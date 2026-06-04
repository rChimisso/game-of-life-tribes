import {Preset} from '.';
import {DEAD_TRIBE, AND_CLAUSE_KIND, IS_CLAUSE_KIND, DEAD_TRIBE_ID, OR_CLAUSE_KIND, EXACTLY_CLAUSE_KIND} from '../model/rule';

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
              tribes: [DEAD_TRIBE_ID]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 1,
                  tribes: [REPLICATOR_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 3,
                  tribes: [REPLICATOR_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 5,
                  tribes: [REPLICATOR_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 7,
                  tribes: [REPLICATOR_TRIBE]
                }
              ]
            }
          ]
        },
        tribe: REPLICATOR_TRIBE
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [REPLICATOR_TRIBE]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 1,
                  tribes: [REPLICATOR_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 3,
                  tribes: [REPLICATOR_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 5,
                  tribes: [REPLICATOR_TRIBE]
                },
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 7,
                  tribes: [REPLICATOR_TRIBE]
                }
              ]
            }
          ]
        },
        tribe: REPLICATOR_TRIBE
      }
    ]
  }
};
