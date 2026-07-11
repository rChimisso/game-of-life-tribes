# Rule Expressions

## Purpose

This page is the canonical reference for persisted tribe and rule expressions. Use it when writing snapshots, reading compressed chunk metadata, or understanding the expression language used by rules.

For the `.golt` container layout, header bytes, and packed grid payload, see [Snapshot format](Snapshot-Format). For evaluation order and WGSL generation, see [Rules engine internals](Rules-Engine-Internals). For detailed cost formulas, see [Rule cost model](Rule-Cost-Model).

## Language at a Glance

A rule has a **clause**, which decides whether the rule matches, and an **outcome**, which decides the next tribe:

```text
Rule
├─ Clause
│  ├─ current-cell test
│  ├─ neighbor-count test
│  ├─ count comparison
│  └─ logical composition
│
└─ Outcome
   ├─ fixed / same
   ├─ ranked selection
   └─ combination lookup

Selectors
├─ explicit tribes
├─ same as the current cell
├─ different from the current cell
└─ candidates in the current ranked tie
```

All neighbor-count expressions use the eight-cell Moore neighborhood.

## Rule Structure

### Tribe JSON

Each tribe is a named cell state:

```jsonc
{
  "id": "Alive",
  "color": "ffffff"
}
```

| Field | Meaning |
| --- | --- |
| `id` | Tribe ID used by cells, selectors, outcomes, and `boundaryTribe`. |
| `color` | Six-digit RGB hex color without `#`. |

The `tribes` array is ordered. Packed grid values are numeric indexes into that array: `0` maps to `tribes[0]`, `1` maps to `tribes[1]`, and so on.

Compatible rulesets include the special `dead` tribe, normally:

```jsonc
{
  "id": "dead",
  "color": "000000"
}
```

Rule and boundary references should point to existing tribe IDs.

### Rule JSON

Rules are persisted in this normalized shape:

```jsonc
{
  "clause": { /* ... */ },
  "become": { /* ... */ },
  "probability": 100,
  "muted": false
}
```

