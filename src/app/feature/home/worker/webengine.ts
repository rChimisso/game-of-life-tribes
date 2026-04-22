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

import {RECORDING_MAX_FRAME_BYTES} from './recording-limits';
import renderWgsl from './render.wgsl';
import {chooseTightStorageGridFormat, fitsGridFormatInMaxBytes, GridFormat, GridFormatMetadata, GRID_FORMAT_8, gridByteSize, gridFormatFromBits, gridFormatFromMetadata, gridFormatMetadata, isSupportedBitsPerCell, packFrameToWords, packedColsForFormat, smallestValidSimulationGridFormat, unpackPackedBytesToFrame, unpackWordsToFrame, validatePackingAgainstStateCount} from '../model/grid-format';
import {ChunkMeta, RecordingManifest} from '../model/recording';
import {Clause, DEAD_TRIBE, Ruleset, Tribe} from '../model/rule';

export {RECORDING_MAX_FRAME_BYTES} from './recording-limits';

// ---------------------------------------------------------------------------
//  Public message contracts
// ---------------------------------------------------------------------------

export interface InitMessage {
  type: 'init';
  canvas: OffscreenCanvas;
  ruleset: Ruleset<readonly Tribe[]>;
  simulationGridFormat: GridFormatMetadata;
  recording: boolean;
  speed: number;
  running: boolean;
}

export interface SetRulesetMessage {
  type: 'setRuleset';
  ruleset: Ruleset<readonly Tribe[]>;
  simulationGridFormat: GridFormatMetadata;
}

export interface SetRunningMessage {
  type: 'setRunning';
  running: boolean;
}

export interface SetSpeedMessage {
  type: 'setSpeed';
  speed: number;
}

export type BrushShape = 'square' | 'round' | 'diamond' | 'vline' | 'hline';

export interface DrawMessage {
  type: 'draw';
  x: number;
  y: number;
  size: number;
  shape: BrushShape;
  fill: 'full' | 'spray' | 'outline';
  tribes: string[];
}

export interface CameraMessage {
  type: 'camera';
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ResizeMessage {
  type: 'resize';
  width: number;
  height: number;
}

export interface GetSnapshotMessage {
  type: 'getSnapshot';
}

export interface LoadSnapshotMessage {
  type: 'loadSnapshot';
  grid: Uint32Array;
  generation: number;
  gridFormat: GridFormatMetadata;
}

export interface SetRecordingMessage {
  type: 'setRecording';
  recording: boolean;
}

export interface GetRecordingMessage {
  type: 'getRecording';
}

export interface StepBackMessage {
  type: 'stepBack';
  count: number;
}

export interface StepForwardMessage {
  type: 'stepForward';
  count: number;
}

export interface CancelSteppingMessage {
  type: 'cancelStepping';
}

export interface GetUncompressedChunksMessage {
  type: 'getUncompressedChunks';
}

export interface UncompressedChunksMessage {
  type: 'uncompressedChunks';
  chunks: {
    filename: string;
    rawBytes: number;
    blockCount: number;
    cols: number;
    rows: number;
    rawGridFormat: GridFormatMetadata;
    storageGridFormat: GridFormatMetadata;
  }[];
}

export type WorkerMessage =
  | InitMessage
  | SetRulesetMessage
  | SetRunningMessage
  | SetSpeedMessage
  | DrawMessage
  | CameraMessage
  | ResizeMessage
  | GetSnapshotMessage
  | LoadSnapshotMessage
  | SetRecordingMessage
  | GetRecordingMessage
  | StepBackMessage
  | StepForwardMessage
  | CancelSteppingMessage
  | GetUncompressedChunksMessage
  | UpdateChunkCodecMessage;

export interface MetricMessage {
  type: 'metrics';
  generation: number;
  population: Record<string, number>;
  shannonEntropy: number;
  simpsonIndex: number;
  boundaryLength: number;
  extinctionTime: Record<string, number | null>;
  totalFrames: number;
  fps: number;
  canStepBack: boolean;
  recordingBytes: number;
  recordingRawBytes: number;
}

export interface SnapshotMessage {
  type: 'snapshot';
  grid: Uint32Array;
  generation: number;
  cols: number;
  rows: number;
  gridFormat: GridFormatMetadata;
}

export interface RecordingMessage {
  type: 'recording';
  manifest: RecordingManifest;
  cols: number;
  rows: number;
}

export interface LimitsMessage {
  type: 'limits';
  maxBytes: number;
  vramBudgetBytes: number;
  frameByteSize: number;
  recordingAvailable: boolean;
  vramSimulationBytes: number;
  vramRecordingBytes: number;
  gridFormat: GridFormatMetadata;
}

export interface SteppingMessage {
  type: 'stepping';
  active: boolean;
}

export interface ChunksSavingMessage {
  type: 'chunksSaving';
  active: boolean;
}

export interface BackpressureMessage {
  type: 'backpressure';
  active: boolean;
}

export interface StorageQuotaMessage {
  type: 'storageQuota';
  usedBytes: number;
  quotaBytes: number;
  pendingRawBytes: number;
  compressedBytes: number;
  gpuBufferMarginBytes: number;
}

export interface ChunkSealedMessage {
  type: 'chunkSealed';
  filename: string;
  rawBytes: number;
  blockCount: number;
  cols: number;
  rows: number;
  rawGridFormat: GridFormatMetadata;
  storageGridFormat: GridFormatMetadata;
}

export interface UpdateChunkCodecMessage {
  type: 'updateChunkCodec';
  filename: string;
  codec: string;
  storedBytes: number;
  gridFormat: GridFormatMetadata;
}

export interface GenerationMessage {
  type: 'generation';
  generation: number;
  fps: number;
}

export interface RebuildingMessage {
  type: 'rebuilding';
  active: boolean;
}

export interface DeviceLostMessage {
  type: 'deviceLost';
  reason: string;
}

export interface GpuErrorMessage {
  type: 'gpuError';
  reason: string;
}

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
let stepAccumulator = 0;
let lastFrameTime = 0;
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
let histogramPipeline: GPUComputePipeline;
let histogramBindGroupA: GPUBindGroup;
let histogramBindGroupB: GPUBindGroup;
let histogramBuffer: GPUBuffer; // Array<atomic<u32>, 256>
let histogramReadBuffer: GPUBuffer;
let boundaryPipeline: GPUComputePipeline;
let boundaryBindGroupA: GPUBindGroup;
let boundaryBindGroupB: GPUBindGroup;
let boundaryBuffer: GPUBuffer; // Single atomic<u32>
let boundaryReadBuffer: GPUBuffer;
let lastMetricsGen = -1;
let metricsInFlight = false;
let pendingMetricsRetry = false;
let lastMetricsTime = 0;

// Extinction tracking: per-tribe last generation seen alive
let tribeLastAliveGen: Map<number, number> = new Map();
let tribeEverAlive: Set<number> = new Set();

// Recording state
let isRecording = false;
let manifest: RecordingManifest = {
  chunks: [],
  generationStart: 0,
  generationEnd: 0,
  gridFormat: gridFormatMetadata(GRID_FORMAT_8)
};
let nextChunkId = 0;
let sealedChunks: ChunkMeta[] = [];

// Skip-forward state
let skipTarget = -1;
let preSkipRunning = false;
let preSkipStepDuration = 100;
let lastProgressTime = 0; // For periodic generation updates during skip & max speed
let gpuCatchUpPending = false; // Prevents rendering while GPU drains after max speed
let maxSpeedGpuWorkPending = false; // Prevents queueing multiple max-speed batches at once

function inNonRecordingMaxSpeedMode(): boolean {
  return simulationRunning && targetStepDuration <= 0 && skipTarget < 0 && !isRecording;
}

function resumeNonRecordingMaxSpeedLoop(): void {
  if (rebuilding || deviceLost || maxSpeedGpuWorkPending || !inNonRecordingMaxSpeedMode()) {
    return;
  }
  mainLoop(performance.now());
}

function wakeRenderLoop(): void {
  if (rebuilding || deviceLost) {
    return;
  }
  self.requestAnimationFrame(mainLoop);
}

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
let opfsDirHandle: FileSystemDirectoryHandle | null = null;
let opfsResetPromise: Promise<void> | null = null;
let inflightSeals = 0;
let pendingOpfsWrites = 0;
const MAX_PENDING_OPFS_WRITES = 12;
let backpressureActive = false;
let sealEpoch = 0; // Incremented on rebuild; stale callbacks silently bail.

// Chunk compression constants
const COMPRESS_MIN_BYTES = 4096; // Only attempt compression above this size
const COMPRESS_SAVINGS_RATIO = 0.90; // Keep compressed only if <= 90% of original

const MAX_TRIBES = 256;
const TRIBE_COLOR_BUFFER_SIZE = MAX_TRIBES * Uint32Array.BYTES_PER_ELEMENT;
const HISTOGRAM_BUFFER_SIZE = MAX_TRIBES * Uint32Array.BYTES_PER_ELEMENT;
const BOUNDARY_BUFFER_SIZE = Uint32Array.BYTES_PER_ELEMENT;

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
  const encoder = device.createCommandEncoder();
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
  histogramBuffer?.destroy();
  histogramReadBuffer?.destroy();
  boundaryBuffer?.destroy();
  boundaryReadBuffer?.destroy();
  brushUniformBuffer?.destroy();
  destroyRecordingBuffers();
}

