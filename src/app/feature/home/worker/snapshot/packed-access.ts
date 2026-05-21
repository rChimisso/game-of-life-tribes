import {GridFormat} from '../../model/grid-format';
import {packedColsForFormat} from '../../util/grid-format';

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
export function readPackedCell(words: Uint32Array, grid: Grid, format: GridFormat, x: number, y: number): number {
  const packedCols = packedColsForFormat(grid.cols, format);
  const word = words[(y * packedCols) + (x >> format.wordShift)] ?? 0;
  return (word >>> ((x & format.cellIndexMask) << format.cellShift)) & format.cellMask;
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
export function writePackedCell(words: Uint32Array, grid: Grid, format: GridFormat, x: number, y: number, value: number): void {
  const packedCols = packedColsForFormat(grid.cols, format);
  const wordIndex = (y * packedCols) + (x >> format.wordShift);
  const bitOffset = (x & format.cellIndexMask) << format.cellShift;
  const clearMask = ~(format.cellMask << bitOffset);
  const current = words[wordIndex] ?? 0;
  words[wordIndex] = ((current & clearMask) | ((value & format.cellMask) << bitOffset)) >>> 0;
}
