import {GoltStateData} from './golt-types';
import {Grid} from '../../../model/grid';
import {GridFormatMetadata} from '../../../model/grid-format';

/**
 * Request to build a `.golt` snapshot file.
 *
 * @export
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
   * @type {GoltStateData}
   */
  snapshot: GoltStateData;
}

/**
 * Request to parse a `.golt` snapshot file.
 *
 * @export
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
 * @export
 * @typedef {SnapshotWorkerRequest}
 */
export type SnapshotWorkerRequest = SnapshotSaveRequest | SnapshotLoadRequest;

/**
 * Snapshot worker request event.
 *
 * @export
 * @typedef {SnapshotWorkerEvent}
 */
export type SnapshotWorkerEvent = MessageEvent<SnapshotWorkerRequest>;

/**
 * Parsed snapshot message sent to the UI thread.
 *
 * @export
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
   * @type {GoltStateData['tribes']}
   */
  tribes: GoltStateData['tribes'];
  /**
   * Loaded rules metadata.
   *
   * @type {GoltStateData['rules']}
   */
  rules: GoltStateData['rules'];
}
