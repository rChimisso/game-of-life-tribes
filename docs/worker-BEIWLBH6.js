var Zt="goltTimestampedConsoleInstalled";function Oi(){let e=globalThis;e[Zt]||(e[Zt]=!0,Jr("info"),Jr("warn"),Jr("error"),console.log=console.info.bind(console))}function Jr(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}Oi();var Qt=`// Render shader: draws the grid as a full-screen quad.\r
// Reads cell tribe IDs from a storage buffer, looks up colors from a uniform array.\r
// Supports zoom, pan, and toroidal tiling.\r
\r
struct Uniforms {\r
  canvas_size: vec2f,    // Canvas width, height in pixels.\r
  scale: f32,            // Pixels per cell.\r
  offset_frac: vec2f,    // Fractional camera offset in cell units.\r
  grid_size: vec2u,      // Grid cols, rows.\r
  offset_cell: vec2u,    // Integer camera offset in cell units.\r
  tribe_count: u32,      // Number of tribes.\r
  preview_center: vec2i, // Brush preview center cell.\r
  preview_size: u32,     // Brush preview size in cells.\r
  preview_shape: u32,    // 0=square 1=round 2=diamond 3=vline 4=hline.\r
  preview_visible: u32,  // 1 when the brush preview should render.\r
};\r
\r
struct VertexOutput {\r
  @builtin(position) position: vec4f,\r
  @location(0) uv: vec2f,\r
};\r
\r
@group(0) @binding(0) var<uniform> u: Uniforms;\r
@group(0) @binding(1) var<storage, read> grid: array<u32>;\r
@group(0) @binding(2) var<storage, read> tribe_colors: array<u32>;\r
\r
const CELLS_PER_WORD: u32 = __CELLS_PER_WORD__;\r
const WORD_SHIFT: u32 = __WORD_SHIFT__;\r
const CELL_SHIFT: u32 = __CELL_SHIFT__;\r
const CELL_INDEX_MASK: u32 = __CELL_INDEX_MASK__;\r
const CELL_MASK: u32 = __CELL_MASK__;\r
\r
fn wrapAdd(base: u32, delta: u32, size: u32) -> u32 {\r
  let rem = delta % size;\r
  if (base >= size - rem) {\r
    return base - (size - rem);\r
  }\r
  return base + rem;\r
}\r
\r
fn wrapCell(value: i32, size: u32) -> i32 {\r
  return ((value % i32(size)) + i32(size)) % i32(size);\r
}\r
\r
fn signedWrapDelta(cell: u32, center: i32, size: u32) -> i32 {\r
  let wrapped_center = wrapCell(center, size);\r
  var delta = i32(cell) - wrapped_center;\r
  let half_size = i32(size) / 2;\r
  if (delta > half_size) {\r
    delta = delta - i32(size);\r
  } else if (delta < -half_size) {\r
    delta = delta + i32(size);\r
  }\r
  return delta;\r
}\r
\r
fn previewInShape(bx: i32, by: i32, size: u32, shape: u32) -> bool {\r
  if (bx < 0 || by < 0 || bx >= i32(size) || by >= i32(size)) { return false; }\r
  let hf = f32(size - 1u) / 2.0;\r
  let fdx = f32(bx) - hf;\r
  let fdy = f32(by) - hf;\r
  switch (shape) {\r
    case 1u: {\r
      let r = f32(size) / 2.0 - 0.25;\r
      return fdx * fdx + fdy * fdy <= r * r;\r
    }\r
    case 2u: {\r
      return abs(fdx) + abs(fdy) <= f32(size) / 2.0;\r
    }\r
    case 3u: {\r
      return bx == i32(size - 1u) / 2;\r
    }\r
    case 4u: {\r
      return by == i32(size - 1u) / 2;\r
    }\r
    default: {\r
      return true;\r
    }\r
  }\r
}\r
\r
fn signedWrapWorldDelta(world: f32, center: i32, size: u32) -> f32 {\r
  let gridSize = f32(size);\r
  let wrappedCenter = f32(wrapCell(center, size));\r
  let delta = world - wrappedCenter;\r
  return delta - floor((delta + gridSize * 0.5) / gridSize) * gridSize;\r
}\r
\r
fn previewRectangleOutline(p: vec2f, halfSize: vec2f, stroke: f32) -> bool {\r
  let distanceInside = halfSize - abs(p);\r
  let inside = distanceInside.x >= 0.0 && distanceInside.y >= 0.0;\r
  return inside && min(distanceInside.x, distanceInside.y) <= stroke;\r
}\r
\r
fn previewSubpixelRectangleOutline(p: vec2f, halfSize: vec2f, stroke: f32) -> bool {\r
  let q = abs(p) - halfSize;\r
  let outsideDistance = length(max(q, vec2f(0.0)));\r
  let insideDistance = min(max(q.x, q.y), 0.0);\r
  let signedDistance = outsideDistance + insideDistance;\r
  return abs(signedDistance) <= stroke;\r
}\r
\r
fn previewCellBorderOutlineMask(ix: u32, iy: u32, cell_frac: vec2f) -> bool {\r
  let size = max(u.preview_size, 1u);\r
  let half = i32(size - 1u) / 2;\r
  let bx = signedWrapDelta(ix, u.preview_center.x, u.grid_size.x) + half;\r
  let by = signedWrapDelta(iy, u.preview_center.y, u.grid_size.y) + half;\r
  let inside = previewInShape(bx, by, size, u.preview_shape);\r
  let edge = min(1.0, 1.0 / max(u.scale, 0.001));\r
  return inside && (\r
    (!previewInShape(bx - 1, by, size, u.preview_shape) && cell_frac.x <= edge) ||\r
    (!previewInShape(bx + 1, by, size, u.preview_shape) && cell_frac.x >= 1.0 - edge) ||\r
    (!previewInShape(bx, by - 1, size, u.preview_shape) && cell_frac.y <= edge) ||\r
    (!previewInShape(bx, by + 1, size, u.preview_shape) && cell_frac.y >= 1.0 - edge)\r
  );\r
}\r
\r
fn previewContinuousOutlineMask(local: vec2f) -> bool {\r
  let size = max(u.preview_size, 1u);\r
  let world = vec2f(f32(u.offset_cell.x), f32(u.offset_cell.y)) + local;\r
  let delta = vec2f(\r
    signedWrapWorldDelta(world.x, u.preview_center.x, u.grid_size.x),\r
    signedWrapWorldDelta(world.y, u.preview_center.y, u.grid_size.y)\r
  );\r
  let footprintCenter = vec2f(0.5, 0.5);\r
  let p = delta - footprintCenter;\r
  let halfSize = f32(size) * 0.5;\r
  let stroke = 1.0 / max(u.scale, 0.001);\r
\r
  switch (u.preview_shape) {\r
    case 1u: {\r
      return abs(length(p) - halfSize) <= stroke;\r
    }\r
    case 2u: {\r
      return abs(abs(p.x) + abs(p.y) - halfSize) <= stroke;\r
    }\r
    case 3u: {\r
      return previewSubpixelRectangleOutline(p, vec2f(0.5, halfSize), stroke);\r
    }\r
    case 4u: {\r
      return previewSubpixelRectangleOutline(p, vec2f(halfSize, 0.5), stroke);\r
    }\r
    default: {\r
      return previewRectangleOutline(p, vec2f(halfSize, halfSize), stroke);\r
    }\r
  }\r
}\r
\r
fn previewOutlineMask(ix: u32, iy: u32, local: vec2f) -> bool {\r
  if (u.scale > 1.0) {\r
    return previewCellBorderOutlineMask(ix, iy, fract(local));\r
  }\r
  return previewContinuousOutlineMask(local);\r
}\r
\r
@vertex\r
fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {\r
  // Full-screen triangle trick: 3 vertices cover the entire clip space.\r
  var pos = array<vec2f, 3>(\r
    vec2f(-1.0, -1.0),\r
    vec2f( 3.0, -1.0),\r
    vec2f(-1.0,  3.0),\r
  );\r
  var out: VertexOutput;\r
  out.position = vec4f(pos[vi], 0.0, 1.0);\r
  // UV: [0,1] range, y flipped so top-left = (0,0).\r
  out.uv = (pos[vi] + 1.0) * 0.5;\r
  out.uv.y = 1.0 - out.uv.y;\r
  return out;\r
}\r
\r
@fragment\r
fn fs_main(in: VertexOutput) -> @location(0) vec4f {\r
  // Convert pixel coordinate to local cell offset. The large integer camera\r
  // offset is applied separately to avoid f32 precision loss on wide grids.\r
  let px = in.uv * u.canvas_size;\r
  let local = px / u.scale + u.offset_frac;\r
\r
  let ix = wrapAdd(u.offset_cell.x, u32(local.x), u.grid_size.x);\r
  let iy = wrapAdd(u.offset_cell.y, u32(local.y), u.grid_size.y);\r
\r
  // Read tribe ID from the active packed grid buffer.\r
  let packed_cols = (u.grid_size.x + CELLS_PER_WORD - 1u) >> WORD_SHIFT;\r
  let word_idx = iy * packed_cols + (ix >> WORD_SHIFT);\r
  let shift = (ix & CELL_INDEX_MASK) << CELL_SHIFT;\r
  let tribe_id = (grid[word_idx] >> shift) & CELL_MASK;\r
\r
  // Look up tribe color (packed as 0x00BBGGRR).\r
  let color_packed = tribe_colors[tribe_id];\r
  let r = f32(color_packed & 0xFFu) / 255.0;\r
  let g = f32((color_packed >> 8u) & 0xFFu) / 255.0;\r
  let b = f32((color_packed >> 16u) & 0xFFu) / 255.0;\r
\r
  if (u.preview_visible == 1u && previewOutlineMask(ix, iy, local)) {\r
    return vec4f(0.82, 0.84, 0.86, 1.0);\r
  }\r
\r
  return vec4f(r, g, b, 1.0);\r
}\r
`;var et=[1,2,4,8,16,32],Ni={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Wi={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},zi={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},ur={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Ki={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},rt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},Z={1:Ni,2:Wi,4:zi,8:ur,16:Ki,32:rt};function Jt(e){return et.includes(e)}function Xi(e){return 2**e}function tt(e,r){return r<=Xi(e)}function nt(e,r,t){return Q(e,r)<=t}function cr(e){return e<=2?Z[1]:e<=4?Z[2]:e<=16?Z[4]:e<=256?Z[8]:e<=65536?Z[16]:Z[32]}function en(e){return cr(e)}function Ae(e){return Z[e]}function rn(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){return it(e,r,t)??rt}function it(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of et){let i=Ae(n);if(tt(n,e)&&nt(r,i,t))return i}return null}function ot(e){return Ae(e?.bitsPerCell??8)}function Ie(e){return{bitsPerCell:e.bitsPerCell}}function ue(e,r){return Math.ceil(e/r.cellsPerWord)}function Q(e,r){return ue(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function tn(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}var Ge={population:!0,diversity:!0,interfaces:!1},lr={enabled:!0,sections:Ge};function Yi(e){return{population:typeof e?.population=="boolean"?e.population:Ge.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Ge.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Ge.interfaces}}function at(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:lr.enabled,sections:Yi(e?.sections)}}function st(e,r){self.postMessage(e,r)}var M="dead";var ut="empty",nn="is",dr="comparison",fr="count",pr="none",mr="exactly",br="min",gr="max",hr="not",Sr="and",yr="or",Tr="xor";async function on(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var d={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var an=4294967295;function ct(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function $(e,r){return e.includes(r)}function sn(e,r,t,n){let i=e*r,o=i<=an,s=i*2<=an;return{population:ct(t&&n.population,o),diversity:ct(t&&n.diversity,o),interfaces:ct(t&&n.interfaces,s)}}function un(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var Se=256*Uint32Array.BYTES_PER_ELEMENT,ye=Uint32Array.BYTES_PER_ELEMENT;function cn(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function ln(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function dn(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function qi(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
${cn(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${ln(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${dn(i)}
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
`}function Hi(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
${cn(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${ln(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${dn(i)}
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
`}function ji(e,r){let{tribes:t,deadTribeIndex:n,readback:i,cols:o,rows:s}=e,a=o*s,u={};for(let p=0;p<t.length;p++){let f=r?i.histogram[p]??0:0;u[t[p].id]=f}let l=r?u[t[n]?.id??""]??0:0;return{population:u,aliveCells:r?Math.max(0,a-l):0,deadCells:l}}function Vi(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,i=0;for(let o=0;o<r.length;o++)o!==t&&(i+=n.histogram[o]??0);return i}function Zi(e,r){let{tribes:t,deadTribeIndex:n,readback:i}=e,o=r?Vi(e):0,s=0,a=0;for(let u=0;u<t.length;u++){let l=u!==n&&o>0?(i.histogram[u]??0)/o:0;l>0&&(s-=l*Math.log2(l),a+=l*l)}return{shannonEntropy:s,simpsonSum:a}}function Qi(e,r){let t=e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,i=r?Math.max(0,t-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?i/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function fn(e){let{device:r}=e,t=r.createShaderModule({label:d.histogramMetricsShaderModule,code:qi(e)}),n=r.createComputePipeline({label:d.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),i=r.createBuffer({label:d.histogramMetricsBuffer,size:Se,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=r.createBuffer({label:d.histogramMetricsReadBuffer,size:Se,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=r.createShaderModule({label:d.interfaceMetricsShaderModule,code:Hi(e)}),a=r.createComputePipeline({label:d.interfaceMetricsPipeline,layout:"auto",compute:{module:s,entryPoint:"main"}}),u=r.createBuffer({label:d.interfaceMetricsBuffer,size:ye,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),l=r.createBuffer({label:d.interfaceMetricsReadBuffer,size:ye,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:a,boundaryBuffer:u,boundaryReadBuffer:l}}function pn(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function mn(e){let{device:r,encoder:t,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:s}=e;if($(s,"population")||$(s,"diversity")){let a=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,a);let u=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),l=t.beginComputePass({label:d.histogramMetricsPass});l.setPipeline(n.histogramPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Se)}if($(s,"interfaces")){let a=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,a);let u=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),l=t.beginComputePass({label:d.interfaceMetricsPass});l.setPipeline(n.boundaryPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,ye)}}async function bn(e){let{resources:r,enabledSections:t}=e,n=$(t,"population")||$(t,"diversity"),i=$(t,"interfaces"),o=[];n&&o.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let s=new Uint32Array(256);n&&(s=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let a=0;if(i){let u=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),a=u[0]??0}return{histogram:s,crossStateContactEdges:a}}function gn(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:i,cols:o,rows:s,totalFrames:a,fps:u,canStepBack:l,recordingBytes:p,recordingRawBytes:f}=e,m=$(t,"population")&&i.population,D=$(t,"diversity")&&i.diversity,S=$(t,"interfaces")&&i.interfaces,U=o*s,se=ji(e,m),O=Zi(e,D),Vt=Qi(e,S);return{type:"metrics",generation:r,population:se.population,aliveCells:se.aliveCells,deadCells:se.deadCells,occupancy:m&&U>0?se.aliveCells/U:0,shannonEntropy:O.shannonEntropy,simpsonIndex:D?1-O.simpsonSum:0,interfaces:Vt,metricsAvailability:n,extinctionTime:{},totalFrames:a,fps:u,canStepBack:l,recordingBytes:p,recordingRawBytes:f}}function Ji(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}function hn(e,r,t,n,i){let o=ue(r.cols,t),s=e[i*o+(n>>t.wordShift)]??0;return Ji(s,t,n&t.cellIndexMask)}function Sn(e,r,t,n,i,o){let s=ue(r.cols,t),a=i*s+(n>>t.wordShift),u=(n&t.cellIndexMask)<<t.cellShift,l=~(t.cellMask<<u),p=e[a]??0;e[a]=(p&l|(o&t.cellMask)<<u)>>>0}var eo=64*1024*1024,cs=256*1024*1024;function Cr(e,r,t,n){let i=e,o;if(t.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(Q(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let s=0;s<r.rows;s++)for(let a=0;a<r.cols;a++)Sn(o,r,n,a,s,hn(i,r,t,a,s))}return o}function yn(e,r,t){let n=Math.floor((r-1)/2),i=e-n,o=i+r,s=[];if(i>=0&&o<=t)s.push({destinationStart:i,localStart:0,span:r});else if(i<0){let a=-i;s.push({destinationStart:t-a,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:r-a})}else{let a=t-i;s.push({destinationStart:i,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:o-t})}return s.filter(a=>a.span>0)}function Tn(e){return`
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
`}function Cn(e,r,t,n){let i=yn(e,t,n.cols),o=yn(r,t,n.rows),s=[];for(let a of o)for(let u of i)s.push({destinationStartX:u.destinationStart,destinationStartY:a.destinationStart,localStartX:u.localStart,localStartY:a.localStart,spanCols:u.span,spanRows:a.span});return s}var Mn={"=":"==","\u2260":"!=",">":">","<":"<","\u2265":">=","\u2264":"<="};function ro(e){let r;return typeof e=="string"?r=vn([e]):r=k(e),r}function vn(e){return{kind:"tribes",tribes:[...e&&e.length>0?e:[M]]}}function k(e,r){let t=e??vn(r),n;switch(t.kind){case"tribes":n={...t,tribes:[...t.tribes]};break;case"tiedMajority":n={...t,source:k(t.source)};break;default:n={...t};break}return n}function De(e,r){return{kind:"count",selector:k(e?.selector,r)}}function Mr(e){return JSON.stringify(J(e))}function J(e){let r;switch(e.kind){case"tribes":r={...e,tribes:[...new Set(e.tribes)].sort()};break;case"tiedMajority":r={...e,source:J(e.source)};break;default:r=e;break}return r}function Rn(e){return e.become??{kind:"fixed",tribe:e.tribe??M}}function Le(e){let r;switch(e.kind){case"majority":case"minority":r={...e,selector:k(e.selector),tie:e.tie?Le(e.tie):void 0,fallback:e.fallback?Le(e.fallback):void 0};break;case"combine":r={kind:"combine",strategy:{...e.strategy,entries:e.strategy.entries.map(t=>({...t,inputs:t.inputs.map(n=>ro(n)).sort((n,i)=>Mr(n).localeCompare(Mr(i)))})),default:e.strategy.default?Le(e.strategy.default):void 0}};break;default:r={...e};break}return r}function to(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function no(e,r){e.push(`const CELLS_PER_WORD: u32 = ${r.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${r.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${r.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${r.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${r.cellMask}u;`)}function io(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function oo(e,r,t){r.remapped?(e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;")):(e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;"))}function ao(e){let r=To(e),t=new Map,n=0;for(let i of r)t.set(i,`count_${n++}`);return t}function so(e,r){let t=Co(e),n=new Map,i=0;for(let o of t){let s=r.get(o);s?n.set(o,s):n.set(o,`eq_count_${i++}`)}return n}function uo(e,r,t,n){for(let[i,o]of r)e.push(`  let ${o} = ${ft(kn(i),t,n)};`);r.size>0&&e.push("")}function co(e,r,t,n,i){let o=0;for(let[s,a]of t)r.has(s)||(e.push(`  let ${a} = ${ft(kn(s),n,i)};`),o++);o>0&&e.push("")}function lo(e,r,t,n,i,o){for(let s=0;s<r.length;s++){let a=r[s],u=Ue(a.clause,t,n,i,o);e.push(s===0?`  if (${u}) {`:`  } else if (${u}) {`),dt(e,Le(Rn(a)),i,o,`rule_${s}`,"    ")}r.length>0&&e.push("  }"),e.push("")}function dt(e,r,t,n,i,o,s=null){switch(r.kind){case"fixed":e.push(`${o}result = ${N(r.tribe,n)}u;`);break;case"same":e.push(`${o}result = selfTribe;`);break;case"majority":case"minority":fo(e,r,t,n,i,o);break;case"combine":po(e,r,t,n,i,o,s);break}}function fo(e,r,t,n,i,o){let s=k(r.selector),a=`${i}_${r.kind}`,u=`${i}_${r.kind}_count`,l=`${i}_${r.kind}_ties`,p=r.kind==="majority"?"0u":"9u",f=r.kind==="majority"?`candidateCount > ${u}`:`candidateCount < ${u}`;e.push(`${o}var ${a}: u32 = ${N(M,n)}u;`),e.push(`${o}var ${u}: u32 = ${p};`),e.push(`${o}var ${l}: u32 = 0u;`);for(let m of _r(s,t,n)){let D=X(U=>`${U} == ${m}u`),S=Te(s,m,n);e.push(`${o}{`),e.push(`${o}  let candidateCount = ${D};`),e.push(`${o}  if (${S} && candidateCount > 0u) {`),e.push(`${o}    if (${f}) {`),e.push(`${o}      ${a} = ${m}u;`),e.push(`${o}      ${u} = candidateCount;`),e.push(`${o}      ${l} = 1u;`),e.push(`${o}    } else if (candidateCount == ${u}) {`),e.push(`${o}      ${l} = ${l} + 1u;`),e.push(`${o}    }`),e.push(`${o}  }`),e.push(`${o}}`)}e.push(`${o}if (${l} == 1u) {`),e.push(`${o}  result = ${a};`),e.push(`${o}} else if (${l} > 1u) {`),r.tie?dt(e,r.tie,t,n,`${i}_tie`,`${o}  `,{selector:s,bestCountVar:u,tieCountVar:l}):vr(e,r.fallback,t,n,`${i}_tie_fallback`,`${o}  `),e.push(`${o}} else {`),vr(e,r.fallback,t,n,`${i}_fallback`,`${o}  `),e.push(`${o}}`)}function vr(e,r,t,n,i,o){r?dt(e,r,t,n,i,o):e.push(`${o}result = ${N(M,n)}u;`)}function po(e,r,t,n,i,o,s){let a=`${i}_input_mask`;e.push(`${o}var ${a}: u32 = 0u;`);for(let f of ho(t,n,s)){let m=Bn(f,n,s);e.push(`${o}if (${m}) {`),e.push(`${o}  ${a} = ${a} | ${Pn(f)};`),e.push(`${o}}`)}let u=`${i}_dead_present`,l=X(f=>`${f} == ${N(M,n)}u`);e.push(`${o}let ${u} = ${l} > 0u;`);let p=[...r.strategy.entries].sort((f,m)=>Number(lt(m,n))-Number(lt(f,n)));p.forEach((f,m)=>{let D=So(f.inputs,t,n,s),S=lt(f,n)?` && ${u}`:"",U=`${a} == (${D})${S}`;e.push(m===0?`${o}if (${U}) {`:`${o}} else if (${U}) {`),e.push(`${o}  result = ${N(f.output,n)}u;`)}),p.length>0?(e.push(`${o}} else {`),vr(e,r.strategy.default,t,n,`${i}_fallback`,`${o}  `),e.push(`${o}}`)):vr(e,r.strategy.default,t,n,`${i}_fallback`,o)}function mo(e){for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(`    let ${xn(t,r)} = readCell(${_n("x",t,"COLS")}, ${_n("y",r,"ROWS")});`)}function ft(e,r,t){let n=J(e),i;switch(n.kind){case"same":i=X(o=>`${o} == selfTribe`);break;case"different":i=X(o=>`${o} != selfTribe`);break;case"tiedMajority":i=ft(n.source,r,t);break;case"tribes":{let o=Oe(n.tribes,t);i=o.length===0?"0u":X(s=>o.map(a=>`${s} == ${a}u`).join(" || "));break}}return i}function X(e){return bo().map(r=>`select(0u, 1u, ${e(r)})`).join(" + ")}function xn(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function bo(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(xn(t,r));return e}function _n(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function Oe(e,r){let t=[];for(let n of e)t.push(Rr(n,r,"selector"));return[...new Set(t)]}function N(e,r){return Rr(e,r,"target")}function Rr(e,r,t){let n=r.get(e),i=r.get(M)??0;return n===void 0&&console.error(`Unknown rule ${t} tribe; using dead tribe instead.`,{tribe:e}),n??i}function _r(e,r,t){let n=J(e),i;switch(n.kind){case"tribes":i=Oe(n.tribes,t);break;case"tiedMajority":i=_r(n.source,r,t);break;default:i=r.map(o=>Rr(o.id,t,"selector"));break}return[...new Set(i)].sort((o,s)=>o-s)}function Te(e,r,t){let n=J(e),i;switch(n.kind){case"same":i=`selfTribe == ${r}u`;break;case"different":i=`selfTribe != ${r}u`;break;case"tiedMajority":i=Te(n.source,r,t);break;case"tribes":{i=Oe(n.tribes,t).includes(r)?"true":"false";break}}return i}function go(e,r,t,n){let i=J(e),o;if(i.kind==="tiedMajority"&&n){let s=X(u=>`${u} == ${r}u`),a=Te(n.selector,r,t);o=`(${n.tieCountVar} > 1u && ${n.bestCountVar} > 0u && ${a} && ${s} == ${n.bestCountVar})`}else{let s=X(u=>`${u} == ${r}u`);o=`(${Te(i.kind==="tiedMajority"?i.source:i,r,t)} && ${s} > 0u)`}return o}function ho(e,r,t){let n;return t?n=_r(t.selector,e,r):n=e.map(i=>Rr(i.id,r,"selector")),[...new Set(n)].filter(i=>i!==N(M,r)).sort((i,o)=>i-o)}function Bn(e,r,t){let n;if(t){let i=X(s=>`${s} == ${e}u`),o=Te(t.selector,e,r);n=`(${e}u != ${N(M,r)}u && ${t.tieCountVar} > 1u && ${t.bestCountVar} > 0u && ${o} && ${i} == ${t.bestCountVar})`}else{let i=X(o=>`${o} == ${e}u`);n=`(${e}u != ${N(M,r)}u && ${i} > 0u)`}return n}function So(e,r,t,n){let i=[];for(let o of e){let s=k(o);for(let a of _r(s,r,t))if(a!==N(M,t)){let u=yo(s,a,t,n);i.push(`select(0u, ${Pn(a)}, ${u})`)}}return i.length>0?i.join(" | "):"0u"}function lt(e,r){let t=N(M,r);return e.inputs.some(n=>{let i=k(n);return i.kind==="tribes"&&Oe(i.tribes,r).includes(t)})}function yo(e,r,t,n){let i=J(e),o;if(n){let s=Bn(r,t,n),a=Te(i.kind==="tiedMajority"?i.source:i,r,t);o=`(${s} && ${a})`}else o=go(i,r,t,null);return o}function Pn(e){return`(1u << ${e}u)`}function En(e){return Mr(e)}function kn(e){return JSON.parse(e)}function wn(e,r){let t=new Set,n=o=>{t.add(En(o))},i=o=>{switch(r(o,n),o.kind){case hr:i(o.clause);break;case Sr:case yr:case Tr:for(let s of o.clauses)i(s);break}};for(let o of e)i(o);return t}function To(e){return wn(e,(r,t)=>{switch(r.kind){case pr:case mr:case br:case gr:case fr:t(k(r.selector,r.tribes));break}})}function Co(e){return wn(e,(r,t)=>{r.kind===dr&&(t(De(r.left,r.tribe1).selector),t(De(r.right,r.tribe2).selector))})}function Ue(e,r,t,n,i){switch(e.kind){case ut:return"false";case nn:return Mo(e.tribes,n,i);case fr:return Fe(ce(k(e.selector,e.tribes),r),e.interval[0],e.interval[1]);case pr:return Fe(ce(k(e.selector,e.tribes),r),0,0);case mr:return Fe(ce(k(e.selector,e.tribes),r),e.value,e.value);case br:return Fe(ce(k(e.selector,e.tribes),r),e.value,8);case gr:return Fe(ce(k(e.selector,e.tribes),r),0,e.value);case dr:return vo(e,t);case hr:return`!(${Ue(e.clause,r,t,n,i)})`;case Sr:return`(${e.clauses.map(o=>Ue(o,r,t,n,i)).join(" && ")})`;case yr:return`(${e.clauses.map(o=>Ue(o,r,t,n,i)).join(" || ")})`;case Tr:return Ro(e.clauses,r,t,n,i);default:return"false"}}function Mo(e,r,t){let n=Oe(e,t);return n.length===0?"false":n.length===r.length?"true":`(${n.map(i=>`selfTribe == ${i}u`).join(" || ")})`}function Fe(e,r,t){return`(${e} >= ${r}u && ${e} <= ${t}u)`}function vo(e,r){let t=De(e.left,e.tribe1).selector,n=De(e.right,e.tribe2).selector,i=Mn[e.operator]??"==",o=Math.max(-8,Math.min(8,e.margin??0));return`(i32(${ce(t,r)}) ${i} (i32(${ce(n,r)}) + ${o}i))`}function Ro(e,r,t,n,i){return`(((${e.map(o=>Ue(o,r,t,n,i)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`}function ce(e,r){return r.get(En(e))}function pt(e,r,t){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,i=Math.min(n,t),o=Math.ceil(n/i);if(o<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:i,dispatchWgY:o,remapped:!0};throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`)}function An(e,r,t,n,i,o,s){let a=[],u=e.rules.filter(m=>!m.muted),l=s.get(M)??0,p=ao(u.map(m=>m.clause)),f=so(u.map(m=>m.clause),p);return a.push("// Auto-generated simulation compute shader."),a.push(`// Tribes: ${r.map(m=>m.id).join(", ")}`),a.push(`// Rules: ${e.rules.length}`),a.push(""),a.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),a.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),a.push(""),a.push(`const COLS: u32 = ${n.cols}u;`),a.push(`const ROWS: u32 = ${n.rows}u;`),a.push(`const PACKED_COLS: u32 = ${t}u;`),to(a,i),no(a,o),a.push(""),io(a,"gridIn","PACKED_COLS"),a.push(""),a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {"),uo(a,p,r,s),co(a,p,f,r,s),a.push(`  var result: u32 = ${l}u;`),a.push(""),lo(a,u,p,f,r,s),a.push("  return result;"),a.push("}"),a.push(""),a.push("@compute @workgroup_size(16, 16)"),i.remapped?a.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):a.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),oo(a,i,"px"),a.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),a.push(""),a.push("  let baseX = px << WORD_SHIFT;"),a.push("  var packed: u32 = 0u;"),a.push(""),a.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),a.push("    let x = baseX + i;"),a.push("    if (x >= COLS) { break; }"),a.push(""),a.push("    let selfTribe = readCell(x, y);"),mo(a),a.push(""),a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),a.push("  }"),a.push(""),a.push("  gridOut[y * PACKED_COLS + px] = packed;"),a.push("}"),a.join(`
`)}var Ce=3,$e="gol-recording",Me="raw-packed",mt="deflate-raw",bt=12,gt=256*1024*1024,In=512*1024*1024,ht=128*1024*1024*1024;function St(e,r,t=0){let n=t;for(let i of e)n+=i[r];return n}function Gn(e,r){return Math.min(e,r)}function yt(e){return Math.min(e,1073741824)}function Ln(e){return Math.min(e,In)}function Tt(e,r){return Math.max(e*2,r*6)}function xr(e,r){return e>0&&e<=r}function Bo(e,r){return e>0?e*2+r:0}function Po(e,r){return e>=1&&r>0?e*r*(1+Ce):0}function Eo(e,r){return e<gt?Math.min(gt,r):e}function Dn(e,r){return xr(e,r)?Math.max(1,Math.floor(Eo(e,r)/e)):0}function Br(e,r){return e>=1&&r>0?Math.max(1,Math.min(bt,Math.floor(536870912/(e*r)))):bt}function Fn(e,r,t,n,i,o){let s=!r.some(u=>u)&&(i||o>=e),a=i?Math.floor(n/2)+1:n;return e>=1&&r.length>0&&(s||t>=a)}function Un(e,r,t,n){return e<r&&n.some((i,o)=>t[o]&&i.mapState==="unmapped")}function On(e,r,t,n,i,o){return e&&r>=1&&t!==null&&n.length>0&&(i<r||o)}function $n(e,r,t,n,i){let o=Math.min(e.quota??ht/128,ht),s=e.usage??0,a=0,u=0;for(let f of r)f.codec===Me?a+=f.storedBytes:u+=f.storedBytes;let l=t*n,p=i?(1+Ce)*l:0;return{quotaBytes:o,usedBytes:s,pendingRawBytes:a,compressedBytes:u,gpuBufferMarginBytes:p}}function Nn(e,r,t,n,i){let o=yt(e);return{maxBytes:e,vramBudgetBytes:Tt(e,o),frameByteSize:r,recordingAvailable:xr(r,o),vramSimulationBytes:Bo(r,n),vramRecordingBytes:Po(t,r),gridFormat:i}}function Pr(e,r,t){r.length>0&&(e.generationStart=r[0].generationStart,e.generationEnd=r[r.length-1].generationEnd),t.length>0&&(r.length===0&&(e.generationStart=t[0]),e.generationEnd=t[t.length-1]),e.chunks=[...r]}function Wn(e){return e.map(r=>({...r,generations:[...r.generations]}))}function zn(e,r){return e!==r}function Er(e,r=0){return St(e,"blockCount",r)}function Kn(e){return St(e,"storedBytes")}function Xn(e){return St(e,"uncompressedBytes")}var ko=256,Ne=80,Yn=ko*Uint32Array.BYTES_PER_ELEMENT;function qn(e){let r=new ArrayBuffer(Ne),t=new Float32Array(r),n=new Int32Array(r),i=new Uint32Array(r),o=(e.offsetX%e.grid.cols+e.grid.cols)%e.grid.cols,s=(e.offsetY%e.grid.rows+e.grid.rows)%e.grid.rows,a=Math.floor(o),u=Math.floor(s);return t[0]=e.canvasWidth,t[1]=e.canvasHeight,t[2]=e.scale,t[4]=o-a,t[5]=s-u,i[6]=e.grid.cols,i[7]=e.grid.rows,i[8]=a,i[9]=u,i[10]=e.tribeCount,n[12]=e.brushPreview.centerX,n[13]=e.brushPreview.centerY,i[14]=e.brushPreview.brushSize,i[15]=e.brushPreview.shape,i[16]=e.brushPreview.visible?1:0,r}function Hn(e){let r=new Uint32Array(e.length);for(let t=0;t<e.length;t++){let n=e[t].color,i=parseInt(n.substring(0,2),16),o=parseInt(n.substring(2,4),16),s=parseInt(n.substring(4,6),16);r[t]=i|o<<8|s<<16}return r}function jn(e,r){return e.replace("__CELLS_PER_WORD__",`${r.cellsPerWord}u`).replace("__WORD_SHIFT__",`${r.wordShift}u`).replace("__CELL_SHIFT__",`${r.cellShift}u`).replace("__CELL_INDEX_MASK__",`${r.cellIndexMask}u`).replace("__CELL_MASK__",`${r.cellMask}u`)}var wo=32,Ao=2,Io=.5,Vn=.2,Zn=1,Go=1048576;function Qn(e){return Math.min(3,Math.max(0,Math.ceil(Math.log10(e.cols*e.rows/1e5))))}function We(e){return 1024/4**Qn(e)}function kr(e){return 16/2**Qn(e)}function Lo(e){return Math.max(Zn,Math.round(We(e)*kr(e)))}function Jn(e){return{generationsPerDrain:Lo(e),targetDrainMs:wo,smoothedDrainMs:0,lastDrainStartedAt:0,lastSubmittedGenerations:0}}function ei(e,r){if(r>0&&e.lastSubmittedGenerations>0){let t=e.smoothedDrainMs===0?r:e.smoothedDrainMs*(1-Vn)+r*Vn,n=Math.min(Ao,Math.max(Io,e.targetDrainMs/t));e.smoothedDrainMs=t,e.generationsPerDrain=Math.max(Zn,Math.min(Go,Math.round(e.generationsPerDrain*n)))}}function Ct(e,r){return e==="recording"?Number.MAX_SAFE_INTEGER:We(r)*kr(r)}function Mt(e,r,t,n,i){let o=e-r*n;return t>n||t>i?Math.min(o,r):o}function ri(e){return e<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/e}}function Y(e){return e.request.stopCondition.kind==="targetGeneration"}function ve(e,r){return e.request.stopCondition.kind==="targetGeneration"&&r>=e.request.stopCondition.generation}function ze(e,r){return e.request.stopCondition.kind==="targetGeneration"?Math.max(0,e.request.stopCondition.generation-r):Number.POSITIVE_INFINITY}function ti(e,r){return r.restore!==!1&&e.request.restoreAfterStop||null}function ni(e,r,t){return r&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")}function ii(e,r,t,n,i){return e.restartRestoredRun!==!1&&r&&t&&!n&&!i}function oi(e,r,t,n){let i=r+t,o=Math.min(n,i-1);if(o<=0)return null;let s=i-1-o;if(s>=r)return{source:"buffered",frameInChunk:s-r};let a=0;for(let u=0;u<e.length;u++){let l=e[u];if(s<a+l.blockCount)return{source:"sealed",sealedIndex:u,frameInChunk:s-a};a+=l.blockCount}return null}function ai(e,r){return{chunkFrameIndex:r.frameInChunk+1,generation:e[r.frameInChunk]}}function si(e,r,t,n,i,o){let s=(r+1)*t;if(i.bitsPerCell===o.bitsPerCell)return{sameFormat:!0,chunkPrefix:new Uint8Array(e,0,s),activeFrame:null};let a=Q(n,i),u=new Uint8Array(s);for(let l=0;l<=r;l++){let p=new Uint8Array(e,l*a,a),f=Cr(tn(p),n,i,o);u.set(new Uint8Array(f.buffer,f.byteOffset,f.byteLength),l*t)}return{sameFormat:!1,chunkPrefix:u,activeFrame:u.subarray(r*t,s)}}var c,A=!1,$r,wr,pe,Hr,_=0,x=0,jr=0,B=ur,Be=[],Pe=new Map,Nr,xt,G,L,Ee,Re,Ve,Bt,Pt,Ye,Ot,$t,w=!1,di=1,fi=0,pi=0,P=!1,I=!1,ne=100,b=0,me=0,Ke=0,Vr=0,Ar,Do=4,Nt=192,fe=[],Wr=[],zr=[],Fo=0,Ir=null,mi={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},ie=null,Gr=-1,_e=!1,qe=!1,vt=0,Ze=lr,Lr=[],R=!1,z=!1,ee={chunks:[],generationStart:0,generationEnd:0,gridFormat:Ie(ur)},bi=0,C=[],Qe=!1,g=null,gi=0,Dr=!1,F=null,h=0,v=[],be=null,T=64,y=0,oe=[],W=[],He=null,le=null,K=0,Je=0,de=0,q=!1,Xe=0,Fr=0,Ur=0,je=[];function Uo(e){switch(!0){case e instanceof Error:return e.message;case typeof e=="string":return e;case(e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"):return e.message;default:return String(e??"Unknown worker error")}}function hi(e){console.error("[GOLT worker] Worker GPU error:",e),E("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),P=!1,self.postMessage({type:"gpuError",reason:Uo(e)})}self.addEventListener("error",e=>{e.preventDefault(),hi(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),hi(e.reason)});async function Wt(){await c.queue.onSubmittedWorkDone()}function ui(e){Fr=0,Ur=2+(e?1+Ce:0),je=[]}async function Kr(){if(je.length>0){let e=c.createCommandEncoder({label:d.trackedAllocationClearEncoder});for(let r of je)e.clearBuffer(r);c.queue.submit([e.finish()]),await Wt(),je=[]}}async function Xr(e,r){I&&Ur>0&&(Fr+=e,Ur--,je.push(r),Fr>=Ln(ge())&&Ur>0&&(await Kr(),Fr=0))}function Yr(){F?.destroy(),F=null;for(let e of oe)e?.destroy();oe=[],W=[],T=0,h=0,v=[],be=null,Je=0}function ci(){G?.destroy(),L?.destroy(),pn(ie),ie=null,fe.forEach(e=>e.destroy()),fe=[],Wr=[],zr=[],Yr()}function Rt(e){let r=K>0;K+=e;let t=K>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function xe(){let e=Fn(T,W,de,Br(T,y),q,h);e!==q&&(q=e,self.postMessage({type:"backpressure",active:e}))}async function we(){self.postMessage({type:"storageQuota",...$n(await navigator.storage.estimate(),C,T,y,R)})}function ge(){return Gn(c.limits.maxBufferSize,c.limits.maxStorageBufferBindingSize)}function rr(){return yt(ge())}function re(){return xr(y,rr())}function Si(){return Un(de,Br(T,y),W,oe)}function er(){return On(re(),T,F,oe,h,Si())}async function Oo(e){let r=new DecompressionStream(mt),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],i=r.readable.getReader();for(;;){let{done:u,value:l}=await i.read();if(u)break;n.push(l)}let o=0;for(let u of n)o+=u.byteLength;let s=new Uint8Array(o),a=0;for(let u of n)s.set(u,a),a+=u.byteLength;return s.buffer}function j(){return{cols:_,rows:x}}function $o(){return pt(Math.ceil(jr/16),Math.ceil(x/16),c.limits.maxComputeWorkgroupsPerDimension)}function No(){return pt(Math.ceil(_/16),Math.ceil(x/16),c.limits.maxComputeWorkgroupsPerDimension)}function Et(){Ee?.destroy(),Ee=c.createBuffer({label:d.uniformBuffer,size:Ne,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Wo(){let e=qn({canvasWidth:pe.width,canvasHeight:pe.height,scale:di,offsetX:fi,offsetY:pi,grid:j(),tribeCount:Be.length,brushPreview:mi});c.queue.writeBuffer(Ee,0,e)}function Zr(){return Q({cols:_,rows:x},B)}function ae(){return Ie(B)}async function kt(){let e=Zr();G=c.createBuffer({label:d.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Xr(e,G),L=c.createBuffer({label:d.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Xr(e,L);let r=c.createCommandEncoder({label:d.gridClearEncoder});r.clearBuffer(G),r.clearBuffer(L),c.queue.submit([r.finish()]),w=!1}function wt(){let e=Hn(Be);Re&&Re.destroy(),Re=c.createBuffer({label:d.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),c.queue.writeBuffer(Re,0,e)}function At(){let e=c.createShaderModule({label:d.renderShaderModule,code:jn(Qt,B)});Ve=c.createRenderPipeline({label:d.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:wr}]},primitive:{topology:"triangle-list"}})}function It(){Bt=c.createBindGroup({layout:Ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ee}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:Re}}]}),Pt=c.createBindGroup({layout:Ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ee}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:Re}}]})}function Gt(){Nr=$o();let e=An(Hr,Be,jr,j(),Nr,B,Pe),r=c.createShaderModule({label:d.simulationShaderModule,code:e});Ye=c.createComputePipeline({label:d.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),Ot=c.createBindGroup({layout:Ye.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:L}}]}),$t=c.createBindGroup({layout:Ye.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:G}}]})}function Lt(){xt=No(),ie=fn({device:c,cols:_,rows:x,gridFormat:B,dispatchPlan:xt})}function Dt(){let e=c.createShaderModule({label:d.brushShaderModule,code:Tn(B)});Ar=c.createComputePipeline({label:d.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),fe.forEach(r=>r.destroy()),fe=[],Wr=[],zr=[];for(let r=0;r<Do;r++){let t=c.createBuffer({label:`${d.brushUniformBuffer} ${r}`,size:Nt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});fe.push(t),Wr.push(c.createBindGroup({layout:Ar.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:t}}]})),zr.push(c.createBindGroup({layout:Ar.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:t}}]}))}}function zo(e,r,t,n,i,o,s){let a=Pe.get(M)??0,u=Fo++,l=Cn(r,t,n,j()),p=w?zr:Wr;for(let[f,m]of l.entries()){let D=new ArrayBuffer(Nt),S=new Uint32Array(D);S[0]=jr,S[1]=n,S[2]=i,S[3]=o,S[4]=a,S[5]=u,S[6]=s.length,S[7]=m.destinationStartX,S[8]=m.destinationStartY,S[9]=m.localStartX,S[10]=m.localStartY,S[11]=m.spanCols,S[12]=m.spanRows,S[13]=0;for(let O=0;O<s.length&&O<32;O++)S[14+O]=s[O];let U=fe[f],se=p[f];if(U&&se){c.queue.writeBuffer(U,0,D);let O=Math.floor(m.destinationStartX/B.cellsPerWord),Di=Math.ceil((m.destinationStartX+m.spanCols)/B.cellsPerWord)-O,Fi=Math.ceil(Di/8),Ui=Math.ceil(m.spanRows/8),sr=e.beginComputePass({label:d.brushPass});sr.setPipeline(Ar),sr.setBindGroup(0,se),sr.dispatchWorkgroups(Fi,Ui),sr.end()}else throw console.error("[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.",{index:f,rectCount:l.length,bindGroupCount:p.length,uniformBufferCount:fe.length}),new Error("Brush dispatch resources are out of sync with the wrapped brush rectangles.")}}function Ko(){let e=w?L:G,r=Zr(),t;try{t=c.createBuffer({label:d.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=c.createCommandEncoder({label:d.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),c.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),i})}function yi(){y=Zr(),T=Dn(y,rr())}function Ft(){self.postMessage({type:"limits",...Nn(ge(),y,T,Ne+Yn+Nt+Se*2+ye*2,ae())})}function tr(e){if(T>=1&&F!==null&&h<T){let r=w?L:G,t=h*y,n=c.createCommandEncoder({label:d.recordingFrameCopyEncoder});n.copyBufferToBuffer(r,0,F,t,y),c.queue.submit([n.finish()]),v.push(e),be=e,h++,Or()}}function _t(e){Je=Math.max(0,Je+e)}function Or(){T>0&&h>=T&&Si()&&nr()}function nr(){let e=F;if(e!==null&&h>0&&oe.length>0&&de<Br(T,y)){let r=W.indexOf(!0);if(r>=0){W[r]=!1;let t=oe[r];if(t.mapState==="unmapped"){let n=h*y,i=bi++,o=[...v],s=o[0],a=o[o.length-1],u=`chunk-${String(i).padStart(6,"0")}.bin`,l=h,p=c.createCommandEncoder({label:d.recordingSealCopyEncoder});p.copyBufferToBuffer(e,0,t,0,n),c.queue.submit([p.finish()]);let f={chunkId:i,generationStart:s,generationEnd:a,blockCount:l,codec:Me,uncompressedBytes:n,storedBytes:n,gridFormat:ae(),generations:o,filename:u};Rt(1),_t(l),de++,xe();let m=Xe;t.mapAsync(GPUMapMode.READ).then(async()=>{let D=t.getMappedRange(),S=new ArrayBuffer(n);new Uint8Array(S).set(new Uint8Array(D,0,n)),t.unmap(),m===Xe&&(W[r]=!0,C.push(f),_t(-l),Pr(ee,C,v),xe(),Or(),Xo(f,S).then(()=>{m===Xe&&(de--,xe(),Rt(-1),we(),qr(),V(!0),Or(),self.postMessage({type:"chunkSealed",filename:f.filename,rawBytes:n,blockCount:f.blockCount,cols:_,rows:x,rawGridFormat:f.gridFormat,storageGridFormat:Ie(cr(Hr.tribes.length))}),Qe&&K===0&&(Qe=!1,qr()))}))}).catch(()=>{m===Xe&&(W[r]=!0,de--,_t(-l),xe(),Rt(-1),Or())}),h=0,v=[]}else W[r]=!0}}}async function Ti(e){Xe++,bi=0,h=0,v=[],C=[],be=null,Je=0,de=0,K>0&&(K=0,self.postMessage({type:"chunksSaving",active:!1})),q&&(q=!1,self.postMessage({type:"backpressure",active:!1})),Qe=!1,z=R,ee={chunks:[],generationStart:e,generationEnd:e,gridFormat:ae()},await Ci(),we()}async function zt(){return le&&await le,He||(He=await(await navigator.storage.getDirectory()).getDirectoryHandle($e,{create:!0})),He}async function Xo(e,r){let i=await(await(await zt()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(r),await i.close()}async function Yo(e){let r=await zt();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function Ci(){if(le)await le;else{le=(async()=>{let e=await navigator.storage.getDirectory();He=null;try{await e.removeEntry($e,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${$e}:`,r)}He=await e.getDirectoryHandle($e,{create:!0})})();try{await le}finally{le=null}}}function qr(){Pr(ee,C,v),self.postMessage({type:"recording",manifest:{chunks:Wn(C),generationStart:ee.generationStart,generationEnd:ee.generationEnd,gridFormat:ae()},cols:_,rows:x})}function ir(e=!1){if(R){let r=!z;e&&z&&er()&&(z=!1,r=!0),r&&zn(be,b)&&er()&&(h>=T&&nr(),tr(b))}}function Kt(){if(Ir){let e=Ir;Ir=null;let r=R&&h>0&&v[h-1]===b;r&&(h--,v.pop());let t=c.createCommandEncoder({label:d.brushEncoder});zo(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),c.queue.submit([t.finish()]),r&&tr(b)}}async function qo(e,r=Me){let o=await(await(await(await zt()).getFileHandle(e)).getFile()).arrayBuffer();return r===mt?Oo(o):o}function Mi(){return sn(_,x,Ze.enabled,Ze.sections)}function Ho(){return un(Mi())}function vi(e){Lr=Ho(),ie&&Lr.length>0&&mn({device:c,encoder:e,resources:ie,sourceBuffer:w?L:G,dispatchPlan:xt,enabledSections:Lr})}function Ri(){let e=b;if(ie&&e!==Gr&&!_e){let r=[...Lr],t=Mi();Gr=e,_e=!0,bn({resources:ie,enabledSections:r}).then(n=>{let i=Pe.get(M)??0,o=Er(C,h+Je),s=gn({generation:e,tribes:Be,deadTribeIndex:i,readback:n,enabledSections:r,availability:t,liveMetricSettings:Ze.sections,cols:_,rows:x,totalFrames:o,fps:Vr,canStepBack:o>1,recordingBytes:Kn(C),recordingRawBytes:Xn(C)});if(_e=!1,self.postMessage(s),qe)if(qe=!1,Gr=-1,xi()){let a=c.createCommandEncoder({label:d.interactiveMetricsEncoder});vi(a),c.queue.submit([a.finish()]),Ri()}else qe=!0}).catch(()=>{_e=!1})}}function jo(e){if(e>0){let r=Nr,t=c.createCommandEncoder({label:d.simulationBatchEncoder});for(let n=0;n<e;n++){let i=t.beginComputePass({label:d.simulationStepPass});i.setPipeline(Ye),i.setBindGroup(0,w?$t:Ot),i.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),i.end(),w=!w,b++}c.queue.submit([t.finish()]),me+=e}}function Vo(){self.postMessage({type:"generation",generation:b,fps:Vr})}function Xt(){let e=c.createCommandEncoder({label:d.simulationSingleStepEncoder}),r=e.beginComputePass({label:d.simulationStepPass});r.setPipeline(Ye),r.setBindGroup(0,w?$t:Ot);let t=Nr;r.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),r.end(),c.queue.submit([e.finish()]),w=!w,b++}function H(){if(c&&$r&&Ee&&Ve&&Bt&&Pt&&!I&&!A){Wo();let e=$r.getCurrentTexture().createView(),r=c.createCommandEncoder({label:d.renderEncoder}),t=r.beginRenderPass({label:d.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(Ve),t.setBindGroup(0,w?Pt:Bt),t.draw(3),t.end(),c.queue.submit([r.finish()])}}function _i(e){Ke===0&&(Ke=e);let r=e-Ke;r>=1e3&&(Vr=me/(r/1e3),me=0,Ke=e)}function Yt(){me=0,Ke=0,Vr=0}function qt(){return R&&re()?"recording":"nonRecording"}function xi(){return!!(c&&ie&&!I&&!A)}function V(e=!1){if(e&&(Gr=-1),!xi())qe=!0;else if(_e)qe=!0;else{let r=c.createCommandEncoder({label:d.interactiveMetricsEncoder});vi(r),c.queue.submit([r.finish()]),Ri()}}function Bi(){V(!0),H()}function Qr(e,r){r&&(e-vt>=1e3||vt===0)&&!_e&&(vt=e,V())}function or(e,r){(e.request.pacing.kind==="max"||Y(e))&&r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,Vo())}function ke(e){q!==e&&(q=e,self.postMessage({type:"backpressure",active:e}))}function Ht(){let e=er();return e&&h>=T&&(nr(),e=er()),e}function ar(){!I&&!A&&!g&&self.requestAnimationFrame(Ut)}function Zo(e,r){let t=e.adaptiveBatch;t&&t.lastDrainStartedAt>0&&(ei(t,r-t.lastDrainStartedAt),t.lastDrainStartedAt=0,t.lastSubmittedGenerations=0)}function Pi(e,r,t){let n=e.adaptiveBatch;n&&r>0&&(n.lastSubmittedGenerations=r,n.lastDrainStartedAt=t)}function Ei(e,r){let t=Math.max(1,Math.round(We(r))),n=0;for(;n<e;){let i=e-n,o=Math.min(t,i);jo(o),n+=o}return n}function he(e){let r=g;if(r&&!r.pumpPending&&!I&&!A){let{token:t}=r;r.pumpPending=!0;let n=()=>{if(g&&g.token===t){let i=performance.now();g.pumpPending=!1,e==="drain"&&Zo(g,i),ia(i)}};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?c.queue.onSubmittedWorkDone().then(n).catch(()=>{g?.token===t&&(g.pumpPending=!1)}):queueMicrotask(n)}}function jt(e,r){g&&E("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1});let t=j(),n=e==="nonRecording"?Jn(t):null;n&&console.info("[GOLT worker] Adaptive non-recording batching started",{cols:t.cols,rows:t.rows,bitsPerCell:B.bitsPerCell,generationsPerDrain:n.generationsPerDrain,targetDrainMs:n.targetDrainMs}),g={kind:e,request:r,token:++gi,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0,adaptiveBatch:n},he(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function te(){P&&jt(qt(),{pacing:ri(ne),stopCondition:{kind:"none"}})}function Qo(e,r){r||e==="cancelled"?ke(!1):q&&xe()}function E(e,r={}){let t=g;if(t){g=null,gi++;let n=Y(t),i=ti(t,r),o=!!i;i&&(P=i.running,ne=i.targetStepDuration),ni(e,n,r)&&self.postMessage({type:"stepping",active:!1}),Qo(e,n),r.render!==!1&&!I&&!A&&Bi(),ii(r,o,P,I,A)?te():ar()}}function ki(e){let r=g;r&&Y(r)&&(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),E("cancelled"))}function Jo(e){E("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),jt(qt(),e)}function wi(e,r,t){ke(!0),or(e,r),Qr(r,t),he("drain")}function ea(e,r){let t=j(),n=e.adaptiveBatch?.generationsPerDrain??Math.round(We(t)*kr(t)),i=Math.min(n,ze(e,b)),o=Ei(i,t),s=o>0;or(e,r),ve(e,b)?E("targetReached"):s?(Pi(e,o,performance.now()),he("drain")):he("raf")}function ra(e,r){ir(!0);let t=!1,n=!1,i=performance.now()+14;for(;ze(e,b)>0&&performance.now()<i;)if(Ht())Xt(),me++,t=!0,tr(b);else{wi(e,r,t),n=!0;break}n||(ke(!1),or(e,r),Qr(r,t),ve(e,b)?E("targetReached"):he("raf"))}function ta(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=e.stepAccumulator,o=Math.floor(e.stepAccumulator/r),s=j(),a=e.adaptiveBatch?.generationsPerDrain??Ct(e.kind,s),u=Math.min(o,ze(e,b),a),l=Ei(u,s),p=l>0;if(e.stepAccumulator=Mt(i,r,o,l,a),or(e,t),ve(e,b))E("targetReached");else{let f=p&&o>l;(!Y(e)&&!f||t-e.lastRenderTime>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,H(),Qr(t,p)),f&&Pi(e,l,performance.now()),he(f?"drain":"raf")}}function na(e,r,t){ir(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=!1,o=0,s=e.stepAccumulator,a=Ct(e.kind,j()),u=Math.floor(e.stepAccumulator/r),l=performance.now()+14,p=!1;for(;e.stepAccumulator>=r&&ze(e,b)>0&&o<a&&performance.now()<l;)if(Ht())Xt(),me++,o++,e.stepAccumulator-=r,i=!0,tr(b);else{wi(e,t,i),p=!0;break}e.stepAccumulator=Mt(s,r,u,o,a),p||(ke(!1),or(e,t),ve(e,b)?E("targetReached"):(Y(e)||(H(),Qr(t,i)),he("raf")))}function ia(e){let r=g;if(r&&!I&&!A)if(_i(e),Y(r)||Kt(),ve(r,b))E("targetReached");else if(r.request.pacing.kind==="max")r.kind==="recording"?ra(r,e):ea(r,e);else{let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?na(r,t,e):ta(r,t,e)}}function Ut(e){I||A?self.requestAnimationFrame(Ut):(_i(e),g||(Kt(),ne>0&&!Dr&&H(),self.requestAnimationFrame(Ut)))}function oa(e,r){let t=c?ge():Number.POSITIVE_INFINITY;return Jt(r.bitsPerCell)&&tt(r.bitsPerCell,e.tribes.length)&&nt(e,Ae(r.bitsPerCell),t)?Ae(r.bitsPerCell):rn(e.tribes.length,e,t)}function Ai(e,r){Hr=e,_=e.cols,x=e.rows,B=oa(e,r),jr=ue(_,B),Be=[...e.tribes],ee.gridFormat=ae(),Pe.clear(),Be.forEach((t,n)=>Pe.set(t.id,n))}async function Ii(e){console.log("[GOLT worker] Initializing WebGPU"),pe=e,c=await on(d.webengineDevice),A=!1,c.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),E("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),A=!0,P=!1,I=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:ge(),vramBudgetBytes:Tt(ge(),rr()),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:ae()});let r=pe.getContext("webgpu");if(r)$r=r,wr=navigator.gpu.getPreferredCanvasFormat(),$r.configure({device:c,format:wr,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:wr,maxBufferSize:c.limits.maxBufferSize,maxStorageBufferBindingSize:c.limits.maxStorageBufferBindingSize});else throw new Error("WebGPU canvas context not available")}async function aa(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Ii(pe),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),E("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),A=!0,P=!1,I=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function Gi(){F=c.createBuffer({label:d.recordingChunkBuffer,size:T*y,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Xr(T*y,F),h=0,v=[],be=null}async function Li(){let e=T*y;oe=[],W=[];for(let r=0;r<Ce;r++){let t=c.createBuffer({label:`${d.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});oe.push(t),W.push(!0),await Xr(e,t)}}async function sa(){await Ci()}async function ua(){console.log("[GOLT worker] Building GPU resources",{cols:_,rows:x,bitsPerCell:B.bitsPerCell,recordingAvailable:re()}),Et(),yi(),await kt(),wt(),At(),It(),Gt(),Dt(),Lt(),await sa(),re()?(await Gi(),await Li()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:y,maxRecordingBufferBytes:rr()}),Yr(),R=!1,z=!1),await Kr(),Ft(),console.log("[GOLT worker] GPU resources ready")}async function ca(){console.log("[GOLT worker] Rebuild started",{cols:_,rows:x,bitsPerCell:B.bitsPerCell}),E("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),I=!0,self.postMessage({type:"rebuilding",active:!0});try{await Wt()}catch{console.warn("[GOLT worker] Queue idle wait rejected during rebuild")}let e=!A;if(A&&(e=await aa()),e){ci(),Et(),yi(),ui(re());try{await kt(),wt(),At(),Gt(),Dt(),It(),Lt(),re()?(await Gi(),await Li()):(Yr(),R=!1,z=!1),await Kr(),Ft()}catch(r){let t=r instanceof Error?r.message:String(r);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{ci(),Et(),ui(!1),await kt(),wt(),At(),Gt(),Dt(),It(),Lt(),R=!1,z=!1,y=Zr(),Yr(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await Kr(),Ft()}catch(n){console.error("[GOLT worker] GPU rebuild recovery failed:",n),e=!1}}}return e&&(I=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:re(),frameByteSize:y})),e}function li(e){Dr=!0,c.queue.onSubmittedWorkDone().then(()=>{Dr=!1,e()}).catch(()=>{Dr=!1})}async function la(){K>0&&await new Promise(e=>{let r=setInterval(()=>{K===0&&(clearInterval(r),e())},10)})}async function da(e){console.log("[GOLT worker] Init message received",{cols:e.ruleset.cols,rows:e.ruleset.rows,recording:e.recording,running:e.running,speed:e.speed}),R=e.recording,Ze=at(e.liveMetrics),z=R,Ai(e.ruleset,e.simulationGridFormat),await Ii(e.canvas),await ua(),V(!0),we(),P=e.running,ne=e.speed<0?0:1e3/e.speed,P?te():ar()}function fa(e){Ze=at(e.liveMetrics),V(!0)}async function pa(e){console.log("[GOLT worker] Ruleset update received",{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length});let r=ge();if(it(e.ruleset.tribes.length,e.ruleset,r))E("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Ai(e.ruleset,e.simulationGridFormat),await ca()&&(b=0,Yt(),await Ti(0),V(!0),P?te():ar());else{let i=`Requested ruleset requires at least ${en(e.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",i,{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length,maxBytes:r}),self.postMessage({type:"gpuError",reason:i})}}function ma(e){P=e.running,e.running?g||te():g&&Y(g)?ki(!1):g?E("manual"):(q&&xe(),Bi(),ar())}function ba(e){let r=ne<=0,t=e.speed<0?0:1e3/e.speed;ne=t,g&&!Y(g)&&P?(E("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&t>0?li(()=>{H(),te()}):te()):P&&!g?te():r&&t>0&&li(()=>{H(),ar()})}function ga(e){di=e.scale,fi=e.offsetX,pi=e.offsetY}function ha(e){pe.width=e.width,pe.height=e.height}function Sa(e){let r=e.tribes.map(t=>Pe.get(t)).filter(t=>t!==void 0);if(r.length>0){let t={square:0,round:1,diamond:2,vline:3,hline:4},n={full:0,spray:1,outline:2};Ir={centerX:e.x,centerY:e.y,brushSize:e.size,shape:t[e.shape]??0,fill:n[e.fill]??0,tribeIds:r}}}function ya(e){let r={square:0,round:1,diamond:2,vline:3,hline:4};mi={centerX:e.x,centerY:e.y,brushSize:e.size,shape:r[e.shape]??0,visible:e.visible},!g&&!I&&!A&&ne<=0&&H()}async function Ta(){try{let e=await Ko();st({type:"snapshot",grid:e,generation:b,cols:_,rows:x,gridFormat:ae()},[e.buffer])}catch{let e=new Uint32Array(0);st({type:"snapshot",grid:e,generation:b,cols:_,rows:x,gridFormat:ae()},[e.buffer])}}async function Ca(e){let r=ot(e.gridFormat),t=j();if(e.grid.byteLength===Q(t,r)){let n=Cr(e.grid,t,r,B);c.queue.writeBuffer(w?L:G,0,n),b=e.generation,Yt(),await Ti(e.generation)}}function Ma(e){let r=g?.request,t=re();e.recording&&t&&!R?(R=!0,z=!0,V(!0),we()):(!e.recording||!t)&&(e.recording&&!t&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:y,maxRecordingBufferBytes:rr()}),R=!1,z=!1),r&&g?Jo(r):!g&&P&&te()}async function va(){Qe||(await Wt(),ir(!1),h>0&&nr(),K>0?Qe=!0:qr())}async function Ra(e){let r=Er(C),t=oi(C,r,h,e.count);if(t){let n=w?L:G;if(t.source==="buffered"){let i=ai(v,t);h=i.chunkFrameIndex,v.length=h,b=i.generation,be=b;let o=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});o.copyBufferToBuffer(F,t.frameInChunk*y,n,0,y),c.queue.submit([o.finish()])}else{K>0&&(await la(),r=Er(C));let i=C[t.sealedIndex],o=await qo(i.filename,i.codec),s=j(),a=ot(i.gridFormat),u=si(o,t.frameInChunk,y,s,a,B);if(c.queue.writeBuffer(F,0,u.chunkPrefix),!u.sameFormat&&u.activeFrame&&c.queue.writeBuffer(n,0,u.activeFrame),h=t.frameInChunk+1,v=i.generations.slice(0,t.frameInChunk+1),b=v[t.frameInChunk],be=b,u.sameFormat){let p=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});p.copyBufferToBuffer(F,t.frameInChunk*y,n,0,y),c.queue.submit([p.finish()])}let l=C.splice(t.sealedIndex);Yo(l.map(p=>p.filename))}Pr(ee,C,v),we(),Yt(),V(!0),H()}}function _a(){Kt(),ir(!0),!R||Ht()?(Xt(),me++,R&&er()&&(h>=T&&nr(),tr(b)),ke(!1)):ke(!0),V(!0),H()}function xa(e){self.postMessage({type:"stepping",active:!0}),ir(!0),jt(qt(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:b+e},restoreAfterStop:{running:P,targetStepDuration:ne}})}function Ba(e){e.count===1?_a():xa(e.count)}function Pa(){ki(g?.request.restoreAfterStop?.running??P)}function Ea(e){let r=C.find(t=>t.filename===e.filename);r&&(r.codec=e.codec,r.storedBytes=e.storedBytes,r.gridFormat=e.gridFormat,ee.chunks=[...C],we(),qr())}function ka(){let e=C.filter(r=>r.codec===Me).map(r=>({filename:r.filename,rawBytes:r.uncompressedBytes,blockCount:r.blockCount,cols:_,rows:x,rawGridFormat:r.gridFormat,storageGridFormat:Ie(cr(Hr.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:e})}async function wa(e){switch(e.type){case"init":await da(e);break;case"setLiveMetrics":fa(e);break;case"setRuleset":await pa(e);break;case"setRunning":ma(e);break;case"setSpeed":ba(e);break;case"camera":ga(e);break;case"resize":ha(e);break;case"draw":Sa(e);break;case"brushPreview":ya(e);break;case"getSnapshot":await Ta();break;case"loadSnapshot":await Ca(e);break;case"setRecording":Ma(e);break;case"getRecording":await va();break;case"stepBack":await Ra(e);break;case"stepForward":Ba(e);break;case"cancelStepping":Pa();break;case"updateChunkCodec":Ea(e);break;case"getUncompressedChunks":ka();break}}self.onmessage=async e=>{await wa(e.data)};
