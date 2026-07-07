import {FIXED_BECOME_KIND, IS_CLAUSE_KIND, Rule, Tribe} from '../../model/rule';

/**
 * Builds a rule that changes a cell from one tribe to another.
 *
 * @template {readonly Tribe[]} T
 * @param {string} fromTribe current tribe ID.
 * @param {string} toTribe next tribe ID.
 * @returns {Rule<T>} transition rule for the change step.
 */
export function directRule<T extends readonly Tribe[]>(fromTribe: string, toTribe: string): Rule<T> {
  return {
    clause: {
      kind: IS_CLAUSE_KIND,
      tribes: [fromTribe]
    },
    become: {
      kind: FIXED_BECOME_KIND,
      tribe: toTribe
    }
  };
}
