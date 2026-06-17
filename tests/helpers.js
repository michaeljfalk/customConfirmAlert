/** Shared helpers for driving the dialog in tests. */

/** @returns {HTMLElement|null} The live dialog element, if any. */
export function getDialog() {
  return document.querySelector('[data-cd-root] .cd-dialog');
}

/** @returns {HTMLElement|null} */
export function getRoot() {
  return document.querySelector('[data-cd-root]');
}

/** @param {string} sel @returns {HTMLElement|null} */
export function q(sel) {
  const root = getRoot();
  return root ? root.querySelector(sel) : null;
}

/** Click the confirm/primary button. */
export function clickConfirm() {
  /** @type {HTMLButtonElement|null} */ (q('.cd-btn-confirm'))?.click();
}

/** Click the cancel button. */
export function clickCancel() {
  /** @type {HTMLButtonElement|null} */ (q('.cd-btn-cancel'))?.click();
}

/** Click the close (×) button. */
export function clickClose() {
  /** @type {HTMLButtonElement|null} */ (q('.cd-close'))?.click();
}

/** Click the backdrop. */
export function clickBackdrop() {
  q('.cd-backdrop')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/**
 * Dispatch a keydown on the dialog.
 * @param {string} key
 * @param {KeyboardEventInit} [init]
 */
export function pressKey(key, init = {}) {
  const dialog = getDialog();
  if (!dialog) return;
  dialog.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}

/** Set the prompt input value. @param {string} value */
export function typeInput(value) {
  const input = /** @type {HTMLInputElement|null} */ (q('.cd-input'));
  if (input) input.value = value;
}
