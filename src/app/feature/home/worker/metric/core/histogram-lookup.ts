import {HistogramLookup} from './histogram-lookup-types';
import {packedColsForFormat} from '../../../logic/grid-format';
import {BitsPerCell, GridFormat} from '../../../model/grid-format';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Byte-level state tables keyed by bits per cell.
 *
 * @type {Partial<Record<BitsPerCell, Uint8Array[]>>}
 */
const BYTE_STATE_LOOKUP_CACHE: Partial<Record<BitsPerCell, Uint8Array[]>> = {};

/**
 * Creates a packed-word histogram lookup for a grid format.
 *
 * @export
 * @param {GridFormat} format grid packing format.
 * @returns {HistogramLookup} histogram lookup.
 */
function createHistogramLookup(format: GridFormat): HistogramLookup {
  if (format.bitsPerCell <= 8) {
    const byteLookup = getByteStateLookup(format);
    return {
      addWord: (word, counts, validCells = format.cellsPerWord) => addSubByteWord(word, counts, format, byteLookup, validCells)
    };
  }
  if (format.bitsPerCell === 16) {
    return {
      addWord: (word, counts, validCells = format.cellsPerWord) => addSixteenBitWord(word, counts, validCells)
    };
  }
  return {
    addWord: (word, counts, validCells = format.cellsPerWord) => addThirtyTwoBitWord(word, counts, validCells)
  };
}

/**
 * Adds one packed grid row to the target counts array.
 *
 * @export
 * @param {Uint32Array} words packed grid words.
 * @param {Grid} grid grid dimensions.
 * @param {GridFormat} format grid packing format.
 * @param {number} y row index.
 * @param {number[]} counts population counts by state index.
 * @param {HistogramLookup} [lookup] reusable histogram lookup.
 */
function addPackedRowToHistogram(words: Uint32Array, grid: Grid, format: GridFormat, y: number, counts: number[], lookup = createHistogramLookup(format)): void {
  const packedCols = packedColsForFormat(grid.cols, format);
  const rowOffset = y * packedCols;
  for (let packedX = 0; packedX < packedCols; packedX++) {
    const baseX = packedX * format.cellsPerWord;
    const validCells = Math.min(format.cellsPerWord, grid.cols - baseX);
    lookup.addWord(words[rowOffset + packedX] ?? 0, counts, validCells);
  }
}

/**
 * Resolves the byte lookup table for a sub-byte or byte-aligned format.
 *
 * @param {GridFormat} format grid packing format.
 * @returns {Uint8Array[]} state values by byte value.
 */
function getByteStateLookup(format: GridFormat): Uint8Array[] {
  const cached = BYTE_STATE_LOOKUP_CACHE[format.bitsPerCell];
  if (cached) {
    return cached;
  }

  const cellsPerByte = 8 / format.bitsPerCell;
  const lookup = new Array<Uint8Array>(256);
  for (let byte = 0; byte < lookup.length; byte++) {
    const states = new Uint8Array(cellsPerByte);
    for (let cellIndex = 0; cellIndex < cellsPerByte; cellIndex++) {
      states[cellIndex] = (byte >>> (cellIndex * format.bitsPerCell)) & format.cellMask;
    }
    lookup[byte] = states;
  }
  BYTE_STATE_LOOKUP_CACHE[format.bitsPerCell] = lookup;
  return lookup;
}

/**
 * Adds a packed word that contains 1-bit, 2-bit, 4-bit, or 8-bit states.
 *
 * @param {number} word packed grid word.
 * @param {number[]} counts population counts by state index.
 * @param {GridFormat} format grid packing format.
 * @param {Uint8Array[]} byteLookup state values by byte value.
 * @param {number} validCells valid cells in the word.
 */
function addSubByteWord(word: number, counts: number[], format: GridFormat, byteLookup: Uint8Array[], validCells: number): void {
  const cellsPerByte = 8 / format.bitsPerCell;
  let remainingCells = validCells;
  for (let byteIndex = 0; remainingCells > 0 && byteIndex < Uint32Array.BYTES_PER_ELEMENT; byteIndex++) {
    const states = byteLookup[(word >>> (byteIndex * 8)) & 0xFF]!;
    const cellsToCount = Math.min(cellsPerByte, remainingCells);
    for (let cellIndex = 0; cellIndex < cellsToCount; cellIndex++) {
      countState(counts, states[cellIndex]!);
    }
    remainingCells -= cellsToCount;
  }
}

/**
 * Adds a packed word that contains 16-bit states.
 *
 * @param {number} word packed grid word.
 * @param {number[]} counts population counts by state index.
 * @param {number} validCells valid cells in the word.
 */
function addSixteenBitWord(word: number, counts: number[], validCells: number): void {
  if (validCells > 0) {
    countState(counts, word & 0xFFFF);
  }
  if (validCells > 1) {
    countState(counts, (word >>> 16) & 0xFFFF);
  }
}

/**
 * Adds a packed word that contains one 32-bit state.
 *
 * @param {number} word packed grid word.
 * @param {number[]} counts population counts by state index.
 * @param {number} validCells valid cells in the word.
 */
function addThirtyTwoBitWord(word: number, counts: number[], validCells: number): void {
  if (validCells > 0) {
    countState(counts, word >>> 0);
  }
}

/**
 * Counts one cell state when it belongs to a known tribe.
 *
 * @param {number[]} counts population counts.
 * @param {number} state cell state.
 */
function countState(counts: number[], state: number): void {
  if (state < counts.length) {
    counts[state]!++;
  }
}

export {addPackedRowToHistogram, createHistogramLookup};

export type {HistogramLookup} from './histogram-lookup-types';
