/**
 * @file A pausable countdown timer that tracks multiple independent pause
 * reasons (hover, focus, hidden tab, gesture, async action). The countdown only
 * runs when there are zero active pause reasons, and resumes with the *actual*
 * remaining time rather than restarting.
 *
 * No DOM. The owner supplies an `onExpire` callback and (optionally) an
 * `onTick` callback used to drive a progress indicator.
 */

/** Monotonic-ish clock; performance.now when available, else Date.now. */
function now() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export class ToastTimer {
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
    this.onChange = onChange || (() => {});
    /** @type {Set<string>} */
    this.pauseReasons = new Set();
    /** @type {ReturnType<typeof setTimeout> | null} */
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
}
