import {Grid} from './grid';
import {GridFormatMetadata} from './grid-format';

/**
 * Persisted metadata for a recorded generation chunk.
 *
 * @interface ChunkMeta
 * @typedef {ChunkMeta}
 */
export interface ChunkMeta {
  /**
   * Stable chunk sequence identifier.
   *
   * @type {number}
   */
  chunkId: number;
  /**
   * First generation stored in the chunk.
   *
   * @type {number}
   */
  generationStart: number;
  /**
   * Last generation stored in the chunk.
   *
   * @type {number}
   */
  generationEnd: number;
  /**
   * Number of encoded blocks written into the chunk payload.
   *
   * @type {number}
   */
  blockCount: number;
  /**
   * Compression codec used for the stored payload.
   *
   * @type {string}
   */
  codec: string;
  /**
   * Chunk size before compression.
   *
   * @type {number}
   */
  uncompressedBytes: number;
  /**
   * Chunk size after compression.
   *
   * @type {number}
   */
  storedBytes: number;
  /**
   * Grid packing used for the chunk contents.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
  /**
   * Ordered generations contained in the chunk.
   *
   * @type {number[]}
   */
  generations: number[];
  /**
   * Chunk filename persisted in storage.
   *
   * @type {string}
   */
  filename: string;
}

/**
 * Recording-level manifest describing the stored chunk set.
 *
 * @interface RecordingManifest
 * @typedef {RecordingManifest}
 */
export interface RecordingManifest {
  /**
   * Chunk metadata entries included in the recording.
   *
   * @type {ChunkMeta[]}
   */
  chunks: ChunkMeta[];
  /**
   * First generation covered by the recording.
   *
   * @type {number}
   */
  generationStart: number;
  /**
   * Last generation covered by the recording.
   *
   * @type {number}
   */
  generationEnd: number;
  /**
   * Grid packing shared across the recording.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
}

/**
 * Simulation grid snapshot paired with its recording manifest.
 *
 * @typedef {Recording}
 */
export type Recording = Grid & {manifest: RecordingManifest};
