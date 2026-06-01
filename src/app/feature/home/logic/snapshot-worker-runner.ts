import {ProgressStatusMode} from '../../../shared/component/progress-status/model/progress-status';
import {SnapshotSaveOutput} from '../model/home-snapshot';
import {Ruleset, Tribe} from '../model/rule';
import {SnapshotMessage} from '../model/worker-message';
import {ParsedGoltState} from '../worker/snapshot/model/golt-types';

/**
 * Snapshot progress callback.
 *
 * @typedef {SnapshotProgressCallback}
 */
export type SnapshotProgressCallback = (mode: ProgressStatusMode | undefined, percent: number | null, status: string) => void;

/**
 * Runs the snapshot worker in save mode.
 *
 * @param {SnapshotMessage} snap snapshot to save.
 * @param {readonly Tribe[]} tribes current tribes.
 * @param {Ruleset['rules']} rules current rules.
 * @param {SnapshotProgressCallback} onProgress progress callback.
 * @returns {Promise<SnapshotSaveOutput>} saved snapshot output.
 */
export function runSnapshotSaveWorker(snap: SnapshotMessage, tribes: readonly Tribe[], rules: Ruleset['rules'], onProgress: SnapshotProgressCallback): Promise<SnapshotSaveOutput> {
  return new Promise<SnapshotSaveOutput>((resolve, reject) => {
    const worker = new Worker(new URL('../worker/snapshot.ts', import.meta.url), {type: 'module'});
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('Snapshot worker failed unexpectedly'));
    };
    worker.onmessage = (event: MessageEvent) => {
      const message = event.data as {
        type: 'saved-buffer' | 'saved-file' | 'progress' | 'error';
        filename?: string;
        buffer?: ArrayBuffer;
        file?: File;
        mode?: ProgressStatusMode;
        percent?: number | null;
        status?: string;
        reason?: string;
      };
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
      snapshot: {
        generation: snap.generation,
        cols: snap.cols,
        rows: snap.rows,
        grid: snap.grid,
        gridFormat: snap.gridFormat,
        tribes: tribes.map(t => ({id: t.id, color: t.color})),
        rules
      }
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
    worker.onmessage = (event: MessageEvent) => {
      const message = event.data as {
        type: 'loaded' | 'invalid' | 'progress' | 'error';
        cols?: number;
        rows?: number;
        generation?: number;
        grid?: Uint32Array;
        gridFormat?: ParsedGoltState['gridFormat'];
        tribes?: ParsedGoltState['tribes'];
        rules?: ParsedGoltState['rules'];
        mode?: ProgressStatusMode;
        percent?: number | null;
        status?: string;
        reason?: string;
      };
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
