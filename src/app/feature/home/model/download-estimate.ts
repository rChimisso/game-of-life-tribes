import {DownloadRequestPayload} from './download';
import {RecordingManifest} from './recording';
import {gridByteSize, gridFormatFromMetadata} from '../util/grid-format';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Memory threshold where downloads switch to compressed recording chunk export.
 *
 * @type {number}
 */
const DOWNLOAD_CHUNK_MODE_THRESHOLD_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Estimated retained metric-row memory where Metrics switches to streaming output.
 *
 * @type {number}
 */
const METRICS_ENTRY_STREAM_THRESHOLD_BYTES = 512 * 1024 * 1024;

/**
 * Estimated Metrics CSV output size where download warns about large output.
 *
 * @type {number}
 */
const METRICS_CSV_LARGE_OUTPUT_BYTES = 512 * 1024 * 1024;

/**
 * Estimated fixed memory retained by one offline metric entry.
 *
 * @type {number}
 */
const METRIC_ENTRY_BASE_BYTES = 512;

/**
 * Estimated memory retained per tribe by one offline metric entry.
 *
 * @type {number}
 */
const METRIC_ENTRY_TRIBE_BYTES = 160;

/**
 * Estimated fixed CSV bytes written by one offline metric row.
 *
 * @type {number}
 */
const METRIC_CSV_ROW_BASE_BYTES = 384;

/**
 * Estimated CSV bytes written per tribe by one offline metric row.
 *
 * @type {number}
 */
const METRIC_CSV_ROW_TRIBE_BYTES = 48;

/**
 * Download output mode selected from memory estimate and user settings.
 *
 * @export
 * @typedef {DownloadMode}
 */
type DownloadMode = 'normal' | 'compressed-chunks';

/**
 * Recording data passed into the download estimator.
 *
 * @export
 * @typedef {DownloadEstimateRecording}
 */
type DownloadEstimateRecording = (Grid & {manifest: RecordingManifest}) | null;

/**
 * Estimated download memory pressure.
 *
 * @export
 * @interface DownloadWorkingSetEstimate
 * @typedef {DownloadWorkingSetEstimate}
 */
