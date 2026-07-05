import {FormType} from '~gol/core/model/form-type';

/**
 * Speed section form value.
 *
 * @interface SpeedFormValue
 * @typedef {SpeedFormValue}
 */
export interface SpeedFormValue {
  /**
   * Target generation speed.
   *
   * @type {(number | null)}
   */
  speed: number | null;
  /**
   * Whether max speed mode is enabled.
   *
   * @type {boolean}
   */
  maxSpeed: boolean;
  /**
   * Whether recording is enabled.
   *
   * @type {boolean}
   */
  recording: boolean;
  /**
   * Whether live metrics are enabled.
   *
   * @type {boolean}
   */
  liveMetricsEnabled: boolean;
}

/**
 * Speed section form controls.
 *
 * @typedef {SpeedFormControls}
 */
export type SpeedFormControls = FormType<SpeedFormValue>;
