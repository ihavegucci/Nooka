// Все изменения данных Nooka. Каждая функция берёт store и возвращает НОВЫЙ store;
// исходный никогда не меняется. Чистый модуль: ни chrome.*, ни document.

/** Сколько дней элемент лежит в корзине, прежде чем исчезнуть сам. */
export const TRASH_DAYS = 30;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function newId(prefix) {
  let tail = "";
  for (let i = 0; i < 6; i += 1) {
    tail += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return prefix + tail;
}

/** Список по возрастанию order — порядок хранится числом, не позицией в массиве. */
function sorted(list) {
  return [...list].sort((a, b) => a.order - b.order);
}

/** Переписывает order по позиции в переданном списке: 0, 1, 2…
 *  Список уже должен идти в нужном порядке — сортировкой занимается sorted(). */
function renumber(list) {
  return list.map((item, i) => (item.order === i ? item : { ...item, order: i }));
}

function withPages(store, pages) {
  return { ...store, pages };
}

function mapPage(store, pageId, fn) {
  return withPages(
    store,
    store.pages.map((page) => (page.id === pageId ? fn(page) : page)),
  );
}

function mapBoard(store, boardId, fn) {
  return withPages(
    store,
    store.pages.map((page) =>
      page.boards.some((board) => board.id === boardId)
        ? { ...page, boards: page.boards.map((b) => (b.id === boardId ? fn(b) : b)) }
        : page,
    ),
  );
}

function findBoard(store, boardId) {
  for (const page of store.pages) {
    const board = page.boards.find((b) => b.id === boardId);
    if (board) return { board, page };
  }
  return null;
}

/** Адрес без схемы дополняется до https:// (история 8). */
function withScheme(url) {
  const value = String(url ?? "").trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
}

/** Название по умолчанию — хост без www. */
function titleFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

/** Ключ сравнения адресов: регистр схемы и хоста и хвостовой «/» не считаются. */
function urlKey(url) {
  const value = withScheme(url);
  try {
    const parsed = new URL(value);
    const rest = value.slice(parsed.origin.length);
    return (parsed.origin.toLowerCase() + rest).replace(/\/$/, "");
  } catch {
    return value.toLowerCase().replace(/\/$/, "");
  }
}

// --- страницы ---------------------------------------------------------------

export function addPage(store, title) {
  const page = { id: newId("p_"), title, order: store.pages.length, boards: [] };
  return withPages(store, renumber([...sorted(store.pages), page]));
}

export function renamePage(store, pageId, title) {
  return mapPage(store, pageId, (page) => ({ ...page, title }));
}

export function removePage(store, pageId, now = Date.now()) {
  const page = store.pages.find((p) => p.id === pageId);
  if (!page) return store;
  const next = withPages(
    store,
    renumber(sorted(store.pages).filter((p) => p.id !== pageId)),
  );
  return toTrash(next, "page", page, now, { pageId: null, boardId: null, order: page.order });
}

export function movePage(store, pageId, toIndex) {
  const list = sorted(store.pages);
  const from = list.findIndex((p) => p.id === pageId);
  if (from === -1) return store;
  const [page] = list.splice(from, 1);
  list.splice(clamp(toIndex, 0, list.length), 0, page);
  return withPages(store, renumber(list));
}

// --- доски ------------------------------------------------------------------

export function addBoard(store, pageId, title, column = 0) {
  const page = store.pages.find((p) => p.id === pageId);
  if (!page) return store;
  const board = {
    id: newId("b_"),
    title,
    order: page.boards.length,
    column,
    links: [],
  };
  return mapPage(store, pageId, (p) => ({ ...p, boards: renumber([...sorted(p.boards), board]) }));
}

export function renameBoard(store, boardId, title) {
  return mapBoard(store, boardId, (board) => ({ ...board, title }));
}

export function removeBoard(store, boardId, now = Date.now()) {
  const found = findBoard(store, boardId);
  if (!found) return store;
  const next = mapPage(store, found.page.id, (page) => ({
    ...page,
    boards: renumber(sorted(page.boards).filter((b) => b.id !== boardId)),
  }));
  return toTrash(next, "board", found.board, now, {
    pageId: found.page.id,
    boardId: null,
    order: found.board.order,
  });
}

/** target: { pageId, column, index } — index считается внутри своей колонки. */
export function moveBoard(store, boardId, target) {
  const found = findBoard(store, boardId);
  if (!found) return store;
  const pageId = target.pageId ?? found.page.id;
  if (!store.pages.some((p) => p.id === pageId)) return store;

  const column = target.column ?? found.board.column ?? 0;
  const moved = { ...found.board, column };

  let next = mapPage(store, found.page.id, (page) => ({
    ...page,
    boards: page.boards.filter((b) => b.id !== boardId),
  }));

  next = mapPage(next, pageId, (page) => {
    const rest = sorted(page.boards);
    const inColumn = rest.filter((b) => b.column === column);
    const others = rest.filter((b) => b.column !== column);
    inColumn.splice(clamp(target.index ?? inColumn.length, 0, inColumn.length), 0, moved);
    const columns = [...new Set([...others, ...inColumn].map((b) => b.column))].sort(
      (a, b) => a - b,
    );
    const laid = columns.flatMap((col) =>
      col === column ? inColumn : others.filter((b) => b.column === col),
    );
    return { ...page, boards: renumber(laid) };
  });

  return next;
}

// --- ссылки -----------------------------------------------------------------

export function addLink(store, boardId, { url, title }, now = Date.now()) {
  const found = findBoard(store, boardId);
  if (!found) return store;
  const full = withScheme(url);
  const link = {
    id: newId("l_"),
    title: String(title ?? "").trim() || titleFromUrl(full),
    url: full,
    order: found.board.links.length,
    createdAt: now,
  };
  return mapBoard(store, boardId, (board) => ({
    ...board,
    links: renumber([...sorted(board.links), link]),
  }));
}

export function editLink(store, linkId, { url, title }) {
  const found = findLink(store, linkId);
  if (!found) return store;
  const full = url === undefined ? found.link.url : withScheme(url);
  const name = title === undefined ? found.link.title : String(title).trim();
  return mapBoard(store, found.board.id, (board) => ({
    ...board,
    links: board.links.map((l) =>
      l.id === linkId ? { ...l, url: full, title: name || titleFromUrl(full) } : l,
    ),
  }));
}

export function removeLink(store, linkId, now = Date.now()) {
  const found = findLink(store, linkId);
  if (!found) return store;
  const next = mapBoard(store, found.board.id, (board) => ({
    ...board,
    links: renumber(sorted(board.links).filter((l) => l.id !== linkId)),
  }));
  return toTrash(next, "link", found.link, now, {
    pageId: found.page.id,
    boardId: found.board.id,
    order: found.link.order,
  });
}

/** target: { boardId, index } */
export function moveLink(store, linkId, target) {
  const found = findLink(store, linkId);
  if (!found) return store;
  const boardId = target.boardId ?? found.board.id;
  if (!findBoard(store, boardId)) return store;

  let next = mapBoard(store, found.board.id, (board) => ({
    ...board,
    links: board.links.filter((l) => l.id !== linkId),
  }));

  next = mapBoard(next, boardId, (board) => {
    const list = sorted(board.links);
    list.splice(clamp(target.index ?? list.length, 0, list.length), 0, found.link);
    return { ...board, links: renumber(list) };
  });

  return withPages(
    next,
    next.pages.map((page) => ({
      ...page,
      boards: page.boards.map((b) =>
        b.id === found.board.id ? { ...b, links: renumber(sorted(b.links)) } : b,
      ),
    })),
  );
}

export function findLink(store, linkId) {
  for (const page of store.pages) {
    for (const board of page.boards) {
      const link = board.links.find((l) => l.id === linkId);
      if (link) return { link, board, page };
    }
  }
  return null;
}

export function isDuplicate(store, boardId, url) {
  const found = findBoard(store, boardId);
  if (!found) return false;
  const key = urlKey(url);
  return found.board.links.some((link) => urlKey(link.url) === key);
}

// --- корзина ----------------------------------------------------------------

function toTrash(store, kind, data, deletedAt, from) {
  const entry = { id: newId("t_"), kind, data, deletedAt, from };
  return { ...store, trash: [...store.trash, entry] };
}

/**
 * Возвращает элемент туда, откуда он был удалён. Если родителя больше нет —
 * кладёт в конец страницы fallbackPageId (история 21).
 */
export function restoreFromTrash(store, trashId, fallbackPageId = null) {
  const entry = store.trash.find((t) => t.id === trashId);
  if (!entry) return store;
  const without = { ...store, trash: store.trash.filter((t) => t.id !== trashId) };

  if (entry.kind === "page") {
    const list = sorted(without.pages);
    list.splice(clamp(entry.from.order, 0, list.length), 0, entry.data);
    return withPages(without, renumber(list));
  }

  const fallbackPage =
    without.pages.find((p) => p.id === fallbackPageId) ?? without.pages[0] ?? null;

  if (entry.kind === "board") {
    const page =
      without.pages.find((p) => p.id === entry.from.pageId) ?? fallbackPage;
    if (!page) return store;
    return mapPage(without, page.id, (p) => ({
      ...p,
      boards: renumber([...sorted(p.boards), entry.data]),
    }));
  }

  if (entry.kind === "link") {
    const board =
      findBoard(without, entry.from.boardId)?.board ?? sorted(fallbackPage?.boards ?? [])[0];
    if (!board) return store;
    return mapBoard(without, board.id, (b) => ({
      ...b,
      links: renumber([...sorted(b.links), entry.data]),
    }));
  }

  return without;
}

/** Выбрасывает всё, что пролежало в корзине дольше TRASH_DAYS. */
export function purgeTrash(store, now = Date.now()) {
  const limit = TRASH_DAYS * 24 * 60 * 60 * 1000;
  const kept = store.trash.filter((entry) => now - entry.deletedAt < limit);
  return kept.length === store.trash.length ? store : { ...store, trash: kept };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
