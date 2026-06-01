import {GridFormatMetadata} from '../../../model/grid-format';
import {ChunkMeta} from '../../../model/recording';

/**
 * Reference to one recorded frame inside an OPFS chunk.
 *
 * @interface RecordingFrameRef
 * @typedef {RecordingFrameRef}
 */
interface RecordingFrameRef {
  /**
   * Chunk containing the frame.
   *
   * @type {ChunkMeta}
   */
  chunk: ChunkMeta;
  /**
   * Frame index inside the chunk.
   *
   * @type {number}
   */
  localFrameIndex: number;
  /**
   * Frame index inside the whole recording.
   *
   * @type {number}
   */
  globalFrameIndex: number;
  /**
   * Generation represented by the frame.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Packing format used by the frame.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
}

/**
 * Packed frame bytes read from OPFS.
 *
 * @interface RecordingFrameData
 * @typedef {RecordingFrameData}
 */
interface RecordingFrameData {
  /**
   * Generation represented by the frame.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Packed frame bytes backed by the decoded chunk buffer.
   *
   * @type {Uint8Array}
   */
  packed: Uint8Array;
}

export type {RecordingFrameData, RecordingFrameRef};
