import {FormType} from '~gol/core/model/form-type';

/**
 * Playback section form value.
 *
 * @interface PlaybackFormValue
 * @typedef {PlaybackFormValue}
 */
export interface PlaybackFormValue {
  /**
   * Number of generations to step.
   *
   * @type {(number | null)}
   */
  skipAmount: number | null;
}

/**
 * Playback section form controls.
 *
 * @typedef {PlaybackFormControls}
 */
export type PlaybackFormControls = FormType<PlaybackFormValue>;
