const DECIMAL_BASE = 1000;

const BINARY_BASE = 1024;

const UNITS = [
  'KB',
  'MB',
  'GB',
  'TB'
] as const;

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

export function formatBinaryBytes(bytes: number): string {
  return formatBytesWithBase(bytes, BINARY_BASE);
}

export function formatDecimalBytes(bytes: number): string {
  return formatBytesWithBase(bytes, DECIMAL_BASE);
}
