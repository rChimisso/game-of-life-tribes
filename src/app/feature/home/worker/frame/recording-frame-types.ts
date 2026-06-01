import {GridFormat, GridFormatMetadata} from '../../model/grid-format';
import {ChunkMeta} from '../../model/recording';

/**
 * Recorded chunk with its global frame span.
 *
 * @interface RecordingChunkRange
 * @typedef {RecordingChunkRange}
 */
interface RecordingChunkRange {
  /**
   * Recorded chunk metadata.
   *
   * @type {ChunkMeta}
   */
  chunk: ChunkMeta;
  /**
   * First zero-based frame index in the chunk.
   *
   * @type {number}
   */
  startIndex: number;
  /**
   * Last zero-based frame index in the chunk.
   *
   * @type {number}
   */
  endIndex: number;
}

/**
 * Packed recorded frame yielded by the shared recording iterator.
 *
 * @interface PackedRecordedFrame
 * @typedef {PackedRecordedFrame}
 */
interface PackedRecordedFrame {
  /**
   * Zero-based frame index in the whole recording.
   *
   * @type {number}
   */
  globalFrameIndex: number;
  /**
   * Zero-based frame index inside the current chunk.
   *
   * @type {number}
   */
  localFrameIndex: number;
  /**
   * Generation represented by the frame.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Grid columns.
   *
   * @type {number}
   */
  cols: number;
  /**
   * Grid rows.
   *
   * @type {number}
   */
  rows: number;
  /**
   * Packed frame bytes backed by the decoded chunk.
   *
   * @type {Uint8Array}
   */
  packed: Uint8Array;
  /**
   * Packed frame words.
   *
   * @type {Uint32Array}
   */
  words: Uint32Array;
  /**
   * Grid packing format metadata for this frame.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
  /**
   * Runtime grid packing format for this frame.
   *
   * @type {GridFormat}
   */
  format: GridFormat;
}

/**
 * Resolved frame selection for a recording.
 *
 * @interface RecordingFrameSelection
 * @typedef {RecordingFrameSelection}
 */
interface RecordingFrameSelection {
  /**
   * Total frames available in the manifest.
   *
   * @type {number}
   */
  totalFrames: number;
  /**
   * First selected zero-based frame index.
   *
   * @type {number}
   */
  startIndex: number;
  /**
   * Last selected zero-based frame index.
   *
   * @type {number}
   */
  endIndex: number;
  /**
   * Number of selected frames.
   *
   * @type {number}
   */
  framesTotal: number;
  /**
   * First selected one-based UI frame index.
   *
   * @type {number}
   */
  selectedStartFrame: number;
  /**
   * Last selected one-based UI frame index.
   *
   * @type {number}
   */
  selectedEndFrame: number;
}

/**
 * Recording frame iteration progress.
 *
 * @interface RecordingFrameIterationProgress
 * @typedef {RecordingFrameIterationProgress}
 */
interface RecordingFrameIterationProgress {
  /**
   * Selected chunks processed so far.
   *
   * @type {number}
   */
  chunksProcessed: number;
  /**
   * Selected chunks total.
   *
   * @type {number}
   */
  chunksTotal: number;
  /**
   * Selected frames processed so far.
   *
   * @type {number}
   */
  framesProcessed: number;
  /**
   * Selected frames total.
   *
   * @type {number}
   */
  framesTotal: number;
  /**
   * Last processed generation, or null before the first frame.
   *
   * @type {(number | null)}
   */
  generation: number | null;
}

/**
 * Options for the shared recording frame iterator.
 *
 * @interface RecordingFrameIteratorOptions
 * @typedef {RecordingFrameIteratorOptions}
 */
interface RecordingFrameIteratorOptions {
  /**
   * Returns whether iteration should stop because the export was cancelled.
   *
   * @type {() => boolean}
   */
  shouldCancel?: () => boolean;
  /**
   * Receives determinate chunk and frame progress.
   *
   * @type {(progress: RecordingFrameIterationProgress) => void}
   */
  onProgress?: (progress: RecordingFrameIterationProgress) => void;
}

export type {PackedRecordedFrame, RecordingChunkRange, RecordingFrameIterationProgress, RecordingFrameIteratorOptions, RecordingFrameSelection};
