var bn="goltTimestampedConsoleInstalled";function Ti(){let e=globalThis;e[bn]||(e[bn]=!0,pt("info"),pt("warn"),pt("error"),console.log=console.info.bind(console))}function pt(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}Ti();var gn=`// Render shader: draws the grid as a full-screen quad.\r
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
`;function Sn(e){return Math.min(Math.max(1,Math.floor(+e||1)),100)}var mt=[1,2,4,8,16,32],Ci={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Mi={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Ri={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Ar={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},vi={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},bt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},te={1:Ci,2:Mi,4:Ri,8:Ar,16:vi,32:bt};function yn(e){return mt.includes(e)}function Bi(e){return 2**e}function gt(e,r){return r<=Bi(e)}function ht(e,r,t){return ne(e,r)<=t}function Ir(e){return e<=2?te[1]:e<=4?te[2]:e<=16?te[4]:e<=256?te[8]:e<=65536?te[16]:te[32]}function Tn(e){return Ir(e)}function er(e){return te[e]}function _n(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){return St(e,r,t)??bt}function St(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of mt){let o=er(n);if(gt(n,e)&&ht(r,o,t))return o}return null}function Gr(e){return er(e?.bitsPerCell??8)}function rr(e){return{bitsPerCell:e.bitsPerCell}}function be(e,r){return Math.ceil(e/r.cellsPerWord)}function ne(e,r){return be(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function xn(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}var tr={population:!0,diversity:!0,interfaces:!1},Dr={enabled:!0,sections:tr};function Ei(e){return{population:typeof e?.population=="boolean"?e.population:tr.population,diversity:typeof e?.diversity=="boolean"?e.diversity:tr.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:tr.interfaces}}function yt(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Dr.enabled,sections:Ei(e?.sections)}}var C="dead";var Cn="toroidal",B="bounded";var Mn=42,Rn=1,Tt=4294967295,vn=100,_t=0,Lr=100,nr=1e3,Xs=_t*nr,qs=Lr*nr,or="empty",Bn="is",ve="comparison",Be="count",Ee="none",Pe="exactly",ke="min",we="max",Ae="not",Ie="and",Ge="or",De="xor";var xt={kind:or};function Rt(e){let r=typeof e=="number"&&Number.isFinite(e)?e:Mn;return Math.max(Rn,Math.min(Tt,Math.trunc(r)))}function he(e){let r=typeof e=="number"&&Number.isFinite(e)?e:vn,t=Math.round(r*nr)/nr;return Math.max(_t,Math.min(Lr,t))}function En(e){return Math.floor(he(e)/Lr*Tt)}function Pi(e){let r;return typeof e=="string"?r=Pn([e]):r=w(e),r}function Pn(e){return{kind:"tribes",tribes:[...e&&e.length>0?e:[C]]}}function w(e,r){let t=e??Pn(r),n;switch(t.kind){case"tribes":n={...t,tribes:[...t.tribes]};break;case"tiedMajority":n={...t,source:w(t.source)};break;default:n={...t};break}return n}function ge(e,r){return{kind:"count",selector:w(e?.selector,r)}}function Or(e){return JSON.stringify(ie(e))}function ie(e){let r;switch(e.kind){case"tribes":r={...e,tribes:[...new Set(e.tribes)].sort()};break;case"tiedMajority":r={...e,source:ie(e.source)};break;default:r=e;break}return r}function Ct(e){switch(e.kind){case or:return xt;case Be:case Ee:case Pe:case ke:case we:return{...e,selector:w(e.selector,e.tribes)};case ve:return{...e,left:ge(e.left,e.tribe1),right:ge(e.right,e.tribe2),margin:e.margin??0};case Ae:return{...e,clause:Ct(e.clause)};case Ie:case Ge:case De:{let r=e.clauses.map(t=>Ct(t));for(;r.length<2;)r.push(xt);return{...e,clauses:r}}default:return e}}function Mt(e){let r=Ct(e);switch(r.kind){case Be:case Ee:case Pe:case ke:case we:{let t=structuredClone(r);return delete t.tribes,t}case ve:{let t=structuredClone(r);return delete t.tribe1,delete t.tribe2,t}case Ae:return{...r,clause:Mt(r.clause)};case Ie:case Ge:case De:return{...r,clauses:r.clauses.map(t=>Mt(t))};default:return r}}function ir(e){return e.become??{kind:"fixed",tribe:e.tribe??C}}function oe(e){let r;switch(e.kind){case"majority":case"minority":r={...e,selector:w(e.selector),tie:e.tie?oe(e.tie):void 0,fallback:e.fallback?oe(e.fallback):void 0};break;case"combine":r={kind:"combine",strategy:{...e.strategy,entries:e.strategy.entries.map(t=>({...t,inputs:t.inputs.map(n=>Pi(n)).sort((n,o)=>Or(n).localeCompare(Or(o)))})),default:e.strategy.default?oe(e.strategy.default):void 0}};break;default:r={...e};break}return r}function ki(e){let r=structuredClone(e);return r.become=oe(ir(e)),r.probability=he(e.probability),r}function kn(e){return{...e,randomSeed:Rt(e.randomSeed),rules:e.rules.map(r=>wi(r))}}function wi(e){let r=ki(e);return r.clause=Mt(r.clause),delete r.key,delete r.tribe,r.muted=!!r.muted,r.probability=he(r.probability),r}function vt(e,r){self.postMessage(e,r)}async function wn(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var d={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",recordingStepBatchEncoder:"recording step batch encoder",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",simulationBindGroupAtoB:"simulation bind group A to B",simulationBindGroupBtoA:"simulation bind group B to A",simulationParameterBuffer:"simulation parameter buffer",simulationParameterBindGroup:"simulation parameter bind group",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var An=4294967295;function Bt(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function W(e,r){return e.includes(r)}function In(e,r,t,n){let o=e*r,i=o<=An,s=o*2<=An;return{population:Bt(t&&n.population,i),diversity:Bt(t&&n.diversity,i),interfaces:Bt(t&&n.interfaces,s)}}function Gn(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var Le=256*Uint32Array.BYTES_PER_ELEMENT,Oe=Uint32Array.BYTES_PER_ELEMENT;function Dn(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function Ln(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function On(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function Ai(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:o}=e;return`
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
${Dn(o)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Ln(o)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${On(o)}
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
`}function Ii(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:o}=e;return`
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
${Dn(o)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Ln(o)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${On(o)}
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
`}function Gi(e,r){let{tribes:t,deadTribeIndex:n,readback:o,cols:i,rows:s}=e,a=i*s,l={};for(let f=0;f<t.length;f++){let p=r?o.histogram[f]??0:0;l[t[f].id]=p}let u=r?l[t[n]?.id??""]??0:0;return{population:l,aliveCells:r?Math.max(0,a-u):0,deadCells:u}}function Di(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,o=0;for(let i=0;i<r.length;i++)i!==t&&(o+=n.histogram[i]??0);return o}function Li(e,r){let{tribes:t,deadTribeIndex:n,readback:o}=e,i=r?Di(e):0,s=0,a=0;for(let l=0;l<t.length;l++){let u=l!==n&&i>0?(o.histogram[l]??0)/i:0;u>0&&(s-=u*Math.log2(u),a+=u*u)}return{shannonEntropy:s,simpsonSum:a}}function Oi(e,r){let t=e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,o=r?Math.max(0,t-n):0;return{sameStateContactEdges:o,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?o/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function Fn(e){let{device:r}=e,t=r.createShaderModule({label:d.histogramMetricsShaderModule,code:Ai(e)}),n=r.createComputePipeline({label:d.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),o=r.createBuffer({label:d.histogramMetricsBuffer,size:Le,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),i=r.createBuffer({label:d.histogramMetricsReadBuffer,size:Le,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=r.createShaderModule({label:d.interfaceMetricsShaderModule,code:Ii(e)}),a=r.createComputePipeline({label:d.interfaceMetricsPipeline,layout:"auto",compute:{module:s,entryPoint:"main"}}),l=r.createBuffer({label:d.interfaceMetricsBuffer,size:Oe,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),u=r.createBuffer({label:d.interfaceMetricsReadBuffer,size:Oe,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:o,histogramReadBuffer:i,boundaryPipeline:a,boundaryBuffer:l,boundaryReadBuffer:u}}function Un(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function Nn(e){let{device:r,encoder:t,resources:n,sourceBuffer:o,dispatchPlan:i,enabledSections:s}=e;if(W(s,"population")||W(s,"diversity")){let a=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,a);let l=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),u=t.beginComputePass({label:d.histogramMetricsPass});u.setPipeline(n.histogramPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(i.dispatchWgX,i.dispatchWgY),u.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Le)}if(W(s,"interfaces")){let a=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,a);let l=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),u=t.beginComputePass({label:d.interfaceMetricsPass});u.setPipeline(n.boundaryPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(i.dispatchWgX,i.dispatchWgY),u.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Oe)}}async function $n(e){let{resources:r,enabledSections:t}=e,n=W(t,"population")||W(t,"diversity"),o=W(t,"interfaces"),i=[];n&&i.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),o&&i.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(i);let s=new Uint32Array(256);n&&(s=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let a=0;if(o){let l=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),a=l[0]??0}return{histogram:s,crossStateContactEdges:a}}function Wn(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:o,cols:i,rows:s,totalFrames:a,fps:l,canStepBack:u,recordingBytes:f,recordingRawBytes:p}=e,m=W(t,"population")&&o.population,_=W(t,"diversity")&&o.diversity,O=W(t,"interfaces")&&o.interfaces,y=i*s,re=Gi(e,m),me=Li(e,_),yi=Oi(e,O);return{type:"metrics",generation:r,population:re.population,aliveCells:re.aliveCells,deadCells:re.deadCells,occupancy:m&&y>0?re.aliveCells/y:0,shannonEntropy:me.shannonEntropy,simpsonIndex:_?1-me.simpsonSum:0,interfaces:yi,metricsAvailability:n,extinctionTime:{},totalFrames:a,fps:l,canStepBack:u,recordingBytes:f,recordingRawBytes:p}}function Fi(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}function zn(e,r,t,n,o){let i=be(r.cols,t),s=e[o*i+(n>>t.wordShift)]??0;return Fi(s,t,n&t.cellIndexMask)}function Yn(e,r,t,n,o,i){let s=be(r.cols,t),a=o*s+(n>>t.wordShift),l=(n&t.cellIndexMask)<<t.cellShift,u=~(t.cellMask<<l),f=e[a]??0;e[a]=(f&u|(i&t.cellMask)<<l)>>>0}var Ui=64*1024*1024,Cu=256*1024*1024;function Fr(e,r,t,n){let o=e,i;if(t.bitsPerCell===n.bitsPerCell)i=e;else{i=new Uint32Array(ne(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let s=0;s<r.rows;s++)for(let a=0;a<r.cols;a++)Yn(i,r,n,a,s,zn(o,r,t,a,s))}return i}function Ni(e,r,t){let n=Math.floor((r-1)/2),o=e-n,i=o+r,s=[];if(o>=0&&i<=t)s.push({destinationStart:o,localStart:0,span:r});else if(o<0){let a=-o;s.push({destinationStart:t-a,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:r-a})}else{let a=t-o;s.push({destinationStart:o,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:i-t})}return s.filter(a=>a.span>0)}function $i(e,r,t){let n=e-Math.floor((r-1)/2),o=Math.max(0,n),i=Math.min(t,n+r),s=Math.max(0,i-o),a=[];return s>0&&a.push({destinationStart:o,localStart:o-n,span:s}),a}function Xn(e){return`
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
`}function qn(e,r,t,n,o){let i=o===B?$i:Ni,s=i(e,t,n.cols),a=i(r,t,n.rows),l=[];for(let u of a)for(let f of s)l.push({destinationStartX:f.destinationStart,destinationStartY:u.destinationStart,localStartX:f.localStart,localStartY:u.localStart,spanCols:f.span,spanRows:u.span});return l}var Kn={"=":"==","\u2260":"!=",">":">","<":"<","\u2265":">=","\u2264":"<="};function Wi(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function zi(e,r){e.push(`const CELLS_PER_WORD: u32 = ${r.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${r.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${r.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${r.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${r.cellMask}u;`)}function Yi(e){e.push("struct SimulationParams {"),e.push("  generation: u32,"),e.push("  _pad0: u32,"),e.push("  _pad1: u32,"),e.push("  _pad2: u32,"),e.push("};"),e.push("@group(1) @binding(0) var<uniform> simulationParams: SimulationParams;"),e.push(""),e.push("fn probabilityHash(x: u32, y: u32, generation: u32, ruleIndex: u32, randomSeed: u32) -> u32 {"),e.push("  var h = x * 0x9e3779b9u;"),e.push("  h = h ^ (y * 0x85ebca6bu);"),e.push("  h = h ^ (generation * 0xc2b2ae35u);"),e.push("  h = h ^ (ruleIndex * 0x27d4eb2fu);"),e.push("  h = h ^ randomSeed;"),e.push("  h = (h ^ (h >> 16u)) * 0x7feb352du;"),e.push("  h = (h ^ (h >> 15u)) * 0x846ca68bu;"),e.push("  return h ^ (h >> 16u);"),e.push("}")}function Xi(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function qi(e,r){e.push("fn readBoundedCell(x: i32, y: i32) -> u32 {"),e.push("  if (x < 0i || y < 0i || x >= i32(COLS) || y >= i32(ROWS)) {"),e.push(`    return ${r}u;`),e.push("  }"),e.push("  return readCell(u32(x), u32(y));"),e.push("}")}function Ki(e,r,t){r.remapped?(e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;")):(e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;"))}function Hi(e){let r=ua(e),t=new Map,n=0;for(let o of r)t.set(o,`count_${n++}`);return t}function Vi(e,r){let t=la(e),n=new Map,o=0;for(let i of t){let s=r.get(i);s?n.set(i,s):n.set(i,`eq_count_${o++}`)}return n}function ji(e,r,t,n){for(let[o,i]of r)e.push(`  let ${i} = ${Pt(ro(o),t,n)};`);r.size>0&&e.push("")}function Zi(e,r,t,n,o){let i=0;for(let[s,a]of t)r.has(s)||(e.push(`  let ${a} = ${Pt(ro(s),n,o)};`),i++);i>0&&e.push("")}function Qi(e,r,t,n,o,i,s){s?ea(e,r,t,n,o,i):Ji(e,r,t,n,o,i)}function Ji(e,r,t,n,o,i){for(let s=0;s<r.length;s++){let{rule:a}=r[s],l=Fe(a.clause,t,n,o,i);e.push(s===0?`  if (${l}) {`:`  } else if (${l}) {`),sr(e,oe(ir(a)),o,i,`rule_${s}`,"    ")}r.length>0&&e.push("  }"),e.push("")}function ea(e,r,t,n,o,i){e.push("  var applied = false;");for(let s=0;s<r.length;s++){let a=r[s],{rule:l,probability:u,priorityIndex:f}=a,p=Fe(l.clause,t,n,o,i);e.push(`  if (!applied && ${p}) {`),u===100?(sr(e,oe(ir(l)),o,i,`rule_${s}`,"    "),e.push("    applied = true;")):(e.push(`    if (probabilityHash(x, y, generation, ${f}u, RANDOM_SEED) < ${En(u)}u) {`),sr(e,oe(ir(l)),o,i,`rule_${s}`,"      "),e.push("      applied = true;"),e.push("    }")),e.push("  }")}e.push("")}function sr(e,r,t,n,o,i,s=null){switch(r.kind){case"fixed":e.push(`${i}result = ${z(r.tribe,n)}u;`);break;case"same":e.push(`${i}result = selfTribe;`);break;case"majority":case"minority":ra(e,r,t,n,o,i);break;case"combine":ta(e,r,t,n,o,i,s);break}}function ra(e,r,t,n,o,i){let s=w(r.selector),a=`${o}_${r.kind}`,l=`${o}_${r.kind}_count`,u=`${o}_${r.kind}_ties`,f=r.kind==="majority"?"0u":"9u",p=r.kind==="majority"?`candidateCount > ${l}`:`candidateCount < ${l}`;e.push(`${i}var ${a}: u32 = ${z(C,n)}u;`),e.push(`${i}var ${l}: u32 = ${f};`),e.push(`${i}var ${u}: u32 = 0u;`);for(let m of $r(s,t,n)){let _=V(y=>`${y} == ${m}u`),O=Ue(s,m,n);e.push(`${i}{`),e.push(`${i}  let candidateCount = ${_};`),e.push(`${i}  if (${O} && candidateCount > 0u) {`),e.push(`${i}    if (${p}) {`),e.push(`${i}      ${a} = ${m}u;`),e.push(`${i}      ${l} = candidateCount;`),e.push(`${i}      ${u} = 1u;`),e.push(`${i}    } else if (candidateCount == ${l}) {`),e.push(`${i}      ${u} = ${u} + 1u;`),e.push(`${i}    }`),e.push(`${i}  }`),e.push(`${i}}`)}e.push(`${i}if (${u} == 1u) {`),e.push(`${i}  result = ${a};`),e.push(`${i}} else if (${u} > 1u) {`),r.tie?sr(e,r.tie,t,n,`${o}_tie`,`${i}  `,{selector:s,bestCountVar:l,tieCountVar:u}):Nr(e,r.fallback,t,n,`${o}_tie_fallback`,`${i}  `),e.push(`${i}} else {`),Nr(e,r.fallback,t,n,`${o}_fallback`,`${i}  `),e.push(`${i}}`)}function Nr(e,r,t,n,o,i){r?sr(e,r,t,n,o,i):e.push(`${i}result = ${z(C,n)}u;`)}function ta(e,r,t,n,o,i,s){let a=`${o}_input_mask`;e.push(`${i}var ${a}: u32 = 0u;`);for(let p of ia(t,n,s)){let m=Qn(p,n,s);e.push(`${i}if (${m}) {`),e.push(`${i}  ${a} = ${a} | ${Jn(p)};`),e.push(`${i}}`)}let l=`${o}_dead_present`,u=V(p=>`${p} == ${z(C,n)}u`);e.push(`${i}let ${l} = ${u} > 0u;`);let f=[...r.strategy.entries].sort((p,m)=>Number(Et(m,n))-Number(Et(p,n)));f.forEach((p,m)=>{let _=aa(p.inputs,t,n,s),O=Et(p,n)?` && ${l}`:"",y=`${a} == (${_})${O}`;e.push(m===0?`${i}if (${y}) {`:`${i}} else if (${y}) {`),e.push(`${i}  result = ${z(p.output,n)}u;`)}),f.length>0?(e.push(`${i}} else {`),Nr(e,r.strategy.default,t,n,`${o}_fallback`,`${i}  `),e.push(`${i}}`)):Nr(e,r.strategy.default,t,n,`${o}_fallback`,i)}function Hn(e){for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(`    var ${kt(t,r)}: u32;`)}function Ur(e,r,t){for(let n=-1;n<=1;n++)for(let o=-1;o<=1;o++)if(!(o===0&&n===0)){let i=kt(o,n),s;r==="toroidal"?s=`readCell(${Vn("x",o,"COLS")}, ${Vn("y",n,"ROWS")})`:r==="boundedDirect"?s=`readCell(${jn("x",o)}, ${jn("y",n)})`:s=`readBoundedCell(${Zn("x",o)}, ${Zn("y",n)})`,e.push(`${t}${i} = ${s};`)}}function Pt(e,r,t){let n=ie(e),o;switch(n.kind){case"same":o=V(i=>`${i} == selfTribe`);break;case"different":o=V(i=>`${i} != selfTribe`);break;case"tiedMajority":o=Pt(n.source,r,t);break;case"tribes":{let i=ur(n.tribes,t);o=i.length===0?"0u":V(s=>i.map(a=>`${s} == ${a}u`).join(" || "));break}}return o}function V(e){return na().map(r=>`select(0u, 1u, ${e(r)})`).join(" + ")}function kt(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function na(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(kt(t,r));return e}function Vn(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function jn(e,r){let t=e;return r===-1?t=`${e} - 1u`:r===1&&(t=`${e} + 1u`),t}function Zn(e,r){let t=`i32(${e})`;return r===-1?t=`i32(${e}) - 1i`:r===1&&(t=`i32(${e}) + 1i`),t}function ur(e,r){let t=[];for(let n of e)t.push(lr(n,r,"selector"));return[...new Set(t)]}function z(e,r){return lr(e,r,"target")}function lr(e,r,t){let n=r.get(e),o=r.get(C)??0;return n===void 0&&console.error(`Unknown rule ${t} tribe; using dead tribe instead.`,{tribe:e}),n??o}function $r(e,r,t){let n=ie(e),o;switch(n.kind){case"tribes":o=ur(n.tribes,t);break;case"tiedMajority":o=$r(n.source,r,t);break;default:o=r.map(i=>lr(i.id,t,"selector"));break}return[...new Set(o)].sort((i,s)=>i-s)}function Ue(e,r,t){let n=ie(e),o;switch(n.kind){case"same":o=`selfTribe == ${r}u`;break;case"different":o=`selfTribe != ${r}u`;break;case"tiedMajority":o=Ue(n.source,r,t);break;case"tribes":{o=ur(n.tribes,t).includes(r)?"true":"false";break}}return o}function oa(e,r,t,n){let o=ie(e),i;if(o.kind==="tiedMajority"&&n){let s=V(l=>`${l} == ${r}u`),a=Ue(n.selector,r,t);i=`(${n.tieCountVar} > 1u && ${n.bestCountVar} > 0u && ${a} && ${s} == ${n.bestCountVar})`}else{let s=V(l=>`${l} == ${r}u`);i=`(${Ue(o.kind==="tiedMajority"?o.source:o,r,t)} && ${s} > 0u)`}return i}function ia(e,r,t){let n;return t?n=$r(t.selector,e,r):n=e.map(o=>lr(o.id,r,"selector")),[...new Set(n)].filter(o=>o!==z(C,r)).sort((o,i)=>o-i)}function Qn(e,r,t){let n;if(t){let o=V(s=>`${s} == ${e}u`),i=Ue(t.selector,e,r);n=`(${e}u != ${z(C,r)}u && ${t.tieCountVar} > 1u && ${t.bestCountVar} > 0u && ${i} && ${o} == ${t.bestCountVar})`}else{let o=V(i=>`${i} == ${e}u`);n=`(${e}u != ${z(C,r)}u && ${o} > 0u)`}return n}function aa(e,r,t,n){let o=[];for(let i of e){let s=w(i);for(let a of $r(s,r,t))if(a!==z(C,t)){let l=sa(s,a,t,n);o.push(`select(0u, ${Jn(a)}, ${l})`)}}return o.length>0?o.join(" | "):"0u"}function Et(e,r){let t=z(C,r);return e.inputs.some(n=>{let o=w(n);return o.kind==="tribes"&&ur(o.tribes,r).includes(t)})}function sa(e,r,t,n){let o=ie(e),i;if(n){let s=Qn(r,t,n),a=Ue(o.kind==="tiedMajority"?o.source:o,r,t);i=`(${s} && ${a})`}else i=oa(o,r,t,null);return i}function Jn(e){return`(1u << ${e}u)`}function eo(e){return Or(e)}function ro(e){return JSON.parse(e)}function to(e,r){let t=new Set,n=i=>{t.add(eo(i))},o=i=>{switch(r(i,n),i.kind){case Ae:o(i.clause);break;case Ie:case Ge:case De:for(let s of i.clauses)o(s);break}};for(let i of e)o(i);return t}function ua(e){return to(e,(r,t)=>{switch(r.kind){case Ee:case Pe:case ke:case we:case Be:t(w(r.selector,r.tribes));break}})}function la(e){return to(e,(r,t)=>{r.kind===ve&&(t(ge(r.left,r.tribe1).selector),t(ge(r.right,r.tribe2).selector))})}function Fe(e,r,t,n,o){switch(e.kind){case or:return"false";case Bn:return ca(e.tribes,n,o);case Be:return ar(Se(w(e.selector,e.tribes),r),e.interval[0],e.interval[1]);case Ee:return ar(Se(w(e.selector,e.tribes),r),0,0);case Pe:return ar(Se(w(e.selector,e.tribes),r),e.value,e.value);case ke:return ar(Se(w(e.selector,e.tribes),r),e.value,8);case we:return ar(Se(w(e.selector,e.tribes),r),0,e.value);case ve:return da(e,t);case Ae:return`!(${Fe(e.clause,r,t,n,o)})`;case Ie:return`(${e.clauses.map(i=>Fe(i,r,t,n,o)).join(" && ")})`;case Ge:return`(${e.clauses.map(i=>Fe(i,r,t,n,o)).join(" || ")})`;case De:return fa(e.clauses,r,t,n,o);default:return"false"}}function ca(e,r,t){let n=ur(e,t);return n.length===0?"false":n.length===r.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}function ar(e,r,t){return`(${e} >= ${r}u && ${e} <= ${t}u)`}function da(e,r){let t=ge(e.left,e.tribe1).selector,n=ge(e.right,e.tribe2).selector,o=Kn[e.operator]??"==",i=Math.max(-8,Math.min(8,e.margin??0));return`(i32(${Se(t,r)}) ${o} (i32(${Se(n,r)}) + ${i}i))`}function fa(e,r,t,n,o){return`(((${e.map(i=>Fe(i,r,t,n,o)).map(i=>`select(0u, 1u, ${i})`).join(" + ")}) & 1u) == 1u)`}function Se(e,r){return r.get(eo(e))}function wt(e,r,t){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,o=Math.min(n,t),i=Math.ceil(n/o);if(i<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:o,dispatchWgY:i,remapped:!0};throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`)}function no(e,r,t,n,o,i,s){let a=[],l=e.rules.map((y,re)=>({rule:y,priorityIndex:re,probability:he(y.probability)})).filter(y=>!y.rule.muted&&y.probability>0),u=l.some(y=>y.probability>0&&y.probability<100),f=s.get(C)??0,p=e.topology===B,m=lr(e.boundaryTribe??C,s,"boundary"),_=Hi(l.map(y=>y.rule.clause)),O=Vi(l.map(y=>y.rule.clause),_);return a.push("// Auto-generated simulation compute shader."),a.push(`// Tribes: ${r.map(y=>y.id).join(", ")}`),a.push(`// Rules: ${e.rules.length}`),a.push(""),a.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),a.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),u&&(a.push(""),Yi(a)),a.push(""),a.push(`const COLS: u32 = ${n.cols}u;`),a.push(`const ROWS: u32 = ${n.rows}u;`),a.push(`const PACKED_COLS: u32 = ${t}u;`),u&&a.push(`const RANDOM_SEED: u32 = ${Rt(e.randomSeed)}u;`),Wi(a,o),zi(a,i),a.push(""),Xi(a,"gridIn","PACKED_COLS"),p&&(a.push(""),qi(a,m)),a.push(""),u?a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32, x: u32, y: u32, generation: u32) -> u32 {"):a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {"),ji(a,_,r,s),Zi(a,_,O,r,s),a.push(`  var result: u32 = ${f}u;`),a.push(""),Qi(a,l,_,O,r,s,u),a.push("  return result;"),a.push("}"),a.push(""),a.push("@compute @workgroup_size(16, 16)"),o.remapped?a.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):a.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),Ki(a,o,"px"),a.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),a.push(""),a.push("  let baseX = px << WORD_SHIFT;"),p&&a.push("  let interiorPackedWord = y > 0u && y + 1u < ROWS && baseX > 0u && baseX + CELLS_PER_WORD < COLS;"),a.push("  var packed: u32 = 0u;"),a.push(""),a.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),a.push("    let x = baseX + i;"),a.push("    if (x >= COLS) { break; }"),a.push(""),a.push("    let selfTribe = readCell(x, y);"),p?(Hn(a),a.push("    if (interiorPackedWord) {"),Ur(a,"boundedDirect","      "),a.push("    } else {"),a.push("      let interiorCell = x > 0u && y > 0u && x + 1u < COLS && y + 1u < ROWS;"),a.push("      if (interiorCell) {"),Ur(a,"boundedDirect","        "),a.push("      } else {"),Ur(a,"boundedVirtual","        "),a.push("      }"),a.push("    }")):(Hn(a),Ur(a,"toroidal","    ")),a.push(""),u?a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR, x, y, simulationParams.generation) & CELL_MASK) << (i << CELL_SHIFT));"):a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),a.push("  }"),a.push(""),a.push("  gridOut[y * PACKED_COLS + px] = packed;"),a.push("}"),a.join(`
`)}var Ne=3,cr="gol-recording",ye="raw-packed",At="deflate-raw",It=12,Gt=256*1024*1024,oo=512*1024*1024;function Dt(e,r,t=0){let n=t;for(let o of e)n+=o[r];return n}function io(e,r){return Math.min(e,r)}function Lt(e){return Math.min(e,1073741824)}function ao(e){return Math.min(e,oo)}function Ot(e,r){return Math.max(e*2,r*6)}function Wr(e,r){return e>0&&e<=r}function ba(e,r){return e>0?e*2+r:0}function ga(e,r){return e>=1&&r>0?e*r*(1+Ne):0}function ha(e,r){return e<Gt?Math.min(Gt,r):e}function so(e,r){return Wr(e,r)?Math.max(1,Math.floor(ha(e,r)/e)):0}function zr(e,r){return e>=1&&r>0?Math.max(1,Math.min(It,Math.floor(536870912/(e*r)))):It}function uo(e,r,t,n,o,i){let s=!r.some(l=>l)&&(o||i>=e),a=o?Math.floor(n/2)+1:n;return e>=1&&r.length>0&&(s||t>=a)}function lo(e,r,t,n){return e<r&&n.some((o,i)=>t[i]&&o.mapState==="unmapped")}function co(e,r,t,n,o,i){return e&&r>=1&&t!==null&&n.length>0&&(o<r||i)}function fo(e,r,t,n){let o=e.quota??0,i=e.usage??0,s=0,a=0;for(let f of r)f.codec===ye?s+=f.storedBytes:a+=f.storedBytes;let l=t*n,u=(1+Ne)*l;return{quotaBytes:o,usedBytes:i,pendingRawBytes:s,compressedBytes:a,reservedBytes:u}}function po(e,r,t,n,o){let i=Lt(e);return{maxBytes:e,vramBudgetBytes:Ot(e,i),frameByteSize:r,recordingAvailable:Wr(r,i),vramSimulationBytes:ba(r,n),vramRecordingBytes:ga(t,r),gridFormat:o}}function dr(e,r,t){r.length>0&&(e.generationStart=r[0].generationStart,e.generationEnd=r[r.length-1].generationEnd),t.length>0&&(r.length===0&&(e.generationStart=t[0]),e.generationEnd=t[t.length-1]),e.chunks=[...r]}function mo(e){return e.map(r=>({...r,generations:[...r.generations]}))}function bo(e,r){return e!==r}function fr(e,r=0){return Dt(e,"blockCount",r)}function go(e){return Dt(e,"storedBytes")}function ho(e){return Dt(e,"uncompressedBytes")}var Sa=256,pr=96,So=Sa*Uint32Array.BYTES_PER_ELEMENT;function ya(e){return e===B?"  return i32(cell) - center;":"  return signedWrapDelta(cell, center, size);"}function Ta(e){return e===B?"  return world - f32(center);":"  return signedWrapWorldDelta(world, center, size);"}function _a(e){return e===B?`  let ix = min(u.grid_size.x - 1u, u.offset_cell.x + u32(local.x));
  let iy = min(u.grid_size.y - 1u, u.offset_cell.y + u32(local.y));`:`  let ix = wrapAdd(u.offset_cell.x, u32(local.x), u.grid_size.x);
  let iy = wrapAdd(u.offset_cell.y, u32(local.y), u.grid_size.y);`}function xa(e){return`  if (u.export_visible == 1u) {
    if (exportCenterMarkerMask(local) || ${e===B?"exportBoundedCornerMarkerMask(local)":"exportOriginMarkerMask(local)"}) {
      return vec4f(0.0, 0.0, 0.0, 1.0);
    }

    if (exportCenterMarkerOutlineMask(local) || ${e===B?"exportBoundedCornerMarkerOutlineMask(local)":"exportOriginMarkerOutlineMask(local)"}) {
      return vec4f(0.82, 0.84, 0.86, 1.0);
    }
  }`}function yo(e){let r=new ArrayBuffer(pr),t=new Float32Array(r),n=new Int32Array(r),o=new Uint32Array(r),i=e.topology===B?e.offsetX:(e.offsetX%e.grid.cols+e.grid.cols)%e.grid.cols,s=e.topology===B?e.offsetY:(e.offsetY%e.grid.rows+e.grid.rows)%e.grid.rows,a=Math.floor(i),l=Math.floor(s);return t[0]=e.canvasWidth,t[1]=e.canvasHeight,t[2]=e.scale,t[4]=i-a,t[5]=s-l,o[6]=e.grid.cols,o[7]=e.grid.rows,o[8]=a,o[9]=l,o[10]=e.tribeCount,n[12]=e.brushPreview.centerX,n[13]=e.brushPreview.centerY,o[14]=e.brushPreview.brushSize,o[15]=e.brushPreview.shape,o[16]=e.brushPreview.visible?1:0,o[17]=e.exportFrameOverlay.originX,o[18]=e.exportFrameOverlay.originY,o[19]=e.exportFrameOverlay.visible?1:0,o[20]=e.topology===B?1:0,r}function To(e){let r=new Uint32Array(e.length);for(let t=0;t<e.length;t++){let n=e[t].color,o=parseInt(n.substring(0,2),16),i=parseInt(n.substring(2,4),16),s=parseInt(n.substring(4,6),16);r[t]=o|i<<8|s<<16}return r}function _o(e,r,t){return e.replace("__CELLS_PER_WORD__",`${r.cellsPerWord}u`).replace("__WORD_SHIFT__",`${r.wordShift}u`).replace("__CELL_SHIFT__",`${r.cellShift}u`).replace("__CELL_INDEX_MASK__",`${r.cellIndexMask}u`).replace("__CELL_MASK__",`${r.cellMask}u`).replace("__SIGNED_GRID_DELTA_BODY__",ya(t)).replace("__SIGNED_GRID_WORLD_DELTA_BODY__",Ta(t)).replace("__GRID_COORDINATE_ASSIGNMENTS__",_a(t)).replace("__EXPORT_OVERLAY_BLOCK__",xa(t))}var Ca=500,Ma=33,Ra=2,va=.5,xo=.2,Co=1,Ba=1048576;function Mo(e){return Math.min(3,Math.max(0,Math.ceil(Math.log10(e.cols*e.rows/1e5))))}function mr(e){return 1024/4**Mo(e)}function Yr(e){return 16/2**Mo(e)}function Ea(e){return Math.max(Co,Math.round(mr(e)*Yr(e)))}function Ro(e,r){return{generationsPerDrain:Ea(e),targetDrainMs:r.kind==="max"?Ca:Ma,smoothedDrainMs:0,lastDrainStartedAt:0,lastSubmittedGenerations:0}}function vo(e,r){if(r>0&&e.lastSubmittedGenerations>0){let t=e.smoothedDrainMs===0?r:e.smoothedDrainMs*(1-xo)+r*xo,n=Math.min(Ra,Math.max(va,e.targetDrainMs/t));e.smoothedDrainMs=t,e.generationsPerDrain=Math.max(Co,Math.min(Ba,Math.round(e.generationsPerDrain*n)))}}function Ft(e,r){return e==="recording"?Number.MAX_SAFE_INTEGER:mr(r)*Yr(r)}function Ut(e,r,t,n,o){let i=e-r*n;return t>n||t>o?Math.min(i,r):i}function Bo(e){return e<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/e}}function j(e){return e.request.stopCondition.kind==="targetGeneration"}function $e(e,r){return e.request.stopCondition.kind==="targetGeneration"&&r>=e.request.stopCondition.generation}function Z(e,r){return e.request.stopCondition.kind==="targetGeneration"?Math.max(0,e.request.stopCondition.generation-r):Number.POSITIVE_INFINITY}function Eo(e,r){return r.restore!==!1&&e.request.restoreAfterStop||null}function Po(e,r,t){return r&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")}function ko(e,r,t,n,o){return e.restartRestoredRun!==!1&&r&&t&&!n&&!o}function Nt(e,r,t,n){let o=r+t,i=Math.min(n,o-1);if(i<=0)return null;let s=o-1-i;if(s>=r)return{source:"buffered",frameInChunk:s-r};let a=0;for(let l=0;l<e.length;l++){let u=e[l];if(s<a+u.blockCount)return{source:"sealed",sealedIndex:l,frameInChunk:s-a};a+=u.blockCount}return null}function wo(e,r){return{chunkFrameIndex:r.frameInChunk+1,generation:e[r.frameInChunk]}}function $t(e,r,t,n,o,i){let s=(r+1)*t;if(o.bitsPerCell===i.bitsPerCell)return{sameFormat:!0,chunkPrefix:new Uint8Array(e,0,s),activeFrame:null};let a=ne(n,o),l=new Uint8Array(s);for(let u=0;u<=r;u++){let f=new Uint8Array(e,u*a,a),p=Fr(xn(f),n,o,i);l.set(new Uint8Array(p.buffer,p.byteOffset,p.byteLength),u*t)}return{sameFormat:!1,chunkPrefix:l,activeFrame:l.subarray(r*t,s)}}var c,R=!1,et,qr,xe,q,I=0,G=0,st=0,E=Ar,qe=[],Ke=new Map,Yt,Xt,D,L,He,ze,_r,qt,Kt,gr,Lo,Oo,Ve=!1,je=null,rt=[],Xe=0,U=!1,Fo=1,Uo=0,No=0,P=!1,v=!1,ee=100,b=0,Ze=0,br=0,ut=0,Kr,Pa=4,an=192,Qe=1024,Ao=16,_e=[],tt=[],nt=[],ka=0,Hr=null,$o={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},Wo={originX:0,originY:0,visible:!1},ce=null,Vr=-1,Ye=!1,hr=!1,Wt=0,xr=Dr,jr=[],A=!1,N=!1,Q={chunks:[],generationStart:0,generationEnd:0,gridFormat:rr(Ar)},zo=0,T=[],Cr=!1,g=null,Yo=0,Zr=!1,$=null,S=0,M=[],de=null,x=64,h=0,fe=[],Y=[],Sr=null,Te=null,X=0,Mr=0,ae=0,J=!1,We=0,Qr=0,Jr=0,yr=[];function Xo(e){switch(!0){case e instanceof Error:return e.message;case typeof e=="string":return e;case(e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"):return e.message;default:return String(e??"Unknown worker error")}}function lt(e){console.error("[GOLT worker] Worker GPU error:",e),k("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),P=!1,self.postMessage({type:"gpuError",reason:Xo(e)})}self.addEventListener("error",e=>{e.preventDefault(),lt(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),lt(e.reason)});async function sn(){await c.queue.onSubmittedWorkDone()}function Io(e){Qr=0,Jr=2+(e?1+Ne:0),yr=[]}async function ot(){if(yr.length>0){let e=c.createCommandEncoder({label:d.trackedAllocationClearEncoder});for(let r of yr)e.clearBuffer(r);c.queue.submit([e.finish()]),await sn(),yr=[]}}async function it(e,r){v&&Jr>0&&(Qr+=e,Jr--,yr.push(r),Qr>=ao(Ce())&&Jr>0&&(await ot(),Qr=0))}function at(){$?.destroy(),$=null;for(let e of fe)e?.destroy();fe=[],Y=[],x=0,S=0,M=[],de=null,Mr=0}function qo(){je?.destroy(),je=null,rt=[],Xe=0}function Go(){D?.destroy(),L?.destroy(),qo(),Un(ce),ce=null,_e.forEach(e=>e.destroy()),_e=[],tt=[],nt=[],at()}function Xr(e){let r=X>0;X+=e;let t=X>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function se(){let e=uo(x,Y,ae,zr(x,h),J,S);e!==J&&(J=e,self.postMessage({type:"backpressure",active:e}))}async function Re(){self.postMessage({type:"storageQuota",...fo(await navigator.storage.estimate(),T,x,h)})}function Ce(){return io(c.limits.maxBufferSize,c.limits.maxStorageBufferBindingSize)}function Br(){return Lt(Ce())}function ue(){return Wr(h,Br())}function Ko(){return lo(ae,zr(x,h),Y,fe)}function Rr(){return co(ue(),x,$,fe,S,Ko())}async function wa(e){let r=new DecompressionStream(At),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],o=r.readable.getReader();for(;;){let{done:l,value:u}=await o.read();if(l)break;n.push(u)}let i=0;for(let l of n)i+=l.byteLength;let s=new Uint8Array(i),a=0;for(let l of n)s.set(l,a),a+=l.byteLength;return s.buffer}function K(){return{cols:I,rows:G}}function Aa(){return wt(Math.ceil(st/16),Math.ceil(G/16),c.limits.maxComputeWorkgroupsPerDimension)}function Ia(){return wt(Math.ceil(I/16),Math.ceil(G/16),c.limits.maxComputeWorkgroupsPerDimension)}function Ht(){He?.destroy(),He=c.createBuffer({label:d.uniformBuffer,size:pr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Ga(){let e=yo({canvasWidth:xe.width,canvasHeight:xe.height,scale:Fo,offsetX:Uo,offsetY:No,grid:K(),topology:q.topology,tribeCount:qe.length,brushPreview:$o,exportFrameOverlay:Wo});c.queue.writeBuffer(He,0,e)}function ct(){return ne({cols:I,rows:G},E)}function pe(){return rr(E)}async function Vt(){let e=ct();D=c.createBuffer({label:d.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await it(e,D),L=c.createBuffer({label:d.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await it(e,L);let r=c.createCommandEncoder({label:d.gridClearEncoder});r.clearBuffer(D),r.clearBuffer(L),c.queue.submit([r.finish()]),U=!1}function jt(){let e=To(qe);ze&&ze.destroy(),ze=c.createBuffer({label:d.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),c.queue.writeBuffer(ze,0,e)}function Zt(){let e=q.topology,r=c.createShaderModule({label:`${d.renderShaderModule} (${e})`,code:_o(gn,E,e)});_r=c.createRenderPipeline({label:`${d.renderPipeline} (${e})`,layout:"auto",vertex:{module:r,entryPoint:"vs_main"},fragment:{module:r,entryPoint:"fs_main",targets:[{format:qr}]},primitive:{topology:"triangle-list"}})}function Qt(){qt=c.createBindGroup({layout:_r.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:He}},{binding:1,resource:{buffer:D}},{binding:2,resource:{buffer:ze}}]}),Kt=c.createBindGroup({layout:_r.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:He}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:ze}}]})}function Da(){return q.rules.some(e=>{let r=he(e.probability);return!e.muted&&r>0&&r<100})}function La(){Xe=Math.max(Ao,c.limits.minUniformBufferOffsetAlignment),je=c.createBuffer({label:d.simulationParameterBuffer,size:Xe*Qe,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),rt=[];let e=gr.getBindGroupLayout(1);for(let r=0;r<Qe;r++)rt.push(c.createBindGroup({label:`${d.simulationParameterBindGroup} ${r}`,layout:e,entries:[{binding:0,resource:{buffer:je,offset:r*Xe,size:Ao}}]}))}function Jt(){qo(),Yt=Aa(),Ve=Da();let e=no(q,qe,st,K(),Yt,E,Ke),r=c.createShaderModule({label:d.simulationShaderModule,code:e});gr=c.createComputePipeline({label:d.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),Lo=c.createBindGroup({label:d.simulationBindGroupAtoB,layout:gr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:L}}]}),Oo=c.createBindGroup({label:d.simulationBindGroupBtoA,layout:gr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:D}}]}),Ve&&(La(),console.info("[GOLT worker] Probabilistic rule compute path enabled",{randomSeed:q.randomSeed,parameterSlots:Qe}))}function en(){Xt=Ia(),ce=Fn({device:c,cols:I,rows:G,gridFormat:E,dispatchPlan:Xt})}function rn(){let e=c.createShaderModule({label:d.brushShaderModule,code:Xn(E)});Kr=c.createComputePipeline({label:d.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),_e.forEach(r=>r.destroy()),_e=[],tt=[],nt=[];for(let r=0;r<Pa;r++){let t=c.createBuffer({label:`${d.brushUniformBuffer} ${r}`,size:an,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});_e.push(t),tt.push(c.createBindGroup({layout:Kr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:t}}]})),nt.push(c.createBindGroup({layout:Kr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:t}}]}))}}function Oa(e,r){let t=Ke.get(C)??0,n=ka++,o=qn(r.centerX,r.centerY,r.brushSize,K(),q.topology),i=U?nt:tt;for(let[s,a]of o.entries()){let l=new ArrayBuffer(an),u=new Uint32Array(l);u[0]=st,u[1]=r.brushSize,u[2]=r.shape,u[3]=r.fill,u[4]=t,u[5]=n,u[6]=r.tribeIds.length,u[7]=a.destinationStartX,u[8]=a.destinationStartY,u[9]=a.localStartX,u[10]=a.localStartY,u[11]=a.spanCols,u[12]=a.spanRows,u[13]=r.density,u[14]=0,u[15]=0;for(let m=0;m<r.tribeIds.length&&m<32;m++)u[16+m]=r.tribeIds[m];let f=_e[s],p=i[s];if(f&&p){c.queue.writeBuffer(f,0,l);let m=Math.floor(a.destinationStartX/E.cellsPerWord),O=Math.ceil((a.destinationStartX+a.spanCols)/E.cellsPerWord)-m,y=Math.ceil(O/8),re=Math.ceil(a.spanRows/8),me=e.beginComputePass({label:d.brushPass});me.setPipeline(Kr),me.setBindGroup(0,p),me.dispatchWorkgroups(y,re),me.end()}else throw console.error("[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.",{index:s,rectCount:o.length,bindGroupCount:i.length,uniformBufferCount:_e.length}),new Error("Brush dispatch resources are out of sync with the wrapped brush rectangles.")}}function Fa(){let e=U?L:D,r=ct(),t;try{t=c.createBuffer({label:d.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(o){return console.warn("GPU readback buffer allocation failed:",o),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=c.createCommandEncoder({label:d.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),c.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let o=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),o})}function Ho(){h=ct(),x=so(h,Br())}function Ua(){let e=Ve?Xe*Qe:0;return pr+So+an+Le*2+Oe*2+e}function tn(){self.postMessage({type:"limits",...po(Ce(),h,x,Ua(),pe())})}function Vo(){return x>=1&&$!==null&&S<x}function jo(e,r){let t=U?L:D,n=S*h;e.copyBufferToBuffer(t,0,$,n,h),M.push(r),de=r,S++}function un(e){if(Vo()){let r=c.createCommandEncoder({label:d.recordingFrameCopyEncoder});jo(r,e),c.queue.submit([r.finish()]),Tr()}}function zt(e){Mr=Math.max(0,Mr+e)}function Tr(){x>0&&S>=x&&Ko()&&Er()}function Er(){let e=$;if(e!==null&&S>0&&fe.length>0&&ae<zr(x,h)){let r=Y.indexOf(!0);if(r>=0){Y[r]=!1;let t=fe[r];if(t.mapState==="unmapped"){let n=S*h,o=zo++,i=[...M],s=i[0],a=i[i.length-1],l=`chunk-${String(o).padStart(6,"0")}.bin`,u=S,f=c.createCommandEncoder({label:d.recordingSealCopyEncoder});f.copyBufferToBuffer(e,0,t,0,n),c.queue.submit([f.finish()]);let p={chunkId:o,generationStart:s,generationEnd:a,blockCount:u,codec:ye,uncompressedBytes:n,storedBytes:n,gridFormat:pe(),generations:i,filename:l};Xr(1),zt(u),ae++,se();let m=We;t.mapAsync(GPUMapMode.READ).then(async()=>{let _=t.getMappedRange(),O=new ArrayBuffer(n);new Uint8Array(O).set(new Uint8Array(_,0,n)),t.unmap(),m===We&&(Y[r]=!0,T.push(p),zt(-u),dr(Q,T,M),se(),Tr(),Na(p,O).then(()=>{m===We&&(ae--,se(),Xr(-1),Re(),vr(),H(!0),Tr(),self.postMessage({type:"chunkSealed",filename:p.filename,rawBytes:n,blockCount:p.blockCount,cols:I,rows:G,rawGridFormat:p.gridFormat,storageGridFormat:rr(Ir(q.tribes.length))}),Cr&&X===0&&(Cr=!1,vr()))}).catch(y=>{m===We&&(ae--,se(),Xr(-1),Ya(p,y).catch(lt))}))}).catch(()=>{m===We&&(Y[r]=!0,ae--,zt(-u),se(),Xr(-1),Tr())}),S=0,M=[]}else Y[r]=!0}}}async function Zo(e){We++,zo=0,S=0,M=[],T=[],de=null,Mr=0,ae=0,X>0&&(X=0,self.postMessage({type:"chunksSaving",active:!1})),J&&(J=!1,self.postMessage({type:"backpressure",active:!1})),Cr=!1,N=A,Q={chunks:[],generationStart:e,generationEnd:e,gridFormat:pe()},await Jo(),Re()}async function ln(){return Te&&await Te,Sr||(Sr=await(await navigator.storage.getDirectory()).getDirectoryHandle(cr,{create:!0})),Sr}async function Na(e,r){let t=await ln(),o=await(await t.getFileHandle(e.filename,{create:!0})).createWritable(),i=!1;try{await o.write(r),await o.close(),i=!0,o=null}catch(s){if(o&&!i)try{await o.abort()}catch(a){console.warn("[GOLT worker] Failed to abort recording chunk write after error:",a)}try{await t.removeEntry(e.filename)}catch(a){a instanceof DOMException&&a.name==="NotFoundError"||console.warn("[GOLT worker] Failed to remove failed recording chunk:",e.filename,a)}throw s}}function $a(e){let r=Xo(e).toLowerCase();return e instanceof DOMException&&e.name==="QuotaExceededError"||r.includes("storage quota")||r.includes("quota exceeded")||r.includes("exceed its storage quota")}function Qo(e){let r=T.findIndex(t=>t.filename===e.filename);r>=0&&T.splice(r,1)}async function Wa(){let e=null,r=fr(T),t=Nt(T,r,0,1);if(t?.source==="sealed"){let{frameInChunk:n}=t,o=T[t.sealedIndex];try{let i=(n+1)*h,s=await ei(o.filename,o.codec),a=K(),l=Gr(o.gridFormat),u=$t(s,n,h,a,l,E),f=u.activeFrame??u.chunkPrefix.subarray(n*h,i);if(c.queue.writeBuffer(U?L:D,0,f),S=0,M=[],b=o.generations[n]??o.generationEnd,de=b,e=b,n<o.blockCount-1){let m=n+1,_=o.blockCount>0?Math.floor(o.uncompressedBytes/o.blockCount):h;o.blockCount=m,o.generationEnd=b,o.generations=o.generations.slice(0,m),o.uncompressedBytes=_*m,o.codec===ye&&(o.storedBytes=h*m)}let p=T.splice(t.sealedIndex+1);await nn(p.map(m=>m.filename)),dt(),ii(),F()}catch(i){console.warn("[GOLT worker] Failed to restore the previous persisted recording frame after storage quota pressure:",i)}}else{let n=T.splice(0);await nn(n.map(o=>o.filename)),S=0,M=[]}return e}async function za(e,r){console.warn("[GOLT worker] Recording stopped because OPFS storage quota was reached:",r),Qo(e),k("cancelled",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),P=!1,A=!1,N=!1;let t=await Wa();dr(Q,T,M),se(),Re(),vr(),H(!0),self.postMessage({type:"recordingStopped",reason:"storageQuota",restoredGeneration:t})}async function Ya(e,r){Qo(e),$a(r)?await za(e,r):lt(r)}async function nn(e){let r=await ln();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function Jo(){if(Te)await Te;else{Te=(async()=>{let e=await navigator.storage.getDirectory();Sr=null;try{await e.removeEntry(cr,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${cr}:`,r)}Sr=await e.getDirectoryHandle(cr,{create:!0})})();try{await Te}finally{Te=null}}}function vr(){dr(Q,T,M),self.postMessage({type:"recording",manifest:{chunks:mo(T),generationStart:Q.generationStart,generationEnd:Q.generationEnd,gridFormat:pe()},cols:I,rows:G})}function Pr(e=!1){if(A){let r=!N;e&&N&&Rr()&&(N=!1,r=!0),r&&bo(de,b)&&Rr()&&(S>=x&&Er(),un(b))}}function cn(){if(Hr){let e=Hr;Hr=null;let r=A&&S>0&&M[S-1]===b;r&&(S--,M.pop());let t=c.createCommandEncoder({label:d.brushEncoder});Oa(t,e),c.queue.submit([t.finish()]),r&&un(b)}}async function ei(e,r=ye){let i=await(await(await(await ln()).getFileHandle(e)).getFile()).arrayBuffer();return r===At?wa(i):i}function ri(){return In(I,G,xr.enabled,xr.sections)}function Xa(){return Gn(ri())}function ti(e){jr=Xa(),ce&&jr.length>0&&Nn({device:c,encoder:e,resources:ce,sourceBuffer:U?L:D,dispatchPlan:Xt,enabledSections:jr})}function ni(){let e=b;if(ce&&e!==Vr&&!Ye){let r=[...jr],t=ri();Vr=e,Ye=!0,$n({resources:ce,enabledSections:r}).then(n=>{let o=Ke.get(C)??0,i=fr(T,S+Mr),s=Wn({generation:e,tribes:qe,deadTribeIndex:o,readback:n,enabledSections:r,availability:t,liveMetricSettings:xr.sections,cols:I,rows:G,totalFrames:i,fps:ut,canStepBack:i>1,recordingBytes:go(T),recordingRawBytes:ho(T)});if(Ye=!1,self.postMessage(s),hr)if(hr=!1,Vr=-1,si()){let a=c.createCommandEncoder({label:d.interactiveMetricsEncoder});ti(a),c.queue.submit([a.finish()]),ni()}else hr=!0}).catch(()=>{Ye=!1})}}function dn(e){if(Ve&&je&&e>0){let r=Math.min(e,Qe),t=Xe/Uint32Array.BYTES_PER_ELEMENT,n=new Uint32Array(r*t);for(let o=0;o<r;o++)n[o*t]=b+o;c.queue.writeBuffer(je,0,n)}}function oi(e){let r=e;return Ve&&(r=Math.min(e,Qe)),r}function fn(e,r=0){let t=e.beginComputePass({label:d.simulationStepPass});t.setPipeline(gr),t.setBindGroup(0,U?Oo:Lo),Ve&&t.setBindGroup(1,rt[r]);let n=Yt;t.dispatchWorkgroups(n.dispatchWgX,n.dispatchWgY),t.end(),U=!U,b++}function qa(e){let r=oi(e);if(r>0){dn(r);let t=c.createCommandEncoder({label:d.simulationBatchEncoder});for(let n=0;n<r;n++)fn(t,n);c.queue.submit([t.finish()]),Ze+=r}}function ii(){self.postMessage({type:"generation",generation:b,fps:ut})}function Ka(){dn(1);let e=c.createCommandEncoder({label:d.simulationSingleStepEncoder});fn(e),c.queue.submit([e.finish()])}function F(){if(c&&et&&He&&_r&&qt&&Kt&&!v&&!R){Ga();let e=et.getCurrentTexture().createView(),r=c.createCommandEncoder({label:d.renderEncoder}),t=r.beginRenderPass({label:d.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(_r),t.setBindGroup(0,U?Kt:qt),t.draw(3),t.end(),c.queue.submit([r.finish()])}}function ai(e){br===0&&(br=e);let r=e-br;r>=1e3&&(ut=Ze/(r/1e3),Ze=0,br=e)}function dt(){Ze=0,br=0,ut=0}function pn(){return A&&ue()?"recording":"nonRecording"}function si(){return!!(c&&ce&&!v&&!R)}function H(e=!1){if(e&&(Vr=-1),!si())hr=!0;else if(Ye)hr=!0;else{let r=c.createCommandEncoder({label:d.interactiveMetricsEncoder});ti(r),c.queue.submit([r.finish()]),ni()}}function ui(){H(!0),F()}function ft(e,r){r&&(e-Wt>=1e3||Wt===0)&&!Ye&&(Wt=e,H())}function kr(e,r){(e.request.pacing.kind==="max"||j(e))&&r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,ii())}function Je(e){J!==e&&(J=e,self.postMessage({type:"backpressure",active:e}))}function li(){let e=Rr();return e&&S>=x&&(Er(),e=Rr()),e}function wr(){!v&&!R&&!g&&self.requestAnimationFrame(on)}function Ha(e,r){let t=e.adaptiveBatch;t&&t.lastDrainStartedAt>0&&(vo(t,r-t.lastDrainStartedAt),t.lastDrainStartedAt=0,t.lastSubmittedGenerations=0)}function ci(e,r,t){let n=e.adaptiveBatch;n&&r>0&&(n.lastSubmittedGenerations=r,n.lastDrainStartedAt=t)}function di(e,r){let t=Math.max(1,Math.round(mr(r))),n=0;for(;n<e;){let o=e-n,i=Math.min(t,o);qa(i),n+=i}return n}function Me(e){let r=g;if(r&&!r.pumpPending&&!v&&!R){let{token:t}=r;r.pumpPending=!0;let n=()=>{if(g&&g.token===t){let o=performance.now();g.pumpPending=!1,e==="drain"&&Ha(g,o),rs(o)}};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?c.queue.onSubmittedWorkDone().then(n).catch(()=>{g?.token===t&&(g.pumpPending=!1)}):queueMicrotask(n)}}function mn(e,r){g&&k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1});let t=K(),n=e==="nonRecording"?Ro(t,r.pacing):null;n&&console.info("[GOLT worker] Adaptive non-recording batching started",{cols:t.cols,rows:t.rows,bitsPerCell:E.bitsPerCell,generationsPerDrain:n.generationsPerDrain,targetDrainMs:n.targetDrainMs}),g={kind:e,request:r,token:++Yo,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0,adaptiveBatch:n},Me(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function le(){P&&mn(pn(),{pacing:Bo(ee),stopCondition:{kind:"none"}})}function Va(e,r){r||e==="cancelled"?Je(!1):J&&se()}function k(e,r={}){let t=g;if(t){g=null,Yo++;let n=j(t),o=Eo(t,r),i=!!o;o&&(P=o.running,ee=o.targetStepDuration),Po(e,n,r)&&self.postMessage({type:"stepping",active:!1}),Va(e,n),r.render!==!1&&!v&&!R&&ui(),ko(r,i,P,v,R)?le():wr()}}function fi(e){let r=g;r&&j(r)&&(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),k("cancelled"))}function ja(e){k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),mn(pn(),e)}function pi(e,r,t){Je(!0),kr(e,r),ft(r,t),Me("drain")}function mi(e,r){let t=oi(e);dn(t);let n=c.createCommandEncoder({label:d.recordingStepBatchEncoder}),o=0,i=!1,s=t>0;for(;s;)o<t&&performance.now()<r?li()&&Vo()?(fn(n,o),jo(n,b),o++,S>=x&&(s=!1)):(i=!0,s=!1):s=!1;return o>0&&(c.queue.submit([n.finish()]),Ze+=o,Tr()),{steps:o,blocked:i}}function Za(e,r){let t=K(),n=e.adaptiveBatch?.generationsPerDrain??Math.round(mr(t)*Yr(t)),o=Math.min(n,Z(e,b)),i=di(o,t),s=i>0;kr(e,r),$e(e,b)?k("targetReached"):s?(ci(e,i,performance.now()),Me("drain")):Me("raf")}function Qa(e,r){Pr(!0);let t=!1,n=!1,o=performance.now()+14,i=Z(e,b)>0&&performance.now()<o;for(;i;){let s=mi(Z(e,b),o);t=t||s.steps>0,s.blocked?(pi(e,r,t),n=!0,i=!1):i=s.steps>0&&Z(e,b)>0&&performance.now()<o}n||(Je(!1),kr(e,r),ft(r,t),$e(e,b)?k("targetReached"):Me("raf"))}function Ja(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let o=e.stepAccumulator,i=Math.floor(e.stepAccumulator/r),s=K(),a=e.adaptiveBatch?.generationsPerDrain??Ft(e.kind,s),l=Math.min(i,Z(e,b),a),u=di(l,s),f=u>0;if(e.stepAccumulator=Ut(o,r,i,u,a),kr(e,t),$e(e,b))k("targetReached");else{let p=f&&i>u;(!j(e)&&!p||t-e.lastRenderTime>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,F(),ft(t,f)),p&&ci(e,u,performance.now()),Me(p?"drain":"raf")}}function es(e,r,t){Pr(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let o=!1,i=0,s=e.stepAccumulator,a=Ft(e.kind,K()),l=Math.floor(e.stepAccumulator/r),u=performance.now()+14,f=!1,p=l>0&&Z(e,b)>0&&i<a&&performance.now()<u;for(;p;){let m=Math.min(l-i,a-i,Z(e,b)),_=mi(m,u);i+=_.steps,o=o||_.steps>0,_.blocked?(pi(e,t,o),f=!0,p=!1):p=_.steps>0&&l>i&&Z(e,b)>0&&i<a&&performance.now()<u}e.stepAccumulator=Ut(s,r,l,i,a),f||(Je(!1),kr(e,t),$e(e,b)?k("targetReached"):(j(e)||(F(),ft(t,o)),Me("raf")))}function rs(e){let r=g;if(r&&!v&&!R)if(ai(e),j(r)||cn(),$e(r,b))k("targetReached");else if(r.request.pacing.kind==="max")r.kind==="recording"?Qa(r,e):Za(r,e);else{let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?es(r,t,e):Ja(r,t,e)}}function on(e){v||R?self.requestAnimationFrame(on):(ai(e),g||(cn(),ee>0&&!Zr&&F(),self.requestAnimationFrame(on)))}function ts(e,r){let t=c?Ce():Number.POSITIVE_INFINITY;return yn(r.bitsPerCell)&&gt(r.bitsPerCell,e.tribes.length)&&ht(e,er(r.bitsPerCell),t)?er(r.bitsPerCell):_n(e.tribes.length,e,t)}function bi(e,r){let t=kn(e),n=t.topology===B?B:Cn,o=t.tribes.some(i=>i.id===t.boundaryTribe)?t.boundaryTribe:C;q={...t,topology:n,boundaryTribe:o},I=t.cols,G=t.rows,E=ts(t,r),st=be(I,E),qe=[...q.tribes],Q.gridFormat=pe(),Ke.clear(),qe.forEach((i,s)=>Ke.set(i.id,s))}async function gi(e){console.log("[GOLT worker] Initializing WebGPU"),xe=e,c=await wn(d.webengineDevice),R=!1,c.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),R=!0,P=!1,v=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:Ce(),vramBudgetBytes:Ot(Ce(),Br()),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:pe()});let r=xe.getContext("webgpu");if(r)et=r,qr=navigator.gpu.getPreferredCanvasFormat(),et.configure({device:c,format:qr,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:qr,maxBufferSize:c.limits.maxBufferSize,maxStorageBufferBindingSize:c.limits.maxStorageBufferBindingSize});else throw new Error("WebGPU canvas context not available")}async function ns(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await gi(xe),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),R=!0,P=!1,v=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function hi(){$=c.createBuffer({label:d.recordingChunkBuffer,size:x*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await it(x*h,$),S=0,M=[],de=null}async function Si(){let e=x*h;fe=[],Y=[];for(let r=0;r<Ne;r++){let t=c.createBuffer({label:`${d.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});fe.push(t),Y.push(!0),await it(e,t)}}async function os(){await Jo()}async function is(){console.log("[GOLT worker] Building GPU resources",{cols:I,rows:G,bitsPerCell:E.bitsPerCell,recordingAvailable:ue()}),Ht(),Ho(),await Vt(),jt(),Zt(),Qt(),Jt(),rn(),en(),await os(),ue()?(await hi(),await Si()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:h,maxRecordingBufferBytes:Br()}),at(),A=!1,N=!1),await ot(),tn(),console.log("[GOLT worker] GPU resources ready")}async function as(){console.log("[GOLT worker] Rebuild started",{cols:I,rows:G,bitsPerCell:E.bitsPerCell}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),v=!0,self.postMessage({type:"rebuilding",active:!0});try{await sn()}catch{console.warn("[GOLT worker] Queue idle wait rejected during rebuild")}let e=!R;if(R&&(e=await ns()),e){Go(),Ht(),Ho(),Io(ue());try{await Vt(),jt(),Zt(),Jt(),rn(),Qt(),en(),ue()?(await hi(),await Si()):(at(),A=!1,N=!1),await ot(),tn()}catch(r){let t=r instanceof Error?r.message:String(r);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{Go(),Ht(),Io(!1),await Vt(),jt(),Zt(),Jt(),rn(),Qt(),en(),A=!1,N=!1,h=ct(),at(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await ot(),tn()}catch(n){console.error("[GOLT worker] GPU rebuild recovery failed:",n),e=!1}}}return e&&(v=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:ue(),frameByteSize:h})),e}function Do(e){Zr=!0,c.queue.onSubmittedWorkDone().then(()=>{Zr=!1,e()}).catch(()=>{Zr=!1})}async function ss(){X>0&&await new Promise(e=>{let r=setInterval(()=>{X===0&&(clearInterval(r),e())},10)})}async function us(e){console.log("[GOLT worker] Init message received",{cols:e.ruleset.cols,rows:e.ruleset.rows,recording:e.recording,running:e.running,speed:e.speed}),A=e.recording,xr=yt(e.liveMetrics),N=A,bi(e.ruleset,e.simulationGridFormat),await gi(e.canvas),await is(),H(!0),Re(),P=e.running,ee=e.speed<0?0:1e3/e.speed,P?le():wr()}function ls(e){xr=yt(e.liveMetrics),H(!0)}async function cs(e){console.log("[GOLT worker] Ruleset update received",{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length});let r=Ce();if(St(e.ruleset.tribes.length,e.ruleset,r))k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),bi(e.ruleset,e.simulationGridFormat),await as()&&(b=0,dt(),await Zo(0),H(!0),P?le():wr());else{let o=`Requested ruleset requires at least ${Tn(e.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",o,{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length,maxBytes:r}),self.postMessage({type:"gpuError",reason:o})}}function ds(e){P=e.running,e.running?g||le():g&&j(g)?fi(!1):g?k("manual"):(J&&se(),ui(),wr())}function fs(e){let r=ee<=0,t=e.speed<0?0:1e3/e.speed;ee=t,g&&!j(g)&&P?(k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&t>0?Do(()=>{F(),le()}):le()):P&&!g?le():r&&t>0&&Do(()=>{F(),wr()})}function ps(e){Fo=e.scale,Uo=e.offsetX,No=e.offsetY,!g&&!v&&!R&&F()}function ms(e){xe.width=e.width,xe.height=e.height,!g&&!v&&!R&&F()}function bs(e){let r=e.tribes.map(t=>Ke.get(t)).filter(t=>t!==void 0);if(r.length>0){let t={square:0,round:1,diamond:2,vline:3,hline:4},n={full:0,spray:1,outline:2};Hr={centerX:e.x,centerY:e.y,brushSize:e.size,shape:t[e.shape]??0,fill:n[e.fill]??0,density:Sn(e.density),tribeIds:r}}}function gs(e){let r={square:0,round:1,diamond:2,vline:3,hline:4};$o={centerX:e.x,centerY:e.y,brushSize:e.size,shape:r[e.shape]??0,visible:e.visible},!g&&!v&&!R&&ee<=0&&F()}function hs(e){Wo={originX:e.origin?.originX??0,originY:e.origin?.originY??0,visible:e.visible&&e.origin!==null},!g&&!v&&!R&&ee<=0&&F()}async function Ss(){try{let e=await Fa();vt({type:"snapshot",grid:e,generation:b,cols:I,rows:G,gridFormat:pe()},[e.buffer])}catch{let e=new Uint32Array(0);vt({type:"snapshot",grid:e,generation:b,cols:I,rows:G,gridFormat:pe()},[e.buffer])}}async function ys(e){let r=Gr(e.gridFormat),t=K();if(e.grid.byteLength===ne(t,r)){let n=Fr(e.grid,t,r,E);c.queue.writeBuffer(U?L:D,0,n),b=e.generation,dt(),await Zo(e.generation)}}function Ts(e){let r=g?.request,t=ue();e.recording&&t&&!A?(A=!0,N=!0,H(!0),Re()):(!e.recording||!t)&&(e.recording&&!t&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:h,maxRecordingBufferBytes:Br()}),A=!1,N=!1),r&&g?ja(r):!g&&P&&le()}async function _s(){Cr||(await sn(),Pr(!1),S>0&&Er(),X>0?Cr=!0:vr())}async function xs(e){let r=fr(T),t=Nt(T,r,S,e.count);if(t){let n=U?L:D;if(t.source==="buffered"){let o=wo(M,t);S=o.chunkFrameIndex,M.length=S,b=o.generation,de=b;let i=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});i.copyBufferToBuffer($,t.frameInChunk*h,n,0,h),c.queue.submit([i.finish()])}else{X>0&&(await ss(),r=fr(T));let o=T[t.sealedIndex],i=await ei(o.filename,o.codec),s=K(),a=Gr(o.gridFormat),l=$t(i,t.frameInChunk,h,s,a,E);if(c.queue.writeBuffer($,0,l.chunkPrefix),!l.sameFormat&&l.activeFrame&&c.queue.writeBuffer(n,0,l.activeFrame),S=t.frameInChunk+1,M=o.generations.slice(0,t.frameInChunk+1),b=M[t.frameInChunk],de=b,l.sameFormat){let f=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});f.copyBufferToBuffer($,t.frameInChunk*h,n,0,h),c.queue.submit([f.finish()])}let u=T.splice(t.sealedIndex);nn(u.map(f=>f.filename))}dr(Q,T,M),Re(),dt(),H(!0),F()}}function Cs(){cn(),Pr(!0),!A||li()?(Ka(),Ze++,A&&Rr()&&(S>=x&&Er(),un(b)),Je(!1)):Je(!0),H(!0),F()}function Ms(e){self.postMessage({type:"stepping",active:!0}),Pr(!0),mn(pn(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:b+e},restoreAfterStop:{running:P,targetStepDuration:ee}})}function Rs(e){e.count===1?Cs():Ms(e.count)}function vs(){fi(g?.request.restoreAfterStop?.running??P)}function Bs(e){let r=T.find(t=>t.filename===e.filename);r&&(r.codec=e.codec,r.storedBytes=e.storedBytes,r.gridFormat=e.gridFormat,Q.chunks=[...T],Re(),vr())}function Es(){let e=T.filter(r=>r.codec===ye).map(r=>({filename:r.filename,rawBytes:r.uncompressedBytes,blockCount:r.blockCount,cols:I,rows:G,rawGridFormat:r.gridFormat,storageGridFormat:rr(Ir(q.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:e})}async function Ps(e){switch(e.type){case"init":await us(e);break;case"setLiveMetrics":ls(e);break;case"setRuleset":await cs(e);break;case"setRunning":ds(e);break;case"setSpeed":fs(e);break;case"camera":ps(e);break;case"resize":ms(e);break;case"draw":bs(e);break;case"brushPreview":gs(e);break;case"exportFrameOverlay":hs(e);break;case"getSnapshot":await Ss();break;case"loadSnapshot":await ys(e);break;case"setRecording":Ts(e);break;case"getRecording":await _s();break;case"stepBack":await xs(e);break;case"stepForward":Rs(e);break;case"cancelStepping":vs();break;case"updateChunkCodec":Bs(e);break;case"getUncompressedChunks":Es();break}}self.onmessage=async e=>{await Ps(e.data)};
