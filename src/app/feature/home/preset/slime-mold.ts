import {Preset} from '.';
import {COUNT_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID} from '../model/rule';

/**
 * Slime leading edge tribe ID.
 *
 * @type {string}
 */
const SLIME_MOLD_FRONT_TRIBE = 'front';

/**
 * Stable slime body tribe ID.
 *
 * @type {string}
 */
const SLIME_MOLD_BODY_TRIBE = 'body';

/**
 * Fresh trail tribe ID.
 *
 * @type {string}
 */
const SLIME_MOLD_FRESH_TRAIL_TRIBE = 'trailFresh';

/**
 * Old trail tribe ID.
 *
 * @type {string}
 */
const SLIME_MOLD_OLD_TRAIL_TRIBE = 'trailOld';

/**
 * Food source tribe ID.
 *
 * @type {string}
 */
const SLIME_MOLD_FOOD_TRIBE = 'food';

/**
 * Depleted food source tribe ID.
 *
 * @type {string}
 */
const SLIME_MOLD_SPENT_FOOD_TRIBE = 'spentFood';

/**
 * Slime Mold preset.
 *
 * @type {Preset}
 */
export const SLIME_MOLD_PRESET: Preset = {
  name: 'Slime Mold',
  description: 'Slime body with explorer tendrils',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: SLIME_MOLD_FRONT_TRIBE,
        color: '9ae6b4'
      },
      {
        id: SLIME_MOLD_BODY_TRIBE,
        color: '38a169'
      },
      {
        id: SLIME_MOLD_FRESH_TRAIL_TRIBE,
        color: '718096'
      },
      {
        id: SLIME_MOLD_OLD_TRAIL_TRIBE,
        color: '2d3748'
      },
      {
        id: SLIME_MOLD_FOOD_TRIBE,
        color: 'f6e05e'
      },
      {
        id: SLIME_MOLD_SPENT_FOOD_TRIBE,
        color: '887716'
      }
    ],
    rules: [
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [DEAD_TRIBE_ID]
            },
            {
              kind: 'min',
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_FOOD_TRIBE]
              },
              value: 1
            },
            {
              kind: COUNT_CLAUSE_KIND,
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_FRONT_TRIBE, SLIME_MOLD_BODY_TRIBE]
              },
              interval: [1, 4]
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: SLIME_MOLD_FRONT_TRIBE
        }
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [SLIME_MOLD_FRONT_TRIBE]
            },
            {
              kind: 'min',
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_FOOD_TRIBE]
              },
              value: 1
            },
            {
              kind: 'min',
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_BODY_TRIBE]
              },
              value: 1
            },
            {
              kind: 'max',
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_FRONT_TRIBE, SLIME_MOLD_BODY_TRIBE]
              },
              value: 8
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: SLIME_MOLD_BODY_TRIBE
        }
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [SLIME_MOLD_BODY_TRIBE]
            },
            {
              kind: 'min',
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_FOOD_TRIBE]
              },
              value: 1
            },
            {
              kind: COUNT_CLAUSE_KIND,
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_FRONT_TRIBE, SLIME_MOLD_BODY_TRIBE]
              },
              interval: [1, 8]
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: SLIME_MOLD_BODY_TRIBE
        }
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [DEAD_TRIBE_ID]
            },
            {
              kind: 'exactly',
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_FRONT_TRIBE]
              },
              value: 1
            },
            {
              kind: COUNT_CLAUSE_KIND,
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_BODY_TRIBE]
              },
              interval: [1, 2]
            },
            {
              kind: 'max',
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_FRESH_TRAIL_TRIBE, SLIME_MOLD_OLD_TRAIL_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: SLIME_MOLD_FRONT_TRIBE
        }
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [SLIME_MOLD_FRONT_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_BODY_TRIBE]
              },
              interval: [1, 3]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_FRONT_TRIBE, SLIME_MOLD_BODY_TRIBE]
              },
              interval: [2, 4]
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: SLIME_MOLD_BODY_TRIBE
        }
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [SLIME_MOLD_BODY_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_FRONT_TRIBE, SLIME_MOLD_BODY_TRIBE]
              },
              interval: [2, 4]
            }
          ]
        },
        become: {
          kind: 'same'
        }
      },
      {
        clause: {
          kind: 'is',
          tribes: [SLIME_MOLD_FRONT_TRIBE]
        },
        become: {
          kind: 'fixed',
          tribe: SLIME_MOLD_FRESH_TRAIL_TRIBE
        }
      },
      {
        clause: {
          kind: 'is',
          tribes: [SLIME_MOLD_BODY_TRIBE]
        },
        become: {
          kind: 'fixed',
          tribe: SLIME_MOLD_FRESH_TRAIL_TRIBE
        }
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [SLIME_MOLD_FRESH_TRAIL_TRIBE]
            },
            {
              kind: 'not',
              clause: {
                kind: 'min',
                value: 2,
                selector: {
                  kind: 'tribes',
                  tribes: [SLIME_MOLD_BODY_TRIBE, SLIME_MOLD_FRONT_TRIBE]
                }
              }
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: SLIME_MOLD_OLD_TRAIL_TRIBE
        }
      },
      {
        clause: {
          kind: 'is',
          tribes: [SLIME_MOLD_OLD_TRAIL_TRIBE]
        },
        become: {
          kind: 'fixed',
          tribe: DEAD_TRIBE_ID
        }
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [SLIME_MOLD_FOOD_TRIBE]
            },
            {
              kind: 'min',
              value: 4,
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_BODY_TRIBE]
              }
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: SLIME_MOLD_SPENT_FOOD_TRIBE
        }
      },
      {
        clause: {
          kind: 'is',
          tribes: [SLIME_MOLD_FOOD_TRIBE]
        },
        become: {
          kind: 'same'
        }
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: [SLIME_MOLD_SPENT_FOOD_TRIBE]
            },
            {
              kind: 'min',
              value: 6,
              selector: {
                kind: 'tribes',
                tribes: [SLIME_MOLD_BODY_TRIBE]
              }
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: SLIME_MOLD_BODY_TRIBE
        }
      },
      {
        clause: {
          kind: 'is',
          tribes: [SLIME_MOLD_SPENT_FOOD_TRIBE]
        },
        become: {
          kind: 'fixed',
          tribe: SLIME_MOLD_FRESH_TRAIL_TRIBE
        }
      }
    ]
  }
};
