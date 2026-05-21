import {GOLT_PREAMBLE_SIZE, GOLT_VERSION, hasGoltMagic, RAW_DEFLATE_CODEC} from './golt-format';
import {GoltHeader, ParsedGoltState, SNAPSHOT_STREAMING_THRESHOLD_BYTES, SnapshotProgressReporter} from './golt-types';
import {gridByteSize, gridFormatFromMetadata, gridFormatMetadata, isSupportedBitsPerCell} from '../../util/grid-format';

/**
 * Reads and validates the `.golt` header context.
 *
 * @param {ArrayBuffer} buffer serialized `.golt` file bytes.
 * @returns {{header: GoltHeader; headerEnd: number} | null} parsed header context or `null` when invalid.
 */
function readHeaderContext(buffer: ArrayBuffer): {header: GoltHeader; headerEnd: number} | null {
  let context: {header: GoltHeader; headerEnd: number} | null = null;
  if (buffer.byteLength >= GOLT_PREAMBLE_SIZE) {
    const view = new DataView(buffer);
    const headerLength = view.getUint32(8, true);
    const headerEnd = GOLT_PREAMBLE_SIZE + headerLength;
    const validPreamble = hasGoltMagic(view) && view.getUint32(4, true) === GOLT_VERSION && headerEnd <= buffer.byteLength;
    if (validPreamble) {
      context = {
        header: JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, GOLT_PREAMBLE_SIZE, headerLength))),
        headerEnd
      };
    }
  }
  return context;
}

/**
 * Inflates and validates the packed grid payload.
 *
 * @async
 * @param {ArrayBuffer} buffer serialized `.golt` file bytes.
 * @param {GoltHeader} header parsed `.golt` header.
 * @param {number} headerEnd byte offset where compressed grid data starts.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @returns {Promise<ParsedGoltState | null>} parsed state or `null` when invalid.
 */
async function parseGridPayload(buffer: ArrayBuffer, header: GoltHeader, headerEnd: number, reportProgress: SnapshotProgressReporter): Promise<ParsedGoltState | null> {
  let parsed: ParsedGoltState | null = null;
  const {gridFormat} = header;
  if (header.cols && header.rows && isSupportedBitsPerCell(gridFormat?.bitsPerCell ?? 0)) {
    const decodedGridFormat = gridFormatFromMetadata(gridFormat);
    const expectedGridBytes = gridByteSize(header, decodedGridFormat);
    const largeSnapshot = expectedGridBytes >= SNAPSHOT_STREAMING_THRESHOLD_BYTES;
    reportProgress({
      mode: largeSnapshot ? 'determinate' : 'indeterminate',
      percent: largeSnapshot ? 5 : null,
      status: 'Decompressing grid'
    });
    const rawGrid = await inflateRaw(new Uint8Array(buffer, headerEnd), largeSnapshot ? expectedGridBytes : null, reportProgress);
    if (rawGrid.byteLength >= expectedGridBytes) {
      const gridBuffer = rawGrid.byteLength === expectedGridBytes ? rawGrid : rawGrid.slice(0, expectedGridBytes);
      parsed = {
        cols: header.cols,
        rows: header.rows,
        generation: header.generation ?? 0,
        grid: new Uint32Array(gridBuffer),
        gridFormat: gridFormatMetadata(decodedGridFormat)
      };
    }
  }
  return parsed;
}

/**
 * Decompresses bytes with the `.golt` raw deflate codec.
 *
 * @async
 * @param {Uint8Array} data compressed grid bytes.
 * @param {(number | null)} expectedGridBytes expected decompressed grid bytes.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @returns {Promise<ArrayBuffer>} decompressed packed grid bytes.
 */
async function inflateRaw(data: Uint8Array, expectedGridBytes: number | null, reportProgress: SnapshotProgressReporter): Promise<ArrayBuffer> {
  const stream = new DecompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  const output = collectInflatedBytes(stream.readable.getReader(), expectedGridBytes, reportProgress);
  await writer.write(data);
  await writer.close();
  return output;
}

/**
 * Collects inflated grid bytes while reporting decompression progress.
 *
 * @async
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader inflated byte reader.
 * @param {(number | null)} expectedGridBytes expected packed grid byte count.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @returns {Promise<ArrayBuffer>} decompressed packed grid bytes.
 */
async function collectInflatedBytes(reader: ReadableStreamDefaultReader<Uint8Array>, expectedGridBytes: number | null, reportProgress: SnapshotProgressReporter): Promise<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      chunks.push(result.value);
      totalBytes += result.value.byteLength;
      if (expectedGridBytes) {
        reportProgress({
          mode: 'determinate',
          percent: Math.min(95, Math.round((totalBytes / expectedGridBytes) * 90) + 5),
          status: 'Decompressing grid'
        });
      }
    }
  }
  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  reportProgress({
    mode: expectedGridBytes ? 'determinate' : 'indeterminate',
    percent: expectedGridBytes ? 100 : null,
    status: 'Preparing loaded grid'
  });
  return output.buffer;
}

/**
 * Parses a `.golt` state file.
 *
 * @export
 * @async
 * @param {ArrayBuffer} buffer serialized `.golt` file bytes.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @returns {Promise<ParsedGoltState | null>} parsed snapshot or `null` when invalid.
 */
export async function parseGoltStateFile(buffer: ArrayBuffer, reportProgress: SnapshotProgressReporter): Promise<ParsedGoltState | null> {
  let parsed: ParsedGoltState | null = null;
  const headerContext = readHeaderContext(buffer);
  if (headerContext) {
    parsed = await parseGridPayload(buffer, headerContext.header, headerContext.headerEnd, reportProgress);
  }
  return parsed;
}
