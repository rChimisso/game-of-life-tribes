import {BrushFill, BrushShape, TouchMode} from '~gol/feature/home/model/draw-mode';

/**
 * Two-dimensional point used by engine input logic.
 *
 * @interface EnginePoint
 * @typedef {EnginePoint}
 */
export interface EnginePoint {
  /**
   * Horizontal coordinate.
   *
   * @type {number}
   */
  x: number;
  /**
   * Vertical coordinate.
   *
   * @type {number}
   */
  y: number;
}

/**
 * Brush state read by the engine input controller.
 *
 * @interface EngineBrushSettings
 * @typedef {EngineBrushSettings}
 */
export interface EngineBrushSettings {
  /**
   * Brush size in cells.
   *
   * @type {number}
   */
  size: number;
  /**
   * Brush footprint shape.
   *
   * @type {BrushShape}
   */
  shape: BrushShape;
  /**
   * Brush fill mode.
   *
   * @type {BrushFill}
   */
  fill: BrushFill;
  /**
   * Brush density percentage.
   *
   * @type {number}
   */
  density: number;
  /**
   * Tribe IDs selected for drawing.
   *
   * @type {string[]}
   */
  tribes: string[];
}

/**
 * Active engine pointer interaction mode.
 *
 * @typedef {EngineInteractionMode}
 */
export type EngineInteractionMode = 'idle' | TouchMode | 'pinch';
