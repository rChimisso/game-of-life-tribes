import {abortWritableStreamWriter, cancelReadableStreamReader, collectByteSinkOutput, createStreamCancellationState, pumpReadableChunks, waitForCancellablePromise} from '../../io/logic/stream';
import {ByteSink, StreamCancellationOptions} from '../../io/model/stream';
import {createGoltPrefix} from '../logic/golt-format';
import {RAW_DEFLATE_CODEC} from '../model/golt-format';
import {ParsedGoltState, SNAPSHOT_EXPORT_CANCELLED_ERROR_MESSAGE, SnapshotProgressReporter} from '../model/golt-types';
import {repackPackedGrid, writeRepackedGridToSink} from '../packing/packed-repack';

import {chooseTightStorageGridFormat, gridFormatFromMetadata, gridFormatMetadata} from '~gol/feature/home/logic/grid-format';
import {GridFormat} from '~gol/feature/home/model/grid-format';

/**
 * Creates the serialized `.golt` JSON header.
 *
 * @param {ParsedGoltState} data state data to serialize.
 * @param {GridFormat} targetFormat target storage grid format.
 * @returns {Uint8Array} encoded header bytes.
 */
function createGoltHeaderBytes(data: ParsedGoltState, targetFormat: GridFormat): Uint8Array {
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
 * Writes a `.golt` state file to a byte sink using a streaming-shaped deflate path.
 *
 * @async
 * @param {ParsedGoltState} data state data to serialize.
 * @param {ByteSink} sink byte sink that receives serialized chunks.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @param {StreamCancellationOptions} options stream cancellation options.
 */
export async function writeGoltStateStream(data: ParsedGoltState, sink: ByteSink, reportProgress: SnapshotProgressReporter, options: StreamCancellationOptions): Promise<void> {
  const targetFormat = chooseTightStorageGridFormat(data.tribes.length);
  const sourceFormat = gridFormatFromMetadata(data.gridFormat);
  const headerBytes = createGoltHeaderBytes(data, targetFormat);
  const stream = new CompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  let pumpFailure: Error | null = null;
  const cancellation = createStreamCancellationState(options, () => {
    abortWritableStreamWriter(writer, new Error(SNAPSHOT_EXPORT_CANCELLED_ERROR_MESSAGE), '[GOLT] Failed to abort snapshot compressor after export failure:');
  });
  const pump = pumpReadableChunks(reader, chunk => sink.write(chunk), cancellation, SNAPSHOT_EXPORT_CANCELLED_ERROR_MESSAGE).catch(error => {
    pumpFailure = error instanceof Error ? error : new Error(String(error));
  });
  reportProgress({
    mode: 'determinate',
    percent: 5,
    status: 'Compressing grid'
  });
  try {
    await waitForCancellablePromise(sink.write(createGoltPrefix(headerBytes)), cancellation, SNAPSHOT_EXPORT_CANCELLED_ERROR_MESSAGE);
    await writeRepackedGridToSink(data.grid, data, sourceFormat, targetFormat, {
      write: chunk => waitForCancellablePromise(writer.write(chunk), cancellation, SNAPSHOT_EXPORT_CANCELLED_ERROR_MESSAGE)
    }, reportProgress);
    await waitForCancellablePromise(writer.close(), cancellation, SNAPSHOT_EXPORT_CANCELLED_ERROR_MESSAGE);
    await waitForCancellablePromise(pump, cancellation, SNAPSHOT_EXPORT_CANCELLED_ERROR_MESSAGE);
    if (pumpFailure) {
      throw pumpFailure;
    }
    reportProgress({
      mode: 'determinate',
      percent: 100,
      status: 'Preparing snapshot'
    });
  } catch (error) {
    abortWritableStreamWriter(writer, error, '[GOLT] Failed to abort snapshot compressor after export failure:');
    cancelReadableStreamReader(reader, error, '[GOLT] Failed to cancel snapshot compressor reader after export failure:');
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
 * @async
 * @param {ParsedGoltState} data state data to serialize.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @param {StreamCancellationOptions} options stream cancellation options.
 * @returns {Promise<Uint8Array>} serialized `.golt` file bytes.
 */
export async function collectGoltStateStream(data: ParsedGoltState, reportProgress: SnapshotProgressReporter, options: StreamCancellationOptions): Promise<Uint8Array> {
  return collectByteSinkOutput(sink => writeGoltStateStream(data, sink, reportProgress, options));
}

/**
 * Creates the normalized header and packed grid bytes for a `.golt` snapshot.
 *
 * @async
 * @param {ParsedGoltState} data state data to normalize.
 * @returns {{headerBytes: Uint8Array; gridBytes: Uint8Array}} encoded header and packed grid bytes.
 */
export function prepareGoltState(data: ParsedGoltState): {headerBytes: Uint8Array; gridBytes: Uint8Array} {
  const targetFormat = chooseTightStorageGridFormat(data.tribes.length);
  const sourceFormat = gridFormatFromMetadata(data.gridFormat);
  const targetGrid = repackPackedGrid(data.grid, data, sourceFormat, targetFormat);
  const gridBytes = new Uint8Array(targetGrid.buffer, targetGrid.byteOffset, targetGrid.byteLength);
  const headerBytes = createGoltHeaderBytes(data, targetFormat);
  return {headerBytes, gridBytes};
}
