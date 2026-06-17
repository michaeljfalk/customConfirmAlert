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

export interface CustomDialogApi {
  alert: typeof customAlert;
  confirm: typeof customConfirm;
  prompt: typeof customPrompt;
  /** Number of dialogs currently waiting in the queue. */
  readonly queueSize: number;
}

/** Grouped API mirroring the named exports. */
export const CustomDialog: CustomDialogApi;

export default CustomDialog;
