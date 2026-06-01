/**
 * Logical and physical workgroup counts for a remapped two-dimensional dispatch.
 *
 * @interface DispatchPlan2D
 * @typedef {DispatchPlan2D}
 */
export interface DispatchPlan2D {
  /**
   * Logical workgroup count along x.
   *
   * @type {number}
   */
  logicalWgX: number;
  /**
   * Logical workgroup count along y.
   *
   * @type {number}
   */
  logicalWgY: number;
  /**
   * Dispatched workgroup count along x.
   *
   * @type {number}
   */
  dispatchWgX: number;
  /**
   * Dispatched workgroup count along y.
   *
   * @type {number}
   */
  dispatchWgY: number;
  /**
   * Whether dispatch coordinates are remapped in shader code.
   *
   * @type {boolean}
   */
  remapped: boolean;
}
