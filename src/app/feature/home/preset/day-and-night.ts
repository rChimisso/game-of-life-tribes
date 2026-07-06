import {Preset} from '.';
import {DEAD_TRIBE, AND_CLAUSE_KIND, IS_CLAUSE_KIND, DEAD_TRIBE_ID, OR_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, MIN_CLAUSE_KIND, COUNT_CLAUSE_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

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
                  value: 3,
                  selector: {kind: TRIBES_SELECTOR_KIND, tribes: [DAY_AND_NIGHT_TRIBE]}
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  value: 6,
                  selector: {kind: TRIBES_SELECTOR_KIND, tribes: [DAY_AND_NIGHT_TRIBE]}
                }
              ]
            }
          ]
        },
        tribe: DAY_AND_NIGHT_TRIBE
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
                  interval: [3, 4],
                  selector: {kind: TRIBES_SELECTOR_KIND, tribes: [DAY_AND_NIGHT_TRIBE]}
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  value: 6,
                  selector: {kind: TRIBES_SELECTOR_KIND, tribes: [DAY_AND_NIGHT_TRIBE]}
                }
              ]
            }
          ]
        },
        tribe: DAY_AND_NIGHT_TRIBE
      }
    ]
  }
};
