# Changelog

All notable changes to **customConfirmAlert** (npm: `customconfirmalert`) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `examples/toasts.html` — a standalone, `file://`-openable toast example covering
  variants, positions, timing, in-place updates, actions, and overflow.
- This `CHANGELOG.md`.

## [1.1.1] — 2026-06-17

Docs-only release. The code is byte-for-byte identical to 1.1.0; republished so the
npm package page reflects the updated README.

### Documentation
- Document the required host-page viewport meta (`viewport-fit=cover`) for safe-area insets.
- Document the virtual-keyboard limitation (no `visualViewport`/`keyboard-inset-*` handling).
- Add consolidated **Limitations** and **Versioning & compatibility** sections.
- Note that `toast.update({ position })` is ignored and that `maxVisible` is per position.

## [1.1.0] — 2026-06-17

### Added — Toast notification system
A second, architecturally separate, non-modal UI system alongside the modal dialogs.
Toasts never lock scrolling, inert content, trap/steal focus, or use the dialog queue,
and can be visible at the same time as a dialog.

- **API:** `customToast(options)` returning a controller `{ id, update, close, isOpen }`,
  plus `configureToasts`, `closeToast`, `getToast`, `closeAllToasts`. All available as
  named exports and on the grouped `CustomDialog` object (and `window.CustomDialog`).
- **Variants:** `info`, `success`, `warning`, `danger`, `neutral`.
- **Positions:** six positions, each with its own lazily-created container.
- **Animations:** `slide-down/up/left/right`, `fade`, `scale`, `none`, and `auto`
  (derives the natural motion from the position); transform/opacity only; respects
  `prefers-reduced-motion`; safe timeout fallback so cleanup never depends on
  `transitionend` firing.
- **Timing:** timed and persistent toasts; the dismiss timer starts only after the toast
  has visibly entered; `persistent` overrides `duration`.
- **`update()`** mutates in place with documented timing rules (new `duration` restarts,
  `persistent: true` stops, `persistent: false` begins the timer).
- **ID deduplication:** a repeat call with the same `id` updates in place and returns the
  existing controller (no duplicates).
- **Pause/resume:** on hover, focus, hidden tab, swipe, and async actions, with
  multi-reason tracking; resumes with the actual remaining time.
- **Progress indicator** (`showProgress`) that pauses/resumes with the timer.
- **One async action button** with loading state, duplicate-activation prevention, and a
  safe error/retry state on failure (no raw stack traces).
- **Stacking limits:** `maxVisible` per position with `queue` / `dismiss-oldest` /
  `dismiss-newest` overflow policies.
- **Swipe-to-dismiss** via Pointer Events (`touch-action: pan-y`), with distance/velocity
  threshold and snap-back; disable per toast with `swipeToDismiss: false`.
- **Accessibility:** per-toast `role="status"`/`alert` live regions, `aria-atomic`,
  accessible labels, visible focus; never traps/steals focus or inerts the page.
- **Theming:** new `--custom-toast-*` tokens reusing the dialog tokens; dark mode,
  reduced motion, `forced-colors`, mobile full-width sheets, and safe-area insets.
- TypeScript declarations for all toast types; expanded demo; new `tests/toast.test.js`.

### Changed
- Extracted the shared variant/spinner/close icons into `src/icons.js`; `dialog.js` now
  imports them (no behavioural change).

### Compatibility
- Purely additive and backward compatible — existing `customAlert`/`customConfirm`/
  `customPrompt` and `CustomDialog.{alert,confirm,prompt}` are unchanged.

## [1.0.1] — 2026-06-17

### Fixed
- Demo now works standalone: switched to the classic global build so it runs by opening
  the file directly (`file://`) and added `npm run demo` (serves from the project root).

### Added
- `examples/` folder (`plain-html.html`, `esm-module.html`, `node-api.mjs`) shipped in the
  package, plus `tests/examples.test.js` executing the documented usage patterns.
- GitHub Actions publish workflow.

## [1.0.0] — 2026-06-17

### Added
- Initial release: Promise-based, dependency-free, framework-agnostic modal dialogs that
  replace the visual role of `alert()` / `confirm()` / `prompt()` without overriding the
  native globals.
- `customAlert`, `customConfirm`, `customPrompt`, and the grouped `CustomDialog` API.
- Four variants, sequential queue (no stacking, no double-resolve), async `onConfirm` with
  loading/error/retry, sync & async prompt validation.
- Accessibility: `role`/`aria-*`, focus trap + restoration, background `inert`, Escape/Tab/
  Enter handling, visible focus, reduced-motion and high-contrast support.
- Mobile-safe scroll lock, theming via CSS custom properties (light/dark/auto), ESM/CJS/IIFE
  + minified builds, separate CSS, and TypeScript declarations.

[Unreleased]: https://github.com/michaeljfalk/customConfirmAlert/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/michaeljfalk/customConfirmAlert/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/michaeljfalk/customConfirmAlert/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/michaeljfalk/customConfirmAlert/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/michaeljfalk/customConfirmAlert/releases/tag/v1.0.0
