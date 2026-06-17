/**
 * @file Toast position constants and the `auto` animation resolver. Pure data /
 * pure functions — no DOM, no state.
 */

/** @typedef {'top-left'|'top-center'|'top-right'|'bottom-left'|'bottom-center'|'bottom-right'} ToastPosition */
/** @typedef {'auto'|'slide-down'|'slide-up'|'slide-left'|'slide-right'|'fade'|'scale'|'none'} ToastAnimation */

/** All supported positions, in a stable order. */
export const POSITIONS = /** @type {ToastPosition[]} */ ([
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]);

export const POSITION_SET = new Set(POSITIONS);

export const ANIMATIONS = new Set([
  'auto',
  'slide-down',
  'slide-up',
  'slide-left',
  'slide-right',
  'fade',
  'scale',
  'none',
]);

/** @param {ToastPosition} position @returns {boolean} */
export function isTopPosition(position) {
  return position.startsWith('top');
}

/**
 * Resolve the natural enter/exit animation for `auto` from the position.
 * - top-center slides down in / up out; bottom-center slides up in / down out.
 * - left positions slide in from the left; right positions from the right.
 * @param {ToastPosition} position
 * @returns {{ enter: ToastAnimation, exit: ToastAnimation }}
 */
export function autoAnimationFor(position) {
  switch (position) {
    case 'top-center':
      return { enter: 'slide-down', exit: 'slide-up' };
    case 'bottom-center':
      return { enter: 'slide-up', exit: 'slide-down' };
    case 'top-left':
    case 'bottom-left':
      return { enter: 'slide-right', exit: 'slide-left' };
    case 'top-right':
    case 'bottom-right':
    default:
      return { enter: 'slide-left', exit: 'slide-right' };
  }
}

/**
 * Resolve a concrete enter/exit animation pair, expanding `auto`.
 * @param {ToastPosition} position
 * @param {ToastAnimation} enter
 * @param {ToastAnimation} exit
 * @returns {{ enter: ToastAnimation, exit: ToastAnimation }}
 */
export function resolveAnimations(position, enter, exit) {
  const auto = autoAnimationFor(position);
  return {
    enter: !enter || enter === 'auto' ? auto.enter : enter,
    exit: !exit || exit === 'auto' ? auto.exit : exit,
  };
}
