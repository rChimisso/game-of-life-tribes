import {Preset, staticRule} from '.';
import {AND_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, EXACTLY_CLAUSE_KIND, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MAJORITY_BECOME_KIND, MIN_CLAUSE_KIND, Rule, SAME_BECOME_KIND, Tribe, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Red competitor tribe ID.
 *
 * @type {string}
 */
const CYCLIC_DOMINANCE_RED_TRIBE = 'Red';

/**
 * Green competitor tribe ID.
 *
 * @type {string}
 */
const CYCLIC_DOMINANCE_GREEN_TRIBE = 'Green';

/**
 * Blue competitor tribe ID.
 *
 * @type {string}
 */
const CYCLIC_DOMINANCE_BLUE_TRIBE = 'Blue';

/**
 * Build a rule for a tribe winning against another.
 *
 * @template {Tribe[]} T 
 * @param {string} loserTribe tribe losing.
 * @param {string} winnerTribe tribe winning.
 * @returns {Rule<T>} contest rule.
 */
function contestRule<T extends Tribe[]>(loserTribe: string, winnerTribe: string): Rule<T> {
  return {
    clause: {
      kind: AND_CLAUSE_KIND,
      clauses: [
        {
          kind: IS_CLAUSE_KIND,
          tribes: [loserTribe]
        },
        {
          kind: MIN_CLAUSE_KIND,
          selector: {
            kind: TRIBES_SELECTOR_KIND,
            tribes: [winnerTribe]
          },
          value: 2
        }
      ]
    },
    become: {
      kind: FIXED_BECOME_KIND,
      tribe: winnerTribe
    }
  };
}

/**
 * Cyclic Dominance preset.
 *
 * @type {Preset}
 */
export const CYCLIC_DOMINANCE_PRESET: Preset = {
  name: 'Cyclic Dominance',
  description: 'Rock-paper-scissors territory contest',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: CYCLIC_DOMINANCE_RED_TRIBE,
        color: 'ff0000'
      },
      {
        id: CYCLIC_DOMINANCE_GREEN_TRIBE,
        color: '00ff00'
      },
      {
        id: CYCLIC_DOMINANCE_BLUE_TRIBE,
        color: '0000ff'
      }
    ],
    rules: [
      contestRule(CYCLIC_DOMINANCE_RED_TRIBE, CYCLIC_DOMINANCE_GREEN_TRIBE),
      contestRule(CYCLIC_DOMINANCE_GREEN_TRIBE, CYCLIC_DOMINANCE_BLUE_TRIBE),
      contestRule(CYCLIC_DOMINANCE_BLUE_TRIBE, CYCLIC_DOMINANCE_RED_TRIBE),
      staticRule(CYCLIC_DOMINANCE_RED_TRIBE, CYCLIC_DOMINANCE_GREEN_TRIBE, CYCLIC_DOMINANCE_BLUE_TRIBE),
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [CYCLIC_DOMINANCE_RED_TRIBE, CYCLIC_DOMINANCE_GREEN_TRIBE, CYCLIC_DOMINANCE_BLUE_TRIBE]
              },
              value: 3
            }
          ]
        },
        become: {
          kind: MAJORITY_BECOME_KIND,
          selector: {
            kind: TRIBES_SELECTOR_KIND,
            tribes: [CYCLIC_DOMINANCE_RED_TRIBE, CYCLIC_DOMINANCE_GREEN_TRIBE, CYCLIC_DOMINANCE_BLUE_TRIBE]
          },
          tie: {
            kind: SAME_BECOME_KIND
          },
          fallback: {
            kind: SAME_BECOME_KIND
          }
        }
      }
    ]
  }
};
