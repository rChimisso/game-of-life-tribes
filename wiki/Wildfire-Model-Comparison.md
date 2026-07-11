# Wildfire Model Comparison

## Scope Of The Comparison

The [NetLogo Fire model](https://ccl.northwestern.edu/netlogo/models/Fire) is a useful reference because it also demonstrates a density-controlled nonlinear transition in a spatial forest. The comparison here is qualitative and structural.

> **Note**: no NetLogo runs are included, and the two models do not share rules, geometry, ignition, or outcome definitions.

## NetLogo Fire And GoLT Wildfire

| Feature                           | NetLogo Fire                                        | GoLT Wildfire experiment                                                  |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| Fuel states                       | Tree or empty                                       | Grass, Bush, Tree, Char, and empty (`dead`)                               |
| Neighborhood                      | Default to Four orthogonal neighbors                | Eight Moore neighbors                                                     |
| Ignition                          | Any adjacent burning tree                           | Vegetation-specific thresholds from 1 to 5 burning neighbors              |
| Fire lifecycle                    | Fire front becomes ember/burned                     | Blaze → Fire → Ember → Char                                               |
| Ignition geometry                 | Fire starts along the left edge                     | $12$ seeded active cells                                                  |
| Topology in documented experiment | Finite world used to test left-to-right crossing    | $512\times512$ torus                                                      |
| Primary question                  | Whether fire reaches the right edge; percent burned | Fraction burned, type-specific loss, duration, intensity, and variability |
| Fuel regrowth                     | None in the standard one-shot model                 | Recolonization rule present but muted                                     |

The NetLogo documentation reports a sharp transition around $59\%$ tree density for its left-to-right crossing experiment. The GoLT experiment's strongest change is around $90\%$ initial vegetation density. These numbers must not be treated as competing estimates of the same threshold.

The most important reasons are:

- Four-neighbor and eight-neighbor connectivity have different percolation behavior.
- NetLogo uses one combustible tree state; GoLT mixes three resistance classes.
- NetLogo ignites a boundary, while GoLT uses a small seed.
- Reaching the opposite boundary is not the same endpoint as total fraction burned.
- A finite boundary and a torus create different long paths and edge effects.
- GoLT's staged fire states and threshold-dependent ignition duration change local propagation.

There is also an important difference in where randomness enters. NetLogo's Fire rules use stochastic ignition, whereas the GoLT Wildfire evolution rules are deterministic once the initial grid is fixed. The GoLT experiment still has run-to-run variation because the randomized brush strokes create different initial fuel layouts; that is not rule-level randomness. Despite this difference, both models exhibit the same qualitative density-driven crossover, which strengthens the structural comparison without making it a quantitative validation.

## What The Qualitative Agreement Means

Both models show the same broad complex-systems lesson: a smooth change in initial density can produce an abrupt change in macroscopic spread, with strong run-to-run variability near the crossover. That structural agreement is meaningful. It does not establish numerical validation of either model against the other or against real wildfire data.

The GoLT analysis additionally resolves heterogeneous fuel response. The observed `Grass > Bush > Tree` loss ordering follows directly from its resistance rules and has no counterpart in the binary NetLogo forest.

## A Matched Comparison

A direct comparison would require both platforms to use the same:

1. Grid dimensions and boundary topology.
2. Eight-neighbor definition.
3. Binary or matched multi-type fuel composition.
4. Ignition geometry and seed size.
5. Fire-state duration and transmission rule.
6. Density values, random seeds, and repetition count.
7. Stopping rule and endpoint, including a common crossing or burn-fraction definition.
