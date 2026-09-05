// Весь DOM новой вкладки. Никакой другой таск этот файл не трогает: кнопки
// панели и пункты меню приходят через реестры, а не через правку разметки.
//
// state = { store } — единица правды целиком, язык берётся из store.settings.
// Никакого innerHTML: любые названия и адреса ставятся через textContent.

import { t } from "../core/i18n.js";
import { PANEL_COMMANDS } from "./commands.js";

// Пространство имён SVG — идентификатор стандарта, а не ссылка: ничего не грузится.
const SVG_NS = "http://www.w3.org/2000/svg";

/** Пороги из истории 59: < 900 — 2 колонки, < 1300 — 3, < 1800 — 4, дальше 5. */
export function columnCount(width) {
  if (width < 900) return 2;
  if (width < 1300) return 3;
  if (width < 1800) return 4;
  return 5;
}

const ICONS = {
  search: ["M9 3a6 6 0 1 0 0 12A6 6 0 0 0 9 3Z", "M13.6 13.6 17 17"],
  import: [
    "M10 3v8",
    "M6.5 8.5 10 12l3.5-3.5",
    "M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2",
  ],
  backup: [
    "M10 12V3",
    "M6.5 6.5 10 3l3.5 3.5",
    "M4 13v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3",
  ],
  trash: ["M4 6h12", "M8 6V4h4v2", "M6 6l.8 10a1 1 0 0 0 1 1h4.4a1 1 0 0 0 1-1L14 6"],
  settings: [
    "M3 6.5h8",
    "M15 6.5h2",
    "M3 13.5h2",
    "M7 13.5h10",
    "M13 5.1a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z",
    "M5 12.1a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z",
  ],
  privacy: [
    "M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5S2.5 10 2.5 10Z",
    "M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  ],
  privacyOff: [
    "M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5S2.5 10 2.5 10Z",
    "M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    "M4 16 16 4",
  ],
  plus: ["M10 5v10", "M5 10h10"],
  edit: [
    "M4 16v-2.2l8.7-8.7a1 1 0 0 1 1.4 0l1.8 1.8a1 1 0 0 1 0 1.4L7.2 16H4Z",
    "M11.3 6l2.7 2.7",
  ],
  // Троеточие меню вкладки (R03) — три точки рисуются как короткие отрезки
  // с круглым stroke-linecap: тот же приём, что уже даёт круглые точки у
  // остальных иконок, без введения заливки/кругов отдельным типом узла.
  kebab: ["M10 5.01v.01", "M10 9.99v.01", "M10 14.99v.01"],
};

function icon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const d of ICONS[name] ?? []) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function slot(name) {
  return document.querySelector(`[data-nooka="${name}"]`);
}

function clear(node) {
  while (node.firstChild) node.firstChild.remove();
}

function roundButton(iconName, label, command) {
  const button = el("button", "round");
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.dataset.command = command;
  button.append(icon(iconName));
  return button;
}

/** Цвет запасного кружка выводится из домена: один домен — всегда один цвет. */
function domainHue(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i += 1) {
    hash = (hash * 31 + domain.charCodeAt(i)) % 360;
  }
  return hash;
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function letterBadge(url) {
  const domain = domainOf(url);
  const badge = el("span", "link-letter", (domain[0] ?? "?").toUpperCase());
  badge.style.background = `hsl(${domainHue(domain)} 52% 46%)`;
  badge.setAttribute("aria-hidden", "true");
  return badge;
}

/**
 * Иконка сайта (второй раунд фидбека, R05): раньше — только локальный API
 * `chrome-extension://…/_favicon/`, который читает исключительно то, что
 * Chrome уже закэшировал из истории профиля. Для домена, ни разу не
 * открытого в этом браузере, этот API не «падает» — он молча отдаёт
 * generic-заглушку с кодом 200 (`onerror` никогда не срабатывает), поэтому
 * запасной путь на letterBadge() физически не мог включиться, и пользователь
 * видел одинаковый серый глобус на всех непосещённых сайтах.
 *
 * Пользователь прямо разрешил сетевой запрос ради рабочих иконок (с оговоркой
 * «будет публиковаться в Chrome Web Store») — переключился на публичный
 * favicon-сервис Google (`www.google.com/s2/favicons`), тот же приём, что у
 * множества опубликованных в CWS расширений-менеджеров закладок: обычный
 * `<img src>` на чужой домен, без `fetch`/XHR и без новых permissions в
 * манифесте. Реальный сетевой сбой (сайт недоступен, домен не резолвится)
 * по-прежнему даёт `onerror` → буква-заглушка, как и раньше.
 */
