import {CHUNK_BUFFER_CAP, MAJOR_BUFFER_ALLOCATION_YIELD_BYTES, MAX_PENDING_OPFS_WRITES, RAW_PACKED_CODEC, RecordingLimitsPayload, STAGING_RING_SIZE, StorageQuotaSnapshot} from '../model/recording-runtime';

import {GridFormatMetadata} from '~gol/feature/home/model/grid-format';
import {ChunkMeta, RecordingManifest} from '~gol/feature/home/model/recording';
import {OPFS_PENDING_WRITE_BYTE_BUDGET, RECORDING_MAX_FRAME_BYTES} from '~gol/feature/home/model/recording-limits';

/**
 * Counts the specified data in the sealed chunks, with an optional starting count.
 *
 * @param {readonly ChunkMeta[]} sealedChunks sealed recording chunks.
 * @param {{[K in keyof ChunkMeta]: ChunkMeta[K] extends number ? K : never}[keyof ChunkMeta]} data data to count.
 * @param {number} [additional=0] optional starting value.
 * @returns {number} total data count.
 */
function countSealedData(sealedChunks: readonly ChunkMeta[], data: {[K in keyof ChunkMeta]: ChunkMeta[K] extends number ? K : never}[keyof ChunkMeta], additional: number = 0): number {
  let count = additional;
  for (const chunk of sealedChunks) {
    count += chunk[data];
  }
  return count;
}

/**
 * Computes the maximum safe simulation buffer size supported by the device.
 *
 * @param {number} maxBufferSize device `maxBufferSize` limit.
 * @param {number} maxStorageBufferBindingSize device `maxStorageBufferBindingSize` limit.
 * @returns {number} maximum simulation buffer size in bytes.
 */
export function maxSimulationBufferBytes(maxBufferSize: number, maxStorageBufferBindingSize: number): number {
  return Math.min(maxBufferSize, maxStorageBufferBindingSize);
}

/**
 * Computes the maximum safe recording frame size for the current device.
 *
 * @param {number} maxSimulationBytes maximum simulation buffer size in bytes.
 * @returns {number} maximum recording frame size in bytes.
 */
export function maxRecordingBufferBytes(maxSimulationBytes: number): number {
  return Math.min(maxSimulationBytes, RECORDING_MAX_FRAME_BYTES);
}

/**
 * Computes the byte threshold before rebuild allocation yields.
 *
 * @param {number} maxSimulationBytes maximum simulation buffer size in bytes.
 * @returns {number} rebuild allocation yield threshold in bytes.
 */
export function majorBufferAllocationYieldBytes(maxSimulationBytes: number): number {
  return Math.min(maxSimulationBytes, MAJOR_BUFFER_ALLOCATION_YIELD_BYTES);
}

/**
 * Computes the worker VRAM budget used for simulation and recording buffers.
 *
 * @param {number} maxSimulationBytes maximum simulation buffer size in bytes.
 * @param {number} maxRecordingBytes maximum recording frame size in bytes.
 * @returns {number} VRAM budget in bytes.
 */
export function vramBudgetBytes(maxSimulationBytes: number, maxRecordingBytes: number): number {
  return Math.max(maxSimulationBytes * 2, maxRecordingBytes * 6);
}

/**
 * Checks whether recording is available for the current frame size.
 *
 * @param {number} frameByteSize frame size in bytes.
 * @param {number} maxRecordingBytes maximum recording frame size in bytes.
 * @returns {boolean} true when recording can use the current frame size.
 */
export function recordingAvailableForCurrentFrame(frameByteSize: number, maxRecordingBytes: number): boolean {
  return frameByteSize > 0 && frameByteSize <= maxRecordingBytes;
}

/**
 * Computes the byte size of the current simulation buffers.
 *
 * @param {number} frameByteSize frame size in bytes.
 * @param {number} fixedOverheadBytes fixed non-grid simulation buffer bytes.
 * @returns {number} simulation buffer footprint in bytes.
 */
export function simulationBufferBytes(frameByteSize: number, fixedOverheadBytes: number): number {
  return frameByteSize > 0 ? frameByteSize * 2 + fixedOverheadBytes : 0;
}

/**
 * Computes the byte size of the current recording buffers.
 *
 * @param {number} chunkFrameCapacity frame count per recording chunk.
 * @param {number} frameByteSize frame size in bytes.
 * @returns {number} recording buffer footprint in bytes.
 */
export function recordingBufferBytes(chunkFrameCapacity: number, frameByteSize: number): number {
  return chunkFrameCapacity >= 1 && frameByteSize > 0 ? chunkFrameCapacity * frameByteSize * (1 + STAGING_RING_SIZE) : 0;
}

/**
 * Returns the target byte size for one recording chunk.
 *
 * @param {number} frameByteSize frame size in bytes.
 * @param {number} maxRecordingBytes maximum recording frame size in bytes.
 * @returns {number} target chunk byte size.
 */
export function targetChunkBytes(frameByteSize: number, maxRecordingBytes: number): number {
  return frameByteSize < CHUNK_BUFFER_CAP ? Math.min(CHUNK_BUFFER_CAP, maxRecordingBytes) : frameByteSize;
}

