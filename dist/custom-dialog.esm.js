/*! customConfirmAlert v1.2.0 | MIT License | https://github.com/michaeljfalk/customConfirmAlert */

// src/utils.js
var FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(",");
var idCounter = 0;
function generateId(prefix = "cd") {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}
function isPromise(value) {
  return !!value && (typeof value === "object" || typeof value === "function") && typeof /** @type {any} */
  value.then === "function";
}
function isNode(value) {
  return !!value && typeof /** @type {any} */
  value.nodeType === "number";
}
function setContent(el, content, allowHtml = false) {
  el.textContent = "";
  if (content == null || content === "") return false;
  if (isNode(content)) {
    el.appendChild(content);
    return true;
  }
  const text = String(content);
  if (allowHtml) {
    el.innerHTML = text;
  } else {
    el.textContent = text;
  }
  return true;
}
function whenBodyReady() {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("customConfirmAlert requires a DOM environment."));
  }
  if (document.body) return Promise.resolve();
  return new Promise((resolve) => {
    const onReady = () => {
      document.removeEventListener("DOMContentLoaded", onReady);
      resolve();
    };
    document.addEventListener("DOMContentLoaded", onReady);
  });
}
var scrollLock = /* @__PURE__ */ (() => {
  let count = 0;
  let scrollY = 0;
  let previous = {};
  return {
    lock() {
      count += 1;
      if (count > 1) return;
      const { body } = document;
      scrollY = window.scrollY || window.pageYOffset || 0;
      previous = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow
      };
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
    },
    unlock() {
      if (count === 0) return;
      count -= 1;
      if (count > 0) return;
      const { body } = document;
      body.style.position = previous.position || "";
      body.style.top = previous.top || "";
      body.style.left = previous.left || "";
      body.style.right = previous.right || "";
      body.style.width = previous.width || "";
      body.style.overflow = previous.overflow || "";
      window.scrollTo(0, scrollY);
    },
    /** @returns {boolean} */
    get active() {
      return count > 0;
    }
  };
})();
function svgEl(tag, attrs = {}, children = []) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  for (const child of children) el.appendChild(child);
  return el;
}

