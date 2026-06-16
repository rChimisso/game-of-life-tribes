var Zt="goltTimestampedConsoleInstalled";function Yi(){let e=globalThis;e[Zt]||(e[Zt]=!0,rt("info"),rt("warn"),rt("error"),console.log=console.info.bind(console))}function rt(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}Yi();var Qt=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var tt=[1,2,4,8,16,32],ji={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Vi={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Zi={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},lr={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Qi={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},nt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},ee={1:ji,2:Vi,4:Zi,8:lr,16:Qi,32:nt};function Jt(e){return tt.includes(e)}function Ji(e){return 2**e}function it(e,r){return r<=Ji(e)}function ot(e,r,t){return re(e,r)<=t}function dr(e){return e<=2?ee[1]:e<=4?ee[2]:e<=16?ee[4]:e<=256?ee[8]:e<=65536?ee[16]:ee[32]}function en(e){return dr(e)}function Ge(e){return ee[e]}function rn(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){return at(e,r,t)??nt}function at(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of tt){let i=Ge(n);if(it(n,e)&&ot(r,i,t))return i}return null}function fr(e){return Ge(e?.bitsPerCell??8)}function Fe(e){return{bitsPerCell:e.bitsPerCell}}function fe(e,r){return Math.ceil(e/r.cellsPerWord)}function re(e,r){return fe(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function tn(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}var Le={population:!0,diversity:!0,interfaces:!1},pr={enabled:!0,sections:Le};function eo(e){return{population:typeof e?.population=="boolean"?e.population:Le.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Le.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Le.interfaces}}function st(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:pr.enabled,sections:eo(e?.sections)}}function ut(e,r){self.postMessage(e,r)}var x="dead";var ct="empty",nn="is",mr="comparison",br="count",gr="none",hr="exactly",Sr="min",yr="max",Tr="not",Cr="and",vr="or",Mr="xor";async function on(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var p={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",recordingStepBatchEncoder:"recording step batch encoder",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var an=4294967295;function lt(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function W(e,r){return e.includes(r)}function sn(e,r,t,n){let i=e*r,o=i<=an,s=i*2<=an;return{population:lt(t&&n.population,o),diversity:lt(t&&n.diversity,o),interfaces:lt(t&&n.interfaces,s)}}function un(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var Ce=256*Uint32Array.BYTES_PER_ELEMENT,ve=Uint32Array.BYTES_PER_ELEMENT;function cn(e){return e.remapped?`
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
  let y = gid.y;`}function ro(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
`}function to(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
`}function no(e,r){let{tribes:t,deadTribeIndex:n,readback:i,cols:o,rows:s}=e,a=o*s,u={};for(let m=0;m<t.length;m++){let f=r?i.histogram[m]??0:0;u[t[m].id]=f}let l=r?u[t[n]?.id??""]??0:0;return{population:u,aliveCells:r?Math.max(0,a-l):0,deadCells:l}}function io(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,i=0;for(let o=0;o<r.length;o++)o!==t&&(i+=n.histogram[o]??0);return i}function oo(e,r){let{tribes:t,deadTribeIndex:n,readback:i}=e,o=r?io(e):0,s=0,a=0;for(let u=0;u<t.length;u++){let l=u!==n&&o>0?(i.histogram[u]??0)/o:0;l>0&&(s-=l*Math.log2(l),a+=l*l)}return{shannonEntropy:s,simpsonSum:a}}function ao(e,r){let t=e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,i=r?Math.max(0,t-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?i/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function fn(e){let{device:r}=e,t=r.createShaderModule({label:p.histogramMetricsShaderModule,code:ro(e)}),n=r.createComputePipeline({label:p.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),i=r.createBuffer({label:p.histogramMetricsBuffer,size:Ce,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=r.createBuffer({label:p.histogramMetricsReadBuffer,size:Ce,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=r.createShaderModule({label:p.interfaceMetricsShaderModule,code:to(e)}),a=r.createComputePipeline({label:p.interfaceMetricsPipeline,layout:"auto",compute:{module:s,entryPoint:"main"}}),u=r.createBuffer({label:p.interfaceMetricsBuffer,size:ve,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),l=r.createBuffer({label:p.interfaceMetricsReadBuffer,size:ve,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:a,boundaryBuffer:u,boundaryReadBuffer:l}}function pn(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function mn(e){let{device:r,encoder:t,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:s}=e;if(W(s,"population")||W(s,"diversity")){let a=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,a);let u=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),l=t.beginComputePass({label:p.histogramMetricsPass});l.setPipeline(n.histogramPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Ce)}if(W(s,"interfaces")){let a=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,a);let u=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),l=t.beginComputePass({label:p.interfaceMetricsPass});l.setPipeline(n.boundaryPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,ve)}}async function bn(e){let{resources:r,enabledSections:t}=e,n=W(t,"population")||W(t,"diversity"),i=W(t,"interfaces"),o=[];n&&o.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let s=new Uint32Array(256);n&&(s=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let a=0;if(i){let u=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),a=u[0]??0}return{histogram:s,crossStateContactEdges:a}}function gn(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:i,cols:o,rows:s,totalFrames:a,fps:u,canStepBack:l,recordingBytes:m,recordingRawBytes:f}=e,d=W(t,"population")&&i.population,v=W(t,"diversity")&&i.diversity,T=W(t,"interfaces")&&i.interfaces,D=o*s,de=no(e,d),N=oo(e,v),Vt=ao(e,T);return{type:"metrics",generation:r,population:de.population,aliveCells:de.aliveCells,deadCells:de.deadCells,occupancy:d&&D>0?de.aliveCells/D:0,shannonEntropy:N.shannonEntropy,simpsonIndex:v?1-N.simpsonSum:0,interfaces:Vt,metricsAvailability:n,extinctionTime:{},totalFrames:a,fps:u,canStepBack:l,recordingBytes:m,recordingRawBytes:f}}function so(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}function hn(e,r,t,n,i){let o=fe(r.cols,t),s=e[i*o+(n>>t.wordShift)]??0;return so(s,t,n&t.cellIndexMask)}function Sn(e,r,t,n,i,o){let s=fe(r.cols,t),a=i*s+(n>>t.wordShift),u=(n&t.cellIndexMask)<<t.cellShift,l=~(t.cellMask<<u),m=e[a]??0;e[a]=(m&l|(o&t.cellMask)<<u)>>>0}var uo=64*1024*1024,Ts=256*1024*1024;function xr(e,r,t,n){let i=e,o;if(t.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(re(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let s=0;s<r.rows;s++)for(let a=0;a<r.cols;a++)Sn(o,r,n,a,s,hn(i,r,t,a,s))}return o}function yn(e,r,t){let n=Math.floor((r-1)/2),i=e-n,o=i+r,s=[];if(i>=0&&o<=t)s.push({destinationStart:i,localStart:0,span:r});else if(i<0){let a=-i;s.push({destinationStart:t-a,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:r-a})}else{let a=t-i;s.push({destinationStart:i,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:o-t})}return s.filter(a=>a.span>0)}function Tn(e){return`
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
`}function Cn(e,r,t,n){let i=yn(e,t,n.cols),o=yn(r,t,n.rows),s=[];for(let a of o)for(let u of i)s.push({destinationStartX:u.destinationStart,destinationStartY:a.destinationStart,localStartX:u.localStart,localStartY:a.localStart,spanCols:u.span,spanRows:a.span});return s}var vn={"=":"==","\u2260":"!=",">":">","<":"<","\u2265":">=","\u2264":"<="};function co(e){let r;return typeof e=="string"?r=Mn([e]):r=I(e),r}function Mn(e){return{kind:"tribes",tribes:[...e&&e.length>0?e:[x]]}}function I(e,r){let t=e??Mn(r),n;switch(t.kind){case"tribes":n={...t,tribes:[...t.tribes]};break;case"tiedMajority":n={...t,source:I(t.source)};break;default:n={...t};break}return n}function Oe(e,r){return{kind:"count",selector:I(e?.selector,r)}}function _r(e){return JSON.stringify(te(e))}function te(e){let r;switch(e.kind){case"tribes":r={...e,tribes:[...new Set(e.tribes)].sort()};break;case"tiedMajority":r={...e,source:te(e.source)};break;default:r=e;break}return r}function xn(e){return e.become??{kind:"fixed",tribe:e.tribe??x}}function De(e){let r;switch(e.kind){case"majority":case"minority":r={...e,selector:I(e.selector),tie:e.tie?De(e.tie):void 0,fallback:e.fallback?De(e.fallback):void 0};break;case"combine":r={kind:"combine",strategy:{...e.strategy,entries:e.strategy.entries.map(t=>({...t,inputs:t.inputs.map(n=>co(n)).sort((n,i)=>_r(n).localeCompare(_r(i)))})),default:e.strategy.default?De(e.strategy.default):void 0}};break;default:r={...e};break}return r}function lo(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function fo(e,r){e.push(`const CELLS_PER_WORD: u32 = ${r.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${r.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${r.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${r.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${r.cellMask}u;`)}function po(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function mo(e,r,t){r.remapped?(e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;")):(e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;"))}function bo(e){let r=Bo(e),t=new Map,n=0;for(let i of r)t.set(i,`count_${n++}`);return t}function go(e,r){let t=Po(e),n=new Map,i=0;for(let o of t){let s=r.get(o);s?n.set(o,s):n.set(o,`eq_count_${i++}`)}return n}function ho(e,r,t,n){for(let[i,o]of r)e.push(`  let ${o} = ${pt(En(i),t,n)};`);r.size>0&&e.push("")}function So(e,r,t,n,i){let o=0;for(let[s,a]of t)r.has(s)||(e.push(`  let ${a} = ${pt(En(s),n,i)};`),o++);o>0&&e.push("")}function yo(e,r,t,n,i,o){for(let s=0;s<r.length;s++){let a=r[s],u=$e(a.clause,t,n,i,o);e.push(s===0?`  if (${u}) {`:`  } else if (${u}) {`),ft(e,De(xn(a)),i,o,`rule_${s}`,"    ")}r.length>0&&e.push("  }"),e.push("")}function ft(e,r,t,n,i,o,s=null){switch(r.kind){case"fixed":e.push(`${o}result = ${z(r.tribe,n)}u;`);break;case"same":e.push(`${o}result = selfTribe;`);break;case"majority":case"minority":To(e,r,t,n,i,o);break;case"combine":Co(e,r,t,n,i,o,s);break}}function To(e,r,t,n,i,o){let s=I(r.selector),a=`${i}_${r.kind}`,u=`${i}_${r.kind}_count`,l=`${i}_${r.kind}_ties`,m=r.kind==="majority"?"0u":"9u",f=r.kind==="majority"?`candidateCount > ${u}`:`candidateCount < ${u}`;e.push(`${o}var ${a}: u32 = ${z(x,n)}u;`),e.push(`${o}var ${u}: u32 = ${m};`),e.push(`${o}var ${l}: u32 = 0u;`);for(let d of Br(s,t,n)){let v=H(D=>`${D} == ${d}u`),T=Me(s,d,n);e.push(`${o}{`),e.push(`${o}  let candidateCount = ${v};`),e.push(`${o}  if (${T} && candidateCount > 0u) {`),e.push(`${o}    if (${f}) {`),e.push(`${o}      ${a} = ${d}u;`),e.push(`${o}      ${u} = candidateCount;`),e.push(`${o}      ${l} = 1u;`),e.push(`${o}    } else if (candidateCount == ${u}) {`),e.push(`${o}      ${l} = ${l} + 1u;`),e.push(`${o}    }`),e.push(`${o}  }`),e.push(`${o}}`)}e.push(`${o}if (${l} == 1u) {`),e.push(`${o}  result = ${a};`),e.push(`${o}} else if (${l} > 1u) {`),r.tie?ft(e,r.tie,t,n,`${i}_tie`,`${o}  `,{selector:s,bestCountVar:u,tieCountVar:l}):Rr(e,r.fallback,t,n,`${i}_tie_fallback`,`${o}  `),e.push(`${o}} else {`),Rr(e,r.fallback,t,n,`${i}_fallback`,`${o}  `),e.push(`${o}}`)}function Rr(e,r,t,n,i,o){r?ft(e,r,t,n,i,o):e.push(`${o}result = ${z(x,n)}u;`)}function Co(e,r,t,n,i,o,s){let a=`${i}_input_mask`;e.push(`${o}var ${a}: u32 = 0u;`);for(let f of _o(t,n,s)){let d=kn(f,n,s);e.push(`${o}if (${d}) {`),e.push(`${o}  ${a} = ${a} | ${Bn(f)};`),e.push(`${o}}`)}let u=`${i}_dead_present`,l=H(f=>`${f} == ${z(x,n)}u`);e.push(`${o}let ${u} = ${l} > 0u;`);let m=[...r.strategy.entries].sort((f,d)=>Number(dt(d,n))-Number(dt(f,n)));m.forEach((f,d)=>{let v=Ro(f.inputs,t,n,s),T=dt(f,n)?` && ${u}`:"",D=`${a} == (${v})${T}`;e.push(d===0?`${o}if (${D}) {`:`${o}} else if (${D}) {`),e.push(`${o}  result = ${z(f.output,n)}u;`)}),m.length>0?(e.push(`${o}} else {`),Rr(e,r.strategy.default,t,n,`${i}_fallback`,`${o}  `),e.push(`${o}}`)):Rr(e,r.strategy.default,t,n,`${i}_fallback`,o)}function vo(e){for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(`    let ${Rn(t,r)} = readCell(${_n("x",t,"COLS")}, ${_n("y",r,"ROWS")});`)}function pt(e,r,t){let n=te(e),i;switch(n.kind){case"same":i=H(o=>`${o} == selfTribe`);break;case"different":i=H(o=>`${o} != selfTribe`);break;case"tiedMajority":i=pt(n.source,r,t);break;case"tribes":{let o=Ne(n.tribes,t);i=o.length===0?"0u":H(s=>o.map(a=>`${s} == ${a}u`).join(" || "));break}}return i}function H(e){return Mo().map(r=>`select(0u, 1u, ${e(r)})`).join(" + ")}function Rn(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function Mo(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(Rn(t,r));return e}function _n(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function Ne(e,r){let t=[];for(let n of e)t.push(kr(n,r,"selector"));return[...new Set(t)]}function z(e,r){return kr(e,r,"target")}function kr(e,r,t){let n=r.get(e),i=r.get(x)??0;return n===void 0&&console.error(`Unknown rule ${t} tribe; using dead tribe instead.`,{tribe:e}),n??i}function Br(e,r,t){let n=te(e),i;switch(n.kind){case"tribes":i=Ne(n.tribes,t);break;case"tiedMajority":i=Br(n.source,r,t);break;default:i=r.map(o=>kr(o.id,t,"selector"));break}return[...new Set(i)].sort((o,s)=>o-s)}function Me(e,r,t){let n=te(e),i;switch(n.kind){case"same":i=`selfTribe == ${r}u`;break;case"different":i=`selfTribe != ${r}u`;break;case"tiedMajority":i=Me(n.source,r,t);break;case"tribes":{i=Ne(n.tribes,t).includes(r)?"true":"false";break}}return i}function xo(e,r,t,n){let i=te(e),o;if(i.kind==="tiedMajority"&&n){let s=H(u=>`${u} == ${r}u`),a=Me(n.selector,r,t);o=`(${n.tieCountVar} > 1u && ${n.bestCountVar} > 0u && ${a} && ${s} == ${n.bestCountVar})`}else{let s=H(u=>`${u} == ${r}u`);o=`(${Me(i.kind==="tiedMajority"?i.source:i,r,t)} && ${s} > 0u)`}return o}function _o(e,r,t){let n;return t?n=Br(t.selector,e,r):n=e.map(i=>kr(i.id,r,"selector")),[...new Set(n)].filter(i=>i!==z(x,r)).sort((i,o)=>i-o)}function kn(e,r,t){let n;if(t){let i=H(s=>`${s} == ${e}u`),o=Me(t.selector,e,r);n=`(${e}u != ${z(x,r)}u && ${t.tieCountVar} > 1u && ${t.bestCountVar} > 0u && ${o} && ${i} == ${t.bestCountVar})`}else{let i=H(o=>`${o} == ${e}u`);n=`(${e}u != ${z(x,r)}u && ${i} > 0u)`}return n}function Ro(e,r,t,n){let i=[];for(let o of e){let s=I(o);for(let a of Br(s,r,t))if(a!==z(x,t)){let u=ko(s,a,t,n);i.push(`select(0u, ${Bn(a)}, ${u})`)}}return i.length>0?i.join(" | "):"0u"}function dt(e,r){let t=z(x,r);return e.inputs.some(n=>{let i=I(n);return i.kind==="tribes"&&Ne(i.tribes,r).includes(t)})}function ko(e,r,t,n){let i=te(e),o;if(n){let s=kn(r,t,n),a=Me(i.kind==="tiedMajority"?i.source:i,r,t);o=`(${s} && ${a})`}else o=xo(i,r,t,null);return o}function Bn(e){return`(1u << ${e}u)`}function Pn(e){return _r(e)}function En(e){return JSON.parse(e)}function wn(e,r){let t=new Set,n=o=>{t.add(Pn(o))},i=o=>{switch(r(o,n),o.kind){case Tr:i(o.clause);break;case Cr:case vr:case Mr:for(let s of o.clauses)i(s);break}};for(let o of e)i(o);return t}function Bo(e){return wn(e,(r,t)=>{switch(r.kind){case gr:case hr:case Sr:case yr:case br:t(I(r.selector,r.tribes));break}})}function Po(e){return wn(e,(r,t)=>{r.kind===mr&&(t(Oe(r.left,r.tribe1).selector),t(Oe(r.right,r.tribe2).selector))})}function $e(e,r,t,n,i){switch(e.kind){case ct:return"false";case nn:return Eo(e.tribes,n,i);case br:return Ue(pe(I(e.selector,e.tribes),r),e.interval[0],e.interval[1]);case gr:return Ue(pe(I(e.selector,e.tribes),r),0,0);case hr:return Ue(pe(I(e.selector,e.tribes),r),e.value,e.value);case Sr:return Ue(pe(I(e.selector,e.tribes),r),e.value,8);case yr:return Ue(pe(I(e.selector,e.tribes),r),0,e.value);case mr:return wo(e,t);case Tr:return`!(${$e(e.clause,r,t,n,i)})`;case Cr:return`(${e.clauses.map(o=>$e(o,r,t,n,i)).join(" && ")})`;case vr:return`(${e.clauses.map(o=>$e(o,r,t,n,i)).join(" || ")})`;case Mr:return Ao(e.clauses,r,t,n,i);default:return"false"}}function Eo(e,r,t){let n=Ne(e,t);return n.length===0?"false":n.length===r.length?"true":`(${n.map(i=>`selfTribe == ${i}u`).join(" || ")})`}function Ue(e,r,t){return`(${e} >= ${r}u && ${e} <= ${t}u)`}function wo(e,r){let t=Oe(e.left,e.tribe1).selector,n=Oe(e.right,e.tribe2).selector,i=vn[e.operator]??"==",o=Math.max(-8,Math.min(8,e.margin??0));return`(i32(${pe(t,r)}) ${i} (i32(${pe(n,r)}) + ${o}i))`}function Ao(e,r,t,n,i){return`(((${e.map(o=>$e(o,r,t,n,i)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`}function pe(e,r){return r.get(Pn(e))}function mt(e,r,t){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,i=Math.min(n,t),o=Math.ceil(n/i);if(o<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:i,dispatchWgY:o,remapped:!0};throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`)}function An(e,r,t,n,i,o,s){let a=[],u=e.rules.filter(d=>!d.muted),l=s.get(x)??0,m=bo(u.map(d=>d.clause)),f=go(u.map(d=>d.clause),m);return a.push("// Auto-generated simulation compute shader."),a.push(`// Tribes: ${r.map(d=>d.id).join(", ")}`),a.push(`// Rules: ${e.rules.length}`),a.push(""),a.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),a.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),a.push(""),a.push(`const COLS: u32 = ${n.cols}u;`),a.push(`const ROWS: u32 = ${n.rows}u;`),a.push(`const PACKED_COLS: u32 = ${t}u;`),lo(a,i),fo(a,o),a.push(""),po(a,"gridIn","PACKED_COLS"),a.push(""),a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {"),ho(a,m,r,s),So(a,m,f,r,s),a.push(`  var result: u32 = ${l}u;`),a.push(""),yo(a,u,m,f,r,s),a.push("  return result;"),a.push("}"),a.push(""),a.push("@compute @workgroup_size(16, 16)"),i.remapped?a.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):a.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),mo(a,i,"px"),a.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),a.push(""),a.push("  let baseX = px << WORD_SHIFT;"),a.push("  var packed: u32 = 0u;"),a.push(""),a.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),a.push("    let x = baseX + i;"),a.push("    if (x >= COLS) { break; }"),a.push(""),a.push("    let selfTribe = readCell(x, y);"),vo(a),a.push(""),a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),a.push("  }"),a.push(""),a.push("  gridOut[y * PACKED_COLS + px] = packed;"),a.push("}"),a.join(`
`)}var xe=3,We="gol-recording",me="raw-packed",bt="deflate-raw",gt=12,ht=256*1024*1024,In=512*1024*1024;function St(e,r,t=0){let n=t;for(let i of e)n+=i[r];return n}function Gn(e,r){return Math.min(e,r)}function yt(e){return Math.min(e,1073741824)}function Fn(e){return Math.min(e,In)}function Tt(e,r){return Math.max(e*2,r*6)}function Pr(e,r){return e>0&&e<=r}function Fo(e,r){return e>0?e*2+r:0}function Lo(e,r){return e>=1&&r>0?e*r*(1+xe):0}function Do(e,r){return e<ht?Math.min(ht,r):e}function Ln(e,r){return Pr(e,r)?Math.max(1,Math.floor(Do(e,r)/e)):0}function Er(e,r){return e>=1&&r>0?Math.max(1,Math.min(gt,Math.floor(536870912/(e*r)))):gt}function Dn(e,r,t,n,i,o){let s=!r.some(u=>u)&&(i||o>=e),a=i?Math.floor(n/2)+1:n;return e>=1&&r.length>0&&(s||t>=a)}function On(e,r,t,n){return e<r&&n.some((i,o)=>t[o]&&i.mapState==="unmapped")}function Un(e,r,t,n,i,o){return e&&r>=1&&t!==null&&n.length>0&&(i<r||o)}function $n(e,r,t,n){let i=e.quota??0,o=e.usage??0,s=0,a=0;for(let m of r)m.codec===me?s+=m.storedBytes:a+=m.storedBytes;let u=t*n,l=(1+xe)*u;return{quotaBytes:i,usedBytes:o,pendingRawBytes:s,compressedBytes:a,reservedBytes:l}}function Nn(e,r,t,n,i){let o=yt(e);return{maxBytes:e,vramBudgetBytes:Tt(e,o),frameByteSize:r,recordingAvailable:Pr(r,o),vramSimulationBytes:Fo(r,n),vramRecordingBytes:Lo(t,r),gridFormat:i}}function ze(e,r,t){r.length>0&&(e.generationStart=r[0].generationStart,e.generationEnd=r[r.length-1].generationEnd),t.length>0&&(r.length===0&&(e.generationStart=t[0]),e.generationEnd=t[t.length-1]),e.chunks=[...r]}function Wn(e){return e.map(r=>({...r,generations:[...r.generations]}))}function zn(e,r){return e!==r}function qe(e,r=0){return St(e,"blockCount",r)}function qn(e){return St(e,"storedBytes")}function Kn(e){return St(e,"uncompressedBytes")}var Oo=256,Ke=80,Xn=Oo*Uint32Array.BYTES_PER_ELEMENT;function Yn(e){let r=new ArrayBuffer(Ke),t=new Float32Array(r),n=new Int32Array(r),i=new Uint32Array(r),o=(e.offsetX%e.grid.cols+e.grid.cols)%e.grid.cols,s=(e.offsetY%e.grid.rows+e.grid.rows)%e.grid.rows,a=Math.floor(o),u=Math.floor(s);return t[0]=e.canvasWidth,t[1]=e.canvasHeight,t[2]=e.scale,t[4]=o-a,t[5]=s-u,i[6]=e.grid.cols,i[7]=e.grid.rows,i[8]=a,i[9]=u,i[10]=e.tribeCount,n[12]=e.brushPreview.centerX,n[13]=e.brushPreview.centerY,i[14]=e.brushPreview.brushSize,i[15]=e.brushPreview.shape,i[16]=e.brushPreview.visible?1:0,i[17]=e.exportFrameOverlay.originX,i[18]=e.exportFrameOverlay.originY,i[19]=e.exportFrameOverlay.visible?1:0,r}function Hn(e){let r=new Uint32Array(e.length);for(let t=0;t<e.length;t++){let n=e[t].color,i=parseInt(n.substring(0,2),16),o=parseInt(n.substring(2,4),16),s=parseInt(n.substring(4,6),16);r[t]=i|o<<8|s<<16}return r}function jn(e,r){return e.replace("__CELLS_PER_WORD__",`${r.cellsPerWord}u`).replace("__WORD_SHIFT__",`${r.wordShift}u`).replace("__CELL_SHIFT__",`${r.cellShift}u`).replace("__CELL_INDEX_MASK__",`${r.cellIndexMask}u`).replace("__CELL_MASK__",`${r.cellMask}u`)}var Uo=500,$o=33,No=2,Wo=.5,Vn=.2,Zn=1,zo=1048576;function Qn(e){return Math.min(3,Math.max(0,Math.ceil(Math.log10(e.cols*e.rows/1e5))))}function Xe(e){return 1024/4**Qn(e)}function wr(e){return 16/2**Qn(e)}function qo(e){return Math.max(Zn,Math.round(Xe(e)*wr(e)))}function Jn(e,r){return{generationsPerDrain:qo(e),targetDrainMs:r.kind==="max"?Uo:$o,smoothedDrainMs:0,lastDrainStartedAt:0,lastSubmittedGenerations:0}}function ei(e,r){if(r>0&&e.lastSubmittedGenerations>0){let t=e.smoothedDrainMs===0?r:e.smoothedDrainMs*(1-Vn)+r*Vn,n=Math.min(No,Math.max(Wo,e.targetDrainMs/t));e.smoothedDrainMs=t,e.generationsPerDrain=Math.max(Zn,Math.min(zo,Math.round(e.generationsPerDrain*n)))}}function Ct(e,r){return e==="recording"?Number.MAX_SAFE_INTEGER:Xe(r)*wr(r)}function vt(e,r,t,n,i){let o=e-r*n;return t>n||t>i?Math.min(o,r):o}function ri(e){return e<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/e}}function j(e){return e.request.stopCondition.kind==="targetGeneration"}function _e(e,r){return e.request.stopCondition.kind==="targetGeneration"&&r>=e.request.stopCondition.generation}function V(e,r){return e.request.stopCondition.kind==="targetGeneration"?Math.max(0,e.request.stopCondition.generation-r):Number.POSITIVE_INFINITY}function ti(e,r){return r.restore!==!1&&e.request.restoreAfterStop||null}function ni(e,r,t){return r&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")}function ii(e,r,t,n,i){return e.restartRestoredRun!==!1&&r&&t&&!n&&!i}function Mt(e,r,t,n){let i=r+t,o=Math.min(n,i-1);if(o<=0)return null;let s=i-1-o;if(s>=r)return{source:"buffered",frameInChunk:s-r};let a=0;for(let u=0;u<e.length;u++){let l=e[u];if(s<a+l.blockCount)return{source:"sealed",sealedIndex:u,frameInChunk:s-a};a+=l.blockCount}return null}function oi(e,r){return{chunkFrameIndex:r.frameInChunk+1,generation:e[r.frameInChunk]}}function xt(e,r,t,n,i,o){let s=(r+1)*t;if(i.bitsPerCell===o.bitsPerCell)return{sameFormat:!0,chunkPrefix:new Uint8Array(e,0,s),activeFrame:null};let a=re(n,i),u=new Uint8Array(s);for(let l=0;l<=r;l++){let m=new Uint8Array(e,l*a,a),f=xr(tn(m),n,i,o);u.set(new Uint8Array(f.buffer,f.byteOffset,f.byteLength),l*t)}return{sameFormat:!1,chunkPrefix:u,activeFrame:u.subarray(r*t,s)}}var c,_=!1,Wr,Ir,he,Hr,w=0,A=0,jr=0,k=lr,Pe=[],Ee=new Map,kt,Bt,G,F,we,ke,Qe,Pt,Et,Gr,ci,li,O=!1,di=1,fi=0,pi=0,B=!1,R=!1,J=100,b=0,Ae=0,Ye=0,Vr=0,Fr,Ko=4,Wt=192,ge=[],zr=[],qr=[],Xo=0,Lr=null,mi={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},bi={originX:0,originY:0,visible:!1},se=null,Dr=-1,Be=!1,He=!1,_t=0,Je=pr,Or=[],E=!1,U=!1,Z={chunks:[],generationStart:0,generationEnd:0,gridFormat:Fe(lr)},gi=0,y=[],er=!1,g=null,hi=0,Ur=!1,$=null,S=0,M=[],ue=null,C=64,h=0,ce=[],q=[],je=null,be=null,K=0,rr=0,ne=0,Q=!1,Re=0,$r=0,Nr=0,Ve=[];function Si(e){switch(!0){case e instanceof Error:return e.message;case typeof e=="string":return e;case(e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"):return e.message;default:return String(e??"Unknown worker error")}}function Zr(e){console.error("[GOLT worker] Worker GPU error:",e),P("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),B=!1,self.postMessage({type:"gpuError",reason:Si(e)})}self.addEventListener("error",e=>{e.preventDefault(),Zr(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),Zr(e.reason)});async function zt(){await c.queue.onSubmittedWorkDone()}function ai(e){$r=0,Nr=2+(e?1+xe:0),Ve=[]}async function Kr(){if(Ve.length>0){let e=c.createCommandEncoder({label:p.trackedAllocationClearEncoder});for(let r of Ve)e.clearBuffer(r);c.queue.submit([e.finish()]),await zt(),Ve=[]}}async function Xr(e,r){R&&Nr>0&&($r+=e,Nr--,Ve.push(r),$r>=Fn(Se())&&Nr>0&&(await Kr(),$r=0))}function Yr(){$?.destroy(),$=null;for(let e of ce)e?.destroy();ce=[],q=[],C=0,S=0,M=[],ue=null,rr=0}function si(){G?.destroy(),F?.destroy(),pn(se),se=null,ge.forEach(e=>e.destroy()),ge=[],zr=[],qr=[],Yr()}function Ar(e){let r=K>0;K+=e;let t=K>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function ie(){let e=Dn(C,q,ne,Er(C,h),Q,S);e!==Q&&(Q=e,self.postMessage({type:"backpressure",active:e}))}async function Te(){self.postMessage({type:"storageQuota",...$n(await navigator.storage.estimate(),y,C,h)})}function Se(){return Gn(c.limits.maxBufferSize,c.limits.maxStorageBufferBindingSize)}function ir(){return yt(Se())}function oe(){return Pr(h,ir())}function yi(){return On(ne,Er(C,h),q,ce)}function tr(){return Un(oe(),C,$,ce,S,yi())}async function Yo(e){let r=new DecompressionStream(bt),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],i=r.readable.getReader();for(;;){let{done:u,value:l}=await i.read();if(u)break;n.push(l)}let o=0;for(let u of n)o+=u.byteLength;let s=new Uint8Array(o),a=0;for(let u of n)s.set(u,a),a+=u.byteLength;return s.buffer}function X(){return{cols:w,rows:A}}function Ho(){return mt(Math.ceil(jr/16),Math.ceil(A/16),c.limits.maxComputeWorkgroupsPerDimension)}function jo(){return mt(Math.ceil(w/16),Math.ceil(A/16),c.limits.maxComputeWorkgroupsPerDimension)}function wt(){we?.destroy(),we=c.createBuffer({label:p.uniformBuffer,size:Ke,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Vo(){let e=Yn({canvasWidth:he.width,canvasHeight:he.height,scale:di,offsetX:fi,offsetY:pi,grid:X(),tribeCount:Pe.length,brushPreview:mi,exportFrameOverlay:bi});c.queue.writeBuffer(we,0,e)}function Qr(){return re({cols:w,rows:A},k)}function le(){return Fe(k)}async function At(){let e=Qr();G=c.createBuffer({label:p.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Xr(e,G),F=c.createBuffer({label:p.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Xr(e,F);let r=c.createCommandEncoder({label:p.gridClearEncoder});r.clearBuffer(G),r.clearBuffer(F),c.queue.submit([r.finish()]),O=!1}function It(){let e=Hn(Pe);ke&&ke.destroy(),ke=c.createBuffer({label:p.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),c.queue.writeBuffer(ke,0,e)}function Gt(){let e=c.createShaderModule({label:p.renderShaderModule,code:jn(Qt,k)});Qe=c.createRenderPipeline({label:p.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:Ir}]},primitive:{topology:"triangle-list"}})}function Ft(){Pt=c.createBindGroup({layout:Qe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:we}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:ke}}]}),Et=c.createBindGroup({layout:Qe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:we}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:ke}}]})}function Lt(){kt=Ho();let e=An(Hr,Pe,jr,X(),kt,k,Ee),r=c.createShaderModule({label:p.simulationShaderModule,code:e});Gr=c.createComputePipeline({label:p.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),ci=c.createBindGroup({layout:Gr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:F}}]}),li=c.createBindGroup({layout:Gr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:G}}]})}function Dt(){Bt=jo(),se=fn({device:c,cols:w,rows:A,gridFormat:k,dispatchPlan:Bt})}function Ot(){let e=c.createShaderModule({label:p.brushShaderModule,code:Tn(k)});Fr=c.createComputePipeline({label:p.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),ge.forEach(r=>r.destroy()),ge=[],zr=[],qr=[];for(let r=0;r<Ko;r++){let t=c.createBuffer({label:`${p.brushUniformBuffer} ${r}`,size:Wt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});ge.push(t),zr.push(c.createBindGroup({layout:Fr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:t}}]})),qr.push(c.createBindGroup({layout:Fr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:t}}]}))}}function Zo(e,r,t,n,i,o,s){let a=Ee.get(x)??0,u=Xo++,l=Cn(r,t,n,X()),m=O?qr:zr;for(let[f,d]of l.entries()){let v=new ArrayBuffer(Wt),T=new Uint32Array(v);T[0]=jr,T[1]=n,T[2]=i,T[3]=o,T[4]=a,T[5]=u,T[6]=s.length,T[7]=d.destinationStartX,T[8]=d.destinationStartY,T[9]=d.localStartX,T[10]=d.localStartY,T[11]=d.spanCols,T[12]=d.spanRows,T[13]=0;for(let N=0;N<s.length&&N<32;N++)T[14+N]=s[N];let D=ge[f],de=m[f];if(D&&de){c.queue.writeBuffer(D,0,v);let N=Math.floor(d.destinationStartX/k.cellsPerWord),qi=Math.ceil((d.destinationStartX+d.spanCols)/k.cellsPerWord)-N,Ki=Math.ceil(qi/8),Xi=Math.ceil(d.spanRows/8),cr=e.beginComputePass({label:p.brushPass});cr.setPipeline(Fr),cr.setBindGroup(0,de),cr.dispatchWorkgroups(Ki,Xi),cr.end()}else throw console.error("[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.",{index:f,rectCount:l.length,bindGroupCount:m.length,uniformBufferCount:ge.length}),new Error("Brush dispatch resources are out of sync with the wrapped brush rectangles.")}}function Qo(){let e=O?F:G,r=Qr(),t;try{t=c.createBuffer({label:p.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=c.createCommandEncoder({label:p.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),c.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),i})}function Ti(){h=Qr(),C=Ln(h,ir())}function Ut(){self.postMessage({type:"limits",...Nn(Se(),h,C,Ke+Xn+Wt+Ce*2+ve*2,le())})}function Ci(){return C>=1&&$!==null&&S<C}function vi(e,r){let t=O?F:G,n=S*h;e.copyBufferToBuffer(t,0,$,n,h),M.push(r),ue=r,S++}function qt(e){if(Ci()){let r=c.createCommandEncoder({label:p.recordingFrameCopyEncoder});vi(r,e),c.queue.submit([r.finish()]),Ze()}}function Rt(e){rr=Math.max(0,rr+e)}function Ze(){C>0&&S>=C&&yi()&&or()}function or(){let e=$;if(e!==null&&S>0&&ce.length>0&&ne<Er(C,h)){let r=q.indexOf(!0);if(r>=0){q[r]=!1;let t=ce[r];if(t.mapState==="unmapped"){let n=S*h,i=gi++,o=[...M],s=o[0],a=o[o.length-1],u=`chunk-${String(i).padStart(6,"0")}.bin`,l=S,m=c.createCommandEncoder({label:p.recordingSealCopyEncoder});m.copyBufferToBuffer(e,0,t,0,n),c.queue.submit([m.finish()]);let f={chunkId:i,generationStart:s,generationEnd:a,blockCount:l,codec:me,uncompressedBytes:n,storedBytes:n,gridFormat:le(),generations:o,filename:u};Ar(1),Rt(l),ne++,ie();let d=Re;t.mapAsync(GPUMapMode.READ).then(async()=>{let v=t.getMappedRange(),T=new ArrayBuffer(n);new Uint8Array(T).set(new Uint8Array(v,0,n)),t.unmap(),d===Re&&(q[r]=!0,y.push(f),Rt(-l),ze(Z,y,M),ie(),Ze(),Jo(f,T).then(()=>{d===Re&&(ne--,ie(),Ar(-1),Te(),nr(),Y(!0),Ze(),self.postMessage({type:"chunkSealed",filename:f.filename,rawBytes:n,blockCount:f.blockCount,cols:w,rows:A,rawGridFormat:f.gridFormat,storageGridFormat:Fe(dr(Hr.tribes.length))}),er&&K===0&&(er=!1,nr()))}).catch(D=>{d===Re&&(ne--,ie(),Ar(-1),na(f,D).catch(Zr))}))}).catch(()=>{d===Re&&(q[r]=!0,ne--,Rt(-l),ie(),Ar(-1),Ze())}),S=0,M=[]}else q[r]=!0}}}async function Mi(e){Re++,gi=0,S=0,M=[],y=[],ue=null,rr=0,ne=0,K>0&&(K=0,self.postMessage({type:"chunksSaving",active:!1})),Q&&(Q=!1,self.postMessage({type:"backpressure",active:!1})),er=!1,U=E,Z={chunks:[],generationStart:e,generationEnd:e,gridFormat:le()},await _i(),Te()}async function Kt(){return be&&await be,je||(je=await(await navigator.storage.getDirectory()).getDirectoryHandle(We,{create:!0})),je}async function Jo(e,r){let t=await Kt(),i=await(await t.getFileHandle(e.filename,{create:!0})).createWritable(),o=!1;try{await i.write(r),await i.close(),o=!0,i=null}catch(s){if(i&&!o)try{await i.abort()}catch(a){console.warn("[GOLT worker] Failed to abort recording chunk write after error:",a)}try{await t.removeEntry(e.filename)}catch(a){a instanceof DOMException&&a.name==="NotFoundError"||console.warn("[GOLT worker] Failed to remove failed recording chunk:",e.filename,a)}throw s}}function ea(e){let r=Si(e).toLowerCase();return e instanceof DOMException&&e.name==="QuotaExceededError"||r.includes("storage quota")||r.includes("quota exceeded")||r.includes("exceed its storage quota")}function xi(e){let r=y.findIndex(t=>t.filename===e.filename);r>=0&&y.splice(r,1)}async function ra(){let e=null,r=qe(y),t=Mt(y,r,0,1);if(t?.source==="sealed"){let{frameInChunk:n}=t,i=y[t.sealedIndex];try{let o=(n+1)*h,s=await Ri(i.filename,i.codec),a=X(),u=fr(i.gridFormat),l=xt(s,n,h,a,u,k),m=l.activeFrame??l.chunkPrefix.subarray(n*h,o);if(c.queue.writeBuffer(O?F:G,0,m),S=0,M=[],b=i.generations[n]??i.generationEnd,ue=b,e=b,n<i.blockCount-1){let d=n+1,v=i.blockCount>0?Math.floor(i.uncompressedBytes/i.blockCount):h;i.blockCount=d,i.generationEnd=b,i.generations=i.generations.slice(0,d),i.uncompressedBytes=v*d,i.codec===me&&(i.storedBytes=h*d)}let f=y.splice(t.sealedIndex+1);await $t(f.map(d=>d.filename)),Jr(),Ei(),L()}catch(o){console.warn("[GOLT worker] Failed to restore the previous persisted recording frame after storage quota pressure:",o)}}else{let n=y.splice(0);await $t(n.map(i=>i.filename)),S=0,M=[]}return e}async function ta(e,r){console.warn("[GOLT worker] Recording stopped because OPFS storage quota was reached:",r),xi(e),P("cancelled",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),B=!1,E=!1,U=!1;let t=await ra();ze(Z,y,M),ie(),Te(),nr(),Y(!0),self.postMessage({type:"recordingStopped",reason:"storageQuota",restoredGeneration:t})}async function na(e,r){xi(e),ea(r)?await ta(e,r):Zr(r)}async function $t(e){let r=await Kt();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function _i(){if(be)await be;else{be=(async()=>{let e=await navigator.storage.getDirectory();je=null;try{await e.removeEntry(We,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${We}:`,r)}je=await e.getDirectoryHandle(We,{create:!0})})();try{await be}finally{be=null}}}function nr(){ze(Z,y,M),self.postMessage({type:"recording",manifest:{chunks:Wn(y),generationStart:Z.generationStart,generationEnd:Z.generationEnd,gridFormat:le()},cols:w,rows:A})}function ar(e=!1){if(E){let r=!U;e&&U&&tr()&&(U=!1,r=!0),r&&zn(ue,b)&&tr()&&(S>=C&&or(),qt(b))}}function Xt(){if(Lr){let e=Lr;Lr=null;let r=E&&S>0&&M[S-1]===b;r&&(S--,M.pop());let t=c.createCommandEncoder({label:p.brushEncoder});Zo(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),c.queue.submit([t.finish()]),r&&qt(b)}}async function Ri(e,r=me){let o=await(await(await(await Kt()).getFileHandle(e)).getFile()).arrayBuffer();return r===bt?Yo(o):o}function ki(){return sn(w,A,Je.enabled,Je.sections)}function ia(){return un(ki())}function Bi(e){Or=ia(),se&&Or.length>0&&mn({device:c,encoder:e,resources:se,sourceBuffer:O?F:G,dispatchPlan:Bt,enabledSections:Or})}function Pi(){let e=b;if(se&&e!==Dr&&!Be){let r=[...Or],t=ki();Dr=e,Be=!0,bn({resources:se,enabledSections:r}).then(n=>{let i=Ee.get(x)??0,o=qe(y,S+rr),s=gn({generation:e,tribes:Pe,deadTribeIndex:i,readback:n,enabledSections:r,availability:t,liveMetricSettings:Je.sections,cols:w,rows:A,totalFrames:o,fps:Vr,canStepBack:o>1,recordingBytes:qn(y),recordingRawBytes:Kn(y)});if(Be=!1,self.postMessage(s),He)if(He=!1,Dr=-1,Ai()){let a=c.createCommandEncoder({label:p.interactiveMetricsEncoder});Bi(a),c.queue.submit([a.finish()]),Pi()}else He=!0}).catch(()=>{Be=!1})}}function Yt(e){let r=e.beginComputePass({label:p.simulationStepPass});r.setPipeline(Gr),r.setBindGroup(0,O?li:ci);let t=kt;r.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),r.end(),O=!O,b++}function oa(e){if(e>0){let r=c.createCommandEncoder({label:p.simulationBatchEncoder});for(let t=0;t<e;t++)Yt(r);c.queue.submit([r.finish()]),Ae+=e}}function Ei(){self.postMessage({type:"generation",generation:b,fps:Vr})}function aa(){let e=c.createCommandEncoder({label:p.simulationSingleStepEncoder});Yt(e),c.queue.submit([e.finish()])}function L(){if(c&&Wr&&we&&Qe&&Pt&&Et&&!R&&!_){Vo();let e=Wr.getCurrentTexture().createView(),r=c.createCommandEncoder({label:p.renderEncoder}),t=r.beginRenderPass({label:p.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(Qe),t.setBindGroup(0,O?Et:Pt),t.draw(3),t.end(),c.queue.submit([r.finish()])}}function wi(e){Ye===0&&(Ye=e);let r=e-Ye;r>=1e3&&(Vr=Ae/(r/1e3),Ae=0,Ye=e)}function Jr(){Ae=0,Ye=0,Vr=0}function Ht(){return E&&oe()?"recording":"nonRecording"}function Ai(){return!!(c&&se&&!R&&!_)}function Y(e=!1){if(e&&(Dr=-1),!Ai())He=!0;else if(Be)He=!0;else{let r=c.createCommandEncoder({label:p.interactiveMetricsEncoder});Bi(r),c.queue.submit([r.finish()]),Pi()}}function Ii(){Y(!0),L()}function et(e,r){r&&(e-_t>=1e3||_t===0)&&!Be&&(_t=e,Y())}function sr(e,r){(e.request.pacing.kind==="max"||j(e))&&r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,Ei())}function Ie(e){Q!==e&&(Q=e,self.postMessage({type:"backpressure",active:e}))}function Gi(){let e=tr();return e&&S>=C&&(or(),e=tr()),e}function ur(){!R&&!_&&!g&&self.requestAnimationFrame(Nt)}function sa(e,r){let t=e.adaptiveBatch;t&&t.lastDrainStartedAt>0&&(ei(t,r-t.lastDrainStartedAt),t.lastDrainStartedAt=0,t.lastSubmittedGenerations=0)}function Fi(e,r,t){let n=e.adaptiveBatch;n&&r>0&&(n.lastSubmittedGenerations=r,n.lastDrainStartedAt=t)}function Li(e,r){let t=Math.max(1,Math.round(Xe(r))),n=0;for(;n<e;){let i=e-n,o=Math.min(t,i);oa(o),n+=o}return n}function ye(e){let r=g;if(r&&!r.pumpPending&&!R&&!_){let{token:t}=r;r.pumpPending=!0;let n=()=>{if(g&&g.token===t){let i=performance.now();g.pumpPending=!1,e==="drain"&&sa(g,i),ma(i)}};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?c.queue.onSubmittedWorkDone().then(n).catch(()=>{g?.token===t&&(g.pumpPending=!1)}):queueMicrotask(n)}}function jt(e,r){g&&P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1});let t=X(),n=e==="nonRecording"?Jn(t,r.pacing):null;n&&console.info("[GOLT worker] Adaptive non-recording batching started",{cols:t.cols,rows:t.rows,bitsPerCell:k.bitsPerCell,generationsPerDrain:n.generationsPerDrain,targetDrainMs:n.targetDrainMs}),g={kind:e,request:r,token:++hi,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0,adaptiveBatch:n},ye(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function ae(){B&&jt(Ht(),{pacing:ri(J),stopCondition:{kind:"none"}})}function ua(e,r){r||e==="cancelled"?Ie(!1):Q&&ie()}function P(e,r={}){let t=g;if(t){g=null,hi++;let n=j(t),i=ti(t,r),o=!!i;i&&(B=i.running,J=i.targetStepDuration),ni(e,n,r)&&self.postMessage({type:"stepping",active:!1}),ua(e,n),r.render!==!1&&!R&&!_&&Ii(),ii(r,o,B,R,_)?ae():ur()}}function Di(e){let r=g;r&&j(r)&&(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),P("cancelled"))}function ca(e){P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),jt(Ht(),e)}function Oi(e,r,t){Ie(!0),sr(e,r),et(r,t),ye("drain")}function Ui(e,r){let t=c.createCommandEncoder({label:p.recordingStepBatchEncoder}),n=0,i=!1,o=e>0;for(;o;)n<e&&performance.now()<r?Gi()&&Ci()?(Yt(t),vi(t,b),n++,S>=C&&(o=!1)):(i=!0,o=!1):o=!1;return n>0&&(c.queue.submit([t.finish()]),Ae+=n,Ze()),{steps:n,blocked:i}}function la(e,r){let t=X(),n=e.adaptiveBatch?.generationsPerDrain??Math.round(Xe(t)*wr(t)),i=Math.min(n,V(e,b)),o=Li(i,t),s=o>0;sr(e,r),_e(e,b)?P("targetReached"):s?(Fi(e,o,performance.now()),ye("drain")):ye("raf")}function da(e,r){ar(!0);let t=!1,n=!1,i=performance.now()+14,o=V(e,b)>0&&performance.now()<i;for(;o;){let s=Ui(V(e,b),i);t=t||s.steps>0,s.blocked?(Oi(e,r,t),n=!0,o=!1):o=s.steps>0&&V(e,b)>0&&performance.now()<i}n||(Ie(!1),sr(e,r),et(r,t),_e(e,b)?P("targetReached"):ye("raf"))}function fa(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=e.stepAccumulator,o=Math.floor(e.stepAccumulator/r),s=X(),a=e.adaptiveBatch?.generationsPerDrain??Ct(e.kind,s),u=Math.min(o,V(e,b),a),l=Li(u,s),m=l>0;if(e.stepAccumulator=vt(i,r,o,l,a),sr(e,t),_e(e,b))P("targetReached");else{let f=m&&o>l;(!j(e)&&!f||t-e.lastRenderTime>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,L(),et(t,m)),f&&Fi(e,l,performance.now()),ye(f?"drain":"raf")}}function pa(e,r,t){ar(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=!1,o=0,s=e.stepAccumulator,a=Ct(e.kind,X()),u=Math.floor(e.stepAccumulator/r),l=performance.now()+14,m=!1,f=u>0&&V(e,b)>0&&o<a&&performance.now()<l;for(;f;){let d=Math.min(u-o,a-o,V(e,b)),v=Ui(d,l);o+=v.steps,i=i||v.steps>0,v.blocked?(Oi(e,t,i),m=!0,f=!1):f=v.steps>0&&u>o&&V(e,b)>0&&o<a&&performance.now()<l}e.stepAccumulator=vt(s,r,u,o,a),m||(Ie(!1),sr(e,t),_e(e,b)?P("targetReached"):(j(e)||(L(),et(t,i)),ye("raf")))}function ma(e){let r=g;if(r&&!R&&!_)if(wi(e),j(r)||Xt(),_e(r,b))P("targetReached");else if(r.request.pacing.kind==="max")r.kind==="recording"?da(r,e):la(r,e);else{let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?pa(r,t,e):fa(r,t,e)}}function Nt(e){R||_?self.requestAnimationFrame(Nt):(wi(e),g||(Xt(),J>0&&!Ur&&L(),self.requestAnimationFrame(Nt)))}function ba(e,r){let t=c?Se():Number.POSITIVE_INFINITY;return Jt(r.bitsPerCell)&&it(r.bitsPerCell,e.tribes.length)&&ot(e,Ge(r.bitsPerCell),t)?Ge(r.bitsPerCell):rn(e.tribes.length,e,t)}function $i(e,r){Hr=e,w=e.cols,A=e.rows,k=ba(e,r),jr=fe(w,k),Pe=[...e.tribes],Z.gridFormat=le(),Ee.clear(),Pe.forEach((t,n)=>Ee.set(t.id,n))}async function Ni(e){console.log("[GOLT worker] Initializing WebGPU"),he=e,c=await on(p.webengineDevice),_=!1,c.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),P("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),_=!0,B=!1,R=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:Se(),vramBudgetBytes:Tt(Se(),ir()),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:le()});let r=he.getContext("webgpu");if(r)Wr=r,Ir=navigator.gpu.getPreferredCanvasFormat(),Wr.configure({device:c,format:Ir,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:Ir,maxBufferSize:c.limits.maxBufferSize,maxStorageBufferBindingSize:c.limits.maxStorageBufferBindingSize});else throw new Error("WebGPU canvas context not available")}async function ga(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Ni(he),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),P("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),_=!0,B=!1,R=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function Wi(){$=c.createBuffer({label:p.recordingChunkBuffer,size:C*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Xr(C*h,$),S=0,M=[],ue=null}async function zi(){let e=C*h;ce=[],q=[];for(let r=0;r<xe;r++){let t=c.createBuffer({label:`${p.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});ce.push(t),q.push(!0),await Xr(e,t)}}async function ha(){await _i()}async function Sa(){console.log("[GOLT worker] Building GPU resources",{cols:w,rows:A,bitsPerCell:k.bitsPerCell,recordingAvailable:oe()}),wt(),Ti(),await At(),It(),Gt(),Ft(),Lt(),Ot(),Dt(),await ha(),oe()?(await Wi(),await zi()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:h,maxRecordingBufferBytes:ir()}),Yr(),E=!1,U=!1),await Kr(),Ut(),console.log("[GOLT worker] GPU resources ready")}async function ya(){console.log("[GOLT worker] Rebuild started",{cols:w,rows:A,bitsPerCell:k.bitsPerCell}),P("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),R=!0,self.postMessage({type:"rebuilding",active:!0});try{await zt()}catch{console.warn("[GOLT worker] Queue idle wait rejected during rebuild")}let e=!_;if(_&&(e=await ga()),e){si(),wt(),Ti(),ai(oe());try{await At(),It(),Gt(),Lt(),Ot(),Ft(),Dt(),oe()?(await Wi(),await zi()):(Yr(),E=!1,U=!1),await Kr(),Ut()}catch(r){let t=r instanceof Error?r.message:String(r);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{si(),wt(),ai(!1),await At(),It(),Gt(),Lt(),Ot(),Ft(),Dt(),E=!1,U=!1,h=Qr(),Yr(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await Kr(),Ut()}catch(n){console.error("[GOLT worker] GPU rebuild recovery failed:",n),e=!1}}}return e&&(R=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:oe(),frameByteSize:h})),e}function ui(e){Ur=!0,c.queue.onSubmittedWorkDone().then(()=>{Ur=!1,e()}).catch(()=>{Ur=!1})}async function Ta(){K>0&&await new Promise(e=>{let r=setInterval(()=>{K===0&&(clearInterval(r),e())},10)})}async function Ca(e){console.log("[GOLT worker] Init message received",{cols:e.ruleset.cols,rows:e.ruleset.rows,recording:e.recording,running:e.running,speed:e.speed}),E=e.recording,Je=st(e.liveMetrics),U=E,$i(e.ruleset,e.simulationGridFormat),await Ni(e.canvas),await Sa(),Y(!0),Te(),B=e.running,J=e.speed<0?0:1e3/e.speed,B?ae():ur()}function va(e){Je=st(e.liveMetrics),Y(!0)}async function Ma(e){console.log("[GOLT worker] Ruleset update received",{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length});let r=Se();if(at(e.ruleset.tribes.length,e.ruleset,r))P("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),$i(e.ruleset,e.simulationGridFormat),await ya()&&(b=0,Jr(),await Mi(0),Y(!0),B?ae():ur());else{let i=`Requested ruleset requires at least ${en(e.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",i,{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length,maxBytes:r}),self.postMessage({type:"gpuError",reason:i})}}function xa(e){B=e.running,e.running?g||ae():g&&j(g)?Di(!1):g?P("manual"):(Q&&ie(),Ii(),ur())}function _a(e){let r=J<=0,t=e.speed<0?0:1e3/e.speed;J=t,g&&!j(g)&&B?(P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&t>0?ui(()=>{L(),ae()}):ae()):B&&!g?ae():r&&t>0&&ui(()=>{L(),ur()})}function Ra(e){di=e.scale,fi=e.offsetX,pi=e.offsetY,!g&&!R&&!_&&L()}function ka(e){he.width=e.width,he.height=e.height,!g&&!R&&!_&&L()}function Ba(e){let r=e.tribes.map(t=>Ee.get(t)).filter(t=>t!==void 0);if(r.length>0){let t={square:0,round:1,diamond:2,vline:3,hline:4},n={full:0,spray:1,outline:2};Lr={centerX:e.x,centerY:e.y,brushSize:e.size,shape:t[e.shape]??0,fill:n[e.fill]??0,tribeIds:r}}}function Pa(e){let r={square:0,round:1,diamond:2,vline:3,hline:4};mi={centerX:e.x,centerY:e.y,brushSize:e.size,shape:r[e.shape]??0,visible:e.visible},!g&&!R&&!_&&J<=0&&L()}function Ea(e){bi={originX:e.origin?.originX??0,originY:e.origin?.originY??0,visible:e.visible&&e.origin!==null},!g&&!R&&!_&&J<=0&&L()}async function wa(){try{let e=await Qo();ut({type:"snapshot",grid:e,generation:b,cols:w,rows:A,gridFormat:le()},[e.buffer])}catch{let e=new Uint32Array(0);ut({type:"snapshot",grid:e,generation:b,cols:w,rows:A,gridFormat:le()},[e.buffer])}}async function Aa(e){let r=fr(e.gridFormat),t=X();if(e.grid.byteLength===re(t,r)){let n=xr(e.grid,t,r,k);c.queue.writeBuffer(O?F:G,0,n),b=e.generation,Jr(),await Mi(e.generation)}}function Ia(e){let r=g?.request,t=oe();e.recording&&t&&!E?(E=!0,U=!0,Y(!0),Te()):(!e.recording||!t)&&(e.recording&&!t&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:h,maxRecordingBufferBytes:ir()}),E=!1,U=!1),r&&g?ca(r):!g&&B&&ae()}async function Ga(){er||(await zt(),ar(!1),S>0&&or(),K>0?er=!0:nr())}async function Fa(e){let r=qe(y),t=Mt(y,r,S,e.count);if(t){let n=O?F:G;if(t.source==="buffered"){let i=oi(M,t);S=i.chunkFrameIndex,M.length=S,b=i.generation,ue=b;let o=c.createCommandEncoder({label:p.recordingRestoreCopyEncoder});o.copyBufferToBuffer($,t.frameInChunk*h,n,0,h),c.queue.submit([o.finish()])}else{K>0&&(await Ta(),r=qe(y));let i=y[t.sealedIndex],o=await Ri(i.filename,i.codec),s=X(),a=fr(i.gridFormat),u=xt(o,t.frameInChunk,h,s,a,k);if(c.queue.writeBuffer($,0,u.chunkPrefix),!u.sameFormat&&u.activeFrame&&c.queue.writeBuffer(n,0,u.activeFrame),S=t.frameInChunk+1,M=i.generations.slice(0,t.frameInChunk+1),b=M[t.frameInChunk],ue=b,u.sameFormat){let m=c.createCommandEncoder({label:p.recordingRestoreCopyEncoder});m.copyBufferToBuffer($,t.frameInChunk*h,n,0,h),c.queue.submit([m.finish()])}let l=y.splice(t.sealedIndex);$t(l.map(m=>m.filename))}ze(Z,y,M),Te(),Jr(),Y(!0),L()}}function La(){Xt(),ar(!0),!E||Gi()?(aa(),Ae++,E&&tr()&&(S>=C&&or(),qt(b)),Ie(!1)):Ie(!0),Y(!0),L()}function Da(e){self.postMessage({type:"stepping",active:!0}),ar(!0),jt(Ht(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:b+e},restoreAfterStop:{running:B,targetStepDuration:J}})}function Oa(e){e.count===1?La():Da(e.count)}function Ua(){Di(g?.request.restoreAfterStop?.running??B)}function $a(e){let r=y.find(t=>t.filename===e.filename);r&&(r.codec=e.codec,r.storedBytes=e.storedBytes,r.gridFormat=e.gridFormat,Z.chunks=[...y],Te(),nr())}function Na(){let e=y.filter(r=>r.codec===me).map(r=>({filename:r.filename,rawBytes:r.uncompressedBytes,blockCount:r.blockCount,cols:w,rows:A,rawGridFormat:r.gridFormat,storageGridFormat:Fe(dr(Hr.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:e})}async function Wa(e){switch(e.type){case"init":await Ca(e);break;case"setLiveMetrics":va(e);break;case"setRuleset":await Ma(e);break;case"setRunning":xa(e);break;case"setSpeed":_a(e);break;case"camera":Ra(e);break;case"resize":ka(e);break;case"draw":Ba(e);break;case"brushPreview":Pa(e);break;case"exportFrameOverlay":Ea(e);break;case"getSnapshot":await wa();break;case"loadSnapshot":await Aa(e);break;case"setRecording":Ia(e);break;case"getRecording":await Ga();break;case"stepBack":await Fa(e);break;case"stepForward":Oa(e);break;case"cancelStepping":Ua();break;case"updateChunkCodec":$a(e);break;case"getUncompressedChunks":Na();break}}self.onmessage=async e=>{await Wa(e.data)};
