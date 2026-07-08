import {Preset} from '.';
import {DEAD_TRIBE, AND_CLAUSE_KIND, IS_CLAUSE_KIND, DEAD_TRIBE_ID, OR_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, FIXED_BECOME_KIND, MIN_CLAUSE_KIND, COUNT_CLAUSE_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Tribe ID.
 *
 * @type {string}
 */
const DAY_AND_NIGHT_TRIBE = 'Yang';

/**
 * Day and Night preset.
 *
 * @type {Preset}
 */
export const DAY_AND_NIGHT_PRESET: Preset = {
  name: 'Day & Night',
  description: 'Symmetric under on-off reversal',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: DAY_AND_NIGHT_TRIBE,
        color: 'ffffff'
      }
    ],
    rules: [
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [DAY_AND_NIGHT_TRIBE]
                  },
                  value: 3
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [DAY_AND_NIGHT_TRIBE]
                  },
                  value: 6
                }
              ]
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: DAY_AND_NIGHT_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DAY_AND_NIGHT_TRIBE]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: COUNT_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [DAY_AND_NIGHT_TRIBE]
                  },
                  interval: [3, 4]
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [DAY_AND_NIGHT_TRIBE]
                  },
                  value: 6
                }
              ]
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: DAY_AND_NIGHT_TRIBE
        }
      }
    ]
  }
};
