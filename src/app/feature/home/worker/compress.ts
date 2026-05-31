import '../../../core/function/timestamped-console';

import {gridByteSize, gridFormatFromMetadata, packFrameToWords, unpackPackedBytesToFrame} from '../util/grid-format';
import {CompressRequest, CompressResult, WorkerInput} from './compress/model/compress-message';
import {CompressionChunkSource} from './compress/model/compress-runtime';

/**
 * OPFS directory containing recording chunks.
 *
 * @type {string}
 */
const OPFS_DIR = 'gol-recording';

/**
 * Minimum payload size that is worth passing through `CompressionStream`.
 *
 * @type {number}
 */
const MIN_SIZE_FOR_COMPRESS = 4096;

/**
 * Compression ratio threshold above which the packed raw payload is kept.
 *
 * @type {number}
 */
const COMPRESSION_THRESHOLD = 0.9;

/**
 * Queued compression requests waiting to run.
 *
 * @type {CompressRequest[]}
 */
const pendingQueue: CompressRequest[] = [];

/**
 * Filenames cancelled by the main thread.
 *
 * @type {Set<string>}
 */
const cancelledSet = new Set<string>();

/**
 * Number of active compression jobs in this worker.
 *
 * @type {number}
 */
let activeCount = 0;

/**
 * Whether all current and future jobs are cancelled for this worker lifetime.
 *
 * @type {boolean}
 */
let cancelAll = false;

/**
 * Whether dispatch is paused after active jobs finish.
 *
 * @type {boolean}
 */
let compressionPaused = false;

/**
 * Worker entrypoint for recording chunk compression.
 *
 * @param {MessageEvent<WorkerInput>} e worker message event.
 */
self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const msg = e.data;
  switch (msg.type) {
    case 'compress':
      if (cancelAll) {
        break;
      }
      pendingQueue.push(msg);
      drain();
      break;
    case 'cancel':
      for (const filename of msg.filenames) {
        cancelledSet.add(filename);
      }
      for (let i = pendingQueue.length - 1; i >= 0; i--) {
        if (cancelledSet.has(pendingQueue[i]!.filename)) {
          pendingQueue.splice(i, 1);
        }
      }
      break;
    case 'cancelAll':
      cancelAll = true;
      pendingQueue.length = 0;
      cancelledSet.clear();
      break;
    case 'pauseCompression':
      compressionPaused = true;
      postCompressionStatus();
      if (activeCount === 0) {
        self.postMessage({type: 'compressionPaused'});
      }
      break;
    case 'resumeCompression':
      compressionPaused = false;
      drain();
      break;
  }
};

/**
 * Starts queued compression jobs while the worker is not paused.
 */
function drain(): void {
  while (!compressionPaused && activeCount < 1 && pendingQueue.length > 0) {
    const job = pendingQueue.shift()!;
    if (cancelAll || cancelledSet.has(job.filename)) {
      cancelledSet.delete(job.filename);
    } else {
      activeCount++;
      processJob(job);
    }
  }
}

/**
 * Compresses one queued chunk and reports the result.
 *
 * @async
 * @param {CompressRequest} job compression job.
 */
async function processJob(job: CompressRequest): Promise<void> {
  try {
    const result = await compressChunk(job);
    if (result && !cancelAll && !cancelledSet.has(job.filename)) {
      self.postMessage(result);
    } else if (!cancelAll && !cancelledSet.has(job.filename)) {
      postCompressionFailed(job);
    }
  } catch (e) {
    console.warn('Compression failed for', job.filename, e);
    if (!cancelAll && !cancelledSet.has(job.filename)) {
      postCompressionFailed(job);
    }
  }
  cancelledSet.delete(job.filename);
  activeCount--;
  if (compressionPaused) {
    postCompressionStatus();
  }
  if (compressionPaused && activeCount === 0) {
    self.postMessage({type: 'compressionPaused'});
  }
  drain();
}

/**
 * Posts current active and queued compression job counts.
 */
function postCompressionStatus(): void {
  self.postMessage({
    type: 'compressionStatus',
    activeJobs: activeCount,
    queuedJobs: pendingQueue.length
  });
}

/**
 * Posts failed-job completion so the scheduler can release its budget.
 *
 * @param {CompressRequest} job compression job.
 */
function postCompressionFailed(job: CompressRequest): void {
  self.postMessage({
    type: 'compressionFailed',
    filename: job.filename,
    rawBytes: job.rawBytes
  });
}

/**
 * Replaces an OPFS file with new bytes.
 *
 * @async
 * @param {FileSystemFileHandle} fileHandle file handle to overwrite.
 * @param {BufferSource} data replacement bytes.
 */
