# WebGPU Webengine

## Initialization

The engine component transfers an `OffscreenCanvas` to `webengine.ts` with an `init` message. The worker then:

1. Requests a WebGPU device through the worker GPU device helper.
2. Configures the WebGPU canvas context with the preferred canvas format.
3. Initializes ruleset state, random seed, tribe indexes, grid topology, boundary tribe, grid packing, and dispatch plans.
4. Builds GPU resources for simulation, rendering, brush input, metrics, and recording.
5. Posts initial limits and rebuild state back to the UI.

The worker watches `device.lost`. On loss, it stops active runs, marks the device as lost, pauses simulation state, and posts a device-loss message to the app.

## Rebuild Lifecycle

Ruleset, rule probability, random seed, topology, grid size, and packing changes require a full GPU rebuild. Rebuilds stop active runs, mark the worker as rebuilding, wait for GPU work to finish, destroy or replace resources, rebuild buffers and pipelines, reset OPFS recording state as needed, and post fresh recording limits.

Important rebuild resources include:

- Two ping-pong simulation grid buffers.
- Render uniform buffer.
- Tribe color lookup buffer.
- Render pipeline and bind groups.
- Simulation compute pipeline and bind groups.
- Ruleset parameter data.
- Brush compute pipeline.
- Live metrics resources.
- Recording chunk buffer and staging ring when recording is available.

Topology is compiled into generated simulation, brush, and render shader behavior. Toroidal mode uses wrapping reads, wrapped brush dispatch, and a toroidal render pipeline. Bounded mode uses virtual boundary reads for off-grid neighbors, clipped brush dispatch, and a bounded render pipeline. The virtual boundary is not a GPU grid buffer and does not change frame dimensions.

## Run Loop

The worker has a render loop and an active run pump.

- Fixed speed uses a target step duration derived from `gen/s`.
- Non-recording high-throughput runs use adaptive batching seeded from grid-size tiers, then adjusted from measured GPU queue drain times. Max-speed and multi-generation step-forward runs target 500 ms drains; fixed-speed catch-up targets 33 ms drains.
- Multi-generation step-forward runs use the same non-recording max-speed target-generation path, so they inherit adaptive batching.
- Recording runs use different pacing because recording must preserve every captured frame and honor recording backpressure. During active recording runs, the worker batches ordered simulation-step and frame-copy command pairs so each generation is copied before the next generation can overwrite the ping-pong buffer.
- Non-recording max speed can skip rendering until max speed is disabled.
- Target-generation runs are used for step forward and step back operations.

The run loop also applies pending brush input, updates FPS, emits generation updates, runs periodic metrics, applies recording backpressure, and schedules the next pump with animation-frame or timeout-style pacing depending on the active run.

## Device Limits

The worker derives the maximum simulation frame bytes from the minimum of `device.limits.maxBufferSize` and `device.limits.maxStorageBufferBindingSize`. Recording availability is then capped by the app's 1 GiB recording-frame limit. These values are posted to the UI and shown in Grid size, Packing, and the VRAM/storage displays.
