import {CompressedChunkExportOptions, CompressedChunkExportRequest, PlannedCompressedChunk, PreparedCompressedChunk} from './compressed-chunk-types';
import {RecordingManifest} from '../../model/recording';
import {gridByteSize, gridFormatFromMetadata} from '../../util/grid-format';
import {GOLT_TEMP_DOWNLOAD_DIR, openTempOpfsDirectory} from '../../util/opfs-temp';
import {resolveRecordingFrameSelection} from '../frame/recording-frame-stream';
import {RAW_DEFLATE_CODEC} from '../snapshot/model/golt-format';
import {ByteSink} from '../snapshot/model/golt-types';
import {ZipWriter} from '../zip/zip-writer';

/**
 * OPFS directory containing active recording chunks.
 *
 * @type {string}
 */
const OPFS_RECORDING_DIR = 'gol-recording';

/**
 * Compressed chunk export ZIP manifest version.
 *
 * @type {number}
 */
const COMPRESSED_CHUNK_EXPORT_VERSION = 1;

/**
 * Opens the recording OPFS directory.
 *
 * @async
 * @returns {Promise<FileSystemDirectoryHandle>} recording directory handle.
 */
async function openRecordingDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_RECORDING_DIR);
}

/**
 * Plans copied and rebuilt output chunks for the selected frame range.
 *
 * @param {RecordingManifest} manifest source recording manifest.
 * @param {number} selectionStart selected global frame start.
 * @param {number} selectionEnd selected global frame end.
 * @returns {PlannedCompressedChunk[]} planned chunks.
 */
function planCompressedChunks(manifest: RecordingManifest, selectionStart: number, selectionEnd: number): PlannedCompressedChunk[] {
  const plan: PlannedCompressedChunk[] = [];
  let sourceStartIndex = 0;
  for (const chunk of manifest.chunks) {
    const sourceEndIndex = sourceStartIndex + chunk.blockCount - 1;
    if (sourceEndIndex >= selectionStart && sourceStartIndex <= selectionEnd) {
      const localStart = Math.max(0, selectionStart - sourceStartIndex);
      const localEnd = Math.min(chunk.blockCount - 1, selectionEnd - sourceStartIndex);
      plan.push({
        sourceChunk: chunk,
        sourceStartIndex,
        localStart,
        localEnd,
        source: localStart === 0 && localEnd === chunk.blockCount - 1 ? 'copied' : 'rebuilt'
      });
    }
    sourceStartIndex = sourceEndIndex + 1;
  }
  return plan;
}

/**
 * Prepares one output chunk by copying or rebuilding it.
 *
 * @async
 * @param {CompressedChunkExportRequest} request compressed chunk request.
 * @param {PlannedCompressedChunk} plan planned output chunk.
 * @param {FileSystemDirectoryHandle} recordingDirectory active recording directory.
 * @param {FileSystemDirectoryHandle} tempDirectory download temp directory.
 * @param {number} outputIndex zero-based output chunk index.
 * @param {CompressedChunkExportOptions} options cancellation and progress hooks.
 * @returns {Promise<PreparedCompressedChunk>} prepared output chunk.
 */
async function prepareCompressedChunk(
  request: CompressedChunkExportRequest,
  plan: PlannedCompressedChunk,
  recordingDirectory: FileSystemDirectoryHandle,
  tempDirectory: FileSystemDirectoryHandle,
  outputIndex: number,
  options: CompressedChunkExportOptions
): Promise<PreparedCompressedChunk> {
  const sourceHandle = await recordingDirectory.getFileHandle(plan.sourceChunk.filename);
  const sourceFile = await sourceHandle.getFile();
  let prepared: PreparedCompressedChunk;
  if (plan.source === 'copied') {
    prepared = {
      chunk: createOutputChunkMeta(plan, outputIndex, plan.sourceChunk.codec, plan.sourceChunk.storedBytes, plan.sourceChunk.uncompressedBytes),
      source: 'copied',
      file: sourceFile,
      cleanup: null
    };
  } else {
    prepared = await rebuildBoundaryChunk(request, plan, sourceFile, tempDirectory, outputIndex, options);
  }
  return prepared;
}

