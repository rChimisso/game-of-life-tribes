import {GOLT_MAGIC, GOLT_PREAMBLE_SIZE, GOLT_VERSION} from '../model/golt-format';

/**
 * Checks the `.golt` file magic.
 *
 * @param {DataView} view file data view.
 * @returns {boolean} `true` when the magic matches.
 */
export function hasGoltMagic(view: DataView): boolean {
  return GOLT_MAGIC.every((byte, index) => view.getUint8(index) === byte);
}

/**
 * Writes the `.golt` preamble and header into one contiguous prefix buffer.
 *
 * @param {Uint8Array} headerBytes encoded JSON header bytes.
 * @returns {Uint8Array} `.golt` prefix bytes.
 */
export function createGoltPrefix(headerBytes: Uint8Array): Uint8Array {
  const output = new Uint8Array(GOLT_PREAMBLE_SIZE + headerBytes.byteLength);
  const view = new DataView(output.buffer);
  output.set(GOLT_MAGIC, 0);
  view.setUint32(4, GOLT_VERSION, true);
  view.setUint32(8, headerBytes.byteLength, true);
  output.set(headerBytes, GOLT_PREAMBLE_SIZE);
  return output;
}
