import {ByteSink, SnapshotProgressReporter} from './golt-types';
import {readPackedCell, writePackedCell} from './packed-access';
import {GridFormat} from '../../model/grid-format';
import {gridByteSize, packedColsForFormat} from '../../util/grid-format';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Target byte size for one streamed repack block.
 *
 * @type {number}
 */
const STREAM_REPACK_BLOCK_BYTES = 64 * 1024 * 1024;

/**
 * Reports packed-grid streaming progress.
 *
 * @param {number} bytesWritten target packed bytes written.
 * @param {number} totalBytes total target packed bytes.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 */
function reportPackedProgress(bytesWritten: number, totalBytes: number, reportProgress: SnapshotProgressReporter): void {
  reportProgress({
    mode: 'determinate',
    percent: Math.min(95, Math.round((bytesWritten / totalBytes) * 90) + 5),
    status: 'Compressing grid'
  });
}

/**
 * Writes already-compatible packed grid bytes in chunks.
 *
 * @async
 * @param {Uint32Array} sourceGrid source packed grid words.
 * @param {Grid} grid grid dimensions.
 * @param {GridFormat} targetFormat target packing format.
 * @param {ByteSink} sink byte sink that receives target packed chunks.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 */
async function writeMatchingGridToSink(sourceGrid: Uint32Array, grid: Grid, targetFormat: GridFormat, sink: ByteSink, reportProgress: SnapshotProgressReporter): Promise<void> {
  const sourceBytes = new Uint8Array(sourceGrid.buffer, sourceGrid.byteOffset, gridByteSize(grid, targetFormat));
  let offset = 0;
  while (offset < sourceBytes.byteLength) {
    const end = Math.min(offset + STREAM_REPACK_BLOCK_BYTES, sourceBytes.byteLength);
    await sink.write(sourceBytes.subarray(offset, end));
    offset = end;
    reportPackedProgress(offset, sourceBytes.byteLength, reportProgress);
  }
}

/**
 * Converts packed grid bytes by row blocks.
 *
 * @async
 * @param {Uint32Array} sourceGrid source packed grid words.
 * @param {Grid} grid grid dimensions.
 * @param {GridFormat} sourceFormat source packing format.
 * @param {GridFormat} targetFormat target packing format.
 * @param {ByteSink} sink byte sink that receives target packed chunks.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 */
async function writeConvertedGridToSink(sourceGrid: Uint32Array, grid: Grid, sourceFormat: GridFormat, targetFormat: GridFormat, sink: ByteSink, reportProgress: SnapshotProgressReporter): Promise<void> {
  const targetPackedCols = packedColsForFormat(grid.cols, targetFormat);
  const rowsPerBlock = Math.max(1, Math.floor(STREAM_REPACK_BLOCK_BYTES / (targetPackedCols * Uint32Array.BYTES_PER_ELEMENT)));
  const totalBytes = gridByteSize(grid, targetFormat);
  let bytesWritten = 0;
  for (let startRow = 0; startRow < grid.rows; startRow += rowsPerBlock) {
    const blockRows = Math.min(rowsPerBlock, grid.rows - startRow);
    const blockGrid: Grid = {cols: grid.cols, rows: blockRows};
    const blockWords = new Uint32Array(targetPackedCols * blockRows);
    for (let localY = 0; localY < blockRows; localY++) {
      const sourceY = startRow + localY;
      for (let x = 0; x < grid.cols; x++) {
        writePackedCell(blockWords, blockGrid, targetFormat, x, localY, readPackedCell(sourceGrid, grid, sourceFormat, x, sourceY));
      }
    }
    const blockBytes = new Uint8Array(blockWords.buffer);
    await sink.write(blockBytes);
    bytesWritten += blockBytes.byteLength;
    reportPackedProgress(bytesWritten, totalBytes, reportProgress);
  }
}

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

/**
 * Writes packed grid bytes to a sink without allocating a full target grid.
 *
 * @export
 * @async
 * @param {Uint32Array} sourceGrid source packed grid words.
 * @param {Grid} grid grid dimensions.
 * @param {GridFormat} sourceFormat source packing format.
 * @param {GridFormat} targetFormat target packing format.
 * @param {ByteSink} sink byte sink that receives target packed chunks.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 */
export async function writeRepackedGridToSink(sourceGrid: Uint32Array, grid: Grid, sourceFormat: GridFormat, targetFormat: GridFormat, sink: ByteSink, reportProgress: SnapshotProgressReporter): Promise<void> {
  if (sourceFormat.bitsPerCell === targetFormat.bitsPerCell) {
    await writeMatchingGridToSink(sourceGrid, grid, targetFormat, sink, reportProgress);
  } else {
    await writeConvertedGridToSink(sourceGrid, grid, sourceFormat, targetFormat, sink, reportProgress);
  }
}

export {STREAM_REPACK_BLOCK_BYTES};
