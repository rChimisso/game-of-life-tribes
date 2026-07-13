import {directRule, Preset, staticRule} from '.';
import {AND_CLAUSE_KIND, COMBINE_BECOME_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, TRIBES_SELECTOR_KIND, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MAJORITY_BECOME_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, OR_CLAUSE_KIND, EXACTLY_CLAUSE_KIND} from '../model/rule';

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
  description: 'Life where cells age and become nutrient',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: SENESCENCE_SPARK_TRIBE,
        color: 'd1faff'
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
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE]
                  },
                  value: 3
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE]
                  },
                  value: 5
                }
              ]
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: SENESCENCE_GLOW_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE]
              },
              interval: [2, 5]
            },
            {
              kind: MAX_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [SENESCENCE_ASH_TRIBE]
              },
              value: 5
            },
            {
              kind: MAX_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [SENESCENCE_REMNANT_TRIBE]
              },
              value: 5
            },
            {
              kind: MAX_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
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
              },
              value: 6
            }
          ]
        },
        become: {
          kind: MAJORITY_BECOME_KIND,
          selector: {
            kind: TRIBES_SELECTOR_KIND,
            tribes: [SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE]
          },
          tie: {
            kind: COMBINE_BECOME_KIND,
            entries: [
              {
                inputs: [
                  {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [SENESCENCE_AFTERGLOW_TRIBE]
                  },
                  {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [SENESCENCE_GLOW_TRIBE]
                  }
                ],
                output: SENESCENCE_TRAIL_TRIBE
              },
              {
                inputs: [
                  {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [SENESCENCE_GLOW_TRIBE]
                  },
                  {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [SENESCENCE_TRAIL_TRIBE]
                  }
                ],
                output: SENESCENCE_ECHO_TRIBE
              },
              {
                inputs: [
                  {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [SENESCENCE_AFTERGLOW_TRIBE]
                  },
                  {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [SENESCENCE_TRAIL_TRIBE]
                  }
                ],
                output: SENESCENCE_DIM_TRIBE
              }
            ],
            default: {
              kind: FIXED_BECOME_KIND,
              tribe: SENESCENCE_TRAIL_TRIBE
            }
          },
          fallback: {
            kind: FIXED_BECOME_KIND,
            tribe: SENESCENCE_TRAIL_TRIBE
          }
        }
      },
      {
        clause: {
          kind: OR_CLAUSE_KIND,
          clauses: [
            {
              kind: AND_CLAUSE_KIND,
              clauses: [
                {
                  kind: IS_CLAUSE_KIND,
                  tribes: [SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE]
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [
                      SENESCENCE_GLOW_TRIBE,
                      SENESCENCE_AFTERGLOW_TRIBE,
                      SENESCENCE_TRAIL_TRIBE,
                      SENESCENCE_ECHO_TRIBE,
                      SENESCENCE_DIM_TRIBE,
                      SENESCENCE_ASH_TRIBE,
                      SENESCENCE_REMNANT_TRIBE
                    ]
                  },
                  value: 4
                }
              ]
            },
            {
              kind: AND_CLAUSE_KIND,
              clauses: [
                {
                  kind: IS_CLAUSE_KIND,
                  tribes: [SENESCENCE_ECHO_TRIBE, SENESCENCE_DIM_TRIBE]
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
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
                  },
                  value: 3
                }
              ]
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: SENESCENCE_ASH_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SENESCENCE_ASH_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [
                  SENESCENCE_DIM_TRIBE,
                  SENESCENCE_ECHO_TRIBE,
                  SENESCENCE_TRAIL_TRIBE,
                  SENESCENCE_AFTERGLOW_TRIBE,
                  SENESCENCE_GLOW_TRIBE,
                  SENESCENCE_ASH_TRIBE,
                  SENESCENCE_REMNANT_TRIBE
                ]
              },
              value: 5
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: SENESCENCE_REMNANT_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SENESCENCE_ASH_TRIBE]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: MIN_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [SENESCENCE_SPARK_TRIBE]
                  },
                  value: 1
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [SENESCENCE_ASH_TRIBE, SENESCENCE_REMNANT_TRIBE]
                  },
                  value: 5
                }
              ]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [DEAD_TRIBE_ID, SENESCENCE_ASH_TRIBE, SENESCENCE_REMNANT_TRIBE]
              },
              value: 2
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: SENESCENCE_SPARK_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SENESCENCE_REMNANT_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [
                  SENESCENCE_GLOW_TRIBE,
                  SENESCENCE_AFTERGLOW_TRIBE,
                  SENESCENCE_TRAIL_TRIBE,
                  SENESCENCE_ECHO_TRIBE,
                  SENESCENCE_DIM_TRIBE,
                  SENESCENCE_ASH_TRIBE,
                  SENESCENCE_REMNANT_TRIBE
                ]
              },
              value: 6
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: DEAD_TRIBE_ID
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SENESCENCE_REMNANT_TRIBE]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: MIN_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [SENESCENCE_SPARK_TRIBE]
                  },
                  value: 1
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [SENESCENCE_ASH_TRIBE, SENESCENCE_REMNANT_TRIBE]
                  },
                  value: 5
                }
              ]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [DEAD_TRIBE_ID]
              },
              value: 4
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: SENESCENCE_SPARK_TRIBE
        }
      },
      directRule(SENESCENCE_SPARK_TRIBE, SENESCENCE_GLOW_TRIBE),
      directRule(SENESCENCE_GLOW_TRIBE, SENESCENCE_AFTERGLOW_TRIBE),
      directRule(SENESCENCE_AFTERGLOW_TRIBE, SENESCENCE_TRAIL_TRIBE),
      directRule(SENESCENCE_TRAIL_TRIBE, SENESCENCE_ECHO_TRIBE),
      directRule(SENESCENCE_ECHO_TRIBE, SENESCENCE_DIM_TRIBE),
      directRule(SENESCENCE_ECHO_TRIBE, SENESCENCE_DIM_TRIBE),
      staticRule(SENESCENCE_ASH_TRIBE),
      staticRule(SENESCENCE_REMNANT_TRIBE)
    ]
  }
};
