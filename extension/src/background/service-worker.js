// Горячая клавиша Alt+Shift+N объявлена в manifest.json как зарезервированное
// имя команды "_execute_action" — по нему Chrome сам открывает
// action.default_popup (popup.html), так же как по клику на иконку. Ради
// этого имени команды chrome.commands.onCommand вообще не вызывается —
// Chrome обрабатывает её сам, без единой строки кода расширения.
//
// Слушатель ниже — задел на случай, если в manifest.json появится ещё одна
// команда с обычным именем: тогда её нужно будет открывать вручную через
// chrome.action.openPopup(). Сейчас он не срабатывает.
//
// Ничего не хранит между вызовами: service worker может выгружаться Chrome
// в любой момент, а модульных переменных с состоянием здесь нет.

chrome.commands.onCommand.addListener((command) => {
  if (command === "_execute_action") return;
  if (typeof chrome.action?.openPopup === "function") {
    chrome.action.openPopup().catch(() => {});
  }
});
