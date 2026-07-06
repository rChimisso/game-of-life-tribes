import {Preset} from '.';
import {DEAD_TRIBE, AND_CLAUSE_KIND, IS_CLAUSE_KIND, DEAD_TRIBE_ID, EXACTLY_CLAUSE_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Tribe ID.
 *
 * @type {string}
 */
const ETERNAL_TRIBE = 'Immortal';

/**
 * Eternal preset.
 *
 * @type {Preset}
 */
export const ETERNAL_PRESET: Preset = {
  name: 'Eternal',
  description: 'Never dies once alive',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: ETERNAL_TRIBE,
        color: 'fffff0'
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
              kind: EXACTLY_CLAUSE_KIND,
              value: 3,
              selector: {kind: TRIBES_SELECTOR_KIND, tribes: [ETERNAL_TRIBE]}
            }
          ]
        },
        tribe: ETERNAL_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [ETERNAL_TRIBE]
        },
        tribe: ETERNAL_TRIBE
      }
    ]
  }
};
