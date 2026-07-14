import {Operator, Rule, Tribe} from '~gol/feature/home/model/rule';

/**
 * Mapping from rule comparison operators to WGSL operators.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const COMPARISON_OPERATOR_WGSL: Readonly<Record<Operator, string>> = {
  '=': '==',
  '≠': '!=',
  '>': '>',
  '<': '<',
  '≥': '>=',
  '≤': '<='
};

/**
 * WGSL statement recording that a rule has applied.
 *
 * @type {"applied = true;"}
 */
export const APPLIED_RULE_WGSL = 'applied = true;';

/**
 * Maximum number of rule branches emitted in one WGSL conditional chain.
 *
 * @type {32}
 */
export const RULE_CHAIN_SIZE = 32;

/**
 * Active rule metadata used by shader generation.
 *
 * @interface ActiveRule
 * @typedef {ActiveRule}
 */
export interface ActiveRule {
  /**
   * Normalized rule.
   *
   * @type {Rule<readonly Tribe[]>}
   */
  rule: Rule<readonly Tribe[]>;
  /**
   * Stable priority index in the original ruleset.
   *
   * @type {number}
   */
  priorityIndex: number;
  /**
   * Normalized probability percentage.
   *
   * @type {number}
   */
  probability: number;
}
