# Rule Cost Model

## Purpose

This page defines the rough per-cell worst-case cost model used to compare rule shapes.

The units are comparative estimates for generated shader work, not timing guarantees. One unit represents one simple comparison, boolean operation, arithmetic operation, branch test, or assignment.

Costs are worst-case estimates for a cell that evaluates the expression or reaches the rule branch being described. They are not necessarily paid by every cell in the whole ruleset: first-match-wins rule ordering can skip later branches, and some outcome paths such as ranked tie/fallback handling or combine rows only run when their branch reaches that path.

For selector, clause, and outcome semantics, see [Rule expressions](Rule-Expressions). For the WGSL generation pipeline, see [Rules engine internals](Rules-Engine-Internals).

## Shared Work

A one-condition count over the eight Moore neighbors costs `8` units.

Clause count selectors are precomputed once per unique selector and reused by every clause that needs the same count. Cost estimates for a standalone expression include the count unless otherwise stated; when a count is already available, only the expression-specific check is additional.

Direct assignments and simple current-cell checks cost `1` unit.

## Cost Terms

| Term                    | Meaning                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `selectedTribeCount`    | Number of explicit tribe IDs in a `tribes` or `different-in` selector.                                                   |
| `countCost`             | Cost of computing one selector's neighbor count. A one-tribe selector, `same`, or `different` costs `8` when not reused. |
| `leftCountCost`         | Count cost for the left side of a comparison.                                                                            |
| `rightCountCost`        | Count cost for the right side of a comparison.                                                                           |
| `tribeCount`            | Active tribe count, including `dead`.                                                                                    |
| `candidateCount`        | Candidate tribe IDs considered by a ranked outcome.                                                                      |
| `rankingOverhead`       | `4 * candidateCount`. Per candidate: eligibility check, non-zero check, best-count comparison, and tie-count path.       |
| `selectedTieOrFallback` | Cost of the tie or fallback outcome path that actually runs after ranking.                                               |
| `nonDeadTribeCount`     | Active tribe count excluding `dead`.                                                                                     |
| `rowInputCost`          | Cost of evaluating lookup-row input selectors in a combine outcome.                                                      |
| `rowCount`              | Number of lookup rows in a combine outcome.                                                                              |

## Rule Branches

A deterministic `100%` rule branch costs:

```text
1 + clause + outcome
```

The leading `1` is the rule branch test.

A probabilistic rule with probability greater than `0` and less than `100` adds `10` units for the deterministic hash/threshold guard.

Muted rules and rules with probability `0` do not emit active rule branches. Outcome work is only paid on the branch that executes.

## Selector Costs

### `tribes`

As a count selector:

```text
8 * selectedTribeCount
```

Each neighbor is compared against the selected tribe IDs.

As a ranked selector, the explicit list is the candidate list:

```text
8 * selectedTribeCount + rankingOverhead
```

For this selector form, `candidateCount = selectedTribeCount`.

Explicit selector signatures are sorted and deduplicated for stable reuse.

### `same`

As a count selector:

```text
8
```

As a ranked selector:

```text
8 * tribeCount + rankingOverhead
```

The ranked implementation still iterates the full tribe list as candidate IDs and uses `candidate == selfTribe` as the eligibility check.

### `different`

As a count selector:

```text
8
```

As a ranked selector:

```text
8 * tribeCount + rankingOverhead
```

The ranked implementation still iterates the full tribe list and uses `candidate != selfTribe` as the eligibility check.

### `different-in`

As a count selector:

```text
8 * selectedTribeCount
```

Each neighbor is compared against the selected tribe IDs and against the current cell tribe.

As a ranked selector:

```text
8 * selectedTribeCount + rankingOverhead
```

For this selector form, `candidateCount = selectedTribeCount`; per-candidate eligibility also excludes `candidate == selfTribe`.

### `tie`

Inside ranked tie handling, `tie` reuses the current ranked state:

```text
0
```

When used in a combine row, each tied candidate referenced by the row can add `8` units for a candidate neighbor count.

Outside a ranked tie branch, the compiler has no tie state and treats the selector like its `source`.

## Clause Costs

| Clause       | Cost                                       |
| ------------ | ------------------------------------------ |
| `is`         | `selectedTribeCount`                       |
| `count`      | `countCost + 2`                            |
| `none`       | `countCost + 1`                            |
| `exactly`    | `countCost + 1`                            |
| `min`        | `countCost + 1`                            |
| `max`        | `countCost + 1`                            |
| `comparison` | `leftCountCost + rightCountCost + 1`       |
| `not`        | `childClause + 1`                          |
| `and`        | `sum(childClauses) + (childCount - 1)`     |
| `or`         | `sum(childClauses) + (childCount - 1)`     |
| `xor`        | `sum(childClauses) + (2 * childCount) + 1` |
| `empty`      | `0`                                        |

