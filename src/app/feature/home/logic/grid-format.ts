import {BitsPerCell, GridFormat, GRID_FORMATS, GRID_FORMAT_32, GridFormatMetadata, SUPPORTED_SIMULATION_BITS_PER_CELL} from '../model/grid-format';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Checks whether a number is a supported bits per cell value.
 *
 * @param {number} bitsPerCell
 * @returns {bitsPerCell is BitsPerCell}
 */
export function isSupportedBitsPerCell(bitsPerCell: number): bitsPerCell is BitsPerCell {
  return SUPPORTED_SIMULATION_BITS_PER_CELL.includes(bitsPerCell as BitsPerCell);
}

/**
 * Returns the maximum state count supported by the packing size.
 *
 * @param {BitsPerCell} bitsPerCell
 * @returns {number}
 */
export function maxStateCountForBits(bitsPerCell: BitsPerCell): number {
  return 2 ** bitsPerCell;
}

/**
 * Checks whether a packing size supports the state count.
 *
 * @param {BitsPerCell} bitsPerCell
 * @param {number} totalStateCount
 * @returns {boolean}
 */
export function validatePackingAgainstStateCount(bitsPerCell: BitsPerCell, totalStateCount: number): boolean {
  return totalStateCount <= maxStateCountForBits(bitsPerCell);
}

/**
 * Checks whether a packed grid fits within a byte budget.
 *
 * @param {Grid} grid
 * @param {GridFormat} format
 * @param {number} maxBytes
 * @returns {boolean}
 */
export function fitsGridFormatInMaxBytes(grid: Grid, format: GridFormat, maxBytes: number): boolean {
  return gridByteSize(grid, format) <= maxBytes;
}

/**
 * Chooses a tight storage format for a state count.
 *
 * @param {number} stateCount
 * @returns {GridFormat}
 */
export function chooseGridFormat(stateCount: number): GridFormat {
  return chooseTightStorageGridFormat(stateCount);
}

/**
 * Chooses a tight storage format for a state count.
 *
 * @param {number} stateCount
 * @returns {GridFormat}
 */
export function chooseTightStorageGridFormat(stateCount: number): GridFormat {
  if (stateCount <= 2) {
    return GRID_FORMATS[1];
  }
  if (stateCount <= 4) {
    return GRID_FORMATS[2];
  }
  if (stateCount <= 16) {
    return GRID_FORMATS[4];
  }
  if (stateCount <= 256) {
    return GRID_FORMATS[8];
  }
  if (stateCount <= 65536) {
    return GRID_FORMATS[16];
  }
  return GRID_FORMATS[32];
}

/**
 * Returns the minimum grid format required for a state count.
 *
 * @param {number} totalStateCount
 * @returns {GridFormat}
 */
export function requiredGridFormatForStateCount(totalStateCount: number): GridFormat {
  return chooseTightStorageGridFormat(totalStateCount);
}

/**
 * Resolves a grid format from bits per cell.
 *
 * @param {BitsPerCell} bitsPerCell
 * @returns {GridFormat}
 */
export function gridFormatFromBits(bitsPerCell: BitsPerCell): GridFormat {
  return GRID_FORMATS[bitsPerCell];
}

/**
 * Finds the smallest valid simulation grid format.
 *
 * @param {number} totalStateCount
 * @param {Grid} [grid]
 * @param {number} [maxBytes]
 * @returns {GridFormat}
 */
export function smallestValidSimulationGridFormat(totalStateCount: number, grid: Grid = {cols: 3, rows: 3}, maxBytes = Number.POSITIVE_INFINITY): GridFormat {
  return smallestFittingSimulationGridFormat(totalStateCount, grid, maxBytes) ?? GRID_FORMAT_32;
}

/**
 * Finds the smallest simulation grid format that fits the byte budget.
 *
 * @param {number} totalStateCount
 * @param {Grid} [grid]
 * @param {number} [maxBytes]
 * @returns {(GridFormat | null)}
 */
export function smallestFittingSimulationGridFormat(totalStateCount: number, grid: Grid = {cols: 3, rows: 3}, maxBytes = Number.POSITIVE_INFINITY): GridFormat | null {
  for (const bitsPerCell of SUPPORTED_SIMULATION_BITS_PER_CELL) {
    const format = gridFormatFromBits(bitsPerCell);
    if (validatePackingAgainstStateCount(bitsPerCell, totalStateCount) && fitsGridFormatInMaxBytes(grid, format, maxBytes)) {
      return format;
    }
  }
  return null;
}

