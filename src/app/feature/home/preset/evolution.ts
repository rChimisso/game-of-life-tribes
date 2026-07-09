import {directRule, Preset, staticRule} from '.';
import {AND_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MAJORITY_BECOME_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, Rule, SAME_BECOME_KIND, SAME_TRIBE_SELECTOR_KIND, TRIBES_SELECTOR_KIND, Tribe} from '../model/rule';

/**
 * Hardy genotype tribe ID.
 *
 * @type {string}
 */
const EVOLUTION_HARDY_TRIBE = 'Hardy';

/**
 * Balanced genotype tribe ID.
 *
 * @type {string}
 */
const EVOLUTION_BALANCED_TRIBE = 'Balanced';

/**
 * Fertile genotype tribe ID.
 *
 * @type {string}
 */
const EVOLUTION_FERTILE_TRIBE = 'Fertile';

/**
 * Aggressive genotype tribe ID.
 *
 * @type {string}
 */
const EVOLUTION_AGGRESSIVE_TRIBE = 'Aggressive';

/**
 * Efficient genotype tribe ID.
 *
 * @type {string}
 */
const EVOLUTION_EFFICIENT_TRIBE = 'Efficient';

/**
 * Evolution genotype tribe IDs.
 *
 * @type {readonly string[]}
 */
const EVOLUTION_GENOTYPES = [
  EVOLUTION_HARDY_TRIBE,
  EVOLUTION_BALANCED_TRIBE,
  EVOLUTION_FERTILE_TRIBE,
  EVOLUTION_AGGRESSIVE_TRIBE,
  EVOLUTION_EFFICIENT_TRIBE
] as const;

/**
 * Probability of a genotype mutation.
 *
 * @type {number}
 */
const EVOLUTION_MUTATION_PROBABILITY = 0.001;

/**
 * Builds a probabilistic clonal reproduction rule.
 *
 * @param {string} tribe genotype tribe ID.
 * @param {number} probability reproduction probability percentage.
 * @returns {Rule<Tribe[]>} clonal reproduction rule.
 */
function clonalBirthRule(tribe: string, probability: number): Rule<Tribe[]> {
  return {
    clause: {
      kind: AND_CLAUSE_KIND,
      clauses: [
        {
          kind: IS_CLAUSE_KIND,
          tribes: [DEAD_TRIBE_ID]
        },
        {
          kind: MIN_CLAUSE_KIND,
          selector: {
            kind: TRIBES_SELECTOR_KIND,
            tribes: [tribe]
          },
          value: 1
        }
      ]
    },
    become: {
      kind: FIXED_BECOME_KIND,
      tribe
    },
    probability
  };
}

/**
 * Evolution preset.
 *
 * @type {Preset}
 */
