/* eslint-disable max-lines */
import '~gol/core/function/timestamped-console';

import renderWgsl from './render.wgsl';
import {clampBrushDensity} from '../logic/brush-density';
import {chooseTightStorageGridFormat, fitsGridFormatInMaxBytes, gridByteSize, gridFormatFromBits, gridFormatFromMetadata, gridFormatMetadata, isSupportedBitsPerCell, packedColsForFormat, requiredGridFormatForStateCount, smallestFittingSimulationGridFormat, smallestValidSimulationGridFormat, validatePackingAgainstStateCount} from '../logic/grid-format';
import {normalizeLiveMetricsSettings} from '../logic/metric-settings';
import {normalizeRuleProbability, normalizeRuleset} from '../logic/rule-editor';
import {postWorkerTransfer} from '../logic/worker-post';
import {Grid} from '../model/grid';
import {GridFormat, GridFormatMetadata, GRID_FORMAT_8} from '../model/grid-format';
import {DEFAULT_LIVE_METRICS_SETTINGS, LiveMetricsSettings, MetricAvailability} from '../model/metrics';
import {ChunkMeta, RecordingManifest} from '../model/recording';
import {BOUNDED_GRID_TOPOLOGY, DEAD_TRIBE_ID, Ruleset, TOROIDAL_GRID_TOPOLOGY, Tribe} from '../model/rule';
import {BrushPreviewMessage, CameraMessage, DrawMessage, ExportFrameOverlayMessage, InitMessage, LoadSnapshotMessage, ResizeMessage, SetLiveMetricsMessage, SetRecordingMessage, SetRulesetMessage, SetRunningMessage, SetSpeedMessage, StepBackMessage, StepForwardMessage, UpdateChunkCodecMessage, WorkerMessage} from '../model/worker-message';
import {requestWorkerGpuDevice} from './gpu/gpu-device';
import {GPU_LABELS} from './gpu/gpu-labels';
import {buildInteractiveMetricMessage, createInteractiveMetricsResources, destroyInteractiveMetricsResources, encodeInteractiveMetrics, readInteractiveMetrics} from './metric/interactive/interactive';
import {activeInteractiveMetricSections, planInteractiveMetricAvailability} from './metric/interactive/planner';
import {BOUNDARY_BUFFER_SIZE, HISTOGRAM_BUFFER_SIZE, InteractiveMetricSection, InteractiveMetricsResources} from './metric/interactive/types';
import {repackPackedGrid} from './snapshot/packing/packed-repack';
import {createBrushDispatchRects, generateBrushWgsl} from './webengine/logic/brush';
import {generateComputeWgsl, plan2DDispatch} from './webengine/logic/compute-wgsl';
import {buildRecordingLimitsPayload, buildStorageQuotaSnapshot, canRecord, canSealCurrentChunk, cloneRecordingChunks, computeChunkFrameCapacity, countFrames, evaluateRecordingBackpressure, majorBufferAllocationYieldBytes, maxPendingOpfsWritesForCurrentChunk, maxRecordingBufferBytes, maxSimulationBufferBytes, needsInitialCapture, recordingAvailableForCurrentFrame, recordingRawBytes, recordingStoredBytes, updateManifestRange, vramBudgetBytes} from './webengine/logic/recording';
import {createRenderUniformData, createTribeColorData, generateRenderWgsl} from './webengine/logic/render';
import {createAdaptiveBatchState, currentRunPacing, fixedRunStepBudget, isTargetRun, nextFixedRunAccumulator, nonRecordingMaxSpeedBatchesPerDrain, remainingTargetSteps, restoreAfterStopState, runTargetReached, shouldPostStopStepping, shouldRestartRestoredRun, skipBatchSize, updateAdaptiveBatchState} from './webengine/logic/run';
import {bufferedStepBackState, buildStepBackPrefix, resolveStepBackTarget} from './webengine/logic/step-back';
import {BrushPreview, PendingBrush} from './webengine/model/brush';
import {DispatchPlan2D} from './webengine/model/dispatch-plan';
import {OPFS_DIR, RAW_DEFLATE_CODEC, RAW_PACKED_CODEC, STAGING_RING_SIZE} from './webengine/model/recording-runtime';
import {ExportFrameOverlay, TRIBE_COLOR_BUFFER_SIZE, UNIFORM_SIZE} from './webengine/model/render';
import {PumpSchedule, StopRunOptions} from './webengine/model/run-control';
import {RunKind, RunRequest, RunState, RunStopReason} from './webengine/model/run-state';

/**
 * Active worker GPU device.
 *
 * @type {GPUDevice}
 */
let device: GPUDevice;
/**
 * Whether the current GPU device has been lost.
 *
 * @type {boolean}
 */
let deviceLost = false;
/**
 * WebGPU canvas context used for presentation.
 *
 * @type {GPUCanvasContext}
 */
let context: GPUCanvasContext;
/**
 * Preferred presentation texture format for the worker canvas.
 *
 * @type {GPUTextureFormat}
 */
let canvasFormat: GPUTextureFormat;
/**
 * Offscreen canvas owned by this worker.
 *
 * @type {OffscreenCanvas}
 */
let canvas: OffscreenCanvas;

/**
 * Active simulation ruleset.
 *
 * @type {Ruleset<readonly Tribe[]>}
 */
let ruleset: Ruleset<readonly Tribe[]>;
/**
 * Current logical grid column count.
 *
 * @type {number}
 */
let cols = 0;
/**
 * Current logical grid row count.
 *
 * @type {number}
 */
let rows = 0;
/**
 * Current packed-grid column count in storage words.
 *
 * @type {number}
 */
let packedCols = 0;
/**
 * Packed storage format used by the simulation buffers.
 *
 * @type {GridFormat}
 */
let gridFormat: GridFormat = GRID_FORMAT_8;
/**
 * Active tribe palette in simulation order.
 *
 * @type {Tribe[]}
 */
let tribes: Tribe[] = [];
/**
 * Lookup from tribe ID to active tribe index.
 *
 * @type {Map<string, number>}
 */
const tribeIndex = new Map<string, number>();

/**
 * Workgroup dispatch plan for simulation passes.
 *
 * @type {DispatchPlan2D}
 */
let simulationDispatchPlan: DispatchPlan2D;
/**
 * Workgroup dispatch plan for interactive metrics passes.
 *
 * @type {DispatchPlan2D}
 */
let metricsDispatchPlan: DispatchPlan2D;

/**
 * First ping-pong simulation grid buffer.
 *
 * @type {GPUBuffer}
 */
let gridBufferA: GPUBuffer;
/**
 * Second ping-pong simulation grid buffer.
 *
 * @type {GPUBuffer}
 */
let gridBufferB: GPUBuffer;
/**
 * Render uniform buffer shared by draw passes.
 *
 * @type {GPUBuffer}
 */
let uniformBuffer: GPUBuffer;
/**
 * Storage buffer containing tribe color data.
 *
 * @type {GPUBuffer}
 */
let tribeColorBuffer: GPUBuffer;

/**
 * Render pipeline for the current canvas and grid format.
 *
 * @type {GPURenderPipeline}
 */
let renderPipeline: GPURenderPipeline;
/**
 * Render bind group that reads from grid buffer A.
 *
 * @type {GPUBindGroup}
 */
let renderBindGroupA: GPUBindGroup;
/**
 * Render bind group that reads from grid buffer B.
 *
 * @type {GPUBindGroup}
 */
let renderBindGroupB: GPUBindGroup;
/**
 * Simulation compute pipeline.
 *
 * @type {GPUComputePipeline}
 */
let computePipeline: GPUComputePipeline;
/**
 * Simulation bind group that writes from buffer A into buffer B.
 *
 * @type {GPUBindGroup}
 */
let computeBindGroupAtoB: GPUBindGroup;
/**
 * Simulation bind group that writes from buffer B into buffer A.
 *
 * @type {GPUBindGroup}
 */
let computeBindGroupBtoA: GPUBindGroup;
/**
 * Whether the active compute shader needs per-pass generation parameters.
 *
 * @type {boolean}
 */
let probabilisticComputeActive = false;
/**
 * Uniform buffer holding batched simulation parameters for probabilistic rules.
 *
 * @type {(GPUBuffer | null)}
 */
let simulationParameterBuffer: GPUBuffer | null = null;
/**
 * Bind groups exposing one parameter slot per encoded simulation pass.
 *
 * @type {GPUBindGroup[]}
 */
let simulationParameterBindGroups: GPUBindGroup[] = [];
/**
 * Byte stride between parameter slots.
 *
 * @type {number}
 */
let simulationParameterSlotStride = 0;

/**
 * Whether the latest simulation output lives in buffer B.
 *
 * @type {boolean}
 */
let pingPong = false;

/**
 * Current camera zoom level.
 *
 * @type {number}
 */
let scale = 1;
/**
 * Current camera X offset in logical cells.
 *
 * @type {number}
 */
let offsetX = 0;
/**
 * Current camera Y offset in logical cells.
 *
 * @type {number}
 */
let offsetY = 0;

/**
 * Whether the continuous simulation loop is enabled.
 *
 * @type {boolean}
 */
let simulationRunning = false;
/**
 * Whether GPU resources are being rebuilt for a new layout or device.
 *
 * @type {boolean}
 */
let rebuilding = false;
/**
 * Target duration of one generation step in milliseconds.
 *
 * @type {number}
 */
let targetStepDuration = 100;
/**
 * Current simulation generation counter.
 *
 * @type {number}
 */
let genCounter = 0;
/**
 * Number of steps accumulated for the rolling FPS sample.
 *
 * @type {number}
 */
let stepCount = 0;
/**
 * Timestamp of the current rolling FPS sample window.
 *
 * @type {number}
 */
let lastFpsTime = 0;
/**
 * Latest computed frames-per-second estimate.
 *
 * @type {number}
 */
let currentFps = 0;

/**
 * Compute pipeline used for brush application passes.
 *
 * @type {GPUComputePipeline}
 */
let brushPipeline: GPUComputePipeline;
/**
 * Maximum number of wrapped brush rectangles encoded per brush stroke.
 *
 * @type {number}
 */
const BRUSH_DISPATCH_RECT_CAPACITY = 4;
/**
 * Size in bytes of one brush uniform payload.
 *
 * @type {number}
 */
const BRUSH_UNIFORM_SIZE = 192;
/**
 * Number of per-generation parameter slots available inside one encoded batch.
 *
 * @type {number}
 */
const SIMULATION_PARAMETER_SLOT_COUNT = 1024;
/**
 * Size of one simulation parameter struct in bytes.
 *
 * @type {number}
 */
const SIMULATION_PARAMETER_STRUCT_SIZE = 16;
/**
 * Per-rectangle brush uniform buffers.
 *
 * @type {GPUBuffer[]}
 */
let brushUniformBuffers: GPUBuffer[] = [];
/**
 * Brush bind groups targeting grid buffer A.
 *
 * @type {GPUBindGroup[]}
 */
let brushBindGroupsA: GPUBindGroup[] = [];
/**
 * Brush bind groups targeting grid buffer B.
 *
 * @type {GPUBindGroup[]}
 */
let brushBindGroupsB: GPUBindGroup[] = [];
/**
 * Monotonic seed source for randomized brush fills.
 *
 * @type {number}
 */
let brushSeedCounter = 0;
/**
 * Pending brush stroke to apply on the next safe update point.
 *
 * @type {(PendingBrush | null)}
 */
let pendingBrush: PendingBrush | null = null;
/**
 * Brush preview state rendered over the grid.
 *
 * @type {BrushPreview}
 */
let brushPreview: BrushPreview = {
  centerX: 0,
  centerY: 0,
  brushSize: 1,
  shape: 0,
  visible: false
};

/**
 * Visual export framing overlay state rendered over the grid.
 *
 * @type {ExportFrameOverlay}
 */
let exportFrameOverlay: ExportFrameOverlay = {
  originX: 0,
  originY: 0,
  visible: false
};

/**
 * GPU resources backing interactive metrics passes.
 *
 * @type {(InteractiveMetricsResources | null)}
 */
let metricsResources: InteractiveMetricsResources | null = null;
/**
 * Last generation for which metrics were posted.
 *
 * @type {number}
 */
let lastMetricsGen = -1;
/**
 * Whether a metrics readback is currently in flight.
 *
 * @type {boolean}
 */
let metricsInFlight = false;
/**
 * Whether another metrics pass should run after the current readback completes.
 *
 * @type {boolean}
 */
let pendingMetricsRetry = false;
/**
 * Last timestamp when periodic metrics were queued.
 *
 * @type {number}
 */
let lastMetricsTime = 0;
/**
 * Current live-metrics preferences from the UI.
 *
 * @type {LiveMetricsSettings}
 */
let liveMetrics: LiveMetricsSettings = DEFAULT_LIVE_METRICS_SETTINGS;
/**
 * Metric sections encoded by the latest GPU metrics pass.
 *
 * @type {InteractiveMetricSection[]}
 */
let lastEncodedMetricSections: InteractiveMetricSection[] = [];

/**
 * Whether recording is currently enabled.
 *
 * @type {boolean}
 */
let isRecording = false;
/**
 * Whether recording is waiting for the next forward step before capturing.
 *
 * @type {boolean}
 */
let recordingAwaitingForward = false;
/**
 * Recording manifest mirrored to the main thread.
 *
 * @type {RecordingManifest}
 */
let manifest: RecordingManifest = {
  chunks: [],
  generationStart: 0,
  generationEnd: 0,
  gridFormat: gridFormatMetadata(GRID_FORMAT_8)
};
/**
 * Next monotonically increasing recording chunk ID.
 *
 * @type {number}
 */
let nextChunkId = 0;
/**
 * Sealed recording chunks already persisted or queued for persistence.
 *
 * @type {ChunkMeta[]}
 */
let sealedChunks: ChunkMeta[] = [];
/**
 * Whether a recording manifest request is waiting for seals to finish.
 *
 * @type {boolean}
 */
let getRecordingPending = false;

/**
 * Currently active run-loop state, if any.
 *
 * @type {(RunState | null)}
 */
