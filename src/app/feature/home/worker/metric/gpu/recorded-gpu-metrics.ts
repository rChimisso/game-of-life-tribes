import {GridFormat} from '../../../model/grid-format';
import {DEAD_TRIBE_ID} from '../../../model/rule';
import {PackedRecordedFrame} from '../../frame/recording-frame-stream';
import {buildOfflineMetricEntry, FrameMetricStats, OfflineMetricComputeOptions, OfflineMetricsTribe, PreviousOfflineMetricFrame} from '../core/offline';
import {OfflineMetricEntry} from '../core/offline-types';

/**
 * Number of state buckets supported by the recorded-frame GPU metric backend.
 *
 * @type {number}
 */
const GPU_STATE_BUCKETS = 256;

/**
 * Number of u32 counters in one GPU metric readback.
 *
 * @type {number}
 */
const GPU_STATS_U32_COUNT = (GPU_STATE_BUCKETS * 2) + 5;

/**
 * Recorded-frame GPU metrics backend.
 *
 * @export
 * @class RecordedGpuMetricBackend
 * @typedef {RecordedGpuMetricBackend}
 */
class RecordedGpuMetricBackend {
  /**
   * Creates a recorded-frame GPU metrics backend.
   *
   * @private
   * @param {GPUDevice} device webgpu device.
   */
  private constructor(private readonly device: GPUDevice) {}

  /**
   * Creates a recorded-frame GPU metrics backend when WebGPU is available.
   *
   * @public
   * @static
   * @async
   * @returns {Promise<(RecordedGpuMetricBackend | null)>} GPU backend or null.
   */
  public static async create(): Promise<RecordedGpuMetricBackend | null> {
    if (!('gpu' in navigator) || !navigator.gpu) {
      return null;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return null;
    }
    const device = await adapter.requestDevice({
      requiredLimits: {
        maxBufferSize: adapter.limits.maxBufferSize,
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
      }
    });
    return new RecordedGpuMetricBackend(device);
  }

  /**
   * Computes one recorded-frame Metrics row on the GPU.
   *
   * @public
   * @async
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @param {OfflineMetricComputeOptions} options compute options.
   * @returns {Promise<OfflineMetricEntry>} metric row.
   */
  public async computeFrameMetric(frame: PackedRecordedFrame, tribes: readonly OfflineMetricsTribe[], previous: PreviousOfflineMetricFrame | null, options: OfflineMetricComputeOptions): Promise<OfflineMetricEntry> {
    assertNotCancelled(options);
    if (tribes.length > GPU_STATE_BUCKETS) {
      throw new Error(`Recorded GPU Metrics supports up to ${GPU_STATE_BUCKETS} states.`);
    }
    const exactTransition = previous !== null && frame.generation - previous.generation === 1;
    const deadIndex = tribes.findIndex(tribe => tribe.id === DEAD_TRIBE_ID);
    const readback = await this.runMetricPass(frame, previous, exactTransition, tribes.length, deadIndex);
    assertNotCancelled(options);
    return buildOfflineMetricEntry(frame, tribes, previous, buildGpuFrameMetricStats(readback, tribes.length, exactTransition), deadIndex);
  }

  /**
   * Releases the WebGPU device.
   *
   * @public
   */
  public dispose(): void {
    this.device.destroy();
  }

