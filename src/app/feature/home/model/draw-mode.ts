/**
 * Brush shape modes for draw operations.
 */
export type BrushShape = 'square' | 'round' | 'diamond' | 'vline' | 'hline';

/**
 * Ordered brush shape values used for validation and keyboard cycling.
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
 */
export type BrushFill = 'full' | 'spray' | 'outline';

/**
 * Ordered brush fill values used for UI options and keyboard cycling.
 */
export const BRUSH_FILL_VALUES: readonly BrushFill[] = ['full', 'spray', 'outline'];

/**
 * Touch interaction modes.
 */
export type TouchMode = 'draw' | 'pan';

/**
 * Ordered touch mode values.
 */
export const TOUCH_MODE_VALUES: readonly TouchMode[] = ['draw', 'pan'];
