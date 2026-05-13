import {GridFormatMetadata} from '../model/grid-format';
import {gridByteSize, gridFormatFromMetadata, packFrameToWords, unpackPackedBytesToFrame} from '../util/grid-format';

import {Grid} from '~gol/core/model/grid';

// ---------------------------------------------------------------------------
//  Background compression worker for OPFS recording chunks.
//
//  Receives raw chunk filenames, reads them from OPFS, compresses with
//  Deflate-raw, writes compressed data back.  Reports {filename, codec,
//  StoredBytes} on completion.  Runs up to CONCURRENCY jobs in parallel.
// ---------------------------------------------------------------------------

const OPFS_DIR = 'gol-recording';
const MIN_SIZE_FOR_COMPRESS = 4096; // Skip chunks smaller than 4KB
const COMPRESSION_THRESHOLD = 0.9; // Keep raw if compressed >= 90% of original

interface CompressRequest extends Grid {
  type: 'compress';
  filename: string;
  rawBytes: number;
  blockCount: number;
  rawGridFormat: GridFormatMetadata;
  storageGridFormat: GridFormatMetadata;
}

interface CancelRequest {
  type: 'cancel';
  filenames: string[];
}

interface CancelAllRequest {
  type: 'cancelAll';
}

interface PauseCompressionRequest {
  type: 'pauseCompression';
}

interface ResumeCompressionRequest {
  type: 'resumeCompression';
}

type WorkerInput = CompressRequest | CancelRequest | CancelAllRequest | PauseCompressionRequest | ResumeCompressionRequest;

interface CompressResult {
  type: 'compressed';
  filename: string;
  codec: string;
  storedBytes: number;
  gridFormat: GridFormatMetadata;
}

interface CompressionPausedResult {
  type: 'compressionPaused';
}

const pendingQueue: CompressRequest[] = [];
const cancelledSet = new Set<string>();
let activeCount = 0;
let cancelAll = false;
let compressionPaused = false;

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
      for (const f of msg.filenames) {
        cancelledSet.add(f);
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
      if (activeCount === 0) {
        self.postMessage({type: 'compressionPaused'} satisfies CompressionPausedResult);
      }
      break;
    case 'resumeCompression':
      compressionPaused = false;
      drain();
      break;
  }
};

function drain(): void {
  while (!compressionPaused && activeCount < 1 && pendingQueue.length > 0) {
    const job = pendingQueue.shift()!;
    if (cancelAll || cancelledSet.has(job.filename)) {
      cancelledSet.delete(job.filename);
      continue;
    }
    activeCount++;
    processJob(job);
  }
}

async function processJob(job: CompressRequest): Promise<void> {
  try {
    const result = await compressChunk(job);
    if (result && !cancelAll && !cancelledSet.has(job.filename)) {
      self.postMessage(result);
    }
  } catch (e) {
    console.warn('Compression failed for', job.filename, e);
  }
  cancelledSet.delete(job.filename);
  activeCount--;
  if (compressionPaused && activeCount === 0) {
    self.postMessage({type: 'compressionPaused'} satisfies CompressionPausedResult);
  }
  drain();
}

async function overwriteFile(fileHandle: FileSystemFileHandle, data: BufferSource): Promise<void> {
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

function repackChunkPayload(job: CompressRequest, rawData: Uint8Array): Uint8Array | null {
  if (job.rawGridFormat.bitsPerCell === job.storageGridFormat.bitsPerCell) {
    return rawData;
  }

  const rawFormat = gridFormatFromMetadata(job.rawGridFormat);
  const storageFormat = gridFormatFromMetadata(job.storageGridFormat);
  const rawFrameBytes = gridByteSize(job, rawFormat);
  const storageFrameBytes = gridByteSize(job, storageFormat);
  const expectedRawBytes = rawFrameBytes * job.blockCount;

  if (rawData.byteLength < expectedRawBytes) {
    return null;
  }

  const repacked = new Uint8Array(job.blockCount * storageFrameBytes);
  for (let frameIndex = 0; frameIndex < job.blockCount; frameIndex++) {
    const rawOffset = frameIndex * rawFrameBytes;
    const rawFrame = rawData.subarray(rawOffset, rawOffset + rawFrameBytes);
    const unpacked = unpackPackedBytesToFrame(rawFrame, job, rawFormat);
    const packed = packFrameToWords(unpacked, job, storageFormat);
    repacked.set(new Uint8Array(packed.buffer, packed.byteOffset, packed.byteLength), frameIndex * storageFrameBytes);
  }
  return repacked;
}

async function compressChunk(job: CompressRequest): Promise<CompressResult | null> {
  const root = await navigator.storage.getDirectory();
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await root.getDirectoryHandle(OPFS_DIR);
  } catch (e) {
    console.warn('OPFS directory not found:', e);
    return null;
  }
  let fileHandle: FileSystemFileHandle;
  try {
    fileHandle = await dir.getFileHandle(job.filename);
  } catch (e) {
    console.warn('OPFS file not found:', job.filename, e);
    return null;
  }
  const file = await fileHandle.getFile();
  const rawData = await file.arrayBuffer();
  const rawBytes = new Uint8Array(rawData);
  const packedPayload = repackChunkPayload(job, rawBytes);
  if (!packedPayload) {
    return null;
  }
  const formatChanged = job.rawGridFormat.bitsPerCell !== job.storageGridFormat.bitsPerCell;

  // Skip small chunks
  if (packedPayload.byteLength < MIN_SIZE_FOR_COMPRESS) {
    if (formatChanged) {
      await overwriteFile(fileHandle, packedPayload);
    }
    return {
      type: 'compressed',
      filename: job.filename,
      codec: 'stored-packed',
      storedBytes: packedPayload.byteLength,
      gridFormat: job.storageGridFormat
    };
  }

  // Compress with deflate-raw
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(packedPayload);
  writer.close();
  const compressedData = await new Response(cs.readable).arrayBuffer();

  // Check if compression is worthwhile
  if (compressedData.byteLength >= packedPayload.byteLength * COMPRESSION_THRESHOLD) {
    if (formatChanged) {
      await overwriteFile(fileHandle, packedPayload);
    }
    return {
      type: 'compressed',
      filename: job.filename,
      codec: 'stored-packed',
      storedBytes: packedPayload.byteLength,
      gridFormat: job.storageGridFormat
    };
  }

  // Write compressed data directly to the original file.
  // Safe because downloads are paused during compression and the download
  // Worker re-reads files after all seals complete.
  await overwriteFile(fileHandle, compressedData);

  return {
    type: 'compressed',
    filename: job.filename,
    codec: 'deflate-raw',
    storedBytes: compressedData.byteLength,
    gridFormat: job.storageGridFormat
  };
}
