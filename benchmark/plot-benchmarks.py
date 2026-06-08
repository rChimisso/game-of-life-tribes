"""Generate plots from README benchmark CSV data.

Usage::

  python readme/plot-benchmarks.py

The script reads ``readme/benchmark-results.csv`` and writes PNG plots to
``readme/plots``. It requires ``matplotlib``.
"""

import argparse
import csv
from collections import defaultdict
from pathlib import Path

def parse_args() -> argparse.Namespace:
  """Parse command-line arguments.

  :returns: Parsed command-line arguments.
  :rtype: argparse.Namespace
  """
  parser = argparse.ArgumentParser(description="Plot README benchmark CSV data.")
  parser.add_argument("--input", default="readme/benchmark-results.csv", help="Input benchmark CSV path.")
  parser.add_argument("--output-dir", default="readme/plots", help="Output directory for PNG plots.")
  return parser.parse_args()

def read_rows(path: Path) -> list[dict[str, str | float | int]]:
  """Read benchmark rows from the normalized CSV file.

  :param path: Path to the normalized benchmark CSV file.
  :returns: Parsed benchmark rows with numeric fields converted to native values.
  :rtype: list[dict[str, str | float | int]]
  """
  rows: list[dict[str, str | float | int]] = []
  with path.open(newline="", encoding="utf-8") as file:
    reader = csv.DictReader(file)
    for row in reader:
      rows.append({
        "full_grid": row["full_grid"],
        "actual_grid": row["actual_grid"],
        "cells": int(row["cells"]),
        "bit_packing": int(row["bit_packing"]),
        "mode": row["mode"],
        "frame_size_bytes": int(row["frame_size_bytes"]),
        "gen_per_second": float(row["gen_per_second"]),
        "cell_updates_per_second": float(row["cell_updates_per_second"]),
        "data_volume_bytes_per_second": float(row["data_volume_bytes_per_second"]) if row["data_volume_bytes_per_second"] else 0.0,
        "backpressure": row["backpressure"],
      })
  return rows

def grid_sort_key(grid: str) -> int:
  """Return the numeric side of a square full-grid label.

  :param grid: Square full-grid label such as ``1024x1024``.
  :returns: Numeric grid side length.
  :rtype: int
  """
  return int(grid.split("x", maxsplit=1)[0])

def grid_label(grid: str) -> str:
  """Return the side length label for a square full-grid label.

  :param grid: Square full-grid label such as ``1024x1024``.
  :returns: Grid side label extracted from the full-grid label.
  :rtype: str
  """
  return grid.split("x", maxsplit=1)[0]

def format_bytes(value: float) -> str:
  """Format a byte count for an axis tick.

  :param value: Byte count to format.
  :returns: Human-readable byte string using binary units.
  :rtype: str
  """
  units = ["B", "KiB", "MiB", "GiB"]
  size = value
  unit_index = 0
  while size >= 1024 and unit_index < len(units) - 1:
    size /= 1024
    unit_index += 1
  return f"{size:g} {units[unit_index]}"

def set_frame_size_ticks(ax, rows: list[dict[str, str | float | int]]) -> None:
  """Set frame-size axis ticks to the measured frame sizes.

  :param ax: Matplotlib axes to update.
  :param rows: Benchmark rows that provide measured frame sizes.
  :returns: ``None``. Updates ``ax`` in place.
  :rtype: None
  """
  from matplotlib.ticker import FixedLocator, NullLocator

  frame_sizes = sorted({float(row["frame_size_bytes"]) for row in rows})
  ticks = [size / 1024 / 1024 for size in frame_sizes]
  labels = [format_bytes(size) for size in frame_sizes]
  ax.xaxis.set_major_locator(FixedLocator(ticks))
  ax.xaxis.set_minor_locator(NullLocator())
  ax.set_xticklabels(labels, rotation=45, ha="right")

