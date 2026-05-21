import {GridFormatMetadata} from '../../model/grid-format';
import {Rule, Tribe} from '../../model/rule';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Packed grid size where snapshot building switches to the streaming path.
 *
 * @type {number}
 */
export const SNAPSHOT_STREAMING_THRESHOLD_BYTES = 256 * 1024 * 1024;

/**
 * Parsed `.golt` state payload.
 *
 * @export
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
}

/**
 * Data used to build a `.golt` state file.
 *
 * @export
 * @interface GoltStateData
 * @typedef {GoltStateData}
 * @extends {ParsedGoltState}
 */
export interface GoltStateData extends ParsedGoltState {
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
 * Partial `.golt` file header used while parsing.
 *
 * @export
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
}

/**
 * Streaming sink used by snapshot and ZIP writers.
 *
 * @export
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
 * @export
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
 * @export
 * @typedef {SnapshotProgressReporter}
 */
export type SnapshotProgressReporter = (update: SnapshotProgressUpdate) => void;
