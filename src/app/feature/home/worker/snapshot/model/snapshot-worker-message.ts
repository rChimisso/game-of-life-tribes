import {ParsedGoltState} from './golt-types';

import {Grid} from '~gol/feature/home/model/grid';
import {GridFormatMetadata} from '~gol/feature/home/model/grid-format';
import {Rule, Tribe} from '~gol/feature/home/model/rule';

/**
 * Request to build a `.golt` snapshot file.
 *
 * @interface SnapshotSaveRequest
 * @typedef {SnapshotSaveRequest}
 */
export interface SnapshotSaveRequest {
  /**
   * Snapshot worker request type.
   *
   * @type {'save'}
   */
  type: 'save';
  /**
   * Snapshot state to serialize.
   *
   * @type {ParsedGoltState}
   */
  snapshot: ParsedGoltState;
}

/**
 * Request to parse a `.golt` snapshot file.
 *
 * @interface SnapshotLoadRequest
 * @typedef {SnapshotLoadRequest}
 */
export interface SnapshotLoadRequest {
  /**
   * Snapshot worker request type.
   *
   * @type {'load'}
   */
  type: 'load';
  /**
   * Serialized `.golt` file bytes.
   *
   * @type {ArrayBuffer}
   */
  buffer: ArrayBuffer;
}

/**
 * Snapshot worker request.
 *
 * @typedef {SnapshotWorkerRequest}
 */
export type SnapshotWorkerRequest = SnapshotSaveRequest | SnapshotLoadRequest;

/**
 * Snapshot worker request event.
 *
 * @typedef {SnapshotWorkerEvent}
 */
export type SnapshotWorkerEvent = MessageEvent<SnapshotWorkerRequest>;

/**
 * Parsed snapshot message sent to the UI thread.
 *
 * @interface SnapshotLoadedMessage
 * @typedef {SnapshotLoadedMessage}
 * @extends {Grid}
 */
export interface SnapshotLoadedMessage extends Grid {
  /**
   * Snapshot worker response type.
   *
   * @type {'loaded'}
   */
  type: 'loaded';
  /**
   * Loaded generation counter.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Loaded packed grid data.
   *
   * @type {Uint32Array}
   */
  grid: Uint32Array;
  /**
   * Loaded grid packing format.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
  /**
   * Loaded tribe color metadata.
   *
   * @type {readonly Tribe[]}
   */
  tribes: readonly Tribe[];
  /**
   * Loaded rules metadata.
   *
   * @type {Rule<Tribe[]>[]}
   */
  rules: Rule<Tribe[]>[];
}
