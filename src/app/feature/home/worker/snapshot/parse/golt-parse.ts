import {hasGoltMagic} from '../logic/golt-format';
import {GOLT_PREAMBLE_SIZE, GOLT_VERSION, RAW_DEFLATE_CODEC} from '../model/golt-format';
import {GoltHeader, ParsedGoltState, SNAPSHOT_STREAMING_THRESHOLD_BYTES, SnapshotProgressReporter} from '../model/golt-types';

import {gridByteSize, gridFormatFromMetadata, gridFormatMetadata, isSupportedBitsPerCell} from '~gol/feature/home/logic/grid-format';
import {DEAD_TRIBE_ID, GRID_TOPOLOGY_VALUES, TOROIDAL_GRID_TOPOLOGY, Tribe} from '~gol/feature/home/model/rule';

/**
 * Normalizes snapshot topology metadata.
 *
 * @param {GoltHeader} header parsed snapshot header.
 * @returns {{topology: 'toroidal' | 'bounded'; boundaryTribe: string}} normalized topology settings.
 */
function normalizeHeaderTopology(header: GoltHeader): {topology: 'toroidal' | 'bounded'; boundaryTribe: string} {
  const topology = header.topology && GRID_TOPOLOGY_VALUES.includes(header.topology) ? header.topology : TOROIDAL_GRID_TOPOLOGY;
  let boundaryTribe: string;
  if (typeof header.boundaryTribe === 'string' && header.tribes?.some((tribe: Tribe) => tribe.id === header.boundaryTribe)) {
    boundaryTribe = header.boundaryTribe;
  } else {
    boundaryTribe = DEAD_TRIBE_ID;
  }
  return {topology, boundaryTribe};
}

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
  if (header.cols && header.rows && isSupportedBitsPerCell(gridFormat?.bitsPerCell ?? 0) &&
      Array.isArray(header.tribes) && header.tribes.length > 0 && Array.isArray(header.rules)) {
    const decodedGridFormat = gridFormatFromMetadata(gridFormat);
    const expectedGridBytes = gridByteSize(header, decodedGridFormat);
    const largeSnapshot = expectedGridBytes >= SNAPSHOT_STREAMING_THRESHOLD_BYTES;
    reportProgress({
      mode: largeSnapshot ? 'determinate' : 'indeterminate',
      percent: largeSnapshot ? 5 : null,
      status: 'Decompressing grid'
    });
    const rawGrid = largeSnapshot ?
      await inflateRawToExpectedBuffer(new Uint8Array(buffer, headerEnd), expectedGridBytes, reportProgress) :
      await inflateRaw(new Uint8Array(buffer, headerEnd), reportProgress);
    if (rawGrid && rawGrid.byteLength >= expectedGridBytes) {
      const gridBuffer = rawGrid.byteLength === expectedGridBytes ? rawGrid : rawGrid.slice(0, expectedGridBytes);
      const topology = normalizeHeaderTopology(header);
      parsed = {
        cols: header.cols,
        rows: header.rows,
        topology: topology.topology,
        boundaryTribe: topology.boundaryTribe,
        generation: header.generation ?? 0,
        grid: new Uint32Array(gridBuffer),
        gridFormat: gridFormatMetadata(decodedGridFormat),
        tribes: header.tribes,
        rules: header.rules
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
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @returns {Promise<ArrayBuffer>} decompressed packed grid bytes.
 */
async function inflateRaw(data: Uint8Array, reportProgress: SnapshotProgressReporter): Promise<ArrayBuffer> {
  const stream = new DecompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  const output = collectInflatedBytes(stream.readable.getReader(), reportProgress);
  await writer.write(data);
  await writer.close();
  return output;
}

/**
 * Decompresses bytes into one exact expected-size output buffer.
 *
 * @async
 * @param {Uint8Array} data compressed grid bytes.
 * @param {number} expectedGridBytes expected decompressed grid bytes.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @returns {Promise<ArrayBuffer | null>} decompressed packed grid bytes or `null` when the size is invalid.
 */
async function inflateRawToExpectedBuffer(data: Uint8Array, expectedGridBytes: number, reportProgress: SnapshotProgressReporter): Promise<ArrayBuffer | null> {
  const stream = new DecompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  const output = fillExpectedInflatedBuffer(stream.readable.getReader(), expectedGridBytes, reportProgress);
  await writer.write(data);
  await writer.close();
  return output;
}

/**
 * Collects inflated grid bytes while reporting decompression progress.
 *
 * @async
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader inflated byte reader.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @returns {Promise<ArrayBuffer>} decompressed packed grid bytes.
 */
async function collectInflatedBytes(reader: ReadableStreamDefaultReader<Uint8Array>, reportProgress: SnapshotProgressReporter): Promise<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      chunks.push(result.value);
      totalBytes += result.value.byteLength;
    }
  }
  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  reportProgress({
    mode: 'indeterminate',
    percent: null,
    status: 'Preparing loaded grid'
  });
  return output.buffer;
}

/**
 * Fills a preallocated expected-size buffer from decompressed stream chunks.
 *
 * @async
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader inflated byte reader.
 * @param {number} expectedGridBytes expected packed grid byte count.
 * @param {SnapshotProgressReporter} reportProgress progress callback.
 * @returns {Promise<ArrayBuffer | null>} filled output buffer or `null` when decompressed size is invalid.
 */
async function fillExpectedInflatedBuffer(reader: ReadableStreamDefaultReader<Uint8Array>, expectedGridBytes: number, reportProgress: SnapshotProgressReporter): Promise<ArrayBuffer | null> {
  const output = new Uint8Array(expectedGridBytes);
  let offset = 0;
  let valid = true;
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      if (offset + result.value.byteLength <= expectedGridBytes) {
        output.set(result.value, offset);
        offset += result.value.byteLength;
        reportProgress({
          mode: 'determinate',
          percent: Math.min(95, Math.round((offset / expectedGridBytes) * 90) + 5),
          status: 'Decompressing grid'
        });
      } else {
        valid = false;
        offset += result.value.byteLength;
      }
    }
  }
  let buffer: ArrayBuffer | null = null;
  if (valid && offset === expectedGridBytes) {
    reportProgress({
      mode: 'determinate',
      percent: 100,
      status: 'Preparing loaded grid'
    });
    buffer = output.buffer;
  } else {
    console.warn('[GOLT] Invalid snapshot grid payload size', {
      expectedGridBytes,
      actualGridBytes: offset
    });
  }
  return buffer;
}

/**
 * Parses a `.golt` state file.
 *
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
