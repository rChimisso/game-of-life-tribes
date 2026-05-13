import {chooseTightStorageGridFormat, gridByteSize, gridFormatFromMetadata, gridFormatMetadata, isSupportedBitsPerCell, packFrameToWords, unpackPackedBytesToFrame} from './grid-format';
import {GridFormatMetadata} from '../model/grid-format';
import {Tribe} from '../model/rule';

import {Grid} from '~gol/core/model/grid';

/**
 * Data used to build a `.golt` state file.
 *
 * @export
 * @interface GoltStateData
 * @typedef {GoltStateData}
 * @extends {Grid}
 */
interface GoltStateData extends Grid {
  /**
   * Snapshot generation.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Packed snapshot grid.
   *
   * @type {(Uint32Array | number[])}
   */
  grid: Uint32Array | number[];
  /**
   * Format used by {@link grid}.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
  /**
   * Tribes included in the state file.
   *
   * @type {readonly Pick<Tribe, 'id' | 'color'>[]}
   */
  tribes: readonly Pick<Tribe, 'id' | 'color'>[];
  /**
   * Rules included in the state file.
   *
   * @type {unknown}
   */
  rules: unknown;
}

/**
 * Parsed `.golt` state payload.
 *
 * @export
 * @interface ParsedGoltState
 * @typedef {ParsedGoltState}
 * @extends {Grid}
 */
interface ParsedGoltState extends Grid {
  /**
   * Snapshot generation.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Parsed packed grid.
   *
   * @type {Uint32Array}
   */
  grid: Uint32Array;
  /**
   * Format used by {@link grid}.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
}

/**
 * Partial `.golt` file header used while parsing.
 *
 * @interface GoltHeader
 * @typedef {GoltHeader}
 * @extends {Grid}
 */
interface GoltHeader extends Grid {
  generation?: number;
  gridFormat?: GridFormatMetadata;
}

const GOLT_MAGIC = new Uint8Array([
  0x47,
  0x6F,
  0x4C,
  0x54
]);
const GOLT_VERSION = 1;
const GOLT_PREAMBLE_SIZE = 12;
const RAW_DEFLATE_CODEC = 'deflate-raw';

/**
 * Builds a `.golt` state file.
 *
 * @export
 * @param {GoltStateData} data state data to serialize.
 * @returns {Promise<Uint8Array>} serialized file bytes.
 */
async function buildGoltStateFile(data: GoltStateData): Promise<Uint8Array> {
  const targetFormat = chooseTightStorageGridFormat(data.tribes.length);
  const sourceFormat = gridFormatFromMetadata(data.gridFormat);
  const sourceGrid = data.grid instanceof Uint32Array ? data.grid : new Uint32Array(data.grid);
  const targetGrid = sourceFormat.bitsPerCell === targetFormat.bitsPerCell ?
    sourceGrid :
    packFrameToWords(
      unpackPackedBytesToFrame(new Uint8Array(sourceGrid.buffer, sourceGrid.byteOffset, sourceGrid.byteLength), data, sourceFormat),
      data,
      targetFormat
    );
  const gridBytes = new Uint8Array(targetGrid.buffer, targetGrid.byteOffset, targetGrid.byteLength);
  const headerBytes = new TextEncoder().encode(JSON.stringify({
    generation: data.generation,
    cols: data.cols,
    rows: data.rows,
    gridFormat: gridFormatMetadata(targetFormat),
    tribes: data.tribes.map(t => ({id: t.id, color: t.color})),
    rules: data.rules
  }));
  const compressedGrid = new Uint8Array(await deflateRaw(gridBytes));
  const preambleSize = GOLT_PREAMBLE_SIZE + headerBytes.byteLength;
  const output = new Uint8Array(preambleSize + compressedGrid.byteLength);
  const view = new DataView(output.buffer);

  output.set(GOLT_MAGIC, 0);
  view.setUint32(4, GOLT_VERSION, true);
  view.setUint32(8, headerBytes.byteLength, true);
  output.set(headerBytes, GOLT_PREAMBLE_SIZE);
  output.set(compressedGrid, preambleSize);
  return output;
}

/**
 * Parses a `.golt` state file.
 *
 * @export
 * @param {ArrayBuffer} buffer file bytes.
 * @returns {Promise<ParsedGoltState | null>} parsed state or `null` if invalid.
 */
async function parseGoltStateFile(buffer: ArrayBuffer): Promise<ParsedGoltState | null> {
  if (buffer.byteLength < GOLT_PREAMBLE_SIZE) {
    return null;
  }

  const view = new DataView(buffer);
  if (!hasGoltMagic(view) || view.getUint32(4, true) !== GOLT_VERSION) {
    return null;
  }

  const headerLength = view.getUint32(8, true);
  if (GOLT_PREAMBLE_SIZE + headerLength > buffer.byteLength) {
    return null;
  }

  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, GOLT_PREAMBLE_SIZE, headerLength))) as GoltHeader;
  if (!header.cols || !header.rows || !isSupportedBitsPerCell(header.gridFormat?.bitsPerCell ?? 0)) {
    return null;
  }

  const decodedGridFormat = gridFormatFromMetadata(header.gridFormat);
  const rawGrid = await inflateRaw(buffer.slice(GOLT_PREAMBLE_SIZE + headerLength));
  const expectedGridBytes = gridByteSize(header, decodedGridFormat);
  if (rawGrid.byteLength < expectedGridBytes) {
    return null;
  }

  return {
    cols: header.cols,
    rows: header.rows,
    generation: header.generation ?? 0,
    grid: new Uint32Array(rawGrid.slice(0, expectedGridBytes)),
    gridFormat: gridFormatMetadata(decodedGridFormat)
  };
}

/**
 * Compresses data with the `.golt` raw deflate codec.
 *
 * @param {Uint8Array} data uncompressed bytes.
 * @returns {Promise<ArrayBuffer>} compressed bytes.
 */
async function deflateRaw(data: Uint8Array): Promise<ArrayBuffer> {
  const stream = new CompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  writer.write(data);
  writer.close();
  return new Response(stream.readable).arrayBuffer();
}

/**
 * Decompresses data with the `.golt` raw deflate codec.
 *
 * @param {ArrayBuffer} data compressed bytes.
 * @returns {Promise<ArrayBuffer>} decompressed bytes.
 */
async function inflateRaw(data: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new DecompressionStream(RAW_DEFLATE_CODEC);
  const writer = stream.writable.getWriter();
  writer.write(new Uint8Array(data));
  writer.close();
  return new Response(stream.readable).arrayBuffer();
}

/**
 * Checks the `.golt` file magic.
 *
 * @param {DataView} view file view.
 * @returns {boolean} `true` when the magic matches.
 */
function hasGoltMagic(view: DataView): boolean {
  return GOLT_MAGIC.every((byte, index) => view.getUint8(index) === byte);
}

export {buildGoltStateFile, parseGoltStateFile};
export type {GoltStateData, ParsedGoltState};
