import {chooseTightStorageGridFormat, gridFormatFromMetadata, gridFormatMetadata} from '../../../logic/grid-format';
import {GridFormat} from '../../../model/grid-format';
import {createGoltPrefix, RAW_DEFLATE_CODEC} from '../model/golt-format';
import {ByteSink, GoltStateData, SnapshotProgressReporter, SnapshotStreamOptions} from '../model/golt-types';
import {repackPackedGrid, writeRepackedGridToSink} from '../packing/packed-repack';

/**
 * Creates the serialized `.golt` JSON header.
 *
 * @param {GoltStateData} data state data to serialize.
 * @param {GridFormat} targetFormat target storage grid format.
 * @returns {Uint8Array} encoded header bytes.
 */
function createGoltHeaderBytes(data: GoltStateData, targetFormat: GridFormat): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({
    generation: data.generation,
    cols: data.cols,
    rows: data.rows,
    gridFormat: gridFormatMetadata(targetFormat),
    tribes: data.tribes.map(t => ({id: t.id, color: t.color})),
    rules: data.rules
  }));
}

/**
 * Cancellation state shared by `.golt` stream operations.
 *
 * @interface GoltStreamCancellationState
 * @typedef {GoltStreamCancellationState}
 */
interface GoltStreamCancellationState {
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
 * Result of an awaited `.golt` stream operation raced against cancellation.
 *
 * @typedef {GoltCancellableResult}
 * @template T
 */
type GoltCancellableResult<T> = {
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
 * Pumps compressed chunks from a stream reader into a sink.
 *
 * @async
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader compressed stream reader.
 * @param {ByteSink} sink sink that receives compressed chunks.
 * @param {GoltStreamCancellationState} cancellation active cancellation state.
 */
async function pumpCompressedChunks(reader: ReadableStreamDefaultReader<Uint8Array>, sink: ByteSink, cancellation: GoltStreamCancellationState): Promise<void> {
  let done = false;
  while (!done) {
    const result = await waitForCancellablePromise(reader.read(), cancellation);
    done = result.done;
    if (result.value) {
      await waitForCancellablePromise(sink.write(result.value), cancellation);
    }
  }
}

/**
 * Creates active `.golt` stream cancellation state.
 *
 * @param {SnapshotStreamOptions} options stream cancellation options.
 * @param {() => void} onCancel cancellation side effect.
 * @returns {GoltStreamCancellationState} cancellation state.
 */
function createGoltStreamCancellationState(options: SnapshotStreamOptions, onCancel: () => void): GoltStreamCancellationState {
  let resolveCancel: () => void = () => undefined;
  const state: GoltStreamCancellationState = {
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
 * Awaits a promise while allowing active `.golt` cancellation to win the race.
 *
 * @async
 * @template T
 * @param {Promise<T>} promise operation promise.
 * @param {GoltStreamCancellationState} cancellation active cancellation state.
 * @returns {Promise<T>} operation result.
 */
async function waitForCancellablePromise<T>(promise: Promise<T>, cancellation: GoltStreamCancellationState): Promise<T> {
  assertGoltCancellationState(cancellation);
  const observedPromise: Promise<GoltCancellableResult<T>> = promise.then(value => ({
    type: 'value',
    value
  }), error => ({
    type: 'error',
    error
  }));
  const result = await Promise.race([observedPromise, cancellation.promise.then((): GoltCancellableResult<T> => ({type: 'cancelled'}))]);
  if (result.type === 'error') {
    throw result.error;
  }
  if (result.type === 'cancelled') {
    throw new Error('Snapshot export cancelled');
  }
  return result.value;
}

/**
 * Aborts the snapshot compressor writer.
 *
 * @param {WritableStreamDefaultWriter<BufferSource>} writer compressor writer.
 * @param {unknown} reason original failure reason.
 */
function abortCompressorWriter(writer: WritableStreamDefaultWriter<BufferSource>, reason: unknown): void {
  writer.abort(reason).catch(error => {
    console.warn('[GOLT] Failed to abort snapshot compressor after export failure:', error);
  });
}

/**
 * Cancels the snapshot compressor reader.
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader compressor reader.
 * @param {unknown} reason original failure reason.
 */
function cancelCompressorReader(reader: ReadableStreamDefaultReader<Uint8Array>, reason: unknown): void {
  reader.cancel(reason).catch(error => {
    console.warn('[GOLT] Failed to cancel snapshot compressor reader after export failure:', error);
  });
}

/**
 * Throws when `.golt` stream cancellation has already been requested.
 *
 * @param {GoltStreamCancellationState} cancellation active cancellation state.
 */
function assertGoltCancellationState(cancellation: GoltStreamCancellationState): void {
  if (cancellation.cancelled) {
    throw new Error('Snapshot export cancelled');
  }
}

/**
 * Writes a `.golt` state file to a byte sink using a streaming-shaped deflate path.
 *
 * @export
 * @async
 * @param {GoltStateData} data state data to serialize.
 * @param {ByteSink} sink byte sink that receives serialized chunks.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @param {SnapshotStreamOptions} options stream cancellation options.
 */
export async function writeGoltStateStream(data: GoltStateData, sink: ByteSink, reportProgress: SnapshotProgressReporter, options: SnapshotStreamOptions): Promise<void> {
  const targetFormat = chooseTightStorageGridFormat(data.tribes.length);
  const sourceFormat = gridFormatFromMetadata(data.gridFormat);
  const headerBytes = createGoltHeaderBytes(data, targetFormat);
  const stream = new CompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  let pumpFailure: Error | null = null;
  const cancellation = createGoltStreamCancellationState(options, () => {
    abortCompressorWriter(writer, new Error('Snapshot export cancelled'));
  });
  const pump = pumpCompressedChunks(reader, sink, cancellation).catch(error => {
    pumpFailure = error instanceof Error ? error : new Error(String(error));
  });
  reportProgress({
    mode: 'determinate',
    percent: 5,
    status: 'Compressing grid'
  });
  try {
    await waitForCancellablePromise(sink.write(createGoltPrefix(headerBytes)), cancellation);
    await writeRepackedGridToSink(data.grid, data, sourceFormat, targetFormat, {
      write: chunk => waitForCancellablePromise(writer.write(chunk), cancellation)
    }, reportProgress);
    await waitForCancellablePromise(writer.close(), cancellation);
    await waitForCancellablePromise(pump, cancellation);
    if (pumpFailure) {
      throw pumpFailure;
    }
    reportProgress({
      mode: 'determinate',
      percent: 100,
      status: 'Preparing snapshot'
    });
  } catch (error) {
    abortCompressorWriter(writer, error);
    cancelCompressorReader(reader, error);
    if (!options.shouldCancel()) {
      await pump;
    }
    throw error;
  } finally {
    cancellation.unregister();
  }
}

/**
 * Collects a streamed `.golt` state into one byte array for browser download handoff.
 *
 * @export
 * @async
 * @param {GoltStateData} data state data to serialize.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @param {SnapshotStreamOptions} options stream cancellation options.
 * @returns {Promise<Uint8Array>} serialized `.golt` file bytes.
 */
export async function collectGoltStateStream(data: GoltStateData, reportProgress: SnapshotProgressReporter, options: SnapshotStreamOptions): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  await writeGoltStateStream(data, {
    write: async chunk => {
      chunks.push(chunk);
      totalBytes += chunk.byteLength;
    }
  }, reportProgress, options);
  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

/**
 * Creates the normalized header and packed grid bytes for a `.golt` snapshot.
 *
 * @export
 * @async
 * @param {GoltStateData} data state data to normalize.
 * @returns {{headerBytes: Uint8Array; gridBytes: Uint8Array}} encoded header and packed grid bytes.
 */
export function prepareGoltState(data: GoltStateData): {headerBytes: Uint8Array; gridBytes: Uint8Array} {
  const targetFormat = chooseTightStorageGridFormat(data.tribes.length);
  const sourceFormat = gridFormatFromMetadata(data.gridFormat);
  const targetGrid = repackPackedGrid(data.grid, data, sourceFormat, targetFormat);
  const gridBytes = new Uint8Array(targetGrid.buffer, targetGrid.byteOffset, targetGrid.byteLength);
  const headerBytes = createGoltHeaderBytes(data, targetFormat);
  return {headerBytes, gridBytes};
}