// src/focus.js
function getFocusable(container) {
  const nodes = (
    /** @type {HTMLElement[]} */
    Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
  );
  return nodes.filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.hidden) return false;
    const style = typeof window.getComputedStyle === "function" ? window.getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return true;
  });
}
var SUPPORTS_INERT = typeof HTMLElement !== "undefined" && "inert" in HTMLElement.prototype;
var FocusTrap = class {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.container = container;
    this.previouslyFocused = null;
    this.mutated = [];
    this.onKeydown = this.handleKeydown.bind(this);
  }
  /**
   * Activate the trap.
   * @param {HTMLElement | null} [initialFocus] - Element to focus first.
   */
  activate(initialFocus) {
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.deactivateBackground();
    document.addEventListener("keydown", this.onKeydown, true);
    const target = initialFocus || getFocusable(this.container)[0] || this.container;
    requestAnimationFrame(() => {
      if (target && typeof target.focus === "function") {
        target.focus({ preventScroll: true });
      }
    });
  }
  /** Make every sibling of the dialog root inert / hidden from AT. */
  deactivateBackground() {
    const root = this.container.closest("[data-cd-root]") || this.container;
    const siblings = Array.from(document.body.children);
    for (const el of siblings) {
      if (el === root) continue;
      this.mutated.push({
        el,
        inert: SUPPORTS_INERT ? (
          /** @type {any} */
          el.inert === true
        ) : false,
        ariaHidden: el.getAttribute("aria-hidden")
      });
      if (SUPPORTS_INERT) {
        el.inert = true;
      }
      el.setAttribute("aria-hidden", "true");
    }
  }
  /** Restore inert/aria-hidden on the background. */
  reactivateBackground() {
    for (const record of this.mutated) {
      if (SUPPORTS_INERT) {
        record.el.inert = record.inert;
      }
      if (record.ariaHidden === null) {
        record.el.removeAttribute("aria-hidden");
      } else {
        record.el.setAttribute("aria-hidden", record.ariaHidden);
      }
    }
    this.mutated = [];
  }
  /** @param {KeyboardEvent} e */
  handleKeydown(e) {
    if (e.key !== "Tab") return;
    const focusable = getFocusable(this.container);
    if (focusable.length === 0) {
      e.preventDefault();
      this.container.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (!this.container.contains(active)) {
      e.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  }
  /** Deactivate the trap and restore focus to the opener. */
  release() {
    document.removeEventListener("keydown", this.onKeydown, true);
    this.reactivateBackground();
    const target = this.previouslyFocused;
    if (target && typeof /** @type {any} */
    target.focus === "function") {
      requestAnimationFrame(() => {
        if (document.contains(target)) {
          target.focus({ preventScroll: true });
        }
      });
    }
    this.previouslyFocused = null;
  }
};

// src/icons.js
var STROKE_COMMON = {
  viewBox: "0 0 24 24",
  width: 24,
  height: 24,
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
  focusable: "false"
};
function buildVariantIcon(variant) {
  const glyphs = {
    info: [
      svgEl("circle", { cx: 12, cy: 12, r: 10 }),
      svgEl("line", { x1: 12, y1: 11, x2: 12, y2: 16 }),
      svgEl("line", { x1: 12, y1: 8, x2: 12.01, y2: 8 })
    ],
    success: [
      svgEl("circle", { cx: 12, cy: 12, r: 10 }),
      svgEl("path", { d: "M8 12.5l2.5 2.5 5-5" })
    ],
    warning: [
      svgEl("path", {
        d: "M10.29 3.86l-8.18 14A1.5 1.5 0 003.4 20h17.2a1.5 1.5 0 001.29-2.14l-8.18-14a1.5 1.5 0 00-2.62 0z"
      }),
      svgEl("line", { x1: 12, y1: 9, x2: 12, y2: 13 }),
      svgEl("line", { x1: 12, y1: 17, x2: 12.01, y2: 17 })
    ],
    danger: [
      svgEl("circle", { cx: 12, cy: 12, r: 10 }),
      svgEl("line", { x1: 15, y1: 9, x2: 9, y2: 15 }),
      svgEl("line", { x1: 9, y1: 9, x2: 15, y2: 15 })
    ],
    neutral: [
      svgEl("path", { d: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" }),
      svgEl("path", { d: "M13.73 21a2 2 0 01-3.46 0" })
    ]
  };
  return svgEl("svg", STROKE_COMMON, glyphs[variant] || glyphs.info);
}
function buildSpinner(className = "cd-spinner") {
  return svgEl(
    "svg",
    {
      class: className,
      viewBox: "0 0 24 24",
      width: 18,
      height: 18,
      "aria-hidden": "true",
      focusable: "false"
    },
    [svgEl("circle", { cx: 12, cy: 12, r: 9, fill: "none", "stroke-width": 3 })]
  );
}
function buildCloseIcon(size = 20) {
  return svgEl(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "aria-hidden": "true",
      focusable: "false"
    },
    [
      svgEl("line", { x1: 6, y1: 6, x2: 18, y2: 18 }),
      svgEl("line", { x1: 18, y1: 6, x2: 6, y2: 18 })
    ]
  );
}

// src/dialog.js
var VARIANTS = /* @__PURE__ */ new Set(["info", "success", "warning", "danger"]);
function choiceButtonClass(variant) {
  switch (variant) {
    case "primary":
      return "cd-btn-primary";
    case "danger":
      return "cd-btn-danger";
    case "secondary":
      return "cd-btn-secondary";
    case "neutral":
    default:
      return "cd-btn-neutral";
  }
}
var Dialog = class {
  /**
   * @param {object} options - Normalised options (see normalizeOptions in index.js).
   * @param {HTMLElement} root - The shared, persistent modal root element.
   */
  constructor(options, root) {
    this.options = options;
    this.root = root;
    this.type = options.type;
    this.settled = false;
    this.pending = false;
    this._resolve = null;
    this.focusTrap = null;
    this.titleId = generateId("cd-title");
    this.descId = generateId("cd-desc");
    this.errorId = generateId("cd-error");
    this.inputId = generateId("cd-input");
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
      this.root.setAttribute("data-cd-open", "");
      this.root.hidden = false;
      this.focusTrap = new FocusTrap(this.els.dialog);
      this.focusTrap.activate(this.getInitialFocus());
      this.els.backdrop.addEventListener("click", this.onBackdrop);
      this.els.dialog.addEventListener("keydown", this.onKeydown);
    });
  }
  /** Construct the dialog DOM and attach it to the root viewport. */
  build() {
    const o = this.options;
    const backdrop = document.createElement("div");
    backdrop.className = "cd-backdrop";
    backdrop.setAttribute("data-cd-backdrop", "");
    const viewport = document.createElement("div");
    viewport.className = "cd-viewport";
    const dialog = document.createElement("div");
    dialog.className = `cd-dialog cd-variant-${o.variant}`;
    if (o.className) dialog.className += ` ${o.className}`;
    dialog.setAttribute("role", o.type === "alert" ? "alertdialog" : "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("tabindex", "-1");
    if (o.icon !== false) {
      const iconWrap = document.createElement("div");
      iconWrap.className = "cd-icon";
      iconWrap.setAttribute("aria-hidden", "true");
      if (o.icon && typeof o.icon === "object" && o.icon.nodeType) {
        iconWrap.appendChild(o.icon);
      } else if (typeof o.icon === "string") {
        iconWrap.textContent = o.icon;
      } else {
        iconWrap.appendChild(buildVariantIcon(o.variant));
      }
      dialog.appendChild(iconWrap);
    }
    const content = document.createElement("div");
    content.className = "cd-content";
    if (o.title) {
      const title = document.createElement("h2");
      title.className = "cd-title";
      title.id = this.titleId;
      setContent(title, o.title, o.allowHtml);
      content.appendChild(title);
      dialog.setAttribute("aria-labelledby", this.titleId);
    } else {
      dialog.setAttribute("aria-label", o.ariaLabel || "Dialog");
    }
    if (o.message) {
      const message = document.createElement("div");
      message.className = "cd-message";
      message.id = this.descId;
      setContent(message, o.message, o.allowHtml);
      content.appendChild(message);
      dialog.setAttribute("aria-describedby", this.descId);
    }
    if (o.type === "prompt") {
      const field = document.createElement("div");
      field.className = "cd-field";
      const label = document.createElement("label");
      label.className = "cd-input-label";
      label.htmlFor = this.inputId;
      label.textContent = o.inputLabel || o.placeholder || "Input";
      if (!o.inputLabel) label.classList.add("cd-visually-hidden");
      const input = document.createElement("input");
      input.className = "cd-input";
      input.id = this.inputId;
      input.type = o.inputType || "text";
      input.placeholder = o.placeholder || "";
      input.value = o.defaultValue != null ? String(o.defaultValue) : "";
      input.setAttribute("aria-describedby", this.errorId);
      input.autocomplete = "off";
      field.appendChild(label);
      field.appendChild(input);
      content.appendChild(field);
      this.els.input = input;
    }
    const error = document.createElement("div");
    error.className = "cd-error";
    error.id = this.errorId;
    error.setAttribute("role", "alert");
    error.hidden = true;
    content.appendChild(error);
    dialog.appendChild(content);
    if (o.dismissible) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "cd-close";
      close.setAttribute("aria-label", o.closeLabel || "Close");
      close.appendChild(buildCloseIcon(20));
      close.addEventListener("click", () => this.cancel());
      dialog.appendChild(close);
      this.els.close = close;
    }
    const footer = document.createElement("div");
    footer.className = "cd-footer";
    if (o.type === "choice") {
      this.buildChoiceButtons(footer);
    } else {
      if (o.type !== "alert") {
        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "cd-btn cd-btn-cancel";
        cancelBtn.textContent = o.cancelText;
        cancelBtn.addEventListener("click", () => this.cancel());
        footer.appendChild(cancelBtn);
        this.els.cancelBtn = cancelBtn;
      }
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = `cd-btn cd-btn-confirm cd-btn-${o.variant}`;
      const confirmLabel = document.createElement("span");
      confirmLabel.className = "cd-btn-label";
      confirmLabel.textContent = o.confirmText;
      confirmBtn.appendChild(confirmLabel);
      confirmBtn.addEventListener("click", () => this.submit());
      footer.appendChild(confirmBtn);
      this.els.confirmBtn = confirmBtn;
      this.els.confirmLabel = confirmLabel;
    }
    dialog.appendChild(footer);
    viewport.appendChild(dialog);
    this.root.textContent = "";
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
    this.els.choiceButtons = [];
    this.els.choiceByValue = /* @__PURE__ */ new Map();
    for (const b of this.options.buttons) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `cd-btn ${choiceButtonClass(b.variant)}`;
      btn.textContent = b.text;
      btn.setAttribute("data-cd-value", String(b.value));
      if (b.role === "cancel") {
        btn.setAttribute("data-cd-role", "cancel");
        this.els.choiceCancelBtn = btn;
      }
      btn.addEventListener("click", () => this.choose(b.value));
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
    if (this.type === "choice") return this.getChoiceInitialFocus();
    switch (this.options.defaultFocus) {
      case "input":
        return this.els.input || this.els.confirmBtn;
      case "cancel":
        return this.els.cancelBtn || this.els.confirmBtn;
      case "confirm":
        return this.els.confirmBtn;
      case "none":
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
    if (df && df !== "cancel") {
      const byValue = this.els.choiceByValue.get(df);
      if (byValue) return byValue;
    }
    if (this.els.choiceCancelBtn) return this.els.choiceCancelBtn;
    const buttons = this.els.choiceButtons;
    return buttons.length ? buttons[buttons.length - 1].el : this.els.dialog;
  }
  /** @param {KeyboardEvent} e */
  handleKeydown(e) {
    if (e.key === "Escape") {
      if (this.options.closeOnEscape && !this.pending) {
        e.preventDefault();
        this.cancel();
      }
      return;
    }
    if (e.key === "Enter") {
      if (this.type === "choice") return;
      const target = (
        /** @type {HTMLElement} */
        e.target
      );
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
    if (this.type === "choice") return this.options.hasCancel ? this.options.cancelValue : null;
    if (this.type === "confirm") return false;
    if (this.type === "prompt") return null;
    return void 0;
  }
  /**
   * @param {any} value - The prompt input value (ignored for other types).
   * @returns {any} The resolution value for a successful confirm.
   */
  confirmValue(value) {
    if (this.type === "prompt") return value;
    if (this.type === "confirm") return true;
    return void 0;
  }
  /**
   * Confirm action: run validation, then optional async onConfirm. Keeps the
   * dialog open and shows an error if anything throws.
   */
  async submit() {
    if (this.settled || this.pending) return;
    const value = this.type === "prompt" ? this.els.input.value : true;
    this.setPending(true);
    this.clearError();
    try {
      if (typeof this.options.validate === "function") {
        const result = await this.options.validate(value);
        if (result === false) {
          throw new Error(this.options.invalidMessage || "Please enter a valid value.");
        }
        if (typeof result === "string" && result.length > 0) {
          throw new Error(result);
        }
      }
      if (typeof this.options.onConfirm === "function") {
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
    this.els.dialog.classList.toggle("cd-is-loading", on);
    confirmBtn.toggleAttribute("disabled", on);
    confirmBtn.setAttribute("aria-busy", String(on));
    if (cancelBtn) cancelBtn.toggleAttribute("disabled", on);
    if (close) close.toggleAttribute("disabled", on);
    if (input) input.toggleAttribute("disabled", on);
    if (on) {
      if (!this.els.spinner) {
        this.els.spinner = buildSpinner();
        confirmBtn.insertBefore(this.els.spinner, this.els.confirmLabel);
      }
    } else if (this.els.spinner) {
      this.els.spinner.remove();
      this.els.spinner = void 0;
    }
  }
  /** @param {string} message */
  showError(message) {
    const { error, input, confirmBtn } = this.els;
    error.textContent = message;
    error.hidden = false;
    requestAnimationFrame(() => {
      if (input) input.focus({ preventScroll: true });
      else confirmBtn.focus({ preventScroll: true });
    });
  }
  clearError() {
    if (this.els.error) {
      this.els.error.textContent = "";
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
    this.els.backdrop.removeEventListener("click", this.onBackdrop);
    this.els.dialog.removeEventListener("keydown", this.onKeydown);
    if (this.focusTrap) this.focusTrap.release();
    this.root.hidden = true;
    this.root.removeAttribute("data-cd-open");
    this.root.textContent = "";
    scrollLock.unlock();
    const resolve = this._resolve;
    this._resolve = null;
    const onClose = this.options.onClose;
    this.els = {};
    if (typeof onClose === "function") {
      try {
        onClose(value);
      } catch (_) {
      }
    }
    if (resolve) resolve(value);
  }
};

// src/queue.js
var DialogQueue = class {
  constructor() {
    this.pending = [];
    this.processing = false;
  }
  /**
   * Enqueue a dialog. The returned promise settles with whatever `runner`
   * resolves to (the dialog result).
   * @param {DialogRunner} runner
   * @returns {Promise<any>}
   */
  enqueue(runner) {
    return new Promise((resolve, reject) => {
      this.pending.push({ runner, resolve, reject });
      this.process();
    });
  }
  /** @returns {number} Number of dialogs waiting (excluding the active one). */
  get size() {
    return this.pending.length;
  }
  async process() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.pending.length > 0) {
        const item = (
          /** @type {typeof this.pending[number]} */
          this.pending.shift()
        );
        try {
          const result = await item.runner();
          item.resolve(result);
        } catch (err) {
          item.reject(err);
        }
      }
    } finally {
      this.processing = false;
    }
  }
};
var dialogQueue = new DialogQueue();

// src/toast/toast-timer.js
function now() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}
var ToastTimer = class {
  /**
   * @param {object} opts
   * @param {number} opts.duration - Total run time in ms (> 0).
   * @param {() => void} opts.onExpire - Called once when the countdown completes.
   * @param {(remaining: number, duration: number, running: boolean) => void} [opts.onChange]
   *   - Called whenever timing state changes (start/pause/resume/reset), for progress UI.
   */
  constructor({ duration, onExpire, onChange }) {
    this.duration = Math.max(0, Number(duration) || 0);
    this.remaining = this.duration;
    this.onExpire = onExpire;
    this.onChange = onChange || (() => {
    });
    this.pauseReasons = /* @__PURE__ */ new Set();
    this.handle = null;
    this.startedAt = 0;
    this.expired = false;
    this.started = false;
  }
  /** @returns {boolean} True while the countdown is actively running. */
  get running() {
    return this.handle !== null;
  }
  /** Begin (or restart) the countdown from the full duration. */
  start() {
    this.clearHandle();
    this.expired = false;
    this.started = true;
    this.remaining = this.duration;
    this.tickStart();
  }
  /** Internal: (re)arm the timeout if no pause reasons are active. */
  tickStart() {
    this.clearHandle();
    if (this.expired || !this.started) return;
    if (this.pauseReasons.size > 0) {
      this.emit();
      return;
    }
    this.startedAt = now();
    this.handle = setTimeout(() => {
      this.handle = null;
      this.remaining = 0;
      this.expired = true;
      this.emit();
      this.onExpire();
    }, this.remaining);
    this.emit();
  }
  /**
   * Add a pause reason. The countdown stops if it was running; the elapsed time
   * is banked into `remaining`.
   * @param {string} reason
   */
  pause(reason) {
    if (!this.started || this.expired) {
      this.pauseReasons.add(reason);
      return;
    }
    if (this.handle !== null) {
      const elapsed = now() - this.startedAt;
      this.remaining = Math.max(0, this.remaining - elapsed);
      this.clearHandle();
    }
    this.pauseReasons.add(reason);
    this.emit();
  }
  /**
   * Remove a pause reason. The countdown resumes only when *all* reasons clear.
   * @param {string} reason
   */
  resume(reason) {
    if (!this.pauseReasons.has(reason)) return;
    this.pauseReasons.delete(reason);
    if (this.pauseReasons.size === 0 && this.started && !this.expired) {
      this.tickStart();
    } else {
      this.emit();
    }
  }
  /**
   * Replace the duration and restart the countdown from full (used when a toast
   * is updated with a new duration).
   * @param {number} duration
   */
  reset(duration) {
    this.duration = Math.max(0, Number(duration) || 0);
    this.remaining = this.duration;
    this.expired = false;
    this.started = true;
    this.tickStart();
  }
  /** Stop permanently and release the handle (no expiry callback). */
  cancel() {
    this.clearHandle();
    this.started = false;
    this.pauseReasons.clear();
  }
  clearHandle() {
    if (this.handle !== null) {
      clearTimeout(this.handle);
      this.handle = null;
    }
  }
  emit() {
    this.onChange(this.remaining, this.duration, this.running);
  }
};

// src/toast/toast-positions.js
var POSITIONS = (
  /** @type {ToastPosition[]} */
  [
    "top-left",
    "top-center",
    "top-right",
    "bottom-left",
    "bottom-center",
    "bottom-right"
  ]
);
var POSITION_SET = new Set(POSITIONS);
var ANIMATIONS = /* @__PURE__ */ new Set([
  "auto",
  "slide-down",
  "slide-up",
  "slide-left",
  "slide-right",
  "fade",
  "scale",
  "none"
]);
function isTopPosition(position) {
  return position.startsWith("top");
}
function autoAnimationFor(position) {
  switch (position) {
    case "top-center":
      return { enter: "slide-down", exit: "slide-up" };
    case "bottom-center":
      return { enter: "slide-up", exit: "slide-down" };
    case "top-left":
    case "bottom-left":
      return { enter: "slide-right", exit: "slide-left" };
    case "top-right":
    case "bottom-right":
    default:
      return { enter: "slide-left", exit: "slide-right" };
  }
}
function resolveAnimations(position, enter, exit) {
  const auto = autoAnimationFor(position);
  return {
    enter: !enter || enter === "auto" ? auto.enter : enter,
    exit: !exit || exit === "auto" ? auto.exit : exit
  };
}

// src/toast/toast-gestures.js
var DIRECTION_LOCK_THRESHOLD = 8;
var DISMISS_DISTANCE_RATIO = 0.35;
var DISMISS_VELOCITY = 0.5;
function attachSwipe(el, { onGestureStart, onGestureEnd, onDismiss, reducedMotion = false }) {
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let locked = false;
  let decided = false;
  let active = false;
  function onPointerDown(e) {
    if (active) return;
    if (e.target instanceof Element && e.target.closest("button, a, input, textarea, select, [tabindex]")) {
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    active = true;
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    startY = e.clientY;
    startTime = lastTime = e.timeStamp;
    velocity = 0;
    locked = false;
    decided = false;
  }
  function onPointerMove(e) {
    if (!active || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!decided) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > DIRECTION_LOCK_THRESHOLD) {
        decided = true;
        active = false;
        return;
      }
      if (Math.abs(dx) > DIRECTION_LOCK_THRESHOLD) {
        decided = true;
        locked = true;
        try {
          el.setPointerCapture(pointerId);
        } catch {
        }
        el.classList.add("ct-swiping");
        onGestureStart();
      } else {
        return;
      }
    }
    if (!locked) return;
    const dt = e.timeStamp - lastTime;
    if (dt > 0) velocity = (e.clientX - lastX) / dt;
    lastX = e.clientX;
    lastTime = e.timeStamp;
    const width = el.offsetWidth || 320;
    const opacity = Math.max(0, 1 - Math.abs(dx) / (width * 1.4));
    el.style.transform = `translateX(${dx}px)`;
    el.style.opacity = String(opacity);
  }
  function finish(e) {
    if (!active && !locked) {
      reset();
      return;
    }
    if (e && e.pointerId !== pointerId) return;
    const dx = lastX - startX;
    const width = el.offsetWidth || 320;
    const farEnough = Math.abs(dx) > width * DISMISS_DISTANCE_RATIO;
    const fastEnough = Math.abs(velocity) > DISMISS_VELOCITY && Math.abs(dx) > 24;
    el.classList.remove("ct-swiping");
    try {
      if (pointerId !== null) el.releasePointerCapture(pointerId);
    } catch {
    }
    if (locked && (farEnough || fastEnough)) {
      onDismiss(dx >= 0 ? 1 : -1);
      reset();
      return;
    }
    if (!reducedMotion) el.classList.add("ct-snap-back");
    el.style.transform = "";
    el.style.opacity = "";
    if (locked) onGestureEnd();
    window.setTimeout(() => el.classList.remove("ct-snap-back"), 200);
    reset();
  }
  function reset() {
    active = false;
    locked = false;
    decided = false;
    pointerId = null;
  }
  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", finish);
  el.addEventListener("pointercancel", finish);
  return function cleanup() {
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", finish);
    el.removeEventListener("pointercancel", finish);
  };
}

