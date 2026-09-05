// Popup быстрого сохранения. Каждое открытие читает store заново через
// app/storage.js — между вызовами ничего не хранится (страница popup
// полностью выгружается при закрытии).
//
// Адрес и название вкладки берутся через activeTab (разрешение "tabs" не
// нужно): попап открывается кликом по иконке или горячей клавишей —
// оба события дают временный доступ к активной вкладке.

import { addLink } from "../core/model.js";
import { t, detectLang } from "../core/i18n.js";
import { load, save } from "../app/storage.js";

const BLOCKED_SCHEMES = ["chrome:", "chrome-extension:", "about:", "edge:", "file:", "data:"];

function isBlockedUrl(url) {
  if (!url) return true;
  return BLOCKED_SCHEMES.some((scheme) => url.startsWith(scheme));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function host() {
  return document.querySelector('[data-nooka="popup"]');
}

function clear(node) {
  while (node.firstChild) node.firstChild.remove();
}

async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  } catch {
    return null;
  }
}

/** Доски всех страниц, страница за страницей, с подписью страницы (история 30). */
function allBoards(store) {
  const list = [];
  for (const page of [...store.pages].sort((a, b) => a.order - b.order)) {
    for (const board of [...page.boards].sort((a, b) => a.order - b.order)) {
      list.push({ board, page });
    }
  }
  return list;
}

/** lastBoardId, если такая доска ещё есть; иначе первая доска активной
 *  страницы; иначе первая доска вообще. */
function defaultBoardId(store, boards) {
  const last = store.settings.lastBoardId;
  if (last && boards.some((item) => item.board.id === last)) return last;
  const inActivePage = boards.find((item) => item.page.id === store.settings.activePageId);
  if (inActivePage) return inActivePage.board.id;
  return boards[0]?.board.id ?? null;
}

function renderBlocked(lang) {
  const root = host();
  clear(root);
  root.append(el("p", "qs-message", t(lang, "quicksave.blocked")));
}

function renderNoBoards(lang) {
  const root = host();
  clear(root);
  const box = el("div", "qs-empty");
  box.append(el("p", "qs-message", t(lang, "quicksave.noBoards")));
  const button = el("button", "qs-button", t(lang, "quicksave.openNooka"));
  button.type = "button";
  button.addEventListener("click", () => {
    chrome.tabs.create({});
    window.close();
  });
  box.append(button);
  root.append(box);
}

function renderForm(lang, store, tab, boards) {
  const root = host();
  clear(root);

  const titleField = el("div", "qs-field");
  const titleLabel = el("label", "qs-label", t(lang, "quicksave.titleLabel"));
  titleLabel.htmlFor = "qs-title";
  const titleInput = el("input", "qs-input");
  titleInput.id = "qs-title";
  titleInput.type = "text";
  titleInput.value = tab.title || "";
  titleField.append(titleLabel, titleInput);

  const urlText = el("p", "qs-url", tab.url);

  const boardField = el("div", "qs-field");
  const boardLabel = el("label", "qs-label", t(lang, "quicksave.boardLabel"));
  boardLabel.htmlFor = "qs-board";
  const select = el("select", "qs-select");
  select.id = "qs-board";
  for (const { board, page } of boards) {
    const option = el("option", null, `${board.title} — ${page.title}`);
    option.value = board.id;
    select.append(option);
  }
  select.value = defaultBoardId(store, boards) ?? "";
  boardField.append(boardLabel, select);

  const saveButton = el("button", "qs-button", t(lang, "quicksave.save"));
  saveButton.type = "button";

  const message = el("p", "qs-message");
  message.setAttribute("aria-live", "polite");

  saveButton.addEventListener("click", async () => {
    const boardId = select.value;
    if (!boardId) return;
    saveButton.disabled = true;
    clear(message);

    let next = addLink(store, boardId, { url: tab.url, title: titleInput.value });
    next = { ...next, settings: { ...next.settings, lastBoardId: boardId } };

    try {
      await save(next);
    } catch {
      message.textContent = t(lang, "error.save");
      const retry = el("button", "qs-retry", t(lang, "error.save.retry"));
      retry.type = "button";
      retry.addEventListener("click", () => saveButton.click(), { once: true });
      message.append(retry);
      saveButton.disabled = false;
      return;
    }

    const boardTitle = boards.find((item) => item.board.id === boardId)?.board.title ?? "";
    message.textContent = t(lang, "quicksave.saved", { board: boardTitle });
    setTimeout(() => window.close(), 900);
  });

  root.append(titleField, urlText, boardField, saveButton, message);
  titleInput.focus();
  titleInput.select();
}

async function boot() {
  const [result, tab] = await Promise.all([load(), getActiveTab()]);
  const store = result.store;
  // "empty" — самый первый запуск: emptyStore() ещё не знает язык браузера,
  // тем же способом, что и newtab.js при посеве демо-данных.
  const lang =
    result.status === "empty"
      ? detectLang(navigator.language)
      : (store?.settings.lang ?? detectLang(navigator.language));

  if (!tab || isBlockedUrl(tab.url)) {
    renderBlocked(lang);
    return;
  }
  if (!store) {
    renderNoBoards(lang);
    return;
  }

  const boards = allBoards(store);
  if (boards.length === 0) {
    renderNoBoards(lang);
    return;
  }

  renderForm(lang, store, tab, boards);
}

boot();
