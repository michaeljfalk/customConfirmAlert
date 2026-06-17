/*! customConfirmAlert v1.0.1 | MIT License | https://github.com/michaeljfalk/customConfirmAlert */

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

// src/dialog.js
var VARIANTS = /* @__PURE__ */ new Set(["info", "success", "warning", "danger"]);
function buildIcon(variant) {
  const common = {
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
      svgEl("path", { d: "M10.29 3.86l-8.18 14A1.5 1.5 0 003.4 20h17.2a1.5 1.5 0 001.29-2.14l-8.18-14a1.5 1.5 0 00-2.62 0z" }),
      svgEl("line", { x1: 12, y1: 9, x2: 12, y2: 13 }),
      svgEl("line", { x1: 12, y1: 17, x2: 12.01, y2: 17 })
    ],
    danger: [
      svgEl("circle", { cx: 12, cy: 12, r: 10 }),
      svgEl("line", { x1: 15, y1: 9, x2: 9, y2: 15 }),
      svgEl("line", { x1: 9, y1: 9, x2: 15, y2: 15 })
    ]
  };
  return svgEl("svg", common, glyphs[variant] || glyphs.info);
}
function buildSpinner() {
  return svgEl(
    "svg",
    {
      class: "cd-spinner",
      viewBox: "0 0 24 24",
      width: 18,
      height: 18,
      "aria-hidden": "true",
      focusable: "false"
    },
    [svgEl("circle", { cx: 12, cy: 12, r: 9, fill: "none", "stroke-width": 3 })]
  );
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
        iconWrap.appendChild(buildIcon(o.variant));
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
      close.appendChild(
        svgEl(
          "svg",
          { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "aria-hidden": "true", focusable: "false" },
          [svgEl("line", { x1: 6, y1: 6, x2: 18, y2: 18 }), svgEl("line", { x1: 18, y1: 6, x2: 6, y2: 18 })]
        )
      );
      close.addEventListener("click", () => this.cancel());
      dialog.appendChild(close);
      this.els.close = close;
    }
    const footer = document.createElement("div");
    footer.className = "cd-footer";
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
  /** @returns {HTMLElement | null} The element to focus on open. */
  getInitialFocus() {
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
    this.els = {};
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
var CustomDialog = {
  alert: customAlert,
  confirm: customConfirm,
  prompt: customPrompt,
  /** @returns {number} Dialogs currently waiting in the queue. */
  get queueSize() {
    return dialogQueue.size;
  }
};
var index_default = CustomDialog;
export {
  CustomDialog,
  customAlert,
  customConfirm,
  customPrompt,
  index_default as default
};
