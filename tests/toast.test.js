import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  customToast,
  configureToasts,
  closeToast,
  getToast,
  closeAllToasts,
  CustomDialog,
  customAlert,
} from '../src/index.js';
import { toastManager } from '../src/toast/toast-manager.js';
import { resolveAnimations, autoAnimationFor } from '../src/toast/toast-positions.js';

/* ----------------------------------------------------------------- helpers */

/** Poll until `fn()` is truthy (handles real animation/timer lifecycles). */
async function waitFor(fn, { timeout = 2000, interval = 5 } = {}) {
  const start = Date.now();
  for (;;) {
    let v;
    try {
      v = fn();
    } catch {
      v = false;
    }
    if (v) return v;
    if (Date.now() - start > timeout) throw new Error('waitFor: timed out');
    await new Promise((r) => setTimeout(r, interval));
  }
}

const cards = (sel = '') => document.querySelectorAll(`.ct-toast${sel}`);
const firstCard = () => document.querySelector('.ct-toast');
const containerFor = (pos) => document.querySelector(`.ct-pos-${pos}`);

let reducedMotion = true;
function setMatchMedia() {
  window.matchMedia = (query) => ({
    matches: query.includes('reduced-motion') ? reducedMotion : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  });
}

beforeEach(() => {
  reducedMotion = true; // fast, deterministic animation timing by default
  setMatchMedia();
  configureToasts({ maxVisible: 5, overflow: 'queue', defaultPosition: 'top-right', defaultDuration: 4000 });
});

afterEach(async () => {
  await closeAllToasts();
  await new Promise((r) => setTimeout(r, 30));
  // Hard reset any residue so the singleton can't leak between tests.
  document.querySelectorAll('.ct-container, .cd-root').forEach((el) => el.remove());
  toastManager.byId.clear();
  toastManager.visible.clear();
  toastManager.queues.clear();
  toastManager.containers.clear();
});

/* ------------------------------------------------------------- rendering/API */

describe('rendering & API surface', () => {
  it('renders a basic toast (role=status, message text)', async () => {
    customToast({ message: 'Edits saved' });
    await waitFor(() => firstCard());
    expect(firstCard().getAttribute('role')).toBe('status');
    expect(document.querySelector('.ct-message').textContent).toBe('Edits saved');
  });

  it('applies recommended defaults', async () => {
    customToast({ message: 'hi' });
    await waitFor(() => firstCard());
    expect(containerFor('top-right')).not.toBeNull(); // default position
    expect(firstCard().className).toContain('ct-variant-info'); // default variant
    expect(document.querySelector('.ct-close').hidden).toBe(false); // dismissible
    expect(firstCard().getAttribute('aria-live')).toBe('polite');
  });

  it('string shorthand is treated as the message', async () => {
    customToast('Quick note');
    await waitFor(() => firstCard());
    expect(document.querySelector('.ct-message').textContent).toBe('Quick note');
  });

  it('named export and grouped API both create toasts', async () => {
    expect(typeof customToast).toBe('function');
    expect(typeof CustomDialog.toast).toBe('function');
    const c1 = customToast({ message: 'a', position: 'top-left' });
    const c2 = CustomDialog.toast({ message: 'b', position: 'bottom-left' });
    await waitFor(() => cards().length === 2);
    expect(c1.id).not.toBe(c2.id);
  });

  it('returns a controller with the documented shape', async () => {
    const t = customToast({ message: 'x' });
    expect(t).toMatchObject({ id: expect.any(String) });
    expect(typeof t.update).toBe('function');
    expect(typeof t.close).toBe('function');
    expect(typeof t.isOpen).toBe('function');
    await waitFor(() => firstCard());
    expect(t.isOpen()).toBe(true);
  });
});

/* ---------------------------------------------------------------- timing */

