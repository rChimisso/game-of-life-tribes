import {ParsedGoltState} from '../../snapshot/model/golt-types';

import {DownloadRequestPayload} from '~gol/feature/home/model/download';
import {DownloadEstimateRecording} from '~gol/feature/home/model/download-estimate';
import {Rule, Tribe} from '~gol/feature/home/model/rule';

/**
 * Download worker request payload.
 *
 * @interface DownloadRequest
 * @typedef {DownloadRequest}
 */
export interface DownloadRequest {
  /**
   * Download worker request type.
   *
   * @type {'download'}
   */
  type: 'download';
  /**
   * Selected export options.
   *
   * @type {DownloadRequestPayload}
   */
  opts: DownloadRequestPayload;
  /**
   * Current engine snapshot used when no recording is available.
   *
   * @type {ParsedGoltState}
   */
  snapshot: ParsedGoltState;
  /**
   * Recording metadata used to resolve saved frame snapshots.
   *
   * @type {DownloadEstimateRecording}
   */
  recording: DownloadEstimateRecording;
  /**
   * Snapshot tribe color metadata.
   *
   * @type {readonly Tribe[]}
   */
  tribes: readonly Tribe[];
  /**
   * Snapshot rules metadata.
   *
   * @type {Rule<Tribe[]>[]}
   */
  rules: Rule<Tribe[]>[];
}

/**
 * Download worker cancellation request.
 *
 * @interface DownloadCancelRequest
 * @typedef {DownloadCancelRequest}
 */
export interface DownloadCancelRequest {
  /**
   * Download worker cancellation request type.
   *
   * @type {'cancel'}
   */
  type: 'cancel';
}

/**
 * Download worker input.
 *
 * @typedef {WorkerInput}
 */
export type WorkerInput = DownloadRequest | DownloadCancelRequest;

/**
 * Download worker request event.
 *
 * @typedef {DownloadWorkerEvent}
 */
export type DownloadWorkerEvent = MessageEvent<WorkerInput>;

/**
 * Listener notified when download cancellation is requested.
 *
 * @typedef {DownloadCancelListener}
 */
export type DownloadCancelListener = () => void;
