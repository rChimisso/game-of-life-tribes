import {Preset} from './model/preset';
import {AND_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, EXACTLY_CLAUSE_KIND, FIXED_BECOME_KIND, IS_CLAUSE_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Tribe ID.
 *
 * @type {string}
 */
const CONWAY_TRIBE = 'Alive';

/**
 * Conway's Game of Life preset.
 *
 * @type {Preset}
 */
export const CONWAY_PRESET: Preset = {
  name: 'Conway',
  description: 'Classic Game of Life',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: CONWAY_TRIBE,
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
              kind: EXACTLY_CLAUSE_KIND,
              value: 3,
              selector: {kind: TRIBES_SELECTOR_KIND, tribes: [CONWAY_TRIBE]}
            }
          ]
        },
        become: {kind: FIXED_BECOME_KIND, tribe: CONWAY_TRIBE}
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [CONWAY_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [2, 3],
              selector: {kind: TRIBES_SELECTOR_KIND, tribes: [CONWAY_TRIBE]}
            }
          ]
        },
        become: {kind: FIXED_BECOME_KIND, tribe: CONWAY_TRIBE}
      }
    ]
  }
};
