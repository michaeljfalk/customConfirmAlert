/**
 * @file Small, dependency-free helpers shared across the dialog modules.
 * Nothing here touches the network, globals, or framework internals.
 */

/** Selector matching elements that can receive keyboard focus. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

let idCounter = 0;

/**
 * Generate a process-unique id. Deterministic counter (no Math.random) so it is
 * safe in SSR/replay environments.
 * @param {string} [prefix='cd'] - Prefix for readability in the DOM.
 * @returns {string}
 */
export function generateId(prefix = 'cd') {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** No-op used as a safe default callback. */
export function noop() {}

/**
 * @param {unknown} value
 * @returns {value is Promise<unknown>}
 */
export function isPromise(value) {
  return (
    !!value &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (/** @type {any} */ (value).then) === 'function'
  );
}

/**
 * @param {unknown} value
 * @returns {value is Node}
 */
export function isNode(value) {
  return !!value && typeof (/** @type {any} */ (value).nodeType) === 'number';
}

/**
 * Safely place caller-supplied content into an element.
 *
 * Default behaviour is to use {@link Node.textContent} (no HTML parsing). A DOM
 * Node / DocumentFragment is always appended as-is (the safe rich-content path).
 * Raw HTML strings are only parsed when `allowHtml` is explicitly true, in which
 * case the *caller* is responsible for sanitisation.
 *
 * @param {HTMLElement} el - Target element (cleared first).
 * @param {string | Node | null | undefined} content
 * @param {boolean} [allowHtml=false]
 * @returns {boolean} True when any content was written.
 */
export function setContent(el, content, allowHtml = false) {
  el.textContent = '';
  if (content == null || content === '') return false;

  if (isNode(content)) {
    el.appendChild(content);
    return true;
  }

  const text = String(content);
  if (allowHtml) {
    // Trusted by contract: the caller opted into allowHtml and owns sanitising.
    el.innerHTML = text;
  } else {
    el.textContent = text;
  }
  return true;
}

/**
 * Resolve when document.body exists. Handles being imported before the DOM is
 * ready (e.g. a module in <head> without defer).
 * @returns {Promise<void>}
 */
export function whenBodyReady() {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('customConfirmAlert requires a DOM environment.'));
  }
  if (document.body) return Promise.resolve();
  return new Promise((resolve) => {
    const onReady = () => {
      document.removeEventListener('DOMContentLoaded', onReady);
      resolve();
    };
    document.addEventListener('DOMContentLoaded', onReady);
  });
}

/**
 * Reference-counted scroll lock. Uses `position: fixed` so the technique also
 * holds on iOS Safari, and restores the exact scroll offset on release.
 */
export const scrollLock = (() => {
  let count = 0;
  let scrollY = 0;
  /** @type {Partial<CSSStyleDeclaration>} */
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
        overflow: body.style.overflow,
      };
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    },
    unlock() {
      if (count === 0) return;
      count -= 1;
      if (count > 0) return;
      const { body } = document;
      body.style.position = previous.position || '';
      body.style.top = previous.top || '';
      body.style.left = previous.left || '';
      body.style.right = previous.right || '';
      body.style.width = previous.width || '';
      body.style.overflow = previous.overflow || '';
      window.scrollTo(0, scrollY);
    },
    /** @returns {boolean} */
    get active() {
      return count > 0;
    },
  };
})();

/**
 * Create a namespaced SVG element from a small trusted spec. Used only for our
 * own built-in icons — never for caller content — so no HTML parsing occurs.
 * @param {string} tag
 * @param {Record<string, string|number>} attrs
 * @param {Element[]} [children]
 * @returns {SVGElement}
 */
export function svgEl(tag, attrs = {}, children = []) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  for (const child of children) el.appendChild(child);
  return el;
}
