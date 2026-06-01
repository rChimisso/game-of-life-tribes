import {PackedRecordedFrame, RecordingChunkRange, RecordingFrameIteratorOptions, RecordingFrameSelection} from './recording-frame-types';
import {alignPackedBytesToWords, gridByteSize, gridFormatFromMetadata} from '../../logic/grid-format';
import {DownloadFrameRange} from '../../model/download';
import {ChunkMeta, RecordingManifest} from '../../model/recording';
import {RAW_DEFLATE_CODEC} from '../snapshot/model/golt-format';
import {countRecordingFrames} from '../snapshot/recording/recording-frame-ref';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Directory name for OPFS recording storage.
 *
 * @type {string}
 */
const OPFS_RECORDING_DIR = 'gol-recording';

/**
 * Resolves a one-based UI frame range into zero-based recording indexes.
 *
 * @export
 * @param {RecordingManifest} manifest recording manifest.
 * @param {(DownloadFrameRange | null)} frameRange selected UI frame range.
 * @returns {RecordingFrameSelection} resolved selection.
 */
function resolveRecordingFrameSelection(manifest: RecordingManifest, frameRange: DownloadFrameRange | null): RecordingFrameSelection {
  const totalFrames = countRecordingFrames(manifest);
  const startIndex = frameRange && totalFrames > 0 ? Math.max(0, Math.min(totalFrames - 1, frameRange.startFrame - 1)) : 0;
  const endIndex = frameRange && totalFrames > 0 ? Math.max(startIndex, Math.min(totalFrames - 1, frameRange.endFrame - 1)) : Math.max(0, totalFrames - 1);
  const framesTotal = totalFrames > 0 ? endIndex - startIndex + 1 : 0;
  return {
    totalFrames,
    startIndex,
    endIndex,
    framesTotal,
    selectedStartFrame: framesTotal > 0 ? startIndex + 1 : 0,
    selectedEndFrame: framesTotal > 0 ? endIndex + 1 : 0
  };
}

/**
 * Iterates selected recorded frames while reading each selected chunk once.
 *
 * @export
 * @async
 * @param {Grid & {manifest: RecordingManifest}} recording recording dimensions and manifest.
 * @param {(DownloadFrameRange | null)} frameRange selected UI frame range.
 * @param {RecordingFrameIteratorOptions} [options] iteration options.
 */
async function *iterateRecordedFrames(recording: Grid & {manifest: RecordingManifest}, frameRange: DownloadFrameRange | null, options: RecordingFrameIteratorOptions = {}): AsyncIterable<PackedRecordedFrame> {
  const selection = resolveRecordingFrameSelection(recording.manifest, frameRange);
  const chunkRanges = buildChunkRanges(recording.manifest);
  const selectedRanges = chunkRanges.filter(range => selection.framesTotal > 0 && range.endIndex >= selection.startIndex && range.startIndex <= selection.endIndex);
  let chunksProcessed = 0;
  let framesProcessed = 0;
  options.onProgress?.({
    chunksProcessed,
    chunksTotal: selectedRanges.length,
    framesProcessed,
    framesTotal: selection.framesTotal,
    generation: null
  });
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle(OPFS_RECORDING_DIR);
  for (const range of selectedRanges) {
    assertNotCancelled(options);
    const chunkData = await readChunkData(directory, range.chunk);
    chunksProcessed++;
    const format = gridFormatFromMetadata(range.chunk.gridFormat);
    const frameByteSize = gridByteSize(recording, format);
    const localStart = Math.max(0, selection.startIndex - range.startIndex);
    const localEnd = Math.min(range.chunk.blockCount - 1, selection.endIndex - range.startIndex);
    for (let localFrameIndex = localStart; localFrameIndex <= localEnd; localFrameIndex++) {
      assertNotCancelled(options);
      const byteOffset = localFrameIndex * frameByteSize;
      const packed = chunkData.subarray(byteOffset, byteOffset + frameByteSize);
      const generation = range.chunk.generations[localFrameIndex] ?? (range.chunk.generationStart + localFrameIndex);
      framesProcessed++;
      options.onProgress?.({
        chunksProcessed,
        chunksTotal: selectedRanges.length,
        framesProcessed,
        framesTotal: selection.framesTotal,
        generation
      });
      yield {
        globalFrameIndex: range.startIndex + localFrameIndex,
        localFrameIndex,
        generation,
        cols: recording.cols,
        rows: recording.rows,
        packed,
        words: alignPackedBytesToWords(packed),
        gridFormat: range.chunk.gridFormat,
        format
      };
    }
  }
}

/**
 * Builds global frame spans for all manifest chunks.
 *
 * @param {RecordingManifest} manifest recording manifest.
 * @returns {RecordingChunkRange[]} chunk ranges.
 */
function buildChunkRanges(manifest: RecordingManifest): RecordingChunkRange[] {
  const ranges: RecordingChunkRange[] = [];
  let nextStart = 0;
  for (const chunk of manifest.chunks) {
    const startIndex = nextStart;
    const endIndex = startIndex + chunk.blockCount - 1;
    ranges.push({
      chunk,
      startIndex,
      endIndex
    });
    nextStart = endIndex + 1;
  }
  return ranges;
}

/**
 * Reads and inflates one recorded chunk.
 *
 * @async
 * @param {FileSystemDirectoryHandle} directory opfs recording directory.
 * @param {ChunkMeta} chunk recorded chunk metadata.
 * @returns {Promise<Uint8Array>} decoded chunk bytes.
 */
async function readChunkData(directory: FileSystemDirectoryHandle, chunk: ChunkMeta): Promise<Uint8Array> {
  const fileHandle = await directory.getFileHandle(chunk.filename);
  const file = await fileHandle.getFile();
  const storedData = await file.arrayBuffer();
  const decoded = chunk.codec === RAW_DEFLATE_CODEC ? await decompressChunk(storedData) : storedData;
  return new Uint8Array(decoded);
}

/**
 * Decompresses a recorded deflate chunk.
 *
 * @async
 * @param {ArrayBuffer} compressed compressed chunk bytes.
 * @returns {Promise<ArrayBuffer>} decompressed chunk bytes.
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
 * Throws when iterator cancellation has been requested.
 *
 * @param {RecordingFrameIteratorOptions} options iteration options.
 */
function assertNotCancelled(options: RecordingFrameIteratorOptions): void {
  if (options.shouldCancel?.() === true) {
    throw new Error('Recording frame iteration cancelled');
  }
}

export {iterateRecordedFrames, resolveRecordingFrameSelection};

export type {PackedRecordedFrame, RecordingFrameIterationProgress, RecordingFrameIteratorOptions, RecordingFrameSelection} from './recording-frame-types';
