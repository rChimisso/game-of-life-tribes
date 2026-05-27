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
 * Metrics stats buffer byte size.
 *
 * @type {number}
 */
const GPU_STATS_BYTE_SIZE = GPU_STATS_U32_COUNT * Uint32Array.BYTES_PER_ELEMENT;

/**
 * Size of the uniform config buffer.
 *
 * @type {number}
 */
const GPU_CONFIG_U32_COUNT = 1;

/**
 * Metrics config buffer byte size.
 *
 * @type {number}
 */
const GPU_CONFIG_BYTE_SIZE = GPU_CONFIG_U32_COUNT * Uint32Array.BYTES_PER_ELEMENT;

/**
 * Maximum value representable by WebGPU u32 counters.
 *
 * @type {number}
 */
const U32_MAX = 0xffff_ffff;

/**
 * Reusable GPU Metrics resources for one export.
 *
 * @interface RecordedGpuMetricsContext
 * @typedef {RecordedGpuMetricsContext}
 */
interface RecordedGpuMetricsContext {
  /**
   * Compute pipeline specialized for the export layout.
   *
   * @type {GPUComputePipeline}
   */
  pipeline: GPUComputePipeline;
  /**
   * Bind group for reusable Metrics buffers.
   *
   * @type {GPUBindGroup}
   */
  bindGroup: GPUBindGroup;
  /**
   * Current-frame storage buffer.
   *
   * @type {GPUBuffer}
   */
  currentBuffer: GPUBuffer;
  /**
   * Previous-frame storage buffer.
   *
   * @type {GPUBuffer}
   */
  previousBuffer: GPUBuffer;
  /**
   * Metrics stats storage buffer.
   *
   * @type {GPUBuffer}
   */
  statsBuffer: GPUBuffer;
  /**
   * Metrics stats readback buffer.
   *
   * @type {GPUBuffer}
   */
  readbackBuffer: GPUBuffer;
  /**
   * Per-frame Metrics config uniform buffer.
   *
   * @type {GPUBuffer}
   */
  configBuffer: GPUBuffer;
  /**
   * Stats buffer byte size.
   *
   * @type {number}
   */
  statsByteSize: number;
  /**
   * Packed frame buffer byte size.
   *
   * @type {number}
   */
  frameByteSize: number;
}

/**
 * Recorded-frame GPU metrics backend.
 *
 * @export
 * @class RecordedGpuMetricBackend
 * @typedef {RecordedGpuMetricBackend}
 */
class RecordedGpuMetricBackend {
  /**
   * Reusable per-export GPU context.
   *
   * @private
   * @type {(RecordedGpuMetricsContext | null)}
   */
  private context: RecordedGpuMetricsContext | null = null;

