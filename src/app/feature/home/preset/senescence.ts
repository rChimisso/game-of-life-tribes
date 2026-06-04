import {Preset} from '.';
import {DEAD_TRIBE, AND_CLAUSE_KIND, IS_CLAUSE_KIND, DEAD_TRIBE_ID, EXACTLY_CLAUSE_KIND, COUNT_CLAUSE_KIND, NONE_CLAUSE_KIND} from '../model/rule';

/**
 * Newborn living cell tribe ID for the Senescence preset.
 *
 * @type {string}
 */
const SENESCENCE_SPARK_TRIBE = 'Spark';

/**
 * Young living cell tribe ID for the Senescence preset.
 *
 * @type {string}
 */
const SENESCENCE_GLOW_TRIBE = 'Glow';

/**
 * Adult living cell tribe ID for the Senescence preset.
 *
 * @type {string}
 */
const SENESCENCE_AFTERGLOW_TRIBE = 'Afterglow';

/**
 * Mature living cell tribe ID for the Senescence preset.
 *
 * @type {string}
 */
const SENESCENCE_TRAIL_TRIBE = 'Trail';

/**
 * Elder living cell tribe ID for the Senescence preset.
 *
 * @type {string}
 */
const SENESCENCE_ECHO_TRIBE = 'Echo';

/**
 * Fragile elder cell tribe ID for the Senescence preset.
 *
 * @type {string}
 */
const SENESCENCE_DIM_TRIBE = 'Dim';

/**
 * Recently dead cell tribe ID for the Senescence preset.
 *
 * @type {string}
 */
const SENESCENCE_ASH_TRIBE = 'Ash';

/**
 * Final fading corpse tribe ID for the Senescence preset.
 *
 * @type {string}
 */
const SENESCENCE_REMNANT_TRIBE = 'Remnant';

/**
 * Senescence preset.
 *
 * Aging affects fertility, survival, and decay:
 * - Young/adult cells are productive neighbors.
 * - Elder cells can survive, but they suppress clean births.
 * - Ash can catalyze regrowth with fewer living neighbors.
 * - Failed survival causes accelerated aging or death.
 *
 * @type {Preset}
 */
