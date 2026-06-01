import {Mp4OutputSize} from '../model/mp4-types';

/**
 * Small-grid reference dimension used for integer upscaling.
 *
 * @type {number}
 */
const MP4_SMALL_GRID_REFERENCE_DIMENSION = 1080;

/**
 * Minimum MP4 output dimension before codec-safe even adjustment.
 *
 * @type {number}
 */
const MP4_MIN_OUTPUT_DIMENSION = 3;

/**
 * Maximum MP4 output width and height.
 *
 * @type {number}
 */
export const MP4_MAX_OUTPUT_DIMENSION = 4096;

/**
 * Resolves MP4 output dimensions from source grid dimensions.
 *
 * @param {number} cols source grid columns.
 * @param {number} rows source grid rows.
 * @param {boolean} evenRequired whether dimensions must be even.
 * @returns {Mp4OutputSize} resolved MP4 output size.
 */
export function resolveMp4OutputSize(cols: number, rows: number, evenRequired: boolean): Mp4OutputSize {
  let width = cols;
  let height = rows;
  let xClamped = false;
  let yClamped = false;
  if (cols <= MP4_MAX_OUTPUT_DIMENSION && rows <= MP4_MAX_OUTPUT_DIMENSION) {
    const maxSide = Math.max(cols, rows);
    if (maxSide < MP4_SMALL_GRID_REFERENCE_DIMENSION) {
      const maxUniformScale = Math.floor(MP4_MAX_OUTPUT_DIMENSION / maxSide);
      const referenceScale = Math.floor(MP4_SMALL_GRID_REFERENCE_DIMENSION / maxSide);
      const uniformScale = Math.max(1, Math.min(maxUniformScale, referenceScale));
      width = cols * uniformScale;
      height = rows * uniformScale;
    }
  } else {
    width = Math.min(cols, MP4_MAX_OUTPUT_DIMENSION);
    height = Math.min(rows, MP4_MAX_OUTPUT_DIMENSION);
    xClamped = cols > MP4_MAX_OUTPUT_DIMENSION;
    yClamped = rows > MP4_MAX_OUTPUT_DIMENSION;
  }

  width = Math.max(MP4_MIN_OUTPUT_DIMENSION, width);
  height = Math.max(MP4_MIN_OUTPUT_DIMENSION, height);
  if (evenRequired) {
    width += width % 2;
    height += height % 2;
  }

  return {
    sourceCols: cols,
    sourceRows: rows,
    width,
    height,
    xScale: cols / width,
    yScale: rows / height,
    xClamped,
    yClamped
  };
}
