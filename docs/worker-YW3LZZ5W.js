var Zt="goltTimestampedConsoleInstalled";function Gi(){let e=globalThis;e[Zt]||(e[Zt]=!0,Zr("info"),Zr("warn"),Zr("error"),console.log=console.info.bind(console))}function Zr(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}Gi();var Qt=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var Qr=[1,2,4,8,16,32],Fi={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Di={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Ui={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},sr={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Oi={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},Jr={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},V={1:Fi,2:Di,4:Ui,8:sr,16:Oi,32:Jr};function Jt(e){return Qr.includes(e)}function $i(e){return 2**e}function et(e,r){return r<=$i(e)}function rt(e,r,t){return Z(e,r)<=t}function ur(e){return e<=2?V[1]:e<=4?V[2]:e<=16?V[4]:e<=256?V[8]:e<=65536?V[16]:V[32]}function en(e){return ur(e)}function Ie(e){return V[e]}function rn(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){return tt(e,r,t)??Jr}function tt(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of Qr){let i=Ie(n);if(et(n,e)&&rt(r,i,t))return i}return null}function nt(e){return Ie(e?.bitsPerCell??8)}function Ae(e){return{bitsPerCell:e.bitsPerCell}}function ue(e,r){return Math.ceil(e/r.cellsPerWord)}function Z(e,r){return ue(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function tn(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}var Ge={population:!0,diversity:!0,interfaces:!1},cr={enabled:!0,sections:Ge};function Wi(e){return{population:typeof e?.population=="boolean"?e.population:Ge.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Ge.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Ge.interfaces}}function it(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:cr.enabled,sections:Wi(e?.sections)}}function ot(e,r){self.postMessage(e,r)}var M="dead";var at="empty",nn="is",lr="comparison",dr="count",fr="none",pr="exactly",mr="min",br="max",gr="not",hr="and",Sr="or",yr="xor";async function on(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var d={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var an=4294967295;function st(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function $(e,r){return e.includes(r)}function sn(e,r,t,n){let i=e*r,o=i<=an,s=i*2<=an;return{population:st(t&&n.population,o),diversity:st(t&&n.diversity,o),interfaces:st(t&&n.interfaces,s)}}function un(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var Se=256*Uint32Array.BYTES_PER_ELEMENT,ye=Uint32Array.BYTES_PER_ELEMENT;function cn(e){return e.remapped?`
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
  let y = gid.y;`}function Ni(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
`}function zi(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
`}function Ki(e,r){let{tribes:t,deadTribeIndex:n,readback:i,cols:o,rows:s}=e,a=o*s,u={};for(let p=0;p<t.length;p++){let f=r?i.histogram[p]??0:0;u[t[p].id]=f}let l=r?u[t[n]?.id??""]??0:0;return{population:u,aliveCells:r?Math.max(0,a-l):0,deadCells:l}}function Xi(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,i=0;for(let o=0;o<r.length;o++)o!==t&&(i+=n.histogram[o]??0);return i}function Yi(e,r){let{tribes:t,deadTribeIndex:n,readback:i}=e,o=r?Xi(e):0,s=0,a=0;for(let u=0;u<t.length;u++){let l=u!==n&&o>0?(i.histogram[u]??0)/o:0;l>0&&(s-=l*Math.log2(l),a+=l*l)}return{shannonEntropy:s,simpsonSum:a}}function qi(e,r){let t=e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,i=r?Math.max(0,t-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?i/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function fn(e){let{device:r}=e,t=r.createShaderModule({label:d.histogramMetricsShaderModule,code:Ni(e)}),n=r.createComputePipeline({label:d.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),i=r.createBuffer({label:d.histogramMetricsBuffer,size:Se,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=r.createBuffer({label:d.histogramMetricsReadBuffer,size:Se,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=r.createShaderModule({label:d.interfaceMetricsShaderModule,code:zi(e)}),a=r.createComputePipeline({label:d.interfaceMetricsPipeline,layout:"auto",compute:{module:s,entryPoint:"main"}}),u=r.createBuffer({label:d.interfaceMetricsBuffer,size:ye,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),l=r.createBuffer({label:d.interfaceMetricsReadBuffer,size:ye,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:a,boundaryBuffer:u,boundaryReadBuffer:l}}function pn(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function mn(e){let{device:r,encoder:t,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:s}=e;if($(s,"population")||$(s,"diversity")){let a=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,a);let u=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),l=t.beginComputePass({label:d.histogramMetricsPass});l.setPipeline(n.histogramPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Se)}if($(s,"interfaces")){let a=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,a);let u=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),l=t.beginComputePass({label:d.interfaceMetricsPass});l.setPipeline(n.boundaryPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,ye)}}async function bn(e){let{resources:r,enabledSections:t}=e,n=$(t,"population")||$(t,"diversity"),i=$(t,"interfaces"),o=[];n&&o.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let s=new Uint32Array(256);n&&(s=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let a=0;if(i){let u=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),a=u[0]??0}return{histogram:s,crossStateContactEdges:a}}function gn(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:i,cols:o,rows:s,totalFrames:a,fps:u,canStepBack:l,recordingBytes:p,recordingRawBytes:f}=e,m=$(t,"population")&&i.population,F=$(t,"diversity")&&i.diversity,S=$(t,"interfaces")&&i.interfaces,U=o*s,se=Ki(e,m),O=Yi(e,F),Vt=qi(e,S);return{type:"metrics",generation:r,population:se.population,aliveCells:se.aliveCells,deadCells:se.deadCells,occupancy:m&&U>0?se.aliveCells/U:0,shannonEntropy:O.shannonEntropy,simpsonIndex:F?1-O.simpsonSum:0,interfaces:Vt,metricsAvailability:n,extinctionTime:{},totalFrames:a,fps:u,canStepBack:l,recordingBytes:p,recordingRawBytes:f}}function Hi(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}function hn(e,r,t,n,i){let o=ue(r.cols,t),s=e[i*o+(n>>t.wordShift)]??0;return Hi(s,t,n&t.cellIndexMask)}function Sn(e,r,t,n,i,o){let s=ue(r.cols,t),a=i*s+(n>>t.wordShift),u=(n&t.cellIndexMask)<<t.cellShift,l=~(t.cellMask<<u),p=e[a]??0;e[a]=(p&l|(o&t.cellMask)<<u)>>>0}var ji=64*1024*1024,Za=256*1024*1024;function Tr(e,r,t,n){let i=e,o;if(t.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(Z(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let s=0;s<r.rows;s++)for(let a=0;a<r.cols;a++)Sn(o,r,n,a,s,hn(i,r,t,a,s))}return o}function yn(e,r,t){let n=Math.floor((r-1)/2),i=e-n,o=i+r,s=[];if(i>=0&&o<=t)s.push({destinationStart:i,localStart:0,span:r});else if(i<0){let a=-i;s.push({destinationStart:t-a,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:r-a})}else{let a=t-i;s.push({destinationStart:i,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:o-t})}return s.filter(a=>a.span>0)}function Tn(e){return`
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
`}function Cn(e,r,t,n){let i=yn(e,t,n.cols),o=yn(r,t,n.rows),s=[];for(let a of o)for(let u of i)s.push({destinationStartX:u.destinationStart,destinationStartY:a.destinationStart,localStartX:u.localStart,localStartY:a.localStart,spanCols:u.span,spanRows:a.span});return s}var Mn={"=":"==","\u2260":"!=",">":">","<":"<","\u2265":">=","\u2264":"<="};function Vi(e){let r;return typeof e=="string"?r=vn([e]):r=E(e),r}function vn(e){return{kind:"tribes",tribes:[...e&&e.length>0?e:[M]]}}function E(e,r){let t=e??vn(r),n;switch(t.kind){case"tribes":n={...t,tribes:[...t.tribes]};break;case"tiedMajority":n={...t,source:E(t.source)};break;default:n={...t};break}return n}function Fe(e,r){return{kind:"count",selector:E(e?.selector,r)}}function Cr(e){return JSON.stringify(Q(e))}function Q(e){let r;switch(e.kind){case"tribes":r={...e,tribes:[...new Set(e.tribes)].sort()};break;case"tiedMajority":r={...e,source:Q(e.source)};break;default:r=e;break}return r}function Rn(e){return e.become??{kind:"fixed",tribe:e.tribe??M}}function Le(e){let r;switch(e.kind){case"majority":case"minority":r={...e,selector:E(e.selector),tie:e.tie?Le(e.tie):void 0,fallback:e.fallback?Le(e.fallback):void 0};break;case"combine":r={kind:"combine",strategy:{...e.strategy,entries:e.strategy.entries.map(t=>({...t,inputs:t.inputs.map(n=>Vi(n)).sort((n,i)=>Cr(n).localeCompare(Cr(i)))})),default:e.strategy.default?Le(e.strategy.default):void 0}};break;default:r={...e};break}return r}function Zi(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function Qi(e,r){e.push(`const CELLS_PER_WORD: u32 = ${r.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${r.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${r.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${r.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${r.cellMask}u;`)}function Ji(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function eo(e,r,t){r.remapped?(e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;")):(e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;"))}function ro(e){let r=bo(e),t=new Map,n=0;for(let i of r)t.set(i,`count_${n++}`);return t}function to(e,r){let t=go(e),n=new Map,i=0;for(let o of t){let s=r.get(o);s?n.set(o,s):n.set(o,`eq_count_${i++}`)}return n}function no(e,r,t,n){for(let[i,o]of r)e.push(`  let ${o} = ${lt(kn(i),t,n)};`);r.size>0&&e.push("")}function io(e,r,t,n,i){let o=0;for(let[s,a]of t)r.has(s)||(e.push(`  let ${a} = ${lt(kn(s),n,i)};`),o++);o>0&&e.push("")}function oo(e,r,t,n,i,o){for(let s=0;s<r.length;s++){let a=r[s],u=Ue(a.clause,t,n,i,o);e.push(s===0?`  if (${u}) {`:`  } else if (${u}) {`),ct(e,Le(Rn(a)),i,o,`rule_${s}`,"    ")}r.length>0&&e.push("  }"),e.push("")}function ct(e,r,t,n,i,o,s=null){switch(r.kind){case"fixed":e.push(`${o}result = ${W(r.tribe,n)}u;`);break;case"same":e.push(`${o}result = selfTribe;`);break;case"majority":case"minority":ao(e,r,t,n,i,o);break;case"combine":so(e,r,t,n,i,o,s);break}}function ao(e,r,t,n,i,o){let s=E(r.selector),a=`${i}_${r.kind}`,u=`${i}_${r.kind}_count`,l=`${i}_${r.kind}_ties`,p=r.kind==="majority"?"0u":"9u",f=r.kind==="majority"?`candidateCount > ${u}`:`candidateCount < ${u}`;e.push(`${o}var ${a}: u32 = ${W(M,n)}u;`),e.push(`${o}var ${u}: u32 = ${p};`),e.push(`${o}var ${l}: u32 = 0u;`);for(let m of Rr(s,t,n)){let F=X(U=>`${U} == ${m}u`),S=Te(s,m,n);e.push(`${o}{`),e.push(`${o}  let candidateCount = ${F};`),e.push(`${o}  if (${S} && candidateCount > 0u) {`),e.push(`${o}    if (${f}) {`),e.push(`${o}      ${a} = ${m}u;`),e.push(`${o}      ${u} = candidateCount;`),e.push(`${o}      ${l} = 1u;`),e.push(`${o}    } else if (candidateCount == ${u}) {`),e.push(`${o}      ${l} = ${l} + 1u;`),e.push(`${o}    }`),e.push(`${o}  }`),e.push(`${o}}`)}e.push(`${o}if (${l} == 1u) {`),e.push(`${o}  result = ${a};`),e.push(`${o}} else if (${l} > 1u) {`),r.tie?ct(e,r.tie,t,n,`${i}_tie`,`${o}  `,{selector:s,bestCountVar:u,tieCountVar:l}):Mr(e,r.fallback,t,n,`${i}_tie_fallback`,`${o}  `),e.push(`${o}} else {`),Mr(e,r.fallback,t,n,`${i}_fallback`,`${o}  `),e.push(`${o}}`)}function Mr(e,r,t,n,i,o){r?ct(e,r,t,n,i,o):e.push(`${o}result = ${W(M,n)}u;`)}function so(e,r,t,n,i,o,s){let a=`${i}_input_mask`;e.push(`${o}var ${a}: u32 = 0u;`);for(let f of fo(t,n,s)){let m=Bn(f,n,s);e.push(`${o}if (${m}) {`),e.push(`${o}  ${a} = ${a} | ${Pn(f)};`),e.push(`${o}}`)}let u=`${i}_dead_present`,l=X(f=>`${f} == ${W(M,n)}u`);e.push(`${o}let ${u} = ${l} > 0u;`);let p=[...r.strategy.entries].sort((f,m)=>Number(ut(m,n))-Number(ut(f,n)));p.forEach((f,m)=>{let F=po(f.inputs,t,n,s),S=ut(f,n)?` && ${u}`:"",U=`${a} == (${F})${S}`;e.push(m===0?`${o}if (${U}) {`:`${o}} else if (${U}) {`),e.push(`${o}  result = ${W(f.output,n)}u;`)}),p.length>0?(e.push(`${o}} else {`),Mr(e,r.strategy.default,t,n,`${i}_fallback`,`${o}  `),e.push(`${o}}`)):Mr(e,r.strategy.default,t,n,`${i}_fallback`,o)}function uo(e){for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(`    let ${xn(t,r)} = readCell(${_n("x",t,"COLS")}, ${_n("y",r,"ROWS")});`)}function lt(e,r,t){let n=Q(e),i;switch(n.kind){case"same":i=X(o=>`${o} == selfTribe`);break;case"different":i=X(o=>`${o} != selfTribe`);break;case"tiedMajority":i=lt(n.source,r,t);break;case"tribes":{let o=Oe(n.tribes,t);i=o.length===0?"0u":X(s=>o.map(a=>`${s} == ${a}u`).join(" || "));break}}return i}function X(e){return co().map(r=>`select(0u, 1u, ${e(r)})`).join(" + ")}function xn(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function co(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(xn(t,r));return e}function _n(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function Oe(e,r){let t=[];for(let n of e)t.push(vr(n,r,"selector"));return[...new Set(t)]}function W(e,r){return vr(e,r,"target")}function vr(e,r,t){let n=r.get(e),i=r.get(M)??0;return n===void 0&&console.error(`Unknown rule ${t} tribe; using dead tribe instead.`,{tribe:e}),n??i}function Rr(e,r,t){let n=Q(e),i;switch(n.kind){case"tribes":i=Oe(n.tribes,t);break;case"tiedMajority":i=Rr(n.source,r,t);break;default:i=r.map(o=>vr(o.id,t,"selector"));break}return[...new Set(i)].sort((o,s)=>o-s)}function Te(e,r,t){let n=Q(e),i;switch(n.kind){case"same":i=`selfTribe == ${r}u`;break;case"different":i=`selfTribe != ${r}u`;break;case"tiedMajority":i=Te(n.source,r,t);break;case"tribes":{i=Oe(n.tribes,t).includes(r)?"true":"false";break}}return i}function lo(e,r,t,n){let i=Q(e),o;if(i.kind==="tiedMajority"&&n){let s=X(u=>`${u} == ${r}u`),a=Te(n.selector,r,t);o=`(${n.tieCountVar} > 1u && ${n.bestCountVar} > 0u && ${a} && ${s} == ${n.bestCountVar})`}else{let s=X(u=>`${u} == ${r}u`);o=`(${Te(i.kind==="tiedMajority"?i.source:i,r,t)} && ${s} > 0u)`}return o}function fo(e,r,t){let n;return t?n=Rr(t.selector,e,r):n=e.map(i=>vr(i.id,r,"selector")),[...new Set(n)].filter(i=>i!==W(M,r)).sort((i,o)=>i-o)}function Bn(e,r,t){let n;if(t){let i=X(s=>`${s} == ${e}u`),o=Te(t.selector,e,r);n=`(${e}u != ${W(M,r)}u && ${t.tieCountVar} > 1u && ${t.bestCountVar} > 0u && ${o} && ${i} == ${t.bestCountVar})`}else{let i=X(o=>`${o} == ${e}u`);n=`(${e}u != ${W(M,r)}u && ${i} > 0u)`}return n}function po(e,r,t,n){let i=[];for(let o of e){let s=E(o);for(let a of Rr(s,r,t))if(a!==W(M,t)){let u=mo(s,a,t,n);i.push(`select(0u, ${Pn(a)}, ${u})`)}}return i.length>0?i.join(" | "):"0u"}function ut(e,r){let t=W(M,r);return e.inputs.some(n=>{let i=E(n);return i.kind==="tribes"&&Oe(i.tribes,r).includes(t)})}function mo(e,r,t,n){let i=Q(e),o;if(n){let s=Bn(r,t,n),a=Te(i.kind==="tiedMajority"?i.source:i,r,t);o=`(${s} && ${a})`}else o=lo(i,r,t,null);return o}function Pn(e){return`(1u << ${e}u)`}function En(e){return Cr(e)}function kn(e){return JSON.parse(e)}function wn(e,r){let t=new Set,n=o=>{t.add(En(o))},i=o=>{switch(r(o,n),o.kind){case gr:i(o.clause);break;case hr:case Sr:case yr:for(let s of o.clauses)i(s);break}};for(let o of e)i(o);return t}function bo(e){return wn(e,(r,t)=>{switch(r.kind){case fr:case pr:case mr:case br:case dr:t(E(r.selector,r.tribes));break}})}function go(e){return wn(e,(r,t)=>{r.kind===lr&&(t(Fe(r.left,r.tribe1).selector),t(Fe(r.right,r.tribe2).selector))})}function Ue(e,r,t,n,i){switch(e.kind){case at:return"false";case nn:return ho(e.tribes,n,i);case dr:return De(ce(E(e.selector,e.tribes),r),e.interval[0],e.interval[1]);case fr:return De(ce(E(e.selector,e.tribes),r),0,0);case pr:return De(ce(E(e.selector,e.tribes),r),e.value,e.value);case mr:return De(ce(E(e.selector,e.tribes),r),e.value,8);case br:return De(ce(E(e.selector,e.tribes),r),0,e.value);case lr:return So(e,t);case gr:return`!(${Ue(e.clause,r,t,n,i)})`;case hr:return`(${e.clauses.map(o=>Ue(o,r,t,n,i)).join(" && ")})`;case Sr:return`(${e.clauses.map(o=>Ue(o,r,t,n,i)).join(" || ")})`;case yr:return yo(e.clauses,r,t,n,i);default:return"false"}}function ho(e,r,t){let n=Oe(e,t);return n.length===0?"false":n.length===r.length?"true":`(${n.map(i=>`selfTribe == ${i}u`).join(" || ")})`}function De(e,r,t){return`(${e} >= ${r}u && ${e} <= ${t}u)`}function So(e,r){let t=Fe(e.left,e.tribe1).selector,n=Fe(e.right,e.tribe2).selector,i=Mn[e.operator]??"==",o=Math.max(-8,Math.min(8,e.margin??0));return`(i32(${ce(t,r)}) ${i} (i32(${ce(n,r)}) + ${o}i))`}function yo(e,r,t,n,i){return`(((${e.map(o=>Ue(o,r,t,n,i)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`}function ce(e,r){return r.get(En(e))}function dt(e,r,t){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,i=Math.min(n,t),o=Math.ceil(n/i);if(o<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:i,dispatchWgY:o,remapped:!0};throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`)}function In(e,r,t,n,i,o,s){let a=[],u=e.rules.filter(m=>!m.muted),l=s.get(M)??0,p=ro(u.map(m=>m.clause)),f=to(u.map(m=>m.clause),p);return a.push("// Auto-generated simulation compute shader."),a.push(`// Tribes: ${r.map(m=>m.id).join(", ")}`),a.push(`// Rules: ${e.rules.length}`),a.push(""),a.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),a.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),a.push(""),a.push(`const COLS: u32 = ${n.cols}u;`),a.push(`const ROWS: u32 = ${n.rows}u;`),a.push(`const PACKED_COLS: u32 = ${t}u;`),Zi(a,i),Qi(a,o),a.push(""),Ji(a,"gridIn","PACKED_COLS"),a.push(""),a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {"),no(a,p,r,s),io(a,p,f,r,s),a.push(`  var result: u32 = ${l}u;`),a.push(""),oo(a,u,p,f,r,s),a.push("  return result;"),a.push("}"),a.push(""),a.push("@compute @workgroup_size(16, 16)"),i.remapped?a.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):a.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),eo(a,i,"px"),a.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),a.push(""),a.push("  let baseX = px << WORD_SHIFT;"),a.push("  var packed: u32 = 0u;"),a.push(""),a.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),a.push("    let x = baseX + i;"),a.push("    if (x >= COLS) { break; }"),a.push(""),a.push("    let selfTribe = readCell(x, y);"),uo(a),a.push(""),a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),a.push("  }"),a.push(""),a.push("  gridOut[y * PACKED_COLS + px] = packed;"),a.push("}"),a.join(`
`)}var Ce=3,$e="gol-recording",Me="raw-packed",ft="deflate-raw",pt=12,mt=256*1024*1024,An=512*1024*1024,bt=128*1024*1024*1024;function gt(e,r,t=0){let n=t;for(let i of e)n+=i[r];return n}function Gn(e,r){return Math.min(e,r)}function ht(e){return Math.min(e,1073741824)}function Ln(e){return Math.min(e,An)}function St(e,r){return Math.max(e*2,r*6)}function _r(e,r){return e>0&&e<=r}function Mo(e,r){return e>0?e*2+r:0}function vo(e,r){return e>=1&&r>0?e*r*(1+Ce):0}function Ro(e,r){return e<mt?Math.min(mt,r):e}function Fn(e,r){return _r(e,r)?Math.max(1,Math.floor(Ro(e,r)/e)):0}function xr(e,r){return e>=1&&r>0?Math.max(1,Math.min(pt,Math.floor(536870912/(e*r)))):pt}function Dn(e,r,t,n,i,o){let s=!r.some(u=>u)&&(i||o>=e),a=i?Math.floor(n/2)+1:n;return e>=1&&r.length>0&&(s||t>=a)}function Un(e,r,t,n){return e<r&&n.some((i,o)=>t[o]&&i.mapState==="unmapped")}function On(e,r,t,n,i,o){return e&&r>=1&&t!==null&&n.length>0&&(i<r||o)}function $n(e,r,t,n,i){let o=Math.min(e.quota??bt/128,bt),s=e.usage??0,a=0,u=0;for(let f of r)f.codec===Me?a+=f.storedBytes:u+=f.storedBytes;let l=t*n,p=i?(1+Ce)*l:0;return{quotaBytes:o,usedBytes:s,pendingRawBytes:a,compressedBytes:u,gpuBufferMarginBytes:p}}function Wn(e,r,t,n,i){let o=ht(e);return{maxBytes:e,vramBudgetBytes:St(e,o),frameByteSize:r,recordingAvailable:_r(r,o),vramSimulationBytes:Mo(r,n),vramRecordingBytes:vo(t,r),gridFormat:i}}function Br(e,r,t){r.length>0&&(e.generationStart=r[0].generationStart,e.generationEnd=r[r.length-1].generationEnd),t.length>0&&(r.length===0&&(e.generationStart=t[0]),e.generationEnd=t[t.length-1]),e.chunks=[...r]}function Nn(e){return e.map(r=>({...r,generations:[...r.generations]}))}function zn(e,r){return e!==r}function Pr(e,r=0){return gt(e,"blockCount",r)}function Kn(e){return gt(e,"storedBytes")}function Xn(e){return gt(e,"uncompressedBytes")}var _o=256,We=80,Yn=_o*Uint32Array.BYTES_PER_ELEMENT;function qn(e){let r=new ArrayBuffer(We),t=new Float32Array(r),n=new Int32Array(r),i=new Uint32Array(r),o=(e.offsetX%e.grid.cols+e.grid.cols)%e.grid.cols,s=(e.offsetY%e.grid.rows+e.grid.rows)%e.grid.rows,a=Math.floor(o),u=Math.floor(s);return t[0]=e.canvasWidth,t[1]=e.canvasHeight,t[2]=e.scale,t[4]=o-a,t[5]=s-u,i[6]=e.grid.cols,i[7]=e.grid.rows,i[8]=a,i[9]=u,i[10]=e.tribeCount,n[12]=e.brushPreview.centerX,n[13]=e.brushPreview.centerY,i[14]=e.brushPreview.brushSize,i[15]=e.brushPreview.shape,i[16]=e.brushPreview.visible?1:0,r}function Hn(e){let r=new Uint32Array(e.length);for(let t=0;t<e.length;t++){let n=e[t].color,i=parseInt(n.substring(0,2),16),o=parseInt(n.substring(2,4),16),s=parseInt(n.substring(4,6),16);r[t]=i|o<<8|s<<16}return r}function jn(e,r){return e.replace("__CELLS_PER_WORD__",`${r.cellsPerWord}u`).replace("__WORD_SHIFT__",`${r.wordShift}u`).replace("__CELL_SHIFT__",`${r.cellShift}u`).replace("__CELL_INDEX_MASK__",`${r.cellIndexMask}u`).replace("__CELL_MASK__",`${r.cellMask}u`)}function Vn(e){return Math.min(3,Math.max(0,Math.ceil(Math.log10(e.cols*e.rows/1e5))))}function yt(e){return 1024/4**Vn(e)}function Tt(e){return 16/2**Vn(e)}function Ct(e,r){return e==="recording"?Number.MAX_SAFE_INTEGER:yt(r)*Tt(r)}function Mt(e,r,t,n,i){let o=e-r*n;return t>n||t>i?Math.min(o,r):o}function Zn(e){return e<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/e}}function Y(e){return e.request.stopCondition.kind==="targetGeneration"}function ve(e,r){return e.request.stopCondition.kind==="targetGeneration"&&r>=e.request.stopCondition.generation}function Ne(e,r){return e.request.stopCondition.kind==="targetGeneration"?Math.max(0,e.request.stopCondition.generation-r):Number.POSITIVE_INFINITY}function Qn(e,r){return r.restore!==!1&&e.request.restoreAfterStop||null}function Jn(e,r,t){return r&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")}function ei(e,r,t,n,i){return e.restartRestoredRun!==!1&&r&&t&&!n&&!i}function ri(e,r,t,n){let i=r+t,o=Math.min(n,i-1);if(o<=0)return null;let s=i-1-o;if(s>=r)return{source:"buffered",frameInChunk:s-r};let a=0;for(let u=0;u<e.length;u++){let l=e[u];if(s<a+l.blockCount)return{source:"sealed",sealedIndex:u,frameInChunk:s-a};a+=l.blockCount}return null}function ti(e,r){return{chunkFrameIndex:r.frameInChunk+1,generation:e[r.frameInChunk]}}function ni(e,r,t,n,i,o){let s=(r+1)*t;if(i.bitsPerCell===o.bitsPerCell)return{sameFormat:!0,chunkPrefix:new Uint8Array(e,0,s),activeFrame:null};let a=Z(n,i),u=new Uint8Array(s);for(let l=0;l<=r;l++){let p=new Uint8Array(e,l*a,a),f=Tr(tn(p),n,i,o);u.set(new Uint8Array(f.buffer,f.byteOffset,f.byteLength),l*t)}return{sameFormat:!1,chunkPrefix:u,activeFrame:u.subarray(r*t,s)}}var c,w=!1,Ur,Er,pe,Yr,_=0,x=0,qr=0,I=sr,Be=[],Pe=new Map,Or,xt,G,L,Ee,Re,je,Bt,Pt,Xe,Ot,$t,k=!1,si=1,ui=0,ci=0,B=!1,A=!1,te=100,b=0,me=0,ze=0,Hr=0,kr,xo=4,Wt=192,fe=[],$r=[],Wr=[],Bo=0,wr=null,li={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},ne=null,Ir=-1,_e=!1,Ye=!1,vt=0,Ve=cr,Ar=[],R=!1,z=!1,J={chunks:[],generationStart:0,generationEnd:0,gridFormat:Ae(sr)},di=0,C=[],Ze=!1,g=null,fi=0,Gr=!1,D=null,h=0,v=[],be=null,T=64,y=0,ie=[],N=[],qe=null,le=null,K=0,Qe=0,de=0,q=!1,Ke=0,Lr=0,Fr=0,He=[];function Po(e){switch(!0){case e instanceof Error:return e.message;case typeof e=="string":return e;case(e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"):return e.message;default:return String(e??"Unknown worker error")}}function pi(e){console.error("[GOLT worker] Worker GPU error:",e),P("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),B=!1,self.postMessage({type:"gpuError",reason:Po(e)})}self.addEventListener("error",e=>{e.preventDefault(),pi(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),pi(e.reason)});async function Nt(){await c.queue.onSubmittedWorkDone()}function ii(e){Lr=0,Fr=2+(e?1+Ce:0),He=[]}async function Nr(){if(He.length>0){let e=c.createCommandEncoder({label:d.trackedAllocationClearEncoder});for(let r of He)e.clearBuffer(r);c.queue.submit([e.finish()]),await Nt(),He=[]}}async function zr(e,r){A&&Fr>0&&(Lr+=e,Fr--,He.push(r),Lr>=Ln(ge())&&Fr>0&&(await Nr(),Lr=0))}function Kr(){D?.destroy(),D=null;for(let e of ie)e?.destroy();ie=[],N=[],T=0,h=0,v=[],be=null,Qe=0}function oi(){G?.destroy(),L?.destroy(),pn(ne),ne=null,fe.forEach(e=>e.destroy()),fe=[],$r=[],Wr=[],Kr()}function Rt(e){let r=K>0;K+=e;let t=K>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function xe(){let e=Dn(T,N,de,xr(T,y),q,h);e!==q&&(q=e,self.postMessage({type:"backpressure",active:e}))}async function we(){self.postMessage({type:"storageQuota",...$n(await navigator.storage.estimate(),C,T,y,R)})}function ge(){return Gn(c.limits.maxBufferSize,c.limits.maxStorageBufferBindingSize)}function er(){return ht(ge())}function ee(){return _r(y,er())}function mi(){return Un(de,xr(T,y),N,ie)}function Je(){return On(ee(),T,D,ie,h,mi())}async function Eo(e){let r=new DecompressionStream(ft),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],i=r.readable.getReader();for(;;){let{done:u,value:l}=await i.read();if(u)break;n.push(l)}let o=0;for(let u of n)o+=u.byteLength;let s=new Uint8Array(o),a=0;for(let u of n)s.set(u,a),a+=u.byteLength;return s.buffer}function ae(){return{cols:_,rows:x}}function ko(){return dt(Math.ceil(qr/16),Math.ceil(x/16),c.limits.maxComputeWorkgroupsPerDimension)}function wo(){return dt(Math.ceil(_/16),Math.ceil(x/16),c.limits.maxComputeWorkgroupsPerDimension)}function Et(){Ee?.destroy(),Ee=c.createBuffer({label:d.uniformBuffer,size:We,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Io(){let e=qn({canvasWidth:pe.width,canvasHeight:pe.height,scale:si,offsetX:ui,offsetY:ci,grid:ae(),tribeCount:Be.length,brushPreview:li});c.queue.writeBuffer(Ee,0,e)}function jr(){return Z({cols:_,rows:x},I)}function oe(){return Ae(I)}async function kt(){let e=jr();G=c.createBuffer({label:d.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await zr(e,G),L=c.createBuffer({label:d.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await zr(e,L);let r=c.createCommandEncoder({label:d.gridClearEncoder});r.clearBuffer(G),r.clearBuffer(L),c.queue.submit([r.finish()]),k=!1}function wt(){let e=Hn(Be);Re&&Re.destroy(),Re=c.createBuffer({label:d.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),c.queue.writeBuffer(Re,0,e)}function It(){let e=c.createShaderModule({label:d.renderShaderModule,code:jn(Qt,I)});je=c.createRenderPipeline({label:d.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:Er}]},primitive:{topology:"triangle-list"}})}function At(){Bt=c.createBindGroup({layout:je.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ee}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:Re}}]}),Pt=c.createBindGroup({layout:je.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ee}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:Re}}]})}function Gt(){Or=ko();let e=In(Yr,Be,qr,ae(),Or,I,Pe),r=c.createShaderModule({label:d.simulationShaderModule,code:e});Xe=c.createComputePipeline({label:d.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),Ot=c.createBindGroup({layout:Xe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:L}}]}),$t=c.createBindGroup({layout:Xe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:G}}]})}function Lt(){xt=wo(),ne=fn({device:c,cols:_,rows:x,gridFormat:I,dispatchPlan:xt})}function Ft(){let e=c.createShaderModule({label:d.brushShaderModule,code:Tn(I)});kr=c.createComputePipeline({label:d.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),fe.forEach(r=>r.destroy()),fe=[],$r=[],Wr=[];for(let r=0;r<xo;r++){let t=c.createBuffer({label:`${d.brushUniformBuffer} ${r}`,size:Wt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});fe.push(t),$r.push(c.createBindGroup({layout:kr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:t}}]})),Wr.push(c.createBindGroup({layout:kr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:t}}]}))}}function Ao(e,r,t,n,i,o,s){let a=Pe.get(M)??0,u=Bo++,l=Cn(r,t,n,ae()),p=k?Wr:$r;for(let[f,m]of l.entries()){let F=new ArrayBuffer(Wt),S=new Uint32Array(F);S[0]=qr,S[1]=n,S[2]=i,S[3]=o,S[4]=a,S[5]=u,S[6]=s.length,S[7]=m.destinationStartX,S[8]=m.destinationStartY,S[9]=m.localStartX,S[10]=m.localStartY,S[11]=m.spanCols,S[12]=m.spanRows,S[13]=0;for(let O=0;O<s.length&&O<32;O++)S[14+O]=s[O];let U=fe[f],se=p[f];if(U&&se){c.queue.writeBuffer(U,0,F);let O=Math.floor(m.destinationStartX/I.cellsPerWord),wi=Math.ceil((m.destinationStartX+m.spanCols)/I.cellsPerWord)-O,Ii=Math.ceil(wi/8),Ai=Math.ceil(m.spanRows/8),ar=e.beginComputePass({label:d.brushPass});ar.setPipeline(kr),ar.setBindGroup(0,se),ar.dispatchWorkgroups(Ii,Ai),ar.end()}else throw console.error("[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.",{index:f,rectCount:l.length,bindGroupCount:p.length,uniformBufferCount:fe.length}),new Error("Brush dispatch resources are out of sync with the wrapped brush rectangles.")}}function Go(){let e=k?L:G,r=jr(),t;try{t=c.createBuffer({label:d.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=c.createCommandEncoder({label:d.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),c.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),i})}function bi(){y=jr(),T=Fn(y,er())}function Dt(){self.postMessage({type:"limits",...Wn(ge(),y,T,We+Yn+Wt+Se*2+ye*2,oe())})}function rr(e){if(T>=1&&D!==null&&h<T){let r=k?L:G,t=h*y,n=c.createCommandEncoder({label:d.recordingFrameCopyEncoder});n.copyBufferToBuffer(r,0,D,t,y),c.queue.submit([n.finish()]),v.push(e),be=e,h++,Dr()}}function _t(e){Qe=Math.max(0,Qe+e)}function Dr(){T>0&&h>=T&&mi()&&tr()}function tr(){let e=D;if(e!==null&&h>0&&ie.length>0&&de<xr(T,y)){let r=N.indexOf(!0);if(r>=0){N[r]=!1;let t=ie[r];if(t.mapState==="unmapped"){let n=h*y,i=di++,o=[...v],s=o[0],a=o[o.length-1],u=`chunk-${String(i).padStart(6,"0")}.bin`,l=h,p=c.createCommandEncoder({label:d.recordingSealCopyEncoder});p.copyBufferToBuffer(e,0,t,0,n),c.queue.submit([p.finish()]);let f={chunkId:i,generationStart:s,generationEnd:a,blockCount:l,codec:Me,uncompressedBytes:n,storedBytes:n,gridFormat:oe(),generations:o,filename:u};Rt(1),_t(l),de++,xe();let m=Ke;t.mapAsync(GPUMapMode.READ).then(async()=>{let F=t.getMappedRange(),S=new ArrayBuffer(n);new Uint8Array(S).set(new Uint8Array(F,0,n)),t.unmap(),m===Ke&&(N[r]=!0,C.push(f),_t(-l),Br(J,C,v),xe(),Dr(),Lo(f,S).then(()=>{m===Ke&&(de--,xe(),Rt(-1),we(),Xr(),j(!0),Dr(),self.postMessage({type:"chunkSealed",filename:f.filename,rawBytes:n,blockCount:f.blockCount,cols:_,rows:x,rawGridFormat:f.gridFormat,storageGridFormat:Ae(ur(Yr.tribes.length))}),Ze&&K===0&&(Ze=!1,Xr()))}))}).catch(()=>{m===Ke&&(N[r]=!0,de--,_t(-l),xe(),Rt(-1),Dr())}),h=0,v=[]}else N[r]=!0}}}async function gi(e){Ke++,di=0,h=0,v=[],C=[],be=null,Qe=0,de=0,K>0&&(K=0,self.postMessage({type:"chunksSaving",active:!1})),q&&(q=!1,self.postMessage({type:"backpressure",active:!1})),Ze=!1,z=R,J={chunks:[],generationStart:e,generationEnd:e,gridFormat:oe()},await hi(),we()}async function zt(){return le&&await le,qe||(qe=await(await navigator.storage.getDirectory()).getDirectoryHandle($e,{create:!0})),qe}async function Lo(e,r){let i=await(await(await zt()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(r),await i.close()}async function Fo(e){let r=await zt();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function hi(){if(le)await le;else{le=(async()=>{let e=await navigator.storage.getDirectory();qe=null;try{await e.removeEntry($e,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${$e}:`,r)}qe=await e.getDirectoryHandle($e,{create:!0})})();try{await le}finally{le=null}}}function Xr(){Br(J,C,v),self.postMessage({type:"recording",manifest:{chunks:Nn(C),generationStart:J.generationStart,generationEnd:J.generationEnd,gridFormat:oe()},cols:_,rows:x})}function nr(e=!1){if(R){let r=!z;e&&z&&Je()&&(z=!1,r=!0),r&&zn(be,b)&&Je()&&(h>=T&&tr(),rr(b))}}function Kt(){if(wr){let e=wr;wr=null;let r=R&&h>0&&v[h-1]===b;r&&(h--,v.pop());let t=c.createCommandEncoder({label:d.brushEncoder});Ao(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),c.queue.submit([t.finish()]),r&&rr(b)}}async function Do(e,r=Me){let o=await(await(await(await zt()).getFileHandle(e)).getFile()).arrayBuffer();return r===ft?Eo(o):o}function Si(){return sn(_,x,Ve.enabled,Ve.sections)}function Uo(){return un(Si())}function yi(e){Ar=Uo(),ne&&Ar.length>0&&mn({device:c,encoder:e,resources:ne,sourceBuffer:k?L:G,dispatchPlan:xt,enabledSections:Ar})}function Ti(){let e=b;if(ne&&e!==Ir&&!_e){let r=[...Ar],t=Si();Ir=e,_e=!0,bn({resources:ne,enabledSections:r}).then(n=>{let i=Pe.get(M)??0,o=Pr(C,h+Qe),s=gn({generation:e,tribes:Be,deadTribeIndex:i,readback:n,enabledSections:r,availability:t,liveMetricSettings:Ve.sections,cols:_,rows:x,totalFrames:o,fps:Hr,canStepBack:o>1,recordingBytes:Kn(C),recordingRawBytes:Xn(C)});if(_e=!1,self.postMessage(s),Ye)if(Ye=!1,Ir=-1,vi()){let a=c.createCommandEncoder({label:d.interactiveMetricsEncoder});yi(a),c.queue.submit([a.finish()]),Ti()}else Ye=!0}).catch(()=>{_e=!1})}}function Ci(e){if(e>0){let r=Or,t=c.createCommandEncoder({label:d.simulationBatchEncoder});for(let n=0;n<e;n++){let i=t.beginComputePass({label:d.simulationStepPass});i.setPipeline(Xe),i.setBindGroup(0,k?$t:Ot),i.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),i.end(),k=!k,b++}c.queue.submit([t.finish()]),me+=e}}function Oo(){self.postMessage({type:"generation",generation:b,fps:Hr})}function Xt(){let e=c.createCommandEncoder({label:d.simulationSingleStepEncoder}),r=e.beginComputePass({label:d.simulationStepPass});r.setPipeline(Xe),r.setBindGroup(0,k?$t:Ot);let t=Or;r.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),r.end(),c.queue.submit([e.finish()]),k=!k,b++}function H(){if(c&&Ur&&Ee&&je&&Bt&&Pt&&!A&&!w){Io();let e=Ur.getCurrentTexture().createView(),r=c.createCommandEncoder({label:d.renderEncoder}),t=r.beginRenderPass({label:d.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(je),t.setBindGroup(0,k?Pt:Bt),t.draw(3),t.end(),c.queue.submit([r.finish()])}}function Mi(e){ze===0&&(ze=e);let r=e-ze;r>=1e3&&(Hr=me/(r/1e3),me=0,ze=e)}function Yt(){me=0,ze=0,Hr=0}function qt(){return R&&ee()?"recording":"nonRecording"}function vi(){return!!(c&&ne&&!A&&!w)}function j(e=!1){if(e&&(Ir=-1),!vi())Ye=!0;else if(_e)Ye=!0;else{let r=c.createCommandEncoder({label:d.interactiveMetricsEncoder});yi(r),c.queue.submit([r.finish()]),Ti()}}function Ri(){j(!0),H()}function Vr(e,r){r&&(e-vt>=1e3||vt===0)&&!_e&&(vt=e,j())}function ir(e,r){(e.request.pacing.kind==="max"||Y(e))&&r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,Oo())}function ke(e){q!==e&&(q=e,self.postMessage({type:"backpressure",active:e}))}function Ht(){let e=Je();return e&&h>=T&&(tr(),e=Je()),e}function or(){!A&&!w&&!g&&self.requestAnimationFrame(Ut)}function he(e){let r=g;if(r&&!r.pumpPending&&!A&&!w){let{token:t}=r;r.pumpPending=!0;let n=()=>{g&&g.token===t&&(g.pumpPending=!1,Yo(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?c.queue.onSubmittedWorkDone().then(n).catch(()=>{g?.token===t&&(g.pumpPending=!1)}):queueMicrotask(n)}}function jt(e,r){g&&P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),g={kind:e,request:r,token:++fi,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0},he(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function re(){B&&jt(qt(),{pacing:Zn(te),stopCondition:{kind:"none"}})}function $o(e,r){r||e==="cancelled"?ke(!1):q&&xe()}function P(e,r={}){let t=g;if(t){g=null,fi++;let n=Y(t),i=Qn(t,r),o=!!i;i&&(B=i.running,te=i.targetStepDuration),Jn(e,n,r)&&self.postMessage({type:"stepping",active:!1}),$o(e,n),r.render!==!1&&!A&&!w&&Ri(),ei(r,o,B,A,w)?re():or()}}function _i(e){let r=g;r&&Y(r)&&(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),P("cancelled"))}function Wo(e){P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),jt(qt(),e)}function xi(e,r,t){ke(!0),ir(e,r),Vr(r,t),he("drain")}function No(e,r){let t=ae(),n=yt(t),i=Tt(t),o=!1;for(let s=0;s<i;s++){let a=Ne(e,b);if(a<=0)break;Ci(Math.min(n,a)),o=!0}ir(e,r),ve(e,b)?P("targetReached"):he(o?"drain":"raf")}function zo(e,r){nr(!0);let t=!1,n=!1,i=performance.now()+14;for(;Ne(e,b)>0&&performance.now()<i;)if(Ht())Xt(),me++,t=!0,rr(b);else{xi(e,r,t),n=!0;break}n||(ke(!1),ir(e,r),Vr(r,t),ve(e,b)?P("targetReached"):he("raf"))}function Ko(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=e.stepAccumulator,o=Math.floor(e.stepAccumulator/r),s=Ct(e.kind,ae()),a=Math.min(o,Ne(e,b),s),u=a>0;if(u&&Ci(a),e.stepAccumulator=Mt(i,r,o,a,s),ir(e,t),ve(e,b))P("targetReached");else{let l=u&&o>a;(!Y(e)&&!l||t-e.lastRenderTime>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,H(),Vr(t,u)),he(l?"drain":"raf")}}function Xo(e,r,t){nr(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=!1,o=0,s=e.stepAccumulator,a=Ct(e.kind,ae()),u=Math.floor(e.stepAccumulator/r),l=performance.now()+14,p=!1;for(;e.stepAccumulator>=r&&Ne(e,b)>0&&o<a&&performance.now()<l;)if(Ht())Xt(),me++,o++,e.stepAccumulator-=r,i=!0,rr(b);else{xi(e,t,i),p=!0;break}e.stepAccumulator=Mt(s,r,u,o,a),p||(ke(!1),ir(e,t),ve(e,b)?P("targetReached"):(Y(e)||(H(),Vr(t,i)),he("raf")))}function Yo(e){let r=g;if(r&&!A&&!w)if(Mi(e),Y(r)||Kt(),ve(r,b))P("targetReached");else if(r.request.pacing.kind==="max")r.kind==="recording"?zo(r,e):No(r,e);else{let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?Xo(r,t,e):Ko(r,t,e)}}function Ut(e){A||w?self.requestAnimationFrame(Ut):(Mi(e),g||(Kt(),te>0&&!Gr&&H(),self.requestAnimationFrame(Ut)))}function qo(e,r){let t=c?ge():Number.POSITIVE_INFINITY;return Jt(r.bitsPerCell)&&et(r.bitsPerCell,e.tribes.length)&&rt(e,Ie(r.bitsPerCell),t)?Ie(r.bitsPerCell):rn(e.tribes.length,e,t)}function Bi(e,r){Yr=e,_=e.cols,x=e.rows,I=qo(e,r),qr=ue(_,I),Be=[...e.tribes],J.gridFormat=oe(),Pe.clear(),Be.forEach((t,n)=>Pe.set(t.id,n))}async function Pi(e){console.log("[GOLT worker] Initializing WebGPU"),pe=e,c=await on(d.webengineDevice),w=!1,c.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),P("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),w=!0,B=!1,A=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:ge(),vramBudgetBytes:St(ge(),er()),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:oe()});let r=pe.getContext("webgpu");if(r)Ur=r,Er=navigator.gpu.getPreferredCanvasFormat(),Ur.configure({device:c,format:Er,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:Er,maxBufferSize:c.limits.maxBufferSize,maxStorageBufferBindingSize:c.limits.maxStorageBufferBindingSize});else throw new Error("WebGPU canvas context not available")}async function Ho(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Pi(pe),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),P("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),w=!0,B=!1,A=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function Ei(){D=c.createBuffer({label:d.recordingChunkBuffer,size:T*y,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await zr(T*y,D),h=0,v=[],be=null}async function ki(){let e=T*y;ie=[],N=[];for(let r=0;r<Ce;r++){let t=c.createBuffer({label:`${d.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});ie.push(t),N.push(!0),await zr(e,t)}}async function jo(){await hi()}async function Vo(){console.log("[GOLT worker] Building GPU resources",{cols:_,rows:x,bitsPerCell:I.bitsPerCell,recordingAvailable:ee()}),Et(),bi(),await kt(),wt(),It(),At(),Gt(),Ft(),Lt(),await jo(),ee()?(await Ei(),await ki()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:y,maxRecordingBufferBytes:er()}),Kr(),R=!1,z=!1),await Nr(),Dt(),console.log("[GOLT worker] GPU resources ready")}async function Zo(){console.log("[GOLT worker] Rebuild started",{cols:_,rows:x,bitsPerCell:I.bitsPerCell}),P("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),A=!0,self.postMessage({type:"rebuilding",active:!0});try{await Nt()}catch{console.warn("[GOLT worker] Queue idle wait rejected during rebuild")}let e=!w;if(w&&(e=await Ho()),e){oi(),Et(),bi(),ii(ee());try{await kt(),wt(),It(),Gt(),Ft(),At(),Lt(),ee()?(await Ei(),await ki()):(Kr(),R=!1,z=!1),await Nr(),Dt()}catch(r){let t=r instanceof Error?r.message:String(r);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{oi(),Et(),ii(!1),await kt(),wt(),It(),Gt(),Ft(),At(),Lt(),R=!1,z=!1,y=jr(),Kr(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await Nr(),Dt()}catch(n){console.error("[GOLT worker] GPU rebuild recovery failed:",n),e=!1}}}return e&&(A=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:ee(),frameByteSize:y})),e}function ai(e){Gr=!0,c.queue.onSubmittedWorkDone().then(()=>{Gr=!1,e()}).catch(()=>{Gr=!1})}async function Qo(){K>0&&await new Promise(e=>{let r=setInterval(()=>{K===0&&(clearInterval(r),e())},10)})}async function Jo(e){console.log("[GOLT worker] Init message received",{cols:e.ruleset.cols,rows:e.ruleset.rows,recording:e.recording,running:e.running,speed:e.speed}),R=e.recording,Ve=it(e.liveMetrics),z=R,Bi(e.ruleset,e.simulationGridFormat),await Pi(e.canvas),await Vo(),j(!0),we(),B=e.running,te=e.speed<0?0:1e3/e.speed,B?re():or()}function ea(e){Ve=it(e.liveMetrics),j(!0)}async function ra(e){console.log("[GOLT worker] Ruleset update received",{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length});let r=ge();if(tt(e.ruleset.tribes.length,e.ruleset,r))P("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Bi(e.ruleset,e.simulationGridFormat),await Zo()&&(b=0,Yt(),await gi(0),j(!0),B?re():or());else{let i=`Requested ruleset requires at least ${en(e.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",i,{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length,maxBytes:r}),self.postMessage({type:"gpuError",reason:i})}}function ta(e){B=e.running,e.running?g||re():g&&Y(g)?_i(!1):g?P("manual"):(q&&xe(),Ri(),or())}function na(e){let r=te<=0,t=e.speed<0?0:1e3/e.speed;te=t,g&&!Y(g)&&B?(P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&t>0?ai(()=>{H(),re()}):re()):B&&!g?re():r&&t>0&&ai(()=>{H(),or()})}function ia(e){si=e.scale,ui=e.offsetX,ci=e.offsetY}function oa(e){pe.width=e.width,pe.height=e.height}function aa(e){let r=e.tribes.map(t=>Pe.get(t)).filter(t=>t!==void 0);if(r.length>0){let t={square:0,round:1,diamond:2,vline:3,hline:4},n={full:0,spray:1,outline:2};wr={centerX:e.x,centerY:e.y,brushSize:e.size,shape:t[e.shape]??0,fill:n[e.fill]??0,tribeIds:r}}}function sa(e){let r={square:0,round:1,diamond:2,vline:3,hline:4};li={centerX:e.x,centerY:e.y,brushSize:e.size,shape:r[e.shape]??0,visible:e.visible},!g&&!A&&!w&&te<=0&&H()}async function ua(){try{let e=await Go();ot({type:"snapshot",grid:e,generation:b,cols:_,rows:x,gridFormat:oe()},[e.buffer])}catch{let e=new Uint32Array(0);ot({type:"snapshot",grid:e,generation:b,cols:_,rows:x,gridFormat:oe()},[e.buffer])}}async function ca(e){let r=nt(e.gridFormat),t=ae();if(e.grid.byteLength===Z(t,r)){let n=Tr(e.grid,t,r,I);c.queue.writeBuffer(k?L:G,0,n),b=e.generation,Yt(),await gi(e.generation)}}function la(e){let r=g?.request,t=ee();e.recording&&t&&!R?(R=!0,z=!0,j(!0),we()):(!e.recording||!t)&&(e.recording&&!t&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:y,maxRecordingBufferBytes:er()}),R=!1,z=!1),r&&g?Wo(r):!g&&B&&re()}async function da(){Ze||(await Nt(),nr(!1),h>0&&tr(),K>0?Ze=!0:Xr())}async function fa(e){let r=Pr(C),t=ri(C,r,h,e.count);if(t){let n=k?L:G;if(t.source==="buffered"){let i=ti(v,t);h=i.chunkFrameIndex,v.length=h,b=i.generation,be=b;let o=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});o.copyBufferToBuffer(D,t.frameInChunk*y,n,0,y),c.queue.submit([o.finish()])}else{K>0&&(await Qo(),r=Pr(C));let i=C[t.sealedIndex],o=await Do(i.filename,i.codec),s=ae(),a=nt(i.gridFormat),u=ni(o,t.frameInChunk,y,s,a,I);if(c.queue.writeBuffer(D,0,u.chunkPrefix),!u.sameFormat&&u.activeFrame&&c.queue.writeBuffer(n,0,u.activeFrame),h=t.frameInChunk+1,v=i.generations.slice(0,t.frameInChunk+1),b=v[t.frameInChunk],be=b,u.sameFormat){let p=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});p.copyBufferToBuffer(D,t.frameInChunk*y,n,0,y),c.queue.submit([p.finish()])}let l=C.splice(t.sealedIndex);Fo(l.map(p=>p.filename))}Br(J,C,v),we(),Yt(),j(!0),H()}}function pa(){Kt(),nr(!0),!R||Ht()?(Xt(),me++,R&&Je()&&(h>=T&&tr(),rr(b)),ke(!1)):ke(!0),j(!0),H()}function ma(e){self.postMessage({type:"stepping",active:!0}),nr(!0),jt(qt(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:b+e},restoreAfterStop:{running:B,targetStepDuration:te}})}function ba(e){e.count===1?pa():ma(e.count)}function ga(){_i(g?.request.restoreAfterStop?.running??B)}function ha(e){let r=C.find(t=>t.filename===e.filename);r&&(r.codec=e.codec,r.storedBytes=e.storedBytes,r.gridFormat=e.gridFormat,J.chunks=[...C],we(),Xr())}function Sa(){let e=C.filter(r=>r.codec===Me).map(r=>({filename:r.filename,rawBytes:r.uncompressedBytes,blockCount:r.blockCount,cols:_,rows:x,rawGridFormat:r.gridFormat,storageGridFormat:Ae(ur(Yr.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:e})}async function ya(e){switch(e.type){case"init":await Jo(e);break;case"setLiveMetrics":ea(e);break;case"setRuleset":await ra(e);break;case"setRunning":ta(e);break;case"setSpeed":na(e);break;case"camera":ia(e);break;case"resize":oa(e);break;case"draw":aa(e);break;case"brushPreview":sa(e);break;case"getSnapshot":await ua();break;case"loadSnapshot":await ca(e);break;case"setRecording":la(e);break;case"getRecording":await da();break;case"stepBack":await fa(e);break;case"stepForward":ba(e);break;case"cancelStepping":ga();break;case"updateChunkCodec":ha(e);break;case"getUncompressedChunks":Sa();break}}self.onmessage=async e=>{await ya(e.data)};
