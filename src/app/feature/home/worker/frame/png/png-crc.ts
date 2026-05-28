import {IndexedPngBitDepth, PngByteSink} from './png-types';
import {finalizeCrc32, updateCrc32} from '../../zip/zip-crc32';

/**
 * PNG signature bytes.
 *
 * @type {Uint8Array}
 */
const PNG_SIGNATURE = new Uint8Array([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10
]);

/**
 * PNG indexed-color type.
 *
 * @type {number}
 */
const PNG_INDEXED_COLOR_TYPE = 3;

/**
 * Empty PNG chunk payload.
 *
 * @type {Uint8Array}
 */
const EMPTY_CHUNK_DATA = new Uint8Array(0);

/**
 * Text encoder used for PNG chunk types.
 *
 * @type {TextEncoder}
 */
const TEXT_ENCODER = new TextEncoder();

/**
 * Writes the PNG signature.
 *
 * @export
 * @async
 * @param {PngByteSink} sink target byte sink.
 */
async function writePngSignature(sink: PngByteSink): Promise<void> {
  await sink.write(PNG_SIGNATURE);
}

/**
 * Writes one PNG chunk.
 *
 * @export
 * @async
 * @param {PngByteSink} sink target byte sink.
 * @param {string} type four-byte PNG chunk type.
 * @param {Uint8Array} data chunk payload.
 */
async function writePngChunk(sink: PngByteSink, type: string, data: Uint8Array): Promise<void> {
  const typeBytes = encodePngChunkType(type);
  const header = new Uint8Array(8);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, data.byteLength, false);
  header.set(typeBytes, 4);
  await sink.write(header);
  if (data.byteLength > 0) {
    await sink.write(data);
  }
  const crcBytes = new Uint8Array(4);
  const crcView = new DataView(crcBytes.buffer);
  let crc = updateCrc32(0xffffffff, typeBytes);
  crc = updateCrc32(crc, data);
  crcView.setUint32(0, finalizeCrc32(crc), false);
  await sink.write(crcBytes);
}

/**
 * Writes the PNG IHDR chunk for an indexed-color image.
 *
 * @export
 * @async
 * @param {PngByteSink} sink target byte sink.
 * @param {number} width image width in pixels.
 * @param {number} height image height in pixels.
 * @param {IndexedPngBitDepth} bitDepth indexed-color bit depth.
 */
async function writeIhdrChunk(sink: PngByteSink, width: number, height: number, bitDepth: IndexedPngBitDepth): Promise<void> {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  data[8] = bitDepth;
  data[9] = PNG_INDEXED_COLOR_TYPE;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  await writePngChunk(sink, 'IHDR', data);
}

/**
 * Writes the PNG PLTE chunk.
 *
 * @export
 * @async
 * @param {PngByteSink} sink target byte sink.
 * @param {Uint8Array} palette palette payload as RGB triples.
 */
async function writePlteChunk(sink: PngByteSink, palette: Uint8Array): Promise<void> {
  await writePngChunk(sink, 'PLTE', palette);
}

/**
 * Writes the PNG IEND chunk.
 *
 * @export
 * @async
 * @param {PngByteSink} sink target byte sink.
 */
async function writeIendChunk(sink: PngByteSink): Promise<void> {
  await writePngChunk(sink, 'IEND', EMPTY_CHUNK_DATA);
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

export {writeIendChunk, writeIhdrChunk, writePlteChunk, writePngChunk, writePngSignature};