function faviconImage(url) {
  const img = el("img", "link-icon");
  img.width = 18;
  img.height = 18;
  img.alt = "";
  img.loading = "lazy";
  try {
    const src = new URL("https://www.google.com/s2/favicons");
    src.searchParams.set("sz", "64");
    src.searchParams.set("domain_url", domainOf(url));
    img.src = src.toString();
  } catch {
    return letterBadge(url);
  }
  img.addEventListener("error", () => img.replaceWith(letterBadge(url)), { once: true });
  return img;
}

function activePage(store) {
  return (
    store.pages.find((page) => page.id === store.settings.activePageId) ??
    [...store.pages].sort((a, b) => a.order - b.order)[0] ??
    null
  );
}

/**
 * Лёгкое переключение активной вкладки страницы (кусок 3, R03): никакого
 * createElement/clear() — только перестановка aria-current на уже
 * существующих кнопках `.tab[data-kind="page"]` внутри уже отрисованного
 * `.pages-strip`. CSS-переход на `.tab[aria-current="page"]` (newtab.css)
 * теперь есть от чего анимировать, раз узел не пересоздаётся.
 *
 * Используется только для одного сценария — клика по вкладке ради смены
 * activePageId. Любое изменение состава/порядка/названий страниц (добавили,
 * удалили, переименовали, перетащили, восстановили из корзины, внешнее
 * изменение из другой вкладки) по-прежнему идёт через полный renderPages().
 */
export function setActivePage(pageId) {
  const host = slot("pages");
  if (!host) return;
  for (const tab of host.querySelectorAll('.tab[data-kind="page"]')) {
    if (tab.dataset.id === pageId) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  }
}

// Шестой раунд фидбека: убраны все анимации перерисовки контента (кросс-фейд
// и FLIP ниже) — каждая попытка оживить появление нового содержимого своим
// эффектом (мгновенная непрозрачность у нового + гаснущий оверлей поверх,
// потом симметричный фейд, потом transform: scale() на host) на практике
// давала свой видимый артефакт (просвечивающий фон, «выезжающие» вкладки).
// Пользователь прямо попросил убрать эти анимации, а не искать четвёртый
// вариант — renderPages()/renderBoards() ниже просто мгновенно перерисовывают
// содержимое, без фейда/оверлея/transform. Простой clear()+пересборка не
// может «моргнуть» сам по себе: браузер не рисует кадр между двумя
// синхронными DOM-операциями в одном скрипте.
export function renderPages(state) {
  const host = slot("pages");
  if (!host) return;
  paintPages(state, host);
}

function paintPages(state, host) {
  const { store } = state;
  const lang = store.settings.lang;
  clear(host);

  const strip = el("div", "pages-strip");
  const current = activePage(store);

  for (const page of [...store.pages].sort((a, b) => a.order - b.order)) {
    const wrap = el("div", "tab-wrap");
    const tab = el("button", "tab");
    tab.type = "button";
    tab.draggable = true;
    tab.dataset.kind = "page";
    tab.dataset.id = page.id;
    tab.dataset.page = page.id;
    if (current && page.id === current.id) tab.setAttribute("aria-current", "page");
    // Заголовок — отдельный span (седьмой раунд фидбека, приватный режим):
    // размывается только текст, не вся кнопка целиком. Блюр всей .tab
    // (заливка+форма) при клиппинге со стороны .pages-strip
    // (overflow-x: auto — по спецификации CSS включает и overflow-y: auto,
    // высота строки впритык под сами табы) обрезался жёсткой прямой линией
    // сверху/снизу вместо мягкого растворения — «острые края размытия».
    // У текста то же самое клиппинг-ограничение технически остаётся, но
    // блюр тонкой строки текста визуально не даёт заметного жёсткого среза,
    // в отличие от блюра сплошной закрашенной формы кнопки.
    tab.append(el("span", "tab-label", page.title));
    wrap.append(tab);

    // Переименовать/удалить вкладку (R03, переработка): раньше здесь стояли
    // две кнопки (карандаш + ×), прижатые к тексту вкладки отрицательными
    // margin — на коротких названиях они наезжали друг на друга и на сам
    // текст. Теперь один триггер в обычном потоке .tab-wrap (без наложения),
    // открывающий общее плавающее меню — см. openTabMenu() в newtab.js.
    // Двойной клик по самой вкладке по-прежнему переименовывает напрямую
    // (тот же renamePageDialog()), меню — не единственный путь, а видимый.
    const menuBtn = el("button", "tab-menu-btn");
    menuBtn.type = "button";
    menuBtn.title = t(lang, "page.menu");
    menuBtn.setAttribute("aria-label", t(lang, "page.menu"));
    menuBtn.setAttribute("aria-haspopup", "true");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.dataset.tabMenu = page.id;
    menuBtn.append(icon("kebab"));
    wrap.append(menuBtn);

    strip.append(wrap);
  }

  // Вкладка-призрак (кусок 4, R08): заменяет круглую .tab-add — пунктирный
  // элемент той же формы, что соседние .tab, с плюсом по центру. Тот же
  // data-command="page.add", тот же обработчик в newtab.js.
  const add = el("button", "tab-ghost");
  add.type = "button";
  add.title = t(lang, "page.add");
  add.setAttribute("aria-label", t(lang, "page.add"));
  add.dataset.command = "page.add";
  add.append(icon("plus"));

  host.append(strip, add);
}

