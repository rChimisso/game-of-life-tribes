# Engine Limitations And Extensions

## Current Model Class

The engine is a synchronous finite-state cellular automaton on a rectangular square lattice. Every generation reads the complete current grid and writes a separate next grid, then swaps the buffers.

Current structural constraints are:

- A fixed radius-$1$, $8$-cell Moore neighborhood.
- Toroidal topology or bounded topology with $1$ virtual boundary tribe.
- One discrete tribe value per cell.
- Ordered rules in which the first matching rule whose probability roll succeeds determines the next state.
- Unmatched cells become `dead`.
- Probability rolls are deterministic hashes of cell coordinates, generation, original rule index, and ruleset random seed.

This design is well suited to Life-like rules, multi-state local automata, Wildfire, and lattice epidemics. It does not natively represent continuous fields, arbitrary contact networks, mobile agents, or multiple independent attributes attached to $1$ cell.

These constraints keep the engine a powerful, well-defined superset of Life-like cellular automata rather than a universal cellular-automaton framework. The project began as an extension of Game of Life for multiple tribes with potentially different behavior; later features were chosen to improve expressivity without straying too far from that original idea.

## Neighborhood And Space

The fixed Moore neighborhood prevents exact expression of models that use $4$-neighbor von Neumann contact, larger radii, weighted distance, or direction-specific influence. For example, the standard NetLogo Fire model spreads through $4$ orthogonal neighbors, so it cannot be reproduced exactly.

Useful extensions would include:

- selectable Moore and von Neumann neighborhoods;
- configurable radius;
- directional selectors for wind, slope, or transport;
- weighted kernels for distance-dependent exposure.

These features would need corresponding rule-editor validation, shader generation, cost estimates, snapshot fields, and migration rules.

They have not been implemented because they would expand the engine beyond its Life-like focus, require changes throughout the application, and reduce performance through more expensive neighborhood evaluation.

## State Representation

A tribe is the cell's entire persistent state. Additional memory must be encoded by adding more tribes, as presets such as [Afterimage](Presets#afterimage) and [Senescence](Presets#senescence) already do. This becomes cumbersome when several attributes combine - for example vegetation type × moisture × burn age, or health state × age group × vaccination status.

Possible extensions are:

- multiple packed state channels per cell;
- small integer or fixed-point attributes;
- explicit time-since-transition counters;
- separate immutable cell type and mutable dynamic state;
- optional agent entities that can move across a field.

An agent layer would be a substantial change, but models such as [Sugarscape](https://ccl.northwestern.edu/netlogo/models/Sugarscape1ImmediateGrowback) illustrate why it is useful: agents carry metabolism, vision, and resources while moving over a spatial resource landscape. Encoding that behavior only as fixed cell tribes would not preserve the same model semantics.

These extensions have not been implemented because they would make the state model and GPU pipeline substantially more complex, while increasing memory use and reducing simulation performance.

## Built-in Experiment Automation

The current run-state stop conditions are "none" and target generation. There is no native stop-on-extinction, stop-on-stability, parameter sweep, or multi-repetition runner.

A built-in experiment system could provide:

- density and parameter sweeps;
- repetitions and seed schedules;
- stop conditions based on tribe population, stability, or custom metric expressions;
- headless/background execution;
- automatic export naming and manifests;
- resumable batches and failed-run retry;
- summary statistics after each parameter combination.

NetLogo's [BehaviorSpace](https://docs.netlogo.org/behaviorspace) is a relevant interaction and reproducibility reference, although a WebGPU/browser implementation would need to account for device loss, storage quota, and background throttling.

The project is primarily a concept and interactive engine rather than a high-performance scientific batch-execution tool. It therefore provides basic experimentation capabilities, while extensive sweeps are better suited to a non-browser implementation; the Angular API can also be used to automate experiments, with example scripts available in the repository's [`analysis/`](https://github.com/rChimisso/game-of-life-tribes/blob/main/analysis/) directory.

## Metrics

Offline exports provide tribe populations, deltas, changed cells, births, deaths, switches, diversity, and contact/frontier values. Transition metrics are exact only when consecutive generations are exported.

Current limitations and extensions include:

- Add a full tribe-to-tribe transition matrix instead of reconstructing preset-specific flows from aggregates.
- Add state-duration, first-passage, extinction, and per-cell event counters.
- Add connected-component and spatial-correlation metrics on the GPU.
- Allow preset-defined metrics with names and denominator metadata.

Online metrics are intentionally limited and sampled less frequently to keep simulation performance high, while offline metrics are limited to avoid long computations in the browser.  
Frame exports nevertheless preserve the complete state history of the run, thus an export can be parsed afterward to compute any additional needed metric.

## Browser, GPU, And Storage Limits

Grid and recording capacity depend on WebGPU adapter limits, VRAM, browser storage, and OPFS behavior. Important application caps include a $1\text{ GiB}$ recording frame, $256\text{ MiB}$ preferred recording chunks, pending-write and compression budgets, and device-specific maximum buffer and storage-binding sizes. See [Limits and performance](Limits-and-Performance) and [VRAM and packing](VRAM-and-Packing).

A possible useful extension could be to allow parallel, distributed, or server-side batch execution of runs or parameter sweeps.

The hardcoded caps were selected as high but generally safe limits for most devices and browsers. More ambitious execution extensions have not been implemented because the project is browser-based and hosted on GitHub Pages without a server-side compute service; as with built-in automation, extensive experimentation is better handled outside the browser or with ad-hoc extension scripts leveraging Angular API.
