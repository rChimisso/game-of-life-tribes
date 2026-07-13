import {Preset, staticRule} from '.';
import {AND_CLAUSE_KIND, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE, DEAD_TRIBE_ID, FIXED_BECOME_KIND, MIN_CLAUSE_KIND, TRIBES_SELECTOR_KIND} from '../model/rule';

/**
 * Red primary pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_RED_TRIBE = 'Red';

/**
 * Yellow primary pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_YELLOW_TRIBE = 'Yellow';

/**
 * Blue primary pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_BLUE_TRIBE = 'Blue';

/**
 * Red-yellow mixed pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_ORANGE_TRIBE = 'Orange';

/**
 * Yellow-blue mixed pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_GREEN_TRIBE = 'Green';

/**
 * Blue-red mixed pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_VIOLET_TRIBE = 'Violet';

/**
 * Three-primary mixed pigment tribe ID.
 *
 * @type {string}
 */
const COLOR_MIXING_BROWN_TRIBE = 'Brown';

/**
 * Color Mixing preset.
 *
 * @type {Preset}
 */
export const COLOR_MIXING_PRESET: Preset = {
  name: 'Color Mixing',
  description: 'Neighboring pigments combine into local color mixtures',
  ruleset: {
    tribes: [
      DEAD_TRIBE,
      {
        id: COLOR_MIXING_RED_TRIBE,
        color: 'ff3b30'
      },
      {
        id: COLOR_MIXING_YELLOW_TRIBE,
        color: 'ffcc00'
      },
      {
        id: COLOR_MIXING_BLUE_TRIBE,
        color: '007aff'
      },
      {
        id: COLOR_MIXING_ORANGE_TRIBE,
        color: 'ff9500'
      },
      {
        id: COLOR_MIXING_GREEN_TRIBE,
        color: '34c759'
      },
      {
        id: COLOR_MIXING_VIOLET_TRIBE,
        color: 'af52de'
      },
      {
        id: COLOR_MIXING_BROWN_TRIBE,
        color: '8b5a2b'
      }
    ],
    rules: [
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_RED_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_YELLOW_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '>'
            },
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_RED_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_BLUE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '>'
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: COLOR_MIXING_RED_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_YELLOW_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_RED_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '>'
            },
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_YELLOW_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_BLUE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '>'
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: COLOR_MIXING_YELLOW_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_BLUE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_RED_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '>'
            },
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_BLUE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_YELLOW_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '>'
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: COLOR_MIXING_BLUE_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_RED_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_YELLOW_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '='
            },
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_RED_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_BLUE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '>'
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: COLOR_MIXING_ORANGE_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_YELLOW_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_BLUE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '='
            },
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_YELLOW_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_RED_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '>'
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: COLOR_MIXING_GREEN_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_BLUE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_RED_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '='
            },
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_BLUE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_YELLOW_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '>'
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: COLOR_MIXING_VIOLET_TRIBE
        }
      },
      {
        clause: {
          kind: AND_CLAUSE_KIND,
          clauses: [
            {
              kind: MIN_CLAUSE_KIND,
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [
                  COLOR_MIXING_RED_TRIBE,
                  COLOR_MIXING_YELLOW_TRIBE,
                  COLOR_MIXING_BLUE_TRIBE,
                  COLOR_MIXING_ORANGE_TRIBE,
                  COLOR_MIXING_GREEN_TRIBE,
                  COLOR_MIXING_VIOLET_TRIBE,
                  COLOR_MIXING_BROWN_TRIBE
                ]
              },
              value: 1
            },
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_RED_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_YELLOW_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '='
            },
            {
              kind: COMPARISON_CLAUSE_KIND,
              left: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_YELLOW_TRIBE,
                    COLOR_MIXING_ORANGE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              right: {
                kind: COUNT_CLAUSE_KIND,
                selector: {
                  kind: TRIBES_SELECTOR_KIND,
                  tribes: [
                    COLOR_MIXING_BLUE_TRIBE,
                    COLOR_MIXING_GREEN_TRIBE,
                    COLOR_MIXING_VIOLET_TRIBE,
                    COLOR_MIXING_BROWN_TRIBE
                  ]
                }
              },
              operator: '='
            }
          ]
        },
        become: {
          kind: FIXED_BECOME_KIND,
          tribe: COLOR_MIXING_BROWN_TRIBE
        }
      },
      staticRule(
        DEAD_TRIBE_ID,
        COLOR_MIXING_RED_TRIBE,
        COLOR_MIXING_YELLOW_TRIBE,
        COLOR_MIXING_BLUE_TRIBE,
        COLOR_MIXING_ORANGE_TRIBE,
        COLOR_MIXING_GREEN_TRIBE,
        COLOR_MIXING_VIOLET_TRIBE,
        COLOR_MIXING_BROWN_TRIBE
      )
    ]
  }
};
