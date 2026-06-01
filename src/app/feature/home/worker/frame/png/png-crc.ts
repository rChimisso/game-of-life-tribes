import {EMPTY_CHUNK_DATA, IndexedPngBitDepth, PNG_SIGNATURE, PNG_SINGLE_WRITE_CHUNK_THRESHOLD_BYTES, TEXT_ENCODER} from './png-types';
import {ByteSink} from '../../snapshot/model/golt-types';
import {finalizeCrc32, updateCrc32} from '../../zip/zip-crc32';

/**
 * Writes one PNG chunk through a single sink call.
 *
 * @async
 * @param {ByteSink} sink target byte sink.
 * @param {Uint8Array} typeBytes encoded chunk type.
 * @param {Uint8Array} data chunk payload.
 * @param {Uint8Array} crcBytes encoded chunk crc.
 */
async function writeSingleBufferPngChunk(sink: ByteSink, typeBytes: Uint8Array, data: Uint8Array, crcBytes: Uint8Array): Promise<void> {
  const chunk = new Uint8Array(8 + data.byteLength + 4);
  const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, data.byteLength, false);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  chunk.set(crcBytes, 8 + data.byteLength);
  await sink.write(chunk);
}

/**
 * Writes one PNG chunk without copying a large payload.
 *
 * @async
 * @param {ByteSink} sink target byte sink.
 * @param {Uint8Array} typeBytes encoded chunk type.
 * @param {Uint8Array} data chunk payload.
 * @param {Uint8Array} crcBytes encoded chunk crc.
 */
async function writeSplitPngChunk(sink: ByteSink, typeBytes: Uint8Array, data: Uint8Array, crcBytes: Uint8Array): Promise<void> {
  const header = new Uint8Array(8);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, data.byteLength, false);
  header.set(typeBytes, 4);
  await sink.write(header);
  if (data.byteLength > 0) {
    await sink.write(data);
  }
  await sink.write(crcBytes);
}

/**
 * Creates the encoded PNG chunk CRC.
 *
 * @param {Uint8Array} typeBytes encoded chunk type.
 * @param {Uint8Array} data chunk payload.
 * @returns {Uint8Array} encoded crc bytes.
 */
function createPngCrcBytes(typeBytes: Uint8Array, data: Uint8Array): Uint8Array {
  const crcBytes = new Uint8Array(4);
  const crcView = new DataView(crcBytes.buffer);
  let crc = updateCrc32(0xffffffff, typeBytes);
  crc = updateCrc32(crc, data);
  crcView.setUint32(0, finalizeCrc32(crc), false);
  return crcBytes;
}

/**
 * Encodes a PNG chunk type.
 *
 * @param {string} type four-character PNG chunk type.
 * @returns {Uint8Array} encoded chunk type.
 */
function encodePngChunkType(type: string): Uint8Array {
  const bytes = TEXT_ENCODER.encode(type);
  if (bytes.byteLength !== 4) {
    throw new Error(`Invalid PNG chunk type: ${type}`);
  }
  return bytes;
}

/**
 * Writes the PNG signature.
 *
 * @async
 * @param {ByteSink} sink target byte sink.
 */
export async function writePngSignature(sink: ByteSink): Promise<void> {
  await sink.write(PNG_SIGNATURE);
}

/**
 * Writes one PNG chunk.
 *
 * @async
 * @param {ByteSink} sink target byte sink.
 * @param {string} type four-byte PNG chunk type.
 * @param {Uint8Array} data chunk payload.
 */
export async function writePngChunk(sink: ByteSink, type: string, data: Uint8Array): Promise<void> {
  const typeBytes = encodePngChunkType(type);
  const crcBytes = createPngCrcBytes(typeBytes, data);
  if (data.byteLength <= PNG_SINGLE_WRITE_CHUNK_THRESHOLD_BYTES) {
    await writeSingleBufferPngChunk(sink, typeBytes, data, crcBytes);
  } else {
    await writeSplitPngChunk(sink, typeBytes, data, crcBytes);
  }
}

/**
 * Writes the PNG IHDR chunk for an indexed-color image.
 *
 * @async
 * @param {ByteSink} sink target byte sink.
 * @param {number} width image width in pixels.
 * @param {number} height image height in pixels.
 * @param {IndexedPngBitDepth} bitDepth indexed-color bit depth.
 */
export async function writeIhdrChunk(sink: ByteSink, width: number, height: number, bitDepth: IndexedPngBitDepth): Promise<void> {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  data[8] = bitDepth;
  data[9] = 3;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  await writePngChunk(sink, 'IHDR', data);
}

/**
 * Writes the PNG PLTE chunk.
 *
 * @async
 * @param {ByteSink} sink target byte sink.
 * @param {Uint8Array} palette palette payload as RGB triples.
 */
export async function writePlteChunk(sink: ByteSink, palette: Uint8Array): Promise<void> {
  await writePngChunk(sink, 'PLTE', palette);
}

/**
 * Writes the PNG IEND chunk.
 *
 * @async
 * @param {ByteSink} sink target byte sink.
 */
export async function writeIendChunk(sink: ByteSink): Promise<void> {
  await writePngChunk(sink, 'IEND', EMPTY_CHUNK_DATA);
}
