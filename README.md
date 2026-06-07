# Game of Life: Tribes

##### A colorful cellular automata playground for rules, factions, histories, and emergent worlds.

## Description

**Game of Life: Tribes** is an interactive engine for exploring [cellular automata](https://en.wikipedia.org/wiki/Cellular_automaton) inspired by [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life). It keeps the same simple foundation of a grid evolving one generation at a time, but expands it into a more powerful superset: cells can belong to different tribes, rules can target specific tribes or relationships between them, and outcomes can express more than the usual alive-or-dead transition.

In classic Life, every cell is either alive or dead, and the next generation depends only on the number of live neighbors. In **Game of Life: Tribes**, a cell belongs to a named tribe, and rules decide whether it stays in that tribe, switches to another tribe, inherits a tribe from nearby cells, or disappears into the `dead` state. That extra vocabulary makes the engine useful for experimenting with competing populations, trails, territory, material spread, and other local interactions that emerge from simple neighbor-based rules.

> Image slot: main simulation screenshot, ideally showing the canvas and sidebar together.

## How The Logic Works

The simulation advances in generations. During each generation, every cell reads its current state and the state of its [Moore neighborhood](https://en.wikipedia.org/wiki/Moore_neighborhood) and changes state based on that.

The grid is toroidal: moving past one edge wraps around to the opposite edge. A pattern leaving the right side can reappear from the left, and the same applies vertically. This avoids hard borders and makes the simulation behave like a continuous surface with [periodic boundary conditions](https://en.wikipedia.org/wiki/Periodic_boundary_conditions).

Rules are evaluated as clauses plus outcomes:

- A **clause** decides whether a rule matches a cell.
- An **outcome** decides what the cell becomes when the clause matches.
- Rules are evaluated from top to bottom, and the first matching rule wins.
- If no rule matches, the cell becomes `dead`.

This ordering matters. A broad rule placed near the top can catch cells before a more specific rule below it ever runs. When designing a ruleset, put exceptional or narrow cases first, and use broader fallback-style rules later.  
Muting a rule removes it from this chain without deleting it, which is useful when testing whether a behavior comes from one rule or from an interaction between several rules.

Clauses can ask questions such as:

- Is the current cell part of a specific tribe?
- Does it have exactly, at least, at most, or between a range of selected neighbors?
- Are there no neighbors from a selected tribe?
- Does one neighbor group outnumber another?
- Do several smaller clauses all match, or does at least one of them match?

Neighbor selection is also tribe-aware. A rule can count explicit tribes, the same tribe as the current cell, different tribes, or candidates involved in a majority-style choice. This is where the engine starts to move beyond ordinary birth/survival notation: rules can react to composition, not only to the total number of alive cells.

Outcomes can be simple or dynamic. A matching rule can set a fixed tribe, keep the current tribe, choose the majority or minority tribe among selected neighbors, or combine selected tribes through a lookup. This lets you write rules for classic survival, tribe inheritance, decay, trails, territory pressure, resource spread, and other local interactions without changing the engine code.

You can edit tribes and rules directly in the app. Add a tribe, give it a color, create a few clauses, choose what matching cells become, and then draw material into the grid to see whether your local rules produce interesting global behavior.

> Image slot: close-up of the rule editor with a few tribes and clauses visible.

Very detailed rule syntax, file formats, metrics internals, and export details can be found in the [Wiki](https://github.com/rChimisso/game-of-life-tribes/wiki).

## Built-In Presets

The app ships with presets that act as examples or starting points for the rule system.

Some presets stay close to familiar [Life-like](https://en.wikipedia.org/wiki/Life-like_cellular_automaton) automata:

- **Conway**: the classic Game of Life.
- **Replicator**: a rule that copies its own structures indefinitely.
- **Eternal**: cells are born like Life cells, then never die.
- **Diamoeba**, **Day & Night**, and **Anneal**: single-tribe rules with different growth, symmetry, and smoothing behavior.

Other presets show why tribes make the engine more expressive:

- **Afterimage** adds fading cell states, leaving visible traces behind classic Life activity.
- **Senescence** gives cells ages and lifecycle stages, so populations can become young, mature, fragile, or exhausted.
- **Slime Mold** separates exploring tendrils from stable body tissue, creating porous growth and folding boundaries.
- **Wildfire** uses vegetation density, fire, embers, ash, and obstacles to create spreading, recovering landscapes.

Presets are not locked demos. Load one, resize the world, draw into it, change a color, mute a rule, edit a threshold, or add a new tribe. Small edits can turn a stable-looking rule into a chaotic one, or make a noisy preset settle into islands, waves, borders, filaments, and repeating structures.

> Image slot: preset gallery or a grid of four generated preset screenshots.

## Simulation Controls

The playback controls cover both watching and inspecting a simulation. You can run or pause, step forward one or more generations, step backward through available history, reset the current setup, and adjust speed. Max speed mode lets the GPU advance the simulation as fast as the current grid, rules, recording settings, and device allow.

Navigation is canvas-like. Use pan and zoom to inspect dense regions, follow a moving structure, or work at a comfortable scale on large grids. The grid size can be changed from the sidebar, and the app reports frame-size limits so you can see when a configuration is becoming too heavy for recording or your device.

Drawing tools turn the simulation into a live editor:

- Pick one or more tribes to paint.
- Toggle delete mode to erase cells back to `dead`.
- Change brush size for fine edits or broad seeding.
- Switch brush shape and fill mode to draw points, blocks, outlines, or larger regions.
- Use touch controls on mobile-style input when available.

Keyboard shortcuts cover the common loop: play and pause, restart, step backward and forward, change speed, toggle max speed, toggle recording, toggle live metrics, cycle drawing tribes, switch brush shape and fill mode, resize the brush, pan, and zoom.

Live metrics can be enabled while the simulation runs. They give immediate feedback about population, tribe distribution, diversity, and interfaces between states, which is especially useful for keeping an eye on how a multi-tribe simulation is evolving. Metrics cost extra work, so disabling them can increase maximum simulation speed when you only care about raw throughput.

Recording stores simulation history for later use. It makes stepping backward possible and enables frame, video, and metrics exports, but it consumes storage and can reduce maximum speed. Larger grids create larger recorded frames; depending on how many tribes the ruleset needs, reducing bits per cell can keep frame size, recording storage, and export work more manageable.

> Image slot: controls screenshot showing playback, drawing, metrics, and packing controls.

## Downloads And Snapshots

Snapshots save the current simulation state as a `.golt` file and can be loaded back into the app later. A snapshot is the right tool when you want to preserve a ruleset, grid size, tribe setup, generation counter, and current cell state.

Downloads are for recorded simulation history. After enabling recording and letting the simulation run, you can export selected outputs such as first and last saves, metrics, PNG frames, or an MP4 video. The download panel also lets you choose a frame range and adjust MP4 settings.

For large recordings, chunk download mode can export compressed recording chunks instead of rendering every selected output at once, for later processing. This is useful when the recorded data is too large for a single browser-side export workflow.

If you know you will want a video, frames, or metrics for a run, turn recording on before the interesting part happens. If you're unsure, save a snapshot of the initial state, and then load it back in case something interesting happens: you'll have a second chance at recording it.

> Image slot: short MP4 or GIF preview exported from an interesting preset.

## Technical Overview

**Game of Life: Tribes** is a browser application built with [Angular 20](https://angular.dev/docs) and [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API).

The simulation core runs in a Web Worker and uses WebGPU compute shaders written in [WGSL](https://www.w3.org/TR/WGSL/) to advance the grid and render it efficiently. This keeps the Angular UI responsive while the engine processes large grids, records frames, and communicates generation updates back to the main thread.

The export pipeline also uses workers. Snapshots are encoded and parsed off the main thread, recordings are stored in chunks, and large downloads can stream work through background processing. PNG frame export, metrics export, compressed chunk export, and MP4 generation are all handled as separate workloads so the app can show progress and cancellation state while the browser does the heavy lifting.

MP4 export uses browser media APIs together with [Mediabunny](https://mediabunny.dev/) for writing media output. Temporary recording and export data use the browser's [Origin Private File System](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).

Browser support, device capabilities, GPU limits, and available storage can heavily affect what the engine can do. A browser without WebGPU cannot run the simulation engine, a device with smaller GPU limits may reject very large grids or exports, and limited storage can shorten practical recording sessions. These constraints matter most when combining large grids, many tribes, high bits-per-cell formats, live metrics, long recordings, PNG frame export, or MP4 generation.

For local development:

```bash
pnpm install # Install dependencies
pnpm run serve # Start the development server
pnpm run build # Create the production build
```

## Benchmarks

These benchmarks are measured on a laptop using the **Conway** preset. The goal is to compare how max speed changes across grid sizes, bit-packing formats, live metrics, and recording.

Hardware:

- **CPU**: Intel Core i7-12700H
- **GPU**: NVIDIA RTX 3070 Ti Laptop GPU, 150 W, 8 GB GDDR6 VRAM
- **RAM**: 64 GB DDR5 SODIMM Corsair 4800 MHz, 2 x 32 GB
- **Browser**: Opera GX 131.0.5877.111, based on Chromium 147.0.7727.56
- **GPU selection**: dedicated GPU
- **Power**: plugged in

Method:

- Each grid is initialized by using the round spray brush everywhere.
- Max speed mode is enabled immediately, before starting the simulation.
- Max speed uses adaptive non-recording batching, so the value is read only after the initial batching warm-up has settled.
- The reported value is read by eye after one minute.
- No visible UI slowdown was observed during these runs.
- Every result uses the Conway preset.

> Image slot: screenshot of the initialized benchmark grid before max speed is enabled.

Grid and packing coverage:

| Grid            | Tested bit packing |
| --------------- | ------------------ |
| 128 x 128       | 1, 2, 4, 8, 16, 32 |
| 256 x 256       | 1, 2, 4, 8, 16, 32 |
| 512 x 512       | 1, 2, 4, 8, 16, 32 |
| 1024 x 1024     | 1, 2, 4, 8, 16, 32 |
| 2048 x 2048     | 1, 2, 4, 8, 16, 32 |
| 4096 x 4096     | 1, 2, 4, 8, 16, 32 |
| 8192 x 8192     | 1, 2, 4, 8, 16, 32 |
| 16384 x 16384   | 1, 2, 4, 8, 16, 32 |
| 32768 x 32768   | 1, 2, 4, 8, 16     |
| 65536 x 65536   | 1, 2, 4            |
| 131072 x 131071 | 1                  |

Some very large grids use one fewer row in specific packing modes because of maximum frame-size limits: `32768 x 32767` at 16-bit packing and `65536 x 65535` at 4-bit packing. Recording is not supported when the frame size is above 1 GB, so those combinations are measured only with recording disabled. Live metrics are included only where they are supported.

> Image slot: grid and packing coverage chart showing where larger grids stop supporting wider bit-packing formats.

Results:

Add one row for each supported grid, bit-packing, and mode combination. The Conway preset uses two tribes, `dead` and `Alive`.

| Grid | Tribes | Bit packing | Metrics | Recording | Max gen/s |
| ---- | ------ | ----------- | ------- | --------- | --------- |
| TBD  | 2      | TBD         | Off     | Off       | TBD       |
| TBD  | 2      | TBD         | On      | Off       | TBD       |
| TBD  | 2      | TBD         | Off     | On        | TBD       |

> Image slot: benchmark chart comparing max gen/s across grid sizes.
> Image slot: benchmark chart comparing bit packing with recording disabled and enabled.
> Image slot: benchmark chart comparing live metrics overhead by grid size.

## Useful Notes

- Rules are evaluated over the whole grid at each generation, so larger grids and heavier metric or recording settings can use more memory, storage, and GPU time.
- The `dead` tribe represents empty cells. Other tribes are the visible, editable states that rules can create, preserve, count, or transform.
- Rule order is part of the ruleset. Moving a rule can change the simulation even when the rule itself is unchanged.
- If a cell should survive, persist, or remain as a special tribe, some rule must explicitly produce that result.
- Tribe count and bits per cell are connected. More possible tribes require more bits per cell, while fewer tribes can use tighter packing.
- Recording is most useful when enabled before the event you care about. Snapshots are better for saving a restart point.
- Browser storage is not infinite. Long recordings on large grids can consume quota quickly, especially with larger bits-per-cell formats.
- Presets are starting points. Muting one rule or changing one threshold is often enough to reveal what gives a ruleset its character.
