/**
 * @file A single toast notification: rendering, enter/exit animation (with a
 * safe timeout fallback), the pausable timer + progress wiring, the async action
 * state machine, and swipe gestures. Exposes a small controller facade
 * ({ id, update, close, isOpen }). Knows nothing about stacking/containers/limits
 * — that is the manager's job. Never traps focus, locks scroll, or inerts.
 */

import { setContent, isPromise, generateId } from '../utils.js';
import { buildVariantIcon, buildSpinner, buildCloseIcon } from '../icons.js';
import { ToastTimer } from './toast-timer.js';
import { resolveAnimations } from './toast-positions.js';
import { attachSwipe } from './toast-gestures.js';

/** Fallback timings (ms) that guarantee cleanup even if transitionend never fires. */
const ENTER_FALLBACK = 260;
const EXIT_FALLBACK = 300;
const REDUCED_FALLBACK = 20;

export class Toast {
  /**
   * @param {object} options - Normalised toast options (see normalizeToastOptions).
   * @param {object} host - Manager callbacks.
   * @param {() => boolean} host.reducedMotion
   * @param {(toast: Toast) => void} host.handleClosed - Called after full cleanup.
   */
  constructor(options, host) {
    this.options = options;
    this.host = host;
    this.id = options.id || generateId('toast');
    this.position = options.position;
    this.state = 'idle'; // idle → entering → open → leaving → closed

    this.titleId = generateId('ct-title');
    this.msgId = generateId('ct-msg');

    /** @type {ToastTimer | null} */
    this.timer = null;
    /** Pause reasons tracked even before the timer exists (e.g. hover during enter). */
    this.pauseReasons = new Set();
    this.actionPending = false;

    /** @type {Record<string, any>} */
    this.els = {};
    /** @type {(() => void) | null} */
    this.detachSwipe = null;

    this._enterDone = false;
    this._exitDone = false;
    /** @type {Promise<void> | null} */
    this._closePromise = null;
    this._resolveClose = null;
    this._enterFallback = null;
    this._exitFallback = null;

    /** Stable controller facade returned to callers. */
    this.controller = Object.freeze({
      id: this.id,
      update: (opts) => {
        this.update(opts);
        return this.controller;
      },
      close: () => this.close(),
      isOpen: () => this.isOpen(),
    });
  }

  /** @returns {boolean} */
  isOpen() {
    return this.state === 'entering' || this.state === 'open';
  }

  /* ------------------------------------------------------------------ build */

  build() {
    const o = this.options;
    const el = document.createElement('div');
    el.className = `ct-toast ct-variant-${o.variant}`;
    if (o.className) el.className += ` ${o.className}`;
    el.setAttribute('data-cd-toast', this.id);
    // Live-region semantics live on the toast itself (not the container) to
    // avoid nested live regions / duplicate announcements.
    el.setAttribute('role', o.ariaLive === 'assertive' ? 'alert' : 'status');
    el.setAttribute('aria-live', o.ariaLive);
    el.setAttribute('aria-atomic', 'true');

    // Icon
    if (o.icon !== false) {
      const iconWrap = document.createElement('div');
      iconWrap.className = 'ct-icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      if (o.icon && typeof o.icon === 'object' && o.icon.nodeType) iconWrap.appendChild(o.icon);
      else if (typeof o.icon === 'string') iconWrap.textContent = o.icon;
      else iconWrap.appendChild(buildVariantIcon(o.variant));
      el.appendChild(iconWrap);
      this.els.icon = iconWrap;
    }

    const content = document.createElement('div');
    content.className = 'ct-content';

    const title = document.createElement('div');
    title.className = 'ct-title';
    title.id = this.titleId;
    content.appendChild(title);
    this.els.title = title;

    const message = document.createElement('div');
    message.className = 'ct-message';
    message.id = this.msgId;
    content.appendChild(message);
    this.els.message = message;

    const error = document.createElement('div');
    error.className = 'ct-error';
    error.hidden = true;
    content.appendChild(error);
    this.els.error = error;

    const actions = document.createElement('div');
    actions.className = 'ct-actions';
    content.appendChild(actions);
    this.els.actions = actions;

    el.appendChild(content);
    this.els.content = content;

    // Close button
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ct-close';
    close.setAttribute('aria-label', o.closeLabel || 'Dismiss notification');
    close.appendChild(buildCloseIcon(18));
    close.addEventListener('click', () => this.close());
    el.appendChild(close);
    this.els.close = close;

    // Progress bar
    const progress = document.createElement('div');
    progress.className = 'ct-progress';
    progress.setAttribute('aria-hidden', 'true');
    const bar = document.createElement('div');
    bar.className = 'ct-progress-bar';
    progress.appendChild(bar);
    el.appendChild(progress);
    this.els.progress = progress;
    this.els.progressBar = bar;

    this.el = el;
    this.applyContent();
    this.applyDismissible();
    this.applyProgressVisibility();

    // Bind pause listeners now (not at timer-start) so an interaction during the
    // enter animation is captured and applied once the timer begins.
    this.bindPauseListeners();

    // Swipe-to-dismiss (Pointer Events). Isolated; failure here can't break the toast.
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

    // aria-labelledby/describedby for the action/close relationship.
    if (o.title) this.el.setAttribute('aria-labelledby', this.titleId);
    else this.el.removeAttribute('aria-labelledby');

    this.renderAction();
  }

