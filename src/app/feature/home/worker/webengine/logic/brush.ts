import {BrushDispatchAxisSegment, BrushDispatchRect} from '../model/brush';

import {Grid} from '~gol/feature/home/model/grid';
import {GridFormat} from '~gol/feature/home/model/grid-format';

/**
 * Splits one brush axis into non-wrapping destination segments.
 *
 * @param {number} center brush center on the target axis.
 * @param {number} brushSize brush size in logical cells.
 * @param {number} limit grid extent on the target axis.
 * @returns {BrushDispatchAxisSegment[]} one or two non-wrapping segments.
 */
function createBrushAxisSegments(center: number, brushSize: number, limit: number): BrushDispatchAxisSegment[] {
  const half = Math.floor((brushSize - 1) / 2);
  const rawStart = center - half;
  const rawEndExclusive = rawStart + brushSize;
  const segments: BrushDispatchAxisSegment[] = [];
  if (rawStart >= 0 && rawEndExclusive <= limit) {
    segments.push({
      destinationStart: rawStart,
      localStart: 0,
      span: brushSize
    });
  } else if (rawStart < 0) {
    const wrappedSpan = -rawStart;
    segments.push({
      destinationStart: limit - wrappedSpan,
      localStart: 0,
      span: wrappedSpan
    });
    segments.push({
      destinationStart: 0,
      localStart: wrappedSpan,
      span: brushSize - wrappedSpan
    });
  } else {
    const nonWrappedSpan = limit - rawStart;
    segments.push({
      destinationStart: rawStart,
      localStart: 0,
      span: nonWrappedSpan
    });
    segments.push({
      destinationStart: 0,
      localStart: nonWrappedSpan,
      span: rawEndExclusive - limit
    });
  }
  return segments.filter(segment => segment.span > 0);
}

/**
 * Generates the brush compute shader for the active packed-grid format.
 *
 * @param {GridFormat} gridFormat active packed grid format.
 * @returns {string} brush WGSL source.
 */
