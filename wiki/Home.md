# Game of Life: Tribes Wiki

**Game of Life: Tribes** is a browser-based cellular automata playground built around a WebGPU simulation engine.  
It is a superset of Conway's Game of Life, extending it with multiple named tribes, more powerful rules, recording, and specialized export tools.

The app has two main surfaces:

- A full-screen canvas where the simulation is rendered and can be panned, zoomed, and edited with brush strokes.
- A controls sidebar with sections for playback, speed, drawing, grid and packing setup, presets, tribes, rules, metrics, downloads, snapshots, and shortcuts.

## Start Here

- [UI](UI): how to use the sidebar, canvas controls, rules, metrics, downloads, snapshots, and shortcuts.
- [Engine](Engine): how the application works internally, including Angular orchestration, workers, WebGPU, storage, exports, file formats, limits, and performance.
- [Benchmark](Benchmark): benchmark setup, measured results, and practical conclusions about grid size, packing, recording, and max speed.
- [Analysis](Analysis): density-sweep experiments for Wildfire and SIRSD Epidemic, including methods, results, model comparisons, and conclusions.
- [Limitations and extensions](Limitations-and-Extensions): analysis boundaries, engine constraints, future directions, and references.

## Basic Workflow

1. Open the sidebar with the menu button.
2. Choose or create a ruleset with Presets, Tribes, and Rules.
3. Resize the grid, choose topology, or choose packing if needed.
4. Pick a draw tribe and paint cells on the canvas.
5. Run the simulation, step through it, or use max speed.
6. Enable recording before the part you want to export.
7. Save a snapshot for restartable state, or download recorded outputs.

## Browser Requirements

The simulation requires WebGPU. Recording, snapshots, downloads, MP4 generation, and large exports also depend on browser storage, OPFS, compression streams, and media APIs. Device and browser limits can affect the largest usable grid, whether recording is available, whether live metrics are available, and whether an export uses normal output or compressed chunk mode.

## Versioning

This Wiki is current for application version `v0.27.3`.

**Game of Life: Tribes** follows [Semantic Versioning](https://semver.org/) using `MAJOR.MINOR.PATCH` version numbers:

- **MAJOR** identifies incompatible changes to stable public application contracts after version `1.0.0`.
- **MINOR** identifies new functionality. While the project remains in initial development under `0.y.z`, incompatible changes also increment this number because the public contracts are not yet considered stable.
- **PATCH** identifies backward-compatible bug fixes and small implementation corrections.

Wiki-only updates do not increment the application version because they do not change the released application behavior or its public contracts.
