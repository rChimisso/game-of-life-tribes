var En="goltTimestampedConsoleInstalled";function Pi(){let e=globalThis;e[En]||(e[En]=!0,yt("info"),yt("warn"),yt("error"),console.log=console.info.bind(console))}function yt(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}Pi();var vn=`// Render shader: draws the grid as a full-screen quad.\r
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
`;function kn(e){return Math.min(Math.max(1,Math.floor(+e||1)),100)}var _t=[1,2,4,8,16,32],Ai={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Di={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Gi={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Gr={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Oi={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},Tt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},oe={1:Ai,2:Di,4:Gi,8:Gr,16:Oi,32:Tt};function Pn(e){return _t.includes(e)}function Li(e){return 2**e}function Ct(e,r){return r<=Li(e)}function xt(e,r,t){return ie(e,r)<=t}function Or(e){return e<=2?oe[1]:e<=4?oe[2]:e<=16?oe[4]:e<=256?oe[8]:e<=65536?oe[16]:oe[32]}function In(e){return Or(e)}function je(e){return oe[e]}function wn(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){return Rt(e,r,t)??Tt}function Rt(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of _t){let o=je(n);if(Ct(n,e)&&xt(r,o,t))return o}return null}function Lr(e){return je(e?.bitsPerCell??8)}function Ze(e){return{bitsPerCell:e.bitsPerCell}}function he(e,r){return Math.ceil(e/r.cellsPerWord)}function ie(e,r){return he(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function An(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}var Qe={population:!0,diversity:!0,interfaces:!1},Fr={enabled:!0,sections:Qe};function Fi(e){return{population:typeof e?.population=="boolean"?e.population:Qe.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Qe.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Qe.interfaces}}function Mt(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Fr.enabled,sections:Fi(e?.sections)}}var x="dead";var Dn="toroidal",v="bounded";var Gn=42,On=0,Et=4294967295,Ln=100,vt=0,Ur=100,Je=1e3,tu=vt*Je,nu=Ur*Je,er="empty",Bt="is",rr="comparison",tr="count",nr="none",or="exactly",ir="min",ar="max",ve="not",Be="and",ke="or",Pe="xor",j="tribes",kt="same",Pt="different",W="tie",Nr="fixed",Fn="same",Ie="majority",$r="minority";var sr="combine";var It={kind:er};function wt(e){let r;return Array.isArray(e)?r=`[${e.map(t=>wt(t)).join(",")}]`:e&&typeof e=="object"?r=`{${Object.entries(e).filter(([,n])=>n!==void 0).sort(([n],[o])=>n.localeCompare(o)).map(([n,o])=>`${JSON.stringify(n)}:${wt(o)}`).join(",")}}`:r=JSON.stringify(e),r}function Gt(e){let r=typeof e=="number"&&Number.isFinite(e)?e:Gn;return Math.max(On,Math.min(Et,Math.trunc(r)))}function ye(e){let r=typeof e=="number"&&Number.isFinite(e)?e:Ln,t=Math.round(r*Je)/Je;return Math.max(vt,Math.min(Ur,t))}function Un(e){return Math.floor(ye(e)/Ur*Et)}function Ui(e){let r=e&&e.length>0?e:[x];return{kind:j,tribes:[...r]}}function D(e){let r=e??Ui(void 0),t;switch(r.kind){case j:t={...r,tribes:[...r.tribes]};break;case W:t={...r,source:D(r.source)};break;default:t={...r};break}return t}function Se(e){return{kind:"count",selector:D(e?.selector)}}function Wr(e){return wt(se(e))}function se(e){let r;switch(e.kind){case j:r={...e,tribes:[...new Set(e.tribes)].sort()};break;case W:r={...e,source:se(e.source)};break;default:r=e;break}return r}function At(e){switch(e.kind){case er:return It;case tr:case nr:case or:case ir:case ar:return{...e,selector:D(e.selector)};case rr:return{...e,left:Se(e.left),right:Se(e.right),margin:e.margin??0};case ve:return{...e,clause:At(e.clause)};case Be:case ke:case Pe:{let r=e.clauses.map(t=>At(t));for(;r.length<2;)r.push(It);return{...e,clauses:r}}default:return e}}function Dt(e){let r=At(e);switch(r.kind){case ve:return{...r,clause:Dt(r.clause)};case Be:case ke:case Pe:return{...r,clauses:r.clauses.map(t=>Dt(t))};default:return r}}function ur(e){return e??{kind:Nr,tribe:x}}function ae(e){let r;switch(e.kind){case Ie:case $r:r={...e,selector:D(e.selector),tie:e.tie?ae(e.tie):void 0,fallback:e.fallback?ae(e.fallback):void 0};break;case sr:r={kind:sr,strategy:{...e.strategy,entries:e.strategy.entries.map(t=>({...t,inputs:t.inputs.map(n=>D(n)).sort((n,o)=>Wr(n).localeCompare(Wr(o)))})),default:e.strategy.default?ae(e.strategy.default):void 0}};break;default:r={...e};break}return r}function Ni(e){let r=structuredClone(e);return r.become=ae(ur(e.become)),r.probability=ye(e.probability),r}function Nn(e){return{...e,randomSeed:Gt(e.randomSeed),rules:e.rules.map(r=>$i(r))}}function $i(e){let r=Ni(e);return r.clause=Dt(r.clause),delete r.key,r.muted=!!r.muted,r.probability=ye(r.probability),r}function Ot(e,r){self.postMessage(e,r)}async function $n(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var d={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",recordingStepBatchEncoder:"recording step batch encoder",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",simulationBindGroupAtoB:"simulation bind group A to B",simulationBindGroupBtoA:"simulation bind group B to A",simulationParameterBuffer:"simulation parameter buffer",simulationParameterBindGroup:"simulation parameter bind group",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var Wn=4294967295;function Lt(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function z(e,r){return e.includes(r)}function zn(e,r,t,n){let o=e*r,i=o<=Wn,s=o*2<=Wn;return{population:Lt(t&&n.population,i),diversity:Lt(t&&n.diversity,i),interfaces:Lt(t&&n.interfaces,s)}}function Kn(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var we=256*Uint32Array.BYTES_PER_ELEMENT,Ae=Uint32Array.BYTES_PER_ELEMENT;function Yn(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function Xn(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function qn(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function Wi(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:o}=e;return`
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
${Yn(o)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Xn(o)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${qn(o)}
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
`}function zi(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:o}=e;return`
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
${Yn(o)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Xn(o)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${qn(o)}
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
`}function Ki(e,r){let{tribes:t,deadTribeIndex:n,readback:o,cols:i,rows:s}=e,a=i*s,l={};for(let f=0;f<t.length;f++){let p=r?o.histogram[f]??0:0;l[t[f].id]=p}let u=r?l[t[n]?.id??""]??0:0;return{population:l,aliveCells:r?Math.max(0,a-u):0,deadCells:u}}function Yi(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,o=0;for(let i=0;i<r.length;i++)i!==t&&(o+=n.histogram[i]??0);return o}function Xi(e,r){let{tribes:t,deadTribeIndex:n,readback:o}=e,i=r?Yi(e):0,s=0,a=0;for(let l=0;l<t.length;l++){let u=l!==n&&i>0?(o.histogram[l]??0)/i:0;u>0&&(s-=u*Math.log2(u),a+=u*u)}return{shannonEntropy:s,simpsonSum:a}}function qi(e,r){let t=e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,o=r?Math.max(0,t-n):0;return{sameStateContactEdges:o,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?o/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function Hn(e){let{device:r}=e,t=r.createShaderModule({label:d.histogramMetricsShaderModule,code:Wi(e)}),n=r.createComputePipeline({label:d.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),o=r.createBuffer({label:d.histogramMetricsBuffer,size:we,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),i=r.createBuffer({label:d.histogramMetricsReadBuffer,size:we,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=r.createShaderModule({label:d.interfaceMetricsShaderModule,code:zi(e)}),a=r.createComputePipeline({label:d.interfaceMetricsPipeline,layout:"auto",compute:{module:s,entryPoint:"main"}}),l=r.createBuffer({label:d.interfaceMetricsBuffer,size:Ae,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),u=r.createBuffer({label:d.interfaceMetricsReadBuffer,size:Ae,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:o,histogramReadBuffer:i,boundaryPipeline:a,boundaryBuffer:l,boundaryReadBuffer:u}}function Vn(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function jn(e){let{device:r,encoder:t,resources:n,sourceBuffer:o,dispatchPlan:i,enabledSections:s}=e;if(z(s,"population")||z(s,"diversity")){let a=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,a);let l=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),u=t.beginComputePass({label:d.histogramMetricsPass});u.setPipeline(n.histogramPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(i.dispatchWgX,i.dispatchWgY),u.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,we)}if(z(s,"interfaces")){let a=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,a);let l=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),u=t.beginComputePass({label:d.interfaceMetricsPass});u.setPipeline(n.boundaryPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(i.dispatchWgX,i.dispatchWgY),u.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Ae)}}async function Zn(e){let{resources:r,enabledSections:t}=e,n=z(t,"population")||z(t,"diversity"),o=z(t,"interfaces"),i=[];n&&i.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),o&&i.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(i);let s=new Uint32Array(256);n&&(s=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let a=0;if(o){let l=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),a=l[0]??0}return{histogram:s,crossStateContactEdges:a}}function Qn(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:o,cols:i,rows:s,totalFrames:a,fps:l,canStepBack:u,recordingBytes:f,recordingRawBytes:p}=e,m=z(t,"population")&&o.population,T=z(t,"diversity")&&o.diversity,L=z(t,"interfaces")&&o.interfaces,y=i*s,ne=Ki(e,m),ge=Xi(e,T),ki=qi(e,L);return{type:"metrics",generation:r,population:ne.population,aliveCells:ne.aliveCells,deadCells:ne.deadCells,occupancy:m&&y>0?ne.aliveCells/y:0,shannonEntropy:ge.shannonEntropy,simpsonIndex:T?1-ge.simpsonSum:0,interfaces:ki,metricsAvailability:n,extinctionTime:{},totalFrames:a,fps:l,canStepBack:u,recordingBytes:f,recordingRawBytes:p}}function Hi(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}function Jn(e,r,t,n,o){let i=he(r.cols,t),s=e[o*i+(n>>t.wordShift)]??0;return Hi(s,t,n&t.cellIndexMask)}function eo(e,r,t,n,o,i){let s=he(r.cols,t),a=o*s+(n>>t.wordShift),l=(n&t.cellIndexMask)<<t.cellShift,u=~(t.cellMask<<l),f=e[a]??0;e[a]=(f&u|(i&t.cellMask)<<l)>>>0}var Vi=64*1024*1024,Gu=256*1024*1024;function zr(e,r,t,n){let o=e,i;if(t.bitsPerCell===n.bitsPerCell)i=e;else{i=new Uint32Array(ie(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let s=0;s<r.rows;s++)for(let a=0;a<r.cols;a++)eo(i,r,n,a,s,Jn(o,r,t,a,s))}return i}function ji(e,r,t){let n=Math.floor((r-1)/2),o=e-n,i=o+r,s=[];if(o>=0&&i<=t)s.push({destinationStart:o,localStart:0,span:r});else if(o<0){let a=-o;s.push({destinationStart:t-a,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:r-a})}else{let a=t-o;s.push({destinationStart:o,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:i-t})}return s.filter(a=>a.span>0)}function Zi(e,r,t){let n=e-Math.floor((r-1)/2),o=Math.max(0,n),i=Math.min(t,n+r),s=Math.max(0,i-o),a=[];return s>0&&a.push({destinationStart:o,localStart:o-n,span:s}),a}function ro(e){return`
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
`}function to(e,r,t,n,o){let i=o===v?Zi:ji,s=i(e,t,n.cols),a=i(r,t,n.rows),l=[];for(let u of a)for(let f of s)l.push({destinationStartX:f.destinationStart,destinationStartY:u.destinationStart,localStartX:f.localStart,localStartY:u.localStart,spanCols:f.span,spanRows:u.span});return l}var no={"=":"==","\u2260":"!=",">":">","<":"<","\u2265":">=","\u2264":"<="};function Qi(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function Ji(e,r){e.push(`const CELLS_PER_WORD: u32 = ${r.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${r.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${r.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${r.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${r.cellMask}u;`)}function ea(e){e.push("struct SimulationParams {"),e.push("  generation: u32,"),e.push("  _pad0: u32,"),e.push("  _pad1: u32,"),e.push("  _pad2: u32,"),e.push("};"),e.push("@group(1) @binding(0) var<uniform> simulationParams: SimulationParams;"),e.push(""),e.push("fn probabilityHash(x: u32, y: u32, generation: u32, ruleIndex: u32, randomSeed: u32) -> u32 {"),e.push("  var h = x * 0x9e3779b9u;"),e.push("  h = h ^ (y * 0x85ebca6bu);"),e.push("  h = h ^ (generation * 0xc2b2ae35u);"),e.push("  h = h ^ (ruleIndex * 0x27d4eb2fu);"),e.push("  h = h ^ randomSeed;"),e.push("  h = (h ^ (h >> 16u)) * 0x7feb352du;"),e.push("  h = (h ^ (h >> 15u)) * 0x846ca68bu;"),e.push("  return h ^ (h >> 16u);"),e.push("}")}function ra(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function ta(e,r){e.push("fn readBoundedCell(x: i32, y: i32) -> u32 {"),e.push("  if (x < 0i || y < 0i || x >= i32(COLS) || y >= i32(ROWS)) {"),e.push(`    return ${r}u;`),e.push("  }"),e.push("  return readCell(u32(x), u32(y));"),e.push("}")}function na(e,r,t){r.remapped?(e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;")):(e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;"))}function oa(e){let r=Sa(e),t=new Map,n=0;for(let o of r)t.set(o,`count_${n++}`);return t}function ia(e,r){let t=ya(e),n=new Map,o=0;for(let i of t){let s=r.get(i);s?n.set(i,s):n.set(i,`eq_count_${o++}`)}return n}function aa(e,r,t,n){for(let[o,i]of r)e.push(`  let ${i} = ${Nt(fo(o),t,n)};`);r.size>0&&e.push("")}function sa(e,r,t,n,o){let i=0;for(let[s,a]of t)r.has(s)||(e.push(`  let ${a} = ${Nt(fo(s),n,o)};`),i++);i>0&&e.push("")}function ua(e,r,t,n,o,i,s){s?ca(e,r,t,n,o,i):la(e,r,t,n,o,i)}function la(e,r,t,n,o,i){for(let s=0;s<r.length;s++){let{rule:a}=r[s],l=De(a.clause,t,n,o,i);e.push(s===0?`  if (${l}) {`:`  } else if (${l}) {`),cr(e,ae(ur(a.become)),o,i,`rule_${s}`,"    ")}r.length>0&&e.push("  }"),e.push("")}function ca(e,r,t,n,o,i){e.push("  var applied = false;");for(let s=0;s<r.length;s++){let a=r[s],{rule:l,probability:u,priorityIndex:f}=a,p=De(l.clause,t,n,o,i);e.push(`  if (!applied && ${p}) {`),u===100?(cr(e,ae(ur(l.become)),o,i,`rule_${s}`,"    "),e.push("    applied = true;")):(e.push(`    if (probabilityHash(x, y, generation, ${f}u, RANDOM_SEED) < ${Un(u)}u) {`),cr(e,ae(ur(l.become)),o,i,`rule_${s}`,"      "),e.push("      applied = true;"),e.push("    }")),e.push("  }")}e.push("")}function cr(e,r,t,n,o,i,s=null){switch(r.kind){case Nr:e.push(`${i}result = ${K(r.tribe,n)}u;`);break;case Fn:e.push(`${i}result = selfTribe;`);break;case Ie:case $r:da(e,r,t,n,o,i);break;case sr:fa(e,r,t,n,o,i,s);break}}function da(e,r,t,n,o,i){let s=D(r.selector),a=`${o}_${r.kind}`,l=`${o}_${r.kind}_count`,u=`${o}_${r.kind}_ties`,f=r.kind===Ie?"0u":"9u",p=r.kind===Ie?`candidateCount > ${l}`:`candidateCount < ${l}`;e.push(`${i}var ${a}: u32 = ${K(x,n)}u;`),e.push(`${i}var ${l}: u32 = ${f};`),e.push(`${i}var ${u}: u32 = 0u;`);for(let m of qr(s,t,n)){let T=Z(y=>`${y} == ${m}u`),L=Ge(s,m,n);e.push(`${i}{`),e.push(`${i}  let candidateCount = ${T};`),e.push(`${i}  if (${L} && candidateCount > 0u) {`),e.push(`${i}    if (${p}) {`),e.push(`${i}      ${a} = ${m}u;`),e.push(`${i}      ${l} = candidateCount;`),e.push(`${i}      ${u} = 1u;`),e.push(`${i}    } else if (candidateCount == ${l}) {`),e.push(`${i}      ${u} = ${u} + 1u;`),e.push(`${i}    }`),e.push(`${i}  }`),e.push(`${i}}`)}e.push(`${i}if (${u} == 1u) {`),e.push(`${i}  result = ${a};`),e.push(`${i}} else if (${u} > 1u) {`),r.tie?cr(e,r.tie,t,n,`${o}_tie`,`${i}  `,{selector:s,bestCountVar:l,tieCountVar:u}):Xr(e,r.fallback,t,n,`${o}_tie_fallback`,`${i}  `),e.push(`${i}} else {`),Xr(e,r.fallback,t,n,`${o}_fallback`,`${i}  `),e.push(`${i}}`)}function Xr(e,r,t,n,o,i){r?cr(e,r,t,n,o,i):e.push(`${i}result = ${K(x,n)}u;`)}function fa(e,r,t,n,o,i,s){let a=`${o}_input_mask`;e.push(`${i}var ${a}: u32 = 0u;`);for(let p of ba(t,n,s)){let m=uo(p,n,s);e.push(`${i}if (${m}) {`),e.push(`${i}  ${a} = ${a} | ${lo(p)};`),e.push(`${i}}`)}let l=`${o}_dead_present`,u=Z(p=>`${p} == ${K(x,n)}u`);e.push(`${i}let ${l} = ${u} > 0u;`);let f=[...r.strategy.entries].sort((p,m)=>Number(Ft(m,n))-Number(Ft(p,n)));f.forEach((p,m)=>{let T=ga(p.inputs,t,n,s),L=Ft(p,n)?` && ${l}`:"",y=`${a} == (${T})${L}`;e.push(m===0?`${i}if (${y}) {`:`${i}} else if (${y}) {`),e.push(`${i}  result = ${K(p.output,n)}u;`)}),f.length>0?(e.push(`${i}} else {`),Xr(e,r.strategy.default,t,n,`${o}_fallback`,`${i}  `),e.push(`${i}}`)):Xr(e,r.strategy.default,t,n,`${o}_fallback`,i)}function oo(e){for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(`    var ${$t(t,r)}: u32;`)}function Kr(e,r,t){for(let n=-1;n<=1;n++)for(let o=-1;o<=1;o++)if(!(o===0&&n===0)){let i=$t(o,n),s;r==="toroidal"?s=`readCell(${io("x",o,"COLS")}, ${io("y",n,"ROWS")})`:r==="boundedDirect"?s=`readCell(${ao("x",o)}, ${ao("y",n)})`:s=`readBoundedCell(${so("x",o)}, ${so("y",n)})`,e.push(`${t}${i} = ${s};`)}}function Nt(e,r,t){let n=se(e),o;switch(n.kind){case kt:o=Z(i=>`${i} == selfTribe`);break;case Pt:o=Z(i=>`${i} != selfTribe`);break;case W:o=Nt(n.source,r,t);break;case j:{let i=dr(n.tribes,t);o=i.length===0?"0u":Z(s=>i.map(a=>`${s} == ${a}u`).join(" || "));break}}return o}function Z(e){return pa().map(r=>`select(0u, 1u, ${e(r)})`).join(" + ")}function $t(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function pa(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push($t(t,r));return e}function io(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function ao(e,r){let t=e;return r===-1?t=`${e} - 1u`:r===1&&(t=`${e} + 1u`),t}function so(e,r){let t=`i32(${e})`;return r===-1?t=`i32(${e}) - 1i`:r===1&&(t=`i32(${e}) + 1i`),t}function dr(e,r){let t=[];for(let n of e)t.push(fr(n,r,"selector"));return[...new Set(t)]}function K(e,r){return fr(e,r,"target")}function fr(e,r,t){let n=r.get(e),o=r.get(x)??0;return n===void 0&&console.error(`Unknown rule ${t} tribe; using dead tribe instead.`,{tribe:e}),n??o}function qr(e,r,t){let n=se(e),o;switch(n.kind){case j:o=dr(n.tribes,t);break;case W:o=qr(n.source,r,t);break;default:o=r.map(i=>fr(i.id,t,"selector"));break}return[...new Set(o)].sort((i,s)=>i-s)}function Ge(e,r,t){let n=se(e),o;switch(n.kind){case kt:o=`selfTribe == ${r}u`;break;case Pt:o=`selfTribe != ${r}u`;break;case W:o=Ge(n.source,r,t);break;case j:{o=dr(n.tribes,t).includes(r)?"true":"false";break}}return o}function ma(e,r,t,n){let o=se(e),i;if(o.kind===W&&n){let s=Z(l=>`${l} == ${r}u`),a=Ge(n.selector,r,t);i=`(${n.tieCountVar} > 1u && ${n.bestCountVar} > 0u && ${a} && ${s} == ${n.bestCountVar})`}else{let s=Z(l=>`${l} == ${r}u`);i=`(${Ge(o.kind===W?o.source:o,r,t)} && ${s} > 0u)`}return i}function ba(e,r,t){let n;return t?n=qr(t.selector,e,r):n=e.map(o=>fr(o.id,r,"selector")),[...new Set(n)].filter(o=>o!==K(x,r)).sort((o,i)=>o-i)}function uo(e,r,t){let n;if(t){let o=Z(s=>`${s} == ${e}u`),i=Ge(t.selector,e,r);n=`(${e}u != ${K(x,r)}u && ${t.tieCountVar} > 1u && ${t.bestCountVar} > 0u && ${i} && ${o} == ${t.bestCountVar})`}else{let o=Z(i=>`${i} == ${e}u`);n=`(${e}u != ${K(x,r)}u && ${o} > 0u)`}return n}function ga(e,r,t,n){let o=[];for(let i of e){let s=D(i);for(let a of qr(s,r,t))if(a!==K(x,t)){let l=ha(s,a,t,n);o.push(`select(0u, ${lo(a)}, ${l})`)}}return o.length>0?o.join(" | "):"0u"}function Ft(e,r){let t=K(x,r);return e.inputs.some(n=>{let o=D(n);return o.kind===j&&dr(o.tribes,r).includes(t)})}function ha(e,r,t,n){let o=se(e),i;if(n){let s=uo(r,t,n),a=Ge(o.kind===W?o.source:o,r,t);i=`(${s} && ${a})`}else i=ma(o,r,t,null);return i}function lo(e){return`(1u << ${e}u)`}function co(e){return Wr(e)}function fo(e){return JSON.parse(e)}function po(e,r){let t=new Set,n=i=>{t.add(co(i))},o=i=>{switch(r(i,n),i.kind){case ve:o(i.clause);break;case Be:case ke:case Pe:for(let s of i.clauses)o(s);break}};for(let i of e)o(i);return t}function Sa(e){return po(e,(r,t)=>{switch(r.kind){case nr:case or:t(D(r.selector));break;case ir:Yr(r.value,8)||t(D(r.selector));break;case ar:Yr(0,r.value)||t(D(r.selector));break;case tr:Yr(r.interval[0],r.interval[1])||t(D(r.selector));break}})}function ya(e){return po(e,(r,t)=>{r.kind===rr&&(t(Se(r.left).selector),t(Se(r.right).selector))})}function De(e,r,t,n,o){switch(e.kind){case er:return"false";case Bt:return _a(e.tribes,n,o);case tr:return lr(e.selector,r,e.interval[0],e.interval[1]);case nr:return lr(e.selector,r,0,0);case or:return lr(e.selector,r,e.value,e.value);case ir:return lr(e.selector,r,e.value,8);case ar:return lr(e.selector,r,0,e.value);case rr:return Ca(e,t);case ve:return`!(${De(e.clause,r,t,n,o)})`;case Be:return`(${e.clauses.map(i=>De(i,r,t,n,o)).join(" && ")})`;case ke:return`(${e.clauses.map(i=>De(i,r,t,n,o)).join(" || ")})`;case Pe:return xa(e.clauses,r,t,n,o);default:return"false"}}function _a(e,r,t){let n=dr(e,t);return n.length===0?"false":n.length===r.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}function lr(e,r,t,n){let o;return Yr(t,n)?o="true":o=Ta(Ut(D(e),r),t,n),o}function Yr(e,r){return e<=0&&r>=8}function Ta(e,r,t){switch(!0){case r===t:return`${e} == ${r}u`;case r<=0:return`${e} <= ${t}u`;case t>=8:return`${e} >= ${r}u`;default:return`(${e} >= ${r}u && ${e} <= ${t}u)`}}function Ca(e,r){let t=Se(e.left).selector,n=Se(e.right).selector,o=no[e.operator]??"==",i=Math.max(-8,Math.min(8,e.margin??0));return`(i32(${Ut(t,r)}) ${o} (i32(${Ut(n,r)}) + ${i}i))`}function xa(e,r,t,n,o){return`(((${e.map(i=>De(i,r,t,n,o)).map(i=>`select(0u, 1u, ${i})`).join(" + ")}) & 1u) == 1u)`}function Ut(e,r){return r.get(co(e))}function Wt(e,r,t){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,o=Math.min(n,t),i=Math.ceil(n/o);if(i<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:o,dispatchWgY:i,remapped:!0};throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`)}function mo(e,r,t,n,o,i,s){let a=[],l=e.rules.map((y,ne)=>({rule:y,priorityIndex:ne,probability:ye(y.probability)})).filter(y=>!y.rule.muted&&y.probability>0),u=l.some(y=>y.probability>0&&y.probability<100),f=s.get(x)??0,p=e.topology===v,m=fr(e.boundaryTribe??x,s,"boundary"),T=oa(l.map(y=>y.rule.clause)),L=ia(l.map(y=>y.rule.clause),T);return a.push("// Auto-generated simulation compute shader."),a.push(`// Tribes: ${r.map(y=>y.id).join(", ")}`),a.push(`// Rules: ${e.rules.length}`),a.push(""),a.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),a.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),u&&(a.push(""),ea(a)),a.push(""),a.push(`const COLS: u32 = ${n.cols}u;`),a.push(`const ROWS: u32 = ${n.rows}u;`),a.push(`const PACKED_COLS: u32 = ${t}u;`),u&&a.push(`const RANDOM_SEED: u32 = ${Gt(e.randomSeed)}u;`),Qi(a,o),Ji(a,i),a.push(""),ra(a,"gridIn","PACKED_COLS"),p&&(a.push(""),ta(a,m)),a.push(""),u?a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32, x: u32, y: u32, generation: u32) -> u32 {"):a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {"),aa(a,T,r,s),sa(a,T,L,r,s),a.push(`  var result: u32 = ${f}u;`),a.push(""),ua(a,l,T,L,r,s,u),a.push("  return result;"),a.push("}"),a.push(""),a.push("@compute @workgroup_size(16, 16)"),o.remapped?a.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):a.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),na(a,o,"px"),a.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),a.push(""),a.push("  let baseX = px << WORD_SHIFT;"),p&&a.push("  let interiorPackedWord = y > 0u && y + 1u < ROWS && baseX > 0u && baseX + CELLS_PER_WORD < COLS;"),a.push("  var packed: u32 = 0u;"),a.push(""),a.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),a.push("    let x = baseX + i;"),a.push("    if (x >= COLS) { break; }"),a.push(""),a.push("    let selfTribe = readCell(x, y);"),p?(oo(a),a.push("    if (interiorPackedWord) {"),Kr(a,"boundedDirect","      "),a.push("    } else {"),a.push("      let interiorCell = x > 0u && y > 0u && x + 1u < COLS && y + 1u < ROWS;"),a.push("      if (interiorCell) {"),Kr(a,"boundedDirect","        "),a.push("      } else {"),Kr(a,"boundedVirtual","        "),a.push("      }"),a.push("    }")):(oo(a),Kr(a,"toroidal","    ")),a.push(""),u?a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR, x, y, simulationParams.generation) & CELL_MASK) << (i << CELL_SHIFT));"):a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),a.push("  }"),a.push(""),a.push("  gridOut[y * PACKED_COLS + px] = packed;"),a.push("}"),a.join(`
`)}var Oe=3,pr="gol-recording",_e="raw-packed",zt="deflate-raw",Kt=12,Yt=256*1024*1024,bo=512*1024*1024;function Xt(e,r,t=0){let n=t;for(let o of e)n+=o[r];return n}function go(e,r){return Math.min(e,r)}function qt(e){return Math.min(e,1073741824)}function ho(e){return Math.min(e,bo)}function Ht(e,r){return Math.max(e*2,r*6)}function Hr(e,r){return e>0&&e<=r}function Ea(e,r){return e>0?e*2+r:0}function va(e,r){return e>=1&&r>0?e*r*(1+Oe):0}function Ba(e,r){return e<Yt?Math.min(Yt,r):e}function So(e,r){return Hr(e,r)?Math.max(1,Math.floor(Ba(e,r)/e)):0}function Vr(e,r){return e>=1&&r>0?Math.max(1,Math.min(Kt,Math.floor(536870912/(e*r)))):Kt}function yo(e,r,t,n,o,i){let s=!r.some(l=>l)&&(o||i>=e),a=o?Math.floor(n/2)+1:n;return e>=1&&r.length>0&&(s||t>=a)}function _o(e,r,t,n){return e<r&&n.some((o,i)=>t[i]&&o.mapState==="unmapped")}function To(e,r,t,n,o,i){return e&&r>=1&&t!==null&&n.length>0&&(o<r||i)}function Co(e,r,t,n){let o=e.quota??0,i=e.usage??0,s=0,a=0;for(let f of r)f.codec===_e?s+=f.storedBytes:a+=f.storedBytes;let l=t*n,u=(1+Oe)*l;return{quotaBytes:o,usedBytes:i,pendingRawBytes:s,compressedBytes:a,reservedBytes:u}}function xo(e,r,t,n,o){let i=qt(e);return{maxBytes:e,vramBudgetBytes:Ht(e,i),frameByteSize:r,recordingAvailable:Hr(r,i),vramSimulationBytes:Ea(r,n),vramRecordingBytes:va(t,r),gridFormat:o}}function mr(e,r,t){r.length>0&&(e.generationStart=r[0].generationStart,e.generationEnd=r[r.length-1].generationEnd),t.length>0&&(r.length===0&&(e.generationStart=t[0]),e.generationEnd=t[t.length-1]),e.chunks=[...r]}function Ro(e){return e.map(r=>({...r,generations:[...r.generations]}))}function Mo(e,r){return e!==r}function br(e,r=0){return Xt(e,"blockCount",r)}function Eo(e){return Xt(e,"storedBytes")}function vo(e){return Xt(e,"uncompressedBytes")}var ka=256,gr=96,Bo=ka*Uint32Array.BYTES_PER_ELEMENT;function Pa(e){return e===v?"  return i32(cell) - center;":"  return signedWrapDelta(cell, center, size);"}function Ia(e){return e===v?"  return world - f32(center);":"  return signedWrapWorldDelta(world, center, size);"}function wa(e){return e===v?`  let ix = min(u.grid_size.x - 1u, u.offset_cell.x + u32(local.x));
  let iy = min(u.grid_size.y - 1u, u.offset_cell.y + u32(local.y));`:`  let ix = wrapAdd(u.offset_cell.x, u32(local.x), u.grid_size.x);
  let iy = wrapAdd(u.offset_cell.y, u32(local.y), u.grid_size.y);`}function Aa(e){return`  if (u.export_visible == 1u) {
    if (exportCenterMarkerMask(local) || ${e===v?"exportBoundedCornerMarkerMask(local)":"exportOriginMarkerMask(local)"}) {
      return vec4f(0.0, 0.0, 0.0, 1.0);
    }

    if (exportCenterMarkerOutlineMask(local) || ${e===v?"exportBoundedCornerMarkerOutlineMask(local)":"exportOriginMarkerOutlineMask(local)"}) {
      return vec4f(0.82, 0.84, 0.86, 1.0);
    }
  }`}function ko(e){let r=new ArrayBuffer(gr),t=new Float32Array(r),n=new Int32Array(r),o=new Uint32Array(r),i=e.topology===v?e.offsetX:(e.offsetX%e.grid.cols+e.grid.cols)%e.grid.cols,s=e.topology===v?e.offsetY:(e.offsetY%e.grid.rows+e.grid.rows)%e.grid.rows,a=Math.floor(i),l=Math.floor(s);return t[0]=e.canvasWidth,t[1]=e.canvasHeight,t[2]=e.scale,t[4]=i-a,t[5]=s-l,o[6]=e.grid.cols,o[7]=e.grid.rows,o[8]=a,o[9]=l,o[10]=e.tribeCount,n[12]=e.brushPreview.centerX,n[13]=e.brushPreview.centerY,o[14]=e.brushPreview.brushSize,o[15]=e.brushPreview.shape,o[16]=e.brushPreview.visible?1:0,o[17]=e.exportFrameOverlay.originX,o[18]=e.exportFrameOverlay.originY,o[19]=e.exportFrameOverlay.visible?1:0,o[20]=e.topology===v?1:0,r}function Po(e){let r=new Uint32Array(e.length);for(let t=0;t<e.length;t++){let n=e[t].color,o=parseInt(n.substring(0,2),16),i=parseInt(n.substring(2,4),16),s=parseInt(n.substring(4,6),16);r[t]=o|i<<8|s<<16}return r}function Io(e,r,t){return e.replace("__CELLS_PER_WORD__",`${r.cellsPerWord}u`).replace("__WORD_SHIFT__",`${r.wordShift}u`).replace("__CELL_SHIFT__",`${r.cellShift}u`).replace("__CELL_INDEX_MASK__",`${r.cellIndexMask}u`).replace("__CELL_MASK__",`${r.cellMask}u`).replace("__SIGNED_GRID_DELTA_BODY__",Pa(t)).replace("__SIGNED_GRID_WORLD_DELTA_BODY__",Ia(t)).replace("__GRID_COORDINATE_ASSIGNMENTS__",wa(t)).replace("__EXPORT_OVERLAY_BLOCK__",Aa(t))}var Da=500,Ga=33,Oa=2,La=.5,wo=.2,Ao=1,Fa=1048576;function Do(e){return Math.min(3,Math.max(0,Math.ceil(Math.log10(e.cols*e.rows/1e5))))}function hr(e){return 1024/4**Do(e)}function jr(e){return 16/2**Do(e)}function Ua(e){return Math.max(Ao,Math.round(hr(e)*jr(e)))}function Go(e,r){return{generationsPerDrain:Ua(e),targetDrainMs:r.kind==="max"?Da:Ga,smoothedDrainMs:0,lastDrainStartedAt:0,lastSubmittedGenerations:0}}function Oo(e,r){if(r>0&&e.lastSubmittedGenerations>0){let t=e.smoothedDrainMs===0?r:e.smoothedDrainMs*(1-wo)+r*wo,n=Math.min(Oa,Math.max(La,e.targetDrainMs/t));e.smoothedDrainMs=t,e.generationsPerDrain=Math.max(Ao,Math.min(Fa,Math.round(e.generationsPerDrain*n)))}}function Vt(e,r){return e==="recording"?Number.MAX_SAFE_INTEGER:hr(r)*jr(r)}function jt(e,r,t,n,o){let i=e-r*n;return t>n||t>o?Math.min(i,r):i}function Lo(e){return e<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/e}}function Q(e){return e.request.stopCondition.kind==="targetGeneration"}function Le(e,r){return e.request.stopCondition.kind==="targetGeneration"&&r>=e.request.stopCondition.generation}function J(e,r){return e.request.stopCondition.kind==="targetGeneration"?Math.max(0,e.request.stopCondition.generation-r):Number.POSITIVE_INFINITY}function Fo(e,r){return r.restore!==!1&&e.request.restoreAfterStop||null}function Uo(e,r,t){return r&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")}function No(e,r,t,n,o){return e.restartRestoredRun!==!1&&r&&t&&!n&&!o}function Zt(e,r,t,n){let o=r+t,i=Math.min(n,o-1);if(i<=0)return null;let s=o-1-i;if(s>=r)return{source:"buffered",frameInChunk:s-r};let a=0;for(let l=0;l<e.length;l++){let u=e[l];if(s<a+u.blockCount)return{source:"sealed",sealedIndex:l,frameInChunk:s-a};a+=u.blockCount}return null}function $o(e,r){return{chunkFrameIndex:r.frameInChunk+1,generation:e[r.frameInChunk]}}function Qt(e,r,t,n,o,i){let s=(r+1)*t;if(o.bitsPerCell===i.bitsPerCell)return{sameFormat:!0,chunkPrefix:new Uint8Array(e,0,s),activeFrame:null};let a=ie(n,o),l=new Uint8Array(s);for(let u=0;u<=r;u++){let f=new Uint8Array(e,u*a,a),p=zr(An(f),n,o,i);l.set(new Uint8Array(p.buffer,p.byteOffset,p.byteLength),u*t)}return{sameFormat:!1,chunkPrefix:l,activeFrame:l.subarray(r*t,s)}}var c,M=!1,at,Qr,xe,q,w=0,A=0,pt=0,B=Gr,We=[],ze=new Map,rn,tn,G,O,Ke,Ue,Rr,nn,on,yr,Xo,qo,Ye=!1,Xe=null,st=[],$e=0,U=!1,Ho=1,Vo=0,jo=0,k=!1,E=!1,te=100,b=0,qe=0,Sr=0,mt=0,Jr,Na=4,hn=192,He=1024,Wo=16,Ce=[],ut=[],lt=[],$a=0,et=null,Zo={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},Qo={originX:0,originY:0,visible:!1},fe=null,rt=-1,Ne=!1,_r=!1,Jt=0,Mr=Fr,tt=[],I=!1,N=!1,ee={chunks:[],generationStart:0,generationEnd:0,gridFormat:Ze(Gr)},Jo=0,_=[],Er=!1,g=null,ei=0,nt=!1,$=null,S=0,R=[],pe=null,C=64,h=0,me=[],Y=[],Tr=null,Te=null,X=0,vr=0,ue=0,re=!1,Fe=0,ot=0,it=0,Cr=[];function ri(e){switch(!0){case e instanceof Error:return e.message;case typeof e=="string":return e;case(e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"):return e.message;default:return String(e??"Unknown worker error")}}function bt(e){console.error("[GOLT worker] Worker GPU error:",e),P("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),k=!1,self.postMessage({type:"gpuError",reason:ri(e)})}self.addEventListener("error",e=>{e.preventDefault(),bt(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),bt(e.reason)});async function Sn(){await c.queue.onSubmittedWorkDone()}function zo(e){ot=0,it=2+(e?1+Oe:0),Cr=[]}async function ct(){if(Cr.length>0){let e=c.createCommandEncoder({label:d.trackedAllocationClearEncoder});for(let r of Cr)e.clearBuffer(r);c.queue.submit([e.finish()]),await Sn(),Cr=[]}}async function dt(e,r){E&&it>0&&(ot+=e,it--,Cr.push(r),ot>=ho(Re())&&it>0&&(await ct(),ot=0))}function ft(){$?.destroy(),$=null;for(let e of me)e?.destroy();me=[],Y=[],C=0,S=0,R=[],pe=null,vr=0}function ti(){Xe?.destroy(),Xe=null,st=[],$e=0}function Ko(){G?.destroy(),O?.destroy(),ti(),Vn(fe),fe=null,Ce.forEach(e=>e.destroy()),Ce=[],ut=[],lt=[],ft()}function Zr(e){let r=X>0;X+=e;let t=X>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function le(){let e=yo(C,Y,ue,Vr(C,h),re,S);e!==re&&(re=e,self.postMessage({type:"backpressure",active:e}))}async function Ee(){self.postMessage({type:"storageQuota",...Co(await navigator.storage.estimate(),_,C,h)})}function Re(){return go(c.limits.maxBufferSize,c.limits.maxStorageBufferBindingSize)}function Pr(){return qt(Re())}function ce(){return Hr(h,Pr())}function ni(){return _o(ue,Vr(C,h),Y,me)}function Br(){return To(ce(),C,$,me,S,ni())}async function Wa(e){let r=new DecompressionStream(zt),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],o=r.readable.getReader();for(;;){let{done:l,value:u}=await o.read();if(l)break;n.push(u)}let i=0;for(let l of n)i+=l.byteLength;let s=new Uint8Array(i),a=0;for(let l of n)s.set(l,a),a+=l.byteLength;return s.buffer}function H(){return{cols:w,rows:A}}function za(){return Wt(Math.ceil(pt/16),Math.ceil(A/16),c.limits.maxComputeWorkgroupsPerDimension)}function Ka(){return Wt(Math.ceil(w/16),Math.ceil(A/16),c.limits.maxComputeWorkgroupsPerDimension)}function an(){Ke?.destroy(),Ke=c.createBuffer({label:d.uniformBuffer,size:gr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Ya(){let e=ko({canvasWidth:xe.width,canvasHeight:xe.height,scale:Ho,offsetX:Vo,offsetY:jo,grid:H(),topology:q.topology,tribeCount:We.length,brushPreview:Zo,exportFrameOverlay:Qo});c.queue.writeBuffer(Ke,0,e)}function gt(){return ie({cols:w,rows:A},B)}function be(){return Ze(B)}async function sn(){let e=gt();G=c.createBuffer({label:d.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await dt(e,G),O=c.createBuffer({label:d.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await dt(e,O);let r=c.createCommandEncoder({label:d.gridClearEncoder});r.clearBuffer(G),r.clearBuffer(O),c.queue.submit([r.finish()]),U=!1}function un(){let e=Po(We);Ue&&Ue.destroy(),Ue=c.createBuffer({label:d.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),c.queue.writeBuffer(Ue,0,e)}function ln(){let e=q.topology,r=c.createShaderModule({label:`${d.renderShaderModule} (${e})`,code:Io(vn,B,e)});Rr=c.createRenderPipeline({label:`${d.renderPipeline} (${e})`,layout:"auto",vertex:{module:r,entryPoint:"vs_main"},fragment:{module:r,entryPoint:"fs_main",targets:[{format:Qr}]},primitive:{topology:"triangle-list"}})}function cn(){nn=c.createBindGroup({layout:Rr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ke}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:Ue}}]}),on=c.createBindGroup({layout:Rr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ke}},{binding:1,resource:{buffer:O}},{binding:2,resource:{buffer:Ue}}]})}function Xa(){return q.rules.some(e=>{let r=ye(e.probability);return!e.muted&&r>0&&r<100})}function qa(){$e=Math.max(Wo,c.limits.minUniformBufferOffsetAlignment),Xe=c.createBuffer({label:d.simulationParameterBuffer,size:$e*He,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),st=[];let e=yr.getBindGroupLayout(1);for(let r=0;r<He;r++)st.push(c.createBindGroup({label:`${d.simulationParameterBindGroup} ${r}`,layout:e,entries:[{binding:0,resource:{buffer:Xe,offset:r*$e,size:Wo}}]}))}function dn(){ti(),rn=za(),Ye=Xa();let e=mo(q,We,pt,H(),rn,B,ze),r=c.createShaderModule({label:d.simulationShaderModule,code:e});yr=c.createComputePipeline({label:d.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),Xo=c.createBindGroup({label:d.simulationBindGroupAtoB,layout:yr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:O}}]}),qo=c.createBindGroup({label:d.simulationBindGroupBtoA,layout:yr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}},{binding:1,resource:{buffer:G}}]}),Ye&&(qa(),console.info("[GOLT worker] Probabilistic rule compute path enabled",{randomSeed:q.randomSeed,parameterSlots:He}))}function fn(){tn=Ka(),fe=Hn({device:c,cols:w,rows:A,gridFormat:B,dispatchPlan:tn})}function pn(){let e=c.createShaderModule({label:d.brushShaderModule,code:ro(B)});Jr=c.createComputePipeline({label:d.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),Ce.forEach(r=>r.destroy()),Ce=[],ut=[],lt=[];for(let r=0;r<Na;r++){let t=c.createBuffer({label:`${d.brushUniformBuffer} ${r}`,size:hn,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});Ce.push(t),ut.push(c.createBindGroup({layout:Jr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:t}}]})),lt.push(c.createBindGroup({layout:Jr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}},{binding:1,resource:{buffer:t}}]}))}}function Ha(e,r){let t=ze.get(x)??0,n=$a++,o=to(r.centerX,r.centerY,r.brushSize,H(),q.topology),i=U?lt:ut;for(let[s,a]of o.entries()){let l=new ArrayBuffer(hn),u=new Uint32Array(l);u[0]=pt,u[1]=r.brushSize,u[2]=r.shape,u[3]=r.fill,u[4]=t,u[5]=n,u[6]=r.tribeIds.length,u[7]=a.destinationStartX,u[8]=a.destinationStartY,u[9]=a.localStartX,u[10]=a.localStartY,u[11]=a.spanCols,u[12]=a.spanRows,u[13]=r.density,u[14]=0,u[15]=0;for(let m=0;m<r.tribeIds.length&&m<32;m++)u[16+m]=r.tribeIds[m];let f=Ce[s],p=i[s];if(f&&p){c.queue.writeBuffer(f,0,l);let m=Math.floor(a.destinationStartX/B.cellsPerWord),L=Math.ceil((a.destinationStartX+a.spanCols)/B.cellsPerWord)-m,y=Math.ceil(L/8),ne=Math.ceil(a.spanRows/8),ge=e.beginComputePass({label:d.brushPass});ge.setPipeline(Jr),ge.setBindGroup(0,p),ge.dispatchWorkgroups(y,ne),ge.end()}else throw console.error("[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.",{index:s,rectCount:o.length,bindGroupCount:i.length,uniformBufferCount:Ce.length}),new Error("Brush dispatch resources are out of sync with the wrapped brush rectangles.")}}function Va(){let e=U?O:G,r=gt(),t;try{t=c.createBuffer({label:d.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(o){return console.warn("GPU readback buffer allocation failed:",o),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=c.createCommandEncoder({label:d.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),c.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let o=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),o})}function oi(){h=gt(),C=So(h,Pr())}function ja(){let e=Ye?$e*He:0;return gr+Bo+hn+we*2+Ae*2+e}function mn(){self.postMessage({type:"limits",...xo(Re(),h,C,ja(),be())})}function ii(){return C>=1&&$!==null&&S<C}function ai(e,r){let t=U?O:G,n=S*h;e.copyBufferToBuffer(t,0,$,n,h),R.push(r),pe=r,S++}function yn(e){if(ii()){let r=c.createCommandEncoder({label:d.recordingFrameCopyEncoder});ai(r,e),c.queue.submit([r.finish()]),xr()}}function en(e){vr=Math.max(0,vr+e)}function xr(){C>0&&S>=C&&ni()&&Ir()}function Ir(){let e=$;if(e!==null&&S>0&&me.length>0&&ue<Vr(C,h)){let r=Y.indexOf(!0);if(r>=0){Y[r]=!1;let t=me[r];if(t.mapState==="unmapped"){let n=S*h,o=Jo++,i=[...R],s=i[0],a=i[i.length-1],l=`chunk-${String(o).padStart(6,"0")}.bin`,u=S,f=c.createCommandEncoder({label:d.recordingSealCopyEncoder});f.copyBufferToBuffer(e,0,t,0,n),c.queue.submit([f.finish()]);let p={chunkId:o,generationStart:s,generationEnd:a,blockCount:u,codec:_e,uncompressedBytes:n,storedBytes:n,gridFormat:be(),generations:i,filename:l};Zr(1),en(u),ue++,le();let m=Fe;t.mapAsync(GPUMapMode.READ).then(async()=>{let T=t.getMappedRange(),L=new ArrayBuffer(n);new Uint8Array(L).set(new Uint8Array(T,0,n)),t.unmap(),m===Fe&&(Y[r]=!0,_.push(p),en(-u),mr(ee,_,R),le(),xr(),Za(p,L).then(()=>{m===Fe&&(ue--,le(),Zr(-1),Ee(),kr(),V(!0),xr(),self.postMessage({type:"chunkSealed",filename:p.filename,rawBytes:n,blockCount:p.blockCount,cols:w,rows:A,rawGridFormat:p.gridFormat,storageGridFormat:Ze(Or(q.tribes.length))}),Er&&X===0&&(Er=!1,kr()))}).catch(y=>{m===Fe&&(ue--,le(),Zr(-1),rs(p,y).catch(bt))}))}).catch(()=>{m===Fe&&(Y[r]=!0,ue--,en(-u),le(),Zr(-1),xr())}),S=0,R=[]}else Y[r]=!0}}}async function si(e){Fe++,Jo=0,S=0,R=[],_=[],pe=null,vr=0,ue=0,X>0&&(X=0,self.postMessage({type:"chunksSaving",active:!1})),re&&(re=!1,self.postMessage({type:"backpressure",active:!1})),Er=!1,N=I,ee={chunks:[],generationStart:e,generationEnd:e,gridFormat:be()},await li(),Ee()}async function _n(){return Te&&await Te,Tr||(Tr=await(await navigator.storage.getDirectory()).getDirectoryHandle(pr,{create:!0})),Tr}async function Za(e,r){let t=await _n(),o=await(await t.getFileHandle(e.filename,{create:!0})).createWritable(),i=!1;try{await o.write(r),await o.close(),i=!0,o=null}catch(s){if(o&&!i)try{await o.abort()}catch(a){console.warn("[GOLT worker] Failed to abort recording chunk write after error:",a)}try{await t.removeEntry(e.filename)}catch(a){a instanceof DOMException&&a.name==="NotFoundError"||console.warn("[GOLT worker] Failed to remove failed recording chunk:",e.filename,a)}throw s}}function Qa(e){let r=ri(e).toLowerCase();return e instanceof DOMException&&e.name==="QuotaExceededError"||r.includes("storage quota")||r.includes("quota exceeded")||r.includes("exceed its storage quota")}function ui(e){let r=_.findIndex(t=>t.filename===e.filename);r>=0&&_.splice(r,1)}async function Ja(){let e=null,r=br(_),t=Zt(_,r,0,1);if(t?.source==="sealed"){let{frameInChunk:n}=t,o=_[t.sealedIndex];try{let i=(n+1)*h,s=await ci(o.filename,o.codec),a=H(),l=Lr(o.gridFormat),u=Qt(s,n,h,a,l,B),f=u.activeFrame??u.chunkPrefix.subarray(n*h,i);if(c.queue.writeBuffer(U?O:G,0,f),S=0,R=[],b=o.generations[n]??o.generationEnd,pe=b,e=b,n<o.blockCount-1){let m=n+1,T=o.blockCount>0?Math.floor(o.uncompressedBytes/o.blockCount):h;o.blockCount=m,o.generationEnd=b,o.generations=o.generations.slice(0,m),o.uncompressedBytes=T*m,o.codec===_e&&(o.storedBytes=h*m)}let p=_.splice(t.sealedIndex+1);await bn(p.map(m=>m.filename)),ht(),bi(),F()}catch(i){console.warn("[GOLT worker] Failed to restore the previous persisted recording frame after storage quota pressure:",i)}}else{let n=_.splice(0);await bn(n.map(o=>o.filename)),S=0,R=[]}return e}async function es(e,r){console.warn("[GOLT worker] Recording stopped because OPFS storage quota was reached:",r),ui(e),P("cancelled",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),k=!1,I=!1,N=!1;let t=await Ja();mr(ee,_,R),le(),Ee(),kr(),V(!0),self.postMessage({type:"recordingStopped",reason:"storageQuota",restoredGeneration:t})}async function rs(e,r){ui(e),Qa(r)?await es(e,r):bt(r)}async function bn(e){let r=await _n();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function li(){if(Te)await Te;else{Te=(async()=>{let e=await navigator.storage.getDirectory();Tr=null;try{await e.removeEntry(pr,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${pr}:`,r)}Tr=await e.getDirectoryHandle(pr,{create:!0})})();try{await Te}finally{Te=null}}}function kr(){mr(ee,_,R),self.postMessage({type:"recording",manifest:{chunks:Ro(_),generationStart:ee.generationStart,generationEnd:ee.generationEnd,gridFormat:be()},cols:w,rows:A})}function wr(e=!1){if(I){let r=!N;e&&N&&Br()&&(N=!1,r=!0),r&&Mo(pe,b)&&Br()&&(S>=C&&Ir(),yn(b))}}function Tn(){if(et){let e=et;et=null;let r=I&&S>0&&R[S-1]===b;r&&(S--,R.pop());let t=c.createCommandEncoder({label:d.brushEncoder});Ha(t,e),c.queue.submit([t.finish()]),r&&yn(b)}}async function ci(e,r=_e){let i=await(await(await(await _n()).getFileHandle(e)).getFile()).arrayBuffer();return r===zt?Wa(i):i}function di(){return zn(w,A,Mr.enabled,Mr.sections)}function ts(){return Kn(di())}function fi(e){tt=ts(),fe&&tt.length>0&&jn({device:c,encoder:e,resources:fe,sourceBuffer:U?O:G,dispatchPlan:tn,enabledSections:tt})}function pi(){let e=b;if(fe&&e!==rt&&!Ne){let r=[...tt],t=di();rt=e,Ne=!0,Zn({resources:fe,enabledSections:r}).then(n=>{let o=ze.get(x)??0,i=br(_,S+vr),s=Qn({generation:e,tribes:We,deadTribeIndex:o,readback:n,enabledSections:r,availability:t,liveMetricSettings:Mr.sections,cols:w,rows:A,totalFrames:i,fps:mt,canStepBack:i>1,recordingBytes:Eo(_),recordingRawBytes:vo(_)});if(Ne=!1,self.postMessage(s),_r)if(_r=!1,rt=-1,hi()){let a=c.createCommandEncoder({label:d.interactiveMetricsEncoder});fi(a),c.queue.submit([a.finish()]),pi()}else _r=!0}).catch(()=>{Ne=!1})}}function Cn(e){if(Ye&&Xe&&e>0){let r=Math.min(e,He),t=$e/Uint32Array.BYTES_PER_ELEMENT,n=new Uint32Array(r*t);for(let o=0;o<r;o++)n[o*t]=b+o;c.queue.writeBuffer(Xe,0,n)}}function mi(e){let r=e;return Ye&&(r=Math.min(e,He)),r}function xn(e,r=0){let t=e.beginComputePass({label:d.simulationStepPass});t.setPipeline(yr),t.setBindGroup(0,U?qo:Xo),Ye&&t.setBindGroup(1,st[r]);let n=rn;t.dispatchWorkgroups(n.dispatchWgX,n.dispatchWgY),t.end(),U=!U,b++}function ns(e){let r=mi(e);if(r>0){Cn(r);let t=c.createCommandEncoder({label:d.simulationBatchEncoder});for(let n=0;n<r;n++)xn(t,n);c.queue.submit([t.finish()]),qe+=r}}function bi(){self.postMessage({type:"generation",generation:b,fps:mt})}function os(){Cn(1);let e=c.createCommandEncoder({label:d.simulationSingleStepEncoder});xn(e),c.queue.submit([e.finish()])}function F(){if(c&&at&&Ke&&Rr&&nn&&on&&!E&&!M){Ya();let e=at.getCurrentTexture().createView(),r=c.createCommandEncoder({label:d.renderEncoder}),t=r.beginRenderPass({label:d.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(Rr),t.setBindGroup(0,U?on:nn),t.draw(3),t.end(),c.queue.submit([r.finish()])}}function gi(e){Sr===0&&(Sr=e);let r=e-Sr;r>=1e3&&(mt=qe/(r/1e3),qe=0,Sr=e)}function ht(){qe=0,Sr=0,mt=0}function Rn(){return I&&ce()?"recording":"nonRecording"}function hi(){return!!(c&&fe&&!E&&!M)}function V(e=!1){if(e&&(rt=-1),!hi())_r=!0;else if(Ne)_r=!0;else{let r=c.createCommandEncoder({label:d.interactiveMetricsEncoder});fi(r),c.queue.submit([r.finish()]),pi()}}function Si(){V(!0),F()}function St(e,r){r&&(e-Jt>=1e3||Jt===0)&&!Ne&&(Jt=e,V())}function Ar(e,r){(e.request.pacing.kind==="max"||Q(e))&&r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,bi())}function Ve(e){re!==e&&(re=e,self.postMessage({type:"backpressure",active:e}))}function yi(){let e=Br();return e&&S>=C&&(Ir(),e=Br()),e}function Dr(){!E&&!M&&!g&&self.requestAnimationFrame(gn)}function is(e,r){let t=e.adaptiveBatch;t&&t.lastDrainStartedAt>0&&(Oo(t,r-t.lastDrainStartedAt),t.lastDrainStartedAt=0,t.lastSubmittedGenerations=0)}function _i(e,r,t){let n=e.adaptiveBatch;n&&r>0&&(n.lastSubmittedGenerations=r,n.lastDrainStartedAt=t)}function Ti(e,r){let t=Math.max(1,Math.round(hr(r))),n=0;for(;n<e;){let o=e-n,i=Math.min(t,o);ns(i),n+=i}return n}function Me(e){let r=g;if(r&&!r.pumpPending&&!E&&!M){let{token:t}=r;r.pumpPending=!0;let n=()=>{if(g&&g.token===t){let o=performance.now();g.pumpPending=!1,e==="drain"&&is(g,o),fs(o)}};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?c.queue.onSubmittedWorkDone().then(n).catch(()=>{g?.token===t&&(g.pumpPending=!1)}):queueMicrotask(n)}}function Mn(e,r){g&&P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1});let t=H(),n=e==="nonRecording"?Go(t,r.pacing):null;n&&console.info("[GOLT worker] Adaptive non-recording batching started",{cols:t.cols,rows:t.rows,bitsPerCell:B.bitsPerCell,generationsPerDrain:n.generationsPerDrain,targetDrainMs:n.targetDrainMs}),g={kind:e,request:r,token:++ei,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0,adaptiveBatch:n},Me(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function de(){k&&Mn(Rn(),{pacing:Lo(te),stopCondition:{kind:"none"}})}function as(e,r){r||e==="cancelled"?Ve(!1):re&&le()}function P(e,r={}){let t=g;if(t){g=null,ei++;let n=Q(t),o=Fo(t,r),i=!!o;o&&(k=o.running,te=o.targetStepDuration),Uo(e,n,r)&&self.postMessage({type:"stepping",active:!1}),as(e,n),r.render!==!1&&!E&&!M&&Si(),No(r,i,k,E,M)?de():Dr()}}function Ci(e){let r=g;r&&Q(r)&&(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),P("cancelled"))}function ss(e){P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Mn(Rn(),e)}function xi(e,r,t){Ve(!0),Ar(e,r),St(r,t),Me("drain")}function Ri(e,r){let t=mi(e);Cn(t);let n=c.createCommandEncoder({label:d.recordingStepBatchEncoder}),o=0,i=!1,s=t>0;for(;s;)o<t&&performance.now()<r?yi()&&ii()?(xn(n,o),ai(n,b),o++,S>=C&&(s=!1)):(i=!0,s=!1):s=!1;return o>0&&(c.queue.submit([n.finish()]),qe+=o,xr()),{steps:o,blocked:i}}function us(e,r){let t=H(),n=e.adaptiveBatch?.generationsPerDrain??Math.round(hr(t)*jr(t)),o=Math.min(n,J(e,b)),i=Ti(o,t),s=i>0;Ar(e,r),Le(e,b)?P("targetReached"):s?(_i(e,i,performance.now()),Me("drain")):Me("raf")}function ls(e,r){wr(!0);let t=!1,n=!1,o=performance.now()+14,i=J(e,b)>0&&performance.now()<o;for(;i;){let s=Ri(J(e,b),o);t=t||s.steps>0,s.blocked?(xi(e,r,t),n=!0,i=!1):i=s.steps>0&&J(e,b)>0&&performance.now()<o}n||(Ve(!1),Ar(e,r),St(r,t),Le(e,b)?P("targetReached"):Me("raf"))}function cs(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let o=e.stepAccumulator,i=Math.floor(e.stepAccumulator/r),s=H(),a=e.adaptiveBatch?.generationsPerDrain??Vt(e.kind,s),l=Math.min(i,J(e,b),a),u=Ti(l,s),f=u>0;if(e.stepAccumulator=jt(o,r,i,u,a),Ar(e,t),Le(e,b))P("targetReached");else{let p=f&&i>u;(!Q(e)&&!p||t-e.lastRenderTime>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,F(),St(t,f)),p&&_i(e,u,performance.now()),Me(p?"drain":"raf")}}function ds(e,r,t){wr(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let o=!1,i=0,s=e.stepAccumulator,a=Vt(e.kind,H()),l=Math.floor(e.stepAccumulator/r),u=performance.now()+14,f=!1,p=l>0&&J(e,b)>0&&i<a&&performance.now()<u;for(;p;){let m=Math.min(l-i,a-i,J(e,b)),T=Ri(m,u);i+=T.steps,o=o||T.steps>0,T.blocked?(xi(e,t,o),f=!0,p=!1):p=T.steps>0&&l>i&&J(e,b)>0&&i<a&&performance.now()<u}e.stepAccumulator=jt(s,r,l,i,a),f||(Ve(!1),Ar(e,t),Le(e,b)?P("targetReached"):(Q(e)||(F(),St(t,o)),Me("raf")))}function fs(e){let r=g;if(r&&!E&&!M)if(gi(e),Q(r)||Tn(),Le(r,b))P("targetReached");else if(r.request.pacing.kind==="max")r.kind==="recording"?ls(r,e):us(r,e);else{let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?ds(r,t,e):cs(r,t,e)}}function gn(e){E||M?self.requestAnimationFrame(gn):(gi(e),g||(Tn(),te>0&&!nt&&F(),self.requestAnimationFrame(gn)))}function ps(e,r){let t=c?Re():Number.POSITIVE_INFINITY;return Pn(r.bitsPerCell)&&Ct(r.bitsPerCell,e.tribes.length)&&xt(e,je(r.bitsPerCell),t)?je(r.bitsPerCell):wn(e.tribes.length,e,t)}function Mi(e,r){let t=Nn(e),n=t.topology===v?v:Dn,o=t.tribes.some(i=>i.id===t.boundaryTribe)?t.boundaryTribe:x;q={...t,topology:n,boundaryTribe:o},w=t.cols,A=t.rows,B=ps(t,r),pt=he(w,B),We=[...q.tribes],ee.gridFormat=be(),ze.clear(),We.forEach((i,s)=>ze.set(i.id,s))}async function Ei(e){console.log("[GOLT worker] Initializing WebGPU"),xe=e,c=await $n(d.webengineDevice),M=!1,c.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),P("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),M=!0,k=!1,E=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:Re(),vramBudgetBytes:Ht(Re(),Pr()),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:be()});let r=xe.getContext("webgpu");if(r)at=r,Qr=navigator.gpu.getPreferredCanvasFormat(),at.configure({device:c,format:Qr,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:Qr,maxBufferSize:c.limits.maxBufferSize,maxStorageBufferBindingSize:c.limits.maxStorageBufferBindingSize});else throw new Error("WebGPU canvas context not available")}async function ms(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Ei(xe),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),P("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),M=!0,k=!1,E=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function vi(){$=c.createBuffer({label:d.recordingChunkBuffer,size:C*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await dt(C*h,$),S=0,R=[],pe=null}async function Bi(){let e=C*h;me=[],Y=[];for(let r=0;r<Oe;r++){let t=c.createBuffer({label:`${d.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});me.push(t),Y.push(!0),await dt(e,t)}}async function bs(){await li()}async function gs(){console.log("[GOLT worker] Building GPU resources",{cols:w,rows:A,bitsPerCell:B.bitsPerCell,recordingAvailable:ce()}),an(),oi(),await sn(),un(),ln(),cn(),dn(),pn(),fn(),await bs(),ce()?(await vi(),await Bi()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:h,maxRecordingBufferBytes:Pr()}),ft(),I=!1,N=!1),await ct(),mn(),console.log("[GOLT worker] GPU resources ready")}async function hs(){console.log("[GOLT worker] Rebuild started",{cols:w,rows:A,bitsPerCell:B.bitsPerCell}),P("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),E=!0,self.postMessage({type:"rebuilding",active:!0});try{await Sn()}catch{console.warn("[GOLT worker] Queue idle wait rejected during rebuild")}let e=!M;if(M&&(e=await ms()),e){Ko(),an(),oi(),zo(ce());try{await sn(),un(),ln(),dn(),pn(),cn(),fn(),ce()?(await vi(),await Bi()):(ft(),I=!1,N=!1),await ct(),mn()}catch(r){let t=r instanceof Error?r.message:String(r);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{Ko(),an(),zo(!1),await sn(),un(),ln(),dn(),pn(),cn(),fn(),I=!1,N=!1,h=gt(),ft(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await ct(),mn()}catch(n){console.error("[GOLT worker] GPU rebuild recovery failed:",n),e=!1}}}return e&&(E=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:ce(),frameByteSize:h})),e}function Yo(e){nt=!0,c.queue.onSubmittedWorkDone().then(()=>{nt=!1,e()}).catch(()=>{nt=!1})}async function Ss(){X>0&&await new Promise(e=>{let r=setInterval(()=>{X===0&&(clearInterval(r),e())},10)})}async function ys(e){console.log("[GOLT worker] Init message received",{cols:e.ruleset.cols,rows:e.ruleset.rows,recording:e.recording,running:e.running,speed:e.speed}),I=e.recording,Mr=Mt(e.liveMetrics),N=I,Mi(e.ruleset,e.simulationGridFormat),await Ei(e.canvas),await gs(),V(!0),Ee(),k=e.running,te=e.speed<0?0:1e3/e.speed,k?de():Dr()}function _s(e){Mr=Mt(e.liveMetrics),V(!0)}async function Ts(e){console.log("[GOLT worker] Ruleset update received",{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length});let r=Re();if(Rt(e.ruleset.tribes.length,e.ruleset,r))P("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Mi(e.ruleset,e.simulationGridFormat),await hs()&&(b=0,ht(),await si(0),V(!0),k?de():Dr());else{let o=`Requested ruleset requires at least ${In(e.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",o,{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length,maxBytes:r}),self.postMessage({type:"gpuError",reason:o})}}function Cs(e){k=e.running,e.running?g||de():g&&Q(g)?Ci(!1):g?P("manual"):(re&&le(),Si(),Dr())}function xs(e){let r=te<=0,t=e.speed<0?0:1e3/e.speed;te=t,g&&!Q(g)&&k?(P("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&t>0?Yo(()=>{F(),de()}):de()):k&&!g?de():r&&t>0&&Yo(()=>{F(),Dr()})}function Rs(e){Ho=e.scale,Vo=e.offsetX,jo=e.offsetY,!g&&!E&&!M&&F()}function Ms(e){xe.width=e.width,xe.height=e.height,!g&&!E&&!M&&F()}function Es(e){let r=e.tribes.map(t=>ze.get(t)).filter(t=>t!==void 0);if(r.length>0){let t={square:0,round:1,diamond:2,vline:3,hline:4},n={full:0,spray:1,outline:2};et={centerX:e.x,centerY:e.y,brushSize:e.size,shape:t[e.shape]??0,fill:n[e.fill]??0,density:kn(e.density),tribeIds:r}}}function vs(e){let r={square:0,round:1,diamond:2,vline:3,hline:4};Zo={centerX:e.x,centerY:e.y,brushSize:e.size,shape:r[e.shape]??0,visible:e.visible},!g&&!E&&!M&&te<=0&&F()}function Bs(e){Qo={originX:e.origin?.originX??0,originY:e.origin?.originY??0,visible:e.visible&&e.origin!==null},!g&&!E&&!M&&te<=0&&F()}async function ks(){try{let e=await Va();Ot({type:"snapshot",grid:e,generation:b,cols:w,rows:A,gridFormat:be()},[e.buffer])}catch{let e=new Uint32Array(0);Ot({type:"snapshot",grid:e,generation:b,cols:w,rows:A,gridFormat:be()},[e.buffer])}}async function Ps(e){let r=Lr(e.gridFormat),t=H();if(e.grid.byteLength===ie(t,r)){let n=zr(e.grid,t,r,B);c.queue.writeBuffer(U?O:G,0,n),b=e.generation,ht(),await si(e.generation)}}function Is(e){let r=g?.request,t=ce();e.recording&&t&&!I?(I=!0,N=!0,V(!0),Ee()):(!e.recording||!t)&&(e.recording&&!t&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:h,maxRecordingBufferBytes:Pr()}),I=!1,N=!1),r&&g?ss(r):!g&&k&&de()}async function ws(){Er||(await Sn(),wr(!1),S>0&&Ir(),X>0?Er=!0:kr())}async function As(e){let r=br(_),t=Zt(_,r,S,e.count);if(t){let n=U?O:G;if(t.source==="buffered"){let o=$o(R,t);S=o.chunkFrameIndex,R.length=S,b=o.generation,pe=b;let i=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});i.copyBufferToBuffer($,t.frameInChunk*h,n,0,h),c.queue.submit([i.finish()])}else{X>0&&(await Ss(),r=br(_));let o=_[t.sealedIndex],i=await ci(o.filename,o.codec),s=H(),a=Lr(o.gridFormat),l=Qt(i,t.frameInChunk,h,s,a,B);if(c.queue.writeBuffer($,0,l.chunkPrefix),!l.sameFormat&&l.activeFrame&&c.queue.writeBuffer(n,0,l.activeFrame),S=t.frameInChunk+1,R=o.generations.slice(0,t.frameInChunk+1),b=R[t.frameInChunk],pe=b,l.sameFormat){let f=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});f.copyBufferToBuffer($,t.frameInChunk*h,n,0,h),c.queue.submit([f.finish()])}let u=_.splice(t.sealedIndex);bn(u.map(f=>f.filename))}mr(ee,_,R),Ee(),ht(),V(!0),F()}}function Ds(){Tn(),wr(!0),!I||yi()?(os(),qe++,I&&Br()&&(S>=C&&Ir(),yn(b)),Ve(!1)):Ve(!0),V(!0),F()}function Gs(e){self.postMessage({type:"stepping",active:!0}),wr(!0),Mn(Rn(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:b+e},restoreAfterStop:{running:k,targetStepDuration:te}})}function Os(e){e.count===1?Ds():Gs(e.count)}function Ls(){Ci(g?.request.restoreAfterStop?.running??k)}function Fs(e){let r=_.find(t=>t.filename===e.filename);r&&(r.codec=e.codec,r.storedBytes=e.storedBytes,r.gridFormat=e.gridFormat,ee.chunks=[..._],Ee(),kr())}function Us(){let e=_.filter(r=>r.codec===_e).map(r=>({filename:r.filename,rawBytes:r.uncompressedBytes,blockCount:r.blockCount,cols:w,rows:A,rawGridFormat:r.gridFormat,storageGridFormat:Ze(Or(q.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:e})}async function Ns(e){switch(e.type){case"init":await ys(e);break;case"setLiveMetrics":_s(e);break;case"setRuleset":await Ts(e);break;case"setRunning":Cs(e);break;case"setSpeed":xs(e);break;case"camera":Rs(e);break;case"resize":Ms(e);break;case"draw":Es(e);break;case"brushPreview":vs(e);break;case"exportFrameOverlay":Bs(e);break;case"getSnapshot":await ks();break;case"loadSnapshot":await Ps(e);break;case"setRecording":Is(e);break;case"getRecording":await ws();break;case"stepBack":await As(e);break;case"stepForward":Os(e);break;case"cancelStepping":Ls();break;case"updateChunkCodec":Fs(e);break;case"getUncompressedChunks":Us();break}}self.onmessage=async e=>{await Ns(e.data)};
