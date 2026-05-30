import {DecodedPackedRow} from './packed-access-types';
import {GridFormat} from '../../../model/grid-format';
import {packedColsForFormat} from '../../../util/grid-format';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Reads one packed cell value.
 *
 * @export
 * @param {Uint32Array} words packed grid words.
 * @param {Grid} grid grid dimensions.
 * @param {GridFormat} format packing format.
 * @param {number} x cell column.
 * @param {number} y cell row.
 * @returns {number} packed cell value.
 */
function readPackedCell(words: Uint32Array, grid: Grid, format: GridFormat, x: number, y: number): number {
  const packedCols = packedColsForFormat(grid.cols, format);
  const word = words[(y * packedCols) + (x >> format.wordShift)] ?? 0;
  return readPackedCellFromWord(word, format, x & format.cellIndexMask);
}

/**
 * Decodes one packed grid row into a reusable state buffer.
 *
 * @export
 * @param {Uint32Array} words packed grid words.
 * @param {Grid} grid grid dimensions.
 * @param {GridFormat} format packing format.
 * @param {number} y row index.
 * @param {DecodedPackedRow} out decoded row output; only the first `grid.cols` entries are written.
 */
function decodePackedRow(words: Uint32Array, grid: Grid, format: GridFormat, y: number, out: DecodedPackedRow): void {
  const packedCols = packedColsForFormat(grid.cols, format);
  const rowOffset = y * packedCols;
  for (let packedX = 0; packedX < packedCols; packedX++) {
    const word = words[rowOffset + packedX] ?? 0;
    const baseX = packedX * format.cellsPerWord;
    const validCells = Math.min(format.cellsPerWord, grid.cols - baseX);
    for (let cellIndex = 0; cellIndex < validCells; cellIndex++) {
      out[baseX + cellIndex] = readPackedCellFromWord(word, format, cellIndex);
    }
  }
}

/**
 * Writes one packed cell value.
 *
 * @export
 * @param {Uint32Array} words packed grid words.
 * @param {Grid} grid grid dimensions.
 * @param {GridFormat} format packing format.
 * @param {number} x cell column.
 * @param {number} y cell row.
 * @param {number} value cell value to write.
 */
function writePackedCell(words: Uint32Array, grid: Grid, format: GridFormat, x: number, y: number, value: number): void {
  const packedCols = packedColsForFormat(grid.cols, format);
  const wordIndex = (y * packedCols) + (x >> format.wordShift);
  const bitOffset = (x & format.cellIndexMask) << format.cellShift;
  const clearMask = ~(format.cellMask << bitOffset);
  const current = words[wordIndex] ?? 0;
  words[wordIndex] = ((current & clearMask) | ((value & format.cellMask) << bitOffset)) >>> 0;
}

/**
 * Reads one packed cell value from a word.
 *
 * @param {number} word packed word.
 * @param {GridFormat} format packing format.
 * @param {number} cellIndex cell index inside the word.
 * @returns {number} packed cell value.
 */
function readPackedCellFromWord(word: number, format: GridFormat, cellIndex: number): number {
  if (format.bitsPerCell === 32) {
    return word >>> 0;
  }
  return (word >>> (cellIndex << format.cellShift)) & format.cellMask;
}

export {decodePackedRow, readPackedCell, writePackedCell};

export type {DecodedPackedRow} from './packed-access-types';
