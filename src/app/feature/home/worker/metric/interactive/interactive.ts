import {LiveDiversityStats, LivePopulationStats} from './live-stats-types';
import {hasInteractiveMetricSection} from './planner';
import {BuildMetricMessageRequest, CreateInteractiveMetricsResourcesRequest, EncodeInteractiveMetricsRequest, InteractiveMetricMessage, InteractiveMetricsReadback, InteractiveMetricsResources, MetricsDispatchPlan2D, ReadInteractiveMetricsRequest} from './types';
import {GPU_LABELS} from '../../gpu/gpu-labels';

/**
 * Builds dispatch constants for remapped metrics dispatches.
 *
 * @param {MetricsDispatchPlan2D} dispatchPlan metrics dispatch plan.
 * @returns {string} WGSL constants.
 */
function dispatchConstantsWgsl(dispatchPlan: MetricsDispatchPlan2D): string {
  return dispatchPlan.remapped ? `
const LOGICAL_WG_X: u32 = ${dispatchPlan.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${dispatchPlan.dispatchWgX}u;
` : '';
}

/**
 * Builds the WGSL main signature for a metrics shader.
 *
 * @param {MetricsDispatchPlan2D} dispatchPlan metrics dispatch plan.
 * @returns {string} WGSL main signature.
 */
function metricsMainSignatureWgsl(dispatchPlan: MetricsDispatchPlan2D): string {
  return dispatchPlan.remapped ? `fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {` : `fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`;
}

/**
 * Builds WGSL coordinate calculation for a metrics shader.
 *
 * @param {MetricsDispatchPlan2D} dispatchPlan metrics dispatch plan.
 * @returns {string} WGSL coordinate calculation.
 */
function metricsCoordinateWgsl(dispatchPlan: MetricsDispatchPlan2D): string {
  return dispatchPlan.remapped ? `  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;` : `  let x = gid.x;
  let y = gid.y;`;
}

/**
 * Generates the histogram metrics shader.
 *
 * @param {CreateInteractiveMetricsResourcesRequest} request resource creation request.
 * @returns {string} WGSL shader source.
 */
