var Er="goltTimestampedConsoleInstalled";function In(){let e=globalThis;e[Er]||(e[Er]=!0,Dt("log"),Dt("warn"),Dt("error"))}function Dt(e){let t=console[e].bind(console);console[e]=(...r)=>{t(`[${new Date().toISOString()}]`,...r)}}In();async function wr(e,t){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let r=await navigator.gpu.requestAdapter();if(!r)throw new Error("WebGPU adapter is unavailable.");return t?.(r.limits),r.requestDevice({label:e,requiredLimits:{maxBufferSize:r.limits.maxBufferSize,maxStorageBufferBindingSize:r.limits.maxStorageBufferBindingSize}})}var d={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var xr=4294967295;function X(e,t){return e.includes(t)}function Ut(e,t){let r;return e?r=t?"ok":"tooLarge":r="disabled",r}function kr(e,t,r,n){let i=e*t,s=i<=xr,o=i*2<=xr;return{population:Ut(r&&n.population,s),diversity:Ut(r&&n.diversity,s),interfaces:Ut(r&&n.interfaces,o)}}function Tr(e){let t=[];return e.population==="ok"&&t.push("population"),e.diversity==="ok"&&t.push("diversity"),e.interfaces==="ok"&&t.push("interfaces"),t}var Be=256*Uint32Array.BYTES_PER_ELEMENT,Ee=Uint32Array.BYTES_PER_ELEMENT;function Ar(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function Ir(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function Gr(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function Gn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${Ar(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Ir(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${Gr(i)}
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
`}function Ln(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${Ar(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Ir(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${Gr(i)}
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
`}function Lr(e){let{device:t}=e,r=t.createShaderModule({label:d.histogramMetricsShaderModule,code:Gn(e)}),n=t.createComputePipeline({label:d.histogramMetricsPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),i=t.createBuffer({label:d.histogramMetricsBuffer,size:Be,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),s=t.createBuffer({label:d.histogramMetricsReadBuffer,size:Be,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),o=t.createShaderModule({label:d.interfaceMetricsShaderModule,code:Ln(e)}),c=t.createComputePipeline({label:d.interfaceMetricsPipeline,layout:"auto",compute:{module:o,entryPoint:"main"}}),u=t.createBuffer({label:d.interfaceMetricsBuffer,size:Ee,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),l=t.createBuffer({label:d.interfaceMetricsReadBuffer,size:Ee,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:s,boundaryPipeline:c,boundaryBuffer:u,boundaryReadBuffer:l}}function Fr(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function Dr(e){let{device:t,encoder:r,resources:n,sourceBuffer:i,dispatchPlan:s,enabledSections:o}=e;if(X(o,"population")||X(o,"diversity")){let c=new Uint32Array(256);t.queue.writeBuffer(n.histogramBuffer,0,c);let u=t.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),l=r.beginComputePass({label:d.histogramMetricsPass});l.setPipeline(n.histogramPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(s.dispatchWgX,s.dispatchWgY),l.end(),r.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Be)}if(X(o,"interfaces")){let c=new Uint32Array([0]);t.queue.writeBuffer(n.boundaryBuffer,0,c);let u=t.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),l=r.beginComputePass({label:d.interfaceMetricsPass});l.setPipeline(n.boundaryPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(s.dispatchWgX,s.dispatchWgY),l.end(),r.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Ee)}}async function Ur(e){let{resources:t,enabledSections:r}=e,n=X(r,"population")||X(r,"diversity"),i=X(r,"interfaces"),s=[];n&&s.push(t.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&s.push(t.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(s);let o=new Uint32Array(256);n&&(o=new Uint32Array(t.histogramReadBuffer.getMappedRange().slice(0)),t.histogramReadBuffer.unmap());let c=0;if(i){let u=new Uint32Array(t.boundaryReadBuffer.getMappedRange().slice(0));t.boundaryReadBuffer.unmap(),c=u[0]??0}return{histogram:o,crossStateContactEdges:c}}function Fn(e,t){let{tribes:r,deadTribeIndex:n,readback:i,cols:s,rows:o}=e,c=s*o,u={};for(let h=0;h<r.length;h++){let f=t?i.histogram[h]??0:0;u[r[h].id]=f}let l=t?u[r[n]?.id??""]??0:0;return{population:u,aliveCells:t?Math.max(0,c-l):0,deadCells:l}}function Dn(e){let{tribes:t,deadTribeIndex:r,readback:n}=e,i=0;for(let s=0;s<t.length;s++)s!==r&&(i+=n.histogram[s]??0);return i}function Un(e,t){let{tribes:r,deadTribeIndex:n,readback:i}=e,s=t?Dn(e):0,o=0,c=0;for(let u=0;u<r.length;u++){let l=u!==n&&s>0?(i.histogram[u]??0)/s:0;l>0&&(o-=l*Math.log2(l),c+=l*l)}return{shannonEntropy:o,simpsonSum:c}}function On(e,t){let r=e.cols*e.rows*2,n=t?e.readback.crossStateContactEdges:0,i=t?Math.max(0,r-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:t&&r>0?i/r:0,crossStateContactFraction:t&&r>0?n/r:0}}function Or(e){let{generation:t,enabledSections:r,availability:n,liveMetricSettings:i,cols:s,rows:o,totalFrames:c,fps:u,canStepBack:l,recordingBytes:h,recordingRawBytes:f}=e,p=X(r,"population")&&i.population,B=X(r,"diversity")&&i.diversity,_=X(r,"interfaces")&&i.interfaces,O=s*o,g=Fn(e,p),E=Un(e,B),H=On(e,_);return{type:"metrics",generation:t,population:g.population,aliveCells:g.aliveCells,deadCells:g.deadCells,occupancy:p&&O>0?g.aliveCells/O:0,shannonEntropy:E.shannonEntropy,simpsonIndex:B?1-E.simpsonSum:0,interfaces:H,metricsAvailability:n,extinctionTime:{},totalFrames:c,fps:u,canStepBack:l,recordingBytes:h,recordingRawBytes:f}}var Wr=`// Render shader: draws the grid as a full-screen quad.
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
`;var Ot=[1,2,4,8,16,32],Nn={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},zn={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},$n={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Ve={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Xn={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},Wt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},re={1:Nn,2:zn,4:$n,8:Ve,16:Xn,32:Wt};var we={population:!0,diversity:!0,interfaces:!1},Ze={enabled:!0,sections:we};var Nt="any",Qe="dead";var Je="empty",et="is",zt="comparison",tt="count",rt="none",nt="exactly",it="min",st="max",ot="not",at="and",ct="or",ut="xor";function Nr(e){return Ot.includes(e)}function qn(e){return 2**e}function $t(e,t){return t<=qn(e)}function Xt(e,t,r){return de(e,t)<=r}function lt(e){return e<=2?re[1]:e<=4?re[2]:e<=16?re[4]:e<=256?re[8]:e<=65536?re[16]:re[32]}function zr(e){return lt(e)}function xe(e){return re[e]}function $r(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){return qt(e,t,r)??Wt}function qt(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of Ot){let i=xe(n);if($t(n,e)&&Xt(t,i,r))return i}return null}function Yt(e){return xe(e?.bitsPerCell??8)}function ke(e){return{bitsPerCell:e.bitsPerCell}}function le(e,t){return Math.ceil(e/t.cellsPerWord)}function de(e,t){return le(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Xr(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function Yn(e){return{population:typeof e?.population=="boolean"?e.population:we.population,diversity:typeof e?.diversity=="boolean"?e.diversity:we.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:we.interfaces}}function Kt(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Ze.enabled,sections:Yn(e?.sections)}}function qr(e,t,r,n,i){let s=le(t.cols,r),o=e[i*s+(n>>r.wordShift)]??0;return Kn(o,r,n&r.cellIndexMask)}function Yr(e,t,r,n,i,s){let o=le(t.cols,r),c=i*o+(n>>r.wordShift),u=(n&r.cellIndexMask)<<r.cellShift,l=~(r.cellMask<<u),h=e[c]??0;e[c]=(h&l|(s&r.cellMask)<<u)>>>0}function Kn(e,t,r){return t.bitsPerCell===32?e>>>0:e>>>(r<<t.cellShift)&t.cellMask}var fs=64*1024*1024;function Ht(e,t,r,n){let i=e,s;if(r.bitsPerCell===n.bitsPerCell)s=e;else{s=new Uint32Array(de(t,n)/Uint32Array.BYTES_PER_ELEMENT);for(let o=0;o<t.rows;o++)for(let c=0;c<t.cols;c++)Yr(s,t,n,c,o,qr(i,t,r,c,o))}return s}var a,U=!1,Ct,ft,ge,Oe,y=0,C=0,Et=0,b=Ve,J=[],se=new Map,wt,Qt,F,D,Re,ye,We,Jt,er,Le,pr,mr,A=!1,sn=1,on=0,an=0,x=!1,I=!1,j=100,R=0,pt,Vn=4,_e=[],vt=[],_t=[],Zn=0,mt=null,Se={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},oe=null,V=-1,z=!1,q=!1,jt=0,Ne=Ze,gt=[],k=!1,K=!1,Y={chunks:[],generationStart:0,generationEnd:0,gridFormat:ke(Ve)},cn=0,P=[],S=null,un=0,Te=!1,L=null,v=0,w=[],be=null,M=64,m=0,xt=3,ee=[],$=[],bt="gol-recording",kt="raw-packed",ln="deflate-raw",Fe=null,fe=null,Q=0,ze=0,ie=0,Kr=12,G=!1,Ae=0,dn=256,Qn=dn*Uint32Array.BYTES_PER_ELEMENT,Hr=256*1024*1024,Jn=512*1024*1024,jr=128*1024*1024*1024,ht=0,St=0,De=[];function ei(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function fn(e){console.error("[GOLT worker] Worker GPU error:",e),T("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),x=!1,self.postMessage({type:"gpuError",reason:ei(e)})}self.addEventListener("error",e=>{e.preventDefault(),fn(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),fn(e.reason)});async function gr(){await a.queue.onSubmittedWorkDone()}function Vr(e){ht=0,St=2+(e?1+xt:0),De=[]}async function Rt(){if(De.length===0)return;let e=a.createCommandEncoder({label:d.trackedAllocationClearEncoder});for(let t of De)e.clearBuffer(t);a.queue.submit([e.finish()]),await gr(),De=[]}async function Pt(e,t){!I||St<=0||(ht+=e,St--,De.push(t),ht>=ti()&&St>0&&(await Rt(),ht=0))}function ti(){return Math.min(ae(),Jn)}function ae(){return Math.min(a.limits.maxBufferSize,a.limits.maxStorageBufferBindingSize)}function Ye(){return Math.min(ae(),1073741824)}function pn(){return Math.max(ae()*2,Ye()*6)}function W(){return m>0&&m<=Ye()}function ri(){return m<=0?0:m*2+hr+Qn+Sr+Be*2+Ee*2}function ni(){return M<1||m<=0?0:M*m*(1+xt)}function Mt(){L?.destroy(),L=null;for(let e of ee)e?.destroy();ee=[],$=[],M=0,v=0,w=[],be=null,ze=0}function Zr(){F?.destroy(),D?.destroy(),Fr(oe),oe=null,_e.forEach(e=>e.destroy()),_e=[],vt=[],_t=[],Mt()}function Vt(e){let t=Q>0;Q+=e;let r=Q>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function Ce(){if(M<1||ee.length===0){G&&(G=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=yr(),t=!$.some(i=>i)&&v>=M,r=ie>=e,n;if(G){let i=$.some(o=>o),s=ie<=Math.floor(e/2);n=!(i&&s)}else n=t||r;n!==G&&(G=n,self.postMessage({type:"backpressure",active:n}))}async function ve(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??jr/128,jr),r=e.usage??0,n=0,i=0;for(let c of P)c.codec===kt?n+=c.storedBytes:i+=c.storedBytes;let s=M*m,o=k?(1+xt)*s:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:o})}var $e=!1;async function ii(e){let t=new DecompressionStream(ln),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:u,value:l}=await i.read();if(u)break;n.push(l)}let s=0;for(let u of n)s+=u.byteLength;let o=new Uint8Array(s),c=0;for(let u of n)o.set(u,c),c+=u.byteLength;return o.buffer}var Pe=0,dt=0,br=0;function mn(e,t,r=a.limits.maxComputeWorkgroupsPerDimension){if(e<=r&&t<=r)return{logicalWgX:e,logicalWgY:t,dispatchWgX:e,dispatchWgY:t,remapped:!1};let n=e*t,i=Math.min(n,r),s=Math.ceil(n/i);if(s>r)throw new Error(`Grid requires ${e}x${t} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${r}.`);return{logicalWgX:e,logicalWgY:t,dispatchWgX:i,dispatchWgY:s,remapped:!0}}function si(){return mn(Math.ceil(Et/16),Math.ceil(C/16))}function oi(){return mn(Math.ceil(y/16),Math.ceil(C/16))}function ai(e,t){t.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${t.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${t.dispatchWgX}u;`))}function ci(e){e.push(`const CELLS_PER_WORD: u32 = ${b.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${b.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${b.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${b.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${b.cellMask}u;`)}function ui(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function li(e,t,r){if(t.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${r} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${r} = gid.x;`),e.push("  let y = gid.y;")}function di(){let e=[],t=Et,r=wt;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${J.map(f=>f.id).join(", ")}`),e.push(`// Rules: ${Oe.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${y}u;`),e.push(`const ROWS: u32 = ${C}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),ai(e,r),ci(e),e.push(""),ui(e,"gridIn","PACKED_COLS"),e.push("");let n=se.get(Qe)??0,i=Oe.rules.filter(f=>!f.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let s=pi(i.map(f=>f.clause)),o=new Map,c=0;for(let f of s){let p=`count_${c++}`;o.set(f,p)}for(let[f,p]of o){let B=f.split(",").map(Number),O=Qr().map(g=>`select(0u, 1u, ${B.map(H=>`${g} == ${H}u`).join(" || ")})`);e.push(`  let ${p} = ${O.join(" + ")};`)}s.size>0&&e.push("");let u=mi(i.map(f=>f.clause)),l=new Map,h=0;for(let f of u)if(o.has(f))l.set(f,o.get(f));else{let p=`eq_count_${h++}`;l.set(f,p)}for(let[f,p]of l){if(o.has(f))continue;let B=f.split(",").map(Number),O=Qr().map(g=>`select(0u, 1u, ${B.map(H=>`${g} == ${H}u`).join(" || ")})`);e.push(`  let ${p} = ${O.join(" + ")};`)}u.size>0&&h>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let f=0;f<i.length;f++){let p=i[f],B=Ie(p.clause,o,l),_=fi(p.tribe);f===0?e.push(`  if (${B}) {`):e.push(`  } else if (${B}) {`),e.push(`    result = ${_}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),r.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),li(e,r,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let f=-1;f<=1;f++)for(let p=-1;p<=1;p++){if(p===0&&f===0)continue;let B=gn(p,f),_=Jr("x",p,"COLS"),O=Jr("y",f,"ROWS");e.push(`    let ${B} = readCell(${_}, ${O});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function gn(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function Qr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(gn(r,t));return e}function Jr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function N(e){let t=[];for(let r of e)if(r===Nt)for(let n=0;n<J.length;n++)t.push(n);else{let n=se.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function fi(e){return e===Nt?0:se.get(e)??0}function pi(e){let t=new Set;for(let r of e)tr(r,t);return t}function tr(e,t){switch(e.kind){case Je:case et:break;case rt:case nt:case it:case st:case tt:{let r=N(e.tribes).sort();t.add(r.join(","));break}case ot:tr(e.clause,t);break;case at:case ct:case ut:for(let r of e.clauses)tr(r,t);break}}function mi(e){let t=new Set;for(let r of e)rr(r,t);return t}function rr(e,t){switch(e.kind){case Je:case et:case tt:case rt:case nt:case it:case st:break;case zt:{let r=N(e.tribe1).sort(),n=N(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case ot:rr(e.clause,t);break;case at:case ct:case ut:for(let r of e.clauses)rr(r,t);break}}function Ie(e,t,r){switch(e.kind){case Je:return"false";case et:{let n=N(e.tribes);return n.length===0?"false":n.length===J.length?"true":`(${n.map(s=>`selfTribe == ${s}u`).join(" || ")})`}case tt:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case rt:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case nt:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case it:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case st:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case zt:{let n=r.get(N(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),s=`(i32(${r.get(N(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${s})`;case">":return`(i32(${n}) > ${s})`;case"<":return`(i32(${n}) < ${s})`;case"\u2265":return`(i32(${n}) >= ${s})`;case"\u2264":return`(i32(${n}) <= ${s})`;default:return`(i32(${n}) == ${s})`}}case ot:return`!(${Ie(e.clause,t,r)})`;case at:return`(${e.clauses.map(i=>Ie(i,t,r)).join(" && ")})`;case ct:return`(${e.clauses.map(i=>Ie(i,t,r)).join(" || ")})`;case ut:return`(((${e.clauses.map(s=>Ie(s,t,r)).map(s=>`select(0u, 1u, ${s})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var hr=80;function nr(){Re?.destroy(),Re=a.createBuffer({label:d.uniformBuffer,size:hr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function gi(){let e=new ArrayBuffer(hr),t=new Float32Array(e),r=new Int32Array(e),n=new Uint32Array(e),i=(on%y+y)%y,s=(an%C+C)%C,o=Math.floor(i),c=Math.floor(s);t[0]=ge.width,t[1]=ge.height,t[2]=sn,t[4]=i-o,t[5]=s-c,n[6]=y,n[7]=C,n[8]=o,n[9]=c,n[10]=J.length,r[12]=Se.centerX,r[13]=Se.centerY,n[14]=Se.brushSize,n[15]=Se.shape,n[16]=Se.visible?1:0,a.queue.writeBuffer(Re,0,e)}function Tt(){return de({cols:y,rows:C},b)}function ce(){return ke(b)}async function ir(){let e=Tt();F=a.createBuffer({label:d.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Pt(e,F),D=a.createBuffer({label:d.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Pt(e,D);let t=a.createCommandEncoder({label:d.gridClearEncoder});t.clearBuffer(F),t.clearBuffer(D),a.queue.submit([t.finish()]),A=!1}function sr(){let e=new Uint32Array(dn);for(let t=0;t<J.length;t++){let r=J[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),s=parseInt(r.substring(4,6),16);e[t]=n|i<<8|s<<16}ye&&ye.destroy(),ye=a.createBuffer({label:d.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),a.queue.writeBuffer(ye,0,e)}function bi(){return Wr.replace("__CELLS_PER_WORD__",`${b.cellsPerWord}u`).replace("__WORD_SHIFT__",`${b.wordShift}u`).replace("__CELL_SHIFT__",`${b.cellShift}u`).replace("__CELL_INDEX_MASK__",`${b.cellIndexMask}u`).replace("__CELL_MASK__",`${b.cellMask}u`)}function or(){let e=a.createShaderModule({label:d.renderShaderModule,code:bi()});We=a.createRenderPipeline({label:d.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:ft}]},primitive:{topology:"triangle-list"}})}function ar(){Jt=a.createBindGroup({layout:We.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Re}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:ye}}]}),er=a.createBindGroup({layout:We.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Re}},{binding:1,resource:{buffer:D}},{binding:2,resource:{buffer:ye}}]})}function cr(){wt=si();let e=di(),t=a.createShaderModule({label:d.simulationShaderModule,code:e});Le=a.createComputePipeline({label:d.simulationPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),pr=a.createBindGroup({layout:Le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:D}}]}),mr=a.createBindGroup({layout:Le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:F}}]})}function ur(){Qt=oi(),oe=Lr({device:a,cols:y,rows:C,gridFormat:b,dispatchPlan:Qt})}var Sr=192;function hi(){return`
struct BrushParams {
  packedCols: u32,
  brushSize: u32,
  shape: u32,      // 0=square 1=round 2=diamond 3=vline, 4=hline
  fill: u32,        // 0=full 1=spray 2=outline
  deadId: u32,
  seed: u32,
  tribeCount: u32,
  destinationStartX: u32,
  destinationStartY: u32,
  localStartX: u32,
  localStartY: u32,
  spanCols: u32,
  spanRows: u32,
  pad: u32,
  tribeIds: array<u32, 32>,
}

@group(0) @binding(0) var<storage, read_write> grid: array<u32>;
@group(0) @binding(1) var<uniform> params: BrushParams;

const CELLS_PER_WORD: u32 = ${b.cellsPerWord}u;
const WORD_SHIFT: u32 = ${b.wordShift}u;
const CELL_SHIFT: u32 = ${b.cellShift}u;
const CELL_INDEX_MASK: u32 = ${b.cellIndexMask}u;
const CELL_MASK: u32 = ${b.cellMask}u;

fn pcg(inp: u32) -> u32 {
  var state = inp * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn writePackedWord(wordIdx: u32, writeMask: u32, writeBits: u32) {
  let old = grid[wordIdx];
  let updated = (old & ~writeMask) | (writeBits & writeMask);
  grid[wordIdx] = updated;
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
  let startWord = params.destinationStartX >> WORD_SHIFT;
  let endWordExclusive = (params.destinationStartX + params.spanCols + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
  let spanWords = endWordExclusive - startWord;
  let wordOffset = gid.x;
  let rowOffset = gid.y;
  if (wordOffset >= spanWords || rowOffset >= params.spanRows) { return; }

  let cy = params.destinationStartY + rowOffset;
  let localBy = params.localStartY + rowOffset;
  let wordX = startWord + wordOffset;
  let wordIdx = cy * params.packedCols + wordX;
  let wordBaseCellX = wordX << WORD_SHIFT;
  let rectEndX = params.destinationStartX + params.spanCols;

  var writeMask = 0u;
  var writeBits = 0u;

  for (var lane = 0u; lane < CELLS_PER_WORD; lane++) {
    let cx = wordBaseCellX + lane;
    let insideRect = cx >= params.destinationStartX && cx < rectEndX;
    if (insideRect) {
      let localBx = params.localStartX + (cx - params.destinationStartX);
      let bx = i32(localBx);
      let by = i32(localBy);
      var insideShape = false;
      if (params.fill == 2u) {
        insideShape = onBorder(bx, by, params.brushSize, params.shape);
      } else {
        insideShape = inShape(bx, by, params.brushSize, params.shape);
      }

      if (insideShape) {
        let idx = localBy * params.brushSize + localBx;
        let spatialHash = (cx * 73856093u) ^ (cy * 19349663u);
        let h = pcg(params.seed ^ idx ^ spatialHash);
        let selectedTribe = params.tribeIds[h % params.tribeCount];
        var shouldWrite = true;
        var value = selectedTribe;

        if (params.fill == 1u && ((h >> 16u) & 1u) != 0u) {
          if (selectedTribe != params.deadId) {
            value = params.deadId;
          } else {
            shouldWrite = false;
          }
        }

        if (shouldWrite) {
          let shift = (lane & CELL_INDEX_MASK) << CELL_SHIFT;
          let mask = CELL_MASK << shift;
          writeMask |= mask;
          writeBits = (writeBits & ~mask) | ((value & CELL_MASK) << shift);
        }
      }
    }
  }

  if (writeMask != 0u) {
    writePackedWord(wordIdx, writeMask, writeBits);
  }
}
`}function lr(){let e=a.createShaderModule({label:d.brushShaderModule,code:hi()});pt=a.createComputePipeline({label:d.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),_e.forEach(t=>t.destroy()),_e=[],vt=[],_t=[];for(let t=0;t<Vn;t++){let r=a.createBuffer({label:`${d.brushUniformBuffer} ${t}`,size:Sr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});_e.push(r),vt.push(a.createBindGroup({layout:pt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:r}}]})),_t.push(a.createBindGroup({layout:pt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:r}}]}))}}function en(e,t,r){let n=Math.floor((t-1)/2),i=e-n,s=i+t,o=[];if(i>=0&&s<=r)o.push({destinationStart:i,localStart:0,span:t});else if(i<0){let c=-i;o.push({destinationStart:r-c,localStart:0,span:c}),o.push({destinationStart:0,localStart:c,span:t-c})}else{let c=r-i;o.push({destinationStart:i,localStart:0,span:c}),o.push({destinationStart:0,localStart:c,span:s-r})}return o.filter(c=>c.span>0)}function Si(e,t,r){let n=en(e,r,y),i=en(t,r,C),s=[];for(let o of i)for(let c of n)s.push({destinationStartX:c.destinationStart,destinationStartY:o.destinationStart,localStartX:c.localStart,localStartY:o.localStart,spanCols:c.span,spanRows:o.span});return s}function yi(e,t,r,n,i,s,o){let c=se.get(Qe)??0,u=Zn++,l=Si(t,r,n),h=A?_t:vt;for(let[f,p]of l.entries()){let B=new ArrayBuffer(Sr),_=new Uint32Array(B);_[0]=Et,_[1]=n,_[2]=i,_[3]=s,_[4]=c,_[5]=u,_[6]=o.length,_[7]=p.destinationStartX,_[8]=p.destinationStartY,_[9]=p.localStartX,_[10]=p.localStartY,_[11]=p.spanCols,_[12]=p.spanRows,_[13]=0;for(let Me=0;Me<o.length&&Me<32;Me++)_[14+Me]=o[Me];a.queue.writeBuffer(_e[f],0,B);let O=Math.floor(p.destinationStartX/b.cellsPerWord),E=Math.ceil((p.destinationStartX+p.spanCols)/b.cellsPerWord)-O,H=Math.ceil(E/8),Ft=Math.ceil(p.spanRows/8),te=e.beginComputePass({label:d.brushPass});te.setPipeline(pt),te.setBindGroup(0,h[f]),te.dispatchWorkgroups(H,Ft),te.end()}}function Ci(){let e=A?D:F,t=Tt(),r;try{r=a.createBuffer({label:d.gridReadbackBuffer,size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=a.createCommandEncoder({label:d.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,r,0,t),a.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function bn(){if(m=Tt(),!W()){M=0;return}let e=vi();M=Math.max(1,Math.floor(e/m))}function vi(){return m>=Hr?m:Math.min(Math.max(Hr,m),Ye())}function yr(){if(M<1||m<=0)return Kr;let e=Math.max(m,M*m),t=Math.floor(536870912/e);return Math.max(1,Math.min(Kr,t||1))}function dr(){let e=W();self.postMessage({type:"limits",maxBytes:ae(),vramBudgetBytes:pn(),frameByteSize:m,recordingAvailable:e,vramSimulationBytes:ri(),vramRecordingBytes:ni(),gridFormat:ce()})}function Xe(){return!W()||M<1||L===null||ee.length===0?!1:v<M?!0:hn()}function hn(){return ie>=yr()?!1:ee.some((e,t)=>$[t]&&e.mapState==="unmapped")}function Ke(e){if(M<1||L===null||v>=M)return;let t=A?D:F,r=v*m,n=a.createCommandEncoder({label:d.recordingFrameCopyEncoder});n.copyBufferToBuffer(t,0,L,r,m),a.queue.submit([n.finish()]),w.push(e),be=e,v++,yt()}function Zt(e){ze=Math.max(0,ze+e)}function yt(){M>0&&v>=M&&hn()&&qe()}function qe(){if(L===null||v===0||ee.length===0||ie>=yr())return;let e=$.indexOf(!0);if(e<0)return;$[e]=!1;let t=ee[e];if(t.mapState!=="unmapped"){$[e]=!0;return}let r=v*m,n=cn++,i=[...w],s=i[0],o=i[i.length-1],c=`chunk-${String(n).padStart(6,"0")}.bin`,u=v,l=a.createCommandEncoder({label:d.recordingSealCopyEncoder});l.copyBufferToBuffer(L,0,t,0,r),a.queue.submit([l.finish()]);let h={chunkId:n,generationStart:s,generationEnd:o,blockCount:u,codec:kt,uncompressedBytes:r,storedBytes:r,gridFormat:ce(),generations:i,filename:c};Vt(1),Zt(u),ie++,Ce();let f=Ae;t.mapAsync(GPUMapMode.READ).then(async()=>{let p=t.getMappedRange(),B=new ArrayBuffer(r);new Uint8Array(B).set(new Uint8Array(p,0,r)),t.unmap(),f===Ae&&($[e]=!0,P.push(h),Zt(-u),Cr(),Ce(),yt(),_i(h,B).then(()=>{f===Ae&&(ie--,Ce(),Vt(-1),ve(),Bt(),It(!0),yt(),self.postMessage({type:"chunkSealed",filename:h.filename,rawBytes:r,blockCount:h.blockCount,cols:y,rows:C,rawGridFormat:h.gridFormat,storageGridFormat:ke(lt(Oe.tribes.length))}),$e&&Q===0&&($e=!1,Bt()))}))}).catch(()=>{f===Ae&&($[e]=!0,ie--,Zt(-u),Ce(),Vt(-1),yt())}),v=0,w=[]}function Cr(){P.length>0&&(Y.generationStart=P[0].generationStart,Y.generationEnd=P[P.length-1].generationEnd),w.length>0&&(P.length===0&&(Y.generationStart=w[0]),Y.generationEnd=w[w.length-1]),Y.chunks=[...P]}async function tn(e){Ae++,cn=0,v=0,w=[],P=[],be=null,ze=0,ie=0,Q>0&&(Q=0,self.postMessage({type:"chunksSaving",active:!1})),G&&(G=!1,self.postMessage({type:"backpressure",active:!1})),$e=!1,K=k,Y={chunks:[],generationStart:e,generationEnd:e,gridFormat:ce()},await Sn(),ve()}async function vr(){return fe&&await fe,Fe||(Fe=await(await navigator.storage.getDirectory()).getDirectoryHandle(bt,{create:!0})),Fe}async function _i(e,t){let i=await(await(await vr()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function Ri(e){let t=await vr();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function Sn(){if(fe){await fe;return}fe=(async()=>{let e=await navigator.storage.getDirectory();Fe=null;try{await e.removeEntry(bt,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${bt}:`,t)}Fe=await e.getDirectoryHandle(bt,{create:!0})})();try{await fe}finally{fe=null}}function Bt(){Cr(),self.postMessage({type:"recording",manifest:{chunks:P.map(e=>({...e,generations:[...e.generations]})),generationStart:Y.generationStart,generationEnd:Y.generationEnd,gridFormat:ce()},cols:y,rows:C})}function Pi(){return be!==R}function Ue(e=!1){if(k){if(e){if(K){if(!Xe())return;K=!1}}else if(K)return;!Pi()||!Xe()||(v>=M&&qe(),Ke(R))}}function _r(){if(mt){let e=mt;mt=null;let t=k&&v>0&&w[v-1]===R;t&&(v--,w.pop());let r=a.createCommandEncoder({label:d.brushEncoder});yi(r,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),a.queue.submit([r.finish()]),t&&Ke(R)}}async function Mi(e,t=kt){let s=await(await(await(await vr()).getFileHandle(e)).getFile()).arrayBuffer();return t===ln?ii(s):s}function Bi(){let e=v+ze;for(let t of P)e+=t.blockCount;return e}function yn(){return kr(y,C,Ne.enabled,Ne.sections)}function Ei(){return Tr(yn())}function pe(e){gt=Ei(),oe&&gt.length!==0&&Dr({device:a,encoder:e,resources:oe,sourceBuffer:A?D:F,dispatchPlan:Qt,enabledSections:gt})}function me(){let e=R;if(!oe||e===V||z)return;let t=oe,r=[...gt],n=yn();V=e,z=!0,Ur({resources:t,enabledSections:r}).then(i=>{let s=se.get(Qe)??0,o=Bi(),c=Or({generation:e,tribes:J,deadTribeIndex:s,readback:i,enabledSections:r,availability:n,liveMetricSettings:Ne.sections,cols:y,rows:C,totalFrames:o,fps:br,canStepBack:o>1,recordingBytes:P.reduce((u,l)=>u+l.storedBytes,0),recordingRawBytes:P.reduce((u,l)=>u+l.uncompressedBytes,0)});if(z=!1,self.postMessage(c),q)if(q=!1,V=-1,Bn()){let u=a.createCommandEncoder({label:d.interactiveMetricsEncoder});pe(u),a.queue.submit([u.finish()]),me()}else q=!0}).catch(()=>{z=!1})}function Cn(){let e=y*C;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function vn(e){return e==="recording"?Number.MAX_SAFE_INTEGER:Cn()*Rn()}function _n(e,t,r,n,i,s){let o=t-r*i;n>i||n>s?e.stepAccumulator=Math.min(o,r):e.stepAccumulator=o}function Rn(){let e=y*C;return e>1e7?2:e>1e6?4:e>1e5?8:16}function Pn(e){if(e<=0)return;let t=wt,r=a.createCommandEncoder({label:d.simulationBatchEncoder});for(let n=0;n<e;n++){let i=r.beginComputePass({label:d.simulationStepPass});i.setPipeline(Le),i.setBindGroup(0,A?mr:pr),i.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),i.end(),A=!A,R++}a.queue.submit([r.finish()]),Pe+=e}function wi(){self.postMessage({type:"generation",generation:R,fps:br})}function Rr(){let e=a.createCommandEncoder({label:d.simulationSingleStepEncoder}),t=e.beginComputePass({label:d.simulationStepPass});t.setPipeline(Le),t.setBindGroup(0,A?mr:pr);let r=wt;t.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),t.end(),a.queue.submit([e.finish()]),A=!A,R++}function Z(){if(!!(a&&Ct&&Re&&We&&Jt&&er&&!I&&!U)){gi();let t=Ct.getCurrentTexture().createView(),r=a.createCommandEncoder({label:d.renderEncoder}),n=r.beginRenderPass({label:d.renderPass,colorAttachments:[{view:t,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});n.setPipeline(We),n.setBindGroup(0,A?er:Jt),n.draw(3),n.end(),a.queue.submit([r.finish()])}}function Mn(e){dt===0&&(dt=e);let t=e-dt;t>=1e3&&(br=Pe/(t/1e3),Pe=0,dt=e)}function Pr(){return k&&W()?"recording":"nonRecording"}function xi(){return j<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/j}}function ue(e){return e.request.stopCondition.kind==="targetGeneration"}function He(e){return e.request.stopCondition.kind==="targetGeneration"&&R>=e.request.stopCondition.generation}function At(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-R)}function Bn(){return!!(a&&oe&&!I&&!U)}function It(e=!1){if(e&&(V=-1),!Bn())q=!0;else if(z)q=!0;else{let t=a.createCommandEncoder({label:d.interactiveMetricsEncoder});pe(t),a.queue.submit([t.finish()]),me()}}function En(){It(!0),Z()}function Gt(e,t){if(!t)return;(e-jt>=1e3||jt===0)&&!z&&(jt=e,It())}function je(e,t){e.request.pacing.kind!=="max"&&!ue(e)||t-e.lastProgressTime>=1e3&&(e.lastProgressTime=t,wi())}function Lt(){G&&(G=!1,self.postMessage({type:"backpressure",active:!1}))}function wn(){G||(G=!0,self.postMessage({type:"backpressure",active:!0}))}function Mr(){return Xe()?(v>=M&&qe(),Xe()):!1}function Ge(){I||U||S||self.requestAnimationFrame(fr)}function he(e){let t=S;if(!t||t.pumpPending||I||U)return;let{token:r}=t;t.pumpPending=!0;let n=()=>{!S||S.token!==r||(S.pumpPending=!1,Li(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?a.queue.onSubmittedWorkDone().then(n).catch(()=>{S?.token===r&&(S.pumpPending=!1)}):queueMicrotask(n)}function Br(e,t){S&&T("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),S={kind:e,request:t,token:++un,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0},he(t.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function ne(){x&&Br(Pr(),{pacing:xi(),stopCondition:{kind:"none"}})}function T(e,t={}){let r=S;if(!r)return;S=null,un++;let n=ue(r),i=t.restore!==!1&&!!r.request.restoreAfterStop;i&&r.request.restoreAfterStop&&(x=r.request.restoreAfterStop.running,j=r.request.restoreAfterStop.targetStepDuration),n&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?Lt():G&&Ce(),t.render!==!1&&!I&&!U&&En(),t.restartRestoredRun!==!1&&i&&x&&!I&&!U?ne():Ge()}function rn(e){let t=S;!t||!ue(t)||(t.request.restoreAfterStop&&(t.request.restoreAfterStop.running=e),T("cancelled"))}function ki(e){T("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Br(Pr(),e)}function xn(e,t,r){wn(),je(e,t),Gt(t,r),he("drain")}function Ti(e,t){let r=Cn(),n=Rn(),i=!1;for(let s=0;s<n;s++){let o=At(e);if(o<=0)break;let c=Math.min(r,o);Pn(c),i=!0}if(je(e,t),He(e)){T("targetReached");return}he(i?"drain":"raf")}function Ai(e,t){Ue(!0);let r=!1,n=performance.now()+14;for(;At(e)>0&&performance.now()<n;){if(!Mr()){xn(e,t,r);return}Rr(),Pe++,r=!0,Ke(R)}if(Lt(),je(e,t),Gt(t,r),He(e)){T("targetReached");return}he("raf")}function Ii(e,t,r){e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=e.stepAccumulator,s=Math.floor(e.stepAccumulator/t),o=vn(e.kind),c=Math.min(s,At(e),o),u=c>0;if(u&&Pn(c),_n(e,i,t,s,c,o),je(e,r),He(e)){T("targetReached");return}let l=u&&s>c;if(!ue(e)){let h=r-e.lastRenderTime;(!l||h>=33||e.lastRenderTime===0)&&(e.lastRenderTime=r,Z(),Gt(r,u))}he(l?"drain":"raf")}function Gi(e,t,r){Ue(!0),e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=!1,s=0,o=e.stepAccumulator,c=vn(e.kind),u=Math.floor(e.stepAccumulator/t),l=performance.now()+14;for(;e.stepAccumulator>=t&&At(e)>0&&s<c&&performance.now()<l;){if(!Mr()){xn(e,r,i);return}Rr(),Pe++,s++,e.stepAccumulator-=t,i=!0,Ke(R)}if(_n(e,o,t,u,s,c),Lt(),je(e,r),He(e)){T("targetReached");return}ue(e)||(Z(),Gt(r,i)),he("raf")}function Li(e){let t=S;if(!t||I||U)return;if(Mn(e),ue(t)||_r(),He(t)){T("targetReached");return}if(t.request.pacing.kind==="max"){t.kind==="recording"?Ai(t,e):Ti(t,e);return}let r=1e3/t.request.pacing.genPerSecond;t.kind==="recording"?Gi(t,r,e):Ii(t,r,e)}function fr(e){if(I||U){self.requestAnimationFrame(fr);return}Mn(e),!S&&(_r(),j>0&&!Te&&Z(),self.requestAnimationFrame(fr))}function Fi(e,t){let r=a?ae():Number.POSITIVE_INFINITY;return Nr(t.bitsPerCell)&&$t(t.bitsPerCell,e.tribes.length)&&Xt(e,xe(t.bitsPerCell),r)?xe(t.bitsPerCell):$r(e.tribes.length,e,r)}function nn(e,t){Oe=e,y=e.cols,C=e.rows,b=Fi(e,t),Et=le(y,b),J=[...e.tribes],Y.gridFormat=ce(),se.clear(),J.forEach((r,n)=>se.set(r.id,n))}async function kn(e){console.log("[GOLT worker] Initializing WebGPU"),ge=e,a=await wr(d.webengineDevice),U=!1,a.lost.then(r=>{let n=r.message||r.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),T("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),U=!0,x=!1,I=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:ae(),vramBudgetBytes:pn(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:ce()});let t=ge.getContext("webgpu");if(!t)throw new Error("WebGPU canvas context not available");Ct=t,ft=navigator.gpu.getPreferredCanvasFormat(),Ct.configure({device:a,format:ft,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:ft,maxBufferSize:a.limits.maxBufferSize,maxStorageBufferBindingSize:a.limits.maxStorageBufferBindingSize})}async function Di(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await kn(ge),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let t=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",t),T("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),U=!0,x=!1,I=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function Tn(){L=a.createBuffer({label:d.recordingChunkBuffer,size:M*m,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Pt(M*m,L),v=0,w=[],be=null}async function An(){let e=M*m;ee=[],$=[];for(let t=0;t<xt;t++){let r=a.createBuffer({label:`${d.recordingStagingBuffer} ${t}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});ee.push(r),$.push(!0),await Pt(e,r)}}async function Ui(){await Sn()}async function Oi(){console.log("[GOLT worker] Building GPU resources",{cols:y,rows:C,bitsPerCell:b.bitsPerCell,recordingAvailable:W()}),nr(),bn(),await ir(),sr(),or(),ar(),cr(),lr(),ur(),await Ui(),W()?(await Tn(),await An()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:m,maxRecordingBufferBytes:Ye()}),Mt(),k=!1,K=!1),await Rt(),dr(),console.log("[GOLT worker] GPU resources ready")}async function Wi(){console.log("[GOLT worker] Rebuild started",{cols:y,rows:C,bitsPerCell:b.bitsPerCell}),T("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),I=!0,self.postMessage({type:"rebuilding",active:!0});try{await gr()}catch{}if(U&&!await Di())return!1;Zr(),nr(),bn(),Vr(W());try{await ir(),sr(),or(),cr(),lr(),ar(),ur(),W()?(await Tn(),await An()):(Mt(),k=!1,K=!1),await Rt(),dr()}catch(e){let t=e instanceof Error?e.message:String(e);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{Zr(),nr(),Vr(!1),await ir(),sr(),or(),cr(),lr(),ar(),ur(),k=!1,K=!1,m=Tt(),Mt(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await Rt(),dr()}catch(r){return console.error("[GOLT worker] GPU rebuild recovery failed:",r),!1}}return I=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:W(),frameByteSize:m}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(console.log("[GOLT worker] Init message received",{cols:t.ruleset.cols,rows:t.ruleset.rows,recording:t.recording,running:t.running,speed:t.speed}),k=t.recording,Ne=Kt(t.liveMetrics),K=k,nn(t.ruleset,t.simulationGridFormat),await kn(t.canvas),await Oi(),z)q=!0;else{let r=a.createCommandEncoder({label:d.interactiveMetricsEncoder});pe(r),a.queue.submit([r.finish()]),me()}ve(),x=t.running,j=t.speed<0?0:1e3/t.speed,x?ne():Ge();break}case"setLiveMetrics":{Ne=Kt(t.liveMetrics),V=-1,It(!0);break}case"setRuleset":{if(console.log("[GOLT worker] Ruleset update received",{cols:t.ruleset.cols,rows:t.ruleset.rows,tribes:t.ruleset.tribes.length}),qt(t.ruleset.tribes.length,t.ruleset,ae())){if(T("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),nn(t.ruleset,t.simulationGridFormat),await Wi())if(R=0,V=-1,await tn(0),x?ne():Ge(),z)q=!0;else{let i=a.createCommandEncoder({label:d.interactiveMetricsEncoder});pe(i),a.queue.submit([i.finish()]),me()}}else{let i=`Requested ruleset requires at least ${zr(t.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",i,{cols:t.ruleset.cols,rows:t.ruleset.rows,tribes:t.ruleset.tribes.length,maxBytes:ae()}),self.postMessage({type:"gpuError",reason:i})}break}case"setRunning":if(x=t.running,t.running){S||ne();break}S&&ue(S)?rn(!1):S?T("manual"):(G&&Ce(),En(),Ge());break;case"setSpeed":{let r=j<=0,n=t.speed<0?0:1e3/t.speed;j=n,S&&!ue(S)&&x?(T("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&n>0?(Te=!0,a.queue.onSubmittedWorkDone().then(()=>{Te=!1,Z(),ne()})):ne()):x&&!S?ne():r&&n>0&&(Te=!0,a.queue.onSubmittedWorkDone().then(()=>{Te=!1,Z(),Ge()}));break}case"camera":sn=t.scale,on=t.offsetX,an=t.offsetY;break;case"resize":ge.width=t.width,ge.height=t.height;break;case"draw":{let r=t.tribes.map(n=>se.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2},s=n[t.shape]??0,o=i[t.fill]??0;mt={centerX:t.x,centerY:t.y,brushSize:t.size,shape:s,fill:o,tribeIds:r}}break}case"brushPreview":{let r={square:0,round:1,diamond:2,vline:3,hline:4};Se={centerX:t.x,centerY:t.y,brushSize:t.size,shape:r[t.shape]??0,visible:t.visible},!S&&!I&&!U&&j<=0&&Z();break}case"getSnapshot":{Ci().then(r=>{let n={type:"snapshot",grid:r,generation:R,cols:y,rows:C,gridFormat:ce()};self.postMessage(n,[r.buffer])}).catch(()=>{let r=new Uint32Array(0),n={type:"snapshot",grid:r,generation:R,cols:y,rows:C,gridFormat:ce()};self.postMessage(n,[r.buffer])});break}case"loadSnapshot":{let r=A?D:F,n=Yt(t.gridFormat),i=de({cols:y,rows:C},n);if(t.grid.byteLength!==i)break;let s=Ht(t.grid,{cols:y,rows:C},n,b);a.queue.writeBuffer(r,0,s),R=t.generation,await tn(t.generation);break}case"setRecording":{let r=S?.request;if(t.recording&&W()&&!k){if(k=!0,K=!0,V=-1,z)q=!0;else{let n=a.createCommandEncoder({label:d.interactiveMetricsEncoder});pe(n),a.queue.submit([n.finish()]),me()}ve()}else(!t.recording||!W())&&(t.recording&&!W()&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:m,maxRecordingBufferBytes:Ye()}),k=!1,K=!1);r&&S?ki(r):!S&&x&&ne();break}case"getRecording":{if($e)break;await gr(),Ue(!1),v>0&&qe(),Q>0?$e=!0:Bt();break}case"stepBack":{let r=0;for(let c of P)r+=c.blockCount;let n=r+v,i=Math.min(t.count,n-1);if(i<=0)break;let s=n-1-i,o=A?D:F;if(s>=r){let c=s-r;v=c+1,w.length=v,R=w[c],be=R;let u=a.createCommandEncoder({label:d.recordingRestoreCopyEncoder});u.copyBufferToBuffer(L,c*m,o,0,m),a.queue.submit([u.finish()])}else{if(Q>0){await new Promise(g=>{let E=setInterval(()=>{Q===0&&(clearInterval(E),g())},10)}),r=0;for(let g of P)r+=g.blockCount}let c=0,u=0,l=0;for(let g=0;g<P.length;g++){let E=P[g];if(s<c+E.blockCount){u=g,l=s-c;break}c+=E.blockCount}let h=P[u],f=await Mi(h.filename,h.codec),p=Yt(h.gridFormat),B=de({cols:y,rows:C},p);if(p.bitsPerCell===b.bitsPerCell){let g=(l+1)*m;a.queue.writeBuffer(L,0,new Uint8Array(f,0,g))}else{let g=new Uint8Array((l+1)*m);for(let E=0;E<=l;E++){let H=E*B,Ft=new Uint8Array(f,H,B),te=Ht(Xr(Ft),{cols:y,rows:C},p,b);g.set(new Uint8Array(te.buffer,te.byteOffset,te.byteLength),E*m)}a.queue.writeBuffer(L,0,g),a.queue.writeBuffer(o,0,g.subarray(l*m,(l+1)*m))}if(v=l+1,w=h.generations.slice(0,l+1),R=w[l],be=R,p.bitsPerCell===b.bitsPerCell){let g=a.createCommandEncoder({label:d.recordingRestoreCopyEncoder});g.copyBufferToBuffer(L,l*m,o,0,m),a.queue.submit([g.finish()])}let O=P.splice(u).map(g=>g.filename);Ri(O)}if(Cr(),ve(),V=-1,z)q=!0;else{let c=a.createCommandEncoder({label:d.interactiveMetricsEncoder});pe(c),a.queue.submit([c.finish()]),me()}Z();break}case"stepForward":{if(_r(),t.count===1){Ue(!0);let r=!k||Mr();if(r?(Rr(),Pe++,k&&Xe()&&(v>=M&&qe(),Ke(R))):wn(),r&&Lt(),V=-1,z)q=!0;else{let n=a.createCommandEncoder({label:d.interactiveMetricsEncoder});pe(n),a.queue.submit([n.finish()]),me()}Z()}else self.postMessage({type:"stepping",active:!0}),Ue(!0),Br(Pr(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:R+t.count},restoreAfterStop:{running:x,targetStepDuration:j}});break}case"cancelStepping":{rn(S?.request.restoreAfterStop?.running??x);break}case"updateChunkCodec":{let r=P.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,Y.chunks=[...P],ve(),Bt());break}case"getUncompressedChunks":{let r=P.filter(n=>n.codec===kt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:y,rows:C,rawGridFormat:n.gridFormat,storageGridFormat:ke(lt(Oe.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
