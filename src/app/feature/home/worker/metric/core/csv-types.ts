/**
 * Metrics CSV column groups.
 *
 * @interface MetricsCsvColumns
 * @typedef {MetricsCsvColumns}
 */
interface MetricsCsvColumns {
  /**
   * Full CSV header cells.
   *
   * @type {string[]}
   */
  header: string[];
  /**
   * Population tribe columns.
   *
   * @type {string[]}
   */
  populationColumns: string[];
  /**
   * Frontier tribe columns.
   *
   * @type {string[]}
   */
  frontierColumns: string[];
}

export type {MetricsCsvColumns};
