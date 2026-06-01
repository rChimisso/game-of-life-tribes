import {runWorker} from './worker-runner';
import {SnapshotSaveOutput} from '../model/home-snapshot';
import {Rule, Tribe} from '../model/rule';
import {SnapshotMessage} from '../model/worker-message';
import {WorkerRunnerContext} from '../model/worker-runner';
import {ParsedGoltState} from '../worker/snapshot/model/golt-types';
import {SnapshotLoadRequest, SnapshotSaveRequest, SnapshotWorkerResponse} from '../worker/snapshot/model/snapshot-worker-message';

import {ProgressStatusMode} from '~gol/shared/component/progress-status/model/progress-status';

/**
 * Snapshot progress callback.
 *
 * @typedef {SnapshotProgressCallback}
 */
type SnapshotProgressCallback = (mode: ProgressStatusMode | undefined, percent: number | null, status: string) => void;

/**
 * Snapshot buffer response type.
 *
 * @type {'saved-buffer'}
 */
const SNAPSHOT_SAVED_BUFFER_TYPE = 'saved-buffer';

/**
 * Snapshot file response type.
 *
 * @type {'saved-file'}
 */
const SNAPSHOT_SAVED_FILE_TYPE = 'saved-file';

/**
 * Creates the snapshot worker.
 *
 * @returns {Worker} snapshot worker instance.
 */
function createSnapshotWorker(): Worker {
  return new Worker(new URL('../worker/snapshot.ts', import.meta.url), {type: 'module'});
}

/**
 * Creates the unexpected snapshot worker error.
 *
 * @returns {Error} unexpected snapshot worker error.
 */
function createUnexpectedSnapshotWorkerError(): Error {
  return new Error('Snapshot worker failed unexpectedly');
}

/**
 * Handles a snapshot save worker response.
 *
 * @param {SnapshotWorkerResponse} message worker response.
 * @param {WorkerRunnerContext<SnapshotSaveOutput>} context worker runner context.
 * @param {SnapshotProgressCallback} onProgress progress callback.
 */
function handleSnapshotSaveMessage(message: SnapshotWorkerResponse, context: WorkerRunnerContext<SnapshotSaveOutput>, onProgress: SnapshotProgressCallback): void {
  if (message.type === SNAPSHOT_SAVED_BUFFER_TYPE && message.buffer instanceof ArrayBuffer && message.filename) {
    context.terminate();
    context.resolve({
      filename: message.filename,
      blob: new Blob([message.buffer], {type: 'application/octet-stream'})
    });
  } else if (message.type === SNAPSHOT_SAVED_FILE_TYPE && message.file instanceof File && message.filename) {
    context.terminate();
    context.resolve({
      filename: message.filename,
      blob: message.file
    });
  } else {
    switch (message.type) {
      case SNAPSHOT_SAVED_BUFFER_TYPE:
      case SNAPSHOT_SAVED_FILE_TYPE:
        context.terminate();
        context.reject(new Error('Snapshot save failed: incomplete worker payload'));
        break;
      case 'progress':
        onProgress(message.mode, message.percent ?? null, message.status ?? '');
        break;
      case 'error':
        context.terminate();
        context.reject(new Error(message.reason ?? 'Snapshot save failed'));
        break;
      case 'loaded':
      case 'invalid':
        break;
    }
  }
}

/**
 * Handles a snapshot load worker response.
 *
 * @param {SnapshotWorkerResponse} message worker response.
 * @param {WorkerRunnerContext<(ParsedGoltState | null)>} context worker runner context.
 * @param {SnapshotProgressCallback} onProgress progress callback.
 */