/**
 * Rebuilds one boundary chunk with only selected frames.
 *
 * @async
 * @param {CompressedChunkExportRequest} request compressed chunk request.
 * @param {PlannedCompressedChunk} plan planned boundary chunk.
 * @param {File} sourceFile source chunk file.
 * @param {FileSystemDirectoryHandle} tempDirectory download temp directory.
 * @param {number} outputIndex zero-based output chunk index.
 * @param {CompressedChunkExportOptions} options cancellation and progress hooks.
 * @returns {Promise<PreparedCompressedChunk>} rebuilt chunk file.
 */
async function rebuildBoundaryChunk(
  request: CompressedChunkExportRequest,
  plan: PlannedCompressedChunk,
  sourceFile: File,
  tempDirectory: FileSystemDirectoryHandle,
  outputIndex: number,
  options: CompressedChunkExportOptions
): Promise<PreparedCompressedChunk> {
  assertNotCancelled(options);
  const sourceBytes = new Uint8Array(await sourceFile.arrayBuffer());
  const decoded = plan.sourceChunk.codec === RAW_DEFLATE_CODEC ? new Uint8Array(await inflateBytes(sourceBytes)) : sourceBytes;
  const format = gridFormatFromMetadata(plan.sourceChunk.gridFormat);
  const frameBytes = gridByteSize(request.recording, format);
  const selectedBytes = decoded.subarray(plan.localStart * frameBytes, (plan.localEnd + 1) * frameBytes);
  const filename = createOutputChunkFilename(outputIndex);
  const tempFilename = `rebuilt-${filename}`;
  const fileHandle = await tempDirectory.getFileHandle(tempFilename, {create: true});
  const storedBytes = await writeDeflatedBytesToOpfs(selectedBytes, fileHandle, options);
  return {
    chunk: createOutputChunkMeta(plan, outputIndex, RAW_DEFLATE_CODEC, storedBytes, selectedBytes.byteLength),
    source: 'rebuilt',
    file: await fileHandle.getFile(),
    cleanup: () => tempDirectory.removeEntry(tempFilename)
  };
}

/**
 * Creates exported chunk metadata.
 *
 * @param {PlannedCompressedChunk} plan planned chunk.
 * @param {number} outputIndex zero-based output index.
 * @param {string} codec chunk codec.
 * @param {number} storedBytes stored byte count.
 * @param {number} uncompressedBytes uncompressed byte count.
 * @returns {RecordingManifest['chunks'][number]} output chunk metadata.
 */
function createOutputChunkMeta(plan: PlannedCompressedChunk, outputIndex: number, codec: string, storedBytes: number, uncompressedBytes: number): RecordingManifest['chunks'][number] {
  const generations = plan.sourceChunk.generations.slice(plan.localStart, plan.localEnd + 1);
  return {
    chunkId: outputIndex,
    filename: createOutputChunkFilename(outputIndex),
    codec,
    storedBytes,
    uncompressedBytes,
    blockCount: generations.length,
    generationStart: generations[0] ?? plan.sourceChunk.generationStart + plan.localStart,
    generationEnd: generations[generations.length - 1] ?? plan.sourceChunk.generationStart + plan.localEnd,
    generations,
    gridFormat: plan.sourceChunk.gridFormat
  };
}

/**
 * Creates a stable output chunk filename.
 *
 * @param {number} index zero-based output chunk index.
 * @returns {string} output chunk filename.
 */
function createOutputChunkFilename(index: number): string {
  return `chunk-${String(index).padStart(6, '0')}.bin`;
}

/**
 * Writes the compressed chunk manifest.
 *
 * @async
 * @param {ZipWriter} zip target ZIP writer.
 * @param {CompressedChunkExportRequest} request compressed chunk request.
 * @param {ReturnType<typeof resolveRecordingFrameSelection>} selection selected frame span.
 * @param {PreparedCompressedChunk[]} chunks output chunks.
 */
