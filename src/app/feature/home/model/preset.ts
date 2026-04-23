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
        id: 'alive',
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
              tribes: ['alive']
            },
            {
              kind: 'count',
              interval: [0, 1],
              tribes: ['alive']
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
              tribes: ['alive']
            },
            {
              kind: 'count',
              interval: [2, 3],
              tribes: ['alive']
            }
          ]
        },
        tribe: 'alive'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['alive']
            },
            {
              kind: 'count',
              interval: [4, 8],
              tribes: ['alive']
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
              tribes: ['dead']
            },
            {
              kind: 'count',
              interval: [3, 3],
              tribes: ['alive']
            }
          ]
        },
        tribe: 'alive'
      }
    ]
  }
};

const ecosystem: Preset = {
  name: 'Ecosystem',
  description: 'Grass, rabbits, and foxes',
  ruleset: {
    cols: 128,
    rows: 128,
    tribes: [
      DEAD_TRIBE,
      {
        id: 'grass',
        color: '00ff00'
      },
      {
        id: 'rabbit',
        color: 'ffffff'
      },
      {
        id: 'fox',
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
              tribes: [DEAD_TRIBE.id, 'rabbit', 'grass']
            },
            {
              kind: 'and',
              clauses: [
                {
                  kind: 'count',
                  interval: [2, 8],
                  tribes: ['rabbit']
                },
                {
                  kind: 'count',
                  interval: [2, 4],
                  tribes: ['fox']
                }
              ]
            }
          ]
        },
        tribe: 'fox'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['fox']
            },
            {
              kind: 'and',
              clauses: [
                {
                  kind: 'count',
                  interval: [0, 7],
                  tribes: ['grass']
                },
                {
                  kind: 'count',
                  interval: [1, 7],
                  tribes: ['rabbit']
                },
                {
                  kind: 'count',
                  interval: [0, 2],
                  tribes: ['fox']
                },
                {
                  kind: 'not',
                  clause: {
                    kind: 'count',
                    interval: [8, 8],
                    tribes: ['grass', 'rabbit', 'fox']
                  }
                }
              ]
            }
          ]
        },
        tribe: 'fox'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [DEAD_TRIBE.id, 'grass']
            },
            {
              kind: 'and',
              clauses: [
                {
                  kind: 'count',
                  interval: [2, 8],
                  tribes: ['grass']
                },
                {
                  kind: 'count',
                  interval: [2, 6],
                  tribes: ['rabbit']
                },
                {
                  kind: 'count',
                  interval: [0, 0],
                  tribes: ['fox']
                }
              ]
            }
          ]
        },
        tribe: 'rabbit'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['rabbit']
            },
            {
              kind: 'and',
              clauses: [
                {
                  kind: 'count',
                  interval: [1, 7],
                  tribes: ['grass']
                },
                {
                  kind: 'count',
                  interval: [0, 0],
                  tribes: ['fox']
                },
                {
                  kind: 'count',
                  interval: [0, 3],
                  tribes: ['rabbit']
                },
                {
                  kind: 'not',
                  clause: {
                    kind: 'count',
                    interval: [8, 8],
                    tribes: ['grass', 'rabbit', 'fox']
                  }
                }
              ]
            }
          ]
        },
        tribe: 'rabbit'
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
              tribes: ['grass']
            }
          ]
        },
        tribe: 'grass'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['grass']
            },
            {
              kind: 'and',
              clauses: [
                {
                  kind: 'count',
                  interval: [0, 6],
                  tribes: ['grass']
                },
                {
                  kind: 'count',
                  interval: [0, 7],
                  tribes: ['fox']
                },
                {
                  kind: 'not',
                  clause: {
                    kind: 'count',
                    interval: [8, 8],
                    tribes: ['grass', 'rabbit', 'fox']
                  }
                }
              ]
            }
          ]
        },
        tribe: 'grass'
      }
    ]
  }
};

export const PRESETS: readonly Preset[] = [conway, ecosystem];

export type {Preset};