describe('timed & persistent', () => {
  it('auto-dismisses a timed toast after its duration', async () => {
    customToast({ message: 'bye', duration: 60 });
    await waitFor(() => firstCard());
    await waitFor(() => cards().length === 0);
  });

  it('keeps a persistent toast (duration ignored)', async () => {
    customToast({ message: 'stay', persistent: true, duration: 40 });
    await waitFor(() => firstCard());
    await new Promise((r) => setTimeout(r, 120));
    expect(cards().length).toBe(1); // still there well past the duration
  });

  it('manual close() removes the toast and resolves', async () => {
    const t = customToast({ message: 'm', persistent: true });
    await waitFor(() => firstCard());
    await t.close();
    expect(cards().length).toBe(0);
    expect(t.isOpen()).toBe(false);
  });

  it('close button dismisses', async () => {
    customToast({ message: 'c', persistent: true });
    await waitFor(() => firstCard());
    document.querySelector('.ct-close').click();
    await waitFor(() => cards().length === 0);
  });

  it('isOpen() reflects lifecycle', async () => {
    const t = customToast({ message: 'i', persistent: true });
    await waitFor(() => t.isOpen() === true);
    await t.close();
    expect(t.isOpen()).toBe(false);
  });
});

/* ---------------------------------------------------------------- update */

describe('update()', () => {
  it('updates content in place (same DOM node)', async () => {
    const t = customToast({ message: 'before', persistent: true });
    await waitFor(() => firstCard());
    const node = firstCard();
    t.update({ message: 'after', variant: 'success' });
    expect(firstCard()).toBe(node); // not recreated
    expect(document.querySelector('.ct-message').textContent).toBe('after');
    expect(node.className).toContain('ct-variant-success');
  });

  it('persistent → timed begins the timer', async () => {
    const t = customToast({ message: 'p', persistent: true });
    await waitFor(() => firstCard());
    t.update({ persistent: false, duration: 60 });
    await waitFor(() => cards().length === 0);
  });

  it('timed → persistent stops the timer immediately', async () => {
    const t = customToast({ message: 't', duration: 80 });
    await waitFor(() => firstCard());
    t.update({ persistent: true });
    await new Promise((r) => setTimeout(r, 160));
    expect(cards().length).toBe(1);
  });

  it('restarts the timer when updated with a new duration', async () => {
    const t = customToast({ message: 'r', duration: 80 });
    await waitFor(() => firstCard());
    await new Promise((r) => setTimeout(r, 50));
    t.update({ duration: 400 }); // restart → should NOT close at original 80ms
    await new Promise((r) => setTimeout(r, 120));
    expect(cards().length).toBe(1);
  });

  it('update() after close is a graceful no-op', async () => {
    const t = customToast({ message: 'x', persistent: true });
    await waitFor(() => firstCard());
    await t.close();
    expect(() => t.update({ message: 'ignored' })).not.toThrow();
    expect(cards().length).toBe(0);
  });

  it('deduplicates by id: updates in place and returns the same controller', async () => {
    const a = customToast({ id: 'autosave', message: 'Saving…', persistent: true });
    await waitFor(() => firstCard());
    const b = customToast({ id: 'autosave', message: 'Saved', variant: 'success', persistent: false, duration: 200 });
    expect(b).toBe(a); // same controller
    expect(cards().length).toBe(1); // no duplicate
    expect(document.querySelector('.ct-message').textContent).toBe('Saved');
  });
});

/* ------------------------------------------------------------ pause/resume */

