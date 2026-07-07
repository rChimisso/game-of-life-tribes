import {AND_CLAUSE_KIND, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MIN_CLAUSE_KIND, NeighborCount, Rule, TRIBES_SELECTOR_KIND, Tribe} from '../../model/rule';
import {WILDFIRE_BLAZE_TRIBE, WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE} from '../model/wildfire';

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
export function burnRules<T extends Tribe[]>(vegetationTribe: string, fireResistance: NeighborCount): Rule<T>[] {
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
            value: offsetNeighborCount(fireResistance, 1),
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
