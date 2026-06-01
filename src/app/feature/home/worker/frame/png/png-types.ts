/**
 * PNG signature bytes.
 *
 * @type {Uint8Array}
 */
export const PNG_SIGNATURE = new Uint8Array([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10
]);

/**
 * Empty PNG chunk payload.
 *
 * @type {Uint8Array}
 */
export const EMPTY_CHUNK_DATA = new Uint8Array(0);

/**
 * Largest PNG chunk payload copied into one sink write.
 *
 * @type {number}
 */
export const PNG_SINGLE_WRITE_CHUNK_THRESHOLD_BYTES = 64 * 1024 * 1024;

/**
 * Text encoder used for PNG chunk types.
 *
 * @type {TextEncoder}
 */
export const TEXT_ENCODER = new TextEncoder();

/**
 * Memory budget for one PNG scanline write block.
 *
 * @type {number}
 */
export const PNG_SCANLINE_BLOCK_MEMORY_BUDGET_BYTES = 32 * 1024 * 1024;

/**
 * Error message used when PNG export cancellation stops encode work.
 *
 * @type {string}
 */
export const PNG_EXPORT_CANCELLED_ERROR_MESSAGE = 'PNG export cancelled';

/**
 * PNG image-data chunk type.
 *
 * @type {string}
 */
export const IDAT_CHUNK_TYPE = 'IDAT';

/**
 * Observed state for the parallel compressor output pump.
 *
 * @interface CompressedPumpState
 * @typedef {CompressedPumpState}
 */
export interface CompressedPumpState {
  /**
   * Error captured from the compressor output pump.
   *
   * @type {(unknown | null)}
   */
  error: unknown | null;
}

/**
 * Cancellation state shared by PNG stream operations.
 *
 * @interface PngCancellationState
 * @typedef {PngCancellationState}
 */
export interface PngCancellationState {
  /**
   * Whether cancellation has been requested.
   *
   * @type {boolean}
   */
  cancelled: boolean;
  /**
   * Promise resolved when cancellation is requested.
   *
   * @type {Promise<void>}
   */
  promise: Promise<void>;
  /**
   * Removes the active cancellation listener.
   *
   * @type {() => void}
   */
  unregister: () => void;
}

/**
 * Result of an awaited operation raced against PNG cancellation.
 *
 * @typedef {PngCancellableResult}
 * @template T
 */
export type PngCancellableResult<T> = {
  /**
   * Operation result type.
   *
   * @type {'value'}
   */
  type: 'value';
  /**
   * Operation result value.
   *
   * @type {T}
   */
  value: T;
} | {
  /**
   * Operation result type.
   *
   * @type {'error'}
   */
  type: 'error';
  /**
   * Operation rejection reason.
   *
   * @type {unknown}
   */
  error: unknown;
} | {
  /**
   * Operation result type.
   *
   * @type {'cancelled'}
   */
  type: 'cancelled';
};

/**
 * Indexed-color PNG bit depth.
 *
 * @typedef {IndexedPngBitDepth}
 */
export type IndexedPngBitDepth = 1 | 2 | 4 | 8;

/**
 * Indexed-color PNG palette metadata.
 *
 * @interface IndexedPngPalette
 * @typedef {IndexedPngPalette}
 */
export interface IndexedPngPalette {
  /**
   * PNG bit depth selected for the state count.
   *
   * @type {IndexedPngBitDepth}
   */
  bitDepth: IndexedPngBitDepth;
  /**
   * Optional state-to-palette index lookup.
   *
   * @type {(Uint8Array | null)}
   */
  stateToPaletteIndex: Uint8Array | null;
  /**
   * PNG PLTE payload as RGB triples.
   *
   * @type {Uint8Array}
   */
  plte: Uint8Array;
  /**
   * Number of exported states.
   *
   * @type {number}
   */
  stateCount: number;
}

/**
 * Options used while encoding one indexed-color PNG frame.
 *
 * @interface IndexedPngFrameOptions
 * @typedef {IndexedPngFrameOptions}
 */
export interface IndexedPngFrameOptions {
  /**
   * Returns whether the active export has been cancelled.
   *
   * @type {() => boolean}
   */
  shouldCancel: () => boolean;
  /**
   * Registers a listener for active export cancellation.
   *
   * @type {(listener: () => void) => () => void}
   */
  onCancelRequested: (listener: () => void) => () => void;
  /**
   * Receives row-level encode progress.
   *
   * @type {?((rowsProcessed: number, rowsTotal: number) => void)}
   */
  onRowsProcessed?: (rowsProcessed: number, rowsTotal: number) => void;
}