/**
 * Computes the frame capacity of one recording chunk.
 *
 * @param {number} frameByteSize frame size in bytes.
 * @param {number} maxRecordingBytes maximum recording frame size in bytes.
 * @returns {number} frame capacity for one chunk.
 */
export function computeChunkFrameCapacity(frameByteSize: number, maxRecordingBytes: number): number {
  return recordingAvailableForCurrentFrame(frameByteSize, maxRecordingBytes) ? Math.max(1, Math.floor(targetChunkBytes(frameByteSize, maxRecordingBytes) / frameByteSize)) : 0;
}

/**
 * Returns the maximum number of pending OPFS writes allowed for the current chunk size.
 *
 * @param {number} chunkFrameCapacity frame count per recording chunk.
 * @param {number} frameByteSize frame size in bytes.
 * @returns {number} maximum pending OPFS writes.
 */
export function maxPendingOpfsWritesForCurrentChunk(chunkFrameCapacity: number, frameByteSize: number): number {
  return chunkFrameCapacity >= 1 && frameByteSize > 0 ? Math.max(1, Math.min(MAX_PENDING_OPFS_WRITES, Math.floor(OPFS_PENDING_WRITE_BYTE_BUDGET / (chunkFrameCapacity * frameByteSize)))) : MAX_PENDING_OPFS_WRITES;
}

/**
 * Recomputes whether recording backpressure should be active.
 *
 * @param {number} chunkFrameCapacity frame count per recording chunk.
 * @param {readonly boolean[]} stagingAvailable staging-slot availability flags.
 * @param {number} pendingOpfsWrites queued OPFS write count.
 * @param {number} maxPendingWrites allowed pending OPFS write count.
 * @param {boolean} backpressureActive current backpressure state.
 * @param {number} chunkFrameIndex recorded frames currently buffered.
 * @returns {boolean} next backpressure state.
 */
export function evaluateRecordingBackpressure(chunkFrameCapacity: number, stagingAvailable: readonly boolean[], pendingOpfsWrites: number, maxPendingWrites: number, backpressureActive: boolean, chunkFrameIndex: number): boolean {
  const stagingBackpressured = !stagingAvailable.some(value => value) && (backpressureActive || chunkFrameIndex >= chunkFrameCapacity);
  const pendingWriteLimit = backpressureActive ? Math.floor(maxPendingWrites / 2) + 1 : maxPendingWrites;
  return chunkFrameCapacity >= 1 && stagingAvailable.length > 0 && (stagingBackpressured || pendingOpfsWrites >= pendingWriteLimit);
}

/**
 * Returns whether the current chunk can be sealed and handed off for persistence.
 *
 * @param {number} pendingOpfsWrites queued OPFS write count.
 * @param {number} maxPendingWrites allowed pending OPFS write count.
 * @param {readonly boolean[]} stagingAvailable staging-slot availability flags.
 * @param {readonly GPUBuffer[]} stagingRing staging buffers.
 * @returns {boolean} true when the current chunk can be sealed.
 */
export function canSealCurrentChunk(pendingOpfsWrites: number, maxPendingWrites: number, stagingAvailable: readonly boolean[], stagingRing: readonly GPUBuffer[]): boolean {
  return pendingOpfsWrites < maxPendingWrites && stagingRing.some((buffer, index) => stagingAvailable[index] && buffer.mapState === 'unmapped');
}

/**
 * Returns whether the current frame can be recorded immediately.
 *
 * @param {boolean} recordingAvailable whether recording supports the current frame size.
 * @param {number} chunkFrameCapacity frame count per recording chunk.
 * @param {GPUBuffer | null} chunkGpuBuffer current recording chunk buffer.
 * @param {readonly GPUBuffer[]} stagingRing staging buffers.
 * @param {number} chunkFrameIndex buffered frame count.
 * @param {boolean} canSealChunk whether the current chunk can be sealed.
 * @returns {boolean} true when recording can proceed.
 */
export function canRecord(recordingAvailable: boolean, chunkFrameCapacity: number, chunkGpuBuffer: GPUBuffer | null, stagingRing: readonly GPUBuffer[], chunkFrameIndex: number, canSealChunk: boolean): boolean {
  return recordingAvailable && chunkFrameCapacity >= 1 && chunkGpuBuffer !== null && stagingRing.length > 0 && (chunkFrameIndex < chunkFrameCapacity || canSealChunk);
}

/**
 * Builds the storage-quota snapshot posted through the worker protocol.
 *
 * @param {StorageEstimate} estimate browser storage estimate.
 * @param {readonly ChunkMeta[]} sealedChunks sealed recording chunks.
 * @param {number} chunkFrameCapacity frame count per recording chunk.
 * @param {number} frameByteSize frame size in bytes.
 * @returns {StorageQuotaSnapshot} storage-quota payload.
 */