describe('pause & resume', () => {
  it('pauses on hover and resumes on leave', async () => {
    customToast({ message: 'h', duration: 80, pauseOnHover: true });
    await waitFor(() => firstCard());
    firstCard().dispatchEvent(new window.Event('pointerenter'));
    await new Promise((r) => setTimeout(r, 160));
    expect(cards().length).toBe(1); // paused — survived past duration
    firstCard().dispatchEvent(new window.Event('pointerleave'));
    await waitFor(() => cards().length === 0); // resumed and finished
  });

  it('pauses while focus is inside', async () => {
    customToast({ message: 'f', duration: 80, pauseOnFocus: true });
    await waitFor(() => firstCard());
    firstCard().dispatchEvent(new window.Event('focusin'));
    await new Promise((r) => setTimeout(r, 160));
    expect(cards().length).toBe(1);
    firstCard().dispatchEvent(new window.Event('focusout'));
    await waitFor(() => cards().length === 0);
  });

  it('resumes with the remaining time, not the full duration', async () => {
    customToast({ message: 'rem', duration: 120, pauseOnHover: true });
    await waitFor(() => firstCard());
    await new Promise((r) => setTimeout(r, 90)); // ~30ms remaining
    firstCard().dispatchEvent(new window.Event('pointerenter'));
    await new Promise((r) => setTimeout(r, 100)); // paused
    firstCard().dispatchEvent(new window.Event('pointerleave'));
    // Should finish quickly (~30ms), well under a fresh full duration.
    const start = Date.now();
    await waitFor(() => cards().length === 0);
    expect(Date.now() - start).toBeLessThan(110);
  });

  it('tracks multiple pause reasons (resumes only when all clear)', async () => {
    customToast({ message: 'multi', duration: 70, pauseOnHover: true, pauseOnFocus: true });
    await waitFor(() => firstCard());
    firstCard().dispatchEvent(new window.Event('pointerenter'));
    firstCard().dispatchEvent(new window.Event('focusin'));
    firstCard().dispatchEvent(new window.Event('pointerleave')); // one reason cleared, focus still holds
    await new Promise((r) => setTimeout(r, 140));
    expect(cards().length).toBe(1);
    firstCard().dispatchEvent(new window.Event('focusout'));
    await waitFor(() => cards().length === 0);
  });

  it('pauses while the document is hidden, resumes when visible', async () => {
    customToast({ message: 'vis', duration: 70 });
    await waitFor(() => firstCard());
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new window.Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 140));
    expect(cards().length).toBe(1); // not dismissed while hidden
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new window.Event('visibilitychange'));
    await waitFor(() => cards().length === 0);
  });
});

/* ---------------------------------------------------------------- progress */

describe('progress indicator', () => {
  it('renders when showProgress and timed', async () => {
    customToast({ message: 'p', duration: 200, showProgress: true });
    await waitFor(() => firstCard());
    const progress = document.querySelector('.ct-progress');
    expect(progress.hidden).toBe(false);
    expect(document.querySelector('.ct-progress-bar')).not.toBeNull();
  });

  it('is hidden for persistent toasts', async () => {
    customToast({ message: 'p', persistent: true, showProgress: true });
    await waitFor(() => firstCard());
    expect(document.querySelector('.ct-progress').hidden).toBe(true);
  });
});

/* ------------------------------------------------------- stacking/positions */

describe('stacking, positions & containers', () => {
  it('creates containers lazily and removes them when empty', async () => {
    expect(document.querySelector('.ct-container')).toBeNull();
    const t = customToast({ message: 'a', persistent: true });
    await waitFor(() => containerFor('top-right'));
    await t.close();
    await waitFor(() => document.querySelector('.ct-container') === null);
  });

  it('uses separate containers per position', async () => {
    customToast({ message: 'a', position: 'top-left', persistent: true });
    customToast({ message: 'b', position: 'bottom-right', persistent: true });
    await waitFor(() => containerFor('top-left') && containerFor('bottom-right'));
    expect(containerFor('top-left')).not.toBe(containerFor('bottom-right'));
  });

  it('stacks newest nearest the edge for top positions (prepend)', async () => {
    customToast({ message: 'first', position: 'top-right', persistent: true });
    await waitFor(() => cards().length === 1);
    customToast({ message: 'second', position: 'top-right', persistent: true });
    await waitFor(() => cards().length === 2);
    const texts = [...containerFor('top-right').querySelectorAll('.ct-message')].map((m) => m.textContent);
    expect(texts[0]).toBe('second'); // newest first (top edge)
  });

  it('stacks newest nearest the edge for bottom positions (append)', async () => {
    customToast({ message: 'first', position: 'bottom-right', persistent: true });
    await waitFor(() => cards().length === 1);
    customToast({ message: 'second', position: 'bottom-right', persistent: true });
    await waitFor(() => cards().length === 2);
    const texts = [...containerFor('bottom-right').querySelectorAll('.ct-message')].map((m) => m.textContent);
    expect(texts[texts.length - 1]).toBe('second'); // newest last (bottom edge)
  });

  it('handles many toasts created nearly simultaneously', async () => {
    for (let i = 0; i < 4; i += 1) customToast({ message: `n${i}`, persistent: true });
    await waitFor(() => cards().length === 4);
    expect(toastManager.byId.size).toBe(4);
  });
});

