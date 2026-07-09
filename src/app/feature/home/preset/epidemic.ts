import {Preset, staticRule} from '.';
import {AND_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MIN_CLAUSE_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Susceptible population tribe ID.
 *
 * @type {string}
 */
const EPIDEMIC_SUSCEPTIBLE_TRIBE = 'Susceptible';

/**
 * Infectious population tribe ID.
 *
 * @type {string}
 */
const EPIDEMIC_INFECTIOUS_TRIBE = 'Infectious';

/**
 * Recovered population tribe ID.
 *
 * @type {string}
 */
const EPIDEMIC_RECOVERED_TRIBE = 'Recovered';

/**
 * SIRD Epidemic preset.
 *
 * @type {Preset}
 */
export const EPIDEMIC_PRESET: Preset = {
  name: 'SIRD Epidemic',
  description: 'Probabilistic infection, recovery, and mortality',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: EPIDEMIC_SUSCEPTIBLE_TRIBE,
        color: 'feec2a'
      },
      {
        id: EPIDEMIC_INFECTIOUS_TRIBE,
        color: 'd91212'
      },
      {
        id: EPIDEMIC_RECOVERED_TRIBE,
        color: '25d818'
      }
    ],
    rules: [
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [EPIDEMIC_SUSCEPTIBLE_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [EPIDEMIC_INFECTIOUS_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: EPIDEMIC_INFECTIOUS_TRIBE
        },
        probability: 50
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [EPIDEMIC_INFECTIOUS_TRIBE]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: EPIDEMIC_RECOVERED_TRIBE
        },
        probability: 5
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [EPIDEMIC_INFECTIOUS_TRIBE]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: DEAD_TRIBE_ID
        },
        probability: 0.1
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [EPIDEMIC_RECOVERED_TRIBE]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: EPIDEMIC_SUSCEPTIBLE_TRIBE
        },
        probability: 1
      },
      staticRule(EPIDEMIC_SUSCEPTIBLE_TRIBE, EPIDEMIC_INFECTIOUS_TRIBE, EPIDEMIC_RECOVERED_TRIBE)
    ]
  }
};
