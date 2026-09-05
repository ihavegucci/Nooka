// Точка входа новой вкладки: прочитать данные, нарисовать, слушать.
// Здесь же живут два обещания реестрам: клик по [data-command] уходит
// в commands.run, а клик по ссылке — событием nooka:linkopen на document.

import { demoStore } from "../core/schema.js";
import {
  purgeTrash,
  addPage,
  renamePage,
  removePage,
  addBoard,
  renameBoard,
  removeBoard,
  addLink,
  editLink,
  removeLink,
  findLink,
} from "../core/model.js";
import { detectLang, t } from "../core/i18n.js";
import { load, save, onExternalChange } from "./storage.js";
import { applyTheme } from "./theme.js";
import { renderAll, renderBoards, renderPanel, setActivePage, columnCount } from "./render.js";
import { register, run } from "./commands.js";
import { openForm, openConfirm } from "./dialog.js";
import { initDragAndDrop } from "./dnd.js";
// Кусок 2: settings.js саморегистрирует "settings" в commands.js на верхнем
// уровне при импорте — этой строке достаточно, чтобы модуль загрузился хоть
// раз. Больше он newtab.js ничего не трогает и ничего от него не требует
// (сам ходит в storage.js за store).
import "./settings.js";
// Кусок 5: trash.js саморегистрирует "trash" в commands.js на верхнем уровне
// при импорте — тем же приёмом, что settings.js строкой выше. Сам ходит в
// storage.js за store, от newtab.js ему больше ничего не нужно.
import "./trash.js";
// Кусок 6: backup.js саморегистрирует "backup" в commands.js на верхнем уровне
// при импорте — тем же приёмом. Это та самая команда, которую уже рисует
// кнопка экрана ошибки чтения ниже (showScreen(..., "backup")) — до этого
// импорта она никуда не была подключена.
import "./backup.js";
// Кусок 7: import.js саморегистрирует "import" в commands.js на верхнем
// уровне при импорте — тем же приёмом. Сам ходит в storage.js за store и
// chrome.bookmarks/chrome.permissions за закладками, от newtab.js ему больше
// ничего не нужно.
import "./import.js";
// Кусок 8: search.js саморегистрирует "search" в commands.js на верхнем
// уровне при импорте — тем же приёмом. Сам ходит в storage.js за store,
// от newtab.js ему больше ничего не нужно.
import "./search.js";

/** Единица правды вкладки. Меняют её только функции core/model.js. */
const state = { store: null };
let columns = columnCount(window.innerWidth);

function lang() {
  return state.store?.settings.lang ?? "en";
}

function draw() {
  closeTabMenu();
  applyTheme(state.store.settings);
  renderAll(state);
}

/** Перерисовка только досок после перетаскивания доски внутри той же
 *  страницы, вместо полного draw() — состав вкладок и тема не меняются,
 *  трогать их незачем. `{ flip: true }` (render.js) переиспользует
 *  существующие DOM-узлы досок вместо пересоздания — не анимация (шестой
 *  раунд фидбека убрал анимацию перемещения совсем), а экономия на
 *  backdrop-filter. */
function drawBoards() {
  renderBoards(state, { flip: true });
}

/**
 * Перерисовка только досок — для правок доски/ссылки (добавить/
 * переименовать/удалить): состав страниц, настройки и панель при этом не
 * меняются вовсе. Раньше все эти действия шли через общий draw(), который
 * заодно гасил/зажигал ВСЮ ленту вкладок и безусловно пересоздавал все
 * круглые кнопки панели (backdrop-filter) — четвёртый раунд фидбека: «всё
 * моргает» на каждое обычное действие, а не только на переключение вкладок.
 */
function drawContent() {
  closeTabMenu();
  renderBoards(state);
}

/** Записать. Сбой записи — плашка с повтором, данные в памяти целы (история 86). */
function persist() {
  save(state.store).catch(() => {
    toast(t(lang(), "error.save"), { label: t(lang(), "error.save.retry"), run: persist });
  });
}

function toast(text, action) {
  const host = document.querySelector('[data-nooka="toasts"]');
  if (!host) return;
  const box = document.createElement("div");
  box.className = "toast";
  const label = document.createElement("span");
  label.textContent = text;
  box.append(label);
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      box.remove();
      action.run();
    });
    box.append(button);
  }
  host.append(box);
  setTimeout(() => box.remove(), 4000);
}

