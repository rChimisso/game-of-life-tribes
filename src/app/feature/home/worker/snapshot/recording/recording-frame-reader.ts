import {RecordingFrameData, RecordingFrameRef} from './recording-frame-types';
import {gridByteSize, gridFormatFromMetadata} from '../../../util/grid-format';
import {RAW_DEFLATE_CODEC} from '../model/golt-format';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Directory name for OPFS recording storage.
 *
 * @type {string}
 */
const OPFS_RECORDING_DIR = 'gol-recording';

/**
 * Decompresses an OPFS recording chunk.
 *
 * @async
 * @param {ArrayBuffer} compressed compressed chunk bytes.
 * @returns {Promise<ArrayBuffer>} decompressed packed chunk bytes.
 */
async function decompressChunk(compressed: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new DecompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  const output = new Response(stream.readable).arrayBuffer();
  await writer.write(new Uint8Array(compressed));
  await writer.close();
  return output;
}

/**
 * Reads one packed recorded frame from OPFS.
 *
 * @export
 * @async
 * @param {Grid} grid recording grid dimensions.
 * @param {RecordingFrameRef} ref frame reference to read.
 * @returns {Promise<RecordingFrameData>} packed recorded frame data.
 */
export async function readRecordingFrame(grid: Grid, ref: RecordingFrameRef): Promise<RecordingFrameData> {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle(OPFS_RECORDING_DIR);
  const fileHandle = await dir.getFileHandle(ref.chunk.filename);
  const blob = await fileHandle.getFile();
  const storedData = await blob.arrayBuffer();
  const chunkData = ref.chunk.codec === RAW_DEFLATE_CODEC ? new Uint8Array(await decompressChunk(storedData)) : new Uint8Array(storedData);
  const frameByteSize = gridByteSize(grid, gridFormatFromMetadata(ref.gridFormat));
  const byteOffset = ref.localFrameIndex * frameByteSize;
  return {
    generation: ref.generation,
    packed: chunkData.subarray(byteOffset, byteOffset + frameByteSize)
  };
}

export type {RecordingFrameData};
