import {FormArray, FormControl} from '@angular/forms';

import {Operator, Tribe, TribeSelector} from '~gol/feature/home/model/rule';
import {ClauseDraft} from '~gol/feature/home/model/rule-draft';

/**
 * Clause editor form controls.
 *
 * @interface ClauseFormControls
 * @typedef {ClauseFormControls}
 */
export interface ClauseFormControls {
  /**
   * Count-style selector.
   *
   * @type {FormControl<TribeSelector<Tribe[]> | null>}
   */
  selector: FormControl<TribeSelector<Tribe[]> | null>;
  /**
   * Left comparison selector.
   *
   * @type {FormControl<TribeSelector<Tribe[]> | null>}
   */
  leftSelector: FormControl<TribeSelector<Tribe[]> | null>;
  /**
   * Right comparison selector.
   *
   * @type {FormControl<TribeSelector<Tribe[]> | null>}
   */
  rightSelector: FormControl<TribeSelector<Tribe[]> | null>;
  /**
   * Selected tribes for IS clauses.
   *
   * @type {FormControl<string[]>}
   */
  tribes: FormControl<string[]>;
  /**
   * Count interval lower bound.
   *
   * @type {FormControl<number | null>}
   */
  intervalMin: FormControl<number | null>;
  /**
   * Count interval upper bound.
   *
   * @type {FormControl<number | null>}
   */
  intervalMax: FormControl<number | null>;
  /**
   * Single count value.
   *
   * @type {FormControl<number | null>}
   */
  value: FormControl<number | null>;
  /**
   * Comparison margin.
   *
   * @type {FormControl<number | null>}
   */
  margin: FormControl<number | null>;
  /**
   * Comparison operator.
   *
   * @type {FormControl<Operator>}
   */
  operator: FormControl<Operator>;
  /**
   * NOT child clause.
   *
   * @type {FormControl<ClauseDraft>}
   */
  child: FormControl<ClauseDraft>;
  /**
   * Logical child clauses.
   *
   * @type {FormArray<FormControl<ClauseDraft>>}
   */
  children: FormArray<FormControl<ClauseDraft>>;
}
