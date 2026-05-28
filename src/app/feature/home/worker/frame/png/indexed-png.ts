import {packIndexedPngScanline} from './indexed-png-row-pack';
import {writeIendChunk, writeIhdrChunk, writePlteChunk, writePngChunk, writePngSignature} from './png-crc';
import {IndexedPngFrameOptions, IndexedPngPalette, PngByteSink} from './png-types';
import {decodePackedRow} from '../../snapshot/packed-access';
import {PackedRecordedFrame} from '../recording-frame-stream';

/**
 * Default row interval used to yield during PNG encoding.
 *
 * @type {number}
 */
const DEFAULT_YIELD_EVERY_ROWS = 128;

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
  const scanline = new Uint8Array(1 + Math.ceil((frame.cols * palette.bitDepth) / 8));
  const yieldEveryRows = options.yieldEveryRows ?? DEFAULT_YIELD_EVERY_ROWS;
  for (let y = 0; y < frame.rows; y++) {
    assertNotCancelled(options);
    decodePackedRow(frame.words, frame, frame.format, y, decodedRow);
    packIndexedPngScanline(decodedRow, frame.cols, palette.bitDepth, scanline, palette.stateToPaletteIndex);
    await writer.write(scanline.slice());
    options.onRowsProcessed?.(y + 1, frame.rows);
    if ((y + 1) % yieldEveryRows === 0) {
      await Promise.resolve();
    }
  }
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
