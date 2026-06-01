import {GridFormatMetadata} from './grid-format';
import {ChunkSealedMessage} from './worker-message';

/**
 * Compression wait mode.
 *
 * @typedef {CompressionWaitMode}
 */
export type CompressionWaitMode = 'active' | 'all';

/**
 * Compression job tracked by the main-thread scheduler.
 *
 * @interface QueuedCompressionJob
 * @typedef {QueuedCompressionJob}
 */
export interface QueuedCompressionJob {
  /**
   * Chunk data sent to a compression worker.
   *
   * @type {ChunkSealedMessage}
   */
  chunk: ChunkSealedMessage;
  /**
   * Failed retry attempts since this job last entered the queue.
   *
   * @type {number}
   */
  attempts: number;
  /**
   * Number of times this job has moved from deferred back to queued.
   *
   * @type {number}
   */
  deferredRequeues: number;
}

/**
 * Compression scheduler callbacks.
 *
 * @interface CompressionSchedulerCallbacks
 * @typedef {CompressionSchedulerCallbacks}
 */
export interface CompressionSchedulerCallbacks {
  /**
   * Chunk codec update callback.
   *
   * @type {(message: {filename: string; rawBytes: number; codec: string; storedBytes: number; gridFormat: GridFormatMetadata}) => void}
   */
  updateChunkCodec: (message: {filename: string; rawBytes: number; codec: string; storedBytes: number; gridFormat: GridFormatMetadata}) => void;
  /**
   * Download cancellation state getter.
   *
   * @type {() => boolean}
   */
  isDownloadCancelled: () => boolean;
  /**
   * Download progress state getter.
   *
   * @type {() => number}
   */
  getDownloadProgress: () => number;
  /**
   * Download progress state setter.
   *
   * @type {(progress: number, status: string) => void}
   */
  setDownloadProgress: (progress: number, status: string) => void;
  /**
   * Estimate refresh callback.
   *
   * @type {() => void}
   */
  refreshDownloadEstimate: () => void;
  /**
   * Change detection callback.
   *
   * @type {() => void}
   */
  markForCheck: () => void;
}
