# Analysis Limitations And Extensions

## Evidence Boundary

The Wildfire and Epidemic results are descriptive experiments on one $512\times512$ toroidal grid, using one version of each preset, one $12$-cell seeding protocol, a fixed ruleset random seed ($42$), and $30$ runs per density. They locate strong finite-grid crossovers but do not estimate universal critical points.

The main sources of uncertainty are:

- **Finite sample size**: $30$ runs per density reveal the large transition effects, but they give limited precision for rare outcomes such as Epidemic resurgence.
- **One grid size**: no finite-size scaling was performed, so transition location and width may shift with grid dimensions.
- **One topology**: toroidal wrapping removes outer boundaries and can reconnect fronts that would meet an edge in a bounded world.
- **One seed geometry**: seed count is fixed at $12$, but location, shape, and boundary placement were not varied systematically.
- **One preset parameterization**: vegetation thresholds and Epidemic transition probabilities were not swept.
- **Common ruleset seed**: every archive records seed $42$. Different randomized brush layouts produce distinct runs, but the probability field itself was not re-seeded across replicates.

No confidence intervals, hypothesis tests, changepoint model, or finite-size scaling fit has been applied. The boxplots, IQR curves, medians, and quartiles should therefore be read as empirical summaries of the collected runs.

## Data And Metric Limitations

The analysis scripts use aggregate `metrics.csv` rows, downloaded from the engine built-in export. They do not use the spatial pattern inside every recorded generation.

Consequences include:

- Wildfire burn fraction does not identify connected fuel components, front perimeter, crossing probability, or unburned-island geometry.
- Epidemic episodes reconstruct the total number of `S → I` events but do not identify how those events are distributed among cells.
- Aggregate prevalence cannot distinguish $1$ coherent wave from several simultaneous local outbreaks.
- Final-state summaries do not measure spatial clustering, correlation length, or front velocity.

## Resurgence Sensitivity

The resurgence definition uses an $11$-generation centred smoother, $0.15\%$ start threshold, $0.05\%$ end threshold held for $25$ generations, $8\times$ trough-to-peak rebound, and $10$-generation persistence requirement. These are explicit, arbitrary analysis choices rather than preset, derived, or standard parameters.

The current conclusions do not show whether the $31$ runs with at least $1$ resurgence remain the same under nearby settings. The centred mean also uses future values, making it appropriate for retrospective analysis but unsuitable as an online detector.

## Possible Analysis Extensions

### Replication And Uncertainty

- Increase repetitions near $89\text{–}91\%$ Wildfire and $40\text{–}42\%$ Epidemic density.
- Report bootstrap confidence intervals for medians, IQRs, fadeout probability, and any-resurgence probability.
- Predefine endpoints and analysis thresholds in a machine-readable experiment specification.

### Finite-Size And Geometry Tests

- Repeat on several square grid sizes and estimate how crossover location and width change.
- Compare toroidal and bounded topology.
- Vary active seed count, compactness, position, and number of simultaneous foci.
- For a matched NetLogo comparison, add left-edge ignition and a common boundary-crossing endpoint.

### Parameter Sensitivity

- Wildfire: vary vegetation mix, ignition thresholds, fire-state duration, regrowth, and directional effects.
- Epidemic: vary infection, recovery, mortality, and immunity-loss probabilities independently.
- Replace the saturating infection rule with neighbor-count-dependent exposure and compare the transition.
- Perform a sensitivity grid around the resurgence thresholds and smoothing window.

### Spatial Analysis

- Measure connected components, spanning clusters, front speed, perimeter, anisotropy, and correlation length for Wildfire.
- Measure infection-cluster count, wavefront geometry, spatial autocorrelation, and source locations for Epidemic.
- Track each fixed cell's state history to obtain the distribution of reinfections, not only aggregate episodes per initial population.

These extensions would turn the current exploratory result into a more formal computational experiment without changing the conclusions already supported by the archived data.
