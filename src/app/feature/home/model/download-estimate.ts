import {Recording} from './recording';

/**
 * Estimated fixed memory retained by one offline metric entry.
 *
 * @type {number}
 */
export const METRIC_ENTRY_BASE_BYTES = 512;

/**
 * Estimated memory retained per tribe by one offline metric entry.
 *
 * @type {number}
 */
export const METRIC_ENTRY_TRIBE_BYTES = 160;

/**
 * Estimated fixed CSV bytes written by one offline metric row.
 *
 * @type {number}
 */
export const METRIC_CSV_ROW_BASE_BYTES = 384;

/**
 * Estimated CSV bytes written per tribe by one offline metric row.
 *
 * @type {number}
 */
export const METRIC_CSV_ROW_TRIBE_BYTES = 48;

/**
 * Memory threshold where downloads switch to compressed recording chunk export.
 *
 * @type {number}
 */
export const DOWNLOAD_CHUNK_MODE_THRESHOLD_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Estimated retained metric-row memory where Metrics switches to streaming output.
 *
 * @type {number}
 */
export const METRICS_ENTRY_STREAM_THRESHOLD_BYTES = 512 * 1024 * 1024;

/**
 * Estimated Metrics CSV output size where download warns about large output.
 *
 * @type {number}
 */
export const METRICS_CSV_LARGE_OUTPUT_BYTES = 512 * 1024 * 1024;

/**
 * Download output mode selected from memory estimate and user settings.
 *
 * @typedef {DownloadMode}
 */
export type DownloadMode = 'normal' | 'compressed-chunks';

/**
 * Recording data passed into the download estimator.
 *
 * @typedef {DownloadEstimateRecording}
 */
export type DownloadEstimateRecording = Recording | null;

/**
 * Selected recording frame span used for download estimates.
 *
 * @interface DownloadEstimateFrameSelection
 * @typedef {DownloadEstimateFrameSelection}
 */
export interface DownloadEstimateFrameSelection {
  /**
   * First selected zero-based frame index.
   *
   * @type {number}
   */
  startIndex: number;
  /**
   * Last selected zero-based frame index.
   *
   * @type {number}
   */
  endIndex: number;
  /**
   * Selected frame count.
   *
   * @type {number}
   */
  framesTotal: number;
}

/**
 * Estimated download memory pressure.
 *
 * @interface DownloadWorkingSetEstimate
 * @typedef {DownloadWorkingSetEstimate}
 */
export interface DownloadWorkingSetEstimate {
  /**
   * Estimated peak working-set bytes.
   *
   * @type {number}
   */
  totalBytes: number;
  /**
   * Estimated retained metric-entry bytes before streaming.
   *
   * @type {number}
   */
  metricEntryBytes: number;
  /**
   * Whether Metrics entries should be streamed.
   *
   * @type {boolean}
   */
  streamMetrics: boolean;
  /**
   * Largest selected chunk read/decode footprint.
   *
   * @type {number}
   */
  maxChunkBytes: number;
  /**
   * Packed previous-frame bytes retained by Metrics.
   *
   * @type {number}
   */
  previousFrameBytes: number;
  /**
   * Estimated Metrics CSV output bytes.
   *
   * @type {number}
   */
  metricCsvBytes: number;
  /**
   * Selected Metrics frame count.
   *
   * @type {number}
   */
  metricFrameCount: number;
}