/** Экран вместо белой страницы, когда данные не прочитались (история 88). */
function showScreen(titleKey, textKey, actionKey, command) {
  const host = document.querySelector('[data-nooka="boards"]');
  if (!host) return;
  host.replaceChildren();
  const screen = document.createElement("div");
  screen.className = "screen";
  const title = document.createElement("h1");
  title.className = "screen-title";
  title.textContent = t(lang(), titleKey);
  const text = document.createElement("p");
  text.className = "screen-text";
  text.textContent = t(lang(), textKey);
  screen.append(title, text);
  if (actionKey) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button";
    button.textContent = t(lang(), actionKey);
    button.dataset.command = command;
    screen.append(button);
  }
  host.append(screen);
}

// --- действия таска 01 в реестре -------------------------------------------

register("privacy", () => {
  state.store = {
    ...state.store,
    settings: { ...state.store.settings, privacy: !state.store.settings.privacy },
  };
  // Приватность (глаз) — только CSS-класс .is-private на <body> (applyTheme)
  // и смена иконки/aria-pressed на самой кнопке (renderPanel). Раньше здесь
  // был общий draw(), который зря пересобирал табы И доски целиком —
  // единственное, что реально меняется, — это фильтр blur и вид одной
  // кнопки; полная пересборка была источником лишнего мигания (R03).
  applyTheme(state.store.settings);
  renderPanel(state);
  persist();
});

/** model.js не экспортирует поиск доски саму по себе (только через findBoard
 *  внутри mapBoard/removeBoard) — небольшой локальный поиск для форм. */
function findBoardById(store, boardId) {
  for (const page of store.pages) {
    const board = page.boards.find((b) => b.id === boardId);
    if (board) return { board, page };
  }
  return null;
}

/** redraw — какую перерисовку запустить после сохранения: полный draw() по
 *  умолчанию (страницы), либо облегчённый drawContent() для правок доски/
 *  ссылки (см. вызовы ниже) — состав страниц эти правки не меняют. */
function renameForm(title, currentValue, onSave, redraw = draw) {
  openForm({
    title,
    fields: [{ name: "title", label: t(lang(), "quicksave.titleLabel"), type: "text", value: currentValue }],
    submitLabel: t(lang(), "quicksave.save"),
    cancelLabel: t(lang(), "dialog.cancel"),
    onSubmit: (values) => {
      const next = values.title.trim();
      if (!next) return false;
      onSave(next);
      redraw();
      persist();
    },
  });
}

function removeConfirm(titleKey, textKey, itemTitle, onConfirm, redraw = draw) {
  openConfirm({
    title: t(lang(), titleKey),
    text: t(lang(), textKey, { title: itemTitle }),
    confirmLabel: t(lang(), "action.delete"),
    cancelLabel: t(lang(), "dialog.cancel"),
    danger: true,
  }).then((ok) => {
    if (!ok) return;
    onConfirm();
    redraw();
    persist();
  });
}

// --- страницы -----------------------------------------------------------

register("page.add", () => {
  renameForm(t(lang(), "page.add"), "", (title) => {
    state.store = addPage(state.store, title);
  });
});

register("page.remove", (ctx) => {
  const page = state.store.pages.find((p) => p.id === ctx.page);
  if (!page) return;
  removeConfirm("page.remove.title", "page.remove.text", page.title, () => {
    state.store = removePage(state.store, page.id);
  });
});

/** Общий путь переименования страницы — кнопка-карандаш на вкладке (кусок 2)
 *  и двойной клик по самой вкладке ведут сюда же, а не в две параллельные
 *  копии одной и той же формы. */
function renamePageDialog(pageId) {
  const page = state.store.pages.find((p) => p.id === pageId);
  if (!page) return;
  renameForm(t(lang(), "action.rename"), page.title, (title) => {
    state.store = renamePage(state.store, page.id, title);
  });
}

register("page.rename", (ctx) => {
  renamePageDialog(ctx.page);
});

// --- меню вкладки страницы (R03) --------------------------------------------
// Один переиспользуемый плавающий узел вместо пары иконок, наложенных прямо
// на вкладку: см. обоснование в render.js рядом с созданием .tab-menu-btn.