export const SENESCENCE_PRESET: Preset = {
  name: 'Senescence',
  description: 'Life where cells age',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: SENESCENCE_SPARK_TRIBE,
        color: 'e9fbff'
      },
      {
        id: SENESCENCE_GLOW_TRIBE,
        color: '94f2ff'
      },
      {
        id: SENESCENCE_AFTERGLOW_TRIBE,
        color: '3fdfff'
      },
      {
        id: SENESCENCE_TRAIL_TRIBE,
        color: '00b8d9'
      },
      {
        id: SENESCENCE_ECHO_TRIBE,
        color: '008ca6'
      },
      {
        id: SENESCENCE_DIM_TRIBE,
        color: '006273'
      },
      {
        id: SENESCENCE_ASH_TRIBE,
        color: '4f5f63'
      },
      {
        id: SENESCENCE_REMNANT_TRIBE,
        color: '1c292c'
      }
    ],
    rules: [
      /*
       * Clean birth:
       * Classic B3, but only productive cells count.
       * Elders and nearby ash make birth harder.
       */
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID, SENESCENCE_REMNANT_TRIBE]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              value: 3,
              tribes: [
                SENESCENCE_SPARK_TRIBE,
                SENESCENCE_GLOW_TRIBE,
                SENESCENCE_AFTERGLOW_TRIBE,
                SENESCENCE_TRAIL_TRIBE
              ]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [0, 1],
              tribes: [SENESCENCE_ECHO_TRIBE, SENESCENCE_DIM_TRIBE]
            },
            {
              kind: NONE_CLAUSE_KIND,
              tribes: [SENESCENCE_ASH_TRIBE]
            }
          ]
        },
        tribe: SENESCENCE_SPARK_TRIBE
      },

      /*
       * Compost birth:
       * Ash allows regrowth with only 2 productive neighbors.
       * This makes dead trails occasionally matter instead of just fading away.
       */
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID, SENESCENCE_ASH_TRIBE, SENESCENCE_REMNANT_TRIBE]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              value: 2,
              tribes: [
                SENESCENCE_SPARK_TRIBE,
                SENESCENCE_GLOW_TRIBE,
                SENESCENCE_AFTERGLOW_TRIBE,
                SENESCENCE_TRAIL_TRIBE
              ]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              value: 1,
              tribes: [SENESCENCE_ASH_TRIBE]
            }
          ]
        },
        tribe: SENESCENCE_SPARK_TRIBE
      },

      /*
       * Newborns are fragile:
       * A spark needs exactly 3 productive neighbors to mature.
       */
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SENESCENCE_SPARK_TRIBE]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              value: 3,
              tribes: [
                SENESCENCE_SPARK_TRIBE,
                SENESCENCE_GLOW_TRIBE,
                SENESCENCE_AFTERGLOW_TRIBE,
                SENESCENCE_TRAIL_TRIBE
              ]
            }
          ]
        },
        tribe: SENESCENCE_GLOW_TRIBE
      },

      /*
       * Young/adult survival:
       * Stable Life-like survival, but surviving still advances age.
       */
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SENESCENCE_GLOW_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [2, 3],
              tribes: [
                SENESCENCE_SPARK_TRIBE,
                SENESCENCE_GLOW_TRIBE,
                SENESCENCE_AFTERGLOW_TRIBE,
                SENESCENCE_TRAIL_TRIBE
              ]
            }
          ]
        },
        tribe: SENESCENCE_AFTERGLOW_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SENESCENCE_AFTERGLOW_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [2, 3],
              tribes: [
                SENESCENCE_SPARK_TRIBE,
                SENESCENCE_GLOW_TRIBE,
                SENESCENCE_AFTERGLOW_TRIBE,
                SENESCENCE_TRAIL_TRIBE
              ]
            }
          ]
        },
        tribe: SENESCENCE_TRAIL_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SENESCENCE_TRAIL_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [2, 3],
              tribes: [
                SENESCENCE_SPARK_TRIBE,
                SENESCENCE_GLOW_TRIBE,
                SENESCENCE_AFTERGLOW_TRIBE,
                SENESCENCE_TRAIL_TRIBE
              ]
            }
          ]
        },
        tribe: SENESCENCE_ECHO_TRIBE
      },

      /*
       * Elder survival:
       * Old cells are brittle. They only continue with exactly 2 productive neighbors.
       */
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SENESCENCE_ECHO_TRIBE]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              value: 2,
              tribes: [
                SENESCENCE_SPARK_TRIBE,
                SENESCENCE_GLOW_TRIBE,
                SENESCENCE_AFTERGLOW_TRIBE,
                SENESCENCE_TRAIL_TRIBE
              ]
            }
          ]
        },
        tribe: SENESCENCE_DIM_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SENESCENCE_DIM_TRIBE]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              value: 2,
              tribes: [
                SENESCENCE_SPARK_TRIBE,
                SENESCENCE_GLOW_TRIBE,
                SENESCENCE_AFTERGLOW_TRIBE,
                SENESCENCE_TRAIL_TRIBE
              ]
            }
          ]
        },
        tribe: SENESCENCE_REMNANT_TRIBE
      },

      /*
       * Failed survival fallbacks.
       * These must come after the specific survival rules.
       */
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [SENESCENCE_SPARK_TRIBE]
        },
        tribe: SENESCENCE_ASH_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [SENESCENCE_GLOW_TRIBE]
        },
        tribe: SENESCENCE_DIM_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [SENESCENCE_AFTERGLOW_TRIBE]
        },
        tribe: SENESCENCE_ASH_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [SENESCENCE_TRAIL_TRIBE]
        },
        tribe: SENESCENCE_REMNANT_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [SENESCENCE_ECHO_TRIBE]
        },
        tribe: SENESCENCE_REMNANT_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [SENESCENCE_DIM_TRIBE]
        },
        tribe: DEAD_TRIBE_ID
      },

      /*
       * Corpse decay.
       */
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [SENESCENCE_ASH_TRIBE]
        },
        tribe: SENESCENCE_REMNANT_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [SENESCENCE_REMNANT_TRIBE]
        },
        tribe: DEAD_TRIBE_ID
      }
    ]
  }
};
