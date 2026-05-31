import '../../../core/function/timestamped-console';

import {DownloadCancelledError, DownloadRequestPayload} from '../model/download';
import {DownloadWorkingSetEstimate, METRICS_CSV_LARGE_OUTPUT_BYTES, estimateDownloadWorkingSet, resolveDownloadMode} from '../model/download-estimate';
import {alignPackedBytesToWords} from '../util/grid-format';
import {DownloadCancelListener, DownloadRequest, DownloadWorkerEvent} from './download/model/download-worker-message';
import {PngFrameExportWriter} from './frame/png/png-frame-export-writer';
import {iterateRecordedFrames, resolveRecordingFrameSelection, RecordingFrameSelection} from './frame/recording-frame-stream';
import {createMetricsExportWriter, MetricsExportOptions, MetricsFrameProgressReporter} from './metric/sequence/export';
import {createMp4FrameExportWriter} from './mp4/logic/mp4-frame-export-factory';
import {Mp4FrameExportWriter} from './mp4/model/mp4-types';
import {writeCompressedChunkExport} from './recording-export/compressed-chunk-export';
import {writeGoltStateStream} from './snapshot/build/golt-build-stream';
import {GoltStateData, SnapshotProgressReporter, SnapshotStreamOptions} from './snapshot/model/golt-types';
import {readRecordingFrame} from './snapshot/recording/recording-frame-reader';
import {resolveRecordingFrameRef} from './snapshot/recording/recording-frame-ref';
import {ZipWriter} from './zip/zip-writer';

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
 * First percent used for recorded frame outputs.
 *
 * @type {number}
 */
const FRAME_OUTPUT_PROGRESS_START = 55;

/**
 * Last percent used for recorded frame outputs.
 *
 * @type {number}
 */
const FRAME_OUTPUT_PROGRESS_END = 85;

/**
 * Whether cancellation has been requested for the active download.
 *
 * @type {boolean}
 */
let cancelRequested = false;

/**
 * Active cancellation listeners.
 *
 * @type {Set<DownloadCancelListener>}
 */
const cancelListeners = new Set<DownloadCancelListener>();

/**
 * Worker entrypoint for download ZIP-backed export outputs.
 *
 * @param {DownloadWorkerEvent} event download worker request event.
 */
