import '../../../core/function/timestamped-console';

import {buildGoltStateFile, shouldStreamGoltState, writeGoltStateFileToSink} from './snapshot/golt-build';
import {parseGoltStateFile} from './snapshot/golt-parse';
import {GoltStateData, SnapshotProgressUpdate} from './snapshot/golt-types';
import {GOLT_TEMP_SNAPSHOT_DIR, openTempOpfsDirectory} from '../util/opfs-temp';

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
  /**
   * Loaded tribe color metadata.
   *
   * @type {GoltStateData['tribes']}
   */
  tribes: GoltStateData['tribes'];
  /**
   * Loaded rules metadata.
   *
   * @type {GoltStateData['rules']}
   */
  rules: GoltStateData['rules'];
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
 * Builds a `.golt` snapshot and posts the serialized output.
 *
 * @async
 * @param {GoltStateData} snapshot snapshot data to serialize.
 */
async function saveSnapshot(snapshot: GoltStateData): Promise<void> {
  const filename = createSnapshotFilename(snapshot.generation);
  if (shouldStreamGoltState(snapshot)) {
    console.log('[GOLT] Snapshot worker writing OPFS-backed snapshot');
    const file = await writeSnapshotFileToOpfs(snapshot, filename);
    self.postMessage({
      type: 'saved-file',
      filename,
      file
    });
  } else {
    const bytes = await buildGoltStateFile(snapshot, postSnapshotProgress);
    const buffer = bytes.buffer as ArrayBuffer;
    self.postMessage({
      type: 'saved-buffer',
      filename,
      buffer
    }, [buffer]);
  }
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
      gridFormat: parsed.gridFormat,
      tribes: parsed.tribes,
      rules: parsed.rules
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

/**
 * Writes a large snapshot to OPFS and returns its file handle snapshot.
 *
 * @async
 * @param {GoltStateData} snapshot snapshot data to serialize.
 * @param {string} downloadFilename user-visible download filename.
 * @returns {Promise<File>} OPFS-backed snapshot file.
 */
async function writeSnapshotFileToOpfs(snapshot: GoltStateData, downloadFilename: string): Promise<File> {
  const directory = await openTempOpfsDirectory(GOLT_TEMP_SNAPSHOT_DIR);
  const filename = createOpfsSnapshotFilename(downloadFilename);
  const fileHandle = await directory.getFileHandle(filename, {create: true});
  const writable = await fileHandle.createWritable();
  try {
    await writeGoltStateFileToSink(snapshot, {
      write: chunk => writable.write(chunk)
    }, postSnapshotProgress);
    await writable.close();
  } catch (error) {
    await writable.abort();
    throw error;
  }
  return fileHandle.getFile();
}

/**
 * Creates the user-visible snapshot download filename.
 *
 * @param {number} generation snapshot generation.
 * @returns {string} snapshot filename.
 */
function createSnapshotFilename(generation: number): string {
  return `gol-state-gen${generation}.golt`;
}

/**
 * Creates a unique temporary OPFS snapshot filename.
 *
 * @param {string} downloadFilename user-visible download filename.
 * @returns {string} OPFS filename.
 */
function createOpfsSnapshotFilename(downloadFilename: string): string {
  const suffix = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${Date.now()}-${suffix}-${downloadFilename}`;
}