  applyDismissible() {
    this.els.close.hidden = !this.options.dismissible;
  }

  applyProgressVisibility() {
    const show = this.options.showProgress && !this.isPersistent() && this.options.duration > 0;
    this.els.progress.hidden = !show;
  }

  isPersistent() {
    return this.options.persistent === true;
  }

  renderAction() {
    const actions = this.els.actions;
    actions.textContent = '';
    const action = this.options.action;
    const handler = (action && action.onClick) || this.options.onAction;
    if (!action || !action.label) {
      actions.hidden = true;
      this.els.actionBtn = null;
      return;
    }
    actions.hidden = false;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ct-action';
    const label = document.createElement('span');
    label.className = 'ct-action-label';
    label.textContent = action.label;
    btn.appendChild(label);
    btn.addEventListener('click', () => this.runAction(handler, action));
    actions.appendChild(btn);
    this.els.actionBtn = btn;
    this.els.actionLabel = label;
  }

  /* ------------------------------------------------------------------ enter */

  /** Called by the manager once the element is in its container. */
  enter() {
    const o = this.options;
    const { enter } = resolveAnimations(o.position, o.enterAnimation, o.exitAnimation);
    this.state = 'entering';
    const reduced = this.host.reducedMotion();

    this.el.classList.add('ct-animating');
    if (!reduced && enter !== 'none') {
      this.el.classList.add(`ct-from-${enter}`);
      // Next frame: remove the "from" offset so the transition runs to rest.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (this.state !== 'entering') return;
          this.el.classList.remove(`ct-from-${enter}`);
        });
      });
    }

    const onEnd = (e) => {
      if (e && e.target !== this.el) return;
      this._completeEnter();
    };
    this._onEnterEnd = onEnd;
    this.el.addEventListener('transitionend', onEnd);
    this._enterFallback = setTimeout(
      () => this._completeEnter(),
      reduced ? REDUCED_FALLBACK : ENTER_FALLBACK,
    );
  }

  _completeEnter() {
    if (this._enterDone || this.state === 'closed' || this.state === 'leaving') return;
    this._enterDone = true;
    if (this._onEnterEnd) this.el.removeEventListener('transitionend', this._onEnterEnd);
    clearTimeout(this._enterFallback);
    this.el.classList.remove('ct-animating');
    this.state = 'open';
    this.startTiming(); // timer only begins after the toast has visibly entered
    safeCall(this.options.onOpen);
  }

  /* ------------------------------------------------------------------ timing */

  startTiming() {
    if (this.isPersistent() || this.options.duration <= 0) return;
    this.timer = new ToastTimer({
      duration: this.options.duration,
      onExpire: () => this.close(),
      onChange: (remaining, duration, running) => this.updateProgress(remaining, duration, running),
    });
    this.timer.start();
    // Seed pause reasons captured before the timer existed (hover/focus during
    // the enter animation, or an already-hidden tab).
    if (typeof document !== 'undefined' && document.hidden) this.pauseReasons.add('hidden');
    for (const reason of this.pauseReasons) this.timer.pause(reason);
  }

  bindPauseListeners() {
    const o = this.options;
    if (o.pauseOnHover) {
      this._onEnter = () => this.pauseReason('hover');
      this._onLeave = () => this.resumeReason('hover');
      this.el.addEventListener('pointerenter', this._onEnter);
      this.el.addEventListener('pointerleave', this._onLeave);
    }
    if (o.pauseOnFocus) {
      this._onFocusIn = () => this.pauseReason('focus');
      this._onFocusOut = () => this.resumeReason('focus');
      this.el.addEventListener('focusin', this._onFocusIn);
      this.el.addEventListener('focusout', this._onFocusOut);
    }
  }

  /** Manager forwards document visibility changes here. */
  setHidden(hidden) {
    if (hidden) this.pauseReason('hidden');
    else this.resumeReason('hidden');
  }

  updateProgress(remaining, duration, running) {
    const bar = this.els.progressBar;
    if (!bar || this.els.progress.hidden) return;
    const frac = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
    const reduced = this.host.reducedMotion();
    if (running && !reduced) {
      bar.style.transition = 'none';
      bar.style.transform = `scaleX(${frac})`;
      void bar.offsetWidth; // reflow so the next transition starts from `frac`
      bar.style.transition = `transform ${Math.round(remaining)}ms linear`;
      bar.style.transform = 'scaleX(0)';
    } else {
      bar.style.transition = 'none';
      bar.style.transform = `scaleX(${frac})`;
    }
  }

  /* ------------------------------------------------------------------ action */

  /**
   * @param {(() => any) | undefined} handler
   * @param {object} action
   */
  async runAction(handler, action) {
    if (this.actionPending || this.state === 'leaving' || this.state === 'closed') return;
    if (typeof handler !== 'function') {
      // No handler: treat as a simple acknowledgement that closes the toast.
      this.close();
      return;
    }
    this.actionPending = true;
    this.setActionLoading(true, action);
    this.clearError();
    this.pauseReason('action');

    try {
      const result = handler();
      if (isPromise(result)) await result;
      // Success.
      this.actionPending = false;
      if (action.closeOnSuccess !== false) {
        this.close();
      } else {
        this.setActionLoading(false, action);
        this.resumeReason('action');
      }
    } catch (err) {
      // Keep the toast open, show a safe message, allow retry or dismiss.
      this.actionPending = false;
      this.setActionLoading(false, action);
      if (this.timer) this.timer.cancel(); // stop auto-dismiss after a failure
      this.showError(safeErrorMessage(err));
    }
  }

  setActionLoading(loading, action) {
    const btn = this.els.actionBtn;
    const label = this.els.actionLabel;
    if (!btn) return;
    btn.toggleAttribute('disabled', loading);
    btn.setAttribute('aria-busy', String(loading));
    this.els.close.toggleAttribute('disabled', loading);
    if (loading) {
      if (action.pendingLabel) label.textContent = action.pendingLabel;
      if (!this.els.actionSpinner) {
        this.els.actionSpinner = buildSpinner('cd-spinner');
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
    this.els.error.textContent = '';
    this.els.error.hidden = true;
  }

  /* ------------------------------------------------------------------ update */

  /**
   * Update in place. Restarts the timer when a new duration/persistence is given.
   * `position` changes are ignored (documented limitation).
   * @param {object} patch
   */
  update(patch) {
    if (this.state === 'closed' || this.state === 'leaving') return; // graceful no-op
    const prev = this.options;
    const next = { ...prev, ...patch };
    if (patch && patch.position) next.position = prev.position; // position is immutable post-create
    this.options = next;

    // Not built yet (deferred mount): the new options will be applied at build().
    if (!this.el) return;

    // Variant class
    if (patch.variant && patch.variant !== prev.variant) {
      this.el.classList.remove(`ct-variant-${prev.variant}`);
      this.el.classList.add(`ct-variant-${next.variant}`);
      // Replace the default icon if the caller didn't supply a custom one.
      if (next.icon == null && this.els.icon) {
        this.els.icon.textContent = '';
        this.els.icon.appendChild(buildVariantIcon(next.variant));
      }
    }
    if (patch.ariaLive && patch.ariaLive !== prev.ariaLive) {
      this.el.setAttribute('role', next.ariaLive === 'assertive' ? 'alert' : 'status');
      this.el.setAttribute('aria-live', next.ariaLive);
    }

    this.applyContent();
    this.applyDismissible();
    this.applyProgressVisibility();

    if (next.swipeToDismiss && !this.detachSwipe) this.setupSwipe();
    if (!next.swipeToDismiss && this.detachSwipe) this.teardownSwipe();

    // --- Timing transitions ------------------------------------------------
    // Only manage timing once the toast has entered (otherwise startTiming will
    // pick up the new options when it runs).
    if (this.state !== 'open') return;

    const becamePersistent = next.persistent === true;
    if (becamePersistent) {
      // timed → persistent: stop the timer immediately.
      if (this.timer) {
        this.timer.cancel();
        this.timer = null;
      }
      this.updateProgress(0, 0, false);
    } else if (next.duration > 0) {
      // Restart (or begin) the timer with the new duration.
      if (!this.timer) this.startTiming();
      else this.timer.reset(next.duration);
    }
  }

  /* ------------------------------------------------------------------ swipe */

  setupSwipe() {
    if (this.detachSwipe || !this.el) return;
    this.detachSwipe = attachSwipe(this.el, {
      reducedMotion: this.host.reducedMotion(),
      onGestureStart: () => this.pauseReason('gesture'),
      onGestureEnd: () => this.resumeReason('gesture'),
      onDismiss: (dir) => this.close({ swipeDirection: dir }),
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

    // If we never entered, just tear down.
    if (this.state === 'idle') {
      this._cleanup();
      return this._closePromise;
    }

    this.state = 'leaving';
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

    // Collapse the row smoothly: pin current height, then animate to 0 so the
    // stack closes the gap without other toasts jumping.
    const h = el.offsetHeight;
    el.style.maxHeight = `${h}px`;
    void el.offsetWidth; // reflow

    el.classList.add('ct-leaving');
    if (!reduced && exit !== 'none') {
      if (swipeDirection) el.classList.add(swipeDirection > 0 ? 'ct-out-slide-right' : 'ct-out-slide-left');
      else el.classList.add(`ct-out-${exit}`);
    }
    el.style.maxHeight = '0px';
    el.style.marginTop = '0px';
    el.style.marginBottom = '0px';

    const onEnd = (e) => {
      if (e && e.target !== el) return;
      this._completeExit();
    };
    this._onExitEnd = onEnd;
    el.addEventListener('transitionend', onEnd);
    this._exitFallback = setTimeout(() => this._completeExit(), reduced ? REDUCED_FALLBACK : EXIT_FALLBACK);
  }

  _completeExit() {
    if (this._exitDone) return;
    this._exitDone = true;
    if (this._onExitEnd) this.el.removeEventListener('transitionend', this._onExitEnd);
    clearTimeout(this._exitFallback);
    this._cleanup();
  }

  /** Remove from DOM, detach every listener/timer, resolve, notify the manager. */
  _cleanup() {
    if (this.state === 'closed') {
      if (this._resolveClose) this._resolveClose();
      return;
    }
    this.state = 'closed';

    clearTimeout(this._enterFallback);
    clearTimeout(this._exitFallback);
    if (this.timer) {
      this.timer.cancel();
      this.timer = null;
    }
    this.teardownSwipe();

    if (this.el) {
      // Remove pause/transition listeners by replacing nothing — explicit removes:
      if (this._onEnter) this.el.removeEventListener('pointerenter', this._onEnter);
      if (this._onLeave) this.el.removeEventListener('pointerleave', this._onLeave);
      if (this._onFocusIn) this.el.removeEventListener('focusin', this._onFocusIn);
      if (this._onFocusOut) this.el.removeEventListener('focusout', this._onFocusOut);
      if (this._onEnterEnd) this.el.removeEventListener('transitionend', this._onEnterEnd);
      if (this._onExitEnd) this.el.removeEventListener('transitionend', this._onExitEnd);
      if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    }

    safeCall(this.options.onClose);
    const host = this.host;
    // Drop DOM references so the controller can't retain orphaned nodes.
    this.el = null;
    this.els = {};
    if (this._resolveClose) this._resolveClose();
    host.handleClosed(this);
  }
}

/** Call a user callback without letting it break internal flow. */
function safeCall(fn) {
  if (typeof fn !== 'function') return;
  try {
    fn();
  } catch {
    /* swallow user callback errors */
  }
}

/**
 * Produce a safe, human-readable error string — never a raw stack trace or
 * internal object. Caller-thrown Error.message is shown verbatim (the caller's
 * responsibility to keep it user-safe); anything else falls back to a generic.
 * @param {unknown} err
 * @returns {string}
 */
function safeErrorMessage(err) {
  if (err && typeof err === 'object' && typeof (/** @type {any} */ (err).message) === 'string') {
    const msg = /** @type {any} */ (err).message.trim();
    if (msg) return msg;
  }
  if (typeof err === 'string' && err.trim()) return err.trim();
  return 'Something went wrong. Please try again.';
}

export { safeErrorMessage };
