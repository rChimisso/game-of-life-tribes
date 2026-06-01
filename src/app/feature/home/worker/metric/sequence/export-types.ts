import {PackedRecordedFrame} from '../../frame/recording-frame-stream';
import {RecordedGpuMetricBackend} from '../gpu/recorded-gpu-metrics';

/**
 * Metrics export progress update.
 *
 * @interface MetricsExportProgress
 * @typedef {MetricsExportProgress}
 */
interface MetricsExportProgress {
  /**
   * Metrics phase percent.
   *
   * @type {number}
   */
  percent: number;
  /**
   * Metrics phase status.
   *
   * @type {string}
   */
  status: string;
}

/**
 * Metrics export options.
 *
 * @interface MetricsExportOptions
 * @typedef {MetricsExportOptions}
 */
interface MetricsExportOptions {
  /**
   * Throws or reports cancellation through the caller when true.
   *
   * @type {() => boolean}
   */
  shouldCancel: () => boolean;
  /**
   * Receives determinate metrics progress.
   *
   * @type {(progress: MetricsExportProgress) => void}
   */
  onProgress: (progress: MetricsExportProgress) => void;
  /**
   * Receives visible Metrics export warnings.
   *
   * @type {(message: string) => void}
   */
  onWarning: (message: string) => void;
  /**
   * Streams Metrics output rows instead of retaining them in memory.
   *
   * @type {boolean}
   */
  streamEntries: boolean;
}

/**
 * Metrics row-level progress reporter.
 *
 * @param {number} rowsProcessed rows processed for the current frame.
 * @param {number} rowsTotal total rows in the current frame.
 */
type MetricsFrameProgressReporter = (rowsProcessed: number, rowsTotal: number) => void;

/**
 * Per-frame Metrics export writer.
 *
 * @interface MetricsFrameExportWriter
 * @typedef {MetricsFrameExportWriter}
 */
interface MetricsFrameExportWriter {
  /**
   * Computes and records Metrics for one frame.
   *
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {MetricsFrameProgressReporter} [onProgress] row progress reporter.
   * @returns {Promise<void>} promise resolved after the frame is processed.
   */
  writeFrame(frame: PackedRecordedFrame, onProgress?: MetricsFrameProgressReporter): Promise<void>;
  /**
   * Writes final Metrics ZIP entries.
   *
   * @returns {Promise<void>} promise resolved after output entries are written.
   */
  finish(): Promise<void>;
  /**
   * Releases retained resources.
   *
   * @returns {Promise<void>} promise resolved after resources are released.
   */
  dispose(): Promise<void>;
}

/**
 * Metrics writer with completed-frame count.
 *
 * @typedef {CountingMetricsFrameExportWriter}
 */
type CountingMetricsFrameExportWriter = MetricsFrameExportWriter & {readonly framesCompleted: number};

/**
 * Mutable GPU backend holder used when a failed backend is retired.
 *
 * @interface RecordedGpuMetricBackendState
 * @typedef {RecordedGpuMetricBackendState}
 */
interface RecordedGpuMetricBackendState {
  /**
   * Active recorded-frame GPU Metrics backend.
   *
   * @type {(RecordedGpuMetricBackend | null)}
   */
  backend: RecordedGpuMetricBackend | null;
}

/**
 * Temporary OPFS resources for streaming Metrics output.
 *
 * @interface StreamingMetricsFrameExportResources
 * @typedef {StreamingMetricsFrameExportResources}
 */
interface StreamingMetricsFrameExportResources {
  /**
   * Temporary Metrics directory.
   *
   * @type {FileSystemDirectoryHandle}
   */
  directory: FileSystemDirectoryHandle;
  /**
   * Temporary CSV file handle.
   *
   * @type {FileSystemFileHandle}
   */
  fileHandle: FileSystemFileHandle;
  /**
   * Temporary CSV writable stream.
   *
   * @type {FileSystemWritableFileStream}
   */
  writable: FileSystemWritableFileStream;
  /**
   * Temporary CSV filename.
   *
   * @type {string}
   */
  filename: string;
}

export type {CountingMetricsFrameExportWriter, MetricsExportOptions, MetricsExportProgress, MetricsFrameExportWriter, MetricsFrameProgressReporter, RecordedGpuMetricBackendState, StreamingMetricsFrameExportResources};
