/**
 * Grid dimensions.
 *
 * @interface Grid
 * @typedef {Grid}
 */
export interface Grid {
  /**
   * Grid columns.
   *
   * @type {number}
   */
  cols: number;
  /**
   * Grid rows.
   *
   * @type {number}
   */
  rows: number;
}

/**
 * Grid edge topology.
 *
 * @typedef {GridTopology}
 */
export type GridTopology = 'toroidal' | 'bounded';

/**
 * Grid dimensions and edge behavior.
 *
 * @interface GridSettings
 * @typedef {GridSettings}
 * @extends {Grid}
 */
export interface GridSettings extends Grid {
  /**
   * Grid edge topology.
   *
   * @type {GridTopology}
   */
  topology: GridTopology;
  /**
   * Virtual boundary tribe used by bounded grids.
   *
   * @type {string}
   */
  boundaryTribe: string;
}
