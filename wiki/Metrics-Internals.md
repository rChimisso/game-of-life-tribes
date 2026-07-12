# Metrics Internals

## Live Metrics

Live metrics are computed in the WebGPU worker. They are planned by section and device-safe counter limits, then encoded as compute passes against the current packed grid.

Population and diversity depend on the histogram pass:

- The histogram shader uses $256$ atomic counters in workgroup memory and global storage.
- Counts are by numeric tribe index.
- Alive cells are total cells minus the dead tribe count.
- Occupancy is alive cells divided by total cells.
- Shannon entropy and Simpson index are computed from alive tribe probabilities.

Interfaces use a boundary pass:

- Each cell checks only right and bottom neighbors.
- Total contact edges are `cols * rows * 2`.
- Cross-state edges are counted directly.
- Same-state edges are total contact edges minus cross-state edges.

## Offline Metrics

Download metrics scan recorded frames in the download worker. They decode packed rows, update population histograms, count frontier/contact edges, and compare with the previous frame when generations are consecutive.

Offline transition metrics include:

- Changed cells.
- Births.
- Deaths.
- Tribe switches.

## Limits

Live metrics rely on $32$-bit unsigned GPU counters:

- Population and diversity are available when `cols * rows <= 0xffffffff`.
- Interfaces are available when `cols * rows * 2 <= 0xffffffff`.

If a section is enabled but not safe for counters, the UI marks it unavailable. If disabled globally or per section, it is marked disabled.

Download metric estimates use these constants:

- Metric entry base: $512$ bytes.
- Metric entry per tribe: $160$ bytes.
- Metrics CSV row base: $384$ bytes.
- Metrics CSV row per tribe: $48$ bytes.
- Streaming metric-entry threshold: $512$ MiB.
- Large metrics CSV warning threshold: $512$ MiB.
