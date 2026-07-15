import {Preset, staticRule} from '.';
import {AND_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Stable slime body tribe ID.
 *
 * @type {string}
 */
const SLIME_MOLD_BODY_TRIBE = 'Body';

/**
 * Exploring slime tendril tribe ID.
 *
 * @type {string}
 */
const SLIME_MOLD_HEAD_TRIBE = 'Head';

/**
 * Food source tribe ID.
 *
 * @type {string}
 */
const SLIME_MOLD_FOOD_TRIBE = 'Food';

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
        id: SLIME_MOLD_BODY_TRIBE,
        color: 'ffff00'
      },
      {
        id: SLIME_MOLD_HEAD_TRIBE,
        color: '00ff88'
      },
      {
        id: SLIME_MOLD_FOOD_TRIBE,
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
              tribes: [DEAD_TRIBE_ID, SLIME_MOLD_FOOD_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [SLIME_MOLD_FOOD_TRIBE]
              },
              value: 1
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [SLIME_MOLD_HEAD_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: SLIME_MOLD_HEAD_TRIBE
        },
        probability: 50
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
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [SLIME_MOLD_HEAD_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: SLIME_MOLD_HEAD_TRIBE
        },
        probability: 10
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SLIME_MOLD_HEAD_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [SLIME_MOLD_HEAD_TRIBE, SLIME_MOLD_BODY_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: SLIME_MOLD_BODY_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SLIME_MOLD_BODY_TRIBE]
            },
            {
              kind: COUNT_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [SLIME_MOLD_BODY_TRIBE]
              },
              interval: [1, 3]
            },
            {
              kind: NONE_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [SLIME_MOLD_HEAD_TRIBE]
              }
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [DEAD_TRIBE_ID, SLIME_MOLD_FOOD_TRIBE]
              },
              value: 5
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: SLIME_MOLD_HEAD_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [SLIME_MOLD_BODY_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [SLIME_MOLD_BODY_TRIBE, SLIME_MOLD_HEAD_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: SLIME_MOLD_BODY_TRIBE
        }
      },
      staticRule(SLIME_MOLD_FOOD_TRIBE)
    ]
  }
};
