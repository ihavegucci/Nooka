// Импорт закладок Chrome. Саморегистрируется в реестре commands.js под
// "import" при импорте — тем же приёмом, что settings.js/trash.js/backup.js
// (куски 2/5/6): этому модулю не нужен доступ к живому state.store из
// newtab.js, он сам читает и пишет chrome.storage.local через storage.js, а
// уже открытая вкладка перерисуется сама через onExternalChange (newtab.js
// уже на него подписан).
//
// "bookmarks" — optional_permissions в manifest.json (кусок 7 их не меняет,
// они уже объявлены): chrome.permissions.request() вызывается только по
// клику, никогда заранее. Отказ пользователя — тост, не ошибка.
//
// chrome.permissions.request() должен быть вызван синхронно в ответ на жест
// пользователя: register()/run() в commands.js вызывают обработчик прямо из
// click-слушателя newtab.js, а этот обработчик — async function, чьё тело
// выполняется синхронно вплоть до первого await, поэтому запрос разрешения —
// самая первая строка, без await перед ней.
//
// Своя лёгкая форма выбора папки — через openForm() из dialog.js (готовые
// поля "select" + "text"), а не отдельный второй шаг: подпись доски
// предзаполняется из названия папки и синхронизируется с выбором папки, пока
// пользователь не начал редактировать её сам (dialog.js не даёт onChange-крючок
// для полей формы, поэтому слушатели навешаны прямо на DOM уже смонтированного
// диалога — mount() внутри openForm() добавляет <dialog> в document
// синхронно, до возврата из openForm()).
//
// Тост — общий CustomEvent "nooka:toast" (слушатель в newtab.js), тем же
// путём, что settings.js/backup.js. Кусок 10 научил этот слушатель принимать
// detail.vars и прокидывать их в t(lang(), key, vars) — до этого {count} в
// "import.success" подставить было нечем, и здесь стоял свой локальный тост.

import { register } from "./commands.js";
import { openForm } from "./dialog.js";
import { t } from "../core/i18n.js";
import { addBoard, addLink, isDuplicate } from "../core/model.js";
import { emptyStore } from "../core/schema.js";
import { load, save } from "./storage.js";

function toast(key, vars) {
  document.dispatchEvent(new CustomEvent("nooka:toast", { detail: { key, vars } }));
}

/** Лист закладки: узел с url http(s):// (javascript:/place: и т.п. пропускаем). */
function isBookmark(node) {
  return typeof node.url === "string" && /^https?:/i.test(node.url);
}

/** Папка: узел chrome.bookmarks с массивом children (даже пустым). */
function isFolder(node) {
  return Array.isArray(node.children);
}

/** Число закладок внутри папки, считая рекурсивно по всем вложенным подпапкам. */
function countLeaves(node) {
  if (!isFolder(node)) return isBookmark(node) ? 1 : 0;
  let total = 0;
  for (const child of node.children) total += countLeaves(child);
  return total;
}

/** Плоский список папок дерева, включая вложенные. Пропускает технический
 *  корневой узел Chrome (id "0", без осмысленного title) — но не его прямых
 *  детей ("Панель закладок", "Другие закладки" и т.п.), у них title есть. */
function collectFolders(node, out) {
  if (!isFolder(node)) return;
  const title = String(node.title ?? "").trim();
  if (title) out.push({ id: node.id, title, count: countLeaves(node), node });
  for (const child of node.children) collectFolders(child, out);
}

function collectAllFolders(roots) {
  const out = [];
  for (const root of roots) collectFolders(root, out);
  return out;
}

/** Рекурсивно собирает закладки-листья папки (включая вложенные подпапки). */
function collectLeaves(node, out) {
  if (isFolder(node)) {
    for (const child of node.children) collectLeaves(child, out);
  } else if (isBookmark(node)) {
    out.push({ url: node.url, title: node.title });
  }
}

