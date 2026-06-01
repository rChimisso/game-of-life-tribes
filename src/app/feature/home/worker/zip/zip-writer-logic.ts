/**
 * Creates a unique OPFS ZIP filename.
 *
 * @param {string} visibleFilename user-visible export filename.
 * @returns {string} unique OPFS filename.
 */
export function createUniqueOpfsFilename(visibleFilename: string): string {
  const suffix = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${Date.now()}-${suffix}-${visibleFilename}`;
}

/**
 * Writes a little-endian unsigned 64-bit integer.
 *
 * @param {DataView} view target data view.
 * @param {number} offset byte offset.
 * @param {number} value integer value.
 */
export function setUint64(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value % 0x100000000, true);
  view.setUint32(offset + 4, Math.floor(value / 0x100000000), true);
}