async function writeChunkManifest(zip: ZipWriter, request: CompressedChunkExportRequest, selection: ReturnType<typeof resolveRecordingFrameSelection>, chunks: PreparedCompressedChunk[]): Promise<void> {
  await writeJsonEntry(zip, 'manifest.json', {
    version: COMPRESSED_CHUNK_EXPORT_VERSION,
    cols: request.recording.cols,
    rows: request.recording.rows,
    gridFormat: request.recording.manifest.gridFormat,
    selectedFrameRange: {
      startFrame: selection.selectedStartFrame,
      endFrame: selection.selectedEndFrame,
      startIndex: selection.startIndex,
      endIndex: selection.endIndex,
      framesTotal: selection.framesTotal
    },
    chunks: chunks.map(item => ({
      ...item.chunk,
      source: item.source
    }))
  });
}

/**
 * Writes simulation metadata for the chunk export.
 *
 * @async
 * @param {ZipWriter} zip target ZIP writer.
 * @param {CompressedChunkExportRequest} request compressed chunk request.
 */
async function writeMetadata(zip: ZipWriter, request: CompressedChunkExportRequest): Promise<void> {
  await writeJsonEntry(zip, 'metadata.json', {
    rules: request.metadata.rules,
    tribes: request.metadata.tribes,
    recording: {
      generationStart: request.recording.manifest.generationStart,
      generationEnd: request.recording.manifest.generationEnd
    }
  });
}

/**
 * Writes a JSON ZIP entry.
 *
 * @async
 * @param {ZipWriter} zip target ZIP writer.
 * @param {string} path the ZIP entry path.
 * @param {unknown} data data in JSON format.
 */
async function writeJsonEntry(zip: ZipWriter, path: string, data: unknown): Promise<void> {
  const bytes = new TextEncoder().encode(`${JSON.stringify(data, null, 2)}\n`);
  await zip.addEntry(path, entry => entry.write(bytes));
}

/**
 * Streams a file into a ZIP entry sink.
 *
 * @async
 * @param {File} file source file.
 * @param {ByteSink} sink the ZIP entry sink.
 * @param {CompressedChunkExportOptions} options cancellation hooks.
 */
async function streamFileToSink(file: File, sink: ByteSink, options: CompressedChunkExportOptions): Promise<void> {
  const reader = file.stream().getReader();
  let done = false;
  while (!done) {
    assertNotCancelled(options);
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      await sink.write(result.value);
    }
  }
}

/**
 * Inflates deflate-raw bytes.
 *
 * @async
 * @param {Uint8Array} bytes compressed bytes.
 * @returns {Promise<ArrayBuffer>} decoded bytes.
 */
async function inflateBytes(bytes: Uint8Array): Promise<ArrayBuffer> {
  const stream = new DecompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  const output = new Response(stream.readable).arrayBuffer();
  await writer.write(bytes);
  await writer.close();
  return output;
}

/**
 * Deflates bytes directly into an OPFS temp file.
 *
 * @async
 * @param {Uint8Array} bytes uncompressed bytes to deflate.
 * @param {FileSystemFileHandle} fileHandle file handle for OPFS temp output.
 * @param {CompressedChunkExportOptions} options cancellation hooks.
 * @returns {Promise<number>} compressed byte count written.
 */
async function writeDeflatedBytesToOpfs(bytes: Uint8Array, fileHandle: FileSystemFileHandle, options: CompressedChunkExportOptions): Promise<number> {
  const stream = new CompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const writable = await fileHandle.createWritable();
  let storedBytes = 0;
  let writerClosed = false;
  const pump = pumpDeflatedBytesToOpfs(reader, writable, options, bytesWritten => {
    storedBytes += bytesWritten;
  });
  try {
    assertNotCancelled(options);
    await writer.write(bytes);
    await writer.close();
    writerClosed = true;
    await pump;
    await writable.close();
  } catch (error) {
    if (!writerClosed) {
      await writer.abort(error).catch(() => undefined);
    }
    await reader.cancel(error).catch(() => undefined);
    await writable.abort().catch(() => undefined);
    throw error;
  }
  return storedBytes;
}

