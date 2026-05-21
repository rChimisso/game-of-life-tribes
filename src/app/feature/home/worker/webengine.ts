/**
 * WebGPU Game-of-Life Tribes engine.
 *
 * Runs entirely in a Web Worker on an OffscreenCanvas.
 * - Simulation: compute shader (dynamically generated from the ruleset).
 * - Rendering: full-screen quad reading from the grid storage buffer.
 * - Grid: ping-pong between two storage buffers (A and B).
 * - Cells: u8 tribe IDs packed 4-per-u32 in row-packed storage buffers.
 * - Toroidal: world wraps in both axes.
 */

import {GPU_LABELS} from './gpu-labels';
import {BOUNDARY_BUFFER_SIZE, buildInteractiveMetricMessage, createInteractiveMetricsResources, destroyInteractiveMetricsResources, encodeInteractiveMetrics, HISTOGRAM_BUFFER_SIZE, readInteractiveMetrics} from './metrics/metrics-current';
import {activeInteractiveMetricSections, planInteractiveMetricAvailability} from './metrics/metrics-planner';
import {InteractiveMetricSection, InteractiveMetricsResources} from './metrics/metrics-types';
import renderWgsl from './render.wgsl';
import {GridFormat, GridFormatMetadata, GRID_FORMAT_8} from '../model/grid-format';
import {DEFAULT_LIVE_METRICS_SETTINGS, LiveMetricsSettings} from '../model/metrics';
import {ChunkMeta, RecordingManifest} from '../model/recording';
import {RECORDING_MAX_FRAME_BYTES} from '../model/recording-limits';
import {AND_CLAUSE_KIND, ANY_TRIBE_ID, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Ruleset, Tribe, XOR_CLAUSE_KIND} from '../model/rule';
import {BackpressureMessage, ChunksSavingMessage, ChunkSealedMessage, GenerationMessage, LimitsMessage, RebuildingMessage, RecordingMessage, SnapshotMessage, SteppingMessage, WorkerMessage} from '../model/worker-message';
import {chooseTightStorageGridFormat, fitsGridFormatInMaxBytes, gridByteSize, gridFormatFromBits, gridFormatFromMetadata, gridFormatMetadata, isSupportedBitsPerCell, packFrameToWords, packedColsForFormat, smallestValidSimulationGridFormat, unpackPackedBytesToFrame, unpackWordsToFrame, validatePackingAgainstStateCount} from '../util/grid-format';
import {normalizeLiveMetricsSettings} from '../util/metric-settings';

// ---------------------------------------------------------------------------
//  WebGPU state
// ---------------------------------------------------------------------------

let device: GPUDevice;
let deviceLost = false;
let context: GPUCanvasContext;
let canvasFormat: GPUTextureFormat;
let canvas: OffscreenCanvas;

// Grid data
let ruleset: Ruleset<readonly Tribe[]>;
let cols = 0;
let rows = 0;
let packedCols = 0; // Ceil(cols / cellsPerWord) — u32 words per row in packed grid
let gridFormat: GridFormat = GRID_FORMAT_8;
let tribes: Tribe[] = [];
const tribeIndex = new Map<string, number>();

interface DispatchPlan2D {
  logicalWgX: number;
  logicalWgY: number;
  dispatchWgX: number;
  dispatchWgY: number;
  remapped: boolean;
}

let simulationDispatchPlan: DispatchPlan2D;
let metricsDispatchPlan: DispatchPlan2D;

// GPU buffers
let gridBufferA: GPUBuffer;
let gridBufferB: GPUBuffer;
let uniformBuffer: GPUBuffer;
let tribeColorBuffer: GPUBuffer;

// Pipelines
let renderPipeline: GPURenderPipeline;
let renderBindGroupA: GPUBindGroup;
let renderBindGroupB: GPUBindGroup;
let computePipeline: GPUComputePipeline;
let computeBindGroupAtoB: GPUBindGroup;
let computeBindGroupBtoA: GPUBindGroup;

// Ping-pong state: false = A is current, true = B is current.
let pingPong = false;

// Camera
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Timing
let simulationRunning = false;
let rebuilding = false;
let targetStepDuration = 100;
let genCounter = 0;

// Brush compute pipeline
let brushPipeline: GPUComputePipeline;
let brushUniformBuffer: GPUBuffer;
let brushBindGroupA: GPUBindGroup;
let brushBindGroupB: GPUBindGroup;
let brushSeedCounter = 0;

// Pending brush (coalesced per frame)
let pendingBrush: {centerX: number; centerY: number; brushSize: number; shape: number; fill: number; tribeIds: number[]} | null = null;

// Metrics: GPU histogram + boundary
let metricsResources: InteractiveMetricsResources | null = null;
let lastMetricsGen = -1;
let metricsInFlight = false;
let pendingMetricsRetry = false;
let lastMetricsTime = 0;
let liveMetrics: LiveMetricsSettings = DEFAULT_LIVE_METRICS_SETTINGS;
let lastEncodedMetricSections: InteractiveMetricSection[] = [];

// Recording state
let isRecording = false;
let recordingAwaitingForward = false;
let manifest: RecordingManifest = {
  chunks: [],
  generationStart: 0,
  generationEnd: 0,
  gridFormat: gridFormatMetadata(GRID_FORMAT_8)
};
let nextChunkId = 0;
let sealedChunks: ChunkMeta[] = [];

type RunStopCondition = {kind: 'none'} | {kind: 'targetGeneration'; generation: number};
type RunPacing = {kind: 'max'} | {kind: 'fixedGenPerSecond'; genPerSecond: number};
type RunKind = 'nonRecording' | 'recording';
type RunStopReason = 'manual' | 'targetReached' | 'cancelled' | 'restart' | 'rebuild' | 'deviceLost' | 'error';

interface RunRequest {
  pacing: RunPacing;
  stopCondition: RunStopCondition;
  restoreAfterStop?: {
    running: boolean;
    targetStepDuration: number;
  };
}

interface RunState {
  kind: RunKind;
  request: RunRequest;
  token: number;
  pumpPending: boolean;
  lastFrameTime: number;
  stepAccumulator: number;
  lastProgressTime: number;
}

let activeRun: RunState | null = null;
let nextRunToken = 0;
let gpuCatchUpPending = false; // Prevents rendering while GPU drains after max speed.

// GPU chunk accumulation
let chunkGpuBuffer: GPUBuffer | null = null;
let chunkFrameIndex = 0;
let chunkGenerations: number[] = [];
let chunkFrameCapacity = 64;
let frameByteSize = 0;

// Staging ring for async readback of sealed chunks
const STAGING_RING_SIZE = 3;
let stagingRing: GPUBuffer[] = [];
let stagingAvailable: boolean[] = [];

// OPFS persistence state
const OPFS_DIR = 'gol-recording';
const RAW_PACKED_CODEC = 'raw-packed';
const RAW_DEFLATE_CODEC = 'deflate-raw';
let opfsDirHandle: FileSystemDirectoryHandle | null = null;
let opfsResetPromise: Promise<void> | null = null;
let inflightSeals = 0;
let pendingOpfsWrites = 0;
const MAX_PENDING_OPFS_WRITES = 12;
let backpressureActive = false;
let sealEpoch = 0; // Incremented on rebuild; stale callbacks silently bail.

const MAX_TRIBES = 256;
const TRIBE_COLOR_BUFFER_SIZE = MAX_TRIBES * Uint32Array.BYTES_PER_ELEMENT;

// Chunk + staging buffer cap (each buffer) for normal multi-frame chunks.
// Frames at or above this size fall back to single-frame chunks up to RECORDING_MAX_FRAME_BYTES.
const CHUNK_BUFFER_CAP = 256 * 1024 * 1024; // 256 MB
const OPFS_PENDING_WRITE_BYTE_BUDGET = 512 * 1024 * 1024; // 512 MB

// Yield between major rebuild allocations so the browser can catch up.
const MAJOR_BUFFER_ALLOCATION_YIELD_BYTES = 512 * 1024 * 1024; // 512 MB

// Storage cap for OPFS
const STORAGE_CAP = 128 * 1024 * 1024 * 1024; // 128 GB

let rebuildAllocatedBytesSinceYield = 0;
let rebuildMajorAllocationsRemaining = 0;
let rebuildPendingAllocationBuffers: GPUBuffer[] = [];

function workerErrorReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return String(error ?? 'Unknown worker error');
}

