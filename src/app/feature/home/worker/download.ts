import '../../../core/function/timestamped-console';

import {DownloadCancelledError, DownloadRequestPayload} from '../model/download';
import {RecordingManifest} from '../model/recording';
import {alignPackedBytesToWords, gridByteSize, gridFormatFromMetadata} from '../util/grid-format';
import {resolveRecordingFrameSelection} from './frame/recording-frame-stream';
import {writeMetricsEntries, MetricsExportProgress} from './metric/sequence/export';
import {writeGoltStateStream} from './snapshot/golt-build-stream';
import {GoltStateData, ParsedGoltState, SnapshotProgressReporter} from './snapshot/golt-types';
import {readRecordingFrame} from './snapshot/recording-frame-reader';
import {resolveRecordingFrameRef} from './snapshot/recording-frame-ref';
import {ZipWriter} from './zip/zip-writer';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * User-visible ZIP export filename.
 *
 * @type {string}
 */
const ZIP_DOWNLOAD_FILENAME = 'gol-export.zip';

/**
 * First percent used for streaming save-entry writes.
 *
 * @type {number}
 */
const SAVE_WRITE_PROGRESS_START = 10;

/**
 * Last percent used for streaming save-entry writes.
 *
 * @type {number}
 */
const SAVE_WRITE_PROGRESS_END = 55;

/**
 * First percent used for Metrics export.
 *
 * @type {number}
 */
const METRICS_PROGRESS_START = 55;

/**
 * Last percent used for Metrics export.
 *
 * @type {number}
 */
const METRICS_PROGRESS_END = 85;

/**
 * Maximum estimated working set allowed before cancelling a download.
 *
 * @type {number}
 */
const DOWNLOAD_WORKING_SET_LIMIT_BYTES = 1024 * 1024 * 1024;

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
 * Download worker request payload.
 *
 * @interface DownloadRequest
 * @typedef {DownloadRequest}
 */
