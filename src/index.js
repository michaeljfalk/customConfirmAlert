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
import { toastManager } from './toast/toast-manager.js';

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

/**
 * @typedef {Object} ChoiceButton
 * @property {string} value - Resolved when this button is clicked.
 * @property {string} text - Button label.
 * @property {'primary'|'danger'|'neutral'|'secondary'} [variant] - Styling. Default: neutral.
 * @property {'cancel'} [role] - Marks the dismiss button (Esc/×/backdrop resolve to it).
 */

/**
 * @typedef {Object} ChoiceOptions
 * @property {string} [title]
 * @property {string|Node} [message]
 * @property {'info'|'success'|'warning'|'danger'} [variant]
 * @property {string|Node|false} [icon]
 * @property {boolean} [allowHtml]
 * @property {boolean} [dismissible]
 * @property {boolean} [closeOnEscape]
 * @property {boolean} [closeOnBackdrop]
 * @property {string} [className]
 * @property {string} [ariaLabel]
 * @property {string} [closeLabel]
 * @property {(value: string|null) => void} [onClose]
 * @property {ChoiceButton[]} buttons - One or more footer buttons, in order.
 * @property {string} [defaultFocus] - A button `value`, or 'cancel'.
 */

/**
 * Build the normalised option object for a choice dialog. Throws synchronously
 * on invalid input (empty `buttons`, multiple `role:'cancel'`) so the public
 * `customChoice` never returns a rejected promise.
 * @param {ChoiceOptions} input
 * @returns {object}
 */
function normalizeChoiceOptions(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const buttons = Array.isArray(raw.buttons) ? raw.buttons : [];
  if (buttons.length === 0) {
    throw new Error('customChoice requires at least one button in `buttons`.');
  }

  let hasCancel = false;
  let cancelValue = null;
  const normButtons = buttons.map((b) => {
    const isCancel = b && b.role === 'cancel';
    if (isCancel) {
      if (hasCancel) {
        throw new Error("customChoice allows at most one button with role:'cancel'.");
      }
      hasCancel = true;
      cancelValue = b.value;
    }
    return {
      value: b.value,
      text: b && b.text != null ? String(b.text) : '',
      variant: b && b.variant,
      role: isCancel ? 'cancel' : undefined,
    };
  });

  const variant = VARIANTS.has(raw.variant) ? raw.variant : SHARED_DEFAULTS.variant;

  return {
    type: 'choice',
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
    closeLabel: raw.closeLabel,
    onClose: raw.onClose,
    buttons: normButtons,
    hasCancel,
    cancelValue,
    // A button `value` or the literal 'cancel'; resolved in Dialog at focus time.
    defaultFocus: raw.defaultFocus,
  };
}

/**
 * Show a dialog with an arbitrary set of buttons (3+ supported) and resolve
 * WHICH button was chosen — for decisions that don't reduce to true/false, e.g.
 * Save / Don't Save / Cancel. Additive: does not affect customConfirm.
 *
 * Resolves the clicked button's `value`. Dismiss (Escape / × / backdrop, where
 * enabled) resolves the role:'cancel' button's value, or `null` if none. Never
 * rejects. Throws synchronously if `buttons` is empty.
 * @param {ChoiceOptions} options
 * @returns {Promise<string|null>}
 */
export function customChoice(options) {
  const normalized = normalizeChoiceOptions(options);
  return dialogQueue.enqueue(async () => {
    await whenBodyReady();
    const root = ensureRoot();
    const dialog = new Dialog(normalized, root);
    return dialog.open();
  });
}

/* ============================ Toast notifications ========================== */
/* Non-modal, non-blocking feedback. Architecturally separate from the modal
 * dialog queue: toasts never lock scrolling, inert content, or trap focus, and
 * dialogs + toasts can be visible at the same time. See src/toast/. */