export function buildStorageQuotaSnapshot(estimate: StorageEstimate, sealedChunks: readonly ChunkMeta[], chunkFrameCapacity: number, frameByteSize: number): StorageQuotaSnapshot {
  const quotaBytes = estimate.quota ?? 0;
  const usedBytes = estimate.usage ?? 0;
  let pendingRawBytes = 0;
  let compressedBytes = 0;
  for (const chunk of sealedChunks) {
    if (chunk.codec === RAW_PACKED_CODEC) {
      pendingRawBytes += chunk.storedBytes;
    } else {
      compressedBytes += chunk.storedBytes;
    }
  }
  const chunkCapBytes = chunkFrameCapacity * frameByteSize;
  const reservedBytes = (1 + STAGING_RING_SIZE) * chunkCapBytes;
  return {
    quotaBytes,
    usedBytes,
    pendingRawBytes,
    compressedBytes,
    reservedBytes
  };
}

/**
 * Builds the recording-limit payload posted through the worker protocol.
 *
 * @param {number} maxSimulationBytes maximum simulation buffer size in bytes.
 * @param {number} frameByteSize frame size in bytes.
 * @param {number} chunkFrameCapacity frame count per recording chunk.
 * @param {number} fixedSimulationOverheadBytes fixed non-grid simulation bytes.
 * @param {GridFormatMetadata} gridFormat active grid format metadata.
 * @returns {RecordingLimitsPayload} recording-limits payload.
 */
export function buildRecordingLimitsPayload(maxSimulationBytes: number, frameByteSize: number, chunkFrameCapacity: number, fixedSimulationOverheadBytes: number, gridFormat: GridFormatMetadata): RecordingLimitsPayload {
  const maxRecordingBytes = maxRecordingBufferBytes(maxSimulationBytes);
  return {
    maxBytes: maxSimulationBytes,
    vramBudgetBytes: vramBudgetBytes(maxSimulationBytes, maxRecordingBytes),
    frameByteSize,
    recordingAvailable: recordingAvailableForCurrentFrame(frameByteSize, maxRecordingBytes),
    vramSimulationBytes: simulationBufferBytes(frameByteSize, fixedSimulationOverheadBytes),
    vramRecordingBytes: recordingBufferBytes(chunkFrameCapacity, frameByteSize),
    gridFormat
  };
}

/**
 * Recomputes the manifest generation range and chunk list.
 *
 * @param {RecordingManifest} manifest manifest being updated.
 * @param {readonly ChunkMeta[]} sealedChunks sealed recording chunks.
 * @param {readonly number[]} chunkGenerations buffered in-memory chunk generations.
 */
export function updateManifestRange(manifest: RecordingManifest, sealedChunks: readonly ChunkMeta[], chunkGenerations: readonly number[]): void {
  if (sealedChunks.length > 0) {
    manifest.generationStart = sealedChunks[0]!.generationStart;
    manifest.generationEnd = sealedChunks[sealedChunks.length - 1]!.generationEnd;
  }
  if (chunkGenerations.length > 0) {
    if (sealedChunks.length === 0) {
      manifest.generationStart = chunkGenerations[0]!;
    }
    manifest.generationEnd = chunkGenerations[chunkGenerations.length - 1]!;
  }
  manifest.chunks = [...sealedChunks];
}

/**
 * Deep-clones chunk metadata for protocol messages.
 *
 * @param {readonly ChunkMeta[]} chunks chunks to clone.
 * @returns {ChunkMeta[]} cloned chunk metadata.
 */
export function cloneRecordingChunks(chunks: readonly ChunkMeta[]): ChunkMeta[] {
  return chunks.map(chunk => ({...chunk, generations: [...chunk.generations]}));
}

/**
 * Returns whether the current generation has not yet been recorded.
 *
 * @param {number | null} latestRecordedGeneration latest captured generation.
 * @param {number} generation current generation.
 * @returns {boolean} true when the generation still needs capture.
 */
export function needsInitialCapture(latestRecordedGeneration: number | null, generation: number): boolean {
  return latestRecordedGeneration !== generation;
}

/**
 * Counts the frames persisted in sealed chunks, with an optional, additional amount.
 *
 * @param {readonly ChunkMeta[]} sealedChunks sealed recording chunks.
 * @param {number} [additionalFrames=0] additional frame count.
 * @returns {number} total frame count.
 */
export function countFrames(sealedChunks: readonly ChunkMeta[], additionalFrames: number = 0): number {
  return countSealedData(sealedChunks, 'blockCount', additionalFrames);
}

/**
 * Sums stored chunk payload bytes.
 *
 * @param {readonly ChunkMeta[]} sealedChunks sealed recording chunks.
 * @returns {number} total stored byte count.
 */
export function recordingStoredBytes(sealedChunks: readonly ChunkMeta[]): number {
  return countSealedData(sealedChunks, 'storedBytes');
}

/**
 * Sums uncompressed chunk payload bytes.
 *
 * @param {readonly ChunkMeta[]} sealedChunks sealed recording chunks.
 * @returns {number} total uncompressed byte count.
 */
export function recordingRawBytes(sealedChunks: readonly ChunkMeta[]): number {
  return countSealedData(sealedChunks, 'uncompressedBytes');
}
