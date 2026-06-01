import {createSnapshotPayload} from './snapshot-worker-runner';
import {dispatchWorkerMessage} from './worker-runner';
import {HomeDownloadWorkerCallbacks, HomeDownloadWorkerInput} from '../model/home-download';
import {WorkerMessageHandlerMap} from '../model/worker-runner';
import {DownloadWorkerMessage} from '../worker/download/model/download-worker-message';

/**
 * Download part-ready response type.
 *
 * @type {'done-part'}
 */
const DOWNLOAD_DONE_PART_TYPE = 'done-part';

/**
 * Download cancel-cleanup response type.
 *
 * @type {'cancel-cleanup-done'}
 */
const DOWNLOAD_CANCEL_CLEANUP_DONE_TYPE = 'cancel-cleanup-done';

/**
 * Posts the download request payload.
 *
 * @param {Worker} worker download worker.
 * @param {HomeDownloadWorkerInput} input worker input.
 */
function postDownloadRequest(worker: Worker, input: HomeDownloadWorkerInput): void {
  const gridBuf = input.snapshot.grid;
  const snapshot = createSnapshotPayload(input.snapshot, input.tribes, input.rules);
  const {recording} = input;
  const hasChunks = recording !== null && recording.manifest.chunks.length > 0;
  const transferables: ArrayBuffer[] = [];
  if (gridBuf?.buffer?.byteLength > 0) {
    transferables.push(gridBuf.buffer);
  }
  worker.postMessage({
    type: 'download',
    opts: input.opts,
    snapshot,
    recording: hasChunks ? {
      manifest: recording.manifest,
      cols: recording.cols,
      rows: recording.rows
    } : null
  }, transferables);
}

/**
 * Starts the download worker once snapshot and recording data are stable.
 *
 * @param {HomeDownloadWorkerInput} input worker input.
 * @param {HomeDownloadWorkerCallbacks} callbacks worker callbacks.
 */
export function startHomeDownloadWorker(input: HomeDownloadWorkerInput, callbacks: HomeDownloadWorkerCallbacks): void {
  const worker = new Worker(new URL('../worker/download.ts', import.meta.url), {type: 'module'});
  const pendingDownloadSideEffects: Promise<void>[] = [];
  callbacks.setWorker(worker);
  const releaseDownloadUi = () => {
    callbacks.resetDownloadState();
    callbacks.setCancelRequested(false);
    if (callbacks.getWorker() === worker) {
      callbacks.setWorker(null);
    }
    callbacks.markForCheck();
    callbacks.resumeCompression();
    callbacks.requestUncompressedChunks();
  };
  const terminateDownloadWorker = (reason: string) => {
    if (reason === 'error') {
      console.warn('[GOLT] Download worker terminated after error');
    }
    worker.terminate();
  };
  const cleanupDownload = () => {
    releaseDownloadUi();
    terminateDownloadWorker('done');
  };
  worker.onerror = () => {
    console.error('[GOLT] Download worker failed unexpectedly');
    callbacks.openSnack('Download failed unexpectedly. Try again.', 'error');
    cleanupDownload();
  };
  const downloadHandlers: WorkerMessageHandlerMap<DownloadWorkerMessage> = {
    progress: message => {
      callbacks.setProgress(message.percent, message.status ?? '');
      callbacks.markForCheck();
    },
    warning: message => {
      callbacks.openSnack(message.message ?? 'Download warning.', 'warn');
    },
    [DOWNLOAD_DONE_PART_TYPE]: message => {
      console.log('[GOLT] Download part ready:', message.filename);
      const {filename, file} = message;
      const sideEffect = callbacks.waitForMinimumVisibleTime(input.startedAt).then(() => {
        if (!callbacks.isCancelRequested() && callbacks.getWorker() === worker) {
          callbacks.downloadBlob(file, filename);
        }
      });
      pendingDownloadSideEffects.push(sideEffect);
    },
    error: message => {
      const reason = message.reason ?? 'Unknown error';
      const suggestion = typeof reason === 'string' && reason.includes('Array buffer allocation failed') ? ' Try downloading fewer frames or fewer output selections.' : '';
      callbacks.openSnack(`Download error: ${reason}${suggestion}`, 'error');
      cleanupDownload();
    },
    cancelled: () => {
      releaseDownloadUi();
    },
    [DOWNLOAD_CANCEL_CLEANUP_DONE_TYPE]: () => {
      terminateDownloadWorker('cancel cleanup done');
    },
    done: async() => {
      console.log('[GOLT] Download completed');
      await Promise.all(pendingDownloadSideEffects);
      cleanupDownload();
    }
  };
  worker.onmessage = (event: MessageEvent<unknown>) => {
    dispatchWorkerMessage<DownloadWorkerMessage>(event.data, downloadHandlers);
  };
  postDownloadRequest(worker, input);
}
