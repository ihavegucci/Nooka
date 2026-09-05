// Реестр действий панели. Кнопку рисует таск 01, а обработчик к ней приносит
// свой таск — так параллельные исполнители не делят один файл:
//
//   import { register } from "./commands.js";
//   register("search", openSearch);
//
// Кнопка знает только имя действия. Нет обработчика — плашка «Скоро».

/** Имена кнопок панели в том порядке, в котором они нарисованы. */
export const PANEL_COMMANDS = [
  "search",
  "import",
  "backup",
  "trash",
  "settings",
  "privacy",
];

const handlers = new Map();

export function register(name, fn) {
  handlers.set(name, fn);
}

export function has(name) {
  return handlers.has(name);
}

/**
 * Выполняет действие. Обработчика нет — на document уходит nooka:toast
 * с ключом panel.soon, и его показывает newtab.js.
 */
export function run(name, ctx) {
  const fn = handlers.get(name);
  if (!fn) {
    document.dispatchEvent(
      new CustomEvent("nooka:toast", { detail: { key: "panel.soon" } }),
    );
    return undefined;
  }
  return fn(ctx);
}
