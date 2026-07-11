# Engine

This section describes how the website works internally. Use these pages when you want implementation details about Angular orchestration, workers, WebGPU, WGSL, storage, exports, formats, limits, and performance behavior.

## Pages

- [Technical architecture](Technical-Architecture): high-level Angular, worker, WebGPU, OPFS, and export architecture.
- [WebGPU webengine](WebGPU-Webengine): worker runtime, rebuild lifecycle, message routing, and run loop.
- [WGSL shaders](WGSL-Shaders): generated compute WGSL, render WGSL, brush WGSL, and metrics WGSL.
- [Rule expressions](Rule-Expressions): canonical selector, clause, outcome, tribe, and rule JSON reference.
- [Rule cost model](Rule-Cost-Model): rough per-cell cost formulas, shared count reuse, and worked rule examples.
- [Rules engine internals](Rules-Engine-Internals): how rule clauses, selectors, outcomes, ordering, and muted rules become shader code.
- [VRAM and packing](VRAM-and-Packing): packed grid formats, frame byte formulas, WebGPU limits, and estimated VRAM budgeting.
- [Recording and OPFS](Recording-and-OPFS): recording buffers, chunks, staging, compression, backpressure, and browser storage.
- [Downloads and exports](Downloads-and-Exports): ZIP output, `.golt` saves, metrics, PNG frames, MP4, and chunk export.
- [Compressed chunk export](Compressed-Chunk-Export): chunk ZIP layout, manifest fields, payload decoding, and Python reader example.
- [Snapshot format](Snapshot-Format): `.golt` preamble, JSON header, compressed payload, streaming path, and Python tools.
- [Metrics internals](Metrics-Internals): live GPU metrics and offline export metrics.
- [Limits and performance](Limits-and-Performance): hard-coded limits, practical constraints, and performance tradeoffs.
