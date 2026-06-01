/**
 * Population stats derived from live metric readback.
 *
 * @interface LivePopulationStats
 * @typedef {LivePopulationStats}
 */
export interface LivePopulationStats {
  /**
   * Population by tribe ID.
   *
   * @type {Record<string, number>}
   */
  population: Record<string, number>;
  /**
   * Live cell count.
   *
   * @type {number}
   */
  aliveCells: number;
  /**
   * Dead cell count.
   *
   * @type {number}
   */
  deadCells: number;
}

/**
 * Diversity stats derived from live metric readback.
 *
 * @interface LiveDiversityStats
 * @typedef {LiveDiversityStats}
 */
export interface LiveDiversityStats {
  /**
   * Shannon entropy among live tribes.
   *
   * @type {number}
   */
  shannonEntropy: number;
  /**
   * Simpson sum among live tribes.
   *
   * @type {number}
   */
  simpsonSum: number;
}
