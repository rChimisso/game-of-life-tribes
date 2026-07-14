# Analysis

This section documents density-sweep experiments performed with the built-in [Wildfire](Presets#wildfire) and [SIRSD Epidemic](Presets#sirsd-epidemic) presets. It covers the run protocol, derived metrics, observed regime changes, and qualitative comparisons with established models.

The reported numbers describe runs automatically collected using the scripts under [`analysis/`](https://github.com/rChimisso/game-of-life-tribes/tree/main/analysis/) in the repository while the project was served locally.  
For reproducibility, snapshots for all analyzed runs can be found [alongside the generation scripts](https://github.com/rChimisso/game-of-life-tribes/tree/main/analysis/snapshots.zip) in the repository.

Note that these runs describe the selected preset rules, grid, and seeding protocol; they are not universal critical thresholds or empirical estimates for real wildfires or epidemics.

## Pages

- [Setup and method](Analysis-Setup): grid configuration, density sweeps, repetitions, validation, stopping rules, and shared metric conventions.
- [Wildfire analysis](Wildfire-Analysis): burn outcomes, vegetation-specific loss, fire dynamics, run variability, and the transition sweep.
- [Wildfire model comparison](Wildfire-Model-Comparison): structural comparison with the NetLogo Fire model and requirements for a matched validation.
- [Epidemic analysis](Epidemic-Analysis): prevalence, infection episodes, mortality, duration, population composition, resurgences, and transition sweep.
- [Epidemic model comparison](Epidemic-Model-Comparison): comparison with compartmental SIRSD and spatial stochastic SIRS models.
- [Conclusions](Analysis-Conclusions): conclusions supported by both experiments and boundaries on their interpretation.
