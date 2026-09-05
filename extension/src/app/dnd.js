// Кусок 4: перетаскивание. Делегированные обработчики на document — по
// образцу того, как newtab.js делегирует click/dblclick через
// event.target.closest. Разметка и dataset уже расставлены в render.js
// (draggable="true" на .tab[data-kind="page"], .board[data-kind="board"],
// a.link[data-kind="link"]); moveLink/moveBoard/movePage из core/model.js
// уже полностью готовы — этот модуль только вычисляет index/column/toIndex
// из того, куда бросили элемент, и передаёт их дальше как есть.

import { movePage, moveBoard, moveLink } from "../core/model.js";

/** Какой из трёх перетаскиваемых видов элементов лежит под курсором. */
function closestDraggable(target) {
  if (!target || typeof target.closest !== "function") return null;
  const link = target.closest('a.link[data-kind="link"]');
  if (link) return { kind: "link", id: link.dataset.id, el: link };
  const board = target.closest('.board[data-kind="board"]');
  if (board) return { kind: "board", id: board.dataset.id, el: board };
  const page = target.closest('.tab[data-kind="page"]');
  if (page) return { kind: "page", id: page.dataset.id, el: page };
  return null;
}

/**
 * Колонка, над которой курсор находится по горизонтали, даже если сама
 * `.column` там не встретилась под курсором. Нужна, потому что `.boards`
 * — это `display:flex` строка с `align-items:flex-start`: каждая `.column`
 * высотой ровно в свои карточки, без растяжения на всю высоту ряда. Если в
 * колонке меньше досок (или она вовсе опустела — например, доску только что
 * увели из неё в другую колонку), то область под её последней карточкой (или
 * вся колонка целиком, если досок 0) физически не покрыта элементом
 * `.column` — там курсор попадает на сам `.boards`, и обычный
 * `target.closest(".column")` возвращает null, даже когда визуально курсор
 * явно "над" этой колонкой. Из-за этого доску, уже перемещённую в одну
 * колонку, было невозможно перетащить назад в опустевшую/укоротившуюся
 * колонку — dragover нигде не вызывал preventDefault, и drop не срабатывал.
 * Здесь мы всегда ищем `.boards`-предка и берём ту `.column`, чей
 * горизонтальный диапазон (left..right) содержит clientX, а если курсор
 * левее первой или правее последней колонки — берём крайнюю по X.
 */
function boardColumnAt(target, clientX) {
  if (!target || typeof target.closest !== "function") return null;
  const direct = target.closest(".column");
  if (direct) return direct;
  const boards = target.closest(".boards");
  if (!boards) return null;
  const columns = Array.from(boards.querySelectorAll(":scope > .column"));
  let best = null;
  let bestDist = Infinity;
  for (const column of columns) {
    const rect = column.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right) return column;
    const dist = clientX < rect.left ? rect.left - clientX : clientX - rect.right;
    if (dist < bestDist) {
      bestDist = dist;
      best = column;
    }
  }
  return best;
}

/** Контейнер, над которым сейчас курсор, отдельно для каждого вида. */
function containerFor(kind, event) {
  const target = event.target;
  if (!target || typeof target.closest !== "function") return null;
  if (kind === "link") return target.closest('.board[data-kind="board"]');
  if (kind === "board") return boardColumnAt(target, event.clientX);
  if (kind === "page") return target.closest(".pages-strip");
  return null;
}

/** Индекс вставки среди «остальных» элементов — без самого перетаскиваемого,
 *  так же, как его ждут moveLink/moveBoard/movePage (они сами убирают
 *  элемент из старого места и считают индекс уже по оставшимся). */
function dropIndex(items, draggedItem, coord, axis) {
  let index = 0;
  for (const item of items) {
    if (item === draggedItem) continue;
    const rect = item.getBoundingClientRect();
    const mid = axis === "x" ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
    if (coord > mid) index += 1;
  }
  return index;
}

