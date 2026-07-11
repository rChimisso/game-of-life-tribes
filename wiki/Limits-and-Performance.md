# Limits And Performance

## Hard-Coded Limits

| Limit                         |                        Value | Reason                                                              |
| ----------------------------- | ---------------------------: | ------------------------------------------------------------------- |
| Minimum grid columns/rows     |                            3 | Keeps Moore-neighborhood editing and topology behavior meaningful.  |
| Neighbor count range          |                       0 to 8 | Moore neighborhood has exactly eight neighbors.                     |
| Comparison margin             |                      -8 to 8 | Margin is applied to neighbor counts.                               |
| Supported packing             | 1, 2, 4, 8, 16, 32 bits/cell | Fits cleanly into `u32` words.                                      |
| Render color lookup           |                   256 tribes | Render palette buffer is sized for 256 colors.                      |
| Max recording frame           |                        1 GiB | Keeps individual recorded frames bounded.                           |
| Recording chunk cap           |                      256 MiB | Preferred chunk size before frame-size fallback.                    |
| Staging ring size             |                    3 buffers | Allows readback overlap while keeping VRAM bounded.                 |
| Max pending OPFS writes       |                           12 | Hard backpressure threshold.                                        |
| Pending OPFS write budget     |                      512 MiB | Limits raw unsaved recording pressure.                              |
| Pending compression budget    |                        1 GiB | Limits queued compression pressure.                                 |
| Download chunk-mode threshold |                        2 GiB | Avoids very large in-memory normal exports.                         |
| Snapshot streaming threshold  |                      256 MiB | Switches large snapshots to streaming.                              |
| Snapshot repack block         |                       64 MiB | Bounded block size during streaming snapshot work.                  |
| MP4 max dimension             |                      4096 px | Keeps video output inside practical encoder limits.                 |
| MP4 small-grid reference      |                      1080 px | Upscales small grids to more useful video size.                     |
| MP4 persisted FPS             |                     1 to 240 | Bounds user settings.                                               |
| MP4 persisted bitrate         |                 1 to 60 Mbps | Bounds user settings.                                               |
| Max combine inputs per row    |                            8 | Matches neighbor-scale logic and keeps generated rules bounded.     |
| Random seed                   |              1 to 4294967295 | Keeps deterministic probability rolls inside unsigned 32-bit space. |
| Rule probability input        |                     0 to 100 | Percentage with up to three decimal digits.                         |
| Brush density                 |                    1 to 100% | Bounds density validation and shader selection percentage.          |
| Brush selected tribe ID slots |                           32 | Fixed brush uniform array size.                                     |

## Device Limits

Some limits are not hard-coded by the app. They come from the WebGPU adapter selected by the browser, so they can change across devices, browsers, drivers, and power modes.

Two important limits for grid size are:

- `maxBufferSize`: the largest individual GPU buffer that can be created.
- `maxStorageBufferBindingSize`: the largest storage-buffer range that can be bound for shader access.

The simulation frame must fit both constraints, so the effective maximum simulation frame size is:

```text
maxSimulationBytes = min(maxBufferSize, maxStorageBufferBindingSize)
```

See [VRAM and packing](VRAM-and-Packing) for the frame-size formula and how packing affects these limits.

## Performance Tradeoffs

The largest costs are grid size, packing, rule complexity, recording, metrics, and export selection.

- Larger grids increase compute work and frame bytes.
- Lower bits per cell reduce memory and storage, but must still represent all tribes.
- More rules and complex selectors generate larger shaders and more branch/count work.
- Probabilistic rules add deterministic hash and threshold checks to generated simulation branches.
- Recording copies every captured frame and writes chunks to OPFS. Active recording runs batch ordered step/copy command pairs to reduce per-generation queue-submission overhead without dropping generations.
- Live metrics add GPU passes and readback.
- PNG, MP4, and offline metrics require scanning recorded frames.
- Max speed disables rendering so simulation work can dominate.

Non-recording high-throughput runs use adaptive batching. The grid-size tier is based on `log10(cols * rows / 100000)`, clamped from 0 through 3, and seeds the initial generation budget. After each GPU queue drain, the worker measures drain time and adjusts the next budget with bounded growth and shrink. Max speed and multi-generation step-forward target runs use a 500 ms drain target because rendering is paused or transient. Fixed-speed catch-up uses a 33 ms target so visible canvas updates remain responsive when the requested speed is higher than the device can sustain. Recording runs keep separate pacing because they must preserve every captured frame and honor recording backpressure. Recording batching improves small-frame overhead by submitting several ordered step/copy pairs together, but large backpressured recordings are still limited mainly by GPU readback, CPU copy, and OPFS write throughput.

## Failure Boundaries

The app logs and surfaces failures at lifecycle boundaries:

- WebGPU initialization and rebuild.
- GPU device loss.
- GPU validation/runtime errors.
- OPFS cleanup and recording persistence.
- Compression retries and deferrals.
- Snapshot load/save failures.
- Download preparation and worker export failures.
- Wake lock acquisition and release.

When effective recording usage reaches 75% of the browser-reported storage quota estimate, the app pauses the simulation to preserve data. Effective usage is pending raw recording bytes plus compressed recording bytes plus reserved recording headroom. At 100%, it pauses and disables recording so the user can save data and reset. Recording is also disabled whenever the remaining quota after pending, compressed, and reserved bytes is smaller than one frame. The browser-reported quota estimate is approximate and may change as the browser manages storage. If an actual OPFS write still fails because the browser enforces a lower storage limit, recording is stopped and the app rolls back to the previous persisted frame instead of surfacing a GPU error.
