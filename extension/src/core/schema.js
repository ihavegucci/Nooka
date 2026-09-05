import { addPage, addBoard, addLink } from "./model.js";
import { t } from "./i18n.js";

// Форма данных Nooka, значения по умолчанию и переходы между версиями.
// Чистый модуль: ни chrome.*, ни document, ни импортов из app/.

export const SCHEMA_VERSION = 1;

/** Пустое хранилище: ни одной страницы, настройки по умолчанию. */
export function emptyStore() {
  return {
    schema: SCHEMA_VERSION,
    pages: [],
    settings: {
      lang: "en",
      theme: "dark",
      wallpaper: "5",
      customWallpaper: null,
      privacy: false,
      activePageId: null,
      frequentEnabled: true,
      lastBoardId: null,
      seededDemo: false,
    },
    stats: {},
    statsExcluded: [],
    trash: [],
  };
}

/**
 * Первый запуск: страница с тремя досками-примерами (история 25, кусок 2:
 * контент заменён по прямому указанию пользователя — R01).
 * settings.seededDemo остаётся в схеме (его читают тесты и восстановление
 * из корзины), но у него больше нет переключателя в интерфейсе.
 */
export function demoStore(lang = "en", now = Date.now()) {
  const boards = [
    ["demo.board.social", [
      ["ВКонтакте", "https://vk.com/"],
      ["Авито", "https://www.avito.ru/"],
      ["Pinterest", "https://www.pinterest.com/"],
    ]],
    ["demo.board.work", [
      ["Яндекс Почта", "https://mail.yandex.ru/"],
      ["Яндекс Диск", "https://disk.yandex.ru/"],
    ]],
    ["demo.board.fun", [
      ["RUTUBE", "https://rutube.ru/"],
      ["Яндекс Дзен", "https://dzen.ru/"],
    ]],
  ];

  let store = addPage(emptyStore(), t(lang, "demo.page"));
  const pageId = store.pages[0].id;

  boards.forEach(([titleKey, links], column) => {
    store = addBoard(store, pageId, t(lang, titleKey), column);
    const boardId = store.pages[0].boards.at(-1).id;
    for (const [title, url] of links) {
      store = addLink(store, boardId, { title, url }, now);
    }
  });

  return {
    ...store,
    settings: { ...store.settings, lang, activePageId: pageId, seededDemo: true },
  };
}

/**
 * Проверка формы прочитанного объекта.
 * @returns {{ ok: boolean, errors: string[] }} коды ошибок, не тексты:
 *          текст для человека выбирает интерфейс через i18n.
 */
export function validate(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["not-an-object"] };
  }
  if (typeof raw.schema !== "number") errors.push("schema-not-number");
  if (!Array.isArray(raw.pages)) errors.push("pages-not-array");
  return { ok: errors.length === 0, errors };
}

/**
 * Поднимает прочитанное хранилище до текущей версии.
 * @returns {{ status: "ok"|"migrated"|"too-new"|"invalid", store: object|null, from: number|null }}
 *          "too-new" — данные новее расширения: перезаписывать их нельзя.
 */
export function migrate(raw) {
  const check = validate(raw);
  if (!check.ok) return { status: "invalid", store: null, from: null };

  const from = raw.schema;
  if (from > SCHEMA_VERSION) return { status: "too-new", store: null, from };

  const base = emptyStore();
  const store = {
    ...base,
    ...raw,
    schema: SCHEMA_VERSION,
    settings: { ...base.settings, ...(raw.settings || {}) },
  };

  const filled =
    from !== SCHEMA_VERSION ||
    Object.keys(base).some((key) => !(key in raw)) ||
    Object.keys(base.settings).some((key) => !(key in (raw.settings || {})));

  return { status: filled ? "migrated" : "ok", store, from };
}
