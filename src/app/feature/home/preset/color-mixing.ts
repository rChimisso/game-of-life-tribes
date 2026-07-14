import {Preset} from '.';
import {AND_CLAUSE_KIND, CombinationEntry, COMBINE_BECOME_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, IS_CLAUSE_KIND, MIN_CLAUSE_KIND, SAME_BECOME_KIND, Tribe, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Red primary color tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_RED_TRIBE = 'Red';

/**
 * Green primary color tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_GREEN_TRIBE = 'Green';

/**
 * Blue primary color tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_BLUE_TRIBE = 'Blue';

/**
 * Red-green mixed color tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_YELLOW_TRIBE = 'Yellow';

/**
 * Red-blue mixed color tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_MAGENTA_TRIBE = 'Magenta';

/**
 * Green-blue mixed color tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_CYAN_TRIBE = 'Cyan';

/**
 * Neutral and three-primary mixed color tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_WHITE_TRIBE = 'White';

/**
 * Colors participating in combinations.
 * 
 * @type {[string, ...string[]]}
 */
const COLOR_MIXING_TRIBES: [string, ...string[]] = [
  COLOR_MIXING_RED_TRIBE,
  COLOR_MIXING_GREEN_TRIBE,
  COLOR_MIXING_BLUE_TRIBE,
  COLOR_MIXING_YELLOW_TRIBE,
  COLOR_MIXING_MAGENTA_TRIBE,
  COLOR_MIXING_CYAN_TRIBE,
  COLOR_MIXING_WHITE_TRIBE
];

/**
 * Bit representing the red pigment component.
 *
 * @type {number}
 */
const RED_COMPONENT = 0b001;

/**
 * Bit representing the green pigment component.
 *
 * @type {number}
 */
const GREEN_COMPONENT = 0b010;

/**
 * Bit representing the blue pigment component.
 *
 * @type {number}
 */
const BLUE_COMPONENT = 0b100;

/**
 * Pigment components carried by each color.
 *
 * White is neutral when used as an input and therefore contributes no additional pigment component.
 *
 * @type {Readonly<Record<string, number>>}
 */
const COLOR_COMPONENTS: Readonly<Record<string, number>> = {
  [COLOR_MIXING_RED_TRIBE]: RED_COMPONENT,
  [COLOR_MIXING_GREEN_TRIBE]: GREEN_COMPONENT,
  [COLOR_MIXING_BLUE_TRIBE]: BLUE_COMPONENT,
  [COLOR_MIXING_YELLOW_TRIBE]: RED_COMPONENT | GREEN_COMPONENT,
  [COLOR_MIXING_MAGENTA_TRIBE]: RED_COMPONENT | BLUE_COMPONENT,
  [COLOR_MIXING_CYAN_TRIBE]: GREEN_COMPONENT | BLUE_COMPONENT,
  [COLOR_MIXING_WHITE_TRIBE]: 0
};

/**
 * List of secondary colors.
 *
 * @type {string[]}
 */
const SECONDARY_COLOR_MIXING_TRIBES = [COLOR_MIXING_YELLOW_TRIBE, COLOR_MIXING_MAGENTA_TRIBE, COLOR_MIXING_CYAN_TRIBE];

/**
 * Resolves the color produced by a set of pigment components.
 *
 * 1 component produces its corresponding primary color.  
 * 2 components produce their secondary color.  
 * 3 components produce white.
 *
 * @param {number} components combined pigment-component mask.
 * @returns {string} resulting color.
 */
function outputForComponents(components: number): string {
  switch (components) {
    case RED_COMPONENT:
      return COLOR_MIXING_RED_TRIBE;

    case GREEN_COMPONENT:
      return COLOR_MIXING_GREEN_TRIBE;

    case BLUE_COMPONENT:
      return COLOR_MIXING_BLUE_TRIBE;

    case RED_COMPONENT | GREEN_COMPONENT:
      return COLOR_MIXING_YELLOW_TRIBE;

    case RED_COMPONENT | BLUE_COMPONENT:
      return COLOR_MIXING_MAGENTA_TRIBE;

    case GREEN_COMPONENT | BLUE_COMPONENT:
      return COLOR_MIXING_CYAN_TRIBE;

    case RED_COMPONENT | GREEN_COMPONENT | BLUE_COMPONENT:
      return COLOR_MIXING_WHITE_TRIBE;

    default:
      throw new Error(`Unsupported color-component mask: ${components}.`);
  }
}

/**
 * Produces every unordered combination of the requested size extending the current partial combination.
 *
 * @template T
 * @param {T[]} values source values.
 * @param {number} size target combination size.
 * @param {number} start first source index available for selection.
 * @param {T[]} current combination currently being constructed.
 * @returns {T[][]} completed combinations.
 */
function collectCombinations<T>(values: T[], size: number, start: number = 0, current: T[] = []): T[][] {
  if (current.length === size) {
    return [[...current]];
  }
  const combinations: T[][] = [];
  for (let index = start; index <= values.length - (size - current.length); index++) {
    combinations.push(...collectCombinations(values, size, index + 1, [...current, values[index]!]));
  }
  return combinations;
}

/**
 * Produces every unordered, duplicate-free combination containing at least 2 colors.
 *
 * @returns {string[][]} all supported input combinations.
 */
function buildColorCombinations(): string[][] {
  const combinations: string[][] = [];
  for (let size = 2; size <= COLOR_MIXING_TRIBES.length; size++) {
    combinations.push(...collectCombinations(COLOR_MIXING_TRIBES, size));
  }
  return combinations;
}

/**
 * Resolves the output of one color combination.
 *
 * @param {string[]} colors colors being combined.
 * @returns {string} resulting color.
 */
function mixColors(colors: string[]): string {
  if (colors.includes(COLOR_MIXING_WHITE_TRIBE) && colors.some(color => SECONDARY_COLOR_MIXING_TRIBES.includes(color))) {
    return COLOR_MIXING_WHITE_TRIBE;
  }
  return outputForComponents(colors.reduce((mask, color) => mask | COLOR_COMPONENTS[color]!, 0));
}

/**
 * Complete lookup table for all 120 unordered combinations.
 *
 * @type {CombinationEntry<Tribe[]>[]}
 */
const COLOR_MIXING_ENTRIES = buildColorCombinations().map(colors => ({inputs: colors.map(color => ({kind: TRIBES_SELECTOR_KIND, tribes: [color]})), output: mixColors(colors)})) as CombinationEntry<Tribe[]>[];

/**
 * Color Mixing preset.
 *
 * @type {Preset}
 */
export const COLOR_MIXING_PRESET: Preset = {
  name: 'Color Mixing',
  description: 'Colors combine additively',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: COLOR_MIXING_RED_TRIBE,
        color: 'ff0000'
      },
      {
        id: COLOR_MIXING_GREEN_TRIBE,
        color: '00ff00'
      },
      {
        id: COLOR_MIXING_BLUE_TRIBE,
        color: '0000ff'
      },
      {
        id: COLOR_MIXING_YELLOW_TRIBE,
        color: 'ffff00'
      },
      {
        id: COLOR_MIXING_MAGENTA_TRIBE,
        color: 'ff00ff'
      },
      {
        id: COLOR_MIXING_CYAN_TRIBE,
        color: '00ffff'
      },
      {
        id: COLOR_MIXING_WHITE_TRIBE,
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
              tribes: [...COLOR_MIXING_TRIBES]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [...COLOR_MIXING_TRIBES]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: COMBINE_BECOME_KIND,
          entries: COLOR_MIXING_ENTRIES,
          default: {
            kind: SAME_BECOME_KIND
          }
        }
      },
      {
        clause: {
          kind: 'not',
          clause: {
            kind: 'is',
            tribes: [DEAD_TRIBE_ID]
          }
        },
        become: {
          kind: 'same'
        }
      }
    ]
  }
};
