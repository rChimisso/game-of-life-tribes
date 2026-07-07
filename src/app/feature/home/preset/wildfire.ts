import {directRule} from './logic/direct-rule';
import {burnRules} from './logic/wildfire';
import {Preset} from './model/preset';
import {WILDFIRE_ASH_TRIBE, WILDFIRE_BLAZE_TRIBE, WILDFIRE_DARK_VEGETATION_TRIBE, WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_LIGHT_VEGETATION_TRIBE, WILDFIRE_MEDIUM_VEGETATION_TRIBE, WILDFIRE_ROCK_TRIBE} from './model/wildfire';
import {AND_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, TRIBES_SELECTOR_KIND, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MAJORITY_BECOME_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, SAME_BECOME_KIND} from '../model/rule';

/**
 * Wildfire preset.
 *
 * @type {Preset}
 */
export const WILDFIRE_PRESET: Preset = {
  name: 'Wildfire',
  description: 'Fire spreads through varied vegetation',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: WILDFIRE_LIGHT_VEGETATION_TRIBE,
        color: '9be564'
      },
      {
        id: WILDFIRE_MEDIUM_VEGETATION_TRIBE,
        color: '2f9e44'
      },
      {
        id: WILDFIRE_DARK_VEGETATION_TRIBE,
        color: '0d5c2a'
      },
      {
        id: WILDFIRE_EMBER_TRIBE,
        color: 'ffae3d'
      },
      {
        id: WILDFIRE_FIRE_TRIBE,
        color: 'fe7f2a'
      },
      {
        id: WILDFIRE_BLAZE_TRIBE,
        color: 'ff4d00'
      },
      {
        id: WILDFIRE_ASH_TRIBE,
        color: '6f6f6f'
      },
      {
        id: WILDFIRE_ROCK_TRIBE,
        color: '8a8f98'
      }
    ],
    rules: [
      directRule(WILDFIRE_BLAZE_TRIBE, WILDFIRE_FIRE_TRIBE),
      directRule(WILDFIRE_FIRE_TRIBE, WILDFIRE_EMBER_TRIBE),
      directRule(WILDFIRE_EMBER_TRIBE, WILDFIRE_ASH_TRIBE),
      directRule(WILDFIRE_ROCK_TRIBE, WILDFIRE_ROCK_TRIBE),
      ...burnRules(WILDFIRE_LIGHT_VEGETATION_TRIBE, 1),
      ...burnRules(WILDFIRE_MEDIUM_VEGETATION_TRIBE, 2),
      ...burnRules(WILDFIRE_DARK_VEGETATION_TRIBE, 3),
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [WILDFIRE_LIGHT_VEGETATION_TRIBE, WILDFIRE_MEDIUM_VEGETATION_TRIBE, WILDFIRE_DARK_VEGETATION_TRIBE]
        },
        become: {
          kind: SAME_BECOME_KIND
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID, WILDFIRE_ASH_TRIBE]
            },
            {
              kind: NONE_CLAUSE_KIND,
              selector: {kind: TRIBES_SELECTOR_KIND, tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]}
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 5,
              selector: {kind: TRIBES_SELECTOR_KIND, tribes: [WILDFIRE_LIGHT_VEGETATION_TRIBE, WILDFIRE_MEDIUM_VEGETATION_TRIBE, WILDFIRE_DARK_VEGETATION_TRIBE]}
            }
          ]
        },
        become: {
          kind: MAJORITY_BECOME_KIND,
          selector: {
            kind: TRIBES_SELECTOR_KIND,
            tribes: [WILDFIRE_LIGHT_VEGETATION_TRIBE, WILDFIRE_MEDIUM_VEGETATION_TRIBE, WILDFIRE_DARK_VEGETATION_TRIBE]
          },
          tie: {
            kind: FIXED_BECOME_KIND,
            tribe: WILDFIRE_MEDIUM_VEGETATION_TRIBE
          },
          fallback: {
            kind: FIXED_BECOME_KIND,
            tribe: WILDFIRE_MEDIUM_VEGETATION_TRIBE
          }
        }
      }
    ]
  }
};
