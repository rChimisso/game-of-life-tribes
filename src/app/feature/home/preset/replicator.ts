import {Preset} from '.';
import {DEAD_TRIBE, AND_CLAUSE_KIND, IS_CLAUSE_KIND, DEAD_TRIBE_ID, OR_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, FIXED_BECOME_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Tribe ID.
 *
 * @type {string}
 */
const REPLICATOR_TRIBE = 'Replicant';

/**
 * Replicator preset.
 *
 * @type {Preset}
 */
export const REPLICATOR_PRESET: Preset = {
  name: 'Replicator',
  description: 'Replicates itself indefinitely',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: REPLICATOR_TRIBE,
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
              tribes: [DEAD_TRIBE_ID, REPLICATOR_TRIBE]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [REPLICATOR_TRIBE]
                  },
                  value: 1
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [REPLICATOR_TRIBE]
                  },
                  value: 3
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [REPLICATOR_TRIBE]
                  },
                  value: 5
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  selector: {
                    kind: TRIBES_SELECTOR_KIND,
                    tribes: [REPLICATOR_TRIBE]
                  },
                  value: 7
                }
              ]
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: REPLICATOR_TRIBE
        }
      }
    ]
  }
};
