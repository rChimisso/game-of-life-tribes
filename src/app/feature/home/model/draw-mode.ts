/**
 * Brush shape modes for draw operations.
 *
 * @typedef {BrushShape}
 */
export type BrushShape = 'square' | 'round' | 'diamond' | 'vline' | 'hline';

/**
 * Ordered brush shape values used for validation and keyboard cycling.
 *
 * @type {readonly BrushShape[]}
 */
export const BRUSH_SHAPE_VALUES: readonly BrushShape[] = [
  'square',
  'round',
  'diamond',
  'vline',
  'hline'
];

/**
 * Brush fill modes for draw operations.
 *
 * @typedef {BrushFill}
 */
export type BrushFill = 'full' | 'spray' | 'outline';

/**
 * Ordered brush fill values used for UI options and keyboard cycling.
 *
 * @type {readonly BrushFill[]}
 */
export const BRUSH_FILL_VALUES: readonly BrushFill[] = ['full', 'spray', 'outline'];

/**
 * Brush density settings keyed by fill mode.
 *
 * @typedef {Record<BrushFill, number>} BrushDensityByFill
 */
export type BrushDensityByFill = Record<BrushFill, number>;

/**
 * Minimum brush density percentage.
 *
 * @type {number}
 */
export const MIN_BRUSH_DENSITY = 1;

/**
 * Maximum brush density percentage.
 *
 * @type {number}
 */
export const MAX_BRUSH_DENSITY = 100;

/**
 * Default brush density percentages keyed by fill mode.
 *
 * @type {BrushDensityByFill}
 */
export const DEFAULT_BRUSH_DENSITY_BY_FILL: BrushDensityByFill = {
  full: MAX_BRUSH_DENSITY,
  spray: 50,
  outline: MAX_BRUSH_DENSITY
};

/**
 * Touch interaction modes.
 *
 * @typedef {TouchMode}
 */
export type TouchMode = 'draw' | 'pan';

/**
 * Ordered touch mode values.
 *
 * @type {readonly TouchMode[]}
 */
export const TOUCH_MODE_VALUES: readonly TouchMode[] = ['draw', 'pan'];
