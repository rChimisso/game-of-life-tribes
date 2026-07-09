import {Preset, staticRule} from '.';
import {AND_CLAUSE_KIND, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, DIFFERENT_IN_TRIBE_SELECTOR_KIND, IS_CLAUSE_KIND, MAJORITY_BECOME_KIND, MIN_CLAUSE_KIND, SAME_BECOME_KIND, SAME_TRIBE_SELECTOR_KIND} from '../model/rule';

/**
 * Coral culture tribe ID.
 *
 * @type {string}
 */
const CULTURAL_DRIFT_CORAL_TRIBE = 'Coral';

/**
 * Amber culture tribe ID.
 *
 * @type {string}
 */
const CULTURAL_DRIFT_AMBER_TRIBE = 'Amber';

/**
 * Teal culture tribe ID.
 *
 * @type {string}
 */
const CULTURAL_DRIFT_TEAL_TRIBE = 'Teal';

/**
 * Azure culture tribe ID.
 *
 * @type {string}
 */
const CULTURAL_DRIFT_AZURE_TRIBE = 'Azure';

/**
 * Violet culture tribe ID.
 *
 * @type {string}
 */
const CULTURAL_DRIFT_VIOLET_TRIBE = 'Violet';

/**
 * List of cultural tribes.
 *
 * @type {readonly ["Coral", "Amber", "Teal", "Azure", "Violet"]}
 */
const CULTURAL_DRIFT_TRIBES = [
  CULTURAL_DRIFT_CORAL_TRIBE,
  CULTURAL_DRIFT_AMBER_TRIBE,
  CULTURAL_DRIFT_TEAL_TRIBE,
  CULTURAL_DRIFT_AZURE_TRIBE,
  CULTURAL_DRIFT_VIOLET_TRIBE
] as const;

/**
 * Cultural Drift preset.
 *
 * @type {Preset}
 */
export const CULTURAL_DRIFT_PRESET: Preset = {
  name: 'Cultural Drift',
  description: 'Local influence forms shifting cultural regions',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: CULTURAL_DRIFT_CORAL_TRIBE,
        color: 'ff6b6b'
      },
      {
        id: CULTURAL_DRIFT_AMBER_TRIBE,
        color: 'f4b942'
      },
      {
        id: CULTURAL_DRIFT_TEAL_TRIBE,
        color: '2ec4b6'
      },
      {
        id: CULTURAL_DRIFT_AZURE_TRIBE,
        color: '4d96ff'
      },
      {
        id: CULTURAL_DRIFT_VIOLET_TRIBE,
        color: '9b5de5'
      }
    ],
    rules: [
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID, ...CULTURAL_DRIFT_TRIBES]
            },
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: DIFFERENT_IN_TRIBE_SELECTOR_KIND,
                  tribes: [...CULTURAL_DRIFT_TRIBES]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: SAME_TRIBE_SELECTOR_KIND
                }
              },
              operator: '≥',
              margin: 1
            }
          ]
        },
        become: {
          kind: MAJORITY_BECOME_KIND,
          selector: {
            kind: DIFFERENT_IN_TRIBE_SELECTOR_KIND,
            tribes: [...CULTURAL_DRIFT_TRIBES]
          },
          tie: {
            kind: SAME_BECOME_KIND
          },
          fallback: {
            kind: SAME_BECOME_KIND
          }
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID, ...CULTURAL_DRIFT_TRIBES]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: DIFFERENT_IN_TRIBE_SELECTOR_KIND,
                tribes: [...CULTURAL_DRIFT_TRIBES]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: MAJORITY_BECOME_KIND,
          selector: {
            kind: DIFFERENT_IN_TRIBE_SELECTOR_KIND,
            tribes: [...CULTURAL_DRIFT_TRIBES]
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
      staticRule(...CULTURAL_DRIFT_TRIBES)
    ]
  }
};
