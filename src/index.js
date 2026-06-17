/**
 * @file Public entry point for customConfirmAlert.
 *
 * Exposes the Promise-based API (`customAlert`, `customConfirm`, `customPrompt`)
 * plus the grouped `CustomDialog` object. Owns the single shared modal root and
 * the global dialog queue. Does NOT override window.alert/confirm/prompt.
 */

import { Dialog, VARIANTS } from './dialog.js';
import { dialogQueue } from './queue.js';
import { whenBodyReady } from './utils.js';

/** @type {HTMLElement | null} */
let sharedRoot = null;

/**
 * Lazily create (once) and return the shared modal root element. This is the
 * only persistent side effect the package has on the page.
 * @returns {HTMLElement}
 */
function ensureRoot() {
  if (sharedRoot && document.body.contains(sharedRoot)) return sharedRoot;
  const existing = document.querySelector('[data-cd-root]');
  if (existing) {
    sharedRoot = /** @type {HTMLElement} */ (existing);
    return sharedRoot;
  }
  const root = document.createElement('div');
  root.className = 'cd-root';
  root.setAttribute('data-cd-root', '');
  root.hidden = true;
  document.body.appendChild(root);
  sharedRoot = root;
  return root;
}

/**
 * @typedef {Object} DialogOptions
 * @property {string} [title]
 * @property {string|Node} [message]
 * @property {string} [confirmText]
 * @property {string} [cancelText]
 * @property {'info'|'success'|'warning'|'danger'} [variant]
 * @property {string|Node|false} [icon] - Custom icon (string/Node), or false to hide.
 * @property {boolean} [dismissible] - Show the close (x) button.
 * @property {boolean} [closeOnEscape]
 * @property {boolean} [closeOnBackdrop]
 * @property {'confirm'|'cancel'|'input'|'none'} [defaultFocus]
 * @property {string} [inputType] - For prompt: the <input> type.
 * @property {string} [inputLabel] - For prompt: visible label text.
 * @property {string} [placeholder]
 * @property {string} [defaultValue]
 * @property {(value: any) => (boolean|string|void|Promise<boolean|string|void>)} [validate]
 * @property {(value: any) => (void|Promise<void>)} [onConfirm]
 * @property {boolean} [allowHtml] - Caller is responsible for sanitisation.
 * @property {string} [className] - Extra class on the dialog element.
 * @property {string} [ariaLabel] - Accessible name when no title is given.
 */

/** @type {Required<Pick<DialogOptions, 'variant'|'dismissible'|'closeOnEscape'|'closeOnBackdrop'|'allowHtml'>>} */
const SHARED_DEFAULTS = {
  variant: 'info',
  dismissible: true,
  closeOnEscape: true,
  closeOnBackdrop: false,
  allowHtml: false,
};

/**
 * Merge user options with type-aware defaults and validate the variant.
 * @param {'alert'|'confirm'|'prompt'} type
 * @param {DialogOptions|string} input - A string is treated as the message.
 * @returns {object}
 */
function normalizeOptions(type, input) {
  const raw = typeof input === 'string' ? { message: input } : (input || {});
  const variant = VARIANTS.has(raw.variant) ? raw.variant : SHARED_DEFAULTS.variant;

  /** @type {Record<'alert'|'confirm'|'prompt', any>} */
  const perType = {
    alert: { confirmText: 'OK', defaultFocus: 'confirm' },
    confirm: {
      confirmText: 'OK',
      cancelText: 'Cancel',
      // Destructive dialogs default focus to the safer Cancel button.
      defaultFocus: variant === 'danger' ? 'cancel' : 'confirm',
    },
    prompt: {
      confirmText: 'OK',
      cancelText: 'Cancel',
      defaultFocus: 'input',
      inputType: 'text',
      defaultValue: '',
    },
  };

  return {
    type,
    title: raw.title || '',
    message: raw.message || '',
    variant,
    icon: raw.icon,
    dismissible: raw.dismissible ?? SHARED_DEFAULTS.dismissible,
    closeOnEscape: raw.closeOnEscape ?? SHARED_DEFAULTS.closeOnEscape,
    closeOnBackdrop: raw.closeOnBackdrop ?? SHARED_DEFAULTS.closeOnBackdrop,
    allowHtml: raw.allowHtml ?? SHARED_DEFAULTS.allowHtml,
    className: raw.className || '',
    ariaLabel: raw.ariaLabel,
    confirmText: raw.confirmText ?? perType[type].confirmText,
    cancelText: raw.cancelText ?? perType[type].cancelText,
    defaultFocus: raw.defaultFocus ?? perType[type].defaultFocus,
    onConfirm: raw.onConfirm,
    validate: raw.validate,
    // prompt-only
    inputType: raw.inputType ?? perType[type].inputType,
    inputLabel: raw.inputLabel,
    placeholder: raw.placeholder ?? '',
    defaultValue: raw.defaultValue ?? perType[type].defaultValue,
    invalidMessage: raw.invalidMessage,
    closeLabel: raw.closeLabel,
  };
}

/**
 * Queue and show a dialog of the given type.
 * @param {'alert'|'confirm'|'prompt'} type
 * @param {DialogOptions|string} input
 * @returns {Promise<any>}
 */
function show(type, input) {
  const options = normalizeOptions(type, input);
  return dialogQueue.enqueue(async () => {
    await whenBodyReady();
    const root = ensureRoot();
    const dialog = new Dialog(options, root);
    return dialog.open();
  });
}

/**
 * Show an informational alert with a single dismiss button.
 * @param {DialogOptions|string} options
 * @returns {Promise<void>}
 */
export function customAlert(options) {
  return show('alert', options);
}

/**
 * Ask the user to confirm. Resolves `true` on confirm, `false` otherwise.
 * If `onConfirm` is supplied, resolves `true` only after it succeeds.
 * @param {DialogOptions|string} options
 * @returns {Promise<boolean>}
 */
export function customConfirm(options) {
  return show('confirm', options);
}

/**
 * Prompt for a string. Resolves the entered value, or `null` if cancelled.
 * @param {DialogOptions|string} options
 * @returns {Promise<string|null>}
 */
export function customPrompt(options) {
  return show('prompt', options);
}

/** Grouped API. Mirrors the named exports. */
export const CustomDialog = {
  alert: customAlert,
  confirm: customConfirm,
  prompt: customPrompt,
  /** @returns {number} Dialogs currently waiting in the queue. */
  get queueSize() {
    return dialogQueue.size;
  },
};

export default CustomDialog;
