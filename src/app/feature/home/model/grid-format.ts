/**
 * Supported bits per cell values.
 *
 * @export
 * @typedef {BitsPerCell}
 */
export type BitsPerCell = 1 | 2 | 4 | 8 | 16 | 32;

/**
 * Grid format metadata.
 *
 * @export
 * @interface GridFormatMetadata
 * @typedef {GridFormatMetadata}
 */
export interface GridFormatMetadata {
  /**
   * Bits used by each packed cell.
   *
   * @type {BitsPerCell}
   */
  bitsPerCell: BitsPerCell;
}

/**
 * Runtime grid packing format.
 *
 * @export
 * @interface GridFormat
 * @typedef {GridFormat}
 * @extends {GridFormatMetadata}
 */
export interface GridFormat extends GridFormatMetadata {
  /**
   * Cells packed in one word.
   *
   * @type {(1 | 2 | 4 | 8 | 16 | 32)}
   */
  cellsPerWord: 1 | 2 | 4 | 8 | 16 | 32;
  /**
   * Shift used to find the packed word.
   *
   * @type {(0 | 1 | 2 | 3 | 4 | 5)}
   */
  wordShift: 0 | 1 | 2 | 3 | 4 | 5;
  /**
   * Shift used to find the cell offset inside a word.
   *
   * @type {(0 | 1 | 2 | 3 | 4 | 5)}
   */
  cellShift: 0 | 1 | 2 | 3 | 4 | 5;
  /**
   * Mask for a cell index inside a word.
   *
   * @type {number}
   */
  cellIndexMask: number;
  /**
   * Mask for a packed cell value.
   *
   * @type {number}
   */
  cellMask: number;
}

/**
 * Supported simulation packing sizes.
 *
 * @type {readonly BitsPerCell[]}
 */
export const SUPPORTED_SIMULATION_BITS_PER_CELL = [
  1,
  2,
  4,
  8,
  16,
  32
] as const;

/**
 * Grid format for 1 bit per cell.
 *
 * @type {GridFormat}
 */
export const GRID_FORMAT_1: GridFormat = {
  bitsPerCell: 1,
  cellsPerWord: 32,
  wordShift: 5,
  cellShift: 0,
  cellIndexMask: 31,
  cellMask: 0x1
};

/**
 * Grid format for 2 bits per cell.
 *
 * @type {GridFormat}
 */
export const GRID_FORMAT_2: GridFormat = {
  bitsPerCell: 2,
  cellsPerWord: 16,
  wordShift: 4,
  cellShift: 1,
  cellIndexMask: 15,
  cellMask: 0x3
};

/**
 * Grid format for 4 bits per cell.
 *
 * @type {GridFormat}
 */
export const GRID_FORMAT_4: GridFormat = {
  bitsPerCell: 4,
  cellsPerWord: 8,
  wordShift: 3,
  cellShift: 2,
  cellIndexMask: 7,
  cellMask: 0xF
};

/**
 * Grid format for 8 bits per cell.
 *
 * @type {GridFormat}
 */
export const GRID_FORMAT_8: GridFormat = {
  bitsPerCell: 8,
  cellsPerWord: 4,
  wordShift: 2,
  cellShift: 3,
  cellIndexMask: 3,
  cellMask: 0xFF
};

/**
 * Grid format for 16 bits per cell.
 *
 * @type {GridFormat}
 */
export const GRID_FORMAT_16: GridFormat = {
  bitsPerCell: 16,
  cellsPerWord: 2,
  wordShift: 1,
  cellShift: 4,
  cellIndexMask: 1,
  cellMask: 0xFFFF
};

/**
 * Grid format for 32 bits per cell.
 *
 * @type {GridFormat}
 */
export const GRID_FORMAT_32: GridFormat = {
  bitsPerCell: 32,
  cellsPerWord: 1,
  wordShift: 0,
  cellShift: 5,
  cellIndexMask: 0,
  cellMask: 0xFFFFFFFF
};

/**
 * Grid formats by bits per cell.
 *
 * @type {Record<BitsPerCell, GridFormat>}
 */
export const GRID_FORMATS: Record<BitsPerCell, GridFormat> = {
  1: GRID_FORMAT_1,
  2: GRID_FORMAT_2,
  4: GRID_FORMAT_4,
  8: GRID_FORMAT_8,
  16: GRID_FORMAT_16,
  32: GRID_FORMAT_32
};
