import '../../../core/function/timestamped-console';

import {GOLT_TEMP_SNAPSHOT_DIR, openTempOpfsDirectory} from '../util/opfs-temp';
import {postWorkerTransfer} from '../util/worker-post';
import {buildGoltStateFile, shouldStreamGoltState, writeGoltStateFileToSink} from './snapshot/build/golt-build';
import {GoltStateData, SnapshotProgressUpdate, SnapshotStreamOptions} from './snapshot/model/golt-types';
import {SnapshotLoadedMessage, SnapshotWorkerEvent, SnapshotWorkerRequest} from './snapshot/model/snapshot-worker-message';
import {parseGoltStateFile} from './snapshot/parse/golt-parse';

/**
 * Snapshot stream options for standalone save operations.
 *
 * @type {SnapshotStreamOptions}
 */
const SNAPSHOT_SAVE_STREAM_OPTIONS: SnapshotStreamOptions = {
  shouldCancel: () => false,
  onCancelRequested: () => () => undefined
};

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
    self.postMessage({
      type: 'saved-file',
      file: await writeSnapshotFileToOpfs(snapshot, filename),
      filename
    });
  } else {
    const {buffer} = await buildGoltStateFile(snapshot, postSnapshotProgress, SNAPSHOT_SAVE_STREAM_OPTIONS);
    postWorkerTransfer({
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
    postWorkerTransfer(message, [parsed.grid.buffer]);
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
  const fileHandle = await (await openTempOpfsDirectory(GOLT_TEMP_SNAPSHOT_DIR)).getFileHandle(createOpfsSnapshotFilename(downloadFilename), {create: true});
  const writable = await fileHandle.createWritable();
  try {
    await writeGoltStateFileToSink(snapshot, {write: chunk => writable.write(chunk)}, postSnapshotProgress, SNAPSHOT_SAVE_STREAM_OPTIONS);
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
  return `${Date.now()}-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2)}-${downloadFilename}`;
}
