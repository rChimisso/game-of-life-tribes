var jt="goltTimestampedConsoleInstalled";function qi(){let e=globalThis;e[jt]||(e[jt]=!0,et("info"),et("warn"),et("error"),console.log=console.info.bind(console))}function et(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}qi();var Vt=`// Render shader: draws the grid as a full-screen quad.\r
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
  export_origin_x: u32,  // Visual export unwrap origin column.\r
  export_origin_y: u32,  // Visual export unwrap origin row.\r
  export_visible: u32,   // 1 when the visual export framing overlay should render.\r
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
fn exportMarkerPixel(local: vec2f, marker: vec2u) -> vec2f {\r
  let world = vec2f(f32(u.offset_cell.x), f32(u.offset_cell.y)) + local;\r
  let delta = vec2f(\r
    signedWrapWorldDelta(world.x, i32(marker.x), u.grid_size.x),\r
    signedWrapWorldDelta(world.y, i32(marker.y), u.grid_size.y)\r
  );\r
  return (delta - vec2f(0.5, 0.5)) * u.scale;\r
}\r
\r
fn exportMarkerMask(local: vec2f, marker: vec2u, includeCenterSquare: bool) -> bool {\r
  let p = exportMarkerPixel(local, marker);\r
  let arm = 32.0;\r
  let stroke = 2.0;\r
  let squareHalf = 8.0;\r
  let cross = (abs(p.x) <= stroke && abs(p.y) <= arm) || (abs(p.y) <= stroke && abs(p.x) <= arm);\r
  let centerSquare = includeCenterSquare && abs(p.x) <= squareHalf && abs(p.y) <= squareHalf;\r
  return cross || centerSquare;\r
}\r
\r
fn exportOriginMarkerMask(local: vec2f) -> bool {\r
  return exportMarkerMask(local, vec2u(u.export_origin_x, u.export_origin_y), false);\r
}\r
\r
fn exportCenterMarkerMask(local: vec2f) -> bool {\r
  let center = vec2u(\r
    wrapAdd(u.export_origin_x, u.grid_size.x / 2u, u.grid_size.x),\r
    wrapAdd(u.export_origin_y, u.grid_size.y / 2u, u.grid_size.y)\r
  );\r
  return exportMarkerMask(local, center, true);\r
}\r
\r
fn exportMarkerOutlineMask(local: vec2f, marker: vec2u, includeCenterSquare: bool) -> bool {\r
  let p = exportMarkerPixel(local, marker);\r
  let arm = 34.0;\r
  let stroke = 4.0;\r
  let squareHalf = 10.0;\r
  let cross = (abs(p.x) <= stroke && abs(p.y) <= arm) || (abs(p.y) <= stroke && abs(p.x) <= arm);\r
  let centerSquare = includeCenterSquare && abs(p.x) <= squareHalf && abs(p.y) <= squareHalf;\r
  return cross || centerSquare;\r
}\r
\r
fn exportOriginMarkerOutlineMask(local: vec2f) -> bool {\r
  return exportMarkerOutlineMask(local, vec2u(u.export_origin_x, u.export_origin_y), false);\r
}\r
\r
fn exportCenterMarkerOutlineMask(local: vec2f) -> bool {\r
  let center = vec2u(\r
    wrapAdd(u.export_origin_x, u.grid_size.x / 2u, u.grid_size.x),\r
    wrapAdd(u.export_origin_y, u.grid_size.y / 2u, u.grid_size.y)\r
  );\r
  return exportMarkerOutlineMask(local, center, true);\r
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
  if (u.export_visible == 1u && (exportCenterMarkerMask(local) || exportOriginMarkerMask(local))) {\r
    return vec4f(0.0, 0.0, 0.0, 1.0);\r
  }\r
\r
  if (u.export_visible == 1u && (exportCenterMarkerOutlineMask(local) || exportOriginMarkerOutlineMask(local))) {\r
    return vec4f(0.82, 0.84, 0.86, 1.0);\r
  }\r
\r
  return vec4f(r, g, b, 1.0);\r
}\r
`;function Qt(e){return Math.min(Math.max(1,Math.floor(+e||1)),100)}var rt=[1,2,4,8,16,32],Hi={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},ji={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Vi={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},cr={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Zi={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},tt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},J={1:Hi,2:ji,4:Vi,8:cr,16:Zi,32:tt};function Jt(e){return rt.includes(e)}function Qi(e){return 2**e}function nt(e,r){return r<=Qi(e)}function it(e,r,t){return ee(e,r)<=t}function lr(e){return e<=2?J[1]:e<=4?J[2]:e<=16?J[4]:e<=256?J[8]:e<=65536?J[16]:J[32]}function en(e){return lr(e)}function Ge(e){return J[e]}function rn(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){return ot(e,r,t)??tt}function ot(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of rt){let i=Ge(n);if(nt(n,e)&&it(r,i,t))return i}return null}function dr(e){return Ge(e?.bitsPerCell??8)}function Fe(e){return{bitsPerCell:e.bitsPerCell}}function de(e,r){return Math.ceil(e/r.cellsPerWord)}function ee(e,r){return de(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function tn(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}var Le={population:!0,diversity:!0,interfaces:!1},fr={enabled:!0,sections:Le};function Ji(e){return{population:typeof e?.population=="boolean"?e.population:Le.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Le.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Le.interfaces}}function at(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:fr.enabled,sections:Ji(e?.sections)}}function st(e,r){self.postMessage(e,r)}var v="dead";var ut="empty",nn="is",pr="comparison",mr="count",gr="none",br="exactly",hr="min",Sr="max",yr="not",Tr="and",Cr="or",vr="xor";async function on(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var d={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",recordingStepBatchEncoder:"recording step batch encoder",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var an=4294967295;function ct(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function N(e,r){return e.includes(r)}function sn(e,r,t,n){let i=e*r,o=i<=an,s=i*2<=an;return{population:ct(t&&n.population,o),diversity:ct(t&&n.diversity,o),interfaces:ct(t&&n.interfaces,s)}}function un(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var Ce=256*Uint32Array.BYTES_PER_ELEMENT,ve=Uint32Array.BYTES_PER_ELEMENT;function cn(e){return e.remapped?`
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
  let y = gid.y;`}function eo(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
`}function ro(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
`}function to(e,r){let{tribes:t,deadTribeIndex:n,readback:i,cols:o,rows:s}=e,a=o*s,u={};for(let f=0;f<t.length;f++){let p=r?i.histogram[f]??0:0;u[t[f].id]=p}let c=r?u[t[n]?.id??""]??0:0;return{population:u,aliveCells:r?Math.max(0,a-c):0,deadCells:c}}function no(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,i=0;for(let o=0;o<r.length;o++)o!==t&&(i+=n.histogram[o]??0);return i}function io(e,r){let{tribes:t,deadTribeIndex:n,readback:i}=e,o=r?no(e):0,s=0,a=0;for(let u=0;u<t.length;u++){let c=u!==n&&o>0?(i.histogram[u]??0)/o:0;c>0&&(s-=c*Math.log2(c),a+=c*c)}return{shannonEntropy:s,simpsonSum:a}}function oo(e,r){let t=e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,i=r?Math.max(0,t-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?i/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function fn(e){let{device:r}=e,t=r.createShaderModule({label:d.histogramMetricsShaderModule,code:eo(e)}),n=r.createComputePipeline({label:d.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),i=r.createBuffer({label:d.histogramMetricsBuffer,size:Ce,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=r.createBuffer({label:d.histogramMetricsReadBuffer,size:Ce,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=r.createShaderModule({label:d.interfaceMetricsShaderModule,code:ro(e)}),a=r.createComputePipeline({label:d.interfaceMetricsPipeline,layout:"auto",compute:{module:s,entryPoint:"main"}}),u=r.createBuffer({label:d.interfaceMetricsBuffer,size:ve,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),c=r.createBuffer({label:d.interfaceMetricsReadBuffer,size:ve,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:a,boundaryBuffer:u,boundaryReadBuffer:c}}function pn(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function mn(e){let{device:r,encoder:t,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:s}=e;if(N(s,"population")||N(s,"diversity")){let a=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,a);let u=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),c=t.beginComputePass({label:d.histogramMetricsPass});c.setPipeline(n.histogramPipeline),c.setBindGroup(0,u),c.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),c.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Ce)}if(N(s,"interfaces")){let a=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,a);let u=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),c=t.beginComputePass({label:d.interfaceMetricsPass});c.setPipeline(n.boundaryPipeline),c.setBindGroup(0,u),c.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),c.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,ve)}}async function gn(e){let{resources:r,enabledSections:t}=e,n=N(t,"population")||N(t,"diversity"),i=N(t,"interfaces"),o=[];n&&o.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let s=new Uint32Array(256);n&&(s=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let a=0;if(i){let u=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),a=u[0]??0}return{histogram:s,crossStateContactEdges:a}}function bn(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:i,cols:o,rows:s,totalFrames:a,fps:u,canStepBack:c,recordingBytes:f,recordingRawBytes:p}=e,m=N(t,"population")&&i.population,_=N(t,"diversity")&&i.diversity,$=N(t,"interfaces")&&i.interfaces,D=o*s,Te=to(e,m),le=io(e,_),Xi=oo(e,$);return{type:"metrics",generation:r,population:Te.population,aliveCells:Te.aliveCells,deadCells:Te.deadCells,occupancy:m&&D>0?Te.aliveCells/D:0,shannonEntropy:le.shannonEntropy,simpsonIndex:_?1-le.simpsonSum:0,interfaces:Xi,metricsAvailability:n,extinctionTime:{},totalFrames:a,fps:u,canStepBack:c,recordingBytes:f,recordingRawBytes:p}}function ao(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}function hn(e,r,t,n,i){let o=de(r.cols,t),s=e[i*o+(n>>t.wordShift)]??0;return ao(s,t,n&t.cellIndexMask)}function Sn(e,r,t,n,i,o){let s=de(r.cols,t),a=i*s+(n>>t.wordShift),u=(n&t.cellIndexMask)<<t.cellShift,c=~(t.cellMask<<u),f=e[a]??0;e[a]=(f&c|(o&t.cellMask)<<u)>>>0}var so=64*1024*1024,vs=256*1024*1024;function Mr(e,r,t,n){let i=e,o;if(t.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(ee(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let s=0;s<r.rows;s++)for(let a=0;a<r.cols;a++)Sn(o,r,n,a,s,hn(i,r,t,a,s))}return o}function yn(e,r,t){let n=Math.floor((r-1)/2),i=e-n,o=i+r,s=[];if(i>=0&&o<=t)s.push({destinationStart:i,localStart:0,span:r});else if(i<0){let a=-i;s.push({destinationStart:t-a,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:r-a})}else{let a=t-i;s.push({destinationStart:i,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:o-t})}return s.filter(a=>a.span>0)}function Tn(e){return`
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
  density: u32,
  pad1: u32,
  pad2: u32,
  tribeIdGroups: array<vec4u, 8>,
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

fn brushTribeId(index: u32) -> u32 {
  let group = params.tribeIdGroups[index >> 2u];
  switch (index & 3u) {
    case 1u: {
      return group.y;
    }
    case 2u: {
      return group.z;
    }
    case 3u: {
      return group.w;
    }
    default: {
      return group.x;
    }
  }
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
        let selectedTribe = brushTribeId(h % params.tribeCount);
        let densityHash = pcg(params.seed ^ idx ^ spatialHash ^ 1013904223u);
        let selectedForDraw = (densityHash % 100u) < params.density;
        var shouldWrite = selectedForDraw || params.fill == 1u;
        var value = selectedTribe;

        if (!selectedForDraw && params.fill == 1u) {
          value = params.deadId;
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
`}function Cn(e,r,t,n){let i=yn(e,t,n.cols),o=yn(r,t,n.rows),s=[];for(let a of o)for(let u of i)s.push({destinationStartX:u.destinationStart,destinationStartY:a.destinationStart,localStartX:u.localStart,localStartY:a.localStart,spanCols:u.span,spanRows:a.span});return s}var vn={"=":"==","\u2260":"!=",">":">","<":"<","\u2265":">=","\u2264":"<="};function uo(e){let r;return typeof e=="string"?r=Mn([e]):r=A(e),r}function Mn(e){return{kind:"tribes",tribes:[...e&&e.length>0?e:[v]]}}function A(e,r){let t=e??Mn(r),n;switch(t.kind){case"tribes":n={...t,tribes:[...t.tribes]};break;case"tiedMajority":n={...t,source:A(t.source)};break;default:n={...t};break}return n}function Oe(e,r){return{kind:"count",selector:A(e?.selector,r)}}function xr(e){return JSON.stringify(re(e))}function re(e){let r;switch(e.kind){case"tribes":r={...e,tribes:[...new Set(e.tribes)].sort()};break;case"tiedMajority":r={...e,source:re(e.source)};break;default:r=e;break}return r}function xn(e){return e.become??{kind:"fixed",tribe:e.tribe??v}}function De(e){let r;switch(e.kind){case"majority":case"minority":r={...e,selector:A(e.selector),tie:e.tie?De(e.tie):void 0,fallback:e.fallback?De(e.fallback):void 0};break;case"combine":r={kind:"combine",strategy:{...e.strategy,entries:e.strategy.entries.map(t=>({...t,inputs:t.inputs.map(n=>uo(n)).sort((n,i)=>xr(n).localeCompare(xr(i)))})),default:e.strategy.default?De(e.strategy.default):void 0}};break;default:r={...e};break}return r}function co(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function lo(e,r){e.push(`const CELLS_PER_WORD: u32 = ${r.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${r.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${r.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${r.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${r.cellMask}u;`)}function fo(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function po(e,r,t){r.remapped?(e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;")):(e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;"))}function mo(e){let r=Bo(e),t=new Map,n=0;for(let i of r)t.set(i,`count_${n++}`);return t}function go(e,r){let t=ko(e),n=new Map,i=0;for(let o of t){let s=r.get(o);s?n.set(o,s):n.set(o,`eq_count_${i++}`)}return n}function bo(e,r,t,n){for(let[i,o]of r)e.push(`  let ${o} = ${ft(Pn(i),t,n)};`);r.size>0&&e.push("")}function ho(e,r,t,n,i){let o=0;for(let[s,a]of t)r.has(s)||(e.push(`  let ${a} = ${ft(Pn(s),n,i)};`),o++);o>0&&e.push("")}function So(e,r,t,n,i,o){for(let s=0;s<r.length;s++){let a=r[s],u=$e(a.clause,t,n,i,o);e.push(s===0?`  if (${u}) {`:`  } else if (${u}) {`),dt(e,De(xn(a)),i,o,`rule_${s}`,"    ")}r.length>0&&e.push("  }"),e.push("")}function dt(e,r,t,n,i,o,s=null){switch(r.kind){case"fixed":e.push(`${o}result = ${W(r.tribe,n)}u;`);break;case"same":e.push(`${o}result = selfTribe;`);break;case"majority":case"minority":yo(e,r,t,n,i,o);break;case"combine":To(e,r,t,n,i,o,s);break}}function yo(e,r,t,n,i,o){let s=A(r.selector),a=`${i}_${r.kind}`,u=`${i}_${r.kind}_count`,c=`${i}_${r.kind}_ties`,f=r.kind==="majority"?"0u":"9u",p=r.kind==="majority"?`candidateCount > ${u}`:`candidateCount < ${u}`;e.push(`${o}var ${a}: u32 = ${W(v,n)}u;`),e.push(`${o}var ${u}: u32 = ${f};`),e.push(`${o}var ${c}: u32 = 0u;`);for(let m of Br(s,t,n)){let _=Y(D=>`${D} == ${m}u`),$=Me(s,m,n);e.push(`${o}{`),e.push(`${o}  let candidateCount = ${_};`),e.push(`${o}  if (${$} && candidateCount > 0u) {`),e.push(`${o}    if (${p}) {`),e.push(`${o}      ${a} = ${m}u;`),e.push(`${o}      ${u} = candidateCount;`),e.push(`${o}      ${c} = 1u;`),e.push(`${o}    } else if (candidateCount == ${u}) {`),e.push(`${o}      ${c} = ${c} + 1u;`),e.push(`${o}    }`),e.push(`${o}  }`),e.push(`${o}}`)}e.push(`${o}if (${c} == 1u) {`),e.push(`${o}  result = ${a};`),e.push(`${o}} else if (${c} > 1u) {`),r.tie?dt(e,r.tie,t,n,`${i}_tie`,`${o}  `,{selector:s,bestCountVar:u,tieCountVar:c}):_r(e,r.fallback,t,n,`${i}_tie_fallback`,`${o}  `),e.push(`${o}} else {`),_r(e,r.fallback,t,n,`${i}_fallback`,`${o}  `),e.push(`${o}}`)}function _r(e,r,t,n,i,o){r?dt(e,r,t,n,i,o):e.push(`${o}result = ${W(v,n)}u;`)}function To(e,r,t,n,i,o,s){let a=`${i}_input_mask`;e.push(`${o}var ${a}: u32 = 0u;`);for(let p of xo(t,n,s)){let m=Bn(p,n,s);e.push(`${o}if (${m}) {`),e.push(`${o}  ${a} = ${a} | ${kn(p)};`),e.push(`${o}}`)}let u=`${i}_dead_present`,c=Y(p=>`${p} == ${W(v,n)}u`);e.push(`${o}let ${u} = ${c} > 0u;`);let f=[...r.strategy.entries].sort((p,m)=>Number(lt(m,n))-Number(lt(p,n)));f.forEach((p,m)=>{let _=_o(p.inputs,t,n,s),$=lt(p,n)?` && ${u}`:"",D=`${a} == (${_})${$}`;e.push(m===0?`${o}if (${D}) {`:`${o}} else if (${D}) {`),e.push(`${o}  result = ${W(p.output,n)}u;`)}),f.length>0?(e.push(`${o}} else {`),_r(e,r.strategy.default,t,n,`${i}_fallback`,`${o}  `),e.push(`${o}}`)):_r(e,r.strategy.default,t,n,`${i}_fallback`,o)}function Co(e){for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(`    let ${Rn(t,r)} = readCell(${_n("x",t,"COLS")}, ${_n("y",r,"ROWS")});`)}function ft(e,r,t){let n=re(e),i;switch(n.kind){case"same":i=Y(o=>`${o} == selfTribe`);break;case"different":i=Y(o=>`${o} != selfTribe`);break;case"tiedMajority":i=ft(n.source,r,t);break;case"tribes":{let o=Ne(n.tribes,t);i=o.length===0?"0u":Y(s=>o.map(a=>`${s} == ${a}u`).join(" || "));break}}return i}function Y(e){return vo().map(r=>`select(0u, 1u, ${e(r)})`).join(" + ")}function Rn(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function vo(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(Rn(t,r));return e}function _n(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function Ne(e,r){let t=[];for(let n of e)t.push(Rr(n,r,"selector"));return[...new Set(t)]}function W(e,r){return Rr(e,r,"target")}function Rr(e,r,t){let n=r.get(e),i=r.get(v)??0;return n===void 0&&console.error(`Unknown rule ${t} tribe; using dead tribe instead.`,{tribe:e}),n??i}function Br(e,r,t){let n=re(e),i;switch(n.kind){case"tribes":i=Ne(n.tribes,t);break;case"tiedMajority":i=Br(n.source,r,t);break;default:i=r.map(o=>Rr(o.id,t,"selector"));break}return[...new Set(i)].sort((o,s)=>o-s)}function Me(e,r,t){let n=re(e),i;switch(n.kind){case"same":i=`selfTribe == ${r}u`;break;case"different":i=`selfTribe != ${r}u`;break;case"tiedMajority":i=Me(n.source,r,t);break;case"tribes":{i=Ne(n.tribes,t).includes(r)?"true":"false";break}}return i}function Mo(e,r,t,n){let i=re(e),o;if(i.kind==="tiedMajority"&&n){let s=Y(u=>`${u} == ${r}u`),a=Me(n.selector,r,t);o=`(${n.tieCountVar} > 1u && ${n.bestCountVar} > 0u && ${a} && ${s} == ${n.bestCountVar})`}else{let s=Y(u=>`${u} == ${r}u`);o=`(${Me(i.kind==="tiedMajority"?i.source:i,r,t)} && ${s} > 0u)`}return o}function xo(e,r,t){let n;return t?n=Br(t.selector,e,r):n=e.map(i=>Rr(i.id,r,"selector")),[...new Set(n)].filter(i=>i!==W(v,r)).sort((i,o)=>i-o)}function Bn(e,r,t){let n;if(t){let i=Y(s=>`${s} == ${e}u`),o=Me(t.selector,e,r);n=`(${e}u != ${W(v,r)}u && ${t.tieCountVar} > 1u && ${t.bestCountVar} > 0u && ${o} && ${i} == ${t.bestCountVar})`}else{let i=Y(o=>`${o} == ${e}u`);n=`(${e}u != ${W(v,r)}u && ${i} > 0u)`}return n}function _o(e,r,t,n){let i=[];for(let o of e){let s=A(o);for(let a of Br(s,r,t))if(a!==W(v,t)){let u=Ro(s,a,t,n);i.push(`select(0u, ${kn(a)}, ${u})`)}}return i.length>0?i.join(" | "):"0u"}function lt(e,r){let t=W(v,r);return e.inputs.some(n=>{let i=A(n);return i.kind==="tribes"&&Ne(i.tribes,r).includes(t)})}function Ro(e,r,t,n){let i=re(e),o;if(n){let s=Bn(r,t,n),a=Me(i.kind==="tiedMajority"?i.source:i,r,t);o=`(${s} && ${a})`}else o=Mo(i,r,t,null);return o}function kn(e){return`(1u << ${e}u)`}function En(e){return xr(e)}function Pn(e){return JSON.parse(e)}function wn(e,r){let t=new Set,n=o=>{t.add(En(o))},i=o=>{switch(r(o,n),o.kind){case yr:i(o.clause);break;case Tr:case Cr:case vr:for(let s of o.clauses)i(s);break}};for(let o of e)i(o);return t}function Bo(e){return wn(e,(r,t)=>{switch(r.kind){case gr:case br:case hr:case Sr:case mr:t(A(r.selector,r.tribes));break}})}function ko(e){return wn(e,(r,t)=>{r.kind===pr&&(t(Oe(r.left,r.tribe1).selector),t(Oe(r.right,r.tribe2).selector))})}function $e(e,r,t,n,i){switch(e.kind){case ut:return"false";case nn:return Eo(e.tribes,n,i);case mr:return Ue(fe(A(e.selector,e.tribes),r),e.interval[0],e.interval[1]);case gr:return Ue(fe(A(e.selector,e.tribes),r),0,0);case br:return Ue(fe(A(e.selector,e.tribes),r),e.value,e.value);case hr:return Ue(fe(A(e.selector,e.tribes),r),e.value,8);case Sr:return Ue(fe(A(e.selector,e.tribes),r),0,e.value);case pr:return Po(e,t);case yr:return`!(${$e(e.clause,r,t,n,i)})`;case Tr:return`(${e.clauses.map(o=>$e(o,r,t,n,i)).join(" && ")})`;case Cr:return`(${e.clauses.map(o=>$e(o,r,t,n,i)).join(" || ")})`;case vr:return wo(e.clauses,r,t,n,i);default:return"false"}}function Eo(e,r,t){let n=Ne(e,t);return n.length===0?"false":n.length===r.length?"true":`(${n.map(i=>`selfTribe == ${i}u`).join(" || ")})`}function Ue(e,r,t){return`(${e} >= ${r}u && ${e} <= ${t}u)`}function Po(e,r){let t=Oe(e.left,e.tribe1).selector,n=Oe(e.right,e.tribe2).selector,i=vn[e.operator]??"==",o=Math.max(-8,Math.min(8,e.margin??0));return`(i32(${fe(t,r)}) ${i} (i32(${fe(n,r)}) + ${o}i))`}function wo(e,r,t,n,i){return`(((${e.map(o=>$e(o,r,t,n,i)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`}function fe(e,r){return r.get(En(e))}function pt(e,r,t){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,i=Math.min(n,t),o=Math.ceil(n/i);if(o<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:i,dispatchWgY:o,remapped:!0};throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`)}function An(e,r,t,n,i,o,s){let a=[],u=e.rules.filter(m=>!m.muted),c=s.get(v)??0,f=mo(u.map(m=>m.clause)),p=go(u.map(m=>m.clause),f);return a.push("// Auto-generated simulation compute shader."),a.push(`// Tribes: ${r.map(m=>m.id).join(", ")}`),a.push(`// Rules: ${e.rules.length}`),a.push(""),a.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),a.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),a.push(""),a.push(`const COLS: u32 = ${n.cols}u;`),a.push(`const ROWS: u32 = ${n.rows}u;`),a.push(`const PACKED_COLS: u32 = ${t}u;`),co(a,i),lo(a,o),a.push(""),fo(a,"gridIn","PACKED_COLS"),a.push(""),a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {"),bo(a,f,r,s),ho(a,f,p,r,s),a.push(`  var result: u32 = ${c}u;`),a.push(""),So(a,u,f,p,r,s),a.push("  return result;"),a.push("}"),a.push(""),a.push("@compute @workgroup_size(16, 16)"),i.remapped?a.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):a.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),po(a,i,"px"),a.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),a.push(""),a.push("  let baseX = px << WORD_SHIFT;"),a.push("  var packed: u32 = 0u;"),a.push(""),a.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),a.push("    let x = baseX + i;"),a.push("    if (x >= COLS) { break; }"),a.push(""),a.push("    let selfTribe = readCell(x, y);"),Co(a),a.push(""),a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),a.push("  }"),a.push(""),a.push("  gridOut[y * PACKED_COLS + px] = packed;"),a.push("}"),a.join(`
`)}var xe=3,We="gol-recording",pe="raw-packed",mt="deflate-raw",gt=12,bt=256*1024*1024,In=512*1024*1024;function ht(e,r,t=0){let n=t;for(let i of e)n+=i[r];return n}function Gn(e,r){return Math.min(e,r)}function St(e){return Math.min(e,1073741824)}function Fn(e){return Math.min(e,In)}function yt(e,r){return Math.max(e*2,r*6)}function kr(e,r){return e>0&&e<=r}function Go(e,r){return e>0?e*2+r:0}function Fo(e,r){return e>=1&&r>0?e*r*(1+xe):0}function Lo(e,r){return e<bt?Math.min(bt,r):e}function Ln(e,r){return kr(e,r)?Math.max(1,Math.floor(Lo(e,r)/e)):0}function Er(e,r){return e>=1&&r>0?Math.max(1,Math.min(gt,Math.floor(536870912/(e*r)))):gt}function Dn(e,r,t,n,i,o){let s=!r.some(u=>u)&&(i||o>=e),a=i?Math.floor(n/2)+1:n;return e>=1&&r.length>0&&(s||t>=a)}function On(e,r,t,n){return e<r&&n.some((i,o)=>t[o]&&i.mapState==="unmapped")}function Un(e,r,t,n,i,o){return e&&r>=1&&t!==null&&n.length>0&&(i<r||o)}function $n(e,r,t,n){let i=e.quota??0,o=e.usage??0,s=0,a=0;for(let f of r)f.codec===pe?s+=f.storedBytes:a+=f.storedBytes;let u=t*n,c=(1+xe)*u;return{quotaBytes:i,usedBytes:o,pendingRawBytes:s,compressedBytes:a,reservedBytes:c}}function Nn(e,r,t,n,i){let o=St(e);return{maxBytes:e,vramBudgetBytes:yt(e,o),frameByteSize:r,recordingAvailable:kr(r,o),vramSimulationBytes:Go(r,n),vramRecordingBytes:Fo(t,r),gridFormat:i}}function ze(e,r,t){r.length>0&&(e.generationStart=r[0].generationStart,e.generationEnd=r[r.length-1].generationEnd),t.length>0&&(r.length===0&&(e.generationStart=t[0]),e.generationEnd=t[t.length-1]),e.chunks=[...r]}function Wn(e){return e.map(r=>({...r,generations:[...r.generations]}))}function zn(e,r){return e!==r}function Xe(e,r=0){return ht(e,"blockCount",r)}function Xn(e){return ht(e,"storedBytes")}function qn(e){return ht(e,"uncompressedBytes")}var Do=256,qe=80,Kn=Do*Uint32Array.BYTES_PER_ELEMENT;function Yn(e){let r=new ArrayBuffer(qe),t=new Float32Array(r),n=new Int32Array(r),i=new Uint32Array(r),o=(e.offsetX%e.grid.cols+e.grid.cols)%e.grid.cols,s=(e.offsetY%e.grid.rows+e.grid.rows)%e.grid.rows,a=Math.floor(o),u=Math.floor(s);return t[0]=e.canvasWidth,t[1]=e.canvasHeight,t[2]=e.scale,t[4]=o-a,t[5]=s-u,i[6]=e.grid.cols,i[7]=e.grid.rows,i[8]=a,i[9]=u,i[10]=e.tribeCount,n[12]=e.brushPreview.centerX,n[13]=e.brushPreview.centerY,i[14]=e.brushPreview.brushSize,i[15]=e.brushPreview.shape,i[16]=e.brushPreview.visible?1:0,i[17]=e.exportFrameOverlay.originX,i[18]=e.exportFrameOverlay.originY,i[19]=e.exportFrameOverlay.visible?1:0,r}function Hn(e){let r=new Uint32Array(e.length);for(let t=0;t<e.length;t++){let n=e[t].color,i=parseInt(n.substring(0,2),16),o=parseInt(n.substring(2,4),16),s=parseInt(n.substring(4,6),16);r[t]=i|o<<8|s<<16}return r}function jn(e,r){return e.replace("__CELLS_PER_WORD__",`${r.cellsPerWord}u`).replace("__WORD_SHIFT__",`${r.wordShift}u`).replace("__CELL_SHIFT__",`${r.cellShift}u`).replace("__CELL_INDEX_MASK__",`${r.cellIndexMask}u`).replace("__CELL_MASK__",`${r.cellMask}u`)}var Oo=500,Uo=33,$o=2,No=.5,Vn=.2,Zn=1,Wo=1048576;function Qn(e){return Math.min(3,Math.max(0,Math.ceil(Math.log10(e.cols*e.rows/1e5))))}function Ke(e){return 1024/4**Qn(e)}function Pr(e){return 16/2**Qn(e)}function zo(e){return Math.max(Zn,Math.round(Ke(e)*Pr(e)))}function Jn(e,r){return{generationsPerDrain:zo(e),targetDrainMs:r.kind==="max"?Oo:Uo,smoothedDrainMs:0,lastDrainStartedAt:0,lastSubmittedGenerations:0}}function ei(e,r){if(r>0&&e.lastSubmittedGenerations>0){let t=e.smoothedDrainMs===0?r:e.smoothedDrainMs*(1-Vn)+r*Vn,n=Math.min($o,Math.max(No,e.targetDrainMs/t));e.smoothedDrainMs=t,e.generationsPerDrain=Math.max(Zn,Math.min(Wo,Math.round(e.generationsPerDrain*n)))}}function Tt(e,r){return e==="recording"?Number.MAX_SAFE_INTEGER:Ke(r)*Pr(r)}function Ct(e,r,t,n,i){let o=e-r*n;return t>n||t>i?Math.min(o,r):o}function ri(e){return e<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/e}}function H(e){return e.request.stopCondition.kind==="targetGeneration"}function _e(e,r){return e.request.stopCondition.kind==="targetGeneration"&&r>=e.request.stopCondition.generation}function j(e,r){return e.request.stopCondition.kind==="targetGeneration"?Math.max(0,e.request.stopCondition.generation-r):Number.POSITIVE_INFINITY}function ti(e,r){return r.restore!==!1&&e.request.restoreAfterStop||null}function ni(e,r,t){return r&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")}function ii(e,r,t,n,i){return e.restartRestoredRun!==!1&&r&&t&&!n&&!i}function vt(e,r,t,n){let i=r+t,o=Math.min(n,i-1);if(o<=0)return null;let s=i-1-o;if(s>=r)return{source:"buffered",frameInChunk:s-r};let a=0;for(let u=0;u<e.length;u++){let c=e[u];if(s<a+c.blockCount)return{source:"sealed",sealedIndex:u,frameInChunk:s-a};a+=c.blockCount}return null}function oi(e,r){return{chunkFrameIndex:r.frameInChunk+1,generation:e[r.frameInChunk]}}function Mt(e,r,t,n,i,o){let s=(r+1)*t;if(i.bitsPerCell===o.bitsPerCell)return{sameFormat:!0,chunkPrefix:new Uint8Array(e,0,s),activeFrame:null};let a=ee(n,i),u=new Uint8Array(s);for(let c=0;c<=r;c++){let f=new Uint8Array(e,c*a,a),p=Mr(tn(f),n,i,o);u.set(new Uint8Array(p.buffer,p.byteOffset,p.byteLength),c*t)}return{sameFormat:!1,chunkPrefix:u,activeFrame:u.subarray(r*t,s)}}var l,M=!1,Nr,Ar,be,Yr,P=0,w=0,Hr=0,R=cr,Ee=[],Pe=new Map,Rt,Bt,I,G,we,Be,Qe,kt,Et,Ir,ci,li,L=!1,di=1,fi=0,pi=0,B=!1,x=!1,Q=100,g=0,Ae=0,Ye=0,jr=0,Gr,Xo=4,Nt=192,ge=[],Wr=[],zr=[],qo=0,Fr=null,mi={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},gi={originX:0,originY:0,visible:!1},ae=null,Lr=-1,ke=!1,He=!1,xt=0,Je=fr,Dr=[],E=!1,O=!1,V={chunks:[],generationStart:0,generationEnd:0,gridFormat:Fe(cr)},bi=0,y=[],er=!1,b=null,hi=0,Or=!1,U=null,S=0,C=[],se=null,T=64,h=0,ue=[],z=[],je=null,me=null,X=0,rr=0,te=0,Z=!1,Re=0,Ur=0,$r=0,Ve=[];function Si(e){switch(!0){case e instanceof Error:return e.message;case typeof e=="string":return e;case(e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"):return e.message;default:return String(e??"Unknown worker error")}}function Vr(e){console.error("[GOLT worker] Worker GPU error:",e),k("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),B=!1,self.postMessage({type:"gpuError",reason:Si(e)})}self.addEventListener("error",e=>{e.preventDefault(),Vr(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),Vr(e.reason)});async function Wt(){await l.queue.onSubmittedWorkDone()}function ai(e){Ur=0,$r=2+(e?1+xe:0),Ve=[]}async function Xr(){if(Ve.length>0){let e=l.createCommandEncoder({label:d.trackedAllocationClearEncoder});for(let r of Ve)e.clearBuffer(r);l.queue.submit([e.finish()]),await Wt(),Ve=[]}}async function qr(e,r){x&&$r>0&&(Ur+=e,$r--,Ve.push(r),Ur>=Fn(he())&&$r>0&&(await Xr(),Ur=0))}function Kr(){U?.destroy(),U=null;for(let e of ue)e?.destroy();ue=[],z=[],T=0,S=0,C=[],se=null,rr=0}function si(){I?.destroy(),G?.destroy(),pn(ae),ae=null,ge.forEach(e=>e.destroy()),ge=[],Wr=[],zr=[],Kr()}function wr(e){let r=X>0;X+=e;let t=X>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function ne(){let e=Dn(T,z,te,Er(T,h),Z,S);e!==Z&&(Z=e,self.postMessage({type:"backpressure",active:e}))}async function ye(){self.postMessage({type:"storageQuota",...$n(await navigator.storage.estimate(),y,T,h)})}function he(){return Gn(l.limits.maxBufferSize,l.limits.maxStorageBufferBindingSize)}function ir(){return St(he())}function ie(){return kr(h,ir())}function yi(){return On(te,Er(T,h),z,ue)}function tr(){return Un(ie(),T,U,ue,S,yi())}async function Ko(e){let r=new DecompressionStream(mt),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],i=r.readable.getReader();for(;;){let{done:u,value:c}=await i.read();if(u)break;n.push(c)}let o=0;for(let u of n)o+=u.byteLength;let s=new Uint8Array(o),a=0;for(let u of n)s.set(u,a),a+=u.byteLength;return s.buffer}function q(){return{cols:P,rows:w}}function Yo(){return pt(Math.ceil(Hr/16),Math.ceil(w/16),l.limits.maxComputeWorkgroupsPerDimension)}function Ho(){return pt(Math.ceil(P/16),Math.ceil(w/16),l.limits.maxComputeWorkgroupsPerDimension)}function Pt(){we?.destroy(),we=l.createBuffer({label:d.uniformBuffer,size:qe,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function jo(){let e=Yn({canvasWidth:be.width,canvasHeight:be.height,scale:di,offsetX:fi,offsetY:pi,grid:q(),tribeCount:Ee.length,brushPreview:mi,exportFrameOverlay:gi});l.queue.writeBuffer(we,0,e)}function Zr(){return ee({cols:P,rows:w},R)}function ce(){return Fe(R)}async function wt(){let e=Zr();I=l.createBuffer({label:d.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await qr(e,I),G=l.createBuffer({label:d.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await qr(e,G);let r=l.createCommandEncoder({label:d.gridClearEncoder});r.clearBuffer(I),r.clearBuffer(G),l.queue.submit([r.finish()]),L=!1}function At(){let e=Hn(Ee);Be&&Be.destroy(),Be=l.createBuffer({label:d.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),l.queue.writeBuffer(Be,0,e)}function It(){let e=l.createShaderModule({label:d.renderShaderModule,code:jn(Vt,R)});Qe=l.createRenderPipeline({label:d.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:Ar}]},primitive:{topology:"triangle-list"}})}function Gt(){kt=l.createBindGroup({layout:Qe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:we}},{binding:1,resource:{buffer:I}},{binding:2,resource:{buffer:Be}}]}),Et=l.createBindGroup({layout:Qe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:we}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:Be}}]})}function Ft(){Rt=Yo();let e=An(Yr,Ee,Hr,q(),Rt,R,Pe),r=l.createShaderModule({label:d.simulationShaderModule,code:e});Ir=l.createComputePipeline({label:d.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),ci=l.createBindGroup({layout:Ir.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:I}},{binding:1,resource:{buffer:G}}]}),li=l.createBindGroup({layout:Ir.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:I}}]})}function Lt(){Bt=Ho(),ae=fn({device:l,cols:P,rows:w,gridFormat:R,dispatchPlan:Bt})}function Dt(){let e=l.createShaderModule({label:d.brushShaderModule,code:Tn(R)});Gr=l.createComputePipeline({label:d.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),ge.forEach(r=>r.destroy()),ge=[],Wr=[],zr=[];for(let r=0;r<Xo;r++){let t=l.createBuffer({label:`${d.brushUniformBuffer} ${r}`,size:Nt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});ge.push(t),Wr.push(l.createBindGroup({layout:Gr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:I}},{binding:1,resource:{buffer:t}}]})),zr.push(l.createBindGroup({layout:Gr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:t}}]}))}}function Vo(e,r){let t=Pe.get(v)??0,n=qo++,i=Cn(r.centerX,r.centerY,r.brushSize,q()),o=L?zr:Wr;for(let[s,a]of i.entries()){let u=new ArrayBuffer(Nt),c=new Uint32Array(u);c[0]=Hr,c[1]=r.brushSize,c[2]=r.shape,c[3]=r.fill,c[4]=t,c[5]=n,c[6]=r.tribeIds.length,c[7]=a.destinationStartX,c[8]=a.destinationStartY,c[9]=a.localStartX,c[10]=a.localStartY,c[11]=a.spanCols,c[12]=a.spanRows,c[13]=r.density,c[14]=0,c[15]=0;for(let m=0;m<r.tribeIds.length&&m<32;m++)c[16+m]=r.tribeIds[m];let f=ge[s],p=o[s];if(f&&p){l.queue.writeBuffer(f,0,u);let m=Math.floor(a.destinationStartX/R.cellsPerWord),$=Math.ceil((a.destinationStartX+a.spanCols)/R.cellsPerWord)-m,D=Math.ceil($/8),Te=Math.ceil(a.spanRows/8),le=e.beginComputePass({label:d.brushPass});le.setPipeline(Gr),le.setBindGroup(0,p),le.dispatchWorkgroups(D,Te),le.end()}else throw console.error("[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.",{index:s,rectCount:i.length,bindGroupCount:o.length,uniformBufferCount:ge.length}),new Error("Brush dispatch resources are out of sync with the wrapped brush rectangles.")}}function Zo(){let e=L?G:I,r=Zr(),t;try{t=l.createBuffer({label:d.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=l.createCommandEncoder({label:d.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),l.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),i})}function Ti(){h=Zr(),T=Ln(h,ir())}function Ot(){self.postMessage({type:"limits",...Nn(he(),h,T,qe+Kn+Nt+Ce*2+ve*2,ce())})}function Ci(){return T>=1&&U!==null&&S<T}function vi(e,r){let t=L?G:I,n=S*h;e.copyBufferToBuffer(t,0,U,n,h),C.push(r),se=r,S++}function zt(e){if(Ci()){let r=l.createCommandEncoder({label:d.recordingFrameCopyEncoder});vi(r,e),l.queue.submit([r.finish()]),Ze()}}function _t(e){rr=Math.max(0,rr+e)}function Ze(){T>0&&S>=T&&yi()&&or()}function or(){let e=U;if(e!==null&&S>0&&ue.length>0&&te<Er(T,h)){let r=z.indexOf(!0);if(r>=0){z[r]=!1;let t=ue[r];if(t.mapState==="unmapped"){let n=S*h,i=bi++,o=[...C],s=o[0],a=o[o.length-1],u=`chunk-${String(i).padStart(6,"0")}.bin`,c=S,f=l.createCommandEncoder({label:d.recordingSealCopyEncoder});f.copyBufferToBuffer(e,0,t,0,n),l.queue.submit([f.finish()]);let p={chunkId:i,generationStart:s,generationEnd:a,blockCount:c,codec:pe,uncompressedBytes:n,storedBytes:n,gridFormat:ce(),generations:o,filename:u};wr(1),_t(c),te++,ne();let m=Re;t.mapAsync(GPUMapMode.READ).then(async()=>{let _=t.getMappedRange(),$=new ArrayBuffer(n);new Uint8Array($).set(new Uint8Array(_,0,n)),t.unmap(),m===Re&&(z[r]=!0,y.push(p),_t(-c),ze(V,y,C),ne(),Ze(),Qo(p,$).then(()=>{m===Re&&(te--,ne(),wr(-1),ye(),nr(),K(!0),Ze(),self.postMessage({type:"chunkSealed",filename:p.filename,rawBytes:n,blockCount:p.blockCount,cols:P,rows:w,rawGridFormat:p.gridFormat,storageGridFormat:Fe(lr(Yr.tribes.length))}),er&&X===0&&(er=!1,nr()))}).catch(D=>{m===Re&&(te--,ne(),wr(-1),ta(p,D).catch(Vr))}))}).catch(()=>{m===Re&&(z[r]=!0,te--,_t(-c),ne(),wr(-1),Ze())}),S=0,C=[]}else z[r]=!0}}}async function Mi(e){Re++,bi=0,S=0,C=[],y=[],se=null,rr=0,te=0,X>0&&(X=0,self.postMessage({type:"chunksSaving",active:!1})),Z&&(Z=!1,self.postMessage({type:"backpressure",active:!1})),er=!1,O=E,V={chunks:[],generationStart:e,generationEnd:e,gridFormat:ce()},await _i(),ye()}async function Xt(){return me&&await me,je||(je=await(await navigator.storage.getDirectory()).getDirectoryHandle(We,{create:!0})),je}async function Qo(e,r){let t=await Xt(),i=await(await t.getFileHandle(e.filename,{create:!0})).createWritable(),o=!1;try{await i.write(r),await i.close(),o=!0,i=null}catch(s){if(i&&!o)try{await i.abort()}catch(a){console.warn("[GOLT worker] Failed to abort recording chunk write after error:",a)}try{await t.removeEntry(e.filename)}catch(a){a instanceof DOMException&&a.name==="NotFoundError"||console.warn("[GOLT worker] Failed to remove failed recording chunk:",e.filename,a)}throw s}}function Jo(e){let r=Si(e).toLowerCase();return e instanceof DOMException&&e.name==="QuotaExceededError"||r.includes("storage quota")||r.includes("quota exceeded")||r.includes("exceed its storage quota")}function xi(e){let r=y.findIndex(t=>t.filename===e.filename);r>=0&&y.splice(r,1)}async function ea(){let e=null,r=Xe(y),t=vt(y,r,0,1);if(t?.source==="sealed"){let{frameInChunk:n}=t,i=y[t.sealedIndex];try{let o=(n+1)*h,s=await Ri(i.filename,i.codec),a=q(),u=dr(i.gridFormat),c=Mt(s,n,h,a,u,R),f=c.activeFrame??c.chunkPrefix.subarray(n*h,o);if(l.queue.writeBuffer(L?G:I,0,f),S=0,C=[],g=i.generations[n]??i.generationEnd,se=g,e=g,n<i.blockCount-1){let m=n+1,_=i.blockCount>0?Math.floor(i.uncompressedBytes/i.blockCount):h;i.blockCount=m,i.generationEnd=g,i.generations=i.generations.slice(0,m),i.uncompressedBytes=_*m,i.codec===pe&&(i.storedBytes=h*m)}let p=y.splice(t.sealedIndex+1);await Ut(p.map(m=>m.filename)),Qr(),Pi(),F()}catch(o){console.warn("[GOLT worker] Failed to restore the previous persisted recording frame after storage quota pressure:",o)}}else{let n=y.splice(0);await Ut(n.map(i=>i.filename)),S=0,C=[]}return e}async function ra(e,r){console.warn("[GOLT worker] Recording stopped because OPFS storage quota was reached:",r),xi(e),k("cancelled",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),B=!1,E=!1,O=!1;let t=await ea();ze(V,y,C),ne(),ye(),nr(),K(!0),self.postMessage({type:"recordingStopped",reason:"storageQuota",restoredGeneration:t})}async function ta(e,r){xi(e),Jo(r)?await ra(e,r):Vr(r)}async function Ut(e){let r=await Xt();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function _i(){if(me)await me;else{me=(async()=>{let e=await navigator.storage.getDirectory();je=null;try{await e.removeEntry(We,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${We}:`,r)}je=await e.getDirectoryHandle(We,{create:!0})})();try{await me}finally{me=null}}}function nr(){ze(V,y,C),self.postMessage({type:"recording",manifest:{chunks:Wn(y),generationStart:V.generationStart,generationEnd:V.generationEnd,gridFormat:ce()},cols:P,rows:w})}function ar(e=!1){if(E){let r=!O;e&&O&&tr()&&(O=!1,r=!0),r&&zn(se,g)&&tr()&&(S>=T&&or(),zt(g))}}function qt(){if(Fr){let e=Fr;Fr=null;let r=E&&S>0&&C[S-1]===g;r&&(S--,C.pop());let t=l.createCommandEncoder({label:d.brushEncoder});Vo(t,e),l.queue.submit([t.finish()]),r&&zt(g)}}async function Ri(e,r=pe){let o=await(await(await(await Xt()).getFileHandle(e)).getFile()).arrayBuffer();return r===mt?Ko(o):o}function Bi(){return sn(P,w,Je.enabled,Je.sections)}function na(){return un(Bi())}function ki(e){Dr=na(),ae&&Dr.length>0&&mn({device:l,encoder:e,resources:ae,sourceBuffer:L?G:I,dispatchPlan:Bt,enabledSections:Dr})}function Ei(){let e=g;if(ae&&e!==Lr&&!ke){let r=[...Dr],t=Bi();Lr=e,ke=!0,gn({resources:ae,enabledSections:r}).then(n=>{let i=Pe.get(v)??0,o=Xe(y,S+rr),s=bn({generation:e,tribes:Ee,deadTribeIndex:i,readback:n,enabledSections:r,availability:t,liveMetricSettings:Je.sections,cols:P,rows:w,totalFrames:o,fps:jr,canStepBack:o>1,recordingBytes:Xn(y),recordingRawBytes:qn(y)});if(ke=!1,self.postMessage(s),He)if(He=!1,Lr=-1,Ai()){let a=l.createCommandEncoder({label:d.interactiveMetricsEncoder});ki(a),l.queue.submit([a.finish()]),Ei()}else He=!0}).catch(()=>{ke=!1})}}function Kt(e){let r=e.beginComputePass({label:d.simulationStepPass});r.setPipeline(Ir),r.setBindGroup(0,L?li:ci);let t=Rt;r.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),r.end(),L=!L,g++}function ia(e){if(e>0){let r=l.createCommandEncoder({label:d.simulationBatchEncoder});for(let t=0;t<e;t++)Kt(r);l.queue.submit([r.finish()]),Ae+=e}}function Pi(){self.postMessage({type:"generation",generation:g,fps:jr})}function oa(){let e=l.createCommandEncoder({label:d.simulationSingleStepEncoder});Kt(e),l.queue.submit([e.finish()])}function F(){if(l&&Nr&&we&&Qe&&kt&&Et&&!x&&!M){jo();let e=Nr.getCurrentTexture().createView(),r=l.createCommandEncoder({label:d.renderEncoder}),t=r.beginRenderPass({label:d.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(Qe),t.setBindGroup(0,L?Et:kt),t.draw(3),t.end(),l.queue.submit([r.finish()])}}function wi(e){Ye===0&&(Ye=e);let r=e-Ye;r>=1e3&&(jr=Ae/(r/1e3),Ae=0,Ye=e)}function Qr(){Ae=0,Ye=0,jr=0}function Yt(){return E&&ie()?"recording":"nonRecording"}function Ai(){return!!(l&&ae&&!x&&!M)}function K(e=!1){if(e&&(Lr=-1),!Ai())He=!0;else if(ke)He=!0;else{let r=l.createCommandEncoder({label:d.interactiveMetricsEncoder});ki(r),l.queue.submit([r.finish()]),Ei()}}function Ii(){K(!0),F()}function Jr(e,r){r&&(e-xt>=1e3||xt===0)&&!ke&&(xt=e,K())}function sr(e,r){(e.request.pacing.kind==="max"||H(e))&&r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,Pi())}function Ie(e){Z!==e&&(Z=e,self.postMessage({type:"backpressure",active:e}))}function Gi(){let e=tr();return e&&S>=T&&(or(),e=tr()),e}function ur(){!x&&!M&&!b&&self.requestAnimationFrame($t)}function aa(e,r){let t=e.adaptiveBatch;t&&t.lastDrainStartedAt>0&&(ei(t,r-t.lastDrainStartedAt),t.lastDrainStartedAt=0,t.lastSubmittedGenerations=0)}function Fi(e,r,t){let n=e.adaptiveBatch;n&&r>0&&(n.lastSubmittedGenerations=r,n.lastDrainStartedAt=t)}function Li(e,r){let t=Math.max(1,Math.round(Ke(r))),n=0;for(;n<e;){let i=e-n,o=Math.min(t,i);ia(o),n+=o}return n}function Se(e){let r=b;if(r&&!r.pumpPending&&!x&&!M){let{token:t}=r;r.pumpPending=!0;let n=()=>{if(b&&b.token===t){let i=performance.now();b.pumpPending=!1,e==="drain"&&aa(b,i),pa(i)}};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?l.queue.onSubmittedWorkDone().then(n).catch(()=>{b?.token===t&&(b.pumpPending=!1)}):queueMicrotask(n)}}function Ht(e,r){b&&k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1});let t=q(),n=e==="nonRecording"?Jn(t,r.pacing):null;n&&console.info("[GOLT worker] Adaptive non-recording batching started",{cols:t.cols,rows:t.rows,bitsPerCell:R.bitsPerCell,generationsPerDrain:n.generationsPerDrain,targetDrainMs:n.targetDrainMs}),b={kind:e,request:r,token:++hi,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0,adaptiveBatch:n},Se(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function oe(){B&&Ht(Yt(),{pacing:ri(Q),stopCondition:{kind:"none"}})}function sa(e,r){r||e==="cancelled"?Ie(!1):Z&&ne()}function k(e,r={}){let t=b;if(t){b=null,hi++;let n=H(t),i=ti(t,r),o=!!i;i&&(B=i.running,Q=i.targetStepDuration),ni(e,n,r)&&self.postMessage({type:"stepping",active:!1}),sa(e,n),r.render!==!1&&!x&&!M&&Ii(),ii(r,o,B,x,M)?oe():ur()}}function Di(e){let r=b;r&&H(r)&&(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),k("cancelled"))}function ua(e){k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Ht(Yt(),e)}function Oi(e,r,t){Ie(!0),sr(e,r),Jr(r,t),Se("drain")}function Ui(e,r){let t=l.createCommandEncoder({label:d.recordingStepBatchEncoder}),n=0,i=!1,o=e>0;for(;o;)n<e&&performance.now()<r?Gi()&&Ci()?(Kt(t),vi(t,g),n++,S>=T&&(o=!1)):(i=!0,o=!1):o=!1;return n>0&&(l.queue.submit([t.finish()]),Ae+=n,Ze()),{steps:n,blocked:i}}function ca(e,r){let t=q(),n=e.adaptiveBatch?.generationsPerDrain??Math.round(Ke(t)*Pr(t)),i=Math.min(n,j(e,g)),o=Li(i,t),s=o>0;sr(e,r),_e(e,g)?k("targetReached"):s?(Fi(e,o,performance.now()),Se("drain")):Se("raf")}function la(e,r){ar(!0);let t=!1,n=!1,i=performance.now()+14,o=j(e,g)>0&&performance.now()<i;for(;o;){let s=Ui(j(e,g),i);t=t||s.steps>0,s.blocked?(Oi(e,r,t),n=!0,o=!1):o=s.steps>0&&j(e,g)>0&&performance.now()<i}n||(Ie(!1),sr(e,r),Jr(r,t),_e(e,g)?k("targetReached"):Se("raf"))}function da(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=e.stepAccumulator,o=Math.floor(e.stepAccumulator/r),s=q(),a=e.adaptiveBatch?.generationsPerDrain??Tt(e.kind,s),u=Math.min(o,j(e,g),a),c=Li(u,s),f=c>0;if(e.stepAccumulator=Ct(i,r,o,c,a),sr(e,t),_e(e,g))k("targetReached");else{let p=f&&o>c;(!H(e)&&!p||t-e.lastRenderTime>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,F(),Jr(t,f)),p&&Fi(e,c,performance.now()),Se(p?"drain":"raf")}}function fa(e,r,t){ar(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=!1,o=0,s=e.stepAccumulator,a=Tt(e.kind,q()),u=Math.floor(e.stepAccumulator/r),c=performance.now()+14,f=!1,p=u>0&&j(e,g)>0&&o<a&&performance.now()<c;for(;p;){let m=Math.min(u-o,a-o,j(e,g)),_=Ui(m,c);o+=_.steps,i=i||_.steps>0,_.blocked?(Oi(e,t,i),f=!0,p=!1):p=_.steps>0&&u>o&&j(e,g)>0&&o<a&&performance.now()<c}e.stepAccumulator=Ct(s,r,u,o,a),f||(Ie(!1),sr(e,t),_e(e,g)?k("targetReached"):(H(e)||(F(),Jr(t,i)),Se("raf")))}function pa(e){let r=b;if(r&&!x&&!M)if(wi(e),H(r)||qt(),_e(r,g))k("targetReached");else if(r.request.pacing.kind==="max")r.kind==="recording"?la(r,e):ca(r,e);else{let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?fa(r,t,e):da(r,t,e)}}function $t(e){x||M?self.requestAnimationFrame($t):(wi(e),b||(qt(),Q>0&&!Or&&F(),self.requestAnimationFrame($t)))}function ma(e,r){let t=l?he():Number.POSITIVE_INFINITY;return Jt(r.bitsPerCell)&&nt(r.bitsPerCell,e.tribes.length)&&it(e,Ge(r.bitsPerCell),t)?Ge(r.bitsPerCell):rn(e.tribes.length,e,t)}function $i(e,r){Yr=e,P=e.cols,w=e.rows,R=ma(e,r),Hr=de(P,R),Ee=[...e.tribes],V.gridFormat=ce(),Pe.clear(),Ee.forEach((t,n)=>Pe.set(t.id,n))}async function Ni(e){console.log("[GOLT worker] Initializing WebGPU"),be=e,l=await on(d.webengineDevice),M=!1,l.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),M=!0,B=!1,x=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:he(),vramBudgetBytes:yt(he(),ir()),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:ce()});let r=be.getContext("webgpu");if(r)Nr=r,Ar=navigator.gpu.getPreferredCanvasFormat(),Nr.configure({device:l,format:Ar,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:Ar,maxBufferSize:l.limits.maxBufferSize,maxStorageBufferBindingSize:l.limits.maxStorageBufferBindingSize});else throw new Error("WebGPU canvas context not available")}async function ga(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Ni(be),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),M=!0,B=!1,x=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function Wi(){U=l.createBuffer({label:d.recordingChunkBuffer,size:T*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await qr(T*h,U),S=0,C=[],se=null}async function zi(){let e=T*h;ue=[],z=[];for(let r=0;r<xe;r++){let t=l.createBuffer({label:`${d.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});ue.push(t),z.push(!0),await qr(e,t)}}async function ba(){await _i()}async function ha(){console.log("[GOLT worker] Building GPU resources",{cols:P,rows:w,bitsPerCell:R.bitsPerCell,recordingAvailable:ie()}),Pt(),Ti(),await wt(),At(),It(),Gt(),Ft(),Dt(),Lt(),await ba(),ie()?(await Wi(),await zi()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:h,maxRecordingBufferBytes:ir()}),Kr(),E=!1,O=!1),await Xr(),Ot(),console.log("[GOLT worker] GPU resources ready")}async function Sa(){console.log("[GOLT worker] Rebuild started",{cols:P,rows:w,bitsPerCell:R.bitsPerCell}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),x=!0,self.postMessage({type:"rebuilding",active:!0});try{await Wt()}catch{console.warn("[GOLT worker] Queue idle wait rejected during rebuild")}let e=!M;if(M&&(e=await ga()),e){si(),Pt(),Ti(),ai(ie());try{await wt(),At(),It(),Ft(),Dt(),Gt(),Lt(),ie()?(await Wi(),await zi()):(Kr(),E=!1,O=!1),await Xr(),Ot()}catch(r){let t=r instanceof Error?r.message:String(r);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{si(),Pt(),ai(!1),await wt(),At(),It(),Ft(),Dt(),Gt(),Lt(),E=!1,O=!1,h=Zr(),Kr(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await Xr(),Ot()}catch(n){console.error("[GOLT worker] GPU rebuild recovery failed:",n),e=!1}}}return e&&(x=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:ie(),frameByteSize:h})),e}function ui(e){Or=!0,l.queue.onSubmittedWorkDone().then(()=>{Or=!1,e()}).catch(()=>{Or=!1})}async function ya(){X>0&&await new Promise(e=>{let r=setInterval(()=>{X===0&&(clearInterval(r),e())},10)})}async function Ta(e){console.log("[GOLT worker] Init message received",{cols:e.ruleset.cols,rows:e.ruleset.rows,recording:e.recording,running:e.running,speed:e.speed}),E=e.recording,Je=at(e.liveMetrics),O=E,$i(e.ruleset,e.simulationGridFormat),await Ni(e.canvas),await ha(),K(!0),ye(),B=e.running,Q=e.speed<0?0:1e3/e.speed,B?oe():ur()}function Ca(e){Je=at(e.liveMetrics),K(!0)}async function va(e){console.log("[GOLT worker] Ruleset update received",{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length});let r=he();if(ot(e.ruleset.tribes.length,e.ruleset,r))k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),$i(e.ruleset,e.simulationGridFormat),await Sa()&&(g=0,Qr(),await Mi(0),K(!0),B?oe():ur());else{let i=`Requested ruleset requires at least ${en(e.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",i,{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length,maxBytes:r}),self.postMessage({type:"gpuError",reason:i})}}function Ma(e){B=e.running,e.running?b||oe():b&&H(b)?Di(!1):b?k("manual"):(Z&&ne(),Ii(),ur())}function xa(e){let r=Q<=0,t=e.speed<0?0:1e3/e.speed;Q=t,b&&!H(b)&&B?(k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&t>0?ui(()=>{F(),oe()}):oe()):B&&!b?oe():r&&t>0&&ui(()=>{F(),ur()})}function _a(e){di=e.scale,fi=e.offsetX,pi=e.offsetY,!b&&!x&&!M&&F()}function Ra(e){be.width=e.width,be.height=e.height,!b&&!x&&!M&&F()}function Ba(e){let r=e.tribes.map(t=>Pe.get(t)).filter(t=>t!==void 0);if(r.length>0){let t={square:0,round:1,diamond:2,vline:3,hline:4},n={full:0,spray:1,outline:2};Fr={centerX:e.x,centerY:e.y,brushSize:e.size,shape:t[e.shape]??0,fill:n[e.fill]??0,density:Qt(e.density),tribeIds:r}}}function ka(e){let r={square:0,round:1,diamond:2,vline:3,hline:4};mi={centerX:e.x,centerY:e.y,brushSize:e.size,shape:r[e.shape]??0,visible:e.visible},!b&&!x&&!M&&Q<=0&&F()}function Ea(e){gi={originX:e.origin?.originX??0,originY:e.origin?.originY??0,visible:e.visible&&e.origin!==null},!b&&!x&&!M&&Q<=0&&F()}async function Pa(){try{let e=await Zo();st({type:"snapshot",grid:e,generation:g,cols:P,rows:w,gridFormat:ce()},[e.buffer])}catch{let e=new Uint32Array(0);st({type:"snapshot",grid:e,generation:g,cols:P,rows:w,gridFormat:ce()},[e.buffer])}}async function wa(e){let r=dr(e.gridFormat),t=q();if(e.grid.byteLength===ee(t,r)){let n=Mr(e.grid,t,r,R);l.queue.writeBuffer(L?G:I,0,n),g=e.generation,Qr(),await Mi(e.generation)}}function Aa(e){let r=b?.request,t=ie();e.recording&&t&&!E?(E=!0,O=!0,K(!0),ye()):(!e.recording||!t)&&(e.recording&&!t&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:h,maxRecordingBufferBytes:ir()}),E=!1,O=!1),r&&b?ua(r):!b&&B&&oe()}async function Ia(){er||(await Wt(),ar(!1),S>0&&or(),X>0?er=!0:nr())}async function Ga(e){let r=Xe(y),t=vt(y,r,S,e.count);if(t){let n=L?G:I;if(t.source==="buffered"){let i=oi(C,t);S=i.chunkFrameIndex,C.length=S,g=i.generation,se=g;let o=l.createCommandEncoder({label:d.recordingRestoreCopyEncoder});o.copyBufferToBuffer(U,t.frameInChunk*h,n,0,h),l.queue.submit([o.finish()])}else{X>0&&(await ya(),r=Xe(y));let i=y[t.sealedIndex],o=await Ri(i.filename,i.codec),s=q(),a=dr(i.gridFormat),u=Mt(o,t.frameInChunk,h,s,a,R);if(l.queue.writeBuffer(U,0,u.chunkPrefix),!u.sameFormat&&u.activeFrame&&l.queue.writeBuffer(n,0,u.activeFrame),S=t.frameInChunk+1,C=i.generations.slice(0,t.frameInChunk+1),g=C[t.frameInChunk],se=g,u.sameFormat){let f=l.createCommandEncoder({label:d.recordingRestoreCopyEncoder});f.copyBufferToBuffer(U,t.frameInChunk*h,n,0,h),l.queue.submit([f.finish()])}let c=y.splice(t.sealedIndex);Ut(c.map(f=>f.filename))}ze(V,y,C),ye(),Qr(),K(!0),F()}}function Fa(){qt(),ar(!0),!E||Gi()?(oa(),Ae++,E&&tr()&&(S>=T&&or(),zt(g)),Ie(!1)):Ie(!0),K(!0),F()}function La(e){self.postMessage({type:"stepping",active:!0}),ar(!0),Ht(Yt(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:g+e},restoreAfterStop:{running:B,targetStepDuration:Q}})}function Da(e){e.count===1?Fa():La(e.count)}function Oa(){Di(b?.request.restoreAfterStop?.running??B)}function Ua(e){let r=y.find(t=>t.filename===e.filename);r&&(r.codec=e.codec,r.storedBytes=e.storedBytes,r.gridFormat=e.gridFormat,V.chunks=[...y],ye(),nr())}function $a(){let e=y.filter(r=>r.codec===pe).map(r=>({filename:r.filename,rawBytes:r.uncompressedBytes,blockCount:r.blockCount,cols:P,rows:w,rawGridFormat:r.gridFormat,storageGridFormat:Fe(lr(Yr.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:e})}async function Na(e){switch(e.type){case"init":await Ta(e);break;case"setLiveMetrics":Ca(e);break;case"setRuleset":await va(e);break;case"setRunning":Ma(e);break;case"setSpeed":xa(e);break;case"camera":_a(e);break;case"resize":Ra(e);break;case"draw":Ba(e);break;case"brushPreview":ka(e);break;case"exportFrameOverlay":Ea(e);break;case"getSnapshot":await Pa();break;case"loadSnapshot":await wa(e);break;case"setRecording":Aa(e);break;case"getRecording":await Ia();break;case"stepBack":await Ga(e);break;case"stepForward":Da(e);break;case"cancelStepping":Oa();break;case"updateChunkCodec":Ua(e);break;case"getUncompressedChunks":$a();break}}self.onmessage=async e=>{await Na(e.data)};
