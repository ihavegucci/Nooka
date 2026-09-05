// Поиск. Саморегистрируется в реестре commands.js под "search" при импорте —
// тем же приёмом, что trash.js/backup.js/import.js (кусок 5/6/7): этому
// модулю не нужен доступ к живому state.store из newtab.js, он сам читает
// chrome.storage.local через storage.js один раз при открытии — искать по
// живому store вживую на каждый символ не тот масштаб (см. план куска).
//
// Список — свой лёгкий <dialog>, не openForm() (та рассчитана на поля формы
// и одну кнопку сохранить, не на список результатов). Esc и фокус-трэп даёт
// нативный <dialog> сам — сюда руками ничего не добавляется. Каждый результат
// — настоящий <a href>, тот же способ, что уже открывает ссылки в render.js
// (браузер сам ведёт по-настоящему, это не location.href=).
//
// Никакого innerHTML — только createElement/textContent.

import { register } from "./commands.js";
import { t } from "../core/i18n.js";
import { load } from "./storage.js";
import { emptyStore } from "../core/schema.js";

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
 * Плоский список { link, board, page } из store.pages[].boards[].links[],
 * отфильтрованный по подстроке query (регистронезависимо, ищет и в title,
 * и в url). Пустой (или из одних пробелов) query — пустой список: пустой
 * ввод в диалоге не показывает результатов сам по себе (см. renderResults).
 * Чистая функция без DOM/chrome.* — для ручной проверки отдельно от диалога.
 */
export function filterLinks(store, query) {
  const needle = String(query ?? "").trim().toLowerCase();
  const results = [];
  if (!needle) return results;
  for (const page of store.pages) {
    for (const board of page.boards) {
      for (const link of board.links) {
        const title = String(link.title ?? "").toLowerCase();
        const url = String(link.url ?? "").toLowerCase();
        if (title.includes(needle) || url.includes(needle)) {
          results.push({ link, board, page });
        }
      }
    }
  }
  return results;
}

function buildRow(entry) {
  const anchor = document.createElement("a");
  anchor.className = "link-row";
  anchor.href = entry.link.url;

  // .row-info — общий класс newtab.css (кусок 10), тот же, что теперь и в
  // trash.js: та же раскладка, что даёт .link-row .link настоящей ссылке.
  const info = el("div", "row-info");
  info.append(el("div", "link-title", entry.link.title || entry.link.url));
  info.append(el("div", "dialog-label", `${entry.board.title} / ${entry.page.title}`));
  anchor.append(info);
  return anchor;
}

async function openSearchDialog() {
  const store = await currentStore();
  const lang = store.settings.lang;

  const dialogEl = document.createElement("dialog");
  dialogEl.className = "dialog";

  const wrap = el("div", "dialog-form");
  wrap.append(el("h2", "dialog-title", t(lang, "panel.search")));

  const input = document.createElement("input");
  input.type = "search";
  input.className = "dialog-input";
  input.placeholder = t(lang, "search.placeholder");
  input.setAttribute("aria-label", t(lang, "panel.search"));
  wrap.append(input);

  const listHost = document.createElement("div");
  wrap.append(listHost);

  const actionsRow = el("div", "dialog-actions");
  const closeButton = el("button", "dialog-cancel", t(lang, "dialog.cancel"));
  closeButton.type = "button";
  closeButton.addEventListener("click", () => dialogEl.close());
  actionsRow.append(closeButton);
  wrap.append(actionsRow);

  dialogEl.append(wrap);

  function renderResults() {
    while (listHost.firstChild) listHost.firstChild.remove();

    const query = input.value;
    const results = filterLinks(store, query);
    if (results.length === 0) {
      if (query.trim()) {
        listHost.append(el("p", "board-empty", t(lang, "search.empty")));
      }
      return;
    }
    for (const entry of results) {
      listHost.append(buildRow(entry));
    }
  }

  input.addEventListener("input", renderResults);
  // Enter — переход по первому результату. preventDefault не даёт форме (её
  // тут и нет) или странице ничего перезагрузить; сам переход — настоящий
  // клик по <a href>, тот же самый узел, что нарисован в списке.
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const first = listHost.querySelector("a");
    if (first) first.click();
  });
  // Esc не перехватывается: нативный <dialog> закрывается по нему сам,
  // без побочных эффектов.

  renderResults();
  closeOnBackdrop(dialogEl);
  mount(dialogEl);
  input.focus();
}

register("search", () => {
  openSearchDialog();
});
