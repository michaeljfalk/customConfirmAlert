# customConfirmAlert

A small, polished, **accessible**, **themeable**, **dependency-free** UI primitive providing **two clearly separate systems**:

1. **Modal dialogs** (`customAlert` / `customConfirm` / `customPrompt`) — for actions that need attention or a decision.
2. **Toast notifications** (`customToast`) — non-blocking, passive feedback (saved, upload complete, connection lost, undo…).

- ✅ Native JS / HTML / CSS — **no runtime dependencies**, no framework code in core
- ✅ **Promise-based** dialogs; **controller-based** toasts (`update`/`close`/`isOpen`)
- ✅ Works in plain HTML, Meteor + Blaze, React, Vue, Svelte, Express-rendered, and static sites
- ✅ Accessible: dialogs trap focus & inert the page; toasts are live regions that **never** trap/steal focus or block the page
- ✅ Sequential dialog **queue**; independent toast **stacking** with limits, overflow policies, dedup, pause-on-hover/focus
- ✅ Async `onConfirm` / toast actions with loading state, error display, and retry
- ✅ Shared light/dark/auto themes via CSS custom properties; per-project and per-instance overrides
- 🚫 **Does not** override `window.alert` / `window.confirm` / `window.prompt`

> [!TIP]
> **Use a modal dialog when the user must make a decision or acknowledge important information.
> Use a toast when the application is reporting non-blocking status or feedback.**