let activeRun: RunState | null = null;
/**
 * Token source used to invalidate stale run pumps.
 *
 * @type {number}
 */
let nextRunToken = 0;
/**
 * Whether a deferred render is waiting for GPU work completion.
 *
 * @type {boolean}
 */
let gpuCatchUpPending = false;

/**
 * GPU buffer holding the currently open recording chunk.
 *
 * @type {(GPUBuffer | null)}
 */
let chunkGpuBuffer: GPUBuffer | null = null;
/**
 * Number of frames currently written into the open recording chunk.
 *
 * @type {number}
 */
let chunkFrameIndex = 0;
/**
 * Generation numbers stored in the open recording chunk.
 *
 * @type {number[]}
 */
let chunkGenerations: number[] = [];
/**
 * Latest generation captured into recording buffers.
 *
 * @type {(number | null)}
 */
let latestRecordedGeneration: number | null = null;
/**
 * Maximum frame capacity of the open recording chunk.
 *
 * @type {number}
 */
let chunkFrameCapacity = 64;
/**
 * Byte size of one packed simulation frame.
 *
 * @type {number}
 */
let frameByteSize = 0;

/**
 * Readback staging buffers used for chunk sealing.
 *
 * @type {GPUBuffer[]}
 */
let stagingRing: GPUBuffer[] = [];
/**
 * Availability flags for each staging buffer slot.
 *
 * @type {boolean[]}
 */
let stagingAvailable: boolean[] = [];

/**
 * OPFS directory handle used for recording chunk storage.
 *
 * @type {(FileSystemDirectoryHandle | null)}
 */
let opfsDirHandle: FileSystemDirectoryHandle | null = null;
/**
 * Shared in-flight OPFS reset promise.
 *
 * @type {(Promise<void> | null)}
 */
let opfsResetPromise: Promise<void> | null = null;
/**
 * Number of chunk seals currently in flight.
 *
 * @type {number}
 */
let inflightSeals = 0;
/**
 * Number of recorded frames currently owned by in-flight seals.
 *
 * @type {number}
 */
let inflightSealFrames = 0;
/**
 * Number of pending OPFS write operations.
 *
 * @type {number}
 */
let pendingOpfsWrites = 0;
/**
 * Whether recording backpressure is currently active.
 *
 * @type {boolean}
 */
let backpressureActive = false;
/**
 * Epoch used to invalidate stale seal completions after resets.
 *
 * @type {number}
 */
let sealEpoch = 0;

/**
 * Bytes allocated since the last rebuild yield point.
 *
 * @type {number}
 */
let rebuildAllocatedBytesSinceYield = 0;
/**
 * Remaining tracked major allocations before rebuild completion.
 *
 * @type {number}
 */
let rebuildMajorAllocationsRemaining = 0;
/**
 * Buffers allocated since the last rebuild yield point.
 *
 * @type {GPUBuffer[]}
 */
let rebuildPendingAllocationBuffers: GPUBuffer[] = [];

/**
 * Normalizes unknown worker errors into a user-facing reason string.
 *
 * @param {unknown} error thrown worker error.
 * @returns {string} normalized error reason.
 */
function workerErrorReason(error: unknown): string {
  switch (true) {
    case error instanceof Error: return error.message;
    case typeof error === 'string': return error;
    case error && typeof error === 'object' && 'message' in error && typeof error.message === 'string': return error.message;
    default: return String(error ?? 'Unknown worker error');
  }
}

/**
 * Reports a worker error through logs and the UI-facing worker protocol.
 *
 * @param {unknown} error thrown worker error.
 */
function reportWorkerError(error: unknown): void {
  console.error('[GOLT worker] Worker GPU error:', error);
  stopRun('error', {
    render: false,
    postStepping: false,
    restore: false,
    restartRestoredRun: false
  });
  simulationRunning = false;
  self.postMessage({type: 'gpuError', reason: workerErrorReason(error)});
}

self.addEventListener('error', event => {
  event.preventDefault();
  reportWorkerError(event.error ?? event.message);
});

self.addEventListener('unhandledrejection', event => {
  event.preventDefault();
  reportWorkerError(event.reason);
});

/**
 * Waits until all queued GPU work is complete.
 *
 * @async
 */
async function waitForGpuQueueIdle(): Promise<void> {
  await device.queue.onSubmittedWorkDone();
}

/**
 * Resets rebuild-time tracking for large buffer allocations.
 *
 * @param {boolean} includeRecordingBuffers whether recording buffers are included in the rebuild.
 */
function resetRebuildAllocationTracking(includeRecordingBuffers: boolean): void {
  rebuildAllocatedBytesSinceYield = 0;
  rebuildMajorAllocationsRemaining = 2 + (includeRecordingBuffers ? 1 + STAGING_RING_SIZE : 0);
  rebuildPendingAllocationBuffers = [];
}

/**
 * Clears tracked rebuild buffers and yields until the GPU catches up.
 *
 * @async
 */
async function waitForTrackedBufferAllocations(): Promise<void> {
  if (rebuildPendingAllocationBuffers.length > 0) {
    const encoder = device.createCommandEncoder({label: GPU_LABELS.trackedAllocationClearEncoder});
    for (const buffer of rebuildPendingAllocationBuffers) {
      encoder.clearBuffer(buffer);
    }
    device.queue.submit([encoder.finish()]);
    await waitForGpuQueueIdle();
    rebuildPendingAllocationBuffers = [];
  }
}

/**
 * Tracks one large rebuild allocation and yields when the running total gets too high.
 *
 * @async
 * @param {number} byteSize allocated byte size.
 * @param {GPUBuffer} buffer allocated GPU buffer.
 */
async function trackMajorBufferAllocation(byteSize: number, buffer: GPUBuffer): Promise<void> {
  if (rebuilding && rebuildMajorAllocationsRemaining > 0) {
    rebuildAllocatedBytesSinceYield += byteSize;
    rebuildMajorAllocationsRemaining--;
    rebuildPendingAllocationBuffers.push(buffer);
    if (rebuildAllocatedBytesSinceYield >= majorBufferAllocationYieldBytes(currentMaxSimulationBytes()) && rebuildMajorAllocationsRemaining > 0) {
      await waitForTrackedBufferAllocations();
      rebuildAllocatedBytesSinceYield = 0;
    }
  }
}

/**
 * Destroys the current recording and staging buffers.
 */
function destroyRecordingBuffers(): void {
  chunkGpuBuffer?.destroy();
  chunkGpuBuffer = null;
  for (const buf of stagingRing) {
    buf?.destroy();
  }
  stagingRing = [];
  stagingAvailable = [];
  chunkFrameCapacity = 0;
  chunkFrameIndex = 0;
  chunkGenerations = [];
  latestRecordedGeneration = null;
  inflightSealFrames = 0;
}

/**
 * Destroys probabilistic simulation parameter resources.
 */
function destroySimulationParameterResources(): void {
  simulationParameterBuffer?.destroy();
  simulationParameterBuffer = null;
  simulationParameterBindGroups = [];
  simulationParameterSlotStride = 0;
}

/**
 * Destroys buffers that are rebuilt when the simulation layout changes.
 */
function destroyRebuildableBuffers(): void {
  gridBufferA?.destroy();
  gridBufferB?.destroy();
  destroySimulationParameterResources();
  destroyInteractiveMetricsResources(metricsResources);
  metricsResources = null;
  brushUniformBuffers.forEach(buffer => buffer.destroy());
  brushUniformBuffers = [];
  brushBindGroupsA = [];
  brushBindGroupsB = [];
  destroyRecordingBuffers();
}

/**
 * Updates the count of in-flight chunk seals and posts activity changes.
 *
 * @param {number} delta delta to apply to the in-flight seal count.
 */
function updateInflightSeals(delta: number): void {
  const wasSaving = inflightSeals > 0;
  inflightSeals += delta;
  const isSaving = inflightSeals > 0;
  if (wasSaving !== isSaving) {
    self.postMessage({type: 'chunksSaving', active: isSaving});
  }
}

/**
 * Recomputes recording backpressure and posts state changes when needed.
 */
function checkBackpressure(): void {
  const pressure = evaluateRecordingBackpressure(chunkFrameCapacity, stagingAvailable, pendingOpfsWrites, maxPendingOpfsWritesForCurrentChunk(chunkFrameCapacity, frameByteSize), backpressureActive, chunkFrameIndex);
  if (pressure !== backpressureActive) {
    backpressureActive = pressure;
    self.postMessage({type: 'backpressure', active: pressure});
  }
}

/**
 * Posts the current storage quota estimate through the worker protocol.
 *
 * @async
 */
async function postStorageQuota(): Promise<void> {
  self.postMessage({
    type: 'storageQuota',
    ...buildStorageQuotaSnapshot(await navigator.storage.estimate(), sealedChunks, chunkFrameCapacity, frameByteSize)
  });
}

/**
 * Returns the maximum safe simulation buffer size for the current device.
 *
 * @returns {number} maximum simulation buffer size in bytes.
 */
function currentMaxSimulationBytes(): number {
  return maxSimulationBufferBytes(device.limits.maxBufferSize, device.limits.maxStorageBufferBindingSize);
}

/**
 * Returns the maximum safe recording frame size for the current device.
 *
 * @returns {number} maximum recording frame size in bytes.
 */
function currentMaxRecordingBytes(): number {
  return maxRecordingBufferBytes(currentMaxSimulationBytes());
}

/**
 * Returns whether recording supports the current frame size.
 *
 * @returns {boolean} true when recording is available for the current frame.
 */
function recordingAvailableNow(): boolean {
  return recordingAvailableForCurrentFrame(frameByteSize, currentMaxRecordingBytes());
}

/**
 * Returns whether the current recording chunk can be sealed immediately.
 *
 * @returns {boolean} true when the current chunk can be sealed.
 */
function canSealCurrentChunkNow(): boolean {
  return canSealCurrentChunk(pendingOpfsWrites, maxPendingOpfsWritesForCurrentChunk(chunkFrameCapacity, frameByteSize), stagingAvailable, stagingRing);
}

/**
 * Returns whether the current frame can be recorded immediately.
 *
 * @returns {boolean} true when recording can proceed.
 */
function canRecordNow(): boolean {
  return canRecord(recordingAvailableNow(), chunkFrameCapacity, chunkGpuBuffer, stagingRing, chunkFrameIndex, canSealCurrentChunkNow());
}

/**
 * Decompresses one raw-deflate payload into an ArrayBuffer.
 *
 * @async
 * @param {ArrayBuffer} compressed compressed payload bytes.
 * @returns {Promise<ArrayBuffer>} decompressed payload bytes.
 */
async function decompressPayload(compressed: ArrayBuffer): Promise<ArrayBuffer> {
  const ds = new DecompressionStream(RAW_DEFLATE_CODEC);
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(compressed));
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  for (;;) {
    const {done, value} = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
  }
  let totalLen = 0;
  for (const c of chunks) {
    totalLen += c.byteLength;
  }
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) {
    result.set(c, off);
    off += c.byteLength;
  }
  return result.buffer;
}

/**
 * Current logical grid dimensions.
 *
 * @returns {Grid} logical grid dimensions.
 */
function currentGridSize(): Grid {
  return {cols, rows};
}

/**
 * Builds the simulation compute dispatch plan for the current packed grid.
 *
 * @returns {DispatchPlan2D} simulation dispatch plan.
 */
function createSimulationDispatchPlan(): DispatchPlan2D {
  return plan2DDispatch(Math.ceil(packedCols / 16), Math.ceil(rows / 16), device.limits.maxComputeWorkgroupsPerDimension);
}

/**
 * Builds the metrics compute dispatch plan for the current logical grid.
 *
 * @returns {DispatchPlan2D} metrics dispatch plan.
 */
function createMetricsDispatchPlan(): DispatchPlan2D {
  return plan2DDispatch(Math.ceil(cols / 16), Math.ceil(rows / 16), device.limits.maxComputeWorkgroupsPerDimension);
}

/**
 * Recreates the uniform buffer used by the render pipeline.
 */
function createUniformBuffer(): void {
  uniformBuffer?.destroy();
  uniformBuffer = device.createBuffer({
    label: GPU_LABELS.uniformBuffer,
    size: UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
}

/**
 * Writes the current render uniforms into the GPU uniform buffer.
 */
function writeUniforms(): void {
  const data = createRenderUniformData({
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    scale,
    offsetX,
    offsetY,
    grid: currentGridSize(),
    topology: ruleset.topology,
    tribeCount: tribes.length,
    brushPreview,
    exportFrameOverlay
  });
  device.queue.writeBuffer(uniformBuffer, 0, data);
}

/**
 * Computes the byte size of one packed simulation grid buffer.
 *
 * @returns {number} packed grid buffer size in bytes.
 */
function gridBufferSize(): number {
  return gridByteSize({cols, rows}, gridFormat);
}

/**
 * Returns the metadata representation of the active grid format.
 *
 * @returns {GridFormatMetadata} active grid format metadata.
 */
function currentGridFormatMetadata(): GridFormatMetadata {
  return gridFormatMetadata(gridFormat);
}

/**
 * Recreates the main ping-pong grid buffers for the current simulation layout.
 *
 * @async
 */
async function createGridBuffers(): Promise<void> {
  const byteSize = gridBufferSize();
  gridBufferA = device.createBuffer({
    label: GPU_LABELS.gridBufferA,
    size: byteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  });
  await trackMajorBufferAllocation(byteSize, gridBufferA);
  gridBufferB = device.createBuffer({
    label: GPU_LABELS.gridBufferB,
    size: byteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  });
  await trackMajorBufferAllocation(byteSize, gridBufferB);
  const enc = device.createCommandEncoder({label: GPU_LABELS.gridClearEncoder});
  enc.clearBuffer(gridBufferA);
  enc.clearBuffer(gridBufferB);
  device.queue.submit([enc.finish()]);
  pingPong = false;
}

/**
 * Recreates the tribe-color lookup buffer for the active tribe palette.
 */
function createTribeColorBuffer(): void {
  const data = createTribeColorData(tribes);
  if (tribeColorBuffer) {
    tribeColorBuffer.destroy();
  }
  tribeColorBuffer = device.createBuffer({
    label: GPU_LABELS.tribeColorBuffer,
    size: data.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(tribeColorBuffer, 0, data);
}

/**
 * Recreates the render pipeline for the current canvas format.
 */
function createRenderPipeline(): void {
  const renderTopology = ruleset.topology;
  const module = device.createShaderModule({label: `${GPU_LABELS.renderShaderModule} (${renderTopology})`, code: generateRenderWgsl(renderWgsl, gridFormat, renderTopology)});
  renderPipeline = device.createRenderPipeline({
    label: `${GPU_LABELS.renderPipeline} (${renderTopology})`,
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs_main'
    },
    fragment: {
      module,
      entryPoint: 'fs_main',
      targets: [{format: canvasFormat}]
    },
    primitive: {
      topology: 'triangle-list'
    }
  });
}

/**
 * Recreates the render bind groups for the ping-pong grid buffers.
 */
function createRenderBindGroups(): void {
  renderBindGroupA = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [{binding: 0, resource: {buffer: uniformBuffer} }, {binding: 1, resource: {buffer: gridBufferA} }, {binding: 2, resource: {buffer: tribeColorBuffer} }]
  });
  renderBindGroupB = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [{binding: 0, resource: {buffer: uniformBuffer} }, {binding: 1, resource: {buffer: gridBufferB} }, {binding: 2, resource: {buffer: tribeColorBuffer} }]
  });
}

