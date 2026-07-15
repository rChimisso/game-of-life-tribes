# Game of Life: Tribes

**A WebGPU cellular-automata playground for building rules, competing populations, and emergent worlds.**

[Open the app](https://rchimisso.github.io/game-of-life-tribes/) · [Read the wiki](https://rchimisso.github.io/game-of-life-tribes/wiki/) · [Browse the source](https://github.com/rChimisso/game-of-life-tribes)

https://github.com/user-attachments/assets/f0c2898a-57d1-4e6c-aba4-182da30f08cc

**Game of Life: Tribes** starts with the familiar idea of Conway's Game of Life, a grid that changes one generation at a time, and gives it a richer vocabulary: cells belong to named tribes, rules can reason about the relationship between neighboring tribes, and outcomes can preserve, replace, inherit, or combine states.

The result is a browser-based space for exploring classic Life-like rules, competing populations, fading trails, territorial behavior, critical densities, and rule systems of your own design. The simulation runs on a dedicated WebGPU worker, so the interface stays responsive while the engine advances the grid, records history, and prepares exports.

## Start Here

The app requires a browser with [WebGPU support](https://caniuse.com/webgpu).

1. Open the sidebar and load a preset (defaults to Conway's).
2. Choose a grid size, topology, and packing format if needed.
3. Pick a draw tribe and paint an initial layout on the canvas.
4. Run, pause, or step through generations; use **Max** for the highest available throughput.
5. Enable recording before the part of a run you want to inspect or export.

The built-in presets are designed to be edited. Start with one, then change a threshold, mute a rule, add a tribe, or redraw the canvas and see how local changes alter global behavior.

For a guided tour of the controls, canvas, drawing tools, metrics, downloads, and snapshots, see the [UI section of the wiki](https://rchimisso.github.io/game-of-life-tribes/wiki/ui).

<!-- MEDIA SLOT — Quick-start: three small, labeled screenshots showing preset selection, painting an initial layout, and a running result. -->

## What Makes It Different

### Tribes and rules

Classic Life asks whether a cell is alive or dead. Here, a cell can belong to any named tribe, with the built-in `dead` state. Rules are evaluated from top to bottom, and the first matching rule determines the next state.

A rule can test the current tribe, count selected neighbors, compare groups of neighbors, and combine smaller conditions. Its outcome can set a fixed tribe, keep the current one, choose a majority or minority neighbor, or combine nearby tribes through a lookup. This makes rule order and composition part of the experiment, not just the neighbor count.

Read the [rules guide](https://rchimisso.github.io/game-of-life-tribes/wiki/rules), [rule-expression reference](https://rchimisso.github.io/game-of-life-tribes/wiki/rule-expressions), [rule cost model](https://rchimisso.github.io/game-of-life-tribes/wiki/rule-cost-model), and [engine internals](https://rchimisso.github.io/game-of-life-tribes/wiki/rule-engine-internals) for the full rule syntax, capability and evaluation behavior.

<!-- MEDIA SLOT — Rules: a close crop of one readable rule with its clause, neighbor selector, and outcome visible; use a real multi-tribe example rather than an empty editor. -->

### A canvas built to explore

Pan and zoom the grid, draw with configurable brushes, switch between toroidal and bounded topology, and choose compact cell packing to balance state capacity against memory and recording cost. Live metrics expose population, tribe distribution, diversity, and interfaces while the simulation runs.

<!-- MEDIA SLOT — Canvas: a before/after pair showing a painted seed at close zoom and the same area after several generations. -->

### History, snapshots, and exports

Recording enables step-back and lets you export selected parts of a run as `.golt` saves, metrics, indexed PNG frames, or MP4 video. Snapshots preserve a restartable state; compressed chunk export supports recordings that are too large for a normal browser-side export.

<!-- MEDIA SLOT — Recording and export: a 6–10 second loop showing a simulation run, a step-back action, and the resulting MP4 or frame-sequence output. -->

## Included Presets

The preset library ranges from familiar rules to multi-state systems:

- **Conway**, **Replicator**, **Diamoeba**, **Day & Night**, and **Anneal** explore Life-like behavior.
- **Afterimage** and **Senescence** add history, decay, and lifecycle states.
- **Slime Mold** separates exploring tendrils from stable body tissue.
- **Wildfire** models vegetation, burning, embers, ash, and obstacles.
- **SIRSD Epidemic** models local spread, recovery, waning immunity, and mortality.

They are starting points, not locked demonstrations. A small change to a rule, tribe, or initial layout can create a substantially different system.

<!-- MEDIA SLOT — Presets: a 2×3 gallery of consistently framed screenshots, ideally Conway, Afterimage, Slime Mold, Wildfire, SIRSD Epidemic, and one custom multi-tribe rule. -->

## Analysis

The project includes reproducible density-sweep studies for the Wildfire and SIRSD Epidemic presets on a $512\times512$ toroidal grid.

- **Wildfire:** a sharp shift from local fadeouts to sustained burns appears around $90\%$ initial vegetation density. Vegetation resistance produces a consistent `Grass > Bush > Tree` loss ordering.
- **Epidemic:** the clearest transition occurs between $41\%$ and $42\%$ initial population density, where infection episodes, prevalence, mortality, and duration all rise markedly. Recovered cells can become susceptible again, so some runs produce later resurgences and reinfections.

Read the [analysis overview](https://rchimisso.github.io/game-of-life-tribes/wiki/analysis), [Wildfire results](https://rchimisso.github.io/game-of-life-tribes/wiki/wildfire-analysis), and [Epidemic results](https://rchimisso.github.io/game-of-life-tribes/wiki/epidemic-analysis). The source data and generation scripts live in [`analysis/`](analysis/).

<!-- MEDIA SLOT — Analysis: the Wildfire 85–95% regime-change figure, cropped so the crossover and distribution change are legible at README width. -->

<!-- MEDIA SLOT — Analysis: the Epidemic 40–45% regime-change figure, paired with a one-sentence caption about the change in outbreak behavior. -->

## Benchmark

Benchmarks measure the Conway preset on toroidal grids across packing widths, grid sizes, recording states, and max-speed behavior. Results are device- and browser-specific, but the practical pattern is clear:

- Use the shortest packing that represents the tribes you need, especially while recording.
- Large grids trade generations per second for high total cell-update throughput.
- Recording adds GPU readback, CPU processing, compression, and OPFS storage pressure; it is often limited by the browser and storage path as much as by simulation compute.
- Max speed can run faster than a fixed target because rendering is paused while it is active.

See the [benchmark method](https://rchimisso.github.io/game-of-life-tribes/wiki/benchmark-hardware-method-coverage), [results](https://rchimisso.github.io/game-of-life-tribes/wiki/benchmark-results), and [conclusions](https://rchimisso.github.io/game-of-life-tribes/wiki/benchmark-conclusions). The normalized measurements are in [`benchmark/benchmark-results.csv`](benchmark/benchmark-results.csv).

<!-- MEDIA SLOT — Benchmark: one clean throughput-versus-grid-size chart with a short caption that names the tested browser and hardware. -->

## Game of Life: Tribes and NetLogo

Both tools make spatial models visible and interactive, but they solve different modeling problems. **Game of Life: Tribes** is a WebGPU cellular-automata engine: a packed, fixed grid updates synchronously from local rules. NetLogo is a programmable agent-based modeling environment: its world can contain stationary patches, mobile turtles, and links between turtles, each with its own variables and behavior.

|                          | Game of Life: Tribes                                                                                                                                                         | NetLogo                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Best fit**             | Dense, synchronous grid dynamics and visual emergence                                                                                                                        | Agent-based models of individuals, movement, networks, and institutions                                                                                                   |
| **Modeling unit**        | A grid cell with a tribe value                                                                                                                                               | Patches, mobile turtles, links, and an observer                                                                                                                           |
| **Authoring style**      | Configure tribes, clauses, and outcomes in the app                                                                                                                           | Write procedures in the NetLogo language and build a model interface around them                                                                                          |
| **Scale and speed**      | Designed to update dense packed grids in parallel on WebGPU; usually the better fit for very large cellular grids and high generation throughput                             | General agent behavior trades raw dense-grid throughput for flexibility; practical scale depends strongly on the model, agent count, and machine                          |
| **Direction and biases** | Rules are local and non-directional: they inspect neighborhood composition, not a neighbor's compass position. The rule editor has no global variables or directional fields | A model can define globals, such as wind direction or strength, and use turtle headings, coordinates, patch values, and procedures to make movement or spread directional |
| **Main trade-off**       | Fast visual iteration within a deliberately focused cellular-rule system                                                                                                     | A broader modeling language with more freedom, but more model code and performance costs                                                                                  |

Use **Game of Life: Tribes** when you want to answer questions such as: "What patterns emerge if these local states transform under these neighborhood conditions?" It is particularly well suited to exploring reaction-like systems, competing territories, Life variants, and grid-based spread at a scale where immediate visual feedback, recorded history, and exported frames matter.

Use **NetLogo** when the question needs things that are not just a cell's local state: individuals that move and carry their own variables, directed motion from wind or terrain, social/contact networks, choices made by different agent types, or repeatable parameter sweeps over a programmed model.

For example, a grid wildfire with uniform local spread is a natural GoLT experiment; a wildfire model with changing wind, mobile firefighters, roads, and individually modeled trees is more naturally expressed in NetLogo.

NetLogo's [programming guide](https://docs.netlogo.org/programming.html) describes globals, patches, turtles, links, and agentsets; its [BehaviorSpace guide](https://docs.netlogo.org/behaviorspace.html) covers automated experiments, including headless runs.

<!-- MEDIA SLOT — Comparison: a side-by-side visual with a colorful Tribes grid on the left and a NetLogo model with visible turtles or links on the right; label the modeling unit in each panel. -->

## Technical Overview

The application is built with Angular and WebGPU. An `OffscreenCanvas` and the simulation engine run in a Web Worker; WGSL compute shaders evolve the grid and render it without putting the main UI loop under simulation load. Background workers handle snapshots, recording compression, and download work.

Temporary recording data uses the browser's Origin Private File System (OPFS). Available GPU limits, browser APIs, and storage quota determine the largest usable grid and the practical recording/export capacity.

For architecture, rule syntax, snapshot format, exports, limits, and browser requirements, see the [wiki](https://rchimisso.github.io/game-of-life-tribes/wiki/engine).

## Develop Locally

```bash
pnpm install
pnpm run serve
```

Create a production build with:

```bash
pnpm run build
```
