# Wildfire Analysis

## Preset Dynamics

The active-fire lifecycle is deterministic:

```text
Blaze → Fire → Ember → Char
```

All three active-fire states count equally as burning neighbors. Vegetation resistance determines both whether ignition occurs and its initial intensity:

| Vegetation |                  Ember at | Fire at | Blaze at |
| ---------- | ------------------------: | ------: | -------: |
| Grass      |  $\geq1$ burning neighbor | $\geq2$ |  $\geq3$ |
| Bush       | $\geq2$ burning neighbors | $\geq3$ |  $\geq4$ |
| Tree       | $\geq3$ burning neighbors | $\geq4$ |  $\geq5$ |

Grass, Bush, Tree, Char otherwise remain unchanged.

## Derived Metrics

Initial fuel is the first recorded `Grass + Bush + Tree` population. Total burn fraction is:

$$
\frac{\text{initial fuel}-\text{final fuel}}{\text{initial fuel}}
$$

Vegetation-specific burn fractions use the same formula separately for Grass, Bush, and Tree. Active fire is simply `Ember + Fire + Blaze`.

- **Fire duration**: final active-fire generation minus first recorded generation.
- **Peak active fire**: largest active-fire count divided by initial fuel.
- **Time to peak**: peak generation minus first recorded generation.
- **Maximum burn rate**: largest positive one-generation loss of Grass, Bush, and Tree, divided by initial fuel.
- **Cumulative burn fraction**: fuel lost up to each generation, divided by initial fuel.

## Outcome Distribution

At low and intermediate densities, the seeded fire usually remains local. Median burn fraction is $0.0110\%$ at $50\%$ density and $0.0819\%$ at $80\%$. At $100\%$, the median is $87.469\%$; even a fully occupied grid does not imply total consumption because resistant Tree clusters can remain after the fire front disappears.

![Wildfire outcome distribution across all sampled densities](images/analysis-wildfire-outcomes.png)

The detailed sweep shows a sharp crossover around 90%:

| Density | Median burned |        Q25 |        Q75 |                IQR |
| ------: | ------------: | ---------: | ---------: | -----------------: |
|  $85\%$ |     $0.251\%$ |  $0.117\%$ |  $0.411\%$ |  $0.295\text{ pp}$ |
|  $86\%$ |     $0.363\%$ |  $0.220\%$ |  $0.629\%$ |  $0.409\text{ pp}$ |
|  $87\%$ |     $0.632\%$ |  $0.432\%$ |  $1.537\%$ |  $1.105\text{ pp}$ |
|  $88\%$ |     $1.429\%$ |  $0.706\%$ |  $2.405\%$ |  $1.700\text{ pp}$ |
|  $89\%$ |     $3.756\%$ |  $0.901\%$ | $11.439\%$ | $10.538\text{ pp}$ |
|  $90\%$ |    $27.629\%$ |  $2.475\%$ | $39.797\%$ | $37.321\text{ pp}$ |
|  $91\%$ |    $53.329\%$ | $52.187\%$ | $54.530\%$ |  $2.343\text{ pp}$ |
|  $92\%$ |    $60.496\%$ | $59.043\%$ | $60.991\%$ |  $1.948\text{ pp}$ |
|  $93\%$ |    $64.753\%$ | $64.201\%$ | $65.743\%$ |  $1.542\text{ pp}$ |
|  $94\%$ |    $68.655\%$ | $68.100\%$ | $68.957\%$ |  $0.857\text{ pp}$ |
|  $95\%$ |    $72.015\%$ | $71.628\%$ | $72.364\%$ |  $0.736\text{ pp}$ |

The IQR peaks at $90\%$, where identical density settings produce both rapid fadeouts and large burns. It then collapses at $91\%$ as large connected burns become the dominant outcome.

![Wildfire burn-fraction IQR](images/analysis-wildfire-iqr.png)

Rare fadeouts still persist above the central crossover. At $91\%$, $3$ of $30$ runs burn less than $1\%$, while $26$ burn more than $50\%$. At $93\%$, one run burns $1.234\%$ and the other $29$ exceed $50\%$.

![Wildfire regime-change highlight](images/analysis-wildfire-regime-change.png)

## Vegetation Type

Median loss follows `Grass > Bush > Tree` at every sampled density, matching the preset's ordered ignition thresholds.

| Density | Grass burned | Bush burned | Tree burned |
| ------: | -----------: | ----------: | ----------: |
|  $89\%$ |     $5.72\%$ |    $3.84\%$ |    $1.72\%$ |
|  $90\%$ |    $41.68\%$ |   $28.17\%$ |   $13.01\%$ |
|  $91\%$ |    $78.74\%$ |   $55.12\%$ |   $26.39\%$ |
|  $95\%$ |    $95.24\%$ |   $76.44\%$ |   $44.48\%$ |
| $100\%$ |    $99.28\%$ |   $91.93\%$ |   $71.20\%$ |