def plot_gen_per_second_by_grid(
  rows: list[dict[str, str | float | int]],
  output_dir: Path,
  mode: str,
  output_name: str,
  title: str,
) -> None:
  """Plot raw generations per second by grid and packing.

  :param rows: Benchmark rows to plot.
  :param output_dir: Directory where the PNG file will be written.
  :param mode: Benchmark mode to filter, such as ``baseline`` or ``recording``.
  :param output_name: Output PNG file name.
  :param title: Plot title.
  :returns: ``None``. Writes the generated plot to disk.
  :rtype: None
  """
  import matplotlib.pyplot as plt

  selected = [row for row in rows if row["mode"] == mode]
  grids = sorted({str(row["full_grid"]) for row in selected}, key=grid_sort_key)
  labels = [grid_label(grid) for grid in grids]
  by_packing: dict[int, dict[str, float]] = defaultdict(dict)
  for row in selected:
    by_packing[int(row["bit_packing"])][str(row["full_grid"])] = float(row["gen_per_second"])

  fig, ax = plt.subplots(figsize=(12, 6))
  for packing in sorted(by_packing):
    values = [by_packing[packing].get(grid) for grid in grids]
    ax.plot(labels, values, marker="o", linewidth=1.8, label=f"{packing}-bit")

  ax.set_title(title)
  ax.set_xlabel("Grid side")
  ax.set_ylabel("Generations/s")
  ax.set_yscale("log")
  ax.grid(True, which="both", alpha=0.25)
  ax.legend(ncol=3)
  ax.tick_params(axis="x", rotation=45)
  fig.tight_layout()
  fig.savefig(output_dir / output_name, dpi=180)
  plt.close(fig)

def plot_baseline_cell_updates(rows: list[dict[str, str | float | int]], output_dir: Path) -> None:
  """Plot baseline cell updates per second by grid and packing.

  :param rows: Benchmark rows to plot.
  :param output_dir: Directory where the PNG file will be written.
  :returns: ``None``. Writes the generated plot to disk.
  :rtype: None
  """
  import matplotlib.pyplot as plt

  baseline = [row for row in rows if row["mode"] == "baseline"]
  grids = sorted({str(row["full_grid"]) for row in baseline}, key=grid_sort_key)
  labels = [grid_label(grid) for grid in grids]
  by_packing: dict[int, dict[str, float]] = defaultdict(dict)
  for row in baseline:
    by_packing[int(row["bit_packing"])][str(row["full_grid"])] = float(row["cell_updates_per_second"]) / 1_000_000_000

  fig, ax = plt.subplots(figsize=(12, 6))
  for packing in sorted(by_packing):
    values = [by_packing[packing].get(grid) for grid in grids]
    ax.plot(labels, values, marker="o", linewidth=1.8, label=f"{packing}-bit")

  ax.set_title("Baseline Throughput by Grid Size")
  ax.set_xlabel("Grid side")
  ax.set_ylabel("Cell updates/s (billions)")
  ax.grid(True, alpha=0.25)
  ax.legend(ncol=3)
  ax.tick_params(axis="x", rotation=45)
  fig.tight_layout()
  fig.savefig(output_dir / "benchmark-baseline-cell-updates.png", dpi=180)
  plt.close(fig)

def plot_recording_data_volume(rows: list[dict[str, str | float | int]], output_dir: Path) -> None:
  """Plot recording data volume per second by grid and packing.

  :param rows: Benchmark rows to plot.
  :param output_dir: Directory where the PNG file will be written.
  :returns: ``None``. Writes the generated plot to disk.
  :rtype: None
  """
  import matplotlib.pyplot as plt

  recording = [row for row in rows if row["mode"] == "recording"]
  grids = sorted({str(row["full_grid"]) for row in recording}, key=grid_sort_key)
  labels = [grid_label(grid) for grid in grids]
  by_packing: dict[int, dict[str, float]] = defaultdict(dict)
  for row in recording:
    mib_per_second = float(row["data_volume_bytes_per_second"]) / 1024 / 1024
    by_packing[int(row["bit_packing"])][str(row["full_grid"])] = mib_per_second

  fig, ax = plt.subplots(figsize=(12, 6))
  for packing in sorted(by_packing):
    values = [by_packing[packing].get(grid) for grid in grids]
    ax.plot(labels, values, marker="o", linewidth=1.8, label=f"{packing}-bit")

  ax.set_title("Recording Data Volume by Grid Size")
  ax.set_xlabel("Grid side")
  ax.set_ylabel("Raw data volume (MiB/s)")
  ax.grid(True, alpha=0.25)
  ax.legend(ncol=3)
  ax.tick_params(axis="x", rotation=45)
  fig.tight_layout()
  fig.savefig(output_dir / "benchmark-recording-data-volume.png", dpi=180)
  plt.close(fig)