  /**
   * Runs the recorded-frame GPU metric pass.
   *
   * @private
   * @async
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @param {boolean} exactTransition whether transition counters should be computed.
   * @param {number} tribeCount known state count.
   * @param {number} deadIndex dead tribe index.
   * @returns {Promise<Uint32Array>} metric counters.
   */
  private async runMetricPass(frame: PackedRecordedFrame, previous: PreviousOfflineMetricFrame | null, exactTransition: boolean, tribeCount: number, deadIndex: number): Promise<Uint32Array> {
    const statsByteSize = GPU_STATS_U32_COUNT * Uint32Array.BYTES_PER_ELEMENT;
    const currentBuffer = createStorageBuffer(this.device, 'recorded metric current frame', frame.words);
    const previousBuffer = createStorageBuffer(this.device, 'recorded metric previous frame', previous?.words ?? frame.words);
    const statsBuffer = this.device.createBuffer({
      label: 'recorded metric stats',
      size: statsByteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    const readBuffer = this.device.createBuffer({
      label: 'recorded metric stats readback',
      size: statsByteSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    const pipeline = this.device.createComputePipeline({
      label: 'recorded metric pipeline',
      layout: 'auto',
      compute: {
        module: this.device.createShaderModule({
          label: 'recorded metric shader',
          code: buildRecordedMetricWgsl(frame, previous?.format ?? frame.format, exactTransition, tribeCount, deadIndex)
        }),
        entryPoint: 'main'
      }
    });
    const bindGroup = this.device.createBindGroup({
      label: 'recorded metric bind group',
      layout: pipeline.getBindGroupLayout(0),
      entries: [{binding: 0, resource: {buffer: currentBuffer} }, {binding: 1, resource: {buffer: previousBuffer} }, {binding: 2, resource: {buffer: statsBuffer} }]
    });
    const encoder = this.device.createCommandEncoder({label: 'recorded metric encoder'});
    encoder.clearBuffer(statsBuffer);
    const pass = encoder.beginComputePass({label: 'recorded metric pass'});
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(frame.cols / 16), Math.ceil(frame.rows / 16));
    pass.end();
    encoder.copyBufferToBuffer(statsBuffer, 0, readBuffer, 0, statsByteSize);
    this.device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPUMapMode.READ);
    const readback = new Uint32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();
    currentBuffer.destroy();
    previousBuffer.destroy();
    statsBuffer.destroy();
    readBuffer.destroy();
    return readback;
  }
}

/**
 * Creates and uploads a storage buffer.
 *
 * @param {GPUDevice} device webgpu device.
 * @param {string} label buffer label.
 * @param {Uint32Array} words packed frame words.
 * @returns {GPUBuffer} uploaded buffer.
 */
function createStorageBuffer(device: GPUDevice, label: string, words: Uint32Array): GPUBuffer {
  const buffer = device.createBuffer({
    label,
    size: Math.max(Uint32Array.BYTES_PER_ELEMENT, words.byteLength),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  if (words.byteLength > 0) {
    device.queue.writeBuffer(buffer, 0, words);
  }
  return buffer;
}

/**
 * Builds the recorded-frame metric shader.
 *
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {GridFormat} previousFormat previous frame packing format.
 * @param {boolean} exactTransition whether transition counters should be computed.
 * @param {number} tribeCount known state count.
 * @param {number} deadIndex dead tribe index.
 * @returns {string} wgsl shader source.
 */
function buildRecordedMetricWgsl(frame: PackedRecordedFrame, previousFormat: GridFormat, exactTransition: boolean, tribeCount: number, deadIndex: number): string {
  return `
@group(0) @binding(0) var<storage, read> currentGrid: array<u32>;
@group(0) @binding(1) var<storage, read> previousGrid: array<u32>;
@group(0) @binding(2) var<storage, read_write> stats: array<atomic<u32>>;

const COLS: u32 = ${frame.cols}u;
const ROWS: u32 = ${frame.rows}u;
const STATE_COUNT: u32 = ${tribeCount}u;
const DEAD_INDEX: u32 = ${Math.max(0, deadIndex)}u;
const HAS_DEAD: bool = ${deadIndex >= 0};
const EXACT_TRANSITION: bool = ${exactTransition};

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

    if (EXACT_TRANSITION) {
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
function buildGpuFrameMetricStats(readback: Uint32Array, tribeCount: number, exactTransition: boolean): FrameMetricStats {
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
function assertNotCancelled(options: OfflineMetricComputeOptions): void {
  if (options.shouldCancel()) {
    throw new Error('Metrics computation cancelled');
  }
}

export {RecordedGpuMetricBackend};
