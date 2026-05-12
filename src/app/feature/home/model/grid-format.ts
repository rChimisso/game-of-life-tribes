export type BitsPerCell = 1 | 2 | 4 | 8 | 16 | 32;

export interface GridFormatMetadata {
  bitsPerCell: BitsPerCell;
}

export interface GridFormat extends GridFormatMetadata {
  cellsPerWord: 1 | 2 | 4 | 8 | 16 | 32;
  wordShift: 0 | 1 | 2 | 3 | 4 | 5;
  cellShift: 0 | 1 | 2 | 3 | 4 | 5;
  cellIndexMask: number;
  cellMask: number;
}

export const SUPPORTED_SIMULATION_BITS_PER_CELL = [
  1,
  2,
  4,
  8,
  16,
  32
] as const;

const GRID_FORMATS: Record<BitsPerCell, GridFormat> = {
  1: {
    bitsPerCell: 1,
    cellsPerWord: 32,
    wordShift: 5,
    cellShift: 0,
    cellIndexMask: 31,
    cellMask: 0x1
  },
  2: {
    bitsPerCell: 2,
    cellsPerWord: 16,
    wordShift: 4,
    cellShift: 1,
    cellIndexMask: 15,
    cellMask: 0x3
  },
  4: {
    bitsPerCell: 4,
    cellsPerWord: 8,
    wordShift: 3,
    cellShift: 2,
    cellIndexMask: 7,
    cellMask: 0xF
  },
  8: {
    bitsPerCell: 8,
    cellsPerWord: 4,
    wordShift: 2,
    cellShift: 3,
    cellIndexMask: 3,
    cellMask: 0xFF
  },
  16: {
    bitsPerCell: 16,
    cellsPerWord: 2,
    wordShift: 1,
    cellShift: 4,
    cellIndexMask: 1,
    cellMask: 0xFFFF
  },
  32: {
    bitsPerCell: 32,
    cellsPerWord: 1,
    wordShift: 0,
    cellShift: 5,
    cellIndexMask: 0,
    cellMask: 0xFFFFFFFF
  }
};

export const GRID_FORMAT_1 = GRID_FORMATS[1];
export const GRID_FORMAT_2 = GRID_FORMATS[2];
export const GRID_FORMAT_4 = GRID_FORMATS[4];
export const GRID_FORMAT_8 = GRID_FORMATS[8];
export const GRID_FORMAT_16 = GRID_FORMATS[16];
export const GRID_FORMAT_32 = GRID_FORMATS[32];

export function isSupportedBitsPerCell(bitsPerCell: number): bitsPerCell is BitsPerCell {
  return SUPPORTED_SIMULATION_BITS_PER_CELL.includes(bitsPerCell as BitsPerCell);
}

export function maxStateCountForBits(bitsPerCell: BitsPerCell): number {
  return 2 ** bitsPerCell;
}

export function validatePackingAgainstStateCount(bitsPerCell: BitsPerCell, totalStateCount: number): boolean {
  return totalStateCount <= maxStateCountForBits(bitsPerCell);
}

export function fitsGridFormatInMaxBytes(cols: number, rows: number, format: GridFormat, maxBytes: number): boolean {
  return gridByteSize(cols, rows, format) <= maxBytes;
}

export function chooseGridFormat(stateCount: number): GridFormat {
  return chooseTightStorageGridFormat(stateCount);
}

export function chooseTightStorageGridFormat(stateCount: number): GridFormat {
  if (stateCount <= 2) {
    return GRID_FORMATS[1];
  }
  if (stateCount <= 4) {
    return GRID_FORMATS[2];
  }
  if (stateCount <= 16) {
    return GRID_FORMATS[4];
  }
  if (stateCount <= 256) {
    return GRID_FORMATS[8];
  }
  if (stateCount <= 65536) {
    return GRID_FORMATS[16];
  }
  return GRID_FORMATS[32];
}

export function gridFormatFromBits(bitsPerCell: BitsPerCell): GridFormat {
  return GRID_FORMATS[bitsPerCell];
}

export function smallestValidSimulationGridFormat(totalStateCount: number, cols = 1, rows = 1, maxBytes = Number.POSITIVE_INFINITY): GridFormat {
  for (const bitsPerCell of SUPPORTED_SIMULATION_BITS_PER_CELL) {
    const format = gridFormatFromBits(bitsPerCell);
    if (validatePackingAgainstStateCount(bitsPerCell, totalStateCount) && fitsGridFormatInMaxBytes(cols, rows, format, maxBytes)) {
      return format;
    }
  }
  return GRID_FORMAT_32;
}

export function gridFormatFromMetadata(metadata?: GridFormatMetadata | null): GridFormat {
  return gridFormatFromBits(metadata?.bitsPerCell ?? 8);
}

export function gridFormatMetadata(format: GridFormat): GridFormatMetadata {
  return {bitsPerCell: format.bitsPerCell};
}

export function packedColsForFormat(cols: number, format: GridFormat): number {
  return Math.ceil(cols / format.cellsPerWord);
}

export function gridByteSize(cols: number, rows: number, format: GridFormat): number {
  return packedColsForFormat(cols, format) * rows * Uint32Array.BYTES_PER_ELEMENT;
}

export function alignPackedBytesToWords(packed: Uint8Array): Uint32Array {
  if (packed.byteOffset % Uint32Array.BYTES_PER_ELEMENT === 0) {
    return new Uint32Array(packed.buffer, packed.byteOffset, packed.byteLength / Uint32Array.BYTES_PER_ELEMENT);
  }

  const aligned = new ArrayBuffer(packed.byteLength);
  new Uint8Array(aligned).set(packed);
  return new Uint32Array(aligned);
}

export function packFrameToWords(frame: Uint8Array, cols: number, rows: number, format: GridFormat): Uint32Array {
  const packedCols = packedColsForFormat(cols, format);
  const words = new Uint32Array(packedCols * rows);
  for (let y = 0; y < rows; y++) {
    for (let px = 0; px < packedCols; px++) {
      const baseX = px * format.cellsPerWord;
      let word = 0;
      for (let i = 0; i < format.cellsPerWord && baseX + i < cols; i++) {
        const value = frame[y * cols + baseX + i]! & format.cellMask;
        word |= value << (i << format.cellShift);
      }
      words[y * packedCols + px] = word >>> 0;
    }
  }
  return words;
}

export function unpackWordsToFrame(words: Uint32Array, cols: number, rows: number, format: GridFormat): Uint8Array {
  const packedCols = packedColsForFormat(cols, format);
  const frame = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let px = 0; px < packedCols; px++) {
      const word = words[y * packedCols + px]!;
      const baseX = px * format.cellsPerWord;
      for (let i = 0; i < format.cellsPerWord && baseX + i < cols; i++) {
        frame[y * cols + baseX + i] = (word >>> (i << format.cellShift)) & format.cellMask;
      }
    }
  }
  return frame;
}

export function unpackPackedBytesToFrame(packed: Uint8Array, cols: number, rows: number, format: GridFormat): Uint8Array {
  return unpackWordsToFrame(alignPackedBytesToWords(packed), cols, rows, format);
}
