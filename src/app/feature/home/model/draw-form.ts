import {FormType} from '~gol/core/model/form-type';
import {BrushFill, BrushShape, TouchMode} from '~gol/feature/home/model/draw-mode';

/**
 * Draw section form value.
 *
 * @interface DrawFormValue
 * @typedef {DrawFormValue}
 */
export interface DrawFormValue {
  /**
   * Brush size.
   *
   * @type {(number | null)}
   */
  brushSize: number | null;
  /**
   * Brush shape.
   *
   * @type {BrushShape}
   */
  brushShape: BrushShape;
  /**
   * Brush fill mode.
   *
   * @type {BrushFill}
   */
  brushFill: BrushFill;
  /**
   * Brush density percentage.
   *
   * @type {(number | null)}
   */
  brushDensity: number | null;
  /**
   * Touch interaction mode.
   *
   * @type {TouchMode}
   */
  touchMode: TouchMode;
}

/**
 * Draw section form controls.
 *
 * @typedef {DrawFormControls}
 */
export type DrawFormControls = FormType<DrawFormValue>;
