import {DownloadCancelledError, DownloadRequestPayload} from '../model/download';
import {RecordingManifest} from '../model/recording';
import {alignPackedBytesToWords} from '../util/grid-format';
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
          onProgress: createMetricsProgressReporter(METRICS_PROGRESS_START, METRICS_PROGRESS_END)
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
