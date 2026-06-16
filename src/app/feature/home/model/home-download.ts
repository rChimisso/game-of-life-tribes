import {CompressionWaitMode} from './compression-scheduler';
import {DownloadRequestPayload} from './download';
import {ExportFrameOrigin} from './export-frame-origin';
import {Rule, Tribe} from './rule';
import {RecordingMessage, SnapshotMessage} from './worker-message';

import {SeverityLevel} from '~gol/core/model/severity-level';

/**
 * Home download worker input.
 *
 * @interface HomeDownloadWorkerInput
 * @typedef {HomeDownloadWorkerInput}
 */
export interface HomeDownloadWorkerInput {
  /**
   * Download options.
   *
   * @type {DownloadRequestPayload}
   */
  opts: DownloadRequestPayload;
  /**
   * Stable snapshot.
   *
   * @type {SnapshotMessage}
   */
  snapshot: SnapshotMessage;
  /**
   * Stable recording manifest.
   *
   * @type {(RecordingMessage | null)}
   */
  recording: RecordingMessage | null;
  /**
   * Current tribes.
   *
   * @type {readonly Tribe[]}
   */
  tribes: readonly Tribe[];
  /**
   * Current rules.
   *
   * @type {Rule<Tribe[]>[]}
   */
  rules: Rule<Tribe[]>[];
  /**
   * Download start timestamp.
   *
   * @type {number}
   */
  startedAt: number;
}

/**
 * Home download worker callbacks.
 *
 * @interface HomeDownloadWorkerCallbacks
 * @typedef {HomeDownloadWorkerCallbacks}
 */
export interface HomeDownloadWorkerCallbacks {
  /**
   * Active worker setter.
   *
   * @type {(worker: Worker | null) => void}
   */
  setWorker: (worker: Worker | null) => void;
  /**
   * Active worker getter.
   *
   * @type {() => Worker | null}
   */
  getWorker: () => Worker | null;
  /**
   * Download cancellation state getter.
   *
   * @type {() => boolean}
   */
  isCancelRequested: () => boolean;
  /**
   * Download cancellation state setter.
   *
   * @type {(cancelled: boolean) => void}
   */
  setCancelRequested: (cancelled: boolean) => void;
  /**
   * Download progress setter.
   *
   * @type {(progress: number, status: string) => void}
   */
  setProgress: (progress: number, status: string) => void;
  /**
   * Download state reset callback.
   *
   * @type {() => void}
   */
  resetDownloadState: () => void;
  /**
   * Change detection callback.
   *
   * @type {() => void}
   */
  markForCheck: () => void;
  /**
   * Compression resume callback.
   *
   * @type {() => void}
   */
  resumeCompression: () => void;
  /**
   * Uncompressed chunks refresh callback.
   *
   * @type {() => void}
   */
  requestUncompressedChunks: () => void;
  /**
   * Snackbar callback.
   *
   * @type {(message: string, tone: SeverityLevel) => void}
   */
  openSnack: (message: string, tone: SeverityLevel) => void;
  /**
   * Minimum progress visibility wait.
   *
   * @type {(startedAt: number) => Promise<void>}
   */
  waitForMinimumVisibleTime: (startedAt: number) => Promise<void>;
  /**
   * Browser download callback.
   *
   * @type {(blob: Blob, filename: string) => void}
   */
  downloadBlob: (blob: Blob, filename: string) => void;
  /**
   * Clears the active visual export framing overlay.
   *
   * @type {() => void}
   */
  clearExportFrameOrigin: () => void;
}

/**
 * Home download preparation callbacks.
 *
 * @interface HomeDownloadPreparationCallbacks
 * @typedef {HomeDownloadPreparationCallbacks}
 */
export interface HomeDownloadPreparationCallbacks {
  /**
   * Download preview setter.
   *
   * @type {(opts: DownloadRequestPayload) => void}
   */
  setDownloadPreview: (opts: DownloadRequestPayload) => void;
  /**
   * Cancellation state setter.
   *
   * @type {(cancelled: boolean) => void}
   */
  setCancelRequested: (cancelled: boolean) => void;
  /**
   * Cancellation state getter.
   *
   * @type {() => boolean}
   */
  isCancelRequested: () => boolean;
  /**
   * Running-state pause callback.
   *
   * @type {() => void}
   */
  pauseIfRunning: () => void;
  /**
   * Download progress setter.
   *
   * @type {(progress: number, status: string) => void}
   */
  setProgress: (progress: number, status: string) => void;
  /**
   * Change detection callback.
   *
   * @type {() => void}
   */
  markForCheck: () => void;
  /**
   * Recording manifest request callback.
   *
   * @type {() => Promise<RecordingMessage>}
   */
  requestRecordingManifest: () => Promise<RecordingMessage>;
  /**
   * Snapshot request callback.
   *
   * @type {() => Promise<SnapshotMessage>}
   */
  requestSnapshot: () => Promise<SnapshotMessage>;
  /**
   * Compression wait callback.
   *
   * @type {(mode: CompressionWaitMode) => Promise<void>}
   */
  waitForCompression: (mode: CompressionWaitMode) => Promise<void>;
  /**
   * Estimate flag setter.
   *
   * @type {(exceedsThreshold: boolean) => void}
   */
  setEstimateExceedsThreshold: (exceedsThreshold: boolean) => void;
  /**
   * Active tribe count getter.
   *
   * @type {() => number}
   */
  getTribeCount: () => number;
  /**
   * Download worker starter.
   *
   * @type {(opts: DownloadRequestPayload, snap: SnapshotMessage, rec: RecordingMessage | null, startedAt: number) => void}
   */
  startDownloadWorker: (opts: DownloadRequestPayload, snap: SnapshotMessage, rec: RecordingMessage | null, startedAt: number) => void;
  /**
   * Captures and displays the active visual export framing origin.
   *
   * @type {(opts: DownloadRequestPayload) => ExportFrameOrigin | null}
   */
  beginExportFrameOrigin: (opts: DownloadRequestPayload) => ExportFrameOrigin | null;
  /**
   * Clears the active visual export framing overlay.
   *
   * @type {() => void}
   */
  clearExportFrameOrigin: () => void;
  /**
   * Compression resume callback.
   *
   * @type {() => void}
   */
  resumeCompression: () => void;
  /**
   * Download state reset callback.
   *
   * @type {() => void}
   */
  resetDownloadState: () => void;
  /**
   * Snackbar callback.
   *
   * @type {(message: string, tone: SeverityLevel) => void}
   */
  openSnack: (message: string, tone: SeverityLevel) => void;
}
