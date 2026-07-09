import {Preset, staticRule} from '.';
import {AND_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MIN_CLAUSE_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Resource tribe ID.
 *
 * @type {string}
 */
const RESOURCE_BLOOM_RESOURCE_TRIBE = 'Resource';

/**
 * Bloom tribe ID.
 *
 * @type {string}
 */
const RESOURCE_BLOOM_BLOOM_TRIBE = 'Bloom';

/**
 * Spent land tribe ID.
 *
 * @type {string}
 */
const RESOURCE_BLOOM_SPENT_TRIBE = 'Spent';

/**
 * Resource Bloom preset.
 *
 * @type {Preset}
 */
export const RESOURCE_BLOOM_PRESET: Preset = {
  name: 'Resource Bloom',
  description: 'Rare resources accumulate, erupt into blooms, and exhaust the land',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: RESOURCE_BLOOM_RESOURCE_TRIBE,
        color: '5fad56'
      },
      {
        id: RESOURCE_BLOOM_BLOOM_TRIBE,
        color: 'f9e784'
      },
      {
        id: RESOURCE_BLOOM_SPENT_TRIBE,
        color: '6b5e53'
      }
    ],
    rules: [
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [RESOURCE_BLOOM_BLOOM_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [RESOURCE_BLOOM_SPENT_TRIBE]
              },
              value: 2
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: RESOURCE_BLOOM_SPENT_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [RESOURCE_BLOOM_BLOOM_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [RESOURCE_BLOOM_BLOOM_TRIBE]
              },
              value: 5
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: RESOURCE_BLOOM_SPENT_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [RESOURCE_BLOOM_RESOURCE_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [RESOURCE_BLOOM_BLOOM_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: RESOURCE_BLOOM_BLOOM_TRIBE
        },
        probability: 50
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [RESOURCE_BLOOM_RESOURCE_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [RESOURCE_BLOOM_RESOURCE_TRIBE]
              },
              value: 5
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: RESOURCE_BLOOM_BLOOM_TRIBE
        }
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [RESOURCE_BLOOM_SPENT_TRIBE]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: DEAD_TRIBE_ID
        },
        probability: 3
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
                tribes: [RESOURCE_BLOOM_RESOURCE_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: RESOURCE_BLOOM_RESOURCE_TRIBE
        },
        probability: 5
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [DEAD_TRIBE_ID]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: RESOURCE_BLOOM_RESOURCE_TRIBE
        },
        probability: 0.005
      },
      staticRule(
        RESOURCE_BLOOM_RESOURCE_TRIBE,
        RESOURCE_BLOOM_BLOOM_TRIBE,
        RESOURCE_BLOOM_SPENT_TRIBE
      )
    ]
  }
};
