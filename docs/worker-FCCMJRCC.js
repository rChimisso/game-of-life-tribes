var vn="goltTimestampedConsoleInstalled";function Ii(){let e=globalThis;e[vn]||(e[vn]=!0,_t("info"),_t("warn"),_t("error"),console.log=console.info.bind(console))}function _t(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}Ii();var Bn=`// Render shader: draws the grid as a full-screen quad.\r
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
`;function Pn(e){return Math.min(Math.max(1,Math.floor(+e||1)),100)}var Tt=[1,2,4,8,16,32],Di={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Gi={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Oi={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Or={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Li={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},Ct={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},oe={1:Di,2:Gi,4:Oi,8:Or,16:Li,32:Ct};function In(e){return Tt.includes(e)}function Fi(e){return 2**e}function Rt(e,r){return r<=Fi(e)}function xt(e,r,t){return ie(e,r)<=t}function Lr(e){return e<=2?oe[1]:e<=4?oe[2]:e<=16?oe[4]:e<=256?oe[8]:e<=65536?oe[16]:oe[32]}function wn(e){return Lr(e)}function Qe(e){return oe[e]}function An(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){return Et(e,r,t)??Ct}function Et(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of Tt){let o=Qe(n);if(Rt(n,e)&&xt(r,o,t))return o}return null}function Fr(e){return Qe(e?.bitsPerCell??8)}function Je(e){return{bitsPerCell:e.bitsPerCell}}function Se(e,r){return Math.ceil(e/r.cellsPerWord)}function ie(e,r){return Se(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Dn(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}var er={population:!0,diversity:!0,interfaces:!1},Ur={enabled:!0,sections:er};function Ui(e){return{population:typeof e?.population=="boolean"?e.population:er.population,diversity:typeof e?.diversity=="boolean"?e.diversity:er.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:er.interfaces}}function Mt(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Ur.enabled,sections:Ui(e?.sections)}}var R="dead";var Gn="toroidal",v="bounded";var On=42,Ln=0,vt=4294967295,Fn=100,Bt=0,Nr=100,rr=1e3,nu=Bt*rr,ou=Nr*rr,tr="empty",kt="is",nr="comparison",or="count",ir="none",ar="exactly",sr="min",ur="max",ke="not",Pe="and",Ie="or",we="xor",Z="tribes",Pt="same",It="different",ae="different-in",W="tie",$r="fixed",Un="same",Ae="majority",Wr="minority";var lr="combine";var wt={kind:tr};function At(e){let r;return Array.isArray(e)?r=`[${e.map(t=>At(t)).join(",")}]`:e&&typeof e=="object"?r=`{${Object.entries(e).filter(([,n])=>n!==void 0).sort(([n],[o])=>n.localeCompare(o)).map(([n,o])=>`${JSON.stringify(n)}:${At(o)}`).join(",")}}`:r=JSON.stringify(e),r}function Ot(e){let r=typeof e=="number"&&Number.isFinite(e)?e:On;return Math.max(Ln,Math.min(vt,Math.trunc(r)))}function _e(e){let r=typeof e=="number"&&Number.isFinite(e)?e:Fn,t=Math.round(r*rr)/rr;return Math.max(Bt,Math.min(Nr,t))}function Nn(e){return Math.floor(_e(e)/Nr*vt)}function Ni(e){let r=e&&e.length>0?e:[R];return{kind:Z,tribes:[...r]}}function D(e){let r=e??Ni(void 0),t;switch(r.kind){case Z:case ae:t={...r,tribes:[...r.tribes]};break;case W:t={...r,source:D(r.source)};break;default:t={...r};break}return t}function ye(e){return{kind:"count",selector:D(e?.selector)}}function zr(e){return At(ue(e))}function ue(e){let r;switch(e.kind){case Z:case ae:r={...e,tribes:[...new Set(e.tribes)].sort()};break;case W:r={...e,source:ue(e.source)};break;default:r=e;break}return r}function Dt(e){switch(e.kind){case tr:return wt;case or:case ir:case ar:case sr:case ur:return{...e,selector:D(e.selector)};case nr:return{...e,left:ye(e.left),right:ye(e.right),margin:e.margin??0};case ke:return{...e,clause:Dt(e.clause)};case Pe:case Ie:case we:{let r=e.clauses.map(t=>Dt(t));for(;r.length<2;)r.push(wt);return{...e,clauses:r}}default:return e}}function Gt(e){let r=Dt(e);switch(r.kind){case ke:return{...r,clause:Gt(r.clause)};case Pe:case Ie:case we:return{...r,clauses:r.clauses.map(t=>Gt(t))};default:return r}}function cr(e){return e??{kind:$r,tribe:R}}function se(e){let r;switch(e.kind){case Ae:case Wr:r={...e,selector:D(e.selector),tie:e.tie?se(e.tie):void 0,fallback:e.fallback?se(e.fallback):void 0};break;case lr:r={kind:lr,strategy:{...e.strategy,entries:e.strategy.entries.map(t=>({...t,inputs:t.inputs.map(n=>D(n)).sort((n,o)=>zr(n).localeCompare(zr(o)))})),default:e.strategy.default?se(e.strategy.default):void 0}};break;default:r={...e};break}return r}function $i(e){let r=structuredClone(e);return r.become=se(cr(e.become)),r.probability=_e(e.probability),r}function $n(e){return{...e,randomSeed:Ot(e.randomSeed),rules:e.rules.map(r=>Wi(r))}}function Wi(e){let r=$i(e);return r.clause=Gt(r.clause),delete r.key,r.muted=!!r.muted,r.probability=_e(r.probability),r}function Lt(e,r){self.postMessage(e,r)}async function Wn(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var d={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",recordingStepBatchEncoder:"recording step batch encoder",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",simulationBindGroupAtoB:"simulation bind group A to B",simulationBindGroupBtoA:"simulation bind group B to A",simulationParameterBuffer:"simulation parameter buffer",simulationParameterBindGroup:"simulation parameter bind group",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var zn=4294967295;function Ft(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function z(e,r){return e.includes(r)}function Kn(e,r,t,n){let o=e*r,i=o<=zn,s=o*2<=zn;return{population:Ft(t&&n.population,i),diversity:Ft(t&&n.diversity,i),interfaces:Ft(t&&n.interfaces,s)}}function Yn(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var De=256*Uint32Array.BYTES_PER_ELEMENT,Ge=Uint32Array.BYTES_PER_ELEMENT;function Xn(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function qn(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function Hn(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function zi(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:o}=e;return`
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
${Xn(o)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${qn(o)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${Hn(o)}
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
`}function Ki(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:o}=e;return`
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
${Xn(o)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${qn(o)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${Hn(o)}
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
`}function Yi(e,r){let{tribes:t,deadTribeIndex:n,readback:o,cols:i,rows:s}=e,a=i*s,l={};for(let f=0;f<t.length;f++){let p=r?o.histogram[f]??0:0;l[t[f].id]=p}let u=r?l[t[n]?.id??""]??0:0;return{population:l,aliveCells:r?Math.max(0,a-u):0,deadCells:u}}function Xi(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,o=0;for(let i=0;i<r.length;i++)i!==t&&(o+=n.histogram[i]??0);return o}function qi(e,r){let{tribes:t,deadTribeIndex:n,readback:o}=e,i=r?Xi(e):0,s=0,a=0;for(let l=0;l<t.length;l++){let u=l!==n&&i>0?(o.histogram[l]??0)/i:0;u>0&&(s-=u*Math.log2(u),a+=u*u)}return{shannonEntropy:s,simpsonSum:a}}function Hi(e,r){let t=e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,o=r?Math.max(0,t-n):0;return{sameStateContactEdges:o,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?o/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function Vn(e){let{device:r}=e,t=r.createShaderModule({label:d.histogramMetricsShaderModule,code:zi(e)}),n=r.createComputePipeline({label:d.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),o=r.createBuffer({label:d.histogramMetricsBuffer,size:De,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),i=r.createBuffer({label:d.histogramMetricsReadBuffer,size:De,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=r.createShaderModule({label:d.interfaceMetricsShaderModule,code:Ki(e)}),a=r.createComputePipeline({label:d.interfaceMetricsPipeline,layout:"auto",compute:{module:s,entryPoint:"main"}}),l=r.createBuffer({label:d.interfaceMetricsBuffer,size:Ge,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),u=r.createBuffer({label:d.interfaceMetricsReadBuffer,size:Ge,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:o,histogramReadBuffer:i,boundaryPipeline:a,boundaryBuffer:l,boundaryReadBuffer:u}}function jn(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function Zn(e){let{device:r,encoder:t,resources:n,sourceBuffer:o,dispatchPlan:i,enabledSections:s}=e;if(z(s,"population")||z(s,"diversity")){let a=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,a);let l=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),u=t.beginComputePass({label:d.histogramMetricsPass});u.setPipeline(n.histogramPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(i.dispatchWgX,i.dispatchWgY),u.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,De)}if(z(s,"interfaces")){let a=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,a);let l=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),u=t.beginComputePass({label:d.interfaceMetricsPass});u.setPipeline(n.boundaryPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(i.dispatchWgX,i.dispatchWgY),u.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Ge)}}async function Qn(e){let{resources:r,enabledSections:t}=e,n=z(t,"population")||z(t,"diversity"),o=z(t,"interfaces"),i=[];n&&i.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),o&&i.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(i);let s=new Uint32Array(256);n&&(s=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let a=0;if(o){let l=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),a=l[0]??0}return{histogram:s,crossStateContactEdges:a}}function Jn(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:o,cols:i,rows:s,totalFrames:a,fps:l,canStepBack:u,recordingBytes:f,recordingRawBytes:p}=e,m=z(t,"population")&&o.population,T=z(t,"diversity")&&o.diversity,L=z(t,"interfaces")&&o.interfaces,y=i*s,ne=Yi(e,m),he=qi(e,T),Pi=Hi(e,L);return{type:"metrics",generation:r,population:ne.population,aliveCells:ne.aliveCells,deadCells:ne.deadCells,occupancy:m&&y>0?ne.aliveCells/y:0,shannonEntropy:he.shannonEntropy,simpsonIndex:T?1-he.simpsonSum:0,interfaces:Pi,metricsAvailability:n,extinctionTime:{},totalFrames:a,fps:l,canStepBack:u,recordingBytes:f,recordingRawBytes:p}}function Vi(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}function eo(e,r,t,n,o){let i=Se(r.cols,t),s=e[o*i+(n>>t.wordShift)]??0;return Vi(s,t,n&t.cellIndexMask)}function ro(e,r,t,n,o,i){let s=Se(r.cols,t),a=o*s+(n>>t.wordShift),l=(n&t.cellIndexMask)<<t.cellShift,u=~(t.cellMask<<l),f=e[a]??0;e[a]=(f&u|(i&t.cellMask)<<l)>>>0}var ji=64*1024*1024,Ou=256*1024*1024;function Kr(e,r,t,n){let o=e,i;if(t.bitsPerCell===n.bitsPerCell)i=e;else{i=new Uint32Array(ie(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let s=0;s<r.rows;s++)for(let a=0;a<r.cols;a++)ro(i,r,n,a,s,eo(o,r,t,a,s))}return i}function Zi(e,r,t){let n=Math.floor((r-1)/2),o=e-n,i=o+r,s=[];if(o>=0&&i<=t)s.push({destinationStart:o,localStart:0,span:r});else if(o<0){let a=-o;s.push({destinationStart:t-a,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:r-a})}else{let a=t-o;s.push({destinationStart:o,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:i-t})}return s.filter(a=>a.span>0)}function Qi(e,r,t){let n=e-Math.floor((r-1)/2),o=Math.max(0,n),i=Math.min(t,n+r),s=Math.max(0,i-o),a=[];return s>0&&a.push({destinationStart:o,localStart:o-n,span:s}),a}function to(e){return`
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
`}function no(e,r,t,n,o){let i=o===v?Qi:Zi,s=i(e,t,n.cols),a=i(r,t,n.rows),l=[];for(let u of a)for(let f of s)l.push({destinationStartX:f.destinationStart,destinationStartY:u.destinationStart,localStartX:f.localStart,localStartY:u.localStart,spanCols:f.span,spanRows:u.span});return l}var oo={"=":"==","\u2260":"!=",">":">","<":"<","\u2265":">=","\u2264":"<="};function Ji(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function ea(e,r){e.push(`const CELLS_PER_WORD: u32 = ${r.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${r.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${r.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${r.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${r.cellMask}u;`)}function ra(e){e.push("struct SimulationParams {"),e.push("  generation: u32,"),e.push("  _pad0: u32,"),e.push("  _pad1: u32,"),e.push("  _pad2: u32,"),e.push("};"),e.push("@group(1) @binding(0) var<uniform> simulationParams: SimulationParams;"),e.push(""),e.push("fn probabilityHash(x: u32, y: u32, generation: u32, ruleIndex: u32, randomSeed: u32) -> u32 {"),e.push("  var h = x * 0x9e3779b9u;"),e.push("  h = h ^ (y * 0x85ebca6bu);"),e.push("  h = h ^ (generation * 0xc2b2ae35u);"),e.push("  h = h ^ (ruleIndex * 0x27d4eb2fu);"),e.push("  h = h ^ randomSeed;"),e.push("  h = (h ^ (h >> 16u)) * 0x7feb352du;"),e.push("  h = (h ^ (h >> 15u)) * 0x846ca68bu;"),e.push("  return h ^ (h >> 16u);"),e.push("}")}function ta(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function na(e,r){e.push("fn readBoundedCell(x: i32, y: i32) -> u32 {"),e.push("  if (x < 0i || y < 0i || x >= i32(COLS) || y >= i32(ROWS)) {"),e.push(`    return ${r}u;`),e.push("  }"),e.push("  return readCell(u32(x), u32(y));"),e.push("}")}function oa(e,r,t){r.remapped?(e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;")):(e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;"))}function ia(e){let r=ya(e),t=new Map,n=0;for(let o of r)t.set(o,`count_${n++}`);return t}function aa(e,r){let t=_a(e),n=new Map,o=0;for(let i of t){let s=r.get(i);s?n.set(i,s):n.set(i,`eq_count_${o++}`)}return n}function sa(e,r,t,n){for(let[o,i]of r)e.push(`  let ${i} = ${$t(po(o),t,n)};`);r.size>0&&e.push("")}function ua(e,r,t,n,o){let i=0;for(let[s,a]of t)r.has(s)||(e.push(`  let ${a} = ${$t(po(s),n,o)};`),i++);i>0&&e.push("")}function la(e,r,t,n,o,i,s){s?da(e,r,t,n,o,i):ca(e,r,t,n,o,i)}function ca(e,r,t,n,o,i){for(let s=0;s<r.length;s++){let{rule:a}=r[s],l=Oe(a.clause,t,n,o,i);e.push(s===0?`  if (${l}) {`:`  } else if (${l}) {`),fr(e,se(cr(a.become)),o,i,`rule_${s}`,"    ")}r.length>0&&e.push("  }"),e.push("")}function da(e,r,t,n,o,i){e.push("  var applied = false;");for(let s=0;s<r.length;s++){let a=r[s],{rule:l,probability:u,priorityIndex:f}=a,p=Oe(l.clause,t,n,o,i);e.push(`  if (!applied && ${p}) {`),u===100?(fr(e,se(cr(l.become)),o,i,`rule_${s}`,"    "),e.push("    applied = true;")):(e.push(`    if (probabilityHash(x, y, generation, ${f}u, RANDOM_SEED) < ${Nn(u)}u) {`),fr(e,se(cr(l.become)),o,i,`rule_${s}`,"      "),e.push("      applied = true;"),e.push("    }")),e.push("  }")}e.push("")}function fr(e,r,t,n,o,i,s=null){switch(r.kind){case $r:e.push(`${i}result = ${Y(r.tribe,n)}u;`);break;case Un:e.push(`${i}result = selfTribe;`);break;case Ae:case Wr:fa(e,r,t,n,o,i);break;case lr:pa(e,r,t,n,o,i,s);break}}function fa(e,r,t,n,o,i){let s=D(r.selector),a=`${o}_${r.kind}`,l=`${o}_${r.kind}_count`,u=`${o}_${r.kind}_ties`,f=r.kind===Ae?"0u":"9u",p=r.kind===Ae?`candidateCount > ${l}`:`candidateCount < ${l}`;e.push(`${i}var ${a}: u32 = ${Y(R,n)}u;`),e.push(`${i}var ${l}: u32 = ${f};`),e.push(`${i}var ${u}: u32 = 0u;`);for(let m of Hr(s,t,n)){let T=K(y=>`${y} == ${m}u`),L=Le(s,m,n);e.push(`${i}{`),e.push(`${i}  let candidateCount = ${T};`),e.push(`${i}  if (${L} && candidateCount > 0u) {`),e.push(`${i}    if (${p}) {`),e.push(`${i}      ${a} = ${m}u;`),e.push(`${i}      ${l} = candidateCount;`),e.push(`${i}      ${u} = 1u;`),e.push(`${i}    } else if (candidateCount == ${l}) {`),e.push(`${i}      ${u} = ${u} + 1u;`),e.push(`${i}    }`),e.push(`${i}  }`),e.push(`${i}}`)}e.push(`${i}if (${u} == 1u) {`),e.push(`${i}  result = ${a};`),e.push(`${i}} else if (${u} > 1u) {`),r.tie?fr(e,r.tie,t,n,`${o}_tie`,`${i}  `,{selector:s,bestCountVar:l,tieCountVar:u}):qr(e,r.fallback,t,n,`${o}_tie_fallback`,`${i}  `),e.push(`${i}} else {`),qr(e,r.fallback,t,n,`${o}_fallback`,`${i}  `),e.push(`${i}}`)}function qr(e,r,t,n,o,i){r?fr(e,r,t,n,o,i):e.push(`${i}result = ${Y(R,n)}u;`)}function pa(e,r,t,n,o,i,s){let a=`${o}_input_mask`;e.push(`${i}var ${a}: u32 = 0u;`);for(let p of ga(t,n,s)){let m=lo(p,n,s);e.push(`${i}if (${m}) {`),e.push(`${i}  ${a} = ${a} | ${co(p)};`),e.push(`${i}}`)}let l=`${o}_dead_present`,u=K(p=>`${p} == ${Y(R,n)}u`);e.push(`${i}let ${l} = ${u} > 0u;`);let f=[...r.strategy.entries].sort((p,m)=>Number(Ut(m,n))-Number(Ut(p,n)));f.forEach((p,m)=>{let T=ha(p.inputs,t,n,s),L=Ut(p,n)?` && ${l}`:"",y=`${a} == (${T})${L}`;e.push(m===0?`${i}if (${y}) {`:`${i}} else if (${y}) {`),e.push(`${i}  result = ${Y(p.output,n)}u;`)}),f.length>0?(e.push(`${i}} else {`),qr(e,r.strategy.default,t,n,`${o}_fallback`,`${i}  `),e.push(`${i}}`)):qr(e,r.strategy.default,t,n,`${o}_fallback`,i)}function io(e){for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(`    var ${Wt(t,r)}: u32;`)}function Yr(e,r,t){for(let n=-1;n<=1;n++)for(let o=-1;o<=1;o++)if(!(o===0&&n===0)){let i=Wt(o,n),s;r==="toroidal"?s=`readCell(${ao("x",o,"COLS")}, ${ao("y",n,"ROWS")})`:r==="boundedDirect"?s=`readCell(${so("x",o)}, ${so("y",n)})`:s=`readBoundedCell(${uo("x",o)}, ${uo("y",n)})`,e.push(`${t}${i} = ${s};`)}}function $t(e,r,t){let n=ue(e),o;switch(n.kind){case Pt:o=K(i=>`${i} == selfTribe`);break;case It:o=K(i=>`${i} != selfTribe`);break;case ae:{let i=Te(n.tribes,t);o=i.length===0?"0u":K(s=>`(${s} != selfTribe && (${i.map(a=>`${s} == ${a}u`).join(" || ")}))`);break}case Z:{let i=Te(n.tribes,t);o=i.length===0?"0u":K(s=>i.map(a=>`${s} == ${a}u`).join(" || "));break}case W:o=$t(n.source,r,t);break}return o}function K(e){return ma().map(r=>`select(0u, 1u, ${e(r)})`).join(" + ")}function Wt(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function ma(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(Wt(t,r));return e}function ao(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function so(e,r){let t=e;return r===-1?t=`${e} - 1u`:r===1&&(t=`${e} + 1u`),t}function uo(e,r){let t=`i32(${e})`;return r===-1?t=`i32(${e}) - 1i`:r===1&&(t=`i32(${e}) + 1i`),t}function Te(e,r){let t=[];for(let n of e)t.push(pr(n,r,"selector"));return[...new Set(t)]}function Y(e,r){return pr(e,r,"target")}function pr(e,r,t){let n=r.get(e),o=r.get(R)??0;return n===void 0&&console.error(`Unknown rule ${t} tribe; using dead tribe instead.`,{tribe:e}),n??o}function Hr(e,r,t){let n=ue(e),o;switch(n.kind){case Z:case ae:o=Te(n.tribes,t);break;case W:o=Hr(n.source,r,t);break;default:o=r.map(i=>pr(i.id,t,"selector"));break}return[...new Set(o)].sort((i,s)=>i-s)}function Le(e,r,t){let n=ue(e),o;switch(n.kind){case Pt:o=`selfTribe == ${r}u`;break;case It:o=`selfTribe != ${r}u`;break;case ae:o=Te(n.tribes,t).includes(r)?`selfTribe != ${r}u`:"false";break;case Z:o=Te(n.tribes,t).includes(r)?"true":"false";break;case W:o=Le(n.source,r,t);break}return o}function ba(e,r,t,n){let o=ue(e),i;if(o.kind===W&&n){let s=K(l=>`${l} == ${r}u`),a=Le(n.selector,r,t);i=`(${n.tieCountVar} > 1u && ${n.bestCountVar} > 0u && ${a} && ${s} == ${n.bestCountVar})`}else{let s=K(l=>`${l} == ${r}u`);i=`(${Le(o.kind===W?o.source:o,r,t)} && ${s} > 0u)`}return i}function ga(e,r,t){let n;return t?n=Hr(t.selector,e,r):n=e.map(o=>pr(o.id,r,"selector")),[...new Set(n)].filter(o=>o!==Y(R,r)).sort((o,i)=>o-i)}function lo(e,r,t){let n;if(t){let o=K(s=>`${s} == ${e}u`),i=Le(t.selector,e,r);n=`(${e}u != ${Y(R,r)}u && ${t.tieCountVar} > 1u && ${t.bestCountVar} > 0u && ${i} && ${o} == ${t.bestCountVar})`}else{let o=K(i=>`${i} == ${e}u`);n=`(${e}u != ${Y(R,r)}u && ${o} > 0u)`}return n}function ha(e,r,t,n){let o=[];for(let i of e){let s=D(i);for(let a of Hr(s,r,t))if(a!==Y(R,t)){let l=Sa(s,a,t,n);o.push(`select(0u, ${co(a)}, ${l})`)}}return o.length>0?o.join(" | "):"0u"}function Ut(e,r){let t=Y(R,r);return e.inputs.some(n=>{let o=D(n);return(o.kind===Z||o.kind===ae)&&Te(o.tribes,r).includes(t)})}function Sa(e,r,t,n){let o=ue(e),i;if(n){let s=lo(r,t,n),a=Le(o.kind===W?o.source:o,r,t);i=`(${s} && ${a})`}else i=ba(o,r,t,null);return i}function co(e){return`(1u << ${e}u)`}function fo(e){return zr(e)}function po(e){return JSON.parse(e)}function mo(e,r){let t=new Set,n=i=>{t.add(fo(i))},o=i=>{switch(r(i,n),i.kind){case ke:o(i.clause);break;case Pe:case Ie:case we:for(let s of i.clauses)o(s);break}};for(let i of e)o(i);return t}function ya(e){return mo(e,(r,t)=>{switch(r.kind){case ir:case ar:t(D(r.selector));break;case sr:Xr(r.value,8)||t(D(r.selector));break;case ur:Xr(0,r.value)||t(D(r.selector));break;case or:Xr(r.interval[0],r.interval[1])||t(D(r.selector));break}})}function _a(e){return mo(e,(r,t)=>{r.kind===nr&&(t(ye(r.left).selector),t(ye(r.right).selector))})}function Oe(e,r,t,n,o){switch(e.kind){case tr:return"false";case kt:return Ta(e.tribes,n,o);case or:return dr(e.selector,r,e.interval[0],e.interval[1]);case ir:return dr(e.selector,r,0,0);case ar:return dr(e.selector,r,e.value,e.value);case sr:return dr(e.selector,r,e.value,8);case ur:return dr(e.selector,r,0,e.value);case nr:return Ra(e,t);case ke:return`!(${Oe(e.clause,r,t,n,o)})`;case Pe:return`(${e.clauses.map(i=>Oe(i,r,t,n,o)).join(" && ")})`;case Ie:return`(${e.clauses.map(i=>Oe(i,r,t,n,o)).join(" || ")})`;case we:return xa(e.clauses,r,t,n,o);default:return"false"}}function Ta(e,r,t){let n=Te(e,t);return n.length===0?"false":n.length===r.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}function dr(e,r,t,n){let o;return Xr(t,n)?o="true":o=Ca(Nt(D(e),r),t,n),o}function Xr(e,r){return e<=0&&r>=8}function Ca(e,r,t){switch(!0){case r===t:return`${e} == ${r}u`;case r<=0:return`${e} <= ${t}u`;case t>=8:return`${e} >= ${r}u`;default:return`(${e} >= ${r}u && ${e} <= ${t}u)`}}function Ra(e,r){let t=ye(e.left).selector,n=ye(e.right).selector,o=oo[e.operator]??"==",i=Math.max(-8,Math.min(8,e.margin??0));return`(i32(${Nt(t,r)}) ${o} (i32(${Nt(n,r)}) + ${i}i))`}function xa(e,r,t,n,o){return`(((${e.map(i=>Oe(i,r,t,n,o)).map(i=>`select(0u, 1u, ${i})`).join(" + ")}) & 1u) == 1u)`}function Nt(e,r){return r.get(fo(e))}function zt(e,r,t){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,o=Math.min(n,t),i=Math.ceil(n/o);if(i<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:o,dispatchWgY:i,remapped:!0};throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`)}function bo(e,r,t,n,o,i,s){let a=[],l=e.rules.map((y,ne)=>({rule:y,priorityIndex:ne,probability:_e(y.probability)})).filter(y=>!y.rule.muted&&y.probability>0),u=l.some(y=>y.probability>0&&y.probability<100),f=s.get(R)??0,p=e.topology===v,m=pr(e.boundaryTribe??R,s,"boundary"),T=ia(l.map(y=>y.rule.clause)),L=aa(l.map(y=>y.rule.clause),T);return a.push("// Auto-generated simulation compute shader."),a.push(`// Tribes: ${r.map(y=>y.id).join(", ")}`),a.push(`// Rules: ${e.rules.length}`),a.push(""),a.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),a.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),u&&(a.push(""),ra(a)),a.push(""),a.push(`const COLS: u32 = ${n.cols}u;`),a.push(`const ROWS: u32 = ${n.rows}u;`),a.push(`const PACKED_COLS: u32 = ${t}u;`),u&&a.push(`const RANDOM_SEED: u32 = ${Ot(e.randomSeed)}u;`),Ji(a,o),ea(a,i),a.push(""),ta(a,"gridIn","PACKED_COLS"),p&&(a.push(""),na(a,m)),a.push(""),u?a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32, x: u32, y: u32, generation: u32) -> u32 {"):a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {"),sa(a,T,r,s),ua(a,T,L,r,s),a.push(`  var result: u32 = ${f}u;`),a.push(""),la(a,l,T,L,r,s,u),a.push("  return result;"),a.push("}"),a.push(""),a.push("@compute @workgroup_size(16, 16)"),o.remapped?a.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):a.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),oa(a,o,"px"),a.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),a.push(""),a.push("  let baseX = px << WORD_SHIFT;"),p&&a.push("  let interiorPackedWord = y > 0u && y + 1u < ROWS && baseX > 0u && baseX + CELLS_PER_WORD < COLS;"),a.push("  var packed: u32 = 0u;"),a.push(""),a.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),a.push("    let x = baseX + i;"),a.push("    if (x >= COLS) { break; }"),a.push(""),a.push("    let selfTribe = readCell(x, y);"),p?(io(a),a.push("    if (interiorPackedWord) {"),Yr(a,"boundedDirect","      "),a.push("    } else {"),a.push("      let interiorCell = x > 0u && y > 0u && x + 1u < COLS && y + 1u < ROWS;"),a.push("      if (interiorCell) {"),Yr(a,"boundedDirect","        "),a.push("      } else {"),Yr(a,"boundedVirtual","        "),a.push("      }"),a.push("    }")):(io(a),Yr(a,"toroidal","    ")),a.push(""),u?a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR, x, y, simulationParams.generation) & CELL_MASK) << (i << CELL_SHIFT));"):a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),a.push("  }"),a.push(""),a.push("  gridOut[y * PACKED_COLS + px] = packed;"),a.push("}"),a.join(`
`)}var Fe=3,mr="gol-recording",Ce="raw-packed",Kt="deflate-raw",Yt=12,Xt=256*1024*1024,go=512*1024*1024;function qt(e,r,t=0){let n=t;for(let o of e)n+=o[r];return n}function ho(e,r){return Math.min(e,r)}function Ht(e){return Math.min(e,1073741824)}function So(e){return Math.min(e,go)}function Vt(e,r){return Math.max(e*2,r*6)}function Vr(e,r){return e>0&&e<=r}function va(e,r){return e>0?e*2+r:0}function Ba(e,r){return e>=1&&r>0?e*r*(1+Fe):0}function ka(e,r){return e<Xt?Math.min(Xt,r):e}function yo(e,r){return Vr(e,r)?Math.max(1,Math.floor(ka(e,r)/e)):0}function jr(e,r){return e>=1&&r>0?Math.max(1,Math.min(Yt,Math.floor(536870912/(e*r)))):Yt}function _o(e,r,t,n,o,i){let s=!r.some(l=>l)&&(o||i>=e),a=o?Math.floor(n/2)+1:n;return e>=1&&r.length>0&&(s||t>=a)}function To(e,r,t,n){return e<r&&n.some((o,i)=>t[i]&&o.mapState==="unmapped")}function Co(e,r,t,n,o,i){return e&&r>=1&&t!==null&&n.length>0&&(o<r||i)}function Ro(e,r,t,n){let o=e.quota??0,i=e.usage??0,s=0,a=0;for(let f of r)f.codec===Ce?s+=f.storedBytes:a+=f.storedBytes;let l=t*n,u=(1+Fe)*l;return{quotaBytes:o,usedBytes:i,pendingRawBytes:s,compressedBytes:a,reservedBytes:u}}function xo(e,r,t,n,o){let i=Ht(e);return{maxBytes:e,vramBudgetBytes:Vt(e,i),frameByteSize:r,recordingAvailable:Vr(r,i),vramSimulationBytes:va(r,n),vramRecordingBytes:Ba(t,r),gridFormat:o}}function br(e,r,t){r.length>0&&(e.generationStart=r[0].generationStart,e.generationEnd=r[r.length-1].generationEnd),t.length>0&&(r.length===0&&(e.generationStart=t[0]),e.generationEnd=t[t.length-1]),e.chunks=[...r]}function Eo(e){return e.map(r=>({...r,generations:[...r.generations]}))}function Mo(e,r){return e!==r}function gr(e,r=0){return qt(e,"blockCount",r)}function vo(e){return qt(e,"storedBytes")}function Bo(e){return qt(e,"uncompressedBytes")}var Pa=256,hr=96,ko=Pa*Uint32Array.BYTES_PER_ELEMENT;function Ia(e){return e===v?"  return i32(cell) - center;":"  return signedWrapDelta(cell, center, size);"}function wa(e){return e===v?"  return world - f32(center);":"  return signedWrapWorldDelta(world, center, size);"}function Aa(e){return e===v?`  let ix = min(u.grid_size.x - 1u, u.offset_cell.x + u32(local.x));
  let iy = min(u.grid_size.y - 1u, u.offset_cell.y + u32(local.y));`:`  let ix = wrapAdd(u.offset_cell.x, u32(local.x), u.grid_size.x);
  let iy = wrapAdd(u.offset_cell.y, u32(local.y), u.grid_size.y);`}function Da(e){return`  if (u.export_visible == 1u) {
    if (exportCenterMarkerMask(local) || ${e===v?"exportBoundedCornerMarkerMask(local)":"exportOriginMarkerMask(local)"}) {
      return vec4f(0.0, 0.0, 0.0, 1.0);
    }

    if (exportCenterMarkerOutlineMask(local) || ${e===v?"exportBoundedCornerMarkerOutlineMask(local)":"exportOriginMarkerOutlineMask(local)"}) {
      return vec4f(0.82, 0.84, 0.86, 1.0);
    }
  }`}function Po(e){let r=new ArrayBuffer(hr),t=new Float32Array(r),n=new Int32Array(r),o=new Uint32Array(r),i=e.topology===v?e.offsetX:(e.offsetX%e.grid.cols+e.grid.cols)%e.grid.cols,s=e.topology===v?e.offsetY:(e.offsetY%e.grid.rows+e.grid.rows)%e.grid.rows,a=Math.floor(i),l=Math.floor(s);return t[0]=e.canvasWidth,t[1]=e.canvasHeight,t[2]=e.scale,t[4]=i-a,t[5]=s-l,o[6]=e.grid.cols,o[7]=e.grid.rows,o[8]=a,o[9]=l,o[10]=e.tribeCount,n[12]=e.brushPreview.centerX,n[13]=e.brushPreview.centerY,o[14]=e.brushPreview.brushSize,o[15]=e.brushPreview.shape,o[16]=e.brushPreview.visible?1:0,o[17]=e.exportFrameOverlay.originX,o[18]=e.exportFrameOverlay.originY,o[19]=e.exportFrameOverlay.visible?1:0,o[20]=e.topology===v?1:0,r}function Io(e){let r=new Uint32Array(e.length);for(let t=0;t<e.length;t++){let n=e[t].color,o=parseInt(n.substring(0,2),16),i=parseInt(n.substring(2,4),16),s=parseInt(n.substring(4,6),16);r[t]=o|i<<8|s<<16}return r}function wo(e,r,t){return e.replace("__CELLS_PER_WORD__",`${r.cellsPerWord}u`).replace("__WORD_SHIFT__",`${r.wordShift}u`).replace("__CELL_SHIFT__",`${r.cellShift}u`).replace("__CELL_INDEX_MASK__",`${r.cellIndexMask}u`).replace("__CELL_MASK__",`${r.cellMask}u`).replace("__SIGNED_GRID_DELTA_BODY__",Ia(t)).replace("__SIGNED_GRID_WORLD_DELTA_BODY__",wa(t)).replace("__GRID_COORDINATE_ASSIGNMENTS__",Aa(t)).replace("__EXPORT_OVERLAY_BLOCK__",Da(t))}var Ga=500,Oa=33,La=2,Fa=.5,Ao=.2,Do=1,Ua=1048576;function Go(e){return Math.min(3,Math.max(0,Math.ceil(Math.log10(e.cols*e.rows/1e5))))}function Sr(e){return 1024/4**Go(e)}function Zr(e){return 16/2**Go(e)}function Na(e){return Math.max(Do,Math.round(Sr(e)*Zr(e)))}function Oo(e,r){return{generationsPerDrain:Na(e),targetDrainMs:r.kind==="max"?Ga:Oa,smoothedDrainMs:0,lastDrainStartedAt:0,lastSubmittedGenerations:0}}function Lo(e,r){if(r>0&&e.lastSubmittedGenerations>0){let t=e.smoothedDrainMs===0?r:e.smoothedDrainMs*(1-Ao)+r*Ao,n=Math.min(La,Math.max(Fa,e.targetDrainMs/t));e.smoothedDrainMs=t,e.generationsPerDrain=Math.max(Do,Math.min(Ua,Math.round(e.generationsPerDrain*n)))}}function jt(e,r){return e==="recording"?Number.MAX_SAFE_INTEGER:Sr(r)*Zr(r)}function Zt(e,r,t,n,o){let i=e-r*n;return t>n||t>o?Math.min(i,r):i}function Fo(e){return e<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/e}}function Q(e){return e.request.stopCondition.kind==="targetGeneration"}function Ue(e,r){return e.request.stopCondition.kind==="targetGeneration"&&r>=e.request.stopCondition.generation}function J(e,r){return e.request.stopCondition.kind==="targetGeneration"?Math.max(0,e.request.stopCondition.generation-r):Number.POSITIVE_INFINITY}function Uo(e,r){return r.restore!==!1&&e.request.restoreAfterStop||null}function No(e,r,t){return r&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")}function $o(e,r,t,n,o){return e.restartRestoredRun!==!1&&r&&t&&!n&&!o}function Qt(e,r,t,n){let o=r+t,i=Math.min(n,o-1);if(i<=0)return null;let s=o-1-i;if(s>=r)return{source:"buffered",frameInChunk:s-r};let a=0;for(let l=0;l<e.length;l++){let u=e[l];if(s<a+u.blockCount)return{source:"sealed",sealedIndex:l,frameInChunk:s-a};a+=u.blockCount}return null}function Wo(e,r){return{chunkFrameIndex:r.frameInChunk+1,generation:e[r.frameInChunk]}}function Jt(e,r,t,n,o,i){let s=(r+1)*t;if(o.bitsPerCell===i.bitsPerCell)return{sameFormat:!0,chunkPrefix:new Uint8Array(e,0,s),activeFrame:null};let a=ie(n,o),l=new Uint8Array(s);for(let u=0;u<=r;u++){let f=new Uint8Array(e,u*a,a),p=Kr(Dn(f),n,o,i);l.set(new Uint8Array(p.buffer,p.byteOffset,p.byteLength),u*t)}return{sameFormat:!1,chunkPrefix:l,activeFrame:l.subarray(r*t,s)}}var c,E=!1,st,Jr,Ee,H,w=0,A=0,mt=0,B=Or,Ke=[],Ye=new Map,tn,nn,G,O,Xe,$e,Er,on,an,_r,qo,Ho,qe=!1,He=null,ut=[],ze=0,U=!1,Vo=1,jo=0,Zo=0,k=!1,M=!1,te=100,b=0,Ve=0,yr=0,bt=0,et,$a=4,Sn=192,je=1024,zo=16,xe=[],lt=[],ct=[],Wa=0,rt=null,Qo={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},Jo={originX:0,originY:0,visible:!1},pe=null,tt=-1,We=!1,Tr=!1,en=0,Mr=Ur,nt=[],I=!1,N=!1,ee={chunks:[],generationStart:0,generationEnd:0,gridFormat:Je(Or)},ei=0,_=[],vr=!1,g=null,ri=0,ot=!1,$=null,S=0,x=[],me=null,C=64,h=0,be=[],X=[],Cr=null,Re=null,q=0,Br=0,le=0,re=!1,Ne=0,it=0,at=0,Rr=[];function ti(e){switch(!0){case e instanceof Error:return e.message;case typeof e=="string":return e;case(e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"):return e.message;default:return String(e??"Unknown worker error")}}function gt(e){console.error("[GOLT worker] Worker GPU error:",e),P("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),k=!1,self.postMessage({type:"gpuError",reason:ti(e)})}self.addEventListener("error",e=>{e.preventDefault(),gt(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),gt(e.reason)});async function yn(){await c.queue.onSubmittedWorkDone()}function Ko(e){it=0,at=2+(e?1+Fe:0),Rr=[]}async function dt(){if(Rr.length>0){let e=c.createCommandEncoder({label:d.trackedAllocationClearEncoder});for(let r of Rr)e.clearBuffer(r);c.queue.submit([e.finish()]),await yn(),Rr=[]}}async function ft(e,r){M&&at>0&&(it+=e,at--,Rr.push(r),it>=So(Me())&&at>0&&(await dt(),it=0))}function pt(){$?.destroy(),$=null;for(let e of be)e?.destroy();be=[],X=[],C=0,S=0,x=[],me=null,Br=0}function ni(){He?.destroy(),He=null,ut=[],ze=0}function Yo(){G?.destroy(),O?.destroy(),ni(),jn(pe),pe=null,xe.forEach(e=>e.destroy()),xe=[],lt=[],ct=[],pt()}function Qr(e){let r=q>0;q+=e;let t=q>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function ce(){let e=_o(C,X,le,jr(C,h),re,S);e!==re&&(re=e,self.postMessage({type:"backpressure",active:e}))}async function Be(){self.postMessage({type:"storageQuota",...Ro(await navigator.storage.estimate(),_,C,h)})}function Me(){return ho(c.limits.maxBufferSize,c.limits.maxStorageBufferBindingSize)}function Ir(){return Ht(Me())}function de(){return Vr(h,Ir())}function oi(){return To(le,jr(C,h),X,be)}function kr(){return Co(de(),C,$,be,S,oi())}async function za(e){let r=new DecompressionStream(Kt),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],o=r.readable.getReader();for(;;){let{done:l,value:u}=await o.read();if(l)break;n.push(u)}let i=0;for(let l of n)i+=l.byteLength;let s=new Uint8Array(i),a=0;for(let l of n)s.set(l,a),a+=l.byteLength;return s.buffer}function V(){return{cols:w,rows:A}}function Ka(){return zt(Math.ceil(mt/16),Math.ceil(A/16),c.limits.maxComputeWorkgroupsPerDimension)}function Ya(){return zt(Math.ceil(w/16),Math.ceil(A/16),c.limits.maxComputeWorkgroupsPerDimension)}function sn(){Xe?.destroy(),Xe=c.createBuffer({label:d.uniformBuffer,size:hr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Xa(){let e=Po({canvasWidth:Ee.width,canvasHeight:Ee.height,scale:Vo,offsetX:jo,offsetY:Zo,grid:V(),topology:H.topology,tribeCount:Ke.length,brushPreview:Qo,exportFrameOverlay:Jo});c.queue.writeBuffer(Xe,0,e)}function ht(){return ie({cols:w,rows:A},B)}function ge(){return Je(B)}async function un(){let e=ht();G=c.createBuffer({label:d.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ft(e,G),O=c.createBuffer({label:d.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ft(e,O);let r=c.createCommandEncoder({label:d.gridClearEncoder});r.clearBuffer(G),r.clearBuffer(O),c.queue.submit([r.finish()]),U=!1}function ln(){let e=Io(Ke);$e&&$e.destroy(),$e=c.createBuffer({label:d.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),c.queue.writeBuffer($e,0,e)}function cn(){let e=H.topology,r=c.createShaderModule({label:`${d.renderShaderModule} (${e})`,code:wo(Bn,B,e)});Er=c.createRenderPipeline({label:`${d.renderPipeline} (${e})`,layout:"auto",vertex:{module:r,entryPoint:"vs_main"},fragment:{module:r,entryPoint:"fs_main",targets:[{format:Jr}]},primitive:{topology:"triangle-list"}})}function dn(){on=c.createBindGroup({layout:Er.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Xe}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:$e}}]}),an=c.createBindGroup({layout:Er.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Xe}},{binding:1,resource:{buffer:O}},{binding:2,resource:{buffer:$e}}]})}function qa(){return H.rules.some(e=>{let r=_e(e.probability);return!e.muted&&r>0&&r<100})}function Ha(){ze=Math.max(zo,c.limits.minUniformBufferOffsetAlignment),He=c.createBuffer({label:d.simulationParameterBuffer,size:ze*je,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),ut=[];let e=_r.getBindGroupLayout(1);for(let r=0;r<je;r++)ut.push(c.createBindGroup({label:`${d.simulationParameterBindGroup} ${r}`,layout:e,entries:[{binding:0,resource:{buffer:He,offset:r*ze,size:zo}}]}))}function fn(){ni(),tn=Ka(),qe=qa();let e=bo(H,Ke,mt,V(),tn,B,Ye),r=c.createShaderModule({label:d.simulationShaderModule,code:e});_r=c.createComputePipeline({label:d.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),qo=c.createBindGroup({label:d.simulationBindGroupAtoB,layout:_r.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:O}}]}),Ho=c.createBindGroup({label:d.simulationBindGroupBtoA,layout:_r.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}},{binding:1,resource:{buffer:G}}]}),qe&&(Ha(),console.info("[GOLT worker] Probabilistic rule compute path enabled",{randomSeed:H.randomSeed,parameterSlots:je}))}function pn(){nn=Ya(),pe=Vn({device:c,cols:w,rows:A,gridFormat:B,dispatchPlan:nn})}function mn(){let e=c.createShaderModule({label:d.brushShaderModule,code:to(B)});et=c.createComputePipeline({label:d.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),xe.forEach(r=>r.destroy()),xe=[],lt=[],ct=[];for(let r=0;r<$a;r++){let t=c.createBuffer({label:`${d.brushUniformBuffer} ${r}`,size:Sn,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});xe.push(t),lt.push(c.createBindGroup({layout:et.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:t}}]})),ct.push(c.createBindGroup({layout:et.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}},{binding:1,resource:{buffer:t}}]}))}}function Va(e,r){let t=Ye.get(R)??0,n=Wa++,o=no(r.centerX,r.centerY,r.brushSize,V(),H.topology),i=U?ct:lt;for(let[s,a]of o.entries()){let l=new ArrayBuffer(Sn),u=new Uint32Array(l);u[0]=mt,u[1]=r.brushSize,u[2]=r.shape,u[3]=r.fill,u[4]=t,u[5]=n,u[6]=r.tribeIds.length,u[7]=a.destinationStartX,u[8]=a.destinationStartY,u[9]=a.localStartX,u[10]=a.localStartY,u[11]=a.spanCols,u[12]=a.spanRows,u[13]=r.density,u[14]=0,u[15]=0;for(let m=0;m<r.tribeIds.length&&m<32;m++)u[16+m]=r.tribeIds[m];let f=xe[s],p=i[s];if(f&&p){c.queue.writeBuffer(f,0,l);let m=Math.floor(a.destinationStartX/B.cellsPerWord),L=Math.ceil((a.destinationStartX+a.spanCols)/B.cellsPerWord)-m,y=Math.ceil(L/8),ne=Math.ceil(a.spanRows/8),he=e.beginComputePass({label:d.brushPass});he.setPipeline(et),he.setBindGroup(0,p),he.dispatchWorkgroups(y,ne),he.end()}else throw console.error("[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.",{index:s,rectCount:o.length,bindGroupCount:i.length,uniformBufferCount:xe.length}),new Error("Brush dispatch resources are out of sync with the wrapped brush rectangles.")}}function ja(){let e=U?O:G,r=ht(),t;try{t=c.createBuffer({label:d.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(o){return console.warn("GPU readback buffer allocation failed:",o),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=c.createCommandEncoder({label:d.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),c.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let o=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),o})}function ii(){h=ht(),C=yo(h,Ir())}function Za(){let e=qe?ze*je:0;return hr+ko+Sn+De*2+Ge*2+e}function bn(){self.postMessage({type:"limits",...xo(Me(),h,C,Za(),ge())})}function ai(){return C>=1&&$!==null&&S<C}function si(e,r){let t=U?O:G,n=S*h;e.copyBufferToBuffer(t,0,$,n,h),x.push(r),me=r,S++}function _n(e){if(ai()){let r=c.createCommandEncoder({label:d.recordingFrameCopyEncoder});si(r,e),c.queue.submit([r.finish()]),xr()}}function rn(e){Br=Math.max(0,Br+e)}function xr(){C>0&&S>=C&&oi()&&wr()}function wr(){let e=$;if(e!==null&&S>0&&be.length>0&&le<jr(C,h)){let r=X.indexOf(!0);if(r>=0){X[r]=!1;let t=be[r];if(t.mapState==="unmapped"){let n=S*h,o=ei++,i=[...x],s=i[0],a=i[i.length-1],l=`chunk-${String(o).padStart(6,"0")}.bin`,u=S,f=c.createCommandEncoder({label:d.recordingSealCopyEncoder});f.copyBufferToBuffer(e,0,t,0,n),c.queue.submit([f.finish()]);let p={chunkId:o,generationStart:s,generationEnd:a,blockCount:u,codec:Ce,uncompressedBytes:n,storedBytes:n,gridFormat:ge(),generations:i,filename:l};Qr(1),rn(u),le++,ce();let m=Ne;t.mapAsync(GPUMapMode.READ).then(async()=>{let T=t.getMappedRange(),L=new ArrayBuffer(n);new Uint8Array(L).set(new Uint8Array(T,0,n)),t.unmap(),m===Ne&&(X[r]=!0,_.push(p),rn(-u),br(ee,_,x),ce(),xr(),Qa(p,L).then(()=>{m===Ne&&(le--,ce(),Qr(-1),Be(),Pr(),j(!0),xr(),self.postMessage({type:"chunkSealed",filename:p.filename,rawBytes:n,blockCount:p.blockCount,cols:w,rows:A,rawGridFormat:p.gridFormat,storageGridFormat:Je(Lr(H.tribes.length))}),vr&&q===0&&(vr=!1,Pr()))}).catch(y=>{m===Ne&&(le--,ce(),Qr(-1),ts(p,y).catch(gt))}))}).catch(()=>{m===Ne&&(X[r]=!0,le--,rn(-u),ce(),Qr(-1),xr())}),S=0,x=[]}else X[r]=!0}}}async function ui(e){Ne++,ei=0,S=0,x=[],_=[],me=null,Br=0,le=0,q>0&&(q=0,self.postMessage({type:"chunksSaving",active:!1})),re&&(re=!1,self.postMessage({type:"backpressure",active:!1})),vr=!1,N=I,ee={chunks:[],generationStart:e,generationEnd:e,gridFormat:ge()},await ci(),Be()}async function Tn(){return Re&&await Re,Cr||(Cr=await(await navigator.storage.getDirectory()).getDirectoryHandle(mr,{create:!0})),Cr}async function Qa(e,r){let t=await Tn(),o=await(await t.getFileHandle(e.filename,{create:!0})).createWritable(),i=!1;try{await o.write(r),await o.close(),i=!0,o=null}catch(s){if(o&&!i)try{await o.abort()}catch(a){console.warn("[GOLT worker] Failed to abort recording chunk write after error:",a)}try{await t.removeEntry(e.filename)}catch(a){a instanceof DOMException&&a.name==="NotFoundError"||console.warn("[GOLT worker] Failed to remove failed recording chunk:",e.filename,a)}throw s}}function Ja(e){let r=ti(e).toLowerCase();return e instanceof DOMException&&e.name==="QuotaExceededError"||r.includes("storage quota")||r.includes("quota exceeded")||r.includes("exceed its storage quota")}function li(e){let r=_.findIndex(t=>t.filename===e.filename);r>=0&&_.splice(r,1)}async function es(){let e=null,r=gr(_),t=Qt(_,r,0,1);if(t?.source==="sealed"){let{frameInChunk:n}=t,o=_[t.sealedIndex];try{let i=(n+1)*h,s=await di(o.filename,o.codec),a=V(),l=Fr(o.gridFormat),u=Jt(s,n,h,a,l,B),f=u.activeFrame??u.chunkPrefix.subarray(n*h,i);if(c.queue.writeBuffer(U?O:G,0,f),S=0,x=[],b=o.generations[n]??o.generationEnd,me=b,e=b,n<o.blockCount-1){let m=n+1,T=o.blockCount>0?Math.floor(o.uncompressedBytes/o.blockCount):h;o.blockCount=m,o.generationEnd=b,o.generations=o.generations.slice(0,m),o.uncompressedBytes=T*m,o.codec===Ce&&(o.storedBytes=h*m)}let p=_.splice(t.sealedIndex+1);await gn(p.map(m=>m.filename)),St(),gi(),F()}catch(i){console.warn("[GOLT worker] Failed to restore the previous persisted recording frame after storage quota pressure:",i)}}else{let n=_.splice(0);await gn(n.map(o=>o.filename)),S=0,x=[]}return e}async function rs(e,r){console.warn("[GOLT worker] Recording stopped because OPFS storage quota was reached:",r),li(e),P("cancelled",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),k=!1,I=!1,N=!1;let t=await es();br(ee,_,x),ce(),Be(),Pr(),j(!0),self.postMessage({type:"recordingStopped",reason:"storageQuota",restoredGeneration:t})}async function ts(e,r){li(e),Ja(r)?await rs(e,r):gt(r)}async function gn(e){let r=await Tn();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function ci(){if(Re)await Re;else{Re=(async()=>{let e=await navigator.storage.getDirectory();Cr=null;try{await e.removeEntry(mr,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${mr}:`,r)}Cr=await e.getDirectoryHandle(mr,{create:!0})})();try{await Re}finally{Re=null}}}function Pr(){br(ee,_,x),self.postMessage({type:"recording",manifest:{chunks:Eo(_),generationStart:ee.generationStart,generationEnd:ee.generationEnd,gridFormat:ge()},cols:w,rows:A})}function Ar(e=!1){if(I){let r=!N;e&&N&&kr()&&(N=!1,r=!0),r&&Mo(me,b)&&kr()&&(S>=C&&wr(),_n(b))}}function Cn(){if(rt){let e=rt;rt=null;let r=I&&S>0&&x[S-1]===b;r&&(S--,x.pop());let t=c.createCommandEncoder({label:d.brushEncoder});Va(t,e),c.queue.submit([t.finish()]),r&&_n(b)}}async function di(e,r=Ce){let i=await(await(await(await Tn()).getFileHandle(e)).getFile()).arrayBuffer();return r===Kt?za(i):i}function fi(){return Kn(w,A,Mr.enabled,Mr.sections)}function ns(){return Yn(fi())}function pi(e){nt=ns(),pe&&nt.length>0&&Zn({device:c,encoder:e,resources:pe,sourceBuffer:U?O:G,dispatchPlan:nn,enabledSections:nt})}function mi(){let e=b;if(pe&&e!==tt&&!We){let r=[...nt],t=fi();tt=e,We=!0,Qn({resources:pe,enabledSections:r}).then(n=>{let o=Ye.get(R)??0,i=gr(_,S+Br),s=Jn({generation:e,tribes:Ke,deadTribeIndex:o,readback:n,enabledSections:r,availability:t,liveMetricSettings:Mr.sections,cols:w,rows:A,totalFrames:i,fps:bt,canStepBack:i>1,recordingBytes:vo(_),recordingRawBytes:Bo(_)});if(We=!1,self.postMessage(s),Tr)if(Tr=!1,tt=-1,Si()){let a=c.createCommandEncoder({label:d.interactiveMetricsEncoder});pi(a),c.queue.submit([a.finish()]),mi()}else Tr=!0}).catch(()=>{We=!1})}}function Rn(e){if(qe&&He&&e>0){let r=Math.min(e,je),t=ze/Uint32Array.BYTES_PER_ELEMENT,n=new Uint32Array(r*t);for(let o=0;o<r;o++)n[o*t]=b+o;c.queue.writeBuffer(He,0,n)}}function bi(e){let r=e;return qe&&(r=Math.min(e,je)),r}function xn(e,r=0){let t=e.beginComputePass({label:d.simulationStepPass});t.setPipeline(_r),t.setBindGroup(0,U?Ho:qo),qe&&t.setBindGroup(1,ut[r]);let n=tn;t.dispatchWorkgroups(n.dispatchWgX,n.dispatchWgY),t.end(),U=!U,b++}function os(e){let r=bi(e);if(r>0){Rn(r);let t=c.createCommandEncoder({label:d.simulationBatchEncoder});for(let n=0;n<r;n++)xn(t,n);c.queue.submit([t.finish()]),Ve+=r}}function gi(){self.postMessage({type:"generation",generation:b,fps:bt})}function is(){Rn(1);let e=c.createCommandEncoder({label:d.simulationSingleStepEncoder});xn(e),c.queue.submit([e.finish()])}function F(){if(c&&st&&Xe&&Er&&on&&an&&!M&&!E){Xa();let e=st.getCurrentTexture().createView(),r=c.createCommandEncoder({label:d.renderEncoder}),t=r.beginRenderPass({label:d.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(Er),t.setBindGroup(0,U?an:on),t.draw(3),t.end(),c.queue.submit([r.finish()])}}function hi(e){yr===0&&(yr=e);let r=e-yr;r>=1e3&&(bt=Ve/(r/1e3),Ve=0,yr=e)}function St(){Ve=0,yr=0,bt=0}function En(){return I&&de()?"recording":"nonRecording"}function Si(){return!!(c&&pe&&!M&&!E)}function j(e=!1){if(e&&(tt=-1),!Si())Tr=!0;else if(We)Tr=!0;else{let r=c.createCommandEncoder({label:d.interactiveMetricsEncoder});pi(r),c.queue.submit([r.finish()]),mi()}}function yi(){j(!0),F()}function yt(e,r){r&&(e-en>=1e3||en===0)&&!We&&(en=e,j())}function Dr(e,r){(e.request.pacing.kind==="max"||Q(e))&&r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,gi())}function Ze(e){re!==e&&(re=e,self.postMessage({type:"backpressure",active:e}))}function _i(){let e=kr();return e&&S>=C&&(wr(),e=kr()),e}function Gr(){!M&&!E&&!g&&self.requestAnimationFrame(hn)}function as(e,r){let t=e.adaptiveBatch;t&&t.lastDrainStartedAt>0&&(Lo(t,r-t.lastDrainStartedAt),t.lastDrainStartedAt=0,t.lastSubmittedGenerations=0)}function Ti(e,r,t){let n=e.adaptiveBatch;n&&r>0&&(n.lastSubmittedGenerations=r,n.lastDrainStartedAt=t)}function Ci(e,r){let t=Math.max(1,Math.round(Sr(r))),n=0;for(;n<e;){let o=e-n,i=Math.min(t,o);os(i),n+=i}return n}function ve(e){let r=g;if(r&&!r.pumpPending&&!M&&!E){let{token:t}=r;r.pumpPending=!0;let n=()=>{if(g&&g.token===t){let o=performance.now();g.pumpPending=!1,e==="drain"&&as(g,o),ps(o)}};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?c.queue.onSubmittedWorkDone().then(n).catch(()=>{g?.token===t&&(g.pumpPending=!1)}):queueMicrotask(n)}}function Mn(e,r){g&&P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1});let t=V(),n=e==="nonRecording"?Oo(t,r.pacing):null;n&&console.info("[GOLT worker] Adaptive non-recording batching started",{cols:t.cols,rows:t.rows,bitsPerCell:B.bitsPerCell,generationsPerDrain:n.generationsPerDrain,targetDrainMs:n.targetDrainMs}),g={kind:e,request:r,token:++ri,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0,adaptiveBatch:n},ve(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function fe(){k&&Mn(En(),{pacing:Fo(te),stopCondition:{kind:"none"}})}function ss(e,r){r||e==="cancelled"?Ze(!1):re&&ce()}function P(e,r={}){let t=g;if(t){g=null,ri++;let n=Q(t),o=Uo(t,r),i=!!o;o&&(k=o.running,te=o.targetStepDuration),No(e,n,r)&&self.postMessage({type:"stepping",active:!1}),ss(e,n),r.render!==!1&&!M&&!E&&yi(),$o(r,i,k,M,E)?fe():Gr()}}function Ri(e){let r=g;r&&Q(r)&&(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),P("cancelled"))}function us(e){P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Mn(En(),e)}function xi(e,r,t){Ze(!0),Dr(e,r),yt(r,t),ve("drain")}function Ei(e,r){let t=bi(e);Rn(t);let n=c.createCommandEncoder({label:d.recordingStepBatchEncoder}),o=0,i=!1,s=t>0;for(;s;)o<t&&performance.now()<r?_i()&&ai()?(xn(n,o),si(n,b),o++,S>=C&&(s=!1)):(i=!0,s=!1):s=!1;return o>0&&(c.queue.submit([n.finish()]),Ve+=o,xr()),{steps:o,blocked:i}}function ls(e,r){let t=V(),n=e.adaptiveBatch?.generationsPerDrain??Math.round(Sr(t)*Zr(t)),o=Math.min(n,J(e,b)),i=Ci(o,t),s=i>0;Dr(e,r),Ue(e,b)?P("targetReached"):s?(Ti(e,i,performance.now()),ve("drain")):ve("raf")}function cs(e,r){Ar(!0);let t=!1,n=!1,o=performance.now()+14,i=J(e,b)>0&&performance.now()<o;for(;i;){let s=Ei(J(e,b),o);t=t||s.steps>0,s.blocked?(xi(e,r,t),n=!0,i=!1):i=s.steps>0&&J(e,b)>0&&performance.now()<o}n||(Ze(!1),Dr(e,r),yt(r,t),Ue(e,b)?P("targetReached"):ve("raf"))}function ds(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let o=e.stepAccumulator,i=Math.floor(e.stepAccumulator/r),s=V(),a=e.adaptiveBatch?.generationsPerDrain??jt(e.kind,s),l=Math.min(i,J(e,b),a),u=Ci(l,s),f=u>0;if(e.stepAccumulator=Zt(o,r,i,u,a),Dr(e,t),Ue(e,b))P("targetReached");else{let p=f&&i>u;(!Q(e)&&!p||t-e.lastRenderTime>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,F(),yt(t,f)),p&&Ti(e,u,performance.now()),ve(p?"drain":"raf")}}function fs(e,r,t){Ar(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let o=!1,i=0,s=e.stepAccumulator,a=jt(e.kind,V()),l=Math.floor(e.stepAccumulator/r),u=performance.now()+14,f=!1,p=l>0&&J(e,b)>0&&i<a&&performance.now()<u;for(;p;){let m=Math.min(l-i,a-i,J(e,b)),T=Ei(m,u);i+=T.steps,o=o||T.steps>0,T.blocked?(xi(e,t,o),f=!0,p=!1):p=T.steps>0&&l>i&&J(e,b)>0&&i<a&&performance.now()<u}e.stepAccumulator=Zt(s,r,l,i,a),f||(Ze(!1),Dr(e,t),Ue(e,b)?P("targetReached"):(Q(e)||(F(),yt(t,o)),ve("raf")))}function ps(e){let r=g;if(r&&!M&&!E)if(hi(e),Q(r)||Cn(),Ue(r,b))P("targetReached");else if(r.request.pacing.kind==="max")r.kind==="recording"?cs(r,e):ls(r,e);else{let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?fs(r,t,e):ds(r,t,e)}}function hn(e){M||E?self.requestAnimationFrame(hn):(hi(e),g||(Cn(),te>0&&!ot&&F(),self.requestAnimationFrame(hn)))}function ms(e,r){let t=c?Me():Number.POSITIVE_INFINITY;return In(r.bitsPerCell)&&Rt(r.bitsPerCell,e.tribes.length)&&xt(e,Qe(r.bitsPerCell),t)?Qe(r.bitsPerCell):An(e.tribes.length,e,t)}function Mi(e,r){let t=$n(e),n=t.topology===v?v:Gn,o=t.tribes.some(i=>i.id===t.boundaryTribe)?t.boundaryTribe:R;H={...t,topology:n,boundaryTribe:o},w=t.cols,A=t.rows,B=ms(t,r),mt=Se(w,B),Ke=[...H.tribes],ee.gridFormat=ge(),Ye.clear(),Ke.forEach((i,s)=>Ye.set(i.id,s))}async function vi(e){console.log("[GOLT worker] Initializing WebGPU"),Ee=e,c=await Wn(d.webengineDevice),E=!1,c.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),P("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),E=!0,k=!1,M=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:Me(),vramBudgetBytes:Vt(Me(),Ir()),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:ge()});let r=Ee.getContext("webgpu");if(r)st=r,Jr=navigator.gpu.getPreferredCanvasFormat(),st.configure({device:c,format:Jr,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:Jr,maxBufferSize:c.limits.maxBufferSize,maxStorageBufferBindingSize:c.limits.maxStorageBufferBindingSize});else throw new Error("WebGPU canvas context not available")}async function bs(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await vi(Ee),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),P("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),E=!0,k=!1,M=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function Bi(){$=c.createBuffer({label:d.recordingChunkBuffer,size:C*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ft(C*h,$),S=0,x=[],me=null}async function ki(){let e=C*h;be=[],X=[];for(let r=0;r<Fe;r++){let t=c.createBuffer({label:`${d.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});be.push(t),X.push(!0),await ft(e,t)}}async function gs(){await ci()}async function hs(){console.log("[GOLT worker] Building GPU resources",{cols:w,rows:A,bitsPerCell:B.bitsPerCell,recordingAvailable:de()}),sn(),ii(),await un(),ln(),cn(),dn(),fn(),mn(),pn(),await gs(),de()?(await Bi(),await ki()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:h,maxRecordingBufferBytes:Ir()}),pt(),I=!1,N=!1),await dt(),bn(),console.log("[GOLT worker] GPU resources ready")}async function Ss(){console.log("[GOLT worker] Rebuild started",{cols:w,rows:A,bitsPerCell:B.bitsPerCell}),P("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),M=!0,self.postMessage({type:"rebuilding",active:!0});try{await yn()}catch{console.warn("[GOLT worker] Queue idle wait rejected during rebuild")}let e=!E;if(E&&(e=await bs()),e){Yo(),sn(),ii(),Ko(de());try{await un(),ln(),cn(),fn(),mn(),dn(),pn(),de()?(await Bi(),await ki()):(pt(),I=!1,N=!1),await dt(),bn()}catch(r){let t=r instanceof Error?r.message:String(r);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{Yo(),sn(),Ko(!1),await un(),ln(),cn(),fn(),mn(),dn(),pn(),I=!1,N=!1,h=ht(),pt(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await dt(),bn()}catch(n){console.error("[GOLT worker] GPU rebuild recovery failed:",n),e=!1}}}return e&&(M=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:de(),frameByteSize:h})),e}function Xo(e){ot=!0,c.queue.onSubmittedWorkDone().then(()=>{ot=!1,e()}).catch(()=>{ot=!1})}async function ys(){q>0&&await new Promise(e=>{let r=setInterval(()=>{q===0&&(clearInterval(r),e())},10)})}async function _s(e){console.log("[GOLT worker] Init message received",{cols:e.ruleset.cols,rows:e.ruleset.rows,recording:e.recording,running:e.running,speed:e.speed}),I=e.recording,Mr=Mt(e.liveMetrics),N=I,Mi(e.ruleset,e.simulationGridFormat),await vi(e.canvas),await hs(),j(!0),Be(),k=e.running,te=e.speed<0?0:1e3/e.speed,k?fe():Gr()}function Ts(e){Mr=Mt(e.liveMetrics),j(!0)}async function Cs(e){console.log("[GOLT worker] Ruleset update received",{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length});let r=Me();if(Et(e.ruleset.tribes.length,e.ruleset,r))P("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Mi(e.ruleset,e.simulationGridFormat),await Ss()&&(b=0,St(),await ui(0),j(!0),k?fe():Gr());else{let o=`Requested ruleset requires at least ${wn(e.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",o,{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length,maxBytes:r}),self.postMessage({type:"gpuError",reason:o})}}function Rs(e){k=e.running,e.running?g||fe():g&&Q(g)?Ri(!1):g?P("manual"):(re&&ce(),yi(),Gr())}function xs(e){let r=te<=0,t=e.speed<0?0:1e3/e.speed;te=t,g&&!Q(g)&&k?(P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&t>0?Xo(()=>{F(),fe()}):fe()):k&&!g?fe():r&&t>0&&Xo(()=>{F(),Gr()})}function Es(e){Vo=e.scale,jo=e.offsetX,Zo=e.offsetY,!g&&!M&&!E&&F()}function Ms(e){Ee.width=e.width,Ee.height=e.height,!g&&!M&&!E&&F()}function vs(e){let r=e.tribes.map(t=>Ye.get(t)).filter(t=>t!==void 0);if(r.length>0){let t={square:0,round:1,diamond:2,vline:3,hline:4},n={full:0,spray:1,outline:2};rt={centerX:e.x,centerY:e.y,brushSize:e.size,shape:t[e.shape]??0,fill:n[e.fill]??0,density:Pn(e.density),tribeIds:r}}}function Bs(e){let r={square:0,round:1,diamond:2,vline:3,hline:4};Qo={centerX:e.x,centerY:e.y,brushSize:e.size,shape:r[e.shape]??0,visible:e.visible},!g&&!M&&!E&&te<=0&&F()}function ks(e){Jo={originX:e.origin?.originX??0,originY:e.origin?.originY??0,visible:e.visible&&e.origin!==null},!g&&!M&&!E&&te<=0&&F()}async function Ps(){try{let e=await ja();Lt({type:"snapshot",grid:e,generation:b,cols:w,rows:A,gridFormat:ge()},[e.buffer])}catch{let e=new Uint32Array(0);Lt({type:"snapshot",grid:e,generation:b,cols:w,rows:A,gridFormat:ge()},[e.buffer])}}async function Is(e){let r=Fr(e.gridFormat),t=V();if(e.grid.byteLength===ie(t,r)){let n=Kr(e.grid,t,r,B);c.queue.writeBuffer(U?O:G,0,n),b=e.generation,St(),await ui(e.generation)}}function ws(e){let r=g?.request,t=de();e.recording&&t&&!I?(I=!0,N=!0,j(!0),Be()):(!e.recording||!t)&&(e.recording&&!t&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:h,maxRecordingBufferBytes:Ir()}),I=!1,N=!1),r&&g?us(r):!g&&k&&fe()}async function As(){vr||(await yn(),Ar(!1),S>0&&wr(),q>0?vr=!0:Pr())}async function Ds(e){let r=gr(_),t=Qt(_,r,S,e.count);if(t){let n=U?O:G;if(t.source==="buffered"){let o=Wo(x,t);S=o.chunkFrameIndex,x.length=S,b=o.generation,me=b;let i=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});i.copyBufferToBuffer($,t.frameInChunk*h,n,0,h),c.queue.submit([i.finish()])}else{q>0&&(await ys(),r=gr(_));let o=_[t.sealedIndex],i=await di(o.filename,o.codec),s=V(),a=Fr(o.gridFormat),l=Jt(i,t.frameInChunk,h,s,a,B);if(c.queue.writeBuffer($,0,l.chunkPrefix),!l.sameFormat&&l.activeFrame&&c.queue.writeBuffer(n,0,l.activeFrame),S=t.frameInChunk+1,x=o.generations.slice(0,t.frameInChunk+1),b=x[t.frameInChunk],me=b,l.sameFormat){let f=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});f.copyBufferToBuffer($,t.frameInChunk*h,n,0,h),c.queue.submit([f.finish()])}let u=_.splice(t.sealedIndex);gn(u.map(f=>f.filename))}br(ee,_,x),Be(),St(),j(!0),F()}}function Gs(){Cn(),Ar(!0),!I||_i()?(is(),Ve++,I&&kr()&&(S>=C&&wr(),_n(b)),Ze(!1)):Ze(!0),j(!0),F()}function Os(e){self.postMessage({type:"stepping",active:!0}),Ar(!0),Mn(En(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:b+e},restoreAfterStop:{running:k,targetStepDuration:te}})}function Ls(e){e.count===1?Gs():Os(e.count)}function Fs(){Ri(g?.request.restoreAfterStop?.running??k)}function Us(e){let r=_.find(t=>t.filename===e.filename);r&&(r.codec=e.codec,r.storedBytes=e.storedBytes,r.gridFormat=e.gridFormat,ee.chunks=[..._],Be(),Pr())}function Ns(){let e=_.filter(r=>r.codec===Ce).map(r=>({filename:r.filename,rawBytes:r.uncompressedBytes,blockCount:r.blockCount,cols:w,rows:A,rawGridFormat:r.gridFormat,storageGridFormat:Je(Lr(H.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:e})}async function $s(e){switch(e.type){case"init":await _s(e);break;case"setLiveMetrics":Ts(e);break;case"setRuleset":await Cs(e);break;case"setRunning":Rs(e);break;case"setSpeed":xs(e);break;case"camera":Es(e);break;case"resize":Ms(e);break;case"draw":vs(e);break;case"brushPreview":Bs(e);break;case"exportFrameOverlay":ks(e);break;case"getSnapshot":await Ps();break;case"loadSnapshot":await Is(e);break;case"setRecording":ws(e);break;case"getRecording":await As();break;case"stepBack":await Ds(e);break;case"stepForward":Ls(e);break;case"cancelStepping":Fs();break;case"updateChunkCodec":Us(e);break;case"getUncompressedChunks":Ns();break}}self.onmessage=async e=>{await $s(e.data)};