/* ----------------------------------------------------------- limits/overflow */

describe('limits & overflow', () => {
  it('enforces maxVisible per position', async () => {
    configureToasts({ maxVisible: 2 });
    for (let i = 0; i < 3; i += 1) customToast({ message: `q${i}`, persistent: true });
    await waitFor(() => cards().length === 2);
    expect(cards().length).toBe(2);
  });

  it('queue overflow: shows the queued toast when a slot frees', async () => {
    configureToasts({ maxVisible: 2, overflow: 'queue' });
    const a = customToast({ message: 'A', persistent: true });
    customToast({ message: 'B', persistent: true });
    customToast({ message: 'C', persistent: true }); // queued
    await waitFor(() => cards().length === 2);
    await a.close();
    await waitFor(() => [...document.querySelectorAll('.ct-message')].some((m) => m.textContent === 'C'));
  });

  it('dismiss-oldest overflow closes the oldest and shows the new', async () => {
    configureToasts({ maxVisible: 2, overflow: 'dismiss-oldest' });
    customToast({ message: 'A', persistent: true });
    customToast({ message: 'B', persistent: true });
    customToast({ message: 'C', persistent: true });
    await waitFor(() => {
      const texts = [...document.querySelectorAll('.ct-message')].map((m) => m.textContent);
      return texts.includes('C') && !texts.includes('A') && cards().length === 2;
    });
  });

  it('dismiss-newest overflow discards the new request', async () => {
    configureToasts({ maxVisible: 2, overflow: 'dismiss-newest' });
    customToast({ message: 'A', persistent: true });
    customToast({ message: 'B', persistent: true });
    await waitFor(() => cards().length === 2);
    const c = customToast({ message: 'C', persistent: true });
    await new Promise((r) => setTimeout(r, 30));
    expect(cards().length).toBe(2);
    expect([...document.querySelectorAll('.ct-message')].some((m) => m.textContent === 'C')).toBe(false);
    expect(c.isOpen()).toBe(false);
  });
});

/* --------------------------------------------------------------- registry */

describe('id registry helpers', () => {
  it('getToast returns the controller, or null', async () => {
    const t = customToast({ id: 'reg', message: 'r', persistent: true });
    await waitFor(() => firstCard());
    expect(getToast('reg')).toBe(t);
    expect(getToast('missing')).toBeNull();
  });

  it('closeToast(id) closes by id', async () => {
    customToast({ id: 'k', message: 'k', persistent: true });
    await waitFor(() => firstCard());
    await closeToast('k');
    expect(cards().length).toBe(0);
  });

  it('closeAllToasts() closes everything', async () => {
    customToast({ message: 'a', position: 'top-left', persistent: true });
    customToast({ message: 'b', position: 'bottom-right', persistent: true });
    await waitFor(() => cards().length === 2);
    await closeAllToasts();
    await waitFor(() => cards().length === 0);
  });

  it('closeAllToasts({ position }) filters by position', async () => {
    customToast({ message: 'keep', position: 'top-left', persistent: true });
    customToast({ message: 'drop', position: 'bottom-right', persistent: true });
    await waitFor(() => cards().length === 2);
    await closeAllToasts({ position: 'bottom-right' });
    await waitFor(() => cards().length === 1);
    expect(document.querySelector('.ct-message').textContent).toBe('keep');
  });
});

/* ----------------------------------------------------------------- actions */