/**
 * Карта существующих DOM-узлов досок по id — чтобы paintBoards() мог
 * переиспользовать узел вместо пересоздания (не анимация: пересоздание узла
 * с backdrop-filter заметно дороже для Chromium, чем перестановка того же
 * узла в другую колонку — экономия, а не эффект).
 */
function captureBoardNodes(host) {
  const nodes = new Map();
  for (const board of host.querySelectorAll(".board[data-id]")) {
    nodes.set(board.dataset.id, board);
  }
  return nodes;
}

/**
 * flip: true — вызов из-за перетаскивания доски (dnd.js). Раньше здесь была
 * FLIP-анимация перемещения; шестой раунд фидбека убрал её вместе с
 * кросс-фейдом выше — карточки просто мгновенно переставляются в новую
 * колонку (переиспользуя узел, см. captureBoardNodes) без transform.
 */
export function renderBoards(state, { flip = false } = {}) {
  const host = slot("boards");
  if (!host) return;

  if (flip) {
    const reuse = captureBoardNodes(host);
    paintBoards(state, host, { reuse });
    return;
  }

  paintBoards(state, host);
}

function paintBoards(state, host, { reuse } = {}) {
  const { store } = state;
  const lang = store.settings.lang;
  clear(host);

  const page = activePage(store);
  if (!page) {
    host.append(el("p", "page-empty", t(lang, "empty.store")));
    return;
  }

  const boards = [...page.boards].sort((a, b) => a.order - b.order);
  if (boards.length === 0) {
    const box = el("div", "page-empty");
    box.append(el("p", null, t(lang, "empty.page")));
    const action = el("button", "button", t(lang, "empty.page.action"));
    action.type = "button";
    action.dataset.command = "board.add";
    action.dataset.page = page.id;
    box.append(action);
    host.append(box);
    return;
  }

  const total = columnCount(window.innerWidth);
  const columns = [];
  for (let i = 0; i < total; i += 1) {
    const column = el("div", "column");
    column.dataset.column = String(i);
    column.dataset.page = page.id;
    columns.push(column);
  }

  for (const board of boards) {
    // Колонок стало меньше — доска показывается в последней существующей.
    const index = Math.min(Math.max(board.column ?? 0, 0), total - 1);
    // Переиспользование узла (R05, третий раунд) — только для FLIP-пути
    // (простое перетаскивание, данные доски не меняются): append() того же
    // узла просто переставляет его в другую колонку, не пересоздавая
    // backdrop-filter. Обычный путь (смена вкладки/переименование и т.д.)
    // reuse не передаёт — там состав контента реально может измениться.
    const node = reuse?.get(board.id) ?? boardCard(board, page, lang);
    columns[index].append(node);
  }

  // Страница уже не пустая (ветка выше вернула бы свою кнопку раньше) —
  // добавить ещё одну доску иначе было нечем: доска-призрак (кусок 4, R08) —
  // пунктирный прямоугольник в форме карточки доски, в конец последней
  // колонки, без переделки структуры колонок. Тот же data-command и dataset,
  // что раньше были на круглой .tab-add.
  const addBoard = el("button", "board-ghost");
  addBoard.type = "button";
  addBoard.title = t(lang, "board.add");
  addBoard.setAttribute("aria-label", t(lang, "board.add"));
  addBoard.dataset.command = "board.add";
  addBoard.dataset.page = page.id;
  addBoard.append(icon("plus"));
  columns[total - 1].append(addBoard);

  host.append(...columns);
}