function updateInflightSeals(delta: number): void {
  const wasSaving = inflightSeals > 0;
  inflightSeals += delta;
  const isSaving = inflightSeals > 0;
  if (wasSaving !== isSaving) {
    self.postMessage({
      type: 'chunksSaving',
      active: isSaving
    });
  }
}

function checkBackpressure(): void {
  if (chunkFrameCapacity < 1 || stagingRing.length === 0) {
    if (backpressureActive) {
      backpressureActive = false;
      self.postMessage({
        type: 'backpressure',
        active: false
      });
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
    self.postMessage({
      type: 'backpressure',
      active: pressure
    });
  }
}

async function postStorageQuota(): Promise<void> {
  const estimate = await navigator.storage.estimate();
  const quotaBytes = Math.min(estimate.quota ?? STORAGE_CAP / 128, STORAGE_CAP);
  const usedBytes = estimate.usage ?? 0;
  let pendingRawBytes = 0;
  let compressedBytes = 0;
  for (const c of sealedChunks) {
    if (c.codec === 'raw-packed') {
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

// ---------------------------------------------------------------------------
//  Chunk compression helpers (deflate-raw via CompressionStream API)
// ---------------------------------------------------------------------------

async function compressPayload(raw: ArrayBuffer): Promise<{data: ArrayBuffer; codec: string}> {
  if (raw.byteLength < COMPRESS_MIN_BYTES) {
    return {data: raw,
      codec: 'raw-packed'};
  }
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(new Uint8Array(raw));
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
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
  if (totalLen > raw.byteLength * COMPRESS_SAVINGS_RATIO) {
    // Compression didn't help enough — keep raw.
    return {data: raw,
      codec: 'raw-packed'};
  }
  const compressed = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) {
    compressed.set(c, off);
    off += c.byteLength;
  }
  return {data: compressed.buffer,
    codec: 'deflate-raw'};
}

async function decompressPayload(compressed: ArrayBuffer): Promise<ArrayBuffer> {
  const ds = new DecompressionStream('deflate-raw');
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

// ---------------------------------------------------------------------------
//  Compute shader codegen
// ---------------------------------------------------------------------------

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

function generateComputeWgsl(): string {
  const lines: string[] = [];
  const pc = packedCols;

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
  pushGridFormatWgslConstants(lines);
  lines.push('');

  // Helper: read a cell's tribe ID from packed grid.
  pushReadCellWgsl(lines, 'gridIn', 'PACKED_COLS');
  lines.push('');

  // Generate applyRules function containing all rule logic.
  const deadIdx = tribeIndex.get(DEAD_TRIBE.id) ?? 0;
  lines.push('fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {');

  // Precompute neighbor count variables for each unique tribe set used in count clauses.
  const countSets = collectCountSets(ruleset.rules.map(r => r.clause));
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
  const equalitySets = collectEqualitySets(ruleset.rules.map(r => r.clause));
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
  for (let ri = 0; ri < ruleset.rules.length; ri++) {
    const rule = ruleset.rules[ri]!;
    const condExpr = generateClauseExpr(rule.clause, countVarMap, eqVarMap);
    const targetIdx = resolveTribeTarget(rule.tribe);
    if (ri === 0) {
      lines.push(`  if (${ condExpr }) {`);
    } else {
      lines.push(`  } else if (${ condExpr }) {`);
    }
    lines.push(`    result = ${ targetIdx }u;`);
  }
  if (ruleset.rules.length > 0) {
    lines.push('  }');
  }
  lines.push('');
  lines.push('  return result;');
  lines.push('}');
  lines.push('');

  // Main compute function: each thread processes one packed u32 word.
  lines.push('@compute @workgroup_size(16, 16)');
  lines.push('fn main(@builtin(global_invocation_id) gid: vec3u) {');
  lines.push('  let px = gid.x;');
  lines.push('  let y = gid.y;');
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
  const xName = dx === -1 ? 'L' : dx === 1 ? 'R' : 'C';
  const yName = dy === -1 ? 'T' : dy === 1 ? 'B' : 'C';
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
    if (name === 'any') {
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
  if (tribeName === 'any') {
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
    case 'count': {
      const ids = resolveTribeIds(c.tribes as string[]).sort();
      result.add(ids.join(','));
      break;
    }
    case 'not':
      collectCountSetsRec(c.clause, result);
      break;
    case 'and':
    case 'or':
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
    case 'equality': {
      const ids1 = resolveTribeIds(c.tribe1 as string[]).sort();
      const ids2 = resolveTribeIds(c.tribe2 as string[]).sort();
      result.add(ids1.join(','));
      result.add(ids2.join(','));
      break;
    }
    case 'not':
      collectEqualitySetsRec(c.clause, result);
      break;
    case 'and':
    case 'or':
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
    case 'is': {
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
    case 'count': {
      const ids = resolveTribeIds(c.tribes as string[]).sort();
      const varName = countVarMap.get(ids.join(','))!;
      return `(${ varName } >= ${ c.interval[0] }u && ${ varName } <= ${ c.interval[1] }u)`;
    }
    case 'equality': {
      const ids1 = resolveTribeIds(c.tribe1 as string[]).sort();
      const ids2 = resolveTribeIds(c.tribe2 as string[]).sort();
      const var1 = eqVarMap.get(ids1.join(','))!;
      const var2 = eqVarMap.get(ids2.join(','))!;
      return `(${ var1 } == ${ var2 })`;
    }
    case 'not':
      return `!(${ generateClauseExpr(c.clause, countVarMap, eqVarMap) })`;
    case 'and': {
      const parts = c.clauses.map(sub => generateClauseExpr(sub, countVarMap, eqVarMap));
      return `(${ parts.join(' && ') })`;
    }
    case 'or': {
      const parts = c.clauses.map(sub => generateClauseExpr(sub, countVarMap, eqVarMap));
      return `(${ parts.join(' || ') })`;
    }
    default:
      return 'false';
  }
}

// ---------------------------------------------------------------------------
//  Uniform layout (must match render.wgsl Uniforms struct)
//
//  Offset  0: canvas_size  vec2f    8 bytes
//  Offset  8: grid_size    vec2f    8 bytes
//  Offset 16: scale        f32      4 bytes
//  Offset 20: pad                   4 bytes
//  Offset 24: offset       vec2f    8 bytes
//  Offset 32: tribe_count  u32      4 bytes
//  Offset 36: pad                  12 bytes
//  Total: 48 bytes
// ---------------------------------------------------------------------------
const UNIFORM_SIZE = 48;

function createUniformBuffer(): void {
  uniformBuffer?.destroy();
  uniformBuffer = device.createBuffer({
    size: UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
}

function writeUniforms(): void {
  const data = new ArrayBuffer(UNIFORM_SIZE);
  const f32 = new Float32Array(data);
  const u32 = new Uint32Array(data);

  f32[0] = canvas.width;
  f32[1] = canvas.height;
  f32[2] = cols;
  f32[3] = rows;
  f32[4] = scale;
  // F32[5] = padding
  f32[6] = offsetX;
  f32[7] = offsetY;
  u32[8] = tribes.length;

  device.queue.writeBuffer(uniformBuffer, 0, data);
}

// ---------------------------------------------------------------------------
//  Buffer management
// ---------------------------------------------------------------------------

function gridBufferSize(): number {
  return gridByteSize(cols, rows, gridFormat);
}

function currentGridFormatMetadata(): GridFormatMetadata {
  return gridFormatMetadata(gridFormat);
}

async function createGridBuffers(): Promise<void> {
  const byteSize = gridBufferSize();

  gridBufferA = device.createBuffer({
    size: byteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  });
  await trackMajorBufferAllocation(byteSize, gridBufferA);

  gridBufferB = device.createBuffer({
    size: byteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  });
  await trackMajorBufferAllocation(byteSize, gridBufferB);

  // Dead tribe always maps to index 0 → packed representation is all-zero.
  // GPU clearBuffer zeroes the buffers with no JS heap allocation.
  const enc = device.createCommandEncoder();
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
  const module = device.createShaderModule({code: generateRenderWgsl()});

  renderPipeline = device.createRenderPipeline({
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

function createRenderBindGroups(): void {
  renderBindGroupA = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      {binding: 0,
        resource: {buffer: uniformBuffer} },
      {binding: 1,
        resource: {buffer: gridBufferA} },
      {binding: 2,
        resource: {buffer: tribeColorBuffer} }
    ]
  });

  renderBindGroupB = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      {binding: 0,
        resource: {buffer: uniformBuffer} },
      {binding: 1,
        resource: {buffer: gridBufferB} },
      {binding: 2,
        resource: {buffer: tribeColorBuffer} }
    ]
  });
}

function createComputePipeline(): void {
  const wgsl = generateComputeWgsl();
  const module = device.createShaderModule({code: wgsl});

  computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module,
      entryPoint: 'main'
    }
  });

  computeBindGroupAtoB = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      {binding: 0,
        resource: {buffer: gridBufferA} },
      {binding: 1,
        resource: {buffer: gridBufferB} }
    ]
  });

  computeBindGroupBtoA = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      {binding: 0,
        resource: {buffer: gridBufferB} },
      {binding: 1,
        resource: {buffer: gridBufferA} }
    ]
  });
}

