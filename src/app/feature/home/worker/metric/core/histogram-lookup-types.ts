/**
 * Packed-word histogram counter for one grid format.
 *
 * @interface HistogramLookup
 * @typedef {HistogramLookup}
 */
export interface HistogramLookup {
  /**
   * Adds one packed word to the target counts array.
   *
   * @param {number} word packed grid word.
   * @param {number[]} counts population counts by state index.
   * @param {number} [validCells] valid cells in the word; omitted when the whole word is valid.
   */
  addWord(word: number, counts: number[], validCells?: number): void;
}
