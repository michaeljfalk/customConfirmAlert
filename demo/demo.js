// Demo wiring. Imports straight from source so the demo always reflects the
// current code. In a real project you would import from the package instead:
//   import { customAlert, customConfirm, customPrompt } from 'customconfirmalert';
import {
  customAlert,
  customConfirm,
  customPrompt,
} from '../src/index.js';

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
};

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
