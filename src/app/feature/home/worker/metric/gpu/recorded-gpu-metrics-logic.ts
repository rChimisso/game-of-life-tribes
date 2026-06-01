import {GPU_STATE_BUCKETS} from './recorded-gpu-metrics-model';
import {PackedRecordedFrame} from '../../frame/recording-frame-types';
import {FrameMetricStats, OfflineMetricComputeOptions} from '../core/offline-compute-types';

import {GridFormat} from '~gol/feature/home/model/grid-format';

/**
 * Creates the device-loss error used to retire the GPU Metrics backend.
 *
 * @param {GPUDeviceLostInfo} info device loss information.
 * @returns {Error} device-loss error.
 */
export function createRecordedGpuMetricsDeviceLostError(info: GPUDeviceLostInfo): Error {
  const message = info.message ? `Recorded GPU Metrics device lost: ${info.message}` : 'Recorded GPU Metrics device lost.';
  return new Error(message);
}

/**
 * Builds the recorded-frame metric shader.
 *
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {GridFormat} previousFormat previous frame packing format.
 * @param {number} tribeCount known state count.
 * @param {number} deadIndex dead tribe index.
 * @returns {string} wgsl shader source.
 */
export function buildRecordedMetricWgsl(frame: PackedRecordedFrame, previousFormat: GridFormat, tribeCount: number, deadIndex: number): string {
  return `
@group(0) @binding(0) var<storage, read> currentGrid: array<u32>;
@group(0) @binding(1) var<storage, read> previousGrid: array<u32>;
@group(0) @binding(2) var<storage, read_write> stats: array<atomic<u32>>;

struct MetricConfig {
  exactTransition: u32,
};

@group(0) @binding(3) var<uniform> config: MetricConfig;

const COLS: u32 = ${frame.cols}u;
const ROWS: u32 = ${frame.rows}u;
const STATE_COUNT: u32 = ${tribeCount}u;
const DEAD_INDEX: u32 = ${Math.max(0, deadIndex)}u;
const HAS_DEAD: bool = ${deadIndex >= 0};

const CURRENT_CELLS_PER_WORD: u32 = ${frame.format.cellsPerWord}u;
const CURRENT_WORD_SHIFT: u32 = ${frame.format.wordShift}u;
const CURRENT_CELL_SHIFT: u32 = ${frame.format.cellShift}u;
const CURRENT_CELL_INDEX_MASK: u32 = ${frame.format.cellIndexMask}u;
const CURRENT_CELL_MASK: u32 = ${frame.format.cellMask}u;
const CURRENT_PACKED_COLS: u32 = (COLS + CURRENT_CELLS_PER_WORD - 1u) >> CURRENT_WORD_SHIFT;

const PREVIOUS_CELLS_PER_WORD: u32 = ${previousFormat.cellsPerWord}u;
const PREVIOUS_WORD_SHIFT: u32 = ${previousFormat.wordShift}u;
const PREVIOUS_CELL_SHIFT: u32 = ${previousFormat.cellShift}u;
const PREVIOUS_CELL_INDEX_MASK: u32 = ${previousFormat.cellIndexMask}u;
const PREVIOUS_CELL_MASK: u32 = ${previousFormat.cellMask}u;
const PREVIOUS_PACKED_COLS: u32 = (COLS + PREVIOUS_CELLS_PER_WORD - 1u) >> PREVIOUS_WORD_SHIFT;

const FRONTIER_OFFSET: u32 = 256u;
const CROSS_OFFSET: u32 = 512u;
const CHANGED_OFFSET: u32 = 513u;
const BIRTHS_OFFSET: u32 = 514u;
const DEATHS_OFFSET: u32 = 515u;
const SWITCHES_OFFSET: u32 = 516u;

var<workgroup> localCounts: array<atomic<u32>, 256>;
var<workgroup> localFrontier: array<atomic<u32>, 256>;
var<workgroup> localCross: atomic<u32>;
var<workgroup> localChanged: atomic<u32>;
var<workgroup> localBirths: atomic<u32>;
var<workgroup> localDeaths: atomic<u32>;
var<workgroup> localSwitches: atomic<u32>;

fn readCurrentCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * CURRENT_PACKED_COLS + (x >> CURRENT_WORD_SHIFT);
  let shift = (x & CURRENT_CELL_INDEX_MASK) << CURRENT_CELL_SHIFT;
  return (currentGrid[wordIdx] >> shift) & CURRENT_CELL_MASK;
}

fn readPreviousCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PREVIOUS_PACKED_COLS + (x >> PREVIOUS_WORD_SHIFT);
  let shift = (x & PREVIOUS_CELL_INDEX_MASK) << PREVIOUS_CELL_SHIFT;
  return (previousGrid[wordIdx] >> shift) & PREVIOUS_CELL_MASK;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_index) lid: u32) {
  atomicStore(&localCounts[lid], 0u);
  atomicStore(&localFrontier[lid], 0u);
  if (lid == 0u) {
    atomicStore(&localCross, 0u);
    atomicStore(&localChanged, 0u);
    atomicStore(&localBirths, 0u);
    atomicStore(&localDeaths, 0u);
    atomicStore(&localSwitches, 0u);
  }
  workgroupBarrier();

  let x = gid.x;
  let y = gid.y;
  if (x < COLS && y < ROWS) {
    let state = readCurrentCell(x, y);
    if (state < STATE_COUNT) {
      atomicAdd(&localCounts[state], 1u);
    }

    let right = readCurrentCell((x + 1u) % COLS, y);
    let bottom = readCurrentCell(x, (y + 1u) % ROWS);
    if (right != state) {
      atomicAdd(&localCross, 1u);
      if (state < STATE_COUNT) {
        atomicAdd(&localFrontier[state], 1u);
      }
    }
    if (bottom != state) {
      atomicAdd(&localCross, 1u);
      if (state < STATE_COUNT) {
        atomicAdd(&localFrontier[state], 1u);
      }
    }

    if (config.exactTransition != 0u) {
      let previousState = readPreviousCell(x, y);
      if (previousState != state) {
        atomicAdd(&localChanged, 1u);
        if (HAS_DEAD && previousState == DEAD_INDEX && state != DEAD_INDEX) {
          atomicAdd(&localBirths, 1u);
        } else if (HAS_DEAD && previousState != DEAD_INDEX && state == DEAD_INDEX) {
          atomicAdd(&localDeaths, 1u);
        } else if (!HAS_DEAD || (previousState != DEAD_INDEX && state != DEAD_INDEX)) {
          atomicAdd(&localSwitches, 1u);
        }
      }
    }
  }
  workgroupBarrier();

  let count = atomicLoad(&localCounts[lid]);
  if (count > 0u) {
    atomicAdd(&stats[lid], count);
  }
  let frontier = atomicLoad(&localFrontier[lid]);
  if (frontier > 0u) {
    atomicAdd(&stats[FRONTIER_OFFSET + lid], frontier);
  }
  if (lid == 0u) {
    atomicAdd(&stats[CROSS_OFFSET], atomicLoad(&localCross));
    atomicAdd(&stats[CHANGED_OFFSET], atomicLoad(&localChanged));
    atomicAdd(&stats[BIRTHS_OFFSET], atomicLoad(&localBirths));
    atomicAdd(&stats[DEATHS_OFFSET], atomicLoad(&localDeaths));
    atomicAdd(&stats[SWITCHES_OFFSET], atomicLoad(&localSwitches));
  }
}
`;
}