function reportWorkerError(error: unknown): void {
  console.error('[GOLT worker] Worker GPU error:', error);
  stopRun('error', {
    render: false, postStepping: false, restore: false, restartRestoredRun: false
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

async function waitForGpuQueueIdle(): Promise<void> {
  await device.queue.onSubmittedWorkDone();
}

function resetRebuildAllocationTracking(includeRecordingBuffers: boolean): void {
  rebuildAllocatedBytesSinceYield = 0;
  rebuildMajorAllocationsRemaining = 2 + (includeRecordingBuffers ? 1 + STAGING_RING_SIZE : 0);
  rebuildPendingAllocationBuffers = [];
}

async function waitForTrackedBufferAllocations(): Promise<void> {
  if (rebuildPendingAllocationBuffers.length === 0) {
    return;
  }
  const encoder = device.createCommandEncoder({label: GPU_LABELS.trackedAllocationClearEncoder});
  for (const buffer of rebuildPendingAllocationBuffers) {
    encoder.clearBuffer(buffer);
  }
  device.queue.submit([encoder.finish()]);
  await waitForGpuQueueIdle();
  rebuildPendingAllocationBuffers = [];
}

async function trackMajorBufferAllocation(byteSize: number, buffer: GPUBuffer): Promise<void> {
  if (!rebuilding || rebuildMajorAllocationsRemaining <= 0) {
    return;
  }
  rebuildAllocatedBytesSinceYield += byteSize;
  rebuildMajorAllocationsRemaining--;
  rebuildPendingAllocationBuffers.push(buffer);
  if (rebuildAllocatedBytesSinceYield >= majorBufferAllocationYieldBytes() && rebuildMajorAllocationsRemaining > 0) {
    await waitForTrackedBufferAllocations();
    rebuildAllocatedBytesSinceYield = 0;
  }
}

function majorBufferAllocationYieldBytes(): number {
  return Math.min(maxSimulationBufferBytes(), MAJOR_BUFFER_ALLOCATION_YIELD_BYTES);
}

function maxSimulationBufferBytes(): number {
  return Math.min(device.limits.maxBufferSize, device.limits.maxStorageBufferBindingSize);
}

function maxRecordingBufferBytes(): number {
  return Math.min(maxSimulationBufferBytes(), RECORDING_MAX_FRAME_BYTES);
}

function vramBudgetBytes(): number {
  return Math.max(maxSimulationBufferBytes() * 2, maxRecordingBufferBytes() * 6);
}

function recordingAvailableForCurrentFrame(): boolean {
  return frameByteSize > 0 && frameByteSize <= maxRecordingBufferBytes();
}

function simulationBufferBytes(): number {
  if (frameByteSize <= 0) {
    return 0;
  }
  return frameByteSize * 2 +
    UNIFORM_SIZE +
    TRIBE_COLOR_BUFFER_SIZE +
    BRUSH_UNIFORM_SIZE +
    HISTOGRAM_BUFFER_SIZE * 2 +
    BOUNDARY_BUFFER_SIZE * 2;
}

function recordingBufferBytes(): number {
  if (chunkFrameCapacity < 1 || frameByteSize <= 0) {
    return 0;
  }
  const chunkBytes = chunkFrameCapacity * frameByteSize;
  return chunkBytes * (1 + STAGING_RING_SIZE);
}

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
}

function destroyRebuildableBuffers(): void {
  gridBufferA?.destroy();
  gridBufferB?.destroy();
  destroyInteractiveMetricsResources(metricsResources);
  metricsResources = null;
  brushUniformBuffer?.destroy();
  destroyRecordingBuffers();
}

function updateInflightSeals(delta: number): void {
  const wasSaving = inflightSeals > 0;
  inflightSeals += delta;
  const isSaving = inflightSeals > 0;
  if (wasSaving !== isSaving) {
    self.postMessage({type: 'chunksSaving', active: isSaving});
  }
}

function checkBackpressure(): void {
  if (chunkFrameCapacity < 1 || stagingRing.length === 0) {
    if (backpressureActive) {
      backpressureActive = false;
      self.postMessage({type: 'backpressure', active: false});
    }
    return;
  }
  const maxPendingWrites = maxPendingOpfsWritesForCurrentChunk();
  const stagingFull = !stagingAvailable.some(v => v) && chunkFrameIndex >= chunkFrameCapacity;
  const opfsFull = pendingOpfsWrites >= maxPendingWrites;
  let pressure: boolean;
  if (backpressureActive) {
    // Hysteresis: deactivate only when well below thresholds.
    const stagingOk = stagingAvailable.some(v => v);
    const opfsOk = pendingOpfsWrites <= Math.floor(maxPendingWrites / 2);
    pressure = !(stagingOk && opfsOk);
  } else {
    pressure = stagingFull || opfsFull;
  }
  if (pressure !== backpressureActive) {
    backpressureActive = pressure;
    self.postMessage({type: 'backpressure', active: pressure});
  }
}

async function postStorageQuota(): Promise<void> {
  const estimate = await navigator.storage.estimate();
  const quotaBytes = Math.min(estimate.quota ?? STORAGE_CAP / 128, STORAGE_CAP);
  const usedBytes = estimate.usage ?? 0;
  let pendingRawBytes = 0;
  let compressedBytes = 0;
  for (const c of sealedChunks) {
    if (c.codec === RAW_PACKED_CODEC) {
      pendingRawBytes += c.storedBytes;
    } else {
      compressedBytes += c.storedBytes;
    }
  }
  // Worst-case bytes in GPU buffers not yet written to OPFS:
  // 1 chunk buffer being filled + STAGING_RING_SIZE staging buffers in flight.
  const chunkCapBytes = chunkFrameCapacity * frameByteSize;
  const gpuBufferMarginBytes = isRecording ? (1 + STAGING_RING_SIZE) * chunkCapBytes : 0;
  self.postMessage({
    type: 'storageQuota',
    usedBytes,
    quotaBytes,
    pendingRawBytes,
    compressedBytes,
    gpuBufferMarginBytes
  });
}

let getRecordingPending = false;

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

// FPS tracking
let stepCount = 0;
let lastFpsTime = 0;
let currentFps = 0;

function plan2DDispatch(logicalWgX: number, logicalWgY: number, limit = device.limits.maxComputeWorkgroupsPerDimension): DispatchPlan2D {
  if (logicalWgX <= limit && logicalWgY <= limit) {
    return {
      logicalWgX,
      logicalWgY,
      dispatchWgX: logicalWgX,
      dispatchWgY: logicalWgY,
      remapped: false
    };
  }

  const totalLogicalWorkgroups = logicalWgX * logicalWgY;
  const dispatchWgX = Math.min(totalLogicalWorkgroups, limit);
  const dispatchWgY = Math.ceil(totalLogicalWorkgroups / dispatchWgX);

  if (dispatchWgY > limit) {
    throw new Error(`Grid requires ${logicalWgX}x${logicalWgY} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${limit}.`);
  }

  return {
    logicalWgX,
    logicalWgY,
    dispatchWgX,
    dispatchWgY,
    remapped: true
  };
}

function createSimulationDispatchPlan(): DispatchPlan2D {
  return plan2DDispatch(Math.ceil(packedCols / 16), Math.ceil(rows / 16));
}

function createMetricsDispatchPlan(): DispatchPlan2D {
  return plan2DDispatch(Math.ceil(cols / 16), Math.ceil(rows / 16));
}

// ---------------------------------------------------------------------------
//  Compute shader codegen
// ---------------------------------------------------------------------------

function pushDispatchPlanWgslConstants(lines: string[], plan: DispatchPlan2D): void {
  if (!plan.remapped) {
    return;
  }
  lines.push(`const LOGICAL_WG_X: u32 = ${plan.logicalWgX}u;`);
  lines.push(`const DISPATCH_WG_X: u32 = ${plan.dispatchWgX}u;`);
}

function pushGridFormatWgslConstants(lines: string[]): void {
  lines.push(`const CELLS_PER_WORD: u32 = ${gridFormat.cellsPerWord}u;`);
  lines.push(`const WORD_SHIFT: u32 = ${gridFormat.wordShift}u;`);
  lines.push(`const CELL_SHIFT: u32 = ${gridFormat.cellShift}u;`);
  lines.push(`const CELL_INDEX_MASK: u32 = ${gridFormat.cellIndexMask}u;`);
  lines.push(`const CELL_MASK: u32 = ${gridFormat.cellMask}u;`);
}

function pushReadCellWgsl(lines: string[], storageVar: string, packedColsExpr: string): void {
  lines.push('fn readCell(x: u32, y: u32) -> u32 {');
  lines.push(`  let wordIdx = y * ${packedColsExpr} + (x >> WORD_SHIFT);`);
  lines.push('  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;');
  lines.push(`  return (${storageVar}[wordIdx] >> shift) & CELL_MASK;`);
  lines.push('}');
}

function pushLogicalInvocation2DWgsl(lines: string[], plan: DispatchPlan2D, xName: string): void {
  if (plan.remapped) {
    lines.push('  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;');
    lines.push('  let logicalWgX = flatWg % LOGICAL_WG_X;');
    lines.push('  let logicalWgY = flatWg / LOGICAL_WG_X;');
    lines.push('');
    lines.push(`  let ${xName} = logicalWgX * 16u + local_invocation_id.x;`);
    lines.push('  let y = logicalWgY * 16u + local_invocation_id.y;');
    return;
  }

  lines.push(`  let ${xName} = gid.x;`);
  lines.push('  let y = gid.y;');
}

function generateComputeWgsl(): string {
  const lines: string[] = [];
  const pc = packedCols;
  const dispatchPlan = simulationDispatchPlan;

  lines.push('// Auto-generated simulation compute shader.');
  lines.push(`// Tribes: ${tribes.map(t => t.id).join(', ')}`);
  lines.push(`// Rules: ${ruleset.rules.length}`);
  lines.push('');
  lines.push('@group(0) @binding(0) var<storage, read> gridIn: array<u32>;');
  lines.push('@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;');
  lines.push('');
  lines.push(`const COLS: u32 = ${ cols }u;`);
  lines.push(`const ROWS: u32 = ${ rows }u;`);
  lines.push(`const PACKED_COLS: u32 = ${ pc }u;`);
  pushDispatchPlanWgslConstants(lines, dispatchPlan);
  pushGridFormatWgslConstants(lines);
  lines.push('');

  // Helper: read a cell's tribe ID from packed grid.
  pushReadCellWgsl(lines, 'gridIn', 'PACKED_COLS');
  lines.push('');

  // Generate applyRules function containing all rule logic.
  const deadIdx = tribeIndex.get(DEAD_TRIBE_ID) ?? 0;
  const activeRules = ruleset.rules.filter(rule => !rule.muted);
  lines.push('fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {');

  // Precompute neighbor count variables for each unique tribe set used in count clauses.
  const countSets = collectCountSets(activeRules.map(r => r.clause));
  const countVarMap = new Map<string, string>();
  let countIdx = 0;
  for (const key of countSets) {
    const varName = `count_${ countIdx++}`;
    countVarMap.set(key, varName);
  }

  for (const [key, varName] of countVarMap) {
    const tribeIds = key.split(',').map(Number);
    const neighbors = getNeighborVarNames();
    const checks = neighbors.map(n => {
      const conditions = tribeIds.map(id => `${n } == ${ id }u`);
      return `select(0u, 1u, ${ conditions.join(' || ') })`;
    });
    lines.push(`  let ${ varName } = ${ checks.join(' + ') };`);
  }
  if (countSets.size > 0) {
    lines.push('');
  }

  // Precompute equality group counts.
  const equalitySets = collectEqualitySets(activeRules.map(r => r.clause));
  const eqVarMap = new Map<string, string>();
  let eqIdx = 0;
  for (const key of equalitySets) {
    if (countVarMap.has(key)) {
      eqVarMap.set(key, countVarMap.get(key)!);
    } else {
      const varName = `eq_count_${ eqIdx++}`;
      eqVarMap.set(key, varName);
    }
  }
  for (const [key, varName] of eqVarMap) {
    if (countVarMap.has(key)) {
      continue;
    }
    const tribeIds = key.split(',').map(Number);
    const neighbors = getNeighborVarNames();
    const checks = neighbors.map(n => {
      const conditions = tribeIds.map(id => `${n } == ${ id }u`);
      return `select(0u, 1u, ${ conditions.join(' || ') })`;
    });
    lines.push(`  let ${ varName } = ${ checks.join(' + ') };`);
  }
  if (equalitySets.size > 0 && eqIdx > 0) {
    lines.push('');
  }

  // Default: dead tribe.
  lines.push(`  var result: u32 = ${ deadIdx }u;`);
  lines.push('');

  // Rule chain: first matching rule wins.
  for (let ri = 0; ri < activeRules.length; ri++) {
    const rule = activeRules[ri]!;
    const condExpr = generateClauseExpr(rule.clause, countVarMap, eqVarMap);
    const targetIdx = resolveTribeTarget(rule.tribe);
    if (ri === 0) {
      lines.push(`  if (${ condExpr }) {`);
    } else {
      lines.push(`  } else if (${ condExpr }) {`);
    }
    lines.push(`    result = ${ targetIdx }u;`);
  }
  if (activeRules.length > 0) {
    lines.push('  }');
  }
  lines.push('');
  lines.push('  return result;');
  lines.push('}');
  lines.push('');

  // Main compute function: each thread processes one packed u32 word.
  lines.push('@compute @workgroup_size(16, 16)');
  if (dispatchPlan.remapped) {
    lines.push('fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {');
  } else {
    lines.push('fn main(@builtin(global_invocation_id) gid: vec3u) {');
  }
  pushLogicalInvocation2DWgsl(lines, dispatchPlan, 'px');
  lines.push('  if (px >= PACKED_COLS || y >= ROWS) { return; }');
  lines.push('');
  lines.push('  let baseX = px << WORD_SHIFT;');
  lines.push('  var packed: u32 = 0u;');
  lines.push('');
  lines.push('  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {');
  lines.push('    let x = baseX + i;');
  lines.push('    if (x >= COLS) { break; }');
  lines.push('');
  lines.push('    let selfTribe = readCell(x, y);');

  // Read 8 neighbors using readCell(wrappedX, wrappedY).
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const name = neighborVarName(dx, dy);
      const xExpr = wrapExpr('x', dx, 'COLS');
      const yExpr = wrapExpr('y', dy, 'ROWS');
      lines.push(`    let ${ name } = readCell(${ xExpr }, ${ yExpr });`);
    }
  }
  lines.push('');
  lines.push('    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));');
  lines.push('  }');
  lines.push('');
  lines.push('  gridOut[y * PACKED_COLS + px] = packed;');
  lines.push('}');

  return lines.join('\n');
}