export function generateBrushWgsl(gridFormat: GridFormat): string {
  return `
struct BrushParams {
  packedCols: u32,
  brushSize: u32,
  shape: u32,
  fill: u32,
  deadId: u32,
  seed: u32,
  tribeCount: u32,
  destinationStartX: u32,
  destinationStartY: u32,
  localStartX: u32,
  localStartY: u32,
  spanCols: u32,
  spanRows: u32,
  pad: u32,
  tribeIds: array<u32, 32>,
}

@group(0) @binding(0) var<storage, read_write> grid: array<u32>;
@group(0) @binding(1) var<uniform> params: BrushParams;

const CELLS_PER_WORD: u32 = ${gridFormat.cellsPerWord}u;
const WORD_SHIFT: u32 = ${gridFormat.wordShift}u;
const CELL_SHIFT: u32 = ${gridFormat.cellShift}u;
const CELL_INDEX_MASK: u32 = ${gridFormat.cellIndexMask}u;
const CELL_MASK: u32 = ${gridFormat.cellMask}u;

fn pcg(inp: u32) -> u32 {
  var state = inp * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn writePackedWord(wordIdx: u32, writeMask: u32, writeBits: u32) {
  let old = grid[wordIdx];
  let updated = (old & ~writeMask) | (writeBits & writeMask);
  grid[wordIdx] = updated;
}

fn inShape(bx: i32, by: i32, size: u32, shape: u32) -> bool {
  if (bx < 0 || by < 0 || bx >= i32(size) || by >= i32(size)) { return false; }
  let hf = f32(size - 1u) / 2.0;
  let fdx = f32(bx) - hf;
  let fdy = f32(by) - hf;
  switch (shape) {
    case 1u: {
      let r = f32(size) / 2.0 - 0.25;
      return fdx * fdx + fdy * fdy <= r * r;
    }
    case 2u: {
      return abs(fdx) + abs(fdy) <= f32(size) / 2.0;
    }
    case 3u: {
      return bx == i32(size - 1u) / 2;
    }
    case 4u: {
      return by == i32(size - 1u) / 2;
    }
    default: {
      return true;
    }
  }
}

fn onBorder(bx: i32, by: i32, size: u32, shape: u32) -> bool {
  if (!inShape(bx, by, size, shape)) { return false; }
  return !inShape(bx - 1, by, size, shape)
      || !inShape(bx + 1, by, size, shape)
      || !inShape(bx, by - 1, size, shape)
      || !inShape(bx, by + 1, size, shape);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let startWord = params.destinationStartX >> WORD_SHIFT;
  let endWordExclusive = (params.destinationStartX + params.spanCols + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
  let spanWords = endWordExclusive - startWord;
  let wordOffset = gid.x;
  let rowOffset = gid.y;
  if (wordOffset >= spanWords || rowOffset >= params.spanRows) { return; }

  let cy = params.destinationStartY + rowOffset;
  let localBy = params.localStartY + rowOffset;
  let wordX = startWord + wordOffset;
  let wordIdx = cy * params.packedCols + wordX;
  let wordBaseCellX = wordX << WORD_SHIFT;
  let rectEndX = params.destinationStartX + params.spanCols;

  var writeMask = 0u;
  var writeBits = 0u;

  for (var lane = 0u; lane < CELLS_PER_WORD; lane++) {
    let cx = wordBaseCellX + lane;
    let insideRect = cx >= params.destinationStartX && cx < rectEndX;
    if (insideRect) {
      let localBx = params.localStartX + (cx - params.destinationStartX);
      let bx = i32(localBx);
      let by = i32(localBy);
      var insideShape = false;
      if (params.fill == 2u) {
        insideShape = onBorder(bx, by, params.brushSize, params.shape);
      } else {
        insideShape = inShape(bx, by, params.brushSize, params.shape);
      }

      if (insideShape) {
        let idx = localBy * params.brushSize + localBx;
        let spatialHash = (cx * 73856093u) ^ (cy * 19349663u);
        let h = pcg(params.seed ^ idx ^ spatialHash);
        let selectedTribe = params.tribeIds[h % params.tribeCount];
        var shouldWrite = true;
        var value = selectedTribe;

        if (params.fill == 1u && ((h >> 16u) & 1u) != 0u) {
          if (selectedTribe != params.deadId) {
            value = params.deadId;
          } else {
            shouldWrite = false;
          }
        }

        if (shouldWrite) {
          let shift = (lane & CELL_INDEX_MASK) << CELL_SHIFT;
          let mask = CELL_MASK << shift;
          writeMask |= mask;
          writeBits = (writeBits & ~mask) | ((value & CELL_MASK) << shift);
        }
      }
    }
  }

  if (writeMask != 0u) {
    writePackedWord(wordIdx, writeMask, writeBits);
  }
}
`;
}

/**
 * Produces the non-wrapping rectangles required for one wrapped brush stroke.
 *
 * @param {number} centerX brush center x coordinate.
 * @param {number} centerY brush center y coordinate.
 * @param {number} brushSize brush size in logical cells.
 * @param {Grid} grid logical grid dimensions.
 * @returns {BrushDispatchRect[]} up to four non-overlapping rectangles.
 */
export function createBrushDispatchRects(centerX: number, centerY: number, brushSize: number, grid: Grid): BrushDispatchRect[] {
  const xSegments = createBrushAxisSegments(centerX, brushSize, grid.cols);
  const ySegments = createBrushAxisSegments(centerY, brushSize, grid.rows);
  const rects: BrushDispatchRect[] = [];
  for (const ySegment of ySegments) {
    for (const xSegment of xSegments) {
      rects.push({
        destinationStartX: xSegment.destinationStart,
        destinationStartY: ySegment.destinationStart,
        localStartX: xSegment.localStart,
        localStartY: ySegment.localStart,
        spanCols: xSegment.span,
        spanRows: ySegment.span
      });
    }
  }
  return rects;
}
