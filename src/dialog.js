/**
 * @file Dialog rendering and the per-dialog state machine (open → submit →
 * loading/error → close). Knows nothing about queueing or the public API shape.
 */

import { FocusTrap } from './focus.js';
import {
  generateId,
  setContent,
  scrollLock,
  isPromise,
} from './utils.js';
import { buildVariantIcon as buildIcon, buildSpinner, buildCloseIcon } from './icons.js';

/** @typedef {'info' | 'success' | 'warning' | 'danger'} Variant */
/** @typedef {'alert' | 'confirm' | 'prompt' | 'choice'} DialogType */
/** @typedef {'confirm' | 'cancel' | 'input' | 'none'} DefaultFocus */
/** @typedef {{ value: string, text: string, variant?: 'primary'|'danger'|'neutral'|'secondary', role?: 'cancel' }} ChoiceButton */

const VARIANTS = new Set(['info', 'success', 'warning', 'danger']);

/**
 * Map a choice button's `variant` to the matching `.cd-btn-*` style class,
 * reusing the existing dialog button styling. Unknown/omitted → neutral.
 * @param {ChoiceButton['variant']} [variant]
 * @returns {string}
 */
function choiceButtonClass(variant) {
  switch (variant) {
    case 'primary':
      return 'cd-btn-primary';
    case 'danger':
      return 'cd-btn-danger';
    case 'secondary':
      return 'cd-btn-secondary';
    case 'neutral':
    default:
      return 'cd-btn-neutral';
  }
}

/**
 * One modal dialog. Construct, call {@link Dialog#open}, await the returned
 * promise. The instance fully cleans up after itself on close.
 */
export class Dialog {
  /**
   * @param {object} options - Normalised options (see normalizeOptions in index.js).
   * @param {HTMLElement} root - The shared, persistent modal root element.
   */
  constructor(options, root) {
    /** @type {any} */
    this.options = options;
    /** @type {HTMLElement} */
    this.root = root;
    /** @type {DialogType} */
    this.type = options.type;

    this.settled = false; // resolution guard — prevents double-resolve
    this.pending = false; // async work in flight — prevents double-submit
    /** @type {((value: any) => void) | null} */
    this._resolve = null;

    /** @type {FocusTrap | null} */
    this.focusTrap = null;

    this.titleId = generateId('cd-title');
    this.descId = generateId('cd-desc');
    this.errorId = generateId('cd-error');
    this.inputId = generateId('cd-input');

    /** @type {Record<string, HTMLElement>} */
    this.els = {};
    this.onKeydown = this.handleKeydown.bind(this);
    this.onBackdrop = this.handleBackdrop.bind(this);
  }

  /**
   * Render and show the dialog.
   * @returns {Promise<any>} Resolves with the dialog result when closed.
   */
  open() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this.build();
      scrollLock.lock();
      this.root.setAttribute('data-cd-open', '');
      this.root.hidden = false;

      this.focusTrap = new FocusTrap(this.els.dialog);
      this.focusTrap.activate(this.getInitialFocus());