async function overwriteFile(fileHandle: FileSystemFileHandle, data: BufferSource): Promise<void> {
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

/**
 * Re-packs one raw chunk into the storage grid format.
 *
 * @param {CompressRequest} job compression job.
 * @param {Uint8Array} rawData raw chunk bytes.
 * @returns {(Uint8Array | null)} packed chunk bytes, or null when invalid.
 */
function repackChunkPayload(job: CompressRequest, rawData: Uint8Array): Uint8Array | null {
  let packedPayload: Uint8Array | null;
  if (job.rawGridFormat.bitsPerCell === job.storageGridFormat.bitsPerCell) {
    packedPayload = rawData;
  } else {
    const rawFormat = gridFormatFromMetadata(job.rawGridFormat);
    const storageFormat = gridFormatFromMetadata(job.storageGridFormat);
    const rawFrameBytes = gridByteSize(job, rawFormat);
    const storageFrameBytes = gridByteSize(job, storageFormat);
    if (rawData.byteLength < rawFrameBytes * job.blockCount) {
      packedPayload = null;
    } else {
      const repacked = new Uint8Array(job.blockCount * storageFrameBytes);
      for (let frameIndex = 0; frameIndex < job.blockCount; frameIndex++) {
        const rawOffset = frameIndex * rawFrameBytes;
        const packed = packFrameToWords(unpackPackedBytesToFrame(rawData.subarray(rawOffset, rawOffset + rawFrameBytes), job, rawFormat), job, storageFormat);
        repacked.set(new Uint8Array(packed.buffer, packed.byteOffset, packed.byteLength), frameIndex * storageFrameBytes);
      }
      packedPayload = repacked;
    }
  }
  return packedPayload;
}

/**
 * Compresses one OPFS chunk when compression saves enough space.
 *
 * @async
 * @param {CompressRequest} job compression job.
 * @returns {Promise<CompressResult | null>} compression result, or null when the source is unavailable.
 */
async function compressChunk(job: CompressRequest): Promise<CompressResult | null> {
  const source = await readChunkSource(job.filename);
  let result: CompressResult | null = null;
  if (source) {
    const packedPayload = repackChunkPayload(job, source.rawBytes);
    if (packedPayload) {
      result = await storeBestChunkPayload(job, source.fileHandle, packedPayload);
    }
  }
  return result;
}

/**
 * Reads one chunk source from OPFS.
 *
 * @async
 * @param {string} filename OPFS chunk filename.
 * @returns {Promise<CompressionChunkSource | null>} chunk source, or null when missing.
 */
async function readChunkSource(filename: string): Promise<CompressionChunkSource | null> {
  const root = await navigator.storage.getDirectory();
  let dir: FileSystemDirectoryHandle;
  let source: CompressionChunkSource | null = null;
  try {
    dir = await root.getDirectoryHandle(OPFS_DIR);
    try {
      const fileHandle = await dir.getFileHandle(filename);
      source = {fileHandle, rawBytes: new Uint8Array(await (await fileHandle.getFile()).arrayBuffer())};
    } catch (e) {
      console.warn('OPFS file not found:', filename, e);
    }
  } catch (e) {
    console.warn('OPFS directory not found:', e);
  }
  return source;
}

/**
 * Stores packed or compressed chunk bytes according to compression savings.
 *
 * @async
 * @param {CompressRequest} job compression job.
 * @param {FileSystemFileHandle} fileHandle chunk file handle.
 * @param {Uint8Array} packedPayload packed chunk payload.
 * @returns {Promise<CompressResult>} stored chunk result.
 */
async function storeBestChunkPayload(job: CompressRequest, fileHandle: FileSystemFileHandle, packedPayload: Uint8Array): Promise<CompressResult> {
  const formatChanged = job.rawGridFormat.bitsPerCell !== job.storageGridFormat.bitsPerCell;
  let result: CompressResult;
  if (packedPayload.byteLength < MIN_SIZE_FOR_COMPRESS) {
    if (formatChanged) {
      await overwriteFile(fileHandle, packedPayload);
    }
    result = createStoredPackedResult(job, packedPayload.byteLength);
  } else {
    const compressedData = await compressPayload(packedPayload);
    if (compressedData.byteLength >= packedPayload.byteLength * COMPRESSION_THRESHOLD) {
      if (formatChanged) {
        await overwriteFile(fileHandle, packedPayload);
      }
      result = createStoredPackedResult(job, packedPayload.byteLength);
    } else {
      await overwriteFile(fileHandle, compressedData);
      result = createDeflateResult(job, compressedData.byteLength);
    }
  }
  return result;
}

/**
 * Compresses packed bytes with deflate-raw.
 *
 * @async
 * @param {Uint8Array} packedPayload packed chunk payload.
 * @returns {Promise<ArrayBuffer>} compressed payload bytes.
 */
async function compressPayload(packedPayload: Uint8Array): Promise<ArrayBuffer> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  const compressedOutput = new Response(cs.readable).arrayBuffer();
  await writer.write(packedPayload);
  await writer.close();
  return compressedOutput;
}

/**
 * Creates a stored-packed compression result.
 *
 * @param {CompressRequest} job compression job.
 * @param {number} storedBytes stored byte count.
 * @returns {CompressResult} stored-packed result.
 */
function createStoredPackedResult(job: CompressRequest, storedBytes: number): CompressResult {
  return {
    type: 'compressed',
    filename: job.filename,
    rawBytes: job.rawBytes,
    codec: 'stored-packed',
    storedBytes,
    gridFormat: job.storageGridFormat
  };
}

/**
 * Creates a deflate-raw compression result.
 *
 * @param {CompressRequest} job compression job.
 * @param {number} storedBytes stored byte count.
 * @returns {CompressResult} deflate-raw result.
 */
function createDeflateResult(job: CompressRequest, storedBytes: number): CompressResult {
  return {
    type: 'compressed',
    filename: job.filename,
    rawBytes: job.rawBytes,
    codec: 'deflate-raw',
    storedBytes,
    gridFormat: job.storageGridFormat
  };
}
