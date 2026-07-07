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
