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
 * Observed state for the parallel compressor output pump.
 *
 * @interface CompressedPumpState
 * @typedef {CompressedPumpState}
 */
interface CompressedPumpState {
  /**
   * Error captured from the compressor output pump.
   *
   * @type {(unknown | null)}
   */
  error: unknown | null;
}

/**
 * Cancellation state shared by PNG stream operations.
 *
 * @interface PngCancellationState
 * @typedef {PngCancellationState}
 */
interface PngCancellationState {
  /**
   * Whether cancellation has been requested.
   *
   * @type {boolean}
   */
  cancelled: boolean;
  /**
   * Promise resolved when cancellation is requested.
   *
   * @type {Promise<void>}
   */
  promise: Promise<void>;
  /**
   * Removes the active cancellation listener.
   *
   * @type {() => void}
   */
  unregister: () => void;
}

/**
 * Result of an awaited operation raced against PNG cancellation.
 *
 * @typedef {PngCancellableResult}
 * @template T
 */
type PngCancellableResult<T> = {
  /**
   * Operation result type.
   *
   * @type {'value'}
   */
  type: 'value';
  /**
   * Operation result value.
   *
   * @type {T}
   */
  value: T;
} | {
  /**
   * Operation result type.
   *
   * @type {'error'}
   */
  type: 'error';
  /**
   * Operation rejection reason.
   *
   * @type {unknown}
   */
  error: unknown;
} | {
  /**
   * Operation result type.
   *
   * @type {'cancelled'}
   */
  type: 'cancelled';
};

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
  const compressedPumpState: CompressedPumpState = {error: null};
  let writerClosed = false;
  const cancellation = createPngCancellationState(options, () => {
    abortCompressorWriter(writer, new Error('PNG export cancelled'));
  });
  const compressedPump = observeCompressedPump(pumpCompressedChunks(reader, sink, options, cancellation), compressedPumpState);
  try {
    await writeCompressedScanlines(writer, frame, palette, options, cancellation);
    throwCompressedPumpError(compressedPumpState);
    await waitForCancellablePromise(writer.close(), cancellation);
    writerClosed = true;
    await waitForCancellablePromise(compressedPump, cancellation);
    throwCompressedPumpError(compressedPumpState);
    assertNotCancelled(options);
    await writeIendChunk(sink);
  } catch (error) {
    const pendingError = compressedPumpState.error ?? error;
    if (!writerClosed) {
      abortCompressorWriter(writer, pendingError);
    }
    if (!options.shouldCancel()) {
      await compressedPump;
    }
    throw pendingError;
  } finally {
    cancellation.unregister();
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
async function writeCompressedScanlines(writer: WritableStreamDefaultWriter<BufferSource>, frame: PackedRecordedFrame, palette: IndexedPngPalette, options: IndexedPngFrameOptions, cancellation: PngCancellationState): Promise<void> {
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
 * @param {PngCancellationState} cancellation active cancellation state.
 */
async function writeScanlineBlock(writer: WritableStreamDefaultWriter<BufferSource>, block: Uint8Array, usedRows: number, scanlineBytes: number, cancellation: PngCancellationState): Promise<void> {
  const usedBytes = usedRows * scanlineBytes;
  await waitForCancellablePromise(writer.write(block.subarray(0, usedBytes).slice()), cancellation);
}

/**
 * Pumps compressor output into PNG IDAT chunks.
 *
 * @async
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader compressor output reader.
 * @param {PngByteSink} sink target png byte sink.
 * @param {IndexedPngFrameOptions} options png encode options.
 * @param {PngCancellationState} cancellation active cancellation state.
 */
async function pumpCompressedChunks(reader: ReadableStreamDefaultReader<Uint8Array>, sink: PngByteSink, options: IndexedPngFrameOptions, cancellation: PngCancellationState): Promise<void> {
  let done = false;
  while (!done) {
    assertNotCancelled(options);
    const result = await waitForCancellablePromise(reader.read(), cancellation);
    done = result.done;
    if (!done && result.value) {
      await waitForCancellablePromise(writePngChunk(sink, IDAT_CHUNK_TYPE, result.value), cancellation);
    }
  }
}

/**
 * Creates active PNG cancellation state.
 *
 * @param {IndexedPngFrameOptions} options png encode options.
 * @param {() => void} onCancel cancellation side effect.
 * @returns {PngCancellationState} cancellation state.
 */
function createPngCancellationState(options: IndexedPngFrameOptions, onCancel: () => void): PngCancellationState {
  let resolveCancel: () => void = () => undefined;
  const state: PngCancellationState = {
    cancelled: options.shouldCancel(),
    promise: new Promise<void>(resolve => {
      resolveCancel = resolve;
    }),
    unregister: () => undefined
  };
  const cancel = () => {
    if (!state.cancelled) {
      state.cancelled = true;
      resolveCancel();
    }
    onCancel();
  };
  state.unregister = options.onCancelRequested(cancel);
  if (state.cancelled) {
    resolveCancel();
  }
  return state;
}

/**
 * Awaits a promise while allowing active PNG cancellation to win the race.
 *
 * @async
 * @template T
 * @param {Promise<T>} promise operation promise.
 * @param {PngCancellationState} cancellation active cancellation state.
 * @returns {Promise<T>} operation result.
 */
async function waitForCancellablePromise<T>(promise: Promise<T>, cancellation: PngCancellationState): Promise<T> {
  assertPngCancellationState(cancellation);
  const observedPromise: Promise<PngCancellableResult<T>> = promise.then(value => ({
    type: 'value',
    value
  }), error => ({
    type: 'error',
    error
  }));
  const result = await Promise.race([
    observedPromise,
    cancellation.promise.then((): PngCancellableResult<T> => ({type: 'cancelled'}))
  ]);
  if (result.type === 'error') {
    throw result.error;
  }
  if (result.type === 'cancelled') {
    throw new Error('PNG export cancelled');
  }
  return result.value;
}

/**
 * Observes a background compressor pump without letting it create an unhandled rejection.
 *
 * @param {Promise<void>} pump compressor pump promise.
 * @param {CompressedPumpState} state pump state to update on failure.
 * @returns {Promise<void>} observed pump promise.
 */
function observeCompressedPump(pump: Promise<void>, state: CompressedPumpState): Promise<void> {
  return pump.catch(error => {
    state.error = error;
  });
}

/**
 * Throws the captured compressor pump error, when present.
 *
 * @param {CompressedPumpState} state observed compressor pump state.
 */
function throwCompressedPumpError(state: CompressedPumpState): void {
  if (state.error !== null) {
    throw state.error;
  }
}

/**
 * Aborts the compressor writer and preserves the original export failure.
 *
 * @param {WritableStreamDefaultWriter<BufferSource>} writer compressor writer.
 * @param {unknown} reason original export failure reason.
 */
function abortCompressorWriter(writer: WritableStreamDefaultWriter<BufferSource>, reason: unknown): void {
  writer.abort(reason).catch(error => {
    console.warn('[GOLT] Failed to abort PNG compressor after export failure:', error);
  });
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

/**
 * Throws when PNG cancellation has already been requested.
 *
 * @param {PngCancellationState} cancellation active cancellation state.
 */
function assertPngCancellationState(cancellation: PngCancellationState): void {
  if (cancellation.cancelled) {
    throw new Error('PNG export cancelled');
  }
}

export {writeIndexedPngFrame};
