// Type declarations for customConfirmAlert (source is JavaScript).

export type DialogVariant = 'info' | 'success' | 'warning' | 'danger';
export type DefaultFocus = 'confirm' | 'cancel' | 'input' | 'none';

export interface DialogOptions {
  /** Heading; used as the dialog's accessible name (aria-labelledby). */
  title?: string;
  /** Body text, or a DOM Node / DocumentFragment for safe rich content. */
  message?: string | Node;
  /** Confirm/primary button label. Default: "OK". */
  confirmText?: string;
  /** Cancel button label (confirm/prompt only). Default: "Cancel". */
  cancelText?: string;
  /** Visual + semantic variant. Default: "info". */
  variant?: DialogVariant;
  /** Custom icon (emoji/text string or DOM Node), or `false` to hide it. */
  icon?: string | Node | false;
  /** Show the close (×) button. Default: true. */
  dismissible?: boolean;
  /** Allow Escape to cancel. Default: true. */
  closeOnEscape?: boolean;
  /** Allow a backdrop click to cancel. Default: false. */
  closeOnBackdrop?: boolean;
  /** Which control receives initial focus. Danger confirms default to "cancel". */
  defaultFocus?: DefaultFocus;
  /** Prompt only: the input's `type` attribute. Default: "text". */
  inputType?: string;
  /** Prompt only: visible label text for the input. */
  inputLabel?: string;
  /** Prompt only: input placeholder. */
  placeholder?: string;
  /** Prompt only: initial input value. */
  defaultValue?: string;
  /**
   * Validate before confirming. Return `true`/`undefined` for valid, a string
   * to show as an error message, or `false` for a generic error. May be async.
   */
  validate?: (value: any) => boolean | string | void | Promise<boolean | string | void>;
  /**
   * Optional async work to run on confirm. While it runs, controls are disabled
   * and a loading state is shown. If it throws, the dialog stays open and shows
   * the error so the user can retry or cancel.
   */
  onConfirm?: (value: any) => void | Promise<void>;
  /** Render `title`/`message` strings as HTML. Caller MUST sanitise. Default: false. */
  allowHtml?: boolean;
  /** Extra class name added to the dialog element (per-dialog theming). */
  className?: string;
  /** Accessible name when no `title` is provided. */
  ariaLabel?: string;
  /** Accessible label for the close button. Default: "Close". */
  closeLabel?: string;
  /** Generic message used when `validate` returns `false`. */
  invalidMessage?: string;
}

/** Show an informational alert with a single dismiss button. */
export function customAlert(options: DialogOptions | string): Promise<void>;

/**
 * Ask the user to confirm. Resolves `true` on confirm, `false` otherwise.
 * With `onConfirm`, resolves `true` only after that callback succeeds.
 */
export function customConfirm(options: DialogOptions | string): Promise<boolean>;

/** Prompt for a string. Resolves the entered value, or `null` if cancelled. */
export function customPrompt(options: DialogOptions | string): Promise<string | null>;

/* ============================ Toast notifications ========================== */

export type ToastVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type ToastAnimation =
  | 'auto'
  | 'slide-down'
  | 'slide-up'
  | 'slide-left'
  | 'slide-right'
  | 'fade'
  | 'scale'
  | 'none';

export type ToastOverflow = 'queue' | 'dismiss-oldest' | 'dismiss-newest';

export interface ToastController {
  readonly id: string;
  /** Update the toast in place. Returns the same controller (chainable). */
  update(options: Partial<ToastOptions>): ToastController;
  /** Resolves after the exit animation and cleanup complete. */
  close(): Promise<void>;
  isOpen(): boolean;
}

export interface ToastAction {
  label: string;
  /** Label shown while an async action runs. */
  pendingLabel?: string;
  /** Close the toast when the action resolves. Default: true. */
  closeOnSuccess?: boolean;
  onClick?: () => void | Promise<void>;
}

export interface ToastOptions {
  /** Stable id; a repeat call with the same id updates in place (no duplicate). */
  id?: string;
  title?: string;
  /** Body text, or a DOM Node / DocumentFragment for safe rich content. */
  message?: string | Node;
  variant?: ToastVariant;
  /** Custom icon (string/Node), or `false` to hide it. */
  icon?: string | Node | false;
  position?: ToastPosition;
  /** Auto-dismiss after N ms. Ignored while `persistent` is true. */
  duration?: number;
  /** Stay until closed or updated; overrides `duration`. */
  persistent?: boolean;
  dismissible?: boolean;
  pauseOnHover?: boolean;
  pauseOnFocus?: boolean;
  showProgress?: boolean;
  swipeToDismiss?: boolean;
  action?: ToastAction;
  closeLabel?: string;
  enterAnimation?: ToastAnimation;
  exitAnimation?: ToastAnimation;
  ariaLive?: 'polite' | 'assertive' | 'off';
  /** Render `title`/`message` strings as HTML. Caller MUST sanitise. Default: false. */
  allowHtml?: boolean;
  className?: string;
  /** Arbitrary caller data, passed through untouched. */
  data?: any;
  onOpen?: () => void;
  onClose?: () => void;
  onAction?: () => void | Promise<void>;
}

export interface ToastConfig {
  /** Max toasts visible per position before overflow applies. Default: 5. */
  maxVisible?: number;
  /** What to do when the visible limit is reached. Default: 'queue'. */
  overflow?: ToastOverflow;
  defaultPosition?: ToastPosition;
  defaultDuration?: number;
}

/** Show a non-blocking toast notification. */
export function customToast(options: ToastOptions | string): ToastController;

/** Configure global toast behaviour (limits, overflow policy, defaults). */
export function configureToasts(config: ToastConfig): Required<ToastConfig>;

/** Close a toast by id. */
export function closeToast(id: string): Promise<void>;

/** Get the controller for a live toast by id, or null. */
export function getToast(id: string): ToastController | null;

/** Close all toasts, optionally filtered by position and/or variant. */
export function closeAllToasts(filter?: { position?: ToastPosition; variant?: ToastVariant }): Promise<void>;

export interface CustomDialogApi {
  // Modal dialogs
  alert: typeof customAlert;
  confirm: typeof customConfirm;
  prompt: typeof customPrompt;
  /** Number of dialogs currently waiting in the queue. */
  readonly queueSize: number;
  // Toast notifications
  toast: typeof customToast;
  configureToasts: typeof configureToasts;
  closeToast: typeof closeToast;
  getToast: typeof getToast;
  closeAllToasts: typeof closeAllToasts;
}

/** Grouped API mirroring the named exports. */
export const CustomDialog: CustomDialogApi;

export default CustomDialog;
