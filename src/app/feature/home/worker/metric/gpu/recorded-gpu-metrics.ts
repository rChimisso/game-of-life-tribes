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
 * Maximum value representable by WebGPU u32 counters.
 *
 * @type {number}
 */
const U32_MAX = 0xffff_ffff;

/**
 * Reusable GPU buffer with its allocated byte size.
 *
 * @interface ReusableGpuBuffer
 * @typedef {ReusableGpuBuffer}
 */
interface ReusableGpuBuffer {
  /**
   * GPU buffer.
   *
   * @type {GPUBuffer}
   */
  buffer: GPUBuffer;
  /**
   * Allocated buffer byte size.
   *
   * @type {number}
   */
  byteSize: number;
}

/**
 * Frame buffer slot retained across metric frames.
 *
 * @typedef {FrameBufferSlot}
 */
type FrameBufferSlot = 0 | 1;

/**
 * Recorded-frame GPU metrics backend.
 *
 * @export
 * @class RecordedGpuMetricBackend
 * @typedef {RecordedGpuMetricBackend}
 */
class RecordedGpuMetricBackend {
  /**
   * Cached compute pipelines by frame layout.
   *
   * @private
   * @readonly
   * @type {Map<string, GPUComputePipeline>}
   */
  private readonly pipelineCache = new Map<string, GPUComputePipeline>();

  /**
   * Cached bind groups by pipeline and buffer slot layout.
   *
   * @private
   * @readonly
   * @type {Map<string, GPUBindGroup>}
   */
  private readonly bindGroupCache = new Map<string, GPUBindGroup>();

  /**
   * Alternating frame storage buffers.
   *
   * @private
   * @type {[ReusableGpuBuffer | null, ReusableGpuBuffer | null]}
   */
  private readonly frameBuffers: [ReusableGpuBuffer | null, ReusableGpuBuffer | null] = [null, null];

  /**
   * Slot currently retaining the previous exported frame.
   *
   * @private
   * @type {(FrameBufferSlot | null)}
   */
  private previousFrameSlot: FrameBufferSlot | null = null;

  /**
   * Generation retained in the previous-frame slot.
   *
   * @private
   * @type {(number | null)}
   */
  private previousFrameGeneration: number | null = null;

  /**
   * Packing format retained in the previous-frame slot.
   *
   * @private
   * @type {string}
   */
  private previousFrameFormatKey = '';

  /**
   * Packed byte length retained in the previous-frame slot.
   *
   * @private
   * @type {number}
   */
  private previousFrameByteLength = 0;

  /**
   * Reusable stats storage buffer.
   *
   * @private
   * @type {(ReusableGpuBuffer | null)}
   */
  private statsBuffer: ReusableGpuBuffer | null = null;

  /**
   * Reusable stats readback buffer.
   *
   * @private
   * @type {(ReusableGpuBuffer | null)}
   */
  private readBuffer: ReusableGpuBuffer | null = null;

  /**
   * Resource version used to invalidate bind group cache keys.
   *
   * @private
   * @type {number}
   */
  private resourceVersion = 0;

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
   * Explains why a frame should skip the GPU backend.
   *
   * @public
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @returns {(string | null)} unsupported reason, or null when GPU can be used.
   */
  public unsupportedReason(frame: PackedRecordedFrame, tribes: readonly OfflineMetricsTribe[], previous: PreviousOfflineMetricFrame | null): string | null {
    const exactTransition = previous !== null && frame.generation - previous.generation === 1;
    const maxStorageBytes = this.maxStorageBufferBytes();
    const totalCells = frame.cols * frame.rows;
    const totalContactEdges = totalCells * 2;
    let reason: string | null = null;
    if (tribes.length > GPU_STATE_BUCKETS) {
      reason = `Recorded GPU Metrics supports up to ${GPU_STATE_BUCKETS} states.`;
    } else if (frame.words.byteLength > maxStorageBytes) {
      reason = `Recorded GPU Metrics frame buffer (${frame.words.byteLength} bytes) exceeds device storage buffer limit (${maxStorageBytes} bytes).`;
    } else if (exactTransition && previous && previous.words.byteLength > maxStorageBytes) {
      reason = `Recorded GPU Metrics previous frame buffer (${previous.words.byteLength} bytes) exceeds device storage buffer limit (${maxStorageBytes} bytes).`;
    } else if (totalCells > U32_MAX || totalContactEdges > U32_MAX) {
      reason = 'Recorded GPU Metrics counters can overflow for this grid size.';
    }
    return reason;
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
    this.pipelineCache.clear();
    this.bindGroupCache.clear();
    for (const frameBuffer of this.frameBuffers) {
      frameBuffer?.buffer.destroy();
    }
    this.statsBuffer?.buffer.destroy();
    this.readBuffer?.buffer.destroy();
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
    const previousFormat = previous?.format ?? frame.format;
    const pipelineKey = createPipelineKey(frame, previousFormat, exactTransition, tribeCount, deadIndex);
    const pipeline = this.getPipeline(pipelineKey, frame, previousFormat, exactTransition, tribeCount, deadIndex);
    const previousSlot = this.preparePreviousFrameSlot(previous, exactTransition);
    const currentSlot = previousSlot === 0 ? 1 : 0;
    const currentBuffer = this.uploadFrameToSlot(currentSlot, frame.words, 'recorded metric current frame');
    const previousBuffer = previousSlot === null ? currentBuffer : this.frameBuffers[previousSlot]!.buffer;
    const previousBindingSlot = previousSlot ?? currentSlot;
    const statsBuffer = this.ensureBuffer('stats', statsByteSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST).buffer;
    const readBuffer = this.ensureBuffer('readback', statsByteSize, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST).buffer;
    const bindGroup = this.getBindGroup(pipelineKey, currentSlot, previousBindingSlot, pipeline, currentBuffer, previousBuffer, statsBuffer);
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
    this.rememberPreviousFrame(currentSlot, frame);
    return readback;
  }