interface DownloadRequest {
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
   * @type {(Grid & {manifest: RecordingManifest}) | null}
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
 * @interface DownloadCancelRequest
 * @typedef {DownloadCancelRequest}
 */
interface DownloadCancelRequest {
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
type WorkerInput = DownloadRequest | DownloadCancelRequest;

/**
 * Download worker request event.
 *
 * @typedef {DownloadWorkerEvent}
 */
type DownloadWorkerEvent = MessageEvent<WorkerInput>;

let cancelRequested = false;

/**
 * Download worker for ZIP-backed export outputs.
 *
 * @param {DownloadWorkerEvent} event download worker request event.
 */
self.onmessage = (event: DownloadWorkerEvent) => {
  switch (event.data.type) {
    case 'download':
      cancelRequested = false;
      handleDownload(event.data).catch(error => {
        if (error instanceof DownloadCancelledError || cancelRequested) {
          console.log('[GOLT] Download worker cancelled');
          self.postMessage({type: 'cancelled'});
        } else {
          const reason = error instanceof Error ? error.message : String(error);
          console.error('[GOLT] Download worker failed:', error);
          self.postMessage({type: 'error', reason});
        }
      }).finally(() => {
      });
      break;
    case 'cancel':
      cancelRequested = true;
      postProgress(100, 'Cancelling');
      break;
  }
};

/**
 * Handles a download request.
 *
 * @async
 * @param {DownloadRequest} message download request payload.
 */
async function handleDownload(message: DownloadRequest): Promise<void> {
  const {opts, snapshot, recording, tribes, rules} = message;
  logSkippedOutputs(opts);
  postProgress(0, 'Preparing download');
  throwIfCancelled();
  const hasRecordedFrames = recording !== null && recording.manifest.chunks.length > 0;
  const shouldWriteZip = opts.saves || (opts.metrics && hasRecordedFrames);
  const estimate = estimateDownloadWorkingSet(opts, recording, tribes.length);
  logDownloadWorkingSetEstimate(estimate);
  if (estimate.totalBytes > DOWNLOAD_WORKING_SET_LIMIT_BYTES) {
    const reason = opts.metrics ?
      `Estimated Metrics memory (${formatBytes(estimate.totalBytes)}) exceeds the ${formatBytes(DOWNLOAD_WORKING_SET_LIMIT_BYTES)} limit. Select fewer frames or fewer checkboxes.` :
      `Estimated download memory (${formatBytes(estimate.totalBytes)}) exceeds the ${formatBytes(DOWNLOAD_WORKING_SET_LIMIT_BYTES)} limit. Select fewer frames or fewer checkboxes.`;
    console.error('[GOLT] Download cancelled by memory estimate:', estimate);
    throw new Error(reason);
  }
  postAllowedEstimateWarnings(estimate);
  if (opts.metrics && !hasRecordedFrames) {
    console.warn('[GOLT] Metrics requested but no recording data is available');
  }
  if (shouldWriteZip) {
    postProgress(10, 'Opening ZIP output');
    const zip = await ZipWriter.open(ZIP_DOWNLOAD_FILENAME);
    try {
      await writeSaveEntries(zip, opts, snapshot, recording, tribes, rules);
      if (opts.metrics && hasRecordedFrames && recording) {
        await writeMetricsEntries(zip, recording, opts.frameRange, tribes, {
          shouldCancel: () => cancelRequested,
          onProgress: createMetricsProgressReporter(METRICS_PROGRESS_START, METRICS_PROGRESS_END),
          onWarning: postWarning,
          streamEntries: estimate.streamMetrics
        });
      }
      throwIfCancelled();
      postProgress(90, 'Finalizing ZIP');
      const file = await zip.finalize();
      throwIfCancelled();
      postProgress(100, 'Done');
      self.postMessage({
        type: 'done-part',
        filename: ZIP_DOWNLOAD_FILENAME,
        file
      });
    } catch (error) {
      await zip.cleanup();
      throw error;
    }
  } else {
    postProgress(100, 'Done');
  }
  self.postMessage({type: 'done'});
}

/**
 * Estimated download memory pressure.
 *
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
 * @param {DownloadRequestPayload} opts selected download options.
 * @param {DownloadRequest['recording']} recording recording manifest, if available.
 * @param {number} tribeCount exported tribe count.
 * @returns {DownloadWorkingSetEstimate} working-set estimate.
 */
function estimateDownloadWorkingSet(opts: DownloadRequestPayload, recording: DownloadRequest['recording'], tribeCount: number): DownloadWorkingSetEstimate {
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
  if (opts.metrics && recording && recording.manifest.chunks.length > 0) {
    const selection = resolveRecordingFrameSelection(recording.manifest, opts.frameRange);
    metricFrameCount = selection.framesTotal;
    const selectedChunks = selectedMetricChunks(recording.manifest, selection.startIndex, selection.endIndex);
    maxChunkBytes = selectedChunks.reduce((maxBytes, chunk) => {
      const compressedOverlap = chunk.codec === 'deflate-raw' ? chunk.storedBytes : 0;
      return Math.max(maxBytes, chunk.uncompressedBytes + compressedOverlap);
    }, 0);
    const firstChunk = selectedChunks[0] ?? recording.manifest.chunks[0]!;
    previousFrameBytes = firstChunk.blockCount > 0 ?
      Math.ceil(firstChunk.uncompressedBytes / firstChunk.blockCount) :
      gridByteSize(recording, gridFormatFromMetadata(firstChunk.gridFormat));
    metricEntryBytes = estimateMetricEntryBytes(selection.framesTotal, tribeCount);
    metricCsvBytes = estimateMetricCsvBytes(selection.framesTotal, tribeCount);
    streamMetrics = metricEntryBytes > METRICS_ENTRY_STREAM_THRESHOLD_BYTES;
    totalBytes += maxChunkBytes + previousFrameBytes + estimateMetricRowBufferBytes(recording, tribeCount);
    if (!streamMetrics) {
      totalBytes += metricEntryBytes;
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
 * Logs detailed working-set estimate numbers for diagnostics.
 *
 * @param {DownloadWorkingSetEstimate} estimate working-set estimate.
 */
function logDownloadWorkingSetEstimate(estimate: DownloadWorkingSetEstimate): void {
  console.log('[GOLT] Download working-set estimate:', {
    totalBytes: estimate.totalBytes,
    total: formatBytes(estimate.totalBytes),
    metricEntryBytes: estimate.metricEntryBytes,
    metricEntries: formatBytes(estimate.metricEntryBytes),
    metricCsvBytes: estimate.metricCsvBytes,
    metricCsv: formatBytes(estimate.metricCsvBytes),
    streamMetrics: estimate.streamMetrics,
    maxChunkBytes: estimate.maxChunkBytes,
    maxChunk: formatBytes(estimate.maxChunkBytes),
    previousFrameBytes: estimate.previousFrameBytes,
    previousFrame: formatBytes(estimate.previousFrameBytes),
    metricFrameCount: estimate.metricFrameCount
  });
}

/**
 * Posts warnings for allowed but potentially expensive exports.
 *
 * @param {DownloadWorkingSetEstimate} estimate working-set estimate.
 */
function postAllowedEstimateWarnings(estimate: DownloadWorkingSetEstimate): void {
  if (estimate.streamMetrics) {
    const message = `Estimated Metrics memory is high (${formatBytes(estimate.metricEntryBytes)}), so CSV and JSON will be streamed during export.`;
    console.warn('[GOLT] Metrics row estimate exceeds in-memory threshold; streaming CSV and JSON to OPFS-backed ZIP entries');
    postWarning(message);
  }
  if (estimate.metricCsvBytes > METRICS_CSV_LARGE_OUTPUT_BYTES) {
    const message = `Metrics CSV output is expected to be large (${formatBytes(estimate.metricCsvBytes)}). Finalizing the ZIP and starting the browser download may take a while.`;
    console.warn('[GOLT] Metrics CSV output estimate is large:', {
      metricCsvBytes: estimate.metricCsvBytes,
      metricCsv: formatBytes(estimate.metricCsvBytes),
      metricFrameCount: estimate.metricFrameCount
    });
    postWarning(message);
  }
}

/**
 * Selects chunks that overlap a zero-based frame range.
 *
 * @param {RecordingManifest} manifest recording manifest.
 * @param {number} startIndex first selected zero-based frame.
 * @param {number} endIndex last selected zero-based frame.
 * @returns {RecordingManifest['chunks']} selected chunks.
 */
function selectedMetricChunks(manifest: RecordingManifest, startIndex: number, endIndex: number): RecordingManifest['chunks'] {
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

/**
 * Formats byte counts for diagnostics and error messages.
 *
 * @param {number} bytes byte count.
 * @returns {string} formatted byte count.
 */
function formatBytes(bytes: number): string {
  const gib = bytes / (1024 ** 3);
  const mib = bytes / (1024 ** 2);
  return gib >= 1 ? `${gib.toFixed(2)} GiB` : `${mib.toFixed(1)} MiB`;
}

/**
 * Writes available save entries to the ZIP archive.
 *
 * @async
 * @param {ZipWriter} zip zip writer.
 * @param {DownloadRequestPayload} opts selected download options.
 * @param {DownloadRequest['snapshot']} snapshot current snapshot fallback.
 * @param {DownloadRequest['recording']} recording recording manifest, if available.
 * @param {DownloadRequest['tribes']} tribes snapshot tribe metadata.
 * @param {GoltStateData['rules']} rules snapshot rule metadata.
 */
async function writeSaveEntries(zip: ZipWriter, opts: DownloadRequestPayload, snapshot: DownloadRequest['snapshot'], recording: DownloadRequest['recording'], tribes: DownloadRequest['tribes'], rules: GoltStateData['rules']): Promise<void> {
  throwIfCancelled();
  if (opts.saves && recording && recording.manifest.chunks.length > 0) {
    await writeRecordedSaveEntries(zip, opts, recording, tribes, rules);
  } else if (opts.saves) {
    postProgress(SAVE_WRITE_PROGRESS_START, 'Writing current save');
    await zip.addEntry(`state-gen${snapshot.generation}.golt`, entry => writeGoltStateStream({
      generation: snapshot.generation,
      cols: snapshot.cols,
      rows: snapshot.rows,
      grid: snapshot.grid,
      gridFormat: snapshot.gridFormat,
      tribes,
      rules
    }, entry, createSaveProgressReporter(SAVE_WRITE_PROGRESS_START, SAVE_WRITE_PROGRESS_END, 'Writing current save')));
  }
}

/**
 * Writes first and last selected recorded saves.
 *
 * @async
 * @param {ZipWriter} zip zip writer.
 * @param {DownloadRequestPayload} opts selected download options.
 * @param {Grid & {manifest: RecordingManifest}} recording recording manifest and dimensions.
 * @param {DownloadRequest['tribes']} tribes snapshot tribe metadata.
 * @param {GoltStateData['rules']} rules snapshot rule metadata.
 */
async function writeRecordedSaveEntries(zip: ZipWriter, opts: DownloadRequestPayload, recording: Grid & {manifest: RecordingManifest}, tribes: DownloadRequest['tribes'], rules: GoltStateData['rules']): Promise<void> {
  postProgress(SAVE_WRITE_PROGRESS_START, 'Resolving selected frames');
  throwIfCancelled();
  const selection = resolveRecordingFrameSelection(recording.manifest, opts.frameRange);
  const firstRef = resolveRecordingFrameRef(recording.manifest, selection.startIndex);
  const lastRef = resolveRecordingFrameRef(recording.manifest, selection.endIndex);
  if (firstRef && lastRef) {
    const twoEntries = lastRef.globalFrameIndex !== firstRef.globalFrameIndex;
    const firstEnd = twoEntries ? Math.round((SAVE_WRITE_PROGRESS_START + SAVE_WRITE_PROGRESS_END) / 2) : SAVE_WRITE_PROGRESS_END;
    const lastStart = Math.min(SAVE_WRITE_PROGRESS_END, firstEnd + 1);
    postProgress(SAVE_WRITE_PROGRESS_START, 'Writing first save');
    throwIfCancelled();
    const firstFrame = await readRecordingFrame(recording, firstRef);
    throwIfCancelled();
    await zip.addEntry(`state-first-gen${firstFrame.generation}.golt`, entry => writeGoltStateStream({
      generation: firstFrame.generation,
      cols: recording.cols,
      rows: recording.rows,
      grid: alignPackedBytesToWords(firstFrame.packed),
      gridFormat: firstRef.gridFormat,
      tribes,
      rules
    }, entry, createSaveProgressReporter(SAVE_WRITE_PROGRESS_START, firstEnd, 'Writing first save')));
    if (twoEntries) {
      postProgress(lastStart, 'Writing last save');
      throwIfCancelled();
      const lastFrame = await readRecordingFrame(recording, lastRef);
      throwIfCancelled();
      await zip.addEntry(`state-last-gen${lastFrame.generation}.golt`, entry => writeGoltStateStream({
        generation: lastFrame.generation,
        cols: recording.cols,
        rows: recording.rows,
        grid: alignPackedBytesToWords(lastFrame.packed),
        gridFormat: lastRef.gridFormat,
        tribes,
        rules
      }, entry, createSaveProgressReporter(lastStart, SAVE_WRITE_PROGRESS_END, 'Writing last save')));
    }
  } else {
    console.warn('[GOLT] Saves requested but selected recording frames could not be resolved');
  }
}

/**
 * Creates a reporter that maps Metrics export progress into the overall download range.
 *
 * @param {number} startPercent overall start percent.
 * @param {number} endPercent overall end percent.
 * @returns {(progress: MetricsExportProgress) => void} mapped progress reporter.
 */
function createMetricsProgressReporter(startPercent: number, endPercent: number): (progress: MetricsExportProgress) => void {
  return progress => {
    throwIfCancelled();
    const innerPercent = Math.max(0, Math.min(100, progress.percent));
    const span = endPercent - startPercent;
    postProgress(Math.round(startPercent + (innerPercent / 100) * span), progress.status);
  };
}

/**
 * Creates a reporter that maps one save-entry stream into the overall download range.
 *
 * @param {number} startPercent overall start percent for this save entry.
 * @param {number} endPercent overall end percent for this save entry.
 * @param {string} status download status text for this save entry.
 * @returns {SnapshotProgressReporter} mapped progress reporter.
 */
function createSaveProgressReporter(startPercent: number, endPercent: number, status: string): SnapshotProgressReporter {
  return update => {
    throwIfCancelled();
    const innerPercent = Math.max(0, Math.min(100, update.percent ?? 0));
    const span = endPercent - startPercent;
    postProgress(Math.round(startPercent + (innerPercent / 100) * span), status);
  };
}

/**
 * Throws when the user has cancelled the active download.
 */
function throwIfCancelled(): void {
  if (cancelRequested) {
    throw new DownloadCancelledError();
  }
}

/**
 * Logs unsupported output selections for the first milestone.
 *
 * @param {DownloadRequestPayload} opts selected download options.
 */
function logSkippedOutputs(opts: DownloadRequestPayload): void {
  if (opts.png) {
    console.log('[GOLT] PNG frame export is not implemented in the new download worker yet; skipping PNG output.');
  }
  if (opts.mp4) {
    console.log('[GOLT] MP4 export is not implemented in the new download worker yet; skipping MP4 output.');
  }
}

/**
 * Posts determinate download progress to the UI thread.
 *
 * @param {number} percent progress percent.
 * @param {string} status progress status text.
 */
function postProgress(percent: number, status: string): void {
  self.postMessage({
    type: 'progress',
    percent,
    status
  });
}

/**
 * Posts a user-visible warning to the UI thread.
 *
 * @param {string} message warning message.
 */
function postWarning(message: string): void {
  self.postMessage({
    type: 'warning',
    message
  });
}