function generateHistogramWgsl(request: CreateInteractiveMetricsResourcesRequest): string {
  const {cols, rows, gridFormat, dispatchPlan} = request;
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
${dispatchConstantsWgsl(dispatchPlan)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${metricsMainSignatureWgsl(dispatchPlan)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${metricsCoordinateWgsl(dispatchPlan)}
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

/**
 * Generates the boundary metrics shader.
 *
 * @param {CreateInteractiveMetricsResourcesRequest} request resource creation request.
 * @returns {string} WGSL shader source.
 */
function generateBoundaryWgsl(request: CreateInteractiveMetricsResourcesRequest): string {
  const {cols, rows, gridFormat, dispatchPlan} = request;
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
${dispatchConstantsWgsl(dispatchPlan)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${metricsMainSignatureWgsl(dispatchPlan)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${metricsCoordinateWgsl(dispatchPlan)}
  if (x < COLS && y < ROWS) {
    var edges = 0u;
    let self_tribe = readCell(x, y);

    if (readCell((x + 1u) % COLS, y) != self_tribe) {
      edges += 1u;
    }

    if (readCell(x, (y + 1u) % ROWS) != self_tribe) {
      edges += 1u;
    }

    if (edges > 0u) {
      atomicAdd(&localCount, edges);
    }
  }
  workgroupBarrier();

  if (lid == 0u) {
    let sum = atomicLoad(&localCount);
    if (sum > 0u) {
      atomicAdd(&boundary, sum);
    }
  }
}
`;
}
/**
 * Computes live population stats.
 *
 * @param {BuildMetricMessageRequest} request metric message request.
 * @param {boolean} populationEnabled whether population metrics are enabled.
 * @returns {LivePopulationStats} population stats.
 */
function computeLivePopulationStats(request: BuildMetricMessageRequest, populationEnabled: boolean): LivePopulationStats {
  const {tribes, deadTribeIndex, readback, cols, rows} = request;
  const totalCells = cols * rows;
  const population: Record<string, number> = {};
  for (let i = 0; i < tribes.length; i++) {
    const count = populationEnabled ? readback.histogram[i] ?? 0 : 0;
    population[tribes[i]!.id] = count;
  }
  const deadCells = populationEnabled ? population[tribes[deadTribeIndex]?.id ?? ''] ?? 0 : 0;
  return {
    population,
    aliveCells: populationEnabled ? Math.max(0, totalCells - deadCells) : 0,
    deadCells
  };
}

/**
 * Computes the total live cells used by diversity metrics.
 *
 * @param {BuildMetricMessageRequest} request metric message request.
 * @returns {number} total live cells.
 */
function computeDiversityAliveCells(request: BuildMetricMessageRequest): number {
  const {tribes, deadTribeIndex, readback} = request;
  let totalAlive = 0;
  for (let i = 0; i < tribes.length; i++) {
    if (i !== deadTribeIndex) {
      totalAlive += readback.histogram[i] ?? 0;
    }
  }
  return totalAlive;
}

/**
 * Computes live diversity stats.
 *
 * @param {BuildMetricMessageRequest} request metric message request.
 * @param {boolean} diversityEnabled whether diversity metrics are enabled.
 * @returns {LiveDiversityStats} diversity stats.
 */
function computeLiveDiversityStats(request: BuildMetricMessageRequest, diversityEnabled: boolean): LiveDiversityStats {
  const {tribes, deadTribeIndex, readback} = request;
  const totalAlive = diversityEnabled ? computeDiversityAliveCells(request) : 0;
  let shannonEntropy = 0;
  let simpsonSum = 0;
  for (let i = 0; i < tribes.length; i++) {
    const probability = i !== deadTribeIndex && totalAlive > 0 ? (readback.histogram[i] ?? 0) / totalAlive : 0;
    if (probability > 0) {
      shannonEntropy -= probability * Math.log2(probability);
      simpsonSum += probability * probability;
    }
  }
  return {shannonEntropy, simpsonSum};
}

/**
 * Builds live interface metrics.
 *
 * @param {BuildMetricMessageRequest} request metric message request.
 * @param {boolean} interfacesEnabled whether interface metrics are enabled.
 * @returns {NonNullable<InteractiveMetricMessage['interfaces']>} interface metrics.
 */
function buildLiveInterfaceMetrics(request: BuildMetricMessageRequest, interfacesEnabled: boolean): NonNullable<InteractiveMetricMessage['interfaces']> {
  const totalContactEdges = request.cols * request.rows * 2;
  const crossStateContactEdges = interfacesEnabled ? request.readback.crossStateContactEdges : 0;
  const sameStateContactEdges = interfacesEnabled ? Math.max(0, totalContactEdges - crossStateContactEdges) : 0;
  return {
    sameStateContactEdges,
    crossStateContactEdges,
    sameStateContactFraction: interfacesEnabled && totalContactEdges > 0 ? sameStateContactEdges / totalContactEdges : 0,
    crossStateContactFraction: interfacesEnabled && totalContactEdges > 0 ? crossStateContactEdges / totalContactEdges : 0
  };
}

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
 * Creates live metric WebGPU resources.
 *
 * @param {CreateInteractiveMetricsResourcesRequest} request resource creation request.
 * @returns {InteractiveMetricsResources} live metric GPU resources.
 */
export function createInteractiveMetricsResources(request: CreateInteractiveMetricsResourcesRequest): InteractiveMetricsResources {
  const {device} = request;
  const histModule = device.createShaderModule({label: GPU_LABELS.histogramMetricsShaderModule, code: generateHistogramWgsl(request)});
  const histogramPipeline = device.createComputePipeline({
    label: GPU_LABELS.histogramMetricsPipeline,
    layout: 'auto',
    compute: {module: histModule, entryPoint: 'main'}
  });
  const histogramBuffer = device.createBuffer({
    label: GPU_LABELS.histogramMetricsBuffer,
    size: HISTOGRAM_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  const histogramReadBuffer = device.createBuffer({
    label: GPU_LABELS.histogramMetricsReadBuffer,
    size: HISTOGRAM_BUFFER_SIZE,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });
  const boundaryModule = device.createShaderModule({label: GPU_LABELS.interfaceMetricsShaderModule, code: generateBoundaryWgsl(request)});
  const boundaryPipeline = device.createComputePipeline({
    label: GPU_LABELS.interfaceMetricsPipeline,
    layout: 'auto',
    compute: {module: boundaryModule, entryPoint: 'main'}
  });
  const boundaryBuffer = device.createBuffer({
    label: GPU_LABELS.interfaceMetricsBuffer,
    size: BOUNDARY_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  const boundaryReadBuffer = device.createBuffer({
    label: GPU_LABELS.interfaceMetricsReadBuffer,
    size: BOUNDARY_BUFFER_SIZE,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });
  return {
    histogramPipeline,
    histogramBuffer,
    histogramReadBuffer,
    boundaryPipeline,
    boundaryBuffer,
    boundaryReadBuffer
  };
}

/**
 * Destroys live metric WebGPU resources.
 *
 * @param {(InteractiveMetricsResources | null)} resources live metric GPU resources.
 */
export function destroyInteractiveMetricsResources(resources: InteractiveMetricsResources | null): void {
  resources?.histogramBuffer.destroy();
  resources?.histogramReadBuffer.destroy();
  resources?.boundaryBuffer.destroy();
  resources?.boundaryReadBuffer.destroy();
}

/**
 * Encodes live metric GPU work into a command encoder.
 *
 * @param {EncodeInteractiveMetricsRequest} request encode request.
 */
export function encodeInteractiveMetrics(request: EncodeInteractiveMetricsRequest): void {
  const {device, encoder, resources, sourceBuffer, dispatchPlan, enabledSections} = request;
  if (hasInteractiveMetricSection(enabledSections, 'population') || hasInteractiveMetricSection(enabledSections, 'diversity')) {
    const zeros256 = new Uint32Array(256);
    device.queue.writeBuffer(resources.histogramBuffer, 0, zeros256);
    const bindGroup = device.createBindGroup({
      layout: resources.histogramPipeline.getBindGroupLayout(0),
      entries: [{binding: 0, resource: {buffer: sourceBuffer} }, {binding: 1, resource: {buffer: resources.histogramBuffer} }]
    });
    const pass = encoder.beginComputePass({label: GPU_LABELS.histogramMetricsPass});
    pass.setPipeline(resources.histogramPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(dispatchPlan.dispatchWgX, dispatchPlan.dispatchWgY);
    pass.end();
    encoder.copyBufferToBuffer(resources.histogramBuffer, 0, resources.histogramReadBuffer, 0, HISTOGRAM_BUFFER_SIZE);
  }
  if (hasInteractiveMetricSection(enabledSections, 'interfaces')) {
    const zeros1 = new Uint32Array([0]);
    device.queue.writeBuffer(resources.boundaryBuffer, 0, zeros1);
    const bindGroup = device.createBindGroup({
      layout: resources.boundaryPipeline.getBindGroupLayout(0),
      entries: [{binding: 0, resource: {buffer: sourceBuffer} }, {binding: 1, resource: {buffer: resources.boundaryBuffer} }]
    });
    const pass = encoder.beginComputePass({label: GPU_LABELS.interfaceMetricsPass});
    pass.setPipeline(resources.boundaryPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(dispatchPlan.dispatchWgX, dispatchPlan.dispatchWgY);
    pass.end();
    encoder.copyBufferToBuffer(resources.boundaryBuffer, 0, resources.boundaryReadBuffer, 0, BOUNDARY_BUFFER_SIZE);
  }
}

/**
 * Reads live metric GPU outputs.
 *
 * @async
 * @param {ReadInteractiveMetricsRequest} request readback request.
 * @returns {Promise<InteractiveMetricsReadback>} live metric readback.
 */
export async function readInteractiveMetrics(request: ReadInteractiveMetricsRequest): Promise<InteractiveMetricsReadback> {
  const {resources, enabledSections} = request;
  const needsHistogram = hasInteractiveMetricSection(enabledSections, 'population') || hasInteractiveMetricSection(enabledSections, 'diversity');
  const needsBoundary = hasInteractiveMetricSection(enabledSections, 'interfaces');
  const mapPromises: Promise<void>[] = [];
  if (needsHistogram) {
    mapPromises.push(resources.histogramReadBuffer.mapAsync(GPUMapMode.READ));
  }
  if (needsBoundary) {
    mapPromises.push(resources.boundaryReadBuffer.mapAsync(GPUMapMode.READ));
  }
  await Promise.all(mapPromises);

  let histogram = new Uint32Array(256);
  if (needsHistogram) {
    histogram = new Uint32Array(resources.histogramReadBuffer.getMappedRange().slice(0));
    resources.histogramReadBuffer.unmap();
  }

  let crossStateContactEdges = 0;
  if (needsBoundary) {
    const bData = new Uint32Array(resources.boundaryReadBuffer.getMappedRange().slice(0));
    resources.boundaryReadBuffer.unmap();
    crossStateContactEdges = bData[0] ?? 0;
  }
  return {histogram, crossStateContactEdges};
}

/**
 * Builds a live metric message from GPU readback.
 *
 * @param {BuildMetricMessageRequest} request metric message request.
 * @returns {InteractiveMetricMessage} live metric message.
 */
export function buildInteractiveMetricMessage(request: BuildMetricMessageRequest): InteractiveMetricMessage {
  const {generation, enabledSections, availability, liveMetricSettings, cols, rows, totalFrames, fps, canStepBack, recordingBytes, recordingRawBytes} = request;
  const populationEnabled = hasInteractiveMetricSection(enabledSections, 'population') && liveMetricSettings.population;
  const diversityEnabled = hasInteractiveMetricSection(enabledSections, 'diversity') && liveMetricSettings.diversity;
  const interfacesEnabled = hasInteractiveMetricSection(enabledSections, 'interfaces') && liveMetricSettings.interfaces;
  const totalCells = cols * rows;
  const populationStats = computeLivePopulationStats(request, populationEnabled);
  const diversityStats = computeLiveDiversityStats(request, diversityEnabled);
  const interfaces = buildLiveInterfaceMetrics(request, interfacesEnabled);
  return {
    type: 'metrics',
    generation,
    population: populationStats.population,
    aliveCells: populationStats.aliveCells,
    deadCells: populationStats.deadCells,
    occupancy: populationEnabled && totalCells > 0 ? populationStats.aliveCells / totalCells : 0,
    shannonEntropy: diversityStats.shannonEntropy,
    simpsonIndex: diversityEnabled ? 1 - diversityStats.simpsonSum : 0,
    interfaces,
    metricsAvailability: availability,
    extinctionTime: {},
    totalFrames,
    fps,
    canStepBack,
    recordingBytes,
    recordingRawBytes
  };
}
