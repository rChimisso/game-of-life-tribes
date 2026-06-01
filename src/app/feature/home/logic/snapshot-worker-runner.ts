import {SnapshotSaveOutput} from '../model/home-snapshot';
import {Rule, Tribe} from '../model/rule';
import {SnapshotMessage} from '../model/worker-message';
import {ParsedGoltState} from '../worker/snapshot/model/golt-types';
import {SnapshotWorkerResponseEvent} from '../worker/snapshot/model/snapshot-worker-message';

import {ProgressStatusMode} from '~gol/shared/component/progress-status/model/progress-status';

/**
 * Snapshot progress callback.
 *
 * @typedef {SnapshotProgressCallback}
 */
export type SnapshotProgressCallback = (mode: ProgressStatusMode | undefined, percent: number | null, status: string) => void;

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
  return new Promise<SnapshotSaveOutput>((resolve, reject) => {
    const worker = new Worker(new URL('../worker/snapshot.ts', import.meta.url), {type: 'module'});
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('Snapshot worker failed unexpectedly'));
    };
    worker.onmessage = (event: SnapshotWorkerResponseEvent) => {
      const {data: message} = event;
      if (message.type === 'saved-buffer' && message.buffer instanceof ArrayBuffer && message.filename) {
        worker.terminate();
        resolve({
          filename: message.filename,
          blob: new Blob([message.buffer], {type: 'application/octet-stream'})
        });
      } else if (message.type === 'saved-file' && message.file instanceof File && message.filename) {
        worker.terminate();
        resolve({
          filename: message.filename,
          blob: message.file
        });
      } else if (message.type === 'saved-buffer' || message.type === 'saved-file') {
        worker.terminate();
        reject(new Error('Snapshot save failed: incomplete worker payload'));
      } else if (message.type === 'progress') {
        onProgress(message.mode, message.percent ?? null, message.status ?? '');
      } else if (message.type === 'error') {
        worker.terminate();
        reject(new Error(message.reason ?? 'Snapshot save failed'));
      }
    };
    worker.postMessage({
      type: 'save',
      snapshot: createSnapshotPayload(snap, tribes, rules)
    }, [snap.grid.buffer]);
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
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../worker/snapshot.ts', import.meta.url), {type: 'module'});
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('Snapshot worker failed unexpectedly'));
    };
    worker.onmessage = (event: SnapshotWorkerResponseEvent) => {
      const {data: message} = event;
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
        worker.terminate();
        resolve({
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
            worker.terminate();
            reject(new Error('Snapshot load failed: incomplete worker payload'));
            break;
          case 'invalid':
            worker.terminate();
            resolve(null);
            break;
          case 'progress':
            onProgress(message.mode, message.percent ?? null, message.status ?? '');
            break;
          case 'error':
            worker.terminate();
            reject(new Error(message.reason ?? 'Snapshot load failed'));
            break;
        }
      }
    };
    worker.postMessage({
      type: 'load',
      buffer
    }, [buffer]);
  });
}