/**
 * Resolves a grid format from metadata.
 *
 * @param {(GridFormatMetadata | null)} [metadata]
 * @returns {GridFormat}
 */
export function gridFormatFromMetadata(metadata?: GridFormatMetadata | null): GridFormat {
  return gridFormatFromBits(metadata?.bitsPerCell ?? 8);
}

/**
 * Extracts serializable grid format metadata.
 *
 * @param {GridFormat} format
 * @returns {GridFormatMetadata}
 */
export function gridFormatMetadata(format: GridFormat): GridFormatMetadata {
  return {bitsPerCell: format.bitsPerCell};
}

/**
 * Returns packed columns for a format.
 *
 * @param {number} cols
 * @param {GridFormat} format
 * @returns {number}
 */
export function packedColsForFormat(cols: number, format: GridFormat): number {
  return Math.ceil(cols / format.cellsPerWord);
}

/**
 * Returns packed grid size in bytes.
 *
 * @param {Grid} grid
 * @param {GridFormat} format
 * @returns {number}
 */
export function gridByteSize(grid: Grid, format: GridFormat): number {
  return packedColsForFormat(grid.cols, format) * grid.rows * Uint32Array.BYTES_PER_ELEMENT;
}

/**
 * Aligns packed bytes to words.
 *
 * @param {Uint8Array} packed
 * @returns {Uint32Array}
 */
export function alignPackedBytesToWords(packed: Uint8Array): Uint32Array {
  if (packed.byteOffset % Uint32Array.BYTES_PER_ELEMENT === 0) {
    return new Uint32Array(packed.buffer, packed.byteOffset, packed.byteLength / Uint32Array.BYTES_PER_ELEMENT);
  }

  const aligned = new ArrayBuffer(packed.byteLength);
  new Uint8Array(aligned).set(packed);
  return new Uint32Array(aligned);
}

/**
 * Packs a frame into words.
 *
 * @param {Uint8Array} frame
 * @param {Grid} grid
 * @param {GridFormat} format
 * @returns {Uint32Array}
 */
export function packFrameToWords(frame: Uint8Array, grid: Grid, format: GridFormat): Uint32Array {
  const packedCols = packedColsForFormat(grid.cols, format);
  const words = new Uint32Array(packedCols * grid.rows);
  for (let y = 0; y < grid.rows; y++) {
    for (let px = 0; px < packedCols; px++) {
      const baseX = px * format.cellsPerWord;
      let word = 0;
      for (let i = 0; i < format.cellsPerWord && baseX + i < grid.cols; i++) {
        const value = frame[y * grid.cols + baseX + i]! & format.cellMask;
        word |= value << (i << format.cellShift);
      }
      words[y * packedCols + px] = word >>> 0;
    }
  }
  return words;
}

/**
 * Unpacks words into a frame.
 *
 * @param {Uint32Array} words
 * @param {Grid} grid
 * @param {GridFormat} format
 * @returns {Uint8Array}
 */
export function unpackWordsToFrame(words: Uint32Array, grid: Grid, format: GridFormat): Uint8Array {
  const packedCols = packedColsForFormat(grid.cols, format);
  const frame = new Uint8Array(grid.cols * grid.rows);
  for (let y = 0; y < grid.rows; y++) {
    for (let px = 0; px < packedCols; px++) {
      const word = words[y * packedCols + px]!;
      const baseX = px * format.cellsPerWord;
      for (let i = 0; i < format.cellsPerWord && baseX + i < grid.cols; i++) {
        frame[y * grid.cols + baseX + i] = (word >>> (i << format.cellShift)) & format.cellMask;
      }
    }
  }
  return frame;
}

/**
 * Unpacks bytes into a frame.
 *
 * @param {Uint8Array} packed
 * @param {Grid} grid
 * @param {GridFormat} format
 * @returns {Uint8Array}
 */
export function unpackPackedBytesToFrame(packed: Uint8Array, grid: Grid, format: GridFormat): Uint8Array {
  return unpackWordsToFrame(alignPackedBytesToWords(packed), grid, format);
}
