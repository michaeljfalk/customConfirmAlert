import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { customChoice, customConfirm, CustomDialog } from '../src/index.js';
import { getDialog, getRoot, q, clickClose, clickBackdrop, pressKey } from './helpers.js';

/** Save / Don't Save / Cancel — the canonical 3-button case. */
const SAVE_BUTTONS = [
  { value: 'save', text: 'Save', variant: 'primary' },
  { value: 'discard', text: "Don't Save", variant: 'danger' },
  { value: 'cancel', text: 'Cancel', variant: 'neutral', role: 'cancel' },
];

/** Click a choice button by its `value`. */
function clickValue(value) {
  /** @type {HTMLButtonElement|null} */ (q(`[data-cd-value="${value}"]`))?.click();
}

beforeEach(async () => {
  document.body.innerHTML = '';
  document.body.style.cssText = '';
  await flush(2);
});

afterEach(async () => {
  // Drain anything still open so it can't leak into the next test.
  for (let i = 0; i < 12 && getDialog(); i += 1) {
    pressKey('Escape');
    clickClose();
    clickValue('cancel');
    await flush();
  }
  await flush(3);
});

describe('customChoice: resolution', () => {
  it('resolves each button with its own value', async () => {
    for (const value of ['save', 'discard', 'cancel']) {
      const p = customChoice({ title: 'Unsaved changes', buttons: SAVE_BUTTONS });
      await flush();
      clickValue(value);
      // eslint-disable-next-line no-await-in-loop
      await expect(p).resolves.toBe(value);
      await flush();
    }
  });

  it('renders buttons in array order', async () => {
    const p = customChoice({ title: 'X', buttons: SAVE_BUTTONS });
    await flush();
    const labels = Array.from(getDialog().querySelectorAll('.cd-footer .cd-btn')).map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(['Save', "Don't Save", 'Cancel']);
    clickValue('cancel');
    await p;
  });

  it('maps variants to the matching button classes', async () => {
    const p = customChoice({ title: 'X', buttons: SAVE_BUTTONS });
    await flush();
    expect(q('[data-cd-value="save"]').className).toContain('cd-btn-primary');
    expect(q('[data-cd-value="discard"]').className).toContain('cd-btn-danger');
    expect(q('[data-cd-value="cancel"]').className).toContain('cd-btn-neutral');
    clickValue('cancel');
    await p;
  });

  it('defaults an unspecified variant to neutral', async () => {
    const p = customChoice({ buttons: [{ value: 'ok', text: 'OK' }] });
    await flush();
    expect(q('[data-cd-value="ok"]').className).toContain('cd-btn-neutral');
    clickValue('ok');
    await p;
  });

  it('throws synchronously when buttons is empty', () => {
    expect(() => customChoice({ title: 'X', buttons: [] })).toThrow();
    expect(() => customChoice({ title: 'X' })).toThrow();
  });

  it('throws when more than one button has role cancel', () => {
    expect(() =>
      customChoice({
        buttons: [
          { value: 'a', text: 'A', role: 'cancel' },
          { value: 'b', text: 'B', role: 'cancel' },
        ],
      }),
    ).toThrow();
  });
});

describe('customChoice: dismissal', () => {
  it('Escape resolves the role:cancel value', async () => {
    const p = customChoice({ buttons: SAVE_BUTTONS });
    await flush();
    pressKey('Escape');
    await expect(p).resolves.toBe('cancel');
  });

  it('× (close) resolves the role:cancel value', async () => {
    const p = customChoice({ buttons: SAVE_BUTTONS, dismissible: true });
    await flush();
    clickClose();
    await expect(p).resolves.toBe('cancel');
  });

  it('backdrop click resolves the role:cancel value when enabled', async () => {
    const p = customChoice({ buttons: SAVE_BUTTONS, closeOnBackdrop: true });
    await flush();
    clickBackdrop();
    await expect(p).resolves.toBe('cancel');
  });

  it('Escape resolves null when no button has role cancel', async () => {
    const p = customChoice({
      buttons: [
        { value: 'yes', text: 'Yes', variant: 'primary' },
        { value: 'no', text: 'No' },
      ],
    });
    await flush();
    pressKey('Escape');
    await expect(p).resolves.toBeNull();
  });
});