/**
 * Checks whether the current ruleset needs probabilistic generation parameters.
 *
 * @returns {boolean} true when an active rule has a probability from 1 to 99.
 */
function hasActiveProbabilisticRules(): boolean {
  return ruleset.rules.some(rule => {
    const probability = normalizeRuleProbability(rule.probability);
    return !rule.muted && probability > 0 && probability < 100;
  });
}

/**
 * Creates the batched simulation parameter buffer and slot bind groups.
 */
function createSimulationParameterResources(): void {
  simulationParameterSlotStride = Math.max(SIMULATION_PARAMETER_STRUCT_SIZE, device.limits.minUniformBufferOffsetAlignment);
  simulationParameterBuffer = device.createBuffer({
    label: GPU_LABELS.simulationParameterBuffer,
    size: simulationParameterSlotStride * SIMULATION_PARAMETER_SLOT_COUNT,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  simulationParameterBindGroups = [];
  const layout = computePipeline.getBindGroupLayout(1);
  for (let i = 0; i < SIMULATION_PARAMETER_SLOT_COUNT; i++) {
    simulationParameterBindGroups.push(device.createBindGroup({
      label: `${GPU_LABELS.simulationParameterBindGroup} ${i}`,
      layout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: simulationParameterBuffer,
            offset: i * simulationParameterSlotStride,
            size: SIMULATION_PARAMETER_STRUCT_SIZE
          }
        }
      ]
    }));
  }
}

/**
 * Recreates the simulation compute pipeline and its bind groups.
 */
function createComputePipeline(): void {
  destroySimulationParameterResources();
  simulationDispatchPlan = createSimulationDispatchPlan();
  probabilisticComputeActive = hasActiveProbabilisticRules();
  const wgsl = generateComputeWgsl(ruleset, tribes, packedCols, currentGridSize(), simulationDispatchPlan, gridFormat, tribeIndex);
  const module = device.createShaderModule({label: GPU_LABELS.simulationShaderModule, code: wgsl});
  computePipeline = device.createComputePipeline({
    label: GPU_LABELS.simulationPipeline,
    layout: 'auto',
    compute: {module, entryPoint: 'main'}
  });
  computeBindGroupAtoB = device.createBindGroup({
    label: GPU_LABELS.simulationBindGroupAtoB,
    layout: computePipeline.getBindGroupLayout(0),
    entries: [{binding: 0, resource: {buffer: gridBufferA} }, {binding: 1, resource: {buffer: gridBufferB} }]
  });
  computeBindGroupBtoA = device.createBindGroup({
    label: GPU_LABELS.simulationBindGroupBtoA,
    layout: computePipeline.getBindGroupLayout(0),
    entries: [{binding: 0, resource: {buffer: gridBufferB} }, {binding: 1, resource: {buffer: gridBufferA} }]
  });
  if (probabilisticComputeActive) {
    createSimulationParameterResources();
    console.info('[GOLT worker] Probabilistic rule compute path enabled', {
      randomSeed: ruleset.randomSeed,
      parameterSlots: SIMULATION_PARAMETER_SLOT_COUNT
    });
  }
}

/**
 * Recreates the interactive metrics pipelines and backing resources.
 */
function createMetricsPipelines(): void {
  metricsDispatchPlan = createMetricsDispatchPlan();
  metricsResources = createInteractiveMetricsResources({
    device,
    cols,
    rows,
    gridFormat,
    topology: ruleset.topology,
    dispatchPlan: metricsDispatchPlan
  });
}

/**
 * Creates the brush compute pipeline and per-rectangle uniform resources.
 */
