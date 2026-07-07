import {MIN_BRUSH_SIZE} from '../model/brush-size';
import {Grid} from '../model/grid';

/**
 * Calculates the maximum legal brush size for a grid.
 *
 * @param {Pick<Grid, 'cols' | 'rows'>} grid active grid size.
 * @returns {number} maximum brush size.
 */
export function maxBrushSize(grid: Pick<Grid, 'cols' | 'rows'>): number {
  return Math.max(MIN_BRUSH_SIZE, Math.floor(Math.min(grid.cols, grid.rows) / 4));
}

/**
 * Normalizes a scalar brush size before grid-dependent max clamping.
 *
 * @param {number} size brush size.
 * @returns {number} normalized brush size.
 */
export function normalizeBrushSize(size: number): number {
  return Math.max(MIN_BRUSH_SIZE, Math.floor(size));
}

/**
 * Clamps a brush size to the legal range for a grid.
 *
 * @param {number} size brush size.
 * @param {Pick<Grid, 'cols' | 'rows'>} grid active grid size.
 * @returns {number} clamped brush size.
 */
export function clampBrushSize(size: number, grid: Pick<Grid, 'cols' | 'rows'>): number {
  return Math.min(maxBrushSize(grid), normalizeBrushSize(size));
}
