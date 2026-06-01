import {repackPackedGrid} from '../../snapshot/packing/packed-repack';
import {BufferedStepBackTarget, StepBackPrefix, StepBackTarget} from '../model/step-back';

import {alignPackedBytesToWords, gridByteSize} from '~gol/feature/home/logic/grid-format';
import {Grid} from '~gol/feature/home/model/grid';
import {GridFormat} from '~gol/feature/home/model/grid-format';
import {ChunkMeta} from '~gol/feature/home/model/recording';

/**
 * Resolves the target frame for one step-back request.
 *
 * @param {readonly ChunkMeta[]} sealedChunks sealed recording chunks.
 * @param {number} sealedCount total sealed frame count.
 * @param {number} chunkFrameIndex buffered in-memory frame count.
 * @param {number} requestedCount requested step-back count.
 * @returns {StepBackTarget | null} resolved target, or `null` when no step back is possible.
 */
export function resolveStepBackTarget(sealedChunks: readonly ChunkMeta[], sealedCount: number, chunkFrameIndex: number, requestedCount: number): StepBackTarget | null {
  const totalFrames = sealedCount + chunkFrameIndex;
  const count = Math.min(requestedCount, totalFrames - 1);
  if (count <= 0) {
    return null;
  }
  const targetFrameGlobal = totalFrames - 1 - count;
  if (targetFrameGlobal >= sealedCount) {
    return {
      source: 'buffered',
      frameInChunk: targetFrameGlobal - sealedCount
    };
  }
  let accumulated = 0;
  for (let sealedIndex = 0; sealedIndex < sealedChunks.length; sealedIndex++) {
    const chunk = sealedChunks[sealedIndex]!;
    if (targetFrameGlobal < accumulated + chunk.blockCount) {
      return {
        source: 'sealed',
        sealedIndex,
        frameInChunk: targetFrameGlobal - accumulated
      };
    }
    accumulated += chunk.blockCount;
  }
  return null;
}

/**
 * Builds the restored in-memory state for a buffered step-back target.
 *
 * @param {readonly number[]} chunkGenerations buffered chunk generations.
 * @param {BufferedStepBackTarget} target resolved buffered target.
 * @returns {{chunkFrameIndex: number; generation: number}} restored buffered state.
 */
export function bufferedStepBackState(chunkGenerations: readonly number[], target: BufferedStepBackTarget): {chunkFrameIndex: number; generation: number} {
  return {chunkFrameIndex: target.frameInChunk + 1, generation: chunkGenerations[target.frameInChunk]!};
}

/**
 * Builds the repacked prefix needed to restore a sealed chunk target.
 *
 * @param {ArrayBuffer} chunkData stored chunk payload.
 * @param {number} frameInChunk target frame index inside the chunk.
 * @param {number} frameByteSize active frame size in bytes.
 * @param {Grid} grid logical grid dimensions.
 * @param {GridFormat} storedGridFormat stored chunk grid format.
 * @param {GridFormat} activeGridFormat active simulation grid format.
 * @returns {StepBackPrefix} restored prefix payloads.
 */
export function buildStepBackPrefix(chunkData: ArrayBuffer, frameInChunk: number, frameByteSize: number, grid: Grid, storedGridFormat: GridFormat, activeGridFormat: GridFormat): StepBackPrefix {
  const prefixBytes = (frameInChunk + 1) * frameByteSize;
  if (storedGridFormat.bitsPerCell === activeGridFormat.bitsPerCell) {
    return {
      sameFormat: true,
      chunkPrefix: new Uint8Array(chunkData, 0, prefixBytes),
      activeFrame: null
    };
  }
  const storedFrameByteSize = gridByteSize(grid, storedGridFormat);
  const repackedPrefix = new Uint8Array(prefixBytes);
  for (let frameIndex = 0; frameIndex <= frameInChunk; frameIndex++) {
    const packedFrame = new Uint8Array(chunkData, frameIndex * storedFrameByteSize, storedFrameByteSize);
    const repackedFrame = repackPackedGrid(alignPackedBytesToWords(packedFrame), grid, storedGridFormat, activeGridFormat);
    repackedPrefix.set(new Uint8Array(repackedFrame.buffer, repackedFrame.byteOffset, repackedFrame.byteLength), frameIndex * frameByteSize);
  }
  return {
    sameFormat: false,
    chunkPrefix: repackedPrefix,
    activeFrame: repackedPrefix.subarray(frameInChunk * frameByteSize, prefixBytes)
  };
}
