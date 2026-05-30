import {IndexedPngBitDepth, IndexedPngPalette} from './png-types';
import {Tribe} from '../../../model/rule';

/**
 * Maximum number of palette entries supported by indexed PNG.
 *
 * @type {number}
 */
const INDEXED_PNG_MAX_STATES = 256;

/**
 * Hex color channel width.
 *
 * @type {number}
 */
const HEX_COLOR_CHANNEL_WIDTH = 2;

/**
 * Chooses the smallest indexed-color PNG bit depth for a state count.
 *
 * @export
 * @param {number} stateCount number of encoded states.
 * @returns {IndexedPngBitDepth} PNG indexed-color bit depth.
 */
function chooseIndexedPngBitDepth(stateCount: number): IndexedPngBitDepth {
  let bitDepth: IndexedPngBitDepth;
  if (stateCount <= 2) {
    bitDepth = 1;
  } else if (stateCount <= 4) {
    bitDepth = 2;
  } else if (stateCount <= 16) {
    bitDepth = 4;
  } else {
    bitDepth = 8;
  }
  return bitDepth;
}

/**
 * Builds an indexed-color PNG palette from ordered tribes.
 *
 * @export
 * @param {readonly Pick<Tribe, 'id' | 'color'>[]} tribes ordered tribe metadata.
 * @returns {IndexedPngPalette} indexed-color PNG palette.
 */
function buildIndexedPngPalette(tribes: readonly Pick<Tribe, 'id' | 'color'>[]): IndexedPngPalette {
  if (tribes.length > INDEXED_PNG_MAX_STATES) {
    throw new Error(`PNG export supports at most ${INDEXED_PNG_MAX_STATES} states; received ${tribes.length}.`);
  }
  const stateCount = Math.max(1, tribes.length);
  const plte = new Uint8Array(stateCount * 3);
  tribes.forEach((tribe, index) => {
    const rgb = parseRgbHexColor(tribe.color);
    plte.set(rgb, index * 3);
  });
  return {
    bitDepth: chooseIndexedPngBitDepth(stateCount),
    stateToPaletteIndex: null,
    plte,
    stateCount
  };
}

/**
 * Parses an RGB hex color.
 *
 * @param {string} color rgb hex color with or without a leading #.
 * @returns {Uint8Array} parsed rgb channels.
 */
function parseRgbHexColor(color: string): Uint8Array {
  const normalized = color.startsWith('#') ? color.slice(1) : color;
  if (!/^[\da-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Invalid tribe color for PNG export: ${color}`);
  }
  const red = Number.parseInt(normalized.slice(0, HEX_COLOR_CHANNEL_WIDTH), 16);
  const green = Number.parseInt(normalized.slice(HEX_COLOR_CHANNEL_WIDTH, HEX_COLOR_CHANNEL_WIDTH * 2), 16);
  const blue = Number.parseInt(normalized.slice(HEX_COLOR_CHANNEL_WIDTH * 2, HEX_COLOR_CHANNEL_WIDTH * 3), 16);
  return new Uint8Array([red, green, blue]);
}

export {buildIndexedPngPalette, chooseIndexedPngBitDepth};
