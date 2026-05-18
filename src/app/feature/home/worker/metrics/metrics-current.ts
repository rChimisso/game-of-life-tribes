import {
  BuildMetricMessageRequest,
  CreateInteractiveMetricsResourcesRequest,
  EncodeInteractiveMetricsRequest,
  InteractiveMetricMessage,
  InteractiveMetricsReadback,
  InteractiveMetricsResources,
  MetricsDispatchPlan2D,
  ReadInteractiveMetricsRequest
} from './metrics-types';
import {hasInteractiveMetricSection} from './metrics-planner';

export const HISTOGRAM_BUFFER_SIZE = 256 * Uint32Array.BYTES_PER_ELEMENT;
export const BOUNDARY_BUFFER_SIZE = Uint32Array.BYTES_PER_ELEMENT;

function dispatchConstantsWgsl(dispatchPlan: MetricsDispatchPlan2D): string {
  if (!dispatchPlan.remapped) {
    return '';
  }
  return `
const LOGICAL_WG_X: u32 = ${dispatchPlan.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${dispatchPlan.dispatchWgX}u;
`;
}

function metricsMainSignatureWgsl(dispatchPlan: MetricsDispatchPlan2D): string {
  if (dispatchPlan.remapped) {
    return `fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`;
  }
  return `fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`;
}

function metricsCoordinateWgsl(dispatchPlan: MetricsDispatchPlan2D): string {
  if (dispatchPlan.remapped) {
    return `  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`;
  }
  return `  let x = gid.x;
  let y = gid.y;`;
}

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

export function createInteractiveMetricsResources(request: CreateInteractiveMetricsResourcesRequest): InteractiveMetricsResources {
  const {device} = request;
  const histModule = device.createShaderModule({code: generateHistogramWgsl(request)});
  const histogramPipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {module: histModule, entryPoint: 'main'}
  });
  const histogramBuffer = device.createBuffer({
    size: HISTOGRAM_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  const histogramReadBuffer = device.createBuffer({size: HISTOGRAM_BUFFER_SIZE, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST});

  const boundaryModule = device.createShaderModule({code: generateBoundaryWgsl(request)});
  const boundaryPipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {module: boundaryModule, entryPoint: 'main'}
  });
  const boundaryBuffer = device.createBuffer({size: BOUNDARY_BUFFER_SIZE, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST});
  const boundaryReadBuffer = device.createBuffer({size: BOUNDARY_BUFFER_SIZE, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST});

  return {
    histogramPipeline,
    histogramBuffer,
    histogramReadBuffer,
    boundaryPipeline,
    boundaryBuffer,
    boundaryReadBuffer
  };
}

export function destroyInteractiveMetricsResources(resources: InteractiveMetricsResources | null): void {
  resources?.histogramBuffer.destroy();
  resources?.histogramReadBuffer.destroy();
  resources?.boundaryBuffer.destroy();
  resources?.boundaryReadBuffer.destroy();
}

export function encodeInteractiveMetrics(request: EncodeInteractiveMetricsRequest): void {
  const {device, encoder, resources, sourceBuffer, dispatchPlan, enabledSections} = request;
  if (hasInteractiveMetricSection(enabledSections, 'population') || hasInteractiveMetricSection(enabledSections, 'diversity')) {
    const zeros256 = new Uint32Array(256);
    device.queue.writeBuffer(resources.histogramBuffer, 0, zeros256);
    const bindGroup = device.createBindGroup({
      layout: resources.histogramPipeline.getBindGroupLayout(0),
      entries: [{binding: 0, resource: {buffer: sourceBuffer} }, {binding: 1, resource: {buffer: resources.histogramBuffer} }]
    });
    const pass = encoder.beginComputePass();
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
    const pass = encoder.beginComputePass();
    pass.setPipeline(resources.boundaryPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(dispatchPlan.dispatchWgX, dispatchPlan.dispatchWgY);
    pass.end();
    encoder.copyBufferToBuffer(resources.boundaryBuffer, 0, resources.boundaryReadBuffer, 0, BOUNDARY_BUFFER_SIZE);
  }
}

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

export function buildInteractiveMetricMessage(request: BuildMetricMessageRequest): InteractiveMetricMessage {
  const {generation, tribes, deadTribeIndex, readback, enabledSections, availability, liveMetricSettings, cols, rows, totalFrames, fps, canStepBack, recordingBytes, recordingRawBytes} = request;
  const populationEnabled = hasInteractiveMetricSection(enabledSections, 'population') && liveMetricSettings.population;
  const diversityEnabled = hasInteractiveMetricSection(enabledSections, 'diversity') && liveMetricSettings.diversity;
  const interfacesEnabled = hasInteractiveMetricSection(enabledSections, 'interfaces') && liveMetricSettings.interfaces;
  const population: Record<string, number> = {};
  let shannonEntropy = 0;
  let simpsonSum = 0;
  const extinctionTime: Record<string, number | null> = {};
  let totalAlive = 0;
  const totalCells = cols * rows;

  for (let i = 0; i < tribes.length; i++) {
    const count = populationEnabled ? readback.histogram[i] ?? 0 : 0;
    population[tribes[i]!.id] = count;
    if (i !== deadTribeIndex) {
      totalAlive += count;
    }
  }

  if (diversityEnabled) {
    totalAlive = 0;
    for (let i = 0; i < tribes.length; i++) {
      if (i !== deadTribeIndex) {
        totalAlive += readback.histogram[i] ?? 0;
      }
    }
  }

  if (diversityEnabled && totalAlive > 0) {
    for (let i = 0; i < tribes.length; i++) {
      if (i === deadTribeIndex) {
        continue;
      }
      const p = (readback.histogram[i] ?? 0) / totalAlive;
      if (p > 0) {
        shannonEntropy -= p * Math.log2(p);
        simpsonSum += p * p;
      }
    }
  }

  for (let i = 0; i < tribes.length; i++) {
    if (i === deadTribeIndex) {
      continue;
    }
    extinctionTime[tribes[i]!.id] = 0;
  }

  const deadCells = populationEnabled ? population[tribes[deadTribeIndex]?.id ?? ''] ?? 0 : 0;
  const aliveCells = populationEnabled ? Math.max(0, totalCells - deadCells) : 0;
  const totalContactEdges = totalCells * 2;
  const crossStateContactEdges = interfacesEnabled ? readback.crossStateContactEdges : 0;
  const sameStateContactEdges = interfacesEnabled ? Math.max(0, totalContactEdges - crossStateContactEdges) : 0;
  const interfaces = {
    sameStateContactEdges,
    crossStateContactEdges,
    sameStateContactFraction: interfacesEnabled && totalContactEdges > 0 ? sameStateContactEdges / totalContactEdges : 0,
    crossStateContactFraction: interfacesEnabled && totalContactEdges > 0 ? crossStateContactEdges / totalContactEdges : 0
  };

  return {
    type: 'metrics',
    generation,
    population,
    aliveCells,
    deadCells,
    occupancy: populationEnabled && totalCells > 0 ? aliveCells / totalCells : 0,
    shannonEntropy,
    simpsonIndex: diversityEnabled ? 1 - simpsonSum : 0,
    interfaces,
    metricsAvailability: availability,
    extinctionTime,
    totalFrames,
    fps,
    canStepBack,
    recordingBytes,
    recordingRawBytes
  };
}
