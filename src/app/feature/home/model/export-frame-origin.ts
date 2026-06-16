/**
 * Frozen toroidal origin used to unwrap full-grid visual exports.
 *
 * @interface ExportFrameOrigin
 * @typedef {ExportFrameOrigin}
 */
export interface ExportFrameOrigin {
  /**
   * Wrapped source column used as the exported frame's left edge.
   *
   * @type {number}
   */
  originX: number;
  /**
   * Wrapped source row used as the exported frame's top edge.
   *
   * @type {number}
   */
  originY: number;
}

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
