// Резервная копия. Саморегистрируется в реестре commands.js под "backup" при
// импорте — тем же приёмом, что settings.js/trash.js: этому модулю не нужен
// доступ к живому state.store из newtab.js (который у него и так недоступен —
// register() отдаёт обработчику только { ...dataset, element }), он сам читает
// и пишет chrome.storage.local через storage.js. Это же снимает вопрос
// "а что если state.store ещё null" — модуль его никогда и не трогает: он
// зовёт load() заново, и на экране ошибки чтения это просто ещё раз вернёт
// store: null (скачивать нечего, кнопка «Скачать» неактивна), а «Загрузить»
// работает всегда, потому что ей чужой store не нужен вообще.
//
// Кнопка "backup" уже рисуется newtab.js:showScreen() на экране ошибки чтения
// (история 88) — до этого файла она никуда не была подключена (находка
// R04i.4). Обычный путь — кнопка на панели инструментов (PANEL_COMMANDS в
// commands.js уже включает "backup").
//
// Список из двух независимых действий в одном окне — свой лёгкий <dialog>,
// а не openForm() (тот рассчитан на одну форму с одним onSubmit, а тут скачать
// и восстановить не связаны и не должны закрывать/блокировать друг друга).
// Стили — только уже существующие классы (.dialog*, .icon-btn и т.п. не
// нужны), новых классов в newtab.css это не требует.
//
// location.reload() ниже — не общий паттерн проекта (обычно onExternalChange
// сам перерисовывает уже открытую вкладку), а точечное решение именно для
// восстановления, вызванного с экрана ошибки чтения: там newtab.js так и не
// дошёл до wire() (нет подписки на onExternalChange, нет живого state), так что
// самый простой надёжный способ показать восстановленные данные — перезагрузить
// newtab.html. Когда диалог открыт с обычной панели, состояние уже живое и
// подписано на onExternalChange, поэтому там достаточно тоста без перезагрузки.

import { register } from "./commands.js";
import { t, detectLang } from "../core/i18n.js";
import { migrate } from "../core/schema.js";
import { load, save } from "./storage.js";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function closeOnBackdrop(dialogEl) {
  dialogEl.addEventListener("click", (event) => {
    if (event.target === dialogEl) dialogEl.close();
  });
}

function mount(dialogEl) {
  document.body.append(dialogEl);
  dialogEl.addEventListener("close", () => dialogEl.remove());
  dialogEl.showModal();
}

/** Экран ошибки чтения рисует newtab.js:showScreen() как .screen внутри
 *  [data-nooka="boards"] — тот же единственный признак, что и в разметке
 *  showScreen(), больше нигде это не проверяется. Только чтение DOM, ничего
 *  в newtab.js для этого менять не нужно. */
function isErrorScreen() {
  return !!document.querySelector('[data-nooka="boards"] .screen');
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function todayStamp(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Blob + <a download>, без chrome.downloads — разрешение не нужно (A решение
 *  из плана). Клик программный, ссылка временная. */
function downloadStore(store) {
  const json = JSON.stringify(store, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nooka-backup-${todayStamp()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Файл → store текущей схемы. Битый JSON — ожидаемый путь, не баг: ловится
 * тут же, до вызова migrate() (migrate принимает уже разобранный объект).
 * @returns {Promise<{ok: true} | {ok: false, errorKey: string}>}
 */
async function restoreFromFile(file) {
  let text;
  try {
    text = await readAsText(file);
  } catch {
    return { ok: false, errorKey: "backup.corrupted" };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errorKey: "backup.corrupted" };
  }

  const result = migrate(parsed);
  if (result.status === "invalid") return { ok: false, errorKey: "backup.corrupted" };
  if (result.status === "too-new") return { ok: false, errorKey: "backup.tooNew" };

  // status: "ok" | "migrated" — save() пишет в chrome.storage.local; на
  // обычной панели это подхватит onExternalChange уже открытой вкладки,
  // на экране ошибки чтения дальше явно перезагрузим страницу.
  await save(result.store);
  return { ok: true };
}

async function openBackupDialog() {
  const result = await load();
  const store = result.store ?? null;
  const lang = store?.settings?.lang ?? detectLang(navigator.language);

  const dialogEl = document.createElement("dialog");
  dialogEl.className = "dialog";

  const wrap = el("div", "dialog-form");
  wrap.append(el("h2", "dialog-title", t(lang, "panel.backup")));

  const error = el("p", "dialog-error");
  error.hidden = true;
  const showError = (msg) => {
    error.textContent = msg;
    error.hidden = false;
  };

  // --- скачать -------------------------------------------------------------
  const downloadField = el("div", "dialog-field");
  downloadField.append(el("label", "dialog-label", t(lang, "backup.download.hint")));
  const downloadButton = el("button", "dialog-submit", t(lang, "backup.download"));
  downloadButton.type = "button";
  downloadButton.disabled = !store;
  downloadButton.addEventListener("click", () => {
    error.hidden = true;
    if (!store) return;
    try {
      downloadStore(store);
    } catch {
      showError(t(lang, "backup.downloadFailed"));
    }
  });
  downloadField.append(downloadButton);
  wrap.append(downloadField);

  // --- загрузить -------------------------------------------------------------
  const uploadField = el("div", "dialog-field");
  const uploadLabel = el("label", "dialog-label", t(lang, "backup.upload"));
  uploadField.append(uploadLabel);
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json";
  fileInput.className = "dialog-input";
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    error.hidden = true;
    fileInput.disabled = true;
    const outcome = await restoreFromFile(file);
    fileInput.disabled = false;
    fileInput.value = "";

    if (!outcome.ok) {
      showError(t(lang, outcome.errorKey));
      return;
    }

    if (isErrorScreen()) {
      location.reload();
      return;
    }

    document.dispatchEvent(
      new CustomEvent("nooka:toast", { detail: { key: "backup.restored" } }),
    );
    dialogEl.close();
  });
  uploadField.append(fileInput);
  wrap.append(uploadField);

  wrap.append(error);

  const actions = el("div", "dialog-actions");
  const closeButton = el("button", "dialog-cancel", t(lang, "dialog.cancel"));
  closeButton.type = "button";
  closeButton.addEventListener("click", () => dialogEl.close());
  actions.append(closeButton);
  wrap.append(actions);

  dialogEl.append(wrap);
  closeOnBackdrop(dialogEl);
  mount(dialogEl);
  closeButton.focus();
}

register("backup", () => {
  openBackupDialog();
});
