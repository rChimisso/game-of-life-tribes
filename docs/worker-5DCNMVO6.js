var Qt="goltTimestampedConsoleInstalled";function Zo(){let e=globalThis;e[Qt]||(e[Qt]=!0,tt("info"),tt("warn"),tt("error"),console.log=console.info.bind(console))}function tt(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}Zo();var Jt=`// Render shader: draws the grid as a full-screen quad.\r
// Reads cell tribe IDs from a storage buffer, looks up colors from a uniform array.
// Supports zoom, pan, toroidal tiling, and bounded-grid clipping.
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
  topology: u32,         // 0=toroidal, 1=bounded.\r
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
fn signedGridDelta(cell: u32, center: i32, size: u32) -> i32 {
__SIGNED_GRID_DELTA_BODY__
}
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
fn signedGridWorldDelta(world: f32, center: i32, size: u32) -> f32 {
__SIGNED_GRID_WORLD_DELTA_BODY__
}
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
  let bx = signedGridDelta(ix, u.preview_center.x, u.grid_size.x) + half;\r
  let by = signedGridDelta(iy, u.preview_center.y, u.grid_size.y) + half;\r
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
    signedGridWorldDelta(world.x, u.preview_center.x, u.grid_size.x),\r
    signedGridWorldDelta(world.y, u.preview_center.y, u.grid_size.y)\r
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
    signedGridWorldDelta(world.x, i32(marker.x), u.grid_size.x),\r
    signedGridWorldDelta(world.y, i32(marker.y), u.grid_size.y)\r
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
fn exportBoundedCornerPixel(local: vec2f, corner: vec2f) -> vec2f {\r
  let world = vec2f(f32(u.offset_cell.x), f32(u.offset_cell.y)) + local;\r
  return (world - corner) * u.scale;\r
}\r
\r
fn exportMarkerShape(p: vec2f, arm: f32, stroke: f32, squareHalf: f32, includeCenterSquare: bool) -> bool {\r
  let cross = (abs(p.x) <= stroke && abs(p.y) <= arm) || (abs(p.y) <= stroke && abs(p.x) <= arm);\r
  let centerSquare = includeCenterSquare && abs(p.x) <= squareHalf && abs(p.y) <= squareHalf;\r
  return cross || centerSquare;\r
}\r
\r
fn exportBoundedCornerMarkerMask(local: vec2f) -> bool {\r
  let maxCorner = vec2f(f32(u.grid_size.x), f32(u.grid_size.y));\r
  return exportMarkerShape(exportBoundedCornerPixel(local, vec2f(0.0, 0.0)), 32.0, 2.0, 8.0, false) || exportMarkerShape(exportBoundedCornerPixel(local, vec2f(maxCorner.x, 0.0)), 32.0, 2.0, 8.0, false) || exportMarkerShape(exportBoundedCornerPixel(local, vec2f(0.0, maxCorner.y)), 32.0, 2.0, 8.0, false) || exportMarkerShape(exportBoundedCornerPixel(local, maxCorner), 32.0, 2.0, 8.0, false);\r
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
fn exportBoundedCornerMarkerOutlineMask(local: vec2f) -> bool {\r
  let maxCorner = vec2f(f32(u.grid_size.x), f32(u.grid_size.y));\r
  return exportMarkerShape(exportBoundedCornerPixel(local, vec2f(0.0, 0.0)), 34.0, 4.0, 10.0, false) ||\r
    exportMarkerShape(exportBoundedCornerPixel(local, vec2f(maxCorner.x, 0.0)), 34.0, 4.0, 10.0, false) ||\r
    exportMarkerShape(exportBoundedCornerPixel(local, vec2f(0.0, maxCorner.y)), 34.0, 4.0, 10.0, false) ||\r
    exportMarkerShape(exportBoundedCornerPixel(local, maxCorner), 34.0, 4.0, 10.0, false);\r
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
__GRID_COORDINATE_ASSIGNMENTS__
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
__EXPORT_OVERLAY_BLOCK__
\r
  return vec4f(r, g, b, 1.0);\r
}\r
`;function rn(e){return Math.min(Math.max(1,Math.floor(+e||1)),100)}var nt=[1,2,4,8,16,32],ei={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},ri={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},ti={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},fr={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},ni={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},ot={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},ee={1:ei,2:ri,4:ti,8:fr,16:ni,32:ot};function tn(e){return nt.includes(e)}function oi(e){return 2**e}function it(e,r){return r<=oi(e)}function at(e,r,t){return re(e,r)<=t}function pr(e){return e<=2?ee[1]:e<=4?ee[2]:e<=16?ee[4]:e<=256?ee[8]:e<=65536?ee[16]:ee[32]}function nn(e){return pr(e)}function Le(e){return ee[e]}function on(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){return st(e,r,t)??ot}function st(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of nt){let o=Le(n);if(it(n,e)&&at(r,o,t))return o}return null}function mr(e){return Le(e?.bitsPerCell??8)}function Oe(e){return{bitsPerCell:e.bitsPerCell}}function pe(e,r){return Math.ceil(e/r.cellsPerWord)}function re(e,r){return pe(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function an(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}var Fe={population:!0,diversity:!0,interfaces:!1},gr={enabled:!0,sections:Fe};function ii(e){return{population:typeof e?.population=="boolean"?e.population:Fe.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Fe.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Fe.interfaces}}function ut(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:gr.enabled,sections:ii(e?.sections)}}function lt(e,r){self.postMessage(e,r)}var x="dead";var sn="toroidal",B="bounded";var ct="empty",un="is",br="comparison",hr="count",Sr="none",yr="exactly",Tr="min",_r="max",xr="not",Cr="and",Mr="or",vr="xor";async function ln(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var f={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",recordingStepBatchEncoder:"recording step batch encoder",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var cn=4294967295;function dt(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function W(e,r){return e.includes(r)}function dn(e,r,t,n){let o=e*r,i=o<=cn,s=o*2<=cn;return{population:dt(t&&n.population,i),diversity:dt(t&&n.diversity,i),interfaces:dt(t&&n.interfaces,s)}}function fn(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var Ce=256*Uint32Array.BYTES_PER_ELEMENT,Me=Uint32Array.BYTES_PER_ELEMENT;function pn(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function mn(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function gn(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function ai(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:o}=e;return`
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
${pn(o)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${mn(o)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${gn(o)}
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
`}function si(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:o}=e;return`
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
${pn(o)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${mn(o)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${gn(o)}
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
`}function ui(e,r){let{tribes:t,deadTribeIndex:n,readback:o,cols:i,rows:s}=e,a=i*s,u={};for(let d=0;d<t.length;d++){let p=r?o.histogram[d]??0:0;u[t[d].id]=p}let l=r?u[t[n]?.id??""]??0:0;return{population:u,aliveCells:r?Math.max(0,a-l):0,deadCells:l}}function li(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,o=0;for(let i=0;i<r.length;i++)i!==t&&(o+=n.histogram[i]??0);return o}function ci(e,r){let{tribes:t,deadTribeIndex:n,readback:o}=e,i=r?li(e):0,s=0,a=0;for(let u=0;u<t.length;u++){let l=u!==n&&i>0?(o.histogram[u]??0)/i:0;l>0&&(s-=l*Math.log2(l),a+=l*l)}return{shannonEntropy:s,simpsonSum:a}}function di(e,r){let t=e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,o=r?Math.max(0,t-n):0;return{sameStateContactEdges:o,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?o/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function bn(e){let{device:r}=e,t=r.createShaderModule({label:f.histogramMetricsShaderModule,code:ai(e)}),n=r.createComputePipeline({label:f.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),o=r.createBuffer({label:f.histogramMetricsBuffer,size:Ce,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),i=r.createBuffer({label:f.histogramMetricsReadBuffer,size:Ce,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=r.createShaderModule({label:f.interfaceMetricsShaderModule,code:si(e)}),a=r.createComputePipeline({label:f.interfaceMetricsPipeline,layout:"auto",compute:{module:s,entryPoint:"main"}}),u=r.createBuffer({label:f.interfaceMetricsBuffer,size:Me,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),l=r.createBuffer({label:f.interfaceMetricsReadBuffer,size:Me,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:o,histogramReadBuffer:i,boundaryPipeline:a,boundaryBuffer:u,boundaryReadBuffer:l}}function hn(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function Sn(e){let{device:r,encoder:t,resources:n,sourceBuffer:o,dispatchPlan:i,enabledSections:s}=e;if(W(s,"population")||W(s,"diversity")){let a=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,a);let u=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),l=t.beginComputePass({label:f.histogramMetricsPass});l.setPipeline(n.histogramPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(i.dispatchWgX,i.dispatchWgY),l.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Ce)}if(W(s,"interfaces")){let a=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,a);let u=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),l=t.beginComputePass({label:f.interfaceMetricsPass});l.setPipeline(n.boundaryPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(i.dispatchWgX,i.dispatchWgY),l.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Me)}}async function yn(e){let{resources:r,enabledSections:t}=e,n=W(t,"population")||W(t,"diversity"),o=W(t,"interfaces"),i=[];n&&i.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),o&&i.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(i);let s=new Uint32Array(256);n&&(s=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let a=0;if(o){let u=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),a=u[0]??0}return{histogram:s,crossStateContactEdges:a}}function Tn(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:o,cols:i,rows:s,totalFrames:a,fps:u,canStepBack:l,recordingBytes:d,recordingRawBytes:p}=e,m=W(t,"population")&&o.population,_=W(t,"diversity")&&o.diversity,C=W(t,"interfaces")&&o.interfaces,U=i*s,xe=ui(e,m),fe=ci(e,_),jo=di(e,C);return{type:"metrics",generation:r,population:xe.population,aliveCells:xe.aliveCells,deadCells:xe.deadCells,occupancy:m&&U>0?xe.aliveCells/U:0,shannonEntropy:fe.shannonEntropy,simpsonIndex:_?1-fe.simpsonSum:0,interfaces:jo,metricsAvailability:n,extinctionTime:{},totalFrames:a,fps:u,canStepBack:l,recordingBytes:d,recordingRawBytes:p}}function fi(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}function _n(e,r,t,n,o){let i=pe(r.cols,t),s=e[o*i+(n>>t.wordShift)]??0;return fi(s,t,n&t.cellIndexMask)}function xn(e,r,t,n,o,i){let s=pe(r.cols,t),a=o*s+(n>>t.wordShift),u=(n&t.cellIndexMask)<<t.cellShift,l=~(t.cellMask<<u),d=e[a]??0;e[a]=(d&l|(i&t.cellMask)<<u)>>>0}var pi=64*1024*1024,Is=256*1024*1024;function Rr(e,r,t,n){let o=e,i;if(t.bitsPerCell===n.bitsPerCell)i=e;else{i=new Uint32Array(re(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let s=0;s<r.rows;s++)for(let a=0;a<r.cols;a++)xn(i,r,n,a,s,_n(o,r,t,a,s))}return i}function mi(e,r,t){let n=Math.floor((r-1)/2),o=e-n,i=o+r,s=[];if(o>=0&&i<=t)s.push({destinationStart:o,localStart:0,span:r});else if(o<0){let a=-o;s.push({destinationStart:t-a,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:r-a})}else{let a=t-o;s.push({destinationStart:o,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:i-t})}return s.filter(a=>a.span>0)}function gi(e,r,t){let n=e-Math.floor((r-1)/2),o=Math.max(0,n),i=Math.min(t,n+r),s=Math.max(0,i-o),a=[];return s>0&&a.push({destinationStart:o,localStart:o-n,span:s}),a}function Cn(e){return`
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
`}function Mn(e,r,t,n,o){let i=o===B?gi:mi,s=i(e,t,n.cols),a=i(r,t,n.rows),u=[];for(let l of a)for(let d of s)u.push({destinationStartX:d.destinationStart,destinationStartY:l.destinationStart,localStartX:d.localStart,localStartY:l.localStart,spanCols:d.span,spanRows:l.span});return u}var vn={"=":"==","\u2260":"!=",">":">","<":"<","\u2265":">=","\u2264":"<="};function bi(e){let r;return typeof e=="string"?r=Rn([e]):r=G(e),r}function Rn(e){return{kind:"tribes",tribes:[...e&&e.length>0?e:[x]]}}function G(e,r){let t=e??Rn(r),n;switch(t.kind){case"tribes":n={...t,tribes:[...t.tribes]};break;case"tiedMajority":n={...t,source:G(t.source)};break;default:n={...t};break}return n}function $e(e,r){return{kind:"count",selector:G(e?.selector,r)}}function Br(e){return JSON.stringify(te(e))}function te(e){let r;switch(e.kind){case"tribes":r={...e,tribes:[...new Set(e.tribes)].sort()};break;case"tiedMajority":r={...e,source:te(e.source)};break;default:r=e;break}return r}function Bn(e){return e.become??{kind:"fixed",tribe:e.tribe??x}}function Ue(e){let r;switch(e.kind){case"majority":case"minority":r={...e,selector:G(e.selector),tie:e.tie?Ue(e.tie):void 0,fallback:e.fallback?Ue(e.fallback):void 0};break;case"combine":r={kind:"combine",strategy:{...e.strategy,entries:e.strategy.entries.map(t=>({...t,inputs:t.inputs.map(n=>bi(n)).sort((n,o)=>Br(n).localeCompare(Br(o)))})),default:e.strategy.default?Ue(e.strategy.default):void 0}};break;default:r={...e};break}return r}function hi(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function Si(e,r){e.push(`const CELLS_PER_WORD: u32 = ${r.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${r.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${r.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${r.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${r.cellMask}u;`)}function yi(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Ti(e,r){e.push("fn readBoundedCell(x: i32, y: i32) -> u32 {"),e.push("  if (x < 0i || y < 0i || x >= i32(COLS) || y >= i32(ROWS)) {"),e.push(`    return ${r}u;`),e.push("  }"),e.push("  return readCell(u32(x), u32(y));"),e.push("}")}function _i(e,r,t){r.remapped?(e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;")):(e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;"))}function xi(e){let r=Gi(e),t=new Map,n=0;for(let o of r)t.set(o,`count_${n++}`);return t}function Ci(e,r){let t=Di(e),n=new Map,o=0;for(let i of t){let s=r.get(i);s?n.set(i,s):n.set(i,`eq_count_${o++}`)}return n}function Mi(e,r,t,n){for(let[o,i]of r)e.push(`  let ${i} = ${mt(Dn(o),t,n)};`);r.size>0&&e.push("")}function vi(e,r,t,n,o){let i=0;for(let[s,a]of t)r.has(s)||(e.push(`  let ${a} = ${mt(Dn(s),n,o)};`),i++);i>0&&e.push("")}function Ri(e,r,t,n,o,i){for(let s=0;s<r.length;s++){let a=r[s],u=We(a.clause,t,n,o,i);e.push(s===0?`  if (${u}) {`:`  } else if (${u}) {`),pt(e,Ue(Bn(a)),o,i,`rule_${s}`,"    ")}r.length>0&&e.push("  }"),e.push("")}function pt(e,r,t,n,o,i,s=null){switch(r.kind){case"fixed":e.push(`${i}result = ${z(r.tribe,n)}u;`);break;case"same":e.push(`${i}result = selfTribe;`);break;case"majority":case"minority":Bi(e,r,t,n,o,i);break;case"combine":ki(e,r,t,n,o,i,s);break}}function Bi(e,r,t,n,o,i){let s=G(r.selector),a=`${o}_${r.kind}`,u=`${o}_${r.kind}_count`,l=`${o}_${r.kind}_ties`,d=r.kind==="majority"?"0u":"9u",p=r.kind==="majority"?`candidateCount > ${u}`:`candidateCount < ${u}`;e.push(`${i}var ${a}: u32 = ${z(x,n)}u;`),e.push(`${i}var ${u}: u32 = ${d};`),e.push(`${i}var ${l}: u32 = 0u;`);for(let m of Pr(s,t,n)){let _=H(U=>`${U} == ${m}u`),C=ve(s,m,n);e.push(`${i}{`),e.push(`${i}  let candidateCount = ${_};`),e.push(`${i}  if (${C} && candidateCount > 0u) {`),e.push(`${i}    if (${p}) {`),e.push(`${i}      ${a} = ${m}u;`),e.push(`${i}      ${u} = candidateCount;`),e.push(`${i}      ${l} = 1u;`),e.push(`${i}    } else if (candidateCount == ${u}) {`),e.push(`${i}      ${l} = ${l} + 1u;`),e.push(`${i}    }`),e.push(`${i}  }`),e.push(`${i}}`)}e.push(`${i}if (${l} == 1u) {`),e.push(`${i}  result = ${a};`),e.push(`${i}} else if (${l} > 1u) {`),r.tie?pt(e,r.tie,t,n,`${o}_tie`,`${i}  `,{selector:s,bestCountVar:u,tieCountVar:l}):Er(e,r.fallback,t,n,`${o}_tie_fallback`,`${i}  `),e.push(`${i}} else {`),Er(e,r.fallback,t,n,`${o}_fallback`,`${i}  `),e.push(`${i}}`)}function Er(e,r,t,n,o,i){r?pt(e,r,t,n,o,i):e.push(`${i}result = ${z(x,n)}u;`)}function ki(e,r,t,n,o,i,s){let a=`${o}_input_mask`;e.push(`${i}var ${a}: u32 = 0u;`);for(let p of wi(t,n,s)){let m=An(p,n,s);e.push(`${i}if (${m}) {`),e.push(`${i}  ${a} = ${a} | ${In(p)};`),e.push(`${i}}`)}let u=`${o}_dead_present`,l=H(p=>`${p} == ${z(x,n)}u`);e.push(`${i}let ${u} = ${l} > 0u;`);let d=[...r.strategy.entries].sort((p,m)=>Number(ft(m,n))-Number(ft(p,n)));d.forEach((p,m)=>{let _=Ai(p.inputs,t,n,s),C=ft(p,n)?` && ${u}`:"",U=`${a} == (${_})${C}`;e.push(m===0?`${i}if (${U}) {`:`${i}} else if (${U}) {`),e.push(`${i}  result = ${z(p.output,n)}u;`)}),d.length>0?(e.push(`${i}} else {`),Er(e,r.strategy.default,t,n,`${o}_fallback`,`${i}  `),e.push(`${i}}`)):Er(e,r.strategy.default,t,n,`${o}_fallback`,i)}function kn(e){for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(`    var ${gt(t,r)}: u32;`)}function kr(e,r,t){for(let n=-1;n<=1;n++)for(let o=-1;o<=1;o++)if(!(o===0&&n===0)){let i=gt(o,n),s;r==="toroidal"?s=`readCell(${En("x",o,"COLS")}, ${En("y",n,"ROWS")})`:r==="boundedDirect"?s=`readCell(${Pn("x",o)}, ${Pn("y",n)})`:s=`readBoundedCell(${wn("x",o)}, ${wn("y",n)})`,e.push(`${t}${i} = ${s};`)}}function mt(e,r,t){let n=te(e),o;switch(n.kind){case"same":o=H(i=>`${i} == selfTribe`);break;case"different":o=H(i=>`${i} != selfTribe`);break;case"tiedMajority":o=mt(n.source,r,t);break;case"tribes":{let i=ze(n.tribes,t);o=i.length===0?"0u":H(s=>i.map(a=>`${s} == ${a}u`).join(" || "));break}}return o}function H(e){return Ei().map(r=>`select(0u, 1u, ${e(r)})`).join(" + ")}function gt(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function Ei(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(gt(t,r));return e}function En(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function Pn(e,r){let t=e;return r===-1?t=`${e} - 1u`:r===1&&(t=`${e} + 1u`),t}function wn(e,r){let t=`i32(${e})`;return r===-1?t=`i32(${e}) - 1i`:r===1&&(t=`i32(${e}) + 1i`),t}function ze(e,r){let t=[];for(let n of e)t.push(qe(n,r,"selector"));return[...new Set(t)]}function z(e,r){return qe(e,r,"target")}function qe(e,r,t){let n=r.get(e),o=r.get(x)??0;return n===void 0&&console.error(`Unknown rule ${t} tribe; using dead tribe instead.`,{tribe:e}),n??o}function Pr(e,r,t){let n=te(e),o;switch(n.kind){case"tribes":o=ze(n.tribes,t);break;case"tiedMajority":o=Pr(n.source,r,t);break;default:o=r.map(i=>qe(i.id,t,"selector"));break}return[...new Set(o)].sort((i,s)=>i-s)}function ve(e,r,t){let n=te(e),o;switch(n.kind){case"same":o=`selfTribe == ${r}u`;break;case"different":o=`selfTribe != ${r}u`;break;case"tiedMajority":o=ve(n.source,r,t);break;case"tribes":{o=ze(n.tribes,t).includes(r)?"true":"false";break}}return o}function Pi(e,r,t,n){let o=te(e),i;if(o.kind==="tiedMajority"&&n){let s=H(u=>`${u} == ${r}u`),a=ve(n.selector,r,t);i=`(${n.tieCountVar} > 1u && ${n.bestCountVar} > 0u && ${a} && ${s} == ${n.bestCountVar})`}else{let s=H(u=>`${u} == ${r}u`);i=`(${ve(o.kind==="tiedMajority"?o.source:o,r,t)} && ${s} > 0u)`}return i}function wi(e,r,t){let n;return t?n=Pr(t.selector,e,r):n=e.map(o=>qe(o.id,r,"selector")),[...new Set(n)].filter(o=>o!==z(x,r)).sort((o,i)=>o-i)}function An(e,r,t){let n;if(t){let o=H(s=>`${s} == ${e}u`),i=ve(t.selector,e,r);n=`(${e}u != ${z(x,r)}u && ${t.tieCountVar} > 1u && ${t.bestCountVar} > 0u && ${i} && ${o} == ${t.bestCountVar})`}else{let o=H(i=>`${i} == ${e}u`);n=`(${e}u != ${z(x,r)}u && ${o} > 0u)`}return n}function Ai(e,r,t,n){let o=[];for(let i of e){let s=G(i);for(let a of Pr(s,r,t))if(a!==z(x,t)){let u=Ii(s,a,t,n);o.push(`select(0u, ${In(a)}, ${u})`)}}return o.length>0?o.join(" | "):"0u"}function ft(e,r){let t=z(x,r);return e.inputs.some(n=>{let o=G(n);return o.kind==="tribes"&&ze(o.tribes,r).includes(t)})}function Ii(e,r,t,n){let o=te(e),i;if(n){let s=An(r,t,n),a=ve(o.kind==="tiedMajority"?o.source:o,r,t);i=`(${s} && ${a})`}else i=Pi(o,r,t,null);return i}function In(e){return`(1u << ${e}u)`}function Gn(e){return Br(e)}function Dn(e){return JSON.parse(e)}function Ln(e,r){let t=new Set,n=i=>{t.add(Gn(i))},o=i=>{switch(r(i,n),i.kind){case xr:o(i.clause);break;case Cr:case Mr:case vr:for(let s of i.clauses)o(s);break}};for(let i of e)o(i);return t}function Gi(e){return Ln(e,(r,t)=>{switch(r.kind){case Sr:case yr:case Tr:case _r:case hr:t(G(r.selector,r.tribes));break}})}function Di(e){return Ln(e,(r,t)=>{r.kind===br&&(t($e(r.left,r.tribe1).selector),t($e(r.right,r.tribe2).selector))})}function We(e,r,t,n,o){switch(e.kind){case ct:return"false";case un:return Li(e.tribes,n,o);case hr:return Ne(me(G(e.selector,e.tribes),r),e.interval[0],e.interval[1]);case Sr:return Ne(me(G(e.selector,e.tribes),r),0,0);case yr:return Ne(me(G(e.selector,e.tribes),r),e.value,e.value);case Tr:return Ne(me(G(e.selector,e.tribes),r),e.value,8);case _r:return Ne(me(G(e.selector,e.tribes),r),0,e.value);case br:return Oi(e,t);case xr:return`!(${We(e.clause,r,t,n,o)})`;case Cr:return`(${e.clauses.map(i=>We(i,r,t,n,o)).join(" && ")})`;case Mr:return`(${e.clauses.map(i=>We(i,r,t,n,o)).join(" || ")})`;case vr:return Fi(e.clauses,r,t,n,o);default:return"false"}}function Li(e,r,t){let n=ze(e,t);return n.length===0?"false":n.length===r.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}function Ne(e,r,t){return`(${e} >= ${r}u && ${e} <= ${t}u)`}function Oi(e,r){let t=$e(e.left,e.tribe1).selector,n=$e(e.right,e.tribe2).selector,o=vn[e.operator]??"==",i=Math.max(-8,Math.min(8,e.margin??0));return`(i32(${me(t,r)}) ${o} (i32(${me(n,r)}) + ${i}i))`}function Fi(e,r,t,n,o){return`(((${e.map(i=>We(i,r,t,n,o)).map(i=>`select(0u, 1u, ${i})`).join(" + ")}) & 1u) == 1u)`}function me(e,r){return r.get(Gn(e))}function bt(e,r,t){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,o=Math.min(n,t),i=Math.ceil(n/o);if(i<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:o,dispatchWgY:i,remapped:!0};throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`)}function On(e,r,t,n,o,i,s){let a=[],u=e.rules.filter(C=>!C.muted),l=s.get(x)??0,d=e.topology===B,p=qe(e.boundaryTribe??x,s,"boundary"),m=xi(u.map(C=>C.clause)),_=Ci(u.map(C=>C.clause),m);return a.push("// Auto-generated simulation compute shader."),a.push(`// Tribes: ${r.map(C=>C.id).join(", ")}`),a.push(`// Rules: ${e.rules.length}`),a.push(""),a.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),a.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),a.push(""),a.push(`const COLS: u32 = ${n.cols}u;`),a.push(`const ROWS: u32 = ${n.rows}u;`),a.push(`const PACKED_COLS: u32 = ${t}u;`),hi(a,o),Si(a,i),a.push(""),yi(a,"gridIn","PACKED_COLS"),d&&(a.push(""),Ti(a,p)),a.push(""),a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {"),Mi(a,m,r,s),vi(a,m,_,r,s),a.push(`  var result: u32 = ${l}u;`),a.push(""),Ri(a,u,m,_,r,s),a.push("  return result;"),a.push("}"),a.push(""),a.push("@compute @workgroup_size(16, 16)"),o.remapped?a.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):a.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),_i(a,o,"px"),a.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),a.push(""),a.push("  let baseX = px << WORD_SHIFT;"),d&&a.push("  let interiorPackedWord = y > 0u && y + 1u < ROWS && baseX > 0u && baseX + CELLS_PER_WORD < COLS;"),a.push("  var packed: u32 = 0u;"),a.push(""),a.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),a.push("    let x = baseX + i;"),a.push("    if (x >= COLS) { break; }"),a.push(""),a.push("    let selfTribe = readCell(x, y);"),d?(kn(a),a.push("    if (interiorPackedWord) {"),kr(a,"boundedDirect","      "),a.push("    } else {"),a.push("      let interiorCell = x > 0u && y > 0u && x + 1u < COLS && y + 1u < ROWS;"),a.push("      if (interiorCell) {"),kr(a,"boundedDirect","        "),a.push("      } else {"),kr(a,"boundedVirtual","        "),a.push("      }"),a.push("    }")):(kn(a),kr(a,"toroidal","    ")),a.push(""),a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),a.push("  }"),a.push(""),a.push("  gridOut[y * PACKED_COLS + px] = packed;"),a.push("}"),a.join(`
`)}var Re=3,Ye="gol-recording",ge="raw-packed",ht="deflate-raw",St=12,yt=256*1024*1024,Fn=512*1024*1024;function Tt(e,r,t=0){let n=t;for(let o of e)n+=o[r];return n}function Un(e,r){return Math.min(e,r)}function _t(e){return Math.min(e,1073741824)}function $n(e){return Math.min(e,Fn)}function xt(e,r){return Math.max(e*2,r*6)}function wr(e,r){return e>0&&e<=r}function Ni(e,r){return e>0?e*2+r:0}function Wi(e,r){return e>=1&&r>0?e*r*(1+Re):0}function zi(e,r){return e<yt?Math.min(yt,r):e}function Nn(e,r){return wr(e,r)?Math.max(1,Math.floor(zi(e,r)/e)):0}function Ar(e,r){return e>=1&&r>0?Math.max(1,Math.min(St,Math.floor(536870912/(e*r)))):St}function Wn(e,r,t,n,o,i){let s=!r.some(u=>u)&&(o||i>=e),a=o?Math.floor(n/2)+1:n;return e>=1&&r.length>0&&(s||t>=a)}function zn(e,r,t,n){return e<r&&n.some((o,i)=>t[i]&&o.mapState==="unmapped")}function qn(e,r,t,n,o,i){return e&&r>=1&&t!==null&&n.length>0&&(o<r||i)}function Yn(e,r,t,n){let o=e.quota??0,i=e.usage??0,s=0,a=0;for(let d of r)d.codec===ge?s+=d.storedBytes:a+=d.storedBytes;let u=t*n,l=(1+Re)*u;return{quotaBytes:o,usedBytes:i,pendingRawBytes:s,compressedBytes:a,reservedBytes:l}}function Xn(e,r,t,n,o){let i=_t(e);return{maxBytes:e,vramBudgetBytes:xt(e,i),frameByteSize:r,recordingAvailable:wr(r,i),vramSimulationBytes:Ni(r,n),vramRecordingBytes:Wi(t,r),gridFormat:o}}function Xe(e,r,t){r.length>0&&(e.generationStart=r[0].generationStart,e.generationEnd=r[r.length-1].generationEnd),t.length>0&&(r.length===0&&(e.generationStart=t[0]),e.generationEnd=t[t.length-1]),e.chunks=[...r]}function Kn(e){return e.map(r=>({...r,generations:[...r.generations]}))}function Hn(e,r){return e!==r}function Ke(e,r=0){return Tt(e,"blockCount",r)}function Vn(e){return Tt(e,"storedBytes")}function jn(e){return Tt(e,"uncompressedBytes")}var qi=256,He=96,Zn=qi*Uint32Array.BYTES_PER_ELEMENT;function Yi(e){return e===B?"  return i32(cell) - center;":"  return signedWrapDelta(cell, center, size);"}function Xi(e){return e===B?"  return world - f32(center);":"  return signedWrapWorldDelta(world, center, size);"}function Ki(e){return e===B?`  let ix = min(u.grid_size.x - 1u, u.offset_cell.x + u32(local.x));
  let iy = min(u.grid_size.y - 1u, u.offset_cell.y + u32(local.y));`:`  let ix = wrapAdd(u.offset_cell.x, u32(local.x), u.grid_size.x);
  let iy = wrapAdd(u.offset_cell.y, u32(local.y), u.grid_size.y);`}function Hi(e){return`  if (u.export_visible == 1u) {
    if (exportCenterMarkerMask(local) || ${e===B?"exportBoundedCornerMarkerMask(local)":"exportOriginMarkerMask(local)"}) {
      return vec4f(0.0, 0.0, 0.0, 1.0);
    }

    if (exportCenterMarkerOutlineMask(local) || ${e===B?"exportBoundedCornerMarkerOutlineMask(local)":"exportOriginMarkerOutlineMask(local)"}) {
      return vec4f(0.82, 0.84, 0.86, 1.0);
    }
  }`}function Qn(e){let r=new ArrayBuffer(He),t=new Float32Array(r),n=new Int32Array(r),o=new Uint32Array(r),i=e.topology===B?e.offsetX:(e.offsetX%e.grid.cols+e.grid.cols)%e.grid.cols,s=e.topology===B?e.offsetY:(e.offsetY%e.grid.rows+e.grid.rows)%e.grid.rows,a=Math.floor(i),u=Math.floor(s);return t[0]=e.canvasWidth,t[1]=e.canvasHeight,t[2]=e.scale,t[4]=i-a,t[5]=s-u,o[6]=e.grid.cols,o[7]=e.grid.rows,o[8]=a,o[9]=u,o[10]=e.tribeCount,n[12]=e.brushPreview.centerX,n[13]=e.brushPreview.centerY,o[14]=e.brushPreview.brushSize,o[15]=e.brushPreview.shape,o[16]=e.brushPreview.visible?1:0,o[17]=e.exportFrameOverlay.originX,o[18]=e.exportFrameOverlay.originY,o[19]=e.exportFrameOverlay.visible?1:0,o[20]=e.topology===B?1:0,r}function Jn(e){let r=new Uint32Array(e.length);for(let t=0;t<e.length;t++){let n=e[t].color,o=parseInt(n.substring(0,2),16),i=parseInt(n.substring(2,4),16),s=parseInt(n.substring(4,6),16);r[t]=o|i<<8|s<<16}return r}function eo(e,r,t){return e.replace("__CELLS_PER_WORD__",`${r.cellsPerWord}u`).replace("__WORD_SHIFT__",`${r.wordShift}u`).replace("__CELL_SHIFT__",`${r.cellShift}u`).replace("__CELL_INDEX_MASK__",`${r.cellIndexMask}u`).replace("__CELL_MASK__",`${r.cellMask}u`).replace("__SIGNED_GRID_DELTA_BODY__",Yi(t)).replace("__SIGNED_GRID_WORLD_DELTA_BODY__",Xi(t)).replace("__GRID_COORDINATE_ASSIGNMENTS__",Ki(t)).replace("__EXPORT_OVERLAY_BLOCK__",Hi(t))}var Vi=500,ji=33,Zi=2,Qi=.5,ro=.2,to=1,Ji=1048576;function no(e){return Math.min(3,Math.max(0,Math.ceil(Math.log10(e.cols*e.rows/1e5))))}function Ve(e){return 1024/4**no(e)}function Ir(e){return 16/2**no(e)}function ea(e){return Math.max(to,Math.round(Ve(e)*Ir(e)))}function oo(e,r){return{generationsPerDrain:ea(e),targetDrainMs:r.kind==="max"?Vi:ji,smoothedDrainMs:0,lastDrainStartedAt:0,lastSubmittedGenerations:0}}function io(e,r){if(r>0&&e.lastSubmittedGenerations>0){let t=e.smoothedDrainMs===0?r:e.smoothedDrainMs*(1-ro)+r*ro,n=Math.min(Zi,Math.max(Qi,e.targetDrainMs/t));e.smoothedDrainMs=t,e.generationsPerDrain=Math.max(to,Math.min(Ji,Math.round(e.generationsPerDrain*n)))}}function Ct(e,r){return e==="recording"?Number.MAX_SAFE_INTEGER:Ve(r)*Ir(r)}function Mt(e,r,t,n,o){let i=e-r*n;return t>n||t>o?Math.min(i,r):i}function ao(e){return e<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/e}}function V(e){return e.request.stopCondition.kind==="targetGeneration"}function Be(e,r){return e.request.stopCondition.kind==="targetGeneration"&&r>=e.request.stopCondition.generation}function j(e,r){return e.request.stopCondition.kind==="targetGeneration"?Math.max(0,e.request.stopCondition.generation-r):Number.POSITIVE_INFINITY}function so(e,r){return r.restore!==!1&&e.request.restoreAfterStop||null}function uo(e,r,t){return r&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")}function lo(e,r,t,n,o){return e.restartRestoredRun!==!1&&r&&t&&!n&&!o}function vt(e,r,t,n){let o=r+t,i=Math.min(n,o-1);if(i<=0)return null;let s=o-1-i;if(s>=r)return{source:"buffered",frameInChunk:s-r};let a=0;for(let u=0;u<e.length;u++){let l=e[u];if(s<a+l.blockCount)return{source:"sealed",sealedIndex:u,frameInChunk:s-a};a+=l.blockCount}return null}function co(e,r){return{chunkFrameIndex:r.frameInChunk+1,generation:e[r.frameInChunk]}}function Rt(e,r,t,n,o,i){let s=(r+1)*t;if(o.bitsPerCell===i.bitsPerCell)return{sameFormat:!0,chunkPrefix:new Uint8Array(e,0,s),activeFrame:null};let a=re(n,o),u=new Uint8Array(s);for(let l=0;l<=r;l++){let d=new Uint8Array(e,l*a,a),p=Rr(an(d),n,o,i);u.set(new Uint8Array(p.buffer,p.byteOffset,p.byteLength),l*t)}return{sameFormat:!1,chunkPrefix:u,activeFrame:u.subarray(r*t,s)}}var c,v=!1,qr,Dr,Se,se,A=0,I=0,jr=0,k=fr,we=[],Ae=new Map,Et,Pt,D,L,Ie,Ee,rr,wt,At,Lr,go,bo,F=!1,ho=1,So=0,yo=0,E=!1,R=!1,J=100,g=0,Ge=0,je=0,Zr=0,Or,ra=4,qt=192,he=[],Yr=[],Xr=[],ta=0,Fr=null,To={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},_o={originX:0,originY:0,visible:!1},ue=null,Ur=-1,Pe=!1,Ze=!1,Bt=0,tr=gr,$r=[],w=!1,$=!1,Z={chunks:[],generationStart:0,generationEnd:0,gridFormat:Oe(fr)},xo=0,y=[],nr=!1,b=null,Co=0,Nr=!1,N=null,S=0,M=[],le=null,T=64,h=0,ce=[],q=[],Qe=null,be=null,Y=0,or=0,ne=0,Q=!1,ke=0,Wr=0,zr=0,Je=[];function Mo(e){switch(!0){case e instanceof Error:return e.message;case typeof e=="string":return e;case(e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"):return e.message;default:return String(e??"Unknown worker error")}}function Qr(e){console.error("[GOLT worker] Worker GPU error:",e),P("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),E=!1,self.postMessage({type:"gpuError",reason:Mo(e)})}self.addEventListener("error",e=>{e.preventDefault(),Qr(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),Qr(e.reason)});async function Yt(){await c.queue.onSubmittedWorkDone()}function fo(e){Wr=0,zr=2+(e?1+Re:0),Je=[]}async function Kr(){if(Je.length>0){let e=c.createCommandEncoder({label:f.trackedAllocationClearEncoder});for(let r of Je)e.clearBuffer(r);c.queue.submit([e.finish()]),await Yt(),Je=[]}}async function Hr(e,r){R&&zr>0&&(Wr+=e,zr--,Je.push(r),Wr>=$n(ye())&&zr>0&&(await Kr(),Wr=0))}function Vr(){N?.destroy(),N=null;for(let e of ce)e?.destroy();ce=[],q=[],T=0,S=0,M=[],le=null,or=0}function po(){D?.destroy(),L?.destroy(),hn(ue),ue=null,he.forEach(e=>e.destroy()),he=[],Yr=[],Xr=[],Vr()}function Gr(e){let r=Y>0;Y+=e;let t=Y>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function oe(){let e=Wn(T,q,ne,Ar(T,h),Q,S);e!==Q&&(Q=e,self.postMessage({type:"backpressure",active:e}))}async function _e(){self.postMessage({type:"storageQuota",...Yn(await navigator.storage.estimate(),y,T,h)})}function ye(){return Un(c.limits.maxBufferSize,c.limits.maxStorageBufferBindingSize)}function sr(){return _t(ye())}function ie(){return wr(h,sr())}function vo(){return zn(ne,Ar(T,h),q,ce)}function ir(){return qn(ie(),T,N,ce,S,vo())}async function na(e){let r=new DecompressionStream(ht),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],o=r.readable.getReader();for(;;){let{done:u,value:l}=await o.read();if(u)break;n.push(l)}let i=0;for(let u of n)i+=u.byteLength;let s=new Uint8Array(i),a=0;for(let u of n)s.set(u,a),a+=u.byteLength;return s.buffer}function X(){return{cols:A,rows:I}}function oa(){return bt(Math.ceil(jr/16),Math.ceil(I/16),c.limits.maxComputeWorkgroupsPerDimension)}function ia(){return bt(Math.ceil(A/16),Math.ceil(I/16),c.limits.maxComputeWorkgroupsPerDimension)}function It(){Ie?.destroy(),Ie=c.createBuffer({label:f.uniformBuffer,size:He,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function aa(){let e=Qn({canvasWidth:Se.width,canvasHeight:Se.height,scale:ho,offsetX:So,offsetY:yo,grid:X(),topology:se.topology,tribeCount:we.length,brushPreview:To,exportFrameOverlay:_o});c.queue.writeBuffer(Ie,0,e)}function Jr(){return re({cols:A,rows:I},k)}function de(){return Oe(k)}async function Gt(){let e=Jr();D=c.createBuffer({label:f.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Hr(e,D),L=c.createBuffer({label:f.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Hr(e,L);let r=c.createCommandEncoder({label:f.gridClearEncoder});r.clearBuffer(D),r.clearBuffer(L),c.queue.submit([r.finish()]),F=!1}function Dt(){let e=Jn(we);Ee&&Ee.destroy(),Ee=c.createBuffer({label:f.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),c.queue.writeBuffer(Ee,0,e)}function Lt(){let e=se.topology,r=c.createShaderModule({label:`${f.renderShaderModule} (${e})`,code:eo(Jt,k,e)});rr=c.createRenderPipeline({label:`${f.renderPipeline} (${e})`,layout:"auto",vertex:{module:r,entryPoint:"vs_main"},fragment:{module:r,entryPoint:"fs_main",targets:[{format:Dr}]},primitive:{topology:"triangle-list"}})}function Ot(){wt=c.createBindGroup({layout:rr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ie}},{binding:1,resource:{buffer:D}},{binding:2,resource:{buffer:Ee}}]}),At=c.createBindGroup({layout:rr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ie}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:Ee}}]})}function Ft(){Et=oa();let e=On(se,we,jr,X(),Et,k,Ae),r=c.createShaderModule({label:f.simulationShaderModule,code:e});Lr=c.createComputePipeline({label:f.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),go=c.createBindGroup({layout:Lr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:L}}]}),bo=c.createBindGroup({layout:Lr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:D}}]})}function Ut(){Pt=ia(),ue=bn({device:c,cols:A,rows:I,gridFormat:k,dispatchPlan:Pt})}function $t(){let e=c.createShaderModule({label:f.brushShaderModule,code:Cn(k)});Or=c.createComputePipeline({label:f.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),he.forEach(r=>r.destroy()),he=[],Yr=[],Xr=[];for(let r=0;r<ra;r++){let t=c.createBuffer({label:`${f.brushUniformBuffer} ${r}`,size:qt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});he.push(t),Yr.push(c.createBindGroup({layout:Or.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:t}}]})),Xr.push(c.createBindGroup({layout:Or.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:t}}]}))}}function sa(e,r){let t=Ae.get(x)??0,n=ta++,o=Mn(r.centerX,r.centerY,r.brushSize,X(),se.topology),i=F?Xr:Yr;for(let[s,a]of o.entries()){let u=new ArrayBuffer(qt),l=new Uint32Array(u);l[0]=jr,l[1]=r.brushSize,l[2]=r.shape,l[3]=r.fill,l[4]=t,l[5]=n,l[6]=r.tribeIds.length,l[7]=a.destinationStartX,l[8]=a.destinationStartY,l[9]=a.localStartX,l[10]=a.localStartY,l[11]=a.spanCols,l[12]=a.spanRows,l[13]=r.density,l[14]=0,l[15]=0;for(let m=0;m<r.tribeIds.length&&m<32;m++)l[16+m]=r.tribeIds[m];let d=he[s],p=i[s];if(d&&p){c.queue.writeBuffer(d,0,u);let m=Math.floor(a.destinationStartX/k.cellsPerWord),C=Math.ceil((a.destinationStartX+a.spanCols)/k.cellsPerWord)-m,U=Math.ceil(C/8),xe=Math.ceil(a.spanRows/8),fe=e.beginComputePass({label:f.brushPass});fe.setPipeline(Or),fe.setBindGroup(0,p),fe.dispatchWorkgroups(U,xe),fe.end()}else throw console.error("[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.",{index:s,rectCount:o.length,bindGroupCount:i.length,uniformBufferCount:he.length}),new Error("Brush dispatch resources are out of sync with the wrapped brush rectangles.")}}function ua(){let e=F?L:D,r=Jr(),t;try{t=c.createBuffer({label:f.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(o){return console.warn("GPU readback buffer allocation failed:",o),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=c.createCommandEncoder({label:f.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),c.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let o=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),o})}function Ro(){h=Jr(),T=Nn(h,sr())}function Nt(){self.postMessage({type:"limits",...Xn(ye(),h,T,He+Zn+qt+Ce*2+Me*2,de())})}function Bo(){return T>=1&&N!==null&&S<T}function ko(e,r){let t=F?L:D,n=S*h;e.copyBufferToBuffer(t,0,N,n,h),M.push(r),le=r,S++}function Xt(e){if(Bo()){let r=c.createCommandEncoder({label:f.recordingFrameCopyEncoder});ko(r,e),c.queue.submit([r.finish()]),er()}}function kt(e){or=Math.max(0,or+e)}function er(){T>0&&S>=T&&vo()&&ur()}function ur(){let e=N;if(e!==null&&S>0&&ce.length>0&&ne<Ar(T,h)){let r=q.indexOf(!0);if(r>=0){q[r]=!1;let t=ce[r];if(t.mapState==="unmapped"){let n=S*h,o=xo++,i=[...M],s=i[0],a=i[i.length-1],u=`chunk-${String(o).padStart(6,"0")}.bin`,l=S,d=c.createCommandEncoder({label:f.recordingSealCopyEncoder});d.copyBufferToBuffer(e,0,t,0,n),c.queue.submit([d.finish()]);let p={chunkId:o,generationStart:s,generationEnd:a,blockCount:l,codec:ge,uncompressedBytes:n,storedBytes:n,gridFormat:de(),generations:i,filename:u};Gr(1),kt(l),ne++,oe();let m=ke;t.mapAsync(GPUMapMode.READ).then(async()=>{let _=t.getMappedRange(),C=new ArrayBuffer(n);new Uint8Array(C).set(new Uint8Array(_,0,n)),t.unmap(),m===ke&&(q[r]=!0,y.push(p),kt(-l),Xe(Z,y,M),oe(),er(),la(p,C).then(()=>{m===ke&&(ne--,oe(),Gr(-1),_e(),ar(),K(!0),er(),self.postMessage({type:"chunkSealed",filename:p.filename,rawBytes:n,blockCount:p.blockCount,cols:A,rows:I,rawGridFormat:p.gridFormat,storageGridFormat:Oe(pr(se.tribes.length))}),nr&&Y===0&&(nr=!1,ar()))}).catch(U=>{m===ke&&(ne--,oe(),Gr(-1),pa(p,U).catch(Qr))}))}).catch(()=>{m===ke&&(q[r]=!0,ne--,kt(-l),oe(),Gr(-1),er())}),S=0,M=[]}else q[r]=!0}}}async function Eo(e){ke++,xo=0,S=0,M=[],y=[],le=null,or=0,ne=0,Y>0&&(Y=0,self.postMessage({type:"chunksSaving",active:!1})),Q&&(Q=!1,self.postMessage({type:"backpressure",active:!1})),nr=!1,$=w,Z={chunks:[],generationStart:e,generationEnd:e,gridFormat:de()},await wo(),_e()}async function Kt(){return be&&await be,Qe||(Qe=await(await navigator.storage.getDirectory()).getDirectoryHandle(Ye,{create:!0})),Qe}async function la(e,r){let t=await Kt(),o=await(await t.getFileHandle(e.filename,{create:!0})).createWritable(),i=!1;try{await o.write(r),await o.close(),i=!0,o=null}catch(s){if(o&&!i)try{await o.abort()}catch(a){console.warn("[GOLT worker] Failed to abort recording chunk write after error:",a)}try{await t.removeEntry(e.filename)}catch(a){a instanceof DOMException&&a.name==="NotFoundError"||console.warn("[GOLT worker] Failed to remove failed recording chunk:",e.filename,a)}throw s}}function ca(e){let r=Mo(e).toLowerCase();return e instanceof DOMException&&e.name==="QuotaExceededError"||r.includes("storage quota")||r.includes("quota exceeded")||r.includes("exceed its storage quota")}function Po(e){let r=y.findIndex(t=>t.filename===e.filename);r>=0&&y.splice(r,1)}async function da(){let e=null,r=Ke(y),t=vt(y,r,0,1);if(t?.source==="sealed"){let{frameInChunk:n}=t,o=y[t.sealedIndex];try{let i=(n+1)*h,s=await Ao(o.filename,o.codec),a=X(),u=mr(o.gridFormat),l=Rt(s,n,h,a,u,k),d=l.activeFrame??l.chunkPrefix.subarray(n*h,i);if(c.queue.writeBuffer(F?L:D,0,d),S=0,M=[],g=o.generations[n]??o.generationEnd,le=g,e=g,n<o.blockCount-1){let m=n+1,_=o.blockCount>0?Math.floor(o.uncompressedBytes/o.blockCount):h;o.blockCount=m,o.generationEnd=g,o.generations=o.generations.slice(0,m),o.uncompressedBytes=_*m,o.codec===ge&&(o.storedBytes=h*m)}let p=y.splice(t.sealedIndex+1);await Wt(p.map(m=>m.filename)),et(),Lo(),O()}catch(i){console.warn("[GOLT worker] Failed to restore the previous persisted recording frame after storage quota pressure:",i)}}else{let n=y.splice(0);await Wt(n.map(o=>o.filename)),S=0,M=[]}return e}async function fa(e,r){console.warn("[GOLT worker] Recording stopped because OPFS storage quota was reached:",r),Po(e),P("cancelled",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),E=!1,w=!1,$=!1;let t=await da();Xe(Z,y,M),oe(),_e(),ar(),K(!0),self.postMessage({type:"recordingStopped",reason:"storageQuota",restoredGeneration:t})}async function pa(e,r){Po(e),ca(r)?await fa(e,r):Qr(r)}async function Wt(e){let r=await Kt();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function wo(){if(be)await be;else{be=(async()=>{let e=await navigator.storage.getDirectory();Qe=null;try{await e.removeEntry(Ye,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${Ye}:`,r)}Qe=await e.getDirectoryHandle(Ye,{create:!0})})();try{await be}finally{be=null}}}function ar(){Xe(Z,y,M),self.postMessage({type:"recording",manifest:{chunks:Kn(y),generationStart:Z.generationStart,generationEnd:Z.generationEnd,gridFormat:de()},cols:A,rows:I})}function lr(e=!1){if(w){let r=!$;e&&$&&ir()&&($=!1,r=!0),r&&Hn(le,g)&&ir()&&(S>=T&&ur(),Xt(g))}}function Ht(){if(Fr){let e=Fr;Fr=null;let r=w&&S>0&&M[S-1]===g;r&&(S--,M.pop());let t=c.createCommandEncoder({label:f.brushEncoder});sa(t,e),c.queue.submit([t.finish()]),r&&Xt(g)}}async function Ao(e,r=ge){let i=await(await(await(await Kt()).getFileHandle(e)).getFile()).arrayBuffer();return r===ht?na(i):i}function Io(){return dn(A,I,tr.enabled,tr.sections)}function ma(){return fn(Io())}function Go(e){$r=ma(),ue&&$r.length>0&&Sn({device:c,encoder:e,resources:ue,sourceBuffer:F?L:D,dispatchPlan:Pt,enabledSections:$r})}function Do(){let e=g;if(ue&&e!==Ur&&!Pe){let r=[...$r],t=Io();Ur=e,Pe=!0,yn({resources:ue,enabledSections:r}).then(n=>{let o=Ae.get(x)??0,i=Ke(y,S+or),s=Tn({generation:e,tribes:we,deadTribeIndex:o,readback:n,enabledSections:r,availability:t,liveMetricSettings:tr.sections,cols:A,rows:I,totalFrames:i,fps:Zr,canStepBack:i>1,recordingBytes:Vn(y),recordingRawBytes:jn(y)});if(Pe=!1,self.postMessage(s),Ze)if(Ze=!1,Ur=-1,Fo()){let a=c.createCommandEncoder({label:f.interactiveMetricsEncoder});Go(a),c.queue.submit([a.finish()]),Do()}else Ze=!0}).catch(()=>{Pe=!1})}}function Vt(e){let r=e.beginComputePass({label:f.simulationStepPass});r.setPipeline(Lr),r.setBindGroup(0,F?bo:go);let t=Et;r.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),r.end(),F=!F,g++}function ga(e){if(e>0){let r=c.createCommandEncoder({label:f.simulationBatchEncoder});for(let t=0;t<e;t++)Vt(r);c.queue.submit([r.finish()]),Ge+=e}}function Lo(){self.postMessage({type:"generation",generation:g,fps:Zr})}function ba(){let e=c.createCommandEncoder({label:f.simulationSingleStepEncoder});Vt(e),c.queue.submit([e.finish()])}function O(){if(c&&qr&&Ie&&rr&&wt&&At&&!R&&!v){aa();let e=qr.getCurrentTexture().createView(),r=c.createCommandEncoder({label:f.renderEncoder}),t=r.beginRenderPass({label:f.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(rr),t.setBindGroup(0,F?At:wt),t.draw(3),t.end(),c.queue.submit([r.finish()])}}function Oo(e){je===0&&(je=e);let r=e-je;r>=1e3&&(Zr=Ge/(r/1e3),Ge=0,je=e)}function et(){Ge=0,je=0,Zr=0}function jt(){return w&&ie()?"recording":"nonRecording"}function Fo(){return!!(c&&ue&&!R&&!v)}function K(e=!1){if(e&&(Ur=-1),!Fo())Ze=!0;else if(Pe)Ze=!0;else{let r=c.createCommandEncoder({label:f.interactiveMetricsEncoder});Go(r),c.queue.submit([r.finish()]),Do()}}function Uo(){K(!0),O()}function rt(e,r){r&&(e-Bt>=1e3||Bt===0)&&!Pe&&(Bt=e,K())}function cr(e,r){(e.request.pacing.kind==="max"||V(e))&&r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,Lo())}function De(e){Q!==e&&(Q=e,self.postMessage({type:"backpressure",active:e}))}function $o(){let e=ir();return e&&S>=T&&(ur(),e=ir()),e}function dr(){!R&&!v&&!b&&self.requestAnimationFrame(zt)}function ha(e,r){let t=e.adaptiveBatch;t&&t.lastDrainStartedAt>0&&(io(t,r-t.lastDrainStartedAt),t.lastDrainStartedAt=0,t.lastSubmittedGenerations=0)}function No(e,r,t){let n=e.adaptiveBatch;n&&r>0&&(n.lastSubmittedGenerations=r,n.lastDrainStartedAt=t)}function Wo(e,r){let t=Math.max(1,Math.round(Ve(r))),n=0;for(;n<e;){let o=e-n,i=Math.min(t,o);ga(i),n+=i}return n}function Te(e){let r=b;if(r&&!r.pumpPending&&!R&&!v){let{token:t}=r;r.pumpPending=!0;let n=()=>{if(b&&b.token===t){let o=performance.now();b.pumpPending=!1,e==="drain"&&ha(b,o),Ma(o)}};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?c.queue.onSubmittedWorkDone().then(n).catch(()=>{b?.token===t&&(b.pumpPending=!1)}):queueMicrotask(n)}}function Zt(e,r){b&&P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1});let t=X(),n=e==="nonRecording"?oo(t,r.pacing):null;n&&console.info("[GOLT worker] Adaptive non-recording batching started",{cols:t.cols,rows:t.rows,bitsPerCell:k.bitsPerCell,generationsPerDrain:n.generationsPerDrain,targetDrainMs:n.targetDrainMs}),b={kind:e,request:r,token:++Co,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0,adaptiveBatch:n},Te(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function ae(){E&&Zt(jt(),{pacing:ao(J),stopCondition:{kind:"none"}})}function Sa(e,r){r||e==="cancelled"?De(!1):Q&&oe()}function P(e,r={}){let t=b;if(t){b=null,Co++;let n=V(t),o=so(t,r),i=!!o;o&&(E=o.running,J=o.targetStepDuration),uo(e,n,r)&&self.postMessage({type:"stepping",active:!1}),Sa(e,n),r.render!==!1&&!R&&!v&&Uo(),lo(r,i,E,R,v)?ae():dr()}}function zo(e){let r=b;r&&V(r)&&(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),P("cancelled"))}function ya(e){P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Zt(jt(),e)}function qo(e,r,t){De(!0),cr(e,r),rt(r,t),Te("drain")}function Yo(e,r){let t=c.createCommandEncoder({label:f.recordingStepBatchEncoder}),n=0,o=!1,i=e>0;for(;i;)n<e&&performance.now()<r?$o()&&Bo()?(Vt(t),ko(t,g),n++,S>=T&&(i=!1)):(o=!0,i=!1):i=!1;return n>0&&(c.queue.submit([t.finish()]),Ge+=n,er()),{steps:n,blocked:o}}function Ta(e,r){let t=X(),n=e.adaptiveBatch?.generationsPerDrain??Math.round(Ve(t)*Ir(t)),o=Math.min(n,j(e,g)),i=Wo(o,t),s=i>0;cr(e,r),Be(e,g)?P("targetReached"):s?(No(e,i,performance.now()),Te("drain")):Te("raf")}function _a(e,r){lr(!0);let t=!1,n=!1,o=performance.now()+14,i=j(e,g)>0&&performance.now()<o;for(;i;){let s=Yo(j(e,g),o);t=t||s.steps>0,s.blocked?(qo(e,r,t),n=!0,i=!1):i=s.steps>0&&j(e,g)>0&&performance.now()<o}n||(De(!1),cr(e,r),rt(r,t),Be(e,g)?P("targetReached"):Te("raf"))}function xa(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let o=e.stepAccumulator,i=Math.floor(e.stepAccumulator/r),s=X(),a=e.adaptiveBatch?.generationsPerDrain??Ct(e.kind,s),u=Math.min(i,j(e,g),a),l=Wo(u,s),d=l>0;if(e.stepAccumulator=Mt(o,r,i,l,a),cr(e,t),Be(e,g))P("targetReached");else{let p=d&&i>l;(!V(e)&&!p||t-e.lastRenderTime>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,O(),rt(t,d)),p&&No(e,l,performance.now()),Te(p?"drain":"raf")}}function Ca(e,r,t){lr(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let o=!1,i=0,s=e.stepAccumulator,a=Ct(e.kind,X()),u=Math.floor(e.stepAccumulator/r),l=performance.now()+14,d=!1,p=u>0&&j(e,g)>0&&i<a&&performance.now()<l;for(;p;){let m=Math.min(u-i,a-i,j(e,g)),_=Yo(m,l);i+=_.steps,o=o||_.steps>0,_.blocked?(qo(e,t,o),d=!0,p=!1):p=_.steps>0&&u>i&&j(e,g)>0&&i<a&&performance.now()<l}e.stepAccumulator=Mt(s,r,u,i,a),d||(De(!1),cr(e,t),Be(e,g)?P("targetReached"):(V(e)||(O(),rt(t,o)),Te("raf")))}function Ma(e){let r=b;if(r&&!R&&!v)if(Oo(e),V(r)||Ht(),Be(r,g))P("targetReached");else if(r.request.pacing.kind==="max")r.kind==="recording"?_a(r,e):Ta(r,e);else{let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?Ca(r,t,e):xa(r,t,e)}}function zt(e){R||v?self.requestAnimationFrame(zt):(Oo(e),b||(Ht(),J>0&&!Nr&&O(),self.requestAnimationFrame(zt)))}function va(e,r){let t=c?ye():Number.POSITIVE_INFINITY;return tn(r.bitsPerCell)&&it(r.bitsPerCell,e.tribes.length)&&at(e,Le(r.bitsPerCell),t)?Le(r.bitsPerCell):on(e.tribes.length,e,t)}function Xo(e,r){let t=e.topology===B?B:sn,n=e.tribes.some(o=>o.id===e.boundaryTribe)?e.boundaryTribe:x;se={...e,topology:t,boundaryTribe:n},A=e.cols,I=e.rows,k=va(e,r),jr=pe(A,k),we=[...se.tribes],Z.gridFormat=de(),Ae.clear(),we.forEach((o,i)=>Ae.set(o.id,i))}async function Ko(e){console.log("[GOLT worker] Initializing WebGPU"),Se=e,c=await ln(f.webengineDevice),v=!1,c.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),P("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),v=!0,E=!1,R=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:ye(),vramBudgetBytes:xt(ye(),sr()),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:de()});let r=Se.getContext("webgpu");if(r)qr=r,Dr=navigator.gpu.getPreferredCanvasFormat(),qr.configure({device:c,format:Dr,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:Dr,maxBufferSize:c.limits.maxBufferSize,maxStorageBufferBindingSize:c.limits.maxStorageBufferBindingSize});else throw new Error("WebGPU canvas context not available")}async function Ra(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Ko(Se),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),P("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),v=!0,E=!1,R=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function Ho(){N=c.createBuffer({label:f.recordingChunkBuffer,size:T*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Hr(T*h,N),S=0,M=[],le=null}async function Vo(){let e=T*h;ce=[],q=[];for(let r=0;r<Re;r++){let t=c.createBuffer({label:`${f.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});ce.push(t),q.push(!0),await Hr(e,t)}}async function Ba(){await wo()}async function ka(){console.log("[GOLT worker] Building GPU resources",{cols:A,rows:I,bitsPerCell:k.bitsPerCell,recordingAvailable:ie()}),It(),Ro(),await Gt(),Dt(),Lt(),Ot(),Ft(),$t(),Ut(),await Ba(),ie()?(await Ho(),await Vo()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:h,maxRecordingBufferBytes:sr()}),Vr(),w=!1,$=!1),await Kr(),Nt(),console.log("[GOLT worker] GPU resources ready")}async function Ea(){console.log("[GOLT worker] Rebuild started",{cols:A,rows:I,bitsPerCell:k.bitsPerCell}),P("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),R=!0,self.postMessage({type:"rebuilding",active:!0});try{await Yt()}catch{console.warn("[GOLT worker] Queue idle wait rejected during rebuild")}let e=!v;if(v&&(e=await Ra()),e){po(),It(),Ro(),fo(ie());try{await Gt(),Dt(),Lt(),Ft(),$t(),Ot(),Ut(),ie()?(await Ho(),await Vo()):(Vr(),w=!1,$=!1),await Kr(),Nt()}catch(r){let t=r instanceof Error?r.message:String(r);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{po(),It(),fo(!1),await Gt(),Dt(),Lt(),Ft(),$t(),Ot(),Ut(),w=!1,$=!1,h=Jr(),Vr(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await Kr(),Nt()}catch(n){console.error("[GOLT worker] GPU rebuild recovery failed:",n),e=!1}}}return e&&(R=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:ie(),frameByteSize:h})),e}function mo(e){Nr=!0,c.queue.onSubmittedWorkDone().then(()=>{Nr=!1,e()}).catch(()=>{Nr=!1})}async function Pa(){Y>0&&await new Promise(e=>{let r=setInterval(()=>{Y===0&&(clearInterval(r),e())},10)})}async function wa(e){console.log("[GOLT worker] Init message received",{cols:e.ruleset.cols,rows:e.ruleset.rows,recording:e.recording,running:e.running,speed:e.speed}),w=e.recording,tr=ut(e.liveMetrics),$=w,Xo(e.ruleset,e.simulationGridFormat),await Ko(e.canvas),await ka(),K(!0),_e(),E=e.running,J=e.speed<0?0:1e3/e.speed,E?ae():dr()}function Aa(e){tr=ut(e.liveMetrics),K(!0)}async function Ia(e){console.log("[GOLT worker] Ruleset update received",{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length});let r=ye();if(st(e.ruleset.tribes.length,e.ruleset,r))P("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Xo(e.ruleset,e.simulationGridFormat),await Ea()&&(g=0,et(),await Eo(0),K(!0),E?ae():dr());else{let o=`Requested ruleset requires at least ${nn(e.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",o,{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length,maxBytes:r}),self.postMessage({type:"gpuError",reason:o})}}function Ga(e){E=e.running,e.running?b||ae():b&&V(b)?zo(!1):b?P("manual"):(Q&&oe(),Uo(),dr())}function Da(e){let r=J<=0,t=e.speed<0?0:1e3/e.speed;J=t,b&&!V(b)&&E?(P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&t>0?mo(()=>{O(),ae()}):ae()):E&&!b?ae():r&&t>0&&mo(()=>{O(),dr()})}function La(e){ho=e.scale,So=e.offsetX,yo=e.offsetY,!b&&!R&&!v&&O()}function Oa(e){Se.width=e.width,Se.height=e.height,!b&&!R&&!v&&O()}function Fa(e){let r=e.tribes.map(t=>Ae.get(t)).filter(t=>t!==void 0);if(r.length>0){let t={square:0,round:1,diamond:2,vline:3,hline:4},n={full:0,spray:1,outline:2};Fr={centerX:e.x,centerY:e.y,brushSize:e.size,shape:t[e.shape]??0,fill:n[e.fill]??0,density:rn(e.density),tribeIds:r}}}function Ua(e){let r={square:0,round:1,diamond:2,vline:3,hline:4};To={centerX:e.x,centerY:e.y,brushSize:e.size,shape:r[e.shape]??0,visible:e.visible},!b&&!R&&!v&&J<=0&&O()}function $a(e){_o={originX:e.origin?.originX??0,originY:e.origin?.originY??0,visible:e.visible&&e.origin!==null},!b&&!R&&!v&&J<=0&&O()}async function Na(){try{let e=await ua();lt({type:"snapshot",grid:e,generation:g,cols:A,rows:I,gridFormat:de()},[e.buffer])}catch{let e=new Uint32Array(0);lt({type:"snapshot",grid:e,generation:g,cols:A,rows:I,gridFormat:de()},[e.buffer])}}async function Wa(e){let r=mr(e.gridFormat),t=X();if(e.grid.byteLength===re(t,r)){let n=Rr(e.grid,t,r,k);c.queue.writeBuffer(F?L:D,0,n),g=e.generation,et(),await Eo(e.generation)}}function za(e){let r=b?.request,t=ie();e.recording&&t&&!w?(w=!0,$=!0,K(!0),_e()):(!e.recording||!t)&&(e.recording&&!t&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:h,maxRecordingBufferBytes:sr()}),w=!1,$=!1),r&&b?ya(r):!b&&E&&ae()}async function qa(){nr||(await Yt(),lr(!1),S>0&&ur(),Y>0?nr=!0:ar())}async function Ya(e){let r=Ke(y),t=vt(y,r,S,e.count);if(t){let n=F?L:D;if(t.source==="buffered"){let o=co(M,t);S=o.chunkFrameIndex,M.length=S,g=o.generation,le=g;let i=c.createCommandEncoder({label:f.recordingRestoreCopyEncoder});i.copyBufferToBuffer(N,t.frameInChunk*h,n,0,h),c.queue.submit([i.finish()])}else{Y>0&&(await Pa(),r=Ke(y));let o=y[t.sealedIndex],i=await Ao(o.filename,o.codec),s=X(),a=mr(o.gridFormat),u=Rt(i,t.frameInChunk,h,s,a,k);if(c.queue.writeBuffer(N,0,u.chunkPrefix),!u.sameFormat&&u.activeFrame&&c.queue.writeBuffer(n,0,u.activeFrame),S=t.frameInChunk+1,M=o.generations.slice(0,t.frameInChunk+1),g=M[t.frameInChunk],le=g,u.sameFormat){let d=c.createCommandEncoder({label:f.recordingRestoreCopyEncoder});d.copyBufferToBuffer(N,t.frameInChunk*h,n,0,h),c.queue.submit([d.finish()])}let l=y.splice(t.sealedIndex);Wt(l.map(d=>d.filename))}Xe(Z,y,M),_e(),et(),K(!0),O()}}function Xa(){Ht(),lr(!0),!w||$o()?(ba(),Ge++,w&&ir()&&(S>=T&&ur(),Xt(g)),De(!1)):De(!0),K(!0),O()}function Ka(e){self.postMessage({type:"stepping",active:!0}),lr(!0),Zt(jt(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:g+e},restoreAfterStop:{running:E,targetStepDuration:J}})}function Ha(e){e.count===1?Xa():Ka(e.count)}function Va(){zo(b?.request.restoreAfterStop?.running??E)}function ja(e){let r=y.find(t=>t.filename===e.filename);r&&(r.codec=e.codec,r.storedBytes=e.storedBytes,r.gridFormat=e.gridFormat,Z.chunks=[...y],_e(),ar())}function Za(){let e=y.filter(r=>r.codec===ge).map(r=>({filename:r.filename,rawBytes:r.uncompressedBytes,blockCount:r.blockCount,cols:A,rows:I,rawGridFormat:r.gridFormat,storageGridFormat:Oe(pr(se.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:e})}async function Qa(e){switch(e.type){case"init":await wa(e);break;case"setLiveMetrics":Aa(e);break;case"setRuleset":await Ia(e);break;case"setRunning":Ga(e);break;case"setSpeed":Da(e);break;case"camera":La(e);break;case"resize":Oa(e);break;case"draw":Fa(e);break;case"brushPreview":Ua(e);break;case"exportFrameOverlay":$a(e);break;case"getSnapshot":await Na();break;case"loadSnapshot":await Wa(e);break;case"setRecording":za(e);break;case"getRecording":await qa();break;case"stepBack":await Ya(e);break;case"stepForward":Ha(e);break;case"cancelStepping":Va();break;case"updateChunkCodec":ja(e);break;case"getUncompressedChunks":Za();break}}self.onmessage=async e=>{await Qa(e.data)};
