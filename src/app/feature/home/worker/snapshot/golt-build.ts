import {collectGoltStateStream, prepareGoltState} from './golt-build-stream';
import {createGoltPrefix, RAW_DEFLATE_CODEC} from './golt-format';
import {GoltStateData, SNAPSHOT_STREAMING_THRESHOLD_BYTES, SnapshotProgressReporter} from './golt-types';
import {chooseTightStorageGridFormat, gridByteSize} from '../../util/grid-format';

/**
 * Compresses bytes with the `.golt` raw deflate codec.
 *
 * @export
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
 * @export
 * @async
 * @param {GoltStateData} data state data to serialize.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @returns {Promise<Uint8Array>} serialized `.golt` file bytes.
 */
export async function buildGoltStateFile(data: GoltStateData, reportProgress: SnapshotProgressReporter): Promise<Uint8Array> {
  let output: Uint8Array;
  if (gridByteSize(data, chooseTightStorageGridFormat(data.tribes.length)) >= SNAPSHOT_STREAMING_THRESHOLD_BYTES) {
    output = await collectGoltStateStream(data, reportProgress);
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