export const EVOLUTION_PRESET: Preset = {
  name: 'Evolution',
  description: 'Competing traits mutate and adapt through local selection',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: EVOLUTION_HARDY_TRIBE,
        color: '4dabf7'
      },
      {
        id: EVOLUTION_BALANCED_TRIBE,
        color: 'adb5bd'
      },
      {
        id: EVOLUTION_FERTILE_TRIBE,
        color: '69db7c'
      },
      {
        id: EVOLUTION_AGGRESSIVE_TRIBE,
        color: 'ff6b6b'
      },
      {
        id: EVOLUTION_EFFICIENT_TRIBE,
        color: 'b197fc'
      }
    ],
    rules: [
      {
        ...directRule(EVOLUTION_HARDY_TRIBE, EVOLUTION_BALANCED_TRIBE),
        probability: EVOLUTION_MUTATION_PROBABILITY
      },
      {
        ...directRule(EVOLUTION_BALANCED_TRIBE, EVOLUTION_HARDY_TRIBE),
        probability: EVOLUTION_MUTATION_PROBABILITY
      },
      {
        ...directRule(EVOLUTION_BALANCED_TRIBE, EVOLUTION_FERTILE_TRIBE),
        probability: EVOLUTION_MUTATION_PROBABILITY
      },
      {
        ...directRule(EVOLUTION_FERTILE_TRIBE, EVOLUTION_BALANCED_TRIBE),
        probability: EVOLUTION_MUTATION_PROBABILITY
      },
      {
        ...directRule(EVOLUTION_BALANCED_TRIBE, EVOLUTION_AGGRESSIVE_TRIBE),
        probability: EVOLUTION_MUTATION_PROBABILITY
      },
      {
        ...directRule(EVOLUTION_AGGRESSIVE_TRIBE, EVOLUTION_BALANCED_TRIBE),
        probability: EVOLUTION_MUTATION_PROBABILITY
      },
      {
        ...directRule(EVOLUTION_AGGRESSIVE_TRIBE, EVOLUTION_EFFICIENT_TRIBE),
        probability: EVOLUTION_MUTATION_PROBABILITY
      },
      {
        ...directRule(EVOLUTION_EFFICIENT_TRIBE, EVOLUTION_AGGRESSIVE_TRIBE),
        probability: EVOLUTION_MUTATION_PROBABILITY
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [EVOLUTION_FERTILE_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: SAME_TRIBE_SELECTOR_KIND
              },
              value: 6
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: DEAD_TRIBE_ID
        },
        probability: 8
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [EVOLUTION_AGGRESSIVE_TRIBE]
            },
            {
              kind: NONE_CLAUSE_KIND,
              selector: {
                kind: SAME_TRIBE_SELECTOR_KIND
              }
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: DEAD_TRIBE_ID
        },
        probability: 2
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [EVOLUTION_EFFICIENT_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [...EVOLUTION_GENOTYPES]
              },
              value: 6
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: DEAD_TRIBE_ID
        },
        probability: 3
      },
      {
        ...directRule(EVOLUTION_HARDY_TRIBE, DEAD_TRIBE_ID),
        probability: 0.1
      },
      {
        ...directRule(EVOLUTION_BALANCED_TRIBE, DEAD_TRIBE_ID),
        probability: 0.25
      },
      {
        ...directRule(EVOLUTION_FERTILE_TRIBE, DEAD_TRIBE_ID),
        probability: 0.5
      },
      {
        ...directRule(EVOLUTION_AGGRESSIVE_TRIBE, DEAD_TRIBE_ID),
        probability: 0.35
      },
      {
        ...directRule(EVOLUTION_EFFICIENT_TRIBE, DEAD_TRIBE_ID),
        probability: 0.15
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [
                EVOLUTION_HARDY_TRIBE,
                EVOLUTION_BALANCED_TRIBE,
                EVOLUTION_FERTILE_TRIBE,
                EVOLUTION_EFFICIENT_TRIBE
              ]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [EVOLUTION_AGGRESSIVE_TRIBE]
              },
              value: 2
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: EVOLUTION_AGGRESSIVE_TRIBE
        },
        probability: 8
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [EVOLUTION_EFFICIENT_TRIBE]
              },
              value: 1
            },
            {
              kind: MAX_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [...EVOLUTION_GENOTYPES]
              },
              value: 3
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: EVOLUTION_EFFICIENT_TRIBE
        },
        probability: 10
      },
      clonalBirthRule(EVOLUTION_FERTILE_TRIBE, 12),
      clonalBirthRule(EVOLUTION_BALANCED_TRIBE, 6),
      clonalBirthRule(EVOLUTION_AGGRESSIVE_TRIBE, 4),
      clonalBirthRule(EVOLUTION_HARDY_TRIBE, 2),
      clonalBirthRule(EVOLUTION_EFFICIENT_TRIBE, 1),
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [...EVOLUTION_GENOTYPES]
              },
              value: 2
            }
          ]
        },
        become: {
          kind: MAJORITY_BECOME_KIND,
          selector: {
            kind: TRIBES_SELECTOR_KIND,
            tribes: [...EVOLUTION_GENOTYPES]
          },
          tie: {
            kind: SAME_BECOME_KIND
          },
          fallback: {
            kind: SAME_BECOME_KIND
          }
        },
        probability: 1
      },
      staticRule(...EVOLUTION_GENOTYPES)
    ]
  }
};