function createBrushPipeline(): void {
  const module = device.createShaderModule({label: GPU_LABELS.brushShaderModule, code: generateBrushWgsl(gridFormat)});
  brushPipeline = device.createComputePipeline({
    label: GPU_LABELS.brushPipeline,
    layout: 'auto',
    compute: {module, entryPoint: 'main'}
  });
  brushUniformBuffers.forEach(buffer => buffer.destroy());
  brushUniformBuffers = [];
  brushBindGroupsA = [];
  brushBindGroupsB = [];
  for (let i = 0; i < BRUSH_DISPATCH_RECT_CAPACITY; i++) {
    const brushUniformBuffer = device.createBuffer({
      label: `${GPU_LABELS.brushUniformBuffer} ${i}`,
      size: BRUSH_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    brushUniformBuffers.push(brushUniformBuffer);
    brushBindGroupsA.push(device.createBindGroup({
      layout: brushPipeline.getBindGroupLayout(0),
      entries: [{binding: 0, resource: {buffer: gridBufferA} }, {binding: 1, resource: {buffer: brushUniformBuffer} }]
    }));
    brushBindGroupsB.push(device.createBindGroup({
      layout: brushPipeline.getBindGroupLayout(0),
      entries: [{binding: 0, resource: {buffer: gridBufferB} }, {binding: 1, resource: {buffer: brushUniformBuffer} }]
    }));
  }
}

/**
 * Encodes the wrapped brush stroke as one or more non-overlapping rectangle dispatches.
 *
 * @param {GPUCommandEncoder} encoder destination command encoder.
 * @param {PendingBrush} brush pending brush payload.
 */
function dispatchBrushOnEncoder(encoder: GPUCommandEncoder, brush: PendingBrush): void {
  const deadId = tribeIndex.get(DEAD_TRIBE_ID) ?? 0;
  const seed = brushSeedCounter++;
  const rects = createBrushDispatchRects(brush.centerX, brush.centerY, brush.brushSize, currentGridSize(), ruleset.topology);
  const bindGroups = pingPong ? brushBindGroupsB : brushBindGroupsA;
  for (const [index, rect] of rects.entries()) {
    const data = new ArrayBuffer(BRUSH_UNIFORM_SIZE);
    const u32View = new Uint32Array(data);
    u32View[0] = packedCols;
    u32View[1] = brush.brushSize;
    u32View[2] = brush.shape;
    u32View[3] = brush.fill;
    u32View[4] = deadId;
    u32View[5] = seed;
    u32View[6] = brush.tribeIds.length;
    u32View[7] = rect.destinationStartX;
    u32View[8] = rect.destinationStartY;
    u32View[9] = rect.localStartX;
    u32View[10] = rect.localStartY;
    u32View[11] = rect.spanCols;
    u32View[12] = rect.spanRows;
    u32View[13] = brush.density;
    u32View[14] = 0;
    u32View[15] = 0;
    for (let i = 0; i < brush.tribeIds.length && i < 32; i++) {
      u32View[16 + i] = brush.tribeIds[i]!;
    }
    const brushUniformBuffer = brushUniformBuffers[index];
    const bindGroup = bindGroups[index];
    if (brushUniformBuffer && bindGroup) {
      device.queue.writeBuffer(brushUniformBuffer, 0, data);
      const startWord = Math.floor(rect.destinationStartX / gridFormat.cellsPerWord);
      const endWordExclusive = Math.ceil((rect.destinationStartX + rect.spanCols) / gridFormat.cellsPerWord);
      const spanWords = endWordExclusive - startWord;
      const wgBrushX = Math.ceil(spanWords / 8);
      const wgBrushY = Math.ceil(rect.spanRows / 8);
      const pass = encoder.beginComputePass({label: GPU_LABELS.brushPass});
      pass.setPipeline(brushPipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(wgBrushX, wgBrushY);
      pass.end();
    } else {
      console.error('[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.', {
        index,
        rectCount: rects.length,
        bindGroupCount: bindGroups.length,
        uniformBufferCount: brushUniformBuffers.length
      });
      throw new Error('Brush dispatch resources are out of sync with the wrapped brush rectangles.');
    }
  }
}

/**
 * Reads back the active packed grid from GPU memory.
 *
 * @returns {Promise<Uint32Array>} copy of the active packed grid.
 */
function readbackGrid(): Promise<Uint32Array> {
  const activeGridBuffer = pingPong ? gridBufferB : gridBufferA;
  const byteSize = gridBufferSize();
  let readBuffer: GPUBuffer;
  try {
    readBuffer = device.createBuffer({
      label: GPU_LABELS.gridReadbackBuffer,
      size: byteSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
  } catch (e) {
    console.warn('GPU readback buffer allocation failed:', e);
    return Promise.reject(new Error(`Failed to allocate ${byteSize} byte readback buffer`));
  }
  const encoder = device.createCommandEncoder({label: GPU_LABELS.gridReadbackEncoder});
  encoder.copyBufferToBuffer(activeGridBuffer, 0, readBuffer, 0, byteSize);
  device.queue.submit([encoder.finish()]);
  return readBuffer.mapAsync(GPUMapMode.READ).then(() => {
    const copy = new Uint32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();
    readBuffer.destroy();
    return copy;
  });
}

/**
 * Recomputes the frame capacity of the active recording chunk.
 */
function computeChunkCapacity(): void {
  frameByteSize = gridBufferSize();
  chunkFrameCapacity = computeChunkFrameCapacity(frameByteSize, currentMaxRecordingBytes());
}

/**
 * Returns fixed simulation resource overhead not included in the ping-pong grid buffers.
 *
 * @returns {number} fixed resource overhead in bytes.
 */
function fixedSimulationOverheadBytes(): number {
  const parameterBytes = probabilisticComputeActive ? simulationParameterSlotStride * SIMULATION_PARAMETER_SLOT_COUNT : 0;
  return UNIFORM_SIZE + TRIBE_COLOR_BUFFER_SIZE + BRUSH_UNIFORM_SIZE + HISTOGRAM_BUFFER_SIZE * 2 + BOUNDARY_BUFFER_SIZE * 2 + parameterBytes;
}

/**
 * Posts the current recording-limit state through the worker protocol.
 */
function postRecordingLimits(): void {
  self.postMessage({
    type: 'limits',
    ...buildRecordingLimitsPayload(currentMaxSimulationBytes(), frameByteSize, chunkFrameCapacity, fixedSimulationOverheadBytes(), currentGridFormatMetadata())
  });
}

/**
 * Returns whether the active generation can be copied into the open recording chunk.
 *
 * @returns {boolean} true when a frame copy can be encoded.
 */
function canEncodeRecordingFrameCopy(): boolean {
  return chunkFrameCapacity >= 1 && chunkGpuBuffer !== null && chunkFrameIndex < chunkFrameCapacity;
}

/**
 * Encodes a copy of the active generation into the open recording chunk.
 *
 * @param {GPUCommandEncoder} encoder destination command encoder.
 * @param {number} gen generation being recorded.
 */
function encodeRecordingFrameCopy(encoder: GPUCommandEncoder, gen: number): void {
  const activeGridBuffer = pingPong ? gridBufferB : gridBufferA;
  const offset = chunkFrameIndex * frameByteSize;
  encoder.copyBufferToBuffer(activeGridBuffer, 0, chunkGpuBuffer!, offset, frameByteSize);
  chunkGenerations.push(gen);
  latestRecordedGeneration = gen;
  chunkFrameIndex++;
}

/**
 * Copies the active generation into the current recording chunk.
 *
 * @param {number} gen generation being recorded.
 */
function recordGeneration(gen: number): void {
  if (canEncodeRecordingFrameCopy()) {
    const enc = device.createCommandEncoder({label: GPU_LABELS.recordingFrameCopyEncoder});
    encodeRecordingFrameCopy(enc, gen);
    device.queue.submit([enc.finish()]);
    retrySealCurrentChunkIfPossible();
  }
}

/**
 * Updates the count of frames currently held by in-flight chunk seals.
 *
 * @param {number} delta delta to apply to the in-flight sealed-frame count.
 */
function updateInflightSealFrames(delta: number): void {
  inflightSealFrames = Math.max(0, inflightSealFrames + delta);
}

/**
 * Seals the current chunk as soon as both chunk fullness and backpressure allow it.
 */
function retrySealCurrentChunkIfPossible(): void {
  const currentChunkFull = chunkFrameCapacity > 0 && chunkFrameIndex >= chunkFrameCapacity;
  if (currentChunkFull && canSealCurrentChunkNow()) {
    sealCurrentChunk();
  }
}

/**
 * Moves the current recording chunk into a staging buffer and schedules persistence.
 */
function sealCurrentChunk(): void {
  const recordingBuffer = chunkGpuBuffer;
  if (recordingBuffer !== null && chunkFrameIndex > 0 && stagingRing.length > 0 && pendingOpfsWrites < maxPendingOpfsWritesForCurrentChunk(chunkFrameCapacity, frameByteSize)) {
    const idx = stagingAvailable.indexOf(true);
    if (idx >= 0) {
      stagingAvailable[idx] = false;
      const stagingBuf = stagingRing[idx]!;
      if (stagingBuf.mapState === 'unmapped') {
        const byteLen = chunkFrameIndex * frameByteSize;
        const chunkId = nextChunkId++;
        const generations = [...chunkGenerations];
        const genStart = generations[0]!;
        const genEnd = generations[generations.length - 1]!;
        const filename = `chunk-${String(chunkId).padStart(6, '0')}.bin`;
        const blockCount = chunkFrameIndex;
        const enc = device.createCommandEncoder({label: GPU_LABELS.recordingSealCopyEncoder});
        enc.copyBufferToBuffer(recordingBuffer, 0, stagingBuf, 0, byteLen);
        device.queue.submit([enc.finish()]);
        const meta: ChunkMeta = {
          chunkId,
          generationStart: genStart,
          generationEnd: genEnd,
          blockCount,
          codec: RAW_PACKED_CODEC,
          uncompressedBytes: byteLen,
          storedBytes: byteLen,
          gridFormat: currentGridFormatMetadata(),
          generations,
          filename
        };
        updateInflightSeals(+1);
        updateInflightSealFrames(blockCount);
        pendingOpfsWrites++;
        checkBackpressure();
        const epoch = sealEpoch;
        stagingBuf.mapAsync(GPUMapMode.READ).then(async() => {
          const mapped = stagingBuf.getMappedRange();
          const rawPayload = new ArrayBuffer(byteLen);
          new Uint8Array(rawPayload).set(new Uint8Array(mapped, 0, byteLen));
          stagingBuf.unmap();
          if (epoch === sealEpoch) {
            stagingAvailable[idx] = true;
            sealedChunks.push(meta);
            updateInflightSealFrames(-blockCount);
            updateManifestRange(manifest, sealedChunks, chunkGenerations);
            checkBackpressure();
            retrySealCurrentChunkIfPossible();
            writeChunkToOpfs(meta, rawPayload).then(() => {
              if (epoch === sealEpoch) {
                pendingOpfsWrites--;
                checkBackpressure();
                updateInflightSeals(-1);
                postStorageQuota();
                sendRecordingManifest();
                queueMetricsRefresh(true);
                retrySealCurrentChunkIfPossible();
                self.postMessage({
                  type: 'chunkSealed',
                  filename: meta.filename,
                  rawBytes: byteLen,
                  blockCount: meta.blockCount,
                  cols,
                  rows,
                  rawGridFormat: meta.gridFormat,
                  storageGridFormat: gridFormatMetadata(chooseTightStorageGridFormat(ruleset.tribes.length))
                });
                if (getRecordingPending && inflightSeals === 0) {
                  getRecordingPending = false;
                  sendRecordingManifest();
                }
              }
            }).catch(error => {
              if (epoch === sealEpoch) {
                pendingOpfsWrites--;
                checkBackpressure();
                updateInflightSeals(-1);
                handleRecordingChunkWriteFailure(meta, error).catch(reportWorkerError);
              }
            });
          }
        }).catch(() => {
          if (epoch === sealEpoch) {
            stagingAvailable[idx] = true;
            pendingOpfsWrites--;
            updateInflightSealFrames(-blockCount);
            checkBackpressure();
            updateInflightSeals(-1);
            retrySealCurrentChunkIfPossible();
          }
        });
        chunkFrameIndex = 0;
        chunkGenerations = [];
      } else {
        stagingAvailable[idx] = true;
      }
    }
  }
}

/**
 * Resets recording state, buffers, and OPFS storage for a fresh recording session.
 *
 * @async
 * @param {number} startGen generation to use as the new manifest start.
 */
async function resetRecording(startGen: number): Promise<void> {
  sealEpoch++;
  nextChunkId = 0;
  chunkFrameIndex = 0;
  chunkGenerations = [];
  sealedChunks = [];
  latestRecordedGeneration = null;
  inflightSealFrames = 0;
  pendingOpfsWrites = 0;
  if (inflightSeals > 0) {
    inflightSeals = 0;
    self.postMessage({type: 'chunksSaving', active: false});
  }
  if (backpressureActive) {
    backpressureActive = false;
    self.postMessage({type: 'backpressure', active: false});
  }
  getRecordingPending = false;
  recordingAwaitingForward = isRecording;
  manifest = {
    chunks: [],
    generationStart: startGen,
    generationEnd: startGen,
    gridFormat: currentGridFormatMetadata()
  };
  await resetOpfsDir();
  postStorageQuota();
}

/**
 * Returns the OPFS directory handle used to store recording chunks.
 *
 * @async
 * @returns {Promise<FileSystemDirectoryHandle>} recording OPFS directory handle.
 */
async function ensureOpfsDir(): Promise<FileSystemDirectoryHandle> {
  if (opfsResetPromise) {
    await opfsResetPromise;
  }
  if (!opfsDirHandle) {
    const root = await navigator.storage.getDirectory();
    opfsDirHandle = await root.getDirectoryHandle(OPFS_DIR, {create: true});
  }
  return opfsDirHandle;
}

/**
 * Writes one sealed chunk payload to OPFS.
 *
 * @async
 * @param {ChunkMeta} meta sealed chunk metadata.
 * @param {ArrayBuffer} payload raw chunk payload.
 */
async function writeChunkToOpfs(meta: ChunkMeta, payload: ArrayBuffer): Promise<void> {
  const dir = await ensureOpfsDir();
  const file = await dir.getFileHandle(meta.filename, {create: true});
  let writable: FileSystemWritableFileStream | null = await file.createWritable();
  let closed = false;
  try {
    await writable.write(payload);
    await writable.close();
    closed = true;
    writable = null;
  } catch (error) {
    if (writable && !closed) {
      try {
        await writable.abort();
      } catch (abortError) {
        console.warn('[GOLT worker] Failed to abort recording chunk write after error:', abortError);
      }
    }
    try {
      await dir.removeEntry(meta.filename);
    } catch (removeError) {
      if (!(removeError instanceof DOMException && removeError.name === 'NotFoundError')) {
        console.warn('[GOLT worker] Failed to remove failed recording chunk:', meta.filename, removeError);
      }
    }
    throw error;
  }
}

/**
 * Checks whether an OPFS write error indicates storage quota pressure.
 *
 * @param {unknown} error write error.
 * @returns {boolean} true when the error indicates quota exhaustion.
 */
function isStorageQuotaError(error: unknown): boolean {
  const reason = workerErrorReason(error).toLowerCase();
  return error instanceof DOMException && error.name === 'QuotaExceededError' || reason.includes('storage quota') || reason.includes('quota exceeded') || reason.includes('exceed its storage quota');
}

/**
 * Removes a failed recording chunk from in-memory metadata.
 *
 * @param {ChunkMeta} meta failed chunk metadata.
 */
function removeFailedSealedChunk(meta: ChunkMeta): void {
  const index = sealedChunks.findIndex(chunk => chunk.filename === meta.filename);
  if (index >= 0) {
    sealedChunks.splice(index, 1);
  }
}

/**
 * Restores the active grid to the persisted recording frame before the latest one when available.
 *
 * @async
 * @returns {Promise<(number | null)>} restored generation, or null when no persisted frame was available.
 */
async function restorePreviousPersistedRecordingFrame(): Promise<number | null> {
  let restoredGeneration: number | null = null;
  const sealedCount = countFrames(sealedChunks);
  const target = resolveStepBackTarget(sealedChunks, sealedCount, 0, 1);
  if (target?.source === 'sealed') {
    const {frameInChunk} = target;
    const chunk = sealedChunks[target.sealedIndex]!;
    try {
      const prefixBytes = (frameInChunk + 1) * frameByteSize;
      const chunkData = await readChunkFromOpfs(chunk.filename, chunk.codec);
      const grid = currentGridSize();
      const storedChunkFormat = gridFormatFromMetadata(chunk.gridFormat);
      const restoredPrefix = buildStepBackPrefix(chunkData, frameInChunk, frameByteSize, grid, storedChunkFormat, gridFormat);
      const activeFrame = restoredPrefix.activeFrame ?? restoredPrefix.chunkPrefix.subarray(frameInChunk * frameByteSize, prefixBytes);
      device.queue.writeBuffer(pingPong ? gridBufferB : gridBufferA, 0, activeFrame);
      chunkFrameIndex = 0;
      chunkGenerations = [];
      genCounter = chunk.generations[frameInChunk] ?? chunk.generationEnd;
      latestRecordedGeneration = genCounter;
      restoredGeneration = genCounter;
      if (frameInChunk < chunk.blockCount - 1) {
        const frameCount = frameInChunk + 1;
        const rawBytesPerFrame = chunk.blockCount > 0 ? Math.floor(chunk.uncompressedBytes / chunk.blockCount) : frameByteSize;
        chunk.blockCount = frameCount;
        chunk.generationEnd = genCounter;
        chunk.generations = chunk.generations.slice(0, frameCount);
        chunk.uncompressedBytes = rawBytesPerFrame * frameCount;
        if (chunk.codec === RAW_PACKED_CODEC) {
          chunk.storedBytes = frameByteSize * frameCount;
        }
      }
      const removedChunks = sealedChunks.splice(target.sealedIndex + 1);
      await deleteChunksFromOpfs(removedChunks.map(removedChunk => removedChunk.filename));
      resetFps();
      postGeneration();
      renderFrame();
    } catch (error) {
      console.warn('[GOLT worker] Failed to restore the previous persisted recording frame after storage quota pressure:', error);
    }
  } else {
    const removedChunks = sealedChunks.splice(0);
    await deleteChunksFromOpfs(removedChunks.map(removedChunk => removedChunk.filename));
    chunkFrameIndex = 0;
    chunkGenerations = [];
  }
  return restoredGeneration;
}

/**
 * Stops recording after OPFS rejects a chunk write because storage quota was reached.
 *
 * @async
 * @param {ChunkMeta} meta failed chunk metadata.
 * @param {unknown} error write error.
 */
async function stopRecordingAfterStorageQuotaFailure(meta: ChunkMeta, error: unknown): Promise<void> {
  console.warn('[GOLT worker] Recording stopped because OPFS storage quota was reached:', error);
  removeFailedSealedChunk(meta);
  stopRun('cancelled', {
    render: false,
    postStepping: false,
    restore: false,
    restartRestoredRun: false
  });
  simulationRunning = false;
  isRecording = false;
  recordingAwaitingForward = false;
  const restoredGeneration = await restorePreviousPersistedRecordingFrame();
  updateManifestRange(manifest, sealedChunks, chunkGenerations);
  checkBackpressure();
  postStorageQuota();
  sendRecordingManifest();
  queueMetricsRefresh(true);
  self.postMessage({
    type: 'recordingStopped',
    reason: 'storageQuota',
    restoredGeneration
  });
}

/**
 * Handles a failed OPFS write for a sealed recording chunk.
 *
 * @async
 * @param {ChunkMeta} meta failed chunk metadata.
 * @param {unknown} error write error.
 */
async function handleRecordingChunkWriteFailure(meta: ChunkMeta, error: unknown): Promise<void> {
  removeFailedSealedChunk(meta);
  if (isStorageQuotaError(error)) {
    await stopRecordingAfterStorageQuotaFailure(meta, error);
  } else {
    reportWorkerError(error);
  }
}

/**
 * Deletes the provided chunk files from OPFS.
 *
 * @async
 * @param {string[]} filenames chunk filenames to delete.
 */
async function deleteChunksFromOpfs(filenames: string[]): Promise<void> {
  const dir = await ensureOpfsDir();
  for (const name of filenames) {
    try {
      await dir.removeEntry(name);
    } catch (e) {
      console.warn(`Failed to remove OPFS entry ${name}:`, e);
    }
  }
}

/**
 * Recreates the recording OPFS directory from scratch.
 *
 * @async
 */
async function resetOpfsDir(): Promise<void> {
  if (opfsResetPromise) {
    await opfsResetPromise;
  } else {
    opfsResetPromise = (async() => {
      const root = await navigator.storage.getDirectory();
      opfsDirHandle = null;
      try {
        await root.removeEntry(OPFS_DIR, {recursive: true});
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'NotFoundError')) {
          console.warn(`Failed to remove OPFS directory ${OPFS_DIR}:`, e);
        }
      }
      opfsDirHandle = await root.getDirectoryHandle(OPFS_DIR, {create: true});
    })();
    try {
      await opfsResetPromise;
    } finally {
      opfsResetPromise = null;
    }
  }
}

/**
 * Posts the current recording manifest through the worker protocol.
 */
function sendRecordingManifest(): void {
  updateManifestRange(manifest, sealedChunks, chunkGenerations);
  self.postMessage({
    type: 'recording',
    manifest: {
      chunks: cloneRecordingChunks(sealedChunks),
      generationStart: manifest.generationStart,
      generationEnd: manifest.generationEnd,
      gridFormat: currentGridFormatMetadata()
    },
    cols,
    rows
  });
}

/**
 * Records the current generation when recording is active and capture is still pending.
 *
 * @param {boolean} [markForwardProgress=false] whether forward progress should clear the initial-recording gate.
 */
function captureCurrentGenerationIfNeeded(markForwardProgress: boolean = false): void {
  if (isRecording) {
    let captureAllowed = !recordingAwaitingForward;
    if (markForwardProgress && recordingAwaitingForward && canRecordNow()) {
      recordingAwaitingForward = false;
      captureAllowed = true;
    }
    if (captureAllowed && needsInitialCapture(latestRecordedGeneration, genCounter) && canRecordNow()) {
      if (chunkFrameIndex >= chunkFrameCapacity) {
        sealCurrentChunk();
      }
      recordGeneration(genCounter);
    }
  }
}

/**
 * Apply any pending brush draw and re-record the current gen if it was already captured.
 */
function applyPendingBrush(): void {
  if (pendingBrush) {
    const b = pendingBrush;
    pendingBrush = null;
    const shouldOverwriteRecordedFrame = isRecording && chunkFrameIndex > 0 && chunkGenerations[chunkFrameIndex - 1] === genCounter;
    if (shouldOverwriteRecordedFrame) {
      chunkFrameIndex--;
      chunkGenerations.pop();
    }
    const encoder = device.createCommandEncoder({label: GPU_LABELS.brushEncoder});
    dispatchBrushOnEncoder(encoder, b);
    device.queue.submit([encoder.finish()]);
    if (shouldOverwriteRecordedFrame) {
      recordGeneration(genCounter);
    }
  }
}

/**
 * Read a chunk from OPFS and decompress if needed.
 *
 * @param {string} filename chunk filename.
 * @param {string} codec chunk payload codec.
 * @returns {Promise<ArrayBuffer>} chunk payload bytes.
 */
async function readChunkFromOpfs(filename: string, codec: string = RAW_PACKED_CODEC): Promise<ArrayBuffer> {
  const dir = await ensureOpfsDir();
  const fileHandle = await dir.getFileHandle(filename);
  const file = await fileHandle.getFile();
  const stored = await file.arrayBuffer();
  if (codec === RAW_DEFLATE_CODEC) {
    return decompressPayload(stored);
  }
  return stored;
}

/**
 * Returns the availability of each live metric section for the current grid and settings.
 *
 * @returns {MetricAvailability} availability by live metric section.
 */
function currentMetricAvailability(): MetricAvailability {
  return planInteractiveMetricAvailability(cols, rows, liveMetrics.enabled, liveMetrics.sections);
}

/**
 * Returns the interactive metric sections that can be encoded for the current grid.
 *
 * @returns {InteractiveMetricSection[]} enabled interactive metric sections.
 */
function currentMetricSections(): InteractiveMetricSection[] {
  return activeInteractiveMetricSections(currentMetricAvailability());
}

/**
 * Encodes the enabled interactive metrics passes into the provided GPU command encoder.
 *
 * @param {GPUCommandEncoder} encoder command encoder receiving the metrics passes.
 */
function runMetricsGpu(encoder: GPUCommandEncoder): void {
  lastEncodedMetricSections = currentMetricSections();
  if (metricsResources && lastEncodedMetricSections.length > 0) {
    encodeInteractiveMetrics({
      device,
      encoder,
      resources: metricsResources,
      sourceBuffer: pingPong ? gridBufferB : gridBufferA,
      dispatchPlan: metricsDispatchPlan,
      enabledSections: lastEncodedMetricSections
    });
  }
}

/**
 * Reads back encoded metrics buffers and posts the resulting metrics message.
 */
function readMetricsAndPost(): void {
  const gen = genCounter;
  if (metricsResources && gen !== lastMetricsGen && !metricsInFlight) {
    const encodedSections = [...lastEncodedMetricSections];
    const availability = currentMetricAvailability();
    lastMetricsGen = gen;
    metricsInFlight = true;
    readInteractiveMetrics({resources: metricsResources, enabledSections: encodedSections}).then(readback => {
      const deadIdx = tribeIndex.get(DEAD_TRIBE_ID) ?? 0;
      const totalFrames = countFrames(sealedChunks, chunkFrameIndex + inflightSealFrames);
      const message = buildInteractiveMetricMessage({
        generation: gen,
        tribes,
        deadTribeIndex: deadIdx,
        readback,
        enabledSections: encodedSections,
        availability,
        liveMetricSettings: liveMetrics.sections,
        cols,
        rows,
        topology: ruleset.topology,
        totalFrames,
        fps: currentFps,
        canStepBack: totalFrames > 1,
        recordingBytes: recordingStoredBytes(sealedChunks),
        recordingRawBytes: recordingRawBytes(sealedChunks)
      });
      metricsInFlight = false;
      self.postMessage(message);
      if (pendingMetricsRetry) {
        pendingMetricsRetry = false;
        lastMetricsGen = -1;
        if (canEncodeInteractiveMetrics()) {
          const retryEncoder = device.createCommandEncoder({label: GPU_LABELS.interactiveMetricsEncoder});
          runMetricsGpu(retryEncoder);
          device.queue.submit([retryEncoder.finish()]);
          readMetricsAndPost();
        } else {
          pendingMetricsRetry = true;
        }
      }
    }).catch(() => {
      metricsInFlight = false;
    });
  }
}

/**
 * Writes per-pass generation parameters for a probabilistic simulation batch.
 *
 * @param {number} count generation count to prepare.
 */
function writeSimulationParameters(count: number): void {
  if (probabilisticComputeActive && simulationParameterBuffer && count > 0) {
    const slotCount = Math.min(count, SIMULATION_PARAMETER_SLOT_COUNT);
    const strideU32 = simulationParameterSlotStride / Uint32Array.BYTES_PER_ELEMENT;
    const data = new Uint32Array(slotCount * strideU32);
    for (let i = 0; i < slotCount; i++) {
      data[i * strideU32] = genCounter + i;
    }
    device.queue.writeBuffer(simulationParameterBuffer, 0, data);
  }
}

/**
 * Limits one encoded simulation batch to the available parameter slots.
 *
 * @param {number} requested requested generation count.
 * @returns {number} encodable generation count.
 */
function simulationBatchStepLimit(requested: number): number {
  let limit = requested;
  if (probabilisticComputeActive) {
    limit = Math.min(requested, SIMULATION_PARAMETER_SLOT_COUNT);
  }
  return limit;
}

/**
 * Encodes one simulation generation into the provided command encoder.
 *
 * @param {GPUCommandEncoder} encoder destination command encoder.
 * @param {number} [parameterSlot=0] parameter slot for probabilistic rules.
 */
function encodeSimulationStep(encoder: GPUCommandEncoder, parameterSlot = 0): void {
  const pass = encoder.beginComputePass({label: GPU_LABELS.simulationStepPass});
  pass.setPipeline(computePipeline);
  pass.setBindGroup(0, pingPong ? computeBindGroupBtoA : computeBindGroupAtoB);
  if (probabilisticComputeActive) {
    pass.setBindGroup(1, simulationParameterBindGroups[parameterSlot]);
  }
  const plan = simulationDispatchPlan;
  pass.dispatchWorkgroups(plan.dispatchWgX, plan.dispatchWgY);
  pass.end();
  pingPong = !pingPong;
  genCounter++;
}

/**
 * Encodes multiple simulation steps into a single command submission.
 *
 * @param {number} count number of generations to encode.
 */
function batchStep(count: number): void {
  const stepCountLimit = simulationBatchStepLimit(count);
  if (stepCountLimit > 0) {
    writeSimulationParameters(stepCountLimit);
    const encoder = device.createCommandEncoder({label: GPU_LABELS.simulationBatchEncoder});
    for (let i = 0; i < stepCountLimit; i++) {
      encodeSimulationStep(encoder, i);
    }
    device.queue.submit([encoder.finish()]);
    stepCount += stepCountLimit;
  }
}

/**
 * Post a lightweight generation + fps update.
 */
function postGeneration(): void {
  self.postMessage({
    type: 'generation',
    generation: genCounter,
    fps: currentFps
  });
}

/**
 * Encodes and submits one simulation generation.
 */
function stepSimulation(): void {
  writeSimulationParameters(1);
  const encoder = device.createCommandEncoder({label: GPU_LABELS.simulationSingleStepEncoder});
  encodeSimulationStep(encoder);
  device.queue.submit([encoder.finish()]);
}

/**
 * Renders the current grid when the WebGPU presentation path is ready.
 */
function renderFrame(): void {
  if (device && context && uniformBuffer && renderPipeline && renderBindGroupA && renderBindGroupB && !rebuilding && !deviceLost) {
    writeUniforms();
    const textureView = context.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder({label: GPU_LABELS.renderEncoder});
    const pass = encoder.beginRenderPass({
      label: GPU_LABELS.renderPass,
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: {
            r: 0,
            g: 0,
            b: 0,
            a: 1
          }
        }
      ]
    });
    pass.setPipeline(renderPipeline);
    pass.setBindGroup(0, pingPong ? renderBindGroupB : renderBindGroupA);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }
}

/**
 * Updates the rolling FPS estimate once enough time has elapsed.
 *
 * @param {number} now current high-resolution timestamp.
 */
function updateFps(now: number): void {
  if (lastFpsTime === 0) {
    lastFpsTime = now;
  }
  const fpsElapsed = now - lastFpsTime;
  if (fpsElapsed >= 1000) {
    currentFps = stepCount / (fpsElapsed / 1000);
    stepCount = 0;
    lastFpsTime = now;
  }
}

/**
 * Clears the rolling FPS sample window after non-forward navigation.
 */
function resetFps(): void {
  stepCount = 0;
  lastFpsTime = 0;
  currentFps = 0;
}

/**
 * Chooses the active run kind from the current recording state.
 *
 * @returns {RunKind} run kind for the next run pump.
 */
function runKindForCurrentRecording(): RunKind {
  return isRecording && recordingAvailableNow() ? 'recording' : 'nonRecording';
}

/**
 * Checks whether interactive metrics can be encoded on the current device state.
 *
 * @returns {boolean} `true` when a metrics pass can be submitted.
 */
function canEncodeInteractiveMetrics(): boolean {
  return !!(device && metricsResources && !rebuilding && !deviceLost);
}

/**
 * Schedules a fresh interactive metrics readback, optionally invalidating the cache first.
 *
 * @param {boolean} [force=false] whether to force a refresh even when the generation is unchanged.
 */
function queueMetricsRefresh(force: boolean = false): void {
  if (force) {
    lastMetricsGen = -1;
  }
  if (!canEncodeInteractiveMetrics()) {
    pendingMetricsRetry = true;
  } else if (!metricsInFlight) {
    const encoder = device.createCommandEncoder({label: GPU_LABELS.interactiveMetricsEncoder});
    runMetricsGpu(encoder);
    device.queue.submit([encoder.finish()]);
    readMetricsAndPost();
  } else {
    pendingMetricsRetry = true;
  }
}

/**
 * Forces a metrics refresh before rendering the current frame.
 */
function refreshMetricsAndRender(): void {
  queueMetricsRefresh(true);
  renderFrame();
}

/**
 * Starts a periodic metrics refresh after simulation work completes.
 *
 * @param {number} now current high-resolution timestamp.
 * @param {boolean} didStep whether the loop encoded at least one generation.
 */
function maybeRunPeriodicMetrics(now: number, didStep: boolean): void {
  if (didStep && (now - lastMetricsTime >= 1000 || lastMetricsTime === 0) && !metricsInFlight) {
    lastMetricsTime = now;
    queueMetricsRefresh();
  }
}

/**
 * Posts coarse-grained run progress for long-running max-speed and target runs.
 *
 * @param {RunState} run active run state.
 * @param {number} now current high-resolution timestamp.
 */
function maybePostRunProgress(run: RunState, now: number): void {
  if ((run.request.pacing.kind === 'max' || isTargetRun(run)) && now - run.lastProgressTime >= 1000) {
    run.lastProgressTime = now;
    postGeneration();
  }
}

/**
 * Updates the current run backpressure notification.
 * 
 * @param {boolean} active whether backpressure is active.
 */
function setRunBackpressure(active: boolean): void {
  if (backpressureActive !== active) {
    backpressureActive = active;
    self.postMessage({type: 'backpressure', active});
  }
}

/**
 * Ensures recording state is ready before encoding the next generation.
 *
 * @returns {boolean} `true` when recording can proceed.
 */
function prepareRecordingStep(): boolean {
  let recordingReady = canRecordNow();
  if (recordingReady && chunkFrameIndex >= chunkFrameCapacity) {
    sealCurrentChunk();
    recordingReady = canRecordNow();
  }
  return recordingReady;
}

/**
 * Schedules an idle render frame when no active run owns the loop.
 */
function scheduleIdleFrame(): void {
  if (!rebuilding && !deviceLost && !activeRun) {
    self.requestAnimationFrame(mainLoop);
  }
}

/**
 * Updates adaptive batching from a completed GPU queue drain.
 *
 * @param {RunState} run active run state.
 * @param {number} now current high-resolution timestamp.
 */
function completeAdaptiveDrain(run: RunState, now: number): void {
  const adaptive = run.adaptiveBatch;
  if (adaptive && adaptive.lastDrainStartedAt > 0) {
    updateAdaptiveBatchState(adaptive, now - adaptive.lastDrainStartedAt);
    adaptive.lastDrainStartedAt = 0;
    adaptive.lastSubmittedGenerations = 0;
  }
}

/**
 * Marks the submitted work used for the next adaptive drain measurement.
 *
 * @param {RunState} run active run state.
 * @param {number} submittedGenerations generations submitted before draining.
 * @param {number} startedAt drain start timestamp.
 */
function markAdaptiveDrain(run: RunState, submittedGenerations: number, startedAt: number): void {
  const adaptive = run.adaptiveBatch;
  if (adaptive && submittedGenerations > 0) {
    adaptive.lastSubmittedGenerations = submittedGenerations;
    adaptive.lastDrainStartedAt = startedAt;
  }
}

/**
 * Submits non-recording simulation work in bounded command chunks.
 *
 * @param {number} generations generation count to submit.
 * @param {Grid} grid current logical grid dimensions.
 * @returns {number} generations submitted.
 */
function submitNonRecordingBatches(generations: number, grid: Grid): number {
  const commandBatchSize = Math.max(1, Math.round(skipBatchSize(grid)));
  let submitted = 0;
  while (submitted < generations) {
    const remaining = generations - submitted;
    const steps = Math.min(commandBatchSize, remaining);
    batchStep(steps);
    submitted += steps;
  }
  return submitted;
}

/**
 * Schedules the next run pump using the requested wake-up strategy.
 *
 * @param {PumpSchedule} schedule scheduling strategy for the next pump.
 */
function scheduleRunPump(schedule: PumpSchedule): void {
  const run = activeRun;
  if (run && !run.pumpPending && !rebuilding && !deviceLost) {
    const {token} = run;
    run.pumpPending = true;
    const pump = (): void => {
      if (activeRun && activeRun.token === token) {
        const now = performance.now();
        activeRun.pumpPending = false;
        if (schedule === 'drain') {
          completeAdaptiveDrain(activeRun, now);
        }
        pumpRun(now);
      }
    };
    if (schedule === 'raf') {
      self.requestAnimationFrame(() => pump());
    } else if (schedule === 'drain') {
      device.queue.onSubmittedWorkDone().then(pump).catch(() => {
        if (activeRun?.token === token) {
          activeRun.pumpPending = false;
        }
      });
    } else {
      queueMicrotask(pump);
    }
  }
}

/**
 * Starts a new active run and schedules its first pump.
 *
 * @param {RunKind} kind active run kind.
 * @param {RunRequest} request run pacing and stop conditions.
 */
function startRun(kind: RunKind, request: RunRequest): void {
  if (activeRun) {
    stopRun('restart', {
      render: false,
      postStepping: false,
      restore: false,
      restartRestoredRun: false
    });
  }
  const grid = currentGridSize();
  const adaptiveBatch = kind === 'nonRecording' ? createAdaptiveBatchState(grid, request.pacing) : null;
  if (adaptiveBatch) {
    console.info('[GOLT worker] Adaptive non-recording batching started', {
      cols: grid.cols,
      rows: grid.rows,
      bitsPerCell: gridFormat.bitsPerCell,
      generationsPerDrain: adaptiveBatch.generationsPerDrain,
      targetDrainMs: adaptiveBatch.targetDrainMs
    });
  }
  activeRun = {
    kind,
    request,
    token: ++nextRunToken,
    pumpPending: false,
    lastFrameTime: 0,
    stepAccumulator: 0,
    lastProgressTime: 0,
    lastRenderTime: 0,
    adaptiveBatch
  };
  scheduleRunPump(request.pacing.kind === 'fixedGenPerSecond' ? 'raf' : 'microtask');
}

/**
 * Starts the continuous simulation loop when simulation is enabled.
 */
function startContinuousRun(): void {
  if (simulationRunning) {
    startRun(runKindForCurrentRecording(), {
      pacing: currentRunPacing(targetStepDuration),
      stopCondition: {kind: 'none'}
    });
  }
}

/**
 * Updates run backpressure state after a stop.
 *
 * @param {RunStopReason} reason reason the run is stopping.
 * @param {boolean} targetRun whether the run stops at a target generation.
 */
function finalizeStopBackpressure(reason: RunStopReason, targetRun: boolean): void {
  if (targetRun || reason === 'cancelled') {
    setRunBackpressure(false);
  } else if (backpressureActive) {
    checkBackpressure();
  }
}

/**
 * Stops the active run and applies the requested cleanup behavior.
 *
 * @param {RunStopReason} reason reason the run is stopping.
 * @param {StopRunOptions} [options={}] stop-time side-effect controls.
 */
function stopRun(reason: RunStopReason, options: StopRunOptions = {}): void {
  const run = activeRun;
  if (run) {
    activeRun = null;
    nextRunToken++;
    const targetRun = isTargetRun(run);
    const restoreAfterStop = restoreAfterStopState(run, options);
    const restored = Boolean(restoreAfterStop);
    if (restoreAfterStop) {
      simulationRunning = restoreAfterStop.running;
      targetStepDuration = restoreAfterStop.targetStepDuration;
    }
    if (shouldPostStopStepping(reason, targetRun, options)) {
      self.postMessage({type: 'stepping', active: false});
    }
    finalizeStopBackpressure(reason, targetRun);
    if (options.render !== false && !rebuilding && !deviceLost) {
      refreshMetricsAndRender();
    }
    if (shouldRestartRestoredRun(options, restored, simulationRunning, rebuilding, deviceLost)) {
      startContinuousRun();
    } else {
      scheduleIdleFrame();
    }
  }
}

/**
 * Cancels the current target run and optionally updates the restored running flag.
 *
 * @param {boolean} restoreRunning whether the restored run should resume as running.
 */
function cancelTargetRun(restoreRunning: boolean): void {
  const run = activeRun;
  if (run && isTargetRun(run)) {
    if (run.request.restoreAfterStop) {
      run.request.restoreAfterStop.running = restoreRunning;
    }
    stopRun('cancelled');
  }
}

/**
 * Restarts the active run after a recording-mode change.
 *
 * @param {RunRequest} request run request to resume with.
 */
function restartActiveRunForRecordingChange(request: RunRequest): void {
  stopRun('restart', {
    render: false,
    postStepping: false,
    restore: false,
    restartRestoredRun: false
  });
  startRun(runKindForCurrentRecording(), request);
}

/**
 * Handles a recording stall by yielding until GPU or storage backpressure clears.
 *
 * @param {RunState} run active run state.
 * @param {number} now current high-resolution timestamp.
 * @param {boolean} didStep whether the current pump encoded at least one step.
 */
function handleRecordingBlocked(run: RunState, now: number, didStep: boolean): void {
  setRunBackpressure(true);
  maybePostRunProgress(run, now);
  maybeRunPeriodicMetrics(now, didStep);
  scheduleRunPump('drain');
}

/**
 * Encodes and submits a bounded group of recorded generations.
 *
 * @param {number} maxSteps maximum generations to record in this batch.
 * @param {number} deadline high-resolution timestamp where this pump should yield.
 * @returns {{steps: number; blocked: boolean}} submitted step count and backpressure state.
 */
function submitRecordingStepCopyBatch(maxSteps: number, deadline: number): {steps: number; blocked: boolean} {
  const maxEncodableSteps = simulationBatchStepLimit(maxSteps);
  writeSimulationParameters(maxEncodableSteps);
  const encoder = device.createCommandEncoder({label: GPU_LABELS.recordingStepBatchEncoder});
  let steps = 0;
  let blocked = false;
  let keepEncoding = maxEncodableSteps > 0;
  while (keepEncoding) {
    if (steps < maxEncodableSteps && performance.now() < deadline) {
      if (prepareRecordingStep() && canEncodeRecordingFrameCopy()) {
        encodeSimulationStep(encoder, steps);
        encodeRecordingFrameCopy(encoder, genCounter);
        steps++;
        if (chunkFrameIndex >= chunkFrameCapacity) {
          keepEncoding = false;
        }
      } else {
        blocked = true;
        keepEncoding = false;
      }
    } else {
      keepEncoding = false;
    }
  }
  if (steps > 0) {
    device.queue.submit([encoder.finish()]);
    stepCount += steps;
    retrySealCurrentChunkIfPossible();
  }
  return {steps, blocked};
}

/**
 * Pumps a max-speed non-recording run until the per-drain batch budget is exhausted.
 *
 * @param {RunState} run active run state.
 * @param {number} now current high-resolution timestamp.
 */
function pumpNonRecordingMaxRun(run: RunState, now: number): void {
  const grid = currentGridSize();
  const adaptiveBudget = run.adaptiveBatch?.generationsPerDrain ?? Math.round(skipBatchSize(grid) * nonRecordingMaxSpeedBatchesPerDrain(grid));
  const generations = Math.min(adaptiveBudget, remainingTargetSteps(run, genCounter));
  const submitted = submitNonRecordingBatches(generations, grid);
  const didStep = submitted > 0;
  maybePostRunProgress(run, now);
  if (runTargetReached(run, genCounter)) {
    stopRun('targetReached');
  } else if (didStep) {
    markAdaptiveDrain(run, submitted, performance.now());
    scheduleRunPump('drain');
  } else {
    scheduleRunPump('raf');
  }
}

/**
 * Pumps a max-speed recording run within the current frame deadline.
 *
 * @param {RunState} run active run state.
 * @param {number} now current high-resolution timestamp.
 */
function pumpRecordingMaxRun(run: RunState, now: number): void {
  captureCurrentGenerationIfNeeded(true);
  let didStep = false;
  let blocked = false;
  const deadline = performance.now() + 14;
  let keepPumping = remainingTargetSteps(run, genCounter) > 0 && performance.now() < deadline;
  while (keepPumping) {
    const result = submitRecordingStepCopyBatch(remainingTargetSteps(run, genCounter), deadline);
    didStep = didStep || result.steps > 0;
    if (result.blocked) {
      handleRecordingBlocked(run, now, didStep);
      blocked = true;
      keepPumping = false;
    } else {
      keepPumping = result.steps > 0 && remainingTargetSteps(run, genCounter) > 0 && performance.now() < deadline;
    }
  }
  if (!blocked) {
    setRunBackpressure(false);
    maybePostRunProgress(run, now);
    maybeRunPeriodicMetrics(now, didStep);
    if (runTargetReached(run, genCounter)) {
      stopRun('targetReached');
    } else {
      scheduleRunPump('raf');
    }
  }
}

/**
 * Pumps a fixed-rate non-recording run and optionally drains extra accumulated work.
 *
 * @param {RunState} run active run state.
 * @param {number} duration target step duration in milliseconds.
 * @param {number} now current high-resolution timestamp.
 */
function pumpNonRecordingFixedRun(run: RunState, duration: number, now: number): void {
  if (run.lastFrameTime === 0) {
    run.lastFrameTime = now;
  }
  const delta = now - run.lastFrameTime;
  run.lastFrameTime = now;
  run.stepAccumulator += delta;
  const startingAccumulator = run.stepAccumulator;
  const dueSteps = Math.floor(run.stepAccumulator / duration);
  const grid = currentGridSize();
  const stepBudget = run.adaptiveBatch?.generationsPerDrain ?? fixedRunStepBudget(run.kind, grid);
  const steps = Math.min(dueSteps, remainingTargetSteps(run, genCounter), stepBudget);
  const submitted = submitNonRecordingBatches(steps, grid);
  const didStep = submitted > 0;
  run.stepAccumulator = nextFixedRunAccumulator(startingAccumulator, duration, dueSteps, submitted, stepBudget);
  maybePostRunProgress(run, now);
  if (runTargetReached(run, genCounter)) {
    stopRun('targetReached');
  } else {
    const shouldDrain = didStep && dueSteps > submitted;
    if (!isTargetRun(run) && !shouldDrain || now - run.lastRenderTime >= 33 || run.lastRenderTime === 0) {
      run.lastRenderTime = now;
      renderFrame();
      maybeRunPeriodicMetrics(now, didStep);
    }
    if (shouldDrain) {
      markAdaptiveDrain(run, submitted, performance.now());
    }
    scheduleRunPump(shouldDrain ? 'drain' : 'raf');
  }
}

/**
 * Pumps a fixed-rate recording run within the current frame deadline.
 *
 * @param {RunState} run active run state.
 * @param {number} duration target step duration in milliseconds.
 * @param {number} now current high-resolution timestamp.
 */
function pumpRecordingFixedRun(run: RunState, duration: number, now: number): void {
  captureCurrentGenerationIfNeeded(true);
  if (run.lastFrameTime === 0) {
    run.lastFrameTime = now;
  }
  const delta = now - run.lastFrameTime;
  run.lastFrameTime = now;
  run.stepAccumulator += delta;
  let didStep = false;
  let stepsThisPump = 0;
  const startingAccumulator = run.stepAccumulator;
  const stepBudget = fixedRunStepBudget(run.kind, currentGridSize());
  const dueSteps = Math.floor(run.stepAccumulator / duration);
  const deadline = performance.now() + 14;
  let blocked = false;
  let keepPumping = dueSteps > 0 && remainingTargetSteps(run, genCounter) > 0 && stepsThisPump < stepBudget && performance.now() < deadline;
  while (keepPumping) {
    const maxSteps = Math.min(dueSteps - stepsThisPump, stepBudget - stepsThisPump, remainingTargetSteps(run, genCounter));
    const result = submitRecordingStepCopyBatch(maxSteps, deadline);
    stepsThisPump += result.steps;
    didStep = didStep || result.steps > 0;
    if (result.blocked) {
      handleRecordingBlocked(run, now, didStep);
      blocked = true;
      keepPumping = false;
    } else {
      keepPumping = result.steps > 0 && dueSteps > stepsThisPump && remainingTargetSteps(run, genCounter) > 0 && stepsThisPump < stepBudget && performance.now() < deadline;
    }
  }
  run.stepAccumulator = nextFixedRunAccumulator(startingAccumulator, duration, dueSteps, stepsThisPump, stepBudget);
  if (!blocked) {
    setRunBackpressure(false);
    maybePostRunProgress(run, now);
    if (runTargetReached(run, genCounter)) {
      stopRun('targetReached');
    } else {
      if (!isTargetRun(run)) {
        renderFrame();
        maybeRunPeriodicMetrics(now, didStep);
      }
      scheduleRunPump('raf');
    }
  }
}

/**
 * Dispatches the active run pump for the current animation-frame timestamp.
 *
 * @param {number} now current high-resolution timestamp.
 */
function pumpRun(now: number): void {
  const run = activeRun;
  if (run && !rebuilding && !deviceLost) {
    updateFps(now);
    if (!isTargetRun(run)) {
      applyPendingBrush();
    }
    if (runTargetReached(run, genCounter)) {
      stopRun('targetReached');
    } else if (run.request.pacing.kind === 'max') {
      if (run.kind === 'recording') {
        pumpRecordingMaxRun(run, now);
      } else {
        pumpNonRecordingMaxRun(run, now);
      }
    } else {
      const duration = 1000 / run.request.pacing.genPerSecond;
      if (run.kind === 'recording') {
        pumpRecordingFixedRun(run, duration, now);
      } else {
        pumpNonRecordingFixedRun(run, duration, now);
      }
    }
  }
}

/**
 * Dispatches the active run pump for the current animation-frame timestamp.
 *
 * @param {number} now current high-resolution timestamp.
 */
function mainLoop(now: number): void {
  if (rebuilding || deviceLost) {
    self.requestAnimationFrame(mainLoop);
  } else {
    updateFps(now);
    if (!activeRun) {
      applyPendingBrush();
      if (targetStepDuration > 0 && !gpuCatchUpPending) {
        renderFrame();
      }
      self.requestAnimationFrame(mainLoop);
    }
  }
}

/**
 * Selects the simulation grid format that satisfies both the request and device limits.
 *
 * @param {Ruleset<readonly Tribe[]>} rs ruleset being initialized.
 * @param {GridFormatMetadata} requested requested simulation grid format.
 * @returns {GridFormat} selected packed grid format.
 */
function selectSimulationGridFormat(rs: Ruleset<readonly Tribe[]>, requested: GridFormatMetadata): GridFormat {
  const maxBytes = device ? currentMaxSimulationBytes() : Number.POSITIVE_INFINITY;
  if (isSupportedBitsPerCell(requested.bitsPerCell) && validatePackingAgainstStateCount(requested.bitsPerCell, rs.tribes.length) && fitsGridFormatInMaxBytes(rs, gridFormatFromBits(requested.bitsPerCell), maxBytes)) {
    return gridFormatFromBits(requested.bitsPerCell);
  }
  return smallestValidSimulationGridFormat(rs.tribes.length, rs, maxBytes);
}

/**
 * Initializes worker-local ruleset state from the current configuration.
 *
 * @param {Ruleset<readonly Tribe[]>} rs active ruleset.
 * @param {GridFormatMetadata} simulationGridFormat requested simulation grid format.
 */
function initRuleset(rs: Ruleset<readonly Tribe[]>, simulationGridFormat: GridFormatMetadata): void {
  const normalizedInput = normalizeRuleset(rs);
  const topology = normalizedInput.topology === BOUNDED_GRID_TOPOLOGY ? BOUNDED_GRID_TOPOLOGY : TOROIDAL_GRID_TOPOLOGY;
  const boundaryTribe = normalizedInput.tribes.some(tribe => tribe.id === normalizedInput.boundaryTribe) ? normalizedInput.boundaryTribe : DEAD_TRIBE_ID;
  ruleset = {
    ...normalizedInput,
    topology,
    boundaryTribe
  };
  cols = normalizedInput.cols;
  rows = normalizedInput.rows;
  gridFormat = selectSimulationGridFormat(normalizedInput, simulationGridFormat);
  packedCols = packedColsForFormat(cols, gridFormat);
  tribes = [...ruleset.tribes];
  manifest.gridFormat = currentGridFormatMetadata();
  tribeIndex.clear();
  tribes.forEach((t, i) => tribeIndex.set(t.id, i));
}

/**
 * Initializes the WebGPU device and presentation context for the worker canvas.
 *
 * @param {OffscreenCanvas} offscreen worker-owned rendering surface.
 */
async function initWebGPU(offscreen: OffscreenCanvas): Promise<void> {
  console.log('[GOLT worker] Initializing WebGPU');
  canvas = offscreen;
  device = await requestWorkerGpuDevice(GPU_LABELS.webengineDevice);
  deviceLost = false;
  device.lost.then(info => {
    const reason = info.message || info.reason || 'unknown';
    console.error('[GOLT worker] GPU device lost:', reason);
    stopRun('deviceLost', {
      render: false,
      postStepping: false,
      restore: false,
      restartRestoredRun: false
    });
    deviceLost = true;
    simulationRunning = false;
    rebuilding = true;
    self.postMessage({type: 'deviceLost', reason});
  });
  self.postMessage({
    type: 'limits',
    maxBytes: currentMaxSimulationBytes(),
    vramBudgetBytes: vramBudgetBytes(currentMaxSimulationBytes(), currentMaxRecordingBytes()),
    frameByteSize: 0,
    recordingAvailable: true,
    vramSimulationBytes: 0,
    vramRecordingBytes: 0,
    gridFormat: currentGridFormatMetadata()
  });
  const nextContext = canvas.getContext('webgpu');
  if (nextContext) {
    context = nextContext;
    canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format: canvasFormat,
      alphaMode: 'opaque'
    });
    console.log('[GOLT worker] WebGPU initialized', {
      canvasFormat,
      maxBufferSize: device.limits.maxBufferSize,
      maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize
    });
  } else {
    throw new Error('WebGPU canvas context not available');
  }
}

