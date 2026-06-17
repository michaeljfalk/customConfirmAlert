/**
 * @file Focus management: trapping, restoration, and background inert handling.
 */

import { FOCUSABLE_SELECTOR } from './utils.js';

/**
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFocusable(container) {
  const nodes = /** @type {HTMLElement[]} */ (
    Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
  );
  return nodes.filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.hidden) return false;
    // getComputedStyle works in both real browsers and headless DOMs (jsdom),
    // unlike offsetParent/getClientRects which require a layout engine.
    const style = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return true;
  });
}

const SUPPORTS_INERT =
  typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype;

/**
 * Traps focus inside a container, makes the rest of the page inert, and restores
 * focus to the triggering element on release. One instance per open dialog.
 */
export class FocusTrap {
  /** @param {HTMLElement} container */
  constructor(container) {
    /** @type {HTMLElement} */
    this.container = container;
    /** @type {Element | null} */
    this.previouslyFocused = null;
    /** @type {{ el: Element, inert: boolean, ariaHidden: string | null }[]} */
    this.mutated = [];
    /** @type {(e: KeyboardEvent) => void} */
    this.onKeydown = this.handleKeydown.bind(this);
  }

  /**
   * Activate the trap.
   * @param {HTMLElement | null} [initialFocus] - Element to focus first.
   */
  activate(initialFocus) {
    this.previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    this.deactivateBackground();
    document.addEventListener('keydown', this.onKeydown, true);

    const target = initialFocus || getFocusable(this.container)[0] || this.container;
    // Defer to ensure the element is painted/visible before focusing.
    requestAnimationFrame(() => {
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    });
  }

  /** Make every sibling of the dialog root inert / hidden from AT. */
  deactivateBackground() {
    const root = this.container.closest('[data-cd-root]') || this.container;
    const siblings = Array.from(document.body.children);
    for (const el of siblings) {
      if (el === root) continue;
      this.mutated.push({
        el,
        inert: SUPPORTS_INERT ? /** @type {any} */ (el).inert === true : false,
        ariaHidden: el.getAttribute('aria-hidden'),
      });
      if (SUPPORTS_INERT) {
        /** @type {any} */ (el).inert = true;
      }
      el.setAttribute('aria-hidden', 'true');
    }
  }

  /** Restore inert/aria-hidden on the background. */
  reactivateBackground() {
    for (const record of this.mutated) {
      if (SUPPORTS_INERT) {
        /** @type {any} */ (record.el).inert = record.inert;
      }
      if (record.ariaHidden === null) {
        record.el.removeAttribute('aria-hidden');
      } else {
        record.el.setAttribute('aria-hidden', record.ariaHidden);
      }
    }
    this.mutated = [];
  }

  /** @param {KeyboardEvent} e */
  handleKeydown(e) {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable(this.container);
    if (focusable.length === 0) {
      e.preventDefault();
      this.container.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    // If focus escaped the dialog entirely, pull it back.
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
    document.removeEventListener('keydown', this.onKeydown, true);
    this.reactivateBackground();
    const target = this.previouslyFocused;
    if (target && typeof (/** @type {any} */ (target).focus) === 'function') {
      // Restore after the dialog is gone so focus lands cleanly.
      requestAnimationFrame(() => {
        if (document.contains(target)) {
          /** @type {HTMLElement} */ (target).focus({ preventScroll: true });
        }
      });
    }
    this.previouslyFocused = null;
  }
}
