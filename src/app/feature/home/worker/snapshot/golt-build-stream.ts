import {createGoltPrefix, RAW_DEFLATE_CODEC} from './golt-format';
import {ByteSink, GoltStateData, SnapshotProgressReporter} from './golt-types';
import {repackPackedGrid} from './packed-repack';
import {chooseTightStorageGridFormat, gridFormatFromMetadata, gridFormatMetadata} from '../../util/grid-format';

/**
 * Chunk size used when streaming grid bytes into the compressor.
 *
 * @type {number}
 */
const SNAPSHOT_STREAM_CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * Pumps compressed chunks from a stream reader into a sink.
 *
 * @async
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader compressed stream reader.
 * @param {ByteSink} sink sink that receives compressed chunks.
 */
async function pumpCompressedChunks(reader: ReadableStreamDefaultReader<Uint8Array>, sink: ByteSink): Promise<void> {
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      await sink.write(result.value);
    }
  }
}

/**
 * Streams packed grid bytes into a compression stream.
 *
 * @async
 * @param {WritableStreamDefaultWriter<Uint8Array>} writer compression stream writer.
 * @param {Uint8Array} gridBytes packed grid bytes to compress.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 */
async function writeGridBytes(writer: WritableStreamDefaultWriter<Uint8Array>, gridBytes: Uint8Array, reportProgress: SnapshotProgressReporter): Promise<void> {
  let offset = 0;
  while (offset < gridBytes.byteLength) {
    const end = Math.min(offset + SNAPSHOT_STREAM_CHUNK_BYTES, gridBytes.byteLength);
    await writer.write(gridBytes.subarray(offset, end));
    offset = end;
    reportProgress({
      mode: 'determinate',
      percent: Math.min(95, Math.round((offset / gridBytes.byteLength) * 90) + 5),
      status: 'Compressing grid'
    });
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
 */
export async function writeGoltStateStream(data: GoltStateData, sink: ByteSink, reportProgress: SnapshotProgressReporter): Promise<void> {
  const {headerBytes, gridBytes} = prepareGoltState(data);
  await sink.write(createGoltPrefix(headerBytes));
  const stream = new CompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const pump = pumpCompressedChunks(reader, sink);
  reportProgress({
    mode: 'determinate',
    percent: 5,
    status: 'Compressing grid'
  });
  await writeGridBytes(writer, gridBytes, reportProgress);
  await writer.close();
  await pump;
  reportProgress({
    mode: 'determinate',
    percent: 100,
    status: 'Preparing snapshot'
  });
}

/**
 * Collects a streamed `.golt` state into one byte array for browser download handoff.
 *
 * @export
 * @async
 * @param {GoltStateData} data state data to serialize.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @returns {Promise<Uint8Array>} serialized `.golt` file bytes.
 */
export async function collectGoltStateStream(data: GoltStateData, reportProgress: SnapshotProgressReporter): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  await writeGoltStateStream(data, {
    write: async chunk => {
      chunks.push(chunk);
      totalBytes += chunk.byteLength;
    }
  }, reportProgress);
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
  const headerBytes = new TextEncoder().encode(JSON.stringify({
    generation: data.generation,
    cols: data.cols,
    rows: data.rows,
    gridFormat: gridFormatMetadata(targetFormat),
    tribes: data.tribes.map(t => ({id: t.id, color: t.color})),
    rules: data.rules
  }));
  return {headerBytes, gridBytes};
}
