/**
 * @file Toast manager: owns lazy per-position containers, stacking order,
 * visible/queue bookkeeping, global limits + overflow policy, ID deduplication,
 * the id→toast registry, and document-visibility pause forwarding.
 *
 * Completely independent of the modal dialog queue/root/scroll-lock/focus.
 */

import { whenBodyReady } from '../utils.js';
import { Toast } from './toast.js';
import { POSITION_SET, ANIMATIONS, isTopPosition } from './toast-positions.js';

const VARIANTS = new Set(['info', 'success', 'warning', 'danger', 'neutral']);
const ARIA_LIVE = new Set(['polite', 'assertive', 'off']);
const OVERFLOW_MODES = new Set(['queue', 'dismiss-oldest', 'dismiss-newest']);

const DEFAULT_CONFIG = {
  maxVisible: 5,
  overflow: 'queue',
  defaultPosition: 'top-right',
  defaultDuration: 4000,
};

/**
 * Merge user input with config-aware defaults and validate enums.
 * @param {object|string} input - String is treated as the message.
 * @param {typeof DEFAULT_CONFIG} config
 * @returns {object}
 */
export function normalizeToastOptions(input, config) {
  const raw = typeof input === 'string' ? { message: input } : input || {};
  const variant = VARIANTS.has(raw.variant) ? raw.variant : 'info';
  const position = POSITION_SET.has(raw.position) ? raw.position : config.defaultPosition;
  const ariaLive = ARIA_LIVE.has(raw.ariaLive) ? raw.ariaLive : 'polite';
  const enterAnimation = ANIMATIONS.has(raw.enterAnimation) ? raw.enterAnimation : 'auto';
  const exitAnimation = ANIMATIONS.has(raw.exitAnimation) ? raw.exitAnimation : 'auto';
  const duration = raw.duration != null ? Number(raw.duration) : config.defaultDuration;

  return {
    id: raw.id,
    title: raw.title || '',
    message: raw.message || '',
    variant,
    icon: raw.icon,
    position,
    duration: Number.isFinite(duration) ? duration : config.defaultDuration,
    persistent: raw.persistent === true,
    dismissible: raw.dismissible ?? true,
    pauseOnHover: raw.pauseOnHover ?? true,
    pauseOnFocus: raw.pauseOnFocus ?? true,
    showProgress: raw.showProgress ?? false,
    swipeToDismiss: raw.swipeToDismiss ?? true,
    action: raw.action,
    closeLabel: raw.closeLabel,
    enterAnimation,
    exitAnimation,
    ariaLive,
    allowHtml: raw.allowHtml ?? false,
    className: raw.className || '',
    data: raw.data,
    onOpen: raw.onOpen,
    onClose: raw.onClose,
    onAction: raw.onAction,
  };
}

export class ToastManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    /** @type {Map<string, Toast>} id → toast (visible OR queued) */
    this.byId = new Map();
    /** @type {Map<string, HTMLElement>} position → container */
    this.containers = new Map();
    /** @type {Map<string, Toast[]>} position → visible toasts (creation order) */
    this.visible = new Map();
    /** @type {Map<string, Toast[]>} position → pending toasts (overflow=queue) */
    this.queues = new Map();
    this._visibilityBound = false;
    this._onVisibility = null;

    this.host = {
      reducedMotion: () => this.reducedMotion(),
      handleClosed: (toast) => this.handleClosed(toast),
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
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /**
   * Create (or, on a duplicate id, update) a toast. Returns its controller.
   * @param {object|string} input
   * @returns {object} controller
   */
  create(input) {
    const opts = normalizeToastOptions(input, this.config);

    // Deduplicate by id: update the existing toast in place, return its controller.
    if (opts.id && this.byId.has(opts.id)) {
      const existing = this.byId.get(opts.id);
      existing.update(opts);
      return existing.controller;
    }

    const toast = new Toast(opts, this.host);
    this.byId.set(toast.id, toast);

    if (typeof document !== 'undefined' && document.body) {
      this.mount(toast);
    } else {
      // Graceful when document.body is not yet available.
      whenBodyReady()
        .then(() => {
          if (this.byId.get(toast.id) === toast) this.mount(toast);
        })
        .catch(() => {});
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
    // Top positions: newest nearest the top edge (prepend).
    // Bottom positions: newest nearest the bottom edge (append).
    if (isTopPosition(toast.position)) container.insertBefore(toast.el, container.firstChild);
    else container.appendChild(toast.el);
    visible.push(toast);
    toast.enter();
  }

  handleOverflow(toast, container, visible) {
    switch (this.config.overflow) {
      case 'dismiss-oldest': {
        const oldest = visible[0];
        if (oldest) oldest.close();
        this.show(toast, container, visible);
        break;
      }
      case 'dismiss-newest': {
        // Discard the incoming request.
        this.byId.delete(toast.id);
        toast.close();
        break;
      }
      case 'queue':
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
    // Promote the next queued toast if there is room.
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
    if (container && typeof document !== 'undefined' && document.body.contains(container)) {
      return container;
    }
    container = document.createElement('div');
    container.className = `ct-container ct-pos-${position}`;
    container.setAttribute('data-cd-toast-container', position);
    // A region wrapper for AT, but NOT a live region (toasts carry that).
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', `Notifications (${position})`);
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
    if (this._visibilityBound || typeof document === 'undefined') return;
    this._onVisibility = () => {
      const hidden = document.hidden;
      for (const toast of this.byId.values()) toast.setHidden(hidden);
    };
    document.addEventListener('visibilitychange', this._onVisibility);
    this._visibilityBound = true;
  }

  maybeUnbindVisibility() {
    if (this._visibilityBound && this.byId.size === 0 && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibility);
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
    return Promise.all(targets.map((t) => t.close())).then(() => {});
  }
}

/** Shared manager instance for the public API. */
export const toastManager = new ToastManager();
