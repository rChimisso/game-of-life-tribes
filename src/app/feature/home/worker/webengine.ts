/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable import/exports-last */
/**
 * WebGPU Game-of-Life Tribes engine.
 *
 * Runs entirely in a Web Worker on an OffscreenCanvas.
 * - Simulation: compute shader (dynamically generated from the ruleset).
 * - Rendering: full-screen quad reading from the grid storage buffer.
 * - Grid: ping-pong between two storage buffers (A and B).
 * - Cells: u8 tribe IDs packed 4-per-u32 in storage buffers.
 * - Toroidal: world wraps in both axes.
 */

import renderWgsl from './render.wgsl';
import {Clause, DEAD_TRIBE, Ruleset, Tribe} from '../model/rule';

// ---------------------------------------------------------------------------
//  Public message contracts
// ---------------------------------------------------------------------------

export interface InitMessage {
  type: 'init';
  canvas: OffscreenCanvas;
  ruleset: Ruleset<readonly Tribe[]>;
  speed: number;
  running: boolean;
}

export interface SetRulesetMessage {
  type: 'setRuleset';
  ruleset: Ruleset<readonly Tribe[]>;
}

export interface SetRunningMessage {
  type: 'setRunning';
  running: boolean;
}

export interface SetSpeedMessage {
  type: 'setSpeed';
  speed: number;
}

export interface DrawMessage {
  type: 'draw';
  x: number;
  y: number;
  size: number;
  shape: 'square' | 'round';
  fill: 'full' | 'spray';
  tribe: string;
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
  | StepForwardMessage;

export interface MetricMessage {
  type: 'metrics';
  generation: number;
  population: Record<string, number>;
  shannonEntropy: number;
  simpsonIndex: number;
  boundaryLength: number;
  meanClusterSize?: Record<string, number>;
  fps: number;
}

export interface SnapshotMessage {
  type: 'snapshot';
  grid: Uint32Array;
  generation: number;
  cols: number;
  rows: number;
}

export interface RecordingMessage {
  type: 'recording';
  frames: Uint8Array[];
  startGeneration: number;
  cols: number;
  rows: number;
}

export interface LimitsMessage {
  type: 'limits';
  maxCells: number;
}

export interface SteppingMessage {
  type: 'stepping';
  active: boolean;
}

// ---------------------------------------------------------------------------
//  WebGPU state
// ---------------------------------------------------------------------------

let device: GPUDevice;
let context: GPUCanvasContext;
let canvasFormat: GPUTextureFormat;
let canvas: OffscreenCanvas;

// Grid data
let ruleset: Ruleset<readonly Tribe[]>;
let cols = 0;
let rows = 0;
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
let pendingBrush: {centerX: number; centerY: number; brushSize: number; shape: number; fill: number; tribeId: number} | null = null;

// CPU shadow for cluster analysis.
let cpuShadow: Uint8Array | null = null;

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
let lastFullReadbackGen = 0;
let lastMetricsGen = -1;
let metricsInFlight = false;
let lastMetricsTime = 0;
let lastClusterData: Record<string, number> | undefined;

// Recording state
let isRecording = true;
let recordedFrames: Uint8Array[] = [];
let recordingStartGen = 0;
let needPreStepCapture = false;

// Optimized recording: persistent double-buffered readback
let recordBufA: GPUBuffer;
let recordBufB: GPUBuffer;
let recordBufToggle = false;
let recordBufAReady = true;
let recordBufBReady = true;

// FPS tracking
let stepCount = 0;
let lastFpsTime = 0;
let currentFps = 0;

// ---------------------------------------------------------------------------
//  Compute shader codegen
// ---------------------------------------------------------------------------

function generateComputeWgsl(): string {
  const lines: string[] = [];

  lines.push('// Auto-generated simulation compute shader.');
  lines.push(`// Tribes: ${tribes.map(t => t.id).join(', ')}`);
  lines.push(`// Rules: ${ruleset.rules.length}`);
  lines.push('');
  lines.push('@group(0) @binding(0) var<storage, read> gridIn: array<u32>;');
  lines.push('@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;');
  lines.push('');
  lines.push(`const COLS: u32 = ${ cols }u;`);
  lines.push(`const ROWS: u32 = ${ rows }u;`);
  lines.push(`const TOTAL: u32 = ${ cols * rows }u;`);
  lines.push('');

  // Helper: read a cell's tribe ID.
  lines.push('fn readCell(idx: u32) -> u32 {');
  lines.push('  return gridIn[idx];');
  lines.push('}');
  lines.push('');

  // Helper: write a cell's tribe ID.
  lines.push('fn writeCell(idx: u32, tribe: u32) {');
  lines.push('  gridOut[idx] = tribe;');
  lines.push('}');
  lines.push('');

  // Main compute function.
  lines.push('@compute @workgroup_size(16, 16)');
  lines.push('fn main(@builtin(global_invocation_id) gid: vec3u) {');
  lines.push('  let x = gid.x;');
  lines.push('  let y = gid.y;');
  lines.push('  if (x >= COLS || y >= ROWS) { return; }');
  lines.push('');
  lines.push('  let idx = y * COLS + x;');
  lines.push('');
  lines.push('  let selfTribe = readCell(idx);');
  lines.push('');

  // Read all 8 neighbors.
  lines.push('  // Neighbor tribe IDs (toroidal wrapping).');
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const name = neighborVarName(dx, dy);
      const xExpr = wrapExpr('x', dx, 'COLS');
      const yExpr = wrapExpr('y', dy, 'ROWS');
      lines.push(`  let ${ name } = readCell(${ yExpr } * COLS + ${ xExpr });`);
    }
  }
  lines.push('');

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
  const deadIdx = tribeIndex.get(DEAD_TRIBE.id) ?? 0;
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
  lines.push('  writeCell(idx, result);');
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
  return cols * rows * 4; // 1 u32 (4 bytes) per cell
}

