/**
 * Node/build-tool import example. Confirms the package's named + grouped exports
 * resolve from the built ESM bundle. Run: `node examples/node-api.mjs`
 *
 * (The dialogs themselves need a browser DOM to render — this only verifies the
 * import surface you would use in a bundled app.)
 */
import {
  customAlert,
  customConfirm,
  customPrompt,
  customToast,
  configureToasts,
  closeToast,
  getToast,
  closeAllToasts,
  CustomDialog,
} from '../dist/custom-dialog.esm.js';

const expect = (name, cond) => {
  if (!cond) throw new Error(`Export check failed: ${name}`);
  console.log(`  ✓ ${name}`);
};

console.log('customConfirmAlert export surface:');
expect('customAlert is a function', typeof customAlert === 'function');
expect('customConfirm is a function', typeof customConfirm === 'function');
expect('customPrompt is a function', typeof customPrompt === 'function');
expect('CustomDialog.alert === customAlert', CustomDialog.alert === customAlert);
expect('CustomDialog.confirm === customConfirm', CustomDialog.confirm === customConfirm);
expect('CustomDialog.prompt === customPrompt', CustomDialog.prompt === customPrompt);
expect('CustomDialog.queueSize is a number', typeof CustomDialog.queueSize === 'number');
expect('customToast is a function', typeof customToast === 'function');
expect('configureToasts is a function', typeof configureToasts === 'function');
expect('closeToast is a function', typeof closeToast === 'function');
expect('getToast is a function', typeof getToast === 'function');
expect('closeAllToasts is a function', typeof closeAllToasts === 'function');
expect('CustomDialog.toast === customToast', CustomDialog.toast === customToast);
expect('CustomDialog.closeAllToasts === closeAllToasts', CustomDialog.closeAllToasts === closeAllToasts);
console.log('\nAll exports resolve. In a browser:');
console.log("  const ok = await customConfirm({ title: 'Delete?', variant: 'danger' });");
console.log("  const t = customToast({ message: 'Saved', variant: 'success' });");
