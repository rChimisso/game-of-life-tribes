import {directRule, Preset, staticRule} from '.';
import {AND_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, TRIBES_SELECTOR_KIND, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MAJORITY_BECOME_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NeighborCount, Tribe, Rule} from '../model/rule';

/**
 * Light vegetation tribe ID.
 *
 * @type {string}
 */
const WILDFIRE_LIGHT_VEGETATION_TRIBE = 'Grass';

/**
 * Medium vegetation tribe ID.
 *
 * @type {string}
 */
const WILDFIRE_MEDIUM_VEGETATION_TRIBE = 'Bush';

/**
 * Dense vegetation tribe ID.
 *
 * @type {string}
 */
const WILDFIRE_DARK_VEGETATION_TRIBE = 'Tree';

/**
 * Ember tribe ID.
 *
 * @type {string}
 */
const WILDFIRE_EMBER_TRIBE = 'Ember';

/**
 * Fire tribe ID.
 *
 * @type {string}
 */
const WILDFIRE_FIRE_TRIBE = 'Fire';

/**
 * Blaze tribe ID.
 *
 * @type {string}
 */
const WILDFIRE_BLAZE_TRIBE = 'Blaze';

/**
 * Ash tribe ID.
 *
 * @type {string}
 */
const WILDFIRE_CHAR_TRIBE = 'Char';

/**
 * Rock tribe ID.
 *
 * @type {string}
 */
const WILDFIRE_ROCK_TRIBE = 'Rock';

/**
 * Builds rules for the burning of a vegetation tribe with a given fire resistance.
 *
 * @template {Tribe[]} T
 * @param {string} vegetationTribe tribe ID.
 * @param {NeighborCount} fireResistance minimum number of burning neighbors required for the tribe to catch fire.
 * @returns {Rule<T>[]} transition rules for the burning process.
 */
function burnRules<T extends Tribe[]>(vegetationTribe: string, fireResistance: NeighborCount): Rule<T>[] {
  return [
    {
      clause: {
        kind: AND_CLAUSE_KIND,
        clauses: [
          {
            kind: IS_CLAUSE_KIND,
            tribes: [vegetationTribe]
          },
          {
            kind: MIN_CLAUSE_KIND,
            value: fireResistance + 2 as NeighborCount,
            selector: {kind: TRIBES_SELECTOR_KIND, tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]}
          }
        ]
      },
      become: {
        kind: FIXED_BECOME_KIND,
        tribe: WILDFIRE_BLAZE_TRIBE
      }
    },
    {
      clause: {
        kind: AND_CLAUSE_KIND,
        clauses: [
          {
            kind: IS_CLAUSE_KIND,
            tribes: [vegetationTribe]
          },
          {
            kind: MIN_CLAUSE_KIND,
            value: fireResistance + 1 as NeighborCount,
            selector: {kind: TRIBES_SELECTOR_KIND, tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]}
          }
        ]
      },
      become: {
        kind: FIXED_BECOME_KIND,
        tribe: WILDFIRE_FIRE_TRIBE
      }
    },
    {
      clause: {
        kind: AND_CLAUSE_KIND,
        clauses: [
          {
            kind: IS_CLAUSE_KIND,
            tribes: [vegetationTribe]
          },
          {
            kind: MIN_CLAUSE_KIND,
            value: fireResistance,
            selector: {kind: TRIBES_SELECTOR_KIND, tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]}
          }
        ]
      },
      become: {
        kind: FIXED_BECOME_KIND,
        tribe: WILDFIRE_EMBER_TRIBE
      }
    }
  ];
}

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
        id: WILDFIRE_CHAR_TRIBE,
        color: '241000'
      },
      {
        id: WILDFIRE_ROCK_TRIBE,
        color: '8a8f98'
      }
    ],
    rules: [
      directRule(WILDFIRE_BLAZE_TRIBE, WILDFIRE_FIRE_TRIBE),
      directRule(WILDFIRE_FIRE_TRIBE, WILDFIRE_EMBER_TRIBE),
      directRule(WILDFIRE_EMBER_TRIBE, WILDFIRE_CHAR_TRIBE),
      ...burnRules(WILDFIRE_LIGHT_VEGETATION_TRIBE, 1),
      ...burnRules(WILDFIRE_MEDIUM_VEGETATION_TRIBE, 2),
      ...burnRules(WILDFIRE_DARK_VEGETATION_TRIBE, 3),
      staticRule(WILDFIRE_LIGHT_VEGETATION_TRIBE, WILDFIRE_MEDIUM_VEGETATION_TRIBE, WILDFIRE_DARK_VEGETATION_TRIBE, WILDFIRE_CHAR_TRIBE, WILDFIRE_ROCK_TRIBE),
      {
        muted: true,
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID, WILDFIRE_CHAR_TRIBE]
            },
            {
              kind: NONE_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]
              }
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [WILDFIRE_LIGHT_VEGETATION_TRIBE, WILDFIRE_MEDIUM_VEGETATION_TRIBE, WILDFIRE_DARK_VEGETATION_TRIBE]
              },
              value: 5
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
