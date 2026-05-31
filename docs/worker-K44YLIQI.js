var _t="goltTimestampedConsoleInstalled";function kn(){let e=globalThis;e[_t]||(e[_t]=!0,Tr("log"),Tr("warn"),Tr("error"))}function Tr(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}kn();async function Pt(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var f={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var Rt=4294967295;function K(e,r){return e.includes(r)}function Ar(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function Mt(e,r,t,n){let i=e*r,o=i<=Rt,a=i*2<=Rt;return{population:Ar(t&&n.population,o),diversity:Ar(t&&n.diversity,o),interfaces:Ar(t&&n.interfaces,a)}}function Bt(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var Re=256*Uint32Array.BYTES_PER_ELEMENT,Me=Uint32Array.BYTES_PER_ELEMENT;function Et(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function wt(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function kt(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function xn(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = ${r}u;
const ROWS: u32 = ${t}u;
const CELLS_PER_WORD: u32 = ${n.cellsPerWord}u;
const WORD_SHIFT: u32 = ${n.wordShift}u;
const CELL_SHIFT: u32 = ${n.cellShift}u;
const CELL_INDEX_MASK: u32 = ${n.cellIndexMask}u;
const CELL_MASK: u32 = ${n.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
${Et(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${wt(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${kt(i)}
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
`}function Tn(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${r}u;
const ROWS: u32 = ${t}u;
const CELLS_PER_WORD: u32 = ${n.cellsPerWord}u;
const WORD_SHIFT: u32 = ${n.wordShift}u;
const CELL_SHIFT: u32 = ${n.cellShift}u;
const CELL_INDEX_MASK: u32 = ${n.cellIndexMask}u;
const CELL_MASK: u32 = ${n.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
${Et(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${wt(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${kt(i)}
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
`}function xt(e){let{device:r}=e,t=r.createShaderModule({label:f.histogramMetricsShaderModule,code:xn(e)}),n=r.createComputePipeline({label:f.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),i=r.createBuffer({label:f.histogramMetricsBuffer,size:Re,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=r.createBuffer({label:f.histogramMetricsReadBuffer,size:Re,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),a=r.createShaderModule({label:f.interfaceMetricsShaderModule,code:Tn(e)}),c=r.createComputePipeline({label:f.interfaceMetricsPipeline,layout:"auto",compute:{module:a,entryPoint:"main"}}),u=r.createBuffer({label:f.interfaceMetricsBuffer,size:Me,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),l=r.createBuffer({label:f.interfaceMetricsReadBuffer,size:Me,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:c,boundaryBuffer:u,boundaryReadBuffer:l}}function Tt(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function At(e){let{device:r,encoder:t,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:a}=e;if(K(a,"population")||K(a,"diversity")){let c=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,c);let u=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),l=t.beginComputePass({label:f.histogramMetricsPass});l.setPipeline(n.histogramPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Re)}if(K(a,"interfaces")){let c=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,c);let u=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),l=t.beginComputePass({label:f.interfaceMetricsPass});l.setPipeline(n.boundaryPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Me)}}async function It(e){let{resources:r,enabledSections:t}=e,n=K(t,"population")||K(t,"diversity"),i=K(t,"interfaces"),o=[];n&&o.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let a=new Uint32Array(256);n&&(a=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let c=0;if(i){let u=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),c=u[0]??0}return{histogram:a,crossStateContactEdges:c}}function An(e,r){let{tribes:t,deadTribeIndex:n,readback:i,cols:o,rows:a}=e,c=o*a,u={};for(let b=0;b<t.length;b++){let d=r?i.histogram[b]??0:0;u[t[b].id]=d}let l=r?u[t[n]?.id??""]??0:0;return{population:u,aliveCells:r?Math.max(0,c-l):0,deadCells:l}}function In(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,i=0;for(let o=0;o<r.length;o++)o!==t&&(i+=n.histogram[o]??0);return i}function Ln(e,r){let{tribes:t,deadTribeIndex:n,readback:i}=e,o=r?In(e):0,a=0,c=0;for(let u=0;u<t.length;u++){let l=u!==n&&o>0?(i.histogram[u]??0)/o:0;l>0&&(a-=l*Math.log2(l),c+=l*l)}return{shannonEntropy:a,simpsonSum:c}}function Gn(e,r){let t=e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,i=r?Math.max(0,t-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?i/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function Lt(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:i,cols:o,rows:a,totalFrames:c,fps:u,canStepBack:l,recordingBytes:b,recordingRawBytes:d}=e,m=K(t,"population")&&i.population,_=K(t,"diversity")&&i.diversity,x=K(t,"interfaces")&&i.interfaces,$=o*a,g=An(e,m),T=Ln(e,_),ae=Gn(e,x);return{type:"metrics",generation:r,population:g.population,aliveCells:g.aliveCells,deadCells:g.deadCells,occupancy:m&&$>0?g.aliveCells/$:0,shannonEntropy:T.shannonEntropy,simpsonIndex:_?1-T.simpsonSum:0,interfaces:ae,metricsAvailability:n,extinctionTime:{},totalFrames:c,fps:u,canStepBack:l,recordingBytes:b,recordingRawBytes:d}}var Gt=`// Render shader: draws the grid as a full-screen quad.
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
`;var Ir=[1,2,4,8,16,32],Dn={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Un={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},On={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},He={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Wn={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},Lr={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},ee={1:Dn,2:Un,4:On,8:He,16:Wn,32:Lr};var Be={population:!0,diversity:!0,interfaces:!1},je={enabled:!0,sections:Be};var Gr="any",Ve="dead";var Ze="empty",Qe="is",Fr="comparison",Je="count",er="none",rr="exactly",tr="min",nr="max",ir="not",or="and",sr="or",ar="xor";function Ft(e){return Ir.includes(e)}function Nn(e){return 2**e}function Dr(e,r){return r<=Nn(e)}function Ur(e,r,t){return ue(e,r)<=t}function Or(e){return e<=2?ee[1]:e<=4?ee[2]:e<=16?ee[4]:e<=256?ee[8]:e<=65536?ee[16]:ee[32]}function Ee(e){return ee[e]}function Dt(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of Ir){let i=Ee(n);if(Dr(n,e)&&Ur(r,i,t))return i}return Lr}function Wr(e){return Ee(e?.bitsPerCell??8)}function we(e){return{bitsPerCell:e.bitsPerCell}}function ce(e,r){return Math.ceil(e/r.cellsPerWord)}function ue(e,r){return ce(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Ut(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}function zn(e){return{population:typeof e?.population=="boolean"?e.population:Be.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Be.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Be.interfaces}}function Nr(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:je.enabled,sections:zn(e?.sections)}}function Ot(e,r,t,n,i){let o=ce(r.cols,t),a=e[i*o+(n>>t.wordShift)]??0;return $n(a,t,n&t.cellIndexMask)}function Wt(e,r,t,n,i,o){let a=ce(r.cols,t),c=i*a+(n>>t.wordShift),u=(n&t.cellIndexMask)<<t.cellShift,l=~(t.cellMask<<u),b=e[c]??0;e[c]=(b&l|(o&t.cellMask)<<u)>>>0}function $n(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}var so=64*1024*1024;function zr(e,r,t,n){let i=e,o;if(t.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(ue(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let a=0;a<r.rows;a++)for(let c=0;c<r.cols;c++)Wt(o,r,n,c,a,Ot(i,r,t,c,a))}return o}var s,U=!1,hr,ur,pe,De,S=0,y=0,at=0,C=He,Q=[],ne=new Map,_r,Yr,F,D,ve,he,Ue,Xr,Hr,Ie,ct,ut,A=!1,Zt=1,Qt=0,Jt=0,E=!1,I=!1,H=100,P=0,lr,Se,en,rn,Yn=0,dr=null,be={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},ie=null,j=-1,N=!1,q=!1,$r=0,Oe=je,fr=[],w=!1,X=!1,Y={chunks:[],generationStart:0,generationEnd:0,gridFormat:we(He)},tn=0,R=[],h=null,nn=0,ke=!1,G=null,v=0,B=[],me=null,M=64,p=0,Pr=3,J=[],z=[],pr="gol-recording",Rr="raw-packed",on="deflate-raw",Le=null,le=null,Z=0,We=0,te=0,Nt=12,L=!1,xe=0,sn=256,Xn=sn*Uint32Array.BYTES_PER_ELEMENT,zt=256*1024*1024,Hn=512*1024*1024,$t=128*1024*1024*1024,mr=0,gr=0,Ge=[];function jn(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function an(e){console.error("[GOLT worker] Worker GPU error:",e),k("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),E=!1,self.postMessage({type:"gpuError",reason:jn(e)})}self.addEventListener("error",e=>{e.preventDefault(),an(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),an(e.reason)});async function lt(){await s.queue.onSubmittedWorkDone()}function Kt(e){mr=0,gr=2+(e?1+Pr:0),Ge=[]}async function Sr(){if(Ge.length===0)return;let e=s.createCommandEncoder({label:f.trackedAllocationClearEncoder});for(let r of Ge)e.clearBuffer(r);s.queue.submit([e.finish()]),await lt(),Ge=[]}async function yr(e,r){!I||gr<=0||(mr+=e,gr--,Ge.push(r),mr>=Vn()&&gr>0&&(await Sr(),mr=0))}function Vn(){return Math.min(Pe(),Hn)}function Pe(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function Ke(){return Math.min(Pe(),1073741824)}function cn(){return Math.max(Pe()*2,Ke()*6)}function O(){return p>0&&p<=Ke()}function Zn(){return p<=0?0:p*2+ft+Xn+pt+Re*2+Me*2}function Qn(){return M<1||p<=0?0:M*p*(1+Pr)}function Cr(){G?.destroy(),G=null;for(let e of J)e?.destroy();J=[],z=[],M=0,v=0,B=[],me=null,We=0}function qt(){F?.destroy(),D?.destroy(),Tt(ie),ie=null,Se?.destroy(),Cr()}function Kr(e){let r=Z>0;Z+=e;let t=Z>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function ye(){if(M<1||J.length===0){L&&(L=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=mt(),r=!z.some(i=>i)&&v>=M,t=te>=e,n;if(L){let i=z.some(a=>a),o=te<=Math.floor(e/2);n=!(i&&o)}else n=r||t;n!==L&&(L=n,self.postMessage({type:"backpressure",active:n}))}async function Ce(){let e=await navigator.storage.estimate(),r=Math.min(e.quota??$t/128,$t),t=e.usage??0,n=0,i=0;for(let c of R)c.codec===Rr?n+=c.storedBytes:i+=c.storedBytes;let o=M*p,a=w?(1+Pr)*o:0;self.postMessage({type:"storageQuota",usedBytes:t,quotaBytes:r,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:a})}var Ne=!1;async function Jn(e){let r=new DecompressionStream(on),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],i=r.readable.getReader();for(;;){let{done:u,value:l}=await i.read();if(u)break;n.push(l)}let o=0;for(let u of n)o+=u.byteLength;let a=new Uint8Array(o),c=0;for(let u of n)a.set(u,c),c+=u.byteLength;return a.buffer}var _e=0,cr=0,dt=0;function un(e,r,t=s.limits.maxComputeWorkgroupsPerDimension){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,i=Math.min(n,t),o=Math.ceil(n/i);if(o>t)throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`);return{logicalWgX:e,logicalWgY:r,dispatchWgX:i,dispatchWgY:o,remapped:!0}}function ei(){return un(Math.ceil(at/16),Math.ceil(y/16))}function ri(){return un(Math.ceil(S/16),Math.ceil(y/16))}function ti(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function ni(e){e.push(`const CELLS_PER_WORD: u32 = ${C.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${C.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${C.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${C.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${C.cellMask}u;`)}function ii(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function oi(e,r,t){if(r.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;")}function si(){let e=[],r=at,t=_r;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${Q.map(d=>d.id).join(", ")}`),e.push(`// Rules: ${De.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${S}u;`),e.push(`const ROWS: u32 = ${y}u;`),e.push(`const PACKED_COLS: u32 = ${r}u;`),ti(e,t),ni(e),e.push(""),ii(e,"gridIn","PACKED_COLS"),e.push("");let n=ne.get(Ve)??0,i=De.rules.filter(d=>!d.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let o=ci(i.map(d=>d.clause)),a=new Map,c=0;for(let d of o){let m=`count_${c++}`;a.set(d,m)}for(let[d,m]of a){let _=d.split(",").map(Number),$=Yt().map(g=>`select(0u, 1u, ${_.map(ae=>`${g} == ${ae}u`).join(" || ")})`);e.push(`  let ${m} = ${$.join(" + ")};`)}o.size>0&&e.push("");let u=ui(i.map(d=>d.clause)),l=new Map,b=0;for(let d of u)if(a.has(d))l.set(d,a.get(d));else{let m=`eq_count_${b++}`;l.set(d,m)}for(let[d,m]of l){if(a.has(d))continue;let _=d.split(",").map(Number),$=Yt().map(g=>`select(0u, 1u, ${_.map(ae=>`${g} == ${ae}u`).join(" || ")})`);e.push(`  let ${m} = ${$.join(" + ")};`)}u.size>0&&b>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let d=0;d<i.length;d++){let m=i[d],_=Te(m.clause,a,l),x=ai(m.tribe);d===0?e.push(`  if (${_}) {`):e.push(`  } else if (${_}) {`),e.push(`    result = ${x}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),t.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),oi(e,t,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let d=-1;d<=1;d++)for(let m=-1;m<=1;m++){if(m===0&&d===0)continue;let _=ln(m,d),x=Xt("x",m,"COLS"),$=Xt("y",d,"ROWS");e.push(`    let ${_} = readCell(${x}, ${$});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function ln(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function Yt(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(ln(t,r));return e}function Xt(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function W(e){let r=[];for(let t of e)if(t===Gr)for(let n=0;n<Q.length;n++)r.push(n);else{let n=ne.get(t);n!==void 0&&r.push(n)}return[...new Set(r)]}function ai(e){return e===Gr?0:ne.get(e)??0}function ci(e){let r=new Set;for(let t of e)jr(t,r);return r}function jr(e,r){switch(e.kind){case Ze:case Qe:break;case er:case rr:case tr:case nr:case Je:{let t=W(e.tribes).sort();r.add(t.join(","));break}case ir:jr(e.clause,r);break;case or:case sr:case ar:for(let t of e.clauses)jr(t,r);break}}function ui(e){let r=new Set;for(let t of e)Vr(t,r);return r}function Vr(e,r){switch(e.kind){case Ze:case Qe:case Je:case er:case rr:case tr:case nr:break;case Fr:{let t=W(e.tribe1).sort(),n=W(e.tribe2).sort();r.add(t.join(",")),r.add(n.join(","));break}case ir:Vr(e.clause,r);break;case or:case sr:case ar:for(let t of e.clauses)Vr(t,r);break}}function Te(e,r,t){switch(e.kind){case Ze:return"false";case Qe:{let n=W(e.tribes);return n.length===0?"false":n.length===Q.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case Je:{let n=W(e.tribes).sort(),i=r.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case er:{let n=W(e.tribes).sort(),i=r.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case rr:{let n=W(e.tribes).sort(),i=r.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case tr:{let n=W(e.tribes).sort(),i=r.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case nr:{let n=W(e.tribes).sort(),i=r.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case Fr:{let n=t.get(W(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),o=`(i32(${t.get(W(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${o})`;case">":return`(i32(${n}) > ${o})`;case"<":return`(i32(${n}) < ${o})`;case"\u2265":return`(i32(${n}) >= ${o})`;case"\u2264":return`(i32(${n}) <= ${o})`;default:return`(i32(${n}) == ${o})`}}case ir:return`!(${Te(e.clause,r,t)})`;case or:return`(${e.clauses.map(i=>Te(i,r,t)).join(" && ")})`;case sr:return`(${e.clauses.map(i=>Te(i,r,t)).join(" || ")})`;case ar:return`(((${e.clauses.map(o=>Te(o,r,t)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var ft=80;function Zr(){ve?.destroy(),ve=s.createBuffer({label:f.uniformBuffer,size:ft,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function li(){let e=new ArrayBuffer(ft),r=new Float32Array(e),t=new Int32Array(e),n=new Uint32Array(e),i=(Qt%S+S)%S,o=(Jt%y+y)%y,a=Math.floor(i),c=Math.floor(o);r[0]=pe.width,r[1]=pe.height,r[2]=Zt,r[4]=i-a,r[5]=o-c,n[6]=S,n[7]=y,n[8]=a,n[9]=c,n[10]=Q.length,t[12]=be.centerX,t[13]=be.centerY,n[14]=be.brushSize,n[15]=be.shape,n[16]=be.visible?1:0,s.queue.writeBuffer(ve,0,e)}function Mr(){return ue({cols:S,rows:y},C)}function oe(){return we(C)}async function Qr(){let e=Mr();F=s.createBuffer({label:f.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await yr(e,F),D=s.createBuffer({label:f.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await yr(e,D);let r=s.createCommandEncoder({label:f.gridClearEncoder});r.clearBuffer(F),r.clearBuffer(D),s.queue.submit([r.finish()]),A=!1}function Jr(){let e=new Uint32Array(sn);for(let r=0;r<Q.length;r++){let t=Q[r].color,n=parseInt(t.substring(0,2),16),i=parseInt(t.substring(2,4),16),o=parseInt(t.substring(4,6),16);e[r]=n|i<<8|o<<16}he&&he.destroy(),he=s.createBuffer({label:f.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(he,0,e)}function di(){return Gt.replace("__CELLS_PER_WORD__",`${C.cellsPerWord}u`).replace("__WORD_SHIFT__",`${C.wordShift}u`).replace("__CELL_SHIFT__",`${C.cellShift}u`).replace("__CELL_INDEX_MASK__",`${C.cellIndexMask}u`).replace("__CELL_MASK__",`${C.cellMask}u`)}function et(){let e=s.createShaderModule({label:f.renderShaderModule,code:di()});Ue=s.createRenderPipeline({label:f.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:ur}]},primitive:{topology:"triangle-list"}})}function rt(){Xr=s.createBindGroup({layout:Ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ve}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:he}}]}),Hr=s.createBindGroup({layout:Ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ve}},{binding:1,resource:{buffer:D}},{binding:2,resource:{buffer:he}}]})}function tt(){_r=ei();let e=si(),r=s.createShaderModule({label:f.simulationShaderModule,code:e});Ie=s.createComputePipeline({label:f.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),ct=s.createBindGroup({layout:Ie.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:D}}]}),ut=s.createBindGroup({layout:Ie.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:F}}]})}function nt(){Yr=ri(),ie=xt({device:s,cols:S,rows:y,gridFormat:C,dispatchPlan:Yr})}var pt=176;function fi(){return`
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
`}function it(){let e=s.createShaderModule({label:f.brushShaderModule,code:fi()});lr=s.createComputePipeline({label:f.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),Se?.destroy(),Se=s.createBuffer({label:f.brushUniformBuffer,size:pt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),en=s.createBindGroup({layout:lr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:Se}}]}),rn=s.createBindGroup({layout:lr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:Se}}]})}function pi(e,r,t,n,i,o,a){let c=ne.get(Ve)??0,u=Yn++,l=new ArrayBuffer(pt),b=new Int32Array(l),d=new Uint32Array(l);b[0]=r,b[1]=t,d[2]=S,d[3]=y,d[4]=n,d[5]=i,d[6]=o,d[7]=c,d[8]=u,d[9]=a.length,d[10]=0;for(let x=0;x<a.length&&x<32;x++)d[11+x]=a[x];s.queue.writeBuffer(Se,0,l);let m=Math.ceil(n/8),_=e.beginComputePass({label:f.brushPass});_.setPipeline(lr),_.setBindGroup(0,A?rn:en),_.dispatchWorkgroups(m,m),_.end()}function mi(){let e=A?D:F,r=Mr(),t;try{t=s.createBuffer({label:f.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=s.createCommandEncoder({label:f.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),s.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),i})}function dn(){if(p=Mr(),!O()){M=0;return}let e=gi();M=Math.max(1,Math.floor(e/p))}function gi(){return p>=zt?p:Math.min(Math.max(zt,p),Ke())}function mt(){if(M<1||p<=0)return Nt;let e=Math.max(p,M*p),r=Math.floor(536870912/e);return Math.max(1,Math.min(Nt,r||1))}function ot(){let e=O();self.postMessage({type:"limits",maxBytes:Pe(),vramBudgetBytes:cn(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:Zn(),vramRecordingBytes:Qn(),gridFormat:oe()})}function ze(){return!O()||M<1||G===null||J.length===0?!1:v<M?!0:fn()}function fn(){return te>=mt()?!1:J.some((e,r)=>z[r]&&e.mapState==="unmapped")}function qe(e){if(M<1||G===null||v>=M)return;let r=A?D:F,t=v*p,n=s.createCommandEncoder({label:f.recordingFrameCopyEncoder});n.copyBufferToBuffer(r,0,G,t,p),s.queue.submit([n.finish()]),B.push(e),me=e,v++,br()}function qr(e){We=Math.max(0,We+e)}function br(){M>0&&v>=M&&fn()&&$e()}function $e(){if(G===null||v===0||J.length===0||te>=mt())return;let e=z.indexOf(!0);if(e<0)return;z[e]=!1;let r=J[e];if(r.mapState!=="unmapped"){z[e]=!0;return}let t=v*p,n=tn++,i=[...B],o=i[0],a=i[i.length-1],c=`chunk-${String(n).padStart(6,"0")}.bin`,u=v,l=s.createCommandEncoder({label:f.recordingSealCopyEncoder});l.copyBufferToBuffer(G,0,r,0,t),s.queue.submit([l.finish()]);let b={chunkId:n,generationStart:o,generationEnd:a,blockCount:u,codec:Rr,uncompressedBytes:t,storedBytes:t,gridFormat:oe(),generations:i,filename:c};Kr(1),qr(u),te++,ye();let d=xe;r.mapAsync(GPUMapMode.READ).then(async()=>{let m=r.getMappedRange(),_=new ArrayBuffer(t);new Uint8Array(_).set(new Uint8Array(m,0,t)),r.unmap(),d===xe&&(z[e]=!0,R.push(b),qr(-u),gt(),ye(),br(),bi(b,_).then(()=>{d===xe&&(te--,ye(),Kr(-1),Ce(),vr(),Er(!0),br(),self.postMessage({type:"chunkSealed",filename:b.filename,rawBytes:t,blockCount:b.blockCount,cols:S,rows:y,rawGridFormat:b.gridFormat,storageGridFormat:we(Or(De.tribes.length))}),Ne&&Z===0&&(Ne=!1,vr()))}))}).catch(()=>{d===xe&&(z[e]=!0,te--,qr(-u),ye(),Kr(-1),br())}),v=0,B=[]}function gt(){R.length>0&&(Y.generationStart=R[0].generationStart,Y.generationEnd=R[R.length-1].generationEnd),B.length>0&&(R.length===0&&(Y.generationStart=B[0]),Y.generationEnd=B[B.length-1]),Y.chunks=[...R]}async function Ht(e){xe++,tn=0,v=0,B=[],R=[],me=null,We=0,te=0,Z>0&&(Z=0,self.postMessage({type:"chunksSaving",active:!1})),L&&(L=!1,self.postMessage({type:"backpressure",active:!1})),Ne=!1,X=w,Y={chunks:[],generationStart:e,generationEnd:e,gridFormat:oe()},await pn(),Ce()}async function bt(){return le&&await le,Le||(Le=await(await navigator.storage.getDirectory()).getDirectoryHandle(pr,{create:!0})),Le}async function bi(e,r){let i=await(await(await bt()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(r),await i.close()}async function hi(e){let r=await bt();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function pn(){if(le){await le;return}le=(async()=>{let e=await navigator.storage.getDirectory();Le=null;try{await e.removeEntry(pr,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${pr}:`,r)}Le=await e.getDirectoryHandle(pr,{create:!0})})();try{await le}finally{le=null}}function vr(){gt(),self.postMessage({type:"recording",manifest:{chunks:R.map(e=>({...e,generations:[...e.generations]})),generationStart:Y.generationStart,generationEnd:Y.generationEnd,gridFormat:oe()},cols:S,rows:y})}function Si(){return me!==P}function Fe(e=!1){if(w){if(e){if(X){if(!ze())return;X=!1}}else if(X)return;!Si()||!ze()||(v>=M&&$e(),qe(P))}}function ht(){if(dr){let e=dr;dr=null;let r=w&&v>0&&B[v-1]===P;r&&(v--,B.pop());let t=s.createCommandEncoder({label:f.brushEncoder});pi(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),r&&qe(P)}}async function yi(e,r=Rr){let o=await(await(await(await bt()).getFileHandle(e)).getFile()).arrayBuffer();return r===on?Jn(o):o}function Ci(){let e=v+We;for(let r of R)e+=r.blockCount;return e}function mn(){return Mt(S,y,Oe.enabled,Oe.sections)}function vi(){return Bt(mn())}function de(e){fr=vi(),ie&&fr.length!==0&&At({device:s,encoder:e,resources:ie,sourceBuffer:A?D:F,dispatchPlan:Yr,enabledSections:fr})}function fe(){let e=P;if(!ie||e===j||N)return;let r=ie,t=[...fr],n=mn();j=e,N=!0,It({resources:r,enabledSections:t}).then(i=>{let o=ne.get(Ve)??0,a=Ci(),c=Lt({generation:e,tribes:Q,deadTribeIndex:o,readback:i,enabledSections:t,availability:n,liveMetricSettings:Oe.sections,cols:S,rows:y,totalFrames:a,fps:dt,canStepBack:a>1,recordingBytes:R.reduce((u,l)=>u+l.storedBytes,0),recordingRawBytes:R.reduce((u,l)=>u+l.uncompressedBytes,0)});if(N=!1,self.postMessage(c),q)if(q=!1,j=-1,vn()){let u=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(u),s.queue.submit([u.finish()]),fe()}else q=!0}).catch(()=>{N=!1})}function gn(){let e=S*y;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function bn(e){return e==="recording"?Number.MAX_SAFE_INTEGER:gn()*Sn()}function hn(e,r,t,n,i,o){let a=r-t*i;n>i||n>o?e.stepAccumulator=Math.min(a,t):e.stepAccumulator=a}function Sn(){let e=S*y;return e>1e7?2:e>1e6?4:e>1e5?8:16}function yn(e){if(e<=0)return;let r=_r,t=s.createCommandEncoder({label:f.simulationBatchEncoder});for(let n=0;n<e;n++){let i=t.beginComputePass({label:f.simulationStepPass});i.setPipeline(Ie),i.setBindGroup(0,A?ut:ct),i.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),i.end(),A=!A,P++}s.queue.submit([t.finish()]),_e+=e}function _i(){self.postMessage({type:"generation",generation:P,fps:dt})}function St(){let e=s.createCommandEncoder({label:f.simulationSingleStepEncoder}),r=e.beginComputePass({label:f.simulationStepPass});r.setPipeline(Ie),r.setBindGroup(0,A?ut:ct);let t=_r;r.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),r.end(),s.queue.submit([e.finish()]),A=!A,P++}function V(){if(!!(s&&hr&&ve&&Ue&&Xr&&Hr&&!I&&!U)){li();let r=hr.getCurrentTexture().createView(),t=s.createCommandEncoder({label:f.renderEncoder}),n=t.beginRenderPass({label:f.renderPass,colorAttachments:[{view:r,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});n.setPipeline(Ue),n.setBindGroup(0,A?Hr:Xr),n.draw(3),n.end(),s.queue.submit([t.finish()])}}function Cn(e){cr===0&&(cr=e);let r=e-cr;r>=1e3&&(dt=_e/(r/1e3),_e=0,cr=e)}function yt(){return w&&O()?"recording":"nonRecording"}function Pi(){return H<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/H}}function se(e){return e.request.stopCondition.kind==="targetGeneration"}function Ye(e){return e.request.stopCondition.kind==="targetGeneration"&&P>=e.request.stopCondition.generation}function Br(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-P)}function vn(){return!!(s&&ie&&!I&&!U)}function Er(e=!1){if(e&&(j=-1),!vn())q=!0;else if(N)q=!0;else{let r=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(r),s.queue.submit([r.finish()]),fe()}}function _n(){Er(!0),V()}function wr(e,r){if(!r)return;(e-$r>=1e3||$r===0)&&!N&&($r=e,Er())}function Xe(e,r){e.request.pacing.kind!=="max"&&!se(e)||r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,_i())}function kr(){L&&(L=!1,self.postMessage({type:"backpressure",active:!1}))}function Pn(){L||(L=!0,self.postMessage({type:"backpressure",active:!0}))}function Ct(){return ze()?(v>=M&&$e(),ze()):!1}function Ae(){I||U||h||self.requestAnimationFrame(st)}function ge(e){let r=h;if(!r||r.pumpPending||I||U)return;let{token:t}=r;r.pumpPending=!0;let n=()=>{!h||h.token!==t||(h.pumpPending=!1,ki(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?s.queue.onSubmittedWorkDone().then(n).catch(()=>{h?.token===t&&(h.pumpPending=!1)}):queueMicrotask(n)}function vt(e,r){h&&k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),h={kind:e,request:r,token:++nn,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0},ge(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function re(){E&&vt(yt(),{pacing:Pi(),stopCondition:{kind:"none"}})}function k(e,r={}){let t=h;if(!t)return;h=null,nn++;let n=se(t),i=r.restore!==!1&&!!t.request.restoreAfterStop;i&&t.request.restoreAfterStop&&(E=t.request.restoreAfterStop.running,H=t.request.restoreAfterStop.targetStepDuration),n&&r.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?kr():L&&ye(),r.render!==!1&&!I&&!U&&_n(),r.restartRestoredRun!==!1&&i&&E&&!I&&!U?re():Ae()}function jt(e){let r=h;!r||!se(r)||(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),k("cancelled"))}function Ri(e){k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),vt(yt(),e)}function Rn(e,r,t){Pn(),Xe(e,r),wr(r,t),ge("drain")}function Mi(e,r){let t=gn(),n=Sn(),i=!1;for(let o=0;o<n;o++){let a=Br(e);if(a<=0)break;let c=Math.min(t,a);yn(c),i=!0}if(Xe(e,r),Ye(e)){k("targetReached");return}ge(i?"drain":"raf")}function Bi(e,r){Fe(!0);let t=!1,n=performance.now()+14;for(;Br(e)>0&&performance.now()<n;){if(!Ct()){Rn(e,r,t);return}St(),_e++,t=!0,qe(P)}if(kr(),Xe(e,r),wr(r,t),Ye(e)){k("targetReached");return}ge("raf")}function Ei(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=e.stepAccumulator,o=Math.floor(e.stepAccumulator/r),a=bn(e.kind),c=Math.min(o,Br(e),a),u=c>0;if(u&&yn(c),hn(e,i,r,o,c,a),Xe(e,t),Ye(e)){k("targetReached");return}let l=u&&o>c;if(!se(e)){let b=t-e.lastRenderTime;(!l||b>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,V(),wr(t,u))}ge(l?"drain":"raf")}function wi(e,r,t){Fe(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=!1,o=0,a=e.stepAccumulator,c=bn(e.kind),u=Math.floor(e.stepAccumulator/r),l=performance.now()+14;for(;e.stepAccumulator>=r&&Br(e)>0&&o<c&&performance.now()<l;){if(!Ct()){Rn(e,t,i);return}St(),_e++,o++,e.stepAccumulator-=r,i=!0,qe(P)}if(hn(e,a,r,u,o,c),kr(),Xe(e,t),Ye(e)){k("targetReached");return}se(e)||(V(),wr(t,i)),ge("raf")}function ki(e){let r=h;if(!r||I||U)return;if(Cn(e),se(r)||ht(),Ye(r)){k("targetReached");return}if(r.request.pacing.kind==="max"){r.kind==="recording"?Bi(r,e):Mi(r,e);return}let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?wi(r,t,e):Ei(r,t,e)}function st(e){if(I||U){self.requestAnimationFrame(st);return}Cn(e),!h&&(ht(),H>0&&!ke&&V(),self.requestAnimationFrame(st))}function xi(e,r){let t=s?Pe():Number.POSITIVE_INFINITY;return Ft(r.bitsPerCell)&&Dr(r.bitsPerCell,e.tribes.length)&&Ur(e,Ee(r.bitsPerCell),t)?Ee(r.bitsPerCell):Dt(e.tribes.length,e,t)}function Vt(e,r){De=e,S=e.cols,y=e.rows,C=xi(e,r),at=ce(S,C),Q=[...e.tribes],Y.gridFormat=oe(),ne.clear(),Q.forEach((t,n)=>ne.set(t.id,n))}async function Mn(e){console.log("[GOLT worker] Initializing WebGPU"),pe=e,s=await Pt(f.webengineDevice),U=!1,s.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),U=!0,E=!1,I=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:Pe(),vramBudgetBytes:cn(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:oe()});let r=pe.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");hr=r,ur=navigator.gpu.getPreferredCanvasFormat(),hr.configure({device:s,format:ur,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:ur,maxBufferSize:s.limits.maxBufferSize,maxStorageBufferBindingSize:s.limits.maxStorageBufferBindingSize})}async function Ti(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Mn(pe),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),U=!0,E=!1,I=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function Bn(){G=s.createBuffer({label:f.recordingChunkBuffer,size:M*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await yr(M*p,G),v=0,B=[],me=null}async function En(){let e=M*p;J=[],z=[];for(let r=0;r<Pr;r++){let t=s.createBuffer({label:`${f.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});J.push(t),z.push(!0),await yr(e,t)}}async function Ai(){await pn()}async function Ii(){console.log("[GOLT worker] Building GPU resources",{cols:S,rows:y,bitsPerCell:C.bitsPerCell,recordingAvailable:O()}),Zr(),dn(),await Qr(),Jr(),et(),rt(),tt(),it(),nt(),await Ai(),O()?(await Bn(),await En()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:p,maxRecordingBufferBytes:Ke()}),Cr(),w=!1,X=!1),await Sr(),ot(),console.log("[GOLT worker] GPU resources ready")}async function Li(){console.log("[GOLT worker] Rebuild started",{cols:S,rows:y,bitsPerCell:C.bitsPerCell}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),I=!0,self.postMessage({type:"rebuilding",active:!0});try{await lt()}catch{}if(U&&!await Ti())return!1;qt(),Zr(),dn(),Kt(O());try{await Qr(),Jr(),et(),tt(),it(),rt(),nt(),O()?(await Bn(),await En()):(Cr(),w=!1,X=!1),await Sr(),ot()}catch(e){let r=e instanceof Error?e.message:String(e);console.error("[GOLT worker] GPU rebuild failed:",r),self.postMessage({type:"gpuError",reason:r});try{qt(),Zr(),Kt(!1),await Qr(),Jr(),et(),tt(),it(),rt(),nt(),w=!1,X=!1,p=Mr(),Cr(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await Sr(),ot()}catch(t){return console.error("[GOLT worker] GPU rebuild recovery failed:",t),!1}}return I=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:O(),frameByteSize:p}),!0}self.onmessage=async e=>{let r=e.data;switch(r.type){case"init":{if(console.log("[GOLT worker] Init message received",{cols:r.ruleset.cols,rows:r.ruleset.rows,recording:r.recording,running:r.running,speed:r.speed}),w=r.recording,Oe=Nr(r.liveMetrics),X=w,Vt(r.ruleset,r.simulationGridFormat),await Mn(r.canvas),await Ii(),N)q=!0;else{let t=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(t),s.queue.submit([t.finish()]),fe()}Ce(),E=r.running,H=r.speed<0?0:1e3/r.speed,E?re():Ae();break}case"setLiveMetrics":{Oe=Nr(r.liveMetrics),j=-1,Er(!0);break}case"setRuleset":{if(console.log("[GOLT worker] Ruleset update received",{cols:r.ruleset.cols,rows:r.ruleset.rows,tribes:r.ruleset.tribes.length}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Vt(r.ruleset,r.simulationGridFormat),!await Li())break;if(P=0,j=-1,await Ht(0),E?re():Ae(),N)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(n),s.queue.submit([n.finish()]),fe()}break}case"setRunning":if(E=r.running,r.running){h||re();break}h&&se(h)?jt(!1):h?k("manual"):(L&&ye(),_n(),Ae());break;case"setSpeed":{let t=H<=0,n=r.speed<0?0:1e3/r.speed;H=n,h&&!se(h)&&E?(k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),t&&n>0?(ke=!0,s.queue.onSubmittedWorkDone().then(()=>{ke=!1,V(),re()})):re()):E&&!h?re():t&&n>0&&(ke=!0,s.queue.onSubmittedWorkDone().then(()=>{ke=!1,V(),Ae()}));break}case"camera":Zt=r.scale,Qt=r.offsetX,Jt=r.offsetY;break;case"resize":pe.width=r.width,pe.height=r.height;break;case"draw":{let t=r.tribes.map(n=>ne.get(n)).filter(n=>n!==void 0);if(t.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2},o=n[r.shape]??0,a=i[r.fill]??0;dr={centerX:r.x,centerY:r.y,brushSize:r.size,shape:o,fill:a,tribeIds:t}}break}case"brushPreview":{let t={square:0,round:1,diamond:2,vline:3,hline:4};be={centerX:r.x,centerY:r.y,brushSize:r.size,shape:t[r.shape]??0,visible:r.visible},!h&&!I&&!U&&H<=0&&V();break}case"getSnapshot":{mi().then(t=>{let n={type:"snapshot",grid:t,generation:P,cols:S,rows:y,gridFormat:oe()};self.postMessage(n,[t.buffer])}).catch(()=>{let t=new Uint32Array(0),n={type:"snapshot",grid:t,generation:P,cols:S,rows:y,gridFormat:oe()};self.postMessage(n,[t.buffer])});break}case"loadSnapshot":{let t=A?D:F,n=Wr(r.gridFormat),i=ue({cols:S,rows:y},n);if(r.grid.byteLength!==i)break;let o=zr(r.grid,{cols:S,rows:y},n,C);s.queue.writeBuffer(t,0,o),P=r.generation,await Ht(r.generation);break}case"setRecording":{let t=h?.request;if(r.recording&&O()&&!w){if(w=!0,X=!0,j=-1,N)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(n),s.queue.submit([n.finish()]),fe()}Ce()}else(!r.recording||!O())&&(r.recording&&!O()&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:p,maxRecordingBufferBytes:Ke()}),w=!1,X=!1);t&&h?Ri(t):!h&&E&&re();break}case"getRecording":{if(Ne)break;await lt(),Fe(!1),v>0&&$e(),Z>0?Ne=!0:vr();break}case"stepBack":{let t=0;for(let c of R)t+=c.blockCount;let n=t+v,i=Math.min(r.count,n-1);if(i<=0)break;let o=n-1-i,a=A?D:F;if(o>=t){let c=o-t;v=c+1,B.length=v,P=B[c],me=P;let u=s.createCommandEncoder({label:f.recordingRestoreCopyEncoder});u.copyBufferToBuffer(G,c*p,a,0,p),s.queue.submit([u.finish()])}else{if(Z>0){await new Promise(g=>{let T=setInterval(()=>{Z===0&&(clearInterval(T),g())},10)}),t=0;for(let g of R)t+=g.blockCount}let c=0,u=0,l=0;for(let g=0;g<R.length;g++){let T=R[g];if(o<c+T.blockCount){u=g,l=o-c;break}c+=T.blockCount}let b=R[u],d=await yi(b.filename,b.codec),m=Wr(b.gridFormat),_=ue({cols:S,rows:y},m);if(m.bitsPerCell===C.bitsPerCell){let g=(l+1)*p;s.queue.writeBuffer(G,0,new Uint8Array(d,0,g))}else{let g=new Uint8Array((l+1)*p);for(let T=0;T<=l;T++){let ae=T*_,wn=new Uint8Array(d,ae,_),xr=zr(Ut(wn),{cols:S,rows:y},m,C);g.set(new Uint8Array(xr.buffer,xr.byteOffset,xr.byteLength),T*p)}s.queue.writeBuffer(G,0,g),s.queue.writeBuffer(a,0,g.subarray(l*p,(l+1)*p))}if(v=l+1,B=b.generations.slice(0,l+1),P=B[l],me=P,m.bitsPerCell===C.bitsPerCell){let g=s.createCommandEncoder({label:f.recordingRestoreCopyEncoder});g.copyBufferToBuffer(G,l*p,a,0,p),s.queue.submit([g.finish()])}let $=R.splice(u).map(g=>g.filename);hi($)}if(gt(),Ce(),j=-1,N)q=!0;else{let c=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(c),s.queue.submit([c.finish()]),fe()}V();break}case"stepForward":{if(ht(),r.count===1){Fe(!0);let t=!w||Ct();if(t?(St(),_e++,w&&ze()&&(v>=M&&$e(),qe(P))):Pn(),t&&kr(),j=-1,N)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(n),s.queue.submit([n.finish()]),fe()}V()}else self.postMessage({type:"stepping",active:!0}),Fe(!0),vt(yt(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:P+r.count},restoreAfterStop:{running:E,targetStepDuration:H}});break}case"cancelStepping":{jt(h?.request.restoreAfterStop?.running??E);break}case"updateChunkCodec":{let t=R.find(n=>n.filename===r.filename);t&&(t.codec=r.codec,t.storedBytes=r.storedBytes,t.gridFormat=r.gridFormat,Y.chunks=[...R],Ce(),vr());break}case"getUncompressedChunks":{let t=R.filter(n=>n.codec===Rr).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:S,rows:y,rawGridFormat:n.gridFormat,storageGridFormat:we(Or(De.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:t});break}}};
