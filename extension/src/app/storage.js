// Связь с chrome.storage.local. Ключ, дебаунс и обработку сбоя записи
// не знает никто снаружи.

import { migrate, emptyStore } from "../core/schema.js";

const KEY = "nooka";
const DEBOUNCE_MS = 400;

let timer = null;
let pending = null;
let waiting = [];
// Эхо собственной записи (см. flush()/onExternalChange() ниже): chrome.storage.onChanged
// стреляет и в том же документе, который сам сделал запись — Chrome не
// различает источник события. Без подавления этого эха каждое действие
// (клик по табу, перетаскивание, что угодно) через ~400мс (DEBOUNCE_MS)
// после себя вызывало ещё одну, никак не связанную с самим действием
// полную перерисовку — читалось как необъяснимое моргание всего интерфейса
// (четвёртый раунд фидбека).
let lastWrittenJSON = null;

/**
 * Читает хранилище и поднимает его до текущей схемы.
 * @returns {Promise<{status: "empty"|"ok"|"migrated"|"too-new"|"invalid"|"unreadable",
 *                    store: object|null, from: number|null}>}
 *          "empty" — расширение открыто впервые: интерфейс сеет демо-данные.
 *          "too-new" и "invalid" — перезаписывать прочитанное нельзя.
 */
export async function load() {
  let raw;
  try {
    const bag = await chrome.storage.local.get(KEY);
    raw = bag[KEY];
  } catch {
    return { status: "unreadable", store: null, from: null };
  }
  if (raw === undefined || raw === null) {
    return { status: "empty", store: emptyStore(), from: null };
  }
  return migrate(raw);
}

/**
 * Кладёт store в очередь записи. Несколько вызовов подряд схлопываются
 * в одну запись через 400 мс — перетаскивание не должно бить в хранилище
 * на каждый кадр.
 * @returns {Promise<void>} отклоняется, если запись не удалась (история 86);
 *          данные в памяти при этом целы, повтор — это ещё один save().
 */
export function save(store) {
  pending = store;
  if (timer !== null) clearTimeout(timer);
  return new Promise((resolve, reject) => {
    waiting.push({ resolve, reject });
    timer = setTimeout(flush, DEBOUNCE_MS);
  });
}

async function flush() {
  timer = null;
  const store = pending;
  const listeners = waiting;
  pending = null;
  waiting = [];
  try {
    // Снимок ДО set() — chrome.storage.onChanged для этой же записи может
    // прилететь очень скоро после resolve(), lastWrittenJSON должен быть
    // готов к этому моменту.
    lastWrittenJSON = JSON.stringify(store);
    await chrome.storage.local.set({ [KEY]: store });
    for (const { resolve } of listeners) resolve();
  } catch (error) {
    lastWrittenJSON = null;
    for (const { reject } of listeners) reject(error);
  }
}

/** Изменение из другой вкладки или из popup — чтобы вкладки не расходились. */
export function onExternalChange(cb) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[KEY]) return;
    // Эхо собственной записи (см. комментарий у lastWrittenJSON выше) —
    // сравниваем с тем, что сами только что записали, и не перерисовываем
    // зря. Сброс в null после совпадения — чтобы случайное будущее
    // совпадение (маловероятное, но не невозможное) не подавило реальное
    // внешнее изменение молча.
    const raw = changes[KEY].newValue;
    if (lastWrittenJSON !== null && JSON.stringify(raw) === lastWrittenJSON) {
      lastWrittenJSON = null;
      return;
    }
    const result = migrate(raw);
    if (result.store) cb(result.store);
  });
}

/** @returns {Promise<{bytes: number, quota: number, ratio: number}>} */
export async function usage() {
  const quota = chrome.storage.local.QUOTA_BYTES ?? 10485760;
  try {
    const bytes = await chrome.storage.local.getBytesInUse(KEY);
    return { bytes, quota, ratio: bytes / quota };
  } catch {
    return { bytes: 0, quota, ratio: 0 };
  }
}
