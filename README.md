# customConfirmAlert

A small, polished, **accessible**, **themeable**, **dependency-free** replacement for the *visual* role of `alert()`, `confirm()`, and `prompt()`.

- ✅ Native JS / HTML / CSS — **no runtime dependencies**, no framework code in core
- ✅ **Promise-based** API (`customAlert`, `customConfirm`, `customPrompt`)
- ✅ Works in plain HTML, Meteor + Blaze, React, Vue, Svelte, Express-rendered, and static sites
- ✅ Accessible by default: focus trap, focus restoration, `role`/`aria-*`, `inert`, Escape/Tab/Enter, reduced-motion & high-contrast support
- ✅ Sequential **queue** — only one dialog at a time, no stacking, no double-resolve
- ✅ Async `onConfirm` with loading state, error display, and retry
- ✅ Light/dark/auto themes via CSS custom properties; per-project and per-dialog overrides
- 🚫 **Does not** override `window.alert` / `window.confirm` / `window.prompt`

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
