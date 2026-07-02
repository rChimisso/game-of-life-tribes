import {RenderUniformInput, UNIFORM_SIZE} from '../model/render';

import {GridTopology} from '~gol/feature/home/model/grid';
import {GridFormat} from '~gol/feature/home/model/grid-format';
import {BOUNDED_GRID_TOPOLOGY, Tribe} from '~gol/feature/home/model/rule';

/**
 * Returns the topology-specific signed cell-distance body.
 *
 * @param {GridTopology} topology active grid topology.
 * @returns {string} WGSL function body.
 */
function signedGridDeltaBody(topology: GridTopology): string {
  return topology === BOUNDED_GRID_TOPOLOGY ? '  return i32(cell) - center;' : '  return signedWrapDelta(cell, center, size);';
}

/**
 * Returns the topology-specific signed world-distance body.
 *
 * @param {GridTopology} topology active grid topology.
 * @returns {string} WGSL function body.
 */
function signedGridWorldDeltaBody(topology: GridTopology): string {
  return topology === BOUNDED_GRID_TOPOLOGY ? '  return world - f32(center);' : '  return signedWrapWorldDelta(world, center, size);';
}

/**
 * Returns topology-specific fragment coordinate mapping.
 *
 * @param {GridTopology} topology active grid topology.
 * @returns {string} WGSL statements.
 */
function gridCoordinateAssignments(topology: GridTopology): string {
  return topology === BOUNDED_GRID_TOPOLOGY ?
    '  let ix = min(u.grid_size.x - 1u, u.offset_cell.x + u32(local.x));\n  let iy = min(u.grid_size.y - 1u, u.offset_cell.y + u32(local.y));' :
    '  let ix = wrapAdd(u.offset_cell.x, u32(local.x), u.grid_size.x);\n  let iy = wrapAdd(u.offset_cell.y, u32(local.y), u.grid_size.y);';
}

/**
 * Returns topology-specific visual export overlay rendering.
 *
 * @param {GridTopology} topology active grid topology.
 * @returns {string} WGSL statements.
 */
function exportOverlayBlock(topology: GridTopology): string {
  const cornerMask = topology === BOUNDED_GRID_TOPOLOGY ? 'exportBoundedCornerMarkerMask(local)' : 'exportOriginMarkerMask(local)';
  const cornerOutlineMask = topology === BOUNDED_GRID_TOPOLOGY ? 'exportBoundedCornerMarkerOutlineMask(local)' : 'exportOriginMarkerOutlineMask(local)';
  return `  if (u.export_visible == 1u) {
    if (exportCenterMarkerMask(local) || ${cornerMask}) {
      return vec4f(0.0, 0.0, 0.0, 1.0);
    }

    if (exportCenterMarkerOutlineMask(local) || ${cornerOutlineMask}) {
      return vec4f(0.82, 0.84, 0.86, 1.0);
    }
  }`;
}

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
  const renderOffsetX = input.topology === BOUNDED_GRID_TOPOLOGY ? input.offsetX : ((input.offsetX % input.grid.cols) + input.grid.cols) % input.grid.cols;
  const renderOffsetY = input.topology === BOUNDED_GRID_TOPOLOGY ? input.offsetY : ((input.offsetY % input.grid.rows) + input.grid.rows) % input.grid.rows;
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
  u32[17] = input.exportFrameOverlay.originX;
  u32[18] = input.exportFrameOverlay.originY;
  u32[19] = input.exportFrameOverlay.visible ? 1 : 0;
  u32[20] = input.topology === BOUNDED_GRID_TOPOLOGY ? 1 : 0;
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
 * Specializes the render shader for the active packed-grid layout and topology.
 *
 * @param {string} source render WGSL template.
 * @param {GridFormat} gridFormat active packed grid format.
 * @param {GridTopology} topology active grid topology.
 * @returns {string} specialized render WGSL source.
 */
export function generateRenderWgsl(source: string, gridFormat: GridFormat, topology: GridTopology): string {
  return source
    .replace('__CELLS_PER_WORD__', `${gridFormat.cellsPerWord}u`)
    .replace('__WORD_SHIFT__', `${gridFormat.wordShift}u`)
    .replace('__CELL_SHIFT__', `${gridFormat.cellShift}u`)
    .replace('__CELL_INDEX_MASK__', `${gridFormat.cellIndexMask}u`)
    .replace('__CELL_MASK__', `${gridFormat.cellMask}u`)
    .replace('__SIGNED_GRID_DELTA_BODY__', signedGridDeltaBody(topology))
    .replace('__SIGNED_GRID_WORLD_DELTA_BODY__', signedGridWorldDeltaBody(topology))
    .replace('__GRID_COORDINATE_ASSIGNMENTS__', gridCoordinateAssignments(topology))
    .replace('__EXPORT_OVERLAY_BLOCK__', exportOverlayBlock(topology));
}