function createGridBuffers(): void {
  const byteSize = gridBufferSize();

  gridBufferA = device.createBuffer({
    size: byteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  });

  gridBufferB = device.createBuffer({
    size: byteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  });

  const deadIdx = tribeIndex.get(DEAD_TRIBE.id) ?? 0;
  const initData = new Uint32Array(cols * rows);
  initData.fill(deadIdx);
  device.queue.writeBuffer(gridBufferA, 0, initData);
  device.queue.writeBuffer(gridBufferB, 0, initData);

  pingPong = false;
}

function createTribeColorBuffer(): void {
  const data = new Uint32Array(256);
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

// ---------------------------------------------------------------------------
//  Pipeline creation
// ---------------------------------------------------------------------------

function createRenderPipeline(): void {
  const module = device.createShaderModule({code: renderWgsl});

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

const HISTOGRAM_WGSL = `
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = ${0}u; // placeholder, replaced at creation time
const ROWS: u32 = ${0}u; // placeholder, replaced at creation time

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x;
  let y = gid.y;
  if (x >= COLS || y >= ROWS) { return; }
  let tribe = grid[y * COLS + x];
  atomicAdd(&hist[tribe], 1u);
}
`;

function generateBoundaryWgsl(): string {
  return `
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${cols}u;
const ROWS: u32 = ${rows}u;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x;
  let y = gid.y;
  if (x >= COLS || y >= ROWS) { return; }
  let idx = y * COLS + x;
  let self_tribe = grid[idx];

  // Check right neighbor.
  let rx = (x + 1u) % COLS;
  if (grid[y * COLS + rx] != self_tribe) {
    atomicAdd(&boundary, 1u);
  }

  // Check bottom neighbor.
  let by = (y + 1u) % ROWS;
  if (grid[by * COLS + x] != self_tribe) {
    atomicAdd(&boundary, 1u);
  }
}
`;
}

function createMetricsPipelines(): void {
  // Histogram
  const histWgsl = HISTOGRAM_WGSL
    .replace('const COLS: u32 = 0u;', `const COLS: u32 = ${cols}u;`)
    .replace('const ROWS: u32 = 0u;', `const ROWS: u32 = ${rows}u;`);
  const histModule = device.createShaderModule({code: histWgsl});
  histogramPipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {module: histModule,
      entryPoint: 'main'}
  });

  histogramBuffer = device.createBuffer({
    size: 256 * 4, // 256 tribes max
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  histogramReadBuffer = device.createBuffer({
    size: 256 * 4,
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
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  boundaryReadBuffer = device.createBuffer({
    size: 4,
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
//   16: brushSize (u32) 20: shape   (u32)  0=square,1=round
//   24: fill    (u32)   28: tribeId (u32)
//   32: deadId  (u32)   36: seed    (u32)
const BRUSH_UNIFORM_SIZE = 40;

const BRUSH_WGSL = `
struct BrushParams {
  centerX: i32,
  centerY: i32,
  cols: u32,
  rows: u32,
  brushSize: u32,
  shape: u32,
  fill: u32,
  tribeId: u32,
  deadId: u32,
  seed: u32,
}

@group(0) @binding(0) var<storage, read_write> grid: array<u32>;
@group(0) @binding(1) var<uniform> params: BrushParams;

fn pcg(inp: u32) -> u32 {
  var state = inp * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let bx = gid.x;
  let by = gid.y;
  if (bx >= params.brushSize || by >= params.brushSize) { return; }
  let idx = by * params.brushSize + bx;

  let half = i32(params.brushSize - 1u) / 2;
  let dy = i32(by) - half;
  let dx = i32(bx) - half;

  // Round brush: skip cells outside the radius.
  if (params.shape == 1u) {
    let fhalf = f32(params.brushSize - 1u) / 2.0;
    let fdx = f32(dx) - fhalf + f32(half);
    let fdy = f32(dy) - fhalf + f32(half);
    let r = f32(params.brushSize) / 2.0 - 0.25;
    if (fdx * fdx + fdy * fdy > r * r) { return; }
  }

  // Toroidal wrapping.
  let cx = ((params.centerX + dx) % i32(params.cols) + i32(params.cols)) % i32(params.cols);
  let cy = ((params.centerY + dy) % i32(params.rows) + i32(params.rows)) % i32(params.rows);
  let cellIdx = u32(cy) * params.cols + u32(cx);

  // Spray fill: 50% chance to skip/set-dead.
  if (params.fill == 1u) {
    let h = pcg(params.seed ^ idx);
    if ((h & 1u) != 0u) {
      if (params.tribeId != params.deadId) {
        grid[cellIdx] = params.deadId;
      }
      return;
    }
  }

  grid[cellIdx] = params.tribeId;
}
`;

function createBrushPipeline(): void {
  const module = device.createShaderModule({code: BRUSH_WGSL});

  brushPipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {module,
      entryPoint: 'main'}
  });

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

function dispatchBrushOnEncoder(encoder: GPUCommandEncoder, centerX: number, centerY: number, brushSize: number, shape: number, fill: number, tribeId: number): void {
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
  u32View[7] = tribeId;
  u32View[8] = deadId;
  u32View[9] = seed;

  device.queue.writeBuffer(brushUniformBuffer, 0, data);

  const wgBrush = Math.ceil(brushSize / 8);
  const pass = encoder.beginComputePass();
  pass.setPipeline(brushPipeline);
  pass.setBindGroup(0, pingPong ? brushBindGroupB : brushBindGroupA);
  pass.dispatchWorkgroups(wgBrush, wgBrush);
  pass.end();
  // CpuShadow is refreshed by periodic syncShadowFromGpu during metrics.
}

function initCpuShadow(): void {
  cpuShadow = new Uint8Array(cols * rows);
  const deadIdx = tribeIndex.get(DEAD_TRIBE.id) ?? 0;
  cpuShadow.fill(deadIdx);
}

function syncShadowFromGpu(): void {
  if (!cpuShadow) {
    return;
  }

  const currentGrid = pingPong ? gridBufferB : gridBufferA;
  const byteSize = gridBufferSize();

  const readbackBuffer = device.createBuffer({
    size: byteSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });

  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(currentGrid, 0, readbackBuffer, 0, byteSize);
  device.queue.submit([encoder.finish()]);

  readbackBuffer.mapAsync(GPUMapMode.READ).then(() => {
    const data = new Uint32Array(readbackBuffer.getMappedRange());
    for (let i = 0; i < cols * rows; i++) {
      cpuShadow![i] = data[i]!;
    }
    readbackBuffer.unmap();
    readbackBuffer.destroy();
  });
}

function readbackGrid(): Promise<Uint32Array> {
  const currentGrid = pingPong ? gridBufferB : gridBufferA;
  const byteSize = gridBufferSize();

  const readBuffer = device.createBuffer({
    size: byteSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });

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
  // Modulate metrics frequency based on simulation speed.
  // Slow (<=1 fps): every step. Fast (max speed): every ~60 steps.
  if (targetStepDuration <= 0) {
    return 60;
  }
  const stepsPerSecond = 1000 / targetStepDuration;
  return Math.max(1, Math.round(stepsPerSecond));
}

function fullReadbackInterval(): number {
  // Expensive cluster analysis: less often at high speed.
  return Math.max(5, metricsInterval() * 4);
}

function runMetricsGpu(encoder: GPUCommandEncoder): void {
  // Clear histogram buffer.
  const zeros256 = new Uint32Array(256);
  device.queue.writeBuffer(histogramBuffer, 0, zeros256);
  // Clear boundary buffer.
  const zeros1 = new Uint32Array([0]);
  device.queue.writeBuffer(boundaryBuffer, 0, zeros1);

  const wgX = Math.ceil(cols / 16);
  const wgY = Math.ceil(rows / 16);

  // Histogram pass.
  const hp = encoder.beginComputePass();
  hp.setPipeline(histogramPipeline);
  hp.setBindGroup(0, pingPong ? histogramBindGroupB : histogramBindGroupA);
  hp.dispatchWorkgroups(wgX, wgY);
  hp.end();

  // Boundary pass.
  const bp = encoder.beginComputePass();
  bp.setPipeline(boundaryPipeline);
  bp.setBindGroup(0, pingPong ? boundaryBindGroupB : boundaryBindGroupA);
  bp.dispatchWorkgroups(wgX, wgY);
  bp.end();

  // Copy results to read buffers.
  encoder.copyBufferToBuffer(histogramBuffer, 0, histogramReadBuffer, 0, 256 * 4);
  encoder.copyBufferToBuffer(boundaryBuffer, 0, boundaryReadBuffer, 0, 4);
}

function readMetricsAndPost(includeCluster: boolean): void {
  const gen = genCounter;
  if (gen === lastMetricsGen || metricsInFlight) {
    return;
  }
  lastMetricsGen = gen;
  metricsInFlight = true;

  // Read histogram.
  histogramReadBuffer.mapAsync(GPUMapMode.READ).then(() => {
    const histData = new Uint32Array(histogramReadBuffer.getMappedRange().slice(0));
    histogramReadBuffer.unmap();

    return boundaryReadBuffer.mapAsync(GPUMapMode.READ).then(() => {
      const bData = new Uint32Array(boundaryReadBuffer.getMappedRange().slice(0));
      boundaryReadBuffer.unmap();
      metricsInFlight = false;

      const population: Record<string, number> = {};
      let totalAlive = 0;
      const deadIdx = tribeIndex.get(DEAD_TRIBE.id) ?? 0;
      for (let i = 0; i < tribes.length; i++) {
        const count = histData[i] ?? 0;
        population[tribes[i]!.id] = count;
        if (i !== deadIdx) {
          totalAlive += count;
        }
      }

      // Shannon entropy & Simpson index (over non-dead tribes).
      let shannonEntropy = 0;
      let simpsonSum = 0;
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

      // Cluster data: use latest if available.
      if (includeCluster && cpuShadow) {
        lastClusterData = computeClusterSizes();
      }

      self.postMessage({
        type: 'metrics',
        generation: gen,
        population,
        shannonEntropy,
        simpsonIndex: 1 - simpsonSum,
        boundaryLength: bData[0] ?? 0,
        meanClusterSize: lastClusterData,
        fps: currentFps
      } satisfies MetricMessage);
    });
  });
}

function computeClusterSizes(): Record<string, number> {
  if (!cpuShadow) {
    return {};
  }
  const total = cols * rows;
  const visited = new Uint8Array(total);
  const clusterCounts: Map<number, number[]> = new Map();

  for (let i = 0; i < total; i++) {
    if (visited[i]) {
      continue;
    }
    const tribe = cpuShadow[i]!;
    visited[i] = 1;

    // BFS flood-fill.
    let size = 0;
    const queue = [i];
    while (queue.length > 0) {
      const ci = queue.pop()!;
      size++;
      const cx = ci % cols;
      const cy = (ci - cx) / cols;
      // 4-connected neighbors (toroidal).
      const neighbors = [
        ((cy + rows - 1) % rows) * cols + cx,
        ((cy + 1) % rows) * cols + cx,
        cy * cols + ((cx + cols - 1) % cols),
        cy * cols + ((cx + 1) % cols)
      ];
      for (const ni of neighbors) {
        if (!visited[ni] && cpuShadow[ni] === tribe) {
          visited[ni] = 1;
          queue.push(ni);
        }
      }
    }

    if (!clusterCounts.has(tribe)) {
      clusterCounts.set(tribe, []);
    }
    clusterCounts.get(tribe)!.push(size);
  }

  const result: Record<string, number> = {};
  for (const [tribeIdx, sizes] of clusterCounts) {
    if (tribeIdx < tribes.length) {
      const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      result[tribes[tribeIdx]!.id] = mean;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
//  Simulation step
// ---------------------------------------------------------------------------

function stepSimulation(): void {
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(computePipeline);
  pass.setBindGroup(0, pingPong ? computeBindGroupBtoA : computeBindGroupAtoB);

  const wgX = Math.ceil(cols / 16);
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
  // Apply coalesced brush draw (one per frame max).
  if (pendingBrush) {
    const b = pendingBrush;
    pendingBrush = null;
    const encoder = device.createCommandEncoder();
    dispatchBrushOnEncoder(encoder, b.centerX, b.centerY, b.brushSize, b.shape, b.fill, b.tribeId);
    device.queue.submit([encoder.finish()]);
  }

  // Capture current state before the first step when recording.
  if (isRecording && needPreStepCapture) {
    needPreStepCapture = false;
    readbackGrid().then(grid => {
      const frame = new Uint8Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        frame[i] = grid[i]!;
      }
      const idx = genCounter - recordingStartGen;
      if (idx >= 0 && idx < recordedFrames.length) {
        recordedFrames[idx] = frame;
      } else {
        recordedFrames.push(frame);
      }
      recordedFrames.length = idx + 1;
    });
  }

  // FPS tracking.
  if (lastFpsTime === 0) {
    lastFpsTime = now;
  }
  const fpsElapsed = now - lastFpsTime;
  if (fpsElapsed >= 1000) {
    currentFps = stepCount / (fpsElapsed / 1000);
    stepCount = 0;
    lastFpsTime = now;
  }

  if (simulationRunning) {
    let didStep = false;
    if (lastFrameTime === 0) {
      lastFrameTime = now;
    }
    const delta = now - lastFrameTime;
    lastFrameTime = now;

    const mi = metricsInterval();

    if (targetStepDuration <= 0) {
      // Max speed: run as many steps as fit in a ~14 ms budget per frame.
      // Break at metrics boundaries to keep metrics on precise multiples.
      const deadline = performance.now() + 14;
      while (performance.now() < deadline) {
        stepSimulation();
        stepCount++;
        if (genCounter % mi === 0) {
          break;
        }
      }
      didStep = true;
    } else {
      // Accumulate elapsed time and step as many times as needed.
      stepAccumulator += delta;
      while (stepAccumulator >= targetStepDuration) {
        stepSimulation();
        stepCount++;
        stepAccumulator -= targetStepDuration;
        didStep = true;
      }
    }

    if (didStep) {
    // Record frame using persistent double-buffered readback.
      if (isRecording) {
        const useBufA = !recordBufToggle;
        const buf = useBufA ? recordBufA : recordBufB;
        const ready = useBufA ? recordBufAReady : recordBufBReady;

        if (ready) {
          const currentGrid = pingPong ? gridBufferB : gridBufferA;
          const byteSize = gridBufferSize();
          const copyEncoder = device.createCommandEncoder();
          copyEncoder.copyBufferToBuffer(currentGrid, 0, buf, 0, byteSize);
          device.queue.submit([copyEncoder.finish()]);

          if (useBufA) {
            recordBufAReady = false;
          } else {
            recordBufBReady = false;
          }

          buf.mapAsync(GPUMapMode.READ).then(() => {
            const data = new Uint32Array(buf.getMappedRange());
            const frame = new Uint8Array(cols * rows);
            for (let i = 0; i < cols * rows; i++) {
              frame[i] = data[i]!;
            }
            buf.unmap();
            if (useBufA) {
              recordBufAReady = true;
            } else {
              recordBufBReady = true;
            }
            recordedFrames.push(frame);
          });

          recordBufToggle = !recordBufToggle;
        }
      }

      if (genCounter % mi === 0 || genCounter - lastMetricsGen >= mi * 2) {
        // Only update metrics ~once per second.
        const metricsElapsed = now - lastMetricsTime;
        if ((metricsElapsed >= 1000 || lastMetricsTime === 0) && !metricsInFlight) {
          lastMetricsTime = now;
          // Run GPU metrics passes and submit together.
          const encoder = device.createCommandEncoder();
          runMetricsGpu(encoder);
          device.queue.submit([encoder.finish()]);

          const fri = fullReadbackInterval();
          const doCluster = genCounter - lastFullReadbackGen >= fri;
          if (doCluster) {
            syncShadowFromGpu();
            lastFullReadbackGen = genCounter;
          }
          readMetricsAndPost(doCluster);
        }
      }
    } // DidStep
  }

  // Skip rendering in max speed mode to avoid UI lag.
  if (targetStepDuration > 0) {
    renderFrame();
  }
  self.requestAnimationFrame(mainLoop);
}

// ---------------------------------------------------------------------------
//  Initialization
// ---------------------------------------------------------------------------

function initRuleset(rs: Ruleset<readonly Tribe[]>): void {
  ruleset = rs;
  cols = rs.cols;
  rows = rs.rows;
  tribes = [...rs.tribes];

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

  const maxCells = Math.floor(device.limits.maxBufferSize / 4);
  self.postMessage({type: 'limits',
    maxCells} satisfies LimitsMessage);

  context = canvas.getContext('webgpu') as GPUCanvasContext;
  canvasFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: canvasFormat,
    alphaMode: 'opaque'
  });
}

function createRecordBuffers(): void {
  const byteSize = gridBufferSize();
  recordBufA = device.createBuffer({
    size: byteSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });
  recordBufB = device.createBuffer({
    size: byteSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });
  recordBufToggle = false;
  recordBufAReady = true;
  recordBufBReady = true;
}

function buildPipelines(): void {
  uniformBuffer = device.createBuffer({
    size: UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  createGridBuffers();
  createTribeColorBuffer();
  initCpuShadow();

  createRenderPipeline();
  createRenderBindGroups();
  createComputePipeline();
  createBrushPipeline();
  createMetricsPipelines();
  createRecordBuffers();
}

function rebuildForNewRuleset(): void {
  gridBufferA?.destroy();
  gridBufferB?.destroy();
  histogramBuffer?.destroy();
  histogramReadBuffer?.destroy();
  boundaryBuffer?.destroy();
  boundaryReadBuffer?.destroy();
  recordBufA?.destroy();
  recordBufB?.destroy();

  createGridBuffers();
  createTribeColorBuffer();
  initCpuShadow();
  createComputePipeline();
  createBrushPipeline();
  createRenderBindGroups();
  createMetricsPipelines();
  createRecordBuffers();
  lastClusterData = undefined;
  recordedFrames = [];
  recordingStartGen = genCounter;
}

// ---------------------------------------------------------------------------
//  Message handler
// ---------------------------------------------------------------------------

self.onmessage = async(ev: MessageEvent<WorkerMessage>) => {
  const m = ev.data;
  switch (m.type) {
    case 'init': {
      initRuleset(m.ruleset);
      await initWebGPU(m.canvas);
      buildPipelines();

      simulationRunning = m.running;
      targetStepDuration = m.speed < 0 ? 0 : 1000 / m.speed;
      lastFrameTime = 0;
      stepAccumulator = 0;

      self.requestAnimationFrame(mainLoop);
      break;
    }

    case 'setRuleset': {
      initRuleset(m.ruleset);
      rebuildForNewRuleset();
      genCounter = 0;
      lastMetricsGen = -1;
      recordedFrames = [];
      recordingStartGen = 0;
      needPreStepCapture = false;
      // Post initial metrics for the fresh (empty) grid.
      if (!metricsInFlight) {
        const resetEncoder = device.createCommandEncoder();
        runMetricsGpu(resetEncoder);
        device.queue.submit([resetEncoder.finish()]);
        readMetricsAndPost(true);
      }
      break;
    }

    case 'setRunning':
      simulationRunning = m.running;
      if (m.running) {
        lastFrameTime = 0;
        stepAccumulator = 0;
        if (isRecording) {
          needPreStepCapture = true;
        }
      }
      break;

    case 'setSpeed':
      targetStepDuration = m.speed < 0 ? 0 : 1000 / m.speed;
      stepAccumulator = 0;
      break;

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
      const idx = tribeIndex.get(m.tribe);
      if (idx !== undefined) {
        pendingBrush = {
          centerX: m.x,
          centerY: m.y,
          brushSize: m.size,
          shape: m.shape === 'round' ? 1 : 0,
          fill: m.fill === 'spray' ? 1 : 0,
          tribeId: idx
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
          rows
        } satisfies SnapshotMessage, {transfer: [grid.buffer]});
      });
      break;
    }

    case 'loadSnapshot': {
      const currentGrid = pingPong ? gridBufferB : gridBufferA;
      device.queue.writeBuffer(currentGrid, 0, m.grid);
      if (cpuShadow) {
        for (let i = 0; i < m.grid.length; i++) {
          cpuShadow[i] = m.grid[i]!;
        }
      }
      genCounter = m.generation;
      lastClusterData = undefined;
      break;
    }

    case 'setRecording': {
      if (m.recording && !isRecording) {
        isRecording = true;
        recordedFrames = [];
        recordingStartGen = genCounter;
        needPreStepCapture = true;
      } else if (!m.recording) {
        isRecording = false;
      }
      break;
    }

    case 'getRecording': {
      // Copy frames so the originals stay intact for future downloads.
      const frames = recordedFrames.map(f => new Uint8Array(f));
      const transferables = frames.map(f => f.buffer);
      self.postMessage({
        type: 'recording',
        frames,
        startGeneration: recordingStartGen,
        cols,
        rows
      } satisfies RecordingMessage, {transfer: transferables as Transferable[]});
      break;
    }

    case 'stepBack': {
      const k = Math.min(m.count, recordedFrames.length - 1);
      if (k <= 0) {
        break;
      }
      recordedFrames.splice(recordedFrames.length - k, k);
      const lastFrame = recordedFrames[recordedFrames.length - 1]!;
      const gridData = new Uint32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        gridData[i] = lastFrame[i]!;
      }
      const currentGrid = pingPong ? gridBufferB : gridBufferA;
      device.queue.writeBuffer(currentGrid, 0, gridData);
      if (cpuShadow) {
        for (let i = 0; i < cols * rows; i++) {
          cpuShadow[i] = lastFrame[i]!;
        }
      }
      genCounter = recordingStartGen + recordedFrames.length - 1;
      lastClusterData = undefined;
      lastMetricsGen = -1;
      if (!metricsInFlight) {
        const bEncoder = device.createCommandEncoder();
        runMetricsGpu(bEncoder);
        device.queue.submit([bEncoder.finish()]);
        readMetricsAndPost(true);
      }
      renderFrame();
      break;
    }

    case 'stepForward': {
      const doForward = async() => {
        if (m.count > 1) {
          self.postMessage({type: 'stepping',
            active: true} satisfies SteppingMessage);
        }
        if (isRecording) {
          // Save current state before stepping (handles gen0 + drawing overwrites).
          const preGrid = await readbackGrid();
          const preFrame = new Uint8Array(cols * rows);
          for (let j = 0; j < cols * rows; j++) {
            preFrame[j] = preGrid[j]!;
          }
          const idx = genCounter - recordingStartGen;
          if (idx >= 0 && idx < recordedFrames.length) {
            recordedFrames[idx] = preFrame;
          } else {
            recordedFrames.push(preFrame);
          }
          recordedFrames.length = idx + 1;
        }
        // Run steps: record each intermediate frame but skip canvas rendering.
        for (let i = 0; i < m.count; i++) {
          stepSimulation();
          stepCount++;
          if (isRecording) {
            const grid = await readbackGrid();
            const frame = new Uint8Array(cols * rows);
            for (let j = 0; j < cols * rows; j++) {
              frame[j] = grid[j]!;
            }
            recordedFrames.push(frame);
          }
        }
        lastMetricsGen = -1;
        if (!metricsInFlight) {
          const fEncoder = device.createCommandEncoder();
          runMetricsGpu(fEncoder);
          device.queue.submit([fEncoder.finish()]);
          readMetricsAndPost(true);
        }
        renderFrame();
        if (m.count > 1) {
          self.postMessage({type: 'stepping',
            active: false} satisfies SteppingMessage);
        }
      };
      doForward();
      break;
    }
  }
};
