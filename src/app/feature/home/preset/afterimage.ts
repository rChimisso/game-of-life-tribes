import {directRule, Preset} from '.';
import {DEAD_TRIBE, AND_CLAUSE_KIND, IS_CLAUSE_KIND, DEAD_TRIBE_ID, EXACTLY_CLAUSE_KIND, COUNT_CLAUSE_KIND, TRIBES_SELECTOR_KIND, FIXED_BECOME_KIND} from '../model/rule';

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
 * Ninth fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_REMNANT_TRIBE = 'Remnant';

/**
 * Tenth fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_VEIL_TRIBE = 'Veil';

/**
 * Eleventh fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_HAZE_TRIBE = 'Haze';

/**
 * Twelfth fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_DRIFT_TRIBE = 'Drift';

/**
 * Thirteenth fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_ECHO_TRIBE = 'Echo';

/**
 * Fourteenth fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_SHADOW_TRIBE = 'Shadow';

/**
 * Oldest fading tribe ID.
 *
 * @type {string}
 */
const AFTERIMAGE_HUSK_TRIBE = 'Husk';

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
        color: '7EF2FF'
      },
      {
        id: AFTERIMAGE_FLASH_TRIBE,
        color: '62E8FA'
      },
      {
        id: AFTERIMAGE_GLOW_TRIBE,
        color: '48DDF1'
      },
      {
        id: AFTERIMAGE_GLIMMER_TRIBE,
        color: '31D1E8'
      },
      {
        id: AFTERIMAGE_FLICKER_TRIBE,
        color: '22C3DC'
      },
      {
        id: AFTERIMAGE_SHIMMER_TRIBE,
        color: '18B4CE'
      },
      {
        id: AFTERIMAGE_FADE_TRIBE,
        color: '12A3BD'
      },
      {
        id: AFTERIMAGE_WISP_TRIBE,
        color: '0E91AA'
      },
      {
        id: AFTERIMAGE_TRACE_TRIBE,
        color: '0B7F96'
      },
      {
        id: AFTERIMAGE_REMNANT_TRIBE,
        color: '096C81'
      },
      {
        id: AFTERIMAGE_VEIL_TRIBE,
        color: '075B6D'
      },
      {
        id: AFTERIMAGE_HAZE_TRIBE,
        color: '064A59'
      },
      {
        id: AFTERIMAGE_DRIFT_TRIBE,
        color: '053A46'
      },
      {
        id: AFTERIMAGE_ECHO_TRIBE,
        color: '042C35'
      },
      {
        id: AFTERIMAGE_SHADOW_TRIBE,
        color: '031F26'
      },
      {
        id: AFTERIMAGE_HUSK_TRIBE,
        color: '02151A'
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
                AFTERIMAGE_TRACE_TRIBE,
                AFTERIMAGE_REMNANT_TRIBE,
                AFTERIMAGE_VEIL_TRIBE,
                AFTERIMAGE_HAZE_TRIBE,
                AFTERIMAGE_DRIFT_TRIBE,
                AFTERIMAGE_ECHO_TRIBE,
                AFTERIMAGE_SHADOW_TRIBE
              ]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [AFTERIMAGE_SPARK_TRIBE]
              },
              value: 3
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: AFTERIMAGE_SPARK_TRIBE
        }
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
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [AFTERIMAGE_SPARK_TRIBE]
              },
              interval: [2, 3]
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: AFTERIMAGE_SPARK_TRIBE
        }
      },
      directRule(AFTERIMAGE_SPARK_TRIBE, AFTERIMAGE_FLASH_TRIBE),
      directRule(AFTERIMAGE_FLASH_TRIBE, AFTERIMAGE_GLOW_TRIBE),
      directRule(AFTERIMAGE_GLOW_TRIBE, AFTERIMAGE_GLIMMER_TRIBE),
      directRule(AFTERIMAGE_GLIMMER_TRIBE, AFTERIMAGE_FLICKER_TRIBE),
      directRule(AFTERIMAGE_FLICKER_TRIBE, AFTERIMAGE_SHIMMER_TRIBE),
      directRule(AFTERIMAGE_SHIMMER_TRIBE, AFTERIMAGE_FADE_TRIBE),
      directRule(AFTERIMAGE_FADE_TRIBE, AFTERIMAGE_WISP_TRIBE),
      directRule(AFTERIMAGE_WISP_TRIBE, AFTERIMAGE_TRACE_TRIBE),
      directRule(AFTERIMAGE_TRACE_TRIBE, AFTERIMAGE_REMNANT_TRIBE),
      directRule(AFTERIMAGE_REMNANT_TRIBE, AFTERIMAGE_VEIL_TRIBE),
      directRule(AFTERIMAGE_VEIL_TRIBE, AFTERIMAGE_HAZE_TRIBE),
      directRule(AFTERIMAGE_HAZE_TRIBE, AFTERIMAGE_DRIFT_TRIBE),
      directRule(AFTERIMAGE_DRIFT_TRIBE, AFTERIMAGE_ECHO_TRIBE),
      directRule(AFTERIMAGE_ECHO_TRIBE, AFTERIMAGE_SHADOW_TRIBE),
      directRule(AFTERIMAGE_SHADOW_TRIBE, AFTERIMAGE_HUSK_TRIBE),
      directRule(AFTERIMAGE_HUSK_TRIBE, DEAD_TRIBE_ID)
    ]
  }
};
