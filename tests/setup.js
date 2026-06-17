/**
 * Test setup: provide a deterministic requestAnimationFrame so focus and
 * focus-restoration timing (which the library schedules via rAF) is flushable
 * inside tests, and expose a `flush()` helper on globalThis.
 */

// Force a deterministic, immediately-flushable rAF. jsdom's native rAF fires on
// a ~16ms timer, which the `flush()` helper (setTimeout 0) would race; overriding
// it makes scheduled focus/restoration work reliably observable in tests.
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
if (typeof window !== 'undefined') {
  window.requestAnimationFrame = globalThis.requestAnimationFrame;
  window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
}

/**
 * Flush pending microtasks + the rAF/timeout queue. Call after an action that
 * schedules focus work, e.g. `await flush()`.
 * @param {number} [times=2]
 */
globalThis.flush = async function flush(times = 2) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
};
