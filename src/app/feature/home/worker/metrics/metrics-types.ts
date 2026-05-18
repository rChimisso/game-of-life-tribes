import {GridFormat} from '../../model/grid-format';
import {LiveMetricSectionSettings, MetricAvailability} from '../../model/metrics';
import {Tribe} from '../../model/rule';

import {MetricMessage} from '../../model/worker-message';

export type InteractiveMetricSection = 'population' | 'diversity' | 'interfaces';

export interface MetricsDispatchPlan2D {
  logicalWgX: number;
  logicalWgY: number;
  dispatchWgX: number;
  dispatchWgY: number;
  remapped: boolean;
}

export interface InteractiveMetricsState {
  tribeLastAliveGen: Map<number, number>;
  tribeEverAlive: Set<number>;
}

export interface InteractiveMetricsResources {
  histogramPipeline: GPUComputePipeline;
  histogramBuffer: GPUBuffer;
  histogramReadBuffer: GPUBuffer;
  boundaryPipeline: GPUComputePipeline;
  boundaryBuffer: GPUBuffer;
  boundaryReadBuffer: GPUBuffer;
}

export interface CreateInteractiveMetricsResourcesRequest {
  device: GPUDevice;
  cols: number;
  rows: number;
  gridFormat: GridFormat;
  dispatchPlan: MetricsDispatchPlan2D;
}

export interface EncodeInteractiveMetricsRequest {
  device: GPUDevice;
  encoder: GPUCommandEncoder;
  resources: InteractiveMetricsResources;
  sourceBuffer: GPUBuffer;
  dispatchPlan: MetricsDispatchPlan2D;
  enabledSections: readonly InteractiveMetricSection[];
}

export interface ReadInteractiveMetricsRequest {
  resources: InteractiveMetricsResources;
  enabledSections: readonly InteractiveMetricSection[];
}

export interface InteractiveMetricsReadback {
  histogram: Uint32Array;
  crossStateContactEdges: number;
}

export interface BuildMetricMessageRequest {
  generation: number;
  tribes: readonly Tribe[];
  deadTribeIndex: number;
  readback: InteractiveMetricsReadback;
  enabledSections: readonly InteractiveMetricSection[];
  availability: MetricAvailability;
  liveMetricSettings: LiveMetricSectionSettings;
  cols: number;
  rows: number;
  totalFrames: number;
  fps: number;
  canStepBack: boolean;
  recordingBytes: number;
  recordingRawBytes: number;
}

export type InteractiveMetricMessage = MetricMessage;
