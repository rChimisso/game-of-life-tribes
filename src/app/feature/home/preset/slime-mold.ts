import {Preset} from '.';
import {AND_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, OR_CLAUSE_KIND} from '../model/rule';

/**
 * Exploring slime front tribe ID.
 *
 * @type {string}
 */
const SLIME_MOLD_EXPLORER_TRIBE = 'Explorer';

/**
 * Stable slime body tribe ID.
 *
 * @type {string}
 */
const SLIME_MOLD_SLIME_TRIBE = 'Slime';

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
        id: SLIME_MOLD_EXPLORER_TRIBE,
        color: 'c9ff4d'
      },
      {
        id: SLIME_MOLD_SLIME_TRIBE,
        color: '5fbf1f'
      }
    ],
    rules: [
      /*
       * Dead cells next to sparse slime edges become explorers. This lets a
       * slime-only body regenerate an outside boundary without changing slime.
       */
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
              value: 1,
              tribes: [SLIME_MOLD_SLIME_TRIBE]
            },
            {
              kind: MAX_CLAUSE_KIND,
              value: 1,
              tribes: [SLIME_MOLD_EXPLORER_TRIBE]
            }
          ]
        },
        tribe: SLIME_MOLD_EXPLORER_TRIBE
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
              value: 2,
              tribes: [SLIME_MOLD_SLIME_TRIBE]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              value: 1,
              tribes: [SLIME_MOLD_EXPLORER_TRIBE]
            }
          ]
        },
        tribe: SLIME_MOLD_EXPLORER_TRIBE
      },

      /*
       * Explorers drive all outward growth. Parity-like sparse counts branch
       * irregularly and crowded cells stay empty, leaving pores and gaps.
       */
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
              value: 1,
              tribes: [SLIME_MOLD_EXPLORER_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [0, 2],
              tribes: [SLIME_MOLD_SLIME_TRIBE]
            }
          ]
        },
        tribe: SLIME_MOLD_EXPLORER_TRIBE
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
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 2,
                  tribes: [SLIME_MOLD_EXPLORER_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 3,
                  tribes: [SLIME_MOLD_EXPLORER_TRIBE]
                }
              ]
            },
            {
              kind: MAX_CLAUSE_KIND,
              value: 1,
              tribes: [SLIME_MOLD_SLIME_TRIBE]
            }
          ]
        },
        tribe: SLIME_MOLD_EXPLORER_TRIBE
      },

      /*
       * Explorers inside or near dense tissue mature into the stable body.
       */
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SLIME_MOLD_EXPLORER_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [0, 1],
              tribes: [DEAD_TRIBE_ID]
            }
          ]
        },
        tribe: SLIME_MOLD_SLIME_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SLIME_MOLD_EXPLORER_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 4,
              tribes: [SLIME_MOLD_EXPLORER_TRIBE, SLIME_MOLD_SLIME_TRIBE]
            }
          ]
        },
        tribe: SLIME_MOLD_SLIME_TRIBE
      },

      /*
       * Sparse exposed explorers remain at the boundary.
       */
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SLIME_MOLD_EXPLORER_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              value: 2,
              tribes: [DEAD_TRIBE_ID]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              interval: [1, 2],
              tribes: [SLIME_MOLD_EXPLORER_TRIBE, SLIME_MOLD_SLIME_TRIBE]
            }
          ]
        },
        tribe: SLIME_MOLD_EXPLORER_TRIBE
      },

      /*
       * Slime itself is permanent. Remaining explorers fold back into the body
       * rather than oscillating body cells back into explorers.
       */
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [SLIME_MOLD_EXPLORER_TRIBE]
        },
        tribe: SLIME_MOLD_SLIME_TRIBE
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [SLIME_MOLD_SLIME_TRIBE]
        },
        tribe: SLIME_MOLD_SLIME_TRIBE
      }
    ]
  }
};
