import {directRule, Preset} from '.';
import {DEAD_TRIBE, AND_CLAUSE_KIND, IS_CLAUSE_KIND, DEAD_TRIBE_ID, EXACTLY_CLAUSE_KIND, COUNT_CLAUSE_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Fresh living tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_SPARK_TRIBE = 'Spark';

/**
 * First fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_FLASH_TRIBE = 'Flash';

/**
 * Second fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_GLOW_TRIBE = 'Glow';

/**
 * Third fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_GLIMMER_TRIBE = 'Glimmer';

/**
 * Fourth fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_FLICKER_TRIBE = 'Flicker';

/**
 * Fifth fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_SHIMMER_TRIBE = 'Shimmer';

/**
 * Sixth fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_FADE_TRIBE = 'Fade';

/**
 * Seventh fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_WISP_TRIBE = 'Wisp';

/**
 * Eighth fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_TRACE_TRIBE = 'Trace';

/**
 * Oldest fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_REMNANT_TRIBE = 'Remnant';

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
      {
        id: AFTERIMAGE_SPARK_TRIBE,
        color: '00D9FF'
      },
      {
        id: AFTERIMAGE_GLOW_TRIBE,
        color: '00C3E6'
      },
      {
        id: AFTERIMAGE_FLASH_TRIBE,
        color: '00AECC'
      },
      {
        id: AFTERIMAGE_GLIMMER_TRIBE,
        color: '0098B3'
      },
      {
        id: AFTERIMAGE_FLICKER_TRIBE,
        color: '008299'
      },
      {
        id: AFTERIMAGE_SHIMMER_TRIBE,
        color: '006D80'
      },
      {
        id: AFTERIMAGE_FADE_TRIBE,
        color: '005766'
      },
      {
        id: AFTERIMAGE_WISP_TRIBE,
        color: '00414D'
      },
      {
        id: AFTERIMAGE_TRACE_TRIBE,
        color: '002C33'
      },
      {
        id: AFTERIMAGE_REMNANT_TRIBE,
        color: '00161A'
      }
    ],
    rules: [
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [
                DEAD_TRIBE_ID,
                AFTERIMAGE_GLOW_TRIBE,
                AFTERIMAGE_FLASH_TRIBE,
                AFTERIMAGE_GLIMMER_TRIBE,
                AFTERIMAGE_FLICKER_TRIBE,
                AFTERIMAGE_SHIMMER_TRIBE,
                AFTERIMAGE_FADE_TRIBE,
                AFTERIMAGE_WISP_TRIBE,
                AFTERIMAGE_TRACE_TRIBE
              ]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              value: 3,
              selector: {kind: TRIBES_SELECTOR_KIND, tribes: [AFTERIMAGE_SPARK_TRIBE]}
            }
          ]
        },
        tribe: AFTERIMAGE_SPARK_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [AFTERIMAGE_SPARK_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [2, 3],
              selector: {kind: TRIBES_SELECTOR_KIND, tribes: [AFTERIMAGE_SPARK_TRIBE]}
            }
          ]
        },
        tribe: AFTERIMAGE_SPARK_TRIBE
      },
      directRule(AFTERIMAGE_SPARK_TRIBE, AFTERIMAGE_GLOW_TRIBE),
      directRule(AFTERIMAGE_GLOW_TRIBE, AFTERIMAGE_FLASH_TRIBE),
      directRule(AFTERIMAGE_FLASH_TRIBE, AFTERIMAGE_GLIMMER_TRIBE),
      directRule(AFTERIMAGE_GLIMMER_TRIBE, AFTERIMAGE_FLICKER_TRIBE),
      directRule(AFTERIMAGE_FLICKER_TRIBE, AFTERIMAGE_SHIMMER_TRIBE),
      directRule(AFTERIMAGE_SHIMMER_TRIBE, AFTERIMAGE_FADE_TRIBE),
      directRule(AFTERIMAGE_FADE_TRIBE, AFTERIMAGE_WISP_TRIBE),
      directRule(AFTERIMAGE_WISP_TRIBE, AFTERIMAGE_TRACE_TRIBE),
      directRule(AFTERIMAGE_TRACE_TRIBE, AFTERIMAGE_REMNANT_TRIBE),
      directRule(AFTERIMAGE_REMNANT_TRIBE, DEAD_TRIBE_ID)
    ]
  }
};