self.onmessage = (event: DownloadWorkerEvent) => {
  switch (event.data.type) {
    case 'download':
      cancelRequested = false;
      handleDownload(event.data).catch(error => {
        if (error instanceof DownloadCancelledError || cancelRequested) {
          self.postMessage({type: 'cancelled'});
        } else {
          const reason = error instanceof Error ? error.message : String(error);
          console.error('[GOLT] Download worker failed:', error);
          self.postMessage({type: 'error', reason});
        }
      });
      break;
    case 'cancel':
      cancelRequested = true;
      postProgress(100, 'Cancelling');
      notifyCancelListeners();
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
  postProgress(0, 'Preparing download');
  throwIfCancelled();
  const estimate = estimateDownloadWorkingSet(opts, recording, tribes.length);
  const mode = resolveDownloadMode(estimate, opts.forceChunkDownload);
  logDownloadWorkingSetEstimate(estimate);
  if (mode === 'normal') {
    postAllowedEstimateWarnings(estimate);
  } else {
    console.warn('[GOLT] Download switched to compressed recording chunk export', {
      forced: opts.forceChunkDownload,
      totalBytes: estimate.totalBytes,
      total: formatBytes(estimate.totalBytes)
    });
  }
  if (opts.forceChunkDownload || opts.saves || opts.metrics || opts.png || opts.mp4) {
    postProgress(10, 'Opening ZIP output');
    const zip = await ZipWriter.open(ZIP_DOWNLOAD_FILENAME);
    const unregisterZipCancel = addCancelListener(() => zip.abort().catch(error => console.warn('[GOLT] ZIP cancellation abort failed:', error)));
    try {
      if (mode === 'compressed-chunks') {
        if (recording) {
          await writeCompressedChunkExport(zip, {
            recording,
            frameRange: opts.frameRange,
            metadata: {tribes, rules}
          }, {
            shouldCancel: () => cancelRequested,
            onProgress: postProgress
          });
        } else {
          throw new Error('Compressed chunk export requires recorded frames.');
        }
      } else {
        await writeSaveEntries(zip, opts, snapshot, recording, tribes, rules);
      }
      if (mode === 'normal' && (opts.metrics || opts.png || opts.mp4) && recording) {
        await writeRecordedFrameOutputs(zip, opts, recording, tribes, estimate);
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
      await cleanupZipAfterFailure(zip, error);
      throw error;
    } finally {
      unregisterZipCancel();
    }
  } else {
    postProgress(100, 'Done');
  }
  self.postMessage({type: 'done'});
}

/**
 * Registers a cancellation listener.
 *
 * @param {DownloadCancelListener} listener listener to call when cancellation is requested.
 * @returns {() => void} unregister callback.
 */
function addCancelListener(listener: DownloadCancelListener): () => void {
  cancelListeners.add(listener);
  if (cancelRequested) {
    listener();
  }
  return () => cancelListeners.delete(listener);
}

/**
 * Notifies all active cancellation listeners.
 */
function notifyCancelListeners(): void {
  for (const listener of Array.from(cancelListeners)) {
    try {
      listener();
    } catch (error) {
      console.warn('[GOLT] Download cancellation listener failed:', error);
    }
  }
}

/**
 * Cleans up partial ZIP output after download failure or cancellation.
 *
 * @async
 * @param {ZipWriter} zip zip writer to clean up.
 * @param {unknown} error failure reason.
 */
async function cleanupZipAfterFailure(zip: ZipWriter, error: unknown): Promise<void> {
  if (cancelRequested || error instanceof DownloadCancelledError) {
    cleanupCancelledZip(zip);
  } else {
    await zip.cleanup();
  }
}

/**
 * Starts cancelled ZIP cleanup without blocking cancellation acknowledgement.
 *
 * @param {ZipWriter} zip zip writer to clean up.
 */
function cleanupCancelledZip(zip: ZipWriter): void {
  zip.cleanup().then(() => self.postMessage({type: 'cancel-cleanup-done'})).catch(error => {
    console.warn('[GOLT] Cancelled ZIP cleanup failed:', error);
    self.postMessage({type: 'cancel-cleanup-done'});
  });
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
    console.warn('[GOLT] Metrics row estimate exceeds in-memory threshold; streaming CSV and JSON to OPFS-backed ZIP entries');
    postWarning(`Estimated Metrics memory is high (${formatBytes(estimate.metricEntryBytes)}), so CSV and JSON will be streamed during export.`);
  }
  if (estimate.metricCsvBytes > METRICS_CSV_LARGE_OUTPUT_BYTES) {
    console.warn('[GOLT] Metrics CSV output estimate is large:', {
      metricCsvBytes: estimate.metricCsvBytes,
      metricCsv: formatBytes(estimate.metricCsvBytes),
      metricFrameCount: estimate.metricFrameCount
    });
    postWarning(`Metrics CSV output is expected to be large (${formatBytes(estimate.metricCsvBytes)}). Finalizing the ZIP and starting the browser download may take a while.`);
  }
}

/**
 * Formats byte counts for diagnostics and error messages.
 *
 * @param {number} bytes byte count.
 * @returns {string} formatted byte count.
 */
function formatBytes(bytes: number): string {
  const gib = bytes / (1024 ** 3);
  return gib >= 1 ? `${gib.toFixed(2)} GiB` : `${(bytes / (1024 ** 2)).toFixed(1)} MiB`;
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
    }, entry, createSaveProgressReporter(SAVE_WRITE_PROGRESS_START, SAVE_WRITE_PROGRESS_END, 'Writing current save'), createDownloadSnapshotStreamOptions()));
  }
}

/**
 * Writes first and last selected recorded saves.
 *
 * @async
 * @param {ZipWriter} zip zip writer.
 * @param {DownloadRequestPayload} opts selected download options.
 * @param {NonNullable<DownloadRequest['recording']>} recording recording manifest and dimensions.
 * @param {DownloadRequest['tribes']} tribes snapshot tribe metadata.
 * @param {GoltStateData['rules']} rules snapshot rule metadata.
 */
