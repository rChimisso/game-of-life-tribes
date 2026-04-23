import {DEAD_TRIBE, Ruleset} from './rule';

interface Preset {
  readonly name: string;
  readonly description: string;
  readonly ruleset: Ruleset;
}

const conway: Preset = {
  name: 'Conway',
  description: 'Classic Game of Life (B3/S23)',
  ruleset: {
    cols: 100,
    rows: 100,
    tribes: [
      DEAD_TRIBE,
      {id: 'classic',
        color: 'f0f0f0'}
    ],
    rules: [
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['classic']},
            {
              kind: 'count',
              interval: [0, 1],
              tribes: ['classic']
            }
          ]
        },
        tribe: DEAD_TRIBE.id
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['classic']},
            {
              kind: 'count',
              interval: [2, 3],
              tribes: ['classic']
            }
          ]
        },
        tribe: 'classic'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['classic']},
            {
              kind: 'count',
              interval: [4, 8],
              tribes: ['classic']
            }
          ]
        },
        tribe: DEAD_TRIBE.id
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['dead']},
            {
              kind: 'count',
              interval: [3, 3],
              tribes: ['classic']
            }
          ]
        },
        tribe: 'classic'
      }
    ]
  }
};

const sugar: Preset = {
  name: 'Sugar',
  description: '3 tribes compete for sugar resources',
  ruleset: {
    cols: 100,
    rows: 100,
    tribes: [
      DEAD_TRIBE,
      {id: 'sugar',
        color: 'ffffaa'},
      {id: 'red',
        color: 'ff4444'},
      {id: 'blue',
        color: '4488ff'},
      {id: 'green',
        color: '44dd44'}
    ],
    rules: [
      // Sugar never dies — it transforms into the majority neighbor tribe.
      // If a sugar cell has 1+ red/blue/green neighbors, it becomes the tribe with the most neighbors.
      // We approximate "majority" with priority rules: whichever tribe has ≥2 neighbors claims it.
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['sugar']},
            {
              kind: 'count',
              interval: [2, 8],
              tribes: ['red']
            }
          ]
        },
        tribe: 'red'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['sugar']},
            {
              kind: 'count',
              interval: [2, 8],
              tribes: ['blue']
            }
          ]
        },
        tribe: 'blue'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['sugar']},
            {
              kind: 'count',
              interval: [2, 8],
              tribes: ['green']
            }
          ]
        },
        tribe: 'green'
      },
      // Sugar with only 1 or 0 tribe neighbors stays as sugar
      {
        clause: {kind: 'is',
          tribes: ['sugar']},
        tribe: 'sugar'
      },
      // Tribe cells need adjacent sugar to grow — a tribe cell with ≥1 sugar neighbor and 2-3 same-tribe neighbors survives
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['red']},
            {
              kind: 'count',
              interval: [1, 8],
              tribes: ['sugar']
            },
            {
              kind: 'count',
              interval: [1, 3],
              tribes: ['red']
            }
          ]
        },
        tribe: 'red'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['blue']},
            {
              kind: 'count',
              interval: [1, 8],
              tribes: ['sugar']
            },
            {
              kind: 'count',
              interval: [1, 3],
              tribes: ['blue']
            }
          ]
        },
        tribe: 'blue'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['green']},
            {
              kind: 'count',
              interval: [1, 8],
              tribes: ['sugar']
            },
            {
              kind: 'count',
              interval: [1, 3],
              tribes: ['green']
            }
          ]
        },
        tribe: 'green'
      },
      // Tribe cells without sugar support die
      {
        clause: {kind: 'is',
          tribes: ['red', 'blue', 'green']},
        tribe: DEAD_TRIBE.id
      },
      // Dead cells next to exactly 3 sugar cells become sugar (sugar regrows)
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['dead']},
            {
              kind: 'count',
              interval: [3, 3],
              tribes: ['sugar']
            }
          ]
        },
        tribe: 'sugar'
      }
    ]
  }
};

const ecosystem: Preset = {
  name: 'Ecosystem',
  description: 'Predator–prey food chain (fox > rabbit > grass)',
  ruleset: {
    cols: 100,
    rows: 100,
    tribes: [
      DEAD_TRIBE,
      {id: 'grass',
        color: '66bb66'},
      {id: 'rabbit',
        color: 'dddddd'},
      {id: 'fox',
        color: 'dd8833'}
    ],
    rules: [
      // Foxes die from starvation if they have 0 rabbit neighbors
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['fox']},
            {
              kind: 'count',
              interval: [0, 0],
              tribes: ['rabbit']
            }
          ]
        },
        tribe: DEAD_TRIBE.id
      },
      // Foxes with ≥1 rabbit neighbor survive (they eat)
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['fox']},
            {
              kind: 'count',
              interval: [1, 8],
              tribes: ['rabbit']
            }
          ]
        },
        tribe: 'fox'
      },
      // Rabbits adjacent to foxes get eaten
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['rabbit']},
            {
              kind: 'count',
              interval: [1, 8],
              tribes: ['fox']
            }
          ]
        },
        tribe: DEAD_TRIBE.id
      },
      // Rabbits with grass and no foxes survive
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['rabbit']},
            {
              kind: 'count',
              interval: [1, 8],
              tribes: ['grass']
            },
            {
              kind: 'count',
              interval: [0, 0],
              tribes: ['fox']
            }
          ]
        },
        tribe: 'rabbit'
      },
      // Rabbits without grass starve
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['rabbit']},
            {
              kind: 'count',
              interval: [0, 0],
              tribes: ['grass']
            }
          ]
        },
        tribe: DEAD_TRIBE.id
      },
      // Grass stays alive (persistent) unless it has too many rabbits
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['grass']},
            {
              kind: 'count',
              interval: [4, 8],
              tribes: ['rabbit']
            }
          ]
        },
        tribe: DEAD_TRIBE.id
      },
      {
        clause: {kind: 'is',
          tribes: ['grass']},
        tribe: 'grass'
      },
      // Dead cell with ≥2 grass neighbors regrows as grass
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['dead']},
            {
              kind: 'count',
              interval: [2, 3],
              tribes: ['grass']
            }
          ]
        },
        tribe: 'grass'
      },
      // Dead cell with ≥3 rabbit neighbors births a rabbit
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['dead']},
            {
              kind: 'count',
              interval: [3, 3],
              tribes: ['rabbit']
            }
          ]
        },
        tribe: 'rabbit'
      },
      // Foxes reproduce — dead cell adjacent to exactly 3 foxes becomes a fox
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['dead']},
            {
              kind: 'count',
              interval: [3, 3],
              tribes: ['fox']
            }
          ]
        },
        tribe: 'fox'
      }
    ]
  }
};

export const PRESETS: readonly Preset[] = [conway, sugar, ecosystem];

export type {Preset};
