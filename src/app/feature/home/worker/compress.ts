/* eslint-disable jsdoc/require-jsdoc */

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

interface CompressRequest {
  type: 'compress';
  filename: string;
  rawBytes: number;
}

interface CancelRequest {
  type: 'cancel';
  filenames: string[];
}

interface CancelAllRequest {
  type: 'cancelAll';
}

type WorkerInput = CompressRequest | CancelRequest | CancelAllRequest;

interface CompressResult {
  type: 'compressed';
  filename: string;
  codec: string;
  storedBytes: number;
}

const pendingQueue: CompressRequest[] = [];
const cancelledSet = new Set<string>();
let activeCount = 0;
let cancelAll = false;

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
  }
};

function drain(): void {
  while (activeCount < 1 && pendingQueue.length > 0) {
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
  } catch {
    // Silently skip failed compressions (e.g. file missing)
  }
  cancelledSet.delete(job.filename);
  activeCount--;
  drain();
}

async function compressChunk(job: CompressRequest): Promise<CompressResult | null> {
  const root = await navigator.storage.getDirectory();
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await root.getDirectoryHandle(OPFS_DIR);
  } catch {
    return null;
  }
  let fileHandle: FileSystemFileHandle;
  try {
    fileHandle = await dir.getFileHandle(job.filename);
  } catch {
    return null;
  }
  const file = await fileHandle.getFile();
  const rawData = await file.arrayBuffer();

  // Skip small chunks
  if (rawData.byteLength < MIN_SIZE_FOR_COMPRESS) {
    return {
      type: 'compressed',
      filename: job.filename,
      codec: 'raw-packed',
      storedBytes: rawData.byteLength
    };
  }

  // Compress with deflate-raw
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(new Uint8Array(rawData));
  writer.close();
  const compressedData = await new Response(cs.readable).arrayBuffer();

  // Check if compression is worthwhile
  if (compressedData.byteLength >= rawData.byteLength * COMPRESSION_THRESHOLD) {
    return {
      type: 'compressed',
      filename: job.filename,
      codec: 'raw-packed',
      storedBytes: rawData.byteLength
    };
  }

  // Write compressed data directly to the original file.
  // Safe because downloads are paused during compression and the download
  // Worker re-reads files after all seals complete.
  const writable = await fileHandle.createWritable();
  await writable.write(compressedData);
  await writable.close();

  return {
    type: 'compressed',
    filename: job.filename,
    codec: 'deflate-raw',
    storedBytes: compressedData.byteLength
  };
}