def plot_frame_size_vs_recording_gen(rows: list[dict[str, str | float | int]], output_dir: Path) -> None:
  """Plot recording generations per second by raw frame size.

  :param rows: Benchmark rows to plot.
  :param output_dir: Directory where the PNG file will be written.
  :returns: ``None``. Writes the generated plot to disk.
  :rtype: None
  """
  import matplotlib.pyplot as plt

  recording = [row for row in rows if row["mode"] == "recording"]
  by_packing: dict[int, list[dict[str, str | float | int]]] = defaultdict(list)
  for row in recording:
    by_packing[int(row["bit_packing"])].append(row)

  fig, ax = plt.subplots(figsize=(12, 6))
  for packing in sorted(by_packing):
    packed_rows = sorted(by_packing[packing], key=lambda row: float(row["frame_size_bytes"]))
    frame_mib = [float(row["frame_size_bytes"]) / 1024 / 1024 for row in packed_rows]
    gen_per_second = [float(row["gen_per_second"]) for row in packed_rows]
    ax.plot(frame_mib, gen_per_second, marker="o", linewidth=1.8, label=f"{packing}-bit")

  ax.set_title("Recording Generations by Frame Size")
  ax.set_xlabel("Frame size (MiB)")
  ax.set_ylabel("Generations/s")
  ax.set_xscale("log")
  ax.set_yscale("log")
  set_frame_size_ticks(ax, recording)
  ax.grid(True, which="both", alpha=0.25)
  ax.legend(ncol=3)
  fig.tight_layout()
  fig.savefig(output_dir / "benchmark-recording-gen-by-frame-size.png", dpi=180)
  plt.close(fig)

def plot_frame_size_vs_recording_volume(rows: list[dict[str, str | float | int]], output_dir: Path) -> None:
  """Plot recording data volume per second by raw frame size.

  :param rows: Benchmark rows to plot.
  :param output_dir: Directory where the PNG file will be written.
  :returns: ``None``. Writes the generated plot to disk.
  :rtype: None
  """
  import matplotlib.pyplot as plt

  recording = [row for row in rows if row["mode"] == "recording"]
  by_packing: dict[int, list[dict[str, str | float | int]]] = defaultdict(list)
  for row in recording:
    by_packing[int(row["bit_packing"])].append(row)

  fig, ax = plt.subplots(figsize=(12, 6))
  for packing in sorted(by_packing):
    packed_rows = sorted(by_packing[packing], key=lambda row: float(row["frame_size_bytes"]))
    frame_mib = [float(row["frame_size_bytes"]) / 1024 / 1024 for row in packed_rows]
    data_mib_per_second = [float(row["data_volume_bytes_per_second"]) / 1024 / 1024 for row in packed_rows]
    ax.plot(frame_mib, data_mib_per_second, marker="o", linewidth=1.8, label=f"{packing}-bit")

  ax.set_title("Recording Data Volume by Frame Size")
  ax.set_xlabel("Frame size (MiB)")
  ax.set_ylabel("Raw data volume (MiB/s)")
  ax.set_xscale("log")
  set_frame_size_ticks(ax, recording)

  no_backpressure = [
    float(row["data_volume_bytes_per_second"]) / 1024 / 1024
    for row in recording
    if row["backpressure"] == "No"
  ]
  with_backpressure = [
    float(row["data_volume_bytes_per_second"]) / 1024 / 1024
    for row in recording
    if row["backpressure"] == "Yes"
  ]
  if no_backpressure and with_backpressure:
    threshold = (max(no_backpressure) + min(with_backpressure)) / 2
    ax.axhline(
      threshold,
      color="#dc2626",
      linestyle="--",
      linewidth=1.4,
      label=f"Backpressure separator (~{threshold:.0f} MiB/s)",
    )

  ax.grid(True, alpha=0.25)
  ax.legend(ncol=3)
  fig.tight_layout()
  fig.savefig(output_dir / "benchmark-recording-volume-by-frame-size.png", dpi=180)
  plt.close(fig)

def main() -> None:
  """Create all README benchmark plots.

  :returns: ``None``. Writes all benchmark plot images to disk.
  :rtype: None
  """
  args = parse_args()
  input_path = Path(args.input)
  output_dir = Path(args.output_dir)
  output_dir.mkdir(parents=True, exist_ok=True)
  rows = read_rows(input_path)
  plot_gen_per_second_by_grid(
    rows,
    output_dir,
    "baseline",
    "benchmark-baseline-gen-per-second.png",
    "Baseline Generations by Grid Size",
  )
  plot_gen_per_second_by_grid(
    rows,
    output_dir,
    "recording",
    "benchmark-recording-gen-per-second.png",
    "Recording Generations by Grid Size",
  )
  plot_baseline_cell_updates(rows, output_dir)
  plot_recording_data_volume(rows, output_dir)
  plot_frame_size_vs_recording_gen(rows, output_dir)
  plot_frame_size_vs_recording_volume(rows, output_dir)
  print(f"Wrote benchmark plots to {output_dir}")

if __name__ == "__main__":
  main()
