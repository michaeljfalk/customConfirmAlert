import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { customAlert, customConfirm, customPrompt, CustomDialog } from '../src/index.js';
import {
  getDialog,
  getRoot,
  q,
  clickConfirm,
  clickCancel,
  clickClose,
  clickBackdrop,
  pressKey,
  typeInput,
} from './helpers.js';

beforeEach(async () => {
  document.body.innerHTML = '';
  // reset any scroll-lock leakage between tests
  document.body.style.cssText = '';
  await flush(2);
});

afterEach(async () => {
  // Fully drain the singleton queue and let any pending focus-restoration
  // rAFs settle, so no dialog or scheduled focus leaks into the next test.
  for (let i = 0; i < 12 && getDialog(); i += 1) {
    pressKey('Escape');
    clickCancel();
    clickConfirm();
    clickClose();
    await flush();
  }
  await flush(3);
});

describe('resolution semantics', () => {
  it('alert resolves to undefined when dismissed', async () => {
    const p = customAlert({ title: 'Hi', message: 'Done' });
    await flush();
    expect(getDialog()).not.toBeNull();
    clickConfirm();
    await expect(p).resolves.toBeUndefined();
  });

  it('confirm returns true when confirmed', async () => {
    const p = customConfirm({ title: 'Sure?' });
    await flush();
    clickConfirm();
    await expect(p).resolves.toBe(true);
  });

  it('confirm returns false when cancelled', async () => {
    const p = customConfirm({ title: 'Sure?' });
    await flush();
    clickCancel();
    await expect(p).resolves.toBe(false);
  });

  it('confirm returns false via close button', async () => {
    const p = customConfirm({ title: 'Sure?', dismissible: true });
    await flush();
    clickClose();
    await expect(p).resolves.toBe(false);
  });

  it('prompt returns entered text', async () => {
    const p = customPrompt({ title: 'Name?', defaultValue: '' });
    await flush();
    typeInput('Invoice 42');
    clickConfirm();
    await expect(p).resolves.toBe('Invoice 42');
  });

  it('prompt returns defaultValue when confirmed unchanged', async () => {
    const p = customPrompt({ title: 'Name?', defaultValue: 'preset' });
    await flush();
    clickConfirm();
    await expect(p).resolves.toBe('preset');
  });

  it('prompt cancellation returns null', async () => {
    const p = customPrompt({ title: 'Name?' });
    await flush();
    clickCancel();
    await expect(p).resolves.toBeNull();
  });
});

describe('escape & backdrop', () => {
  it('Escape cancels a confirm by default', async () => {
    const p = customConfirm({ title: 'X' });
    await flush();
    pressKey('Escape');
    await expect(p).resolves.toBe(false);
  });

  it('Escape returns null for a prompt', async () => {
    const p = customPrompt({ title: 'X' });
    await flush();
    pressKey('Escape');
    await expect(p).resolves.toBeNull();
  });

  it('Escape is ignored when closeOnEscape is false', async () => {
    const p = customConfirm({ title: 'X', closeOnEscape: false });
    await flush();
    pressKey('Escape');
    await flush();
    expect(getDialog()).not.toBeNull();
    clickConfirm();
    await expect(p).resolves.toBe(true);
  });

  it('backdrop click does NOT dismiss unless enabled', async () => {
    const p = customConfirm({ title: 'X' });
    await flush();
    clickBackdrop();
    await flush();
    expect(getDialog()).not.toBeNull();
    clickConfirm();
    await expect(p).resolves.toBe(true);
  });

  it('backdrop click dismisses when closeOnBackdrop is true', async () => {
    const p = customConfirm({ title: 'X', closeOnBackdrop: true });
    await flush();
    clickBackdrop();
    await expect(p).resolves.toBe(false);
  });
});

describe('enter key', () => {
  it('Enter confirms', async () => {
    const p = customConfirm({ title: 'X' });
    await flush();
    pressKey('Enter');
    await expect(p).resolves.toBe(true);
  });

  it('Enter submits a prompt value', async () => {
    const p = customPrompt({ title: 'X' });
    await flush();
    typeInput('hello');
    pressKey('Enter');
    await expect(p).resolves.toBe('hello');
  });
});

