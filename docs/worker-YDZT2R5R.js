var jt="goltTimestampedConsoleInstalled";function Ii(){let e=globalThis;e[jt]||(e[jt]=!0,Vr("info"),Vr("warn"),Vr("error"),console.log=console.info.bind(console))}function Vr(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}Ii();var Vt=`// Render shader: draws the grid as a full-screen quad.
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
`;var Zr=[1,2,4,8,16,32],Gi={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Li={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Fi={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},ir={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Di={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},Qr={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},q={1:Gi,2:Li,4:Fi,8:ir,16:Di,32:Qr};function Zt(e){return Zr.includes(e)}function Ui(e){return 2**e}function Jr(e,r){return r<=Ui(e)}function et(e,r,t){return H(e,r)<=t}function or(e){return e<=2?q[1]:e<=4?q[2]:e<=16?q[4]:e<=256?q[8]:e<=65536?q[16]:q[32]}function Qt(e){return or(e)}function Ie(e){return q[e]}function Jt(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){return rt(e,r,t)??Qr}function rt(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of Zr){let i=Ie(n);if(Jr(n,e)&&et(r,i,t))return i}return null}function tt(e){return Ie(e?.bitsPerCell??8)}function Ae(e){return{bitsPerCell:e.bitsPerCell}}function se(e,r){return Math.ceil(e/r.cellsPerWord)}function H(e,r){return se(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function en(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}var Ge={population:!0,diversity:!0,interfaces:!1},ar={enabled:!0,sections:Ge};function Oi(e){return{population:typeof e?.population=="boolean"?e.population:Ge.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Ge.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Ge.interfaces}}function nt(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:ar.enabled,sections:Oi(e?.sections)}}function it(e,r){self.postMessage(e,r)}var L="dead";var ot="empty",rn="is",sr="comparison",ur="count",cr="none",lr="exactly",dr="min",fr="max",pr="not",mr="and",br="or",gr="xor";async function tn(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var d={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var nn=4294967295;function at(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function U(e,r){return e.includes(r)}function on(e,r,t,n){let i=e*r,o=i<=nn,s=i*2<=nn;return{population:at(t&&n.population,o),diversity:at(t&&n.diversity,o),interfaces:at(t&&n.interfaces,s)}}function an(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var ge=256*Uint32Array.BYTES_PER_ELEMENT,he=Uint32Array.BYTES_PER_ELEMENT;function sn(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function un(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function cn(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function $i(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
${sn(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${un(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${cn(i)}
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
`}function Wi(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
${sn(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${un(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${cn(i)}
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
`}function Ni(e,r){let{tribes:t,deadTribeIndex:n,readback:i,cols:o,rows:s}=e,a=o*s,u={};for(let f=0;f<t.length;f++){let p=r?i.histogram[f]??0:0;u[t[f].id]=p}let l=r?u[t[n]?.id??""]??0:0;return{population:u,aliveCells:r?Math.max(0,a-l):0,deadCells:l}}function zi(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,i=0;for(let o=0;o<r.length;o++)o!==t&&(i+=n.histogram[o]??0);return i}function Ki(e,r){let{tribes:t,deadTribeIndex:n,readback:i}=e,o=r?zi(e):0,s=0,a=0;for(let u=0;u<t.length;u++){let l=u!==n&&o>0?(i.histogram[u]??0)/o:0;l>0&&(s-=l*Math.log2(l),a+=l*l)}return{shannonEntropy:s,simpsonSum:a}}function Xi(e,r){let t=e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,i=r?Math.max(0,t-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?i/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function ln(e){let{device:r}=e,t=r.createShaderModule({label:d.histogramMetricsShaderModule,code:$i(e)}),n=r.createComputePipeline({label:d.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),i=r.createBuffer({label:d.histogramMetricsBuffer,size:ge,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=r.createBuffer({label:d.histogramMetricsReadBuffer,size:ge,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=r.createShaderModule({label:d.interfaceMetricsShaderModule,code:Wi(e)}),a=r.createComputePipeline({label:d.interfaceMetricsPipeline,layout:"auto",compute:{module:s,entryPoint:"main"}}),u=r.createBuffer({label:d.interfaceMetricsBuffer,size:he,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),l=r.createBuffer({label:d.interfaceMetricsReadBuffer,size:he,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:a,boundaryBuffer:u,boundaryReadBuffer:l}}function dn(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function fn(e){let{device:r,encoder:t,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:s}=e;if(U(s,"population")||U(s,"diversity")){let a=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,a);let u=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),l=t.beginComputePass({label:d.histogramMetricsPass});l.setPipeline(n.histogramPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,ge)}if(U(s,"interfaces")){let a=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,a);let u=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),l=t.beginComputePass({label:d.interfaceMetricsPass});l.setPipeline(n.boundaryPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,he)}}async function pn(e){let{resources:r,enabledSections:t}=e,n=U(t,"population")||U(t,"diversity"),i=U(t,"interfaces"),o=[];n&&o.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let s=new Uint32Array(256);n&&(s=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let a=0;if(i){let u=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),a=u[0]??0}return{histogram:s,crossStateContactEdges:a}}function mn(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:i,cols:o,rows:s,totalFrames:a,fps:u,canStepBack:l,recordingBytes:f,recordingRawBytes:p}=e,m=U(t,"population")&&i.population,N=U(t,"diversity")&&i.diversity,y=U(t,"interfaces")&&i.interfaces,oe=o*s,ae=Ni(e,m),D=Ki(e,N),Ht=Xi(e,y);return{type:"metrics",generation:r,population:ae.population,aliveCells:ae.aliveCells,deadCells:ae.deadCells,occupancy:m&&oe>0?ae.aliveCells/oe:0,shannonEntropy:D.shannonEntropy,simpsonIndex:N?1-D.simpsonSum:0,interfaces:Ht,metricsAvailability:n,extinctionTime:{},totalFrames:a,fps:u,canStepBack:l,recordingBytes:f,recordingRawBytes:p}}function Yi(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}function bn(e,r,t,n,i){let o=se(r.cols,t),s=e[i*o+(n>>t.wordShift)]??0;return Yi(s,t,n&t.cellIndexMask)}function gn(e,r,t,n,i,o){let s=se(r.cols,t),a=i*s+(n>>t.wordShift),u=(n&t.cellIndexMask)<<t.cellShift,l=~(t.cellMask<<u),f=e[a]??0;e[a]=(f&l|(o&t.cellMask)<<u)>>>0}var qi=64*1024*1024,ja=256*1024*1024;function hr(e,r,t,n){let i=e,o;if(t.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(H(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let s=0;s<r.rows;s++)for(let a=0;a<r.cols;a++)gn(o,r,n,a,s,bn(i,r,t,a,s))}return o}function hn(e,r,t){let n=Math.floor((r-1)/2),i=e-n,o=i+r,s=[];if(i>=0&&o<=t)s.push({destinationStart:i,localStart:0,span:r});else if(i<0){let a=-i;s.push({destinationStart:t-a,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:r-a})}else{let a=t-i;s.push({destinationStart:i,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:o-t})}return s.filter(a=>a.span>0)}function Sn(e){return`
struct BrushParams {
  packedCols: u32,
  brushSize: u32,
  shape: u32,
  fill: u32,
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

const CELLS_PER_WORD: u32 = ${e.cellsPerWord}u;
const WORD_SHIFT: u32 = ${e.wordShift}u;
const CELL_SHIFT: u32 = ${e.cellShift}u;
const CELL_INDEX_MASK: u32 = ${e.cellIndexMask}u;
const CELL_MASK: u32 = ${e.cellMask}u;

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
`}function yn(e,r,t,n){let i=hn(e,t,n.cols),o=hn(r,t,n.rows),s=[];for(let a of o)for(let u of i)s.push({destinationStartX:u.destinationStart,destinationStartY:a.destinationStart,localStartX:u.localStart,localStartY:a.localStart,spanCols:u.span,spanRows:a.span});return s}var Tn={"=":"==","\u2260":"!=",">":">","<":"<","\u2265":">=","\u2264":"<="};function Hi(e){let r;return typeof e=="string"?r=Cn([e]):r=I(e),r}function Cn(e){return{kind:"tribes",tribes:[...e&&e.length>0?e:[L]]}}function I(e,r){let t=e??Cn(r),n;switch(t.kind){case"tribes":n={...t,tribes:[...t.tribes]};break;case"tiedMajority":n={...t,source:I(t.source)};break;default:n={...t};break}return n}function Le(e,r){return{kind:"count",selector:I(e?.selector,r)}}function Sr(e){return JSON.stringify(j(e))}function j(e){let r;switch(e.kind){case"tribes":r={...e,tribes:[...new Set(e.tribes)].sort()};break;case"tiedMajority":r={...e,source:j(e.source)};break;default:r=e;break}return r}function Mn(e){return e.become??{kind:"fixed",tribe:e.tribe??L}}function Se(e){let r;switch(e.kind){case"majority":case"minority":r={...e,selector:I(e.selector),tie:e.tie?Se(e.tie):void 0,fallback:e.fallback?Se(e.fallback):void 0};break;case"combine":r={kind:"combine",strategy:{...e.strategy,entries:e.strategy.entries.map(t=>({...t,inputs:t.inputs.map(n=>Hi(n)).sort((n,i)=>Sr(n).localeCompare(Sr(i)))})),default:e.strategy.default?Se(e.strategy.default):void 0},fallback:e.fallback?Se(e.fallback):void 0};break;default:r={...e};break}return r}function ji(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function Vi(e,r){e.push(`const CELLS_PER_WORD: u32 = ${r.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${r.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${r.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${r.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${r.cellMask}u;`)}function Zi(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Qi(e,r,t){r.remapped?(e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;")):(e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;"))}function Ji(e){let r=po(e),t=new Map,n=0;for(let i of r)t.set(i,`count_${n++}`);return t}function eo(e,r){let t=mo(e),n=new Map,i=0;for(let o of t){let s=r.get(o);s?n.set(o,s):n.set(o,`eq_count_${i++}`)}return n}function ro(e,r,t,n){for(let[i,o]of r)e.push(`  let ${o} = ${ut(Pn(i),t,n)};`);r.size>0&&e.push("")}function to(e,r,t,n,i){let o=0;for(let[s,a]of t)r.has(s)||(e.push(`  let ${a} = ${ut(Pn(s),n,i)};`),o++);o>0&&e.push("")}function no(e,r,t,n,i,o){for(let s=0;s<r.length;s++){let a=r[s],u=De(a.clause,t,n,i,o);e.push(s===0?`  if (${u}) {`:`  } else if (${u}) {`),st(e,Se(Mn(a)),i,o,`rule_${s}`,"    ")}r.length>0&&e.push("  }"),e.push("")}function st(e,r,t,n,i,o,s=null){switch(r.kind){case"fixed":e.push(`${o}result = ${Cr(r.tribe,n)}u;`);break;case"same":e.push(`${o}result = selfTribe;`);break;case"majority":case"minority":io(e,r,t,n,i,o);break;case"combine":oo(e,r,t,n,i,o,s);break}}function io(e,r,t,n,i,o){let s=I(r.selector),a=`${i}_${r.kind}`,u=`${i}_${r.kind}_count`,l=`${i}_${r.kind}_ties`,f=r.kind==="majority"?"0u":"9u",p=r.kind==="majority"?`candidateCount > ${u}`:`candidateCount < ${u}`;e.push(`${o}var ${a}: u32 = ${Cr(L,n)}u;`),e.push(`${o}var ${u}: u32 = ${f};`),e.push(`${o}var ${l}: u32 = 0u;`);for(let m of vr(s,t,n)){let N=V(oe=>`${oe} == ${m}u`),y=ye(s,m,n);e.push(`${o}{`),e.push(`${o}  let candidateCount = ${N};`),e.push(`${o}  if (${y} && candidateCount > 0u) {`),e.push(`${o}    if (${p}) {`),e.push(`${o}      ${a} = ${m}u;`),e.push(`${o}      ${u} = candidateCount;`),e.push(`${o}      ${l} = 1u;`),e.push(`${o}    } else if (candidateCount == ${u}) {`),e.push(`${o}      ${l} = ${l} + 1u;`),e.push(`${o}    }`),e.push(`${o}  }`),e.push(`${o}}`)}e.push(`${o}if (${l} == 1u) {`),e.push(`${o}  result = ${a};`),e.push(`${o}} else if (${l} > 1u) {`),r.tie?st(e,r.tie,t,n,`${i}_tie`,`${o}  `,{selector:s,bestCountVar:u,tieCountVar:l}):yr(e,r.fallback,t,n,`${i}_tie_fallback`,`${o}  `),e.push(`${o}} else {`),yr(e,r.fallback,t,n,`${i}_fallback`,`${o}  `),e.push(`${o}}`)}function yr(e,r,t,n,i,o){r?st(e,r,t,n,i,o):e.push(`${o}result = ${Cr(L,n)}u;`)}function oo(e,r,t,n,i,o,s){let a=`${i}_input_mask`;e.push(`${o}var ${a}: u32 = 0u;`);for(let l of co(t,n,s)){let f=_n(l,n,s);e.push(`${o}if (${f}) {`),e.push(`${o}  ${a} = ${a} | ${xn(l)};`),e.push(`${o}}`)}let u=[...r.strategy.entries];u.forEach((l,f)=>{let p=lo(l.inputs,t,n,s);e.push(f===0?`${o}if (${a} == (${p})) {`:`${o}} else if (${a} == (${p})) {`),e.push(`${o}  result = ${Cr(l.output,n)}u;`)}),u.length>0?(e.push(`${o}} else {`),yr(e,r.strategy.default??r.fallback,t,n,`${i}_fallback`,`${o}  `),e.push(`${o}}`)):yr(e,r.strategy.default??r.fallback,t,n,`${i}_fallback`,o)}function ao(e){for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(`    let ${Rn(t,r)} = readCell(${vn("x",t,"COLS")}, ${vn("y",r,"ROWS")});`)}function ut(e,r,t){let n=j(e),i;switch(n.kind){case"same":i=V(o=>`${o} == selfTribe`);break;case"different":i=V(o=>`${o} != selfTribe`);break;case"tiedMajority":i=ut(n.source,r,t);break;case"tribes":{let o=Tr(n.tribes,t);i=o.length===0?"0u":V(s=>o.map(a=>`${s} == ${a}u`).join(" || "));break}}return i}function V(e){return so().map(r=>`select(0u, 1u, ${e(r)})`).join(" + ")}function Rn(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function so(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(Rn(t,r));return e}function vn(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function Tr(e,r){let t=[];for(let n of e)t.push(Mr(n,r,"selector"));return[...new Set(t)]}function Cr(e,r){return Mr(e,r,"target")}function Mr(e,r,t){let n=r.get(e),i=r.get(L)??0;return n===void 0&&console.error(`Unknown rule ${t} tribe; using dead tribe instead.`,{tribe:e}),n??i}function vr(e,r,t){let n=j(e),i;switch(n.kind){case"tribes":i=Tr(n.tribes,t);break;case"tiedMajority":i=vr(n.source,r,t);break;default:i=r.map(o=>Mr(o.id,t,"selector"));break}return[...new Set(i)].sort((o,s)=>o-s)}function ye(e,r,t){let n=j(e),i;switch(n.kind){case"same":i=`selfTribe == ${r}u`;break;case"different":i=`selfTribe != ${r}u`;break;case"tiedMajority":i=ye(n.source,r,t);break;case"tribes":{i=Tr(n.tribes,t).includes(r)?"true":"false";break}}return i}function uo(e,r,t,n){let i=j(e),o;if(i.kind==="tiedMajority"&&n){let s=V(u=>`${u} == ${r}u`),a=ye(n.selector,r,t);o=`(${n.tieCountVar} > 1u && ${n.bestCountVar} > 0u && ${a} && ${s} == ${n.bestCountVar})`}else{let s=V(u=>`${u} == ${r}u`);o=`(${ye(i.kind==="tiedMajority"?i.source:i,r,t)} && ${s} > 0u)`}return o}function co(e,r,t){let n;return t?n=vr(t.selector,e,r):n=e.map(i=>Mr(i.id,r,"selector")),[...new Set(n)].sort((i,o)=>i-o)}function _n(e,r,t){let n;if(t){let i=V(s=>`${s} == ${e}u`),o=ye(t.selector,e,r);n=`(${t.tieCountVar} > 1u && ${t.bestCountVar} > 0u && ${o} && ${i} == ${t.bestCountVar})`}else n=`(${V(o=>`${o} == ${e}u`)} > 0u)`;return n}function lo(e,r,t,n){let i=[];for(let o of e){let s=I(o);for(let a of vr(s,r,t)){let u=fo(s,a,t,n);i.push(`select(0u, ${xn(a)}, ${u})`)}}return i.length>0?i.join(" | "):"0u"}function fo(e,r,t,n){let i=j(e),o;if(n){let s=_n(r,t,n),a=ye(i.kind==="tiedMajority"?i.source:i,r,t);o=`(${s} && ${a})`}else o=uo(i,r,t,null);return o}function xn(e){return`(1u << ${e}u)`}function Bn(e){return Sr(e)}function Pn(e){return JSON.parse(e)}function En(e,r){let t=new Set,n=o=>{t.add(Bn(o))},i=o=>{switch(r(o,n),o.kind){case pr:i(o.clause);break;case mr:case br:case gr:for(let s of o.clauses)i(s);break}};for(let o of e)i(o);return t}function po(e){return En(e,(r,t)=>{switch(r.kind){case cr:case lr:case dr:case fr:case ur:t(I(r.selector,r.tribes));break}})}function mo(e){return En(e,(r,t)=>{r.kind===sr&&(t(Le(r.left,r.tribe1).selector),t(Le(r.right,r.tribe2).selector))})}function De(e,r,t,n,i){switch(e.kind){case ot:return"false";case rn:return bo(e.tribes,n,i);case ur:return Fe(ue(I(e.selector,e.tribes),r),e.interval[0],e.interval[1]);case cr:return Fe(ue(I(e.selector,e.tribes),r),0,0);case lr:return Fe(ue(I(e.selector,e.tribes),r),e.value,e.value);case dr:return Fe(ue(I(e.selector,e.tribes),r),e.value,8);case fr:return Fe(ue(I(e.selector,e.tribes),r),0,e.value);case sr:return go(e,t);case pr:return`!(${De(e.clause,r,t,n,i)})`;case mr:return`(${e.clauses.map(o=>De(o,r,t,n,i)).join(" && ")})`;case br:return`(${e.clauses.map(o=>De(o,r,t,n,i)).join(" || ")})`;case gr:return ho(e.clauses,r,t,n,i);default:return"false"}}function bo(e,r,t){let n=Tr(e,t);return n.length===0?"false":n.length===r.length?"true":`(${n.map(i=>`selfTribe == ${i}u`).join(" || ")})`}function Fe(e,r,t){return`(${e} >= ${r}u && ${e} <= ${t}u)`}function go(e,r){let t=Le(e.left,e.tribe1).selector,n=Le(e.right,e.tribe2).selector,i=Tn[e.operator]??"==",o=Math.max(-8,Math.min(8,e.margin??0));return`(i32(${ue(t,r)}) ${i} (i32(${ue(n,r)}) + ${o}i))`}function ho(e,r,t,n,i){return`(((${e.map(o=>De(o,r,t,n,i)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`}function ue(e,r){return r.get(Bn(e))}function ct(e,r,t){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,i=Math.min(n,t),o=Math.ceil(n/i);if(o<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:i,dispatchWgY:o,remapped:!0};throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`)}function kn(e,r,t,n,i,o,s){let a=[],u=e.rules.filter(m=>!m.muted),l=s.get(L)??0,f=Ji(u.map(m=>m.clause)),p=eo(u.map(m=>m.clause),f);return a.push("// Auto-generated simulation compute shader."),a.push(`// Tribes: ${r.map(m=>m.id).join(", ")}`),a.push(`// Rules: ${e.rules.length}`),a.push(""),a.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),a.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),a.push(""),a.push(`const COLS: u32 = ${n.cols}u;`),a.push(`const ROWS: u32 = ${n.rows}u;`),a.push(`const PACKED_COLS: u32 = ${t}u;`),ji(a,i),Vi(a,o),a.push(""),Zi(a,"gridIn","PACKED_COLS"),a.push(""),a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {"),ro(a,f,r,s),to(a,f,p,r,s),a.push(`  var result: u32 = ${l}u;`),a.push(""),no(a,u,f,p,r,s),a.push("  return result;"),a.push("}"),a.push(""),a.push("@compute @workgroup_size(16, 16)"),i.remapped?a.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):a.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),Qi(a,i,"px"),a.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),a.push(""),a.push("  let baseX = px << WORD_SHIFT;"),a.push("  var packed: u32 = 0u;"),a.push(""),a.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),a.push("    let x = baseX + i;"),a.push("    if (x >= COLS) { break; }"),a.push(""),a.push("    let selfTribe = readCell(x, y);"),ao(a),a.push(""),a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),a.push("  }"),a.push(""),a.push("  gridOut[y * PACKED_COLS + px] = packed;"),a.push("}"),a.join(`
`)}var Te=3,Ue="gol-recording",Ce="raw-packed",lt="deflate-raw",dt=12,ft=256*1024*1024,wn=512*1024*1024,pt=128*1024*1024*1024;function mt(e,r,t=0){let n=t;for(let i of e)n+=i[r];return n}function In(e,r){return Math.min(e,r)}function bt(e){return Math.min(e,1073741824)}function An(e){return Math.min(e,wn)}function gt(e,r){return Math.max(e*2,r*6)}function Rr(e,r){return e>0&&e<=r}function To(e,r){return e>0?e*2+r:0}function Co(e,r){return e>=1&&r>0?e*r*(1+Te):0}function Mo(e,r){return e<ft?Math.min(ft,r):e}function Gn(e,r){return Rr(e,r)?Math.max(1,Math.floor(Mo(e,r)/e)):0}function _r(e,r){return e>=1&&r>0?Math.max(1,Math.min(dt,Math.floor(536870912/(e*r)))):dt}function Ln(e,r,t,n,i,o){let s=!r.some(u=>u)&&(i||o>=e),a=i?Math.floor(n/2)+1:n;return e>=1&&r.length>0&&(s||t>=a)}function Fn(e,r,t,n){return e<r&&n.some((i,o)=>t[o]&&i.mapState==="unmapped")}function Dn(e,r,t,n,i,o){return e&&r>=1&&t!==null&&n.length>0&&(i<r||o)}function Un(e,r,t,n,i){let o=Math.min(e.quota??pt/128,pt),s=e.usage??0,a=0,u=0;for(let p of r)p.codec===Ce?a+=p.storedBytes:u+=p.storedBytes;let l=t*n,f=i?(1+Te)*l:0;return{quotaBytes:o,usedBytes:s,pendingRawBytes:a,compressedBytes:u,gpuBufferMarginBytes:f}}function On(e,r,t,n,i){let o=bt(e);return{maxBytes:e,vramBudgetBytes:gt(e,o),frameByteSize:r,recordingAvailable:Rr(r,o),vramSimulationBytes:To(r,n),vramRecordingBytes:Co(t,r),gridFormat:i}}function xr(e,r,t){r.length>0&&(e.generationStart=r[0].generationStart,e.generationEnd=r[r.length-1].generationEnd),t.length>0&&(r.length===0&&(e.generationStart=t[0]),e.generationEnd=t[t.length-1]),e.chunks=[...r]}function $n(e){return e.map(r=>({...r,generations:[...r.generations]}))}function Wn(e,r){return e!==r}function Br(e,r=0){return mt(e,"blockCount",r)}function Nn(e){return mt(e,"storedBytes")}function zn(e){return mt(e,"uncompressedBytes")}var vo=256,Oe=80,Kn=vo*Uint32Array.BYTES_PER_ELEMENT;function Xn(e){let r=new ArrayBuffer(Oe),t=new Float32Array(r),n=new Int32Array(r),i=new Uint32Array(r),o=(e.offsetX%e.grid.cols+e.grid.cols)%e.grid.cols,s=(e.offsetY%e.grid.rows+e.grid.rows)%e.grid.rows,a=Math.floor(o),u=Math.floor(s);return t[0]=e.canvasWidth,t[1]=e.canvasHeight,t[2]=e.scale,t[4]=o-a,t[5]=s-u,i[6]=e.grid.cols,i[7]=e.grid.rows,i[8]=a,i[9]=u,i[10]=e.tribeCount,n[12]=e.brushPreview.centerX,n[13]=e.brushPreview.centerY,i[14]=e.brushPreview.brushSize,i[15]=e.brushPreview.shape,i[16]=e.brushPreview.visible?1:0,r}function Yn(e){let r=new Uint32Array(e.length);for(let t=0;t<e.length;t++){let n=e[t].color,i=parseInt(n.substring(0,2),16),o=parseInt(n.substring(2,4),16),s=parseInt(n.substring(4,6),16);r[t]=i|o<<8|s<<16}return r}function qn(e,r){return e.replace("__CELLS_PER_WORD__",`${r.cellsPerWord}u`).replace("__WORD_SHIFT__",`${r.wordShift}u`).replace("__CELL_SHIFT__",`${r.cellShift}u`).replace("__CELL_INDEX_MASK__",`${r.cellIndexMask}u`).replace("__CELL_MASK__",`${r.cellMask}u`)}function Hn(e){return Math.min(3,Math.max(0,Math.ceil(Math.log10(e.cols*e.rows/1e5))))}function ht(e){return 1024/4**Hn(e)}function St(e){return 16/2**Hn(e)}function yt(e,r){return e==="recording"?Number.MAX_SAFE_INTEGER:ht(r)*St(r)}function Tt(e,r,t,n,i){let o=e-r*n;return t>n||t>i?Math.min(o,r):o}function jn(e){return e<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/e}}function z(e){return e.request.stopCondition.kind==="targetGeneration"}function Me(e,r){return e.request.stopCondition.kind==="targetGeneration"&&r>=e.request.stopCondition.generation}function $e(e,r){return e.request.stopCondition.kind==="targetGeneration"?Math.max(0,e.request.stopCondition.generation-r):Number.POSITIVE_INFINITY}function Vn(e,r){return r.restore!==!1&&e.request.restoreAfterStop||null}function Zn(e,r,t){return r&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")}function Qn(e,r,t,n,i){return e.restartRestoredRun!==!1&&r&&t&&!n&&!i}function Jn(e,r,t,n){let i=r+t,o=Math.min(n,i-1);if(o<=0)return null;let s=i-1-o;if(s>=r)return{source:"buffered",frameInChunk:s-r};let a=0;for(let u=0;u<e.length;u++){let l=e[u];if(s<a+l.blockCount)return{source:"sealed",sealedIndex:u,frameInChunk:s-a};a+=l.blockCount}return null}function ei(e,r){return{chunkFrameIndex:r.frameInChunk+1,generation:e[r.frameInChunk]}}function ri(e,r,t,n,i,o){let s=(r+1)*t;if(i.bitsPerCell===o.bitsPerCell)return{sameFormat:!0,chunkPrefix:new Uint8Array(e,0,s),activeFrame:null};let a=H(n,i),u=new Uint8Array(s);for(let l=0;l<=r;l++){let f=new Uint8Array(e,l*a,a),p=hr(en(f),n,i,o);u.set(new Uint8Array(p.buffer,p.byteOffset,p.byteLength),l*t)}return{sameFormat:!1,chunkPrefix:u,activeFrame:u.subarray(r*t,s)}}var c,E=!1,Ur,Er,fe,Yr,R=0,_=0,qr=0,k=ir,xe=[],Be=new Map,Or,Rt,A,G,Pe,ve,Ye,_t,xt,Ne,Dt,Ut,P=!1,oi=1,ai=0,si=0,x=!1,w=!1,ee=100,b=0,Ee=0,Pr=0,Ot=0,kr,Ro=4,$t=192,de=[],$r=[],Wr=[],_o=0,wr=null,ui={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},re=null,Ir=-1,Re=!1,ze=!1,Ct=0,qe=ar,Ar=[],v=!1,$=!1,Z={chunks:[],generationStart:0,generationEnd:0,gridFormat:Ae(ir)},ci=0,C=[],He=!1,g=null,li=0,Gr=!1,F=null,h=0,M=[],pe=null,T=64,S=0,te=[],O=[],Ke=null,ce=null,W=0,je=0,le=0,K=!1,We=0,Lr=0,Fr=0,Xe=[];function xo(e){switch(!0){case e instanceof Error:return e.message;case typeof e=="string":return e;case(e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"):return e.message;default:return String(e??"Unknown worker error")}}function di(e){console.error("[GOLT worker] Worker GPU error:",e),B("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),x=!1,self.postMessage({type:"gpuError",reason:xo(e)})}self.addEventListener("error",e=>{e.preventDefault(),di(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),di(e.reason)});async function Wt(){await c.queue.onSubmittedWorkDone()}function ti(e){Lr=0,Fr=2+(e?1+Te:0),Xe=[]}async function Nr(){if(Xe.length>0){let e=c.createCommandEncoder({label:d.trackedAllocationClearEncoder});for(let r of Xe)e.clearBuffer(r);c.queue.submit([e.finish()]),await Wt(),Xe=[]}}async function zr(e,r){w&&Fr>0&&(Lr+=e,Fr--,Xe.push(r),Lr>=An(me())&&Fr>0&&(await Nr(),Lr=0))}function Kr(){F?.destroy(),F=null;for(let e of te)e?.destroy();te=[],O=[],T=0,h=0,M=[],pe=null,je=0}function ni(){A?.destroy(),G?.destroy(),dn(re),re=null,de.forEach(e=>e.destroy()),de=[],$r=[],Wr=[],Kr()}function Mt(e){let r=W>0;W+=e;let t=W>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function _e(){let e=Ln(T,O,le,_r(T,S),K,h);e!==K&&(K=e,self.postMessage({type:"backpressure",active:e}))}async function we(){self.postMessage({type:"storageQuota",...Un(await navigator.storage.estimate(),C,T,S,v)})}function me(){return In(c.limits.maxBufferSize,c.limits.maxStorageBufferBindingSize)}function Ze(){return bt(me())}function Q(){return Rr(S,Ze())}function fi(){return Fn(le,_r(T,S),O,te)}function Ve(){return Dn(Q(),T,F,te,h,fi())}async function Bo(e){let r=new DecompressionStream(lt),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],i=r.readable.getReader();for(;;){let{done:u,value:l}=await i.read();if(u)break;n.push(l)}let o=0;for(let u of n)o+=u.byteLength;let s=new Uint8Array(o),a=0;for(let u of n)s.set(u,a),a+=u.byteLength;return s.buffer}function ie(){return{cols:R,rows:_}}function Po(){return ct(Math.ceil(qr/16),Math.ceil(_/16),c.limits.maxComputeWorkgroupsPerDimension)}function Eo(){return ct(Math.ceil(R/16),Math.ceil(_/16),c.limits.maxComputeWorkgroupsPerDimension)}function Bt(){Pe?.destroy(),Pe=c.createBuffer({label:d.uniformBuffer,size:Oe,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function ko(){let e=Xn({canvasWidth:fe.width,canvasHeight:fe.height,scale:oi,offsetX:ai,offsetY:si,grid:ie(),tribeCount:xe.length,brushPreview:ui});c.queue.writeBuffer(Pe,0,e)}function Hr(){return H({cols:R,rows:_},k)}function ne(){return Ae(k)}async function Pt(){let e=Hr();A=c.createBuffer({label:d.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await zr(e,A),G=c.createBuffer({label:d.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await zr(e,G);let r=c.createCommandEncoder({label:d.gridClearEncoder});r.clearBuffer(A),r.clearBuffer(G),c.queue.submit([r.finish()]),P=!1}function Et(){let e=Yn(xe);ve&&ve.destroy(),ve=c.createBuffer({label:d.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),c.queue.writeBuffer(ve,0,e)}function kt(){let e=c.createShaderModule({label:d.renderShaderModule,code:qn(Vt,k)});Ye=c.createRenderPipeline({label:d.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:Er}]},primitive:{topology:"triangle-list"}})}function wt(){_t=c.createBindGroup({layout:Ye.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Pe}},{binding:1,resource:{buffer:A}},{binding:2,resource:{buffer:ve}}]}),xt=c.createBindGroup({layout:Ye.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Pe}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:ve}}]})}function It(){Or=Po();let e=kn(Yr,xe,qr,ie(),Or,k,Be),r=c.createShaderModule({label:d.simulationShaderModule,code:e});Ne=c.createComputePipeline({label:d.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),Dt=c.createBindGroup({layout:Ne.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:A}},{binding:1,resource:{buffer:G}}]}),Ut=c.createBindGroup({layout:Ne.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:A}}]})}function At(){Rt=Eo(),re=ln({device:c,cols:R,rows:_,gridFormat:k,dispatchPlan:Rt})}function Gt(){let e=c.createShaderModule({label:d.brushShaderModule,code:Sn(k)});kr=c.createComputePipeline({label:d.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),de.forEach(r=>r.destroy()),de=[],$r=[],Wr=[];for(let r=0;r<Ro;r++){let t=c.createBuffer({label:`${d.brushUniformBuffer} ${r}`,size:$t,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});de.push(t),$r.push(c.createBindGroup({layout:kr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:A}},{binding:1,resource:{buffer:t}}]})),Wr.push(c.createBindGroup({layout:kr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:t}}]}))}}function wo(e,r,t,n,i,o,s){let a=Be.get(L)??0,u=_o++,l=yn(r,t,n,ie()),f=P?Wr:$r;for(let[p,m]of l.entries()){let N=new ArrayBuffer($t),y=new Uint32Array(N);y[0]=qr,y[1]=n,y[2]=i,y[3]=o,y[4]=a,y[5]=u,y[6]=s.length,y[7]=m.destinationStartX,y[8]=m.destinationStartY,y[9]=m.localStartX,y[10]=m.localStartY,y[11]=m.spanCols,y[12]=m.spanRows,y[13]=0;for(let D=0;D<s.length&&D<32;D++)y[14+D]=s[D];let oe=de[p],ae=f[p];if(oe&&ae){c.queue.writeBuffer(oe,0,N);let D=Math.floor(m.destinationStartX/k.cellsPerWord),Ei=Math.ceil((m.destinationStartX+m.spanCols)/k.cellsPerWord)-D,ki=Math.ceil(Ei/8),wi=Math.ceil(m.spanRows/8),nr=e.beginComputePass({label:d.brushPass});nr.setPipeline(kr),nr.setBindGroup(0,ae),nr.dispatchWorkgroups(ki,wi),nr.end()}else throw console.error("[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.",{index:p,rectCount:l.length,bindGroupCount:f.length,uniformBufferCount:de.length}),new Error("Brush dispatch resources are out of sync with the wrapped brush rectangles.")}}function Io(){let e=P?G:A,r=Hr(),t;try{t=c.createBuffer({label:d.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=c.createCommandEncoder({label:d.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),c.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),i})}function pi(){S=Hr(),T=Gn(S,Ze())}function Lt(){self.postMessage({type:"limits",...On(me(),S,T,Oe+Kn+$t+ge*2+he*2,ne())})}function Qe(e){if(T>=1&&F!==null&&h<T){let r=P?G:A,t=h*S,n=c.createCommandEncoder({label:d.recordingFrameCopyEncoder});n.copyBufferToBuffer(r,0,F,t,S),c.queue.submit([n.finish()]),M.push(e),pe=e,h++,Dr()}}function vt(e){je=Math.max(0,je+e)}function Dr(){T>0&&h>=T&&fi()&&Je()}function Je(){let e=F;if(e!==null&&h>0&&te.length>0&&le<_r(T,S)){let r=O.indexOf(!0);if(r>=0){O[r]=!1;let t=te[r];if(t.mapState==="unmapped"){let n=h*S,i=ci++,o=[...M],s=o[0],a=o[o.length-1],u=`chunk-${String(i).padStart(6,"0")}.bin`,l=h,f=c.createCommandEncoder({label:d.recordingSealCopyEncoder});f.copyBufferToBuffer(e,0,t,0,n),c.queue.submit([f.finish()]);let p={chunkId:i,generationStart:s,generationEnd:a,blockCount:l,codec:Ce,uncompressedBytes:n,storedBytes:n,gridFormat:ne(),generations:o,filename:u};Mt(1),vt(l),le++,_e();let m=We;t.mapAsync(GPUMapMode.READ).then(async()=>{let N=t.getMappedRange(),y=new ArrayBuffer(n);new Uint8Array(y).set(new Uint8Array(N,0,n)),t.unmap(),m===We&&(O[r]=!0,C.push(p),vt(-l),xr(Z,C,M),_e(),Dr(),Ao(p,y).then(()=>{m===We&&(le--,_e(),Mt(-1),we(),Xr(),Y(!0),Dr(),self.postMessage({type:"chunkSealed",filename:p.filename,rawBytes:n,blockCount:p.blockCount,cols:R,rows:_,rawGridFormat:p.gridFormat,storageGridFormat:Ae(or(Yr.tribes.length))}),He&&W===0&&(He=!1,Xr()))}))}).catch(()=>{m===We&&(O[r]=!0,le--,vt(-l),_e(),Mt(-1),Dr())}),h=0,M=[]}else O[r]=!0}}}async function mi(e){We++,ci=0,h=0,M=[],C=[],pe=null,je=0,le=0,W>0&&(W=0,self.postMessage({type:"chunksSaving",active:!1})),K&&(K=!1,self.postMessage({type:"backpressure",active:!1})),He=!1,$=v,Z={chunks:[],generationStart:e,generationEnd:e,gridFormat:ne()},await bi(),we()}async function Nt(){return ce&&await ce,Ke||(Ke=await(await navigator.storage.getDirectory()).getDirectoryHandle(Ue,{create:!0})),Ke}async function Ao(e,r){let i=await(await(await Nt()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(r),await i.close()}async function Go(e){let r=await Nt();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function bi(){if(ce)await ce;else{ce=(async()=>{let e=await navigator.storage.getDirectory();Ke=null;try{await e.removeEntry(Ue,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${Ue}:`,r)}Ke=await e.getDirectoryHandle(Ue,{create:!0})})();try{await ce}finally{ce=null}}}function Xr(){xr(Z,C,M),self.postMessage({type:"recording",manifest:{chunks:$n(C),generationStart:Z.generationStart,generationEnd:Z.generationEnd,gridFormat:ne()},cols:R,rows:_})}function er(e=!1){if(v){let r=!$;e&&$&&Ve()&&($=!1,r=!0),r&&Wn(pe,b)&&Ve()&&(h>=T&&Je(),Qe(b))}}function zt(){if(wr){let e=wr;wr=null;let r=v&&h>0&&M[h-1]===b;r&&(h--,M.pop());let t=c.createCommandEncoder({label:d.brushEncoder});wo(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),c.queue.submit([t.finish()]),r&&Qe(b)}}async function Lo(e,r=Ce){let o=await(await(await(await Nt()).getFileHandle(e)).getFile()).arrayBuffer();return r===lt?Bo(o):o}function gi(){return on(R,_,qe.enabled,qe.sections)}function Fo(){return an(gi())}function hi(e){Ar=Fo(),re&&Ar.length>0&&fn({device:c,encoder:e,resources:re,sourceBuffer:P?G:A,dispatchPlan:Rt,enabledSections:Ar})}function Si(){let e=b;if(re&&e!==Ir&&!Re){let r=[...Ar],t=gi();Ir=e,Re=!0,pn({resources:re,enabledSections:r}).then(n=>{let i=Be.get(L)??0,o=Br(C,h+je),s=mn({generation:e,tribes:xe,deadTribeIndex:i,readback:n,enabledSections:r,availability:t,liveMetricSettings:qe.sections,cols:R,rows:_,totalFrames:o,fps:Ot,canStepBack:o>1,recordingBytes:Nn(C),recordingRawBytes:zn(C)});if(Re=!1,self.postMessage(s),ze)if(ze=!1,Ir=-1,Ci()){let a=c.createCommandEncoder({label:d.interactiveMetricsEncoder});hi(a),c.queue.submit([a.finish()]),Si()}else ze=!0}).catch(()=>{Re=!1})}}function yi(e){if(e>0){let r=Or,t=c.createCommandEncoder({label:d.simulationBatchEncoder});for(let n=0;n<e;n++){let i=t.beginComputePass({label:d.simulationStepPass});i.setPipeline(Ne),i.setBindGroup(0,P?Ut:Dt),i.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),i.end(),P=!P,b++}c.queue.submit([t.finish()]),Ee+=e}}function Do(){self.postMessage({type:"generation",generation:b,fps:Ot})}function Kt(){let e=c.createCommandEncoder({label:d.simulationSingleStepEncoder}),r=e.beginComputePass({label:d.simulationStepPass});r.setPipeline(Ne),r.setBindGroup(0,P?Ut:Dt);let t=Or;r.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),r.end(),c.queue.submit([e.finish()]),P=!P,b++}function X(){if(c&&Ur&&Pe&&Ye&&_t&&xt&&!w&&!E){ko();let e=Ur.getCurrentTexture().createView(),r=c.createCommandEncoder({label:d.renderEncoder}),t=r.beginRenderPass({label:d.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(Ye),t.setBindGroup(0,P?xt:_t),t.draw(3),t.end(),c.queue.submit([r.finish()])}}function Ti(e){Pr===0&&(Pr=e);let r=e-Pr;r>=1e3&&(Ot=Ee/(r/1e3),Ee=0,Pr=e)}function Xt(){return v&&Q()?"recording":"nonRecording"}function Ci(){return!!(c&&re&&!w&&!E)}function Y(e=!1){if(e&&(Ir=-1),!Ci())ze=!0;else if(Re)ze=!0;else{let r=c.createCommandEncoder({label:d.interactiveMetricsEncoder});hi(r),c.queue.submit([r.finish()]),Si()}}function Mi(){Y(!0),X()}function jr(e,r){r&&(e-Ct>=1e3||Ct===0)&&!Re&&(Ct=e,Y())}function rr(e,r){(e.request.pacing.kind==="max"||z(e))&&r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,Do())}function ke(e){K!==e&&(K=e,self.postMessage({type:"backpressure",active:e}))}function Yt(){let e=Ve();return e&&h>=T&&(Je(),e=Ve()),e}function tr(){!w&&!E&&!g&&self.requestAnimationFrame(Ft)}function be(e){let r=g;if(r&&!r.pumpPending&&!w&&!E){let{token:t}=r;r.pumpPending=!0;let n=()=>{g&&g.token===t&&(g.pumpPending=!1,Ko(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?c.queue.onSubmittedWorkDone().then(n).catch(()=>{g?.token===t&&(g.pumpPending=!1)}):queueMicrotask(n)}}function qt(e,r){g&&B("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),g={kind:e,request:r,token:++li,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0},be(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function J(){x&&qt(Xt(),{pacing:jn(ee),stopCondition:{kind:"none"}})}function Uo(e,r){r||e==="cancelled"?ke(!1):K&&_e()}function B(e,r={}){let t=g;if(t){g=null,li++;let n=z(t),i=Vn(t,r),o=!!i;i&&(x=i.running,ee=i.targetStepDuration),Zn(e,n,r)&&self.postMessage({type:"stepping",active:!1}),Uo(e,n),r.render!==!1&&!w&&!E&&Mi(),Qn(r,o,x,w,E)?J():tr()}}function vi(e){let r=g;r&&z(r)&&(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),B("cancelled"))}function Oo(e){B("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),qt(Xt(),e)}function Ri(e,r,t){ke(!0),rr(e,r),jr(r,t),be("drain")}function $o(e,r){let t=ie(),n=ht(t),i=St(t),o=!1;for(let s=0;s<i;s++){let a=$e(e,b);if(a<=0)break;yi(Math.min(n,a)),o=!0}rr(e,r),Me(e,b)?B("targetReached"):be(o?"drain":"raf")}function Wo(e,r){er(!0);let t=!1,n=!1,i=performance.now()+14;for(;$e(e,b)>0&&performance.now()<i;)if(Yt())Kt(),Ee++,t=!0,Qe(b);else{Ri(e,r,t),n=!0;break}n||(ke(!1),rr(e,r),jr(r,t),Me(e,b)?B("targetReached"):be("raf"))}function No(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=e.stepAccumulator,o=Math.floor(e.stepAccumulator/r),s=yt(e.kind,ie()),a=Math.min(o,$e(e,b),s),u=a>0;if(u&&yi(a),e.stepAccumulator=Tt(i,r,o,a,s),rr(e,t),Me(e,b))B("targetReached");else{let l=u&&o>a;(!z(e)&&!l||t-e.lastRenderTime>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,X(),jr(t,u)),be(l?"drain":"raf")}}function zo(e,r,t){er(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=!1,o=0,s=e.stepAccumulator,a=yt(e.kind,ie()),u=Math.floor(e.stepAccumulator/r),l=performance.now()+14,f=!1;for(;e.stepAccumulator>=r&&$e(e,b)>0&&o<a&&performance.now()<l;)if(Yt())Kt(),Ee++,o++,e.stepAccumulator-=r,i=!0,Qe(b);else{Ri(e,t,i),f=!0;break}e.stepAccumulator=Tt(s,r,u,o,a),f||(ke(!1),rr(e,t),Me(e,b)?B("targetReached"):(z(e)||(X(),jr(t,i)),be("raf")))}function Ko(e){let r=g;if(r&&!w&&!E)if(Ti(e),z(r)||zt(),Me(r,b))B("targetReached");else if(r.request.pacing.kind==="max")r.kind==="recording"?Wo(r,e):$o(r,e);else{let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?zo(r,t,e):No(r,t,e)}}function Ft(e){w||E?self.requestAnimationFrame(Ft):(Ti(e),g||(zt(),ee>0&&!Gr&&X(),self.requestAnimationFrame(Ft)))}function Xo(e,r){let t=c?me():Number.POSITIVE_INFINITY;return Zt(r.bitsPerCell)&&Jr(r.bitsPerCell,e.tribes.length)&&et(e,Ie(r.bitsPerCell),t)?Ie(r.bitsPerCell):Jt(e.tribes.length,e,t)}function _i(e,r){Yr=e,R=e.cols,_=e.rows,k=Xo(e,r),qr=se(R,k),xe=[...e.tribes],Z.gridFormat=ne(),Be.clear(),xe.forEach((t,n)=>Be.set(t.id,n))}async function xi(e){console.log("[GOLT worker] Initializing WebGPU"),fe=e,c=await tn(d.webengineDevice),E=!1,c.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),B("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),E=!0,x=!1,w=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:me(),vramBudgetBytes:gt(me(),Ze()),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:ne()});let r=fe.getContext("webgpu");if(r)Ur=r,Er=navigator.gpu.getPreferredCanvasFormat(),Ur.configure({device:c,format:Er,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:Er,maxBufferSize:c.limits.maxBufferSize,maxStorageBufferBindingSize:c.limits.maxStorageBufferBindingSize});else throw new Error("WebGPU canvas context not available")}async function Yo(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await xi(fe),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),B("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),E=!0,x=!1,w=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function Bi(){F=c.createBuffer({label:d.recordingChunkBuffer,size:T*S,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await zr(T*S,F),h=0,M=[],pe=null}async function Pi(){let e=T*S;te=[],O=[];for(let r=0;r<Te;r++){let t=c.createBuffer({label:`${d.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});te.push(t),O.push(!0),await zr(e,t)}}async function qo(){await bi()}async function Ho(){console.log("[GOLT worker] Building GPU resources",{cols:R,rows:_,bitsPerCell:k.bitsPerCell,recordingAvailable:Q()}),Bt(),pi(),await Pt(),Et(),kt(),wt(),It(),Gt(),At(),await qo(),Q()?(await Bi(),await Pi()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:S,maxRecordingBufferBytes:Ze()}),Kr(),v=!1,$=!1),await Nr(),Lt(),console.log("[GOLT worker] GPU resources ready")}async function jo(){console.log("[GOLT worker] Rebuild started",{cols:R,rows:_,bitsPerCell:k.bitsPerCell}),B("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),w=!0,self.postMessage({type:"rebuilding",active:!0});try{await Wt()}catch{console.warn("[GOLT worker] Queue idle wait rejected during rebuild")}let e=!E;if(E&&(e=await Yo()),e){ni(),Bt(),pi(),ti(Q());try{await Pt(),Et(),kt(),It(),Gt(),wt(),At(),Q()?(await Bi(),await Pi()):(Kr(),v=!1,$=!1),await Nr(),Lt()}catch(r){let t=r instanceof Error?r.message:String(r);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{ni(),Bt(),ti(!1),await Pt(),Et(),kt(),It(),Gt(),wt(),At(),v=!1,$=!1,S=Hr(),Kr(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await Nr(),Lt()}catch(n){console.error("[GOLT worker] GPU rebuild recovery failed:",n),e=!1}}}return e&&(w=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:Q(),frameByteSize:S})),e}function ii(e){Gr=!0,c.queue.onSubmittedWorkDone().then(()=>{Gr=!1,e()}).catch(()=>{Gr=!1})}async function Vo(){W>0&&await new Promise(e=>{let r=setInterval(()=>{W===0&&(clearInterval(r),e())},10)})}async function Zo(e){console.log("[GOLT worker] Init message received",{cols:e.ruleset.cols,rows:e.ruleset.rows,recording:e.recording,running:e.running,speed:e.speed}),v=e.recording,qe=nt(e.liveMetrics),$=v,_i(e.ruleset,e.simulationGridFormat),await xi(e.canvas),await Ho(),Y(!0),we(),x=e.running,ee=e.speed<0?0:1e3/e.speed,x?J():tr()}function Qo(e){qe=nt(e.liveMetrics),Y(!0)}async function Jo(e){console.log("[GOLT worker] Ruleset update received",{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length});let r=me();if(rt(e.ruleset.tribes.length,e.ruleset,r))B("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),_i(e.ruleset,e.simulationGridFormat),await jo()&&(b=0,await mi(0),Y(!0),x?J():tr());else{let i=`Requested ruleset requires at least ${Qt(e.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",i,{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length,maxBytes:r}),self.postMessage({type:"gpuError",reason:i})}}function ea(e){x=e.running,e.running?g||J():g&&z(g)?vi(!1):g?B("manual"):(K&&_e(),Mi(),tr())}function ra(e){let r=ee<=0,t=e.speed<0?0:1e3/e.speed;ee=t,g&&!z(g)&&x?(B("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&t>0?ii(()=>{X(),J()}):J()):x&&!g?J():r&&t>0&&ii(()=>{X(),tr()})}function ta(e){oi=e.scale,ai=e.offsetX,si=e.offsetY}function na(e){fe.width=e.width,fe.height=e.height}function ia(e){let r=e.tribes.map(t=>Be.get(t)).filter(t=>t!==void 0);if(r.length>0){let t={square:0,round:1,diamond:2,vline:3,hline:4},n={full:0,spray:1,outline:2};wr={centerX:e.x,centerY:e.y,brushSize:e.size,shape:t[e.shape]??0,fill:n[e.fill]??0,tribeIds:r}}}function oa(e){let r={square:0,round:1,diamond:2,vline:3,hline:4};ui={centerX:e.x,centerY:e.y,brushSize:e.size,shape:r[e.shape]??0,visible:e.visible},!g&&!w&&!E&&ee<=0&&X()}async function aa(){try{let e=await Io();it({type:"snapshot",grid:e,generation:b,cols:R,rows:_,gridFormat:ne()},[e.buffer])}catch{let e=new Uint32Array(0);it({type:"snapshot",grid:e,generation:b,cols:R,rows:_,gridFormat:ne()},[e.buffer])}}async function sa(e){let r=tt(e.gridFormat),t=ie();if(e.grid.byteLength===H(t,r)){let n=hr(e.grid,t,r,k);c.queue.writeBuffer(P?G:A,0,n),b=e.generation,await mi(e.generation)}}function ua(e){let r=g?.request,t=Q();e.recording&&t&&!v?(v=!0,$=!0,Y(!0),we()):(!e.recording||!t)&&(e.recording&&!t&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:S,maxRecordingBufferBytes:Ze()}),v=!1,$=!1),r&&g?Oo(r):!g&&x&&J()}async function ca(){He||(await Wt(),er(!1),h>0&&Je(),W>0?He=!0:Xr())}async function la(e){let r=Br(C),t=Jn(C,r,h,e.count);if(t){let n=P?G:A;if(t.source==="buffered"){let i=ei(M,t);h=i.chunkFrameIndex,M.length=h,b=i.generation,pe=b;let o=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});o.copyBufferToBuffer(F,t.frameInChunk*S,n,0,S),c.queue.submit([o.finish()])}else{W>0&&(await Vo(),r=Br(C));let i=C[t.sealedIndex],o=await Lo(i.filename,i.codec),s=ie(),a=tt(i.gridFormat),u=ri(o,t.frameInChunk,S,s,a,k);if(c.queue.writeBuffer(F,0,u.chunkPrefix),!u.sameFormat&&u.activeFrame&&c.queue.writeBuffer(n,0,u.activeFrame),h=t.frameInChunk+1,M=i.generations.slice(0,t.frameInChunk+1),b=M[t.frameInChunk],pe=b,u.sameFormat){let f=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});f.copyBufferToBuffer(F,t.frameInChunk*S,n,0,S),c.queue.submit([f.finish()])}let l=C.splice(t.sealedIndex);Go(l.map(f=>f.filename))}xr(Z,C,M),we(),Y(!0),X()}}function da(){zt(),er(!0),!v||Yt()?(Kt(),Ee++,v&&Ve()&&(h>=T&&Je(),Qe(b)),ke(!1)):ke(!0),Y(!0),X()}function fa(e){self.postMessage({type:"stepping",active:!0}),er(!0),qt(Xt(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:b+e},restoreAfterStop:{running:x,targetStepDuration:ee}})}function pa(e){e.count===1?da():fa(e.count)}function ma(){vi(g?.request.restoreAfterStop?.running??x)}function ba(e){let r=C.find(t=>t.filename===e.filename);r&&(r.codec=e.codec,r.storedBytes=e.storedBytes,r.gridFormat=e.gridFormat,Z.chunks=[...C],we(),Xr())}function ga(){let e=C.filter(r=>r.codec===Ce).map(r=>({filename:r.filename,rawBytes:r.uncompressedBytes,blockCount:r.blockCount,cols:R,rows:_,rawGridFormat:r.gridFormat,storageGridFormat:Ae(or(Yr.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:e})}async function ha(e){switch(e.type){case"init":await Zo(e);break;case"setLiveMetrics":Qo(e);break;case"setRuleset":await Jo(e);break;case"setRunning":ea(e);break;case"setSpeed":ra(e);break;case"camera":ta(e);break;case"resize":na(e);break;case"draw":ia(e);break;case"brushPreview":oa(e);break;case"getSnapshot":await aa();break;case"loadSnapshot":await sa(e);break;case"setRecording":ua(e);break;case"getRecording":await ca();break;case"stepBack":await la(e);break;case"stepForward":pa(e);break;case"cancelStepping":ma();break;case"updateChunkCodec":ba(e);break;case"getUncompressedChunks":ga();break}}self.onmessage=async e=>{await ha(e.data)};
