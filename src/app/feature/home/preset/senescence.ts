import {Preset} from '.';
import {AND_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, OR_CLAUSE_KIND} from '../model/rule';

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
 * @type {Preset}
 */
export const SENESCENCE_PRESET: Preset = {
  name: 'Senescence',
  description: 'Life where cells age',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {id: SENESCENCE_SPARK_TRIBE, color: 'd1faff'},
      {id: SENESCENCE_GLOW_TRIBE, color: '94f2ff'},
      {id: SENESCENCE_AFTERGLOW_TRIBE, color: '3fdfff'},
      {id: SENESCENCE_TRAIL_TRIBE, color: '00b8d9'},
      {id: SENESCENCE_ECHO_TRIBE, color: '008ca6'},
      {id: SENESCENCE_DIM_TRIBE, color: '006273'},
      {id: SENESCENCE_ASH_TRIBE, color: '4f5f63'},
      {id: SENESCENCE_REMNANT_TRIBE, color: '1c292c'}
    ],
    rules: [
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {kind: IS_CLAUSE_KIND, tribes: [DEAD_TRIBE_ID]},
            {
              kind: COUNT_CLAUSE_KIND, selector: {kind: 'tribes', tribes: [SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE]}, interval: [3, 3]
            }
          ]
        },
        tribe: SENESCENCE_GLOW_TRIBE
      },
      {
        clause: {kind: AND_CLAUSE_KIND,
          clauses: [
            {kind: IS_CLAUSE_KIND, tribes: [DEAD_TRIBE_ID]},
            {
              kind: COUNT_CLAUSE_KIND, selector: {kind: 'tribes', tribes: [SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE]}, interval: [5, 5]
            }
          ]},
        tribe: SENESCENCE_GLOW_TRIBE
      },
      {
        clause: {kind: AND_CLAUSE_KIND,
          clauses: [
            {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE]},
            {
              kind: COUNT_CLAUSE_KIND, selector: {kind: 'tribes', tribes: [SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE]}, interval: [2, 5]
            },
            {
              kind: MAX_CLAUSE_KIND, value: 5, selector: {kind: 'tribes', tribes: [SENESCENCE_ASH_TRIBE]}
            },
            {
              kind: MAX_CLAUSE_KIND, value: 5, selector: {kind: 'tribes', tribes: [SENESCENCE_REMNANT_TRIBE]}
            },
            {
              kind: MAX_CLAUSE_KIND,
              value: 6,
              selector: {
                kind: 'tribes',
                tribes: [
                  SENESCENCE_SPARK_TRIBE,
                  SENESCENCE_GLOW_TRIBE,
                  SENESCENCE_AFTERGLOW_TRIBE,
                  SENESCENCE_TRAIL_TRIBE,
                  SENESCENCE_ECHO_TRIBE,
                  SENESCENCE_DIM_TRIBE,
                  SENESCENCE_ASH_TRIBE,
                  SENESCENCE_REMNANT_TRIBE
                ]
              }
            }
          ]},
        become: {
          kind: 'majority',
          selector: {kind: 'tribes', tribes: [SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE]},
          tie: {
            kind: 'combine',
            strategy: {
              kind: 'lookup',
              entries: [
                {
                  inputs: [{kind: 'tribes', tribes: [SENESCENCE_AFTERGLOW_TRIBE]}, {kind: 'tribes', tribes: [SENESCENCE_GLOW_TRIBE]}],
                  output: SENESCENCE_TRAIL_TRIBE
                },
                {
                  inputs: [{kind: 'tribes', tribes: [SENESCENCE_GLOW_TRIBE]}, {kind: 'tribes', tribes: [SENESCENCE_TRAIL_TRIBE]}],
                  output: SENESCENCE_ECHO_TRIBE
                },
                {
                  inputs: [{kind: 'tribes', tribes: [SENESCENCE_AFTERGLOW_TRIBE]}, {kind: 'tribes', tribes: [SENESCENCE_TRAIL_TRIBE]}],
                  output: SENESCENCE_DIM_TRIBE
                }
              ],
              default: {kind: 'fixed', tribe: SENESCENCE_TRAIL_TRIBE}
            }
          },
          fallback: {kind: 'fixed', tribe: SENESCENCE_TRAIL_TRIBE}
        }
      },
      {
        clause: {kind: AND_CLAUSE_KIND,
          clauses: [
            {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE]},
            {
              kind: MIN_CLAUSE_KIND,
              value: 4,
              selector: {kind: 'tribes',
                tribes: [
                  SENESCENCE_GLOW_TRIBE,
                  SENESCENCE_AFTERGLOW_TRIBE,
                  SENESCENCE_TRAIL_TRIBE,
                  SENESCENCE_ECHO_TRIBE,
                  SENESCENCE_DIM_TRIBE,
                  SENESCENCE_ASH_TRIBE,
                  SENESCENCE_REMNANT_TRIBE
                ]}
            }
          ]},
        tribe: SENESCENCE_ASH_TRIBE
      },
      {
        clause: {kind: AND_CLAUSE_KIND,
          clauses: [
            {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_ECHO_TRIBE, SENESCENCE_DIM_TRIBE]},
            {
              kind: MIN_CLAUSE_KIND,
              value: 3,
              selector: {kind: 'tribes',
                tribes: [
                  SENESCENCE_SPARK_TRIBE,
                  SENESCENCE_GLOW_TRIBE,
                  SENESCENCE_AFTERGLOW_TRIBE,
                  SENESCENCE_TRAIL_TRIBE,
                  SENESCENCE_ECHO_TRIBE,
                  SENESCENCE_DIM_TRIBE,
                  SENESCENCE_ASH_TRIBE,
                  SENESCENCE_REMNANT_TRIBE
                ]}
            }
          ]},
        tribe: SENESCENCE_ASH_TRIBE
      },
      {
        clause: {kind: AND_CLAUSE_KIND,
          clauses: [
            {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_ASH_TRIBE]},
            {
              kind: MIN_CLAUSE_KIND,
              value: 5,
              selector: {kind: 'tribes',
                tribes: [
                  SENESCENCE_DIM_TRIBE,
                  SENESCENCE_ECHO_TRIBE,
                  SENESCENCE_TRAIL_TRIBE,
                  SENESCENCE_AFTERGLOW_TRIBE,
                  SENESCENCE_GLOW_TRIBE,
                  SENESCENCE_ASH_TRIBE,
                  SENESCENCE_REMNANT_TRIBE
                ]}
            }
          ]},
        tribe: SENESCENCE_REMNANT_TRIBE
      },
      {
        clause: {kind: AND_CLAUSE_KIND,
          clauses: [
            {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_ASH_TRIBE]},
            {kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: MIN_CLAUSE_KIND, value: 1, selector: {kind: 'tribes', tribes: [SENESCENCE_SPARK_TRIBE]}
                },
                {
                  kind: MIN_CLAUSE_KIND, value: 5, selector: {kind: 'tribes', tribes: [SENESCENCE_ASH_TRIBE, SENESCENCE_REMNANT_TRIBE]}
                }
              ]},
            {
              kind: MIN_CLAUSE_KIND, value: 2, selector: {kind: 'tribes', tribes: [DEAD_TRIBE_ID, SENESCENCE_ASH_TRIBE, SENESCENCE_REMNANT_TRIBE]}
            }
          ]},
        tribe: SENESCENCE_SPARK_TRIBE
      },
      {
        clause: {kind: AND_CLAUSE_KIND,
          clauses: [
            {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_REMNANT_TRIBE]},
            {
              kind: MIN_CLAUSE_KIND,
              value: 6,
              selector: {kind: 'tribes',
                tribes: [
                  SENESCENCE_GLOW_TRIBE,
                  SENESCENCE_AFTERGLOW_TRIBE,
                  SENESCENCE_TRAIL_TRIBE,
                  SENESCENCE_ECHO_TRIBE,
                  SENESCENCE_DIM_TRIBE,
                  SENESCENCE_ASH_TRIBE,
                  SENESCENCE_REMNANT_TRIBE
                ]}
            }
          ]},
        tribe: DEAD_TRIBE_ID
      },
      {
        clause: {kind: AND_CLAUSE_KIND,
          clauses: [
            {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_REMNANT_TRIBE]},
            {kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: MIN_CLAUSE_KIND, value: 1, selector: {kind: 'tribes', tribes: [SENESCENCE_SPARK_TRIBE]}
                },
                {
                  kind: MIN_CLAUSE_KIND, value: 5, selector: {kind: 'tribes', tribes: [SENESCENCE_ASH_TRIBE, SENESCENCE_REMNANT_TRIBE]}
                }
              ]},
            {
              kind: MIN_CLAUSE_KIND, value: 4, selector: {kind: 'tribes', tribes: [DEAD_TRIBE_ID]}
            }
          ]},
        tribe: SENESCENCE_SPARK_TRIBE
      },
      {
        clause: {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_SPARK_TRIBE]}, tribe: SENESCENCE_GLOW_TRIBE
      },
      {
        clause: {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_GLOW_TRIBE]}, tribe: SENESCENCE_AFTERGLOW_TRIBE
      },
      {
        clause: {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_AFTERGLOW_TRIBE]}, tribe: SENESCENCE_TRAIL_TRIBE
      },
      {
        clause: {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_TRAIL_TRIBE]}, tribe: SENESCENCE_ECHO_TRIBE
      },
      {
        clause: {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_ECHO_TRIBE]}, tribe: SENESCENCE_DIM_TRIBE
      },
      {
        clause: {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_ASH_TRIBE]}, tribe: SENESCENCE_ASH_TRIBE
      },
      {
        clause: {kind: IS_CLAUSE_KIND, tribes: [SENESCENCE_REMNANT_TRIBE]}, tribe: SENESCENCE_REMNANT_TRIBE
      }
    ]
  }
};
