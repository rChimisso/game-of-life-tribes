import {FormType} from '~gol/core/model/form-type';
import {GridTopology} from '~gol/feature/home/model/grid';

/**
 * Grid size form value.
 *
 * @interface GridSizeFormValue
 * @typedef {GridSizeFormValue}
 */
export interface GridSizeFormValue {
  /**
   * Grid columns.
   *
   * @type {(number | null)}
   */
  cols: number | null;
  /**
   * Grid rows.
   *
   * @type {(number | null)}
   */
  rows: number | null;
  /**
   * Grid topology.
   *
   * @type {GridTopology}
   */
  topology: GridTopology;
  /**
   * Bounded-grid virtual boundary tribe.
   *
   * @type {string}
   */
  boundaryTribe: string;
}

/**
 * Grid size form controls.
 *
 * @typedef {GridSizeFormControls}
 */
export type GridSizeFormControls = FormType<GridSizeFormValue>;
