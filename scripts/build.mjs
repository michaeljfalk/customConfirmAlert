/**
 * Build script — produces every distribution artifact from src/index.js using
 * esbuild. No application code depends on esbuild at runtime; it is dev-only.
 *
 * Outputs (in dist/):
 *   custom-dialog.esm.js          ESM, readable
 *   custom-dialog.esm.min.js      ESM, minified
 *   custom-dialog.cjs             CommonJS (require)
 *   custom-dialog.global.js       IIFE → window.CustomDialog (+ named on it)
 *   custom-dialog.global.min.js   IIFE, minified
 *   custom-dialog.css             copied from src
 */

import { build } from 'esbuild';
import { mkdir, copyFile, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const entry = join(src, 'index.js');

const banner = {
  js: '/*! customConfirmAlert v1.0.0 | MIT License | https://github.com/michaeljfalk/customConfirmAlert */',
};

/** Footer for the IIFE build: expose named exports on window.CustomDialog and
 *  set the default export as window.CustomDialog without leaking other globals. */
const globalName = '__customConfirmAlert__';

async function run() {
  await mkdir(dist, { recursive: true });

  const common = { entryPoints: [entry], bundle: true, banner, logLevel: 'info', target: ['es2019'] };

  // ESM
  await build({ ...common, format: 'esm', outfile: join(dist, 'custom-dialog.esm.js') });
  await build({ ...common, format: 'esm', minify: true, outfile: join(dist, 'custom-dialog.esm.min.js') });

  // CommonJS
  await build({ ...common, format: 'cjs', outfile: join(dist, 'custom-dialog.cjs') });

  // IIFE → a single global object that carries every named export.
  const iifeFooter = {
    js: `window.CustomDialog = Object.assign(${globalName}.CustomDialog, {
  customAlert: ${globalName}.customAlert,
  customConfirm: ${globalName}.customConfirm,
  customPrompt: ${globalName}.customPrompt
});
try { window.${globalName} = void 0; } catch (e) {}`,
  };
  await build({
    ...common,
    format: 'iife',
    globalName,
    footer: iifeFooter,
    outfile: join(dist, 'custom-dialog.global.js'),
  });
  await build({
    ...common,
    format: 'iife',
    globalName,
    footer: iifeFooter,
    minify: true,
    outfile: join(dist, 'custom-dialog.global.min.js'),
  });

  // CSS (plain copy + minified copy via esbuild's CSS pipeline).
  await copyFile(join(src, 'custom-dialog.css'), join(dist, 'custom-dialog.css'));
  await build({
    entryPoints: [join(src, 'custom-dialog.css')],
    minify: true,
    outfile: join(dist, 'custom-dialog.min.css'),
    logLevel: 'info',
  });

  // Re-export the hand-written declaration so `dist` is self-contained too.
  await writeFile(
    join(dist, 'custom-dialog.d.ts'),
    "export * from '../types/index.d.ts';\nexport { default } from '../types/index.d.ts';\n",
  );

  await report();
}

async function report() {
  const files = (await readdir(dist)).sort();
  console.log('\nBundle sizes:');
  for (const f of files) {
    const s = await stat(join(dist, f));
    const kb = (s.size / 1024).toFixed(2);
    console.log(`  ${f.padEnd(32)} ${kb.padStart(8)} KB`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
