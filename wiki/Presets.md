# Presets

## Purpose

The Presets section loads example rulesets that demonstrate the rule system. Presets keep the current grid dimensions, topology, and boundary tribe, but replace tribes, rules, and random seed metadata. They are useful starting points for classic Life-like automata, lifecycle rules, trails, territory, and multi-state material simulations.

## Controls

- **Preset buttons**:  
  Each button shows the preset name, short description, and minimum required packing.
- **Apply**:  
  Commits the selected preset. Disabled while running, downloading, or when no preset is selected.
- **Cancel**:  
  Clears the current preset selection without changing the simulation.

When a preset is applied, the app checks whether the preset's tribe count can fit the current grid under current WebGPU frame-size limits. If not, it shows an error asking you to reduce the grid size before applying the preset.

Presets can define their own random seed for probabilistic rules.

## Built-In Presets

| Preset           | Description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| Conway           | Classic Game of Life                                              |
| Replicator       | Replicates itself indefinitely                                    |
| Day & Night      | Symmetric under on-off reversal                                   |
| Anneal           | Converges to smooth blobs                                         |
| Afterimage       | Classic Life with fading cells                                    |
| Senescence       | Life where cells age                                              |
| Cyclic Dominance | Rock-paper-scissors territory contest                             |
| SIRSD Epidemic   | Probabilistic infection, recovery, mortality, and waning immunity |
| Slime Mold       | Slime body with explorer tendrils                                 |
| Wildfire         | Fire spreads through varied vegetation                            |

The minimum packing shown on each button is derived from the number of tribes in that preset. For example, two-state presets can use 1-bit packing, while presets with many lifecycle or material states need a larger value.

### Afterimage

TODO

### Senescence

TODO

### SIRSD Epidemic

TODO

### Wildfire

TODO
