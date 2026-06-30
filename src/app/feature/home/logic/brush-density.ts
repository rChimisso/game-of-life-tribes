import {MAX_BRUSH_DENSITY, MIN_BRUSH_DENSITY} from '../model/draw-mode';

/**
 * Clamps a brush density percentage to the supported integer range.
 *
 * @param {number} density raw density percentage.
 * @returns {number} clamped density percentage.
 */
export function clampBrushDensity(density: number): number {
  return Math.min(Math.max(MIN_BRUSH_DENSITY, Math.floor(+density || MIN_BRUSH_DENSITY)), MAX_BRUSH_DENSITY);
}
