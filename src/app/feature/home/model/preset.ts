import {AND_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, OR_CLAUSE_KIND, Ruleset} from './rule';

/**
 * Tribe ID for the Conway preset.
 *
 * @type {string}
 */
const CONWAY_TRIBE = 'Alive';

/**
 * Tribe ID for the Replicator preset.
 *
 * @type {string}
 */
const REPLICATOR_TRIBE = 'Replicant';

/**
 * Tribe ID for the Eternal preset.
 *
 * @type {string}
 */
const ETERNAL_TRIBE = 'Immortal';

/**
 * Tribe ID for the Diamoeba preset.
 *
 * @type {string}
 */
const DIAMOEBA_TRIBE = 'Foam';

/**
 * Tribe ID for the Day & Night preset.
 *
 * @type {string}
 */
const DAY_AND_NIGHT_TRIBE = 'Yang';

/**
 * Tribe ID for the Anneal preset.
 *
 * @type {string}
 */
const ANNEAL_TRIBE = 'Smooth';

/**
 * Light vegetation tribe ID for the Wildfire preset.
 *
 * @type {string}
 */
const WILDFIRE_LIGHT_VEGETATION_TRIBE = 'Light Green';

/**
 * Medium vegetation tribe ID for the Wildfire preset.
 *
 * @type {string}
 */
const WILDFIRE_MEDIUM_VEGETATION_TRIBE = 'Green';

/**
 * Dense vegetation tribe ID for the Wildfire preset.
 *
 * @type {string}
 */
const WILDFIRE_DARK_VEGETATION_TRIBE = 'Dark Green';

/**
 * Ember tribe ID for the Wildfire preset.
 *
 * @type {string}
 */
const WILDFIRE_EMBER_TRIBE = 'Ember';

/**
 * Fire tribe ID for the Wildfire preset.
 *
 * @type {string}
 */
const WILDFIRE_FIRE_TRIBE = 'Fire';

/**
 * Blaze tribe ID for the Wildfire preset.
 *
 * @type {string}
 */
const WILDFIRE_BLAZE_TRIBE = 'Blaze';

/**
 * Ash tribe ID for the Wildfire preset.
 *
 * @type {string}
 */
const WILDFIRE_ASH_TRIBE = 'Ash';

/**
 * Rock tribe ID for the Wildfire preset.
 *
 * @type {string}
 */
const WILDFIRE_ROCK_TRIBE = 'Rock';

/**
 * Named application preset.
 *
 * @interface Preset
 * @typedef {Preset}
 */
export interface Preset {
  /**
   * Preset display name.
   *
   * @type {string}
   */
  readonly name: string;
  /**
   * Preset short description.
   *
   * @type {string}
   */
  readonly description: string;
  /**
   * Ruleset loaded by the preset.
   *
   * @type {Omit<Ruleset, 'cols' | 'rows'>}
   */
  readonly ruleset: Omit<Ruleset, 'cols' | 'rows'>;
}

/**
 * Conway's Game of Life preset.
 *
 * @type {Preset}
 */
export const CONWAY_PRESET: Preset = {
  name: 'Conway',
  description: 'Classic Game of Life',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: CONWAY_TRIBE,
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
              tribes: [DEAD_TRIBE_ID]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              value: 3,
              tribes: [CONWAY_TRIBE]
            }
          ]
        },
        tribe: CONWAY_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [CONWAY_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [2, 3],
              tribes: [CONWAY_TRIBE]
            }
          ]
        },
        tribe: CONWAY_TRIBE
      }
    ]
  }
};

/**
 * Replicator preset.
 *
 * @type {Preset}
 */
export const REPLICATOR_PRESET: Preset = {
  name: 'Replicator',
  description: 'Replicates itself indefinitely',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: REPLICATOR_TRIBE,
        color: 'ffff88'
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
                  value: 1,
                  tribes: [REPLICATOR_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 3,
                  tribes: [REPLICATOR_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 5,
                  tribes: [REPLICATOR_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 7,
                  tribes: [REPLICATOR_TRIBE]
                }
              ]
            }
          ]
        },
        tribe: REPLICATOR_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [REPLICATOR_TRIBE]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 1,
                  tribes: [REPLICATOR_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 3,
                  tribes: [REPLICATOR_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 5,
                  tribes: [REPLICATOR_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 7,
                  tribes: [REPLICATOR_TRIBE]
                }
              ]
            }
          ]
        },
        tribe: REPLICATOR_TRIBE
      }
    ]
  }
};

/**
 * Eternal preset.
 *
 * @type {Preset}
 */
export const ETERNAL_PRESET: Preset = {
  name: 'Eternal',
  description: 'Never dies once alive',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: ETERNAL_TRIBE,
        color: 'fffff0'
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
              kind: EXACTLY_CLAUSE_KIND,
              value: 3,
              tribes: [ETERNAL_TRIBE]
            }
          ]
        },
        tribe: ETERNAL_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [ETERNAL_TRIBE]
        },
        tribe: ETERNAL_TRIBE
      }
    ]
  }
};

/**
 * Diamoeba preset.
 *
 * @type {Preset}
 */
