/**
 * Executes the usage patterns shown in the README / examples folder, so the
 * documented examples can't silently rot. Mirrors real consumer code.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  customAlert,
  customConfirm,
  customPrompt,
  CustomDialog,
} from '../src/index.js';
import {
  getDialog,
  q,
  clickConfirm,
  clickCancel,
  typeInput,
  pressKey,
} from './helpers.js';

beforeEach(async () => {
  document.body.innerHTML = '';
  document.body.style.cssText = '';
  await flush(2);
});

afterEach(async () => {
  for (let i = 0; i < 12 && getDialog(); i += 1) {
    pressKey('Escape');
    clickCancel();
    clickConfirm();
    await flush();
  }
  await flush(3);
});

describe('README: basic usage', () => {
  it('string shorthand: customAlert("Saved!")', async () => {
    const p = customAlert('Saved!');
    await flush();
    expect(q('.cd-message').textContent).toBe('Saved!');
    clickConfirm();
    await expect(p).resolves.toBeUndefined();
  });

  it('success alert example resolves', async () => {
    const p = customAlert({
      title: 'Invoice sent',
      message: 'The customer has been emailed successfully.',
      variant: 'success',
    });
    await flush();
    expect(getDialog().className).toContain('cd-variant-success');
    clickConfirm();
    await expect(p).resolves.toBeUndefined();
  });

  it('grouped API: CustomDialog.confirm(...) works like customConfirm', async () => {
    const p = CustomDialog.confirm({ title: 'Proceed?' });
    await flush();
    clickConfirm();
    await expect(p).resolves.toBe(true);
  });
});

describe('README: delete confirmation (boolean)', () => {
  it('returns true when confirmed, false when cancelled', async () => {
    const yes = customConfirm({
      title: 'Delete invoice?',
      message: 'This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete invoice',
      cancelText: 'Keep invoice',
    });
    await flush();
    clickConfirm();
    await expect(yes).resolves.toBe(true);

    const no = customConfirm({ title: 'Delete invoice?', variant: 'danger' });
    await flush();
    clickCancel();
    await expect(no).resolves.toBe(false);
  });
});

describe('README: async onConfirm (advanced confirmation)', () => {
  it('runs async work and resolves true only after it succeeds', async () => {
    const deleteInvoice = vi.fn().mockResolvedValue(undefined);
    const p = customConfirm({
      title: 'Delete invoice?',
      variant: 'danger',
      confirmText: 'Delete invoice',
      onConfirm: async () => { await deleteInvoice(); },
    });
    await flush();
    clickConfirm();
    await expect(p).resolves.toBe(true);
    expect(deleteInvoice).toHaveBeenCalledTimes(1);
  });

  it('simulated server error keeps the dialog open, then retry succeeds', async () => {
    let attempts = 0;
    const p = customConfirm({
      title: 'Delete account?',
      variant: 'danger',
      confirmText: 'Delete account',
      onConfirm: async () => {
        attempts += 1;
        if (attempts < 2) throw new Error('Server unavailable (503).');
      },
    });
    await flush();
    clickConfirm();
    await flush();
    expect(getDialog()).not.toBeNull();
    expect(q('.cd-error').textContent).toContain('503');
    clickConfirm(); // retry
    await expect(p).resolves.toBe(true);
    expect(attempts).toBe(2);
  });
});

describe('README: prompt with validation', () => {
  it('rejects invalid input, accepts valid input', async () => {
    const p = customPrompt({
      title: 'Choose a username',
      inputLabel: 'Username',
      validate: async (v) => {
        if (!/^[a-z0-9]+$/i.test(v)) return 'Only letters and numbers allowed.';
        if (v.length < 3) return 'Must be at least 3 characters.';
        return true;
      },
    });
    await flush();
    typeInput('a!');
    clickConfirm();
    await flush();
    expect(q('.cd-error').textContent).toBe('Only letters and numbers allowed.');
    typeInput('valid1');
    clickConfirm();
    await expect(p).resolves.toBe('valid1');
  });

  it('prompt cancellation returns null', async () => {
    const p = customPrompt({ title: 'Enter a name', placeholder: 'Record name' });
    await flush();
    clickCancel();
    await expect(p).resolves.toBeNull();
  });
});

describe('README: migration from native confirm()', () => {
  it('async confirm replaces synchronous window.confirm', async () => {
    const deleteItem = vi.fn();
    // const confirmed = await customConfirm({ title: 'Delete?', variant: 'danger' });
    const p = customConfirm({ title: 'Delete?', variant: 'danger' });
    await flush();
    clickConfirm();
    const confirmed = await p;
    if (confirmed) deleteItem();
    expect(confirmed).toBe(true);
    expect(deleteItem).toHaveBeenCalledTimes(1);
  });
});