function neighborVarName(dx: number, dy: number): string {
  let xName = 'C';
  if (dx === -1) {
    xName = 'L';
  } else if (dx === 1) {
    xName = 'R';
  }

  let yName = 'C';
  if (dy === -1) {
    yName = 'T';
  } else if (dy === 1) {
    yName = 'B';
  }

  return `n${ yName }${xName}`;
}

function getNeighborVarNames(): string[] {
  const names: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      names.push(neighborVarName(dx, dy));
    }
  }
  return names;
}

function wrapExpr(varName: string, delta: number, limit: string): string {
  if (delta === 0) {
    return varName;
  }
  if (delta === -1) {
    return `(${ varName } + ${ limit } - 1u) % ${ limit}`;
  }
  return `(${ varName } + 1u) % ${ limit}`;
}

function resolveTribeIds(tribeNames: string[]): number[] {
  const ids: number[] = [];
  for (const name of tribeNames) {
    if (name === ANY_TRIBE_ID) {
      for (let i = 0; i < tribes.length; i++) {
        ids.push(i);
      }
    } else {
      const idx = tribeIndex.get(name);
      if (idx !== undefined) {
        ids.push(idx);
      }
    }
  }
  return [...new Set(ids)];
}

function resolveTribeTarget(tribeName: string): number {
  if (tribeName === ANY_TRIBE_ID) {
    return 0;
  }
  return tribeIndex.get(tribeName) ?? 0;
}

function collectCountSets(clauses: Clause<Tribe[]>[]): Set<string> {
  const result = new Set<string>();
  for (const c of clauses) {
    collectCountSetsRec(c, result);
  }
  return result;
}

function collectCountSetsRec(c: Clause<Tribe[]>, result: Set<string>): void {
  switch (c.kind) {
    case EMPTY_CLAUSE_KIND:
    case IS_CLAUSE_KIND:
      break;
    case NONE_CLAUSE_KIND:
    case EXACTLY_CLAUSE_KIND:
    case MIN_CLAUSE_KIND:
    case MAX_CLAUSE_KIND:
    case COUNT_CLAUSE_KIND: {
      const ids = resolveTribeIds(c.tribes as string[]).sort();
      result.add(ids.join(','));
      break;
    }
    case NOT_CLAUSE_KIND:
      collectCountSetsRec(c.clause, result);
      break;
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND:
      for (const sub of c.clauses) {
        collectCountSetsRec(sub, result);
      }
      break;
  }
}

function collectEqualitySets(clauses: Clause<Tribe[]>[]): Set<string> {
  const result = new Set<string>();
  for (const c of clauses) {
    collectEqualitySetsRec(c, result);
  }
  return result;
}

function collectEqualitySetsRec(c: Clause<Tribe[]>, result: Set<string>): void {
  switch (c.kind) {
    case EMPTY_CLAUSE_KIND:
    case IS_CLAUSE_KIND:
    case COUNT_CLAUSE_KIND:
    case NONE_CLAUSE_KIND:
    case EXACTLY_CLAUSE_KIND:
    case MIN_CLAUSE_KIND:
    case MAX_CLAUSE_KIND:
      break;
    case COMPARISON_CLAUSE_KIND: {
      const ids1 = resolveTribeIds(c.tribe1 as string[]).sort();
      const ids2 = resolveTribeIds(c.tribe2 as string[]).sort();
      result.add(ids1.join(','));
      result.add(ids2.join(','));
      break;
    }
    case NOT_CLAUSE_KIND:
      collectEqualitySetsRec(c.clause, result);
      break;
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND:
      for (const sub of c.clauses) {
        collectEqualitySetsRec(sub, result);
      }
      break;
  }
}

function generateClauseExpr(
  c: Clause<Tribe[]>,
  countVarMap: Map<string, string>,
  eqVarMap: Map<string, string>,
): string {
  switch (c.kind) {
    case EMPTY_CLAUSE_KIND:
      return 'false';
    case IS_CLAUSE_KIND: {
      const ids = resolveTribeIds(c.tribes as string[]);
      if (ids.length === 0) {
        return 'false';
      }
      if (ids.length === tribes.length) {
        return 'true';
      }
      const checks = ids.map(id => `selfTribe == ${ id }u`);
      return `(${ checks.join(' || ') })`;
    }
    case COUNT_CLAUSE_KIND: {
      const ids = resolveTribeIds(c.tribes as string[]).sort();
      const varName = countVarMap.get(ids.join(','))!;
      return `(${ varName } >= ${ c.interval[0] }u && ${ varName } <= ${ c.interval[1] }u)`;
    }
    case NONE_CLAUSE_KIND: {
      const ids = resolveTribeIds(c.tribes as string[]).sort();
      const varName = countVarMap.get(ids.join(','))!;
      return `(${ varName } >= 0u && ${ varName } <= 0u)`;
    }
    case EXACTLY_CLAUSE_KIND: {
      const ids = resolveTribeIds(c.tribes as string[]).sort();
      const varName = countVarMap.get(ids.join(','))!;
      return `(${ varName } >= ${ c.value }u && ${ varName } <= ${ c.value }u)`;
    }
    case MIN_CLAUSE_KIND: {
      const ids = resolveTribeIds(c.tribes as string[]).sort();
      const varName = countVarMap.get(ids.join(','))!;
      return `(${ varName } >= ${ c.value }u && ${ varName } <= 8u)`;
    }
    case MAX_CLAUSE_KIND: {
      const ids = resolveTribeIds(c.tribes as string[]).sort();
      const varName = countVarMap.get(ids.join(','))!;
      return `(${ varName } >= 0u && ${ varName } <= ${ c.value }u)`;
    }
    case COMPARISON_CLAUSE_KIND: {
      const var1 = eqVarMap.get(resolveTribeIds(c.tribe1 as string[]).sort().join(','))!;
      const margin = Math.max(-8, Math.min(8, c.margin ?? 0));
      const rightExpr = `(i32(${eqVarMap.get(resolveTribeIds(c.tribe2 as string[]).sort().join(','))!}) + ${ margin }i)`;
      switch (c.operator) {
        case '≠':
          return `(i32(${var1}) != ${rightExpr})`;
        case '>':
          return `(i32(${var1}) > ${rightExpr})`;
        case '<':
          return `(i32(${var1}) < ${rightExpr})`;
        case '≥':
          return `(i32(${var1}) >= ${rightExpr})`;
        case '≤':
          return `(i32(${var1}) <= ${rightExpr})`;
        case '=':
        default:
          return `(i32(${var1}) == ${rightExpr})`;
      }
    }
    case NOT_CLAUSE_KIND:
      return `!(${ generateClauseExpr(c.clause, countVarMap, eqVarMap) })`;
    case AND_CLAUSE_KIND: {
      const parts = c.clauses.map(sub => generateClauseExpr(sub, countVarMap, eqVarMap));
      return `(${ parts.join(' && ') })`;
    }
    case OR_CLAUSE_KIND: {
      const parts = c.clauses.map(sub => generateClauseExpr(sub, countVarMap, eqVarMap));
      return `(${ parts.join(' || ') })`;
    }
    case XOR_CLAUSE_KIND: {
      const parts = c.clauses.map(sub => generateClauseExpr(sub, countVarMap, eqVarMap));
      const oddExpr = parts.map(p => `select(0u, 1u, ${ p })`).join(' + ');
      return `(((${ oddExpr }) & 1u) == 1u)`;
    }
    default:
      return 'false';
  }
}

// ---------------------------------------------------------------------------
//  Uniform layout (must match render.wgsl Uniforms struct)
//
//  Offset  0: canvas_size  vec2f    8 bytes
//  Offset  8: scale        f32      4 bytes
//  Offset 12: pad                   4 bytes
//  Offset 16: offset_frac  vec2f    8 bytes
//  Offset 24: grid_size    vec2u    8 bytes
//  Offset 32: offset_cell  vec2u    8 bytes
//  Offset 40: tribe_count  u32      4 bytes
//  Offset 44: pad                   4 bytes
//  Total: 48 bytes
// ---------------------------------------------------------------------------
const UNIFORM_SIZE = 48;

