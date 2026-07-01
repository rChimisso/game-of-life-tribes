import {Grid, GridSettings} from '~gol/feature/home/model/grid';
import {GridFormatMetadata} from '~gol/feature/home/model/grid-format';
import {Rule, Tribe} from '~gol/feature/home/model/rule';

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
 * Error message used when snapshot export cancellation stops stream work.
 *
 * @type {string}
 */
export const SNAPSHOT_EXPORT_CANCELLED_ERROR_MESSAGE = 'Snapshot export cancelled';

/**
 * Parsed `.golt` state payload.
 *
 * @interface ParsedGoltState
 * @typedef {ParsedGoltState}
 * @extends {GridSettings}
 */
export interface ParsedGoltState extends GridSettings {
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
   * @type {readonly Tribe[]}
   */
  tribes: readonly Tribe[];
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
   * Grid topology.
   *
   * @type {?GridSettings['topology']}
   */
  topology?: GridSettings['topology'];
  /**
   * Virtual boundary tribe used by bounded grids.
   *
   * @type {?string}
   */
  boundaryTribe?: string;
  /**
   * Grid format metadata.
   *
   * @type {?GridFormatMetadata}
   */
  gridFormat?: GridFormatMetadata;
  /**
   * Tribe information.
   *
   * @type {?readonly Tribe[]}
   */
  tribes?: readonly Tribe[];
  /**
   * Rules.
   *
   * @type {?Rule<Tribe[]>[]}
   */
  rules?: Rule<Tribe[]>[];
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
