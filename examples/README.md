# Examples

Runnable examples that use the **built `dist/` files**. Build first:

```bash
npm run build
```

| File | How to run | Notes |
| --- | --- | --- |
| [`plain-html.html`](./plain-html.html) | **Double-click it** (or serve) | Classic `<script>` + global build → works over `file://`. |
| [`esm-module.html`](./esm-module.html) | **Serve**, then open `/examples/esm-module.html` | Uses ES-module `import`; browsers block modules over `file://`. |
| [`node-api.mjs`](./node-api.mjs) | `node examples/node-api.mjs` | Verifies the import/export surface (no DOM rendering). |

### Serving

ES-module pages must be served from the **project root** (so `../dist/...` resolves):

```bash
npm run demo     # builds, then serves project root at http://localhost:8080
# open http://localhost:8080/examples/esm-module.html
```

Any static server rooted at the project directory works too
(`python3 -m http.server`, etc.). Do **not** serve the `examples/` folder itself
as the root — the pages reference `../dist`, which lives one level up.

### The same patterns, automatically tested

`../tests/examples.test.js` executes these usage patterns (string shorthand,
delete-confirm, async `onConfirm` with retry, prompt validation, grouped API,
the native-`confirm()` migration shape) against a jsdom DOM, so the documented
examples can't silently break.
