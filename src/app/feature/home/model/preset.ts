import {AND_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NOT_CLAUSE_KIND, Ruleset} from './rule';
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
  readonly ruleset: Ruleset;
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
    cols: 128,
    rows: 128,
    tribes: [
      DEAD_TRIBE,
      {
        id: 'Alive',
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
              tribes: ['Alive']
            },
            {
              kind: MAX_CLAUSE_KIND,
              value: 1,
              tribes: ['Alive']
            }
          ]
        },
        tribe: DEAD_TRIBE_ID
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: ['Alive']
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [2, 3],
              tribes: ['Alive']
            }
          ]
        },
        tribe: 'Alive'
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: ['Alive']
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 4,
              tribes: ['Alive']
            }
          ]
        },
        tribe: DEAD_TRIBE_ID
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
              kind: EXACTLY_CLAUSE_KIND,
              value: 3,
              tribes: ['Alive']
            }
          ]
        },
        tribe: 'Alive'
      }
    ]
  }
};

export const PALETTE_PRESET: Preset = {
  name: 'Palette',
  description: 'Primary colors reproduce, mix, decay, and mutate',
  ruleset: {
    cols: 128,
    rows: 128,
    tribes: [
      DEAD_TRIBE,
      {
        id: 'Red',
        color: 'ff0000'
      },
      {
        id: 'Yellow',
        color: 'ffff00'
      },
      {
        id: 'Blue',
        color: '0000ff'
      },
      {
        id: 'Orange',
        color: 'ff8000'
      },
      {
        id: 'Purple',
        color: '8000ff'
      },
      {
        id: 'Green',
        color: '00ff00'
      },
      {
        id: 'Brown',
        color: '8b4513'
      },
      {
        id: 'Gray',
        color: '808080'
      }
    ],
    rules: [
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: ['Gray']
        },
        become: {
          kind: 'fixed',
          tribe: DEAD_TRIBE_ID
        }
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: ['Brown']
        },
        become: {
          kind: 'fixed',
          tribe: 'Gray'
        }
      },

      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: ['Red', 'Yellow', 'Blue']
            },
            {
              kind: MAX_CLAUSE_KIND,
              value: 1,
              selector: {
                kind: 'same'
              }
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: DEAD_TRIBE_ID
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: ['Red', 'Yellow', 'Blue']
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [2, 3],
              selector: {
                kind: 'same'
              }
            }
          ]
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
              tribes: ['Red', 'Yellow', 'Blue']
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 4,
              selector: {
                kind: 'same'
              }
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: DEAD_TRIBE_ID
        }
      },

      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: ['Orange', 'Purple', 'Green']
            },
            {
              kind: MAX_CLAUSE_KIND,
              value: 1,
              selector: {
                kind: 'same'
              }
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: DEAD_TRIBE_ID
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: ['Orange', 'Purple', 'Green']
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [2, 4],
              selector: {
                kind: 'same'
              }
            }
          ]
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
              tribes: ['Orange', 'Purple', 'Green']
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 5,
              selector: {
                kind: 'same'
              }
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: DEAD_TRIBE_ID
        }
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
              kind: EXACTLY_CLAUSE_KIND,
              value: 4,
              selector: {
                kind: 'tribes',
                tribes: [
                  'Red',
                  'Yellow',
                  'Blue',
                  'Orange',
                  'Purple',
                  'Green',
                  'Brown'
                ]
              }
            }
          ]
        },
        become: {
          kind: 'majority',
          selector: {
            kind: 'tribes',
            tribes: [
              'Red',
              'Yellow',
              'Blue',
              'Orange',
              'Purple',
              'Green',
              'Brown'
            ]
          },
          tie: {
            kind: 'combine',
            strategy: {
              kind: 'lookup',
              entries: [
                {
                  inputs: [{kind: 'tribes', tribes: ['Red', 'Yellow']}],
                  output: 'Orange'
                },
                {
                  inputs: [{kind: 'tribes', tribes: ['Red', 'Blue']}],
                  output: 'Purple'
                },
                {
                  inputs: [{kind: 'tribes', tribes: ['Yellow', 'Blue']}],
                  output: 'Green'
                },

                {
                  inputs: [{kind: 'tribes', tribes: ['Orange', 'Red']}],
                  output: 'Orange'
                },
                {
                  inputs: [{kind: 'tribes', tribes: ['Orange', 'Yellow']}],
                  output: 'Orange'
                },
                {
                  inputs: [{kind: 'tribes', tribes: ['Orange', 'Red', 'Yellow']}],
                  output: 'Orange'
                },

                {
                  inputs: [{kind: 'tribes', tribes: ['Purple', 'Red']}],
                  output: 'Purple'
                },
                {
                  inputs: [{kind: 'tribes', tribes: ['Purple', 'Blue']}],
                  output: 'Purple'
                },
                {
                  inputs: [{kind: 'tribes', tribes: ['Purple', 'Red', 'Blue']}],
                  output: 'Purple'
                },

                {
                  inputs: [{kind: 'tribes', tribes: ['Green', 'Yellow']}],
                  output: 'Green'
                },
                {
                  inputs: [{kind: 'tribes', tribes: ['Green', 'Blue']}],
                  output: 'Green'
                },
                {
                  inputs: [{kind: 'tribes', tribes: ['Green', 'Yellow', 'Blue']}],
                  output: 'Green'
                }
              ],
              default: {
                kind: 'fixed',
                tribe: 'Brown'
              }
            }
          },
          fallback: {
            kind: 'fixed',
            tribe: DEAD_TRIBE_ID
          }
        }
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
    cols: 128,
    rows: 128,
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
export const PRESETS: readonly Preset[] = [CONWAY_PRESET, PALETTE_PRESET, ECOSYSTEM_PRESET];
