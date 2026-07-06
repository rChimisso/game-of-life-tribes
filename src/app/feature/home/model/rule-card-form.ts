import {FormControl} from '@angular/forms';

import {Become, Clause, Tribe} from './rule';

/**
 * Rule card editor form controls.
 *
 * @interface RuleCardFormControls
 * @typedef {RuleCardFormControls}
 */
export interface RuleCardFormControls {
  /**
   * Whether the rule is muted.
   *
   * @type {FormControl<boolean>}
   */
  muted: FormControl<boolean>;
  /**
   * Rule probability percentage.
   *
   * @type {FormControl<number | null>}
   */
  probability: FormControl<number | null>;
  /**
   * Rule clause.
   *
   * @type {FormControl<Clause<Tribe[]>>}
   */
  clause: FormControl<Clause<Tribe[]>>;
  /**
   * Rule outcome.
   *
   * @type {FormControl<Become<Tribe[]>>}
   */
  become: FormControl<Become<Tribe[]>>;
}