/**
 * Pumps deflated stream output into an OPFS writable stream.
 *
 * @async
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader deflate stream reader.
 * @param {FileSystemWritableFileStream} writable writable stream for OPFS.
 * @param {CompressedChunkExportOptions} options cancellation hooks.
 * @param {(bytesWritten: number) => void} onBytesWritten compressed byte callback.
 */
async function pumpDeflatedBytesToOpfs(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  writable: FileSystemWritableFileStream,
  options: CompressedChunkExportOptions,
  onBytesWritten: (bytesWritten: number) => void
): Promise<void> {
  let done = false;
  while (!done) {
    assertNotCancelled(options);
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      await writable.write(result.value);
      onBytesWritten(result.value.byteLength);
    }
  }
}

/**
 * Cleans rebuilt download-only chunks.
 *
 * @async
 * @param {PreparedCompressedChunk[]} chunks prepared chunks.
 */
async function cleanupPreparedChunks(chunks: PreparedCompressedChunk[]): Promise<void> {
  for (const chunk of chunks) {
    if (chunk.cleanup) {
      try {
        await chunk.cleanup();
      } catch (error) {
        console.warn('[GOLT] Failed to remove rebuilt download chunk:', chunk.chunk.filename, error);
      }
    }
  }
}

/**
 * Throws when compressed chunk export was cancelled.
 *
 * @param {CompressedChunkExportOptions} options cancellation hooks.
 */
function assertNotCancelled(options: CompressedChunkExportOptions): void {
  if (options.shouldCancel()) {
    throw new Error('Compressed chunk export cancelled');
  }
}

/**
 * Exports selected compressed recording chunks into the ZIP archive.
 *
 * @export
 * @async
 * @param {ZipWriter} zip target ZIP writer.
 * @param {CompressedChunkExportRequest} request compressed chunk export request.
 * @param {CompressedChunkExportOptions} options cancellation and progress hooks.
 */
export async function writeCompressedChunkExport(zip: ZipWriter, request: CompressedChunkExportRequest, options: CompressedChunkExportOptions): Promise<void> {
  assertNotCancelled(options);
  const recordingDirectory = await openRecordingDirectory();
  const tempDirectory = await openTempOpfsDirectory(GOLT_TEMP_DOWNLOAD_DIR);
  const selection = resolveRecordingFrameSelection(request.recording.manifest, request.frameRange);
  const plan = planCompressedChunks(request.recording.manifest, selection.startIndex, selection.endIndex);
  const preparedChunks: PreparedCompressedChunk[] = [];
  try {
    let preparedCount = 0;
    for (const item of plan) {
      assertNotCancelled(options);
      options.onProgress(Math.round((preparedCount / Math.max(1, plan.length)) * 20), 'Preparing recording chunks');
      preparedChunks.push(await prepareCompressedChunk(request, item, recordingDirectory, tempDirectory, preparedChunks.length, options));
      preparedCount++;
    }
    await writeChunkManifest(zip, request, selection, preparedChunks);
    await writeMetadata(zip, request);
    let copied = 0;
    for (const chunk of preparedChunks) {
      assertNotCancelled(options);
      options.onProgress(20 + Math.round((copied / Math.max(1, preparedChunks.length)) * 70), `Writing recording chunk ${copied + 1} / ${preparedChunks.length}`);
      await zip.addEntry(`chunks/${chunk.chunk.filename}`, entry => streamFileToSink(chunk.file, entry, options));
      copied++;
    }
    options.onProgress(90, 'Finalizing compressed recording export');
  } finally {
    await cleanupPreparedChunks(preparedChunks);
  }
}
