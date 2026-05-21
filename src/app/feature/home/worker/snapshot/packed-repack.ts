import {readPackedCell, writePackedCell} from './packed-access';
import {GridFormat} from '../../model/grid-format';
import {gridByteSize} from '../../util/grid-format';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Converts packed grid bytes between packing formats without materializing an unpacked cell frame.
 *
 * @export
 * @param {Uint32Array} sourceGrid source packed grid words.
 * @param {Grid} grid grid dimensions.
 * @param {GridFormat} sourceFormat source packing format.
 * @param {GridFormat} targetFormat target packing format.
 * @returns {Uint32Array} repacked grid words.
 */
export function repackPackedGrid(sourceGrid: Uint32Array, grid: Grid, sourceFormat: GridFormat, targetFormat: GridFormat): Uint32Array {
  const sourceWords = sourceGrid;
  let targetWords: Uint32Array;
  if (sourceFormat.bitsPerCell === targetFormat.bitsPerCell) {
    targetWords = sourceGrid;
  } else {
    targetWords = new Uint32Array(gridByteSize(grid, targetFormat) / Uint32Array.BYTES_PER_ELEMENT);
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        writePackedCell(targetWords, grid, targetFormat, x, y, readPackedCell(sourceWords, grid, sourceFormat, x, y));
      }
    }
  }
  return targetWords;
}
