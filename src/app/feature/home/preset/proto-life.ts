import {Preset, staticRule} from '.';
import {AND_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, SAME_BECOME_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Nutrient tribe ID.
 *
 * @type {string}
 */
const PROTO_LIFE_NUTRIENT_TRIBE = 'Nutrient';

/**
 * Membrane tribe ID.
 *
 * @type {string}
 */
const PROTO_LIFE_MEMBRANE_TRIBE = 'Membrane';

/**
 * Cytoplasm tribe ID.
 *
 * @type {string}
 */
const PROTO_LIFE_CYTOPLASM_TRIBE = 'Cytoplasm';

/**
 * Core tribe ID.
 *
 * @type {string}
 */
const PROTO_LIFE_CORE_TRIBE = 'Core';

/**
 * Cilium tribe ID.
 *
 * @type {string}
 */
const PROTO_LIFE_CILIUM_TRIBE = 'Cilium';

/**
 * Waste tribe ID.
 *
 * @type {string}
 */
const PROTO_LIFE_WASTE_TRIBE = 'Waste';

/**
 * Proto-Life preset.
 *
 * @type {Preset}
 */
export const PROTO_LIFE_PRESET: Preset = {
  name: 'Proto-Life',
  description: 'Cell-like structures emerge, feed, and compete',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: PROTO_LIFE_NUTRIENT_TRIBE,
        color: '8bc34a'
      },
      {
        id: PROTO_LIFE_MEMBRANE_TRIBE,
        color: '1565c0'
      },
      {
        id: PROTO_LIFE_CYTOPLASM_TRIBE,
        color: '64b5f6'
      },
      {
        id: PROTO_LIFE_CORE_TRIBE,
        color: '7b1fa2'
      },
      {
        id: PROTO_LIFE_CILIUM_TRIBE,
        color: 'fdd835'
      },
      {
        id: PROTO_LIFE_WASTE_TRIBE,
        color: '6d4c41'
      }
    ],
    rules: [
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [PROTO_LIFE_CYTOPLASM_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [DEAD_TRIBE_ID, PROTO_LIFE_NUTRIENT_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_MEMBRANE_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [PROTO_LIFE_MEMBRANE_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [PROTO_LIFE_NUTRIENT_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_CILIUM_TRIBE
        },
        probability: 1
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [PROTO_LIFE_NUTRIENT_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [PROTO_LIFE_CILIUM_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_MEMBRANE_TRIBE
        }
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [PROTO_LIFE_CILIUM_TRIBE]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_CYTOPLASM_TRIBE
        }
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [PROTO_LIFE_MEMBRANE_TRIBE]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_WASTE_TRIBE
        },
        probability: 0.02
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [PROTO_LIFE_MEMBRANE_TRIBE]
            },
            {
              kind: NONE_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [PROTO_LIFE_CYTOPLASM_TRIBE, PROTO_LIFE_CORE_TRIBE]
              }
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_WASTE_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [PROTO_LIFE_MEMBRANE_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [PROTO_LIFE_CYTOPLASM_TRIBE, PROTO_LIFE_CORE_TRIBE]
              },
              value: 1
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [DEAD_TRIBE_ID, PROTO_LIFE_NUTRIENT_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: SAME_BECOME_KIND
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [PROTO_LIFE_MEMBRANE_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [PROTO_LIFE_CYTOPLASM_TRIBE, PROTO_LIFE_CORE_TRIBE]
              },
              value: 1
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [PROTO_LIFE_MEMBRANE_TRIBE]
              },
              value: 1
            }
          ]
        },
        become: {
          kind: SAME_BECOME_KIND
        }
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [PROTO_LIFE_MEMBRANE_TRIBE]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_CYTOPLASM_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [PROTO_LIFE_CYTOPLASM_TRIBE]
            },
            {
              kind: NONE_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [DEAD_TRIBE_ID, PROTO_LIFE_NUTRIENT_TRIBE]
              }
            },
            {
              kind: NONE_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [PROTO_LIFE_MEMBRANE_TRIBE]
              }
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [PROTO_LIFE_CYTOPLASM_TRIBE]
              },
              value: 7
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_CORE_TRIBE
        },
        probability: 0.1
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [PROTO_LIFE_CYTOPLASM_TRIBE]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_WASTE_TRIBE
        },
        probability: 0.05
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [PROTO_LIFE_CYTOPLASM_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [PROTO_LIFE_CYTOPLASM_TRIBE, PROTO_LIFE_CORE_TRIBE]
              },
              value: 3
            }
          ]
        },
        become: {
          kind: SAME_BECOME_KIND
        }
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [PROTO_LIFE_CYTOPLASM_TRIBE]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_WASTE_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [PROTO_LIFE_CORE_TRIBE]
            },
            {
              kind: NONE_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [DEAD_TRIBE_ID, PROTO_LIFE_NUTRIENT_TRIBE]
              }
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [PROTO_LIFE_CYTOPLASM_TRIBE, PROTO_LIFE_CORE_TRIBE]
              },
              value: 6
            }
          ]
        },
        become: {
          kind: SAME_BECOME_KIND
        }
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [PROTO_LIFE_CORE_TRIBE]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_CYTOPLASM_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: IS_CLAUSE_KIND,
              tribes: [PROTO_LIFE_WASTE_TRIBE]
            },
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [PROTO_LIFE_CYTOPLASM_TRIBE, PROTO_LIFE_CORE_TRIBE]
              },
              value: 5
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_CYTOPLASM_TRIBE
        }
      },
      {
        clause: {
          kind: IS_CLAUSE_KIND,
          tribes: [PROTO_LIFE_WASTE_TRIBE]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: PROTO_LIFE_NUTRIENT_TRIBE
        },
        probability: 1
      },
      staticRule(
        DEAD_TRIBE_ID,
        PROTO_LIFE_NUTRIENT_TRIBE,
        PROTO_LIFE_WASTE_TRIBE
      )
    ]
  }
};
