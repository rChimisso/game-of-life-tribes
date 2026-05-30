/**
 * Packed-word histogram counter for one grid format.
 *
 * @export
 * @interface HistogramLookup
 * @typedef {HistogramLookup}
 */
interface HistogramLookup {
  /**
   * Adds one packed word to the target counts array.
   *
   * @param {number} word packed grid word.
   * @param {number[]} counts population counts by state index.
   * @param {number} [validCells] valid cells in the word; omitted when the whole word is valid.
   */
  addWord(word: number, counts: number[], validCells?: number): void;
}

export type {HistogramLookup};
