import {RecordingFrameRef} from './recording-frame-types';
import {RecordingManifest} from '../../../model/recording';

/**
 * Resolves a zero-based global frame index into a recording chunk reference.
 *
 * @param {RecordingManifest} manifest recording manifest to search.
 * @param {number} globalFrameIndex zero-based recording frame index.
 * @returns {RecordingFrameRef | null} frame reference or `null` when missing.
 */
export function resolveRecordingFrameRef(manifest: RecordingManifest, globalFrameIndex: number): RecordingFrameRef | null {
  let resolved: RecordingFrameRef | null = null;
  let nextStart = 0;
  for (const chunk of manifest.chunks) {
    const chunkStart = nextStart;
    const chunkEnd = chunkStart + chunk.blockCount - 1;
    if (!resolved && globalFrameIndex >= chunkStart && globalFrameIndex <= chunkEnd) {
      const localFrameIndex = globalFrameIndex - chunkStart;
      resolved = {
        chunk,
        localFrameIndex,
        globalFrameIndex,
        generation: chunk.generations[localFrameIndex] ?? (chunk.generationStart + localFrameIndex),
        gridFormat: chunk.gridFormat
      };
    }
    nextStart = chunkEnd + 1;
  }
  return resolved;
}

/**
 * Counts frames in a recording manifest.
 *
 * @param {RecordingManifest} manifest recording manifest to inspect.
 * @returns {number} total recorded frame count.
 */
export function countRecordingFrames(manifest: RecordingManifest): number {
  let totalFrames = 0;
  for (const chunk of manifest.chunks) {
    totalFrames += chunk.blockCount;
  }
  return totalFrames;
}

export type {RecordingFrameRef};