export const DIAMOEBA_PRESET: Preset = {
  name: 'Diamoeba',
  description: 'Diamonds with fluctuating boundaries',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: DIAMOEBA_TRIBE,
        color: '3dd8ff'
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
                  value: 3,
                  tribes: [DIAMOEBA_TRIBE]
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  value: 5,
                  tribes: [DIAMOEBA_TRIBE]
                }
              ]
            }
          ]
        },
        tribe: DIAMOEBA_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DIAMOEBA_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 5,
              tribes: [DIAMOEBA_TRIBE]
            }
          ]
        },
        tribe: DIAMOEBA_TRIBE
      }
    ]
  }
};

/**
 * Day and Night preset.
 *
 * @type {Preset}
 */
export const DAY_AND_NIGHT_PRESET: Preset = {
  name: 'Day & Night',
  description: 'Symmetric under on-off reversal',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: DAY_AND_NIGHT_TRIBE,
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
              tribes: [DEAD_TRIBE_ID]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 3,
                  tribes: [DAY_AND_NIGHT_TRIBE]
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  value: 6,
                  tribes: [DAY_AND_NIGHT_TRIBE]
                }
              ]
            }
          ]
        },
        tribe: DAY_AND_NIGHT_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DAY_AND_NIGHT_TRIBE]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [3, 4],
                  tribes: [DAY_AND_NIGHT_TRIBE]
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  value: 6,
                  tribes: [DAY_AND_NIGHT_TRIBE]
                }
              ]
            }
          ]
        },
        tribe: DAY_AND_NIGHT_TRIBE
      }
    ]
  }
};

/**
 * Anneal preset.
 *
 * @type {Preset}
 */
export const ANNEAL_PRESET: Preset = {
  name: 'Anneal',
  description: 'Converges to smooth blobs',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: ANNEAL_TRIBE,
        color: 'c4c4c4'
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
                  value: 4,
                  tribes: [ANNEAL_TRIBE]
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  value: 6,
                  tribes: [ANNEAL_TRIBE]
                }
              ]
            }
          ]
        },
        tribe: ANNEAL_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [ANNEAL_TRIBE]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 3,
                  tribes: [ANNEAL_TRIBE]
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  value: 5,
                  tribes: [ANNEAL_TRIBE]
                }
              ]
            }
          ]
        },
        tribe: ANNEAL_TRIBE
      }
    ]
  }
};

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
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [WILDFIRE_BLAZE_TRIBE]
        },
        tribe: WILDFIRE_FIRE_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [WILDFIRE_FIRE_TRIBE]
        },
        tribe: WILDFIRE_EMBER_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [WILDFIRE_EMBER_TRIBE]
        },
        tribe: WILDFIRE_ASH_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [WILDFIRE_ROCK_TRIBE]
        },
        tribe: WILDFIRE_ROCK_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [WILDFIRE_LIGHT_VEGETATION_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 3,
              tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]
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
              tribes: [WILDFIRE_LIGHT_VEGETATION_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 2,
              tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]
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
              tribes: [WILDFIRE_LIGHT_VEGETATION_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 1,
              tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]
            }
          ]
        },
        tribe: WILDFIRE_EMBER_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [WILDFIRE_MEDIUM_VEGETATION_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 4,
              tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]
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
              tribes: [WILDFIRE_MEDIUM_VEGETATION_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 3,
              tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]
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
              tribes: [WILDFIRE_MEDIUM_VEGETATION_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 2,
              tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]
            }
          ]
        },
        tribe: WILDFIRE_EMBER_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [WILDFIRE_DARK_VEGETATION_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 5,
              tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]
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
              tribes: [WILDFIRE_DARK_VEGETATION_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 4,
              tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]
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
              tribes: [WILDFIRE_DARK_VEGETATION_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 3,
              tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]
            }
          ]
        },
        tribe: WILDFIRE_EMBER_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [WILDFIRE_LIGHT_VEGETATION_TRIBE, WILDFIRE_MEDIUM_VEGETATION_TRIBE, WILDFIRE_DARK_VEGETATION_TRIBE]
        },
        become: {
          kind: 'same'
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
              tribes: [WILDFIRE_EMBER_TRIBE, WILDFIRE_FIRE_TRIBE, WILDFIRE_BLAZE_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 5,
              tribes: [WILDFIRE_LIGHT_VEGETATION_TRIBE, WILDFIRE_MEDIUM_VEGETATION_TRIBE, WILDFIRE_DARK_VEGETATION_TRIBE]
            }
          ]
        },
        become: {
          kind: 'majority',
          selector: {
            kind: 'tribes',
            tribes: [WILDFIRE_LIGHT_VEGETATION_TRIBE, WILDFIRE_MEDIUM_VEGETATION_TRIBE, WILDFIRE_DARK_VEGETATION_TRIBE]
          },
          tie: {
            kind: 'fixed',
            tribe: WILDFIRE_MEDIUM_VEGETATION_TRIBE
          },
          fallback: {
            kind: 'fixed',
            tribe: WILDFIRE_MEDIUM_VEGETATION_TRIBE
          }
        }
      }
    ]
  }
};

/**
 * Available built-in presets.
 *
 * @type {readonly Preset[]}
 */
export const PRESETS: readonly Preset[] = [
  CONWAY_PRESET,
  REPLICATOR_PRESET,
  ETERNAL_PRESET,
  DIAMOEBA_PRESET,
  DAY_AND_NIGHT_PRESET,
  ANNEAL_PRESET,
  WILDFIRE_PRESET
];
