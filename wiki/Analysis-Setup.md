# Analysis Setup And Method

## Study Question

The experiments ask how changing initial occupied-cell density changes the evolution and final outcome of two presets:

- In Wildfire, occupied cells are combustible Grass, Bush, or Tree cells.
- In SIRSD Epidemic, occupied cells are living population cells, initially almost all Susceptible.

The target density was varied while the preset rules, grid, topology, random seed, and initial active cells were kept fixed.

## Run Protocol

For each requested density:

1. Set the brush density and generate the initial vegetation or susceptible population.
2. Place 12 active cells: burning cells for Wildfire or Infectious cells for Epidemic.
3. Run until active fire (`Ember + Fire + Blaze`) or `Infectious` reaches zero.
4. Download the recorded run and its metrics.
5. Restart and repeat until 30 runs have been collected, then move to the next density.

This sweep was automated using the scripts under [`analysis/`](https://github.com/rChimisso/game-of-life-tribes/blob/main/analysis/) in the repository while the project was served locally.

## Shared Configuration

| Setting                 |             Value |
| ----------------------- | ----------------: |
| Grid                    |    $512\times512$ |
| Topology                |          Toroidal |
| Ruleset random seed     |              $42$ |
| Initial active cells    | $12$ active cells |
| Repetitions per density |              $30$ |

Applying a preset does not itself select the grid size, topology, or initial layout, so these settings must be manually set to reproduce the runs.  
The fixed ruleset random seed makes Epidemic probability rolls reproducible for a given cell, generation, and rule. Wildfire has no probabilistic evolution rules, so it is deterministic once its initial grid is fixed, regardless of random seed. Initial brush layouts still differ because brush strokes use a separate advancing randomization counter. Consequently, the runs vary mainly through their randomized initial layouts.

## Density Coverage

### Wildfire

The analysis contains $570$ runs across $19$ densities percentages:

```text
50, 55, 60, 65, 70, 75, 80,
85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95,
100
```

The dense $85-95\%$ sweep contains $330$ runs and was added to resolve the observed regime change from the initial sweep.

### Epidemic

The analysis contains $330$ runs across $11$ densities:

```text
30, 35,
40, 41, 42, 43, 44, 45,
50, 55, 60
```

The dense $40-45\%$ sweep contains $180$ runs and was added to resolve the observed regime change from the initial sweep.
