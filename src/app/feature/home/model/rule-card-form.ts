import {FormControl} from '@angular/forms';

import {Become, Tribe} from './rule';
import {ClauseDraft} from './rule-draft';

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
   * @type {FormControl<ClauseDraft>}
   */
  clause: FormControl<ClauseDraft>;
  /**
   * Rule outcome.
   *
   * @type {FormControl<Become<Tribe[]>>}
   */
  become: FormControl<Become<Tribe[]>>;
}
