import {ExportFrameOrigin} from '../model/export-frame-origin';

/**
 * Wraps an export frame origin to the provided grid dimensions.
 *
 * @param {ExportFrameOrigin} origin candidate origin.
 * @param {{cols: number; rows: number}} grid grid dimensions.
 * @param {number} grid.cols grid columns.
 * @param {number} grid.rows grid rows.
 * @returns {ExportFrameOrigin} wrapped export origin.
 */
export function wrapExportFrameOrigin(origin: ExportFrameOrigin, grid: {cols: number; rows: number}): ExportFrameOrigin {
  return {
    originX: ((origin.originX % grid.cols) + grid.cols) % grid.cols,
    originY: ((origin.originY % grid.rows) + grid.rows) % grid.rows
  };
}