> [!IMPORTANT]
> **Native `confirm()` is synchronous; this API is asynchronous.** You must `await`
> the result (or use `.then(...)`). See [Migrating from `confirm()`](#migrating-from-native-confirm).

---

## Table of contents

- [Installation](#installation)
- [Browser usage](#browser-usage)
- [npm usage](#npm-usage)
- [API reference](#api-reference)
- [Options](#options)
- [Return values](#return-values)
- [Async callback behaviour](#async-callback-behaviour)
- [Queue behaviour](#queue-behaviour)
- [Theming](#theming)
- [Accessibility](#accessibility)
- [Security](#security)
- [Framework examples](#framework-examples)
- [Migrating from native `confirm()`](#migrating-from-native-confirm)
- **[Toast notifications](#toast-notifications)** — [API](#toast-api) · [options](#toast-options) · [positioning](#positioning) · [updating](#updating-a-toast) · [IDs & dedup](#notification-ids--deduplication) · [actions](#toast-action-buttons) · [pause/resume](#toast-pause--resume) · [progress](#toast-progress-indicators) · [stack limits & overflow](#stack-limits--overflow-policies) · [accessibility](#toast-accessibility) · [security](#toast-security) · [mobile & swipe](#toast-mobile-behaviour--swipe) · [theming](#toast-theming) · [framework examples](#toast-framework-examples)
- [Limitations](#limitations)
- [Versioning & compatibility](#versioning--compatibility)
- [Browser support](#browser-support)
- [Building & testing](#building--testing)

---

## Installation

```bash
npm install customconfirmalert
```

> The npm package id is lowercase (`customconfirmalert`) because npm package names
> may not contain capital letters. The library, repo, and exported `CustomDialog`
> object keep the readable `customConfirmAlert` casing.

You always need two things: the **JS** and the **CSS** (the stylesheet is shipped as a
separate file so it is fully themeable and never auto-injected).

### Mobile viewport (required for safe-area support)

For dialogs and toasts to clear notches and the home indicator on phones, your page
**must** include this meta tag — the package cannot set it for you:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

Without `viewport-fit=cover`, `env(safe-area-inset-*)` resolves to `0` and content sits
flush to the screen edges (still usable, just not notch-aware).

---

## Browser usage

### ES modules (no build step)

```html
<link rel="stylesheet" href="./custom-dialog.css" />
<script type="module">
  import { customAlert, customConfirm } from './custom-dialog.esm.js';

  document.querySelector('#delete-button').addEventListener('click', async () => {
    const confirmed = await customConfirm({
      title: 'Delete item?',
      message: 'This cannot be undone.',
      variant: 'danger',
    });
    if (confirmed) console.log('Delete confirmed');
  });
</script>
```

### Classic `<script>` (global build)

The IIFE bundle exposes a single global, `window.CustomDialog`, that carries every
function — it does **not** leak `customAlert`/`customConfirm`/etc. as separate globals.

```html
<link rel="stylesheet" href="./custom-dialog.css" />
<script src="./custom-dialog.global.min.js"></script>
<script>
  CustomDialog.confirm({ title: 'Delete?', variant: 'danger' }).then((ok) => {
    if (ok) console.log('confirmed');
  });
  // Named functions are also available on the same object:
  // CustomDialog.customAlert(...), CustomDialog.customConfirm(...)
</script>
```

### CDN

```html
<link rel="stylesheet" href="https://unpkg.com/customconfirmalert/dist/custom-dialog.css" />
<script src="https://unpkg.com/customconfirmalert/dist/custom-dialog.global.min.js"></script>
```

---

## npm usage

```js
import {
  customAlert,
  customConfirm,
  customPrompt,
  CustomDialog,
} from 'customconfirmalert';

// Bring in the stylesheet once (bundler-dependent):
import 'customconfirmalert/css';
```

Both the **named functions** and the grouped **`CustomDialog`** object are exported and
tree-shakeable:

```js
await CustomDialog.confirm({ title: 'Proceed?' });
await customConfirm({ title: 'Proceed?' }); // identical
```

---

## API reference

| Function | Signature | Resolves with |
| --- | --- | --- |
| `customAlert` | `customAlert(options): Promise<void>` | `undefined` when dismissed |
| `customConfirm` | `customConfirm(options): Promise<boolean>` | `true` confirmed / `false` cancelled |
| `customPrompt` | `customPrompt(options): Promise<string \| null>` | entered string / `null` cancelled |

`options` may be an **options object** or a **plain string** (treated as the `message`):

```js
await customAlert('Saved!');                 // shorthand
await customAlert({ message: 'Saved!' });    // equivalent
```

`CustomDialog` mirrors these as `.alert` / `.confirm` / `.prompt`, plus a read-only
`CustomDialog.queueSize`.

---

## Options

All options are optional. Defaults are chosen to be safe and accessible.

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | `string` | `''` | Used as the accessible name (`aria-labelledby`). |
| `message` | `string \| Node` | `''` | A DOM **Node**/`DocumentFragment` is the safe rich-content path. |
| `confirmText` | `string` | `'OK'` | Primary button label. |
| `cancelText` | `string` | `'Cancel'` | Cancel button label (confirm/prompt). |
| `variant` | `'info' \| 'success' \| 'warning' \| 'danger'` | `'info'` | Colour + icon + semantics. |
| `icon` | `string \| Node \| false` | auto | Custom icon (emoji/text or Node), or `false` to hide. |
| `dismissible` | `boolean` | `true` | Show the close (×) button. |
| `closeOnEscape` | `boolean` | `true` | Escape cancels (false/null). |
| `closeOnBackdrop` | `boolean` | `false` | Backdrop click cancels **only when true**. |
| `defaultFocus` | `'confirm' \| 'cancel' \| 'input' \| 'none'` | smart | Danger confirms default to **`cancel`**. |
| `inputType` | `string` | `'text'` | Prompt input `type`. |
| `inputLabel` | `string` | — | Prompt: visible input label (otherwise visually-hidden). |
| `placeholder` | `string` | `''` | Prompt input placeholder. |
| `defaultValue` | `string` | `''` | Prompt initial value. |
| `validate` | `(value) => boolean \| string \| void \| Promise<…>` | — | Return `true` to pass, a string to show as error, `false` for generic error. |
| `onConfirm` | `(value) => void \| Promise<void>` | — | Async work before resolving. See below. |
| `allowHtml` | `boolean` | `false` | Render `title`/`message` strings as HTML. **You must sanitise.** |
| `className` | `string` | `''` | Extra class on the dialog (per-dialog theming). |
| `ariaLabel` | `string` | `'Dialog'` | Accessible name when no `title`. |
| `closeLabel` | `string` | `'Close'` | Accessible label for the × button. |
| `invalidMessage` | `string` | generic | Message used when `validate` returns `false`. |

### `defaultFocus`

- `confirm` — focus the primary button (default for non-destructive confirms & alerts)
- `cancel` — focus the safer cancel button (**default for `variant: 'danger'` confirms**)
- `input` — focus the prompt input (default for prompts)
- `none` — focus the dialog container itself

---

## Return values

```ts
customAlert(options):   Promise<void>
customConfirm(options): Promise<boolean>
customPrompt(options):  Promise<string | null>
```

Cancelling (Escape, cancel button, close ×, or an enabled backdrop click) resolves
`undefined` (alert), `false` (confirm), or `null` (prompt) — it **never rejects**.

---

## Async callback behaviour

Pass `onConfirm` to run asynchronous work *before* the dialog closes:

```js
await customConfirm({
  title: 'Delete invoice?',
  variant: 'danger',
  confirmText: 'Delete invoice',
  onConfirm: async () => {
    await deleteInvoice(); // throws on failure
  },
});
```

While `onConfirm` runs, the component:

1. Shows a **loading state** (spinner on the confirm button, `aria-busy`).
2. **Disables** all controls (confirm, cancel, close, input).
3. **Prevents duplicate submission** — double-clicks are ignored.
4. If the callback **throws**, the dialog **stays open** and shows a human-readable,
   screen-reader-announced error (`role="alert"`); the user can **retry or cancel**.
5. Resolves `true` **only after** the callback succeeds.

The basic boolean usage still works without `onConfirm`:

```js
if (await customConfirm({ title: 'Delete?', variant: 'danger' })) {
  await deleteInvoice();
}
```

`validate` (sync or async) works the same way for prompts — return a string to display
an inline error and keep the dialog open.

---

## Queue behaviour

- Only **one** dialog is ever on screen.
- Concurrent calls are **queued and shown sequentially** in call order.
- Dialogs never stack; double-clicking a button never resolves a Promise twice.
- `CustomDialog.queueSize` reports how many dialogs are waiting.

```js
customAlert({ title: 'First' });
customConfirm({ title: 'Second' }).then((ok) => console.log(ok));
customAlert({ title: 'Third' });
// Shown one after another; each awaits the previous one closing.
```

---

## Theming

Everything visual is a CSS custom property. Override on `:root`, a wrapper element, or
per-dialog via `className`. There is **no dependency** on Bootstrap, Tailwind, Material, etc.

```css
:root {
  --custom-dialog-font-family: system-ui, sans-serif;
  --custom-dialog-backdrop: rgb(0 0 0 / 0.5);
  --custom-dialog-background: #ffffff;
  --custom-dialog-text: #172033;
  --custom-dialog-muted-text: #667085;
  --custom-dialog-border: #e4e7ec;
  --custom-dialog-border-radius: 14px;
  --custom-dialog-shadow: 0 24px 70px rgb(0 0 0 / 0.25);
  --custom-dialog-primary: #2563eb;
  --custom-dialog-primary-text: #ffffff;
  --custom-dialog-danger: #dc2626;
  --custom-dialog-warning: #d97706;
  --custom-dialog-success: #15803d;
  --custom-dialog-focus-ring: #3b82f6;
  --custom-dialog-max-width: 32rem;
  --custom-dialog-z-index: 10000;
}
```

**Light / dark / auto.** Dark mode is applied automatically via
`@media (prefers-color-scheme: dark)`. To force a scheme, set an attribute on any ancestor:

```html
<html data-cd-theme="dark"> … </html>   <!-- or "light" -->
```

**Per-dialog theme.** Add a class and target it:

```js
customAlert({ title: 'Branded', className: 'brand-dialog' });
```
```css
.brand-dialog { --custom-dialog-primary: #7c3aed; --custom-dialog-border-radius: 22px; }
```

---

## Accessibility

Accessibility is a first-class feature:

- `role="alertdialog"` for alerts, `role="dialog"` for confirms/prompts, with `aria-modal="true"`.
- `aria-labelledby` (title) and `aria-describedby` (message) wired automatically.
- **Focus trap** with Tab / Shift+Tab cycling; focus is moved into the dialog on open.
- **Focus restoration** to the element that opened the dialog on close.
- Background made **`inert`** (with `aria-hidden` fallback) so it can't be interacted with or read.
- **Escape** cancels (unless disabled); **Enter** activates the primary action.
- Errors use `role="alert"` so they're announced.
- Visible focus rings (`:focus-visible`), `prefers-reduced-motion` (no animation/spinner),
  and `forced-colors` / high-contrast support.
- Prompt inputs have proper `<label>` association.
- Inputs use ≥16px font to avoid iOS zoom-on-focus; layout is keyboard-safe on mobile.

---

## Security

- Plain strings are rendered with **`textContent`**, never `innerHTML`.
- **No HTML is rendered by default.** Pass a **DOM Node / `DocumentFragment`** for safe
  rich content (recommended).
- `allowHtml: true` is supported but **the caller is responsible for sanitising** the HTML
  (e.g. with DOMPurify). Prefer the Node path instead.
- No inline event-handler attributes; no `eval`, `new Function`, or dynamic script injection
  in the runtime library.
- The only persistent side effect is creating a single shared modal root element.

---

## Framework examples

> The core stays framework-agnostic — call it from any event handler. Do **not** wrap it
> in a framework component unless you keep that in a separate optional adapter.

### Plain JavaScript

```html
<link rel="stylesheet" href="./custom-dialog.css" />
<button id="del">Delete</button>
<script type="module">
  import { customConfirm } from './custom-dialog.esm.js';
  document.getElementById('del').addEventListener('click', async () => {
    const ok = await customConfirm({
      title: 'Delete item?',
      message: 'This cannot be undone.',
      variant: 'danger',
    });
    if (ok) console.log('deleted');
  });
</script>
```

### Meteor + Blaze

Use `Meteor.callAsync`, not callback-style methods.

```js
import { customConfirm } from 'customconfirmalert';

Template.invoiceRow.events({
  async 'click .delete-invoice'(event, instance) {
    const confirmed = await customConfirm({
      title: 'Delete invoice?',
      message: 'This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete invoice',
      cancelText: 'Keep invoice',
    });
    if (!confirmed) return;
    await Meteor.callAsync('invoices.remove', instance.data._id);
  },
});
```

### React

Call it from an event handler — no special component required.

```jsx
import { customConfirm } from 'customconfirmalert';

function DeleteButton({ id, onDeleted }) {
  async function handleDelete() {
    const ok = await customConfirm({
      title: 'Delete invoice?',
      message: 'This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete invoice',
      onConfirm: async () => { await api.deleteInvoice(id); },
    });
    if (ok) onDeleted(id);
  }
  return <button onClick={handleDelete}>Delete</button>;
}
```

### Vue (Composition API)

```vue
<script setup>
import { customConfirm } from 'customconfirmalert';

async function remove(id) {
  const ok = await customConfirm({
    title: 'Delete invoice?',
    variant: 'danger',
    confirmText: 'Delete invoice',
  });
  if (ok) await api.deleteInvoice(id);
}
</script>

<template>
  <button @click="remove(invoice.id)">Delete</button>
</template>
```

### Svelte

```svelte
<script>
  import { customConfirm } from 'customconfirmalert';
  export let id;
  async function remove() {
    if (await customConfirm({ title: 'Delete?', variant: 'danger' })) {
      await api.deleteInvoice(id);
    }
  }
</script>

<button on:click={remove}>Delete</button>
```

### Express-rendered / static sites

Server-render your HTML as usual and include the global build on the page:

```html
<link rel="stylesheet" href="/vendor/custom-dialog.css" />
<script src="/vendor/custom-dialog.global.min.js"></script>
<script>
  document.addEventListener('click', async (e) => {
    if (!e.target.matches('[data-confirm]')) return;
    e.preventDefault();
    const ok = await CustomDialog.confirm({ title: e.target.dataset.confirm, variant: 'danger' });
    if (ok) e.target.closest('form').submit();
  });
</script>
```

---

## Migrating from native `confirm()`

> [!WARNING]
> Native `confirm()` is **synchronous** — it blocks the thread and returns a boolean.
> `customConfirm()` is **asynchronous** — it returns a Promise you must `await`.

```js
// Native and synchronous
if (window.confirm('Delete?')) {
  deleteItem();
}
```

must become:

```js
// Custom and asynchronous
const confirmed = await customConfirm({
  title: 'Delete?',
  variant: 'danger',
});
if (confirmed) {
  await deleteItem();
}
```

The enclosing function must be `async` (or use `.then(...)`). Code *after* the dialog call
no longer runs synchronously — move anything that depends on the answer inside the
`if (confirmed)` block or a `.then()` callback.

---

## Toast notifications

Toasts are **non-modal, non-blocking** feedback. They are a completely separate system
from the modal dialogs:

| | Modal dialog | Toast notification |
| --- | --- | --- |
| Purpose | A decision / acknowledgement is required | Passive status & feedback |
| Blocking | Yes — backdrop, scroll-lock, background `inert`, focus trap | **No** — never blocks, traps, or steals focus |
| Concurrency | One at a time (queued) | Many stacked, per position, with limits |
| Return | `Promise` (await the result) | A **controller** (`update` / `close` / `isOpen`) |

> Toasts and dialogs are independent: a toast can be visible while a dialog is open.
> Toasts are **not** implemented inside `customAlert()`.

### Toast API

```js
import { customToast, CustomDialog } from 'customconfirmalert';
import 'customconfirmalert/css';

customToast({ message: 'Edits saved', variant: 'success' });
CustomDialog.toast({ message: 'Edits saved', variant: 'success' }); // identical
```

`customToast(options)` returns a **controller**:

```js
const toast = customToast({
  title: 'Uploading',
  message: 'Your document is being uploaded.',
  variant: 'info',
  persistent: true,
});

toast.update({ title: 'Upload complete', message: 'Done.', variant: 'success', persistent: false, duration: 3000 });
await toast.close(); // resolves after the exit animation + cleanup

toast.id;          // string
toast.isOpen();    // boolean
```

| Function | Returns |
| --- | --- |
| `customToast(options)` | `ToastController` |
| `CustomDialog.toast(options)` | `ToastController` |
| `closeToast(id)` / `CustomDialog.closeToast(id)` | `Promise<void>` |
| `getToast(id)` / `CustomDialog.getToast(id)` | `ToastController \| null` |
| `closeAllToasts(filter?)` / `CustomDialog.closeAllToasts(filter?)` | `Promise<void>` |
| `configureToasts(config)` / `CustomDialog.configureToasts(config)` | resolved config |

A string argument is shorthand for the message: `customToast('Saved')`.

### Toast options

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `string` | auto | Repeat call with same id **updates in place** (see dedup). |
| `title` | `string` | — | |
| `message` | `string \| Node` | — | A DOM Node/Fragment is the safe rich-content path. |
| `variant` | `'info'\|'success'\|'warning'\|'danger'\|'neutral'` | `'info'` | |
| `icon` | `string \| Node \| false` | auto | `false` hides it. |
| `position` | `ToastPosition` | `'top-right'` | Six positions (below). |
| `duration` | `number` (ms) | `4000` | Auto-dismiss; ignored while `persistent`. |
| `persistent` | `boolean` | `false` | Stays until closed/updated; **overrides `duration`**. |
| `dismissible` | `boolean` | `true` | Show the close (×) button. |
| `pauseOnHover` | `boolean` | `true` | |
| `pauseOnFocus` | `boolean` | `true` | |
| `showProgress` | `boolean` | `false` | Visual time-remaining bar. |
| `swipeToDismiss` | `boolean` | `true` | Horizontal swipe (touch/pointer). |
| `action` | `ToastAction` | — | One optional action button (below). |
| `closeLabel` | `string` | `'Dismiss notification'` | Close-button aria-label. |
| `enterAnimation` / `exitAnimation` | `ToastAnimation` | `'auto'` | `auto` derives from position. |
| `ariaLive` | `'polite'\|'assertive'\|'off'` | `'polite'` | Use `assertive` only for urgent toasts. |
| `allowHtml` | `boolean` | `false` | Caller MUST sanitise. |
| `className` | `string` | — | Per-toast theming hook. |
| `data` | `any` | — | Passed through untouched. |
| `onOpen` / `onClose` | `() => void` | — | Lifecycle callbacks. |
| `onAction` | `() => void \| Promise<void>` | — | Alternative to `action.onClick`. |

**Variants:** `info` · `success` · `warning` · `danger` · `neutral`.

### Timed vs persistent

```js
customToast({ message: 'Edits saved', variant: 'success', duration: 3500 }); // auto-dismiss

customToast({
  title: 'Connection lost',
  message: 'Changes will sync when the connection returns.',
  variant: 'warning',
  persistent: true,           // overrides duration; stays until closed/updated
  dismissible: true,
});
```

The dismiss timer **only starts once the toast has visibly entered**, and exit always
plays the close animation before the toast is removed from the DOM (with a safe timeout
fallback if the animation event never fires).

### Positioning

`top-left` · `top-center` · `top-right` · `bottom-left` · `bottom-center` · `bottom-right`.

Each position has its **own lazily-created container** (created on first use, removed when
empty). Newer toasts appear nearest the screen edge (top positions prepend; bottom positions
append). Toasts never overlap and honour mobile safe-area insets.

`enterAnimation`/`exitAnimation` accept `slide-down`, `slide-up`, `slide-left`, `slide-right`,
`fade`, `scale`, `none`, or `auto`. `auto` derives the natural motion from the position
(e.g. `top-center` slides down in / up out; `bottom-left` slides in from the left). All
animation uses transforms + opacity and respects `prefers-reduced-motion`.

```js
customToast({ message: 'Report generated', position: 'top-center', enterAnimation: 'slide-down', exitAnimation: 'slide-up' });
```

### Updating a toast

`update()` mutates the existing toast **in place** (no destroy/recreate) and returns the
controller. **Timing rules** (documented and stable):

- A new `duration` **restarts** the timer.
- `persistent: true` **stops** the timer immediately (timed → persistent).
- `persistent: false` **begins** the timer (persistent → timed).
- `position` changes on update are ignored (re-create for a new position).

```js
const toast = customToast({ id: 'autosave', message: 'Saving changes…', variant: 'info', persistent: true, dismissible: false });
setTimeout(() => {
  toast.update({ message: 'Changes saved', variant: 'success', persistent: false, dismissible: true, duration: 2500 });
}, 1500);
```

### Notification IDs & deduplication

Provide a stable `id` to address a toast across calls. **Default dedup policy:** a second
`customToast` with the same `id` **updates the existing toast in place, creates no duplicate,
and returns the existing controller**.

```js
customToast({ id: 'autosave-status', message: 'Saving…', variant: 'info', persistent: true });
customToast({ id: 'autosave-status', message: 'Saved', variant: 'success', persistent: false, duration: 2500 });
// → one toast, updated in place

CustomDialog.closeToast('autosave-status');
CustomDialog.getToast('autosave-status');     // controller or null
CustomDialog.closeAllToasts({ position: 'bottom-right' }); // optional position/variant filter
```

### Toast action buttons

One optional action button, keyboard accessible, sync or async:

```js
customToast({
  message: 'Invoice deleted',
  variant: 'warning',
  action: {
    label: 'Undo',
    pendingLabel: 'Undoing…',   // shown while async work runs
    closeOnSuccess: true,        // default true
    onClick: async () => { await restoreInvoice(); },
  },
});

// Or the top-level callback form:
customToast({ message: 'Invoice deleted', action: { label: 'Undo' }, onAction: async () => { await restoreInvoice(); } });
```

While an async action runs: the button is disabled with a spinner/`pendingLabel`, repeated
activation is prevented, and the dismiss timer pauses. **On success** the toast closes (unless
`closeOnSuccess: false`). **On failure** the toast stays open, auto-dismiss is cancelled, and a
safe, human-readable error is shown for retry or dismissal — raw stack traces are never exposed.

### Toast pause & resume

Timed toasts pause on hover (`pauseOnHover`), while focus is inside (`pauseOnFocus`), during a
swipe, while an async action runs, and **while the browser tab is hidden**. Multiple pause
reasons are tracked independently — the countdown resumes only when **all** are cleared, using
the **actual remaining time** (not a fresh full duration). Interactions that happen *during* the
enter animation are captured and applied once the timer begins.

### Toast progress indicators

`showProgress: true` adds a bar that reflects the remaining time. It pauses/resumes with the
timer, restarts on a new `duration`, is themed via CSS custom properties, and is simplified under
reduced motion. It is never the *only* indication that a toast will close.

### Stack limits & overflow policies

```js
CustomDialog.configureToasts({
  maxVisible: 5,            // max simultaneously-visible toasts PER position
  overflow: 'queue',       // 'queue' | 'dismiss-oldest' | 'dismiss-newest'
  defaultPosition: 'top-right',
  defaultDuration: 4000,
});
```

When a position is full (`maxVisible` reached):

- **`queue`** (default) — hold extra toasts until a slot frees, then show them in order.
- **`dismiss-oldest`** — close the oldest visible toast to make room for the new one.
- **`dismiss-newest`** — discard the incoming request (its controller reports `isOpen() === false`).

`maxVisible` is enforced **per position** (each container stacks independently).

### Toast accessibility

- Live-region semantics live on **each toast** (not the container) to avoid duplicate
  announcements: `role="status"` + `aria-live="polite"` normally, or `role="alert"` +
  `aria-live="assertive"` when you set `ariaLive: 'assertive'` (don't make everything assertive).
  `aria-atomic="true"` so loading→success/failure updates are announced as a whole.
- **No** focus stealing, **no** focus trap, **no** `aria-modal`, **no** page `inert`/blocking.
- Close and action buttons are real `<button>`s with accessible labels and visible
  `:focus-visible` rings; high-contrast (`forced-colors`) and reduced-motion supported.

### Toast security

Same rules as the dialogs: plain strings render with `textContent` (never `innerHTML`); pass a
**DOM Node/Fragment** for safe rich content; `allowHtml: true` is opt-in and the caller owns
sanitisation. No inline handlers, no `eval`/`new Function`, and internal/error details are never
leaked (action errors show only a safe message).

### Toast mobile behaviour & swipe

Toasts honour `env(safe-area-inset-*)` (requires the [viewport meta](#mobile-viewport-required-for-safe-area-support)),
become comfortable full-width sheets on narrow screens, keep touch-friendly targets, wrap long
words/URLs/filenames, and never exceed the viewport.
**Swipe-to-dismiss** (`swipeToDismiss`, default on) uses Pointer Events with a distance/velocity
threshold, snaps back if insufficient, pauses the timer during the gesture, respects reduced
motion, and uses `touch-action: pan-y` so vertical page scrolling is unaffected. Disable per
toast with `swipeToDismiss: false`.

> **Virtual keyboard:** inputs are ≥16px (no iOS zoom) and the focused element is scrolled into
> view by the browser, but the library does **not** add `visualViewport`/`keyboard-inset-*`
> handling. A bottom-anchored toast or prompt may be partially covered by the on-screen keyboard
> in some browsers — see [Limitations](#limitations).

> Gesture *feel* (velocity, pointer capture, scroll passthrough) is verified manually in a real
> browser via the demo; the automated tests synthesize pointer events and cover the dismiss/snap
> logic. This is the one area not fully exercised by the headless DOM tests.

### Toast theming

Reuses the dialog tokens and adds toast-specific ones. Override on `:root`, a wrapper, or per
toast via `className`. Dark mode is automatic (`prefers-color-scheme`) or forced with
`data-cd-theme="dark"`.

```css
:root {
  --custom-toast-width: 22rem;
  --custom-toast-max-width: calc(100vw - 2rem);
  --custom-toast-gap: 0.75rem;
  --custom-toast-edge-offset: 1rem;
  --custom-toast-padding: 1rem;
  --custom-toast-border-radius: 12px;
  --custom-toast-background: var(--custom-dialog-background);
  --custom-toast-text: var(--custom-dialog-text);
  --custom-toast-muted-text: var(--custom-dialog-muted-text);
  --custom-toast-border: var(--custom-dialog-border);
  --custom-toast-shadow: var(--custom-dialog-shadow);
  --custom-toast-z-index: 11000;
  --custom-toast-close-size: 2rem;
  --custom-toast-animation-duration: 220ms;
  --custom-toast-progress-height: 3px;
}
```

### Toast framework examples

**Plain JavaScript**

```js
customToast({ message: 'Edits saved', variant: 'success' });
```

**Browser bundle** — `window.CustomDialog` carries every toast method (no extra globals):

```html
<link rel="stylesheet" href="custom-dialog.css" />
<script src="custom-dialog.global.min.js"></script>
<script>
  CustomDialog.toast({ message: 'Saved', variant: 'success' });
  CustomDialog.closeAllToasts();
  CustomDialog.configureToasts({ maxVisible: 3, overflow: 'dismiss-oldest' });
</script>
```

**Meteor + Blaze** (use `Meteor.callAsync`):

```js
import { customToast } from 'customconfirmalert';

Template.profileForm.events({
  async 'submit form'(event) {
    event.preventDefault();
    const toast = customToast({ id: 'profile-save', message: 'Saving profile…', variant: 'info', persistent: true, dismissible: false });
    try {
      await Meteor.callAsync('profile.update', collectProfileFormData(event.currentTarget));
      toast.update({ message: 'Profile saved', variant: 'success', persistent: false, dismissible: true, duration: 3000 });
    } catch (error) {
      toast.update({ title: 'Could not save profile', message: getSafeErrorMessage(error), variant: 'danger', persistent: true, dismissible: true });
    }
  },
});
```

**React** — call the framework-agnostic API from an event handler (no provider/component):

```jsx
import { customToast } from 'customconfirmalert';

function SaveButton({ record }) {
  async function handleSave() {
    const toast = customToast({ id: `save-${record.id}`, message: 'Saving…', variant: 'info', persistent: true });
    try {
      await api.save(record);
      toast.update({ message: 'Saved', variant: 'success', persistent: false, duration: 2500 });
    } catch (e) {
      toast.update({ title: 'Save failed', message: getSafeMessage(e), variant: 'danger', persistent: true });
    }
  }
  return <button onClick={handleSave}>Save</button>;
}
```

**Vue (Composition API)**

```vue
<script setup>
import { customToast } from 'customconfirmalert';
function notify() {
  customToast({ message: 'Edits saved', variant: 'success' });
}
</script>

<template><button @click="notify">Save</button></template>
```

---

## Limitations

A short, honest list of edges that are intentionally out of scope or not fully covered:

- **Virtual keyboard:** no `visualViewport`/`keyboard-inset-*` handling. Inputs are ≥16px and the
  browser scrolls the focused field into view, but a bottom-anchored toast/prompt can be partially
  covered by the on-screen keyboard in some mobile browsers.
- **Safe-area insets require the host page** to set `viewport-fit=cover` (see [Installation](#installation));
  the package cannot set the viewport meta for you.
- **Swipe gesture *feel*** (velocity, pointer capture, scroll passthrough) is verified manually in a
  real browser via the demo, not by the headless DOM tests (which cover the dismiss/snap logic).
- **`toast.update({ position })` is ignored** — position is fixed at creation. Re-create the toast
  to move it to another corner.
- **`maxVisible` is per position**, not a single global cap across all six positions.
- **Visual rendering** (animation curves, `forced-colors`, exact layout) is validated by inspection;
  jsdom has no layout/paint engine, so it isn't pixel-asserted.

## Versioning & compatibility

Follows semver. **`1.1.0`** added the toast system as a purely **additive, backward-compatible**
change — existing `customAlert`/`customConfirm`/`customPrompt` and `CustomDialog.{alert,confirm,prompt}`
signatures are unchanged, so upgrading from `1.0.x` is safe.

---

## Browser support

Modern evergreen browsers: Chrome/Edge, Firefox, Safari (desktop & iOS), and Chromium-based
browsers. Uses standard DOM APIs, CSS custom properties, `:focus-visible`, and `inert`
(with an `aria-hidden` fallback when `inert` is unavailable). No polyfills required for
current browser versions.

---

## Building & testing

```bash
npm install      # dev tooling only (esbuild, vitest, jsdom) — zero runtime deps
npm test         # Vitest + jsdom behaviour suite (incl. tests/examples.test.js)
npm run build    # produces dist/ (ESM, CJS, IIFE, minified, CSS, .d.ts)
npm run demo     # builds, then serves the project root at http://localhost:8080
```

### Running the demo

The demo (`demo/index.html`) uses the **built `dist/` files**, so build first
(or just run `npm run demo`, which builds and serves):

```bash
npm run demo
# then open http://localhost:8080/demo/
```

Because it loads the global build via a classic `<script>`, you can also just
**open `demo/index.html` directly** (double-click) after `npm run build` — no
server needed. It explores every variant, theming, queueing, async confirmation,
validation, and the mobile layout.

> Note: serve from the **project root**, not from inside `demo/`. The page
> references `../dist/...`, which lives one level up — serving the `demo/` folder
> as the web root would 404 those files and the buttons would do nothing.

### Examples

Runnable, minimal examples live in [`examples/`](./examples/):

| File | Run | |
| --- | --- | --- |
| `examples/plain-html.html` | double-click (or serve) | global build via `<script>`, works over `file://` |
| `examples/esm-module.html` | serve, then open `/examples/esm-module.html` | ES-module `import` (blocked over `file://`) |
| `examples/node-api.mjs` | `node examples/node-api.mjs` | verifies the export surface |

These same usage patterns are executed automatically in `tests/examples.test.js`.

### Distribution output

| File | Purpose |
| --- | --- |
| `dist/custom-dialog.esm.js` / `.esm.min.js` | ES module (readable / minified) |
| `dist/custom-dialog.cjs` | CommonJS (`require`) |
| `dist/custom-dialog.global.js` / `.global.min.js` | Browser IIFE → `window.CustomDialog` |
| `dist/custom-dialog.css` / `.min.css` | Stylesheet (separate, themeable) |
| `types/index.d.ts` | TypeScript declarations |

---

## License

[MIT](./LICENSE) © Michael Falk