async function writeRecordedSaveEntries(zip: ZipWriter, opts: DownloadRequestPayload, recording: NonNullable<DownloadRequest['recording']>, tribes: DownloadRequest['tribes'], rules: GoltStateData['rules']): Promise<void> {
  postProgress(SAVE_WRITE_PROGRESS_START, 'Resolving selected frames');
  throwIfCancelled();
  const selection = resolveRecordingFrameSelection(recording.manifest, opts.frameRange);
  const firstRef = resolveRecordingFrameRef(recording.manifest, selection.startIndex);
  const lastRef = resolveRecordingFrameRef(recording.manifest, selection.endIndex);
  if (firstRef && lastRef) {
    const twoEntries = lastRef.globalFrameIndex !== firstRef.globalFrameIndex;
    const firstEnd = twoEntries ? Math.round((SAVE_WRITE_PROGRESS_START + SAVE_WRITE_PROGRESS_END) / 2) : SAVE_WRITE_PROGRESS_END;
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
    }, entry, createSaveProgressReporter(SAVE_WRITE_PROGRESS_START, firstEnd, 'Writing first save'), createDownloadSnapshotStreamOptions()));
    if (twoEntries) {
      const lastStart = Math.min(SAVE_WRITE_PROGRESS_END, firstEnd + 1);
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
      }, entry, createSaveProgressReporter(lastStart, SAVE_WRITE_PROGRESS_END, 'Writing last save'), createDownloadSnapshotStreamOptions()));
    }
  } else {
    console.warn('[GOLT] Saves requested but selected recording frames could not be resolved');
  }
}

/**
 * Writes recorded frame outputs that share the selected recording iteration.
 *
 * @async
 * @param {ZipWriter} zip zip writer.
 * @param {DownloadRequestPayload} opts selected download options.
 * @param {NonNullable<DownloadRequest['recording']>} recording recording manifest and dimensions.
 * @param {DownloadRequest['tribes']} tribes snapshot tribe metadata.
 * @param {DownloadWorkingSetEstimate} estimate download working-set estimate.
 */
async function writeRecordedFrameOutputs(zip: ZipWriter, opts: DownloadRequestPayload, recording: NonNullable<DownloadRequest['recording']>, tribes: DownloadRequest['tribes'], estimate: DownloadWorkingSetEstimate): Promise<void> {
  const selection = resolveRecordingFrameSelection(recording.manifest, opts.frameRange);
  const metricsWriter = opts.metrics ? await createMetricsExportWriter(zip, recording, selection, tribes, createSharedMetricsOptions(estimate)) : null;
  const pngWriter = opts.png ? new PngFrameExportWriter(zip, tribes, selection.framesTotal, createDownloadSnapshotStreamOptions()) : null;
  let mp4Writer: Mp4FrameExportWriter | null = null;
  const operationsPerFrame = Number(metricsWriter !== null) + Number(pngWriter !== null) + Number(opts.mp4);
  let framesCompleted = 0;
  try {
    postProgress(FRAME_OUTPUT_PROGRESS_START, 'Reading recorded frames');
    for await (const frame of iterateRecordedFrames(recording, opts.frameRange, {
      shouldCancel: () => cancelRequested,
      onProgress: progress => postFrameOutputProgress(selection, framesCompleted, 0, operationsPerFrame, 0, createFrameOutputStatus(opts, framesCompleted + 1, progress.framesTotal))
    })) {
      throwIfCancelled();
      let operationIndex = 0;
      if (metricsWriter) {
        await metricsWriter.writeFrame(frame, createFrameOutputReporter(selection, framesCompleted, operationIndex, operationsPerFrame, opts));
        operationIndex++;
      }
      if (pngWriter) {
        await pngWriter.writeFrame(frame, createFrameOutputReporter(selection, framesCompleted, operationIndex, operationsPerFrame, opts));
        operationIndex++;
      }
      if (opts.mp4) {
        mp4Writer ??= await createMp4FrameExportWriter(zip, recording, selection, tribes, frame, createSharedMp4Options(opts));
        await mp4Writer.writeFrame(frame, createFrameOutputReporter(selection, framesCompleted, operationIndex, operationsPerFrame, opts));
      }
      framesCompleted++;
      postFrameOutputProgress(selection, framesCompleted, 0, operationsPerFrame, 0, createFrameOutputStatus(opts, framesCompleted, selection.framesTotal));
    }
    throwIfCancelled();
    if (metricsWriter) {
      await metricsWriter.finish();
    }
    if (pngWriter) {
      await pngWriter.finish();
    }
    if (mp4Writer) {
      await mp4Writer.finish();
    }
  } finally {
    await metricsWriter?.dispose();
    await mp4Writer?.dispose();
  }
}

/**
 * Creates Metrics options for shared frame-output orchestration.
 *
 * @param {DownloadWorkingSetEstimate} estimate download working-set estimate.
 * @returns {MetricsExportOptions} Metrics export options.
 */
function createSharedMetricsOptions(estimate: DownloadWorkingSetEstimate): MetricsExportOptions {
  return {
    shouldCancel: () => cancelRequested,
    onProgress: progress => {
      throwIfCancelled();
      postProgress(FRAME_OUTPUT_PROGRESS_END, progress.status);
    },
    onWarning: postWarning,
    streamEntries: estimate.streamMetrics
  };
}

