import {GridFormat} from '../../../model/grid-format';
import {chooseTightStorageGridFormat, gridFormatFromMetadata, gridFormatMetadata} from '../../../util/grid-format';
import {createGoltPrefix, RAW_DEFLATE_CODEC} from '../model/golt-format';
import {ByteSink, GoltStateData, SnapshotProgressReporter} from '../model/golt-types';
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
 * Writes a `.golt` state file to a byte sink using a streaming-shaped deflate path.
 *
 * @export
 * @async
 * @param {GoltStateData} data state data to serialize.
 * @param {ByteSink} sink byte sink that receives serialized chunks.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 */
export async function writeGoltStateStream(data: GoltStateData, sink: ByteSink, reportProgress: SnapshotProgressReporter): Promise<void> {
  const targetFormat = chooseTightStorageGridFormat(data.tribes.length);
  const sourceFormat = gridFormatFromMetadata(data.gridFormat);
  const headerBytes = createGoltHeaderBytes(data, targetFormat);
  await sink.write(createGoltPrefix(headerBytes));
  const stream = new CompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  let pumpFailure: Error | null = null;
  const pump = pumpCompressedChunks(reader, sink).catch(error => {
    pumpFailure = error instanceof Error ? error : new Error(String(error));
  });
  reportProgress({
    mode: 'determinate',
    percent: 5,
    status: 'Compressing grid'
  });
  try {
    await writeRepackedGridToSink(data.grid, data, sourceFormat, targetFormat, {write: chunk => writer.write(chunk)}, reportProgress);
    await writer.close();
    await pump;
    if (pumpFailure) {
      throw pumpFailure;
    }
    reportProgress({
      mode: 'determinate',
      percent: 100,
      status: 'Preparing snapshot'
    });
  } catch (error) {
    await writer.abort(error).catch(() => undefined);
    await reader.cancel(error).catch(() => undefined);
    await pump;
    throw error;
  }
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
  const headerBytes = createGoltHeaderBytes(data, targetFormat);
  return {headerBytes, gridBytes};
}
