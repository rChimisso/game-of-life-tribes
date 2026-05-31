import {Grid} from '~gol/feature/home/model/grid';
import {GridFormatMetadata} from '~gol/feature/home/model/grid-format';

/**
 * Request to compress one recording chunk.
 *
 * @export
 * @interface CompressRequest
 * @typedef {CompressRequest}
 * @extends {Grid}
 */
export interface CompressRequest extends Grid {
  /**
   * Worker command type.
   *
   * @type {'compress'}
   */
  type: 'compress';
  /**
   * OPFS chunk filename.
   *
   * @type {string}
   */
  filename: string;
  /**
   * Raw chunk byte count before compression.
   *
   * @type {number}
   */
  rawBytes: number;
  /**
   * Number of frames in the chunk.
   *
   * @type {number}
   */
  blockCount: number;
  /**
   * Grid format used by the raw chunk payload.
   *
   * @type {GridFormatMetadata}
   */
  rawGridFormat: GridFormatMetadata;
  /**
   * Grid format to store after optional repacking.
   *
   * @type {GridFormatMetadata}
   */
  storageGridFormat: GridFormatMetadata;
}

/**
 * Request to cancel selected compression jobs.
 *
 * @export
 * @interface CancelRequest
 * @typedef {CancelRequest}
 */
export interface CancelRequest {
  /**
   * Worker command type.
   *
   * @type {'cancel'}
   */
  type: 'cancel';
  /**
   * Filenames to cancel.
   *
   * @type {string[]}
   */
  filenames: string[];
}

/**
 * Request to cancel all queued compression jobs.
 *
 * @export
 * @interface CancelAllRequest
 * @typedef {CancelAllRequest}
 */
export interface CancelAllRequest {
  /**
   * Worker command type.
   *
   * @type {'cancelAll'}
   */
  type: 'cancelAll';
}

/**
 * Request to pause compression after active jobs finish.
 *
 * @export
 * @interface PauseCompressionRequest
 * @typedef {PauseCompressionRequest}
 */
export interface PauseCompressionRequest {
  /**
   * Worker command type.
   *
   * @type {'pauseCompression'}
   */
  type: 'pauseCompression';
}

/**
 * Request to resume queued compression jobs.
 *
 * @export
 * @interface ResumeCompressionRequest
 * @typedef {ResumeCompressionRequest}
 */
export interface ResumeCompressionRequest {
  /**
   * Worker command type.
   *
   * @type {'resumeCompression'}
   */
  type: 'resumeCompression';
}

/**
 * Compression worker input message.
 *
 * @export
 * @typedef {WorkerInput}
 */
export type WorkerInput = CompressRequest | CancelRequest | CancelAllRequest | PauseCompressionRequest | ResumeCompressionRequest;

/**
 * Completed compression result.
 *
 * @export
 * @interface CompressResult
 * @typedef {CompressResult}
 */
export interface CompressResult {
  /**
   * Worker result type.
   *
   * @type {'compressed'}
   */
  type: 'compressed';
  /**
   * OPFS chunk filename.
   *
   * @type {string}
   */
  filename: string;
  /**
   * Original raw byte count.
   *
   * @type {number}
   */
  rawBytes: number;
  /**
   * Stored chunk codec.
   *
   * @type {string}
   */
  codec: string;
  /**
   * Stored byte count after packing or compression.
   *
   * @type {number}
   */
  storedBytes: number;
  /**
   * Stored chunk grid format.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
}
