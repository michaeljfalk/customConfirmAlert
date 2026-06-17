/**
 * @file Sequential dialog queue. Guarantees exactly one dialog is on screen at a
 * time; concurrent requests are shown one after another in call order.
 */

/**
 * @typedef {() => Promise<unknown>} DialogRunner
 * A function that opens a dialog and resolves when that dialog has fully closed.
 */

export class DialogQueue {
  constructor() {
    /** @type {{ runner: DialogRunner, resolve: (v: any) => void, reject: (e: any) => void }[]} */
    this.pending = [];
    /** @type {boolean} */
    this.processing = false;
  }

  /**
   * Enqueue a dialog. The returned promise settles with whatever `runner`
   * resolves to (the dialog result).
   * @param {DialogRunner} runner
   * @returns {Promise<any>}
   */
  enqueue(runner) {
    return new Promise((resolve, reject) => {
      this.pending.push({ runner, resolve, reject });
      this.process();
    });
  }

  /** @returns {number} Number of dialogs waiting (excluding the active one). */
  get size() {
    return this.pending.length;
  }

  async process() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.pending.length > 0) {
        const item = /** @type {typeof this.pending[number]} */ (this.pending.shift());
        try {
          const result = await item.runner();
          item.resolve(result);
        } catch (err) {
          // A runner should not normally reject, but never wedge the queue.
          item.reject(err);
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

/** Shared queue instance for the public API. */
export const dialogQueue = new DialogQueue();