| Field | Meaning |
| --- | --- |
| `clause` | Required [clause expression](#clauses). Decides whether the rule matches. |
| `become` | Required [outcome expression](#outcomes). Decides the next tribe when the rule applies. |
| `probability` | Application percentage from `0` through `100`, with up to three decimals. Missing values load as `100`. |
| `muted` | Disables the rule when `true`. Missing values load as `false`. |

Rules are evaluated in array order and use **first-match-wins** semantics.

1. Muted rules and rules with probability `0` are skipped.
2. A matching `100%` rule applies immediately.
3. A matching rule between `0%` and `100%` performs a deterministic roll using the ruleset `randomSeed`.
4. A failed roll continues to later rules.
5. If no rule applies, the result remains `dead`.

### Default Dead Result

Each cell starts with `dead` as its next result. Rulesets should therefore usually describe only cases that keep or create non-dead states.

A fixed-`dead` outcome often adds work without changing the result. It is mainly useful when an earlier rule must deliberately prevent an overlapping later rule from applying. Even then, narrowing the later positive rule is usually clearer.

## Selectors

Selectors define which tribes a clause or dynamic outcome considers.

| `kind` | Selects | Fields | Notes |
| --- | --- | --- | --- |
| `tribes` | An explicit set of tribe IDs | `tribes` | The list must be non-empty. |
| `same` | Neighbors matching the current cell tribe | — | Relative to the current cell. |
| `different` | Neighbors not matching the current cell tribe | — | Includes `dead`. |
| `different-in` | Neighbors not matching the current cell tribe within an explicit set of tribe IDs | `tribes` | The list must be non-empty. |
| `tie` | Candidates tied in the current ranked outcome | `source` | Only has special meaning during ranked tie handling. |

An explicit selector is written as:

```jsonc
{
  "kind": "tribes",
  "tribes": ["Alive", "Trail"]
}
```

Selector meaning depends on context:

- count clauses count matching neighbors;
- ranked outcomes treat matching tribes as candidate results;
- combine inputs test whether matching tribes are present;
- `tie` refers to ranked candidates tied at the winning count.

Explicit tribe selector signatures are sorted and deduplicated for stable reuse during compilation.

### `tie`

A `tie` selector refers to the tied candidates from another selector:

```jsonc
{
  "kind": "tie",
  "source": {
    "kind": "tribes",
    "tribes": ["Red", "Blue", "Green"]
  }
}
```

In a `majority` outcome, these are the candidates tied for the highest non-zero count. In a `minority` outcome, they are the candidates tied for the lowest non-zero count.

The selector is most useful inside a nested `combine` outcome that resolves a ranked tie by inspecting which tied candidates are present.

Outside an actual ranked tie branch, there is no tie state. The compiler then treats `tie` like its `source`; generated rules should avoid relying on that fallback behavior.

## Clauses

Clauses decide whether a rule is eligible to apply to the current cell.

| `kind` | Meaning | Fields |
| --- | --- | --- |
| `is` | The current cell tribe is selected | `tribes` |
| `count` | The selected neighbor count is inside an inclusive interval | `selector`, `interval` |
| `none` | The selected neighbor count is `0` | `selector` |
| `exactly` | The selected neighbor count equals `value` | `selector`, `value` |
| `min` | The selected neighbor count is at least `value` | `selector`, `value` |
| `max` | The selected neighbor count is at most `value` | `selector`, `value` |
| `comparison` | Compare two neighbor counts | `left`, `right`, `operator`, `margin` |
| `not` | Negate one child clause | `clause` |
| `and` | Every child clause matches | `clauses` |
| `or` | At least one child clause matches | `clauses` |
| `xor` | An odd number of child clauses match | `clauses` |
| `empty` | Editor placeholder that never matches | — |

### Current-Cell Tests

`is` matches when the current cell tribe appears in `tribes`:

```jsonc
{
  "kind": "is",
  "tribes": ["dead"]
}
```

A birth rule can start with `is dead`; a survival rule can start with `is Alive`.

If the selected list covers every known tribe, the clause is always true. If no selected ID resolves to a known tribe, it is always false.

### Count Tests

Count clauses operate on one selector over the eight Moore neighbors.

For example:

```jsonc
{
  "kind": "exactly",
  "selector": {
    "kind": "tribes",
    "tribes": ["Alive"]
  },
  "value": 3
}
```

This matches when exactly three `Alive` neighbors are present.

The count forms are equivalent to:

```text
count      min <= count(selector) <= max
none       count(selector) = 0
exactly    count(selector) = value
min        count(selector) >= value
max        count(selector) <= value
```

`count` intervals are inclusive. A full `[0, 8]` interval always matches. Likewise, `min 0` and `max 8` always match.

The compiler precomputes each unique selector count once and reuses it across clauses that need the same count.

### Count Comparisons

`comparison` compares two count expressions. `margin` is added to the right side before comparison:

```jsonc
{
  "kind": "comparison",
  "left": {
    "kind": "count",
    "selector": {
      "kind": "tribes",
      "tribes": ["Red"]
    }
  },
  "right": {
    "kind": "count",
    "selector": {
      "kind": "tribes",
      "tribes": ["Blue"]
    }
  },
  "operator": ">",
  "margin": 1
}
```

This means:

```text
count(Red) > count(Blue) + 1
```

Persisted operators are `"="`, `"≠"`, `">"`, `"<"`, `"≥"`, and `"≤"`. `margin` is clamped to `-8..8`.

### Logical Composition

Logical clauses are recursive.

For example, Conway birth requires both a dead current cell and exactly three live neighbors:

```jsonc
{
  "kind": "and",
  "clauses": [
    {
      "kind": "is",
      "tribes": ["dead"]
    },
    {
      "kind": "exactly",
      "selector": {
        "kind": "tribes",
        "tribes": ["Alive"]
      },
      "value": 3
    }
  ]
}
```

The logical forms are:

```text
not    negate one child
and    every child is true
or     at least one child is true
xor    an odd number of children are true
```

`xor` uses parity semantics: with two children it behaves like ordinary exclusive-or, while with more children it matches whenever the number of matching children is odd.

### `empty`

The editor uses:

```jsonc
{
  "kind": "empty"
}
```

as a temporary placeholder while a rule is being built.

It always evaluates to false. Rules containing empty placeholders are invalid for application and should not be written in generated snapshots intended to run.

## Outcomes

Outcomes decide which tribe a matched rule writes.

| `kind` | Result | Fields |
| --- | --- | --- |
| `fixed` | Write one tribe | `tribe` |
| `same` | Keep the current cell tribe | — |
| `majority` | Choose the most common eligible neighbor tribe | `selector`, `tie`, `fallback` |
| `minority` | Choose the least common eligible neighbor tribe with a non-zero count | `selector`, `tie`, `fallback` |
| `combine` | Resolve an exact set of present inputs through a lookup table | `strategy` |

### Fixed and Same Outcomes

A fixed outcome writes one tribe ID:

```jsonc
{
  "kind": "fixed",
  "tribe": "Alive"
}
```

A same outcome keeps the current cell tribe:

```jsonc
{
  "kind": "same"
}
```

These are the simplest outcomes.

### Ranked Outcomes

`majority` and `minority` choose among candidate tribes supplied by a selector:

```jsonc
{
  "kind": "majority",
  "selector": {
    "kind": "tribes",
    "tribes": ["Red", "Blue", "Green"]
  },
  "tie": {
    "kind": "fixed",
    "tribe": "dead"
  },
  "fallback": {
    "kind": "fixed",
    "tribe": "dead"
  }
}
```

Only candidates with a non-zero neighbor count participate.

- `majority` chooses the highest count.
- `minority` chooses the lowest non-zero count.
- exactly one winning candidate writes that candidate;
- multiple winning candidates evaluate `tie`;
- no candidate evaluates `fallback`.

A no-candidate case occurs when every eligible candidate has count `0`, the selector resolves to no valid candidates, or selector eligibility excludes every candidate for the current cell.

For example:

- `same` has no candidate when there are no same-tribe neighbors;
- `["Red", "Blue"]` has no candidate when neither Red nor Blue is present.

Missing `tie` or `fallback` outcomes fall back to `dead` during shader generation. The editor requires explicit valid outcomes for applied ranked rules.

### Combine Outcomes

`combine` uses unordered lookup rows over selector inputs:

```jsonc
{
  "kind": "combine",
  "strategy": {
    "kind": "lookup",
    "entries": [
      {
        "inputs": [
          {
            "kind": "tribes",
            "tribes": ["Red"]
          },
          {
            "kind": "tribes",
            "tribes": ["Blue"]
          }
        ],
        "output": "Purple"
      }
    ],
    "default": {
      "kind": "fixed",
      "tribe": "dead"
    }
  }
}
```

Each row describes the **exact set of participating inputs** and the tribe to write.

#### Input Order Does Not Matter

A row containing `[Red, Blue]` is equivalent to `[Blue, Red]`. The editor rejects duplicate rows after normalizing input order.

#### Matching Is Exact

A lookup row is not a subset test.

A row for `[Red]` does not match when both Red and Blue are present. The runtime input set must exactly match the row's input set.

#### `dead` Is Handled Separately

`dead` is not represented in the non-dead input mask because it is the absence state and can coexist with any non-dead combination.

Instead, rows that explicitly include `dead` also require `deadPresent`.

This creates an ordering case:

```text
[Red, Blue, dead]
[Red, Blue]
```

Both rows have the same non-dead mask. The row that explicitly requires `dead` must therefore be checked first.

If no row matches, the combine `default` outcome is evaluated.

Inside a ranked tie branch, a nested combine can use a `tie` selector to distinguish which tied candidates are present.

## Compilation

Rule expressions are compiled to WGSL. The compiler:

- collects unique count selectors and computes each once;
- emits clauses as boolean expressions;
- emits outcomes as assignments to `result`;
- emits active rules as one first-match-wins branch chain.

See [Rules engine internals](Rules-Engine-Internals) for the compiler pipeline and generated shader structure.

For example, the Conway birth rule can reduce to:

```wgsl
if (selfTribe == deadIndex && aliveCount == 3u) {
  result = aliveIndex;
}
```

The snippets in this wiki are representative rather than exact generated output; generated local names and numeric tribe indexes may differ.

## Complete Examples

### Conway's Game of Life

Conway's Game of Life can be represented with one birth rule and one survival rule.

#### Birth

```jsonc
{
  "clause": {
    "kind": "and",
    "clauses": [
      {
        "kind": "is",
        "tribes": ["dead"]
      },
      {
        "kind": "exactly",
        "selector": {
          "kind": "tribes",
          "tribes": ["Alive"]
        },
        "value": 3
      }
    ]
  },
  "become": {
    "kind": "fixed",
    "tribe": "Alive"
  },
  "probability": 100,
  "muted": false
}
```

A dead cell becomes `Alive` when exactly three `Alive` neighbors surround it.

#### Survival

```jsonc
{
  "clause": {
    "kind": "and",
    "clauses": [
      {
        "kind": "is",
        "tribes": ["Alive"]
      },
      {
        "kind": "count",
        "selector": {
          "kind": "tribes",
          "tribes": ["Alive"]
        },
        "interval": [2, 3]
      }
    ]
  },
  "become": {
    "kind": "same"
  },
  "probability": 100,
  "muted": false
}
```

An `Alive` cell remains `Alive` with two or three `Alive` neighbors. Otherwise no rule applies and the default result is `dead`.

Both rules use the same `Alive` neighbor selector, so the generated shader computes that count once and reuses it.

### Ranked Majority With Tie Handling

```jsonc
{
  "clause": {
    "kind": "min",
    "selector": {
      "kind": "different"
    },
    "value": 1
  },
  "become": {
    "kind": "majority",
    "selector": {
      "kind": "different"
    },
    "tie": {
      "kind": "same"
    },
    "fallback": {
      "kind": "same"
    }
  },
  "probability": 100,
  "muted": false
}
```

Any cell with at least one different neighbor adopts the most common different neighboring tribe.

A unique winner is written directly. If multiple candidates tie, or no candidate can be selected, the cell keeps its current tribe.

### Combine With Dead Priority

```jsonc
{
  "clause": {
    "kind": "is",
    "tribes": ["dead"]
  },
  "become": {
    "kind": "combine",
    "strategy": {
      "kind": "lookup",
      "entries": [
        {
          "inputs": [
            { "kind": "tribes", "tribes": ["Red"] },
            { "kind": "tribes", "tribes": ["Blue"] },
            { "kind": "tribes", "tribes": ["dead"] }
          ],
          "output": "Ash"
        },
        {
          "inputs": [
            { "kind": "tribes", "tribes": ["Red"] },
            { "kind": "tribes", "tribes": ["Blue"] }
          ],
          "output": "Purple"
        }
      ],
      "default": {
        "kind": "fixed",
        "tribe": "dead"
      }
    }
  },
  "probability": 100,
  "muted": false
}
```

A dead cell becomes `Ash` when Red, Blue, and dead neighbors are all present.

If Red and Blue are present but no dead neighbor is present, it becomes `Purple`.

Any other input set reaches the default outcome and remains dead.

The explicit-dead row is checked first because both rows share the same non-dead mask.

## Performance Notes

The main costs come from neighbor counting and dynamic outcome selection.

- `is`, `fixed`, and `same` are cheap.
- Count clauses evaluate a selector over the eight neighbors.
- Identical selector counts are precomputed once and reused.
- Comparisons may require two distinct counts.
- `majority` and `minority` count neighbors for each candidate tribe.
- `combine` builds an input mask and checks lookup rows.
- More active rules add branch work and shader size.
- Rule order matters because evaluation is first-match-wins.
- Failed probabilistic rolls continue to later rules, so overlapping probabilistic rules can add work.
- Bounded topology can add edge-specific overhead because off-grid reads resolve to the virtual boundary tribe.

See [Rule cost model](Rule-Cost-Model) for detailed formulas and worked cost examples.