/**
 * Creates MP4 options for shared frame-output orchestration.
 *
 * @param {DownloadRequestPayload} opts selected download options.
 * @returns {Parameters<typeof createMp4FrameExportWriter>[5]} MP4 export options.
 */
function createSharedMp4Options(opts: DownloadRequestPayload): Parameters<typeof createMp4FrameExportWriter>[5] {
  return {
    fps: opts.fps,
    bitrate: opts.bitrate,
    shouldCancel: () => cancelRequested,
    onStatus: status => {
      throwIfCancelled();
      postProgress(FRAME_OUTPUT_PROGRESS_END, status);
    }
  };
}

/**
 * Creates a row reporter for the shared frame-output pass.
 *
 * @param {RecordingFrameSelection} selection selected frame range.
 * @param {number} frameIndex zero-based selected frame index.
 * @param {number} operationIndex zero-based operation index within the frame.
 * @param {number} operationsPerFrame output operations per frame.
 * @param {DownloadRequestPayload} opts selected download options.
 * @returns {MetricsFrameProgressReporter} row progress reporter.
 */
function createFrameOutputReporter(selection: RecordingFrameSelection, frameIndex: number, operationIndex: number, operationsPerFrame: number, opts: DownloadRequestPayload): MetricsFrameProgressReporter {
  return (rowsProcessed, rowsTotal) => postFrameOutputProgress(selection, frameIndex, operationIndex, operationsPerFrame, rowsTotal > 0 ? rowsProcessed / rowsTotal : 1, createFrameOutputStatus(opts, frameIndex + 1, selection.framesTotal));
}

/**
 * Posts mapped shared frame-output progress.
 *
 * @param {RecordingFrameSelection} selection selected frame range.
 * @param {number} frameIndex zero-based selected frame index.
 * @param {number} operationIndex zero-based operation index within the frame.
 * @param {number} operationsPerFrame output operations per frame.
 * @param {number} operationFraction current operation fraction.
 * @param {string} status visible status text.
 */
function postFrameOutputProgress(selection: RecordingFrameSelection, frameIndex: number, operationIndex: number, operationsPerFrame: number, operationFraction: number, status: string): void {
  throwIfCancelled();
  const totalUnits = Math.max(1, selection.framesTotal * Math.max(1, operationsPerFrame));
  const completedUnits = Math.min(totalUnits, (frameIndex * Math.max(1, operationsPerFrame)) + operationIndex + Math.max(0, Math.min(1, operationFraction)));
  postProgress(Math.round(FRAME_OUTPUT_PROGRESS_START + (completedUnits / totalUnits) * (FRAME_OUTPUT_PROGRESS_END - FRAME_OUTPUT_PROGRESS_START)), status);
}

/**
 * Creates shared frame-output status text.
 *
 * @param {DownloadRequestPayload} opts selected download options.
 * @param {number} frameNumber current one-based selected frame number.
 * @param {number} framesTotal selected frame count.
 * @returns {string} status text.
 */
function createFrameOutputStatus(opts: DownloadRequestPayload, frameNumber: number, framesTotal: number): string {
  let status: string;
  if (opts.metrics && opts.png && opts.mp4) {
    status = `Computing metrics, writing PNG, and encoding MP4 frame ${frameNumber} / ${framesTotal}`;
  } else if (opts.metrics && opts.png) {
    status = `Computing metrics and writing PNG frame ${frameNumber} / ${framesTotal}`;
  } else if (opts.metrics && opts.mp4) {
    status = `Computing metrics and encoding MP4 frame ${frameNumber} / ${framesTotal}`;
  } else if (opts.png && opts.mp4) {
    status = `Writing PNG and encoding MP4 frame ${frameNumber} / ${framesTotal}`;
  } else if (opts.png) {
    status = `Writing PNG frame ${frameNumber} / ${framesTotal}`;
  } else if (opts.mp4) {
    status = `Encoding MP4 frame ${frameNumber} / ${framesTotal}`;
  } else {
    status = 'Computing metrics';
  }
  return status;
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
    postProgress(Math.round(startPercent + (Math.max(0, Math.min(100, update.percent ?? 0)) / 100) * (endPercent - startPercent)), status);
  };
}

/**
 * Creates snapshot stream options for ZIP save entries.
 *
 * @returns {SnapshotStreamOptions} snapshot stream cancellation options.
 */
function createDownloadSnapshotStreamOptions(): SnapshotStreamOptions {
  return {shouldCancel: () => cancelRequested, onCancelRequested: addCancelListener};
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
  self.postMessage({type: 'warning', message});
}
