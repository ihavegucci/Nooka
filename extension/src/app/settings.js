// Настройки и своя картинка темы. Саморегистрируется в реестре commands.js
// при импорте (как это уже сделано с "privacy" в newtab.js) — этому модулю
// не нужен доступ к живому state.store из newtab.js: он сам читает и пишет
// chrome.storage.local через storage.js, а обновление уже открытой вкладки
// приходит бесплатно через onExternalChange (newtab.js уже на него подписан:
// chrome.storage.onChanged стреляет и в том же документе, который сам
// записал изменение).
//
// Никакого innerHTML, никакого нового CSS — вся форма собрана через
// готовый openForm() из dialog.js (поля text/url/select/file).

import { register } from "./commands.js";
import { openForm } from "./dialog.js";
import { t } from "../core/i18n.js";
import { WALLPAPERS } from "./theme.js";
import { load, save } from "./storage.js";
import { emptyStore } from "../core/schema.js";

// Сжимаем, если исходный файл больше ~1.5 МБ; итоговый data:URL длиннее
// ~2 МБ символов не сохраняем вовсе (A02 — иначе один фон съедает всю
// квоту chrome.storage.local).
const RESIZE_ABOVE_BYTES = 1.5 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 2 * 1024 * 1024;
const MAX_EDGE = 1920;

async function currentStore() {
  const result = await load();
  return result.store ?? emptyStore();
}

function boolOptions(lang) {
  return [
    { value: "off", label: t(lang, "settings.off") },
    { value: "on", label: t(lang, "settings.on") },
  ];
}

function wallpaperOptions(lang) {
  return [
    ...WALLPAPERS.map((id) => ({ value: id, label: t(lang, `wallpaper.${id}`) })),
    { value: "custom", label: t(lang, "settings.wallpaper.custom") },
  ];
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image-decode-failed"));
    image.src = src;
  });
}

/** Уменьшает и пережимает картинку через offscreen <canvas> — нативный API. */
async function compress(dataUrl) {
  const image = await loadImage(dataUrl);
  const longest = Math.max(image.naturalWidth, image.naturalHeight) || 1;
  const scale = Math.min(1, MAX_EDGE / longest);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

/**
 * File → data:image/…, уменьшая большие файлы. Бросает Error с переведённым
 * текстом, если файл не читается или итог всё равно слишком большой —
 * dialog.js покажет это как .dialog-error, форма не закроется.
 */
async function toWallpaperDataUrl(file, lang) {
  let dataUrl;
  try {
    dataUrl = await readAsDataURL(file);
  } catch {
    throw new Error(t(lang, "settings.wallpaper.badFile"));
  }

  if (file.size > RESIZE_ABOVE_BYTES) {
    try {
      dataUrl = await compress(dataUrl);
    } catch {
      throw new Error(t(lang, "settings.wallpaper.badFile"));
    }
  }

  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error(t(lang, "settings.wallpaper.tooBig"));
  }

  return dataUrl;
}

/**
 * Применяет только те поля, что реально есть в values — так одна функция
 * годится и для полной формы настроек, и для короткой формы «Фон».
 */
async function submitSettings(store, values) {
  const settings = { ...store.settings };

  if ("lang" in values) settings.lang = values.lang;
  if ("theme" in values) settings.theme = values.theme;
  if ("privacy" in values) settings.privacy = values.privacy === "on";

  if (values.wallpaperFile) {
    settings.customWallpaper = await toWallpaperDataUrl(values.wallpaperFile, settings.lang);
    settings.wallpaper = "custom";
  } else if ("wallpaper" in values) {
    settings.wallpaper = values.wallpaper;
  }

  // save() пишет в chrome.storage.local; уже открытая вкладка подхватит
  // новый store через onExternalChange в newtab.js и перерисуется сама.
  await save({ ...store, settings });
}

async function openSettingsForm() {
  const store = await currentStore();
  const { settings } = store;
  const lang = settings.lang;

  const fields = [
    {
      name: "lang",
      label: t(lang, "settings.lang"),
      type: "select",
      value: settings.lang,
      options: [
        { value: "ru", label: t(lang, "lang.ru") },
        { value: "en", label: t(lang, "lang.en") },
      ],
    },
    {
      name: "theme",
      label: t(lang, "settings.theme"),
      type: "select",
      value: settings.theme,
      options: [
        { value: "dark", label: t(lang, "settings.theme.dark") },
        { value: "light", label: t(lang, "settings.theme.light") },
        { value: "system", label: t(lang, "settings.theme.system") },
      ],
    },
    {
      name: "wallpaper",
      label: t(lang, "panel.wallpaper"),
      type: "select",
      value: settings.wallpaper,
      options: wallpaperOptions(lang),
    },
    {
      name: "wallpaperFile",
      label: t(lang, "settings.wallpaper.upload"),
      type: "file",
      accept: "image/*",
    },
    {
      name: "privacy",
      label: t(lang, "panel.privacy"),
      type: "select",
      value: settings.privacy ? "on" : "off",
      options: boolOptions(lang),
    },
  ];

  openForm({
    title: t(lang, "settings.title"),
    fields,
    submitLabel: t(lang, "settings.save"),
    cancelLabel: t(lang, "dialog.cancel"),
    onSubmit: (values) => submitSettings(store, values),
  });
}

register("settings", () => {
  openSettingsForm();
});
