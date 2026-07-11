# VRAM And Packing

## Packed Formats

Cell states are stored as integer tribe indexes packed into `u32` words. Supported formats are 1, 2, 4, 8, 16, and 32 bits per cell.

| Bits/cell | Cells/word | Word shift | Cell shift | Cell mask    |
| --------: | ---------: | ---------: | ---------: | ------------ |
|         1 |         32 |          5 |          0 | `0x1`        |
|         2 |         16 |          4 |          1 | `0x3`        |
|         4 |          8 |          3 |          2 | `0xF`        |
|         8 |          4 |          2 |          3 | `0xFF`       |
|        16 |          2 |          1 |          4 | `0xFFFF`     |
|        32 |          1 |          0 |          5 | `0xFFFFFFFF` |

The smallest tight format for a tribe count is selected by state count thresholds: 2, 4, 16, 256, 65,536, then 32-bit fallback.  
However, currently, only up to 256 states are supported, so 16-bit and 32-bit packings are user-choice only.

## Frame Byte Size

A packed frame is a rectangular array of `u32` words:

```text
packedCols = ceil(cols / cellsPerWord)
frameBytes = packedCols * rows * 4
```

The same formula is used by grid-size validation, packing validation, snapshots, recording, and exports.

## VRAM Budget

The worker computes device simulation capacity as:

```text
maxSimulationBytes = min(maxBufferSize, maxStorageBufferBindingSize)
maxRecordingBytes = min(maxSimulationBytes, 1 GiB)
vramBudgetBytes = max(maxSimulationBytes * 2, maxRecordingBytes * 6)
```

WebGPU does not expose the actual amount of GPU VRAM available to the browser. The displayed VRAM budget is therefore an estimate derived from WebGPU buffer limits and the engine's own buffer plan, not a direct hardware memory reading.

The two WebGPU limits in the first line come from the selected adapter/device:

- `maxBufferSize`: the largest individual `GPUBuffer` the device allows the app to create.
- `maxStorageBufferBindingSize`: the largest storage-buffer range the device allows a shader to bind and access in one binding.

The engine uses the smaller of the two because a simulation frame must both exist as a buffer and be usable by the compute shader. If either limit is smaller than the requested packed frame, the grid cannot be supported in that packing format. This is why very large grids may need narrower packing or one fewer row even when the GPU still has free VRAM.

Simulation buffers use two full packed grid buffers plus fixed overhead. Recording buffers use a chunk GPU buffer plus a staging ring:

```text
simulationVRAM = frameBytes * 2 + fixedOverheadBytes
recordingVRAM = chunkFrameCapacity * frameBytes * (1 + stagingRingSize)
```

The staging ring size is 3, so recording reserves one chunk buffer plus three staging buffers when recording is available.

VRAM classes shown by the app:

- **Simulation**: GPU memory for the current simulation buffers and fixed engine overhead.
- **Recording**: GPU memory for the recording chunk buffer and staging ring.
- **Budget**: an estimated budget derived from WebGPU buffer limits and the engine buffer plan, not actual physical VRAM.

## Why Packing Matters

Packing is a tradeoff between memory traffic, recording cost, shader work, and supported state count. Lower bits per cell reduce frame bytes, which helps larger grids fit WebGPU buffer limits, keeps recording available, lowers OPFS growth, and makes exports cheaper. As covered in the [benchmark conclusions](Benchmark-Conclusions), this matters most while recording and once large grids become memory-traffic bound.

Higher bits per cell support more tribes and can avoid repacking when complex rulesets or snapshots require more states. They also simplify the shader's packing math because fewer cells share each `u32` word. That can reduce overhead on smaller non-recording grids, where dispatch, scheduling, and browser/GPU pipeline overhead often matter more than raw frame size.


