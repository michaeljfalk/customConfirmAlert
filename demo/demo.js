// Demo wiring (classic script, so this page also runs from file://).
// The global build at ../dist/custom-dialog.global.js exposes window.CustomDialog.
// In a real project you would import from the package instead:
//   import { customAlert, customConfirm, customPrompt } from 'customconfirmalert';
const { customAlert, customConfirm, customPrompt, customToast } = window.CustomDialog;
const { configureToasts, closeAllToasts } = window.CustomDialog;

const logEl = document.getElementById('log');
function log(label, value) {
  const line = `${new Date().toLocaleTimeString()}  ${label}: ${JSON.stringify(value)}`;
  logEl.textContent = `${line}\n${logEl.textContent}`;
}

/** Pretend to do server work. */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const actions = {
  'alert-info': () =>
    customAlert({
      title: 'Heads up',
      message: 'This is a basic informational alert.',
      variant: 'info',
    }).then(() => log('alert-info', 'dismissed')),

  'alert-success': () =>
    customAlert({
      title: 'Invoice sent',
      message: 'The customer has been emailed successfully.',
      variant: 'success',
    }).then(() => log('alert-success', 'dismissed')),

  'alert-warning': () =>
    customAlert({
      title: 'Storage almost full',
      message: 'You are using 92% of your available storage.',
      variant: 'warning',
    }).then(() => log('alert-warning', 'dismissed')),

  'confirm-danger': async () => {
    const ok = await customConfirm({
      title: 'Delete invoice?',
      message: 'This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete invoice',
      cancelText: 'Keep invoice',
    });
    log('confirm-danger', ok);
  },

  'confirm-safe': async () => {
    const ok = await customConfirm({
      title: 'Publish changes?',
      message: 'Your changes will become visible to everyone.',
      variant: 'info',
      confirmText: 'Publish',
    });
    log('confirm-safe', ok);
  },

  'confirm-async': async () => {
    const ok = await customConfirm({
      title: 'Archive project?',
      message: 'We will move it to your archive.',
      variant: 'warning',
      confirmText: 'Archive',
      onConfirm: async () => {
        await wait(1200); // simulated server work — note the loading state
      },
    });
    log('confirm-async', ok);
  },

  'confirm-error': async () => {
    let attempts = 0;
    const ok = await customConfirm({
      title: 'Delete account?',
      message: 'This permanently removes all data.',
      variant: 'danger',
      confirmText: 'Delete account',
      onConfirm: async () => {
        attempts += 1;
        await wait(900);
        if (attempts < 2) {
          throw new Error('Server unavailable (503). Please try again.');
        }
      },
    });
    log('confirm-error', { confirmed: ok, attempts });
  },

  prompt: async () => {
    const value = await customPrompt({
      title: 'Enter a name',
      message: 'Choose a name for this record.',
      placeholder: 'Record name',
      defaultValue: '',
    });
    log('prompt', value);
  },

  'prompt-validate': async () => {
    const value = await customPrompt({
      title: 'Choose a username',
      message: 'Letters and numbers, at least 3 characters.',
      placeholder: 'username',
      inputLabel: 'Username',
      validate: async (v) => {
        await wait(300); // async availability check
        if (!/^[a-z0-9]+$/i.test(v)) return 'Only letters and numbers allowed.';
        if (v.length < 3) return 'Must be at least 3 characters.';
        if (v.toLowerCase() === 'admin') return 'That username is taken.';
        return true;
      },
    });
    log('prompt-validate', value);
  },

  queue: () => {
    customAlert({ title: 'First', message: 'Dialog 1 of 3.', variant: 'info' });
    customConfirm({ title: 'Second', message: 'Confirm dialog 2 of 3.' }).then((r) =>
      log('queue#2', r),
    );
    customAlert({ title: 'Third', message: 'Dialog 3 of 3.', variant: 'success' }).then(() =>
      log('queue', 'all shown sequentially'),
    );
  },

  long: () =>
    customConfirm({
      title:
        'This is an intentionally very long title that should wrap gracefully across multiple lines without breaking the layout on any screen size',
      message:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(12) +
        'supercalifragilisticexpialidocioussupercalifragilisticexpialidocious',
      variant: 'info',
      confirmText: 'Understood',
    }).then((r) => log('long', r)),

  rich: () => {
    const frag = document.createDocumentFragment();
    const p = document.createElement('p');
    p.textContent = 'This message was built from DOM nodes (the safe rich-content path):';
    const ul = document.createElement('ul');
    ['No innerHTML', 'No XSS risk', 'Fully styleable'].forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
    frag.appendChild(p);
    frag.appendChild(ul);
    customAlert({ title: 'Rich content', message: frag, variant: 'info' }).then(() =>
      log('rich', 'dismissed'),
    );
  },

  /* ----------------------------- Toasts ----------------------------------- */

  'toast-info': () => customToast({ ...pos(), message: 'New comment on your invoice.', variant: 'info' }),
  'toast-success': () => customToast({ ...pos(), message: 'Edits saved', variant: 'success' }),
  'toast-warning': () =>
    customToast({ ...pos(), title: 'Validation warning', message: 'Two fields need attention.', variant: 'warning' }),
  'toast-danger': () =>
    customToast({
      ...pos(),
      title: 'Connection lost',
      message: 'We could not reach the server.',
      variant: 'danger',
      ariaLive: 'assertive',
    }),
  'toast-neutral': () => customToast({ ...pos(), message: 'Background task finished.', variant: 'neutral' }),

  'toast-auto': () => customToast({ ...pos(), message: 'Auto-dismiss in 4 seconds.', variant: 'info' }),
  'toast-custom-duration': () =>
    customToast({ ...pos(), message: 'Gone in 1.5s', variant: 'success', duration: 1500 }),
  'toast-persistent': () =>
    customToast({
      ...pos(),
      title: 'Connection lost',
      message: 'Changes will sync when the connection returns.',
      variant: 'warning',
      persistent: true,
    }),
  'toast-progress': () =>
    customToast({ ...pos(), message: 'Saved — closing soon', variant: 'success', duration: 5000, showProgress: true }),
  'toast-no-close': () =>
    customToast({ ...pos(), message: 'Uploading… (no close button)', variant: 'info', dismissible: false, duration: 3000 }),
  'toast-stack': () => {
    for (let i = 1; i <= 5; i += 1) {
      customToast({ ...pos(), message: `Notification #${i}`, variant: ['info', 'success', 'warning', 'danger', 'neutral'][i - 1] });
    }
  },
  'toast-overflow': () => {
    applyConfig();
    for (let i = 1; i <= 8; i += 1) {
      customToast({ ...pos(), title: `Item ${i}`, message: 'Overflow policy applies here.', persistent: true });
    }
  },

  'toast-autosave': () => {
    const toast = customToast({
      id: 'autosave-demo',
      ...pos(),
      message: 'Saving changes…',
      variant: 'info',
      persistent: true,
      dismissible: false,
    });
    setTimeout(() => {
      toast.update({
        message: 'Changes saved',
        variant: 'success',
        persistent: false,
        dismissible: true,
        duration: 2500,
      });
    }, 1500);
  },
  'toast-autosave-fail': () => {
    const toast = customToast({
      id: 'autosave-demo',
      ...pos(),
      message: 'Saving changes…',
      variant: 'info',
      persistent: true,
      dismissible: false,
    });
    setTimeout(() => {
      toast.update({
        title: 'Could not save',
        message: 'The server rejected the change. Try again.',
        variant: 'danger',
        persistent: true,
        dismissible: true,
      });
    }, 1500);
  },
  'toast-dedup': () => {
    customToast({ id: 'dedup-demo', ...pos(), message: 'Saving…', variant: 'info', persistent: true });
    setTimeout(() => {
      customToast({ id: 'dedup-demo', ...pos(), message: 'Saved', variant: 'success', persistent: false, duration: 2500 });
    }, 900);
  },
  'toast-undo': () =>
    customToast({
      ...pos(),
      message: 'Invoice deleted',
      variant: 'warning',
      duration: 6000,
      showProgress: true,
      action: {
        label: 'Undo',
        pendingLabel: 'Undoing…',
        onClick: async () => {
          await wait(700);
          log('toast-undo', 'restored');
        },
      },
    }),
  'toast-async-action': () =>
    customToast({
      ...pos(),
      title: 'Report ready',
      message: 'Generate the PDF export?',
      variant: 'info',
      persistent: true,
      action: {
        label: 'Generate',
        pendingLabel: 'Generating…',
        closeOnSuccess: true,
        onClick: async () => {
          await wait(1200);
          log('toast-async-action', 'generated');
        },
      },
    }),
  'toast-action-error': () => {
    let attempts = 0;
    customToast({
      ...pos(),
      title: 'Sync pending',
      message: 'Retry available.',
      variant: 'warning',
      persistent: true,
      action: {
        label: 'Retry',
        pendingLabel: 'Retrying…',
        onClick: async () => {
          attempts += 1;
          await wait(900);
          if (attempts < 2) throw new Error('Server unavailable (503). Please try again.');
          log('toast-action-error', 'synced');
        },
      },
    });
  },

  'toast-long-title': () =>
    customToast({
      ...pos(),
      title: 'This is an intentionally very long notification title that must wrap cleanly without breaking the toast layout',
      message: 'Short body.',
      variant: 'info',
      persistent: true,
    }),
  'toast-long-message': () =>
    customToast({
      ...pos(),
      title: 'Download ready',
      message:
        'https://example.com/very/long/path/supercalifragilisticexpialidocious-filename-that-should-wrap-safely-2026-final-v3.pdf',
      variant: 'success',
      persistent: true,
    }),
  'toast-swipe': () =>
    customToast({
      ...pos(),
      message: 'Swipe me sideways to dismiss (touch / drag).',
      variant: 'neutral',
      persistent: true,
      swipeToDismiss: true,
    }),
  'toast-coexist': () => {
    customToast({ ...pos(), message: 'A toast stays visible behind the dialog.', variant: 'info', persistent: true });
    customConfirm({ title: 'Modal + toast', message: 'Both can be visible at once.', variant: 'info' }).then((r) =>
      log('toast-coexist', { confirmed: r }),
    );
  },
  'toast-close-all': () => closeAllToasts().then(() => log('toast-close-all', 'done')),
};

/** Read the position selector for new toasts. */
function pos() {
  const sel = document.getElementById('toast-position');
  return { position: sel ? sel.value : 'top-right' };
}

/** Apply the overflow + maxVisible controls to the global toast config. */
function applyConfig() {
  const overflow = document.getElementById('toast-overflow');
  const max = document.getElementById('toast-max');
  configureToasts({
    overflow: overflow ? overflow.value : 'queue',
    maxVisible: max ? Number(max.value) || 5 : 5,
  });
}
document.getElementById('toast-overflow')?.addEventListener('change', applyConfig);
document.getElementById('toast-max')?.addEventListener('change', applyConfig);

document.querySelectorAll('[data-demo]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const fn = actions[btn.getAttribute('data-demo')];
    if (fn) fn();
  });
});

// Theme switcher: toggles data-cd-theme and a brand-override class.
const themeSelect = document.getElementById('theme');
themeSelect.addEventListener('change', () => {
  const value = themeSelect.value;
  const html = document.documentElement;
  html.classList.toggle('demo-brand', value === 'brand');
  if (value === 'auto') html.removeAttribute('data-cd-theme');
  else html.setAttribute('data-cd-theme', value === 'brand' ? 'light' : value);
});
