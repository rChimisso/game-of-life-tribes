import {RenderUniformInput, UNIFORM_SIZE} from '../model/render';

import {GridFormat} from '~gol/feature/home/model/grid-format';
import {Tribe} from '~gol/feature/home/model/rule';

/**
 * Packs the current render uniforms into one GPU-ready buffer payload.
 *
 * @param {RenderUniformInput} input render uniform inputs.
 * @returns {ArrayBuffer} packed uniform buffer payload.
 */
export function createRenderUniformData(input: RenderUniformInput): ArrayBuffer {
  const data = new ArrayBuffer(UNIFORM_SIZE);
  const f32 = new Float32Array(data);
  const i32 = new Int32Array(data);
  const u32 = new Uint32Array(data);
  const renderOffsetX = ((input.offsetX % input.grid.cols) + input.grid.cols) % input.grid.cols;
  const renderOffsetY = ((input.offsetY % input.grid.rows) + input.grid.rows) % input.grid.rows;
  const offsetCellX = Math.floor(renderOffsetX);
  const offsetCellY = Math.floor(renderOffsetY);
  f32[0] = input.canvasWidth;
  f32[1] = input.canvasHeight;
  f32[2] = input.scale;
  f32[4] = renderOffsetX - offsetCellX;
  f32[5] = renderOffsetY - offsetCellY;
  u32[6] = input.grid.cols;
  u32[7] = input.grid.rows;
  u32[8] = offsetCellX;
  u32[9] = offsetCellY;
  u32[10] = input.tribeCount;
  i32[12] = input.brushPreview.centerX;
  i32[13] = input.brushPreview.centerY;
  u32[14] = input.brushPreview.brushSize;
  u32[15] = input.brushPreview.shape;
  u32[16] = input.brushPreview.visible ? 1 : 0;
  return data;
}

/**
 * Packs the active tribe palette into the render lookup-buffer layout.
 *
 * @param {readonly Tribe[]} tribes active tribe palette.
 * @returns {Uint32Array} packed tribe-color lookup values.
 */
export function createTribeColorData(tribes: readonly Tribe[]): Uint32Array {
  const data = new Uint32Array(tribes.length);
  for (let index = 0; index < tribes.length; index++) {
    const hex = tribes[index]!.color;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    data[index] = r | (g << 8) | (b << 16);
  }
  return data;
}

/**
 * Specializes the render shader for the active packed-grid layout.
 *
 * @param {string} source render WGSL template.
 * @param {GridFormat} gridFormat active packed grid format.
 * @returns {string} specialized render WGSL source.
 */
export function generateRenderWgsl(source: string, gridFormat: GridFormat): string {
  return source
    .replace('__CELLS_PER_WORD__', `${gridFormat.cellsPerWord}u`)
    .replace('__WORD_SHIFT__', `${gridFormat.wordShift}u`)
    .replace('__CELL_SHIFT__', `${gridFormat.cellShift}u`)
    .replace('__CELL_INDEX_MASK__', `${gridFormat.cellIndexMask}u`)
    .replace('__CELL_MASK__', `${gridFormat.cellMask}u`);
}
