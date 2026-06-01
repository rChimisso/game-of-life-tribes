import {ByteSink} from '../../snapshot/model/golt-types';

/**
 * Indexed-color PNG bit depth.
 *
 * @typedef {IndexedPngBitDepth}
 */
type IndexedPngBitDepth = 1 | 2 | 4 | 8;

/**
 * Indexed-color PNG palette metadata.
 *
 * @interface IndexedPngPalette
 * @typedef {IndexedPngPalette}
 */
interface IndexedPngPalette {
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
interface IndexedPngFrameOptions {
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

/**
 * Writable byte sink used by PNG helpers.
 *
 * @typedef {PngByteSink}
 */
type PngByteSink = ByteSink;

export type {IndexedPngBitDepth, IndexedPngFrameOptions, IndexedPngPalette, PngByteSink};
