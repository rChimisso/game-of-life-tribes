import {Preset} from './model/preset';
import {DEAD_TRIBE, AND_CLAUSE_KIND, IS_CLAUSE_KIND, DEAD_TRIBE_ID, OR_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, FIXED_BECOME_KIND, MIN_CLAUSE_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Tribe ID.
 *
 * @type {string}
 */
const DIAMOEBA_TRIBE = 'Foam';

/**
 * Diamoeba preset.
 *
 * @type {Preset}
 */
export const DIAMOEBA_PRESET: Preset = {
  name: 'Diamoeba',
  description: 'Diamonds with fluctuating boundaries',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: DIAMOEBA_TRIBE,
        color: '3dd8ff'
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
                  selector: {kind: TRIBES_SELECTOR_KIND, tribes: [DIAMOEBA_TRIBE]}
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  value: 5,
                  selector: {kind: TRIBES_SELECTOR_KIND, tribes: [DIAMOEBA_TRIBE]}
                }
              ]
            }
          ]
        },
        become: {kind: FIXED_BECOME_KIND, tribe: DIAMOEBA_TRIBE}
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DIAMOEBA_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 5,
              selector: {kind: TRIBES_SELECTOR_KIND, tribes: [DIAMOEBA_TRIBE]}
            }
          ]
        },
        become: {kind: FIXED_BECOME_KIND, tribe: DIAMOEBA_TRIBE}
      }
    ]
  }
};