describe('customChoice: suppressing dismissal', () => {
  it('closeOnEscape:false ignores Escape', async () => {
    const p = customChoice({ buttons: SAVE_BUTTONS, closeOnEscape: false });
    await flush();
    pressKey('Escape');
    await flush();
    expect(getDialog()).not.toBeNull();
    clickValue('save');
    await expect(p).resolves.toBe('save');
  });

  it('closeOnBackdrop:false ignores backdrop clicks (default)', async () => {
    const p = customChoice({ buttons: SAVE_BUTTONS });
    await flush();
    clickBackdrop();
    await flush();
    expect(getDialog()).not.toBeNull();
    clickValue('save');
    await expect(p).resolves.toBe('save');
  });

  it('dismissible:false hides the × button', async () => {
    const p = customChoice({ buttons: SAVE_BUTTONS, dismissible: false });
    await flush();
    expect(q('.cd-close')).toBeNull();
    clickValue('save');
    await expect(p).resolves.toBe('save');
  });
});

describe('customChoice: focus', () => {
  it('defaults focus to the role:cancel button', async () => {
    customChoice({ buttons: SAVE_BUTTONS });
    await flush();
    expect(document.activeElement).toBe(q('[data-cd-value="cancel"]'));
    clickValue('cancel');
  });

  it('defaults focus to the last button when none is role:cancel', async () => {
    customChoice({
      buttons: [
        { value: 'a', text: 'A' },
        { value: 'b', text: 'B' },
      ],
    });
    await flush();
    expect(document.activeElement).toBe(q('[data-cd-value="b"]'));
    clickValue('b');
  });

  it('defaultFocus targets the button with the matching value', async () => {
    customChoice({ buttons: SAVE_BUTTONS, defaultFocus: 'save' });
    await flush();
    expect(document.activeElement).toBe(q('[data-cd-value="save"]'));
    clickValue('save');
  });

  it('traps focus: Shift+Tab from the first button wraps to the last', async () => {
    customChoice({ buttons: SAVE_BUTTONS, dismissible: false });
    await flush();
    const buttons = Array.from(getDialog().querySelectorAll('.cd-footer .cd-btn'));
    buttons[0].focus();
    pressKeyDocument('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    clickValue('cancel');
  });

  it('traps focus: Tab from the last button wraps to the first', async () => {
    customChoice({ buttons: SAVE_BUTTONS, dismissible: false });
    await flush();
    const buttons = Array.from(getDialog().querySelectorAll('.cd-footer .cd-btn'));
    buttons[buttons.length - 1].focus();
    pressKeyDocument('Tab');
    expect(document.activeElement).toBe(buttons[0]);
    clickValue('cancel');
  });

  it('restores focus to the opener on close', async () => {
    const opener = document.createElement('button');
    opener.id = 'opener';
    document.body.appendChild(opener);
    opener.focus();

    const p = customChoice({ buttons: SAVE_BUTTONS });
    await flush();
    clickValue('save');
    await p;
    await flush();
    expect(document.activeElement).toBe(opener);
  });
});

describe('customChoice: queue & single-resolution', () => {
  it('shows one dialog at a time, interleaved with confirm', async () => {
    const results = [];
    const a = customChoice({ title: 'A', buttons: SAVE_BUTTONS }).then((r) => results.push(['A', r]));
    const b = customConfirm({ title: 'B' }).then((r) => results.push(['B', r]));

    await flush();
    expect(document.querySelectorAll('.cd-dialog').length).toBe(1);
    expect(q('.cd-title').textContent).toBe('A');
    clickValue('discard');
    await flush();

    expect(document.querySelectorAll('.cd-dialog').length).toBe(1);
    expect(q('.cd-title').textContent).toBe('B');
    q('.cd-btn-confirm').click();
    await Promise.all([a, b]);

    expect(results).toEqual([['A', 'discard'], ['B', true]]);
    expect(CustomDialog.queueSize).toBe(0);
  });

  it('resolves exactly once even with repeated clicks', async () => {
    let count = 0;
    const p = customChoice({ buttons: SAVE_BUTTONS }).then((r) => {
      count += 1;
      return r;
    });
    await flush();
    clickValue('save');
    clickValue('discard');
    clickValue('cancel');
    await expect(p).resolves.toBe('save');
    await flush();
    expect(count).toBe(1);
  });

  it('CustomDialog.choose is customChoice', () => {
    expect(CustomDialog.choose).toBe(customChoice);
  });

  it('fires onClose once with the resolved value', async () => {
    const seen = [];
    const p = customChoice({ buttons: SAVE_BUTTONS, onClose: (v) => seen.push(v) });
    await flush();
    clickValue('discard');
    await p;
    expect(seen).toEqual(['discard']);
  });
});

/** Dispatch a Tab keydown at document (capture) level, where the trap listens. */
function pressKeyDocument(key, init = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}
