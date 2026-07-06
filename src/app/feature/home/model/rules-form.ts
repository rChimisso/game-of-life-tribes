import {FormArray, FormControl} from '@angular/forms';

import {Rule, Tribe} from './rule';

/**
 * Rules editor form controls.
 *
 * @interface RulesFormControls
 * @typedef {RulesFormControls}
 */
export interface RulesFormControls {
  /**
   * Deterministic random seed.
   *
   * @type {FormControl<number | null>}
   */
  randomSeed: FormControl<number | null>;
  /**
   * Editable rule controls.
   *
   * @type {FormArray<FormControl<Rule<Tribe[]>>>}
   */
  rules: FormArray<FormControl<Rule<Tribe[]>>>;
}
