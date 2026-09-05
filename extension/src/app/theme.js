// Тема и фон. Всё оформление живёт в CSS-переменных: здесь только выбор
// значения data-theme на <html> и id фона на слое обоев.

/** Встроенные фоны — файлы картинок extension/assets/1.jpg…6.jpg (десятый
 * раунд: раньше это были градиентные «темы», теперь ровно 6 картинок; путь
 * на файл — в newtab.css). "5" — фон по умолчанию (emptyStore() в schema.js). */
export const WALLPAPERS = ["1", "2", "3", "4", "5", "6"];

const DARK_QUERY = "(prefers-color-scheme: dark)";
let systemWatcher = null;

/**
 * Применяет тему, фон и режим «глаз».
 * theme: "dark" | "light" | "system" — «Как в системе» слушает
 * prefers-color-scheme и перекрашивает сразу, без перезагрузки.
 */
export function applyTheme(settings) {
  const root = document.documentElement;
  const media = window.matchMedia(DARK_QUERY);

  if (systemWatcher) {
    media.removeEventListener("change", systemWatcher);
    systemWatcher = null;
  }

  const paint = () => {
    const theme =
      settings.theme === "system"
        ? media.matches
          ? "dark"
          : "light"
        : settings.theme === "light"
          ? "light"
          : "dark";
    root.dataset.theme = theme;
  };

  paint();
  if (settings.theme === "system") {
    systemWatcher = paint;
    media.addEventListener("change", systemWatcher);
  }

  const layer = document.querySelector('[data-nooka="wallpaper"]');
  const id = WALLPAPERS.includes(settings.wallpaper) ? settings.wallpaper : "5";
  if (layer) {
    // "custom" не совпадает ни с одним .wallpaper[data-wallpaper="…"] в
    // newtab.css — картинку задаёт только инлайн-стиль ниже.
    layer.dataset.wallpaper = settings.wallpaper === "custom" ? "custom" : id;
    const custom = settings.customWallpaper;
    const own =
      settings.wallpaper === "custom" &&
      typeof custom === "string" &&
      custom.startsWith("data:image/");
    // Только data:image — ни одной ссылки наружу даже из настроек (R03).
    layer.style.backgroundImage = own ? `url("${custom.replace(/["'\\)]/g, "")}")` : "";
  }

  // Каждый встроенный фон несёт свой акцент (кнопки перестают быть всегда
  // зелёными); своя картинка и «без фона» держат фирменный фиолетовый —
  // это читает tokens.css через :root[data-wallpaper="…"].
  root.dataset.wallpaper = settings.wallpaper === "custom" ? "custom" : id;

  document.body.classList.toggle("is-private", settings.privacy === true);
}