describe('focus management', () => {
  it('moves focus into the dialog on open', async () => {
    customConfirm({ title: 'X' });
    await flush();
    expect(getDialog().contains(document.activeElement)).toBe(true);
    clickConfirm();
  });

  it('danger confirm focuses the safer cancel button', async () => {
    customConfirm({ title: 'Delete?', variant: 'danger' });
    await flush();
    expect(document.activeElement).toBe(q('.cd-btn-cancel'));
    clickCancel();
  });

  it('non-danger confirm focuses the confirm button', async () => {
    customConfirm({ title: 'Save?', variant: 'info' });
    await flush();
    expect(document.activeElement).toBe(q('.cd-btn-confirm'));
    clickConfirm();
  });

  it('traps focus: Shift+Tab from first wraps to last', async () => {
    customConfirm({ title: 'X' });
    await flush();
    const first = q('.cd-btn-confirm'); // depends on DOM order: cancel then confirm
    // Focusable order in DOM: close(x), cancel, confirm
    const focusables = Array.from(getDialog().querySelectorAll('button'));
    focusables[0].focus();
    pressKeyDocument('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);
    expect(first).toBeTruthy();
    clickCancel();
  });

  it('restores focus to the trigger element after close', async () => {
    const btn = document.createElement('button');
    btn.id = 'opener';
    document.body.appendChild(btn);
    btn.focus();
    expect(document.activeElement).toBe(btn);

    const p = customConfirm({ title: 'X' });
    await flush();
    clickConfirm();
    await p;
    await flush();
    expect(document.activeElement).toBe(btn);
  });
});

describe('double-resolution & async onConfirm', () => {
  it('double-clicking confirm only runs onConfirm once', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const p = customConfirm({ title: 'X', onConfirm });
    await flush();
    clickConfirm();
    clickConfirm();
    clickConfirm();
    await p;
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows loading state and disables controls while onConfirm runs', async () => {
    let release;
    const onConfirm = () => new Promise((r) => { release = r; });
    const p = customConfirm({ title: 'X', onConfirm });
    await flush();
    clickConfirm();
    await flush();
    expect(q('.cd-btn-confirm').hasAttribute('disabled')).toBe(true);
    expect(q('.cd-btn-cancel').hasAttribute('disabled')).toBe(true);
    expect(getDialog().classList.contains('cd-is-loading')).toBe(true);
    release();
    await expect(p).resolves.toBe(true);
  });

  it('resolves true only after onConfirm succeeds', async () => {
    const order = [];
    const onConfirm = async () => { await flush(); order.push('work'); };
    const p = customConfirm({ title: 'X', onConfirm }).then(() => order.push('resolved'));
    await flush();
    clickConfirm();
    await p;
    expect(order).toEqual(['work', 'resolved']);
  });

  it('keeps the dialog open and shows an error when onConfirm throws', async () => {
    let calls = 0;
    const onConfirm = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('Server exploded');
    });
    const p = customConfirm({ title: 'X', onConfirm });
    await flush();
    clickConfirm();
    await flush();
    // Still open, error visible, controls re-enabled.
    expect(getDialog()).not.toBeNull();
    expect(q('.cd-error').hidden).toBe(false);
    expect(q('.cd-error').textContent).toContain('Server exploded');
    expect(q('.cd-btn-confirm').hasAttribute('disabled')).toBe(false);
    // Retry succeeds.
    clickConfirm();
    await expect(p).resolves.toBe(true);
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});

describe('validation', () => {
  it('blocks confirm and shows message on sync validation failure', async () => {
    const p = customPrompt({
      title: 'Name?',
      validate: (v) => (v.length >= 3 ? true : 'Too short'),
    });
    await flush();
    typeInput('ab');
    clickConfirm();
    await flush();
    expect(getDialog()).not.toBeNull();
    expect(q('.cd-error').textContent).toBe('Too short');
    // Fix and resubmit.
    typeInput('abcd');
    clickConfirm();
    await expect(p).resolves.toBe('abcd');
  });

  it('supports async validation', async () => {
    const p = customPrompt({
      title: 'Name?',
      validate: async (v) => {
        await flush();
        return v === 'ok' ? true : 'nope';
      },
    });
    await flush();
    typeInput('ok');
    clickConfirm();
    await expect(p).resolves.toBe('ok');
  });
});

