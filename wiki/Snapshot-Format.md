# Snapshot Format

## Purpose

A `.golt` snapshot is a single saved simulation state. It contains the current grid, generation number, topology, virtual boundary tribe, random seed, tribes, rules, and the packing metadata needed to decode the grid. It is the format used by the Snapshot section's Save and Load buttons.

Use this page when you want to inspect, convert, generate, or modify snapshots outside the website.

## File Layout

A `.golt` file has three parts:

```text
12-byte preamble
UTF-8 JSON header
raw-deflate compressed packed grid payload
```

The payload is one packed frame, not a sequence of frames. For recorded multi-frame data, see [Compressed chunk export](Compressed-Chunk-Export).

## Preamble

`.golt` files start with a 12-byte preamble:

| Offset | Size | Meaning                                   |
| -----: | ---: | ----------------------------------------- |
|      0 |    4 | Magic bytes `GoLT`                        |
|      4 |    4 | Little-endian format version              |
|      8 |    4 | Little-endian JSON header length in bytes |

The current version is `1`.

## Header

The header is UTF-8 JSON immediately after the preamble. It has this shape:

```jsonc
{
  "generation": 123,
  "cols": 512,
  "rows": 512,
  "topology": "toroidal",
  "boundaryTribe": "dead",
  "randomSeed": 42,
  "gridFormat": {
    "bitsPerCell": 8
  },
  "tribes": [
    {
      "id": "dead",
      "color": "000000"
    },
    {
      "id": "Alive",
      "color": "ffffff"
    },
    // ...
  ],
  "rules": [
    // ...
  ]
}
```

Fields:

- `generation`: generation counter shown by Playback.
- `cols`: grid columns.
- `rows`: grid rows.
- `topology`: grid edge behavior, either `toroidal` or `bounded`. Missing values load as `toroidal`.
- `boundaryTribe`: selected virtual tribe used for off-grid neighbor reads in bounded mode. Missing values load as `dead`. Provided values must reference a known tribe. The value may be preserved while `topology` is `toroidal`, but it is ignored until bounded topology is selected.
- `randomSeed`: deterministic seed used by probabilistic rules.
- `gridFormat.bitsPerCell`: packing used by the compressed grid payload.
- `tribes`: ordered tribe table. Numeric cell values are indexes into this array. See [Tribe JSON](Rule-Expressions#tribe-json).
- `rules`: persisted rule list used by the rules editor and engine. See [Rule JSON](Rule-Expressions#rule-json).

The app treats the parsed JSON header as untrusted data. Before loading, it recursively strips unsupported fields from recognized header, grid-format, tribe, rule, clause, selector, outcome, combine-strategy, and combination-entry objects. Stripped fields are reported with console warning paths such as `gridFormat.obsoleteField` or `rules[2].clause.tribes`; they do not show a snackbar by themselves.

After stripping unsupported fields, the app applies only explicit defaults, then validates the complete canonical header. Missing `generation`, `topology`, `boundaryTribe`, `randomSeed`, rule `probability`, rule `muted`, comparison `margin`, and defaultable selector fields use the application defaults. Missing required fields, unsupported discriminants, invalid values, duplicate tribe IDs, invalid colors, invalid tribe references, invalid neighbor counts, invalid comparison operators, invalid logical clause shapes, and packing that cannot represent every tribe cause loading to abort. Detailed validation paths are logged to the console and the UI shows a concise snapshot-load error.

The app validates the magic bytes, version, header bounds, supported `bitsPerCell`, grid dimensions, topology, tribe array, rule array, canonical rule expressions, and compressed payload size before accepting a snapshot.

## Rule and Tribe Metadata

Snapshot rule and tribe metadata uses the same persisted shapes as compressed chunk exports and presets. The full reference lives in [Rule expressions](Rule-Expressions):

- [Tribe JSON](Rule-Expressions#tribe-json): tribe IDs, colors, and grid-value indexing.
- [Rule JSON](Rule-Expressions#rule-json): rule object fields, probability, and muted state.
- [Selectors](Rule-Expressions#selectors), [clauses](Rule-Expressions#clauses), and [outcomes](Rule-Expressions#outcomes): expression behavior, JSON shapes, constraints, and examples.

## Grid Payload

After the header, all remaining bytes are the packed grid payload compressed with raw DEFLATE (`deflate-raw`). Raw DEFLATE means there is no zlib or gzip wrapper.

When saving, the app repacks the current grid to the tightest storage format that can represent the tribe count. That means `header.gridFormat.bitsPerCell` is the source of truth for decoding the file, even if the simulation was using a larger runtime packing value before saving.

The expected uncompressed payload size is:

```text
cellsPerWord = 32 / bitsPerCell
packedCols = ceil(cols / cellsPerWord)
payloadBytes = packedCols * rows * 4
```

If decompression produces anything other than exactly `payloadBytes`, the app rejects the snapshot.

## Cell Packing

The uncompressed payload is a row-major array of little-endian `u32` words. Each word stores one or more cell values.

To read one cell:

```text
wordIndex = y * packedCols + floor(x / cellsPerWord)
cellIndex = x % cellsPerWord
shift = cellIndex * bitsPerCell
value = (word >> shift) & ((1 << bitsPerCell) - 1)
```

Ignore padding cells beyond `cols` in the final packed word of each row.

To interpret a numeric value, index into the header's `tribes` array:

```text
tribe = header.tribes[value]
tribe.id     -> user-facing state name
tribe.color  -> RGB hex color without '#'
```

## Streaming Path

Small snapshots are compressed or decompressed as one payload. Large snapshots use a streaming-shaped path so the browser does not need one extra full packed-grid copy during save/load.

Current thresholds:

- Snapshot streaming threshold: 256 MiB packed grid size.
- Stream repack block target: 64 MiB.

This does not change the file format. It only changes how the browser produces or consumes the same layout.

## Example Python Tools

The script below can:

- Read a `.golt` file.
- Print metadata.
- Export the grid as a CSV of tribe IDs.
- Build a new `.golt` file from a header and a numeric grid.

<details>
<summary>Python snapshot tools</summary>

```python
#!/usr/bin/env python3
import csv
import json
import math
import struct
import sys
import zlib
from pathlib import Path
from typing import Any

MAGIC = b"GoLT"
VERSION = 1

GridFormat = dict[str, int]
SnapshotHeader = dict[str, Any]
GridValues = list[list[int]]

def grid_format(bits_per_cell: int) -> GridFormat:
  """Return packing constants for a bits-per-cell value.

  :param bits_per_cell: Number of bits used by one packed cell.
  :returns: A dictionary with the cell mask and cells-per-word count.
  :rtype: dict[str, int]
  :raises ValueError: If the bits-per-cell value is unsupported.
  """
  if bits_per_cell not in (1, 2, 4, 8, 16, 32):
    raise ValueError(f"Unsupported bitsPerCell: {bits_per_cell}")
  return {
    "bits_per_cell": bits_per_cell,
    "cells_per_word": 32 // bits_per_cell,
    "cell_mask": (1 << bits_per_cell) - 1,
  }

def frame_byte_size(cols: int, rows: int, bits_per_cell: int) -> int:
  """Return the byte length of one packed grid frame.

  :param cols: Number of grid columns.
  :param rows: Number of grid rows.
  :param bits_per_cell: Number of bits used by one packed cell.
  :returns: The packed frame size in bytes.
  :rtype: int
  """
  fmt = grid_format(bits_per_cell)
  packed_cols = math.ceil(cols / fmt["cells_per_word"])
  return packed_cols * rows * 4

def inflate_raw_deflate(data: bytes) -> bytes:
  """Inflate a raw deflate payload.

  :param data: Raw deflate bytes without a zlib or gzip wrapper.
  :returns: The decoded byte payload.
  :rtype: bytes
  """
  return zlib.decompress(data, wbits=-zlib.MAX_WBITS)

def deflate_raw(data: bytes) -> bytes:
  """Compress bytes as a raw deflate payload.

  :param data: Uncompressed bytes to encode.
  :returns: Raw deflate bytes without a zlib or gzip wrapper.
  :rtype: bytes
  """
  compressor = zlib.compressobj(level=9, wbits=-zlib.MAX_WBITS)
  return compressor.compress(data) + compressor.flush()

def read_golt(path: str | Path) -> tuple[SnapshotHeader, bytes]:
  """Read a .golt snapshot and return its header and packed grid payload.

  :param path: Path to the .golt snapshot file.
  :returns: A tuple containing the decoded JSON header and raw packed payload.
  :rtype: tuple[dict[str, object], bytes]
  :raises ValueError: If the file does not match the supported snapshot format.
  """
  data = Path(path).read_bytes()
  if len(data) < 12:
    raise ValueError("File is too small to be a .golt snapshot")

  magic = data[0:4]
  version = struct.unpack_from("<I", data, 4)[0]
  header_length = struct.unpack_from("<I", data, 8)[0]
  header_start = 12
  header_end = header_start + header_length

  if magic != MAGIC:
    raise ValueError("Invalid .golt magic")
  if version != VERSION:
    raise ValueError(f"Unsupported .golt version: {version}")
  if header_end > len(data):
    raise ValueError("Header extends beyond file size")

  header = json.loads(data[header_start:header_end].decode("utf-8"))
  bits = header["gridFormat"]["bitsPerCell"]
  expected_bytes = frame_byte_size(header["cols"], header["rows"], bits)
  payload = inflate_raw_deflate(data[header_end:])

  if len(payload) != expected_bytes:
    raise ValueError(f"Decoded grid has {len(payload)} bytes, expected {expected_bytes}")

  return header, payload

def unpack_grid(payload: bytes, cols: int, rows: int, bits_per_cell: int) -> GridValues:
  """Unpack a snapshot payload into a two-dimensional list of tribe indexes.

  :param payload: Raw packed grid payload.
  :param cols: Number of grid columns.
  :param rows: Number of grid rows.
  :param bits_per_cell: Number of bits used by one packed cell.
  :returns: A list of rows, where each value is a tribe index.
  :rtype: list[list[int]]
  """
  fmt = grid_format(bits_per_cell)
  packed_cols = math.ceil(cols / fmt["cells_per_word"])
  values: GridValues = []

  for y in range(rows):
    row: list[int] = []
    for x in range(cols):
      word_index = y * packed_cols + (x // fmt["cells_per_word"])
      word = struct.unpack_from("<I", payload, word_index * 4)[0]
      shift = (x % fmt["cells_per_word"]) * bits_per_cell
      row.append((word >> shift) & fmt["cell_mask"])
    values.append(row)

  return values

def pack_grid(values: GridValues, cols: int, rows: int, bits_per_cell: int) -> bytes:
  """Pack a two-dimensional list of tribe indexes into snapshot grid bytes.

  :param values: Grid rows containing numeric tribe indexes.
  :param cols: Number of grid columns.
  :param rows: Number of grid rows.
  :param bits_per_cell: Number of bits used by one packed cell.
  :returns: Raw packed grid bytes.
  :rtype: bytes
  :raises ValueError: If a cell value does not fit the selected packing width.
  """
  fmt = grid_format(bits_per_cell)
  packed_cols = math.ceil(cols / fmt["cells_per_word"])
  payload = bytearray(packed_cols * rows * 4)

  for y in range(rows):
    for x in range(cols):
      value = int(values[y][x])
      if value < 0 or value > fmt["cell_mask"]:
        raise ValueError(f"Cell value {value} does not fit in {bits_per_cell} bits")
      word_index = y * packed_cols + (x // fmt["cells_per_word"])
      word_offset = word_index * 4
      word = struct.unpack_from("<I", payload, word_offset)[0]
      shift = (x % fmt["cells_per_word"]) * bits_per_cell
      mask = fmt["cell_mask"] << shift
      word = (word & ~mask) | ((value & fmt["cell_mask"]) << shift)
      struct.pack_into("<I", payload, word_offset, word)

  return bytes(payload)

def write_golt(path: str | Path, header: SnapshotHeader, values: GridValues) -> None:
  """Write a .golt snapshot from a header and unpacked grid values.

  :param path: Destination path for the .golt snapshot.
  :param header: Snapshot JSON header to preserve or modify.
  :param values: Grid rows containing numeric tribe indexes.
  :returns: ``None``. Writes the snapshot to disk.
  :rtype: None
  """
  cols = header["cols"]
  rows = header["rows"]
  bits = header["gridFormat"]["bitsPerCell"]
  payload = pack_grid(values, cols, rows, bits)
  compressed = deflate_raw(payload)
  header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
  preamble = MAGIC + struct.pack("<II", VERSION, len(header_bytes))
  Path(path).write_bytes(preamble + header_bytes + compressed)

def write_csv(path: str | Path, header: SnapshotHeader, values: GridValues) -> None:
  """Write unpacked grid values to CSV using tribe IDs.

  :param path: Destination path for the CSV file.
  :param header: Snapshot JSON header containing tribe metadata.
  :param values: Grid rows containing numeric tribe indexes.
  :returns: ``None``. Writes the CSV file to disk.
  :rtype: None
  """
  tribes = header["tribes"]
  with open(path, "w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle)
    for row in values:
      writer.writerow([
        tribes[value]["id"] if value < len(tribes) else f"unknown:{value}"
        for value in row
      ])

def main() -> None:
  """Read a .golt snapshot, export CSV, and write a round-trip snapshot.

  :returns: ``None``. Writes the CSV and round-trip snapshot to disk.
  :rtype: None
  :raises SystemExit: If the command line arguments are invalid.
  """
  if len(sys.argv) != 2:
    raise SystemExit("Usage: python golt_snapshot.py snapshot.golt")

  input_path = Path(sys.argv[1])
  header, payload = read_golt(input_path)
  values = unpack_grid(
    payload,
    header["cols"],
    header["rows"],
    header["gridFormat"]["bitsPerCell"],
  )

  print(f"Generation: {header['generation']}")
  print(f"Grid: {header['cols']} x {header['rows']}")
  print(f"Random seed: {header.get('randomSeed', 42)}")
  print(f"Packing: {header['gridFormat']['bitsPerCell']} bits/cell")
  print("Tribes:", ", ".join(tribe["id"] for tribe in header["tribes"]))

  write_csv("snapshot-grid.csv", header, values)
  write_golt("snapshot-roundtrip.golt", header, values)
  print("Wrote snapshot-grid.csv and snapshot-roundtrip.golt")

if __name__ == "__main__":
  main()
```

</details>

Run it with:

```bash
python golt_snapshot.py my-state.golt
```

## Creating Your Own Snapshot

To create a snapshot yourself:

1. Choose `cols`, `rows`, `generation`, `topology`, `boundaryTribe`, `randomSeed`, `tribes`, and `rules`.
2. Choose `bitsPerCell` large enough for `len(tribes)`.
3. Create a numeric grid where every value is a valid index into `tribes`.
4. Pack the numeric grid as little-endian `u32` words using the selected format.
5. Raw-deflate the packed bytes.
6. Write `GoLT`, version `1`, header byte length, header JSON, and compressed payload.

For compatibility with the app, keep `dead` as a tribe entry and make sure rules reference valid tribe IDs. The app can load snapshots with valid grid data but invalid or inconsistent rules may fail later when rule editing or shader generation references missing tribes.