  /**
   * GPU unsupported-reason warnings already logged.
   *
   * @private
   * @readonly
   * @type {Set<string>}
   */
  private readonly unsupportedWarnings = new Set<string>();

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
    let backend: RecordedGpuMetricBackend | null = null;
    if ('gpu' in navigator && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const device = await adapter.requestDevice({
          requiredLimits: {
            maxBufferSize: adapter.limits.maxBufferSize,
            maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
          }
        });
        backend = new RecordedGpuMetricBackend(device);
      }
    }
    return backend;
  }

  /**
   * Explains why a frame should skip the GPU backend.
   *
   * @public
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @returns {(string | null)} unsupported reason, or null when GPU can be used.
   */
  public unsupportedReason(frame: PackedRecordedFrame, tribes: readonly OfflineMetricsTribe[], previous: PreviousOfflineMetricFrame | null): string | null {
    let reason: string | null = null;
    if (tribes.length > GPU_STATE_BUCKETS) {
      reason = `Recorded GPU Metrics supports up to ${GPU_STATE_BUCKETS} states.`;
    } else {
      reason = this.frameLimitReason(frame, previous);
    }
    return reason;
  }

  /**
   * Returns whether the GPU backend can process a frame without exceeding fixed device limits.
   *
   * @public
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @returns {boolean} whether the frame can be processed on this GPU.
   */
  public canProcessFrame(frame: PackedRecordedFrame, previous: PreviousOfflineMetricFrame | null): boolean {
    return this.frameLimitReason(frame, previous) === null;
  }

  /**
   * Logs a GPU unsupported reason once.
   *
   * @public
   * @param {string} reason unsupported reason.
   * @returns {boolean} whether the reason was newly logged.
   */
  public warnUnsupported(reason: string): boolean {
    let logged = false;
    if (!this.unsupportedWarnings.has(reason)) {
      this.unsupportedWarnings.add(reason);
      console.warn(`[GOLT] ${reason} Using TypeScript Metrics for affected frames.`);
      logged = true;
    }
    return logged;
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
    const unsupportedReason = this.unsupportedReason(frame, tribes, previous);
    if (unsupportedReason) {
      throw new Error(unsupportedReason);
    }
    const exactTransition = previous !== null && frame.generation - previous.generation === 1;
    const deadIndex = tribes.findIndex(tribe => tribe.id === DEAD_TRIBE_ID);
    this.context ??= this.createContext(frame, previous?.format ?? frame.format, tribes.length, deadIndex);
    const readback = await this.runMetricPass(this.context, frame, previous, exactTransition);
    assertNotCancelled(options);
    return buildOfflineMetricEntry(frame, tribes, previous, buildGpuFrameMetricStats(readback, tribes.length, exactTransition), deadIndex);
  }

  /**
   * Releases the WebGPU device and per-export resources.
   *
   * @public
   */
  public dispose(): void {
    this.disposeContext();
    this.device.destroy();
  }

  /**
   * Creates the reusable per-export GPU Metrics context.
   *
   * @private
   * @param {PackedRecordedFrame} frame first packed recorded frame.
   * @param {GridFormat} previousFormat previous-frame packing format.
   * @param {number} tribeCount known state count.
   * @param {number} deadIndex dead tribe index.
   * @returns {RecordedGpuMetricsContext} reusable GPU context.
   */
  private createContext(frame: PackedRecordedFrame, previousFormat: GridFormat, tribeCount: number, deadIndex: number): RecordedGpuMetricsContext {
    const frameByteSize = Math.max(Uint32Array.BYTES_PER_ELEMENT, frame.words.byteLength);
    const shader = this.device.createShaderModule({
      label: 'recorded metric shader',
      code: buildRecordedMetricWgsl(frame, previousFormat, tribeCount, deadIndex)
    });
    const pipeline = this.device.createComputePipeline({
      label: 'recorded metric pipeline',
      layout: 'auto',
      compute: {
        module: shader,
        entryPoint: 'main'
      }
    });
    const currentBuffer = this.device.createBuffer({
      label: 'recorded metric current frame',
      size: frameByteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    const previousBuffer = this.device.createBuffer({
      label: 'recorded metric previous frame',
      size: frameByteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    const statsBuffer = this.device.createBuffer({
      label: 'recorded metric stats',
      size: GPU_STATS_BYTE_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    const readbackBuffer = this.device.createBuffer({
      label: 'recorded metric stats readback',
      size: GPU_STATS_BYTE_SIZE,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    const configBuffer = this.device.createBuffer({
      label: 'recorded metric config',
      size: GPU_CONFIG_BYTE_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const bindGroup = this.device.createBindGroup({
      label: 'recorded metric bind group',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {binding: 0, resource: {buffer: currentBuffer} },
        {binding: 1, resource: {buffer: previousBuffer} },
        {binding: 2, resource: {buffer: statsBuffer} },
        {binding: 3, resource: {buffer: configBuffer} }
      ]
    });
    return {
      pipeline,
      bindGroup,
      currentBuffer,
      previousBuffer,
      statsBuffer,
      readbackBuffer,
      configBuffer,
      statsByteSize: GPU_STATS_BYTE_SIZE,
      frameByteSize
    };
  }

  /**
   * Runs the recorded-frame GPU metric pass.
   *
   * @private
   * @async
   * @param {RecordedGpuMetricsContext} context reusable GPU context.
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @param {boolean} exactTransition whether transition counters should be computed.
   * @returns {Promise<Uint32Array>} metric counters.
   */
  private async runMetricPass(context: RecordedGpuMetricsContext, frame: PackedRecordedFrame, previous: PreviousOfflineMetricFrame | null, exactTransition: boolean): Promise<Uint32Array> {
    this.device.queue.writeBuffer(context.currentBuffer, 0, frame.words);
    this.device.queue.writeBuffer(context.previousBuffer, 0, previous?.words ?? frame.words);
    this.device.queue.writeBuffer(context.configBuffer, 0, new Uint32Array([exactTransition ? 1 : 0]));
    const encoder = this.device.createCommandEncoder({label: 'recorded metric encoder'});
    encoder.clearBuffer(context.statsBuffer);
    const pass = encoder.beginComputePass({label: 'recorded metric pass'});
    pass.setPipeline(context.pipeline);
    pass.setBindGroup(0, context.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(frame.cols / 16), Math.ceil(frame.rows / 16));
    pass.end();
    encoder.copyBufferToBuffer(context.statsBuffer, 0, context.readbackBuffer, 0, context.statsByteSize);
    this.device.queue.submit([encoder.finish()]);
    await context.readbackBuffer.mapAsync(GPUMapMode.READ);
    const readback = new Uint32Array(context.readbackBuffer.getMappedRange().slice(0));
    context.readbackBuffer.unmap();
    return readback;
  }

  /**
   * Explains fixed GPU limit incompatibilities for one frame.
   *
   * @private
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @returns {(string | null)} unsupported reason, or null when fixed limits are satisfied.
   */
  private frameLimitReason(frame: PackedRecordedFrame, previous: PreviousOfflineMetricFrame | null): string | null {
    const maxBufferBytes = this.device.limits.maxBufferSize;
    const maxStorageBytes = this.device.limits.maxStorageBufferBindingSize;
    const totalCells = frame.cols * frame.rows;
    const totalContactEdges = totalCells * 2;
    let reason: string | null = null;
    if (frame.words.byteLength > maxBufferBytes) {
      reason = `Recorded GPU Metrics frame buffer (${frame.words.byteLength} bytes) exceeds device buffer limit (${maxBufferBytes} bytes).`;
    } else if (frame.words.byteLength > maxStorageBytes) {
      reason = `Recorded GPU Metrics frame buffer (${frame.words.byteLength} bytes) exceeds device storage buffer binding limit (${maxStorageBytes} bytes).`;
    } else if (previous && previous.words.byteLength > maxBufferBytes) {
      reason = `Recorded GPU Metrics previous frame buffer (${previous.words.byteLength} bytes) exceeds device buffer limit (${maxBufferBytes} bytes).`;
    } else if (previous && previous.words.byteLength > maxStorageBytes) {
      reason = `Recorded GPU Metrics previous frame buffer (${previous.words.byteLength} bytes) exceeds device storage buffer binding limit (${maxStorageBytes} bytes).`;
    } else if (GPU_STATS_BYTE_SIZE > maxBufferBytes) {
      reason = `Recorded GPU Metrics stats buffer (${GPU_STATS_BYTE_SIZE} bytes) exceeds device buffer limit (${maxBufferBytes} bytes).`;
    } else if (GPU_STATS_BYTE_SIZE > maxStorageBytes) {
      reason = `Recorded GPU Metrics stats buffer (${GPU_STATS_BYTE_SIZE} bytes) exceeds device storage buffer binding limit (${maxStorageBytes} bytes).`;
    } else if (GPU_CONFIG_BYTE_SIZE > maxBufferBytes) {
      reason = `Recorded GPU Metrics config buffer (${GPU_CONFIG_BYTE_SIZE} bytes) exceeds device buffer limit (${maxBufferBytes} bytes).`;
    } else if (totalCells > U32_MAX || totalContactEdges > U32_MAX) {
      reason = 'Recorded GPU Metrics counters can overflow for this grid size.';
    }
    return reason;
  }

  /**
   * Releases the reusable GPU context.
   *
   * @private
   */
  private disposeContext(): void {
    if (this.context) {
      this.context.currentBuffer.destroy();
      this.context.previousBuffer.destroy();
      this.context.statsBuffer.destroy();
      this.context.readbackBuffer.destroy();
      this.context.configBuffer.destroy();
      this.context = null;
    }
  }
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
function buildRecordedMetricWgsl(frame: PackedRecordedFrame, previousFormat: GridFormat, tribeCount: number, deadIndex: number): string {
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