These are fractions of each vegetation type's own initial population, not shares of all burned cells.

![Burn fraction by vegetation type](images/analysis-wildfire-vegetation.png)

## Fire Dynamics

Duration is longest and most variable around the crossover. Median duration rises from $332$ generations at $89\%$ to $855.5$ at $90\%$, then falls to $738.5$ at $91\%$, $592.5$ at $92\%$, and $383$ at $100\%$. The longest individual run lasts $1\,470$ generations at $89\%$.

At the same time, intensity rises with density. Median peak active-fire fraction is $0.0480\%$ at $89\%$, $0.1038\%$ at $90\%$, $0.2399\%$ at $91\%$, and $0.8482\%$ at $100\%$. Median maximum burn rate rises from $0.0347\%$ of initial fuel per generation at $89\%$ to $0.5274\%$ at $100\%$.

Together, these results distinguish two effects: near the crossover, uncertain connectivity produces long, variable exploration of the fuel network; above it, broader fronts consume fuel more intensely and finish sooner.

![Wildfire duration, peak, time-to-peak, and burn-rate metrics](images/analysis-wildfire-fire-metrics.png)

## Trajectories And Representative Runs

Individual cumulative-burn trajectories separate into distinct fadeout and sustained-spread outcomes near $90\%$. The transition figure selects $90\%$ runs nearest the $10\text{th}$, $50\text{th}$, and $90\text{th}$ burn-fraction percentiles:

| Representative role  |  Run |     Burned | Duration |
| -------------------- | ---: | ---------: | -------: |
| Nearest $\text{p}10$ |  $7$ |  $0.678\%$ |    $141$ |
| Nearest $\text{p}50$ | $28$ | $27.324\%$ |    $587$ |
| Nearest $\text{p}90$ |  $5$ | $43.984\%$ |    $904$ |

![Wildfire trajectories by density](images/analysis-wildfire-trajectories.png)

![Representative Wildfire transition runs](images/analysis-wildfire-transition-runs.png)

### Transition Runs In Motion

The three recordings below use the same $90\%$ density and correspond to the representative runs in the table and figure above. Together they show how randomized initial vegetation layouts produce rapid fadeout, intermediate spread, or a large burn even though the subsequent Wildfire evolution is deterministic.

|                                                                                              Low outcome — Run $7$                                                                                              |                                                                                             Median outcome — Run $28$                                                                                              |                                                                                              High outcome — Run $5$                                                                                              |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| <video controls muted playsinline preload="metadata" width="100%"><source src="videos/analysis/wildfire/wildfire-90-run-07-low.mp4" type="video/mp4">Your browser does not support embedded video.</video> | <video controls muted playsinline preload="metadata" width="100%"><source src="videos/analysis/wildfire/wildfire-90-run-28-median.mp4" type="video/mp4">Your browser does not support embedded video.</video> | <video controls muted playsinline preload="metadata" width="100%"><source src="videos/analysis/wildfire/wildfire-90-run-05-high.mp4" type="video/mp4">Your browser does not support embedded video.</video> |
|                                                                                      $0.678\%$ burned<br>$141$ generations                                                                                      |                                                                                       $27.324\%$ burned<br>$587$ generations                                                                                       |                                                                                      $43.984\%$ burned<br>$904$ generations                                                                                      |

### Typical Runs Across Regimes

The $50\%$ run is intentionally brief: its four-generation fadeout is representative of a regime in which fire cannot find a connected path through the fuel. The $100\%$ run shows the contrasting broad fire front and the survival of some resistant vegetation.

|                                                                                              Typical $50\%$ — Run $24$                                                                                              |                                                                                              Typical $100\%$ — Run $6$                                                                                               |
| :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| <video controls muted playsinline preload="metadata" width="100%"><source src="videos/analysis/wildfire/wildfire-50-run-24-typical.mp4" type="video/mp4">Your browser does not support embedded video.</video> | <video controls muted playsinline preload="metadata" width="100%"><source src="videos/analysis/wildfire/wildfire-100-run-06-typical.mp4" type="video/mp4">Your browser does not support embedded video.</video> |
|                                                                                        $0.0114\%$ burned<br>$4$ generations                                                                                         |                                                                                        $87.470\%$ burned<br>$381$ generations                                                                                        |

### Long-Lived Near-Transition Fire

The longest Wildfire run in the dataset occurs at $89\%$ density. Run $5$ burns $27.875\%$ of its initial fuel over $1\,470$ generations, illustrating the slow exploration of marginally connected fuel paths near the crossover.

<video controls muted playsinline preload="metadata" width="100%">
  <source src="videos/analysis/wildfire/wildfire-89-run-05-long-lived.mp4" type="video/mp4">
  Your browser does not support embedded video.
</video>