/**
 * @typedef {Object} ToastAction
 * @property {string} label
 * @property {string} [pendingLabel] - Label shown while an async action runs.
 * @property {boolean} [closeOnSuccess] - Close the toast when the action resolves (default true).
 * @property {() => void | Promise<void>} [onClick]
 */

/**
 * @typedef {Object} ToastOptions
 * @property {string} [id] - Stable id; a repeat call with the same id updates in place.
 * @property {string} [title]
 * @property {string|Node} [message]
 * @property {'info'|'success'|'warning'|'danger'|'neutral'} [variant]
 * @property {string|Node|false} [icon]
 * @property {'top-left'|'top-center'|'top-right'|'bottom-left'|'bottom-center'|'bottom-right'} [position]
 * @property {number} [duration] - Auto-dismiss after N ms (ignored when persistent).
 * @property {boolean} [persistent] - Stay until closed/updated; overrides duration.
 * @property {boolean} [dismissible] - Show the close (×) button.
 * @property {boolean} [pauseOnHover]
 * @property {boolean} [pauseOnFocus]
 * @property {boolean} [showProgress]
 * @property {boolean} [swipeToDismiss]
 * @property {ToastAction} [action]
 * @property {string} [closeLabel]
 * @property {'auto'|'slide-down'|'slide-up'|'slide-left'|'slide-right'|'fade'|'scale'|'none'} [enterAnimation]
 * @property {'auto'|'slide-down'|'slide-up'|'slide-left'|'slide-right'|'fade'|'scale'|'none'} [exitAnimation]
 * @property {'polite'|'assertive'|'off'} [ariaLive]
 * @property {boolean} [allowHtml] - Caller is responsible for sanitisation.
 * @property {string} [className]
 * @property {any} [data]
 * @property {() => void} [onOpen]
 * @property {() => void} [onClose]
 * @property {() => void | Promise<void>} [onAction]
 */

/**
 * @typedef {Object} ToastController
 * @property {string} id
 * @property {(options: Partial<ToastOptions>) => ToastController} update - Update in place.
 * @property {() => Promise<void>} close - Resolves after the exit animation + cleanup.
 * @property {() => boolean} isOpen
 */

/**
 * Show a non-blocking toast notification.
 * @param {ToastOptions|string} options
 * @returns {ToastController}
 */
export function customToast(options) {
  return toastManager.create(options);
}

/**
 * Configure global toast behaviour (limits, overflow policy, defaults).
 * @param {{ maxVisible?: number, overflow?: 'queue'|'dismiss-oldest'|'dismiss-newest', defaultPosition?: ToastOptions['position'], defaultDuration?: number }} config
 * @returns {object} The resolved configuration.
 */
export function configureToasts(config) {
  return toastManager.configure(config);
}

/**
 * Close a toast by id.
 * @param {string} id
 * @returns {Promise<void>}
 */
export function closeToast(id) {
  return toastManager.closeToast(id);
}

/**
 * Get the controller for a live toast by id, or null.
 * @param {string} id
 * @returns {ToastController|null}
 */
export function getToast(id) {
  return toastManager.getToast(id);
}

/**
 * Close all toasts, optionally filtered by position and/or variant.
 * @param {{ position?: ToastOptions['position'], variant?: ToastOptions['variant'] }} [filter]
 * @returns {Promise<void>}
 */
export function closeAllToasts(filter) {
  return toastManager.closeAllToasts(filter);
}

/** Grouped API. Mirrors the named exports (dialogs + toasts). */
export const CustomDialog = {
  // Modal dialogs
  alert: customAlert,
  confirm: customConfirm,
  prompt: customPrompt,
  choose: customChoice,
  /** @returns {number} Dialogs currently waiting in the queue. */
  get queueSize() {
    return dialogQueue.size;
  },
  // Toast notifications
  toast: customToast,
  configureToasts,
  closeToast,
  getToast,
  closeAllToasts,
};

export default CustomDialog;