  /**
   * Returns the effective storage buffer size limit.
   *
   * @private
   * @returns {number} effective storage buffer byte limit.
   */
  private maxStorageBufferBytes(): number {
    return Math.min(this.device.limits.maxStorageBufferBindingSize, this.device.limits.maxBufferSize);
  }

  /**
   * Prepares the retained previous-frame slot.
   *
   * @private
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @param {boolean} exactTransition whether transition counters should be computed.
   * @returns {(FrameBufferSlot | null)} previous frame slot, or null when not needed.
   */
  private preparePreviousFrameSlot(previous: PreviousOfflineMetricFrame | null, exactTransition: boolean): FrameBufferSlot | null {
    let slot: FrameBufferSlot | null = null;
    if (exactTransition && previous) {
      const previousFormatKey = formatCacheKey(previous.format);
      const canReusePrevious = this.previousFrameSlot !== null &&
        this.previousFrameGeneration === previous.generation &&
        this.previousFrameFormatKey === previousFormatKey &&
        this.previousFrameByteLength === previous.words.byteLength;
      if (canReusePrevious) {
        slot = this.previousFrameSlot;
      } else {
        slot = 0;
        this.uploadFrameToSlot(slot, previous.words, 'recorded metric previous frame');
        this.previousFrameSlot = slot;
        this.previousFrameGeneration = previous.generation;
        this.previousFrameFormatKey = previousFormatKey;
        this.previousFrameByteLength = previous.words.byteLength;
      }
    }
    return slot;
  }

  /**
   * Uploads packed frame words to a reusable slot.
   *
   * @private
   * @param {FrameBufferSlot} slot frame buffer slot.
   * @param {Uint32Array} words packed frame words.
   * @param {string} label buffer label.
   * @returns {GPUBuffer} uploaded GPU buffer.
   */
  private uploadFrameToSlot(slot: FrameBufferSlot, words: Uint32Array, label: string): GPUBuffer {
    const byteSize = Math.max(Uint32Array.BYTES_PER_ELEMENT, words.byteLength);
    const existing = this.frameBuffers[slot];
    if (!existing || existing.byteSize !== byteSize) {
      existing?.buffer.destroy();
      this.frameBuffers[slot] = {
        buffer: this.device.createBuffer({
          label,
          size: byteSize,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        }),
        byteSize
      };
      this.invalidateBindGroups();
    }
    const {buffer} = this.frameBuffers[slot]!;
    if (words.byteLength > 0) {
      this.device.queue.writeBuffer(buffer, 0, words);
    }
    return buffer;
  }

  /**
   * Ensures a reusable stats buffer exists.
   *
   * @private
   * @param {'stats' | 'readback'} kind buffer kind.
   * @param {number} byteSize required byte size.
   * @param {GPUBufferUsageFlags} usage buffer usage flags.
   * @returns {ReusableGpuBuffer} reusable buffer.
   */
  private ensureBuffer(kind: 'stats' | 'readback', byteSize: number, usage: GPUBufferUsageFlags): ReusableGpuBuffer {
    const current = kind === 'stats' ? this.statsBuffer : this.readBuffer;
    let next = current;
    if (!next || next.byteSize !== byteSize) {
      current?.buffer.destroy();
      next = {
        buffer: this.device.createBuffer({
          label: kind === 'stats' ? 'recorded metric stats' : 'recorded metric stats readback',
          size: byteSize,
          usage
        }),
        byteSize
      };
      if (kind === 'stats') {
        this.statsBuffer = next;
      } else {
        this.readBuffer = next;
      }
      this.invalidateBindGroups();
    }
    return next;
  }