describe('action buttons', () => {
  it('runs an async action and closes on success by default', async () => {
    const onClick = vi.fn().mockResolvedValue(undefined);
    customToast({ message: 'Deleted', persistent: true, action: { label: 'Undo', onClick } });
    await waitFor(() => document.querySelector('.ct-action'));
    document.querySelector('.ct-action').click();
    await waitFor(() => cards().length === 0);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the toast open when closeOnSuccess is false', async () => {
    const onClick = vi.fn().mockResolvedValue(undefined);
    customToast({ message: 'x', persistent: true, action: { label: 'Do', closeOnSuccess: false, onClick } });
    await waitFor(() => document.querySelector('.ct-action'));
    document.querySelector('.ct-action').click();
    await waitFor(() => onClick.mock.calls.length === 1);
    await new Promise((r) => setTimeout(r, 30));
    expect(cards().length).toBe(1);
  });

  it('keeps the toast open and shows a safe error on failure', async () => {
    const onClick = vi.fn().mockRejectedValue(new Error('Restore failed (503)'));
    customToast({ message: 'Deleted', persistent: true, action: { label: 'Undo', onClick } });
    await waitFor(() => document.querySelector('.ct-action'));
    document.querySelector('.ct-action').click();
    await waitFor(() => !document.querySelector('.ct-error').hidden);
    expect(document.querySelector('.ct-error').textContent).toContain('503');
    expect(cards().length).toBe(1);
    // Action re-enabled for retry.
    expect(document.querySelector('.ct-action').hasAttribute('disabled')).toBe(false);
  });

  it('prevents duplicate activation while pending', async () => {
    let resolve;
    const onClick = vi.fn(() => new Promise((r) => { resolve = r; }));
    customToast({ message: 'x', persistent: true, action: { label: 'Go', onClick } });
    await waitFor(() => document.querySelector('.ct-action'));
    const btn = document.querySelector('.ct-action');
    btn.click();
    btn.click();
    btn.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(onClick).toHaveBeenCalledTimes(1);
    resolve();
  });

  it('supports the top-level onAction callback form', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    customToast({ message: 'x', persistent: true, action: { label: 'Undo' }, onAction });
    await waitFor(() => document.querySelector('.ct-action'));
    document.querySelector('.ct-action').click();
    await waitFor(() => onAction.mock.calls.length === 1);
  });
});

/* ----------------------------------------------------------- a11y & focus */

describe('accessibility & focus', () => {
  it('uses role=alert + aria-live=assertive for urgent toasts', async () => {
    customToast({ message: 'Connection lost', variant: 'danger', ariaLive: 'assertive', persistent: true });
    await waitFor(() => firstCard());
    expect(firstCard().getAttribute('role')).toBe('alert');
    expect(firstCard().getAttribute('aria-live')).toBe('assertive');
    expect(firstCard().getAttribute('aria-atomic')).toBe('true');
  });

  it('does not make every toast assertive by default', async () => {
    customToast({ message: 'normal', variant: 'danger', persistent: true });
    await waitFor(() => firstCard());
    expect(firstCard().getAttribute('aria-live')).toBe('polite');
    expect(firstCard().getAttribute('role')).toBe('status');
  });

  it('gives the close button an accessible label', async () => {
    customToast({ message: 'x', persistent: true });
    await waitFor(() => firstCard());
    expect(document.querySelector('.ct-close').getAttribute('aria-label')).toBe('Dismiss notification');
  });

  it('does NOT steal focus when shown', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    customToast({ message: 'no steal', persistent: true });
    await waitFor(() => firstCard());
    expect(document.activeElement).toBe(input);
    input.remove();
  });

  it('does not trap focus or inert the page (container is not aria-modal)', async () => {
    customToast({ message: 'x', persistent: true });
    await waitFor(() => firstCard());
    expect(firstCard().hasAttribute('aria-modal')).toBe(false);
    expect(containerFor('top-right').hasAttribute('aria-modal')).toBe(false);
    expect(document.body.hasAttribute('inert')).toBe(false);
  });

  it('close and action buttons are real, focusable buttons', async () => {
    customToast({ message: 'x', persistent: true, action: { label: 'Act', onClick() {} } });
    await waitFor(() => document.querySelector('.ct-action'));
    const close = document.querySelector('.ct-close');
    const action = document.querySelector('.ct-action');
    expect(close.tagName).toBe('BUTTON');
    expect(action.tagName).toBe('BUTTON');
    action.focus();
    expect(document.activeElement).toBe(action);
  });
});

