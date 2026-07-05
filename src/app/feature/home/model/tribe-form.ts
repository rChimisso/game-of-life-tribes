import {FormType} from '~gol/core/model/form-type';

/**
 * Editable tribe form value.
 *
 * @interface TribeFormValue
 * @typedef {TribeFormValue}
 */
export interface TribeFormValue {
  /**
   * Tribe id.
   *
   * @type {string}
   */
  id: string;
  /**
   * Tribe color in RGB hex.
   *
   * @type {string}
   */
  color: string;
}

/**
 * Tribe collection form value.
 *
 * @interface TribesFormValue
 * @typedef {TribesFormValue}
 */
export interface TribesFormValue {
  /**
   * Tribe rows.
   *
   * @type {TribeFormValue[]}
   */
  tribes: TribeFormValue[];
}

/**
 * Tribe row form controls.
 *
 * @typedef {TribeFormControls}
 */
export type TribeFormControls = FormType<TribeFormValue>;

/**
 * Tribe collection form controls.
 *
 * @typedef {TribesFormControls}
 */
export type TribesFormControls = FormType<TribesFormValue>;
