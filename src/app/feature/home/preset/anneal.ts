import {Preset} from '.';
import {DEAD_TRIBE, AND_CLAUSE_KIND, IS_CLAUSE_KIND, DEAD_TRIBE_ID, OR_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, FIXED_BECOME_KIND, MIN_CLAUSE_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Tribe ID.
 *
 * @type {string}
 */
const ANNEAL_TRIBE = 'Smooth';

/**
 * Anneal preset.
 *
 * @type {Preset}
 */
export const ANNEAL_PRESET: Preset = {
  name: 'Anneal',
  description: 'Converges to smooth blobs',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: ANNEAL_TRIBE,
        color: 'c4c4c4'
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
                  value: 4,
                  selector: {kind: TRIBES_SELECTOR_KIND, tribes: [ANNEAL_TRIBE]}
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  value: 6,
                  selector: {kind: TRIBES_SELECTOR_KIND, tribes: [ANNEAL_TRIBE]}
                }
              ]
            }
          ]
        },
        become: {kind: FIXED_BECOME_KIND, tribe: ANNEAL_TRIBE}
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [ANNEAL_TRIBE]
            },
            {
              kind: OR_CLAUSE_KIND,
              clauses: [
                {
                  kind: EXACTLY_CLAUSE_KIND,
                  value: 3,
                  selector: {kind: TRIBES_SELECTOR_KIND, tribes: [ANNEAL_TRIBE]}
                },
                {
                  kind: MIN_CLAUSE_KIND,
                  value: 5,
                  selector: {kind: TRIBES_SELECTOR_KIND, tribes: [ANNEAL_TRIBE]}
                }
              ]
            }
          ]
        },
        become: {kind: FIXED_BECOME_KIND, tribe: ANNEAL_TRIBE}
      }
    ]
  }
};
