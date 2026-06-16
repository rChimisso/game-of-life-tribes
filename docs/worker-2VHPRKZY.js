var Ht="goltTimestampedConsoleInstalled";function zi(){let e=globalThis;e[Ht]||(e[Ht]=!0,Zr("info"),Zr("warn"),Zr("error"),console.log=console.info.bind(console))}function Zr(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}zi();var jt=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var Qr=[1,2,4,8,16,32],Xi={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},qi={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Yi={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},sr={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Hi={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},Jr={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},J={1:Xi,2:qi,4:Yi,8:sr,16:Hi,32:Jr};function Vt(e){return Qr.includes(e)}function ji(e){return 2**e}function et(e,r){return r<=ji(e)}function rt(e,r,t){return ee(e,r)<=t}function ur(e){return e<=2?J[1]:e<=4?J[2]:e<=16?J[4]:e<=256?J[8]:e<=65536?J[16]:J[32]}function Zt(e){return ur(e)}function Ie(e){return J[e]}function Qt(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){return tt(e,r,t)??Jr}function tt(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of Qr){let i=Ie(n);if(et(n,e)&&rt(r,i,t))return i}return null}function nt(e){return Ie(e?.bitsPerCell??8)}function Ge(e){return{bitsPerCell:e.bitsPerCell}}function ce(e,r){return Math.ceil(e/r.cellsPerWord)}function ee(e,r){return ce(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Jt(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}var Le={population:!0,diversity:!0,interfaces:!1},cr={enabled:!0,sections:Le};function Vi(e){return{population:typeof e?.population=="boolean"?e.population:Le.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Le.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Le.interfaces}}function it(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:cr.enabled,sections:Vi(e?.sections)}}function ot(e,r){self.postMessage(e,r)}var v="dead";var at="empty",en="is",lr="comparison",dr="count",fr="none",pr="exactly",mr="min",br="max",gr="not",hr="and",Sr="or",yr="xor";async function rn(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var f={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",recordingStepBatchEncoder:"recording step batch encoder",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var tn=4294967295;function st(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function N(e,r){return e.includes(r)}function nn(e,r,t,n){let i=e*r,o=i<=tn,s=i*2<=tn;return{population:st(t&&n.population,o),diversity:st(t&&n.diversity,o),interfaces:st(t&&n.interfaces,s)}}function on(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var Se=256*Uint32Array.BYTES_PER_ELEMENT,ye=Uint32Array.BYTES_PER_ELEMENT;function an(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function sn(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function un(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function Zi(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
${an(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${sn(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${un(i)}
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
`}function Qi(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
${an(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${sn(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${un(i)}
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
`}function Ji(e,r){let{tribes:t,deadTribeIndex:n,readback:i,cols:o,rows:s}=e,a=o*s,u={};for(let p=0;p<t.length;p++){let d=r?i.histogram[p]??0:0;u[t[p].id]=d}let l=r?u[t[n]?.id??""]??0:0;return{population:u,aliveCells:r?Math.max(0,a-l):0,deadCells:l}}function eo(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,i=0;for(let o=0;o<r.length;o++)o!==t&&(i+=n.histogram[o]??0);return i}function ro(e,r){let{tribes:t,deadTribeIndex:n,readback:i}=e,o=r?eo(e):0,s=0,a=0;for(let u=0;u<t.length;u++){let l=u!==n&&o>0?(i.histogram[u]??0)/o:0;l>0&&(s-=l*Math.log2(l),a+=l*l)}return{shannonEntropy:s,simpsonSum:a}}function to(e,r){let t=e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,i=r?Math.max(0,t-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?i/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function cn(e){let{device:r}=e,t=r.createShaderModule({label:f.histogramMetricsShaderModule,code:Zi(e)}),n=r.createComputePipeline({label:f.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),i=r.createBuffer({label:f.histogramMetricsBuffer,size:Se,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=r.createBuffer({label:f.histogramMetricsReadBuffer,size:Se,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=r.createShaderModule({label:f.interfaceMetricsShaderModule,code:Qi(e)}),a=r.createComputePipeline({label:f.interfaceMetricsPipeline,layout:"auto",compute:{module:s,entryPoint:"main"}}),u=r.createBuffer({label:f.interfaceMetricsBuffer,size:ye,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),l=r.createBuffer({label:f.interfaceMetricsReadBuffer,size:ye,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:a,boundaryBuffer:u,boundaryReadBuffer:l}}function ln(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function dn(e){let{device:r,encoder:t,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:s}=e;if(N(s,"population")||N(s,"diversity")){let a=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,a);let u=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),l=t.beginComputePass({label:f.histogramMetricsPass});l.setPipeline(n.histogramPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Se)}if(N(s,"interfaces")){let a=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,a);let u=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),l=t.beginComputePass({label:f.interfaceMetricsPass});l.setPipeline(n.boundaryPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,ye)}}async function fn(e){let{resources:r,enabledSections:t}=e,n=N(t,"population")||N(t,"diversity"),i=N(t,"interfaces"),o=[];n&&o.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let s=new Uint32Array(256);n&&(s=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let a=0;if(i){let u=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),a=u[0]??0}return{histogram:s,crossStateContactEdges:a}}function pn(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:i,cols:o,rows:s,totalFrames:a,fps:u,canStepBack:l,recordingBytes:p,recordingRawBytes:d}=e,m=N(t,"population")&&i.population,x=N(t,"diversity")&&i.diversity,S=N(t,"interfaces")&&i.interfaces,U=o*s,ue=Ji(e,m),$=ro(e,x),Yt=to(e,S);return{type:"metrics",generation:r,population:ue.population,aliveCells:ue.aliveCells,deadCells:ue.deadCells,occupancy:m&&U>0?ue.aliveCells/U:0,shannonEntropy:$.shannonEntropy,simpsonIndex:x?1-$.simpsonSum:0,interfaces:Yt,metricsAvailability:n,extinctionTime:{},totalFrames:a,fps:u,canStepBack:l,recordingBytes:p,recordingRawBytes:d}}function no(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}function mn(e,r,t,n,i){let o=ce(r.cols,t),s=e[i*o+(n>>t.wordShift)]??0;return no(s,t,n&t.cellIndexMask)}function bn(e,r,t,n,i,o){let s=ce(r.cols,t),a=i*s+(n>>t.wordShift),u=(n&t.cellIndexMask)<<t.cellShift,l=~(t.cellMask<<u),p=e[a]??0;e[a]=(p&l|(o&t.cellMask)<<u)>>>0}var io=64*1024*1024,gs=256*1024*1024;function Tr(e,r,t,n){let i=e,o;if(t.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(ee(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let s=0;s<r.rows;s++)for(let a=0;a<r.cols;a++)bn(o,r,n,a,s,mn(i,r,t,a,s))}return o}function gn(e,r,t){let n=Math.floor((r-1)/2),i=e-n,o=i+r,s=[];if(i>=0&&o<=t)s.push({destinationStart:i,localStart:0,span:r});else if(i<0){let a=-i;s.push({destinationStart:t-a,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:r-a})}else{let a=t-i;s.push({destinationStart:i,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:o-t})}return s.filter(a=>a.span>0)}function hn(e){return`
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
`}function Sn(e,r,t,n){let i=gn(e,t,n.cols),o=gn(r,t,n.rows),s=[];for(let a of o)for(let u of i)s.push({destinationStartX:u.destinationStart,destinationStartY:a.destinationStart,localStartX:u.localStart,localStartY:a.localStart,spanCols:u.span,spanRows:a.span});return s}var yn={"=":"==","\u2260":"!=",">":">","<":"<","\u2265":">=","\u2264":"<="};function oo(e){let r;return typeof e=="string"?r=Tn([e]):r=I(e),r}function Tn(e){return{kind:"tribes",tribes:[...e&&e.length>0?e:[v]]}}function I(e,r){let t=e??Tn(r),n;switch(t.kind){case"tribes":n={...t,tribes:[...t.tribes]};break;case"tiedMajority":n={...t,source:I(t.source)};break;default:n={...t};break}return n}function De(e,r){return{kind:"count",selector:I(e?.selector,r)}}function Cr(e){return JSON.stringify(re(e))}function re(e){let r;switch(e.kind){case"tribes":r={...e,tribes:[...new Set(e.tribes)].sort()};break;case"tiedMajority":r={...e,source:re(e.source)};break;default:r=e;break}return r}function Cn(e){return e.become??{kind:"fixed",tribe:e.tribe??v}}function Fe(e){let r;switch(e.kind){case"majority":case"minority":r={...e,selector:I(e.selector),tie:e.tie?Fe(e.tie):void 0,fallback:e.fallback?Fe(e.fallback):void 0};break;case"combine":r={kind:"combine",strategy:{...e.strategy,entries:e.strategy.entries.map(t=>({...t,inputs:t.inputs.map(n=>oo(n)).sort((n,i)=>Cr(n).localeCompare(Cr(i)))})),default:e.strategy.default?Fe(e.strategy.default):void 0}};break;default:r={...e};break}return r}function ao(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function so(e,r){e.push(`const CELLS_PER_WORD: u32 = ${r.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${r.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${r.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${r.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${r.cellMask}u;`)}function uo(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function co(e,r,t){r.remapped?(e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;")):(e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;"))}function lo(e){let r=_o(e),t=new Map,n=0;for(let i of r)t.set(i,`count_${n++}`);return t}function fo(e,r){let t=xo(e),n=new Map,i=0;for(let o of t){let s=r.get(o);s?n.set(o,s):n.set(o,`eq_count_${i++}`)}return n}function po(e,r,t,n){for(let[i,o]of r)e.push(`  let ${o} = ${lt(Bn(i),t,n)};`);r.size>0&&e.push("")}function mo(e,r,t,n,i){let o=0;for(let[s,a]of t)r.has(s)||(e.push(`  let ${a} = ${lt(Bn(s),n,i)};`),o++);o>0&&e.push("")}function bo(e,r,t,n,i,o){for(let s=0;s<r.length;s++){let a=r[s],u=Ue(a.clause,t,n,i,o);e.push(s===0?`  if (${u}) {`:`  } else if (${u}) {`),ct(e,Fe(Cn(a)),i,o,`rule_${s}`,"    ")}r.length>0&&e.push("  }"),e.push("")}function ct(e,r,t,n,i,o,s=null){switch(r.kind){case"fixed":e.push(`${o}result = ${W(r.tribe,n)}u;`);break;case"same":e.push(`${o}result = selfTribe;`);break;case"majority":case"minority":go(e,r,t,n,i,o);break;case"combine":ho(e,r,t,n,i,o,s);break}}function go(e,r,t,n,i,o){let s=I(r.selector),a=`${i}_${r.kind}`,u=`${i}_${r.kind}_count`,l=`${i}_${r.kind}_ties`,p=r.kind==="majority"?"0u":"9u",d=r.kind==="majority"?`candidateCount > ${u}`:`candidateCount < ${u}`;e.push(`${o}var ${a}: u32 = ${W(v,n)}u;`),e.push(`${o}var ${u}: u32 = ${p};`),e.push(`${o}var ${l}: u32 = 0u;`);for(let m of _r(s,t,n)){let x=q(U=>`${U} == ${m}u`),S=Te(s,m,n);e.push(`${o}{`),e.push(`${o}  let candidateCount = ${x};`),e.push(`${o}  if (${S} && candidateCount > 0u) {`),e.push(`${o}    if (${d}) {`),e.push(`${o}      ${a} = ${m}u;`),e.push(`${o}      ${u} = candidateCount;`),e.push(`${o}      ${l} = 1u;`),e.push(`${o}    } else if (candidateCount == ${u}) {`),e.push(`${o}      ${l} = ${l} + 1u;`),e.push(`${o}    }`),e.push(`${o}  }`),e.push(`${o}}`)}e.push(`${o}if (${l} == 1u) {`),e.push(`${o}  result = ${a};`),e.push(`${o}} else if (${l} > 1u) {`),r.tie?ct(e,r.tie,t,n,`${i}_tie`,`${o}  `,{selector:s,bestCountVar:u,tieCountVar:l}):vr(e,r.fallback,t,n,`${i}_tie_fallback`,`${o}  `),e.push(`${o}} else {`),vr(e,r.fallback,t,n,`${i}_fallback`,`${o}  `),e.push(`${o}}`)}function vr(e,r,t,n,i,o){r?ct(e,r,t,n,i,o):e.push(`${o}result = ${W(v,n)}u;`)}function ho(e,r,t,n,i,o,s){let a=`${i}_input_mask`;e.push(`${o}var ${a}: u32 = 0u;`);for(let d of Co(t,n,s)){let m=_n(d,n,s);e.push(`${o}if (${m}) {`),e.push(`${o}  ${a} = ${a} | ${xn(d)};`),e.push(`${o}}`)}let u=`${i}_dead_present`,l=q(d=>`${d} == ${W(v,n)}u`);e.push(`${o}let ${u} = ${l} > 0u;`);let p=[...r.strategy.entries].sort((d,m)=>Number(ut(m,n))-Number(ut(d,n)));p.forEach((d,m)=>{let x=vo(d.inputs,t,n,s),S=ut(d,n)?` && ${u}`:"",U=`${a} == (${x})${S}`;e.push(m===0?`${o}if (${U}) {`:`${o}} else if (${U}) {`),e.push(`${o}  result = ${W(d.output,n)}u;`)}),p.length>0?(e.push(`${o}} else {`),vr(e,r.strategy.default,t,n,`${i}_fallback`,`${o}  `),e.push(`${o}}`)):vr(e,r.strategy.default,t,n,`${i}_fallback`,o)}function So(e){for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(`    let ${Mn(t,r)} = readCell(${vn("x",t,"COLS")}, ${vn("y",r,"ROWS")});`)}function lt(e,r,t){let n=re(e),i;switch(n.kind){case"same":i=q(o=>`${o} == selfTribe`);break;case"different":i=q(o=>`${o} != selfTribe`);break;case"tiedMajority":i=lt(n.source,r,t);break;case"tribes":{let o=$e(n.tribes,t);i=o.length===0?"0u":q(s=>o.map(a=>`${s} == ${a}u`).join(" || "));break}}return i}function q(e){return yo().map(r=>`select(0u, 1u, ${e(r)})`).join(" + ")}function Mn(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function yo(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(Mn(t,r));return e}function vn(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function $e(e,r){let t=[];for(let n of e)t.push(Mr(n,r,"selector"));return[...new Set(t)]}function W(e,r){return Mr(e,r,"target")}function Mr(e,r,t){let n=r.get(e),i=r.get(v)??0;return n===void 0&&console.error(`Unknown rule ${t} tribe; using dead tribe instead.`,{tribe:e}),n??i}function _r(e,r,t){let n=re(e),i;switch(n.kind){case"tribes":i=$e(n.tribes,t);break;case"tiedMajority":i=_r(n.source,r,t);break;default:i=r.map(o=>Mr(o.id,t,"selector"));break}return[...new Set(i)].sort((o,s)=>o-s)}function Te(e,r,t){let n=re(e),i;switch(n.kind){case"same":i=`selfTribe == ${r}u`;break;case"different":i=`selfTribe != ${r}u`;break;case"tiedMajority":i=Te(n.source,r,t);break;case"tribes":{i=$e(n.tribes,t).includes(r)?"true":"false";break}}return i}function To(e,r,t,n){let i=re(e),o;if(i.kind==="tiedMajority"&&n){let s=q(u=>`${u} == ${r}u`),a=Te(n.selector,r,t);o=`(${n.tieCountVar} > 1u && ${n.bestCountVar} > 0u && ${a} && ${s} == ${n.bestCountVar})`}else{let s=q(u=>`${u} == ${r}u`);o=`(${Te(i.kind==="tiedMajority"?i.source:i,r,t)} && ${s} > 0u)`}return o}function Co(e,r,t){let n;return t?n=_r(t.selector,e,r):n=e.map(i=>Mr(i.id,r,"selector")),[...new Set(n)].filter(i=>i!==W(v,r)).sort((i,o)=>i-o)}function _n(e,r,t){let n;if(t){let i=q(s=>`${s} == ${e}u`),o=Te(t.selector,e,r);n=`(${e}u != ${W(v,r)}u && ${t.tieCountVar} > 1u && ${t.bestCountVar} > 0u && ${o} && ${i} == ${t.bestCountVar})`}else{let i=q(o=>`${o} == ${e}u`);n=`(${e}u != ${W(v,r)}u && ${i} > 0u)`}return n}function vo(e,r,t,n){let i=[];for(let o of e){let s=I(o);for(let a of _r(s,r,t))if(a!==W(v,t)){let u=Mo(s,a,t,n);i.push(`select(0u, ${xn(a)}, ${u})`)}}return i.length>0?i.join(" | "):"0u"}function ut(e,r){let t=W(v,r);return e.inputs.some(n=>{let i=I(n);return i.kind==="tribes"&&$e(i.tribes,r).includes(t)})}function Mo(e,r,t,n){let i=re(e),o;if(n){let s=_n(r,t,n),a=Te(i.kind==="tiedMajority"?i.source:i,r,t);o=`(${s} && ${a})`}else o=To(i,r,t,null);return o}function xn(e){return`(1u << ${e}u)`}function Rn(e){return Cr(e)}function Bn(e){return JSON.parse(e)}function Pn(e,r){let t=new Set,n=o=>{t.add(Rn(o))},i=o=>{switch(r(o,n),o.kind){case gr:i(o.clause);break;case hr:case Sr:case yr:for(let s of o.clauses)i(s);break}};for(let o of e)i(o);return t}function _o(e){return Pn(e,(r,t)=>{switch(r.kind){case fr:case pr:case mr:case br:case dr:t(I(r.selector,r.tribes));break}})}function xo(e){return Pn(e,(r,t)=>{r.kind===lr&&(t(De(r.left,r.tribe1).selector),t(De(r.right,r.tribe2).selector))})}function Ue(e,r,t,n,i){switch(e.kind){case at:return"false";case en:return Ro(e.tribes,n,i);case dr:return Oe(le(I(e.selector,e.tribes),r),e.interval[0],e.interval[1]);case fr:return Oe(le(I(e.selector,e.tribes),r),0,0);case pr:return Oe(le(I(e.selector,e.tribes),r),e.value,e.value);case mr:return Oe(le(I(e.selector,e.tribes),r),e.value,8);case br:return Oe(le(I(e.selector,e.tribes),r),0,e.value);case lr:return Bo(e,t);case gr:return`!(${Ue(e.clause,r,t,n,i)})`;case hr:return`(${e.clauses.map(o=>Ue(o,r,t,n,i)).join(" && ")})`;case Sr:return`(${e.clauses.map(o=>Ue(o,r,t,n,i)).join(" || ")})`;case yr:return Po(e.clauses,r,t,n,i);default:return"false"}}function Ro(e,r,t){let n=$e(e,t);return n.length===0?"false":n.length===r.length?"true":`(${n.map(i=>`selfTribe == ${i}u`).join(" || ")})`}function Oe(e,r,t){return`(${e} >= ${r}u && ${e} <= ${t}u)`}function Bo(e,r){let t=De(e.left,e.tribe1).selector,n=De(e.right,e.tribe2).selector,i=yn[e.operator]??"==",o=Math.max(-8,Math.min(8,e.margin??0));return`(i32(${le(t,r)}) ${i} (i32(${le(n,r)}) + ${o}i))`}function Po(e,r,t,n,i){return`(((${e.map(o=>Ue(o,r,t,n,i)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`}function le(e,r){return r.get(Rn(e))}function dt(e,r,t){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,i=Math.min(n,t),o=Math.ceil(n/i);if(o<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:i,dispatchWgY:o,remapped:!0};throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`)}function kn(e,r,t,n,i,o,s){let a=[],u=e.rules.filter(m=>!m.muted),l=s.get(v)??0,p=lo(u.map(m=>m.clause)),d=fo(u.map(m=>m.clause),p);return a.push("// Auto-generated simulation compute shader."),a.push(`// Tribes: ${r.map(m=>m.id).join(", ")}`),a.push(`// Rules: ${e.rules.length}`),a.push(""),a.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),a.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),a.push(""),a.push(`const COLS: u32 = ${n.cols}u;`),a.push(`const ROWS: u32 = ${n.rows}u;`),a.push(`const PACKED_COLS: u32 = ${t}u;`),ao(a,i),so(a,o),a.push(""),uo(a,"gridIn","PACKED_COLS"),a.push(""),a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {"),po(a,p,r,s),mo(a,p,d,r,s),a.push(`  var result: u32 = ${l}u;`),a.push(""),bo(a,u,p,d,r,s),a.push("  return result;"),a.push("}"),a.push(""),a.push("@compute @workgroup_size(16, 16)"),i.remapped?a.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):a.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),co(a,i,"px"),a.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),a.push(""),a.push("  let baseX = px << WORD_SHIFT;"),a.push("  var packed: u32 = 0u;"),a.push(""),a.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),a.push("    let x = baseX + i;"),a.push("    if (x >= COLS) { break; }"),a.push(""),a.push("    let selfTribe = readCell(x, y);"),So(a),a.push(""),a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),a.push("  }"),a.push(""),a.push("  gridOut[y * PACKED_COLS + px] = packed;"),a.push("}"),a.join(`
`)}var Ce=3,Ne="gol-recording",ve="raw-packed",ft="deflate-raw",pt=12,mt=256*1024*1024,En=512*1024*1024,bt=128*1024*1024*1024;function gt(e,r,t=0){let n=t;for(let i of e)n+=i[r];return n}function wn(e,r){return Math.min(e,r)}function ht(e){return Math.min(e,1073741824)}function An(e){return Math.min(e,En)}function St(e,r){return Math.max(e*2,r*6)}function xr(e,r){return e>0&&e<=r}function wo(e,r){return e>0?e*2+r:0}function Ao(e,r){return e>=1&&r>0?e*r*(1+Ce):0}function Io(e,r){return e<mt?Math.min(mt,r):e}function In(e,r){return xr(e,r)?Math.max(1,Math.floor(Io(e,r)/e)):0}function Rr(e,r){return e>=1&&r>0?Math.max(1,Math.min(pt,Math.floor(536870912/(e*r)))):pt}function Gn(e,r,t,n,i,o){let s=!r.some(u=>u)&&(i||o>=e),a=i?Math.floor(n/2)+1:n;return e>=1&&r.length>0&&(s||t>=a)}function Ln(e,r,t,n){return e<r&&n.some((i,o)=>t[o]&&i.mapState==="unmapped")}function Fn(e,r,t,n,i,o){return e&&r>=1&&t!==null&&n.length>0&&(i<r||o)}function Dn(e,r,t,n,i){let o=Math.min(e.quota??bt/128,bt),s=e.usage??0,a=0,u=0;for(let d of r)d.codec===ve?a+=d.storedBytes:u+=d.storedBytes;let l=t*n,p=i?(1+Ce)*l:0;return{quotaBytes:o,usedBytes:s,pendingRawBytes:a,compressedBytes:u,gpuBufferMarginBytes:p}}function On(e,r,t,n,i){let o=ht(e);return{maxBytes:e,vramBudgetBytes:St(e,o),frameByteSize:r,recordingAvailable:xr(r,o),vramSimulationBytes:wo(r,n),vramRecordingBytes:Ao(t,r),gridFormat:i}}function Br(e,r,t){r.length>0&&(e.generationStart=r[0].generationStart,e.generationEnd=r[r.length-1].generationEnd),t.length>0&&(r.length===0&&(e.generationStart=t[0]),e.generationEnd=t[t.length-1]),e.chunks=[...r]}function Un(e){return e.map(r=>({...r,generations:[...r.generations]}))}function $n(e,r){return e!==r}function Pr(e,r=0){return gt(e,"blockCount",r)}function Nn(e){return gt(e,"storedBytes")}function Wn(e){return gt(e,"uncompressedBytes")}var Go=256,We=80,zn=Go*Uint32Array.BYTES_PER_ELEMENT;function Kn(e){let r=new ArrayBuffer(We),t=new Float32Array(r),n=new Int32Array(r),i=new Uint32Array(r),o=(e.offsetX%e.grid.cols+e.grid.cols)%e.grid.cols,s=(e.offsetY%e.grid.rows+e.grid.rows)%e.grid.rows,a=Math.floor(o),u=Math.floor(s);return t[0]=e.canvasWidth,t[1]=e.canvasHeight,t[2]=e.scale,t[4]=o-a,t[5]=s-u,i[6]=e.grid.cols,i[7]=e.grid.rows,i[8]=a,i[9]=u,i[10]=e.tribeCount,n[12]=e.brushPreview.centerX,n[13]=e.brushPreview.centerY,i[14]=e.brushPreview.brushSize,i[15]=e.brushPreview.shape,i[16]=e.brushPreview.visible?1:0,i[17]=e.exportFrameOverlay.originX,i[18]=e.exportFrameOverlay.originY,i[19]=e.exportFrameOverlay.visible?1:0,r}function Xn(e){let r=new Uint32Array(e.length);for(let t=0;t<e.length;t++){let n=e[t].color,i=parseInt(n.substring(0,2),16),o=parseInt(n.substring(2,4),16),s=parseInt(n.substring(4,6),16);r[t]=i|o<<8|s<<16}return r}function qn(e,r){return e.replace("__CELLS_PER_WORD__",`${r.cellsPerWord}u`).replace("__WORD_SHIFT__",`${r.wordShift}u`).replace("__CELL_SHIFT__",`${r.cellShift}u`).replace("__CELL_INDEX_MASK__",`${r.cellIndexMask}u`).replace("__CELL_MASK__",`${r.cellMask}u`)}var Lo=500,Fo=33,Do=2,Oo=.5,Yn=.2,Hn=1,Uo=1048576;function jn(e){return Math.min(3,Math.max(0,Math.ceil(Math.log10(e.cols*e.rows/1e5))))}function ze(e){return 1024/4**jn(e)}function kr(e){return 16/2**jn(e)}function $o(e){return Math.max(Hn,Math.round(ze(e)*kr(e)))}function Vn(e,r){return{generationsPerDrain:$o(e),targetDrainMs:r.kind==="max"?Lo:Fo,smoothedDrainMs:0,lastDrainStartedAt:0,lastSubmittedGenerations:0}}function Zn(e,r){if(r>0&&e.lastSubmittedGenerations>0){let t=e.smoothedDrainMs===0?r:e.smoothedDrainMs*(1-Yn)+r*Yn,n=Math.min(Do,Math.max(Oo,e.targetDrainMs/t));e.smoothedDrainMs=t,e.generationsPerDrain=Math.max(Hn,Math.min(Uo,Math.round(e.generationsPerDrain*n)))}}function yt(e,r){return e==="recording"?Number.MAX_SAFE_INTEGER:ze(r)*kr(r)}function Tt(e,r,t,n,i){let o=e-r*n;return t>n||t>i?Math.min(o,r):o}function Qn(e){return e<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/e}}function Y(e){return e.request.stopCondition.kind==="targetGeneration"}function Me(e,r){return e.request.stopCondition.kind==="targetGeneration"&&r>=e.request.stopCondition.generation}function H(e,r){return e.request.stopCondition.kind==="targetGeneration"?Math.max(0,e.request.stopCondition.generation-r):Number.POSITIVE_INFINITY}function Jn(e,r){return r.restore!==!1&&e.request.restoreAfterStop||null}function ei(e,r,t){return r&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")}function ri(e,r,t,n,i){return e.restartRestoredRun!==!1&&r&&t&&!n&&!i}function ti(e,r,t,n){let i=r+t,o=Math.min(n,i-1);if(o<=0)return null;let s=i-1-o;if(s>=r)return{source:"buffered",frameInChunk:s-r};let a=0;for(let u=0;u<e.length;u++){let l=e[u];if(s<a+l.blockCount)return{source:"sealed",sealedIndex:u,frameInChunk:s-a};a+=l.blockCount}return null}function ni(e,r){return{chunkFrameIndex:r.frameInChunk+1,generation:e[r.frameInChunk]}}function ii(e,r,t,n,i,o){let s=(r+1)*t;if(i.bitsPerCell===o.bitsPerCell)return{sameFormat:!0,chunkPrefix:new Uint8Array(e,0,s),activeFrame:null};let a=ee(n,i),u=new Uint8Array(s);for(let l=0;l<=r;l++){let p=new Uint8Array(e,l*a,a),d=Tr(Jt(p),n,i,o);u.set(new Uint8Array(d.buffer,d.byteOffset,d.byteLength),l*t)}return{sameFormat:!1,chunkPrefix:u,activeFrame:u.subarray(r*t,s)}}var c,M=!1,Ur,Er,me,qr,P=0,k=0,Yr=0,E=sr,Be=[],Pe=new Map,_t,xt,G,L,ke,_e,Ve,Rt,Bt,wr,ui,ci,D=!1,li=1,di=0,fi=0,w=!1,_=!1,V=100,b=0,Ee=0,Ke=0,Hr=0,Ar,No=4,Ot=192,pe=[],$r=[],Nr=[],Wo=0,Ir=null,pi={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},mi={originX:0,originY:0,visible:!1},oe=null,Gr=-1,xe=!1,qe=!1,Ct=0,Ze=cr,Lr=[],B=!1,K=!1,te={chunks:[],generationStart:0,generationEnd:0,gridFormat:Ge(sr)},bi=0,C=[],Qe=!1,g=null,gi=0,Fr=!1,O=null,h=0,R=[],be=null,T=64,y=0,ae=[],z=[],Ye=null,de=null,X=0,Je=0,fe=0,j=!1,Xe=0,Dr=0,Or=0,He=[];function zo(e){switch(!0){case e instanceof Error:return e.message;case typeof e=="string":return e;case(e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"):return e.message;default:return String(e??"Unknown worker error")}}function hi(e){console.error("[GOLT worker] Worker GPU error:",e),A("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),w=!1,self.postMessage({type:"gpuError",reason:zo(e)})}self.addEventListener("error",e=>{e.preventDefault(),hi(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),hi(e.reason)});async function Ut(){await c.queue.onSubmittedWorkDone()}function oi(e){Dr=0,Or=2+(e?1+Ce:0),He=[]}async function Wr(){if(He.length>0){let e=c.createCommandEncoder({label:f.trackedAllocationClearEncoder});for(let r of He)e.clearBuffer(r);c.queue.submit([e.finish()]),await Ut(),He=[]}}async function zr(e,r){_&&Or>0&&(Dr+=e,Or--,He.push(r),Dr>=An(ge())&&Or>0&&(await Wr(),Dr=0))}function Kr(){O?.destroy(),O=null;for(let e of ae)e?.destroy();ae=[],z=[],T=0,h=0,R=[],be=null,Je=0}function ai(){G?.destroy(),L?.destroy(),ln(oe),oe=null,pe.forEach(e=>e.destroy()),pe=[],$r=[],Nr=[],Kr()}function vt(e){let r=X>0;X+=e;let t=X>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function Re(){let e=Gn(T,z,fe,Rr(T,y),j,h);e!==j&&(j=e,self.postMessage({type:"backpressure",active:e}))}async function Ae(){self.postMessage({type:"storageQuota",...Dn(await navigator.storage.estimate(),C,T,y,B)})}function ge(){return wn(c.limits.maxBufferSize,c.limits.maxStorageBufferBindingSize)}function rr(){return ht(ge())}function ne(){return xr(y,rr())}function Si(){return Ln(fe,Rr(T,y),z,ae)}function er(){return Fn(ne(),T,O,ae,h,Si())}async function Ko(e){let r=new DecompressionStream(ft),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],i=r.readable.getReader();for(;;){let{done:u,value:l}=await i.read();if(u)break;n.push(l)}let o=0;for(let u of n)o+=u.byteLength;let s=new Uint8Array(o),a=0;for(let u of n)s.set(u,a),a+=u.byteLength;return s.buffer}function Z(){return{cols:P,rows:k}}function Xo(){return dt(Math.ceil(Yr/16),Math.ceil(k/16),c.limits.maxComputeWorkgroupsPerDimension)}function qo(){return dt(Math.ceil(P/16),Math.ceil(k/16),c.limits.maxComputeWorkgroupsPerDimension)}function Pt(){ke?.destroy(),ke=c.createBuffer({label:f.uniformBuffer,size:We,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Yo(){let e=Kn({canvasWidth:me.width,canvasHeight:me.height,scale:li,offsetX:di,offsetY:fi,grid:Z(),tribeCount:Be.length,brushPreview:pi,exportFrameOverlay:mi});c.queue.writeBuffer(ke,0,e)}function jr(){return ee({cols:P,rows:k},E)}function se(){return Ge(E)}async function kt(){let e=jr();G=c.createBuffer({label:f.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await zr(e,G),L=c.createBuffer({label:f.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await zr(e,L);let r=c.createCommandEncoder({label:f.gridClearEncoder});r.clearBuffer(G),r.clearBuffer(L),c.queue.submit([r.finish()]),D=!1}function Et(){let e=Xn(Be);_e&&_e.destroy(),_e=c.createBuffer({label:f.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),c.queue.writeBuffer(_e,0,e)}function wt(){let e=c.createShaderModule({label:f.renderShaderModule,code:qn(jt,E)});Ve=c.createRenderPipeline({label:f.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:Er}]},primitive:{topology:"triangle-list"}})}function At(){Rt=c.createBindGroup({layout:Ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ke}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:_e}}]}),Bt=c.createBindGroup({layout:Ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ke}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:_e}}]})}function It(){_t=Xo();let e=kn(qr,Be,Yr,Z(),_t,E,Pe),r=c.createShaderModule({label:f.simulationShaderModule,code:e});wr=c.createComputePipeline({label:f.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),ui=c.createBindGroup({layout:wr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:L}}]}),ci=c.createBindGroup({layout:wr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:G}}]})}function Gt(){xt=qo(),oe=cn({device:c,cols:P,rows:k,gridFormat:E,dispatchPlan:xt})}function Lt(){let e=c.createShaderModule({label:f.brushShaderModule,code:hn(E)});Ar=c.createComputePipeline({label:f.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),pe.forEach(r=>r.destroy()),pe=[],$r=[],Nr=[];for(let r=0;r<No;r++){let t=c.createBuffer({label:`${f.brushUniformBuffer} ${r}`,size:Ot,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});pe.push(t),$r.push(c.createBindGroup({layout:Ar.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:t}}]})),Nr.push(c.createBindGroup({layout:Ar.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:t}}]}))}}function Ho(e,r,t,n,i,o,s){let a=Pe.get(v)??0,u=Wo++,l=Sn(r,t,n,Z()),p=D?Nr:$r;for(let[d,m]of l.entries()){let x=new ArrayBuffer(Ot),S=new Uint32Array(x);S[0]=Yr,S[1]=n,S[2]=i,S[3]=o,S[4]=a,S[5]=u,S[6]=s.length,S[7]=m.destinationStartX,S[8]=m.destinationStartY,S[9]=m.localStartX,S[10]=m.localStartY,S[11]=m.spanCols,S[12]=m.spanRows,S[13]=0;for(let $=0;$<s.length&&$<32;$++)S[14+$]=s[$];let U=pe[d],ue=p[d];if(U&&ue){c.queue.writeBuffer(U,0,x);let $=Math.floor(m.destinationStartX/E.cellsPerWord),$i=Math.ceil((m.destinationStartX+m.spanCols)/E.cellsPerWord)-$,Ni=Math.ceil($i/8),Wi=Math.ceil(m.spanRows/8),ar=e.beginComputePass({label:f.brushPass});ar.setPipeline(Ar),ar.setBindGroup(0,ue),ar.dispatchWorkgroups(Ni,Wi),ar.end()}else throw console.error("[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.",{index:d,rectCount:l.length,bindGroupCount:p.length,uniformBufferCount:pe.length}),new Error("Brush dispatch resources are out of sync with the wrapped brush rectangles.")}}function jo(){let e=D?L:G,r=jr(),t;try{t=c.createBuffer({label:f.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=c.createCommandEncoder({label:f.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),c.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),i})}function yi(){y=jr(),T=In(y,rr())}function Ft(){self.postMessage({type:"limits",...On(ge(),y,T,We+zn+Ot+Se*2+ye*2,se())})}function Ti(){return T>=1&&O!==null&&h<T}function Ci(e,r){let t=D?L:G,n=h*y;e.copyBufferToBuffer(t,0,O,n,y),R.push(r),be=r,h++}function $t(e){if(Ti()){let r=c.createCommandEncoder({label:f.recordingFrameCopyEncoder});Ci(r,e),c.queue.submit([r.finish()]),je()}}function Mt(e){Je=Math.max(0,Je+e)}function je(){T>0&&h>=T&&Si()&&tr()}function tr(){let e=O;if(e!==null&&h>0&&ae.length>0&&fe<Rr(T,y)){let r=z.indexOf(!0);if(r>=0){z[r]=!1;let t=ae[r];if(t.mapState==="unmapped"){let n=h*y,i=bi++,o=[...R],s=o[0],a=o[o.length-1],u=`chunk-${String(i).padStart(6,"0")}.bin`,l=h,p=c.createCommandEncoder({label:f.recordingSealCopyEncoder});p.copyBufferToBuffer(e,0,t,0,n),c.queue.submit([p.finish()]);let d={chunkId:i,generationStart:s,generationEnd:a,blockCount:l,codec:ve,uncompressedBytes:n,storedBytes:n,gridFormat:se(),generations:o,filename:u};vt(1),Mt(l),fe++,Re();let m=Xe;t.mapAsync(GPUMapMode.READ).then(async()=>{let x=t.getMappedRange(),S=new ArrayBuffer(n);new Uint8Array(S).set(new Uint8Array(x,0,n)),t.unmap(),m===Xe&&(z[r]=!0,C.push(d),Mt(-l),Br(te,C,R),Re(),je(),Vo(d,S).then(()=>{m===Xe&&(fe--,Re(),vt(-1),Ae(),Xr(),Q(!0),je(),self.postMessage({type:"chunkSealed",filename:d.filename,rawBytes:n,blockCount:d.blockCount,cols:P,rows:k,rawGridFormat:d.gridFormat,storageGridFormat:Ge(ur(qr.tribes.length))}),Qe&&X===0&&(Qe=!1,Xr()))}))}).catch(()=>{m===Xe&&(z[r]=!0,fe--,Mt(-l),Re(),vt(-1),je())}),h=0,R=[]}else z[r]=!0}}}async function vi(e){Xe++,bi=0,h=0,R=[],C=[],be=null,Je=0,fe=0,X>0&&(X=0,self.postMessage({type:"chunksSaving",active:!1})),j&&(j=!1,self.postMessage({type:"backpressure",active:!1})),Qe=!1,K=B,te={chunks:[],generationStart:e,generationEnd:e,gridFormat:se()},await Mi(),Ae()}async function Nt(){return de&&await de,Ye||(Ye=await(await navigator.storage.getDirectory()).getDirectoryHandle(Ne,{create:!0})),Ye}async function Vo(e,r){let i=await(await(await Nt()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(r),await i.close()}async function Zo(e){let r=await Nt();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function Mi(){if(de)await de;else{de=(async()=>{let e=await navigator.storage.getDirectory();Ye=null;try{await e.removeEntry(Ne,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${Ne}:`,r)}Ye=await e.getDirectoryHandle(Ne,{create:!0})})();try{await de}finally{de=null}}}function Xr(){Br(te,C,R),self.postMessage({type:"recording",manifest:{chunks:Un(C),generationStart:te.generationStart,generationEnd:te.generationEnd,gridFormat:se()},cols:P,rows:k})}function nr(e=!1){if(B){let r=!K;e&&K&&er()&&(K=!1,r=!0),r&&$n(be,b)&&er()&&(h>=T&&tr(),$t(b))}}function Wt(){if(Ir){let e=Ir;Ir=null;let r=B&&h>0&&R[h-1]===b;r&&(h--,R.pop());let t=c.createCommandEncoder({label:f.brushEncoder});Ho(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),c.queue.submit([t.finish()]),r&&$t(b)}}async function Qo(e,r=ve){let o=await(await(await(await Nt()).getFileHandle(e)).getFile()).arrayBuffer();return r===ft?Ko(o):o}function _i(){return nn(P,k,Ze.enabled,Ze.sections)}function Jo(){return on(_i())}function xi(e){Lr=Jo(),oe&&Lr.length>0&&dn({device:c,encoder:e,resources:oe,sourceBuffer:D?L:G,dispatchPlan:xt,enabledSections:Lr})}function Ri(){let e=b;if(oe&&e!==Gr&&!xe){let r=[...Lr],t=_i();Gr=e,xe=!0,fn({resources:oe,enabledSections:r}).then(n=>{let i=Pe.get(v)??0,o=Pr(C,h+Je),s=pn({generation:e,tribes:Be,deadTribeIndex:i,readback:n,enabledSections:r,availability:t,liveMetricSettings:Ze.sections,cols:P,rows:k,totalFrames:o,fps:Hr,canStepBack:o>1,recordingBytes:Nn(C),recordingRawBytes:Wn(C)});if(xe=!1,self.postMessage(s),qe)if(qe=!1,Gr=-1,Pi()){let a=c.createCommandEncoder({label:f.interactiveMetricsEncoder});xi(a),c.queue.submit([a.finish()]),Ri()}else qe=!0}).catch(()=>{xe=!1})}}function zt(e){let r=e.beginComputePass({label:f.simulationStepPass});r.setPipeline(wr),r.setBindGroup(0,D?ci:ui);let t=_t;r.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),r.end(),D=!D,b++}function ea(e){if(e>0){let r=c.createCommandEncoder({label:f.simulationBatchEncoder});for(let t=0;t<e;t++)zt(r);c.queue.submit([r.finish()]),Ee+=e}}function ra(){self.postMessage({type:"generation",generation:b,fps:Hr})}function ta(){let e=c.createCommandEncoder({label:f.simulationSingleStepEncoder});zt(e),c.queue.submit([e.finish()])}function F(){if(c&&Ur&&ke&&Ve&&Rt&&Bt&&!_&&!M){Yo();let e=Ur.getCurrentTexture().createView(),r=c.createCommandEncoder({label:f.renderEncoder}),t=r.beginRenderPass({label:f.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(Ve),t.setBindGroup(0,D?Bt:Rt),t.draw(3),t.end(),c.queue.submit([r.finish()])}}function Bi(e){Ke===0&&(Ke=e);let r=e-Ke;r>=1e3&&(Hr=Ee/(r/1e3),Ee=0,Ke=e)}function Kt(){Ee=0,Ke=0,Hr=0}function Xt(){return B&&ne()?"recording":"nonRecording"}function Pi(){return!!(c&&oe&&!_&&!M)}function Q(e=!1){if(e&&(Gr=-1),!Pi())qe=!0;else if(xe)qe=!0;else{let r=c.createCommandEncoder({label:f.interactiveMetricsEncoder});xi(r),c.queue.submit([r.finish()]),Ri()}}function ki(){Q(!0),F()}function Vr(e,r){r&&(e-Ct>=1e3||Ct===0)&&!xe&&(Ct=e,Q())}function ir(e,r){(e.request.pacing.kind==="max"||Y(e))&&r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,ra())}function we(e){j!==e&&(j=e,self.postMessage({type:"backpressure",active:e}))}function Ei(){let e=er();return e&&h>=T&&(tr(),e=er()),e}function or(){!_&&!M&&!g&&self.requestAnimationFrame(Dt)}function na(e,r){let t=e.adaptiveBatch;t&&t.lastDrainStartedAt>0&&(Zn(t,r-t.lastDrainStartedAt),t.lastDrainStartedAt=0,t.lastSubmittedGenerations=0)}function wi(e,r,t){let n=e.adaptiveBatch;n&&r>0&&(n.lastSubmittedGenerations=r,n.lastDrainStartedAt=t)}function Ai(e,r){let t=Math.max(1,Math.round(ze(r))),n=0;for(;n<e;){let i=e-n,o=Math.min(t,i);ea(o),n+=o}return n}function he(e){let r=g;if(r&&!r.pumpPending&&!_&&!M){let{token:t}=r;r.pumpPending=!0;let n=()=>{if(g&&g.token===t){let i=performance.now();g.pumpPending=!1,e==="drain"&&na(g,i),la(i)}};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?c.queue.onSubmittedWorkDone().then(n).catch(()=>{g?.token===t&&(g.pumpPending=!1)}):queueMicrotask(n)}}function qt(e,r){g&&A("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1});let t=Z(),n=e==="nonRecording"?Vn(t,r.pacing):null;n&&console.info("[GOLT worker] Adaptive non-recording batching started",{cols:t.cols,rows:t.rows,bitsPerCell:E.bitsPerCell,generationsPerDrain:n.generationsPerDrain,targetDrainMs:n.targetDrainMs}),g={kind:e,request:r,token:++gi,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0,adaptiveBatch:n},he(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function ie(){w&&qt(Xt(),{pacing:Qn(V),stopCondition:{kind:"none"}})}function ia(e,r){r||e==="cancelled"?we(!1):j&&Re()}function A(e,r={}){let t=g;if(t){g=null,gi++;let n=Y(t),i=Jn(t,r),o=!!i;i&&(w=i.running,V=i.targetStepDuration),ei(e,n,r)&&self.postMessage({type:"stepping",active:!1}),ia(e,n),r.render!==!1&&!_&&!M&&ki(),ri(r,o,w,_,M)?ie():or()}}function Ii(e){let r=g;r&&Y(r)&&(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),A("cancelled"))}function oa(e){A("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),qt(Xt(),e)}function Gi(e,r,t){we(!0),ir(e,r),Vr(r,t),he("drain")}function Li(e,r){let t=c.createCommandEncoder({label:f.recordingStepBatchEncoder}),n=0,i=!1,o=e>0;for(;o;)n<e&&performance.now()<r?Ei()&&Ti()?(zt(t),Ci(t,b),n++,h>=T&&(o=!1)):(i=!0,o=!1):o=!1;return n>0&&(c.queue.submit([t.finish()]),Ee+=n,je()),{steps:n,blocked:i}}function aa(e,r){let t=Z(),n=e.adaptiveBatch?.generationsPerDrain??Math.round(ze(t)*kr(t)),i=Math.min(n,H(e,b)),o=Ai(i,t),s=o>0;ir(e,r),Me(e,b)?A("targetReached"):s?(wi(e,o,performance.now()),he("drain")):he("raf")}function sa(e,r){nr(!0);let t=!1,n=!1,i=performance.now()+14,o=H(e,b)>0&&performance.now()<i;for(;o;){let s=Li(H(e,b),i);t=t||s.steps>0,s.blocked?(Gi(e,r,t),n=!0,o=!1):o=s.steps>0&&H(e,b)>0&&performance.now()<i}n||(we(!1),ir(e,r),Vr(r,t),Me(e,b)?A("targetReached"):he("raf"))}function ua(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=e.stepAccumulator,o=Math.floor(e.stepAccumulator/r),s=Z(),a=e.adaptiveBatch?.generationsPerDrain??yt(e.kind,s),u=Math.min(o,H(e,b),a),l=Ai(u,s),p=l>0;if(e.stepAccumulator=Tt(i,r,o,l,a),ir(e,t),Me(e,b))A("targetReached");else{let d=p&&o>l;(!Y(e)&&!d||t-e.lastRenderTime>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,F(),Vr(t,p)),d&&wi(e,l,performance.now()),he(d?"drain":"raf")}}function ca(e,r,t){nr(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=!1,o=0,s=e.stepAccumulator,a=yt(e.kind,Z()),u=Math.floor(e.stepAccumulator/r),l=performance.now()+14,p=!1,d=u>0&&H(e,b)>0&&o<a&&performance.now()<l;for(;d;){let m=Math.min(u-o,a-o,H(e,b)),x=Li(m,l);o+=x.steps,i=i||x.steps>0,x.blocked?(Gi(e,t,i),p=!0,d=!1):d=x.steps>0&&u>o&&H(e,b)>0&&o<a&&performance.now()<l}e.stepAccumulator=Tt(s,r,u,o,a),p||(we(!1),ir(e,t),Me(e,b)?A("targetReached"):(Y(e)||(F(),Vr(t,i)),he("raf")))}function la(e){let r=g;if(r&&!_&&!M)if(Bi(e),Y(r)||Wt(),Me(r,b))A("targetReached");else if(r.request.pacing.kind==="max")r.kind==="recording"?sa(r,e):aa(r,e);else{let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?ca(r,t,e):ua(r,t,e)}}function Dt(e){_||M?self.requestAnimationFrame(Dt):(Bi(e),g||(Wt(),V>0&&!Fr&&F(),self.requestAnimationFrame(Dt)))}function da(e,r){let t=c?ge():Number.POSITIVE_INFINITY;return Vt(r.bitsPerCell)&&et(r.bitsPerCell,e.tribes.length)&&rt(e,Ie(r.bitsPerCell),t)?Ie(r.bitsPerCell):Qt(e.tribes.length,e,t)}function Fi(e,r){qr=e,P=e.cols,k=e.rows,E=da(e,r),Yr=ce(P,E),Be=[...e.tribes],te.gridFormat=se(),Pe.clear(),Be.forEach((t,n)=>Pe.set(t.id,n))}async function Di(e){console.log("[GOLT worker] Initializing WebGPU"),me=e,c=await rn(f.webengineDevice),M=!1,c.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),A("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),M=!0,w=!1,_=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:ge(),vramBudgetBytes:St(ge(),rr()),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:se()});let r=me.getContext("webgpu");if(r)Ur=r,Er=navigator.gpu.getPreferredCanvasFormat(),Ur.configure({device:c,format:Er,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:Er,maxBufferSize:c.limits.maxBufferSize,maxStorageBufferBindingSize:c.limits.maxStorageBufferBindingSize});else throw new Error("WebGPU canvas context not available")}async function fa(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Di(me),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),A("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),M=!0,w=!1,_=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function Oi(){O=c.createBuffer({label:f.recordingChunkBuffer,size:T*y,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await zr(T*y,O),h=0,R=[],be=null}async function Ui(){let e=T*y;ae=[],z=[];for(let r=0;r<Ce;r++){let t=c.createBuffer({label:`${f.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});ae.push(t),z.push(!0),await zr(e,t)}}async function pa(){await Mi()}async function ma(){console.log("[GOLT worker] Building GPU resources",{cols:P,rows:k,bitsPerCell:E.bitsPerCell,recordingAvailable:ne()}),Pt(),yi(),await kt(),Et(),wt(),At(),It(),Lt(),Gt(),await pa(),ne()?(await Oi(),await Ui()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:y,maxRecordingBufferBytes:rr()}),Kr(),B=!1,K=!1),await Wr(),Ft(),console.log("[GOLT worker] GPU resources ready")}async function ba(){console.log("[GOLT worker] Rebuild started",{cols:P,rows:k,bitsPerCell:E.bitsPerCell}),A("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),_=!0,self.postMessage({type:"rebuilding",active:!0});try{await Ut()}catch{console.warn("[GOLT worker] Queue idle wait rejected during rebuild")}let e=!M;if(M&&(e=await fa()),e){ai(),Pt(),yi(),oi(ne());try{await kt(),Et(),wt(),It(),Lt(),At(),Gt(),ne()?(await Oi(),await Ui()):(Kr(),B=!1,K=!1),await Wr(),Ft()}catch(r){let t=r instanceof Error?r.message:String(r);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{ai(),Pt(),oi(!1),await kt(),Et(),wt(),It(),Lt(),At(),Gt(),B=!1,K=!1,y=jr(),Kr(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await Wr(),Ft()}catch(n){console.error("[GOLT worker] GPU rebuild recovery failed:",n),e=!1}}}return e&&(_=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:ne(),frameByteSize:y})),e}function si(e){Fr=!0,c.queue.onSubmittedWorkDone().then(()=>{Fr=!1,e()}).catch(()=>{Fr=!1})}async function ga(){X>0&&await new Promise(e=>{let r=setInterval(()=>{X===0&&(clearInterval(r),e())},10)})}async function ha(e){console.log("[GOLT worker] Init message received",{cols:e.ruleset.cols,rows:e.ruleset.rows,recording:e.recording,running:e.running,speed:e.speed}),B=e.recording,Ze=it(e.liveMetrics),K=B,Fi(e.ruleset,e.simulationGridFormat),await Di(e.canvas),await ma(),Q(!0),Ae(),w=e.running,V=e.speed<0?0:1e3/e.speed,w?ie():or()}function Sa(e){Ze=it(e.liveMetrics),Q(!0)}async function ya(e){console.log("[GOLT worker] Ruleset update received",{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length});let r=ge();if(tt(e.ruleset.tribes.length,e.ruleset,r))A("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Fi(e.ruleset,e.simulationGridFormat),await ba()&&(b=0,Kt(),await vi(0),Q(!0),w?ie():or());else{let i=`Requested ruleset requires at least ${Zt(e.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",i,{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length,maxBytes:r}),self.postMessage({type:"gpuError",reason:i})}}function Ta(e){w=e.running,e.running?g||ie():g&&Y(g)?Ii(!1):g?A("manual"):(j&&Re(),ki(),or())}function Ca(e){let r=V<=0,t=e.speed<0?0:1e3/e.speed;V=t,g&&!Y(g)&&w?(A("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&t>0?si(()=>{F(),ie()}):ie()):w&&!g?ie():r&&t>0&&si(()=>{F(),or()})}function va(e){li=e.scale,di=e.offsetX,fi=e.offsetY,!g&&!_&&!M&&F()}function Ma(e){me.width=e.width,me.height=e.height,!g&&!_&&!M&&F()}function _a(e){let r=e.tribes.map(t=>Pe.get(t)).filter(t=>t!==void 0);if(r.length>0){let t={square:0,round:1,diamond:2,vline:3,hline:4},n={full:0,spray:1,outline:2};Ir={centerX:e.x,centerY:e.y,brushSize:e.size,shape:t[e.shape]??0,fill:n[e.fill]??0,tribeIds:r}}}function xa(e){let r={square:0,round:1,diamond:2,vline:3,hline:4};pi={centerX:e.x,centerY:e.y,brushSize:e.size,shape:r[e.shape]??0,visible:e.visible},!g&&!_&&!M&&V<=0&&F()}function Ra(e){mi={originX:e.origin?.originX??0,originY:e.origin?.originY??0,visible:e.visible&&e.origin!==null},!g&&!_&&!M&&V<=0&&F()}async function Ba(){try{let e=await jo();ot({type:"snapshot",grid:e,generation:b,cols:P,rows:k,gridFormat:se()},[e.buffer])}catch{let e=new Uint32Array(0);ot({type:"snapshot",grid:e,generation:b,cols:P,rows:k,gridFormat:se()},[e.buffer])}}async function Pa(e){let r=nt(e.gridFormat),t=Z();if(e.grid.byteLength===ee(t,r)){let n=Tr(e.grid,t,r,E);c.queue.writeBuffer(D?L:G,0,n),b=e.generation,Kt(),await vi(e.generation)}}function ka(e){let r=g?.request,t=ne();e.recording&&t&&!B?(B=!0,K=!0,Q(!0),Ae()):(!e.recording||!t)&&(e.recording&&!t&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:y,maxRecordingBufferBytes:rr()}),B=!1,K=!1),r&&g?oa(r):!g&&w&&ie()}async function Ea(){Qe||(await Ut(),nr(!1),h>0&&tr(),X>0?Qe=!0:Xr())}async function wa(e){let r=Pr(C),t=ti(C,r,h,e.count);if(t){let n=D?L:G;if(t.source==="buffered"){let i=ni(R,t);h=i.chunkFrameIndex,R.length=h,b=i.generation,be=b;let o=c.createCommandEncoder({label:f.recordingRestoreCopyEncoder});o.copyBufferToBuffer(O,t.frameInChunk*y,n,0,y),c.queue.submit([o.finish()])}else{X>0&&(await ga(),r=Pr(C));let i=C[t.sealedIndex],o=await Qo(i.filename,i.codec),s=Z(),a=nt(i.gridFormat),u=ii(o,t.frameInChunk,y,s,a,E);if(c.queue.writeBuffer(O,0,u.chunkPrefix),!u.sameFormat&&u.activeFrame&&c.queue.writeBuffer(n,0,u.activeFrame),h=t.frameInChunk+1,R=i.generations.slice(0,t.frameInChunk+1),b=R[t.frameInChunk],be=b,u.sameFormat){let p=c.createCommandEncoder({label:f.recordingRestoreCopyEncoder});p.copyBufferToBuffer(O,t.frameInChunk*y,n,0,y),c.queue.submit([p.finish()])}let l=C.splice(t.sealedIndex);Zo(l.map(p=>p.filename))}Br(te,C,R),Ae(),Kt(),Q(!0),F()}}function Aa(){Wt(),nr(!0),!B||Ei()?(ta(),Ee++,B&&er()&&(h>=T&&tr(),$t(b)),we(!1)):we(!0),Q(!0),F()}function Ia(e){self.postMessage({type:"stepping",active:!0}),nr(!0),qt(Xt(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:b+e},restoreAfterStop:{running:w,targetStepDuration:V}})}function Ga(e){e.count===1?Aa():Ia(e.count)}function La(){Ii(g?.request.restoreAfterStop?.running??w)}function Fa(e){let r=C.find(t=>t.filename===e.filename);r&&(r.codec=e.codec,r.storedBytes=e.storedBytes,r.gridFormat=e.gridFormat,te.chunks=[...C],Ae(),Xr())}function Da(){let e=C.filter(r=>r.codec===ve).map(r=>({filename:r.filename,rawBytes:r.uncompressedBytes,blockCount:r.blockCount,cols:P,rows:k,rawGridFormat:r.gridFormat,storageGridFormat:Ge(ur(qr.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:e})}async function Oa(e){switch(e.type){case"init":await ha(e);break;case"setLiveMetrics":Sa(e);break;case"setRuleset":await ya(e);break;case"setRunning":Ta(e);break;case"setSpeed":Ca(e);break;case"camera":va(e);break;case"resize":Ma(e);break;case"draw":_a(e);break;case"brushPreview":xa(e);break;case"exportFrameOverlay":Ra(e);break;case"getSnapshot":await Ba();break;case"loadSnapshot":await Pa(e);break;case"setRecording":ka(e);break;case"getRecording":await Ea();break;case"stepBack":await wa(e);break;case"stepForward":Ga(e);break;case"cancelStepping":La();break;case"updateChunkCodec":Fa(e);break;case"getUncompressedChunks":Da();break}}self.onmessage=async e=>{await Oa(e.data)};
