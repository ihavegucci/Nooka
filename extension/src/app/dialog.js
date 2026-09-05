// Общий модальный компонент на нативном <dialog>: фокус-трэп, Esc и возврат
// фокуса даёт браузер сам, руками ловится только клик по backdrop. Стили —
// в newtab.css (.dialog, .dialog-field, .dialog-actions, .dialog-error).
//
// Никакого innerHTML — только createElement/textContent, как в render.js.
// Никакого i18n здесь: все тексты (title, submitLabel, cancelLabel) —
// параметры от вызывающего кода, следующий кусок заведёт t().

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Закрывает диалог по клику на сам <dialog> (т.е. на backdrop, не на форму). */
function closeOnBackdrop(dialogEl) {
  dialogEl.addEventListener("click", (event) => {
    if (event.target === dialogEl) dialogEl.close();
  });
}

function mount(dialogEl) {
  document.body.append(dialogEl);
  dialogEl.addEventListener("close", () => {
    // close() снимает [open] и стреляет "close" в тот же тик — если убрать
    // узел прямо здесь, fade-out закрытия из newtab.css (.dialog transition)
    // ни разу не успевает отрисоваться. Ждём конец перехода, с таймером на
    // случай prefers-reduced-motion (там transition:none, transitionend не придёт).
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      dialogEl.remove();
    };
    dialogEl.addEventListener("transitionend", (event) => {
      if (event.target === dialogEl && event.propertyName === "opacity") finish();
    });
    setTimeout(finish, 220);
  });
  dialogEl.showModal();
}

/**
 * Читает значения полей формы в объект { name: value }.
 * Для type="file" отдаёт File | null, для остальных — строку.
 */
function readValues(inputs) {
  const values = {};
  for (const [name, input] of inputs) {
    values[name] = input.type === "file" ? (input.files?.[0] ?? null) : input.value;
  }
  return values;
}

function buildField(field, inputs) {
  const wrap = el("div", "dialog-field");
  const id = `dialog-field-${field.name}-${Math.random().toString(36).slice(2, 8)}`;

  const label = el("label", "dialog-label", field.label);
  label.htmlFor = id;
  wrap.append(label);

  let input;
  if (field.type === "select") {
    input = el("select", "dialog-select");
    for (const opt of field.options ?? []) {
      const isPlain = typeof opt !== "object" || opt === null;
      const value = String(isPlain ? opt : (opt.value ?? opt.label ?? ""));
      const label2 = isPlain ? String(opt) : String(opt.label ?? opt.value ?? "");
      const option = el("option", null, label2);
      option.value = value;
      if (field.value !== undefined && String(field.value) === value) {
        option.selected = true;
      }
      input.append(option);
    }
  } else {
    input = el("input", "dialog-input");
    // Никогда не type="url": браузер сам блокирует отправку формы на своей
    // валидации раньше, чем сработает наш код (а withScheme() в model.js уже
    // терпимо принимает любой ввод, включая адреса без схемы) — заявка «не
    // должно быть невозможно добавить даже невалидную ссылку» была бы нарушена.
    input.type = field.type === "file" ? "file" : "text";
    if (field.type === "file") {
      if (field.accept) input.accept = field.accept;
    } else if (field.value !== undefined) {
      input.value = field.value;
    }
  }

  input.id = id;
  input.name = field.name;
  wrap.append(input);
  inputs.set(field.name, input);
  return wrap;
}

/**
 * Открывает форму. fields: [{ name, label, type: "text"|"url"|"select"|"file",
 * value, options, accept }]. onSubmit(values) может бросить, вернуть false
 * (диалог остаётся открытым молча) или Promise (кнопка блокируется до
 * резолва; реджект — диалог остаётся открытым с ошибкой в .dialog-error).
 */
export function openForm({ title, fields = [], submitLabel, cancelLabel = "Cancel", onSubmit }) {
  const dialogEl = document.createElement("dialog");
  dialogEl.className = "dialog";

  const form = el("form", "dialog-form");
  form.append(el("h2", "dialog-title", title));

  const inputs = new Map();
  for (const field of fields) {
    form.append(buildField(field, inputs));
  }

  const error = el("p", "dialog-error");
  error.hidden = true;
  form.append(error);

  const showError = (err) => {
    error.textContent = err && err.message ? err.message : String(err);
    error.hidden = false;
  };

  const actions = el("div", "dialog-actions");
  const cancelButton = el("button", "dialog-cancel", cancelLabel);
  cancelButton.type = "button";
  cancelButton.addEventListener("click", () => dialogEl.close());

  const submitButton = el("button", "dialog-submit", submitLabel);
  submitButton.type = "submit";

  actions.append(cancelButton, submitButton);
  form.append(actions);
  dialogEl.append(form);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.hidden = true;
    error.textContent = "";

    let result;
    try {
      result = onSubmit ? onSubmit(readValues(inputs)) : undefined;
    } catch (err) {
      showError(err);
      return;
    }

    if (result === false) return;

    if (result && typeof result.then === "function") {
      submitButton.disabled = true;
      result.then(
        (value) => {
          submitButton.disabled = false;
          if (value === false) return;
          dialogEl.close();
        },
        (err) => {
          submitButton.disabled = false;
          showError(err);
        },
      );
      return;
    }

    dialogEl.close();
  });

  closeOnBackdrop(dialogEl);
  mount(dialogEl);
  (form.querySelector("input, select") ?? cancelButton).focus();
}

/**
 * Диалог подтверждения. Возвращает Promise<boolean> (true — подтвердили).
 * danger — кнопка подтверждения красная (.is-danger, токен --danger).
 */
export function openConfirm({ title, text, confirmLabel, cancelLabel = "Cancel", danger = false }) {
  return new Promise((resolve) => {
    const dialogEl = document.createElement("dialog");
    dialogEl.className = "dialog";

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    dialogEl.addEventListener("close", () => finish(false));

    const form = el("form", "dialog-form");
    form.append(el("h2", "dialog-title", title));
    if (text) form.append(el("p", "dialog-text", text));

    const actions = el("div", "dialog-actions");
    const cancelButton = el("button", "dialog-cancel", cancelLabel);
    cancelButton.type = "button";
    cancelButton.addEventListener("click", () => {
      finish(false);
      dialogEl.close();
    });

    const confirmButton = el("button", danger ? "dialog-submit is-danger" : "dialog-submit", confirmLabel);
    confirmButton.type = "button";
    confirmButton.addEventListener("click", () => {
      finish(true);
      dialogEl.close();
    });

    actions.append(cancelButton, confirmButton);
    form.append(actions);
    dialogEl.append(form);

    closeOnBackdrop(dialogEl);
    mount(dialogEl);
    cancelButton.focus();
  });
}
