import {Operator} from '~gol/feature/home/model/rule';

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
