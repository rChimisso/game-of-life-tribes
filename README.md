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

## Benchmark

A detailed benchmark write-up is available in the wiki:

- [Hardware, method, and grid coverage](https://github.com/rChimisso/game-of-life-tribes/wiki/Benchmark-Hardware-Method-Coverage)
- [Results](https://github.com/rChimisso/game-of-life-tribes/wiki/Benchmark-Results)
- [Conclusions](https://github.com/rChimisso/game-of-life-tribes/wiki/Benchmark-Conclusions)

The normalized source data is stored in [`benchmark/benchmark-results.csv`](benchmark/benchmark-results.csv). The runs use the **Conway** preset on a plugged-in laptop with an Intel Core i7-12700H, an NVIDIA RTX 3070 Ti Laptop GPU, 64 GB of DDR5 RAM, a Samsung SSD 980 PRO, and Opera GX running on the dedicated GPU.

Main takeaways:

- Without recording, smaller grids may favor wider bit packings, while larger grids generally benefit from shorter bit packings. This depends heavily on the device, browser, and grid size, so test the combinations you actually use.
- When recording, prefer the shortest bit packing that can represent your tribes. Smaller frames reduce storage use and readback pressure.
- Bigger grids do fewer generations per second because each generation updates more cells, but total cell updates per second stay fairly consistent once the grid is large enough. Very small grids are mostly overhead-limited.
- If you only need a reproducible starting point, save a snapshot instead of recording the whole history.
- If you are unsure whether you will need history later, save a snapshot first. Since evolution is deterministic, you can load it later and record the same run from that point.
- Max speed can reach higher throughput than fixed target speeds because it disables rendering and does not need to keep the simulation interactive.
- Every recording run hit backpressure. Recording throughput therefore depends strongly on readback, CPU-side work, browser storage behavior, and storage speed, not only on GPU simulation performance.

## Useful Notes

- Rules are evaluated over the whole grid at each generation, so larger grids and heavier metric or recording settings can use more memory, storage, and GPU time.
- The `dead` tribe represents empty cells. Other tribes are the visible, editable states that rules can create, preserve, count, or transform.
- Rule order is part of the ruleset. Moving a rule can change the simulation even when the rule itself is unchanged.
- If a cell should survive, persist, or switch tribe, some rule must explicitly produce that result.
- Tribe count and bits per cell are connected. More possible tribes require more bits per cell, while fewer tribes can use tighter packing.
- Recording is most useful when enabled before the event you care about. Snapshots are better for saving a restart point.
- Browser storage is not infinite. Long recordings on large grids can consume quota quickly, especially with larger bits-per-cell formats.
- Presets are starting points. Muting one rule or changing one threshold is often enough to reveal what gives a ruleset its character.
