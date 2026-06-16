import {ExportFrameOrigin} from '~gol/feature/home/model/export-frame-origin';

/**
 * PNG frame export progress callback.
 *
 * @param {number} rowsProcessed rows encoded for the current frame.
 * @param {number} rowsTotal rows in the current frame.
 */
export type PngFrameProgressReporter = (rowsProcessed: number, rowsTotal: number) => void;

/**
 * Options for PNG frame ZIP export.
 *
 * @interface PngFrameExportOptions
 * @typedef {PngFrameExportOptions}
 */
export interface PngFrameExportOptions {
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
  /**
   * Wrapped full-grid origin for PNG visual exports.
   *
   * @type {?(ExportFrameOrigin | null)}
   */
  exportFrameOrigin?: ExportFrameOrigin | null;
}
