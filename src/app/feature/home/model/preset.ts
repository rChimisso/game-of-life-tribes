import {AND_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MIN_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Ruleset} from './rule';

const CONWAY_TRIBE = 'Alive';

const REPLICATOR_TRIBE = 'Replicant';

const ETERNAL_TRIBE = 'Immortal';

const DIAMOEBA_TRIBE = 'Foam';

const DAY_AND_NIGHT_TRIBE = 'Yang';

const ANNEAL_TRIBE = 'Smooth';

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
   * @type {Ruleset}
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
 * Ecosystem simulation preset.
 *
 * @type {Preset}
 */
export const ECOSYSTEM_PRESET: Preset = {
  name: 'Ecosystem',
  description: 'Grass, Rabbits, and Foxes',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: 'Grass',
        color: '00ff00'
      },
      {
        id: 'Rabbit',
        color: 'ffffff'
      },
      {
        id: 'Fox',
        color: 'ff4d00'
      }
    ],
    rules: [
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID, 'Rabbit', 'Grass']
            },
            {
              kind: AND_CLAUSE_KIND,
              clauses: [
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [2, 8],
                  tribes: ['Rabbit']
                },
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [2, 4],
                  tribes: ['Fox']
                }
              ]
            }
          ]
        },
        tribe: 'Fox'
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: ['Fox']
            },
            {
              kind: AND_CLAUSE_KIND,
              clauses: [
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [0, 7],
                  tribes: ['Grass']
                },
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [1, 7],
                  tribes: ['Rabbit']
                },
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [0, 2],
                  tribes: ['Fox']
                },
                {
                  kind: NOT_CLAUSE_KIND,
                  clause: {
                    kind: COUNT_CLAUSE_KIND,
                    interval: [8, 8],
                    tribes: ['Grass', 'Rabbit', 'Fox']
                  }
                }
              ]
            }
          ]
        },
        tribe: 'Fox'
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID, 'Grass']
            },
            {
              kind: AND_CLAUSE_KIND,
              clauses: [
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [2, 8],
                  tribes: ['Grass']
                },
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [2, 6],
                  tribes: ['Rabbit']
                },
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [0, 0],
                  tribes: ['Fox']
                }
              ]
            }
          ]
        },
        tribe: 'Rabbit'
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: ['Rabbit']
            },
            {
              kind: AND_CLAUSE_KIND,
              clauses: [
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [1, 7],
                  tribes: ['Grass']
                },
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [0, 0],
                  tribes: ['Fox']
                },
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [0, 3],
                  tribes: ['Rabbit']
                },
                {
                  kind: NOT_CLAUSE_KIND,
                  clause: {
                    kind: COUNT_CLAUSE_KIND,
                    interval: [8, 8],
                    tribes: ['Grass', 'Rabbit', 'Fox']
                  }
                }
              ]
            }
          ]
        },
        tribe: 'Rabbit'
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [DEAD_TRIBE_ID]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [2, 6],
              tribes: ['Grass']
            }
          ]
        },
        tribe: 'Grass'
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: ['Grass']
            },
            {
              kind: AND_CLAUSE_KIND,
              clauses: [
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [0, 6],
                  tribes: ['Grass']
                },
                {
                  kind: COUNT_CLAUSE_KIND,
                  interval: [0, 7],
                  tribes: ['Fox']
                },
                {
                  kind: NOT_CLAUSE_KIND,
                  clause: {
                    kind: COUNT_CLAUSE_KIND,
                    interval: [8, 8],
                    tribes: ['Grass', 'Rabbit', 'Fox']
                  }
                }
              ]
            }
          ]
        },
        tribe: 'Grass'
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
  ECOSYSTEM_PRESET
];
