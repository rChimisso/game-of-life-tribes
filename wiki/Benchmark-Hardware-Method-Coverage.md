# Benchmark Hardware, Method, And Coverage

These benchmarks are measured on a laptop using the **Conway** preset and **Toroidal** topology. The goal is to compare how max speed changes across grid sizes, bit-packing formats, and recording.

## Hardware:

- **CPU**: Intel Core i7-12700H
- **GPU**: NVIDIA RTX 3070 Ti Laptop GPU, 150 W, 8 GB GDDR6 VRAM
- **WebGPU `maxBufferSize`**: 2 147 483 648 bytes
- **WebGPU `maxStorageBufferBindingSize`**: 2 147 483 644 bytes
- **RAM**: 64 GB DDR5 SODIMM Corsair 4 800 MHz, 2 × 32 GB
- **Storage**: Samsung SSD 980 PRO 1 TB
- **Browser**: Opera GX 131.0.5877.111, based on Chromium 147.0.7727.56
- **OS**: Windows 10 22H2
- **GPU selection**: dedicated GPU
- **Power**: plugged in

## Method:

- The laptop is plugged in and the browser is using the dedicated GPU.
- Each sample is configured through the [benchmark runner](https://github.com/rChimisso/game-of-life-tribes/tree/main/benchmark/benchmark-runner.js), then measured in max speed mode.
- The simulation warms up for $5$ seconds so adaptive batching can settle.
- After warm-up, the runner pauses, waits $2$ seconds for the generation counter to settle, reads the starting generation, waits another $3$ seconds, then measures a $t=60$ second max-speed run.
- The ending generation is read $2$ seconds after the measured run stops, and reported speed is $\frac{\text{end}-\text{start}}{t}$. Then, another $28$ seconds are waited to let the device cool down.
- Each supported sample is repeated $5$ times, and the best observed run is reported.
- Recording runs include OPFS write backpressure in the measured speed.

## Grid and packing coverage:

| Grid                     | Tested bit packings            |
| ------------------------ | ------------------------------ |
| $128\times128$           | $1$, $2$, $4$, $8$, $16$, $32$ |
| $256\times256$           | $1$, $2$, $4$, $8$, $16$, $32$ |
| $512\times512$           | $1$, $2$, $4$, $8$, $16$, $32$ |
| $1\,024\times1\,024$     | $1$, $2$, $4$, $8$, $16$, $32$ |
| $2\,048\times2\,048$     | $1$, $2$, $4$, $8$, $16$, $32$ |
| $4\,096\times4\,096$     | $1$, $2$, $4$, $8$, $16$, $32$ |
| $8\,192\times8\,192$     | $1$, $2$, $4$, $8$, $16$, $32$ |
| $16\,384\times16\,384$   | $1$, $2$, $4$, $8$, $16$, $32$ |
| $32\,768\times32\,768$   | $1$, $2$, $4$, $8$, $16$       |
| $65\,536\times65\,536$   | $1$, $2$, $4$                  |
| $131\,072\times131\,072$ | $1$                            |

Most grids are tested with every bit-packing format. Wider packings make each frame larger, so the largest grids stop at the widest format still allowed by the device frame-size limits. A few maximum-size cases use one fewer row for the same reason: $32\,768\times32\,767$ at $16$-bit packing, $65\,536\times65\,535$ at $4$-bit packing, and $131\,072\times131\,071$ at $1$-bit packing.

Recording is measured only where the engine supports it for that grid and packing.