/**
 * Converts gpu readback counters into shared offline metric stats.
 *
 * @param {Uint32Array} readback gpu readback counters.
 * @param {number} tribeCount known state count.
 * @param {boolean} exactTransition whether transition counters were computed.
 * @returns {FrameMetricStats} aggregate frame stats.
 */
export function buildGpuFrameMetricStats(readback: Uint32Array, tribeCount: number, exactTransition: boolean): FrameMetricStats {
  return {
    counts: Array.from(readback.slice(0, tribeCount)),
    frontierCounts: Array.from(readback.slice(GPU_STATE_BUCKETS, GPU_STATE_BUCKETS + tribeCount)),
    crossStateContactEdges: readback[GPU_STATE_BUCKETS * 2] ?? 0,
    transition: {
      exact: exactTransition,
      changedCells: readback[(GPU_STATE_BUCKETS * 2) + 1] ?? 0,
      births: readback[(GPU_STATE_BUCKETS * 2) + 2] ?? 0,
      deaths: readback[(GPU_STATE_BUCKETS * 2) + 3] ?? 0,
      tribeSwitches: readback[(GPU_STATE_BUCKETS * 2) + 4] ?? 0
    }
  };
}

/**
 * Throws when Metrics computation has been cancelled.
 *
 * @param {OfflineMetricComputeOptions} options compute options.
 */
export function assertNotCancelled(options: OfflineMetricComputeOptions): void {
  if (options.shouldCancel()) {
    throw new Error('Metrics computation cancelled');
  }
}
