/**
 * Decimal base for byte formatting.
 *
 * @type {1000}
 */
const DECIMAL_BASE = 1000;

/**
 * Binary base for byte formatting.
 *
 * @type {1024}
 */
const BINARY_BASE = 1024;

/**
 * Units for byte formatting.
 *
 * @type {readonly ["KB", "MB", "GB", "TB"]}
 */
// eslint-disable-next-line array-element-newline, array-bracket-newline
const UNITS = ['KB', 'MB', 'GB', 'TB'] as const;

/**
 * Formats a byte value using a specified base.
 *
 * @param {number} bytes bytes value to format.
 * @param {number} base base value to use for formatting.
 * @returns {string} formatted byte value.
 */
function formatBytesWithBase(bytes: number, base: number): string {
  if (bytes < base) {
    return `${bytes} B`;
  }
  let value = bytes / base;
  for (let i = 0; i < UNITS.length; i++) {
    if (i === UNITS.length - 1 || value < base) {
      return `${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${UNITS[i]}`;
    }
    value /= base;
  }
  return `${bytes} B`;
}

/**
 * Formats a byte value using the binary base.
 *
 * @export
 * @param {number} bytes bytes value to format.
 * @returns {string} formatted byte value.
 */
export function formatBinaryBytes(bytes: number): string {
  return formatBytesWithBase(bytes, BINARY_BASE);
}

/**
 * Formats a byte value using the decimal base.
 *
 * @export
 * @param {number} bytes bytes value to format.
 * @returns {string} formatted byte value.
 */
export function formatDecimalBytes(bytes: number): string {
  return formatBytesWithBase(bytes, DECIMAL_BASE);
}