/**
 * Restores the WebGPU device after loss and reconfigures worker state.
 *
 * @returns {Promise<boolean>} `true` when device restore succeeds.
 */
async function restoreWebGPUDevice(): Promise<boolean> {
  try {
    console.log('[GOLT worker] Restoring WebGPU device');
    await initWebGPU(canvas);
    console.log('[GOLT worker] WebGPU device restored');
    return true;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[GOLT worker] WebGPU device restore failed:', reason);
    stopRun('deviceLost', {
      render: false,
      postStepping: false,
      restore: false,
      restartRestoredRun: false
    });
    deviceLost = true;
    simulationRunning = false;
    rebuilding = true;
    self.postMessage({type: 'deviceLost', reason});
    return false;
  }
}

/**
 * Restores the WebGPU device after loss and reconfigures worker state.
 */
async function createChunkBuffer(): Promise<void> {
  chunkGpuBuffer = device.createBuffer({
    label: GPU_LABELS.recordingChunkBuffer,
    size: chunkFrameCapacity * frameByteSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  });
  await trackMajorBufferAllocation(chunkFrameCapacity * frameByteSize, chunkGpuBuffer);
  chunkFrameIndex = 0;
  chunkGenerations = [];
  latestRecordedGeneration = null;
}

/**
 * Creates the GPU buffer that accumulates one recording chunk before readback.
 */