describe('queue', () => {
  it('shows only one dialog at a time and preserves order', async () => {
    const results = [];
    const a = customConfirm({ title: 'A' }).then((r) => results.push(['A', r]));
    const b = customConfirm({ title: 'B' }).then((r) => results.push(['B', r]));
    const c = customConfirm({ title: 'C' }).then((r) => results.push(['C', r]));

    await flush();
    expect(document.querySelectorAll('.cd-dialog').length).toBe(1);
    expect(q('.cd-title').textContent).toBe('A');
    clickConfirm();
    await flush();

    expect(document.querySelectorAll('.cd-dialog').length).toBe(1);
    expect(q('.cd-title').textContent).toBe('B');
    clickCancel();
    await flush();

    expect(q('.cd-title').textContent).toBe('C');
    clickConfirm();
    await Promise.all([a, b, c]);

    expect(results).toEqual([['A', true], ['B', false], ['C', true]]);
    expect(CustomDialog.queueSize).toBe(0);
  });

  it('never stacks dialogs when many open at nearly the same time', async () => {
    const ps = [];
    for (let i = 0; i < 5; i += 1) ps.push(customAlert({ title: `n${i}` }));
    await flush();
    expect(document.querySelectorAll('.cd-dialog').length).toBe(1);
    // Drain them all.
    for (let i = 0; i < 5; i += 1) {
      clickConfirm();
      await flush();
    }
    await Promise.all(ps);
    expect(document.querySelectorAll('.cd-dialog').length).toBe(0);
  });
});

describe('security: HTML escaping', () => {
  it('renders strings as text, not HTML, by default', async () => {
    const p = customAlert({ title: '<img src=x onerror=alert(1)>', message: '<b>hi</b>' });
    await flush();
    expect(getDialog().querySelector('img')).toBeNull();
    expect(getDialog().querySelector('b')).toBeNull();
    expect(q('.cd-title').textContent).toBe('<img src=x onerror=alert(1)>');
    clickConfirm();
    await p;
  });

  it('renders HTML only when allowHtml is true', async () => {
    const p = customAlert({ message: '<b class="boom">hi</b>', allowHtml: true });
    await flush();
    expect(getDialog().querySelector('b.boom')).not.toBeNull();
    clickConfirm();
    await p;
  });

  it('accepts a DOM node as safe rich content', async () => {
    const node = document.createElement('span');
    node.className = 'rich';
    node.textContent = 'rich node';
    const p = customAlert({ message: node });
    await flush();
    expect(getDialog().querySelector('span.rich')).not.toBeNull();
    clickConfirm();
    await p;
  });
});

describe('lifecycle: scroll lock & cleanup', () => {
  it('locks scroll while open and restores after close', async () => {
    expect(document.body.style.position).toBe('');
    const p = customConfirm({ title: 'X' });
    await flush();
    expect(document.body.style.position).toBe('fixed');
    clickConfirm();
    await p;
    expect(document.body.style.position).toBe('');
  });

  it('cleans up the root DOM after close', async () => {
    const p = customAlert({ title: 'X' });
    await flush();
    expect(getDialog()).not.toBeNull();
    clickConfirm();
    await p;
    expect(getRoot().hidden).toBe(true);
    expect(getRoot().children.length).toBe(0);
  });

  it('reuses a single shared root across dialogs', async () => {
    const p1 = customAlert({ title: 'one' });
    await flush();
    clickConfirm();
    await p1;
    const p2 = customAlert({ title: 'two' });
    await flush();
    clickConfirm();
    await p2;
    expect(document.querySelectorAll('[data-cd-root]').length).toBe(1);
  });
});

describe('accessibility wiring', () => {
  it('uses alertdialog for alerts and dialog for confirms', async () => {
    customAlert({ title: 'A' });
    await flush();
    expect(getDialog().getAttribute('role')).toBe('alertdialog');
    expect(getDialog().getAttribute('aria-modal')).toBe('true');
    clickConfirm();
    await flush();

    customConfirm({ title: 'C' });
    await flush();
    expect(getDialog().getAttribute('role')).toBe('dialog');
    clickConfirm();
  });

  it('links title and message via aria-labelledby/aria-describedby', async () => {
    customAlert({ title: 'T', message: 'M' });
    await flush();
    const dialog = getDialog();
    const labelId = dialog.getAttribute('aria-labelledby');
    const descId = dialog.getAttribute('aria-describedby');
    expect(dialog.querySelector(`#${labelId}`).textContent).toBe('T');
    expect(dialog.querySelector(`#${descId}`).textContent).toBe('M');
    clickConfirm();
  });

  it('makes background siblings inert/aria-hidden while open', async () => {
    const bg = document.createElement('div');
    bg.id = 'bg';
    document.body.appendChild(bg);
    customConfirm({ title: 'X' });
    await flush();
    expect(bg.getAttribute('aria-hidden')).toBe('true');
    clickConfirm();
    await flush();
    expect(bg.getAttribute('aria-hidden')).toBeNull();
  });
});

/**
 * Dispatch a Tab keydown at the document (capture) level, where the focus trap
 * listens. Kept local to avoid polluting helpers used elsewhere.
 */
function pressKeyDocument(key, init = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}
