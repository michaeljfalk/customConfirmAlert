/**
 * @file Horizontal swipe-to-dismiss using Pointer Events (one implementation for
 * mouse + touch + pen). Isolated so the rest of the toast stays robust if this
 * is disabled. CSS `touch-action: pan-y` on the card lets the browser keep
 * vertical scrolling while we own the horizontal axis.
 */

const DIRECTION_LOCK_THRESHOLD = 8; // px before we decide horizontal vs vertical
const DISMISS_DISTANCE_RATIO = 0.35; // fraction of card width to commit a dismiss
const DISMISS_VELOCITY = 0.5; // px/ms flick velocity that commits regardless of distance

/**
 * Attach swipe handling to a toast card.
 *
 * @param {HTMLElement} el - The toast card.
 * @param {object} handlers
 * @param {() => void} handlers.onGestureStart - Called when a drag begins (pause timer).
 * @param {() => void} handlers.onGestureEnd - Called when a drag ends without dismiss (resume timer).
 * @param {(direction: 1 | -1) => void} handlers.onDismiss - Commit a dismiss in the given direction.
 * @param {boolean} [handlers.reducedMotion=false]
 * @returns {() => void} Cleanup function that removes all listeners.
 */
export function attachSwipe(el, { onGestureStart, onGestureEnd, onDismiss, reducedMotion = false }) {
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let locked = false; // committed to horizontal dragging
  let decided = false; // direction decision made (horizontal or vertical-abort)
  let active = false;

  function onPointerDown(e) {
    if (active) return;
    // Never start a swipe from an interactive control (button/link/input).
    if (e.target instanceof Element && e.target.closest('button, a, input, textarea, select, [tabindex]')) {
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;

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
        // Vertical intent → let the page scroll; abandon the gesture.
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
          /* capture is best-effort */
        }
        el.classList.add('ct-swiping');
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

    el.classList.remove('ct-swiping');
    try {
      if (pointerId !== null) el.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }

    if (locked && (farEnough || fastEnough)) {
      onDismiss(dx >= 0 ? 1 : -1);
      reset();
      return;
    }

    // Snap back to resting position.
    if (!reducedMotion) el.classList.add('ct-snap-back');
    el.style.transform = '';
    el.style.opacity = '';
    if (locked) onGestureEnd();
    window.setTimeout(() => el.classList.remove('ct-snap-back'), 200);
    reset();
  }

  function reset() {
    active = false;
    locked = false;
    decided = false;
    pointerId = null;
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);

  return function cleanup() {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', finish);
    el.removeEventListener('pointercancel', finish);
  };
}
