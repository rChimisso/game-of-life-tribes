import {RuleDraft} from '~gol/feature/home/model/rule-draft';

/**
 * Rules editor value tracked by the Apply/Restore baseline.
 *
 * @interface RulesEditorValue
 * @typedef {RulesEditorValue}
 */
export interface RulesEditorValue {
  /**
   * Deterministic random seed.
   *
   * @type {(number | null)}
   */
  randomSeed: number | null;
  /**
   * Editable rules.
   *
   * @type {RuleDraft[]}
   */
  rules: RuleDraft[];
}