// src/toast/toast.js
var ENTER_FALLBACK = 260;
var EXIT_FALLBACK = 300;
var REDUCED_FALLBACK = 20;
var Toast = class {
  /**
   * @param {object} options - Normalised toast options (see normalizeToastOptions).
   * @param {object} host - Manager callbacks.
   * @param {() => boolean} host.reducedMotion
   * @param {(toast: Toast) => void} host.handleClosed - Called after full cleanup.
   */
  constructor(options, host) {
    this.options = options;
    this.host = host;
    this.id = options.id || generateId("toast");
    this.position = options.position;
    this.state = "idle";
    this.titleId = generateId("ct-title");
    this.msgId = generateId("ct-msg");
    this.timer = null;
    this.pauseReasons = /* @__PURE__ */ new Set();
    this.actionPending = false;
    this.els = {};
    this.detachSwipe = null;
    this._enterDone = false;
    this._exitDone = false;
    this._closePromise = null;
    this._resolveClose = null;
    this._enterFallback = null;
    this._exitFallback = null;
    this.controller = Object.freeze({
      id: this.id,
      update: (opts) => {
        this.update(opts);
        return this.controller;
      },
      close: () => this.close(),
      isOpen: () => this.isOpen()
    });
  }
  /** @returns {boolean} */
  isOpen() {
    return this.state === "entering" || this.state === "open";
  }
  /* ------------------------------------------------------------------ build */
  build() {
    const o = this.options;
    const el = document.createElement("div");
    el.className = `ct-toast ct-variant-${o.variant}`;
    if (o.className) el.className += ` ${o.className}`;
    el.setAttribute("data-cd-toast", this.id);
    el.setAttribute("role", o.ariaLive === "assertive" ? "alert" : "status");
    el.setAttribute("aria-live", o.ariaLive);
    el.setAttribute("aria-atomic", "true");
    if (o.icon !== false) {
      const iconWrap = document.createElement("div");
      iconWrap.className = "ct-icon";
      iconWrap.setAttribute("aria-hidden", "true");
      if (o.icon && typeof o.icon === "object" && o.icon.nodeType) iconWrap.appendChild(o.icon);
      else if (typeof o.icon === "string") iconWrap.textContent = o.icon;
      else iconWrap.appendChild(buildVariantIcon(o.variant));
      el.appendChild(iconWrap);
      this.els.icon = iconWrap;
    }
    const content = document.createElement("div");
    content.className = "ct-content";
    const title = document.createElement("div");
    title.className = "ct-title";
    title.id = this.titleId;
    content.appendChild(title);
    this.els.title = title;
    const message = document.createElement("div");
    message.className = "ct-message";
    message.id = this.msgId;
    content.appendChild(message);
    this.els.message = message;
    const error = document.createElement("div");
    error.className = "ct-error";
    error.hidden = true;
    content.appendChild(error);
    this.els.error = error;
    const actions = document.createElement("div");
    actions.className = "ct-actions";
    content.appendChild(actions);
    this.els.actions = actions;
    el.appendChild(content);
    this.els.content = content;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "ct-close";
    close.setAttribute("aria-label", o.closeLabel || "Dismiss notification");
    close.appendChild(buildCloseIcon(18));
    close.addEventListener("click", () => this.close());
    el.appendChild(close);
    this.els.close = close;
    const progress = document.createElement("div");
    progress.className = "ct-progress";
    progress.setAttribute("aria-hidden", "true");
    const bar = document.createElement("div");
    bar.className = "ct-progress-bar";
    progress.appendChild(bar);
    el.appendChild(progress);
    this.els.progress = progress;
    this.els.progressBar = bar;
    this.el = el;
    this.applyContent();
    this.applyDismissible();
    this.applyProgressVisibility();
    this.bindPauseListeners();
    if (o.swipeToDismiss) this.setupSwipe();
    return el;
  }
  /** Add a pause reason (works before the timer exists). */
  pauseReason(reason) {
    this.pauseReasons.add(reason);
    if (this.timer) this.timer.pause(reason);
  }
  /** Remove a pause reason. */
  resumeReason(reason) {
    this.pauseReasons.delete(reason);
    if (this.timer) this.timer.resume(reason);
  }
  /** Apply title/message/error text + variant class (used on build and update). */
  applyContent() {
    const o = this.options;
    setContent(this.els.title, o.title, o.allowHtml);
    this.els.title.hidden = !o.title;
    setContent(this.els.message, o.message, o.allowHtml);
    this.els.message.hidden = !o.message && !this.els.message.firstChild;
    if (o.title) this.el.setAttribute("aria-labelledby", this.titleId);
    else this.el.removeAttribute("aria-labelledby");
    this.renderAction();
  }
  applyDismissible() {
    this.els.close.hidden = !this.options.dismissible;
  }
  applyProgressVisibility() {
    const show2 = this.options.showProgress && !this.isPersistent() && this.options.duration > 0;
    this.els.progress.hidden = !show2;
  }
  isPersistent() {
    return this.options.persistent === true;
  }
  renderAction() {
    const actions = this.els.actions;
    actions.textContent = "";
    const action = this.options.action;
    const handler = action && action.onClick || this.options.onAction;
    if (!action || !action.label) {
      actions.hidden = true;
      this.els.actionBtn = null;
      return;
    }
    actions.hidden = false;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ct-action";
    const label = document.createElement("span");
    label.className = "ct-action-label";
    label.textContent = action.label;
    btn.appendChild(label);
    btn.addEventListener("click", () => this.runAction(handler, action));
    actions.appendChild(btn);
    this.els.actionBtn = btn;
    this.els.actionLabel = label;
  }
  /* ------------------------------------------------------------------ enter */
  /** Called by the manager once the element is in its container. */
  enter() {
    const o = this.options;
    const { enter } = resolveAnimations(o.position, o.enterAnimation, o.exitAnimation);
    this.state = "entering";
    const reduced = this.host.reducedMotion();
    this.el.classList.add("ct-animating");
    if (!reduced && enter !== "none") {
      this.el.classList.add(`ct-from-${enter}`);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (this.state !== "entering") return;
          this.el.classList.remove(`ct-from-${enter}`);
        });
      });
    }
    const onEnd = (e) => {
      if (e && e.target !== this.el) return;
      this._completeEnter();
    };
    this._onEnterEnd = onEnd;
    this.el.addEventListener("transitionend", onEnd);
    this._enterFallback = setTimeout(
      () => this._completeEnter(),
      reduced ? REDUCED_FALLBACK : ENTER_FALLBACK
    );
  }
  _completeEnter() {
    if (this._enterDone || this.state === "closed" || this.state === "leaving") return;
    this._enterDone = true;
    if (this._onEnterEnd) this.el.removeEventListener("transitionend", this._onEnterEnd);
    clearTimeout(this._enterFallback);
    this.el.classList.remove("ct-animating");
    this.state = "open";
    this.startTiming();
    safeCall(this.options.onOpen);
  }
  /* ------------------------------------------------------------------ timing */
  startTiming() {
    if (this.isPersistent() || this.options.duration <= 0) return;
    this.timer = new ToastTimer({
      duration: this.options.duration,
      onExpire: () => this.close(),
      onChange: (remaining, duration, running) => this.updateProgress(remaining, duration, running)
    });
    this.timer.start();
    if (typeof document !== "undefined" && document.hidden) this.pauseReasons.add("hidden");
    for (const reason of this.pauseReasons) this.timer.pause(reason);
  }
  bindPauseListeners() {
    const o = this.options;
    if (o.pauseOnHover) {
      this._onEnter = () => this.pauseReason("hover");
      this._onLeave = () => this.resumeReason("hover");
      this.el.addEventListener("pointerenter", this._onEnter);
      this.el.addEventListener("pointerleave", this._onLeave);
    }
    if (o.pauseOnFocus) {
      this._onFocusIn = () => this.pauseReason("focus");
      this._onFocusOut = () => this.resumeReason("focus");
      this.el.addEventListener("focusin", this._onFocusIn);
      this.el.addEventListener("focusout", this._onFocusOut);
    }
  }
  /** Manager forwards document visibility changes here. */
  setHidden(hidden) {
    if (hidden) this.pauseReason("hidden");
    else this.resumeReason("hidden");
  }
  updateProgress(remaining, duration, running) {
    const bar = this.els.progressBar;
    if (!bar || this.els.progress.hidden) return;
    const frac = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
    const reduced = this.host.reducedMotion();
    if (running && !reduced) {
      bar.style.transition = "none";
      bar.style.transform = `scaleX(${frac})`;
      void bar.offsetWidth;
      bar.style.transition = `transform ${Math.round(remaining)}ms linear`;
      bar.style.transform = "scaleX(0)";
    } else {
      bar.style.transition = "none";
      bar.style.transform = `scaleX(${frac})`;
    }
  }
  /* ------------------------------------------------------------------ action */
  /**
   * @param {(() => any) | undefined} handler
   * @param {object} action
   */
  async runAction(handler, action) {
    if (this.actionPending || this.state === "leaving" || this.state === "closed") return;
    if (typeof handler !== "function") {
      this.close();
      return;
    }
    this.actionPending = true;
    this.setActionLoading(true, action);
    this.clearError();
    this.pauseReason("action");
    try {
      const result = handler();
      if (isPromise(result)) await result;
      this.actionPending = false;
      if (action.closeOnSuccess !== false) {
        this.close();
      } else {
        this.setActionLoading(false, action);
        this.resumeReason("action");
      }
    } catch (err) {
      this.actionPending = false;
      this.setActionLoading(false, action);
      if (this.timer) this.timer.cancel();
      this.showError(safeErrorMessage(err));
    }
  }
  setActionLoading(loading, action) {
    const btn = this.els.actionBtn;
    const label = this.els.actionLabel;
    if (!btn) return;
    btn.toggleAttribute("disabled", loading);
    btn.setAttribute("aria-busy", String(loading));
    this.els.close.toggleAttribute("disabled", loading);
    if (loading) {
      if (action.pendingLabel) label.textContent = action.pendingLabel;
      if (!this.els.actionSpinner) {
        this.els.actionSpinner = buildSpinner("cd-spinner");
        btn.insertBefore(this.els.actionSpinner, label);
      }
    } else {
      label.textContent = action.label;
      if (this.els.actionSpinner) {
        this.els.actionSpinner.remove();
        this.els.actionSpinner = null;
      }
    }
  }
  showError(message) {
    this.els.error.textContent = message;
    this.els.error.hidden = false;
  }
  clearError() {
    this.els.error.textContent = "";
    this.els.error.hidden = true;
  }
  /* ------------------------------------------------------------------ update */
  /**
   * Update in place. Restarts the timer when a new duration/persistence is given.
   * `position` changes are ignored (documented limitation).
   * @param {object} patch
   */
  update(patch) {
    if (this.state === "closed" || this.state === "leaving") return;
    const prev = this.options;
    const next = { ...prev, ...patch };
    if (patch && patch.position) next.position = prev.position;
    this.options = next;
    if (!this.el) return;
    if (patch.variant && patch.variant !== prev.variant) {
      this.el.classList.remove(`ct-variant-${prev.variant}`);
      this.el.classList.add(`ct-variant-${next.variant}`);
      if (next.icon == null && this.els.icon) {
        this.els.icon.textContent = "";
        this.els.icon.appendChild(buildVariantIcon(next.variant));
      }
    }
    if (patch.ariaLive && patch.ariaLive !== prev.ariaLive) {
      this.el.setAttribute("role", next.ariaLive === "assertive" ? "alert" : "status");
      this.el.setAttribute("aria-live", next.ariaLive);
    }
    this.applyContent();
    this.applyDismissible();
    this.applyProgressVisibility();
    if (next.swipeToDismiss && !this.detachSwipe) this.setupSwipe();
    if (!next.swipeToDismiss && this.detachSwipe) this.teardownSwipe();
    if (this.state !== "open") return;
    const becamePersistent = next.persistent === true;
    if (becamePersistent) {
      if (this.timer) {
        this.timer.cancel();
        this.timer = null;
      }
      this.updateProgress(0, 0, false);
    } else if (next.duration > 0) {
      if (!this.timer) this.startTiming();
      else this.timer.reset(next.duration);
    }
  }
  /* ------------------------------------------------------------------ swipe */
  setupSwipe() {
    if (this.detachSwipe || !this.el) return;
    this.detachSwipe = attachSwipe(this.el, {
      reducedMotion: this.host.reducedMotion(),
      onGestureStart: () => this.pauseReason("gesture"),
      onGestureEnd: () => this.resumeReason("gesture"),
      onDismiss: (dir) => this.close({ swipeDirection: dir })
    });
  }
  teardownSwipe() {
    if (this.detachSwipe) {
      this.detachSwipe();
      this.detachSwipe = null;
    }
  }
  /* ------------------------------------------------------------------ close */
  /**
   * Begin the exit animation, then clean up. Idempotent — repeated calls return
   * the same promise.
   * @param {{ swipeDirection?: 1 | -1 }} [opts]
   * @returns {Promise<void>}
   */
  close(opts = {}) {
    if (this._closePromise) return this._closePromise;
    this._closePromise = new Promise((resolve) => {
      this._resolveClose = resolve;
    });
    if (this.state === "idle") {
      this._cleanup();
      return this._closePromise;
    }
    this.state = "leaving";
    if (this.timer) {
      this.timer.cancel();
      this.timer = null;
    }
    this._animateOut(opts.swipeDirection);
    return this._closePromise;
  }
  _animateOut(swipeDirection) {
    const reduced = this.host.reducedMotion();
    const el = this.el;
    const o = this.options;
    const { exit } = resolveAnimations(o.position, o.enterAnimation, o.exitAnimation);
    const h = el.offsetHeight;
    el.style.maxHeight = `${h}px`;
    void el.offsetWidth;
    el.classList.add("ct-leaving");
    if (!reduced && exit !== "none") {
      if (swipeDirection) el.classList.add(swipeDirection > 0 ? "ct-out-slide-right" : "ct-out-slide-left");
      else el.classList.add(`ct-out-${exit}`);
    }
    el.style.maxHeight = "0px";
    el.style.marginTop = "0px";
    el.style.marginBottom = "0px";
    const onEnd = (e) => {
      if (e && e.target !== el) return;
      this._completeExit();
    };
    this._onExitEnd = onEnd;
    el.addEventListener("transitionend", onEnd);
    this._exitFallback = setTimeout(() => this._completeExit(), reduced ? REDUCED_FALLBACK : EXIT_FALLBACK);
  }
  _completeExit() {
    if (this._exitDone) return;
    this._exitDone = true;
    if (this._onExitEnd) this.el.removeEventListener("transitionend", this._onExitEnd);
    clearTimeout(this._exitFallback);
    this._cleanup();
  }
  /** Remove from DOM, detach every listener/timer, resolve, notify the manager. */
  _cleanup() {
    if (this.state === "closed") {
      if (this._resolveClose) this._resolveClose();
      return;
    }
    this.state = "closed";
    clearTimeout(this._enterFallback);
    clearTimeout(this._exitFallback);
    if (this.timer) {
      this.timer.cancel();
      this.timer = null;
    }
    this.teardownSwipe();
    if (this.el) {
      if (this._onEnter) this.el.removeEventListener("pointerenter", this._onEnter);
      if (this._onLeave) this.el.removeEventListener("pointerleave", this._onLeave);
      if (this._onFocusIn) this.el.removeEventListener("focusin", this._onFocusIn);
      if (this._onFocusOut) this.el.removeEventListener("focusout", this._onFocusOut);
      if (this._onEnterEnd) this.el.removeEventListener("transitionend", this._onEnterEnd);
      if (this._onExitEnd) this.el.removeEventListener("transitionend", this._onExitEnd);
      if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    }
    safeCall(this.options.onClose);
    const host = this.host;
    this.el = null;
    this.els = {};
    if (this._resolveClose) this._resolveClose();
    host.handleClosed(this);
  }
};
function safeCall(fn) {
  if (typeof fn !== "function") return;
  try {
    fn();
  } catch {
  }
}
function safeErrorMessage(err) {
  if (err && typeof err === "object" && typeof /** @type {any} */
  err.message === "string") {
    const msg = (
      /** @type {any} */
      err.message.trim()
    );
    if (msg) return msg;
  }
  if (typeof err === "string" && err.trim()) return err.trim();
  return "Something went wrong. Please try again.";
}