/** addBoard() не возвращает id созданной доски — она всегда добавляется
 *  последней в списке страницы, поэтому после renumber() у неё наибольший
 *  order на этой странице. Ничего больше на этот store в этот момент не
 *  пишет, гонки нет. */
function lastBoardId(store, pageId) {
  const page = store.pages.find((p) => p.id === pageId);
  if (!page) return null;
  const [top] = [...page.boards].sort((a, b) => b.order - a.order);
  return top?.id ?? null;
}

/** Создаёт новую доску из папки закладок и сохраняет. Дубликаты внутри самой
 *  папки не плодятся — isDuplicate проверяется по мере накопления store, не
 *  только против исходного. */
async function importFolder(store, pageId, folderNode, boardTitle) {
  const leaves = [];
  collectLeaves(folderNode, leaves);

  let working = addBoard(store, pageId, boardTitle, 0);
  const boardId = lastBoardId(working, pageId);
  if (!boardId) return;

  let added = 0;
  for (const bookmark of leaves) {
    if (!isDuplicate(working, boardId, bookmark.url)) {
      working = addLink(working, boardId, { url: bookmark.url, title: bookmark.title });
      added += 1;
    }
  }

  await save(working);
  toast("import.success", { count: added });
}

/** Синхронизирует поле "название доски" с выбранной папкой, пока пользователь
 *  не начал редактировать его сам. Читает DOM только что смонтированного
 *  диалога напрямую — dialog.js не даёт onChange-крючок для полей формы. */
function wireBoardTitleSync(folders) {
  const dialogEl = [...document.querySelectorAll("dialog.dialog")].pop();
  if (!dialogEl) return;
  const select = dialogEl.querySelector('select[name="folderId"]');
  const titleInput = dialogEl.querySelector('input[name="boardTitle"]');
  if (!select || !titleInput) return;

  let touched = false;
  titleInput.addEventListener("input", () => {
    touched = true;
  });
  select.addEventListener("change", () => {
    if (touched) return;
    const folder = folders.find((f) => f.id === select.value);
    if (folder) titleInput.value = folder.title;
  });
}

async function openImportForm(store, pageId, folders) {
  const lang = store.settings.lang;

  openForm({
    title: t(lang, "import.title"),
    fields: [
      {
        name: "folderId",
        label: t(lang, "import.folderLabel"),
        type: "select",
        value: folders[0].id,
        options: folders.map((f) => ({ value: f.id, label: `${f.title} (${f.count})` })),
      },
      {
        name: "boardTitle",
        label: t(lang, "quicksave.titleLabel"),
        type: "text",
        value: folders[0].title,
      },
    ],
    submitLabel: t(lang, "import.submit"),
    cancelLabel: t(lang, "dialog.cancel"),
    onSubmit: (values) => {
      const folder = folders.find((f) => f.id === values.folderId);
      if (!folder) return false;
      const boardTitle = values.boardTitle.trim() || folder.title;
      return importFolder(store, pageId, folder.node, boardTitle);
    },
  });

  wireBoardTitleSync(folders);
}

async function handleImport() {
  // Первая строка тела функции — самая первая исполняемая инструкция после
  // клика, без await перед ней (см. заметку в шапке файла).
  let granted = false;
  try {
    granted = await chrome.permissions.request({ permissions: ["bookmarks"] });
  } catch {
    granted = false;
  }
  if (!granted) {
    toast("import.permissionDenied");
    return;
  }

  const [root] = await chrome.bookmarks.getTree();
  const folders = collectAllFolders(root ? [root] : []);
  if (folders.length === 0) return;

  const result = await load();
  const store = result.store ?? emptyStore();
  const pageId = store.pages.some((p) => p.id === store.settings.activePageId)
    ? store.settings.activePageId
    : store.pages[0]?.id;
  if (!pageId) return;

  await openImportForm(store, pageId, folders);
}

register("import", () => {
  handleImport();
});
