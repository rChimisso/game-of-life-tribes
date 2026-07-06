import {FormArray, FormControl} from '@angular/forms';

import {RuleDraft} from './rule-draft';

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
   * @type {FormArray<FormControl<RuleDraft>>}
   */
  rules: FormArray<FormControl<RuleDraft>>;
}
