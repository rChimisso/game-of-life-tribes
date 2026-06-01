import {HomeDownloadWorkerCallbacks, HomeDownloadWorkerInput} from '../model/home-download';

/**
 * Posts the download request payload.
 *
 * @param {Worker} worker download worker.
 * @param {HomeDownloadWorkerInput} input worker input.
 */
function postDownloadRequest(worker: Worker, input: HomeDownloadWorkerInput): void {
  const gridBuf = input.snapshot.grid;
  const {recording} = input;
  const hasChunks = recording !== null && recording.manifest.chunks.length > 0;
  const transferables: ArrayBuffer[] = [];
  if (gridBuf?.buffer?.byteLength > 0) {
    transferables.push(gridBuf.buffer);
  }
  worker.postMessage({
    type: 'download',
    opts: input.opts,
    snapshot: {
      generation: input.snapshot.generation,
      cols: input.snapshot.cols,
      rows: input.snapshot.rows,
      grid: gridBuf,
      gridFormat: input.snapshot.gridFormat,
      tribes: input.tribes.map(t => ({id: t.id, color: t.color})),
      rules: input.rules
    },
    recording: hasChunks ? {
      manifest: recording.manifest,
      cols: recording.cols,
      rows: recording.rows
    } : null,
    tribes: input.tribes.map(t => ({id: t.id, color: t.color})),
    rules: input.rules
  }, transferables);
}

/**
 * Starts the download worker once snapshot and recording data are stable.
 *
 * @export
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
  worker.onmessage = async(e: MessageEvent) => {
    if (e.data.type === 'progress') {
      callbacks.setProgress(e.data.percent, e.data.status ?? '');
      callbacks.markForCheck();
    } else if (e.data.type === 'warning') {
      callbacks.openSnack(e.data.message ?? 'Download warning.', 'warn');
    } else if (e.data.type === 'done-part') {
      console.log('[GOLT] Download part ready:', e.data.filename);
      const blob = e.data.file instanceof Blob ? e.data.file : new Blob([e.data.buffer]);
      const sideEffect = callbacks.waitForMinimumVisibleTime(input.startedAt).then(() => {
        if (!callbacks.isCancelRequested() && callbacks.getWorker() === worker) {
          callbacks.downloadBlob(blob, e.data.filename);
        }
      });
      pendingDownloadSideEffects.push(sideEffect);
    } else if (e.data.type === 'error') {
      const reason = e.data.reason ?? 'Unknown error';
      const suggestion = typeof reason === 'string' && reason.includes('Array buffer allocation failed') ? ' Try downloading fewer frames or fewer output selections.' : '';
      callbacks.openSnack(`Download error: ${reason}${suggestion}`, 'error');
      cleanupDownload();
    } else if (e.data.type === 'cancelled') {
      releaseDownloadUi();
    } else if (e.data.type === 'cancel-cleanup-done') {
      terminateDownloadWorker('cancel cleanup done');
    } else if (e.data.type === 'done') {
      console.log('[GOLT] Download completed');
      await Promise.all(pendingDownloadSideEffects);
      cleanupDownload();
    }
  };
  postDownloadRequest(worker, input);
}
