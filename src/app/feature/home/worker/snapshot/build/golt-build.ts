import {collectGoltStateStream, prepareGoltState, writeGoltStateStream} from './golt-build-stream';
import {ByteSink, StreamCancellationOptions} from '../../io/model/stream';
import {createGoltPrefix} from '../logic/golt-format';
import {RAW_DEFLATE_CODEC} from '../model/golt-format';
import {ParsedGoltState, SNAPSHOT_STREAMING_THRESHOLD_BYTES, SnapshotProgressReporter} from '../model/golt-types';

import {chooseTightStorageGridFormat, gridByteSize} from '~gol/feature/home/logic/grid-format';

/**
 * Compresses bytes with the `.golt` raw deflate codec.
 *
 * @async
 * @param {Uint8Array} data uncompressed packed grid bytes.
 * @returns {Promise<ArrayBuffer>} compressed bytes.
 */
async function deflateRaw(data: Uint8Array): Promise<ArrayBuffer> {
  const stream = new CompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  const output = new Response(stream.readable).arrayBuffer();
  await writer.write(data);
  await writer.close();
  return output;
}

/**
 * Builds a `.golt` state file.
 *
 * @async
 * @param {ParsedGoltState} data state data to serialize.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @param {StreamCancellationOptions} options streaming cancellation options.
 * @returns {Promise<Uint8Array>} serialized `.golt` file bytes.
 */
export async function buildGoltStateFile(data: ParsedGoltState, reportProgress: SnapshotProgressReporter, options: StreamCancellationOptions): Promise<Uint8Array> {
  let output: Uint8Array;
  if (shouldStreamGoltState(data)) {
    output = await collectGoltStateStream(data, reportProgress, options);
  } else {
    reportProgress({
      mode: 'indeterminate',
      percent: null,
      status: 'Compressing grid'
    });
    const {headerBytes, gridBytes} = prepareGoltState(data);
    const compressedGrid = new Uint8Array(await deflateRaw(gridBytes));
    const prefix = createGoltPrefix(headerBytes);
    output = new Uint8Array(prefix.byteLength + compressedGrid.byteLength);
    output.set(prefix, 0);
    output.set(compressedGrid, prefix.byteLength);
  }
  return output;
}

/**
 * Writes a `.golt` state file to a byte sink.
 *
 * @async
 * @param {ParsedGoltState} data state data to serialize.
 * @param {ByteSink} sink byte sink that receives serialized bytes.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @param {StreamCancellationOptions} options streaming cancellation options.
 */
export async function writeGoltStateFileToSink(data: ParsedGoltState, sink: ByteSink, reportProgress: SnapshotProgressReporter, options: StreamCancellationOptions): Promise<void> {
  if (shouldStreamGoltState(data)) {
    await writeGoltStateStream(data, sink, reportProgress, options);
  } else {
    await sink.write(await buildGoltStateFile(data, reportProgress, options));
  }
}

/**
 * Whether the snapshot should use the streaming `.golt` path.
 *
 * @param {ParsedGoltState} data state data to serialize.
 * @returns {boolean} whether the target packed grid is at least the streaming threshold.
 */
export function shouldStreamGoltState(data: ParsedGoltState): boolean {
  return gridByteSize(data, chooseTightStorageGridFormat(data.tribes.length)) >= SNAPSHOT_STREAMING_THRESHOLD_BYTES;
}
