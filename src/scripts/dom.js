export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export function setText(selector, value, root = document) {
  const el = qs(selector, root);
  if (el) el.textContent = value ?? '';
}

export function show(selector, visible = true, root = document) {
  const el = qs(selector, root);
  if (el) el.hidden = !visible;
}

export function setBusy(form, busy) {
  if (!form) return;
  qsa('button, input, select, textarea', form).forEach((el) => {
    el.disabled = Boolean(busy);
  });
  form.setAttribute('aria-busy', busy ? 'true' : 'false');
}

export function readForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}