### Simplified Constant Clauses

Some clause shapes compile to constants and avoid unnecessary count work:

- `count` with `[0, 8]` costs `0`;
- `min 0` costs `0`;
- `max 8` costs `0`;
- `is` covering every known tribe can cost `0` as `true`;
- `is` resolving to no known tribe can cost `0` as `false`;
- `empty` costs `0` and always compiles to `false`.

### Reused Counts

When a selector count has already been precomputed, only the final test is additional:

```text
count       +2
none        +1
exactly     +1
min         +1
max         +1
```

A comparison likewise reuses either side independently when its count is already available.

## Outcome Costs

### `fixed`

```text
1
```

A direct assignment to one tribe index.

### `same`

```text
1
```

A direct assignment from the current cell value.

### `majority` and `minority`

Ranked outcomes cost:

```text
8 * candidateCount + rankingOverhead + selectedTieOrFallback
```

where:

```text
rankingOverhead = 4 * candidateCount
```

For a `tribes` selector, `candidateCount` is the explicit selector size, so `candidateCount = selectedTribeCount`.

For `same` and `different`, `candidateCount` is the full tribe list size. For `tribes` and `different-in`, `candidateCount` is the selected tribe count. Per-candidate eligibility checks determine which candidates can participate for the current cell.

Only the tie or fallback path that actually runs is counted in `selectedTieOrFallback`.

### `combine`

Combine outcomes cost:

```text
8 * nonDeadTribeCount + 8 + rowInputCost + rowCount
```

The terms are:

```text
8 * nonDeadTribeCount    build the base non-dead input mask
8                        detect whether any dead neighbor is present
rowInputCost             8 units per non-dead candidate referenced by row inputs
rowCount                 one mask comparison per lookup row
```

Rows that explicitly include `dead` add a cheap `deadPresent` condition.

Large tribe lists or combination tables can make generated shaders noticeably larger and slower.

This is the worst-case cost once the combine outcome runs. A row that matches early can avoid later row checks at runtime, but the formula counts all rows so lookup tables can be compared conservatively.

## Whole-Ruleset Considerations

### Rule Count and Order

More rules increase branch work and shader size.

Rule order matters because the engine uses first-match-wins evaluation. Earlier rules can prevent later branches from being evaluated.

A fixed-`dead` rule often adds work without changing the result because `result` already starts as `dead`. It is generally preferable to narrow a later positive rule unless the earlier branch deliberately exists to block it.

### Probabilistic Rules

Failed probabilistic rolls continue to later rules.

Overlapping probabilistic rules can therefore pay multiple clause and branch costs for the same cell before one applies or the chain ends.

### Bounded Topology

Bounded topology can add overhead near grid edges because off-grid neighbor reads must resolve to the virtual boundary tribe.

Interior bounded cells use a faster direct path, so this extra cost is concentrated on packed words that contain grid edges.

## Worked Examples

### Conway Birth

The standalone rule:

```text
is dead
AND exactly 3 Alive neighbors
→ fixed Alive
```

costs `13` units:

```text
8    Alive count
1    is dead
1    exactly 3
1    boolean AND
1    rule branch
1    fixed outcome
---
13
```

### Conway Survival

The standalone rule:

```text
is Alive
AND count Alive in [2, 3]
→ same
```

costs `14` units:

```text
8    Alive count
1    is Alive
2    range check
1    boolean AND
1    rule branch
1    same outcome
---
14
```

When paired with Conway birth, the `Alive` count is already available. Adding survival therefore costs only `6` additional units.

### Probabilistic Spread

A rule that matches `Paper`, requires at least one `Fire` neighbor, and becomes `Fire` with probability `6.25%` costs `23` units:

```text
8    Fire count
1    is Paper
1    min Fire 1
1    boolean AND
1    rule branch
10   probability hash/threshold guard
1    fixed outcome
---
23
```

A failed roll continues to later rules.

### Ranked Majority

For:

```text
different count >= 1
→ majority different
→ same on tie or fallback
```

the cost is:

```text
11 + 8 * tribeCount + rankingOverhead
```

The fixed `11` contains the `different` count clause, rule branch, and selected `same` tie/fallback path.

### Combine With Dead Priority

For the example with:

```text
[Red, Blue, dead] → Ash
[Red, Blue]       → Purple
default           → dead
```

the cost is:

```text
45 + 8 * nonDeadTribeCount
```

The fixed `45` contains:

```text
2    rule branch + is dead
8    dead-presence count
2    lookup row comparisons
32   four non-dead row-input references
1    default fixed outcome
---
45
```

The base mask adds `8 * nonDeadTribeCount`.

The explicit-dead row must be checked first because it has the same non-dead mask as the Red+Blue row.
