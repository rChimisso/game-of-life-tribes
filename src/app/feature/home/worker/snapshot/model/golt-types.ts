import {GridFormatMetadata} from '../../../model/grid-format';
import {Rule, Tribe} from '../../../model/rule';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Target byte size for one streamed repack block.
 *
 * @type {number}
 */
export const STREAM_REPACK_BLOCK_BYTES = 64 * 1024 * 1024;

/**
 * Packed grid size where snapshot building switches to the streaming path.
 *
 * @type {number}
 */
export const SNAPSHOT_STREAMING_THRESHOLD_BYTES = 256 * 1024 * 1024;

/**
 * Parsed `.golt` state payload.
 *
 * @interface ParsedGoltState
 * @typedef {ParsedGoltState}
 * @extends {Grid}
 */
export interface ParsedGoltState extends Grid {
  /**
   * Generation number.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Grid data.
   *
   * @type {Uint32Array}
   */
  grid: Uint32Array;
  /**
   * Grid format metadata.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
  /**
   * Tribe information.
   *
   * @type {readonly Pick<Tribe, 'id' | 'color'>[]}
   */
  tribes: readonly Pick<Tribe, 'id' | 'color'>[];
  /**
   * Rules.
   *
   * @type {Rule<Tribe[]>[]}
   */
  rules: Rule<Tribe[]>[];
}

/**
 * Data used to build a `.golt` state file.
 *
 * @typedef {GoltStateData}
 */
export type GoltStateData = ParsedGoltState;

/**
 * Partial `.golt` file header used while parsing.
 *
 * @interface GoltHeader
 * @typedef {GoltHeader}
 * @extends {Grid}
 */
export interface GoltHeader extends Grid {
  /**
   * Generation number.
   *
   * @type {?number}
   */
  generation?: number;
  /**
   * Grid format metadata.
   *
   * @type {?GridFormatMetadata}
   */
  gridFormat?: GridFormatMetadata;
  /**
   * Tribe information.
   *
   * @type {?readonly Pick<Tribe, 'id' | 'color'>[]}
   */
  tribes?: readonly Pick<Tribe, 'id' | 'color'>[];
  /**
   * Rules.
   *
   * @type {?Rule<Tribe[]>[]}
   */
  rules?: Rule<Tribe[]>[];
}

/**
 * Streaming sink used by snapshot and ZIP writers.
 *
 * @interface ByteSink
 * @typedef {ByteSink}
 */
export interface ByteSink {
  /**
   * Writes one byte chunk.
   *
   * @param {Uint8Array} chunk chunk to write.
   * @returns {Promise<void>} promise resolved after the write completes.
   */
  write(chunk: Uint8Array): Promise<void>;
}

/**
 * Snapshot progress update.
 *
 * @interface SnapshotProgressUpdate
 * @typedef {SnapshotProgressUpdate}
 */
export interface SnapshotProgressUpdate {
  /**
   * Progress bar mode.
   *
   * @type {('determinate' | 'indeterminate')}
   */
  mode: 'determinate' | 'indeterminate';
  /**
   * Determinate progress percentage.
   *
   * @type {(number | null)}
   */
  percent: number | null;
  /**
   * Progress status text.
   *
   * @type {string}
   */
  status: string;
}

/**
 * Snapshot progress callback.
 *
 * @typedef {SnapshotProgressReporter}
 */
export type SnapshotProgressReporter = (update: SnapshotProgressUpdate) => void;

/**
 * Cancellation hooks used by streaming snapshot writers.
 *
 * @interface SnapshotStreamOptions
 * @typedef {SnapshotStreamOptions}
 */
export interface SnapshotStreamOptions {
  /**
   * Returns whether the active stream has been cancelled.
   *
   * @type {() => boolean}
   */
  shouldCancel: () => boolean;
  /**
   * Registers a listener for active stream cancellation.
   *
   * @type {(listener: () => void) => () => void}
   */
  onCancelRequested: (listener: () => void) => () => void;
}