function createUniformBuffer(): void {
  uniformBuffer?.destroy();
  uniformBuffer = device.createBuffer({
    label: GPU_LABELS.uniformBuffer,
    size: UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
}

function writeUniforms(): void {
  const data = new ArrayBuffer(UNIFORM_SIZE);
  const f32 = new Float32Array(data);
  const u32 = new Uint32Array(data);
  const renderOffsetX = ((offsetX % cols) + cols) % cols;
  const renderOffsetY = ((offsetY % rows) + rows) % rows;
  const offsetCellX = Math.floor(renderOffsetX);
  const offsetCellY = Math.floor(renderOffsetY);

  f32[0] = canvas.width;
  f32[1] = canvas.height;
  f32[2] = scale;
  // F32[3] = padding
  f32[4] = renderOffsetX - offsetCellX;
  f32[5] = renderOffsetY - offsetCellY;
  u32[6] = cols;
  u32[7] = rows;
  u32[8] = offsetCellX;
  u32[9] = offsetCellY;
  u32[10] = tribes.length;

  device.queue.writeBuffer(uniformBuffer, 0, data);
}

// ---------------------------------------------------------------------------
//  Buffer management
// ---------------------------------------------------------------------------

function gridBufferSize(): number {
  return gridByteSize({cols, rows}, gridFormat);
}

function currentGridFormatMetadata(): GridFormatMetadata {
  return gridFormatMetadata(gridFormat);
}

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

  // Dead tribe always maps to index 0 → packed representation is all-zero.
  // GPU clearBuffer zeroes the buffers with no JS heap allocation.
  const enc = device.createCommandEncoder({label: GPU_LABELS.gridClearEncoder});
  enc.clearBuffer(gridBufferA);
  enc.clearBuffer(gridBufferB);
  device.queue.submit([enc.finish()]);

  pingPong = false;
}

function createTribeColorBuffer(): void {
  const data = new Uint32Array(MAX_TRIBES);
  for (let i = 0; i < tribes.length; i++) {
    const hex = tribes[i]!.color;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    data[i] = r | (g << 8) | (b << 16);
  }

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

function generateRenderWgsl(): string {
  return renderWgsl
    .replace('__CELLS_PER_WORD__', `${gridFormat.cellsPerWord}u`)
    .replace('__WORD_SHIFT__', `${gridFormat.wordShift}u`)
    .replace('__CELL_SHIFT__', `${gridFormat.cellShift}u`)
    .replace('__CELL_INDEX_MASK__', `${gridFormat.cellIndexMask}u`)
    .replace('__CELL_MASK__', `${gridFormat.cellMask}u`);
}

// ---------------------------------------------------------------------------
//  Pipeline creation
// ---------------------------------------------------------------------------

function createRenderPipeline(): void {
  const module = device.createShaderModule({label: GPU_LABELS.renderShaderModule, code: generateRenderWgsl()});

  renderPipeline = device.createRenderPipeline({
    label: GPU_LABELS.renderPipeline,
    layout: 'auto',
    vertex: {module, entryPoint: 'vs_main'},
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

function createComputePipeline(): void {
  simulationDispatchPlan = createSimulationDispatchPlan();
  const wgsl = generateComputeWgsl();
  const module = device.createShaderModule({label: GPU_LABELS.simulationShaderModule, code: wgsl});

  computePipeline = device.createComputePipeline({
    label: GPU_LABELS.simulationPipeline,
    layout: 'auto',
    compute: {module, entryPoint: 'main'}
  });

  computeBindGroupAtoB = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [{binding: 0, resource: {buffer: gridBufferA} }, {binding: 1, resource: {buffer: gridBufferB} }]
  });

  computeBindGroupBtoA = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [{binding: 0, resource: {buffer: gridBufferB} }, {binding: 1, resource: {buffer: gridBufferA} }]
  });
}

// ---------------------------------------------------------------------------
//  Metrics compute pipelines (histogram + boundary)
// ---------------------------------------------------------------------------

function createMetricsPipelines(): void {
  metricsDispatchPlan = createMetricsDispatchPlan();
  metricsResources = createInteractiveMetricsResources({
    device,
    cols,
    rows,
    gridFormat,
    dispatchPlan: metricsDispatchPlan
  });
}

// ---------------------------------------------------------------------------
//  Brush compute shader
// ---------------------------------------------------------------------------

//  BrushParams uniform layout (10 × u32 = 40 bytes):
//    0: centerX (i32)    4: centerY (i32)
//    8: cols    (u32)   12: rows    (u32)
//   16: brushSize (u32) 20: shape   (u32)
//   24: fill    (u32)   28: tribeId (u32)
//   32: deadId  (u32)   36: seed    (u32)
const BRUSH_UNIFORM_SIZE = 176; // 44 bytes header + 32*4 = 128 bytes tribe array = 172, rounded to 176

function generateBrushWgsl(): string {
  return `
struct BrushParams {
  centerX: i32,
  centerY: i32,
  cols: u32,
  rows: u32,
  brushSize: u32,
  shape: u32,      // 0=square 1=round 2=diamond 3=vline, 4=hline
  fill: u32,        // 0=full 1=spray 2=outline
  deadId: u32,
  seed: u32,
  tribeCount: u32,
  pad: u32,
  tribeIds: array<u32, 32>,
}

@group(0) @binding(0) var<storage, read_write> grid: array<atomic<u32>>;
@group(0) @binding(1) var<uniform> params: BrushParams;

const CELLS_PER_WORD: u32 = ${gridFormat.cellsPerWord}u;
const WORD_SHIFT: u32 = ${gridFormat.wordShift}u;
const CELL_SHIFT: u32 = ${gridFormat.cellShift}u;
const CELL_INDEX_MASK: u32 = ${gridFormat.cellIndexMask}u;
const CELL_MASK: u32 = ${gridFormat.cellMask}u;

fn pcg(inp: u32) -> u32 {
  var state = inp * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn writePackedCell(cx: u32, cy: u32, value: u32) {
  let packed_cols = (params.cols + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
  let wordIdx = cy * packed_cols + (cx >> WORD_SHIFT);
  let shift = (cx & CELL_INDEX_MASK) << CELL_SHIFT;
  let mask = CELL_MASK << shift;
  let newBits = (value & CELL_MASK) << shift;
  var old = atomicLoad(&grid[wordIdx]);
  loop {
    let updated = (old & ~mask) | newBits;
    let result = atomicCompareExchangeWeak(&grid[wordIdx], old, updated);
    if (result.exchanged) { break; }
    old = result.old_value;
  }
}

fn inShape(bx: i32, by: i32, size: u32, shape: u32) -> bool {
  if (bx < 0 || by < 0 || bx >= i32(size) || by >= i32(size)) { return false; }
  let hf = f32(size - 1u) / 2.0;
  let fdx = f32(bx) - hf;
  let fdy = f32(by) - hf;
  switch (shape) {
    case 1u: { // round
      let r = f32(size) / 2.0 - 0.25;
      return fdx * fdx + fdy * fdy <= r * r;
    }
    case 2u: { // diamond
      return abs(fdx) + abs(fdy) <= f32(size) / 2.0;
    }
    case 3u: { // vline
      return bx == i32(size - 1u) / 2;
    }
    case 4u: { // hline
      return by == i32(size - 1u) / 2;
    }
    default: { // 0 = square
      return true; // bounds already checked above
    }
  }
}

fn onBorder(bx: i32, by: i32, size: u32, shape: u32) -> bool {
  if (!inShape(bx, by, size, shape)) { return false; }
  return !inShape(bx - 1, by, size, shape)
      || !inShape(bx + 1, by, size, shape)
      || !inShape(bx, by - 1, size, shape)
      || !inShape(bx, by + 1, size, shape);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let bx = i32(gid.x);
  let by = i32(gid.y);
  if (bx >= i32(params.brushSize) || by >= i32(params.brushSize)) { return; }
  let idx = u32(by) * params.brushSize + u32(bx);

  // Shape test.
  if (params.fill == 2u) {
    if (!onBorder(bx, by, params.brushSize, params.shape)) { return; }
  } else {
    if (!inShape(bx, by, params.brushSize, params.shape)) { return; }
  }

  // Toroidal wrapping.
  let half = i32(params.brushSize - 1u) / 2;
  let dx = bx - half;
  let dy = by - half;
  let cx = ((params.centerX + dx) % i32(params.cols) + i32(params.cols)) % i32(params.cols);
  let cy = ((params.centerY + dy) % i32(params.rows) + i32(params.rows)) % i32(params.rows);

  // Pick a random tribe from the list.
  let spatialHash = (u32(cx) * 73856093u) ^ (u32(cy) * 19349663u);
  let h = pcg(params.seed ^ idx ^ spatialHash);
  let selectedTribe = params.tribeIds[h % params.tribeCount];

  // Spray fill: 50% chance to skip/set-dead (use high bits to avoid
  // correlation with tribe selection which uses low bits via modulo).
  if (params.fill == 1u) {
    if (((h >> 16u) & 1u) != 0u) {
      if (selectedTribe != params.deadId) {
        writePackedCell(u32(cx), u32(cy), params.deadId);
      }
      return;
    }
  }

  writePackedCell(u32(cx), u32(cy), selectedTribe);
}
`;
}

function createBrushPipeline(): void {
  const module = device.createShaderModule({label: GPU_LABELS.brushShaderModule, code: generateBrushWgsl()});

  brushPipeline = device.createComputePipeline({
    label: GPU_LABELS.brushPipeline,
    layout: 'auto',
    compute: {module, entryPoint: 'main'}
  });

  brushUniformBuffer?.destroy();
  brushUniformBuffer = device.createBuffer({
    label: GPU_LABELS.brushUniformBuffer,
    size: BRUSH_UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  brushBindGroupA = device.createBindGroup({
    layout: brushPipeline.getBindGroupLayout(0),
    entries: [{binding: 0, resource: {buffer: gridBufferA} }, {binding: 1, resource: {buffer: brushUniformBuffer} }]
  });

  brushBindGroupB = device.createBindGroup({
    layout: brushPipeline.getBindGroupLayout(0),
    entries: [{binding: 0, resource: {buffer: gridBufferB} }, {binding: 1, resource: {buffer: brushUniformBuffer} }]
  });
}

function dispatchBrushOnEncoder(encoder: GPUCommandEncoder, centerX: number, centerY: number, brushSize: number, shape: number, fill: number, tribeIds: number[]): void {
  const deadId = tribeIndex.get(DEAD_TRIBE_ID) ?? 0;
  const seed = brushSeedCounter++;

  const data = new ArrayBuffer(BRUSH_UNIFORM_SIZE);
  const i32View = new Int32Array(data);
  const u32View = new Uint32Array(data);
  i32View[0] = centerX;
  i32View[1] = centerY;
  u32View[2] = cols;
  u32View[3] = rows;
  u32View[4] = brushSize;
  u32View[5] = shape;
  u32View[6] = fill;
  u32View[7] = deadId;
  u32View[8] = seed;
  u32View[9] = tribeIds.length;
  u32View[10] = 0; // Pad
  for (let i = 0; i < tribeIds.length && i < 32; i++) {
    u32View[11 + i] = tribeIds[i]!;
  }

  device.queue.writeBuffer(brushUniformBuffer, 0, data);

  const wgBrush = Math.ceil(brushSize / 8);
  const pass = encoder.beginComputePass({label: GPU_LABELS.brushPass});
  pass.setPipeline(brushPipeline);
  pass.setBindGroup(0, pingPong ? brushBindGroupB : brushBindGroupA);
  pass.dispatchWorkgroups(wgBrush, wgBrush);
  pass.end();
}

// ---------------------------------------------------------------------------
//  Pack / unpack helpers
// ---------------------------------------------------------------------------

function readbackGrid(): Promise<Uint32Array> {
  const currentGrid = pingPong ? gridBufferB : gridBufferA;
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
  encoder.copyBufferToBuffer(currentGrid, 0, readBuffer, 0, byteSize);
  device.queue.submit([encoder.finish()]);

  return readBuffer.mapAsync(GPUMapMode.READ).then(() => {
    const copy = new Uint32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();
    readBuffer.destroy();
    return copy;
  });
}

// ---------------------------------------------------------------------------
//  GPU chunk recording + staging + OPFS persistence
// ---------------------------------------------------------------------------

function computeChunkCapacity(): void {
  frameByteSize = gridBufferSize();
  if (!recordingAvailableForCurrentFrame()) {
    chunkFrameCapacity = 0;
    return;
  }
  const maxChunkBytes = targetChunkBytes();
  chunkFrameCapacity = Math.max(1, Math.floor(maxChunkBytes / frameByteSize));
}

function targetChunkBytes(): number {
  if (frameByteSize >= CHUNK_BUFFER_CAP) {
    return frameByteSize;
  }
  return Math.min(Math.max(CHUNK_BUFFER_CAP, frameByteSize), maxRecordingBufferBytes());
}

function maxPendingOpfsWritesForCurrentChunk(): number {
  if (chunkFrameCapacity < 1 || frameByteSize <= 0) {
    return MAX_PENDING_OPFS_WRITES;
  }
  const estimatedChunkBytes = Math.max(frameByteSize, chunkFrameCapacity * frameByteSize);
  const budgetLimited = Math.floor(OPFS_PENDING_WRITE_BYTE_BUDGET / estimatedChunkBytes);
  return Math.max(1, Math.min(MAX_PENDING_OPFS_WRITES, budgetLimited || 1));
}

function postRecordingLimits(): void {
  const recordingAvailable = recordingAvailableForCurrentFrame();
  self.postMessage({
    type: 'limits',
    maxBytes: maxSimulationBufferBytes(),
    vramBudgetBytes: vramBudgetBytes(),
    frameByteSize,
    recordingAvailable,
    vramSimulationBytes: simulationBufferBytes(),
    vramRecordingBytes: recordingBufferBytes(),
    gridFormat: currentGridFormatMetadata()
  } satisfies LimitsMessage);
}

function canRecord(): boolean {
  if (!recordingAvailableForCurrentFrame()) {
    return false;
  }
  if (chunkFrameCapacity < 1 || chunkGpuBuffer === null || stagingRing.length === 0) {
    return false;
  }
  if (pendingOpfsWrites >= maxPendingOpfsWritesForCurrentChunk()) {
    return false;
  }
  if (chunkFrameIndex < chunkFrameCapacity) {
    return true;
  }
  // Need to seal — a staging buffer must be truly usable (available AND unmapped).
  return stagingRing.some((buf, i) => stagingAvailable[i] && buf.mapState === 'unmapped');
}

function recordGeneration(gen: number): void {
  if (chunkFrameCapacity < 1 || chunkGpuBuffer === null || chunkFrameIndex >= chunkFrameCapacity) {
    return; // Safety: prevent out-of-bounds GPU copy
  }
  const currentGrid = pingPong ? gridBufferB : gridBufferA;
  const offset = chunkFrameIndex * frameByteSize;
  const enc = device.createCommandEncoder({label: GPU_LABELS.recordingFrameCopyEncoder});
  enc.copyBufferToBuffer(currentGrid, 0, chunkGpuBuffer, offset, frameByteSize);
  device.queue.submit([enc.finish()]);
  chunkGenerations.push(gen);
  chunkFrameIndex++;
}

function sealCurrentChunk(): void {
  if (chunkGpuBuffer === null || chunkFrameIndex === 0 || stagingRing.length === 0) {
    return;
  }
  const idx = stagingAvailable.indexOf(true);
  if (idx < 0) {
    return;
  }
  stagingAvailable[idx] = false;
  const stagingBuf = stagingRing[idx]!;

  // Safety: never use a staging buffer that is still mapped/pending.
  if (stagingBuf.mapState !== 'unmapped') {
    stagingAvailable[idx] = true;
    return;
  }

  const byteLen = chunkFrameIndex * frameByteSize;

  const chunkId = nextChunkId++;
  const generations = [...chunkGenerations];
  const genStart = generations[0]!;
  const genEnd = generations[generations.length - 1]!;
  const filename = `chunk-${String(chunkId).padStart(6, '0')}.bin`;
  const blockCount = chunkFrameIndex;

  const enc = device.createCommandEncoder({label: GPU_LABELS.recordingSealCopyEncoder});
  enc.copyBufferToBuffer(chunkGpuBuffer, 0, stagingBuf, 0, byteLen);
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
  pendingOpfsWrites++;
  checkBackpressure();

  const epoch = sealEpoch;

  stagingBuf.mapAsync(GPUMapMode.READ).then(async() => {
    const mapped = stagingBuf.getMappedRange();
    const rawPayload = new ArrayBuffer(byteLen);
    new Uint8Array(rawPayload).set(new Uint8Array(mapped, 0, byteLen));
    stagingBuf.unmap();

    // Stale callback after a rebuild — ignore silently.
    if (epoch !== sealEpoch) {
      return;
    }

    // Free staging immediately after data is in RAM.
    stagingAvailable[idx] = true;
    checkBackpressure();

    sealedChunks.push(meta);
    updateManifestRange();

    // Write raw (uncompressed) to OPFS, then notify the main thread so
    // Compress workers can read the chunk from OPFS.
    writeChunkToOpfs(meta, rawPayload).then(() => {
      if (epoch !== sealEpoch) {
        return;
      }
      pendingOpfsWrites--;
      checkBackpressure();
      updateInflightSeals(-1);
      postStorageQuota();

      self.postMessage({
        type: 'chunkSealed',
        filename: meta.filename,
        rawBytes: byteLen,
        blockCount: meta.blockCount,
        cols,
        rows,
        rawGridFormat: meta.gridFormat,
        storageGridFormat: gridFormatMetadata(chooseTightStorageGridFormat(ruleset.tribes.length))
      } satisfies ChunkSealedMessage);

      if (getRecordingPending && inflightSeals === 0) {
        getRecordingPending = false;
        sendRecordingManifest();
      }
    });
  }).catch(() => {
    // MapAsync failed (e.g. device lost / buffer destroyed on rebuild).
    // Stale epoch — just ignore.
    if (epoch !== sealEpoch) {
      return;
    }
    stagingAvailable[idx] = true;
    pendingOpfsWrites--;
    checkBackpressure();
    updateInflightSeals(-1);
  });

  chunkFrameIndex = 0;
  chunkGenerations = [];
}

function updateManifestRange(): void {
  if (sealedChunks.length > 0) {
    manifest.generationStart = sealedChunks[0]!.generationStart;
    manifest.generationEnd = sealedChunks[sealedChunks.length - 1]!.generationEnd;
  }
  if (chunkGenerations.length > 0) {
    if (sealedChunks.length === 0) {
      manifest.generationStart = chunkGenerations[0]!;
    }
    manifest.generationEnd = chunkGenerations[chunkGenerations.length - 1]!;
  }
  manifest.chunks = [...sealedChunks];
}

async function resetRecording(startGen: number): Promise<void> {
  sealEpoch++;
  nextChunkId = 0;
  chunkFrameIndex = 0;
  chunkGenerations = [];
  sealedChunks = [];
  pendingOpfsWrites = 0;
  if (inflightSeals > 0) {
    inflightSeals = 0;
    self.postMessage({type: 'chunksSaving', active: false} satisfies ChunksSavingMessage);
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

async function writeChunkToOpfs(meta: ChunkMeta, payload: ArrayBuffer): Promise<void> {
  const dir = await ensureOpfsDir();
  const file = await dir.getFileHandle(meta.filename, {create: true});
  const writable = await file.createWritable();
  await writable.write(payload);
  await writable.close();
}

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

async function resetOpfsDir(): Promise<void> {
  if (opfsResetPromise) {
    await opfsResetPromise;
    return;
  }

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

function sendRecordingManifest(): void {
  updateManifestRange();
  self.postMessage({
    type: 'recording',
    manifest: {
      chunks: sealedChunks.map(c => ({...c, generations: [...c.generations]})),
      generationStart: manifest.generationStart,
      generationEnd: manifest.generationEnd,
      gridFormat: currentGridFormatMetadata()
    },
    cols,
    rows
  } satisfies RecordingMessage);
}

/**
 * True when the current generation has not yet been recorded.
 */
function needsInitialCapture(): boolean {
  if (chunkFrameIndex > 0) {
    return chunkGenerations[chunkFrameIndex - 1] !== genCounter;
  }
  if (sealedChunks.length > 0) {
    return sealedChunks[sealedChunks.length - 1]!.generationEnd !== genCounter;
  }
  return true;
}

function captureCurrentGenerationIfNeeded(markForwardProgress: boolean = false): void {
  if (!isRecording) {
    return;
  }

  if (markForwardProgress) {
    if (recordingAwaitingForward) {
      if (!canRecord()) {
        return;
      }
      recordingAwaitingForward = false;
    }
  } else if (recordingAwaitingForward) {
    return;
  }

  if (!needsInitialCapture() || !canRecord()) {
    return;
  }
  if (chunkFrameIndex >= chunkFrameCapacity) {
    sealCurrentChunk();
  }
  recordGeneration(genCounter);
}

/**
 * Apply any pending brush draw and re-record the current gen if it was already captured.
 */
function applyPendingBrush(): void {
  if (!pendingBrush) {
    return;
  }
  const b = pendingBrush;
  pendingBrush = null;
  const encoder = device.createCommandEncoder({label: GPU_LABELS.brushEncoder});
  dispatchBrushOnEncoder(encoder, b.centerX, b.centerY, b.brushSize, b.shape, b.fill, b.tribeIds);
  device.queue.submit([encoder.finish()]);

  // If the current generation was already recorded, overwrite the last frame to reflect the draw.
  if (isRecording && chunkFrameIndex > 0 && chunkGenerations[chunkFrameIndex - 1] === genCounter) {
    chunkFrameIndex--;
    chunkGenerations.pop();
    recordGeneration(genCounter);
  }
}

/**
 * Read a chunk from OPFS and decompress if needed.
 *
 * @param filename
 * @param codec
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
 * Helper: compute total recorded frames across sealed chunks and current buffer.
 */
function totalRecordedFrames(): number {
  let count = chunkFrameIndex;
  for (const c of sealedChunks) {
    count += c.blockCount;
  }
  return count;
}

function currentMetricAvailability() {
  return planInteractiveMetricAvailability(cols, rows, liveMetrics.enabled, liveMetrics.sections);
}

function currentMetricSections(): InteractiveMetricSection[] {
  return activeInteractiveMetricSections(currentMetricAvailability());
}

function runMetricsGpu(encoder: GPUCommandEncoder): void {
  lastEncodedMetricSections = currentMetricSections();
  if (!metricsResources) {
    return;
  }
  if (lastEncodedMetricSections.length === 0) {
    return;
  }
  encodeInteractiveMetrics({
    device,
    encoder,
    resources: metricsResources,
    sourceBuffer: pingPong ? gridBufferB : gridBufferA,
    dispatchPlan: metricsDispatchPlan,
    enabledSections: lastEncodedMetricSections
  });
}

function readMetricsAndPost(): void {
  const gen = genCounter;
  if (!metricsResources || gen === lastMetricsGen || metricsInFlight) {
    return;
  }
  const resources = metricsResources;
  const encodedSections = [...lastEncodedMetricSections];
  const availability = currentMetricAvailability();
  lastMetricsGen = gen;
  metricsInFlight = true;

  readInteractiveMetrics({
    resources,
    enabledSections: encodedSections
  }).then(readback => {
    const deadIdx = tribeIndex.get(DEAD_TRIBE_ID) ?? 0;
    const totalFrames = totalRecordedFrames();
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
      totalFrames,
      fps: currentFps,
      canStepBack: totalFrames > 1,
      recordingBytes: sealedChunks.reduce((sum, c) => sum + c.storedBytes, 0),
      recordingRawBytes: sealedChunks.reduce((sum, c) => sum + c.uncompressedBytes, 0)
    });

    metricsInFlight = false;
    self.postMessage(message);

    // Re-run if a step-back (or similar) requested metrics while we were in-flight.
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
    // Buffer destroyed during rebuild — just mark metrics as no longer in-flight.
    metricsInFlight = false;
  });
}

// ---------------------------------------------------------------------------
//  Simulation step
// ---------------------------------------------------------------------------

/**
 * Batch multiple simulation steps into a single GPU submit.
 * Much lighter on the GPU command queue than calling stepSimulation() N times.
 */
function skipBatchSize(): number {
  const cells = cols * rows;
  if (cells > 10_000_000) {
    return 10;
  }
  if (cells > 1_000_000) {
    return 50;
  }
  if (cells > 100_000) {
    return 200;
  }
  return 1000;
}

function nonRecordingMaxSpeedBatchesPerDrain(): number {
  const cells = cols * rows;
  if (cells > 10_000_000) {
    return 2;
  }
  if (cells > 1_000_000) {
    return 4;
  }
  if (cells > 100_000) {
    return 8;
  }
  return 16;
}

function batchStep(count: number): void {
  if (count <= 0) {
    return;
  }
  const plan = simulationDispatchPlan;
  const encoder = device.createCommandEncoder({label: GPU_LABELS.simulationBatchEncoder});
  for (let i = 0; i < count; i++) {
    const pass = encoder.beginComputePass({label: GPU_LABELS.simulationStepPass});
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, pingPong ? computeBindGroupBtoA : computeBindGroupAtoB);
    pass.dispatchWorkgroups(plan.dispatchWgX, plan.dispatchWgY);
    pass.end();
    pingPong = !pingPong;
    genCounter++;
  }
  device.queue.submit([encoder.finish()]);
  stepCount += count;
}

/**
 * Post a lightweight generation + fps update.
 */
function postGeneration(): void {
  self.postMessage({
    type: 'generation',
    generation: genCounter,
    fps: currentFps
  } satisfies GenerationMessage);
}

function stepSimulation(): void {
  const encoder = device.createCommandEncoder({label: GPU_LABELS.simulationSingleStepEncoder});
  const pass = encoder.beginComputePass({label: GPU_LABELS.simulationStepPass});
  pass.setPipeline(computePipeline);
  pass.setBindGroup(0, pingPong ? computeBindGroupBtoA : computeBindGroupAtoB);

  const plan = simulationDispatchPlan;
  pass.dispatchWorkgroups(plan.dispatchWgX, plan.dispatchWgY);
  pass.end();

  device.queue.submit([encoder.finish()]);

  pingPong = !pingPong;
  genCounter++;
}

// ---------------------------------------------------------------------------
//  Render frame
// ---------------------------------------------------------------------------

function renderFrame(): void {
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

// ---------------------------------------------------------------------------
//  Main loop
// ---------------------------------------------------------------------------

type PumpSchedule = 'raf' | 'drain' | 'microtask';

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

function runKindForCurrentRecording(): RunKind {
  return isRecording && recordingAvailableForCurrentFrame() ? 'recording' : 'nonRecording';
}

function currentRunPacing(): RunPacing {
  if (targetStepDuration <= 0) {
    return {kind: 'max'};
  }
  return {kind: 'fixedGenPerSecond', genPerSecond: 1000 / targetStepDuration};
}

function isTargetRun(run: RunState): boolean {
  return run.request.stopCondition.kind === 'targetGeneration';
}

function runTargetReached(run: RunState): boolean {
  return run.request.stopCondition.kind === 'targetGeneration' && genCounter >= run.request.stopCondition.generation;
}

function remainingTargetSteps(run: RunState): number {
  if (run.request.stopCondition.kind !== 'targetGeneration') {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, run.request.stopCondition.generation - genCounter);
}

function canEncodeInteractiveMetrics(): boolean {
  return Boolean(device && metricsResources && !rebuilding && !deviceLost);
}

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

function refreshMetricsAndRender(): void {
  queueMetricsRefresh(true);
  renderFrame();
}

function maybeRunPeriodicMetrics(now: number, didStep: boolean): void {
  if (!didStep) {
    return;
  }
  const metricsElapsed = now - lastMetricsTime;
  if ((metricsElapsed >= 1000 || lastMetricsTime === 0) && !metricsInFlight) {
    lastMetricsTime = now;
    queueMetricsRefresh();
  }
}

function maybePostRunProgress(run: RunState, now: number): void {
  if (run.request.pacing.kind !== 'max' && !isTargetRun(run)) {
    return;
  }
  if (now - run.lastProgressTime >= 1000) {
    run.lastProgressTime = now;
    postGeneration();
  }
}

function clearRunBackpressure(): void {
  if (backpressureActive) {
    backpressureActive = false;
    self.postMessage({type: 'backpressure', active: false} satisfies BackpressureMessage);
  }
}

function markRunBackpressure(): void {
  if (!backpressureActive) {
    backpressureActive = true;
    self.postMessage({type: 'backpressure', active: true} satisfies BackpressureMessage);
  }
}

function prepareRecordingStep(): boolean {
  if (!canRecord()) {
    return false;
  }
  if (chunkFrameIndex >= chunkFrameCapacity) {
    sealCurrentChunk();
  }
  return canRecord();
}

function scheduleIdleFrame(): void {
  if (rebuilding || deviceLost || activeRun) {
    return;
  }
  self.requestAnimationFrame(mainLoop);
}

function scheduleRunPump(schedule: PumpSchedule): void {
  const run = activeRun;
  if (!run || run.pumpPending || rebuilding || deviceLost) {
    return;
  }
  const {token} = run;
  run.pumpPending = true;
  const pump = (): void => {
    if (!activeRun || activeRun.token !== token) {
      return;
    }
    activeRun.pumpPending = false;
    pumpRun(performance.now());
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

function startRun(kind: RunKind, request: RunRequest): void {
  if (activeRun) {
    stopRun('restart', {
      render: false,
      postStepping: false,
      restore: false,
      restartRestoredRun: false
    });
  }
  activeRun = {
    kind,
    request,
    token: ++nextRunToken,
    pumpPending: false,
    lastFrameTime: 0,
    stepAccumulator: 0,
    lastProgressTime: 0
  };
  scheduleRunPump(request.pacing.kind === 'fixedGenPerSecond' ? 'raf' : 'microtask');
}

function startContinuousRun(): void {
  if (!simulationRunning) {
    return;
  }
  startRun(runKindForCurrentRecording(), {
    pacing: currentRunPacing(),
    stopCondition: {kind: 'none'}
  });
}

interface StopRunOptions {
  render?: boolean;
  postStepping?: boolean;
  restore?: boolean;
  restartRestoredRun?: boolean;
}

function stopRun(reason: RunStopReason, options: StopRunOptions = {}): void {
  const run = activeRun;
  if (!run) {
    return;
  }
  activeRun = null;
  nextRunToken++;

  const targetRun = isTargetRun(run);
  const shouldRestore = options.restore !== false && !!run.request.restoreAfterStop;
  if (shouldRestore && run.request.restoreAfterStop) {
    simulationRunning = run.request.restoreAfterStop.running;
    targetStepDuration = run.request.restoreAfterStop.targetStepDuration;
  }

  if (targetRun && options.postStepping !== false && (reason === 'targetReached' || reason === 'cancelled')) {
    self.postMessage({type: 'stepping', active: false} satisfies SteppingMessage);
  }

  if (targetRun || reason === 'cancelled') {
    clearRunBackpressure();
  } else if (backpressureActive) {
    checkBackpressure();
  }

  if (options.render !== false && !rebuilding && !deviceLost) {
    refreshMetricsAndRender();
  }

  if (options.restartRestoredRun !== false && shouldRestore && simulationRunning && !rebuilding && !deviceLost) {
    startContinuousRun();
  } else {
    scheduleIdleFrame();
  }
}

function cancelTargetRun(restoreRunning: boolean): void {
  const run = activeRun;
  if (!run || !isTargetRun(run)) {
    return;
  }
  if (run.request.restoreAfterStop) {
    run.request.restoreAfterStop.running = restoreRunning;
  }
  stopRun('cancelled');
}

function restartActiveRunForRecordingChange(request: RunRequest): void {
  stopRun('restart', {
    render: false,
    postStepping: false,
    restore: false,
    restartRestoredRun: false
  });
  startRun(runKindForCurrentRecording(), request);
}

function handleRecordingBlocked(run: RunState, now: number, didStep: boolean): void {
  markRunBackpressure();
  maybePostRunProgress(run, now);
  maybeRunPeriodicMetrics(now, didStep);
  scheduleRunPump('drain');
}

function pumpNonRecordingMaxRun(run: RunState, now: number): void {
  const batchSize = skipBatchSize();
  const batchesPerDrain = nonRecordingMaxSpeedBatchesPerDrain();
  let didStep = false;
  for (let i = 0; i < batchesPerDrain; i++) {
    const remaining = remainingTargetSteps(run);
    if (remaining <= 0) {
      break;
    }
    const batch = Math.min(batchSize, remaining);
    batchStep(batch);
    didStep = true;
  }

  maybePostRunProgress(run, now);
  if (runTargetReached(run)) {
    stopRun('targetReached');
    return;
  }
  if (didStep) {
    scheduleRunPump('drain');
  } else {
    scheduleRunPump('raf');
  }
}

function pumpRecordingMaxRun(run: RunState, now: number): void {
  captureCurrentGenerationIfNeeded(true);
  let didStep = false;
  const deadline = performance.now() + 14;
  while (remainingTargetSteps(run) > 0 && performance.now() < deadline) {
    if (!prepareRecordingStep()) {
      handleRecordingBlocked(run, now, didStep);
      return;
    }
    stepSimulation();
    stepCount++;
    didStep = true;
    recordGeneration(genCounter);
  }

  clearRunBackpressure();
  maybePostRunProgress(run, now);
  maybeRunPeriodicMetrics(now, didStep);
  if (runTargetReached(run)) {
    stopRun('targetReached');
    return;
  }
  scheduleRunPump('raf');
}

function pumpNonRecordingFixedRun(run: RunState, duration: number, now: number): void {
  if (run.lastFrameTime === 0) {
    run.lastFrameTime = now;
  }
  const delta = now - run.lastFrameTime;
  run.lastFrameTime = now;
  run.stepAccumulator += delta;

  const dueSteps = Math.floor(run.stepAccumulator / duration);
  const steps = Math.min(dueSteps, remainingTargetSteps(run));
  const didStep = steps > 0;
  if (didStep) {
    batchStep(steps);
    run.stepAccumulator -= duration * steps;
  }

  maybePostRunProgress(run, now);
  if (runTargetReached(run)) {
    stopRun('targetReached');
    return;
  }
  if (!isTargetRun(run)) {
    renderFrame();
    maybeRunPeriodicMetrics(now, didStep);
  }
  scheduleRunPump('raf');
}

function pumpRecordingFixedRun(run: RunState, duration: number, now: number): void {
  captureCurrentGenerationIfNeeded(true);
  if (run.lastFrameTime === 0) {
    run.lastFrameTime = now;
  }
  const delta = now - run.lastFrameTime;
  run.lastFrameTime = now;
  run.stepAccumulator += delta;

  let didStep = false;
  while (run.stepAccumulator >= duration && remainingTargetSteps(run) > 0) {
    if (!prepareRecordingStep()) {
      handleRecordingBlocked(run, now, didStep);
      return;
    }
    stepSimulation();
    stepCount++;
    run.stepAccumulator -= duration;
    didStep = true;
    recordGeneration(genCounter);
  }

  clearRunBackpressure();
  maybePostRunProgress(run, now);
  if (runTargetReached(run)) {
    stopRun('targetReached');
    return;
  }
  if (!isTargetRun(run)) {
    renderFrame();
    maybeRunPeriodicMetrics(now, didStep);
  }
  scheduleRunPump('raf');
}

function pumpRun(now: number): void {
  const run = activeRun;
  if (!run) {
    return;
  }
  if (rebuilding || deviceLost) {
    return;
  }
  updateFps(now);
  if (!isTargetRun(run)) {
    applyPendingBrush();
  }
  if (runTargetReached(run)) {
    stopRun('targetReached');
    return;
  }

  if (run.request.pacing.kind === 'max') {
    if (run.kind === 'recording') {
      pumpRecordingMaxRun(run, now);
    } else {
      pumpNonRecordingMaxRun(run, now);
    }
    return;
  }

  const duration = 1000 / run.request.pacing.genPerSecond;
  if (run.kind === 'recording') {
    pumpRecordingFixedRun(run, duration, now);
  } else {
    pumpNonRecordingFixedRun(run, duration, now);
  }
}

function mainLoop(now: number): void {
  if (rebuilding || deviceLost) {
    self.requestAnimationFrame(mainLoop);
    return;
  }

  updateFps(now);
  if (activeRun) {
    return;
  }

  applyPendingBrush();
  if (targetStepDuration > 0 && !gpuCatchUpPending) {
    renderFrame();
  }
  self.requestAnimationFrame(mainLoop);
}

// ---------------------------------------------------------------------------
//  Initialization
// ---------------------------------------------------------------------------

function selectSimulationGridFormat(rs: Ruleset<readonly Tribe[]>, requested: GridFormatMetadata): GridFormat {
  const maxBytes = device ? maxSimulationBufferBytes() : Number.POSITIVE_INFINITY;
  if (isSupportedBitsPerCell(requested.bitsPerCell) &&
      validatePackingAgainstStateCount(requested.bitsPerCell, rs.tribes.length) &&
      fitsGridFormatInMaxBytes(rs, gridFormatFromBits(requested.bitsPerCell), maxBytes)) {
    return gridFormatFromBits(requested.bitsPerCell);
  }
  return smallestValidSimulationGridFormat(rs.tribes.length, rs, maxBytes);
}

function initRuleset(rs: Ruleset<readonly Tribe[]>, simulationGridFormat: GridFormatMetadata): void {
  ruleset = rs;
  cols = rs.cols;
  rows = rs.rows;
  gridFormat = selectSimulationGridFormat(rs, simulationGridFormat);
  packedCols = packedColsForFormat(cols, gridFormat);
  tribes = [...rs.tribes];
  manifest.gridFormat = currentGridFormatMetadata();

  tribeIndex.clear();
  tribes.forEach((t, i) => tribeIndex.set(t.id, i));
}

async function initWebGPU(offscreen: OffscreenCanvas): Promise<void> {
  console.log('[GOLT worker] Initializing WebGPU');
  canvas = offscreen;

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error('[GOLT worker] WebGPU adapter not available');
    throw new Error('WebGPU adapter not available');
  }

  device = await adapter.requestDevice({
    requiredLimits: {maxBufferSize: adapter.limits.maxBufferSize, maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize}
  });
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
    maxBytes: maxSimulationBufferBytes(),
    vramBudgetBytes: vramBudgetBytes(),
    frameByteSize: 0,
    recordingAvailable: true,
    vramSimulationBytes: 0,
    vramRecordingBytes: 0,
    gridFormat: currentGridFormatMetadata()
  });

  const nextContext = canvas.getContext('webgpu');
  if (!nextContext) {
    throw new Error('WebGPU canvas context not available');
  }
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
}

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

async function createChunkBuffer(): Promise<void> {
  chunkGpuBuffer = device.createBuffer({
    label: GPU_LABELS.recordingChunkBuffer,
    size: chunkFrameCapacity * frameByteSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  });
  await trackMajorBufferAllocation(chunkFrameCapacity * frameByteSize, chunkGpuBuffer);
  chunkFrameIndex = 0;
  chunkGenerations = [];
}

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

async function initOpfs(): Promise<void> {
  await resetOpfsDir();
}

async function buildPipelines(): Promise<void> {
  console.log('[GOLT worker] Building GPU resources', {
    cols,
    rows,
    bitsPerCell: gridFormat.bitsPerCell,
    recordingAvailable: recordingAvailableForCurrentFrame()
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
  if (recordingAvailableForCurrentFrame()) {
    await createChunkBuffer();
    await createStagingRing();
  } else {
    console.warn('[GOLT worker] Recording buffers disabled for current frame size', {
      frameByteSize,
      maxRecordingBufferBytes: maxRecordingBufferBytes()
    });
    destroyRecordingBuffers();
    isRecording = false;
    recordingAwaitingForward = false;
  }
  await waitForTrackedBufferAllocations();
  postRecordingLimits();
  console.log('[GOLT worker] GPU resources ready');
}

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
  self.postMessage({type: 'rebuilding', active: true} satisfies RebuildingMessage);

  // Yield so that (1) the main thread can process the rebuilding message
  // And render the overlay, and (2) any in-flight mainLoop frame sees the
  // `rebuilding` flag and bails out before touching GPU state.
  try {
    await waitForGpuQueueIdle();
  } catch {
    // Queue waits can reject after device loss. Rebuild handles that below.
  }

  if (deviceLost && !await restoreWebGPUDevice()) {
    return false;
  }

  destroyRebuildableBuffers();
  createUniformBuffer();

  computeChunkCapacity();
  resetRebuildAllocationTracking(recordingAvailableForCurrentFrame());

  try {
    await createGridBuffers();
    createTribeColorBuffer();
    createRenderPipeline();
    createComputePipeline();
    createBrushPipeline();
    createRenderBindGroups();
    createMetricsPipelines();
    if (recordingAvailableForCurrentFrame()) {
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
    // GPU buffer allocation failed — post error, stay in rebuilding state
    // So mainLoop does not attempt GPU work, then attempt recovery without
    // Recording buffers.
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[GOLT worker] GPU rebuild failed:', reason);
    self.postMessage({type: 'gpuError', reason});
    try {
      destroyRebuildableBuffers();
      createUniformBuffer();
      resetRebuildAllocationTracking(false);
      // Retry core-only: grid + render + compute, no recording.
      await createGridBuffers();
      createTribeColorBuffer();
      createRenderPipeline();
      createComputePipeline();
      createBrushPipeline();
      createRenderBindGroups();
      createMetricsPipelines();
      // Disable recording since chunk/staging buffers failed.
      isRecording = false;
      recordingAwaitingForward = false;
      frameByteSize = gridBufferSize();
      destroyRecordingBuffers();
      console.warn('[GOLT worker] GPU rebuild recovered with recording disabled');
      await waitForTrackedBufferAllocations();
      postRecordingLimits();
    } catch (e) {
      console.error('[GOLT worker] GPU rebuild recovery failed:', e);
      return false;
    }
  }
  rebuilding = false;
  self.postMessage({type: 'rebuilding', active: false});
  console.log('[GOLT worker] Rebuild completed', {
    recordingAvailable: recordingAvailableForCurrentFrame(),
    frameByteSize
  });
  return true;
}

// ---------------------------------------------------------------------------
//  Message handler
// ---------------------------------------------------------------------------

self.onmessage = async(ev: MessageEvent<WorkerMessage>) => {
  const m = ev.data;
  switch (m.type) {
    case 'init': {
      console.log('[GOLT worker] Init message received', {
        cols: m.ruleset.cols,
        rows: m.ruleset.rows,
        recording: m.recording,
        running: m.running,
        speed: m.speed
      });
      isRecording = m.recording;
      liveMetrics = normalizeLiveMetricsSettings(m.liveMetrics);
      recordingAwaitingForward = isRecording;
      initRuleset(m.ruleset, m.simulationGridFormat);
      await initWebGPU(m.canvas);
      await buildPipelines();
      if (!metricsInFlight) {
        const initEncoder = device.createCommandEncoder({label: GPU_LABELS.interactiveMetricsEncoder});
        runMetricsGpu(initEncoder);
        device.queue.submit([initEncoder.finish()]);
        readMetricsAndPost();
      } else {
        pendingMetricsRetry = true;
      }
      postStorageQuota();

      simulationRunning = m.running;
      targetStepDuration = m.speed < 0 ? 0 : 1000 / m.speed;
      if (simulationRunning) {
        startContinuousRun();
      } else {
        scheduleIdleFrame();
      }
      break;
    }

    case 'setLiveMetrics': {
      liveMetrics = normalizeLiveMetricsSettings(m.liveMetrics);
      lastMetricsGen = -1;
      queueMetricsRefresh(true);
      break;
    }

    case 'setRuleset': {
      console.log('[GOLT worker] Ruleset update received', {
        cols: m.ruleset.cols,
        rows: m.ruleset.rows,
        tribes: m.ruleset.tribes.length
      });
      stopRun('rebuild', {
        render: false,
        postStepping: false,
        restore: false,
        restartRestoredRun: false
      });
      initRuleset(m.ruleset, m.simulationGridFormat);
      const rebuilt = await rebuildForNewRuleset();
      if (!rebuilt) {
        break;
      }
      genCounter = 0;
      lastMetricsGen = -1;
      await resetRecording(0);
      if (simulationRunning) {
        startContinuousRun();
      } else {
        scheduleIdleFrame();
      }
      // Post initial metrics for the fresh (empty) grid.
      if (!metricsInFlight) {
        const resetEncoder = device.createCommandEncoder({label: GPU_LABELS.interactiveMetricsEncoder});
        runMetricsGpu(resetEncoder);
        device.queue.submit([resetEncoder.finish()]);
        readMetricsAndPost();
      } else {
        pendingMetricsRetry = true;
      }
      break;
    }

    case 'setRunning':
      simulationRunning = m.running;
      if (m.running) {
        if (!activeRun) {
          startContinuousRun();
        }
        break;
      }
      if (activeRun && isTargetRun(activeRun)) {
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
      break;

    case 'setSpeed': {
      const wasMaxSpeed = targetStepDuration <= 0;
      const newDuration = m.speed < 0 ? 0 : 1000 / m.speed;
      targetStepDuration = newDuration;
      if (activeRun && !isTargetRun(activeRun) && simulationRunning) {
        stopRun('restart', {
          render: false,
          postStepping: false,
          restore: false,
          restartRestoredRun: false
        });
        if (wasMaxSpeed && newDuration > 0) {
          gpuCatchUpPending = true;
          device.queue.onSubmittedWorkDone().then(() => {
            gpuCatchUpPending = false;
            renderFrame();
            startContinuousRun();
          });
        } else {
          startContinuousRun();
        }
      } else if (simulationRunning && !activeRun) {
        startContinuousRun();
      } else if (wasMaxSpeed && newDuration > 0) {
        gpuCatchUpPending = true;
        device.queue.onSubmittedWorkDone().then(() => {
          gpuCatchUpPending = false;
          renderFrame();
          scheduleIdleFrame();
        });
      }
      break;
    }

    case 'camera':
      scale = m.scale;
      offsetX = m.offsetX;
      offsetY = m.offsetY;
      break;

    case 'resize':
      canvas.width = m.width;
      canvas.height = m.height;
      break;

    case 'draw': {
      const ids = m.tribes.map(t => tribeIndex.get(t)).filter((v): v is number => v !== undefined);
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
          centerX: m.x,
          centerY: m.y,
          brushSize: m.size,
          shape: shapeMap[m.shape] ?? 0,
          fill: fillMap[m.fill] ?? 0,
          tribeIds: ids
        };
      }
      break;
    }

    case 'getSnapshot': {
      readbackGrid().then(grid => {
        self.postMessage({
          type: 'snapshot',
          grid,
          generation: genCounter,
          cols,
          rows,
          gridFormat: currentGridFormatMetadata()
        } satisfies SnapshotMessage);
      }).catch(() => {
        // Grid too large to read back — send empty grid.
        const empty = new Uint32Array(0);
        self.postMessage({
          type: 'snapshot',
          grid: empty,
          generation: genCounter,
          cols,
          rows,
          gridFormat: currentGridFormatMetadata()
        } satisfies SnapshotMessage);
      });
      break;
    }

    case 'loadSnapshot': {
      const currentGrid = pingPong ? gridBufferB : gridBufferA;
      const incomingGridFormat = gridFormatFromMetadata(m.gridFormat);
      const incomingSize = gridByteSize({cols, rows}, incomingGridFormat);
      if (m.grid.byteLength !== incomingSize) {
        break;
      }
      const gridData = incomingGridFormat.bitsPerCell === gridFormat.bitsPerCell ?
        m.grid :
        packFrameToWords(unpackWordsToFrame(m.grid, {cols, rows}, incomingGridFormat), {cols, rows}, gridFormat);
      device.queue.writeBuffer(currentGrid, 0, gridData);
      genCounter = m.generation;
      await resetRecording(m.generation);
      break;
    }

    case 'setRecording': {
      const runToRestart = activeRun?.request;
      if (m.recording && recordingAvailableForCurrentFrame() && !isRecording) {
        isRecording = true;
        recordingAwaitingForward = true;
        lastMetricsGen = -1;
        if (!metricsInFlight) {
          const encoder = device.createCommandEncoder({label: GPU_LABELS.interactiveMetricsEncoder});
          runMetricsGpu(encoder);
          device.queue.submit([encoder.finish()]);
          readMetricsAndPost();
        } else {
          pendingMetricsRetry = true;
        }
        postStorageQuota();
      } else if (!m.recording || !recordingAvailableForCurrentFrame()) {
        if (m.recording && !recordingAvailableForCurrentFrame()) {
          console.warn('[GOLT worker] Recording requested but unavailable for current frame size', {
            frameByteSize,
            maxRecordingBufferBytes: maxRecordingBufferBytes()
          });
        }
        isRecording = false;
        recordingAwaitingForward = false;
      }
      if (runToRestart && activeRun) {
        restartActiveRunForRecordingChange(runToRestart);
      } else if (!activeRun && simulationRunning) {
        startContinuousRun();
      }
      break;
    }

    case 'getRecording': {
      // Flush queued GPU work, capture the current generation if needed,
      // Then seal the current chunk and wait for all writes.
      if (getRecordingPending) {
        break;
      }
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
      break;
    }

    case 'stepBack': {
      // Build global index of all recorded frames.
      let sealedFrameCount = 0;
      for (const c of sealedChunks) {
        sealedFrameCount += c.blockCount;
      }
      const totalFrames = sealedFrameCount + chunkFrameIndex;
      const k = Math.min(m.count, totalFrames - 1);
      if (k <= 0) {
        break;
      }
      const targetFrameGlobal = totalFrames - 1 - k;

      const currentGrid = pingPong ? gridBufferB : gridBufferA;

      if (targetFrameGlobal >= sealedFrameCount) {
        // Target is in the current GPU chunk buffer — fast GPU path.
        const frameInChunk = targetFrameGlobal - sealedFrameCount;
        chunkFrameIndex = frameInChunk + 1;
        chunkGenerations.length = chunkFrameIndex;
        genCounter = chunkGenerations[frameInChunk]!;

        const bEnc = device.createCommandEncoder({label: GPU_LABELS.recordingRestoreCopyEncoder});
        bEnc.copyBufferToBuffer(chunkGpuBuffer!, frameInChunk * frameByteSize, currentGrid, 0, frameByteSize);
        device.queue.submit([bEnc.finish()]);
      } else {
        // Target is in a sealed chunk — wait for in-flight seals to ensure OPFS is up-to-date.
        if (inflightSeals > 0) {
          await new Promise<void>(resolve => {
            const interval = setInterval(() => {
              if (inflightSeals === 0) {
                clearInterval(interval);
                resolve();
              }
            }, 10);
          });
          // Recalculate after await — sealedChunks may have been updated.
          sealedFrameCount = 0;
          for (const c of sealedChunks) {
            sealedFrameCount += c.blockCount;
          }
        }

        // Read from OPFS.
        let accumulated = 0;
        let targetSealedIdx = 0;
        let frameInChunk = 0;
        for (let si = 0; si < sealedChunks.length; si++) {
          const c = sealedChunks[si]!;
          if (targetFrameGlobal < accumulated + c.blockCount) {
            targetSealedIdx = si;
            frameInChunk = targetFrameGlobal - accumulated;
            break;
          }
          accumulated += c.blockCount;
        }

        const chunk = sealedChunks[targetSealedIdx]!;
        const chunkData = await readChunkFromOpfs(chunk.filename, chunk.codec);
        const storedChunkFormat = gridFormatFromMetadata(chunk.gridFormat);
        const storedFrameByteSize = gridByteSize({cols, rows}, storedChunkFormat);

        // Load frames 0..frameInChunk into the GPU chunk buffer.
        if (storedChunkFormat.bitsPerCell === gridFormat.bitsPerCell) {
          const prefixBytes = (frameInChunk + 1) * frameByteSize;
          device.queue.writeBuffer(chunkGpuBuffer!, 0, new Uint8Array(chunkData, 0, prefixBytes));
        } else {
          const repackedPrefix = new Uint8Array((frameInChunk + 1) * frameByteSize);
          for (let frameIndex = 0; frameIndex <= frameInChunk; frameIndex++) {
            const storedOffset = frameIndex * storedFrameByteSize;
            const packedFrame = new Uint8Array(chunkData, storedOffset, storedFrameByteSize);
            const unpackedFrame = unpackPackedBytesToFrame(packedFrame, {cols, rows}, storedChunkFormat);
            const repackedFrame = packFrameToWords(unpackedFrame, {cols, rows}, gridFormat);
            repackedPrefix.set(new Uint8Array(repackedFrame.buffer, repackedFrame.byteOffset, repackedFrame.byteLength), frameIndex * frameByteSize);
          }
          device.queue.writeBuffer(chunkGpuBuffer!, 0, repackedPrefix);
          device.queue.writeBuffer(currentGrid, 0, repackedPrefix.subarray(frameInChunk * frameByteSize, (frameInChunk + 1) * frameByteSize));
        }
        chunkFrameIndex = frameInChunk + 1;
        chunkGenerations = chunk.generations.slice(0, frameInChunk + 1);
        genCounter = chunkGenerations[frameInChunk]!;

        if (storedChunkFormat.bitsPerCell === gridFormat.bitsPerCell) {
          // Copy target frame to the grid.
          const bEnc = device.createCommandEncoder({label: GPU_LABELS.recordingRestoreCopyEncoder});
          bEnc.copyBufferToBuffer(chunkGpuBuffer!, frameInChunk * frameByteSize, currentGrid, 0, frameByteSize);
          device.queue.submit([bEnc.finish()]);
        }

        // Delete the target chunk and all subsequent sealed chunks from OPFS.
        const removed = sealedChunks.splice(targetSealedIdx);
        const filenames = removed.map(c => c.filename);
        deleteChunksFromOpfs(filenames);
      }

      updateManifestRange();
      postStorageQuota();

      lastMetricsGen = -1;
      if (!metricsInFlight) {
        const bEncoder = device.createCommandEncoder({label: GPU_LABELS.interactiveMetricsEncoder});
        runMetricsGpu(bEncoder);
        device.queue.submit([bEncoder.finish()]);
        readMetricsAndPost();
      } else {
        pendingMetricsRetry = true;
      }
      renderFrame();
      break;
    }

    case 'stepForward': {
      applyPendingBrush();
      if (m.count === 1) {
        // Single step: immediate, with recording.
        captureCurrentGenerationIfNeeded(true);
        stepSimulation();
        stepCount++;
        if (isRecording && canRecord()) {
          if (chunkFrameIndex >= chunkFrameCapacity) {
            sealCurrentChunk();
          }
          recordGeneration(genCounter);
        }
        lastMetricsGen = -1;
        if (!metricsInFlight) {
          const fEncoder = device.createCommandEncoder({label: GPU_LABELS.interactiveMetricsEncoder});
          runMetricsGpu(fEncoder);
          device.queue.submit([fEncoder.finish()]);
          readMetricsAndPost();
        } else {
          pendingMetricsRetry = true;
        }
        renderFrame();
      } else {
        // Multi-step: target-generation run, max speed, no rendering.
        self.postMessage({type: 'stepping', active: true} satisfies SteppingMessage);
        captureCurrentGenerationIfNeeded(true);
        startRun(runKindForCurrentRecording(), {
          pacing: {kind: 'max'},
          stopCondition: {kind: 'targetGeneration', generation: genCounter + m.count},
          restoreAfterStop: {
            running: simulationRunning,
            targetStepDuration
          }
        });
      }
      break;
    }

    case 'cancelStepping': {
      cancelTargetRun(activeRun?.request.restoreAfterStop?.running ?? simulationRunning);
      break;
    }
    case 'updateChunkCodec': {
      const chunk = sealedChunks.find(c => c.filename === m.filename);
      if (chunk) {
        chunk.codec = m.codec;
        chunk.storedBytes = m.storedBytes;
        chunk.gridFormat = m.gridFormat;
        manifest.chunks = [...sealedChunks];
        // Always post updated quota so the pending/compressed breakdown refreshes.
        postStorageQuota();
      }
      break;
    }
    case 'getUncompressedChunks': {
      const rawChunks = sealedChunks
        .filter(c => c.codec === RAW_PACKED_CODEC)
        .map(c => ({
          filename: c.filename,
          rawBytes: c.uncompressedBytes,
          blockCount: c.blockCount,
          cols,
          rows,
          rawGridFormat: c.gridFormat,
          storageGridFormat: gridFormatMetadata(chooseTightStorageGridFormat(ruleset.tribes.length))
        }));
      self.postMessage({type: 'uncompressedChunks', chunks: rawChunks});
      break;
    }
  }
};
