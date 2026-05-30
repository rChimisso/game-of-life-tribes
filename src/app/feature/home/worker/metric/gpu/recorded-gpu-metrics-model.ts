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

export {GPU_CONFIG_BYTE_SIZE, GPU_STATS_BYTE_SIZE, GPU_STATE_BUCKETS, U32_MAX};

export type {RecordedGpuMetricsContext};
