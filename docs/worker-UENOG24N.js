var Cr="goltTimestampedConsoleInstalled";function kn(){let e=globalThis;e[Cr]||(e[Cr]=!0,xt("log"),xt("warn"),xt("error"))}function xt(e){let t=console[e].bind(console);console[e]=(...r)=>{t(`[${new Date().toISOString()}]`,...r)}}kn();async function vr(e,t){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let r=await navigator.gpu.requestAdapter();if(!r)throw new Error("WebGPU adapter is unavailable.");return t?.(r.limits),r.requestDevice({label:e,requiredLimits:{maxBufferSize:r.limits.maxBufferSize,maxStorageBufferBindingSize:r.limits.maxStorageBufferBindingSize}})}var f={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var _r=4294967295;function K(e,t){return e.includes(t)}function Tt(e,t){let r;return e?r=t?"ok":"tooLarge":r="disabled",r}function Pr(e,t,r,n){let i=e*t,o=i<=_r,a=i*2<=_r;return{population:Tt(r&&n.population,o),diversity:Tt(r&&n.diversity,o),interfaces:Tt(r&&n.interfaces,a)}}function Rr(e){let t=[];return e.population==="ok"&&t.push("population"),e.diversity==="ok"&&t.push("diversity"),e.interfaces==="ok"&&t.push("interfaces"),t}var Pe=256*Uint32Array.BYTES_PER_ELEMENT,Re=Uint32Array.BYTES_PER_ELEMENT;function Mr(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function Br(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function Er(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function xn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = ${t}u;
const ROWS: u32 = ${r}u;
const CELLS_PER_WORD: u32 = ${n.cellsPerWord}u;
const WORD_SHIFT: u32 = ${n.wordShift}u;
const CELL_SHIFT: u32 = ${n.cellShift}u;
const CELL_INDEX_MASK: u32 = ${n.cellIndexMask}u;
const CELL_MASK: u32 = ${n.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
${Mr(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Br(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${Er(i)}
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
`}function Tn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${t}u;
const ROWS: u32 = ${r}u;
const CELLS_PER_WORD: u32 = ${n.cellsPerWord}u;
const WORD_SHIFT: u32 = ${n.wordShift}u;
const CELL_SHIFT: u32 = ${n.cellShift}u;
const CELL_INDEX_MASK: u32 = ${n.cellIndexMask}u;
const CELL_MASK: u32 = ${n.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
${Mr(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Br(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${Er(i)}
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
`}function wr(e){let{device:t}=e,r=t.createShaderModule({label:f.histogramMetricsShaderModule,code:xn(e)}),n=t.createComputePipeline({label:f.histogramMetricsPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),i=t.createBuffer({label:f.histogramMetricsBuffer,size:Pe,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=t.createBuffer({label:f.histogramMetricsReadBuffer,size:Pe,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),a=t.createShaderModule({label:f.interfaceMetricsShaderModule,code:Tn(e)}),c=t.createComputePipeline({label:f.interfaceMetricsPipeline,layout:"auto",compute:{module:a,entryPoint:"main"}}),u=t.createBuffer({label:f.interfaceMetricsBuffer,size:Re,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),l=t.createBuffer({label:f.interfaceMetricsReadBuffer,size:Re,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:c,boundaryBuffer:u,boundaryReadBuffer:l}}function kr(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function xr(e){let{device:t,encoder:r,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:a}=e;if(K(a,"population")||K(a,"diversity")){let c=new Uint32Array(256);t.queue.writeBuffer(n.histogramBuffer,0,c);let u=t.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),l=r.beginComputePass({label:f.histogramMetricsPass});l.setPipeline(n.histogramPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),r.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Pe)}if(K(a,"interfaces")){let c=new Uint32Array([0]);t.queue.writeBuffer(n.boundaryBuffer,0,c);let u=t.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),l=r.beginComputePass({label:f.interfaceMetricsPass});l.setPipeline(n.boundaryPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),r.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Re)}}async function Tr(e){let{resources:t,enabledSections:r}=e,n=K(r,"population")||K(r,"diversity"),i=K(r,"interfaces"),o=[];n&&o.push(t.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(t.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let a=new Uint32Array(256);n&&(a=new Uint32Array(t.histogramReadBuffer.getMappedRange().slice(0)),t.histogramReadBuffer.unmap());let c=0;if(i){let u=new Uint32Array(t.boundaryReadBuffer.getMappedRange().slice(0));t.boundaryReadBuffer.unmap(),c=u[0]??0}return{histogram:a,crossStateContactEdges:c}}function An(e,t){let{tribes:r,deadTribeIndex:n,readback:i,cols:o,rows:a}=e,c=o*a,u={};for(let b=0;b<r.length;b++){let d=t?i.histogram[b]??0:0;u[r[b].id]=d}let l=t?u[r[n]?.id??""]??0:0;return{population:u,aliveCells:t?Math.max(0,c-l):0,deadCells:l}}function In(e){let{tribes:t,deadTribeIndex:r,readback:n}=e,i=0;for(let o=0;o<t.length;o++)o!==r&&(i+=n.histogram[o]??0);return i}function Ln(e,t){let{tribes:r,deadTribeIndex:n,readback:i}=e,o=t?In(e):0,a=0,c=0;for(let u=0;u<r.length;u++){let l=u!==n&&o>0?(i.histogram[u]??0)/o:0;l>0&&(a-=l*Math.log2(l),c+=l*l)}return{shannonEntropy:a,simpsonSum:c}}function Gn(e,t){let r=e.cols*e.rows*2,n=t?e.readback.crossStateContactEdges:0,i=t?Math.max(0,r-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:t&&r>0?i/r:0,crossStateContactFraction:t&&r>0?n/r:0}}function Ar(e){let{generation:t,enabledSections:r,availability:n,liveMetricSettings:i,cols:o,rows:a,totalFrames:c,fps:u,canStepBack:l,recordingBytes:b,recordingRawBytes:d}=e,m=K(r,"population")&&i.population,_=K(r,"diversity")&&i.diversity,x=K(r,"interfaces")&&i.interfaces,$=o*a,g=An(e,m),T=Ln(e,_),ae=Gn(e,x);return{type:"metrics",generation:t,population:g.population,aliveCells:g.aliveCells,deadCells:g.deadCells,occupancy:m&&$>0?g.aliveCells/$:0,shannonEntropy:T.shannonEntropy,simpsonIndex:_?1-T.simpsonSum:0,interfaces:ae,metricsAvailability:n,extinctionTime:{},totalFrames:c,fps:u,canStepBack:l,recordingBytes:b,recordingRawBytes:d}}var Ir=`// Render shader: draws the grid as a full-screen quad.
// Reads cell tribe IDs from a storage buffer, looks up colors from a uniform array.
// Supports zoom, pan, and toroidal tiling.

struct Uniforms {
  canvas_size: vec2f,    // Canvas width, height in pixels.
  scale: f32,            // Pixels per cell.
  offset_frac: vec2f,    // Fractional camera offset in cell units.
  grid_size: vec2u,      // Grid cols, rows.
  offset_cell: vec2u,    // Integer camera offset in cell units.
  tribe_count: u32,      // Number of tribes.
  preview_center: vec2i, // Brush preview center cell.
  preview_size: u32,     // Brush preview size in cells.
  preview_shape: u32,    // 0=square 1=round 2=diamond 3=vline 4=hline.
  preview_visible: u32,  // 1 when the brush preview should render.
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> grid: array<u32>;
@group(0) @binding(2) var<storage, read> tribe_colors: array<u32>;

const CELLS_PER_WORD: u32 = __CELLS_PER_WORD__;
const WORD_SHIFT: u32 = __WORD_SHIFT__;
const CELL_SHIFT: u32 = __CELL_SHIFT__;
const CELL_INDEX_MASK: u32 = __CELL_INDEX_MASK__;
const CELL_MASK: u32 = __CELL_MASK__;

fn wrapAdd(base: u32, delta: u32, size: u32) -> u32 {
  let rem = delta % size;
  if (base >= size - rem) {
    return base - (size - rem);
  }
  return base + rem;
}

fn wrapCell(value: i32, size: u32) -> i32 {
  return ((value % i32(size)) + i32(size)) % i32(size);
}

fn signedWrapDelta(cell: u32, center: i32, size: u32) -> i32 {
  let wrapped_center = wrapCell(center, size);
  var delta = i32(cell) - wrapped_center;
  let half_size = i32(size) / 2;
  if (delta > half_size) {
    delta = delta - i32(size);
  } else if (delta < -half_size) {
    delta = delta + i32(size);
  }
  return delta;
}

fn previewInShape(bx: i32, by: i32, size: u32, shape: u32) -> bool {
  if (bx < 0 || by < 0 || bx >= i32(size) || by >= i32(size)) { return false; }
  let hf = f32(size - 1u) / 2.0;
  let fdx = f32(bx) - hf;
  let fdy = f32(by) - hf;
  switch (shape) {
    case 1u: {
      let r = f32(size) / 2.0 - 0.25;
      return fdx * fdx + fdy * fdy <= r * r;
    }
    case 2u: {
      return abs(fdx) + abs(fdy) <= f32(size) / 2.0;
    }
    case 3u: {
      return bx == i32(size - 1u) / 2;
    }
    case 4u: {
      return by == i32(size - 1u) / 2;
    }
    default: {
      return true;
    }
  }
}

fn signedWrapWorldDelta(world: f32, center: i32, size: u32) -> f32 {
  let gridSize = f32(size);
  let wrappedCenter = f32(wrapCell(center, size));
  let delta = world - wrappedCenter;
  return delta - floor((delta + gridSize * 0.5) / gridSize) * gridSize;
}

fn previewRectangleOutline(p: vec2f, halfSize: vec2f, stroke: f32) -> bool {
  let distanceInside = halfSize - abs(p);
  let inside = distanceInside.x >= 0.0 && distanceInside.y >= 0.0;
  return inside && min(distanceInside.x, distanceInside.y) <= stroke;
}

fn previewCellBorderOutlineMask(ix: u32, iy: u32, cell_frac: vec2f) -> bool {
  let size = max(u.preview_size, 1u);
  let half = i32(size - 1u) / 2;
  let bx = signedWrapDelta(ix, u.preview_center.x, u.grid_size.x) + half;
  let by = signedWrapDelta(iy, u.preview_center.y, u.grid_size.y) + half;
  let inside = previewInShape(bx, by, size, u.preview_shape);
  let edge = min(1.0, 1.0 / max(u.scale, 0.001));
  return inside && (
    (!previewInShape(bx - 1, by, size, u.preview_shape) && cell_frac.x <= edge) ||
    (!previewInShape(bx + 1, by, size, u.preview_shape) && cell_frac.x >= 1.0 - edge) ||
    (!previewInShape(bx, by - 1, size, u.preview_shape) && cell_frac.y <= edge) ||
    (!previewInShape(bx, by + 1, size, u.preview_shape) && cell_frac.y >= 1.0 - edge)
  );
}

fn previewContinuousOutlineMask(local: vec2f) -> bool {
  let size = max(u.preview_size, 1u);
  let world = vec2f(f32(u.offset_cell.x), f32(u.offset_cell.y)) + local;
  let delta = vec2f(
    signedWrapWorldDelta(world.x, u.preview_center.x, u.grid_size.x),
    signedWrapWorldDelta(world.y, u.preview_center.y, u.grid_size.y)
  );
  let footprintCenter = vec2f(0.5, 0.5);
  let p = delta - footprintCenter;
  let halfSize = f32(size) * 0.5;
  let stroke = 1.0 / max(u.scale, 0.001);

  switch (u.preview_shape) {
    case 1u: {
      return abs(length(p) - halfSize) <= stroke;
    }
    case 2u: {
      return abs(abs(p.x) + abs(p.y) - halfSize) <= stroke;
    }
    case 3u: {
      return previewRectangleOutline(p, vec2f(0.5, halfSize), stroke);
    }
    case 4u: {
      return previewRectangleOutline(p, vec2f(halfSize, 0.5), stroke);
    }
    default: {
      return previewRectangleOutline(p, vec2f(halfSize, halfSize), stroke);
    }
  }
}

fn previewOutlineMask(ix: u32, iy: u32, local: vec2f) -> bool {
  if (u.scale > 1.0) {
    return previewCellBorderOutlineMask(ix, iy, fract(local));
  }
  return previewContinuousOutlineMask(local);
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
  // Full-screen triangle trick: 3 vertices cover the entire clip space.
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0,  3.0),
  );
  var out: VertexOutput;
  out.position = vec4f(pos[vi], 0.0, 1.0);
  // UV: [0,1] range, y flipped so top-left = (0,0).
  out.uv = (pos[vi] + 1.0) * 0.5;
  out.uv.y = 1.0 - out.uv.y;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  // Convert pixel coordinate to local cell offset. The large integer camera
  // offset is applied separately to avoid f32 precision loss on wide grids.
  let px = in.uv * u.canvas_size;
  let local = px / u.scale + u.offset_frac;

  let ix = wrapAdd(u.offset_cell.x, u32(local.x), u.grid_size.x);
  let iy = wrapAdd(u.offset_cell.y, u32(local.y), u.grid_size.y);

  // Read tribe ID from the active packed grid buffer.
  let packed_cols = (u.grid_size.x + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
  let word_idx = iy * packed_cols + (ix >> WORD_SHIFT);
  let shift = (ix & CELL_INDEX_MASK) << CELL_SHIFT;
  let tribe_id = (grid[word_idx] >> shift) & CELL_MASK;

  // Look up tribe color (packed as 0x00BBGGRR).
  let color_packed = tribe_colors[tribe_id];
  let r = f32(color_packed & 0xFFu) / 255.0;
  let g = f32((color_packed >> 8u) & 0xFFu) / 255.0;
  let b = f32((color_packed >> 16u) & 0xFFu) / 255.0;

  if (u.preview_visible == 1u && previewOutlineMask(ix, iy, local)) {
    return vec4f(0.82, 0.84, 0.86, 1.0);
  }

  return vec4f(r, g, b, 1.0);
}
`;var At=[1,2,4,8,16,32],Dn={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Un={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},On={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Xe={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Wn={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},It={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},J={1:Dn,2:Un,4:On,8:Xe,16:Wn,32:It};var Me={population:!0,diversity:!0,interfaces:!1},He={enabled:!0,sections:Me};var Lt="any",je="dead";var Ve="empty",Ze="is",Gt="comparison",Qe="count",Je="none",et="exactly",tt="min",rt="max",nt="not",it="and",ot="or",st="xor";function Lr(e){return At.includes(e)}function Nn(e){return 2**e}function Ft(e,t){return t<=Nn(e)}function Dt(e,t,r){return ue(e,t)<=r}function Ut(e){return e<=2?J[1]:e<=4?J[2]:e<=16?J[4]:e<=256?J[8]:e<=65536?J[16]:J[32]}function Be(e){return J[e]}function Gr(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of At){let i=Be(n);if(Ft(n,e)&&Dt(t,i,r))return i}return It}function Ot(e){return Be(e?.bitsPerCell??8)}function Ee(e){return{bitsPerCell:e.bitsPerCell}}function ce(e,t){return Math.ceil(e/t.cellsPerWord)}function ue(e,t){return ce(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Fr(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function zn(e){return{population:typeof e?.population=="boolean"?e.population:Me.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Me.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Me.interfaces}}function Wt(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:He.enabled,sections:zn(e?.sections)}}function Dr(e,t,r,n,i){let o=ce(t.cols,r),a=e[i*o+(n>>r.wordShift)]??0;return $n(a,r,n&r.cellIndexMask)}function Ur(e,t,r,n,i,o){let a=ce(t.cols,r),c=i*a+(n>>r.wordShift),u=(n&r.cellIndexMask)<<r.cellShift,l=~(r.cellMask<<u),b=e[c]??0;e[c]=(b&l|(o&r.cellMask)<<u)>>>0}function $n(e,t,r){return t.bitsPerCell===32?e>>>0:e>>>(r<<t.cellShift)&t.cellMask}var so=64*1024*1024;function Nt(e,t,r,n){let i=e,o;if(r.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(ue(t,n)/Uint32Array.BYTES_PER_ELEMENT);for(let a=0;a<t.rows;a++)for(let c=0;c<t.cols;c++)Ur(o,t,n,c,a,Dr(i,t,r,c,a))}return o}var s,O=!1,qt,ct,pe,Fe,S=0,y=0,or=0,C=Xe,Z=[],ne=new Map,vt,Yt,G,F,De,he,bt,jr,Vr,Ae,sr,ar,A=!1,Zr=1,Qr=0,Jr=0,E=!1,D=!1,te=100,P=0,ut,Se,en,tn,Yn=0,lt=null,be={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},ie=null,H=-1,N=!1,q=!1,zt=0,Ue=He,dt=[],w=!1,X=!1,Y={chunks:[],generationStart:0,generationEnd:0,gridFormat:Ee(Xe)},rn=0,R=[],h=null,nn=0,we=!1,L=null,v=0,B=[],me=null,M=64,p=0,_t=3,Q=[],z=[],ft="gol-recording",Pt="raw-packed",on="deflate-raw",Ie=null,le=null,V=0,Oe=0,re=0,Or=12,I=!1,ke=0,sn=256,Xn=sn*Uint32Array.BYTES_PER_ELEMENT,Wr=256*1024*1024,Hn=512*1024*1024,Nr=128*1024*1024*1024,pt=0,mt=0,Le=[];function jn(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function an(e){console.error("[GOLT worker] Worker GPU error:",e),k("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),E=!1,self.postMessage({type:"gpuError",reason:jn(e)})}self.addEventListener("error",e=>{e.preventDefault(),an(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),an(e.reason)});async function cr(){await s.queue.onSubmittedWorkDone()}function zr(e){pt=0,mt=2+(e?1+_t:0),Le=[]}async function ht(){if(Le.length===0)return;let e=s.createCommandEncoder({label:f.trackedAllocationClearEncoder});for(let t of Le)e.clearBuffer(t);s.queue.submit([e.finish()]),await cr(),Le=[]}async function St(e,t){!D||mt<=0||(pt+=e,mt--,Le.push(t),pt>=Vn()&&mt>0&&(await ht(),pt=0))}function Vn(){return Math.min(_e(),Hn)}function _e(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function $e(){return Math.min(_e(),1073741824)}function cn(){return Math.max(_e()*2,$e()*6)}function U(){return p>0&&p<=$e()}function Zn(){return p<=0?0:p*2+lr+Xn+dr+Pe*2+Re*2}function Qn(){return M<1||p<=0?0:M*p*(1+_t)}function yt(){L?.destroy(),L=null;for(let e of Q)e?.destroy();Q=[],z=[],M=0,v=0,B=[],me=null,Oe=0}function $r(){G?.destroy(),F?.destroy(),kr(ie),ie=null,Se?.destroy(),yt()}function $t(e){let t=V>0;V+=e;let r=V>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function ye(){if(M<1||Q.length===0){I&&(I=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=fr(),t=!z.some(i=>i)&&v>=M,r=re>=e,n;if(I){let i=z.some(a=>a),o=re<=Math.floor(e/2);n=!(i&&o)}else n=t||r;n!==I&&(I=n,self.postMessage({type:"backpressure",active:n}))}async function Ce(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??Nr/128,Nr),r=e.usage??0,n=0,i=0;for(let c of R)c.codec===Pt?n+=c.storedBytes:i+=c.storedBytes;let o=M*p,a=w?(1+_t)*o:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:a})}var We=!1;async function Jn(e){let t=new DecompressionStream(on),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:u,value:l}=await i.read();if(u)break;n.push(l)}let o=0;for(let u of n)o+=u.byteLength;let a=new Uint8Array(o),c=0;for(let u of n)a.set(u,c),c+=u.byteLength;return a.buffer}var ve=0,at=0,ur=0;function un(e,t,r=s.limits.maxComputeWorkgroupsPerDimension){if(e<=r&&t<=r)return{logicalWgX:e,logicalWgY:t,dispatchWgX:e,dispatchWgY:t,remapped:!1};let n=e*t,i=Math.min(n,r),o=Math.ceil(n/i);if(o>r)throw new Error(`Grid requires ${e}x${t} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${r}.`);return{logicalWgX:e,logicalWgY:t,dispatchWgX:i,dispatchWgY:o,remapped:!0}}function ei(){return un(Math.ceil(or/16),Math.ceil(y/16))}function ti(){return un(Math.ceil(S/16),Math.ceil(y/16))}function ri(e,t){t.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${t.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${t.dispatchWgX}u;`))}function ni(e){e.push(`const CELLS_PER_WORD: u32 = ${C.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${C.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${C.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${C.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${C.cellMask}u;`)}function ii(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function oi(e,t,r){if(t.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${r} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${r} = gid.x;`),e.push("  let y = gid.y;")}function si(){let e=[],t=or,r=vt;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${Z.map(d=>d.id).join(", ")}`),e.push(`// Rules: ${Fe.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${S}u;`),e.push(`const ROWS: u32 = ${y}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),ri(e,r),ni(e),e.push(""),ii(e,"gridIn","PACKED_COLS"),e.push("");let n=ne.get(je)??0,i=Fe.rules.filter(d=>!d.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let o=ci(i.map(d=>d.clause)),a=new Map,c=0;for(let d of o){let m=`count_${c++}`;a.set(d,m)}for(let[d,m]of a){let _=d.split(",").map(Number),$=Kr().map(g=>`select(0u, 1u, ${_.map(ae=>`${g} == ${ae}u`).join(" || ")})`);e.push(`  let ${m} = ${$.join(" + ")};`)}o.size>0&&e.push("");let u=ui(i.map(d=>d.clause)),l=new Map,b=0;for(let d of u)if(a.has(d))l.set(d,a.get(d));else{let m=`eq_count_${b++}`;l.set(d,m)}for(let[d,m]of l){if(a.has(d))continue;let _=d.split(",").map(Number),$=Kr().map(g=>`select(0u, 1u, ${_.map(ae=>`${g} == ${ae}u`).join(" || ")})`);e.push(`  let ${m} = ${$.join(" + ")};`)}u.size>0&&b>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let d=0;d<i.length;d++){let m=i[d],_=xe(m.clause,a,l),x=ai(m.tribe);d===0?e.push(`  if (${_}) {`):e.push(`  } else if (${_}) {`),e.push(`    result = ${x}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),r.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),oi(e,r,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let d=-1;d<=1;d++)for(let m=-1;m<=1;m++){if(m===0&&d===0)continue;let _=ln(m,d),x=qr("x",m,"COLS"),$=qr("y",d,"ROWS");e.push(`    let ${_} = readCell(${x}, ${$});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function ln(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function Kr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(ln(r,t));return e}function qr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function W(e){let t=[];for(let r of e)if(r===Lt)for(let n=0;n<Z.length;n++)t.push(n);else{let n=ne.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function ai(e){return e===Lt?0:ne.get(e)??0}function ci(e){let t=new Set;for(let r of e)Xt(r,t);return t}function Xt(e,t){switch(e.kind){case Ve:case Ze:break;case Je:case et:case tt:case rt:case Qe:{let r=W(e.tribes).sort();t.add(r.join(","));break}case nt:Xt(e.clause,t);break;case it:case ot:case st:for(let r of e.clauses)Xt(r,t);break}}function ui(e){let t=new Set;for(let r of e)Ht(r,t);return t}function Ht(e,t){switch(e.kind){case Ve:case Ze:case Qe:case Je:case et:case tt:case rt:break;case Gt:{let r=W(e.tribe1).sort(),n=W(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case nt:Ht(e.clause,t);break;case it:case ot:case st:for(let r of e.clauses)Ht(r,t);break}}function xe(e,t,r){switch(e.kind){case Ve:return"false";case Ze:{let n=W(e.tribes);return n.length===0?"false":n.length===Z.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case Qe:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case Je:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case et:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case tt:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case rt:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case Gt:{let n=r.get(W(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),o=`(i32(${r.get(W(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${o})`;case">":return`(i32(${n}) > ${o})`;case"<":return`(i32(${n}) < ${o})`;case"\u2265":return`(i32(${n}) >= ${o})`;case"\u2264":return`(i32(${n}) <= ${o})`;default:return`(i32(${n}) == ${o})`}}case nt:return`!(${xe(e.clause,t,r)})`;case it:return`(${e.clauses.map(i=>xe(i,t,r)).join(" && ")})`;case ot:return`(${e.clauses.map(i=>xe(i,t,r)).join(" || ")})`;case st:return`(((${e.clauses.map(o=>xe(o,t,r)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var lr=80;function jt(){De?.destroy(),De=s.createBuffer({label:f.uniformBuffer,size:lr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function li(){let e=new ArrayBuffer(lr),t=new Float32Array(e),r=new Int32Array(e),n=new Uint32Array(e),i=(Qr%S+S)%S,o=(Jr%y+y)%y,a=Math.floor(i),c=Math.floor(o);t[0]=pe.width,t[1]=pe.height,t[2]=Zr,t[4]=i-a,t[5]=o-c,n[6]=S,n[7]=y,n[8]=a,n[9]=c,n[10]=Z.length,r[12]=be.centerX,r[13]=be.centerY,n[14]=be.brushSize,n[15]=be.shape,n[16]=be.visible?1:0,s.queue.writeBuffer(De,0,e)}function Rt(){return ue({cols:S,rows:y},C)}function oe(){return Ee(C)}async function Vt(){let e=Rt();G=s.createBuffer({label:f.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await St(e,G),F=s.createBuffer({label:f.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await St(e,F);let t=s.createCommandEncoder({label:f.gridClearEncoder});t.clearBuffer(G),t.clearBuffer(F),s.queue.submit([t.finish()]),A=!1}function Zt(){let e=new Uint32Array(sn);for(let t=0;t<Z.length;t++){let r=Z[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),o=parseInt(r.substring(4,6),16);e[t]=n|i<<8|o<<16}he&&he.destroy(),he=s.createBuffer({label:f.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(he,0,e)}function di(){return Ir.replace("__CELLS_PER_WORD__",`${C.cellsPerWord}u`).replace("__WORD_SHIFT__",`${C.wordShift}u`).replace("__CELL_SHIFT__",`${C.cellShift}u`).replace("__CELL_INDEX_MASK__",`${C.cellIndexMask}u`).replace("__CELL_MASK__",`${C.cellMask}u`)}function Qt(){let e=s.createShaderModule({label:f.renderShaderModule,code:di()});bt=s.createRenderPipeline({label:f.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:ct}]},primitive:{topology:"triangle-list"}})}function Jt(){jr=s.createBindGroup({layout:bt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:De}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:he}}]}),Vr=s.createBindGroup({layout:bt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:De}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:he}}]})}function er(){vt=ei();let e=si(),t=s.createShaderModule({label:f.simulationShaderModule,code:e});Ae=s.createComputePipeline({label:f.simulationPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),sr=s.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:F}}]}),ar=s.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:G}}]})}function tr(){Yt=ti(),ie=wr({device:s,cols:S,rows:y,gridFormat:C,dispatchPlan:Yt})}var dr=176;function fi(){return`
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

const CELLS_PER_WORD: u32 = ${C.cellsPerWord}u;
const WORD_SHIFT: u32 = ${C.wordShift}u;
const CELL_SHIFT: u32 = ${C.cellShift}u;
const CELL_INDEX_MASK: u32 = ${C.cellIndexMask}u;
const CELL_MASK: u32 = ${C.cellMask}u;

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
`}function rr(){let e=s.createShaderModule({label:f.brushShaderModule,code:fi()});ut=s.createComputePipeline({label:f.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),Se?.destroy(),Se=s.createBuffer({label:f.brushUniformBuffer,size:dr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),en=s.createBindGroup({layout:ut.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:Se}}]}),tn=s.createBindGroup({layout:ut.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:Se}}]})}function pi(e,t,r,n,i,o,a){let c=ne.get(je)??0,u=Yn++,l=new ArrayBuffer(dr),b=new Int32Array(l),d=new Uint32Array(l);b[0]=t,b[1]=r,d[2]=S,d[3]=y,d[4]=n,d[5]=i,d[6]=o,d[7]=c,d[8]=u,d[9]=a.length,d[10]=0;for(let x=0;x<a.length&&x<32;x++)d[11+x]=a[x];s.queue.writeBuffer(Se,0,l);let m=Math.ceil(n/8),_=e.beginComputePass({label:f.brushPass});_.setPipeline(ut),_.setBindGroup(0,A?tn:en),_.dispatchWorkgroups(m,m),_.end()}function mi(){let e=A?F:G,t=Rt(),r;try{r=s.createBuffer({label:f.gridReadbackBuffer,size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder({label:f.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function dn(){if(p=Rt(),!U()){M=0;return}let e=gi();M=Math.max(1,Math.floor(e/p))}function gi(){return p>=Wr?p:Math.min(Math.max(Wr,p),$e())}function fr(){if(M<1||p<=0)return Or;let e=Math.max(p,M*p),t=Math.floor(536870912/e);return Math.max(1,Math.min(Or,t||1))}function nr(){let e=U();self.postMessage({type:"limits",maxBytes:_e(),vramBudgetBytes:cn(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:Zn(),vramRecordingBytes:Qn(),gridFormat:oe()})}function Ne(){return!U()||M<1||L===null||Q.length===0?!1:v<M?!0:fn()}function fn(){return re>=fr()?!1:Q.some((e,t)=>z[t]&&e.mapState==="unmapped")}function Ke(e){if(M<1||L===null||v>=M)return;let t=A?F:G,r=v*p,n=s.createCommandEncoder({label:f.recordingFrameCopyEncoder});n.copyBufferToBuffer(t,0,L,r,p),s.queue.submit([n.finish()]),B.push(e),me=e,v++,gt()}function Kt(e){Oe=Math.max(0,Oe+e)}function gt(){M>0&&v>=M&&fn()&&ze()}function ze(){if(L===null||v===0||Q.length===0||re>=fr())return;let e=z.indexOf(!0);if(e<0)return;z[e]=!1;let t=Q[e];if(t.mapState!=="unmapped"){z[e]=!0;return}let r=v*p,n=rn++,i=[...B],o=i[0],a=i[i.length-1],c=`chunk-${String(n).padStart(6,"0")}.bin`,u=v,l=s.createCommandEncoder({label:f.recordingSealCopyEncoder});l.copyBufferToBuffer(L,0,t,0,r),s.queue.submit([l.finish()]);let b={chunkId:n,generationStart:o,generationEnd:a,blockCount:u,codec:Pt,uncompressedBytes:r,storedBytes:r,gridFormat:oe(),generations:i,filename:c};$t(1),Kt(u),re++,ye();let d=ke;t.mapAsync(GPUMapMode.READ).then(async()=>{let m=t.getMappedRange(),_=new ArrayBuffer(r);new Uint8Array(_).set(new Uint8Array(m,0,r)),t.unmap(),d===ke&&(z[e]=!0,R.push(b),Kt(-u),pr(),ye(),gt(),bi(b,_).then(()=>{d===ke&&(re--,ye(),$t(-1),Ce(),Ct(),Bt(!0),gt(),self.postMessage({type:"chunkSealed",filename:b.filename,rawBytes:r,blockCount:b.blockCount,cols:S,rows:y,rawGridFormat:b.gridFormat,storageGridFormat:Ee(Ut(Fe.tribes.length))}),We&&V===0&&(We=!1,Ct()))}))}).catch(()=>{d===ke&&(z[e]=!0,re--,Kt(-u),ye(),$t(-1),gt())}),v=0,B=[]}function pr(){R.length>0&&(Y.generationStart=R[0].generationStart,Y.generationEnd=R[R.length-1].generationEnd),B.length>0&&(R.length===0&&(Y.generationStart=B[0]),Y.generationEnd=B[B.length-1]),Y.chunks=[...R]}async function Yr(e){ke++,rn=0,v=0,B=[],R=[],me=null,Oe=0,re=0,V>0&&(V=0,self.postMessage({type:"chunksSaving",active:!1})),I&&(I=!1,self.postMessage({type:"backpressure",active:!1})),We=!1,X=w,Y={chunks:[],generationStart:e,generationEnd:e,gridFormat:oe()},await pn(),Ce()}async function mr(){return le&&await le,Ie||(Ie=await(await navigator.storage.getDirectory()).getDirectoryHandle(ft,{create:!0})),Ie}async function bi(e,t){let i=await(await(await mr()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function hi(e){let t=await mr();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function pn(){if(le){await le;return}le=(async()=>{let e=await navigator.storage.getDirectory();Ie=null;try{await e.removeEntry(ft,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${ft}:`,t)}Ie=await e.getDirectoryHandle(ft,{create:!0})})();try{await le}finally{le=null}}function Ct(){pr(),self.postMessage({type:"recording",manifest:{chunks:R.map(e=>({...e,generations:[...e.generations]})),generationStart:Y.generationStart,generationEnd:Y.generationEnd,gridFormat:oe()},cols:S,rows:y})}function Si(){return me!==P}function Ge(e=!1){if(w){if(e){if(X){if(!Ne())return;X=!1}}else if(X)return;!Si()||!Ne()||(v>=M&&ze(),Ke(P))}}function gr(){if(lt){let e=lt;lt=null;let t=w&&v>0&&B[v-1]===P;t&&(v--,B.pop());let r=s.createCommandEncoder({label:f.brushEncoder});pi(r,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([r.finish()]),t&&Ke(P)}}async function yi(e,t=Pt){let o=await(await(await(await mr()).getFileHandle(e)).getFile()).arrayBuffer();return t===on?Jn(o):o}function Ci(){let e=v+Oe;for(let t of R)e+=t.blockCount;return e}function mn(){return Pr(S,y,Ue.enabled,Ue.sections)}function vi(){return Rr(mn())}function de(e){dt=vi(),ie&&dt.length!==0&&xr({device:s,encoder:e,resources:ie,sourceBuffer:A?F:G,dispatchPlan:Yt,enabledSections:dt})}function fe(){let e=P;if(!ie||e===H||N)return;let t=ie,r=[...dt],n=mn();H=e,N=!0,Tr({resources:t,enabledSections:r}).then(i=>{let o=ne.get(je)??0,a=Ci(),c=Ar({generation:e,tribes:Z,deadTribeIndex:o,readback:i,enabledSections:r,availability:n,liveMetricSettings:Ue.sections,cols:S,rows:y,totalFrames:a,fps:ur,canStepBack:a>1,recordingBytes:R.reduce((u,l)=>u+l.storedBytes,0),recordingRawBytes:R.reduce((u,l)=>u+l.uncompressedBytes,0)});if(N=!1,self.postMessage(c),q)if(q=!1,H=-1,vn()){let u=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(u),s.queue.submit([u.finish()]),fe()}else q=!0}).catch(()=>{N=!1})}function gn(){let e=S*y;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function bn(e){return e==="recording"?Number.MAX_SAFE_INTEGER:gn()*Sn()}function hn(e,t,r,n,i,o){let a=t-r*i;n>i||n>o?e.stepAccumulator=Math.min(a,r):e.stepAccumulator=a}function Sn(){let e=S*y;return e>1e7?2:e>1e6?4:e>1e5?8:16}function yn(e){if(e<=0)return;let t=vt,r=s.createCommandEncoder({label:f.simulationBatchEncoder});for(let n=0;n<e;n++){let i=r.beginComputePass({label:f.simulationStepPass});i.setPipeline(Ae),i.setBindGroup(0,A?ar:sr),i.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),i.end(),A=!A,P++}s.queue.submit([r.finish()]),ve+=e}function _i(){self.postMessage({type:"generation",generation:P,fps:ur})}function br(){let e=s.createCommandEncoder({label:f.simulationSingleStepEncoder}),t=e.beginComputePass({label:f.simulationStepPass});t.setPipeline(Ae),t.setBindGroup(0,A?ar:sr);let r=vt;t.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),t.end(),s.queue.submit([e.finish()]),A=!A,P++}function j(){li();let e=qt.getCurrentTexture().createView(),t=s.createCommandEncoder({label:f.renderEncoder}),r=t.beginRenderPass({label:f.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(bt),r.setBindGroup(0,A?Vr:jr),r.draw(3),r.end(),s.queue.submit([t.finish()])}function Cn(e){at===0&&(at=e);let t=e-at;t>=1e3&&(ur=ve/(t/1e3),ve=0,at=e)}function hr(){return w&&U()?"recording":"nonRecording"}function Pi(){return te<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/te}}function se(e){return e.request.stopCondition.kind==="targetGeneration"}function qe(e){return e.request.stopCondition.kind==="targetGeneration"&&P>=e.request.stopCondition.generation}function Mt(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-P)}function vn(){return!!(s&&ie&&!D&&!O)}function Bt(e=!1){if(e&&(H=-1),!vn())q=!0;else if(N)q=!0;else{let t=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(t),s.queue.submit([t.finish()]),fe()}}function _n(){Bt(!0),j()}function Et(e,t){if(!t)return;(e-zt>=1e3||zt===0)&&!N&&(zt=e,Bt())}function Ye(e,t){e.request.pacing.kind!=="max"&&!se(e)||t-e.lastProgressTime>=1e3&&(e.lastProgressTime=t,_i())}function wt(){I&&(I=!1,self.postMessage({type:"backpressure",active:!1}))}function Pn(){I||(I=!0,self.postMessage({type:"backpressure",active:!0}))}function Sr(){return Ne()?(v>=M&&ze(),Ne()):!1}function Te(){D||O||h||self.requestAnimationFrame(ir)}function ge(e){let t=h;if(!t||t.pumpPending||D||O)return;let{token:r}=t;t.pumpPending=!0;let n=()=>{!h||h.token!==r||(h.pumpPending=!1,ki(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?s.queue.onSubmittedWorkDone().then(n).catch(()=>{h?.token===r&&(h.pumpPending=!1)}):queueMicrotask(n)}function yr(e,t){h&&k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),h={kind:e,request:t,token:++nn,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0},ge(t.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function ee(){E&&yr(hr(),{pacing:Pi(),stopCondition:{kind:"none"}})}function k(e,t={}){let r=h;if(!r)return;h=null,nn++;let n=se(r),i=t.restore!==!1&&!!r.request.restoreAfterStop;i&&r.request.restoreAfterStop&&(E=r.request.restoreAfterStop.running,te=r.request.restoreAfterStop.targetStepDuration),n&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?wt():I&&ye(),t.render!==!1&&!D&&!O&&_n(),t.restartRestoredRun!==!1&&i&&E&&!D&&!O?ee():Te()}function Xr(e){let t=h;!t||!se(t)||(t.request.restoreAfterStop&&(t.request.restoreAfterStop.running=e),k("cancelled"))}function Ri(e){k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),yr(hr(),e)}function Rn(e,t,r){Pn(),Ye(e,t),Et(t,r),ge("drain")}function Mi(e,t){let r=gn(),n=Sn(),i=!1;for(let o=0;o<n;o++){let a=Mt(e);if(a<=0)break;let c=Math.min(r,a);yn(c),i=!0}if(Ye(e,t),qe(e)){k("targetReached");return}ge(i?"drain":"raf")}function Bi(e,t){Ge(!0);let r=!1,n=performance.now()+14;for(;Mt(e)>0&&performance.now()<n;){if(!Sr()){Rn(e,t,r);return}br(),ve++,r=!0,Ke(P)}if(wt(),Ye(e,t),Et(t,r),qe(e)){k("targetReached");return}ge("raf")}function Ei(e,t,r){e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=e.stepAccumulator,o=Math.floor(e.stepAccumulator/t),a=bn(e.kind),c=Math.min(o,Mt(e),a),u=c>0;if(u&&yn(c),hn(e,i,t,o,c,a),Ye(e,r),qe(e)){k("targetReached");return}let l=u&&o>c;if(!se(e)){let b=r-e.lastRenderTime;(!l||b>=33||e.lastRenderTime===0)&&(e.lastRenderTime=r,j(),Et(r,u))}ge(l?"drain":"raf")}function wi(e,t,r){Ge(!0),e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=!1,o=0,a=e.stepAccumulator,c=bn(e.kind),u=Math.floor(e.stepAccumulator/t),l=performance.now()+14;for(;e.stepAccumulator>=t&&Mt(e)>0&&o<c&&performance.now()<l;){if(!Sr()){Rn(e,r,i);return}br(),ve++,o++,e.stepAccumulator-=t,i=!0,Ke(P)}if(hn(e,a,t,u,o,c),wt(),Ye(e,r),qe(e)){k("targetReached");return}se(e)||(j(),Et(r,i)),ge("raf")}function ki(e){let t=h;if(!t||D||O)return;if(Cn(e),se(t)||gr(),qe(t)){k("targetReached");return}if(t.request.pacing.kind==="max"){t.kind==="recording"?Bi(t,e):Mi(t,e);return}let r=1e3/t.request.pacing.genPerSecond;t.kind==="recording"?wi(t,r,e):Ei(t,r,e)}function ir(e){if(D||O){self.requestAnimationFrame(ir);return}Cn(e),!h&&(gr(),te>0&&!we&&j(),self.requestAnimationFrame(ir))}function xi(e,t){let r=s?_e():Number.POSITIVE_INFINITY;return Lr(t.bitsPerCell)&&Ft(t.bitsPerCell,e.tribes.length)&&Dt(e,Be(t.bitsPerCell),r)?Be(t.bitsPerCell):Gr(e.tribes.length,e,r)}function Hr(e,t){Fe=e,S=e.cols,y=e.rows,C=xi(e,t),or=ce(S,C),Z=[...e.tribes],Y.gridFormat=oe(),ne.clear(),Z.forEach((r,n)=>ne.set(r.id,n))}async function Mn(e){console.log("[GOLT worker] Initializing WebGPU"),pe=e,s=await vr(f.webengineDevice),O=!1,s.lost.then(r=>{let n=r.message||r.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),O=!0,E=!1,D=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:_e(),vramBudgetBytes:cn(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:oe()});let t=pe.getContext("webgpu");if(!t)throw new Error("WebGPU canvas context not available");qt=t,ct=navigator.gpu.getPreferredCanvasFormat(),qt.configure({device:s,format:ct,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:ct,maxBufferSize:s.limits.maxBufferSize,maxStorageBufferBindingSize:s.limits.maxStorageBufferBindingSize})}async function Ti(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Mn(pe),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let t=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",t),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),O=!0,E=!1,D=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function Bn(){L=s.createBuffer({label:f.recordingChunkBuffer,size:M*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await St(M*p,L),v=0,B=[],me=null}async function En(){let e=M*p;Q=[],z=[];for(let t=0;t<_t;t++){let r=s.createBuffer({label:`${f.recordingStagingBuffer} ${t}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});Q.push(r),z.push(!0),await St(e,r)}}async function Ai(){await pn()}async function Ii(){console.log("[GOLT worker] Building GPU resources",{cols:S,rows:y,bitsPerCell:C.bitsPerCell,recordingAvailable:U()}),jt(),dn(),await Vt(),Zt(),Qt(),Jt(),er(),rr(),tr(),await Ai(),U()?(await Bn(),await En()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:p,maxRecordingBufferBytes:$e()}),yt(),w=!1,X=!1),await ht(),nr(),console.log("[GOLT worker] GPU resources ready")}async function Li(){console.log("[GOLT worker] Rebuild started",{cols:S,rows:y,bitsPerCell:C.bitsPerCell}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),D=!0,self.postMessage({type:"rebuilding",active:!0});try{await cr()}catch{}if(O&&!await Ti())return!1;$r(),jt(),dn(),zr(U());try{await Vt(),Zt(),Qt(),er(),rr(),Jt(),tr(),U()?(await Bn(),await En()):(yt(),w=!1,X=!1),await ht(),nr()}catch(e){let t=e instanceof Error?e.message:String(e);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{$r(),jt(),zr(!1),await Vt(),Zt(),Qt(),er(),rr(),Jt(),tr(),w=!1,X=!1,p=Rt(),yt(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await ht(),nr()}catch(r){return console.error("[GOLT worker] GPU rebuild recovery failed:",r),!1}}return D=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:U(),frameByteSize:p}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(console.log("[GOLT worker] Init message received",{cols:t.ruleset.cols,rows:t.ruleset.rows,recording:t.recording,running:t.running,speed:t.speed}),w=t.recording,Ue=Wt(t.liveMetrics),X=w,Hr(t.ruleset,t.simulationGridFormat),await Mn(t.canvas),await Ii(),N)q=!0;else{let r=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(r),s.queue.submit([r.finish()]),fe()}Ce(),E=t.running,te=t.speed<0?0:1e3/t.speed,E?ee():Te();break}case"setLiveMetrics":{Ue=Wt(t.liveMetrics),H=-1,Bt(!0);break}case"setRuleset":{if(console.log("[GOLT worker] Ruleset update received",{cols:t.ruleset.cols,rows:t.ruleset.rows,tribes:t.ruleset.tribes.length}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Hr(t.ruleset,t.simulationGridFormat),!await Li())break;if(P=0,H=-1,await Yr(0),E?ee():Te(),N)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(n),s.queue.submit([n.finish()]),fe()}break}case"setRunning":if(E=t.running,t.running){h||ee();break}h&&se(h)?Xr(!1):h?k("manual"):(I&&ye(),_n(),Te());break;case"setSpeed":{let r=te<=0,n=t.speed<0?0:1e3/t.speed;te=n,h&&!se(h)&&E?(k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&n>0?(we=!0,s.queue.onSubmittedWorkDone().then(()=>{we=!1,j(),ee()})):ee()):E&&!h?ee():r&&n>0&&(we=!0,s.queue.onSubmittedWorkDone().then(()=>{we=!1,j(),Te()}));break}case"camera":Zr=t.scale,Qr=t.offsetX,Jr=t.offsetY;break;case"resize":pe.width=t.width,pe.height=t.height;break;case"draw":{let r=t.tribes.map(n=>ne.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2},o=n[t.shape]??0,a=i[t.fill]??0;lt={centerX:t.x,centerY:t.y,brushSize:t.size,shape:o,fill:a,tribeIds:r}}break}case"brushPreview":{let r={square:0,round:1,diamond:2,vline:3,hline:4};be={centerX:t.x,centerY:t.y,brushSize:t.size,shape:r[t.shape]??0,visible:t.visible},!h&&!D&&!O&&j();break}case"getSnapshot":{mi().then(r=>{let n={type:"snapshot",grid:r,generation:P,cols:S,rows:y,gridFormat:oe()};self.postMessage(n,[r.buffer])}).catch(()=>{let r=new Uint32Array(0),n={type:"snapshot",grid:r,generation:P,cols:S,rows:y,gridFormat:oe()};self.postMessage(n,[r.buffer])});break}case"loadSnapshot":{let r=A?F:G,n=Ot(t.gridFormat),i=ue({cols:S,rows:y},n);if(t.grid.byteLength!==i)break;let o=Nt(t.grid,{cols:S,rows:y},n,C);s.queue.writeBuffer(r,0,o),P=t.generation,await Yr(t.generation);break}case"setRecording":{let r=h?.request;if(t.recording&&U()&&!w){if(w=!0,X=!0,H=-1,N)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(n),s.queue.submit([n.finish()]),fe()}Ce()}else(!t.recording||!U())&&(t.recording&&!U()&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:p,maxRecordingBufferBytes:$e()}),w=!1,X=!1);r&&h?Ri(r):!h&&E&&ee();break}case"getRecording":{if(We)break;await cr(),Ge(!1),v>0&&ze(),V>0?We=!0:Ct();break}case"stepBack":{let r=0;for(let c of R)r+=c.blockCount;let n=r+v,i=Math.min(t.count,n-1);if(i<=0)break;let o=n-1-i,a=A?F:G;if(o>=r){let c=o-r;v=c+1,B.length=v,P=B[c],me=P;let u=s.createCommandEncoder({label:f.recordingRestoreCopyEncoder});u.copyBufferToBuffer(L,c*p,a,0,p),s.queue.submit([u.finish()])}else{if(V>0){await new Promise(g=>{let T=setInterval(()=>{V===0&&(clearInterval(T),g())},10)}),r=0;for(let g of R)r+=g.blockCount}let c=0,u=0,l=0;for(let g=0;g<R.length;g++){let T=R[g];if(o<c+T.blockCount){u=g,l=o-c;break}c+=T.blockCount}let b=R[u],d=await yi(b.filename,b.codec),m=Ot(b.gridFormat),_=ue({cols:S,rows:y},m);if(m.bitsPerCell===C.bitsPerCell){let g=(l+1)*p;s.queue.writeBuffer(L,0,new Uint8Array(d,0,g))}else{let g=new Uint8Array((l+1)*p);for(let T=0;T<=l;T++){let ae=T*_,wn=new Uint8Array(d,ae,_),kt=Nt(Fr(wn),{cols:S,rows:y},m,C);g.set(new Uint8Array(kt.buffer,kt.byteOffset,kt.byteLength),T*p)}s.queue.writeBuffer(L,0,g),s.queue.writeBuffer(a,0,g.subarray(l*p,(l+1)*p))}if(v=l+1,B=b.generations.slice(0,l+1),P=B[l],me=P,m.bitsPerCell===C.bitsPerCell){let g=s.createCommandEncoder({label:f.recordingRestoreCopyEncoder});g.copyBufferToBuffer(L,l*p,a,0,p),s.queue.submit([g.finish()])}let $=R.splice(u).map(g=>g.filename);hi($)}if(pr(),Ce(),H=-1,N)q=!0;else{let c=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(c),s.queue.submit([c.finish()]),fe()}j();break}case"stepForward":{if(gr(),t.count===1){Ge(!0);let r=!w||Sr();if(r?(br(),ve++,w&&Ne()&&(v>=M&&ze(),Ke(P))):Pn(),r&&wt(),H=-1,N)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(n),s.queue.submit([n.finish()]),fe()}j()}else self.postMessage({type:"stepping",active:!0}),Ge(!0),yr(hr(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:P+t.count},restoreAfterStop:{running:E,targetStepDuration:te}});break}case"cancelStepping":{Xr(h?.request.restoreAfterStop?.running??E);break}case"updateChunkCodec":{let r=R.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,Y.chunks=[...R],Ce(),Ct());break}case"getUncompressedChunks":{let r=R.filter(n=>n.codec===Pt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:S,rows:y,rawGridFormat:n.gridFormat,storageGridFormat:Ee(Ut(Fe.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
