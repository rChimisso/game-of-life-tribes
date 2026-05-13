import {AND_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, IS_CLAUSE_KIND, NOT_CLAUSE_KIND, Ruleset} from './rule';

interface Preset {
  readonly name: string;
  readonly description: string;
  readonly ruleset: Ruleset;
}

const ECOSYSTEM_PRESET: Preset = {
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
              kind: COUNT_CLAUSE_KIND,
              interval: [0, 1],
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
              kind: COUNT_CLAUSE_KIND,
              interval: [4, 8],
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
              kind: COUNT_CLAUSE_KIND,
              interval: [3, 3],
              tribes: ['Alive']
            }
          ]
        },
        tribe: 'Alive'
      }
    ]
  }
};

export const PRESETS: readonly Preset[] = [CONWAY_PRESET, ECOSYSTEM_PRESET];

export type {Preset};
