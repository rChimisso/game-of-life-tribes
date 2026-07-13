# Downloads And Exports

## Normal ZIP Mode

Downloads are produced by `download.ts` as `golt-export.zip`. Normal mode can include:

- `.golt` saves for first and last selected states.
- Metrics output.
- Indexed PNG frames.
- MP4 video.

Before the download worker starts, the home page pauses the simulation (if running), flushes pending recording frames, waits for required compression, requests a stable snapshot, requests a fresh recording manifest, and then hands both to the worker.

The download worker uses progress bands:

- $0$ to $10$: preparation and ZIP opening.
- $10$ to $55$: streaming save entries.
- $55$ to $85$: recorded frame outputs.
- $90$ to $100$: ZIP finalization.

## Compressed Chunk Mode

Compressed chunk mode is selected when Force chunk download is enabled or the estimated working set exceeds $2\text{ GiB}$. It exports compressed recording chunks instead of rendering the selected outputs. See [Compressed chunk export](Compressed-Chunk-Export) for the standalone file contract and a Python reader example.

The ZIP contains:

- `manifest.json`: chunk export version, grid size, grid format, selected frame range, and output chunk metadata.
- `metadata.json`: rules, per-rule probabilities, random seed, tribes, topology, boundary tribe, and recording generation range. Rule and tribe metadata uses the [Rule expressions](Rule-Expressions) shapes.
- `chunks/chunk-000000.bin` and following chunk payload files.

Whole selected source chunks are copied. Boundary chunks are rebuilt when the selected range starts or ends inside a source chunk.

## PNG And MP4

PNG export writes indexed-color PNG frames with a palette derived from tribes. Scanlines are streamed through a `CompressionStream('deflate')`, and row blocks are bounded by a memory budget.

PNG and MP4 visual exports use full-grid framing. When Download is clicked, the home page captures a framing origin and passes it to the download worker. In toroidal topology, that origin is viewport-centered and the worker unwraps each visual frame from it so every grid cell appears exactly once. In bounded topology, the origin is `(0, 0)`, so the finite grid is exported from its top-left corner. This only affects visual frame outputs; `.golt` saves, metrics, and compressed chunk exports keep the recorded packed-grid order.

Bounded topology does not write virtual boundary cells into PNG, MP4, `.golt`, or chunk exports. The selected boundary tribe is stored as metadata and affects simulation neighbor reads only.

MP4 export uses browser `VideoEncoder` support and Mediabunny output writing. Output dimensions are resolved from source grid size:

- Small grids can be uniformly scaled toward a $1080$ reference side.
- Output width and height are clamped to $4096$.
- Minimum output dimension is $3$ before codec-safe even adjustment.
- AVC support is checked before writing, optionally changing the dimensions to support the requested FPS and Bitrate.

The MP4 entry path inside the ZIP is `simulation.mp4`.

## Working Set Estimate

The download estimator accounts for selected chunks, decompression footprint, previous-frame metrics memory, row buffers, metric entries, and estimated CSV output. Metrics switch to streaming output when retained metric-entry memory exceeds $512\text{ MiB}$. Metrics CSV emits a large-output warning above $512\text{ MiB}$.
