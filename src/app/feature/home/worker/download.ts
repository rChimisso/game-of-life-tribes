import {DownloadRequestPayload} from '../model/download';
import {RecordingManifest} from '../model/recording';
import {alignPackedBytesToWords} from '../util/grid-format';
import {writeGoltStateStream} from './snapshot/golt-build-stream';
import {GoltStateData, ParsedGoltState, SnapshotProgressReporter} from './snapshot/golt-types';
import {readRecordingFrame} from './snapshot/recording-frame-reader';
import {countRecordingFrames, resolveRecordingFrameRef} from './snapshot/recording-frame-ref';
import {ZipWriter} from './zip/zip-writer';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * First percent used for streaming save-entry writes.
 *
 * @type {number}
 */
const SAVE_WRITE_PROGRESS_START = 35;

/**
 * Last percent used for streaming save-entry writes.
 *
 * @type {number}
 */
const SAVE_WRITE_PROGRESS_END = 85;

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
 * Download worker input.
 *
 * @typedef {WorkerInput}
 */
type WorkerInput = DownloadRequest;

/**
 * Download worker request event.
 *
 * @typedef {DownloadWorkerEvent}
 */
type DownloadWorkerEvent = MessageEvent<WorkerInput>;

/**
 * Saves-only download worker. Metrics, PNG, and MP4 are intentionally skipped in this milestone.
 *
 * @param {DownloadWorkerEvent} event download worker request event.
 */
self.onmessage = (event: DownloadWorkerEvent) => {
  handleDownload(event.data).catch(error => {
    const reason = error instanceof Error ? error.message : String(error);
    console.error('[GOLT] Download worker failed:', error);
    self.postMessage({type: 'error', reason});
  });
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
  if (opts.saves) {
    postProgress(10, 'Opening ZIP output');
    const zip = await ZipWriter.open('gol-export.zip');
    try {
      await writeSaveEntries(zip, opts, snapshot, recording, tribes, rules);
      postProgress(90, 'Finalizing ZIP');
      const file = await zip.finalize();
      postProgress(100, 'Done');
      self.postMessage({
        type: 'done-part',
        filename: file.name,
        file
      });
    } catch (error) {
      await zip.abort();
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
  if (recording && recording.manifest.chunks.length > 0) {
    await writeRecordedSaveEntries(zip, opts, recording, tribes, rules);
  } else {
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
  postProgress(20, 'Resolving selected frames');
  const totalFrames = countRecordingFrames(recording.manifest);
  const selectedStartIndex = opts.frameRange && totalFrames > 0 ? Math.max(0, Math.min(totalFrames - 1, opts.frameRange.startFrame - 1)) : 0;
  const selectedEndIndex = opts.frameRange && totalFrames > 0 ? Math.max(selectedStartIndex, Math.min(totalFrames - 1, opts.frameRange.endFrame - 1)) : Math.max(0, totalFrames - 1);
  const firstRef = resolveRecordingFrameRef(recording.manifest, selectedStartIndex);
  const lastRef = resolveRecordingFrameRef(recording.manifest, selectedEndIndex);
  if (firstRef && lastRef) {
    const twoEntries = lastRef.globalFrameIndex !== firstRef.globalFrameIndex;
    const firstEnd = twoEntries ? 60 : SAVE_WRITE_PROGRESS_END;
    postProgress(SAVE_WRITE_PROGRESS_START, 'Writing first save');
    const firstFrame = await readRecordingFrame(recording, firstRef);
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
      postProgress(65, 'Writing last save');
      const lastFrame = await readRecordingFrame(recording, lastRef);
      await zip.addEntry(`state-last-gen${lastFrame.generation}.golt`, entry => writeGoltStateStream({
        generation: lastFrame.generation,
        cols: recording.cols,
        rows: recording.rows,
        grid: alignPackedBytesToWords(lastFrame.packed),
        gridFormat: lastRef.gridFormat,
        tribes,
        rules
      }, entry, createSaveProgressReporter(65, SAVE_WRITE_PROGRESS_END, 'Writing last save')));
    }
  } else {
    console.warn('[GOLT] Saves requested but selected recording frames could not be resolved');
  }
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
    const innerPercent = Math.max(0, Math.min(100, update.percent ?? 0));
    const span = endPercent - startPercent;
    postProgress(Math.round(startPercent + (innerPercent / 100) * span), status);
  };
}

/**
 * Logs unsupported output selections for the first milestone.
 *
 * @param {DownloadRequestPayload} opts selected download options.
 */
function logSkippedOutputs(opts: DownloadRequestPayload): void {
  if (opts.metrics) {
    console.log('[GOLT] Metrics export is not implemented in the new download worker yet; skipping metrics output.');
  }
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