  /**
   * Gets or creates a cached compute pipeline.
   *
   * @private
   * @param {string} pipelineKey pipeline cache key.
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {GridFormat} previousFormat previous frame format.
   * @param {boolean} exactTransition whether transition counters should be computed.
   * @param {number} tribeCount known state count.
   * @param {number} deadIndex dead tribe index.
   * @returns {GPUComputePipeline} cached pipeline.
   */
  private getPipeline(pipelineKey: string, frame: PackedRecordedFrame, previousFormat: GridFormat, exactTransition: boolean, tribeCount: number, deadIndex: number): GPUComputePipeline {
    let pipeline = this.pipelineCache.get(pipelineKey);
    if (!pipeline) {
      pipeline = this.device.createComputePipeline({
        label: 'recorded metric pipeline',
        layout: 'auto',
        compute: {
          module: this.device.createShaderModule({
            label: 'recorded metric shader',
            code: buildRecordedMetricWgsl(frame, previousFormat, exactTransition, tribeCount, deadIndex)
          }),
          entryPoint: 'main'
        }
      });
      this.pipelineCache.set(pipelineKey, pipeline);
    }
    return pipeline;
  }

  /**
   * Gets or creates a cached bind group.
   *
   * @private
   * @param {string} pipelineKey pipeline cache key.
   * @param {FrameBufferSlot} currentSlot current frame slot.
   * @param {FrameBufferSlot} previousSlot previous frame slot.
   * @param {GPUComputePipeline} pipeline compute pipeline.
   * @param {GPUBuffer} currentBuffer current frame buffer.
   * @param {GPUBuffer} previousBuffer previous frame buffer.
   * @param {GPUBuffer} statsBuffer stats buffer.
   * @returns {GPUBindGroup} cached bind group.
   */
  private getBindGroup(pipelineKey: string, currentSlot: FrameBufferSlot, previousSlot: FrameBufferSlot, pipeline: GPUComputePipeline, currentBuffer: GPUBuffer, previousBuffer: GPUBuffer, statsBuffer: GPUBuffer): GPUBindGroup {
    const bindGroupKey = `${pipelineKey}|${currentSlot}|${previousSlot}|${this.resourceVersion}`;
    let bindGroup = this.bindGroupCache.get(bindGroupKey);
    if (!bindGroup) {
      bindGroup = this.device.createBindGroup({
        label: 'recorded metric bind group',
        layout: pipeline.getBindGroupLayout(0),
        entries: [{binding: 0, resource: {buffer: currentBuffer} }, {binding: 1, resource: {buffer: previousBuffer} }, {binding: 2, resource: {buffer: statsBuffer} }]
      });
      this.bindGroupCache.set(bindGroupKey, bindGroup);
    }
    return bindGroup;
  }

  /**
   * Retains the current frame slot as the next previous frame.
   *
   * @private
   * @param {FrameBufferSlot} slot current frame slot.
   * @param {PackedRecordedFrame} frame packed recorded frame.
   */
  private rememberPreviousFrame(slot: FrameBufferSlot, frame: PackedRecordedFrame): void {
    this.previousFrameSlot = slot;
    this.previousFrameGeneration = frame.generation;
    this.previousFrameFormatKey = formatCacheKey(frame.format);
    this.previousFrameByteLength = frame.words.byteLength;
  }

  /**
   * Invalidates cached bind groups after buffer recreation.
   *
   * @private
   */
  private invalidateBindGroups(): void {
    this.resourceVersion++;
    this.bindGroupCache.clear();
  }
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
 * Builds a GPU pipeline cache key.
 *
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {GridFormat} previousFormat previous frame packing format.
 * @param {boolean} exactTransition whether transition counters should be computed.
 * @param {number} tribeCount known state count.
 * @param {number} deadIndex dead tribe index.
 * @returns {string} pipeline cache key.
 */
function createPipelineKey(frame: PackedRecordedFrame, previousFormat: GridFormat, exactTransition: boolean, tribeCount: number, deadIndex: number): string {
  return [
    frame.cols,
    frame.rows,
    formatCacheKey(frame.format),
    formatCacheKey(previousFormat),
    exactTransition ? 'exact' : 'inexact',
    tribeCount,
    deadIndex
  ].join('|');
}

/**
 * Builds a cache key for a packing format.
 *
 * @param {GridFormat} format packing format.
 * @returns {string} packing format cache key.
 */
function formatCacheKey(format: GridFormat): string {
  return String(format.bitsPerCell);
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