interface DownloadWorkingSetEstimate {
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

/**
 * Estimates the download working set before opening ZIP output.
 *
 * @export
 * @param {DownloadRequestPayload} opts selected download options.
 * @param {DownloadEstimateRecording} recording recording manifest, if available.
 * @param {number} tribeCount exported tribe count.
 * @returns {DownloadWorkingSetEstimate} working-set estimate.
 */
function estimateDownloadWorkingSet(opts: DownloadRequestPayload, recording: DownloadEstimateRecording, tribeCount: number): DownloadWorkingSetEstimate {
  let totalBytes = 0;
  let metricEntryBytes = 0;
  let streamMetrics = false;
  let maxChunkBytes = 0;
  let previousFrameBytes = 0;
  let metricCsvBytes = 0;
  let metricFrameCount = 0;
  if (opts.saves) {
    totalBytes += recording?.manifest.chunks.reduce((maxBytes, chunk) => Math.max(maxBytes, chunk.uncompressedBytes), 0) ?? 0;
  }
  if ((opts.metrics || opts.png || opts.mp4) && recording && recording.manifest.chunks.length > 0) {
    const selection = resolveEstimateFrameSelection(recording.manifest, opts.frameRange);
    const selectedChunks = selectedEstimateChunks(recording.manifest, selection.startIndex, selection.endIndex);
    maxChunkBytes = selectedChunks.reduce((maxBytes, chunk) => {
      const compressedOverlap = chunk.codec === 'deflate-raw' ? chunk.storedBytes : 0;
      return Math.max(maxBytes, chunk.uncompressedBytes + compressedOverlap);
    }, 0);
    totalBytes += maxChunkBytes;
    if (opts.metrics) {
      metricFrameCount = selection.framesTotal;
      const firstChunk = selectedChunks[0] ?? recording.manifest.chunks[0]!;
      previousFrameBytes = firstChunk.blockCount > 0 ?
        Math.ceil(firstChunk.uncompressedBytes / firstChunk.blockCount) :
        gridByteSize(recording, gridFormatFromMetadata(firstChunk.gridFormat));
      metricEntryBytes = estimateMetricEntryBytes(selection.framesTotal, tribeCount);
      metricCsvBytes = estimateMetricCsvBytes(selection.framesTotal, tribeCount);
      streamMetrics = metricEntryBytes > METRICS_ENTRY_STREAM_THRESHOLD_BYTES;
      totalBytes += previousFrameBytes + estimateMetricRowBufferBytes(recording, tribeCount);
      if (!streamMetrics) {
        totalBytes += metricEntryBytes;
      }
    }
  }
  return {
    totalBytes,
    metricEntryBytes,
    streamMetrics,
    maxChunkBytes,
    previousFrameBytes,
    metricCsvBytes,
    metricFrameCount
  };
}

/**
 * Resolves the effective download mode.
 *
 * @export
 * @param {DownloadWorkingSetEstimate} estimate working-set estimate.
 * @param {boolean} forceChunkDownload whether chunk export was forced.
 * @returns {DownloadMode} effective download mode.
 */
function resolveDownloadMode(estimate: DownloadWorkingSetEstimate, forceChunkDownload: boolean): DownloadMode {
  return forceChunkDownload || estimate.totalBytes > DOWNLOAD_CHUNK_MODE_THRESHOLD_BYTES ? 'compressed-chunks' : 'normal';
}

/**
 * Selects chunks that overlap a zero-based frame range.
 *
 * @param {RecordingManifest} manifest recording manifest.
 * @param {number} startIndex first selected zero-based frame.
 * @param {number} endIndex last selected zero-based frame.
 * @returns {RecordingManifest['chunks']} selected chunks.
 */
function selectedEstimateChunks(manifest: RecordingManifest, startIndex: number, endIndex: number): RecordingManifest['chunks'] {
  const chunks: RecordingManifest['chunks'] = [];
  let chunkStart = 0;
  for (const chunk of manifest.chunks) {
    const chunkEnd = chunkStart + chunk.blockCount - 1;
    if (chunkEnd >= startIndex && chunkStart <= endIndex) {
      chunks.push(chunk);
    }
    chunkStart = chunkEnd + 1;
  }
  return chunks;
}

/**
 * Resolves selected frame indexes for estimator use.
 *
 * @param {RecordingManifest} manifest recording manifest.
 * @param {DownloadRequestPayload['frameRange']} frameRange selected frame range.
 * @returns {{startIndex: number; endIndex: number; framesTotal: number}} selected frame range.
 */
function resolveEstimateFrameSelection(manifest: RecordingManifest, frameRange: DownloadRequestPayload['frameRange']): {startIndex: number; endIndex: number; framesTotal: number} {
  const totalFrames = manifest.chunks.reduce((sum, chunk) => sum + chunk.blockCount, 0);
  const startIndex = frameRange && totalFrames > 0 ? Math.max(0, Math.min(totalFrames - 1, frameRange.startFrame - 1)) : 0;
  const endIndex = frameRange && totalFrames > 0 ? Math.max(startIndex, Math.min(totalFrames - 1, frameRange.endFrame - 1)) : Math.max(0, totalFrames - 1);
  return {
    startIndex,
    endIndex,
    framesTotal: totalFrames > 0 ? endIndex - startIndex + 1 : 0
  };
}

/**
 * Estimates retained metric-entry object memory.
 *
 * @param {number} frameCount selected frame count.
 * @param {number} tribeCount exported tribe count.
 * @returns {number} estimated retained metric-entry bytes.
 */
function estimateMetricEntryBytes(frameCount: number, tribeCount: number): number {
  return frameCount * (METRIC_ENTRY_BASE_BYTES + (tribeCount * METRIC_ENTRY_TRIBE_BYTES));
}

/**
 * Estimates Metrics CSV output size.
 *
 * @param {number} frameCount selected frame count.
 * @param {number} tribeCount exported tribe count.
 * @returns {number} estimated CSV output bytes.
 */
function estimateMetricCsvBytes(frameCount: number, tribeCount: number): number {
  return frameCount * (METRIC_CSV_ROW_BASE_BYTES + (tribeCount * METRIC_CSV_ROW_TRIBE_BYTES));
}

/**
 * Estimates decoded row buffers retained by CPU Metrics.
 *
 * @param {Grid} grid grid dimensions.
 * @param {number} tribeCount exported tribe count.
 * @returns {number} estimated row-buffer bytes.
 */
function estimateMetricRowBufferBytes(grid: Grid, tribeCount: number): number {
  let bytesPerCell: number;
  if (tribeCount <= 256) {
    bytesPerCell = Uint8Array.BYTES_PER_ELEMENT;
  } else if (tribeCount <= 65536) {
    bytesPerCell = Uint16Array.BYTES_PER_ELEMENT;
  } else {
    bytesPerCell = Uint32Array.BYTES_PER_ELEMENT;
  }
  return grid.cols * bytesPerCell * 4;
}

export {
  DOWNLOAD_CHUNK_MODE_THRESHOLD_BYTES,
  METRICS_CSV_LARGE_OUTPUT_BYTES,
  METRICS_ENTRY_STREAM_THRESHOLD_BYTES,
  estimateDownloadWorkingSet,
  resolveDownloadMode
};

export type {DownloadEstimateRecording, DownloadMode, DownloadWorkingSetEstimate};
