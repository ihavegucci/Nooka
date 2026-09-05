// Корзина. Саморегистрируется в реестре commands.js под "trash" при импорте —
// тем же приёмом, что settings.js под "settings"/"wallpaper" (кусок 2): этому
// модулю не нужен доступ к живому state.store из newtab.js, он сам читает и
// пишет chrome.storage.local через storage.js, а уже открытая вкладка
// перерисуется сама через onExternalChange (newtab.js уже на него подписан).
//
// «Удалить навсегда» — тривиальный фильтр store.trash по id, поэтому живёт
// прямо здесь, а не в core/model.js: там нет такой операции, а model.js —
// чужая протестированная зона, трогать без реальной находки нельзя (правила
// проекта). Если бы удаление навсегда должно было учитывать что-то ещё
// (например каскад для доски/страницы) — это была бы находка для model.js,
// но restoreFromTrash уже хранит достаточно в entry.data, чтобы просто выбросить
// запись целиком: она самодостаточна, каскада нет.
//
// Список — свой лёгкий <dialog>, а не openForm() (тот рассчитан на поля формы,
// не на список записей с двумя действиями каждая). Стили — те же токены и
// те же переиспользуемые CSS-классы, что уже есть в newtab.css (.dialog*,
// .link-row/.link-actions/.link-title, .icon-btn, .board-empty, .row-info) —
// ни одного своего нового класса (.row-info завёл кусок 10, тоже общий).
// Подтверждение «Удалить навсегда» — уже готовый openConfirm() из dialog.js.
// Никакого innerHTML — только createElement/textContent.

import { register } from "./commands.js";
import { openConfirm } from "./dialog.js";
import { t } from "../core/i18n.js";
import { restoreFromTrash, TRASH_DAYS } from "../core/model.js";
import { emptyStore } from "../core/schema.js";
import { load, save } from "./storage.js";

const KIND_KEY = {
  page: "trash.kind.page",
  board: "trash.kind.board",
  link: "trash.kind.link",
};

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

async function currentStore() {
  const result = await load();
  return result.store ?? emptyStore();
}

/**
 * Сколько дней запись ещё пролежит в корзине, прежде чем её выбросит
 * purgeTrash. Округляется вверх (последний неполный день всё ещё "день"),
 * не уходит в минус — если запись уже просрочена, но purgeTrash её ещё
 * не подчистил (например пока диалог был открыт), это 0, не -1.
 */
export function daysLeft(deletedAt, now = Date.now()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const remaining = TRASH_DAYS * dayMs - (now - deletedAt);
  return Math.max(0, Math.ceil(remaining / dayMs));
}

/**
 * Убирает запись из store.trash немедленно, не дожидаясь purgeTrash/30 дней.
 * Чистая функция над store, как и всё в core/model.js, но живёт тут — см.
 * заметку в шапке файла о том, почему это не полез в model.js.
 */
export function deleteForever(store, trashId) {
  return { ...store, trash: store.trash.filter((entry) => entry.id !== trashId) };
}

function entryTitle(entry) {
  return entry.data?.title ?? "";
}

function kindLabel(lang, kind) {
  const key = KIND_KEY[kind];
  return key ? t(lang, key) : kind;
}

function buildRow(entry, lang, now, handlers) {
  const row = el("div", "link-row");

  // .row-info — общий класс newtab.css (кусок 10): та же раскладка, что даёт
  // .link-row .link настоящей ссылке.
  const info = el("div", "row-info");
  info.append(el("div", "link-title", entryTitle(entry)));
  const caption = `${kindLabel(lang, entry.kind)} · ${t(lang, "trash.daysLeft", { days: daysLeft(entry.deletedAt, now) })}`;
  info.append(el("div", "dialog-label", caption));
  row.append(info);

  const actions = el("div", "link-actions");

  const restore = el("button", "icon-btn", "↺");
  restore.type = "button";
  restore.title = t(lang, "trash.restore");
  restore.setAttribute("aria-label", t(lang, "trash.restore"));
  restore.addEventListener("click", () => handlers.onRestore(entry));

  const removeForever = el("button", "icon-btn is-danger", "✕");
  removeForever.type = "button";
  removeForever.title = t(lang, "trash.deleteForever");
  removeForever.setAttribute("aria-label", t(lang, "trash.deleteForever"));
  removeForever.addEventListener("click", () => handlers.onDeleteForever(entry));

  actions.append(restore, removeForever);
  row.append(actions);
  return row;
}

async function openTrashDialog() {
  let workingStore = await currentStore();
  const lang = workingStore.settings.lang;

  const dialogEl = document.createElement("dialog");
  dialogEl.className = "dialog";

  const wrap = el("div", "dialog-form");
  wrap.append(el("h2", "dialog-title", t(lang, "panel.trash")));

  const listHost = document.createElement("div");
  wrap.append(listHost);

  const actionsRow = el("div", "dialog-actions");
  const closeButton = el("button", "dialog-cancel", t(lang, "dialog.cancel"));
  closeButton.type = "button";
  closeButton.addEventListener("click", () => dialogEl.close());
  actionsRow.append(closeButton);
  wrap.append(actionsRow);

  dialogEl.append(wrap);

  function renderList() {
    while (listHost.firstChild) listHost.firstChild.remove();

    const entries = [...workingStore.trash].sort((a, b) => b.deletedAt - a.deletedAt);
    if (entries.length === 0) {
      listHost.append(el("p", "board-empty", t(lang, "trash.empty")));
      return;
    }

    const now = Date.now();
    for (const entry of entries) {
      listHost.append(
        buildRow(entry, lang, now, {
          onRestore: (e) => handleRestore(e),
          onDeleteForever: (e) => handleDeleteForever(e),
        }),
      );
    }
  }

  // save() пишет в chrome.storage.local; уже открытая вкладка подхватит новый
  // store через onExternalChange в newtab.js и перерисуется сама (draw()) —
  // тут достаточно обновить список внутри этого диалога.
  async function handleRestore(entry) {
    workingStore = restoreFromTrash(workingStore, entry.id, workingStore.settings.activePageId);
    renderList();
    await save(workingStore);
  }

  async function handleDeleteForever(entry) {
    const ok = await openConfirm({
      title: t(lang, "trash.deleteForever.title"),
      text: t(lang, "trash.deleteForever.text", { title: entryTitle(entry) }),
      confirmLabel: t(lang, "trash.deleteForever"),
      cancelLabel: t(lang, "dialog.cancel"),
      danger: true,
    });
    if (!ok) return;
    workingStore = deleteForever(workingStore, entry.id);
    renderList();
    await save(workingStore);
  }

  renderList();
  closeOnBackdrop(dialogEl);
  mount(dialogEl);
  closeButton.focus();
}

register("trash", () => {
  openTrashDialog();
});