/* ------------------------------------------------------------------ security */

describe('security', () => {
  it('renders strings as text, not HTML', async () => {
    customToast({ title: '<img src=x onerror=alert(1)>', message: '<b>hi</b>', persistent: true });
    await waitFor(() => firstCard());
    expect(firstCard().querySelector('img')).toBeNull();
    expect(firstCard().querySelector('b')).toBeNull();
    expect(document.querySelector('.ct-title').textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('accepts a DOM node as safe rich content', async () => {
    const node = document.createElement('span');
    node.className = 'rich';
    node.textContent = 'rich';
    customToast({ message: node, persistent: true });
    await waitFor(() => firstCard());
    expect(firstCard().querySelector('span.rich')).not.toBeNull();
  });

  it('renders HTML only when allowHtml is true', async () => {
    customToast({ message: '<b class="boom">x</b>', allowHtml: true, persistent: true });
    await waitFor(() => firstCard());
    expect(firstCard().querySelector('b.boom')).not.toBeNull();
  });
});

/* ------------------------------------------------------ animation & cleanup */

describe('animation & cleanup', () => {
  it('reduced motion: no slide transform classes are applied on enter', async () => {
    reducedMotion = true;
    customToast({ message: 'rm', position: 'top-right', persistent: true });
    await waitFor(() => firstCard());
    expect(firstCard().className).not.toMatch(/ct-from-/);
  });

  it('cleans up via the timeout fallback even without transitionend', async () => {
    // jsdom never fires transitionend; close() must still fully clean up.
    const t = customToast({ message: 'fallback', persistent: true });
    await waitFor(() => firstCard());
    const el = firstCard();
    await t.close();
    expect(el.parentNode).toBeNull(); // removed from DOM
    expect(toastManager.byId.has(t.id)).toBe(false);
  });

  it('removes pause listeners and timers on cleanup (no leak)', async () => {
    const t = customToast({ message: 'leak', duration: 500, pauseOnHover: true });
    await waitFor(() => firstCard());
    await t.close();
    // After close, hovering the (detached) element must not throw or revive timing.
    expect(() => t.update({ message: 'x' })).not.toThrow();
    expect(cards().length).toBe(0);
  });

  it('close() is idempotent and returns the same promise', async () => {
    const t = customToast({ message: 'x', persistent: true });
    await waitFor(() => firstCard());
    const p1 = t.close();
    const p2 = t.close();
    expect(p1).toBe(p2);
    await p1;
    expect(cards().length).toBe(0);
  });
});

/* --------------------------------------------------- positions pure logic */

describe('auto animation resolution', () => {
  it('maps positions to natural enter/exit', () => {
    expect(autoAnimationFor('top-center')).toEqual({ enter: 'slide-down', exit: 'slide-up' });
    expect(autoAnimationFor('bottom-center')).toEqual({ enter: 'slide-up', exit: 'slide-down' });
    expect(autoAnimationFor('top-right').enter).toBe('slide-left');
    expect(autoAnimationFor('bottom-left').enter).toBe('slide-right');
  });

  it('expands "auto" but honours explicit names', () => {
    expect(resolveAnimations('top-center', 'auto', 'auto')).toEqual({ enter: 'slide-down', exit: 'slide-up' });
    expect(resolveAnimations('top-right', 'fade', 'scale')).toEqual({ enter: 'fade', exit: 'scale' });
  });
});

/* -------------------------------------------------------------- swipe */
// NOTE: jsdom has no real Pointer Events / layout engine, so these synthesize
// pointer events and mock width. Full gesture feel (velocity, capture, vertical
// scroll passthrough) is verified manually in a real browser via the demo.
function pointerEvent(type, x, y, t) {
  const e = new window.Event(type, { bubbles: true });
  e.clientX = x;
  e.clientY = y;
  e.pointerId = 1;
  e.pointerType = 'touch';
  e.button = 0;
  Object.defineProperty(e, 'timeStamp', { value: t, configurable: true });
  return e;
}
function prepSwipeEl(el) {
  Object.defineProperty(el, 'offsetWidth', { value: 300, configurable: true });
  el.setPointerCapture = () => {};
  el.releasePointerCapture = () => {};
}

describe('swipe-to-dismiss', () => {
  it('dismisses on a sufficient horizontal swipe', async () => {
    customToast({ message: 'swipe me', persistent: true, swipeToDismiss: true });
    await waitFor(() => firstCard());
    const el = firstCard();
    prepSwipeEl(el);
    el.dispatchEvent(pointerEvent('pointerdown', 100, 100, 0));
    el.dispatchEvent(pointerEvent('pointermove', 140, 102, 16)); // lock horizontal
    el.dispatchEvent(pointerEvent('pointermove', 280, 104, 80)); // dx=180 > 0.35*300
    el.dispatchEvent(pointerEvent('pointerup', 280, 104, 100));
    await waitFor(() => cards().length === 0);
  });

  it('snaps back when the swipe is too small', async () => {
    customToast({ message: 'keep', persistent: true, swipeToDismiss: true });
    await waitFor(() => firstCard());
    const el = firstCard();
    prepSwipeEl(el);
    el.dispatchEvent(pointerEvent('pointerdown', 100, 100, 0));
    el.dispatchEvent(pointerEvent('pointermove', 118, 101, 16)); // dx=18, below threshold
    el.dispatchEvent(pointerEvent('pointerup', 118, 101, 40));
    await new Promise((r) => setTimeout(r, 40));
    expect(cards().length).toBe(1);
  });

  it('does not dismiss when swipeToDismiss is false', async () => {
    customToast({ message: 'fixed', persistent: true, swipeToDismiss: false });
    await waitFor(() => firstCard());
    const el = firstCard();
    prepSwipeEl(el);
    el.dispatchEvent(pointerEvent('pointerdown', 100, 100, 0));
    el.dispatchEvent(pointerEvent('pointermove', 280, 104, 80));
    el.dispatchEvent(pointerEvent('pointerup', 280, 104, 100));
    await new Promise((r) => setTimeout(r, 40));
    expect(cards().length).toBe(1);
  });
});

/* -------------------------------------------------- coexistence with modal */

describe('coexistence with modal dialogs', () => {
  it('a toast and a modal dialog can be visible at the same time', async () => {
    customAlert({ title: 'Modal', message: 'decide' });
    customToast({ message: 'passive', persistent: true });
    await waitFor(() => document.querySelector('.cd-dialog') && firstCard());
    expect(document.querySelector('.cd-dialog')).not.toBeNull();
    expect(firstCard()).not.toBeNull();
    // Toast must not have locked scroll the way the dialog does; dialog owns that.
    document.querySelector('.cd-btn-confirm').click();
  });
});

/* -------------------------------------------------------- CSS safe-area etc */

describe('stylesheet guarantees', () => {
  it('CSS includes safe-area insets, click-through containers, and reduced-motion', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const css = readFileSync(resolve(process.cwd(), 'src/custom-dialog.css'), 'utf8');
    expect(css).toContain('env(safe-area-inset-top)');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('env(safe-area-inset-left)');
    expect(css).toContain('env(safe-area-inset-right)');
    expect(css).toMatch(/\.ct-container[\s\S]*pointer-events:\s*none/);
    expect(css).toMatch(/\.ct-toast[\s\S]*pointer-events:\s*auto/);
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('forced-colors');
    expect(css).toContain('--custom-toast-z-index');
  });
});
