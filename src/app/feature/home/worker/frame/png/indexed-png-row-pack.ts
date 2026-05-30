import {IndexedPngBitDepth} from './png-types';
import {DecodedPackedRow} from '../../snapshot/packing/packed-access';

/**
 * PNG filter byte for the "None" filter.
 *
 * @type {number}
 */
const PNG_FILTER_NONE = 0;

/**
 * Packs one decoded state row into one indexed-color PNG scanline.
 *
 * @export
 * @param {DecodedPackedRow} decodedRow decoded state row.
 * @param {number} cols number of grid columns.
 * @param {IndexedPngBitDepth} bitDepth png indexed-color bit depth.
 * @param {Uint8Array} out output scanline, including filter byte at index 0.
 * @param {(Uint8Array | null)} stateToPaletteIndex optional state-to-palette lookup.
 */
function packIndexedPngScanline(decodedRow: DecodedPackedRow, cols: number, bitDepth: IndexedPngBitDepth, out: Uint8Array, stateToPaletteIndex: Uint8Array | null): void {
  out.fill(0);
  out[0] = PNG_FILTER_NONE;
  if (bitDepth === 8) {
    packEightBitScanline(decodedRow, cols, out, stateToPaletteIndex);
  } else {
    packSubByteScanline(decodedRow, cols, bitDepth, out, stateToPaletteIndex);
  }
}

/**
 * Packs one 8-bit indexed-color scanline.
 *
 * @param {DecodedPackedRow} decodedRow decoded state row.
 * @param {number} cols number of grid columns.
 * @param {Uint8Array} out output scanline.
 * @param {(Uint8Array | null)} stateToPaletteIndex optional state-to-palette lookup.
 */
function packEightBitScanline(decodedRow: DecodedPackedRow, cols: number, out: Uint8Array, stateToPaletteIndex: Uint8Array | null): void {
  for (let x = 0; x < cols; x++) {
    out[x + 1] = resolvePaletteIndex(decodedRow[x] ?? 0, stateToPaletteIndex);
  }
}

/**
 * Packs one sub-byte indexed-color scanline using PNG's MSB-first layout.
 *
 * @param {DecodedPackedRow} decodedRow decoded state row.
 * @param {number} cols number of grid columns.
 * @param {IndexedPngBitDepth} bitDepth png indexed-color bit depth.
 * @param {Uint8Array} out output scanline.
 * @param {(Uint8Array | null)} stateToPaletteIndex optional state-to-palette lookup.
 */
function packSubByteScanline(decodedRow: DecodedPackedRow, cols: number, bitDepth: IndexedPngBitDepth, out: Uint8Array, stateToPaletteIndex: Uint8Array | null): void {
  const pixelsPerByte = 8 / bitDepth;
  const mask = (1 << bitDepth) - 1;
  for (let x = 0; x < cols; x++) {
    const paletteIndex = resolvePaletteIndex(decodedRow[x] ?? 0, stateToPaletteIndex) & mask;
    const byteOffset = 1 + Math.floor(x / pixelsPerByte);
    const bitOffset = 8 - bitDepth - ((x % pixelsPerByte) * bitDepth);
    out[byteOffset] = (out[byteOffset] ?? 0) | (paletteIndex << bitOffset);
  }
}

/**
 * Resolves the palette index for one state value.
 *
 * @param {number} state decoded state value.
 * @param {(Uint8Array | null)} stateToPaletteIndex optional state-to-palette lookup.
 * @returns {number} palette index.
 */
function resolvePaletteIndex(state: number, stateToPaletteIndex: Uint8Array | null): number {
  const paletteIndex = stateToPaletteIndex ? stateToPaletteIndex[state] : state;
  return paletteIndex ?? 0;
}

export {packIndexedPngScanline};
