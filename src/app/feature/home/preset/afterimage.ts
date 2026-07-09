import {directRule, Preset} from '.';
import {DEAD_TRIBE, AND_CLAUSE_KIND, IS_CLAUSE_KIND, DEAD_TRIBE_ID, EXACTLY_CLAUSE_KIND, COUNT_CLAUSE_KIND, TRIBES_SELECTOR_KIND, FIXED_BECOME_KIND, Tribe} from '../model/rule';

/**
 * Number of visible afterimage age tribes.
 *
 * @type {32}
 */
const AFTERIMAGE_AGE_COUNT = 32;

/**
 * Visible afterimage age tribe IDs from newest to oldest.
 *
 * @type {readonly string[]}
 */
const AFTERIMAGE_AGE_TRIBES = [
  'Age0',
  'Age1',
  'Age2',
  'Age3',
  'Age4',
  'Age5',
  'Age6',
  'Age7',
  'Age8',
  'Age9',
  'Age10',
  'Age11',
  'Age12',
  'Age13',
  'Age14',
  'Age15',
  'Age16',
  'Age17',
  'Age18',
  'Age19',
  'Age20',
  'Age21',
  'Age22',
  'Age23',
  'Age24',
  'Age25',
  'Age26',
  'Age27',
  'Age28',
  'Age29',
  'Age30',
  'Age31'
] as const;

/**
 * Fresh living afterimage tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_LIVE_TRIBE = AFTERIMAGE_AGE_TRIBES[0];

/**
 * Cell states that can be overwritten by a new live cell.
 *
 * @type {[string, ...string[]]}
 */
const AFTERIMAGE_REBIRTH_TRIBES = [DEAD_TRIBE_ID, ...AFTERIMAGE_AGE_TRIBES.slice(1)] as [string, ...string[]];

/**
 * Converts a color component into two uppercase hex digits.
 *
 * @param {number} component RGB component value.
 * @returns {string} Hexadecimal component text.
 */
function afterimageColorComponent(component: number): string {
  return component.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * Builds the cyan afterimage fade color for one age.
 *
 * @param {number} age Afterimage age index.
 * @returns {string} RGB hex color.
 */
function afterimageAgeColor(age: number): string {
  const fade = age / (AFTERIMAGE_AGE_COUNT - 1);
  return `${afterimageColorComponent(Math.round(126 * (1 - fade) + 2 * fade))}${afterimageColorComponent(Math.round(242 * (1 - fade) + 21 * fade))}${afterimageColorComponent(Math.round(255 * (1 - fade) + 26 * fade))}`;
}

/**
 * Afterimage preset.
 *
 * @type {Preset}
 */
export const AFTERIMAGE_PRESET: Preset = {
  name: 'Afterimage',
  description: 'Classic Life with fading cells',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      ...AFTERIMAGE_AGE_TRIBES.map((id, age): Tribe => ({
        id,
        color: afterimageAgeColor(age)
      }))
    ],
    rules: [
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: AFTERIMAGE_REBIRTH_TRIBES
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [AFTERIMAGE_LIVE_TRIBE]
              },
              value: 3
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: AFTERIMAGE_LIVE_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [AFTERIMAGE_LIVE_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [AFTERIMAGE_LIVE_TRIBE]
              },
              interval: [2, 3]
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: AFTERIMAGE_LIVE_TRIBE
        }
      },
      ...AFTERIMAGE_AGE_TRIBES.map((tribe, index) => directRule<Tribe[]>(tribe, AFTERIMAGE_AGE_TRIBES[index + 1] ?? DEAD_TRIBE_ID))
    ]
  }
};
