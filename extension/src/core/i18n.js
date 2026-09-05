// Тексты интерфейса. Ни одной строки для человека не должно быть в разметке —
// всё приходит отсюда. Новый текст = новый ключ в ОБОИХ словарях.
// Чистый модуль: ни chrome.*, ни document.

export const LANGS = ["ru", "en"];

const DICT = {
  ru: {
    "app.name": "Nooka",
    "app.tagline": "Закладки на новой вкладке",

    "lang.ru": "Русский",
    "lang.en": "English",

    "panel.search": "Поиск",
    "panel.import": "Импорт из Chrome",
    "panel.backup": "Импорт / Экспорт",
    "panel.trash": "Корзина",
    "panel.settings": "Настройки",
    "panel.wallpaper": "Фон",
    "panel.privacy": "Скрыть содержимое",
    "panel.privacyOff": "Показать содержимое",
    "panel.soon": "Скоро",

    "page.add": "Новая страница",

    "page.menu": "Меню страницы",

    "board.add": "Новая доска",
    "board.menu": "Меню доски",
    "board.remove.title": "Удалить доску?",
    "board.remove.text": "«{title}» и её ссылки переедут в корзину.",
    "link.add": "Добавить ссылку",
    "link.menu": "Меню ссылки",
    "link.field.url": "Адрес",
    "link.url.required": "Введите адрес",
    "link.remove.title": "Удалить ссылку?",
    "link.remove.text": "«{title}» переедет в корзину.",

    "page.remove.title": "Удалить страницу?",
    "page.remove.text": "«{title}» со всеми досками переедет в корзину.",

    "action.rename": "Переименовать",
    "action.delete": "Удалить",

    "empty.board": "Перетащи сюда ссылку или нажми +",
    "empty.page": "Здесь пока пусто",
    "empty.page.action": "Создать первую доску",
    "empty.store": "Ни одной страницы. Создай первую — кнопкой + в ленте сверху.",

    "trash.daysLeft": "Осталось {days} дн.",
    "trash.empty": "Корзина пуста",
    "trash.restore": "Восстановить",
    "trash.deleteForever": "Удалить навсегда",
    "trash.deleteForever.title": "Удалить навсегда?",
    "trash.deleteForever.text": "«{title}» будет удалено навсегда — это нельзя отменить.",
    "trash.kind.page": "страница",
    "trash.kind.board": "доска",
    "trash.kind.link": "ссылка",

    "backup.download": "Скачать копию",
    "backup.download.hint": "Файл со всеми текущими данными Nooka.",
    "backup.downloadFailed": "Не удалось создать файл копии",
    "backup.upload": "Загрузить копию из файла",
    "backup.restored": "Данные восстановлены из копии",
    "backup.corrupted": "Файл повреждён или это не копия Nooka",
    "backup.tooNew": "Эта копия новее текущей версии Nooka. Обнови расширение, чтобы её открыть.",

    "import.title": "Импорт закладок",
    "import.folderLabel": "Папка закладок",
    "import.submit": "Импортировать",
    "import.permissionDenied": "Нужен доступ к закладкам, чтобы их импортировать",
    "import.success": "Импортировано ссылок: {count}",

    "search.placeholder": "Название или адрес…",
    "search.empty": "Ничего не найдено",

    "error.load.title": "Не удалось прочитать данные",
    "error.load.text":
      "Данные Nooka не читаются. Ничего не перезаписано — можно поднять из копии.",
    "error.load.action": "Загрузить копию из файла",
    "error.tooNew.title": "Данные новее этой версии Nooka",
    "error.tooNew.text":
      "Обнови расширение, чтобы открыть их. Пока обновления нет, данные не перезаписываются.",
    "error.save": "Не удалось сохранить",
    "error.save.retry": "Повторить",

    "demo.page": "Дом",
    "demo.board.social": "Социал",
    "demo.board.work": "Работа",
    "demo.board.fun": "Развлечения",

    "quicksave.titleLabel": "Название",
    "quicksave.boardLabel": "Доска",
    "quicksave.save": "Сохранить",
    "quicksave.saved": "Сохранено в «{board}»",
    "quicksave.blocked": "Эту страницу сохранить нельзя",
    "quicksave.noBoards": "Пока нет ни одной доски",
    "quicksave.openNooka": "Открыть Nooka и создать первую доску",

    "dialog.cancel": "Отмена",

    "settings.title": "Настройки",
    "settings.save": "Сохранить",
    "settings.lang": "Язык",
    "settings.theme": "Тема",
    "settings.theme.dark": "Тёмная",
    "settings.theme.light": "Светлая",
    "settings.theme.system": "Как в системе",
    "settings.wallpaper.custom": "Своя картинка",
    "settings.wallpaper.upload": "Загрузить файл",
    "settings.wallpaper.tooBig": "Файл слишком большой. Выбери другой.",
    "settings.wallpaper.badFile": "Не удалось прочитать файл",
    "settings.frequent": "Часто открываемые",
    "settings.on": "Включено",
    "settings.off": "Выключено",

    "wallpaper.1": "Фиолет",
    "wallpaper.2": "Тропа",
    "wallpaper.3": "Неон",
    "wallpaper.4": "Затмение",
    "wallpaper.5": "Сияние",
    "wallpaper.6": "Алый",
  },
  en: {
    "app.name": "Nooka",
    "app.tagline": "Bookmarks on your new tab",

    "lang.ru": "Русский",
    "lang.en": "English",

    "panel.search": "Search",
    "panel.import": "Import from Chrome",
    "panel.backup": "Import / Export",
    "panel.trash": "Trash",
    "panel.settings": "Settings",
    "panel.wallpaper": "Wallpaper",
    "panel.privacy": "Blur content",
    "panel.privacyOff": "Show content",
    "panel.soon": "Soon",

    "page.add": "New page",

    "page.menu": "Page menu",

    "board.add": "New board",
    "board.menu": "Board menu",
    "board.remove.title": "Delete board?",
    "board.remove.text": "“{title}” and its links will move to Trash.",
    "link.add": "Add link",
    "link.menu": "Link menu",
    "link.field.url": "URL",
    "link.url.required": "Enter a URL",
    "link.remove.title": "Delete link?",
    "link.remove.text": "“{title}” will move to Trash.",

    "page.remove.title": "Delete page?",
    "page.remove.text": "“{title}” and its boards will move to Trash.",

    "action.rename": "Rename",
    "action.delete": "Delete",

    "empty.board": "Drop a link here or press +",
    "empty.page": "Nothing here yet",
    "empty.page.action": "Create the first board",
    "empty.store": "No pages yet. Create one with the + in the strip above.",

    "trash.daysLeft": "{days} days left",
    "trash.empty": "Trash is empty",
    "trash.restore": "Restore",
    "trash.deleteForever": "Delete forever",
    "trash.deleteForever.title": "Delete forever?",
    "trash.deleteForever.text": "“{title}” will be permanently deleted — this can’t be undone.",
    "trash.kind.page": "page",
    "trash.kind.board": "board",
    "trash.kind.link": "link",

    "backup.download": "Download a copy",
    "backup.download.hint": "A file with all of your current Nooka data.",
    "backup.downloadFailed": "Couldn't create the backup file",
    "backup.upload": "Load a backup file",
    "backup.restored": "Data restored from backup",
    "backup.corrupted": "That file is damaged or isn't a Nooka backup",
    "backup.tooNew": "This backup is newer than your Nooka. Update the extension to open it.",

    "import.title": "Import bookmarks",
    "import.folderLabel": "Bookmarks folder",
    "import.submit": "Import",
    "import.permissionDenied": "Nooka needs access to your bookmarks to import them",
    "import.success": "Imported {count} links",

    "search.placeholder": "Title or URL…",
    "search.empty": "Nothing found",

    "error.load.title": "Could not read your data",
    "error.load.text":
      "Nooka data could not be read. Nothing was overwritten — you can restore from a backup.",
    "error.load.action": "Load a backup file",
    "error.tooNew.title": "This data is newer than your Nooka",
    "error.tooNew.text":
      "Update the extension to open it. Until then nothing is overwritten.",
    "error.save": "Could not save",
    "error.save.retry": "Retry",

    "demo.page": "Home",
    "demo.board.social": "Social",
    "demo.board.work": "Work",
    "demo.board.fun": "Fun",

    "quicksave.titleLabel": "Title",
    "quicksave.boardLabel": "Board",
    "quicksave.save": "Save",
    "quicksave.saved": "Saved to “{board}”",
    "quicksave.blocked": "This page can’t be saved",
    "quicksave.noBoards": "No boards yet",
    "quicksave.openNooka": "Open Nooka and create the first board",

    "dialog.cancel": "Cancel",

    "settings.title": "Settings",
    "settings.save": "Save",
    "settings.lang": "Language",
    "settings.theme": "Theme",
    "settings.theme.dark": "Dark",
    "settings.theme.light": "Light",
    "settings.theme.system": "Match system",
    "settings.wallpaper.custom": "Custom photo",
    "settings.wallpaper.upload": "Upload a file",
    "settings.wallpaper.tooBig": "That file is too big. Pick another one.",
    "settings.wallpaper.badFile": "Couldn’t read that file",
    "settings.frequent": "Frequently opened",
    "settings.on": "On",
    "settings.off": "Off",

    "wallpaper.1": "Violet",
    "wallpaper.2": "Trail",
    "wallpaper.3": "Neon",
    "wallpaper.4": "Eclipse",
    "wallpaper.5": "Glow",
    "wallpaper.6": "Scarlet",
  },
};

/** Русский, если язык браузера начинается с ru; иначе английский. */
export function detectLang(navigatorLang) {
  return String(navigatorLang ?? "").toLowerCase().startsWith("ru") ? "ru" : "en";
}

/** Текст по ключу. Неизвестный ключ возвращается как есть — дыра видна сразу. */
export function t(lang, key, vars) {
  const dict = DICT[lang] ?? DICT.en;
  const value = dict[key] ?? DICT.en[key] ?? key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (whole, name) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** Все ключи словаря — на этом стоит тест «наборы ru и en совпадают». */
export function keysOf(lang) {
  return Object.keys(DICT[lang] ?? {});
}