// ---------------------------------------------------------------------------
//  Metrics compute pipelines (histogram + boundary)
// ---------------------------------------------------------------------------

function generateHistogramWgsl(): string {
  return `
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = ${cols}u;
const ROWS: u32 = ${rows}u;
const CELLS_PER_WORD: u32 = ${gridFormat.cellsPerWord}u;
const WORD_SHIFT: u32 = ${gridFormat.wordShift}u;
const CELL_SHIFT: u32 = ${gridFormat.cellShift}u;
const CELL_INDEX_MASK: u32 = ${gridFormat.cellIndexMask}u;
const CELL_MASK: u32 = ${gridFormat.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

  let x = gid.x;
  let y = gid.y;
  if (x < COLS && y < ROWS) {
    let tribe = readCell(x, y);
    atomicAdd(&localHist[tribe], 1u);
  }
  workgroupBarrier();

  let count = atomicLoad(&localHist[lid]);
  if (count > 0u) {
    atomicAdd(&hist[lid], count);
  }
}
`;
}

function generateBoundaryWgsl(): string {
  return `
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${cols}u;
const ROWS: u32 = ${rows}u;
const CELLS_PER_WORD: u32 = ${gridFormat.cellsPerWord}u;
const WORD_SHIFT: u32 = ${gridFormat.wordShift}u;
const CELL_SHIFT: u32 = ${gridFormat.cellShift}u;
const CELL_INDEX_MASK: u32 = ${gridFormat.cellIndexMask}u;
const CELL_MASK: u32 = ${gridFormat.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

  let x = gid.x;
  let y = gid.y;
  if (x < COLS && y < ROWS) {
    var edges = 0u;
    let self_tribe = readCell(x, y);

    // Check right neighbor.
    if (readCell((x + 1u) % COLS, y) != self_tribe) {
      edges += 1u;
    }

    // Check bottom neighbor.
    if (readCell(x, (y + 1u) % ROWS) != self_tribe) {
      edges += 1u;
    }

    if (edges > 0u) {
      atomicAdd(&localCount, edges);
    }
  }
  workgroupBarrier();

  // One thread flushes the workgroup sum to the global counter.
  if (lid == 0u) {
    let sum = atomicLoad(&localCount);
    if (sum > 0u) {
      atomicAdd(&boundary, sum);
    }
  }
}
`;
}

