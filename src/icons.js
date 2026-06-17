/**
 * @file Shared, built-in icon builders (DOM only — no innerHTML). Used by both
 * the modal dialogs and the toast notifications so the two systems stay
 * visually consistent. Icons are our own trusted markup, never caller content.
 */

import { svgEl } from './utils.js';

/** @typedef {'info' | 'success' | 'warning' | 'danger' | 'neutral'} IconVariant */

const STROKE_COMMON = {
  viewBox: '0 0 24 24',
  width: 24,
  height: 24,
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

/**
 * Build a built-in variant icon.
 * @param {IconVariant} variant
 * @returns {SVGElement}
 */
export function buildVariantIcon(variant) {
  /** @type {Record<IconVariant, SVGElement[]>} */
  const glyphs = {
    info: [
      svgEl('circle', { cx: 12, cy: 12, r: 10 }),
      svgEl('line', { x1: 12, y1: 11, x2: 12, y2: 16 }),
      svgEl('line', { x1: 12, y1: 8, x2: 12.01, y2: 8 }),
    ],
    success: [
      svgEl('circle', { cx: 12, cy: 12, r: 10 }),
      svgEl('path', { d: 'M8 12.5l2.5 2.5 5-5' }),
    ],
    warning: [
      svgEl('path', {
        d: 'M10.29 3.86l-8.18 14A1.5 1.5 0 003.4 20h17.2a1.5 1.5 0 001.29-2.14l-8.18-14a1.5 1.5 0 00-2.62 0z',
      }),
      svgEl('line', { x1: 12, y1: 9, x2: 12, y2: 13 }),
      svgEl('line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }),
    ],
    danger: [
      svgEl('circle', { cx: 12, cy: 12, r: 10 }),
      svgEl('line', { x1: 15, y1: 9, x2: 9, y2: 15 }),
      svgEl('line', { x1: 9, y1: 9, x2: 15, y2: 15 }),
    ],
    neutral: [
      svgEl('path', { d: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9' }),
      svgEl('path', { d: 'M13.73 21a2 2 0 01-3.46 0' }),
    ],
  };
  return svgEl('svg', STROKE_COMMON, glyphs[variant] || glyphs.info);
}

/**
 * Small inline spinner shown during async work.
 * @param {string} [className='cd-spinner']
 * @returns {SVGElement}
 */
export function buildSpinner(className = 'cd-spinner') {
  return svgEl(
    'svg',
    {
      class: className,
      viewBox: '0 0 24 24',
      width: 18,
      height: 18,
      'aria-hidden': 'true',
      focusable: 'false',
    },
    [svgEl('circle', { cx: 12, cy: 12, r: 9, fill: 'none', 'stroke-width': 3 })],
  );
}

/**
 * The "×" close glyph.
 * @param {number} [size=20]
 * @returns {SVGElement}
 */
export function buildCloseIcon(size = 20) {
  return svgEl(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    [
      svgEl('line', { x1: 6, y1: 6, x2: 18, y2: 18 }),
      svgEl('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
    ],
  );
}
