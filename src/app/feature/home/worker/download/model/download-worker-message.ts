import {ParsedGoltState} from '../../snapshot/model/golt-types';

import {DownloadRequestPayload} from '~gol/feature/home/model/download';
import {DownloadEstimateRecording} from '~gol/feature/home/model/download-estimate';

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

/**
 * Download progress response.
 *
 * @interface DownloadProgressMessage
 * @typedef {DownloadProgressMessage}
 */
export interface DownloadProgressMessage {
  /**
   * Download worker response type.
   *
   * @type {'progress'}
   */
  type: 'progress';
  /**
   * Download progress percent.
   *
   * @type {number}
   */
  percent: number;
  /**
   * Progress status text.
   *
   * @type {string}
   */
  status: string;
}

/**
 * Download warning response.
 *
 * @interface DownloadWarningMessage
 * @typedef {DownloadWarningMessage}
 */
export interface DownloadWarningMessage {
  /**
   * Download worker response type.
   *
   * @type {'warning'}
   */
  type: 'warning';
  /**
   * Warning message.
   *
   * @type {string}
   */
  message: string;
}

/**
 * Download output part response.
 *
 * @interface DownloadDonePartMessage
 * @typedef {DownloadDonePartMessage}
 */
export interface DownloadDonePartMessage {
  /**
   * Download worker response type.
   *
   * @type {'done-part'}
   */
  type: 'done-part';
  /**
   * User-visible filename.
   *
   * @type {string}
   */
  filename: string;
  /**
   * Download file output.
   *
   * @type {File}
   */
  file: File;
}

/**
 * Download error response.
 *
 * @interface DownloadErrorMessage
 * @typedef {DownloadErrorMessage}
 */
export interface DownloadErrorMessage {
  /**
   * Download worker response type.
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
 * Download cancelled response.
 *
 * @interface DownloadCancelledMessage
 * @typedef {DownloadCancelledMessage}
 */
export interface DownloadCancelledMessage {
  /**
   * Download worker response type.
   *
   * @type {'cancelled'}
   */
  type: 'cancelled';
}

/**
 * Cancelled ZIP cleanup completion response.
 *
 * @interface DownloadCancelCleanupDoneMessage
 * @typedef {DownloadCancelCleanupDoneMessage}
 */
export interface DownloadCancelCleanupDoneMessage {
  /**
   * Download worker response type.
   *
   * @type {'cancel-cleanup-done'}
   */
  type: 'cancel-cleanup-done';
}

/**
 * Download completed response.
 *
 * @interface DownloadDoneMessage
 * @typedef {DownloadDoneMessage}
 */
export interface DownloadDoneMessage {
  /**
   * Download worker response type.
   *
   * @type {'done'}
   */
  type: 'done';
}

/**
 * Download worker response.
 *
 * @typedef {DownloadWorkerMessage}
 */
export type DownloadWorkerMessage = DownloadProgressMessage | DownloadWarningMessage | DownloadDonePartMessage | DownloadErrorMessage | DownloadCancelledMessage | DownloadCancelCleanupDoneMessage | DownloadDoneMessage;

/**
 * Download worker response event.
 *
 * @typedef {DownloadWorkerResponseEvent}
 */
export type DownloadWorkerResponseEvent = MessageEvent<DownloadWorkerMessage>;
