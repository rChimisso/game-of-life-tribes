# Packing

## Purpose

The Packing section chooses how many bits are used to store each cell. Lower values reduce VRAM and recording/storage size. Higher values support more tribes and can make shader math simpler.

## Controls

<p align="center">
  <img src="images/packing.png" alt="Packing section">
</p>

- **Bits/cell**:  
  Segmented control with $1$, $2$, $4$, $8$, $16$, and $32$-bit options.
- **Frame size**:  
  Read-only estimate for the grid using the pending packing value.
- **Bytes**:  
  Exact pending frame byte count.
- **Max recording size**:  
  Recording frame limit for the current device.
- **Max supported size**:  
  WebGPU buffer limit for the current device.
- **Apply**:  
  Commits the pending packing and rebuilds GPU resources. Disabled while running, downloading, unchanged, or over the allowed frame limit.
- **Restore**:  
  Resets the pending value back to the committed packing.

## Choosing A Value

A packing value must support the number of states in the ruleset, including `dead`. The maximum state count is $\max\left(2^\texttt{bitsPerCell},\,256\right)$:

| Bits/cell | States | Cells per `u32` word |
| --------- | -----: | -------------------: |
| $1$       |    $2$ |                 $32$ |
| $2$       |    $4$ |                 $16$ |
| $4$       |   $16$ |                  $8$ |
| $8$       |  $256$ |                  $4$ |
| $16$      |  $256$ |                  $2$ |
| $32$      |  $256$ |                  $1$ |

As covered in the [benchmark results](Benchmark-Results), tighter packings are most useful when recording and to support larger grids, while wider packings are better suited to non-recording runs with small grids and to rulesets that need more tribes.

The app disables packing choices that cannot represent the current tribe count. If a preset or snapshot requires more states, the app chooses the smallest fitting format that also fits current buffer limits.
