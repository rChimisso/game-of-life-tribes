import {GridFormat} from '~gol/feature/home/model/grid-format';
import {LiveMetricSectionSettings, MetricAvailability} from '~gol/feature/home/model/metrics';
import {Tribe} from '~gol/feature/home/model/rule';

/**
 * Histogram buffer size in bytes.
 *
 * @type {number}
 */
export const HISTOGRAM_BUFFER_SIZE = 256 * Uint32Array.BYTES_PER_ELEMENT;

/**
 * Boundary buffer size in bytes.
 *
 * @type {number}
 */
export const BOUNDARY_BUFFER_SIZE = Uint32Array.BYTES_PER_ELEMENT;

/**
 * Interactive metric section computed by the live WebGPU metrics pipeline.
 *
 * @typedef {InteractiveMetricSection}
 */
export type InteractiveMetricSection = 'population' | 'diversity' | 'interfaces';

/**
 * Two-dimensional metrics dispatch plan.
 *
 * @interface MetricsDispatchPlan2D
 * @typedef {MetricsDispatchPlan2D}
 */
export interface MetricsDispatchPlan2D {
  /**
   * Logical workgroup count on the x axis.
   *
   * @type {number}
   */
  logicalWgX: number;
  /**
   * Logical workgroup count on the y axis.
   *
   * @type {number}
   */
  logicalWgY: number;
  /**
   * Dispatched workgroup count on the x axis.
   *
   * @type {number}
   */
  dispatchWgX: number;
  /**
   * Dispatched workgroup count on the y axis.
   *
   * @type {number}
   */
  dispatchWgY: number;
  /**
   * Whether logical workgroups are remapped from a flattened dispatch.
   *
   * @type {boolean}
   */
  remapped: boolean;
}

/**
 * WebGPU resources used by live metrics.
 *
 * @interface InteractiveMetricsResources
 * @typedef {InteractiveMetricsResources}
 */
export interface InteractiveMetricsResources {
  /**
   * Histogram compute pipeline.
   *
   * @type {GPUComputePipeline}
   */
  histogramPipeline: GPUComputePipeline;
  /**
   * Histogram storage buffer.
   *
   * @type {GPUBuffer}
   */
  histogramBuffer: GPUBuffer;
  /**
   * Histogram readback buffer.
   *
   * @type {GPUBuffer}
   */
  histogramReadBuffer: GPUBuffer;
  /**
   * Boundary compute pipeline.
   *
   * @type {GPUComputePipeline}
   */
  boundaryPipeline: GPUComputePipeline;
  /**
   * Boundary storage buffer.
   *
   * @type {GPUBuffer}
   */
  boundaryBuffer: GPUBuffer;
  /**
   * Boundary readback buffer.
   *
   * @type {GPUBuffer}
   */
  boundaryReadBuffer: GPUBuffer;
}

/**
 * Request to create live metric WebGPU resources.
 *
 * @interface CreateInteractiveMetricsResourcesRequest
 * @typedef {CreateInteractiveMetricsResourcesRequest}
 */
export interface CreateInteractiveMetricsResourcesRequest {
  /**
   * WebGPU device.
   *
   * @type {GPUDevice}
   */
  device: GPUDevice;
  /**
   * Grid columns.
   *
   * @type {number}
   */
  cols: number;
  /**
   * Grid rows.
   *
   * @type {number}
   */
  rows: number;
  /**
   * Runtime grid packing format.
   *
   * @type {GridFormat}
   */
  gridFormat: GridFormat;
  /**
   * Metrics dispatch plan.
   *
   * @type {MetricsDispatchPlan2D}
   */
  dispatchPlan: MetricsDispatchPlan2D;
}

/**
 * Request to encode live metric GPU work.
 *
 * @interface EncodeInteractiveMetricsRequest
 * @typedef {EncodeInteractiveMetricsRequest}
 */
export interface EncodeInteractiveMetricsRequest {
  /**
   * WebGPU device.
   *
   * @type {GPUDevice}
   */
  device: GPUDevice;
  /**
   * Command encoder receiving metric passes.
   *
   * @type {GPUCommandEncoder}
   */
  encoder: GPUCommandEncoder;
  /**
   * Live metric GPU resources.
   *
   * @type {InteractiveMetricsResources}
   */
  resources: InteractiveMetricsResources;
  /**
   * Source grid buffer.
   *
   * @type {GPUBuffer}
   */
  sourceBuffer: GPUBuffer;
  /**
   * Metrics dispatch plan.
   *
   * @type {MetricsDispatchPlan2D}
   */
  dispatchPlan: MetricsDispatchPlan2D;
  /**
   * Enabled interactive metric sections.
   *
   * @type {readonly InteractiveMetricSection[]}
   */
  enabledSections: readonly InteractiveMetricSection[];
}

/**
 * Request to read live metric GPU outputs.
 *
 * @interface ReadInteractiveMetricsRequest
 * @typedef {ReadInteractiveMetricsRequest}
 */
export interface ReadInteractiveMetricsRequest {
  /**
   * Live metric GPU resources.
   *
   * @type {InteractiveMetricsResources}
   */
  resources: InteractiveMetricsResources;
  /**
   * Enabled interactive metric sections.
   *
   * @type {readonly InteractiveMetricSection[]}
   */
  enabledSections: readonly InteractiveMetricSection[];
}

/**
 * CPU readback from live metric GPU resources.
 *
 * @interface InteractiveMetricsReadback
 * @typedef {InteractiveMetricsReadback}
 */
export interface InteractiveMetricsReadback {
  /**
   * Population histogram by state index.
   *
   * @type {Uint32Array}
   */
  histogram: Uint32Array;
  /**
   * Cross-state contact edge count.
   *
   * @type {number}
   */
  crossStateContactEdges: number;
}

/**
 * Request to build a live metric message.
 *
 * @interface BuildMetricMessageRequest
 * @typedef {BuildMetricMessageRequest}
 */
export interface BuildMetricMessageRequest {
  /**
   * Generation represented by the metrics.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Ordered tribe metadata.
   *
   * @type {readonly Tribe[]}
   */
  tribes: readonly Tribe[];
  /**
   * Dead tribe index.
   *
   * @type {number}
   */
  deadTribeIndex: number;
  /**
   * GPU metric readback.
   *
   * @type {InteractiveMetricsReadback}
   */
  readback: InteractiveMetricsReadback;
  /**
   * Enabled live metric sections.
   *
   * @type {readonly InteractiveMetricSection[]}
   */
  enabledSections: readonly InteractiveMetricSection[];
  /**
   * Metric availability by section.
   *
   * @type {MetricAvailability}
   */
  availability: MetricAvailability;
  /**
   * User-selected live metric settings.
   *
   * @type {LiveMetricSectionSettings}
   */
  liveMetricSettings: LiveMetricSectionSettings;
  /**
   * Grid columns.
   *
   * @type {number}
   */
  cols: number;
  /**
   * Grid rows.
   *
   * @type {number}
   */
  rows: number;
  /**
   * Total recorded frames.
   *
   * @type {number}
   */
  totalFrames: number;
  /**
   * Current simulation frames per second.
   *
   * @type {number}
   */
  fps: number;
  /**
   * Whether step-back is currently available.
   *
   * @type {boolean}
   */
  canStepBack: boolean;
  /**
   * Compressed recording bytes.
   *
   * @type {number}
   */
  recordingBytes: number;
  /**
   * Raw recording bytes.
   *
   * @type {number}
   */
  recordingRawBytes: number;
}
