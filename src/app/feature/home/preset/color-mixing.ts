import {Preset} from '.';
import {COMBINE_BECOME_KIND,
  DEAD_TRIBE,
  DEAD_TRIBE_ID,
  IS_CLAUSE_KIND,
  LOOKUP_STRATEGY_KIND,
  MAJORITY_BECOME_KIND,
  SAME_BECOME_KIND,
  TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Red primary pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_RED_TRIBE = 'Red';

/**
 * Yellow primary pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_YELLOW_TRIBE = 'Yellow';

/**
 * Blue primary pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_BLUE_TRIBE = 'Blue';

/**
 * Red-yellow mixed pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_ORANGE_TRIBE = 'Orange';

/**
 * Yellow-blue mixed pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_GREEN_TRIBE = 'Green';

/**
 * Blue-red mixed pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_VIOLET_TRIBE = 'Violet';

/**
 * Three-primary mixed pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_BROWN_TRIBE = 'Brown';

/**
 * Color Mixing preset.
 *
 * @type {Preset}
 */
export const COLOR_MIXING_PRESET: Preset = {
  name: 'Color Mixing',
  description: 'Dominant pigments spread while balanced colors blend',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: COLOR_MIXING_RED_TRIBE,
        color: 'ff3b30'
      },
      {
        id: COLOR_MIXING_YELLOW_TRIBE,
        color: 'ffcc00'
      },
      {
        id: COLOR_MIXING_BLUE_TRIBE,
        color: '007aff'
      },
      {
        id: COLOR_MIXING_ORANGE_TRIBE,
        color: 'ff9500'
      },
      {
        id: COLOR_MIXING_GREEN_TRIBE,
        color: '34c759'
      },
      {
        id: COLOR_MIXING_VIOLET_TRIBE,
        color: 'af52de'
      },
      {
        id: COLOR_MIXING_BROWN_TRIBE,
        color: '8b5a2b'
      }
    ],
    rules: [
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [
            DEAD_TRIBE_ID,
            COLOR_MIXING_RED_TRIBE,
            COLOR_MIXING_YELLOW_TRIBE,
            COLOR_MIXING_BLUE_TRIBE,
            COLOR_MIXING_ORANGE_TRIBE,
            COLOR_MIXING_GREEN_TRIBE,
            COLOR_MIXING_VIOLET_TRIBE,
            COLOR_MIXING_BROWN_TRIBE
          ]
        },
        become: {
          kind: MAJORITY_BECOME_KIND,
          selector: {
            kind: TRIBES_SELECTOR_KIND,
            tribes: [COLOR_MIXING_RED_TRIBE, COLOR_MIXING_YELLOW_TRIBE, COLOR_MIXING_BLUE_TRIBE]
          },
          tie: {
            kind: COMBINE_BECOME_KIND,
            strategy: {
              kind: LOOKUP_STRATEGY_KIND,
              entries: [
                {
                  inputs: [
                    {
                      kind: TRIBES_SELECTOR_KIND,
                      tribes: [COLOR_MIXING_RED_TRIBE]
                    },
                    {
                      kind: TRIBES_SELECTOR_KIND,
                      tribes: [COLOR_MIXING_YELLOW_TRIBE]
                    }
                  ],
                  output: COLOR_MIXING_ORANGE_TRIBE
                },
                {
                  inputs: [
                    {
                      kind: TRIBES_SELECTOR_KIND,
                      tribes: [COLOR_MIXING_YELLOW_TRIBE]
                    },
                    {
                      kind: TRIBES_SELECTOR_KIND,
                      tribes: [COLOR_MIXING_BLUE_TRIBE]
                    }
                  ],
                  output: COLOR_MIXING_GREEN_TRIBE
                },
                {
                  inputs: [
                    {
                      kind: TRIBES_SELECTOR_KIND,
                      tribes: [COLOR_MIXING_BLUE_TRIBE]
                    },
                    {
                      kind: TRIBES_SELECTOR_KIND,
                      tribes: [COLOR_MIXING_RED_TRIBE]
                    }
                  ],
                  output: COLOR_MIXING_VIOLET_TRIBE
                },
                {
                  inputs: [
                    {
                      kind: TRIBES_SELECTOR_KIND,
                      tribes: [COLOR_MIXING_RED_TRIBE]
                    },
                    {
                      kind: TRIBES_SELECTOR_KIND,
                      tribes: [COLOR_MIXING_YELLOW_TRIBE]
                    },
                    {
                      kind: TRIBES_SELECTOR_KIND,
                      tribes: [COLOR_MIXING_BLUE_TRIBE]
                    }
                  ],
                  output: COLOR_MIXING_BROWN_TRIBE
                }
              ],
              default: {
                kind: SAME_BECOME_KIND
              }
            }
          },
          fallback: {
            kind: SAME_BECOME_KIND
          }
        }
      }
    ]
  }
};
