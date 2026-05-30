/**
 * PNG frame export progress callback.
 *
 * @export
 * @param {number} rowsProcessed rows encoded for the current frame.
 * @param {number} rowsTotal rows in the current frame.
 */
type PngFrameProgressReporter = (rowsProcessed: number, rowsTotal: number) => void;

/**
 * Options for PNG frame ZIP export.
 *
 * @export
 * @interface PngFrameExportOptions
 * @typedef {PngFrameExportOptions}
 */
interface PngFrameExportOptions {
  /**
   * Returns whether the active download has been cancelled.
   *
   * @type {() => boolean}
   */
  shouldCancel: () => boolean;
  /**
   * Registers a listener for active download cancellation.
   *
   * @type {(listener: () => void) => () => void}
   */
  onCancelRequested: (listener: () => void) => () => void;
}

export type {PngFrameExportOptions, PngFrameProgressReporter};
