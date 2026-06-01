/**
 * Zip CRC-32 table.
 *
 * @type {Uint32Array}
 */
const CRC_TABLE = new Uint32Array(256);

for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

/**
 * Updates a running CRC-32 value.
 *
 * @param {number} crc current running CRC value.
 * @param {Uint8Array} data bytes to include in the CRC.
 * @returns {number} updated running CRC value.
 */
export function updateCrc32(crc: number, data: Uint8Array): number {
  let next = crc;
  for (const value of data) {
    next = CRC_TABLE[(next ^ value) & 0xff]! ^ (next >>> 8);
  }
  return next;
}

/**
 * Converts a running CRC-32 value to the stored final value.
 *
 * @param {number} crc running CRC value.
 * @returns {number} finalized ZIP CRC-32 value.
 */
export function finalizeCrc32(crc: number): number {
  return (crc ^ 0xffffffff) >>> 0;
}
