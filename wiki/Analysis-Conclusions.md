# Analysis Conclusions

## Supported Conclusions

Both experiments show that initial occupied-cell density can change more than the scale of an outcome: it can change the dominant type of trajectory.

For Wildfire, the strongest observed crossover is centred on $90\%$ initial vegetation density. Median burn fraction rises from $3.756\%$ at $89\%$ to $27.629\%$ at $90\%$ and $53.329\%$ at $91\%$. Run variability is maximal at $90\%$, where the burn-fraction IQR reaches $37.321$ percentage points, then drops to $2.343$ points at $91\%$. This combination of a rising median and a narrow post-transition distribution is stronger evidence than the median alone.

For Epidemic, the clearest change is between $41\%$ and $42\%$ initial population density. Median infection episodes per initial population rise from $0.0717$ to $1.8876$, peak prevalence from $0.403\%$ to $3.211\%$, mortality from $0.135\%$ to $3.519\%$, and duration from $1\,092$ to $3\,189.5$ generations. Infectious-duration variability is greatest at $41\%$, immediately below the large shift in the median.

These transitions arise in different mechanisms:

- Wildfire density controls whether mixed-resistance fuel supports a self-sustaining fire front.
- Epidemic density controls local contact connectivity while recovery, waning immunity, and mortality continually change the available population.

## Dynamics Above The Transition

Wildfire and Epidemic diverge after sustained spread becomes typical.

- Wildfire intensity continues to increase with density, but duration falls above its transition because broad connected fronts consume available fuel faster.
- Epidemic duration continues to increase because `Recovered` cells can become `Susceptible` and be infected again. At the same time, the first major peak occurs earlier as density increases above $42\%$.
- Wildfire fuel resistance produces a consistent `Grass`, `Bush`, `Tree` loss ordering.
- Epidemic infection episodes can greatly exceed the initial population, demonstrating repeated transitions rather than a unique-person attack fraction.

## Resurgence Evidence

Qualifying Epidemic resurgences occur in $31$ of $330$ runs and are sparse across density. The current data supports the statement that post-outbreak resurgence is possible under the preset's local spread and waning immunity. It does not support a monotonic relationship between density and resurgence count.

Wildfire does not present resurgence episodes.

## Interpretation Boundary

The results support preset-specific regime changes. They do not establish:

- a universal percolation threshold;
- a real-world wildfire or epidemiological parameter estimate;
- numerical agreement with NetLogo Fire, compartmental SIRSD, or another spatial epidemic model;
- robustness to grid size, topology, seed geometry, ruleset random seed, or transition probabilities;
- causality beyond mechanisms encoded directly in the presets.
