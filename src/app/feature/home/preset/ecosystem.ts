import {directRule, Preset, staticRule} from '.';
import {AND_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, EXACTLY_CLAUSE_KIND, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MIN_CLAUSE_KIND, SAME_BECOME_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Sprout tribe ID.
 *
 * @type {string}
 */
const ECOSYSTEM_SPROUT_TRIBE = 'Sprout';

/**
 * Grass tribe ID.
 *
 * @type {string}
 */
const ECOSYSTEM_GRASS_TRIBE = 'Grass';

/**
 * Rabbit tribe ID.
 *
 * @type {string}
 */
const ECOSYSTEM_RABBIT_TRIBE = 'Rabbit';

/**
 * Hungry rabbit tribe ID.
 *
 * @type {string}
 */
const ECOSYSTEM_HUNGRY_RABBIT_TRIBE = 'Hungry Rabbit';

/**
 * Fox tribe ID.
 *
 * @type {string}
 */
const ECOSYSTEM_FOX_TRIBE = 'Fox';

/**
 * Hungry fox tribe ID.
 *
 * @type {string}
 */
const ECOSYSTEM_HUNGRY_FOX_TRIBE = 'Hungry Fox';

/**
 * Ecosystem preset.
 *
 * @type {Preset}
 */
export const ECOSYSTEM_PRESET: Preset = {
  name: 'Ecosystem',
  description: 'Grass, rabbits, and foxes form a trophic cycle',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: ECOSYSTEM_SPROUT_TRIBE,
        color: 'a7c957'
      },
      {
        id: ECOSYSTEM_GRASS_TRIBE,
        color: '386641'
      },
      {
        id: ECOSYSTEM_RABBIT_TRIBE,
        color: 'f2e8cf'
      },
      {
        id: ECOSYSTEM_HUNGRY_RABBIT_TRIBE,
        color: 'bc9f7b'
      },
      {
        id: ECOSYSTEM_FOX_TRIBE,
        color: 'e76f51'
      },
      {
        id: ECOSYSTEM_HUNGRY_FOX_TRIBE,
        color: '9d3c2d'
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
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [ECOSYSTEM_GRASS_TRIBE]
              },
              value: 2
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: ECOSYSTEM_SPROUT_TRIBE
        }
      },
      directRule(ECOSYSTEM_SPROUT_TRIBE, ECOSYSTEM_GRASS_TRIBE),
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [ECOSYSTEM_GRASS_TRIBE]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [ECOSYSTEM_RABBIT_TRIBE]
              },
              value: 1
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [ECOSYSTEM_GRASS_TRIBE]
              },
              value: 2
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: ECOSYSTEM_RABBIT_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [ECOSYSTEM_RABBIT_TRIBE]
            },
            {
              kind: EXACTLY_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [ECOSYSTEM_FOX_TRIBE]
              },
              value: 1
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [ECOSYSTEM_RABBIT_TRIBE]
              },
              value: 2
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: ECOSYSTEM_FOX_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [ECOSYSTEM_RABBIT_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [ECOSYSTEM_GRASS_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: SAME_BECOME_KIND
        }
      },
      directRule(ECOSYSTEM_RABBIT_TRIBE, ECOSYSTEM_HUNGRY_RABBIT_TRIBE),
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [ECOSYSTEM_HUNGRY_RABBIT_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [ECOSYSTEM_GRASS_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: ECOSYSTEM_RABBIT_TRIBE
        }
      },
      directRule(ECOSYSTEM_HUNGRY_RABBIT_TRIBE, DEAD_TRIBE_ID),
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [ECOSYSTEM_FOX_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [ECOSYSTEM_RABBIT_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: SAME_BECOME_KIND
        }
      },
      directRule(ECOSYSTEM_FOX_TRIBE, ECOSYSTEM_HUNGRY_FOX_TRIBE),
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [ECOSYSTEM_HUNGRY_FOX_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [ECOSYSTEM_RABBIT_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: ECOSYSTEM_FOX_TRIBE
        }
      },
      directRule(ECOSYSTEM_HUNGRY_FOX_TRIBE, DEAD_TRIBE_ID),
      staticRule(ECOSYSTEM_GRASS_TRIBE)
    ]
  }
};
