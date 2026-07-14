import {Preset, staticRule} from '.';
import {AND_CLAUSE_KIND, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE, DIFFERENT_IN_TRIBE_SELECTOR_KIND, IS_CLAUSE_KIND, MAJORITY_BECOME_KIND, MIN_CLAUSE_KIND, SAME_BECOME_KIND, SAME_TRIBE_SELECTOR_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Coral culture tribe ID.
 *
 * @type {string}
 */
const INNOVATION_WAVES_CORAL_TRIBE = 'Coral';

/**
 * Teal culture tribe ID.
 *
 * @type {string}
 */
const INNOVATION_WAVES_TEAL_TRIBE = 'Teal';

/**
 * Violet culture tribe ID.
 *
 * @type {string}
 */
const INNOVATION_WAVES_VIOLET_TRIBE = 'Violet';

/**
 * New Coral innovation tribe ID.
 *
 * @type {string}
 */
const INNOVATION_WAVES_NEW_CORAL_TRIBE = 'New Coral';

/**
 * New Teal innovation tribe ID.
 *
 * @type {string}
 */
const INNOVATION_WAVES_NEW_TEAL_TRIBE = 'New Teal';

/**
 * New Violet innovation tribe ID.
 *
 * @type {string}
 */
const INNOVATION_WAVES_NEW_VIOLET_TRIBE = 'New Violet';

/**
 * Established culture tribes.
 *
 * @type {string[]}
 */
const INNOVATION_WAVES_ESTABLISHED_TRIBES: [string, ...string[]] = [INNOVATION_WAVES_CORAL_TRIBE, INNOVATION_WAVES_TEAL_TRIBE, INNOVATION_WAVES_VIOLET_TRIBE];

/**
 * Active innovation tribes.
 *
 * @type {string[]}
 */
const INNOVATION_WAVES_NEW_TRIBES: [string, ...string[]] = [INNOVATION_WAVES_NEW_CORAL_TRIBE, INNOVATION_WAVES_NEW_TEAL_TRIBE, INNOVATION_WAVES_NEW_VIOLET_TRIBE];

/**
 * All non-dead Innovation Waves tribes.
 *
 * @type {string[]}
 */
const INNOVATION_WAVES_ACTIVE_TRIBES: [string, ...string[]] = [...INNOVATION_WAVES_ESTABLISHED_TRIBES, ...INNOVATION_WAVES_NEW_TRIBES];

/**
 * Innovation Waves preset.
 *
 * @type {Preset}
 */
export const INNOVATION_WAVES_PRESET: Preset = {
  name: 'Innovation Waves',
  description: 'Rare innovations trigger sudden cultural takeovers',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: INNOVATION_WAVES_CORAL_TRIBE,
        color: 'c8554f'
      },
      {
        id: INNOVATION_WAVES_TEAL_TRIBE,
        color: '1b998b'
      },
      {
        id: INNOVATION_WAVES_VIOLET_TRIBE,
        color: '6a4c93'
      },
      {
        id: INNOVATION_WAVES_NEW_CORAL_TRIBE,
        color: 'ff6b6b'
      },
      {
        id: INNOVATION_WAVES_NEW_TEAL_TRIBE,
        color: '2ec4b6'
      },
      {
        id: INNOVATION_WAVES_NEW_VIOLET_TRIBE,
        color: '9b5de5'
      }
    ],
    rules: [
      /*
       * Critical cascade:
       * if an established culture sees at least two active innovations,
       * it is very likely to adopt the locally dominant innovation.
       */
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: INNOVATION_WAVES_ESTABLISHED_TRIBES
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: INNOVATION_WAVES_NEW_TRIBES
              },
              value: 2
            }
          ]
        },
        become: {
          kind: MAJORITY_BECOME_KIND,
          selector: {
            kind: TRIBES_SELECTOR_KIND,
            tribes: INNOVATION_WAVES_NEW_TRIBES
          },
          tie: {
            kind: SAME_BECOME_KIND
          },
          fallback: {
            kind: SAME_BECOME_KIND
          }
        },
        probability: 60
      },

      /*
       * Weak diffusion:
       * a single innovative neighbour can occasionally persuade a cell,
       * but most isolated innovations fail.
       */
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: INNOVATION_WAVES_ESTABLISHED_TRIBES
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: INNOVATION_WAVES_NEW_TRIBES
              },
              value: 1
            }
          ]
        },
        become: {
          kind: MAJORITY_BECOME_KIND,
          selector: {
            kind: TRIBES_SELECTOR_KIND,
            tribes: INNOVATION_WAVES_NEW_TRIBES
          },
          tie: {
            kind: SAME_BECOME_KIND
          },
          fallback: {
            kind: SAME_BECOME_KIND
          }
        },
        probability: 0.5
      },

      /*
       * Maturation:
       * active innovations eventually become ordinary established culture.
       */
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [INNOVATION_WAVES_NEW_CORAL_TRIBE]
        },
        become: {
          kind: 'fixed',
          tribe: INNOVATION_WAVES_CORAL_TRIBE
        },
        probability: 10
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [INNOVATION_WAVES_NEW_TEAL_TRIBE]
        },
        become: {
          kind: 'fixed',
          tribe: INNOVATION_WAVES_TEAL_TRIBE
        },
        probability: 10
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [INNOVATION_WAVES_NEW_VIOLET_TRIBE]
        },
        become: {
          kind: 'fixed',
          tribe: INNOVATION_WAVES_VIOLET_TRIBE
        },
        probability: 10
      },

      /*
       * Ordinary cultural pressure:
       * between waves, established cultures still consolidate locally.
       */
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: INNOVATION_WAVES_ESTABLISHED_TRIBES
            },
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: DIFFERENT_IN_TRIBE_SELECTOR_KIND,
                  tribes: INNOVATION_WAVES_ESTABLISHED_TRIBES
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: SAME_TRIBE_SELECTOR_KIND
                }
              },
              operator: '≥',
              margin: 1
            }
          ]
        },
        become: {
          kind: MAJORITY_BECOME_KIND,
          selector: {
            kind: TRIBES_SELECTOR_KIND,
            tribes: INNOVATION_WAVES_ESTABLISHED_TRIBES
          },
          tie: {
            kind: SAME_BECOME_KIND
          },
          fallback: {
            kind: SAME_BECOME_KIND
          }
        }
      },

      /*
       * Slow boundary drift:
       * established borders keep moving slightly instead of freezing perfectly.
       */
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: INNOVATION_WAVES_ESTABLISHED_TRIBES
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: DIFFERENT_IN_TRIBE_SELECTOR_KIND,
                tribes: INNOVATION_WAVES_ESTABLISHED_TRIBES
              },
              value: 1
            }
          ]
        },
        become: {
          kind: MAJORITY_BECOME_KIND,
          selector: {
            kind: DIFFERENT_IN_TRIBE_SELECTOR_KIND,
            tribes: INNOVATION_WAVES_ESTABLISHED_TRIBES
          },
          tie: {
            kind: SAME_BECOME_KIND
          },
          fallback: {
            kind: SAME_BECOME_KIND
          }
        },
        probability: 0.1
      },

      /*
       * Rare innovation:
       * innovations appear mostly inside highly homogeneous established regions.
       */
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [INNOVATION_WAVES_CORAL_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: SAME_TRIBE_SELECTOR_KIND
              },
              value: 6
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: INNOVATION_WAVES_NEW_TEAL_TRIBE
        },
        probability: 0.001
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [INNOVATION_WAVES_CORAL_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: SAME_TRIBE_SELECTOR_KIND
              },
              value: 6
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: INNOVATION_WAVES_NEW_VIOLET_TRIBE
        },
        probability: 0.001
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [INNOVATION_WAVES_TEAL_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: SAME_TRIBE_SELECTOR_KIND
              },
              value: 6
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: INNOVATION_WAVES_NEW_CORAL_TRIBE
        },
        probability: 0.001
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [INNOVATION_WAVES_TEAL_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: SAME_TRIBE_SELECTOR_KIND
              },
              value: 6
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: INNOVATION_WAVES_NEW_VIOLET_TRIBE
        },
        probability: 0.001
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [INNOVATION_WAVES_VIOLET_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: SAME_TRIBE_SELECTOR_KIND
              },
              value: 6
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: INNOVATION_WAVES_NEW_CORAL_TRIBE
        },
        probability: 0.001
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [INNOVATION_WAVES_VIOLET_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: SAME_TRIBE_SELECTOR_KIND
              },
              value: 6
            }
          ]
        },
        become: {
          kind: 'fixed',
          tribe: INNOVATION_WAVES_NEW_TEAL_TRIBE
        },
        probability: 0.001
      },
      staticRule(...INNOVATION_WAVES_ACTIVE_TRIBES)
    ]
  }
};
