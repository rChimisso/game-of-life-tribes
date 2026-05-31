import {BrushPreview} from './brush';
import {Grid} from '../../../model/grid';

/**
 * Maximum number of tribe colors stored in the render lookup buffer.
 */
export const MAX_TRIBES = 256;

/**
 * Byte size of the render uniform buffer.
 */
export const UNIFORM_SIZE = 80;

/**
 * Byte size of the tribe-color lookup buffer.
 */
export const TRIBE_COLOR_BUFFER_SIZE = MAX_TRIBES * Uint32Array.BYTES_PER_ELEMENT;

/**
 * Input values required to pack one render uniform payload.
 *
 * @interface RenderUniformInput
 * @typedef {RenderUniformInput}
 */
export interface RenderUniformInput {
  /**
   * Canvas width in device pixels.
   *
   * @type {number}
   */
  canvasWidth: number;
  /**
   * Canvas height in device pixels.
   *
   * @type {number}
   */
  canvasHeight: number;
  /**
   * Current camera zoom factor.
   *
   * @type {number}
   */
  scale: number;
  /**
   * Current camera x offset in cell space.
   *
   * @type {number}
   */
  offsetX: number;
  /**
   * Current camera y offset in cell space.
   *
   * @type {number}
   */
  offsetY: number;
  /**
   * Logical grid dimensions.
   *
   * @type {Grid}
   */
  grid: Grid;
  /**
   * Number of active tribes.
   *
   * @type {number}
   */
  tribeCount: number;
  /**
   * Current brush preview state.
   *
   * @type {BrushPreview}
   */
  brushPreview: BrushPreview;
}
