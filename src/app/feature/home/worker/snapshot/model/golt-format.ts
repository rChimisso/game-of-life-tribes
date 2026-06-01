/**
 * `.golt` file magic bytes.
 *
 * @type {Uint8Array}
 */
export const GOLT_MAGIC = new TextEncoder().encode('GoLT');

/**
 * Current `.golt` wire format version.
 * 
 * @type {number}
 */
export const GOLT_VERSION = 1;

/**
 * Fixed `.golt` preamble size before the JSON header.
 * 
 * @type {number}
 */
export const GOLT_PREAMBLE_SIZE = 12;

/**
 * Compression codec used by `.golt` grid payloads.
 * 
 * @type {string}
 */
export const RAW_DEFLATE_CODEC = 'deflate-raw';