// src/toast/toast-manager.js
var VARIANTS2 = /* @__PURE__ */ new Set(["info", "success", "warning", "danger", "neutral"]);
var ARIA_LIVE = /* @__PURE__ */ new Set(["polite", "assertive", "off"]);
var OVERFLOW_MODES = /* @__PURE__ */ new Set(["queue", "dismiss-oldest", "dismiss-newest"]);
var DEFAULT_CONFIG = {
  maxVisible: 5,
  overflow: "queue",
  defaultPosition: "top-right",
  defaultDuration: 4e3
};
function normalizeToastOptions(input, config) {
  var _a, _b, _c, _d, _e, _f;
  const raw = typeof input === "string" ? { message: input } : input || {};
  const variant = VARIANTS2.has(raw.variant) ? raw.variant : "info";
  const position = POSITION_SET.has(raw.position) ? raw.position : config.defaultPosition;
  const ariaLive = ARIA_LIVE.has(raw.ariaLive) ? raw.ariaLive : "polite";
  const enterAnimation = ANIMATIONS.has(raw.enterAnimation) ? raw.enterAnimation : "auto";
  const exitAnimation = ANIMATIONS.has(raw.exitAnimation) ? raw.exitAnimation : "auto";
  const duration = raw.duration != null ? Number(raw.duration) : config.defaultDuration;
  return {
    id: raw.id,
    title: raw.title || "",
    message: raw.message || "",
    variant,
    icon: raw.icon,
    position,
    duration: Number.isFinite(duration) ? duration : config.defaultDuration,
    persistent: raw.persistent === true,
    dismissible: (_a = raw.dismissible) != null ? _a : true,
    pauseOnHover: (_b = raw.pauseOnHover) != null ? _b : true,
    pauseOnFocus: (_c = raw.pauseOnFocus) != null ? _c : true,
    showProgress: (_d = raw.showProgress) != null ? _d : false,
    swipeToDismiss: (_e = raw.swipeToDismiss) != null ? _e : true,
    action: raw.action,
    closeLabel: raw.closeLabel,
    enterAnimation,
    exitAnimation,
    ariaLive,
    allowHtml: (_f = raw.allowHtml) != null ? _f : false,
    className: raw.className || "",
    data: raw.data,
    onOpen: raw.onOpen,
    onClose: raw.onClose,
    onAction: raw.onAction
  };
}
var ToastManager = class {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.byId = /* @__PURE__ */ new Map();
    this.containers = /* @__PURE__ */ new Map();
    this.visible = /* @__PURE__ */ new Map();
    this.queues = /* @__PURE__ */ new Map();
    this._visibilityBound = false;
    this._onVisibility = null;
    this.host = {
      reducedMotion: () => this.reducedMotion(),
      handleClosed: (toast) => this.handleClosed(toast)
    };
  }
  /**
   * Update global toast configuration.
   * @param {Partial<typeof DEFAULT_CONFIG>} patch
   */
  configure(patch = {}) {
    if (patch.maxVisible != null) this.config.maxVisible = Math.max(1, Math.floor(patch.maxVisible));
    if (OVERFLOW_MODES.has(patch.overflow)) this.config.overflow = patch.overflow;
    if (POSITION_SET.has(patch.defaultPosition)) this.config.defaultPosition = patch.defaultPosition;
    if (patch.defaultDuration != null && Number.isFinite(Number(patch.defaultDuration))) {
      this.config.defaultDuration = Number(patch.defaultDuration);
    }
    return { ...this.config };
  }
  /** @returns {boolean} */
  reducedMotion() {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  /**
   * Create (or, on a duplicate id, update) a toast. Returns its controller.
   * @param {object|string} input
   * @returns {object} controller
   */
  create(input) {
    const opts = normalizeToastOptions(input, this.config);
    if (opts.id && this.byId.has(opts.id)) {
      const existing = this.byId.get(opts.id);
      existing.update(opts);
      return existing.controller;
    }
    const toast = new Toast(opts, this.host);
    this.byId.set(toast.id, toast);
    if (typeof document !== "undefined" && document.body) {
      this.mount(toast);
    } else {
      whenBodyReady().then(() => {
        if (this.byId.get(toast.id) === toast) this.mount(toast);
      }).catch(() => {
      });
    }
    return toast.controller;
  }
  mount(toast) {
    const position = toast.position;
    const container = this.ensureContainer(position);
    const visible = this.visible.get(position);
    if (visible.length >= this.config.maxVisible) {
      this.handleOverflow(toast, container, visible);
      return;
    }
    this.show(toast, container, visible);
  }
  show(toast, container, visible) {
    toast.build();
    if (isTopPosition(toast.position)) container.insertBefore(toast.el, container.firstChild);
    else container.appendChild(toast.el);
    visible.push(toast);
    toast.enter();
  }
  handleOverflow(toast, container, visible) {
    switch (this.config.overflow) {
      case "dismiss-oldest": {
        const oldest = visible[0];
        if (oldest) oldest.close();
        this.show(toast, container, visible);
        break;
      }
      case "dismiss-newest": {
        this.byId.delete(toast.id);
        toast.close();
        break;
      }
      case "queue":
      default: {
        this.queues.get(toast.position).push(toast);
        break;
      }
    }
  }
  handleClosed(toast) {
    if (this.byId.get(toast.id) === toast) this.byId.delete(toast.id);
    const position = toast.position;
    const visible = this.visible.get(position);
    if (visible) {
      const i = visible.indexOf(toast);
      if (i !== -1) visible.splice(i, 1);
    }
    const queue = this.queues.get(position);
    if (queue && queue.length > 0 && visible && visible.length < this.config.maxVisible) {
      const next = queue.shift();
      if (this.byId.get(next.id) === next) {
        this.show(next, this.ensureContainer(position), visible);
      }
    }
    this.maybeRemoveContainer(position);
    this.maybeUnbindVisibility();
  }
  ensureContainer(position) {
    let container = this.containers.get(position);
    if (container && typeof document !== "undefined" && document.body.contains(container)) {
      return container;
    }
    container = document.createElement("div");
    container.className = `ct-container ct-pos-${position}`;
    container.setAttribute("data-cd-toast-container", position);
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", `Notifications (${position})`);
    document.body.appendChild(container);
    this.containers.set(position, container);
    if (!this.visible.has(position)) this.visible.set(position, []);
    if (!this.queues.has(position)) this.queues.set(position, []);
    this.bindVisibility();
    return container;
  }
  maybeRemoveContainer(position) {
    const visible = this.visible.get(position);
    const queue = this.queues.get(position);
    if ((!visible || visible.length === 0) && (!queue || queue.length === 0)) {
      const container = this.containers.get(position);
      if (container && container.parentNode) container.parentNode.removeChild(container);
      this.containers.delete(position);
    }
  }
  bindVisibility() {
    if (this._visibilityBound || typeof document === "undefined") return;
    this._onVisibility = () => {
      const hidden = document.hidden;
      for (const toast of this.byId.values()) toast.setHidden(hidden);
    };
    document.addEventListener("visibilitychange", this._onVisibility);
    this._visibilityBound = true;
  }
  maybeUnbindVisibility() {
    if (this._visibilityBound && this.byId.size === 0 && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this._onVisibility);
      this._visibilityBound = false;
      this._onVisibility = null;
    }
  }
  /** @param {string} id @returns {Promise<void>} */
  closeToast(id) {
    const toast = this.byId.get(id);
    return toast ? toast.close() : Promise.resolve();
  }
  /** @param {string} id @returns {object|null} controller */
  getToast(id) {
    const toast = this.byId.get(id);
    return toast ? toast.controller : null;
  }
  /**
   * Close all toasts, optionally filtered by position and/or variant.
   * @param {{ position?: string, variant?: string }} [filter]
   * @returns {Promise<void>}
   */
  closeAllToasts(filter = {}) {
    const targets = [...this.byId.values()].filter((t) => {
      if (filter.position && t.position !== filter.position) return false;
      if (filter.variant && t.options.variant !== filter.variant) return false;
      return true;
    });
    return Promise.all(targets.map((t) => t.close())).then(() => {
    });
  }
};
var toastManager = new ToastManager();