/**
 * Навешивает делегированные dragstart/dragover/dragleave/drop/dragend на
 * document. getState() должен возвращать тот же объект { store }, что
 * newtab.js хранит в своей модульной области видимости — тогда запись
 * state.store здесь видна и там. draw/persist — те же функции, что уже
 * вызывают остальные обработчики newtab.js после изменения store; drawBoards
 * и drawContent — облегчённая перерисовка только досок (без FLIP-анимации —
 * шестой раунд фидбека её убрал совсем), для перетаскивания доски и ссылки
 * соответственно: состав вкладок не меняется ни в том, ни в другом случае,
 * полный draw() гасил бы их без причины.
 */
export function initDragAndDrop(getState, { draw, drawBoards, drawContent, persist }) {
  let dragData = null; // { kind, id, el }
  let dropTargetEl = null;

  function setDropTarget(el) {
    if (dropTargetEl === el) return;
    if (dropTargetEl) dropTargetEl.classList.remove("drop-target");
    dropTargetEl = el;
    if (dropTargetEl) dropTargetEl.classList.add("drop-target");
  }

  function clearDropTarget() {
    setDropTarget(null);
  }

  function onDragStart(event) {
    const found = closestDraggable(event.target);
    if (!found) return;
    dragData = found;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", found.id);
      } catch {
        // Некоторые окружения запрещают setData вне настоящего drag — не критично.
      }
    }
    found.el.classList.add("is-dragging");
  }

  function onDragOver(event) {
    if (!dragData) return;
    const container = containerFor(dragData.kind, event);
    if (!container) return;
    // Обязательно: без preventDefault браузер не разрешит drop (стандартное
    // поведение HTML5 DnD).
    event.preventDefault();
    setDropTarget(container);
  }

  function onDragLeave(event) {
    if (!dropTargetEl) return;
    if (!dropTargetEl.contains(event.target)) return;
    if (dropTargetEl.contains(event.relatedTarget)) return;
    clearDropTarget();
  }

  function onDrop(event) {
    if (!dragData) return;
    const container = containerFor(dragData.kind, event);
    clearDropTarget();
    if (!container) {
      dragData = null;
      return;
    }
    event.preventDefault();

    const state = getState();
    const store = state.store;
    let next = store;

    if (dragData.kind === "link") {
      const boardId = container.dataset.id;
      const draggedItem = dragData.el.closest(".link-row");
      const items = Array.from(container.querySelectorAll(".links > .link-row"));
      const index = dropIndex(items, draggedItem, event.clientY, "y");
      next = moveLink(store, dragData.id, { boardId, index });
    } else if (dragData.kind === "board") {
      const pageId = container.dataset.page;
      const column = Number(container.dataset.column);
      const items = Array.from(
        container.querySelectorAll(':scope > .board[data-kind="board"]'),
      );
      const index = dropIndex(items, dragData.el, event.clientY, "y");
      next = moveBoard(store, dragData.id, { pageId, column, index });
    } else if (dragData.kind === "page") {
      const draggedItem = dragData.el.closest(".tab-wrap");
      const items = Array.from(container.querySelectorAll(".tab-wrap"));
      const index = dropIndex(items, draggedItem, event.clientX, "x");
      next = movePage(store, dragData.id, index);
    }

    const kind = dragData.kind;
    dragData = null;
    if (!next || next === store) return;
    state.store = next;
    // Перетаскивание доски и ссылки — только перерисовка досок (без анимации,
    // шестой раунд фидбека): в обоих случаях состав вкладок/тема не менялись,
    // полный draw() гасил бы их без причины. Страница по-прежнему идёт через
    // общий draw() — её порядок меняет саму ленту вкладок.
    if (kind === "board" && drawBoards) {
      drawBoards();
    } else if (kind === "link" && drawContent) {
      drawContent();
    } else {
      draw();
    }
    persist();
  }

  function onDragEnd() {
    if (dragData?.el) dragData.el.classList.remove("is-dragging");
    clearDropTarget();
    dragData = null;
  }

  document.addEventListener("dragstart", onDragStart);
  document.addEventListener("dragover", onDragOver);
  document.addEventListener("dragleave", onDragLeave);
  document.addEventListener("drop", onDrop);
  document.addEventListener("dragend", onDragEnd);
}