function boardCard(board, page, lang) {
  const card = el("section", "board");
  card.draggable = true;
  card.dataset.kind = "board";
  card.dataset.id = board.id;
  card.dataset.board = board.id;
  card.dataset.page = page.id;

  const head = el("div", "board-head");
  head.append(el("h2", "board-title", board.title));

  const actions = el("div", "board-actions");

  const rename = el("button", "icon-btn");
  rename.type = "button";
  rename.title = t(lang, "action.rename");
  rename.setAttribute("aria-label", t(lang, "action.rename"));
  rename.dataset.command = "board.rename";
  rename.dataset.id = board.id;
  rename.dataset.page = page.id;
  rename.append(icon("edit"));

  const remove = el("button", "icon-btn is-danger");
  remove.type = "button";
  remove.title = t(lang, "action.delete");
  remove.setAttribute("aria-label", t(lang, "action.delete"));
  remove.dataset.command = "board.remove";
  remove.dataset.id = board.id;
  remove.dataset.page = page.id;
  remove.append(icon("trash"));

  const add = el("button", "tab-add");
  add.type = "button";
  add.title = t(lang, "link.add");
  add.setAttribute("aria-label", t(lang, "link.add"));
  add.dataset.command = "link.add";
  add.dataset.board = board.id;
  add.dataset.page = page.id;
  add.append(icon("plus"));

  actions.append(rename, remove, add);
  head.append(actions);
  card.append(head);

  const links = [...board.links].sort((a, b) => a.order - b.order);
  if (links.length === 0) {
    card.append(el("p", "board-empty", t(lang, "empty.board")));
    return card;
  }

  const list = el("ul", "links");
  for (const link of links) {
    const item = el("li", "link-row");
    // Настоящая ссылка: Tab и Enter работают без единой строки кода.
    const anchor = el("a", "link");
    anchor.href = link.url;
    anchor.draggable = true;
    anchor.dataset.kind = "link";
    anchor.dataset.id = link.id;
    anchor.dataset.board = board.id;
    anchor.dataset.page = page.id;
    anchor.append(faviconImage(link.url));
    anchor.append(el("span", "link-title", link.title));
    item.append(anchor);

    const actions = el("div", "link-actions");

    const rename = el("button", "icon-btn");
    rename.type = "button";
    rename.title = t(lang, "action.rename");
    rename.setAttribute("aria-label", t(lang, "action.rename"));
    rename.dataset.command = "link.rename";
    rename.dataset.id = link.id;
    rename.dataset.board = board.id;
    rename.append(icon("edit"));

    const remove = el("button", "icon-btn is-danger");
    remove.type = "button";
    remove.title = t(lang, "action.delete");
    remove.setAttribute("aria-label", t(lang, "action.delete"));
    remove.dataset.command = "link.remove";
    remove.dataset.id = link.id;
    remove.dataset.board = board.id;
    remove.append(icon("trash"));

    actions.append(rename, remove);
    item.append(actions);
    list.append(item);
  }
  card.append(list);
  return card;
}

// Состав панели не меняется в течение сессии (PANEL_COMMANDS — статический
// список) — единственное, что реально может измениться при повторных
// вызовах, это язык (настройки) и состояние кнопки приватности. Полная
// пересборка на КАЖДЫЙ вызов renderPanel() (а он раньше шёл в общем draw()
// после любого действия — переименовал ссылку, добавил доску, что угодно)
// безусловно уничтожала и заново создавала все круглые кнопки — у них
// `backdrop-filter: blur`, пересоздание такого узла заметно дороже для
// Chromium, чем у обычного, и давало вспышку на каждый клик (четвёртый
// раунд фидбека: «моргает всё»). Ниже — построение с нуля только при первом
// вызове или смене языка, иначе точечное обновление одной кнопки.
let panelLang = null;

export function renderPanel(state) {
  const lang = state.store.settings.lang;
  const host = slot("panel");
  if (!host) return;
  const on = state.store.settings.privacy === true;

  if (host.childElementCount === 0 || panelLang !== lang) {
    panelLang = lang;
    clear(host);
    for (const name of PANEL_COMMANDS) {
      if (name === "privacy") {
        const button = roundButton(
          on ? "privacyOff" : "privacy",
          t(lang, on ? "panel.privacyOff" : "panel.privacy"),
          "privacy",
        );
        button.setAttribute("aria-pressed", String(on));
        host.append(button);
        continue;
      }
      host.append(roundButton(name, t(lang, `panel.${name}`), name));
    }
    return;
  }

  const privacyButton = host.querySelector('[data-command="privacy"]');
  if (!privacyButton) return;
  clear(privacyButton);
  privacyButton.append(icon(on ? "privacyOff" : "privacy"));
  const label = t(lang, on ? "panel.privacyOff" : "panel.privacy");
  privacyButton.title = label;
  privacyButton.setAttribute("aria-label", label);
  privacyButton.setAttribute("aria-pressed", String(on));
}

export function renderAll(state) {
  document.documentElement.lang = state.store.settings.lang;
  renderPanel(state);
  renderPages(state);
  renderBoards(state);
}