// src/index.js
var sharedRoot = null;
function ensureRoot() {
  if (sharedRoot && document.body.contains(sharedRoot)) return sharedRoot;
  const existing = document.querySelector("[data-cd-root]");
  if (existing) {
    sharedRoot = /** @type {HTMLElement} */
    existing;
    return sharedRoot;
  }
  const root = document.createElement("div");
  root.className = "cd-root";
  root.setAttribute("data-cd-root", "");
  root.hidden = true;
  document.body.appendChild(root);
  sharedRoot = root;
  return root;
}
var SHARED_DEFAULTS = {
  variant: "info",
  dismissible: true,
  closeOnEscape: true,
  closeOnBackdrop: false,
  allowHtml: false
};
function normalizeOptions(type, input) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const raw = typeof input === "string" ? { message: input } : input || {};
  const variant = VARIANTS.has(raw.variant) ? raw.variant : SHARED_DEFAULTS.variant;
  const perType = {
    alert: { confirmText: "OK", defaultFocus: "confirm" },
    confirm: {
      confirmText: "OK",
      cancelText: "Cancel",
      // Destructive dialogs default focus to the safer Cancel button.
      defaultFocus: variant === "danger" ? "cancel" : "confirm"
    },
    prompt: {
      confirmText: "OK",
      cancelText: "Cancel",
      defaultFocus: "input",
      inputType: "text",
      defaultValue: ""
    }
  };
  return {
    type,
    title: raw.title || "",
    message: raw.message || "",
    variant,
    icon: raw.icon,
    dismissible: (_a = raw.dismissible) != null ? _a : SHARED_DEFAULTS.dismissible,
    closeOnEscape: (_b = raw.closeOnEscape) != null ? _b : SHARED_DEFAULTS.closeOnEscape,
    closeOnBackdrop: (_c = raw.closeOnBackdrop) != null ? _c : SHARED_DEFAULTS.closeOnBackdrop,
    allowHtml: (_d = raw.allowHtml) != null ? _d : SHARED_DEFAULTS.allowHtml,
    className: raw.className || "",
    ariaLabel: raw.ariaLabel,
    confirmText: (_e = raw.confirmText) != null ? _e : perType[type].confirmText,
    cancelText: (_f = raw.cancelText) != null ? _f : perType[type].cancelText,
    defaultFocus: (_g = raw.defaultFocus) != null ? _g : perType[type].defaultFocus,
    onConfirm: raw.onConfirm,
    validate: raw.validate,
    // prompt-only
    inputType: (_h = raw.inputType) != null ? _h : perType[type].inputType,
    inputLabel: raw.inputLabel,
    placeholder: (_i = raw.placeholder) != null ? _i : "",
    defaultValue: (_j = raw.defaultValue) != null ? _j : perType[type].defaultValue,
    invalidMessage: raw.invalidMessage,
    closeLabel: raw.closeLabel
  };
}
function show(type, input) {
  const options = normalizeOptions(type, input);
  return dialogQueue.enqueue(async () => {
    await whenBodyReady();
    const root = ensureRoot();
    const dialog = new Dialog(options, root);
    return dialog.open();
  });
}
function customAlert(options) {
  return show("alert", options);
}
function customConfirm(options) {
  return show("confirm", options);
}
function customPrompt(options) {
  return show("prompt", options);
}
function normalizeChoiceOptions(input) {
  var _a, _b, _c, _d;
  const raw = input && typeof input === "object" ? input : {};
  const buttons = Array.isArray(raw.buttons) ? raw.buttons : [];
  if (buttons.length === 0) {
    throw new Error("customChoice requires at least one button in `buttons`.");
  }
  let hasCancel = false;
  let cancelValue = null;
  const normButtons = buttons.map((b) => {
    const isCancel = b && b.role === "cancel";
    if (isCancel) {
      if (hasCancel) {
        throw new Error("customChoice allows at most one button with role:'cancel'.");
      }
      hasCancel = true;
      cancelValue = b.value;
    }
    return {
      value: b.value,
      text: b && b.text != null ? String(b.text) : "",
      variant: b && b.variant,
      role: isCancel ? "cancel" : void 0
    };
  });
  const variant = VARIANTS.has(raw.variant) ? raw.variant : SHARED_DEFAULTS.variant;
  return {
    type: "choice",
    title: raw.title || "",
    message: raw.message || "",
    variant,
    icon: raw.icon,
    dismissible: (_a = raw.dismissible) != null ? _a : SHARED_DEFAULTS.dismissible,
    closeOnEscape: (_b = raw.closeOnEscape) != null ? _b : SHARED_DEFAULTS.closeOnEscape,
    closeOnBackdrop: (_c = raw.closeOnBackdrop) != null ? _c : SHARED_DEFAULTS.closeOnBackdrop,
    allowHtml: (_d = raw.allowHtml) != null ? _d : SHARED_DEFAULTS.allowHtml,
    className: raw.className || "",
    ariaLabel: raw.ariaLabel,
    closeLabel: raw.closeLabel,
    onClose: raw.onClose,
    buttons: normButtons,
    hasCancel,
    cancelValue,
    // A button `value` or the literal 'cancel'; resolved in Dialog at focus time.
    defaultFocus: raw.defaultFocus
  };
}
function customChoice(options) {
  const normalized = normalizeChoiceOptions(options);
  return dialogQueue.enqueue(async () => {
    await whenBodyReady();
    const root = ensureRoot();
    const dialog = new Dialog(normalized, root);
    return dialog.open();
  });
}
function customToast(options) {
  return toastManager.create(options);
}
function configureToasts(config) {
  return toastManager.configure(config);
}
function closeToast(id) {
  return toastManager.closeToast(id);
}
function getToast(id) {
  return toastManager.getToast(id);
}
function closeAllToasts(filter) {
  return toastManager.closeAllToasts(filter);
}
var CustomDialog = {
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
  closeAllToasts
};
var index_default = CustomDialog;
export {
  CustomDialog,
  closeAllToasts,
  closeToast,
  configureToasts,
  customAlert,
  customChoice,
  customConfirm,
  customPrompt,
  customToast,
  index_default as default,
  getToast
};
