import {packIndexedPngScanline} from './indexed-png-row-pack';
import {writeIendChunk, writeIhdrChunk, writePlteChunk, writePngChunk, writePngSignature} from './png-crc';
import {IndexedPngFrameOptions, IndexedPngPalette, PngByteSink} from './png-types';
import {decodePackedRow} from '../../snapshot/packing/packed-access';
import {PackedRecordedFrame} from '../recording-frame-stream';

/**
 * Memory budget for one PNG scanline write block.
 *
 * @type {number}
 */
const PNG_SCANLINE_BLOCK_MEMORY_BUDGET_BYTES = 32 * 1024 * 1024;

/**
 * PNG image-data chunk type.
 *
 * @type {string}
 */
const IDAT_CHUNK_TYPE = 'IDAT';

/**
 * Writes one recorded frame as a streaming indexed-color PNG.
 *
 * @export
 * @async
 * @param {PngByteSink} sink target PNG byte sink.
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {IndexedPngPalette} palette indexed-color palette.
 * @param {IndexedPngFrameOptions} options png encode options.
 */
async function writeIndexedPngFrame(sink: PngByteSink, frame: PackedRecordedFrame, palette: IndexedPngPalette, options: IndexedPngFrameOptions): Promise<void> {
  assertNotCancelled(options);
  await writePngSignature(sink);
  await writeIhdrChunk(sink, frame.cols, frame.rows, palette.bitDepth);
  await writePlteChunk(sink, palette.plte);
  const compression = new CompressionStream('deflate');
  const reader = compression.readable.getReader();
  const writer = compression.writable.getWriter();
  const compressedPump = pumpCompressedChunks(reader, sink, options);
  let writerClosed = false;
  try {
    await writeCompressedScanlines(writer, frame, palette, options);
    await writer.close();
    writerClosed = true;
    await compressedPump;
    assertNotCancelled(options);
    await writeIendChunk(sink);
  } catch (error) {
    if (!writerClosed) {
      await writer.abort(error);
    }
    await compressedPump.catch(() => undefined);
    throw error;
  }
}

/**
 * Writes decoded and packed scanlines into the PNG compressor.
 *
 * @async
 * @param {WritableStreamDefaultWriter<BufferSource>} writer compressor writer.
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {IndexedPngPalette} palette indexed-color palette.
 * @param {IndexedPngFrameOptions} options png encode options.
 */
async function writeCompressedScanlines(writer: WritableStreamDefaultWriter<BufferSource>, frame: PackedRecordedFrame, palette: IndexedPngPalette, options: IndexedPngFrameOptions): Promise<void> {
  const decodedRow = new Uint8Array(frame.cols);
  const scanlineBytes = 1 + Math.ceil((frame.cols * palette.bitDepth) / 8);
  const rowsPerBlock = choosePngRowsPerBlock(scanlineBytes, frame.rows);
  const blockA = new Uint8Array(scanlineBytes * rowsPerBlock);
  const blockB = new Uint8Array(scanlineBytes * rowsPerBlock);
  let activeBlock = blockA;
  let usedRows = 0;
  for (let y = 0; y < frame.rows; y++) {
    assertNotCancelled(options);
    const rowOffset = usedRows * scanlineBytes;
    const scanline = activeBlock.subarray(rowOffset, rowOffset + scanlineBytes);
    decodePackedRow(frame.words, frame, frame.format, y, decodedRow);
    packIndexedPngScanline(decodedRow, frame.cols, palette.bitDepth, scanline, palette.stateToPaletteIndex);
    usedRows++;
    if (usedRows === rowsPerBlock) {
      await writeScanlineBlock(writer, activeBlock, usedRows, scanlineBytes);
      activeBlock = activeBlock === blockA ? blockB : blockA;
      usedRows = 0;
      options.onRowsProcessed?.(y + 1, frame.rows);
    }
  }
  if (usedRows > 0) {
    await writeScanlineBlock(writer, activeBlock, usedRows, scanlineBytes);
    options.onRowsProcessed?.(frame.rows, frame.rows);
  }
}

/**
 * Chooses a bounded row count for PNG scanline write blocks.
 *
 * @param {number} scanlineBytes bytes in one packed PNG scanline.
 * @param {number} rowsTotal total rows in the frame.
 * @returns {number} rows per write block.
 */
function choosePngRowsPerBlock(scanlineBytes: number, rowsTotal: number): number {
  return Math.max(1, Math.min(rowsTotal, Math.floor(Math.max(scanlineBytes, PNG_SCANLINE_BLOCK_MEMORY_BUDGET_BYTES) / scanlineBytes)));
}

/**
 * Writes one PNG scanline block to the compressor.
 *
 * @async
 * @param {WritableStreamDefaultWriter<BufferSource>} writer compressor writer.
 * @param {Uint8Array} block reusable scanline block.
 * @param {number} usedRows number of rows populated in the block.
 * @param {number} scanlineBytes bytes in one packed PNG scanline.
 */
async function writeScanlineBlock(writer: WritableStreamDefaultWriter<BufferSource>, block: Uint8Array, usedRows: number, scanlineBytes: number): Promise<void> {
  const usedBytes = usedRows * scanlineBytes;
  await writer.write(block.subarray(0, usedBytes).slice());
}

/**
 * Pumps compressor output into PNG IDAT chunks.
 *
 * @async
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader compressor output reader.
 * @param {PngByteSink} sink target png byte sink.
 * @param {IndexedPngFrameOptions} options png encode options.
 */
async function pumpCompressedChunks(reader: ReadableStreamDefaultReader<Uint8Array>, sink: PngByteSink, options: IndexedPngFrameOptions): Promise<void> {
  let done = false;
  while (!done) {
    assertNotCancelled(options);
    const result = await reader.read();
    done = result.done;
    if (!done && result.value) {
      await writePngChunk(sink, IDAT_CHUNK_TYPE, result.value);
    }
  }
}

/**
 * Throws when PNG export cancellation has been requested.
 *
 * @param {IndexedPngFrameOptions} options png encode options.
 */
function assertNotCancelled(options: IndexedPngFrameOptions): void {
  if (options.shouldCancel()) {
    throw new Error('PNG export cancelled');
  }
}

export {writeIndexedPngFrame};
