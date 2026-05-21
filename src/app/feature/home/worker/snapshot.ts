import {buildGoltStateFile} from './snapshot/golt-build';
import {parseGoltStateFile} from './snapshot/golt-parse';
import {GoltStateData, SnapshotProgressUpdate} from './snapshot/golt-types';

import {GridFormatMetadata} from '~gol/feature/home/model/grid-format';

/**
 * Request to build a `.golt` snapshot file.
 *
 * @interface SnapshotSaveRequest
 * @typedef {SnapshotSaveRequest}
 */
interface SnapshotSaveRequest {
  /**
   * Snapshot worker request type.
   *
   * @type {'save'}
   */
  type: 'save';
  /**
   * Snapshot state to serialize.
   *
   * @type {GoltStateData}
   */
  snapshot: GoltStateData;
}

/**
 * Request to parse a `.golt` snapshot file.
 *
 * @interface SnapshotLoadRequest
 * @typedef {SnapshotLoadRequest}
 */
interface SnapshotLoadRequest {
  /**
   * Snapshot worker request type.
   *
   * @type {'load'}
   */
  type: 'load';
  /**
   * Serialized `.golt` file bytes.
   *
   * @type {ArrayBuffer}
   */
  buffer: ArrayBuffer;
}

/**
 * Snapshot worker request.
 *
 * @typedef {SnapshotWorkerRequest}
 */
type SnapshotWorkerRequest = SnapshotSaveRequest | SnapshotLoadRequest;

/**
 * Snapshot worker request event.
 *
 * @typedef {SnapshotWorkerEvent}
 */
type SnapshotWorkerEvent = MessageEvent<SnapshotWorkerRequest>;

/**
 * Parsed snapshot message sent to the UI thread.
 *
 * @interface SnapshotLoadedMessage
 * @typedef {SnapshotLoadedMessage}
 */
interface SnapshotLoadedMessage {
  /**
   * Snapshot worker response type.
   *
   * @type {'loaded'}
   */
  type: 'loaded';
  /**
   * Loaded grid column count.
   *
   * @type {number}
   */
  cols: number;
  /**
   * Loaded grid row count.
   *
   * @type {number}
   */
  rows: number;
  /**
   * Loaded generation counter.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Loaded packed grid data.
   *
   * @type {Uint32Array}
   */
  grid: Uint32Array;
  /**
   * Loaded grid packing format.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
}

/**
 * Worker entrypoint for `.golt` save and load operations.
 *
 * @param {SnapshotWorkerEvent} event snapshot worker request event.
 */
self.onmessage = (event: SnapshotWorkerEvent) => {
  handleSnapshotRequest(event.data).catch(error => {
    const reason = error instanceof Error ? error.message : String(error);
    console.error('[GOLT] Snapshot worker failed:', error);
    self.postMessage({type: 'error', reason});
  });
};

/**
 * Routes a snapshot worker request.
 *
 * @async
 * @param {SnapshotWorkerRequest} message request to handle.
 */
async function handleSnapshotRequest(message: SnapshotWorkerRequest): Promise<void> {
  switch (message.type) {
    case 'save':
      console.log('[GOLT] Snapshot worker save started');
      postSnapshotProgress({
        mode: 'indeterminate',
        percent: null,
        status: 'Compressing grid'
      });
      await saveSnapshot(message.snapshot);
      console.log('[GOLT] Snapshot worker save completed');
      break;
    case 'load':
      console.log('[GOLT] Snapshot worker load started');
      postSnapshotProgress({
        mode: 'indeterminate',
        percent: null,
        status: 'Reading snapshot header'
      });
      await loadSnapshot(message.buffer);
      console.log('[GOLT] Snapshot worker load completed');
      break;
  }
}

/**
 * Builds a `.golt` snapshot and posts the serialized bytes.
 *
 * @async
 * @param {GoltStateData} snapshot snapshot data to serialize.
 */
async function saveSnapshot(snapshot: GoltStateData): Promise<void> {
  const buffer = (await buildGoltStateFile(snapshot, postSnapshotProgress)).buffer as ArrayBuffer;
  self.postMessage({type: 'saved', buffer}, [buffer]);
}

/**
 * Parses a `.golt` snapshot and posts the loaded grid.
 *
 * @async
 * @param {ArrayBuffer} buffer serialized `.golt` file bytes.
 */
async function loadSnapshot(buffer: ArrayBuffer): Promise<void> {
  const parsed = await parseGoltStateFile(buffer, postSnapshotProgress);
  if (parsed) {
    const message: SnapshotLoadedMessage = {
      type: 'loaded',
      cols: parsed.cols,
      rows: parsed.rows,
      generation: parsed.generation,
      grid: parsed.grid,
      gridFormat: parsed.gridFormat
    };
    self.postMessage(message, [parsed.grid.buffer]);
  } else {
    self.postMessage({type: 'invalid'});
  }
}

/**
 * Posts snapshot worker progress.
 *
 * @param {SnapshotProgressUpdate} update snapshot progress update.
 */
function postSnapshotProgress(update: SnapshotProgressUpdate): void {
  self.postMessage({
    type: 'progress',
    mode: update.mode,
    percent: update.percent,
    status: update.status
  });
}
