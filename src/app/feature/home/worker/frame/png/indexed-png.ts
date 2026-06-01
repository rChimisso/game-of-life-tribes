import {packIndexedPngScanline} from './indexed-png-row-pack';
import {writeIendChunk, writeIhdrChunk, writePlteChunk, writePngChunk, writePngSignature} from './png-crc';
import {IDAT_CHUNK_TYPE, IndexedPngFrameOptions, IndexedPngPalette, PNG_EXPORT_CANCELLED_ERROR_MESSAGE, PNG_SCANLINE_BLOCK_MEMORY_BUDGET_BYTES} from './png-types';
import {abortWritableStreamWriter, createStreamCancellationState, observeStreamPump, pumpReadableChunks, throwStreamPumpError, waitForCancellablePromise} from '../../io/logic/stream';
import {ByteSink, StreamCancellationState, StreamPumpState} from '../../io/model/stream';
import {decodePackedRow} from '../../snapshot/packing/packed-access';
import {PackedRecordedFrame} from '../recording-frame-types';

/**
 * Writes decoded and packed scanlines into the PNG compressor.
 *
 * @async
 * @param {WritableStreamDefaultWriter<BufferSource>} writer compressor writer.
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {IndexedPngPalette} palette indexed-color palette.
 * @param {IndexedPngFrameOptions} options png encode options.
 * @param {StreamCancellationState} cancellation active cancellation state.
 */
async function writeCompressedScanlines(writer: WritableStreamDefaultWriter<BufferSource>, frame: PackedRecordedFrame, palette: IndexedPngPalette, options: IndexedPngFrameOptions, cancellation: StreamCancellationState): Promise<void> {
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
      await writeScanlineBlock(writer, activeBlock, usedRows, scanlineBytes, cancellation);
      activeBlock = activeBlock === blockA ? blockB : blockA;
      usedRows = 0;
      options.onRowsProcessed?.(y + 1, frame.rows);
    }
  }
  if (usedRows > 0) {
    await writeScanlineBlock(writer, activeBlock, usedRows, scanlineBytes, cancellation);
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
 * @param {StreamCancellationState} cancellation active cancellation state.
 */
async function writeScanlineBlock(writer: WritableStreamDefaultWriter<BufferSource>, block: Uint8Array, usedRows: number, scanlineBytes: number, cancellation: StreamCancellationState): Promise<void> {
  await waitForCancellablePromise(writer.write(block.subarray(0, usedRows * scanlineBytes).slice()), cancellation, PNG_EXPORT_CANCELLED_ERROR_MESSAGE);
}

/**
 * Pumps compressor output into PNG IDAT chunks.
 *
 * @async
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader compressor output reader.
 * @param {ByteSink} sink target png byte sink.
 * @param {IndexedPngFrameOptions} options png encode options.
 * @param {StreamCancellationState} cancellation active cancellation state.
 */
async function pumpCompressedChunks(reader: ReadableStreamDefaultReader<Uint8Array>, sink: ByteSink, options: IndexedPngFrameOptions, cancellation: StreamCancellationState): Promise<void> {
  await pumpReadableChunks(reader, async chunk => {
    assertNotCancelled(options);
    await writePngChunk(sink, IDAT_CHUNK_TYPE, chunk);
  }, cancellation, PNG_EXPORT_CANCELLED_ERROR_MESSAGE);
}

/**
 * Throws when PNG export cancellation has been requested.
 *
 * @param {IndexedPngFrameOptions} options png encode options.
 */
function assertNotCancelled(options: IndexedPngFrameOptions): void {
  if (options.shouldCancel()) {
    throw new Error(PNG_EXPORT_CANCELLED_ERROR_MESSAGE);
  }
}

/**
 * Writes one recorded frame as a streaming indexed-color PNG.
 *
 * @async
 * @param {ByteSink} sink target PNG byte sink.
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {IndexedPngPalette} palette indexed-color palette.
 * @param {IndexedPngFrameOptions} options png encode options.
 */
export async function writeIndexedPngFrame(sink: ByteSink, frame: PackedRecordedFrame, palette: IndexedPngPalette, options: IndexedPngFrameOptions): Promise<void> {
  assertNotCancelled(options);
  await writePngSignature(sink);
  await writeIhdrChunk(sink, frame.cols, frame.rows, palette.bitDepth);
  await writePlteChunk(sink, palette.plte);
  const compression = new CompressionStream('deflate');
  const reader = compression.readable.getReader();
  const writer = compression.writable.getWriter();
  const compressedPumpState: StreamPumpState = {error: null};
  let writerClosed = false;
  const cancellation = createStreamCancellationState(options, () => {
    abortWritableStreamWriter(writer, new Error(PNG_EXPORT_CANCELLED_ERROR_MESSAGE), '[GOLT] Failed to abort PNG compressor after export failure:');
  });
  const compressedPump = observeStreamPump(pumpCompressedChunks(reader, sink, options, cancellation), compressedPumpState);
  try {
    await writeCompressedScanlines(writer, frame, palette, options, cancellation);
    throwStreamPumpError(compressedPumpState);
    await waitForCancellablePromise(writer.close(), cancellation, PNG_EXPORT_CANCELLED_ERROR_MESSAGE);
    writerClosed = true;
    await waitForCancellablePromise(compressedPump, cancellation, PNG_EXPORT_CANCELLED_ERROR_MESSAGE);
    throwStreamPumpError(compressedPumpState);
    assertNotCancelled(options);
    await writeIendChunk(sink);
  } catch (error) {
    const pendingError = compressedPumpState.error ?? error;
    if (!writerClosed) {
      abortWritableStreamWriter(writer, pendingError, '[GOLT] Failed to abort PNG compressor after export failure:');
    }
    if (!options.shouldCancel()) {
      await compressedPump;
    }
    throw pendingError;
  } finally {
    cancellation.unregister();
  }
}
