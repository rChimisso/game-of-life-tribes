import {DEAD_TRIBE, Ruleset} from './rule';

interface Preset {
  readonly name: string;
  readonly description: string;
  readonly ruleset: Ruleset;
}

const conway: Preset = {
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
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['Alive']
            },
            {
              kind: 'count',
              interval: [0, 1],
              tribes: ['Alive']
            }
          ]
        },
        tribe: DEAD_TRIBE.id
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['Alive']
            },
            {
              kind: 'count',
              interval: [2, 3],
              tribes: ['Alive']
            }
          ]
        },
        tribe: 'Alive'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['Alive']
            },
            {
              kind: 'count',
              interval: [4, 8],
              tribes: ['Alive']
            }
          ]
        },
        tribe: DEAD_TRIBE.id
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [DEAD_TRIBE.id]
            },
            {
              kind: 'count',
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

const ecosystem: Preset = {
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
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [DEAD_TRIBE.id, 'Rabbit', 'Grass']
            },
            {
              kind: 'and',
              clauses: [
                {
                  kind: 'count',
                  interval: [2, 8],
                  tribes: ['Rabbit']
                },
                {
                  kind: 'count',
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
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['Fox']
            },
            {
              kind: 'and',
              clauses: [
                {
                  kind: 'count',
                  interval: [0, 7],
                  tribes: ['Grass']
                },
                {
                  kind: 'count',
                  interval: [1, 7],
                  tribes: ['Rabbit']
                },
                {
                  kind: 'count',
                  interval: [0, 2],
                  tribes: ['Fox']
                },
                {
                  kind: 'not',
                  clause: {
                    kind: 'count',
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
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [DEAD_TRIBE.id, 'Grass']
            },
            {
              kind: 'and',
              clauses: [
                {
                  kind: 'count',
                  interval: [2, 8],
                  tribes: ['Grass']
                },
                {
                  kind: 'count',
                  interval: [2, 6],
                  tribes: ['Rabbit']
                },
                {
                  kind: 'count',
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
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['Rabbit']
            },
            {
              kind: 'and',
              clauses: [
                {
                  kind: 'count',
                  interval: [1, 7],
                  tribes: ['Grass']
                },
                {
                  kind: 'count',
                  interval: [0, 0],
                  tribes: ['Fox']
                },
                {
                  kind: 'count',
                  interval: [0, 3],
                  tribes: ['Rabbit']
                },
                {
                  kind: 'not',
                  clause: {
                    kind: 'count',
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
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [DEAD_TRIBE.id]
            },
            {
              kind: 'count',
              interval: [2, 6],
              tribes: ['Grass']
            }
          ]
        },
        tribe: 'Grass'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['Grass']
            },
            {
              kind: 'and',
              clauses: [
                {
                  kind: 'count',
                  interval: [0, 6],
                  tribes: ['Grass']
                },
                {
                  kind: 'count',
                  interval: [0, 7],
                  tribes: ['Fox']
                },
                {
                  kind: 'not',
                  clause: {
                    kind: 'count',
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

export const PRESETS: readonly Preset[] = [conway, ecosystem];

export type {Preset};