      this.els.backdrop.addEventListener('click', this.onBackdrop);
      this.els.dialog.addEventListener('keydown', this.onKeydown);
    });
  }

  /** Construct the dialog DOM and attach it to the root viewport. */
  build() {
    const o = this.options;

    const backdrop = document.createElement('div');
    backdrop.className = 'cd-backdrop';
    backdrop.setAttribute('data-cd-backdrop', '');

    const viewport = document.createElement('div');
    viewport.className = 'cd-viewport';

    const dialog = document.createElement('div');
    dialog.className = `cd-dialog cd-variant-${o.variant}`;
    if (o.className) dialog.className += ` ${o.className}`;
    dialog.setAttribute('role', o.type === 'alert' ? 'alertdialog' : 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('tabindex', '-1');

    // --- Icon -------------------------------------------------------------
    if (o.icon !== false) {
      const iconWrap = document.createElement('div');
      iconWrap.className = 'cd-icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      if (o.icon && typeof o.icon === 'object' && o.icon.nodeType) {
        iconWrap.appendChild(o.icon);
      } else if (typeof o.icon === 'string') {
        iconWrap.textContent = o.icon; // treat custom string as plain text/emoji
      } else {
        iconWrap.appendChild(buildIcon(o.variant));
      }
      dialog.appendChild(iconWrap);
    }

    const content = document.createElement('div');
    content.className = 'cd-content';

    // --- Title ------------------------------------------------------------
    if (o.title) {
      const title = document.createElement('h2');
      title.className = 'cd-title';
      title.id = this.titleId;
      setContent(title, o.title, o.allowHtml);
      content.appendChild(title);
      dialog.setAttribute('aria-labelledby', this.titleId);
    } else {
      dialog.setAttribute('aria-label', o.ariaLabel || 'Dialog');
    }

    // --- Message ----------------------------------------------------------
    if (o.message) {
      const message = document.createElement('div');
      message.className = 'cd-message';
      message.id = this.descId;
      setContent(message, o.message, o.allowHtml);
      content.appendChild(message);
      dialog.setAttribute('aria-describedby', this.descId);
    }

    // --- Prompt input -----------------------------------------------------
    if (o.type === 'prompt') {
      const field = document.createElement('div');
      field.className = 'cd-field';

      const label = document.createElement('label');
      label.className = 'cd-input-label';
      label.htmlFor = this.inputId;
      label.textContent = o.inputLabel || o.placeholder || 'Input';
      // Visually hidden when there is already a message; still read by AT.
      if (!o.inputLabel) label.classList.add('cd-visually-hidden');

      const input = document.createElement('input');
      input.className = 'cd-input';
      input.id = this.inputId;
      input.type = o.inputType || 'text';
      input.placeholder = o.placeholder || '';
      input.value = o.defaultValue != null ? String(o.defaultValue) : '';
      input.setAttribute('aria-describedby', this.errorId);
      input.autocomplete = 'off';

      field.appendChild(label);
      field.appendChild(input);
      content.appendChild(field);
      this.els.input = input;
    }

    // --- Error region (live) ---------------------------------------------
    const error = document.createElement('div');
    error.className = 'cd-error';
    error.id = this.errorId;
    error.setAttribute('role', 'alert');
    error.hidden = true;
    content.appendChild(error);

    dialog.appendChild(content);

    // --- Dismiss (x) button ----------------------------------------------
    if (o.dismissible) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'cd-close';
      close.setAttribute('aria-label', o.closeLabel || 'Close');
      close.appendChild(buildCloseIcon(20));
      close.addEventListener('click', () => this.cancel());
      dialog.appendChild(close);
      this.els.close = close;
    }

    // --- Footer / buttons -------------------------------------------------
    const footer = document.createElement('div');
    footer.className = 'cd-footer';

    if (o.type === 'choice') {
      this.buildChoiceButtons(footer);
    } else {
      if (o.type !== 'alert') {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'cd-btn cd-btn-cancel';
        cancelBtn.textContent = o.cancelText;
        cancelBtn.addEventListener('click', () => this.cancel());
        footer.appendChild(cancelBtn);
        this.els.cancelBtn = cancelBtn;
      }

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = `cd-btn cd-btn-confirm cd-btn-${o.variant}`;
      const confirmLabel = document.createElement('span');
      confirmLabel.className = 'cd-btn-label';
      confirmLabel.textContent = o.confirmText;
      confirmBtn.appendChild(confirmLabel);
      confirmBtn.addEventListener('click', () => this.submit());
      footer.appendChild(confirmBtn);
      this.els.confirmBtn = confirmBtn;
      this.els.confirmLabel = confirmLabel;
    }

    dialog.appendChild(footer);

    viewport.appendChild(dialog);

    // Mount: backdrop + viewport into the persistent root.
    this.root.textContent = '';
    this.root.appendChild(backdrop);
    this.root.appendChild(viewport);

    this.els.backdrop = backdrop;
    this.els.viewport = viewport;
    this.els.dialog = dialog;
    this.els.error = error;
    this.els.footer = footer;
  }

  /**
   * Render the N footer buttons for a {@link customChoice} dialog, in array
   * order. Each resolves the dialog with its own `value`.
   * @param {HTMLElement} footer
   */
  buildChoiceButtons(footer) {
    /** @type {{ el: HTMLButtonElement, value: string }[]} */
    this.els.choiceButtons = [];
    /** @type {Map<string, HTMLButtonElement>} */
    this.els.choiceByValue = new Map();

    for (const b of this.options.buttons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cd-btn ${choiceButtonClass(b.variant)}`;
      btn.textContent = b.text;
      btn.setAttribute('data-cd-value', String(b.value));
      if (b.role === 'cancel') {
        btn.setAttribute('data-cd-role', 'cancel');
        this.els.choiceCancelBtn = btn;
      }
      btn.addEventListener('click', () => this.choose(b.value));
      footer.appendChild(btn);
      this.els.choiceButtons.push({ el: btn, value: b.value });
      this.els.choiceByValue.set(b.value, btn);
    }
  }

  /**
   * Resolve a choice dialog with the clicked button's value.
   * @param {string} value
   */
  choose(value) {
    if (this.settled || this.pending) return;
    this.close(value);
  }

  /** @returns {HTMLElement | null} The element to focus on open. */
  getInitialFocus() {
    if (this.type === 'choice') return this.getChoiceInitialFocus();
    switch (this.options.defaultFocus) {
      case 'input':
        return this.els.input || this.els.confirmBtn;
      case 'cancel':
        return this.els.cancelBtn || this.els.confirmBtn;
      case 'confirm':
        return this.els.confirmBtn;
      case 'none':
        return this.els.dialog;
      default:
        return this.els.confirmBtn;
    }
  }

  /**
   * Initial focus for a choice dialog: the button whose `value` matches
   * `defaultFocus`, else the role:'cancel' button, else the last button.
   * @returns {HTMLElement | null}
   */
  getChoiceInitialFocus() {
    const df = this.options.defaultFocus;
    if (df && df !== 'cancel') {
      const byValue = this.els.choiceByValue.get(df);
      if (byValue) return byValue;
    }
    if (this.els.choiceCancelBtn) return this.els.choiceCancelBtn;
    const buttons = this.els.choiceButtons;
    return buttons.length ? buttons[buttons.length - 1].el : this.els.dialog;
  }

  /** @param {KeyboardEvent} e */
  handleKeydown(e) {
    if (e.key === 'Escape') {
      if (this.options.closeOnEscape && !this.pending) {
        e.preventDefault();
        this.cancel();
      }
      return;
    }
    if (e.key === 'Enter') {
      // Choice dialogs have no single "confirm" action: let Enter fall through
      // to the focused button's native activation.
      if (this.type === 'choice') return;
      const target = /** @type {HTMLElement} */ (e.target);
      // Let Enter inside the input (or anywhere) trigger the confirm action,
      // unless focus is on the cancel/close button.
      if (target === this.els.cancelBtn || target === this.els.close) return;
      if (this.pending) return;
      e.preventDefault();
      this.submit();
    }
  }

  /** @param {MouseEvent} e */
  handleBackdrop(e) {
    if (e.target !== this.els.backdrop) return;
    if (!this.options.closeOnBackdrop || this.pending) return;
    this.cancel();
  }

  /** Cancel / dismiss the dialog. */
  cancel() {
    if (this.settled || this.pending) return;
    this.close(this.cancelValue());
  }

  /** @returns {any} The resolution value for a cancellation. */
  cancelValue() {
    if (this.type === 'choice') return this.options.hasCancel ? this.options.cancelValue : null;
    if (this.type === 'confirm') return false;
    if (this.type === 'prompt') return null;
    return undefined;
  }

  /**
   * @param {any} value - The prompt input value (ignored for other types).
   * @returns {any} The resolution value for a successful confirm.
   */
  confirmValue(value) {
    if (this.type === 'prompt') return value;
    if (this.type === 'confirm') return true;
    return undefined; // alert
  }

  /**
   * Confirm action: run validation, then optional async onConfirm. Keeps the
   * dialog open and shows an error if anything throws.
   */
  async submit() {
    if (this.settled || this.pending) return; // double-click / re-entrancy guard

    const value = this.type === 'prompt' ? this.els.input.value : true;

    this.setPending(true);
    this.clearError();

    try {
      if (typeof this.options.validate === 'function') {
        const result = await this.options.validate(value);
        if (result === false) {
          throw new Error(this.options.invalidMessage || 'Please enter a valid value.');
        }
        if (typeof result === 'string' && result.length > 0) {
          throw new Error(result);
        }
      }

      if (typeof this.options.onConfirm === 'function') {
        const maybe = this.options.onConfirm(value);
        if (isPromise(maybe)) await maybe;
      }

      this.close(this.confirmValue(value));
    } catch (err) {
      this.setPending(false);
      this.showError(err && err.message ? err.message : String(err));
    }
  }

  /**
   * Toggle the loading/disabled state.
   * @param {boolean} on
   */
  setPending(on) {
    this.pending = on;
    const { confirmBtn, cancelBtn, close, input } = this.els;
    this.els.dialog.classList.toggle('cd-is-loading', on);
    confirmBtn.toggleAttribute('disabled', on);
    confirmBtn.setAttribute('aria-busy', String(on));
    if (cancelBtn) cancelBtn.toggleAttribute('disabled', on);
    if (close) close.toggleAttribute('disabled', on);
    if (input) input.toggleAttribute('disabled', on);

    if (on) {
      if (!this.els.spinner) {
        this.els.spinner = buildSpinner();
        confirmBtn.insertBefore(this.els.spinner, this.els.confirmLabel);
      }
    } else if (this.els.spinner) {
      this.els.spinner.remove();
      this.els.spinner = undefined;
    }
  }

  /** @param {string} message */
  showError(message) {
    const { error, input, confirmBtn } = this.els;
    error.textContent = message;
    error.hidden = false;
    // Return focus to the most useful retry target.
    requestAnimationFrame(() => {
      if (input) input.focus({ preventScroll: true });
      else confirmBtn.focus({ preventScroll: true });
    });
  }

  clearError() {
    if (this.els.error) {
      this.els.error.textContent = '';
      this.els.error.hidden = true;
    }
  }

  /**
   * Resolve the dialog's promise exactly once and tear everything down.
   * @param {any} value
   */
  close(value) {
    if (this.settled) return;
    this.settled = true;

    this.els.backdrop.removeEventListener('click', this.onBackdrop);
    this.els.dialog.removeEventListener('keydown', this.onKeydown);

    if (this.focusTrap) this.focusTrap.release();

    this.root.hidden = true;
    this.root.removeAttribute('data-cd-open');
    this.root.textContent = '';
    scrollLock.unlock();

    const resolve = this._resolve;
    this._resolve = null;
    const onClose = this.options.onClose;
    this.els = {};
    // Fire the optional onClose hook before resolving; never let it wedge teardown.
    if (typeof onClose === 'function') {
      try {
        onClose(value);
      } catch (_) {
        /* swallow: onClose must not break cleanup or the promise */
      }
    }
    if (resolve) resolve(value);
  }
}

export { VARIANTS };