function createMetricsPipelines(): void {
  // Histogram
  const histModule = device.createShaderModule({code: generateHistogramWgsl()});
  histogramPipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {module: histModule,
      entryPoint: 'main'}
  });

  histogramBuffer = device.createBuffer({
    size: HISTOGRAM_BUFFER_SIZE, // 256 tribes max
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  histogramReadBuffer = device.createBuffer({
    size: HISTOGRAM_BUFFER_SIZE,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });

  histogramBindGroupA = device.createBindGroup({
    layout: histogramPipeline.getBindGroupLayout(0),
    entries: [
      {binding: 0,
        resource: {buffer: gridBufferA} },
      {binding: 1,
        resource: {buffer: histogramBuffer} }
    ]
  });
  histogramBindGroupB = device.createBindGroup({
    layout: histogramPipeline.getBindGroupLayout(0),
    entries: [
      {binding: 0,
        resource: {buffer: gridBufferB} },
      {binding: 1,
        resource: {buffer: histogramBuffer} }
    ]
  });

  // Boundary
  const boundaryModule = device.createShaderModule({code: generateBoundaryWgsl()});
  boundaryPipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {module: boundaryModule,
      entryPoint: 'main'}
  });

  boundaryBuffer = device.createBuffer({
    size: BOUNDARY_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  boundaryReadBuffer = device.createBuffer({
    size: BOUNDARY_BUFFER_SIZE,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });

  boundaryBindGroupA = device.createBindGroup({
    layout: boundaryPipeline.getBindGroupLayout(0),
    entries: [
      {binding: 0,
        resource: {buffer: gridBufferA} },
      {binding: 1,
        resource: {buffer: boundaryBuffer} }
    ]
  });
  boundaryBindGroupB = device.createBindGroup({
    layout: boundaryPipeline.getBindGroupLayout(0),
    entries: [
      {binding: 0,
        resource: {buffer: gridBufferB} },
      {binding: 1,
        resource: {buffer: boundaryBuffer} }
    ]
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
  const module = device.createShaderModule({code: generateBrushWgsl()});

  brushPipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {module,
      entryPoint: 'main'}
  });

  brushUniformBuffer?.destroy();
  brushUniformBuffer = device.createBuffer({
    size: BRUSH_UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  brushBindGroupA = device.createBindGroup({
    layout: brushPipeline.getBindGroupLayout(0),
    entries: [
      {binding: 0,
        resource: {buffer: gridBufferA} },
      {binding: 1,
        resource: {buffer: brushUniformBuffer} }
    ]
  });

  brushBindGroupB = device.createBindGroup({
    layout: brushPipeline.getBindGroupLayout(0),
    entries: [
      {binding: 0,
        resource: {buffer: gridBufferB} },
      {binding: 1,
        resource: {buffer: brushUniformBuffer} }
    ]
  });
}

function dispatchBrushOnEncoder(encoder: GPUCommandEncoder, centerX: number, centerY: number, brushSize: number, shape: number, fill: number, tribeIds: number[]): void {
  const deadId = tribeIndex.get(DEAD_TRIBE.id) ?? 0;
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
  const pass = encoder.beginComputePass();
  pass.setPipeline(brushPipeline);
  pass.setBindGroup(0, pingPong ? brushBindGroupB : brushBindGroupA);
  pass.dispatchWorkgroups(wgBrush, wgBrush);
  pass.end();
}

// ---------------------------------------------------------------------------
//  Pack / unpack helpers
// ---------------------------------------------------------------------------

function unpackGridToFrame(packed: Uint32Array): Uint8Array {
  return unpackWordsToFrame(packed, cols, rows, gridFormat);
}

function packFrameToGrid(frame: Uint8Array): Uint32Array {
  return packFrameToWords(frame, cols, rows, gridFormat);
}

function readbackGrid(): Promise<Uint32Array> {
  const currentGrid = pingPong ? gridBufferB : gridBufferA;
  const byteSize = gridBufferSize();

  let readBuffer: GPUBuffer;
  try {
    readBuffer = device.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
  } catch (e) {
    console.warn('GPU readback buffer allocation failed:', e);
    return Promise.reject(new Error(`Failed to allocate ${byteSize} byte readback buffer`));
  }

  const encoder = device.createCommandEncoder();
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
//  Metrics helpers
// ---------------------------------------------------------------------------

function metricsInterval(): number {
  // Scale down frequency for larger grids.
  const cellCount = cols * rows;
  const areaFactor = cellCount > 1_000_000 ? 10 : cellCount > 100_000 ? 3 : 1;

  if (targetStepDuration <= 0) {
    return 60 * areaFactor;
  }
  const stepsPerSecond = 1000 / targetStepDuration;
  let interval = Math.max(1, Math.round(stepsPerSecond));

  // When FPS < 1, increase interval to reduce metrics overhead.
  if (currentFps > 0 && currentFps < 1) {
    interval = Math.max(interval, Math.ceil(1 / currentFps));
  }

  return interval * areaFactor;
}

// ---------------------------------------------------------------------------
//  RLE compression for recorded frames
// ---------------------------------------------------------------------------

function rleEncode(data: Uint8Array): Uint8Array {
  if (data.length === 0) {
    return data;
  }
  const out = new Uint8Array(data.length * 2); // Worst case
  let oi = 0;
  let i = 0;
  while (i < data.length) {
    const val = data[i]!;
    let run = 1;
    while (i + run < data.length && data[i + run] === val && run < 255) {
      run++;
    }
    out[oi++] = run;
    out[oi++] = val;
    i += run;
  }
  return out.slice(0, oi);
}

function rleDecode(encoded: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let oi = 0;
  for (let i = 0; i < encoded.length; i += 2) {
    const run = encoded[i]!;
    const val = encoded[i + 1]!;
    out.fill(val, oi, oi + run);
    oi += run;
  }
  return out;
}

function rleEncodeFrame(frame: Uint8Array): Uint8Array {
  const encoded = rleEncode(frame);
  return encoded.length < frame.length ? encoded : frame;
}

function rleDecodeFrame(stored: Uint8Array): Uint8Array {
  const expectedLen = cols * rows;
  return stored.length < expectedLen ? rleDecode(stored, expectedLen) : stored;
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
  const enc = device.createCommandEncoder();
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

  const enc = device.createCommandEncoder();
  enc.copyBufferToBuffer(chunkGpuBuffer, 0, stagingBuf, 0, byteLen);
  device.queue.submit([enc.finish()]);

  const meta: ChunkMeta = {
    chunkId,
    generationStart: genStart,
    generationEnd: genEnd,
    blockCount,
    codec: 'raw-packed',
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
    self.postMessage({type: 'chunksSaving',
      active: false} satisfies ChunksSavingMessage);
  }
  if (backpressureActive) {
    backpressureActive = false;
    self.postMessage({type: 'backpressure',
      active: false});
  }
  getRecordingPending = false;
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
      chunks: sealedChunks.map(c => ({...c,
        generations: [...c.generations]})),
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

function captureCurrentGenerationIfNeeded(): void {
  if (!isRecording || !needsInitialCapture() || !canRecord()) {
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
  const encoder = device.createCommandEncoder();
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
async function readChunkFromOpfs(filename: string, codec: string = 'raw-packed'): Promise<ArrayBuffer> {
  const dir = await ensureOpfsDir();
  const fileHandle = await dir.getFileHandle(filename);
  const file = await fileHandle.getFile();
  const stored = await file.arrayBuffer();
  if (codec === 'deflate-raw') {
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

function runMetricsGpu(encoder: GPUCommandEncoder): void {
  const wgX = Math.ceil(cols / 16);
  const wgY = Math.ceil(rows / 16);

  // Histogram pass (population + diversity metrics).
  const zeros256 = new Uint32Array(256);
  device.queue.writeBuffer(histogramBuffer, 0, zeros256);

  const hp = encoder.beginComputePass();
  hp.setPipeline(histogramPipeline);
  hp.setBindGroup(0, pingPong ? histogramBindGroupB : histogramBindGroupA);
  hp.dispatchWorkgroups(wgX, wgY);
  hp.end();

  encoder.copyBufferToBuffer(histogramBuffer, 0, histogramReadBuffer, 0, 256 * 4);

  // Boundary pass (spatial metrics).
  const zeros1 = new Uint32Array([0]);
  device.queue.writeBuffer(boundaryBuffer, 0, zeros1);

  const bp = encoder.beginComputePass();
  bp.setPipeline(boundaryPipeline);
  bp.setBindGroup(0, pingPong ? boundaryBindGroupB : boundaryBindGroupA);
  bp.dispatchWorkgroups(wgX, wgY);
  bp.end();

  encoder.copyBufferToBuffer(boundaryBuffer, 0, boundaryReadBuffer, 0, 4);
}

function readMetricsAndPost(): void {
  const gen = genCounter;
  if (gen === lastMetricsGen || metricsInFlight) {
    return;
  }
  lastMetricsGen = gen;
  metricsInFlight = true;

  // Map only the buffers we need (histogram + boundary).
  const mapPromises: Promise<void>[] = [];
  mapPromises.push(histogramReadBuffer.mapAsync(GPUMapMode.READ));
  mapPromises.push(boundaryReadBuffer.mapAsync(GPUMapMode.READ));

  Promise.all(mapPromises).then(() => {
    const deadIdx = tribeIndex.get(DEAD_TRIBE.id) ?? 0;

    // Population + diversity metrics (derived from histogram — cheap).
    const population: Record<string, number> = {};
    let shannonEntropy = 0;
    let simpsonSum = 0;
    const extinctionTime: Record<string, number | null> = {};

    const histData = new Uint32Array(histogramReadBuffer.getMappedRange().slice(0));
    histogramReadBuffer.unmap();

    let totalAlive = 0;
    for (let i = 0; i < tribes.length; i++) {
      const count = histData[i] ?? 0;
      population[tribes[i]!.id] = count;
      if (i !== deadIdx) {
        totalAlive += count;
        if (count > 0) {
          tribeLastAliveGen.set(i, gen);
          tribeEverAlive.add(i);
        }
      }
    }

    if (totalAlive > 0) {
      for (let i = 0; i < tribes.length; i++) {
        if (i === deadIdx) {
          continue;
        }
        const p = (histData[i] ?? 0) / totalAlive;
        if (p > 0) {
          shannonEntropy -= p * Math.log2(p);
          simpsonSum += p * p;
        }
      }
    }

    for (let i = 0; i < tribes.length; i++) {
      if (i === deadIdx) {
        continue;
      }
      const count = histData[i] ?? 0;
      if (count > 0) {
        extinctionTime[tribes[i]!.id] = null;
      } else if (!tribeEverAlive.has(i)) {
        extinctionTime[tribes[i]!.id] = 0;
      } else {
        extinctionTime[tribes[i]!.id] = tribeLastAliveGen.get(i) ?? 0;
      }
    }

    // Boundary length (from GPU pass — free).
    const bData = new Uint32Array(boundaryReadBuffer.getMappedRange().slice(0));
    boundaryReadBuffer.unmap();
    const boundaryLength = bData[0] ?? 0;

    metricsInFlight = false;

    self.postMessage({
      type: 'metrics',
      generation: gen,
      population,
      shannonEntropy,
      simpsonIndex: 1 - simpsonSum,
      boundaryLength,
      extinctionTime,
      totalFrames: totalRecordedFrames(),
      fps: currentFps,
      canStepBack: totalRecordedFrames() > 1,
      recordingBytes: sealedChunks.reduce((sum, c) => sum + c.storedBytes, 0),
      recordingRawBytes: sealedChunks.reduce((sum, c) => sum + c.uncompressedBytes, 0)
    } satisfies MetricMessage);

    // Re-run if a step-back (or similar) requested metrics while we were in-flight.
    if (pendingMetricsRetry) {
      pendingMetricsRetry = false;
      lastMetricsGen = -1;
      const retryEncoder = device.createCommandEncoder();
      runMetricsGpu(retryEncoder);
      device.queue.submit([retryEncoder.finish()]);
      readMetricsAndPost();
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
  const wgX = Math.ceil(packedCols / 16);
  const wgY = Math.ceil(rows / 16);
  const encoder = device.createCommandEncoder();
  for (let i = 0; i < count; i++) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, pingPong ? computeBindGroupBtoA : computeBindGroupAtoB);
    pass.dispatchWorkgroups(wgX, wgY);
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
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(computePipeline);
  pass.setBindGroup(0, pingPong ? computeBindGroupBtoA : computeBindGroupAtoB);

  const wgX = Math.ceil(packedCols / 16);
  const wgY = Math.ceil(rows / 16);
  pass.dispatchWorkgroups(wgX, wgY);
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

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: textureView,
        loadOp: 'clear' as GPULoadOp,
        storeOp: 'store' as GPUStoreOp,
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

function mainLoop(now: number): void {
  // Skip all GPU work while buffers are being rebuilt or device is lost.
  if (rebuilding || deviceLost) {
    self.requestAnimationFrame(mainLoop);
    return;
  }

  // FPS tracking (shared across all modes).
  if (lastFpsTime === 0) {
    lastFpsTime = now;
  }
  const fpsElapsed = now - lastFpsTime;
  if (fpsElapsed >= 1000) {
    currentFps = stepCount / (fpsElapsed / 1000);
    stepCount = 0;
    lastFpsTime = now;
  }

  // -----------------------------------------------------------------------
  //  Skip-forward mode: run at max speed without rendering.
  // -----------------------------------------------------------------------
  if (skipTarget >= 0) {
    if (isRecording) {
      // Recording: per-step with backpressure.  When recording cannot
      // Proceed (staging + OPFS full), yield and wait for the GPU to finish
      // So mapAsync callbacks can fire and free staging buffers.
      let stuck = false;
      const deadline = performance.now() + 14;
      while (genCounter < skipTarget && performance.now() < deadline) {
        if (!canRecord()) {
          stuck = true;
          break;
        }
        if (chunkFrameIndex >= chunkFrameCapacity) {
          sealCurrentChunk();
        }
        stepSimulation();
        stepCount++;
        recordGeneration(genCounter);
      }
      if (stuck) {
        if (!backpressureActive) {
          backpressureActive = true;
          self.postMessage({
            type: 'backpressure',
            active: true
          });
        }
        if (now - lastProgressTime >= 1000) {
          lastProgressTime = now;
          postGeneration();
        }
        device.queue.onSubmittedWorkDone().then(() => {
          self.requestAnimationFrame(mainLoop);
        });
        return;
      }
      // No longer stuck — clear backpressure if it was set.
      if (backpressureActive) {
        backpressureActive = false;
        self.postMessage({
          type: 'backpressure',
          active: false
        });
      }
    } else {
      // Non-recording: batch steps into a single GPU submit.
      const batch = Math.min(skipBatchSize(), skipTarget - genCounter);
      batchStep(batch);
    }

    // Periodic lightweight generation + fps update.
    if (now - lastProgressTime >= 1000) {
      lastProgressTime = now;
      postGeneration();
    }

    if (genCounter >= skipTarget) {
      skipTarget = -1;
      simulationRunning = preSkipRunning;
      targetStepDuration = preSkipStepDuration;
      lastFrameTime = 0;
      stepAccumulator = 0;
      lastProgressTime = 0;
      if (backpressureActive) {
        backpressureActive = false;
        self.postMessage({
          type: 'backpressure',
          active: false
        });
      }

      // Update metrics and render.
      lastMetricsGen = -1;
      if (!metricsInFlight) {
        const encoder = device.createCommandEncoder();
        runMetricsGpu(encoder);
        device.queue.submit([encoder.finish()]);
        readMetricsAndPost();
      } else {
        pendingMetricsRetry = true;
      }
      renderFrame();
      self.postMessage({
        type: 'stepping',
        active: false
      });
      self.requestAnimationFrame(mainLoop);
    } else if (isRecording) {
      // Recording skip: next frame via rAF (already yielded above when stuck).
      self.requestAnimationFrame(mainLoop);
    } else {
      // Non-recording skip: wait for GPU to finish batch before queuing more.
      device.queue.onSubmittedWorkDone().then(() => {
        self.requestAnimationFrame(mainLoop);
      });
    }
    return;
  }

  // -----------------------------------------------------------------------
  //  Normal operation
  // -----------------------------------------------------------------------

  // Apply coalesced brush draw (one per frame max).
  applyPendingBrush();

  let shouldRunMetrics = false;
  if (simulationRunning) {
    // Capture current state before the first step (only when not yet recorded).
    if (isRecording && needsInitialCapture() && canRecord()) {
      if (chunkFrameIndex >= chunkFrameCapacity) {
        sealCurrentChunk();
      }
      recordGeneration(genCounter);
    }

    let didStep = false;
    if (lastFrameTime === 0) {
      lastFrameTime = now;
    }
    const delta = now - lastFrameTime;
    lastFrameTime = now;

    if (targetStepDuration <= 0) {
      // Max speed mode.
      if (isRecording) {
        // Per-step with yield-on-stuck (like skip-forward).
        let stuck = false;
        const deadline = performance.now() + 14;
        while (performance.now() < deadline) {
          if (!canRecord()) {
            stuck = true;
            break;
          }
          if (chunkFrameIndex >= chunkFrameCapacity) {
            sealCurrentChunk();
          }
          stepSimulation();
          stepCount++;
          didStep = true;
          recordGeneration(genCounter);
        }
        if (stuck) {
          if (!backpressureActive) {
            backpressureActive = true;
            self.postMessage({type: 'backpressure',
              active: true} satisfies BackpressureMessage);
          }
          if (now - lastProgressTime >= 1000) {
            lastProgressTime = now;
            postGeneration();
          }
          if (didStep) {
            const metricsElapsed = now - lastMetricsTime;
            if ((metricsElapsed >= 1000 || lastMetricsTime === 0) && !metricsInFlight) {
              lastMetricsTime = now;
              const encoder = device.createCommandEncoder();
              runMetricsGpu(encoder);
              device.queue.submit([encoder.finish()]);
              readMetricsAndPost();
            }
          }
          device.queue.onSubmittedWorkDone().then(() => {
            self.requestAnimationFrame(mainLoop);
          });
          return;
        }
        // No longer stuck — clear backpressure if it was set.
        if (backpressureActive) {
          backpressureActive = false;
          self.postMessage({type: 'backpressure',
            active: false} satisfies BackpressureMessage);
        }
      } else {
        // Non-recording: keep only one GPU batch in flight at a time.
        // Large grids can make a single batch expensive enough that piling up
        // Submits here keeps the GPU saturated long after pause.
        if (!maxSpeedGpuWorkPending) {
          const batchSize = skipBatchSize();
          const batchesPerDrain = nonRecordingMaxSpeedBatchesPerDrain();
          for (let i = 0; i < batchesPerDrain; i++) {
            batchStep(batchSize);
            didStep = true;
          }
          maxSpeedGpuWorkPending = true;
          device.queue.onSubmittedWorkDone().then(() => {
            maxSpeedGpuWorkPending = false;
            if (inNonRecordingMaxSpeedMode()) {
              resumeNonRecordingMaxSpeedLoop();
            } else {
              wakeRenderLoop();
            }
          });
        }
      }

      // Periodic lightweight generation + fps update during max speed.
      if (now - lastProgressTime >= 1000) {
        lastProgressTime = now;
        postGeneration();
      }
    } else {
      // Accumulate elapsed time and step as many times as needed.
      stepAccumulator += delta;
      while (stepAccumulator >= targetStepDuration) {
        if (isRecording) {
          if (!canRecord()) {
            break;
          }
          if (chunkFrameIndex >= chunkFrameCapacity) {
            sealCurrentChunk();
          }
        }
        stepSimulation();
        stepCount++;
        stepAccumulator -= targetStepDuration;
        didStep = true;
        if (isRecording) {
          recordGeneration(genCounter);
        }
      }
    }

    if (didStep) {
      // Full GPU metrics at most once per second.
      const metricsElapsed = now - lastMetricsTime;
      shouldRunMetrics = (metricsElapsed >= 1000 || lastMetricsTime === 0) && !metricsInFlight;
    }
  }

  // Render first so the visible frame is never behind the metrics pass.
  if (targetStepDuration > 0 && !gpuCatchUpPending) {
    renderFrame();
  }

  if (shouldRunMetrics) {
    lastMetricsTime = now;
    const encoder = device.createCommandEncoder();
    runMetricsGpu(encoder);
    device.queue.submit([encoder.finish()]);
    readMetricsAndPost();
  }

  if (targetStepDuration <= 0 && !isRecording && simulationRunning) {
    return;
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
      fitsGridFormatInMaxBytes(rs.cols, rs.rows, gridFormatFromBits(requested.bitsPerCell), maxBytes)) {
    return gridFormatFromBits(requested.bitsPerCell);
  }
  return smallestValidSimulationGridFormat(rs.tribes.length, rs.cols, rs.rows, maxBytes);
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
  canvas = offscreen;

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPU adapter not available');
  }

  device = await adapter.requestDevice({
    requiredLimits: {
      maxBufferSize: adapter.limits.maxBufferSize,
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
    }
  });
  deviceLost = false;

  device.lost.then(info => {
    const reason = info.message || info.reason || 'unknown';
    deviceLost = true;
    simulationRunning = false;
    rebuilding = true;
    self.postMessage({type: 'deviceLost',
      reason} satisfies DeviceLostMessage);
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
  } satisfies LimitsMessage);

  context = canvas.getContext('webgpu') as GPUCanvasContext;
  canvasFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: canvasFormat,
    alphaMode: 'opaque'
  });
}

async function restoreWebGPUDevice(): Promise<boolean> {
  try {
    await initWebGPU(canvas);
    return true;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    deviceLost = true;
    simulationRunning = false;
    rebuilding = true;
    self.postMessage({type: 'deviceLost',
      reason} satisfies DeviceLostMessage);
    return false;
  }
}

async function createChunkBuffer(): Promise<void> {
  chunkGpuBuffer = device.createBuffer({
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
    destroyRecordingBuffers();
    isRecording = false;
  }
  await waitForTrackedBufferAllocations();
  postRecordingLimits();
}

async function rebuildForNewRuleset(): Promise<boolean> {
  rebuilding = true;
  self.postMessage({type: 'rebuilding',
    active: true} satisfies RebuildingMessage);

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
    }
    await waitForTrackedBufferAllocations();
    postRecordingLimits();
  } catch (err) {
    // GPU buffer allocation failed — post error, stay in rebuilding state
    // So mainLoop does not attempt GPU work, then attempt recovery without
    // Recording buffers.
    const reason = err instanceof Error ? err.message : String(err);
    self.postMessage({type: 'gpuError',
      reason} satisfies GpuErrorMessage);
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
      frameByteSize = gridBufferSize();
      destroyRecordingBuffers();
      await waitForTrackedBufferAllocations();
      postRecordingLimits();
    } catch (e) {
      console.warn('GPU recovery also failed, device may be lost:', e);
      return false;
    }
  }
  rebuilding = false;
  self.postMessage({type: 'rebuilding',
    active: false} satisfies RebuildingMessage);
  return true;
}

// ---------------------------------------------------------------------------
//  Message handler
// ---------------------------------------------------------------------------

self.onmessage = async(ev: MessageEvent<WorkerMessage>) => {
  const m = ev.data;
  switch (m.type) {
    case 'init': {
      isRecording = m.recording;
      initRuleset(m.ruleset, m.simulationGridFormat);
      await initWebGPU(m.canvas);
      await buildPipelines();

      simulationRunning = m.running;
      targetStepDuration = m.speed < 0 ? 0 : 1000 / m.speed;
      lastFrameTime = 0;
      stepAccumulator = 0;

      self.requestAnimationFrame(mainLoop);
      break;
    }

    case 'setRuleset': {
      initRuleset(m.ruleset, m.simulationGridFormat);
      const rebuilt = await rebuildForNewRuleset();
      if (!rebuilt) {
        break;
      }
      genCounter = 0;
      lastMetricsGen = -1;
      await resetRecording(0);
      tribeLastAliveGen = new Map();
      tribeEverAlive = new Set();
      // Post initial metrics for the fresh (empty) grid.
      if (!metricsInFlight) {
        const resetEncoder = device.createCommandEncoder();
        runMetricsGpu(resetEncoder);
        device.queue.submit([resetEncoder.finish()]);
        readMetricsAndPost();
      } else {
        pendingMetricsRetry = true;
      }
      break;
    }

    case 'setRunning':
      if (!m.running && skipTarget >= 0) {
        // Abort active step-forward when pausing.
        skipTarget = -1;
        simulationRunning = false;
        targetStepDuration = preSkipStepDuration;
        lastFrameTime = 0;
        stepAccumulator = 0;

        if (backpressureActive) {
          checkBackpressure();
        }

        lastMetricsGen = -1;
        if (!metricsInFlight) {
          const stopEncoder = device.createCommandEncoder();
          runMetricsGpu(stopEncoder);
          device.queue.submit([stopEncoder.finish()]);
          readMetricsAndPost();
        } else {
          pendingMetricsRetry = true;
        }
        renderFrame();
        self.postMessage({type: 'stepping',
          active: false} satisfies SteppingMessage);
        break;
      }
      simulationRunning = m.running;
      if (m.running) {
        lastFrameTime = 0;
        stepAccumulator = 0;
        resumeNonRecordingMaxSpeedLoop();
      } else {
        // Let backpressure drain naturally; just check if it can clear now.
        if (backpressureActive) {
          checkBackpressure();
        }
        // Post updated metrics so the UI shows the actual genCounter.
        lastMetricsGen = -1;
        if (!metricsInFlight) {
          const stopEncoder = device.createCommandEncoder();
          runMetricsGpu(stopEncoder);
          device.queue.submit([stopEncoder.finish()]);
          readMetricsAndPost();
        } else {
          pendingMetricsRetry = true;
        }
        if (targetStepDuration <= 0 && !isRecording && skipTarget < 0 && !maxSpeedGpuWorkPending) {
          wakeRenderLoop();
        }
      }
      break;

    case 'setSpeed': {
      const wasMaxSpeed = targetStepDuration <= 0;
      const newDuration = m.speed < 0 ? 0 : 1000 / m.speed;
      if (wasMaxSpeed && newDuration > 0) {
        // Transitioning from max speed → normal: let GPU drain before rendering.
        gpuCatchUpPending = true;
        device.queue.onSubmittedWorkDone().then(() => {
          gpuCatchUpPending = false;
          renderFrame();
          wakeRenderLoop();
        });
      }
      targetStepDuration = newDuration;
      stepAccumulator = 0;
      lastProgressTime = 0;
      if (!wasMaxSpeed && newDuration <= 0) {
        resumeNonRecordingMaxSpeedLoop();
      } else if (wasMaxSpeed && newDuration > 0 && !maxSpeedGpuWorkPending) {
        wakeRenderLoop();
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
        } satisfies SnapshotMessage, [grid.buffer] as never);
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
      const incomingSize = gridByteSize(cols, rows, incomingGridFormat);
      if (m.grid.byteLength !== incomingSize) {
        break;
      }
      const gridData = incomingGridFormat.bitsPerCell === gridFormat.bitsPerCell ?
        m.grid :
        packFrameToWords(unpackWordsToFrame(m.grid, cols, rows, incomingGridFormat), cols, rows, gridFormat);
      device.queue.writeBuffer(currentGrid, 0, gridData);
      genCounter = m.generation;
      await resetRecording(m.generation);
      break;
    }

    case 'setRecording': {
      if (m.recording && recordingAvailableForCurrentFrame() && !isRecording) {
        isRecording = true;
        captureCurrentGenerationIfNeeded();
        lastMetricsGen = -1;
        if (!metricsInFlight) {
          const encoder = device.createCommandEncoder();
          runMetricsGpu(encoder);
          device.queue.submit([encoder.finish()]);
          readMetricsAndPost();
        } else {
          pendingMetricsRetry = true;
        }
        postStorageQuota();
      } else if (!m.recording || !recordingAvailableForCurrentFrame()) {
        isRecording = false;
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
      captureCurrentGenerationIfNeeded();
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

        const bEnc = device.createCommandEncoder();
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
        const storedFrameByteSize = gridByteSize(cols, rows, storedChunkFormat);

        // Load frames 0..frameInChunk into the GPU chunk buffer.
        if (storedChunkFormat.bitsPerCell === gridFormat.bitsPerCell) {
          const prefixBytes = (frameInChunk + 1) * frameByteSize;
          device.queue.writeBuffer(chunkGpuBuffer!, 0, new Uint8Array(chunkData, 0, prefixBytes));
        } else {
          const repackedPrefix = new Uint8Array((frameInChunk + 1) * frameByteSize);
          for (let frameIndex = 0; frameIndex <= frameInChunk; frameIndex++) {
            const storedOffset = frameIndex * storedFrameByteSize;
            const packedFrame = new Uint8Array(chunkData, storedOffset, storedFrameByteSize);
            const unpackedFrame = unpackPackedBytesToFrame(packedFrame, cols, rows, storedChunkFormat);
            const repackedFrame = packFrameToWords(unpackedFrame, cols, rows, gridFormat);
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
          const bEnc = device.createCommandEncoder();
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
        const bEncoder = device.createCommandEncoder();
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
        if (isRecording && needsInitialCapture() && canRecord()) {
          if (chunkFrameIndex >= chunkFrameCapacity) {
            sealCurrentChunk();
          }
          recordGeneration(genCounter);
        }
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
          const fEncoder = device.createCommandEncoder();
          runMetricsGpu(fEncoder);
          device.queue.submit([fEncoder.finish()]);
          readMetricsAndPost();
        } else {
          pendingMetricsRetry = true;
        }
        renderFrame();
      } else {
        // Multi-step: enter skip-forward mode (max speed, no rendering).
        self.postMessage({type: 'stepping',
          active: true} satisfies SteppingMessage);

        if (isRecording && needsInitialCapture() && canRecord()) {
          if (chunkFrameIndex >= chunkFrameCapacity) {
            sealCurrentChunk();
          }
          recordGeneration(genCounter);
        }
        preSkipRunning = simulationRunning;
        preSkipStepDuration = targetStepDuration;
        skipTarget = genCounter + m.count;
        simulationRunning = true;
        targetStepDuration = 0;
        lastProgressTime = 0;
      }
      break;
    }

    case 'cancelStepping': {
      if (skipTarget >= 0) {
        skipTarget = -1;
        simulationRunning = preSkipRunning;
        targetStepDuration = preSkipStepDuration;
        lastFrameTime = 0;
        stepAccumulator = 0;

        lastMetricsGen = -1;
        if (!metricsInFlight) {
          const encoder = device.createCommandEncoder();
          runMetricsGpu(encoder);
          device.queue.submit([encoder.finish()]);
          readMetricsAndPost();
        } else {
          pendingMetricsRetry = true;
        }
        renderFrame();
        self.postMessage({type: 'stepping',
          active: false} satisfies SteppingMessage);
      }
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
        .filter(c => c.codec === 'raw-packed')
        .map(c => ({
          filename: c.filename,
          rawBytes: c.uncompressedBytes,
          blockCount: c.blockCount,
          cols,
          rows,
          rawGridFormat: c.gridFormat,
          storageGridFormat: gridFormatMetadata(chooseTightStorageGridFormat(ruleset.tribes.length))
        }));
      self.postMessage({type: 'uncompressedChunks',
        chunks: rawChunks});
      break;
    }
  }
};