function handleSnapshotLoadMessage(message: SnapshotWorkerResponse, context: WorkerRunnerContext<ParsedGoltState | null>, onProgress: SnapshotProgressCallback): void {
  if (
    message.type === 'loaded' &&
    typeof message.cols === 'number' &&
    typeof message.rows === 'number' &&
    typeof message.generation === 'number' &&
    message.grid instanceof Uint32Array &&
    message.gridFormat &&
    Array.isArray(message.tribes) &&
    Array.isArray(message.rules)
  ) {
    context.terminate();
    context.resolve({
      cols: message.cols,
      rows: message.rows,
      generation: message.generation,
      grid: message.grid,
      gridFormat: message.gridFormat,
      tribes: message.tribes,
      rules: message.rules
    });
  } else {
    switch (message.type) {
      case 'loaded':
        context.terminate();
        context.reject(new Error('Snapshot load failed: incomplete worker payload'));
        break;
      case 'invalid':
        context.terminate();
        context.resolve(null);
        break;
      case 'progress':
        onProgress(message.mode, message.percent ?? null, message.status ?? '');
        break;
      case 'error':
        context.terminate();
        context.reject(new Error(message.reason ?? 'Snapshot load failed'));
        break;
      case SNAPSHOT_SAVED_BUFFER_TYPE:
      case SNAPSHOT_SAVED_FILE_TYPE:
        break;
    }
  }
}

/**
 * Creates the canonical `.golt` snapshot payload shared by save and download workers.
 *
 * @param {SnapshotMessage} snap engine snapshot.
 * @param {readonly Tribe[]} tribes current tribe metadata.
 * @param {Rule<Tribe[]>[]} rules current rule metadata.
 * @returns {ParsedGoltState} serializable snapshot payload.
 */
export function createSnapshotPayload(snap: SnapshotMessage, tribes: readonly Tribe[], rules: Rule<Tribe[]>[]): ParsedGoltState {
  return {
    generation: snap.generation,
    cols: snap.cols,
    rows: snap.rows,
    grid: snap.grid,
    gridFormat: snap.gridFormat,
    tribes: tribes.map(t => ({id: t.id, color: t.color})),
    rules
  };
}

/**
 * Runs the snapshot worker in save mode.
 *
 * @param {SnapshotMessage} snap snapshot to save.
 * @param {readonly Tribe[]} tribes current tribes.
 * @param {Rule<Tribe[]>[]} rules current rules.
 * @param {SnapshotProgressCallback} onProgress progress callback.
 * @returns {Promise<SnapshotSaveOutput>} saved snapshot output.
 */
export function runSnapshotSaveWorker(snap: SnapshotMessage, tribes: readonly Tribe[], rules: Rule<Tribe[]>[], onProgress: SnapshotProgressCallback): Promise<SnapshotSaveOutput> {
  return runWorker<SnapshotSaveRequest, SnapshotWorkerResponse, SnapshotSaveOutput>({
    createWorker: createSnapshotWorker,
    request: {
      type: 'save',
      snapshot: createSnapshotPayload(snap, tribes, rules)
    },
    transfer: [snap.grid.buffer],
    onUnexpectedError: createUnexpectedSnapshotWorkerError,
    onMessage: (message, context) => handleSnapshotSaveMessage(message, context, onProgress)
  });
}

/**
 * Runs the snapshot worker in load mode.
 *
 * @param {ArrayBuffer} buffer snapshot file buffer.
 * @param {SnapshotProgressCallback} onProgress progress callback.
 * @returns {Promise<ParsedGoltState | null>} parsed state or null when invalid.
 */
export function runSnapshotLoadWorker(buffer: ArrayBuffer, onProgress: SnapshotProgressCallback): Promise<ParsedGoltState | null> {
  return runWorker<SnapshotLoadRequest, SnapshotWorkerResponse, ParsedGoltState | null>({
    createWorker: createSnapshotWorker,
    request: {
      type: 'load',
      buffer
    },
    transfer: [buffer],
    onUnexpectedError: createUnexpectedSnapshotWorkerError,
    onMessage: (message, context) => handleSnapshotLoadMessage(message, context, onProgress)
  });
}
