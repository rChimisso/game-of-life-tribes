import {directRule, Preset} from '.';
import {AND_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, TRIBES_SELECTOR_KIND, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MAJORITY_BECOME_KIND, MIN_CLAUSE_KIND, NeighborCount, NONE_CLAUSE_KIND, Rule, SAME_BECOME_KIND, Tribe} from '../model/rule';

/**
 * Light vegetation tribe ID.
 *
 * @type {string}
 */
const WILDFIRE_LIGHT_VEGETATION_TRIBE = 'Light Green';

/**
 * Medium vegetation tribe ID.
 *
 * @type {string}
 */
const WILDFIRE_MEDIUM_VEGETATION_TRIBE = 'Green';

/**
 * Dense vegetation tribe ID.
 *
 * @type {string}
 */
const WILDFIRE_DARK_VEGETATION_TRIBE = 'Dark Green';

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
const WILDFIRE_ASH_TRIBE = 'Ash';

/**
 * Rock tribe ID.
 *
 * @type {string}
 */
const WILDFIRE_ROCK_TRIBE = 'Rock';

/**
 * Adds a small offset to a neighbor count.
 *
 * @param {NeighborCount} count base count.
 * @param {1 | 2} offset offset to add.
 * @returns {NeighborCount} resulting neighbor count.
 */
function offsetNeighborCount(count: NeighborCount, offset: 1 | 2): NeighborCount {
  const next = count + offset;
  let result: NeighborCount;
  switch (next) {
    case 0:
      result = 0;
      break;
    case 1:
      result = 1;
      break;
    case 2:
      result = 2;
      break;
    case 3:
      result = 3;
      break;
    case 4:
      result = 4;
      break;
    case 5:
      result = 5;
      break;
    case 6:
      result = 6;
      break;
    case 7:
      result = 7;
      break;
    case 8:
      result = 8;
      break;
    default:
      throw new Error(`Invalid neighbor count ${next}`);
  }
  return result;
}

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
            value: offsetNeighborCount(fireResistance, 2),
            selector: {kind: TRIBES_SELECTOR_KIND, tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]}
          }
        ]
      },
      tribe: WILDFIRE_BLAZE_TRIBE
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
            value: offsetNeighborCount(fireResistance, 1),
            selector: {kind: TRIBES_SELECTOR_KIND, tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]}
          }
        ]
      },
      tribe: WILDFIRE_FIRE_TRIBE
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
      tribe: WILDFIRE_EMBER_TRIBE
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
