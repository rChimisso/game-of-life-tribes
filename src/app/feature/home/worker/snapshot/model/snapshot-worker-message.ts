import {ParsedGoltState} from './golt-types';

import {GridSettings} from '~gol/feature/home/model/grid';
import {GridFormatMetadata} from '~gol/feature/home/model/grid-format';
import {Rule, Tribe} from '~gol/feature/home/model/rule';
import {ProgressStatusMode} from '~gol/shared/component/progress-status/model/progress-status';

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
 * @extends {GridSettings}
 */
export interface SnapshotLoadedMessage extends GridSettings {
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
   * Loaded deterministic random seed.
   *
   * @type {number}
   */
  randomSeed: number;
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

/**
 * Snapshot file response backed by an ArrayBuffer.
 *
 * @interface SnapshotSavedBufferMessage
 * @typedef {SnapshotSavedBufferMessage}
 */
export interface SnapshotSavedBufferMessage {
  /**
   * Snapshot worker response type.
   *
   * @type {'saved-buffer'}
   */
  type: 'saved-buffer';
  /**
   * User-visible snapshot filename.
   *
   * @type {string}
   */
  filename: string;
  /**
   * Serialized `.golt` bytes.
   *
   * @type {ArrayBuffer}
   */
  buffer: ArrayBuffer;
}

/**
 * Snapshot file response backed by OPFS.
 *
 * @interface SnapshotSavedFileMessage
 * @typedef {SnapshotSavedFileMessage}
 */
export interface SnapshotSavedFileMessage {
  /**
   * Snapshot worker response type.
   *
   * @type {'saved-file'}
   */
  type: 'saved-file';
  /**
   * User-visible snapshot filename.
   *
   * @type {string}
   */
  filename: string;
  /**
   * Snapshot file handle output.
   *
   * @type {File}
   */
  file: File;
}

/**
 * Invalid snapshot response.
 *
 * @interface SnapshotInvalidMessage
 * @typedef {SnapshotInvalidMessage}
 */
export interface SnapshotInvalidMessage {
  /**
   * Snapshot worker response type.
   *
   * @type {'invalid'}
   */
  type: 'invalid';
}

/**
 * Snapshot worker progress response.
 *
 * @interface SnapshotProgressMessage
 * @typedef {SnapshotProgressMessage}
 */
export interface SnapshotProgressMessage {
  /**
   * Snapshot worker response type.
   *
   * @type {'progress'}
   */
  type: 'progress';
  /**
   * Progress bar mode.
   *
   * @type {(ProgressStatusMode | undefined)}
   */
  mode?: ProgressStatusMode;
  /**
   * Determinate progress percent.
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
 * Snapshot worker error response.
 *
 * @interface SnapshotErrorMessage
 * @typedef {SnapshotErrorMessage}
 */
export interface SnapshotErrorMessage {
  /**
   * Snapshot worker response type.
   *
   * @type {'error'}
   */
  type: 'error';
  /**
   * Error reason.
   *
   * @type {string}
   */
  reason: string;
}

/**
 * Snapshot worker response.
 *
 * @typedef {SnapshotWorkerResponse}
 */
export type SnapshotWorkerResponse = SnapshotSavedBufferMessage | SnapshotSavedFileMessage | SnapshotLoadedMessage | SnapshotInvalidMessage | SnapshotProgressMessage | SnapshotErrorMessage;
