/**
 * Brush dispatch queued from a pointer stroke.
 *
 * @interface PendingBrush
 * @typedef {PendingBrush}
 */
export interface PendingBrush {
  /**
   * Center x coordinate.
   *
   * @type {number}
   */
  centerX: number;
  /**
   * Center y coordinate.
   *
   * @type {number}
   */
  centerY: number;
  /**
   * Brush size in cells.
   *
   * @type {number}
   */
  brushSize: number;
  /**
   * Numeric brush shape.
   *
   * @type {number}
   */
  shape: number;
  /**
   * Numeric brush fill mode.
   *
   * @type {number}
   */
  fill: number;
  /**
   * Brush density percentage.
   *
   * @type {number}
   */
  density: number;
  /**
   * Numeric tribe IDs eligible for this brush.
   *
   * @type {number[]}
   */
  tribeIds: number[];
}

/**
 * One non-wrapping segment of a wrapped brush axis.
 *
 * @interface BrushDispatchAxisSegment
 * @typedef {BrushDispatchAxisSegment}
 */
export interface BrushDispatchAxisSegment {
  /**
   * Destination start coordinate in grid space.
   *
   * @type {number}
   */
  destinationStart: number;
  /**
   * Source start coordinate in brush-local space.
   *
   * @type {number}
   */
  localStart: number;
  /**
   * Number of logical cells covered by this segment.
   *
   * @type {number}
   */
  span: number;
}

/**
 * One non-wrapping brush rectangle dispatched to the GPU.
 *
 * @interface BrushDispatchRect
 * @typedef {BrushDispatchRect}
 */
export interface BrushDispatchRect {
  /**
   * Destination start x coordinate in grid space.
   *
   * @type {number}
   */
  destinationStartX: number;
  /**
   * Destination start y coordinate in grid space.
   *
   * @type {number}
   */
  destinationStartY: number;
  /**
   * Source start x coordinate in brush-local space.
   *
   * @type {number}
   */
  localStartX: number;
  /**
   * Source start y coordinate in brush-local space.
   *
   * @type {number}
   */
  localStartY: number;
  /**
   * Rectangle width in logical cells.
   *
   * @type {number}
   */
  spanCols: number;
  /**
   * Rectangle height in logical cells.
   *
   * @type {number}
   */
  spanRows: number;
}

/**
 * Brush footprint preview shown during drawing.
 *
 * @interface BrushPreview
 * @typedef {BrushPreview}
 */
export interface BrushPreview {
  /**
   * Center x coordinate.
   *
   * @type {number}
   */
  centerX: number;
  /**
   * Center y coordinate.
   *
   * @type {number}
   */
  centerY: number;
  /**
   * Brush size in cells.
   *
   * @type {number}
   */
  brushSize: number;
  /**
   * Numeric brush shape.
   *
   * @type {number}
   */
  shape: number;
  /**
   * Whether the preview should render.
   *
   * @type {boolean}
   */
  visible: boolean;
}
