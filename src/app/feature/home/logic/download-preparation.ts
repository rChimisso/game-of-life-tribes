import {DownloadCancelledError} from './download-cancelled-error';
import {estimateDownloadWorkingSet, resolveDownloadMode} from './download-estimate';
import {clearTempOpfsDirectory} from './opfs-temp';
import {DownloadRequestPayload} from '../model/download';
import {DOWNLOAD_CHUNK_MODE_THRESHOLD_BYTES, DownloadMode} from '../model/download-estimate';
import {HomeDownloadPreparationCallbacks} from '../model/home-download';
import {PREPARING_SNAPSHOT_STATUS, WAITING_COMPRESSION_JOBS_STATUS} from '../model/home-runtime';
import {RecordingMessage} from '../model/worker-message';

/**
 * Checks whether download outputs need recorded frames.
 *
 * @param {DownloadRequestPayload} opts download options.
 * @returns {boolean} true when recording data is needed.
 */
function needsRecordedFrames(opts: DownloadRequestPayload): boolean {
  return opts.forceChunkDownload || opts.mp4 || opts.png || opts.metrics || opts.saves;
}

/**
 * Flushes recording data before download when frame outputs are requested.
 *
 * @async
 * @param {boolean} needFrames whether recording frames are required.
 * @param {HomeDownloadPreparationCallbacks} callbacks preparation callbacks.
 * @returns {Promise<RecordingMessage | null>} flushed recording manifest.
 */
async function flushRecordingForDownload(needFrames: boolean, callbacks: HomeDownloadPreparationCallbacks): Promise<RecordingMessage | null> {
  console.log('[GOLT] Clearing temporary OPFS files before download');
  await clearTempOpfsDirectory();
  throwIfDownloadCancelled(callbacks);
  let flushedRecording: RecordingMessage | null = null;
  if (needFrames) {
    console.log('[GOLT] Download OPFS flush started');
    flushedRecording = await callbacks.requestRecordingManifest();
    console.log('[GOLT] Download OPFS flush completed', {
      chunks: flushedRecording.manifest.chunks.length,
      generationStart: flushedRecording.manifest.generationStart,
      generationEnd: flushedRecording.manifest.generationEnd
    });
    throwIfDownloadCancelled(callbacks);
    callbacks.setProgress(0, WAITING_COMPRESSION_JOBS_STATUS);
    callbacks.markForCheck();
  }
  return flushedRecording;
}

/**
 * Resolves the first download mode and updates the estimate flag.
 *
 * @param {DownloadRequestPayload} opts download options.
 * @param {(RecordingMessage | null)} flushedRecording flushed recording manifest.
 * @param {HomeDownloadPreparationCallbacks} callbacks preparation callbacks.
 * @returns {DownloadMode} initial download mode.
 */
function resolveInitialDownloadMode(opts: DownloadRequestPayload, flushedRecording: RecordingMessage | null, callbacks: HomeDownloadPreparationCallbacks): DownloadMode {
  const initialEstimate = estimateDownloadWorkingSet(opts, flushedRecording, callbacks.getTribeCount());
  const initialMode = resolveDownloadMode(initialEstimate, opts.forceChunkDownload);
  callbacks.setEstimateExceedsThreshold(initialEstimate.totalBytes > DOWNLOAD_CHUNK_MODE_THRESHOLD_BYTES);
  return initialMode;
}

/**
 * Waits for the required compression state.
 *
 * @async
 * @param {DownloadMode} initialMode initial download mode.
 * @param {HomeDownloadPreparationCallbacks} callbacks preparation callbacks.
 */
async function waitForPreparedCompression(initialMode: DownloadMode, callbacks: HomeDownloadPreparationCallbacks): Promise<void> {
  if (initialMode === 'compressed-chunks') {
    console.log('[GOLT] Download waiting for all recording chunks before chunk export');
    await callbacks.waitForCompression('all');
  } else {
    console.log('[GOLT] Download active compression wait started');
    await callbacks.waitForCompression('active');
  }
  throwIfDownloadCancelled(callbacks);
}

/**
 * Stops download preparation when cancellation was requested.
 *
 * @param {HomeDownloadPreparationCallbacks} callbacks preparation callbacks.
 */
function throwIfDownloadCancelled(callbacks: HomeDownloadPreparationCallbacks): void {
  if (callbacks.isCancelRequested()) {
    throw new DownloadCancelledError();
  }
}

/**
 * Handles download setup failure or cancellation before the worker starts.
 *
 * @param {unknown} error failure reason.
 * @param {HomeDownloadPreparationCallbacks} callbacks preparation callbacks.
 */
function handleDownloadPreparationFailure(error: unknown, callbacks: HomeDownloadPreparationCallbacks): void {
  if (callbacks.isCancelRequested() || error instanceof DownloadCancelledError) {
    callbacks.setProgress(0, 'Cancelling');
  } else {
    console.error('[GOLT] Download preparation failed:', error);
    callbacks.openSnack('Download failed while preparing compression data. Try again.', 'error');
  }
  callbacks.resumeCompression();
  callbacks.resetDownloadState();
  callbacks.setCancelRequested(false);
  callbacks.markForCheck();
}

/**
 * Prepares a consistent snapshot and optional recording manifest for download.
 *
 * @async
 * @param {DownloadRequestPayload} opts download options.
 * @param {HomeDownloadPreparationCallbacks} callbacks preparation callbacks.
 */
export async function prepareHomeDownload(opts: DownloadRequestPayload, callbacks: HomeDownloadPreparationCallbacks): Promise<void> {
  callbacks.setCancelRequested(false);
  callbacks.setDownloadPreview(opts);
  const needFrames = needsRecordedFrames(opts);
  console.log('[GOLT] Download started', {
    metrics: opts.metrics,
    mp4: opts.mp4,
    png: opts.png,
    saves: opts.saves,
    forceChunkDownload: opts.forceChunkDownload,
    frameRange: opts.frameRange
  });
  callbacks.pauseIfRunning();
  callbacks.setProgress(0, needFrames ? 'Saving pending recording frames' : PREPARING_SNAPSHOT_STATUS);
  callbacks.markForCheck();
  try {
    const flushedRecording = await flushRecordingForDownload(needFrames, callbacks);
    const initialMode = resolveInitialDownloadMode(opts, flushedRecording, callbacks);
    await waitForPreparedCompression(initialMode, callbacks);
    callbacks.setProgress(30, needFrames ? 'Refreshing recording manifest' : PREPARING_SNAPSHOT_STATUS);
    callbacks.markForCheck();
    const snapshotP = callbacks.requestSnapshot();
    const recordingP = needFrames ? callbacks.requestRecordingManifest() : Promise.resolve(null);
    const [snap, rec] = await Promise.all([snapshotP, recordingP]);
    throwIfDownloadCancelled(callbacks);
    console.log('[GOLT] Download manifest handoff ready', {
      chunks: rec?.manifest.chunks.length ?? 0,
      generationStart: rec?.manifest.generationStart ?? null,
      generationEnd: rec?.manifest.generationEnd ?? null
    });
    callbacks.startDownloadWorker(opts, snap, rec, performance.now());
  } catch (error) {
    handleDownloadPreparationFailure(error, callbacks);
  }
}