let tabMenuEl = null;

function ensureTabMenu() {
  if (tabMenuEl) return tabMenuEl;
  const menu = document.createElement("div");
  menu.className = "tab-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;

  const rename = document.createElement("button");
  rename.type = "button";
  rename.className = "tab-menu-item";
  rename.setAttribute("role", "menuitem");
  rename.dataset.command = "page.rename";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "tab-menu-item is-danger";
  remove.setAttribute("role", "menuitem");
  remove.dataset.command = "page.remove";

  menu.append(rename, remove);
  document.body.append(menu);
  tabMenuEl = menu;
  return menu;
}

function closeTabMenu() {
  if (tabMenuEl) tabMenuEl.hidden = true;
  const btn = document.querySelector('.tab-menu-btn[aria-expanded="true"]');
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function openTabMenu(button, pageId) {
  const menu = ensureTabMenu();
  const rename = menu.querySelector('[data-command="page.rename"]');
  const remove = menu.querySelector('[data-command="page.remove"]');
  rename.textContent = t(lang(), "action.rename");
  rename.dataset.page = pageId;
  remove.textContent = t(lang(), "action.delete");
  remove.dataset.page = pageId;

  const rect = button.getBoundingClientRect();
  menu.style.left = `${Math.round(rect.left)}px`;
  menu.style.top = `${Math.round(rect.bottom + 6)}px`;
  menu.hidden = false;
  button.setAttribute("aria-expanded", "true");
}

function toggleTabMenu(button, pageId) {
  const alreadyOpenForThis =
    tabMenuEl && !tabMenuEl.hidden && button.getAttribute("aria-expanded") === "true";
  closeTabMenu();
  if (!alreadyOpenForThis) openTabMenu(button, pageId);
}

function onDblClick(event) {
  const tab = event.target.closest('.tab[data-kind="page"]');
  if (!tab) return;
  renamePageDialog(tab.dataset.id);
}

// --- доски ----------------------------------------------------------------

register("board.add", (ctx) => {
  const pageId = ctx.page;
  if (!pageId) return;
  renameForm(t(lang(), "board.add"), "", (title) => {
    state.store = addBoard(state.store, pageId, title, 0);
  }, drawContent);
});

register("board.rename", (ctx) => {
  const found = findBoardById(state.store, ctx.id);
  if (!found) return;
  renameForm(t(lang(), "action.rename"), found.board.title, (title) => {
    state.store = renameBoard(state.store, ctx.id, title);
  }, drawContent);
});

register("board.remove", (ctx) => {
  const found = findBoardById(state.store, ctx.id);
  if (!found) return;
  removeConfirm("board.remove.title", "board.remove.text", found.board.title, () => {
    state.store = removeBoard(state.store, ctx.id);
  }, drawContent);
});

// --- ссылки -----------------------------------------------------------------

function linkForm(title, values, onSave) {
  openForm({
    title,
    fields: [
      { name: "title", label: t(lang(), "quicksave.titleLabel"), type: "text", value: values.title },
      { name: "url", label: t(lang(), "link.field.url"), type: "url", value: values.url },
    ],
    submitLabel: t(lang(), "quicksave.save"),
    cancelLabel: t(lang(), "dialog.cancel"),
    onSubmit: (formValues) => {
      if (!formValues.url || !formValues.url.trim()) {
        throw new Error(t(lang(), "link.url.required"));
      }
      onSave(formValues);
      // Ссылка не меняет состав страниц — drawContent() (только доски),
      // не общий draw() (см. drawContent выше).
      drawContent();
      persist();
    },
  });
}

register("link.add", (ctx) => {
  const boardId = ctx.board;
  if (!boardId) return;
  linkForm(t(lang(), "link.add"), { title: "", url: "" }, (values) => {
    state.store = addLink(state.store, boardId, { url: values.url, title: values.title });
  });
});

register("link.rename", (ctx) => {
  const found = findLink(state.store, ctx.id);
  if (!found) return;
  linkForm(t(lang(), "action.rename"), { title: found.link.title, url: found.link.url }, (values) => {
    state.store = editLink(state.store, ctx.id, { url: values.url, title: values.title });
  });
});

register("link.remove", (ctx) => {
  const found = findLink(state.store, ctx.id);
  if (!found) return;
  removeConfirm("link.remove.title", "link.remove.text", found.link.title, () => {
    state.store = removeLink(state.store, ctx.id);
  }, drawContent);
});

// --- слушатели --------------------------------------------------------------

function onClick(event) {
  const menuToggle = event.target.closest("[data-tab-menu]");
  if (menuToggle) {
    event.preventDefault();
    event.stopPropagation();
    toggleTabMenu(menuToggle, menuToggle.dataset.tabMenu);
    return;
  }

  // Клик где угодно за пределами открытого меню и его кнопки-триггера —
  // закрыть меню, но не мешать остальной обработке клика (например, по
  // другой вкладке или по пункту самого меню — у него тоже [data-command]).
  if (!event.target.closest(".tab-menu")) closeTabMenu();

  const commander = event.target.closest("[data-command]");
  if (commander) {
    event.preventDefault();
    if (commander.closest(".tab-menu")) closeTabMenu();
    run(commander.dataset.command, { ...commander.dataset, element: commander });
    return;
  }

  const tab = event.target.closest('.tab[data-kind="page"]');
  if (tab) {
    if (tab.dataset.id === state.store.settings.activePageId) return;
    state.store = {
      ...state.store,
      settings: { ...state.store.settings, activePageId: tab.dataset.id },
    };
    // Смена активной страницы — единственный сценарий, где не нужен полный
    // draw(): состав вкладок не изменился, только какая из них активна, и
    // контент доски. renderPanel/applyTheme от активной страницы не зависят,
    // setActivePage() не трогает DOM вкладок вовсе (кусок 3, R03) — только
    // переставляет aria-current, поэтому CSS-переход теперь проигрывается.
    setActivePage(tab.dataset.id);
    renderBoards(state);
    persist();
    return;
  }

  // Ссылка остаётся настоящей ссылкой: браузер откроет её сам,
  // а событие подхватит тот, кому нужна статистика.
  const link = event.target.closest('a[data-kind="link"]');
  if (link) {
    document.dispatchEvent(
      new CustomEvent("nooka:linkopen", {
        detail: {
          url: link.href,
          linkId: link.dataset.id,
          boardId: link.dataset.board,
          pageId: link.dataset.page,
        },
      }),
    );
  }
}

function onResize() {
  const next = columnCount(window.innerWidth);
  if (next === columns) return;
  columns = next;
  renderBoards(state);
}

function onKeydown(event) {
  if (event.key === "Escape" && tabMenuEl && !tabMenuEl.hidden) {
    const btn = document.querySelector('.tab-menu-btn[aria-expanded="true"]');
    closeTabMenu();
    btn?.focus();
  }
}

function wire() {
  document.addEventListener("click", onClick);
  document.addEventListener("dblclick", onDblClick);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("nooka:toast", (event) => {
    const key = event.detail?.key;
    // detail.vars (кусок 10) — те же {name} из t(), что подставляются в форму
    // и подтверждение; до этого import.js не мог отдать сюда {count} и вёл
    // свой локальный тост рядом.
    if (key) toast(t(lang(), key, event.detail?.vars));
  });
  window.addEventListener("resize", onResize);
  onExternalChange((store) => {
    state.store = store;
    draw();
  });
  // Кусок 4: dnd.js сам вычисляет index/column/toIndex из того, куда бросили
  // элемент, и вызывает move*/draw/persist — тут только передать доступ к
  // модульному состоянию.
  initDragAndDrop(() => state, { draw, drawBoards, drawContent, persist });
}

async function boot() {
  const result = await load();

  if (result.status === "too-new") {
    showScreen("error.tooNew.title", "error.tooNew.text", null, null);
    return;
  }
  if (result.status === "invalid" || result.status === "unreadable") {
    showScreen("error.load.title", "error.load.text", "error.load.action", "backup");
    document.addEventListener("click", onClick);
    return;
  }

  if (result.status === "empty") {
    state.store = demoStore(detectLang(navigator.language));
    draw();
    persist();
  } else {
    const purged = purgeTrash(result.store, Date.now());
    state.store = purged;
    draw();
    if (purged !== result.store || result.status === "migrated") persist();
  }

  wire();
}

boot();
