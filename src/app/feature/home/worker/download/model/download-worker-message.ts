import {DownloadRequestPayload} from '../../../model/download';
import {Grid} from '../../../model/grid';
import {RecordingManifest} from '../../../model/recording';
import {GoltStateData, ParsedGoltState} from '../../snapshot/model/golt-types';

/**
 * Download worker request payload.
 *
 * @export
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
   * @type {((Grid & {manifest: RecordingManifest}) | null)}
   */
  recording: (Grid & {manifest: RecordingManifest}) | null;
  /**
   * Snapshot tribe color metadata.
   *
   * @type {GoltStateData['tribes']}
   */
  tribes: GoltStateData['tribes'];
  /**
   * Snapshot rules metadata.
   *
   * @type {GoltStateData['rules']}
   */
  rules: GoltStateData['rules'];
}

/**
 * Download worker cancellation request.
 *
 * @export
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
 * @export
 * @typedef {WorkerInput}
 */
export type WorkerInput = DownloadRequest | DownloadCancelRequest;

/**
 * Download worker request event.
 *
 * @export
 * @typedef {DownloadWorkerEvent}
 */
export type DownloadWorkerEvent = MessageEvent<WorkerInput>;

/**
 * Listener notified when download cancellation is requested.
 *
 * @export
 * @typedef {DownloadCancelListener}
 */
export type DownloadCancelListener = () => void;