async function createStagingRing(): Promise<void> {
  const size = chunkFrameCapacity * frameByteSize;
  stagingRing = [];
  stagingAvailable = [];
  for (let i = 0; i < STAGING_RING_SIZE; i++) {
    const stagingBuffer = device.createBuffer({
      label: `${GPU_LABELS.recordingStagingBuffer} ${i}`,
      size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    stagingRing.push(stagingBuffer);
    stagingAvailable.push(true);
    await trackMajorBufferAllocation(size, stagingBuffer);
  }
}

/**
 * Creates the mapped staging buffers used to read recorded chunks back to the CPU.
 */
async function initOpfs(): Promise<void> {
  await resetOpfsDir();
}

/**
 * Resets the OPFS workspace used for recording chunks.
 */
async function buildPipelines(): Promise<void> {
  console.log('[GOLT worker] Building GPU resources', {
    cols,
    rows,
    bitsPerCell: gridFormat.bitsPerCell,
    recordingAvailable: recordingAvailableNow()
  });
  createUniformBuffer();
  computeChunkCapacity();
  await createGridBuffers();
  createTribeColorBuffer();
  createRenderPipeline();
  createRenderBindGroups();
  createComputePipeline();
  createBrushPipeline();
  createMetricsPipelines();
  await initOpfs();
  if (recordingAvailableNow()) {
    await createChunkBuffer();
    await createStagingRing();
  } else {
    console.warn('[GOLT worker] Recording buffers disabled for current frame size', {
      frameByteSize,
      maxRecordingBufferBytes: currentMaxRecordingBytes()
    });
    destroyRecordingBuffers();
    isRecording = false;
    recordingAwaitingForward = false;
  }
  await waitForTrackedBufferAllocations();
  postRecordingLimits();
  console.log('[GOLT worker] GPU resources ready');
}

/**
 * Builds the GPU resources required for simulation, rendering, metrics, and recording.
 *
 * @returns {Promise<void>} resolves when all requested resources are ready.
 */
async function rebuildForNewRuleset(): Promise<boolean> {
  console.log('[GOLT worker] Rebuild started', {
    cols,
    rows,
    bitsPerCell: gridFormat.bitsPerCell
  });
  stopRun('rebuild', {
    render: false,
    postStepping: false,
    restore: false,
    restartRestoredRun: false
  });
  rebuilding = true;
  self.postMessage({type: 'rebuilding', active: true});
  try {
    await waitForGpuQueueIdle();
  } catch {
    console.warn('[GOLT worker] Queue idle wait rejected during rebuild');
  }
  let rebuildSucceeded = !deviceLost;
  if (deviceLost) {
    rebuildSucceeded = await restoreWebGPUDevice();
  }
  if (rebuildSucceeded) {
    destroyRebuildableBuffers();
    createUniformBuffer();
    computeChunkCapacity();
    resetRebuildAllocationTracking(recordingAvailableNow());
    try {
      await createGridBuffers();
      createTribeColorBuffer();
      createRenderPipeline();
      createComputePipeline();
      createBrushPipeline();
      createRenderBindGroups();
      createMetricsPipelines();
      if (recordingAvailableNow()) {
        await createChunkBuffer();
        await createStagingRing();
      } else {
        destroyRecordingBuffers();
        isRecording = false;
        recordingAwaitingForward = false;
      }
      await waitForTrackedBufferAllocations();
      postRecordingLimits();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error('[GOLT worker] GPU rebuild failed:', reason);
      self.postMessage({type: 'gpuError', reason});
      try {
        destroyRebuildableBuffers();
        createUniformBuffer();
        resetRebuildAllocationTracking(false);
        await createGridBuffers();
        createTribeColorBuffer();
        createRenderPipeline();
        createComputePipeline();
        createBrushPipeline();
        createRenderBindGroups();
        createMetricsPipelines();
        isRecording = false;
        recordingAwaitingForward = false;
        frameByteSize = gridBufferSize();
        destroyRecordingBuffers();
        console.warn('[GOLT worker] GPU rebuild recovered with recording disabled');
        await waitForTrackedBufferAllocations();
        postRecordingLimits();
      } catch (e) {
        console.error('[GOLT worker] GPU rebuild recovery failed:', e);
        rebuildSucceeded = false;
      }
    }
  }
  if (rebuildSucceeded) {
    rebuilding = false;
    self.postMessage({type: 'rebuilding', active: false});
    console.log('[GOLT worker] Rebuild completed', {
      recordingAvailable: recordingAvailableNow(),
      frameByteSize
    });
  }
  return rebuildSucceeded;
}

/**
 * Schedules a callback after pending GPU catch-up work finishes.
 *
 * @param {() => void} onComplete callback to run after the GPU queue drains.
 */
function scheduleGpuCatchUpCompletion(onComplete: () => void): void {
  gpuCatchUpPending = true;
  device.queue.onSubmittedWorkDone().then(() => {
    gpuCatchUpPending = false;
    onComplete();
  }).catch(() => {
    gpuCatchUpPending = false;
  });
}

/**
 * Waits until all in-flight seal callbacks finish updating OPFS state.
 */
async function waitForInflightSeals(): Promise<void> {
  if (inflightSeals > 0) {
    await new Promise<void>(resolve => {
      const interval = setInterval(() => {
        if (inflightSeals === 0) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });
  }
}

/**
 * Handles the initial worker boot message.
 *
 * @param {InitMessage} message init message.
 */
async function handleInitMessage(message: InitMessage): Promise<void> {
  console.log('[GOLT worker] Init message received', {
    cols: message.ruleset.cols,
    rows: message.ruleset.rows,
    recording: message.recording,
    running: message.running,
    speed: message.speed
  });
  isRecording = message.recording;
  liveMetrics = normalizeLiveMetricsSettings(message.liveMetrics);
  recordingAwaitingForward = isRecording;
  initRuleset(message.ruleset, message.simulationGridFormat);
  await initWebGPU(message.canvas);
  await buildPipelines();
  queueMetricsRefresh(true);
  postStorageQuota();
  simulationRunning = message.running;
  targetStepDuration = message.speed < 0 ? 0 : 1000 / message.speed;
  if (simulationRunning) {
    startContinuousRun();
  } else {
    scheduleIdleFrame();
  }
}

/**
 * Handles live-metrics settings updates.
 *
 * @param {SetLiveMetricsMessage} message live-metrics message.
 */
function handleSetLiveMetricsMessage(message: SetLiveMetricsMessage): void {
  liveMetrics = normalizeLiveMetricsSettings(message.liveMetrics);
  queueMetricsRefresh(true);
}

/**
 * Handles ruleset changes that require GPU resource rebuilds.
 *
 * @param {SetRulesetMessage} message ruleset update message.
 */
async function handleSetRulesetMessage(message: SetRulesetMessage): Promise<void> {
  console.log('[GOLT worker] Ruleset update received', {
    cols: message.ruleset.cols,
    rows: message.ruleset.rows,
    tribes: message.ruleset.tribes.length
  });
  const maxSimulationBytes = currentMaxSimulationBytes();
  const fittingFormat = smallestFittingSimulationGridFormat(message.ruleset.tribes.length, message.ruleset, maxSimulationBytes);
  if (!fittingFormat) {
    const requiredFormat = requiredGridFormatForStateCount(message.ruleset.tribes.length);
    const reason = `Requested ruleset requires at least ${requiredFormat.bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;
    console.error('[GOLT worker] Rebuild rejected:', reason, {
      cols: message.ruleset.cols,
      rows: message.ruleset.rows,
      tribes: message.ruleset.tribes.length,
      maxBytes: maxSimulationBytes
    });
    self.postMessage({type: 'gpuError', reason});
  } else {
    stopRun('rebuild', {
      render: false,
      postStepping: false,
      restore: false,
      restartRestoredRun: false
    });
    initRuleset(message.ruleset, message.simulationGridFormat);
    const rebuilt = await rebuildForNewRuleset();
    if (rebuilt) {
      genCounter = 0;
      resetFps();
      await resetRecording(0);
      queueMetricsRefresh(true);
      if (simulationRunning) {
        startContinuousRun();
      } else {
        scheduleIdleFrame();
      }
    }
  }
}

/**
 * Handles simulation running-state changes.
 *
 * @param {SetRunningMessage} message running-state message.
 */
function handleSetRunningMessage(message: SetRunningMessage): void {
  simulationRunning = message.running;
  if (message.running) {
    if (!activeRun) {
      startContinuousRun();
    }
  } else if (activeRun && isTargetRun(activeRun)) {
    cancelTargetRun(false);
  } else if (activeRun) {
    stopRun('manual');
  } else {
    if (backpressureActive) {
      checkBackpressure();
    }
    refreshMetricsAndRender();
    scheduleIdleFrame();
  }
}

/**
 * Handles simulation speed changes.
 *
 * @param {SetSpeedMessage} message speed update message.
 */
function handleSetSpeedMessage(message: SetSpeedMessage): void {
  const wasMaxSpeed = targetStepDuration <= 0;
  const newDuration = message.speed < 0 ? 0 : 1000 / message.speed;
  targetStepDuration = newDuration;
  if (activeRun && !isTargetRun(activeRun) && simulationRunning) {
    stopRun('restart', {
      render: false,
      postStepping: false,
      restore: false,
      restartRestoredRun: false
    });
    if (wasMaxSpeed && newDuration > 0) {
      scheduleGpuCatchUpCompletion(() => {
        renderFrame();
        startContinuousRun();
      });
    } else {
      startContinuousRun();
    }
  } else if (simulationRunning && !activeRun) {
    startContinuousRun();
  } else if (wasMaxSpeed && newDuration > 0) {
    scheduleGpuCatchUpCompletion(() => {
      renderFrame();
      scheduleIdleFrame();
    });
  }
}

/**
 * Handles camera updates.
 *
 * @param {CameraMessage} message camera message.
 */
function handleCameraMessage(message: CameraMessage): void {
  scale = message.scale;
  offsetX = message.offsetX;
  offsetY = message.offsetY;
  if (!activeRun && !rebuilding && !deviceLost) {
    renderFrame();
  }
}

/**
 * Handles canvas resize updates.
 *
 * @param {ResizeMessage} message resize message.
 */
function handleResizeMessage(message: ResizeMessage): void {
  canvas.width = message.width;
  canvas.height = message.height;
  if (!activeRun && !rebuilding && !deviceLost) {
    renderFrame();
  }
}

/**
 * Handles queued brush draw requests.
 *
 * @param {DrawMessage} message draw message.
 */
function handleDrawMessage(message: DrawMessage): void {
  const ids = message.tribes.map(tribe => tribeIndex.get(tribe)).filter((value): value is number => value !== undefined);
  if (ids.length > 0) {
    const shapeMap: Record<string, number> = {
      square: 0,
      round: 1,
      diamond: 2,
      vline: 3,
      hline: 4
    };
    const fillMap: Record<string, number> = {
      full: 0,
      spray: 1,
      outline: 2
    };
    pendingBrush = {
      centerX: message.x,
      centerY: message.y,
      brushSize: message.size,
      shape: shapeMap[message.shape] ?? 0,
      fill: fillMap[message.fill] ?? 0,
      density: clampBrushDensity(message.density),
      tribeIds: ids
    };
  }
}

/**
 * Handles brush preview updates.
 *
 * @param {BrushPreviewMessage} message brush-preview message.
 */
function handleBrushPreviewMessage(message: BrushPreviewMessage): void {
  const shapeMap: Record<string, number> = {
    square: 0,
    round: 1,
    diamond: 2,
    vline: 3,
    hline: 4
  };
  brushPreview = {
    centerX: message.x,
    centerY: message.y,
    brushSize: message.size,
    shape: shapeMap[message.shape] ?? 0,
    visible: message.visible
  };
  if (!activeRun && !rebuilding && !deviceLost && targetStepDuration <= 0) {
    renderFrame();
  }
}

/**
 * Handles visual export framing overlay updates.
 *
 * @param {ExportFrameOverlayMessage} message export-frame overlay message.
 */
function handleExportFrameOverlayMessage(message: ExportFrameOverlayMessage): void {
  exportFrameOverlay = {
    originX: message.origin?.originX ?? 0,
    originY: message.origin?.originY ?? 0,
    visible: message.visible && message.origin !== null
  };
  if (!activeRun && !rebuilding && !deviceLost && targetStepDuration <= 0) {
    renderFrame();
  }
}

/**
 * Handles snapshot readback requests.
 */
async function handleGetSnapshotMessage(): Promise<void> {
  try {
    const grid = await readbackGrid();
    postWorkerTransfer({
      type: 'snapshot',
      grid,
      generation: genCounter,
      cols,
      rows,
      gridFormat: currentGridFormatMetadata()
    }, [grid.buffer]);
  } catch {
    const empty = new Uint32Array(0);
    postWorkerTransfer({
      type: 'snapshot',
      grid: empty,
      generation: genCounter,
      cols,
      rows,
      gridFormat: currentGridFormatMetadata()
    }, [empty.buffer]);
  }
}

/**
 * Handles snapshot restore requests.
 *
 * @param {LoadSnapshotMessage} message snapshot-restore message.
 */
async function handleLoadSnapshotMessage(message: LoadSnapshotMessage): Promise<void> {
  const incomingGridFormat = gridFormatFromMetadata(message.gridFormat);
  const grid = currentGridSize();
  if (message.grid.byteLength === gridByteSize(grid, incomingGridFormat)) {
    const gridData = repackPackedGrid(message.grid, grid, incomingGridFormat, gridFormat);
    device.queue.writeBuffer(pingPong ? gridBufferB : gridBufferA, 0, gridData);
    genCounter = message.generation;
    resetFps();
    await resetRecording(message.generation);
  }
}

/**
 * Handles recording enablement changes.
 *
 * @param {SetRecordingMessage} message recording toggle message.
 */
function handleSetRecordingMessage(message: SetRecordingMessage): void {
  const runToRestart = activeRun?.request;
  const recordingAvailable = recordingAvailableNow();
  if (message.recording && recordingAvailable && !isRecording) {
    isRecording = true;
    recordingAwaitingForward = true;
    queueMetricsRefresh(true);
    postStorageQuota();
  } else if (!message.recording || !recordingAvailable) {
    if (message.recording && !recordingAvailable) {
      console.warn('[GOLT worker] Recording requested but unavailable for current frame size', {frameByteSize, maxRecordingBufferBytes: currentMaxRecordingBytes()});
    }
    isRecording = false;
    recordingAwaitingForward = false;
  }
  if (runToRestart && activeRun) {
    restartActiveRunForRecordingChange(runToRestart);
  } else if (!activeRun && simulationRunning) {
    startContinuousRun();
  }
}

/**
 * Handles recording manifest requests.
 */
async function handleGetRecordingMessage(): Promise<void> {
  if (!getRecordingPending) {
    await waitForGpuQueueIdle();
    captureCurrentGenerationIfNeeded(false);
    if (chunkFrameIndex > 0) {
      sealCurrentChunk();
    }
    if (inflightSeals > 0) {
      getRecordingPending = true;
    } else {
      sendRecordingManifest();
    }
  }
}

/**
 * Handles recorded step-back navigation.
 *
 * @param {StepBackMessage} message step-back message.
 */
async function handleStepBackMessage(message: StepBackMessage): Promise<void> {
  let sealedCount = countFrames(sealedChunks);
  const target = resolveStepBackTarget(sealedChunks, sealedCount, chunkFrameIndex, message.count);
  if (target) {
    const activeGridBuffer = pingPong ? gridBufferB : gridBufferA;
    if (target.source === 'buffered') {
      const bufferedState = bufferedStepBackState(chunkGenerations, target);
      chunkFrameIndex = bufferedState.chunkFrameIndex;
      chunkGenerations.length = chunkFrameIndex;
      genCounter = bufferedState.generation;
      latestRecordedGeneration = genCounter;
      const encoder = device.createCommandEncoder({label: GPU_LABELS.recordingRestoreCopyEncoder});
      encoder.copyBufferToBuffer(chunkGpuBuffer!, target.frameInChunk * frameByteSize, activeGridBuffer, 0, frameByteSize);
      device.queue.submit([encoder.finish()]);
    } else {
      if (inflightSeals > 0) {
        await waitForInflightSeals();
        sealedCount = countFrames(sealedChunks);
      }
      const chunk = sealedChunks[target.sealedIndex]!;
      const chunkData = await readChunkFromOpfs(chunk.filename, chunk.codec);
      const grid = currentGridSize();
      const storedChunkFormat = gridFormatFromMetadata(chunk.gridFormat);
      const restoredPrefix = buildStepBackPrefix(chunkData, target.frameInChunk, frameByteSize, grid, storedChunkFormat, gridFormat);
      device.queue.writeBuffer(chunkGpuBuffer!, 0, restoredPrefix.chunkPrefix);
      if (!restoredPrefix.sameFormat && restoredPrefix.activeFrame) {
        device.queue.writeBuffer(activeGridBuffer, 0, restoredPrefix.activeFrame);
      }
      chunkFrameIndex = target.frameInChunk + 1;
      chunkGenerations = chunk.generations.slice(0, target.frameInChunk + 1);
      genCounter = chunkGenerations[target.frameInChunk]!;
      latestRecordedGeneration = genCounter;
      if (restoredPrefix.sameFormat) {
        const encoder = device.createCommandEncoder({label: GPU_LABELS.recordingRestoreCopyEncoder});
        encoder.copyBufferToBuffer(chunkGpuBuffer!, target.frameInChunk * frameByteSize, activeGridBuffer, 0, frameByteSize);
        device.queue.submit([encoder.finish()]);
      }
      const removed = sealedChunks.splice(target.sealedIndex);
      deleteChunksFromOpfs(removed.map(removedChunk => removedChunk.filename));
    }
    updateManifestRange(manifest, sealedChunks, chunkGenerations);
    postStorageQuota();
    resetFps();
    queueMetricsRefresh(true);
    renderFrame();
  }
}

/**
 * Handles one immediate forward simulation step.
 */
function handleSingleStepForward(): void {
  applyPendingBrush();
  captureCurrentGenerationIfNeeded(true);
  const recordingReady = !isRecording || prepareRecordingStep();
  if (recordingReady) {
    stepSimulation();
    stepCount++;
    if (isRecording && canRecordNow()) {
      if (chunkFrameIndex >= chunkFrameCapacity) {
        sealCurrentChunk();
      }
      recordGeneration(genCounter);
    }
    setRunBackpressure(false);
  } else {
    setRunBackpressure(true);
  }
  queueMetricsRefresh(true);
  renderFrame();
}

/**
 * Handles multi-step forward runs by starting a temporary target-generation run.
 *
 * @param {number} count number of generations to advance.
 */
function handleTargetStepForward(count: number): void {
  self.postMessage({type: 'stepping', active: true});
  captureCurrentGenerationIfNeeded(true);
  startRun(runKindForCurrentRecording(), {
    pacing: {kind: 'max'},
    stopCondition: {kind: 'targetGeneration', generation: genCounter + count},
    restoreAfterStop: {running: simulationRunning, targetStepDuration}
  });
}

/**
 * Handles step-forward requests.
 *
 * @param {StepForwardMessage} message step-forward message.
 */
function handleStepForwardMessage(message: StepForwardMessage): void {
  if (message.count === 1) {
    handleSingleStepForward();
  } else {
    handleTargetStepForward(message.count);
  }
}

/**
 * Handles cancellation of an active target-generation run.
 */
function handleCancelSteppingMessage(): void {
  cancelTargetRun(activeRun?.request.restoreAfterStop?.running ?? simulationRunning);
}

/**
 * Handles chunk codec updates from the compression worker.
 *
 * @param {UpdateChunkCodecMessage} message chunk-codec update message.
 */
function handleUpdateChunkCodecMessage(message: UpdateChunkCodecMessage): void {
  const chunk = sealedChunks.find(sealedChunk => sealedChunk.filename === message.filename);
  if (chunk) {
    chunk.codec = message.codec;
    chunk.storedBytes = message.storedBytes;
    chunk.gridFormat = message.gridFormat;
    manifest.chunks = [...sealedChunks];
    postStorageQuota();
    sendRecordingManifest();
  }
}

/**
 * Handles requests for currently uncompressed chunks.
 */
function handleGetUncompressedChunksMessage(): void {
  const rawChunks = sealedChunks.filter(chunk => chunk.codec === RAW_PACKED_CODEC).map(chunk => ({
    filename: chunk.filename,
    rawBytes: chunk.uncompressedBytes,
    blockCount: chunk.blockCount,
    cols,
    rows,
    rawGridFormat: chunk.gridFormat,
    storageGridFormat: gridFormatMetadata(chooseTightStorageGridFormat(ruleset.tribes.length))
  }));
  self.postMessage({type: 'uncompressedChunks', chunks: rawChunks});
}

/**
 * Dispatches one incoming worker message to its concrete handler.
 *
 * @param {WorkerMessage} message incoming worker message.
 */
async function handleWorkerMessage(message: WorkerMessage): Promise<void> {
  switch (message.type) {
    case 'init':
      await handleInitMessage(message);
      break;
    case 'setLiveMetrics':
      handleSetLiveMetricsMessage(message);
      break;
    case 'setRuleset':
      await handleSetRulesetMessage(message);
      break;
    case 'setRunning':
      handleSetRunningMessage(message);
      break;
    case 'setSpeed':
      handleSetSpeedMessage(message);
      break;
    case 'camera':
      handleCameraMessage(message);
      break;
    case 'resize':
      handleResizeMessage(message);
      break;
    case 'draw':
      handleDrawMessage(message);
      break;
    case 'brushPreview':
      handleBrushPreviewMessage(message);
      break;
    case 'exportFrameOverlay':
      handleExportFrameOverlayMessage(message);
      break;
    case 'getSnapshot':
      await handleGetSnapshotMessage();
      break;
    case 'loadSnapshot':
      await handleLoadSnapshotMessage(message);
      break;
    case 'setRecording':
      handleSetRecordingMessage(message);
      break;
    case 'getRecording':
      await handleGetRecordingMessage();
      break;
    case 'stepBack':
      await handleStepBackMessage(message);
      break;
    case 'stepForward':
      handleStepForwardMessage(message);
      break;
    case 'cancelStepping':
      handleCancelSteppingMessage();
      break;
    case 'updateChunkCodec':
      handleUpdateChunkCodecMessage(message);
      break;
    case 'getUncompressedChunks':
      handleGetUncompressedChunksMessage();
      break;
  }
}

/**
 * Worker entrypoint for simulation logic and recording.
 * 
 * @param {MessageEvent<WorkerMessage>} event worker message event.
 */
self.onmessage = async(event: MessageEvent<WorkerMessage>) => {
  await handleWorkerMessage(event.data);
};
