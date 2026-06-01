import {Tribe} from '~gol/feature/home/model/rule';

/**
 * Float values stored for one RGBA palette entry.
 *
 * @type {number}
 */
const RGBA_FLOAT_COMPONENTS = 4;

/**
 * Parses an RGB hex color.
 *
 * @param {string} hex rgb hex color, with or without a leading hash.
 * @returns {{r: number; g: number; b: number}} parsed color channels.
 */
function parseRgbHex(hex: string): {r: number; g: number; b: number} {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  const value = Number.parseInt(normalized.padEnd(6, '0').slice(0, 6), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff
  };
}

/**
 * Builds a GPU-friendly RGBA palette for MP4 conversion.
 *
 * @param {readonly Pick<Tribe, 'id' | 'color'>[]} tribes ordered tribe metadata.
 * @returns {Float32Array} packed RGBA colors.
 */
export function buildMp4GpuPalette(tribes: readonly Pick<Tribe, 'id' | 'color'>[]): Float32Array {
  const palette = new Float32Array(Math.max(1, tribes.length) * RGBA_FLOAT_COMPONENTS);
  tribes.forEach((tribe, index) => {
    const color = parseRgbHex(tribe.color);
    const offset = index * RGBA_FLOAT_COMPONENTS;
    palette[offset] = color.r / 255;
    palette[offset + 1] = color.g / 255;
    palette[offset + 2] = color.b / 255;
    palette[offset + 3] = 1;
  });
  return palette;
}
