var Pn="goltTimestampedConsoleInstalled";function Di(){let e=globalThis;e[Pn]||(e[Pn]=!0,Tt("info"),Tt("warn"),Tt("error"),console.log=console.info.bind(console))}function Tt(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}Di();var kn=`// Render shader: draws the grid as a full-screen quad.\r
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
`;function wn(e){return Math.min(Math.max(1,Math.floor(+e||1)),100)}var Ct=[1,2,4,8,16,32],Oi={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Fi={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Ui={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Dr={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Ni={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},Rt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},oe={1:Oi,2:Fi,4:Ui,8:Dr,16:Ni,32:Rt};function An(e){return Ct.includes(e)}function $i(e){return 2**e}function xt(e,r){return r<=$i(e)}function Mt(e,r,t){return ie(e,r)<=t}function Gr(e){return e<=2?oe[1]:e<=4?oe[2]:e<=16?oe[4]:e<=256?oe[8]:e<=65536?oe[16]:oe[32]}function Dn(e){return Gr(e)}function Ze(e){return oe[e]}function Gn(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){return Et(e,r,t)??Rt}function Et(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of Ct){let o=Ze(n);if(xt(n,e)&&Mt(r,o,t))return o}return null}function Lr(e){return Ze(e?.bitsPerCell??8)}function Qe(e){return{bitsPerCell:e.bitsPerCell}}function be(e,r){return Math.ceil(e/r.cellsPerWord)}function ie(e,r){return be(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Ln(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}var Je={population:!0,diversity:!0,interfaces:!1},Or={enabled:!0,sections:Je};function Wi(e){return{population:typeof e?.population=="boolean"?e.population:Je.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Je.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Je.interfaces}}function vt(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Or.enabled,sections:Wi(e?.sections)}}var C="dead";var On="toroidal",R="bounded";var Fn=42,Un=0,Bt=4294967295,Nn=100,Pt=0,Fr=100,er=1e3,su=Pt*er,uu=Fr*er,rr="empty",kt="is",tr="comparison",nr="count",or="none",ir="exactly",ar="min",sr="max",Pe="not",ke="and",Ie="or",we="xor",Z="tribes",It="same",wt="different",ae="different-in",Ur="fixed",$n="same",Ae="majority",Nr="minority",ur="combine";var At={kind:rr};function Dt(e){let r;return Array.isArray(e)?r=`[${e.map(t=>Dt(t)).join(",")}]`:e&&typeof e=="object"?r=`{${Object.entries(e).filter(([,n])=>n!==void 0).sort(([n],[o])=>n.localeCompare(o)).map(([n,o])=>`${JSON.stringify(n)}:${Dt(o)}`).join(",")}}`:r=JSON.stringify(e),r}function Ot(e){let r=typeof e=="number"&&Number.isFinite(e)?e:Fn;return Math.max(Un,Math.min(Bt,Math.trunc(r)))}function Se(e){let r=typeof e=="number"&&Number.isFinite(e)?e:Nn,t=Math.round(r*er)/er;return Math.max(Pt,Math.min(Fr,t))}function Wn(e){return Math.floor(Se(e)/Fr*Bt)}function zi(e){let r=e&&e.length>0?e:[C];return{kind:Z,tribes:[...r]}}function G(e){let r=e??zi(void 0),t;switch(r.kind){case Z:case ae:t={...r,tribes:[...r.tribes]};break;default:t={...r};break}return t}function he(e){return{kind:"count",selector:G(e?.selector)}}function $r(e){return Dt(ye(e))}function ye(e){let r;switch(e.kind){case Z:case ae:r={...e,tribes:[...new Set(e.tribes)].sort()};break;default:r=e;break}return r}function Gt(e){switch(e.kind){case rr:return At;case nr:case or:case ir:case ar:case sr:return{...e,selector:G(e.selector)};case tr:return{...e,left:he(e.left),right:he(e.right),margin:e.margin??0};case Pe:return{...e,clause:Gt(e.clause)};case ke:case Ie:case we:{let r=e.clauses.map(t=>Gt(t));for(;r.length<2;)r.push(At);return{...e,clauses:r}}default:return e}}function Lt(e){let r=Gt(e);switch(r.kind){case Pe:return{...r,clause:Lt(r.clause)};case ke:case Ie:case we:return{...r,clauses:r.clauses.map(t=>Lt(t))};default:return r}}function Wr(e){return e??{kind:Ur,tribe:C}}function ge(e){let r;switch(e.kind){case Ae:case Nr:r={...e,selector:G(e.selector),tie:e.tie?ge(e.tie):void 0,fallback:e.fallback?ge(e.fallback):void 0};break;case ur:r={kind:ur,entries:e.entries.map(t=>({...t,inputs:t.inputs.map(n=>G(n)).sort((n,o)=>$r(n).localeCompare($r(o)))})),default:e.default?ge(e.default):void 0};break;default:r={...e};break}return r}function Ki(e){let r=structuredClone(e);return r.become=ge(Wr(e.become)),r.probability=Se(e.probability),r}function zn(e){return{...e,randomSeed:Ot(e.randomSeed),rules:e.rules.map(r=>Yi(r))}}function Yi(e){let r=Ki(e);return r.clause=Lt(r.clause),delete r.key,r.muted=!!r.muted,r.probability=Se(r.probability),r}function Ft(e,r){self.postMessage(e,r)}async function Kn(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var f={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",recordingStepBatchEncoder:"recording step batch encoder",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",simulationBindGroupAtoB:"simulation bind group A to B",simulationBindGroupBtoA:"simulation bind group B to A",simulationParameterBuffer:"simulation parameter buffer",simulationParameterBindGroup:"simulation parameter bind group",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var Yn=4294967295;function Ut(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function Y(e,r){return e.includes(r)}function Xn(e,r,t,n){let o=e*r,i=o<=Yn,s=o*2<=Yn;return{population:Ut(t&&n.population,i),diversity:Ut(t&&n.diversity,i),interfaces:Ut(t&&n.interfaces,s)}}function qn(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var De=256*Uint32Array.BYTES_PER_ELEMENT,Ge=Uint32Array.BYTES_PER_ELEMENT;function Hn(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function Vn(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function jn(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function Xi(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:o}=e;return`
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
${Hn(o)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Vn(o)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${jn(o)}
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
`}function qi(e){let{cols:r,rows:t,topology:n,gridFormat:o,dispatchPlan:i}=e,s=n===R?"x + 1u < COLS":"true",a=n===R?"y + 1u < ROWS":"true";return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${r}u;
const ROWS: u32 = ${t}u;
const CELLS_PER_WORD: u32 = ${o.cellsPerWord}u;
const WORD_SHIFT: u32 = ${o.wordShift}u;
const CELL_SHIFT: u32 = ${o.cellShift}u;
const CELL_INDEX_MASK: u32 = ${o.cellIndexMask}u;
const CELL_MASK: u32 = ${o.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
${Hn(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Vn(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${jn(i)}
  if (x < COLS && y < ROWS) {
    var edges = 0u;
    let self_tribe = readCell(x, y);

    if (${s} && readCell((x + 1u) % COLS, y) != self_tribe) {
      edges += 1u;
    }

    if (${a} && readCell(x, (y + 1u) % ROWS) != self_tribe) {
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
`}function Hi(e,r){let{tribes:t,deadTribeIndex:n,readback:o,cols:i,rows:s}=e,a=i*s,l={};for(let d=0;d<t.length;d++){let m=r?o.histogram[d]??0:0;l[t[d].id]=m}let u=r?l[t[n]?.id??""]??0:0;return{population:l,aliveCells:r?Math.max(0,a-u):0,deadCells:u}}function Vi(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,o=0;for(let i=0;i<r.length;i++)i!==t&&(o+=n.histogram[i]??0);return o}function ji(e,r){let{tribes:t,deadTribeIndex:n,readback:o}=e,i=r?Vi(e):0,s=0,a=0;for(let l=0;l<t.length;l++){let u=l!==n&&i>0?(o.histogram[l]??0)/i:0;u>0&&(s-=u*Math.log2(u),a+=u*u)}return{shannonEntropy:s,simpsonSum:a}}function Zi(e,r){let t=e.topology===R?e.rows*Math.max(0,e.cols-1)+e.cols*Math.max(0,e.rows-1):e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,o=r?Math.max(0,t-n):0;return{sameStateContactEdges:o,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?o/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function Zn(e){let{device:r}=e,t=r.createShaderModule({label:f.histogramMetricsShaderModule,code:Xi(e)}),n=r.createComputePipeline({label:f.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),o=r.createBuffer({label:f.histogramMetricsBuffer,size:De,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),i=r.createBuffer({label:f.histogramMetricsReadBuffer,size:De,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=r.createShaderModule({label:f.interfaceMetricsShaderModule,code:qi(e)}),a=r.createComputePipeline({label:f.interfaceMetricsPipeline,layout:"auto",compute:{module:s,entryPoint:"main"}}),l=r.createBuffer({label:f.interfaceMetricsBuffer,size:Ge,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),u=r.createBuffer({label:f.interfaceMetricsReadBuffer,size:Ge,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:o,histogramReadBuffer:i,boundaryPipeline:a,boundaryBuffer:l,boundaryReadBuffer:u}}function Qn(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function Jn(e){let{device:r,encoder:t,resources:n,sourceBuffer:o,dispatchPlan:i,enabledSections:s}=e;if(Y(s,"population")||Y(s,"diversity")){let a=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,a);let l=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),u=t.beginComputePass({label:f.histogramMetricsPass});u.setPipeline(n.histogramPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(i.dispatchWgX,i.dispatchWgY),u.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,De)}if(Y(s,"interfaces")){let a=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,a);let l=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),u=t.beginComputePass({label:f.interfaceMetricsPass});u.setPipeline(n.boundaryPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(i.dispatchWgX,i.dispatchWgY),u.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Ge)}}async function eo(e){let{resources:r,enabledSections:t}=e,n=Y(t,"population")||Y(t,"diversity"),o=Y(t,"interfaces"),i=[];n&&i.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),o&&i.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(i);let s=new Uint32Array(256);n&&(s=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let a=0;if(o){let l=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),a=l[0]??0}return{histogram:s,crossStateContactEdges:a}}function ro(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:o,cols:i,rows:s,totalFrames:a,fps:l,canStepBack:u,recordingBytes:d,recordingRawBytes:m}=e,p=Y(t,"population")&&o.population,S=Y(t,"diversity")&&o.diversity,M=Y(t,"interfaces")&&o.interfaces,g=i*s,F=Hi(e,p),j=ji(e,S),_t=Zi(e,M);return{type:"metrics",generation:r,population:F.population,aliveCells:F.aliveCells,deadCells:F.deadCells,occupancy:p&&g>0?F.aliveCells/g:0,shannonEntropy:j.shannonEntropy,simpsonIndex:S?1-j.simpsonSum:0,interfaces:_t,metricsAvailability:n,extinctionTime:{},totalFrames:a,fps:l,canStepBack:u,recordingBytes:d,recordingRawBytes:m}}function Qi(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}function to(e,r,t,n,o){let i=be(r.cols,t),s=e[o*i+(n>>t.wordShift)]??0;return Qi(s,t,n&t.cellIndexMask)}function no(e,r,t,n,o,i){let s=be(r.cols,t),a=o*s+(n>>t.wordShift),l=(n&t.cellIndexMask)<<t.cellShift,u=~(t.cellMask<<l),d=e[a]??0;e[a]=(d&u|(i&t.cellMask)<<l)>>>0}var Ji=64*1024*1024,$u=256*1024*1024;function zr(e,r,t,n){let o=e,i;if(t.bitsPerCell===n.bitsPerCell)i=e;else{i=new Uint32Array(ie(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let s=0;s<r.rows;s++)for(let a=0;a<r.cols;a++)no(i,r,n,a,s,to(o,r,t,a,s))}return i}function ea(e,r,t){let n=Math.floor((r-1)/2),o=e-n,i=o+r,s=[];if(o>=0&&i<=t)s.push({destinationStart:o,localStart:0,span:r});else if(o<0){let a=-o;s.push({destinationStart:t-a,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:r-a})}else{let a=t-o;s.push({destinationStart:o,localStart:0,span:a}),s.push({destinationStart:0,localStart:a,span:i-t})}return s.filter(a=>a.span>0)}function ra(e,r,t){let n=e-Math.floor((r-1)/2),o=Math.max(0,n),i=Math.min(t,n+r),s=Math.max(0,i-o),a=[];return s>0&&a.push({destinationStart:o,localStart:o-n,span:s}),a}function oo(e){return`
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
`}function io(e,r,t,n,o){let i=o===R?ra:ea,s=i(e,t,n.cols),a=i(r,t,n.rows),l=[];for(let u of a)for(let d of s)l.push({destinationStartX:d.destinationStart,destinationStartY:u.destinationStart,localStartX:d.localStart,localStartY:u.localStart,spanCols:d.span,spanRows:u.span});return l}var ao={"=":"==","\u2260":"!=",">":">","<":"<","\u2265":">=","\u2264":"<="},Nt="applied = true;",_e=32;function ta(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function na(e,r){e.push(`const CELLS_PER_WORD: u32 = ${r.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${r.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${r.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${r.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${r.cellMask}u;`)}function oa(e){e.push("struct SimulationParams {"),e.push("  generation: u32,"),e.push("  _pad0: u32,"),e.push("  _pad1: u32,"),e.push("  _pad2: u32,"),e.push("};"),e.push("@group(1) @binding(0) var<uniform> simulationParams: SimulationParams;"),e.push(""),e.push("fn probabilityHash(x: u32, y: u32, generation: u32, ruleIndex: u32, randomSeed: u32) -> u32 {"),e.push("  var h = x * 0x9e3779b9u;"),e.push("  h = h ^ (y * 0x85ebca6bu);"),e.push("  h = h ^ (generation * 0xc2b2ae35u);"),e.push("  h = h ^ (ruleIndex * 0x27d4eb2fu);"),e.push("  h = h ^ randomSeed;"),e.push("  h = (h ^ (h >> 16u)) * 0x7feb352du;"),e.push("  h = (h ^ (h >> 15u)) * 0x846ca68bu;"),e.push("  return h ^ (h >> 16u);"),e.push("}")}function ia(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function aa(e,r){e.push("fn readBoundedCell(x: i32, y: i32) -> u32 {"),e.push("  if (x < 0i || y < 0i || x >= i32(COLS) || y >= i32(ROWS)) {"),e.push(`    return ${r}u;`),e.push("  }"),e.push("  return readCell(u32(x), u32(y));"),e.push("}")}function sa(e,r,t){r.remapped?(e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;")):(e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;"))}function ua(e){let r=Ra(e),t=new Map,n=0;for(let o of r)t.set(o,`count_${n++}`);return t}function la(e,r){let t=xa(e),n=new Map,o=0;for(let i of t){let s=r.get(i);s?n.set(i,s):n.set(i,`eq_count_${o++}`)}return n}function ca(e,r,t,n){for(let[o,i]of r)e.push(`  let ${i} = ${fo(ho(o),t,n)};`);r.size>0&&e.push("")}function da(e,r,t,n,o){let i=0;for(let[s,a]of t)r.has(s)||(e.push(`  let ${a} = ${fo(ho(s),n,o)};`),i++);i>0&&e.push("")}function fa(e,r,t,n,o,i,s){s?ma(e,r,t,n,o,i):pa(e,r,t,n,o,i)}function pa(e,r,t,n,o,i){e.push("  var applied = false;");for(let s=0;s<r.length;s+=_e){let a=r.slice(s,s+_e);e.push("  if (!applied) {");for(let l=0;l<a.length;l++){let u=s+l,{rule:d}=a[l],m=Le(d.clause,t,n,o,i);e.push(l===0?`    if (${m}) {`:`    } else if (${m}) {`),qr(e,ge(Wr(d.become)),o,i,`rule_${u}`,"      "),e.push(`      ${Nt}`)}e.push("    }"),e.push("  }")}e.push("")}function ma(e,r,t,n,o,i){e.push("  var applied = false;");for(let s=0;s<r.length;s+=_e){let a=r.slice(s,s+_e);e.push("  if (!applied) {");for(let l=0;l<a.length;l++){let u=s+l,d=a[l],{rule:m,probability:p,priorityIndex:S}=d,M=Le(m.clause,t,n,o,i),g=p===100?"true":`probabilityHash(x, y, generation, ${S}u, RANDOM_SEED) < ${Wn(p)}u`,F=`(${M} && ${g})`;e.push(l===0?`    if ${F} {`:`    } else if ${F} {`),qr(e,ge(Wr(m.become)),o,i,`rule_${u}`,"      "),e.push(`      ${Nt}`)}e.push("    }"),e.push("  }")}e.push("")}function qr(e,r,t,n,o,i,s=null){switch(r.kind){case Ur:e.push(`${i}result = ${W(r.tribe,n)}u;`);break;case $n:e.push(`${i}result = selfTribe;`);break;case Ae:case Nr:ba(e,r,t,n,o,i);break;case ur:ga(e,r,t,n,o,i,s);break}}function ba(e,r,t,n,o,i){let s=G(r.selector),a=`${o}_${r.kind}`,l=`${o}_${r.kind}_count`,u=`${o}_${r.kind}_ties`,d=r.kind===Ae?"0u":"9u",m=r.kind===Ae?`candidateCount > ${l}`:`candidateCount < ${l}`;e.push(`${i}var ${a}: u32 = ${W(C,n)}u;`),e.push(`${i}var ${l}: u32 = ${d};`),e.push(`${i}var ${u}: u32 = 0u;`);for(let p of Hr(s,t,n)){let S=Q(g=>`${g} == ${p}u`),M=dr(s,p,n);e.push(`${i}{`),e.push(`${i}  let candidateCount = ${S};`),e.push(`${i}  if (${M} && candidateCount > 0u) {`),e.push(`${i}    if (${m}) {`),e.push(`${i}      ${a} = ${p}u;`),e.push(`${i}      ${l} = candidateCount;`),e.push(`${i}      ${u} = 1u;`),e.push(`${i}    } else if (candidateCount == ${l}) {`),e.push(`${i}      ${u} = ${u} + 1u;`),e.push(`${i}    }`),e.push(`${i}  }`),e.push(`${i}}`)}e.push(`${i}if (${u} == 1u) {`),e.push(`${i}  result = ${a};`),e.push(`${i}} else if (${u} > 1u) {`),r.tie?qr(e,r.tie,t,n,`${o}_tie`,`${i}  `,{selector:s,bestCountVar:l,tieCountVar:u}):Xr(e,r.fallback,t,n,`${o}_tie_fallback`,`${i}  `),e.push(`${i}} else {`),Xr(e,r.fallback,t,n,`${o}_fallback`,`${i}  `),e.push(`${i}}`)}function Xr(e,r,t,n,o,i){r?qr(e,r,t,n,o,i):e.push(`${i}result = ${W(C,n)}u;`)}function ga(e,r,t,n,o,i,s){let a=`${o}_input_mask`,l=`${o}_matched`;e.push(`${i}var ${a}: u32 = 0u;`);for(let p of ya(t,n,s)){let S=po(p,n,s);e.push(`${i}if (${S}) {`),e.push(`${i}  ${a} = ${a} | ${bo(p)};`),e.push(`${i}}`)}let u=`${o}_dead_present`,d=Q(p=>`${p} == ${W(C,n)}u`);e.push(`${i}let ${u} = ${d} > 0u;`),e.push(`${i}var ${l} = false;`);let m=[...r.entries].sort((p,S)=>Number($t(S,n))-Number($t(p,n)));for(let p=0;p<m.length;p+=_e){let S=m.slice(p,p+_e);e.push(`${i}if (!${l}) {`);for(let M=0;M<S.length;M++){let g=S[M],F=_a(g.inputs,t,n),j=Ta(g.inputs,t,n,s,u),_t=$t(g,n)?` && ${u}`:"",Bn=`((${a} & ~(${F})) == 0u && ${j}${_t})`;e.push(M===0?`${i}  if ${Bn} {`:`${i}  } else if ${Bn} {`),e.push(`${i}    result = ${W(g.output,n)}u;`),e.push(`${i}    ${l} = true;`)}e.push(`${i}  }`),e.push(`${i}}`)}m.length>0?(e.push(`${i}if (!${l}) {`),Xr(e,r.default,t,n,`${o}_fallback`,`${i}  `),e.push(`${i}}`)):Xr(e,r.default,t,n,`${o}_fallback`,i)}function so(e){for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(`    var ${zt(t,r)}: u32;`)}function Kr(e,r,t){for(let n=-1;n<=1;n++)for(let o=-1;o<=1;o++)if(!(o===0&&n===0)){let i=zt(o,n),s;r==="toroidal"?s=`readCell(${uo("x",o,"COLS")}, ${uo("y",n,"ROWS")})`:r==="boundedDirect"?s=`readCell(${lo("x",o)}, ${lo("y",n)})`:s=`readBoundedCell(${co("x",o)}, ${co("y",n)})`,e.push(`${t}${i} = ${s};`)}}function fo(e,r,t){let n=ye(e),o;switch(n.kind){case It:o=Q(i=>`${i} == selfTribe`);break;case wt:o=Q(i=>`${i} != selfTribe`);break;case ae:{let i=Te(n.tribes,t);o=i.length===0?"0u":Q(s=>`(${s} != selfTribe && (${i.map(a=>`${s} == ${a}u`).join(" || ")}))`);break}case Z:{let i=Te(n.tribes,t);o=i.length===0?"0u":Q(s=>i.map(a=>`${s} == ${a}u`).join(" || "));break}}return o}function Q(e){return ha().map(r=>`select(0u, 1u, ${e(r)})`).join(" + ")}function zt(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function ha(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(zt(t,r));return e}function uo(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function lo(e,r){let t=e;return r===-1?t=`${e} - 1u`:r===1&&(t=`${e} + 1u`),t}function co(e,r){let t=`i32(${e})`;return r===-1?t=`i32(${e}) - 1i`:r===1&&(t=`i32(${e}) + 1i`),t}function Te(e,r){let t=[];for(let n of e)t.push(cr(n,r,"selector"));return[...new Set(t)]}function W(e,r){return cr(e,r,"target")}function cr(e,r,t){let n=r.get(e),o=r.get(C)??0;return n===void 0&&console.error(`Unknown rule ${t} tribe; using dead tribe instead.`,{tribe:e}),n??o}function Hr(e,r,t){let n=ye(e),o;switch(n.kind){case Z:case ae:o=Te(n.tribes,t);break;default:o=r.map(i=>cr(i.id,t,"selector"));break}return[...new Set(o)].sort((i,s)=>i-s)}function dr(e,r,t){let n=ye(e),o;switch(n.kind){case It:o=`selfTribe == ${r}u`;break;case wt:o=`selfTribe != ${r}u`;break;case ae:o=Te(n.tribes,t).includes(r)?`selfTribe != ${r}u`:"false";break;case Z:o=Te(n.tribes,t).includes(r)?"true":"false";break}return o}function Sa(e,r,t){let n=ye(e),o=Q(s=>`${s} == ${r}u`);return`(${dr(n,r,t)} && ${o} > 0u)`}function ya(e,r,t){let n;return t?n=Hr(t.selector,e,r):n=e.map(o=>cr(o.id,r,"selector")),[...new Set(n)].filter(o=>o!==W(C,r)).sort((o,i)=>o-i)}function po(e,r,t){let n;if(t){let o=Q(s=>`${s} == ${e}u`),i=dr(t.selector,e,r);n=`(${e}u != ${W(C,r)}u && ${t.tieCountVar} > 1u && ${t.bestCountVar} > 0u && ${i} && ${o} == ${t.bestCountVar})`}else{let o=Q(i=>`${i} == ${e}u`);n=`(${e}u != ${W(C,r)}u && ${o} > 0u)`}return n}function _a(e,r,t){let n=[];for(let o of e){let i=G(o);for(let s of Hr(i,r,t))if(s!==W(C,t)){let a=dr(i,s,t);n.push(`select(0u, ${bo(s)}, ${a})`)}}return n.length>0?n.join(" | "):"0u"}function Ta(e,r,t,n,o){let i=[];for(let s of e){let a=G(s),l=[];for(let u of Hr(a,r,t))u!==W(C,t)&&l.push(Ca(a,u,t,n));l.length>0?i.push(`(${l.join(" || ")})`):mo(a,t)?i.push(o):i.push("false")}return i.length>0?i.join(" && "):"false"}function $t(e,r){return e.inputs.some(t=>mo(G(t),r))}function mo(e,r){let t=W(C,r),n=!1;return(e.kind===Z||e.kind===ae)&&(n=Te(e.tribes,r).includes(t)),n}function Ca(e,r,t,n){let o=ye(e),i;if(n){let s=po(r,t,n),a=dr(o,r,t);i=`(${s} && ${a})`}else i=Sa(o,r,t);return i}function bo(e){return`(1u << ${e}u)`}function go(e){return $r(e)}function ho(e){return JSON.parse(e)}function So(e,r){let t=new Set,n=i=>{t.add(go(i))},o=i=>{switch(r(i,n),i.kind){case Pe:o(i.clause);break;case ke:case Ie:case we:for(let s of i.clauses)o(s);break}};for(let i of e)o(i);return t}function Ra(e){return So(e,(r,t)=>{switch(r.kind){case or:case ir:t(G(r.selector));break;case ar:Yr(r.value,8)||t(G(r.selector));break;case sr:Yr(0,r.value)||t(G(r.selector));break;case nr:Yr(r.interval[0],r.interval[1])||t(G(r.selector));break}})}function xa(e){return So(e,(r,t)=>{r.kind===tr&&(t(he(r.left).selector),t(he(r.right).selector))})}function Le(e,r,t,n,o){switch(e.kind){case rr:return"false";case kt:return Ma(e.tribes,n,o);case nr:return lr(e.selector,r,e.interval[0],e.interval[1]);case or:return lr(e.selector,r,0,0);case ir:return lr(e.selector,r,e.value,e.value);case ar:return lr(e.selector,r,e.value,8);case sr:return lr(e.selector,r,0,e.value);case tr:return va(e,t);case Pe:return`!(${Le(e.clause,r,t,n,o)})`;case ke:return`(${e.clauses.map(i=>Le(i,r,t,n,o)).join(" && ")})`;case Ie:return`(${e.clauses.map(i=>Le(i,r,t,n,o)).join(" || ")})`;case we:return Ba(e.clauses,r,t,n,o);default:return"false"}}function Ma(e,r,t){let n=Te(e,t);return n.length===0?"false":n.length===r.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}function lr(e,r,t,n){let o;return Yr(t,n)?o="true":o=Ea(Wt(G(e),r),t,n),o}function Yr(e,r){return e<=0&&r>=8}function Ea(e,r,t){switch(!0){case r===t:return`${e} == ${r}u`;case r<=0:return`${e} <= ${t}u`;case t>=8:return`${e} >= ${r}u`;default:return`(${e} >= ${r}u && ${e} <= ${t}u)`}}function va(e,r){let t=he(e.left).selector,n=he(e.right).selector,o=ao[e.operator]??"==",i=Math.max(-8,Math.min(8,e.margin??0));return`(i32(${Wt(t,r)}) ${o} (i32(${Wt(n,r)}) + ${i}i))`}function Ba(e,r,t,n,o){return`(((${e.map(i=>Le(i,r,t,n,o)).map(i=>`select(0u, 1u, ${i})`).join(" + ")}) & 1u) == 1u)`}function Wt(e,r){return r.get(go(e))}function Kt(e,r,t){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,o=Math.min(n,t),i=Math.ceil(n/o);if(i<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:o,dispatchWgY:i,remapped:!0};throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`)}function yo(e,r,t,n,o,i,s){let a=[],l=e.rules.map((g,F)=>({rule:g,priorityIndex:F,probability:Se(g.probability)})).filter(g=>!g.rule.muted&&g.probability>0),u=l.some(g=>g.probability>0&&g.probability<100),d=s.get(C)??0,m=e.topology===R,p=cr(e.boundaryTribe??C,s,"boundary"),S=ua(l.map(g=>g.rule.clause)),M=la(l.map(g=>g.rule.clause),S);return a.push("// Auto-generated simulation compute shader."),a.push(`// Tribes: ${r.map(g=>g.id).join(", ")}`),a.push(`// Rules: ${e.rules.length}`),a.push(""),a.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),a.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),u&&(a.push(""),oa(a)),a.push(""),a.push(`const COLS: u32 = ${n.cols}u;`),a.push(`const ROWS: u32 = ${n.rows}u;`),a.push(`const PACKED_COLS: u32 = ${t}u;`),u&&a.push(`const RANDOM_SEED: u32 = ${Ot(e.randomSeed)}u;`),ta(a,o),na(a,i),a.push(""),ia(a,"gridIn","PACKED_COLS"),m&&(a.push(""),aa(a,p)),a.push(""),u?a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32, x: u32, y: u32, generation: u32) -> u32 {"):a.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {"),ca(a,S,r,s),da(a,S,M,r,s),a.push(`  var result: u32 = ${d}u;`),a.push(""),fa(a,l,S,M,r,s,u),a.push("  return result;"),a.push("}"),a.push(""),a.push("@compute @workgroup_size(16, 16)"),o.remapped?a.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):a.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),sa(a,o,"px"),a.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),a.push(""),a.push("  let baseX = px << WORD_SHIFT;"),m&&a.push("  let interiorPackedWord = y > 0u && y + 1u < ROWS && baseX > 0u && baseX + CELLS_PER_WORD < COLS;"),a.push("  var packed: u32 = 0u;"),a.push(""),a.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),a.push("    let x = baseX + i;"),a.push("    if (x >= COLS) { break; }"),a.push(""),a.push("    let selfTribe = readCell(x, y);"),m?(so(a),a.push("    if (interiorPackedWord) {"),Kr(a,"boundedDirect","      "),a.push("    } else {"),a.push("      let interiorCell = x > 0u && y > 0u && x + 1u < COLS && y + 1u < ROWS;"),a.push("      if (interiorCell) {"),Kr(a,"boundedDirect","        "),a.push("      } else {"),Kr(a,"boundedVirtual","        "),a.push("      }"),a.push("    }")):(so(a),Kr(a,"toroidal","    ")),a.push(""),u?a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR, x, y, simulationParams.generation) & CELL_MASK) << (i << CELL_SHIFT));"):a.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),a.push("  }"),a.push(""),a.push("  gridOut[y * PACKED_COLS + px] = packed;"),a.push("}"),a.join(`
`)}var Oe=3,fr="gol-recording",Ce="raw-packed",Yt="deflate-raw",Xt=12,qt=256*1024*1024,_o=512*1024*1024;function Ht(e,r,t=0){let n=t;for(let o of e)n+=o[r];return n}function To(e,r){return Math.min(e,r)}function Vt(e){return Math.min(e,1073741824)}function Co(e){return Math.min(e,_o)}function jt(e,r){return Math.max(e*2,r*6)}function Vr(e,r){return e>0&&e<=r}function Ia(e,r){return e>0?e*2+r:0}function wa(e,r){return e>=1&&r>0?e*r*(1+Oe):0}function Aa(e,r){return e<qt?Math.min(qt,r):e}function Ro(e,r){return Vr(e,r)?Math.max(1,Math.floor(Aa(e,r)/e)):0}function jr(e,r){return e>=1&&r>0?Math.max(1,Math.min(Xt,Math.floor(536870912/(e*r)))):Xt}function xo(e,r,t,n,o,i){let s=!r.some(l=>l)&&(o||i>=e),a=o?Math.floor(n/2)+1:n;return e>=1&&r.length>0&&(s||t>=a)}function Mo(e,r,t,n){return e<r&&n.some((o,i)=>t[i]&&o.mapState==="unmapped")}function Eo(e,r,t,n,o,i){return e&&r>=1&&t!==null&&n.length>0&&(o<r||i)}function vo(e,r,t,n){let o=e.quota??0,i=e.usage??0,s=0,a=0;for(let d of r)d.codec===Ce?s+=d.storedBytes:a+=d.storedBytes;let l=t*n,u=(1+Oe)*l;return{quotaBytes:o,usedBytes:i,pendingRawBytes:s,compressedBytes:a,reservedBytes:u}}function Bo(e,r,t,n,o){let i=Vt(e);return{maxBytes:e,vramBudgetBytes:jt(e,i),frameByteSize:r,recordingAvailable:Vr(r,i),vramSimulationBytes:Ia(r,n),vramRecordingBytes:wa(t,r),gridFormat:o}}function pr(e,r,t){r.length>0&&(e.generationStart=r[0].generationStart,e.generationEnd=r[r.length-1].generationEnd),t.length>0&&(r.length===0&&(e.generationStart=t[0]),e.generationEnd=t[t.length-1]),e.chunks=[...r]}function Po(e){return e.map(r=>({...r,generations:[...r.generations]}))}function ko(e,r){return e!==r}function mr(e,r=0){return Ht(e,"blockCount",r)}function Io(e){return Ht(e,"storedBytes")}function wo(e){return Ht(e,"uncompressedBytes")}var Da=256,br=96,Ao=Da*Uint32Array.BYTES_PER_ELEMENT;function Ga(e){return e===R?"  return i32(cell) - center;":"  return signedWrapDelta(cell, center, size);"}function La(e){return e===R?"  return world - f32(center);":"  return signedWrapWorldDelta(world, center, size);"}function Oa(e){return e===R?`  let ix = min(u.grid_size.x - 1u, u.offset_cell.x + u32(local.x));
  let iy = min(u.grid_size.y - 1u, u.offset_cell.y + u32(local.y));`:`  let ix = wrapAdd(u.offset_cell.x, u32(local.x), u.grid_size.x);
  let iy = wrapAdd(u.offset_cell.y, u32(local.y), u.grid_size.y);`}function Fa(e){return`  if (u.export_visible == 1u) {
    if (exportCenterMarkerMask(local) || ${e===R?"exportBoundedCornerMarkerMask(local)":"exportOriginMarkerMask(local)"}) {
      return vec4f(0.0, 0.0, 0.0, 1.0);
    }

    if (exportCenterMarkerOutlineMask(local) || ${e===R?"exportBoundedCornerMarkerOutlineMask(local)":"exportOriginMarkerOutlineMask(local)"}) {
      return vec4f(0.82, 0.84, 0.86, 1.0);
    }
  }`}function Do(e){let r=new ArrayBuffer(br),t=new Float32Array(r),n=new Int32Array(r),o=new Uint32Array(r),i=e.topology===R?e.offsetX:(e.offsetX%e.grid.cols+e.grid.cols)%e.grid.cols,s=e.topology===R?e.offsetY:(e.offsetY%e.grid.rows+e.grid.rows)%e.grid.rows,a=Math.floor(i),l=Math.floor(s);return t[0]=e.canvasWidth,t[1]=e.canvasHeight,t[2]=e.scale,t[4]=i-a,t[5]=s-l,o[6]=e.grid.cols,o[7]=e.grid.rows,o[8]=a,o[9]=l,o[10]=e.tribeCount,n[12]=e.brushPreview.centerX,n[13]=e.brushPreview.centerY,o[14]=e.brushPreview.brushSize,o[15]=e.brushPreview.shape,o[16]=e.brushPreview.visible?1:0,o[17]=e.exportFrameOverlay.originX,o[18]=e.exportFrameOverlay.originY,o[19]=e.exportFrameOverlay.visible?1:0,o[20]=e.topology===R?1:0,r}function Go(e){let r=new Uint32Array(e.length);for(let t=0;t<e.length;t++){let n=e[t].color,o=parseInt(n.substring(0,2),16),i=parseInt(n.substring(2,4),16),s=parseInt(n.substring(4,6),16);r[t]=o|i<<8|s<<16}return r}function Lo(e,r,t){return e.replace("__CELLS_PER_WORD__",`${r.cellsPerWord}u`).replace("__WORD_SHIFT__",`${r.wordShift}u`).replace("__CELL_SHIFT__",`${r.cellShift}u`).replace("__CELL_INDEX_MASK__",`${r.cellIndexMask}u`).replace("__CELL_MASK__",`${r.cellMask}u`).replace("__SIGNED_GRID_DELTA_BODY__",Ga(t)).replace("__SIGNED_GRID_WORLD_DELTA_BODY__",La(t)).replace("__GRID_COORDINATE_ASSIGNMENTS__",Oa(t)).replace("__EXPORT_OVERLAY_BLOCK__",Fa(t))}var Ua=500,Na=33,$a=2,Wa=.5,Oo=.2,Fo=1,za=1048576;function Uo(e){return Math.min(3,Math.max(0,Math.ceil(Math.log10(e.cols*e.rows/1e5))))}function gr(e){return 1024/4**Uo(e)}function Zr(e){return 16/2**Uo(e)}function Ka(e){return Math.max(Fo,Math.round(gr(e)*Zr(e)))}function No(e,r){return{generationsPerDrain:Ka(e),targetDrainMs:r.kind==="max"?Ua:Na,smoothedDrainMs:0,lastDrainStartedAt:0,lastSubmittedGenerations:0}}function $o(e,r){if(r>0&&e.lastSubmittedGenerations>0){let t=e.smoothedDrainMs===0?r:e.smoothedDrainMs*(1-Oo)+r*Oo,n=Math.min($a,Math.max(Wa,e.targetDrainMs/t));e.smoothedDrainMs=t,e.generationsPerDrain=Math.max(Fo,Math.min(za,Math.round(e.generationsPerDrain*n)))}}function Zt(e,r){return e==="recording"?Number.MAX_SAFE_INTEGER:gr(r)*Zr(r)}function Qt(e,r,t,n,o){let i=e-r*n;return t>n||t>o?Math.min(i,r):i}function Wo(e){return e<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/e}}function J(e){return e.request.stopCondition.kind==="targetGeneration"}function Fe(e,r){return e.request.stopCondition.kind==="targetGeneration"&&r>=e.request.stopCondition.generation}function ee(e,r){return e.request.stopCondition.kind==="targetGeneration"?Math.max(0,e.request.stopCondition.generation-r):Number.POSITIVE_INFINITY}function zo(e,r){return r.restore!==!1&&e.request.restoreAfterStop||null}function Ko(e,r,t){return r&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")}function Yo(e,r,t,n,o){return e.restartRestoredRun!==!1&&r&&t&&!n&&!o}function Jt(e,r,t,n){let o=r+t,i=Math.min(n,o-1);if(i<=0)return null;let s=o-1-i;if(s>=r)return{source:"buffered",frameInChunk:s-r};let a=0;for(let l=0;l<e.length;l++){let u=e[l];if(s<a+u.blockCount)return{source:"sealed",sealedIndex:l,frameInChunk:s-a};a+=u.blockCount}return null}function Xo(e,r){return{chunkFrameIndex:r.frameInChunk+1,generation:e[r.frameInChunk]}}function en(e,r,t,n,o,i){let s=(r+1)*t;if(o.bitsPerCell===i.bitsPerCell)return{sameFormat:!0,chunkPrefix:new Uint8Array(e,0,s),activeFrame:null};let a=ie(n,o),l=new Uint8Array(s);for(let u=0;u<=r;u++){let d=new Uint8Array(e,u*a,a),m=zr(Ln(d),n,o,i);l.set(new Uint8Array(m.buffer,m.byteOffset,m.byteLength),u*t)}return{sameFormat:!1,chunkPrefix:l,activeFrame:l.subarray(r*t,s)}}var c,v=!1,st,Jr,Me,$,A=0,D=0,mt=0,P=Dr,ze=[],Ke=new Map,nn,on,L,O,Ye,Ne,Rr,an,sn,Sr,Zo,Qo,Xe=!1,qe=null,ut=[],We=0,N=!1,Jo=1,ei=0,ri=0,k=!1,B=!1,ne=100,b=0,He=0,hr=0,bt=0,et,Ya=4,yn=192,Ve=1024,qo=16,xe=[],lt=[],ct=[],Xa=0,rt=null,ti={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},ni={originX:0,originY:0,visible:!1},de=null,tt=-1,$e=!1,yr=!1,rn=0,xr=Or,nt=[],w=!1,z=!1,re={chunks:[],generationStart:0,generationEnd:0,gridFormat:Qe(Dr)},oi=0,T=[],Mr=!1,h=null,ii=0,ot=!1,K=null,_=0,E=[],fe=null,x=64,y=0,pe=[],X=[],_r=null,Re=null,q=0,Er=0,se=0,te=!1,Ue=0,it=0,at=0,Tr=[];function ai(e){switch(!0){case e instanceof Error:return e.message;case typeof e=="string":return e;case(e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"):return e.message;default:return String(e??"Unknown worker error")}}function gt(e){console.error("[GOLT worker] Worker GPU error:",e),I("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),k=!1,self.postMessage({type:"gpuError",reason:ai(e)})}self.addEventListener("error",e=>{e.preventDefault(),gt(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),gt(e.reason)});async function _n(){await c.queue.onSubmittedWorkDone()}function Ho(e){it=0,at=2+(e?1+Oe:0),Tr=[]}async function dt(){if(Tr.length>0){let e=c.createCommandEncoder({label:f.trackedAllocationClearEncoder});for(let r of Tr)e.clearBuffer(r);c.queue.submit([e.finish()]),await _n(),Tr=[]}}async function ft(e,r){B&&at>0&&(it+=e,at--,Tr.push(r),it>=Co(Ee())&&at>0&&(await dt(),it=0))}function pt(){K?.destroy(),K=null;for(let e of pe)e?.destroy();pe=[],X=[],x=0,_=0,E=[],fe=null,Er=0}function si(){qe?.destroy(),qe=null,ut=[],We=0}function Vo(){L?.destroy(),O?.destroy(),si(),Qn(de),de=null,xe.forEach(e=>e.destroy()),xe=[],lt=[],ct=[],pt()}function Qr(e){let r=q>0;q+=e;let t=q>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function ue(){let e=xo(x,X,se,jr(x,y),te,_);e!==te&&(te=e,self.postMessage({type:"backpressure",active:e}))}async function Be(){self.postMessage({type:"storageQuota",...vo(await navigator.storage.estimate(),T,x,y)})}function Ee(){return To(c.limits.maxBufferSize,c.limits.maxStorageBufferBindingSize)}function Pr(){return Vt(Ee())}function le(){return Vr(y,Pr())}function ui(){return Mo(se,jr(x,y),X,pe)}function vr(){return Eo(le(),x,K,pe,_,ui())}async function qa(e){let r=new DecompressionStream(Yt),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],o=r.readable.getReader();for(;;){let{done:l,value:u}=await o.read();if(l)break;n.push(u)}let i=0;for(let l of n)i+=l.byteLength;let s=new Uint8Array(i),a=0;for(let l of n)s.set(l,a),a+=l.byteLength;return s.buffer}function H(){return{cols:A,rows:D}}function Ha(){return Kt(Math.ceil(mt/16),Math.ceil(D/16),c.limits.maxComputeWorkgroupsPerDimension)}function Va(){return Kt(Math.ceil(A/16),Math.ceil(D/16),c.limits.maxComputeWorkgroupsPerDimension)}function un(){Ye?.destroy(),Ye=c.createBuffer({label:f.uniformBuffer,size:br,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function ja(){let e=Do({canvasWidth:Me.width,canvasHeight:Me.height,scale:Jo,offsetX:ei,offsetY:ri,grid:H(),topology:$.topology,tribeCount:ze.length,brushPreview:ti,exportFrameOverlay:ni});c.queue.writeBuffer(Ye,0,e)}function ht(){return ie({cols:A,rows:D},P)}function me(){return Qe(P)}async function ln(){let e=ht();L=c.createBuffer({label:f.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ft(e,L),O=c.createBuffer({label:f.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ft(e,O);let r=c.createCommandEncoder({label:f.gridClearEncoder});r.clearBuffer(L),r.clearBuffer(O),c.queue.submit([r.finish()]),N=!1}function cn(){let e=Go(ze);Ne&&Ne.destroy(),Ne=c.createBuffer({label:f.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),c.queue.writeBuffer(Ne,0,e)}function dn(){let e=$.topology,r=c.createShaderModule({label:`${f.renderShaderModule} (${e})`,code:Lo(kn,P,e)});Rr=c.createRenderPipeline({label:`${f.renderPipeline} (${e})`,layout:"auto",vertex:{module:r,entryPoint:"vs_main"},fragment:{module:r,entryPoint:"fs_main",targets:[{format:Jr}]},primitive:{topology:"triangle-list"}})}function fn(){an=c.createBindGroup({layout:Rr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ye}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:Ne}}]}),sn=c.createBindGroup({layout:Rr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ye}},{binding:1,resource:{buffer:O}},{binding:2,resource:{buffer:Ne}}]})}function Za(){return $.rules.some(e=>{let r=Se(e.probability);return!e.muted&&r>0&&r<100})}function Qa(){We=Math.max(qo,c.limits.minUniformBufferOffsetAlignment),qe=c.createBuffer({label:f.simulationParameterBuffer,size:We*Ve,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),ut=[];let e=Sr.getBindGroupLayout(1);for(let r=0;r<Ve;r++)ut.push(c.createBindGroup({label:`${f.simulationParameterBindGroup} ${r}`,layout:e,entries:[{binding:0,resource:{buffer:qe,offset:r*We,size:qo}}]}))}async function pn(){si(),nn=Ha(),Xe=Za();let e=yo($,ze,mt,H(),nn,P,Ke),r=c.createShaderModule({label:f.simulationShaderModule,code:e}),t=await r.getCompilationInfo(),n=t.messages.filter(i=>i.type==="error"),o=t.messages.filter(i=>i.type==="warning");if(o.length>0&&self.postMessage({type:"gpuWarning",reason:`Simulation shader warning: ${o.map(i=>i.message).join(" ")}`}),n.length>0)throw new Error(`Simulation shader compilation failed: ${n.map(i=>i.message).join(" ")}`);Sr=await c.createComputePipelineAsync({label:f.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),Zo=c.createBindGroup({label:f.simulationBindGroupAtoB,layout:Sr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:O}}]}),Qo=c.createBindGroup({label:f.simulationBindGroupBtoA,layout:Sr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}},{binding:1,resource:{buffer:L}}]}),Xe&&(Qa(),console.info("[GOLT worker] Probabilistic rule compute path enabled",{randomSeed:$.randomSeed,parameterSlots:Ve}))}function mn(){on=Va(),de=Zn({device:c,cols:A,rows:D,gridFormat:P,topology:$.topology,dispatchPlan:on})}function bn(){let e=c.createShaderModule({label:f.brushShaderModule,code:oo(P)});et=c.createComputePipeline({label:f.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),xe.forEach(r=>r.destroy()),xe=[],lt=[],ct=[];for(let r=0;r<Ya;r++){let t=c.createBuffer({label:`${f.brushUniformBuffer} ${r}`,size:yn,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});xe.push(t),lt.push(c.createBindGroup({layout:et.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:t}}]})),ct.push(c.createBindGroup({layout:et.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}},{binding:1,resource:{buffer:t}}]}))}}function Ja(e,r){let t=Ke.get(C)??0,n=Xa++,o=io(r.centerX,r.centerY,r.brushSize,H(),$.topology),i=N?ct:lt;for(let[s,a]of o.entries()){let l=new ArrayBuffer(yn),u=new Uint32Array(l);u[0]=mt,u[1]=r.brushSize,u[2]=r.shape,u[3]=r.fill,u[4]=t,u[5]=n,u[6]=r.tribeIds.length,u[7]=a.destinationStartX,u[8]=a.destinationStartY,u[9]=a.localStartX,u[10]=a.localStartY,u[11]=a.spanCols,u[12]=a.spanRows,u[13]=r.density,u[14]=0,u[15]=0;for(let p=0;p<r.tribeIds.length&&p<32;p++)u[16+p]=r.tribeIds[p];let d=xe[s],m=i[s];if(d&&m){c.queue.writeBuffer(d,0,l);let p=Math.floor(a.destinationStartX/P.cellsPerWord),M=Math.ceil((a.destinationStartX+a.spanCols)/P.cellsPerWord)-p,g=Math.ceil(M/8),F=Math.ceil(a.spanRows/8),j=e.beginComputePass({label:f.brushPass});j.setPipeline(et),j.setBindGroup(0,m),j.dispatchWorkgroups(g,F),j.end()}else throw console.error("[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.",{index:s,rectCount:o.length,bindGroupCount:i.length,uniformBufferCount:xe.length}),new Error("Brush dispatch resources are out of sync with the wrapped brush rectangles.")}}function es(){let e=N?O:L,r=ht(),t;try{t=c.createBuffer({label:f.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(o){return console.warn("GPU readback buffer allocation failed:",o),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=c.createCommandEncoder({label:f.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),c.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let o=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),o})}function li(){y=ht(),x=Ro(y,Pr())}function rs(){let e=Xe?We*Ve:0;return br+Ao+yn+De*2+Ge*2+e}function gn(){self.postMessage({type:"limits",...Bo(Ee(),y,x,rs(),me())})}function ci(){return x>=1&&K!==null&&_<x}function di(e,r){let t=N?O:L,n=_*y;e.copyBufferToBuffer(t,0,K,n,y),E.push(r),fe=r,_++}function Tn(e){if(ci()){let r=c.createCommandEncoder({label:f.recordingFrameCopyEncoder});di(r,e),c.queue.submit([r.finish()]),Cr()}}function tn(e){Er=Math.max(0,Er+e)}function Cr(){x>0&&_>=x&&ui()&&kr()}function kr(){let e=K;if(e!==null&&_>0&&pe.length>0&&se<jr(x,y)){let r=X.indexOf(!0);if(r>=0){X[r]=!1;let t=pe[r];if(t.mapState==="unmapped"){let n=_*y,o=oi++,i=[...E],s=i[0],a=i[i.length-1],l=`chunk-${String(o).padStart(6,"0")}.bin`,u=_,d=c.createCommandEncoder({label:f.recordingSealCopyEncoder});d.copyBufferToBuffer(e,0,t,0,n),c.queue.submit([d.finish()]);let m={chunkId:o,generationStart:s,generationEnd:a,blockCount:u,codec:Ce,uncompressedBytes:n,storedBytes:n,gridFormat:me(),generations:i,filename:l};Qr(1),tn(u),se++,ue();let p=Ue;t.mapAsync(GPUMapMode.READ).then(async()=>{let S=t.getMappedRange(),M=new ArrayBuffer(n);new Uint8Array(M).set(new Uint8Array(S,0,n)),t.unmap(),p===Ue&&(X[r]=!0,T.push(m),tn(-u),pr(re,T,E),ue(),Cr(),ts(m,M).then(()=>{p===Ue&&(se--,ue(),Qr(-1),Be(),Br(),V(!0),Cr(),self.postMessage({type:"chunkSealed",filename:m.filename,rawBytes:n,blockCount:m.blockCount,cols:A,rows:D,rawGridFormat:m.gridFormat,storageGridFormat:Qe(Gr($.tribes.length))}),Mr&&q===0&&(Mr=!1,Br()))}).catch(g=>{p===Ue&&(se--,ue(),Qr(-1),as(m,g).catch(gt))}))}).catch(()=>{p===Ue&&(X[r]=!0,se--,tn(-u),ue(),Qr(-1),Cr())}),_=0,E=[]}else X[r]=!0}}}async function fi(e){Ue++,oi=0,_=0,E=[],T=[],fe=null,Er=0,se=0,q>0&&(q=0,self.postMessage({type:"chunksSaving",active:!1})),te&&(te=!1,self.postMessage({type:"backpressure",active:!1})),Mr=!1,z=w,re={chunks:[],generationStart:e,generationEnd:e,gridFormat:me()},await mi(),Be()}async function Cn(){return Re&&await Re,_r||(_r=await(await navigator.storage.getDirectory()).getDirectoryHandle(fr,{create:!0})),_r}async function ts(e,r){let t=await Cn(),o=await(await t.getFileHandle(e.filename,{create:!0})).createWritable(),i=!1;try{await o.write(r),await o.close(),i=!0,o=null}catch(s){if(o&&!i)try{await o.abort()}catch(a){console.warn("[GOLT worker] Failed to abort recording chunk write after error:",a)}try{await t.removeEntry(e.filename)}catch(a){a instanceof DOMException&&a.name==="NotFoundError"||console.warn("[GOLT worker] Failed to remove failed recording chunk:",e.filename,a)}throw s}}function ns(e){let r=ai(e).toLowerCase();return e instanceof DOMException&&e.name==="QuotaExceededError"||r.includes("storage quota")||r.includes("quota exceeded")||r.includes("exceed its storage quota")}function pi(e){let r=T.findIndex(t=>t.filename===e.filename);r>=0&&T.splice(r,1)}async function os(){let e=null,r=mr(T),t=Jt(T,r,0,1);if(t?.source==="sealed"){let{frameInChunk:n}=t,o=T[t.sealedIndex];try{let i=(n+1)*y,s=await bi(o.filename,o.codec),a=H(),l=Lr(o.gridFormat),u=en(s,n,y,a,l,P),d=u.activeFrame??u.chunkPrefix.subarray(n*y,i);if(c.queue.writeBuffer(N?O:L,0,d),_=0,E=[],b=o.generations[n]??o.generationEnd,fe=b,e=b,n<o.blockCount-1){let p=n+1,S=o.blockCount>0?Math.floor(o.uncompressedBytes/o.blockCount):y;o.blockCount=p,o.generationEnd=b,o.generations=o.generations.slice(0,p),o.uncompressedBytes=S*p,o.codec===Ce&&(o.storedBytes=y*p)}let m=T.splice(t.sealedIndex+1);await hn(m.map(p=>p.filename)),St(),_i(),U()}catch(i){console.warn("[GOLT worker] Failed to restore the previous persisted recording frame after storage quota pressure:",i)}}else{let n=T.splice(0);await hn(n.map(o=>o.filename)),_=0,E=[]}return e}async function is(e,r){console.warn("[GOLT worker] Recording stopped because OPFS storage quota was reached:",r),pi(e),I("cancelled",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),k=!1,w=!1,z=!1;let t=await os();pr(re,T,E),ue(),Be(),Br(),V(!0),self.postMessage({type:"recordingStopped",reason:"storageQuota",restoredGeneration:t})}async function as(e,r){pi(e),ns(r)?await is(e,r):gt(r)}async function hn(e){let r=await Cn();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function mi(){if(Re)await Re;else{Re=(async()=>{let e=await navigator.storage.getDirectory();_r=null;try{await e.removeEntry(fr,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${fr}:`,r)}_r=await e.getDirectoryHandle(fr,{create:!0})})();try{await Re}finally{Re=null}}}function Br(){pr(re,T,E),self.postMessage({type:"recording",manifest:{chunks:Po(T),generationStart:re.generationStart,generationEnd:re.generationEnd,gridFormat:me()},cols:A,rows:D})}function Ir(e=!1){if(w){let r=!z;e&&z&&vr()&&(z=!1,r=!0),r&&ko(fe,b)&&vr()&&(_>=x&&kr(),Tn(b))}}function Rn(){if(rt){let e=rt;rt=null;let r=w&&_>0&&E[_-1]===b;r&&(_--,E.pop());let t=c.createCommandEncoder({label:f.brushEncoder});Ja(t,e),c.queue.submit([t.finish()]),r&&Tn(b)}}async function bi(e,r=Ce){let i=await(await(await(await Cn()).getFileHandle(e)).getFile()).arrayBuffer();return r===Yt?qa(i):i}function gi(){return Xn(A,D,xr.enabled,xr.sections)}function ss(){return qn(gi())}function hi(e){nt=ss(),de&&nt.length>0&&Jn({device:c,encoder:e,resources:de,sourceBuffer:N?O:L,dispatchPlan:on,enabledSections:nt})}function Si(){let e=b;if(de&&e!==tt&&!$e){let r=[...nt],t=gi();tt=e,$e=!0,eo({resources:de,enabledSections:r}).then(n=>{let o=Ke.get(C)??0,i=mr(T,_+Er),s=ro({generation:e,tribes:ze,deadTribeIndex:o,readback:n,enabledSections:r,availability:t,liveMetricSettings:xr.sections,cols:A,rows:D,topology:$.topology,totalFrames:i,fps:bt,canStepBack:i>1,recordingBytes:Io(T),recordingRawBytes:wo(T)});if($e=!1,self.postMessage(s),yr)if(yr=!1,tt=-1,Ci()){let a=c.createCommandEncoder({label:f.interactiveMetricsEncoder});hi(a),c.queue.submit([a.finish()]),Si()}else yr=!0}).catch(()=>{$e=!1})}}function xn(e){if(Xe&&qe&&e>0){let r=Math.min(e,Ve),t=We/Uint32Array.BYTES_PER_ELEMENT,n=new Uint32Array(r*t);for(let o=0;o<r;o++)n[o*t]=b+o;c.queue.writeBuffer(qe,0,n)}}function yi(e){let r=e;return Xe&&(r=Math.min(e,Ve)),r}function Mn(e,r=0){let t=e.beginComputePass({label:f.simulationStepPass});t.setPipeline(Sr),t.setBindGroup(0,N?Qo:Zo),Xe&&t.setBindGroup(1,ut[r]);let n=nn;t.dispatchWorkgroups(n.dispatchWgX,n.dispatchWgY),t.end(),N=!N,b++}function us(e){let r=yi(e);if(r>0){xn(r);let t=c.createCommandEncoder({label:f.simulationBatchEncoder});for(let n=0;n<r;n++)Mn(t,n);c.queue.submit([t.finish()]),He+=r}}function _i(){self.postMessage({type:"generation",generation:b,fps:bt})}function ls(){xn(1);let e=c.createCommandEncoder({label:f.simulationSingleStepEncoder});Mn(e),c.queue.submit([e.finish()])}function U(){if(c&&st&&Ye&&Rr&&an&&sn&&!B&&!v){ja();let e=st.getCurrentTexture().createView(),r=c.createCommandEncoder({label:f.renderEncoder}),t=r.beginRenderPass({label:f.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(Rr),t.setBindGroup(0,N?sn:an),t.draw(3),t.end(),c.queue.submit([r.finish()])}}function Ti(e){hr===0&&(hr=e);let r=e-hr;r>=1e3&&(bt=He/(r/1e3),He=0,hr=e)}function St(){He=0,hr=0,bt=0}function En(){return w&&le()?"recording":"nonRecording"}function Ci(){return!!(c&&de&&!B&&!v)}function V(e=!1){if(e&&(tt=-1),!Ci())yr=!0;else if($e)yr=!0;else{let r=c.createCommandEncoder({label:f.interactiveMetricsEncoder});hi(r),c.queue.submit([r.finish()]),Si()}}function Ri(){V(!0),U()}function yt(e,r){r&&(e-rn>=1e3||rn===0)&&!$e&&(rn=e,V())}function wr(e,r){(e.request.pacing.kind==="max"||J(e))&&r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,_i())}function je(e){te!==e&&(te=e,self.postMessage({type:"backpressure",active:e}))}function xi(){let e=vr();return e&&_>=x&&(kr(),e=vr()),e}function Ar(){!B&&!v&&!h&&self.requestAnimationFrame(Sn)}function cs(e,r){let t=e.adaptiveBatch;t&&t.lastDrainStartedAt>0&&($o(t,r-t.lastDrainStartedAt),t.lastDrainStartedAt=0,t.lastSubmittedGenerations=0)}function Mi(e,r,t){let n=e.adaptiveBatch;n&&r>0&&(n.lastSubmittedGenerations=r,n.lastDrainStartedAt=t)}function Ei(e,r){let t=Math.max(1,Math.round(gr(r))),n=0;for(;n<e;){let o=e-n,i=Math.min(t,o);us(i),n+=i}return n}function ve(e){let r=h;if(r&&!r.pumpPending&&!B&&!v){let{token:t}=r;r.pumpPending=!0;let n=()=>{if(h&&h.token===t){let o=performance.now();h.pumpPending=!1,e==="drain"&&cs(h,o),hs(o)}};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?c.queue.onSubmittedWorkDone().then(n).catch(()=>{h?.token===t&&(h.pumpPending=!1)}):queueMicrotask(n)}}function vn(e,r){h&&I("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1});let t=H(),n=e==="nonRecording"?No(t,r.pacing):null;n&&console.info("[GOLT worker] Adaptive non-recording batching started",{cols:t.cols,rows:t.rows,bitsPerCell:P.bitsPerCell,generationsPerDrain:n.generationsPerDrain,targetDrainMs:n.targetDrainMs}),h={kind:e,request:r,token:++ii,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0,adaptiveBatch:n},ve(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function ce(){k&&vn(En(),{pacing:Wo(ne),stopCondition:{kind:"none"}})}function ds(e,r){r||e==="cancelled"?je(!1):te&&ue()}function I(e,r={}){let t=h;if(t){h=null,ii++;let n=J(t),o=zo(t,r),i=!!o;o&&(k=o.running,ne=o.targetStepDuration),Ko(e,n,r)&&self.postMessage({type:"stepping",active:!1}),ds(e,n),r.render!==!1&&!B&&!v&&Ri(),Yo(r,i,k,B,v)?ce():Ar()}}function vi(e){let r=h;r&&J(r)&&(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),I("cancelled"))}function fs(e){I("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),vn(En(),e)}function Bi(e,r,t){je(!0),wr(e,r),yt(r,t),ve("drain")}function Pi(e,r){let t=yi(e);xn(t);let n=c.createCommandEncoder({label:f.recordingStepBatchEncoder}),o=0,i=!1,s=t>0;for(;s;)o<t&&performance.now()<r?xi()&&ci()?(Mn(n,o),di(n,b),o++,_>=x&&(s=!1)):(i=!0,s=!1):s=!1;return o>0&&(c.queue.submit([n.finish()]),He+=o,Cr()),{steps:o,blocked:i}}function ps(e,r){let t=H(),n=e.adaptiveBatch?.generationsPerDrain??Math.round(gr(t)*Zr(t)),o=Math.min(n,ee(e,b)),i=Ei(o,t),s=i>0;wr(e,r),Fe(e,b)?I("targetReached"):s?(Mi(e,i,performance.now()),ve("drain")):ve("raf")}function ms(e,r){Ir(!0);let t=!1,n=!1,o=performance.now()+14,i=ee(e,b)>0&&performance.now()<o;for(;i;){let s=Pi(ee(e,b),o);t=t||s.steps>0,s.blocked?(Bi(e,r,t),n=!0,i=!1):i=s.steps>0&&ee(e,b)>0&&performance.now()<o}n||(je(!1),wr(e,r),yt(r,t),Fe(e,b)?I("targetReached"):ve("raf"))}function bs(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let o=e.stepAccumulator,i=Math.floor(e.stepAccumulator/r),s=H(),a=e.adaptiveBatch?.generationsPerDrain??Zt(e.kind,s),l=Math.min(i,ee(e,b),a),u=Ei(l,s),d=u>0;if(e.stepAccumulator=Qt(o,r,i,u,a),wr(e,t),Fe(e,b))I("targetReached");else{let m=d&&i>u;(!J(e)&&!m||t-e.lastRenderTime>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,U(),yt(t,d)),m&&Mi(e,u,performance.now()),ve(m?"drain":"raf")}}function gs(e,r,t){Ir(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let o=!1,i=0,s=e.stepAccumulator,a=Zt(e.kind,H()),l=Math.floor(e.stepAccumulator/r),u=performance.now()+14,d=!1,m=l>0&&ee(e,b)>0&&i<a&&performance.now()<u;for(;m;){let p=Math.min(l-i,a-i,ee(e,b)),S=Pi(p,u);i+=S.steps,o=o||S.steps>0,S.blocked?(Bi(e,t,o),d=!0,m=!1):m=S.steps>0&&l>i&&ee(e,b)>0&&i<a&&performance.now()<u}e.stepAccumulator=Qt(s,r,l,i,a),d||(je(!1),wr(e,t),Fe(e,b)?I("targetReached"):(J(e)||(U(),yt(t,o)),ve("raf")))}function hs(e){let r=h;if(r&&!B&&!v)if(Ti(e),J(r)||Rn(),Fe(r,b))I("targetReached");else if(r.request.pacing.kind==="max")r.kind==="recording"?ms(r,e):ps(r,e);else{let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?gs(r,t,e):bs(r,t,e)}}function Sn(e){B||v?self.requestAnimationFrame(Sn):(Ti(e),h||(Rn(),ne>0&&!ot&&U(),self.requestAnimationFrame(Sn)))}function Ss(e,r){let t=c?Ee():Number.POSITIVE_INFINITY;return An(r.bitsPerCell)&&xt(r.bitsPerCell,e.tribes.length)&&Mt(e,Ze(r.bitsPerCell),t)?Ze(r.bitsPerCell):Gn(e.tribes.length,e,t)}function ki(e,r){let t=zn(e),n=t.topology===R?R:On,o=t.tribes.some(i=>i.id===t.boundaryTribe)?t.boundaryTribe:C;$={...t,topology:n,boundaryTribe:o},A=t.cols,D=t.rows,P=Ss(t,r),mt=be(A,P),ze=[...$.tribes],re.gridFormat=me(),Ke.clear(),ze.forEach((i,s)=>Ke.set(i.id,s))}async function Ii(e){console.log("[GOLT worker] Initializing WebGPU"),Me=e,c=await Kn(f.webengineDevice),v=!1,c.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),I("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),v=!0,k=!1,B=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:Ee(),vramBudgetBytes:jt(Ee(),Pr()),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:me()});let r=Me.getContext("webgpu");if(r)st=r,Jr=navigator.gpu.getPreferredCanvasFormat(),st.configure({device:c,format:Jr,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:Jr,maxBufferSize:c.limits.maxBufferSize,maxStorageBufferBindingSize:c.limits.maxStorageBufferBindingSize});else throw new Error("WebGPU canvas context not available")}async function ys(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Ii(Me),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),I("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),v=!0,k=!1,B=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function wi(){K=c.createBuffer({label:f.recordingChunkBuffer,size:x*y,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ft(x*y,K),_=0,E=[],fe=null}async function Ai(){let e=x*y;pe=[],X=[];for(let r=0;r<Oe;r++){let t=c.createBuffer({label:`${f.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});pe.push(t),X.push(!0),await ft(e,t)}}async function _s(){await mi()}async function Ts(){console.log("[GOLT worker] Building GPU resources",{cols:A,rows:D,bitsPerCell:P.bitsPerCell,recordingAvailable:le()}),un(),li(),await ln(),cn(),dn(),fn(),await pn(),bn(),mn(),await _s(),le()?(await wi(),await Ai()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:y,maxRecordingBufferBytes:Pr()}),pt(),w=!1,z=!1),await dt(),gn(),console.log("[GOLT worker] GPU resources ready")}async function Cs(){console.log("[GOLT worker] Rebuild started",{cols:A,rows:D,bitsPerCell:P.bitsPerCell}),I("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),B=!0,self.postMessage({type:"rebuilding",active:!0});try{await _n()}catch{console.warn("[GOLT worker] Queue idle wait rejected during rebuild")}let e=!v;if(v&&(e=await ys()),e){Vo(),un(),li(),Ho(le());try{await ln(),cn(),dn(),await pn(),bn(),fn(),mn(),le()?(await wi(),await Ai()):(pt(),w=!1,z=!1),await dt(),gn()}catch(r){let t=r instanceof Error?r.message:String(r);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{Vo(),un(),Ho(!1),await ln(),cn(),dn(),await pn(),bn(),fn(),mn(),w=!1,z=!1,y=ht(),pt(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await dt(),gn()}catch(n){console.error("[GOLT worker] GPU rebuild recovery failed:",n),e=!1}}}return e&&(B=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:le(),frameByteSize:y})),e}function jo(e){ot=!0,c.queue.onSubmittedWorkDone().then(()=>{ot=!1,e()}).catch(()=>{ot=!1})}async function Rs(){q>0&&await new Promise(e=>{let r=setInterval(()=>{q===0&&(clearInterval(r),e())},10)})}async function xs(e){console.log("[GOLT worker] Init message received",{cols:e.ruleset.cols,rows:e.ruleset.rows,recording:e.recording,running:e.running,speed:e.speed}),w=e.recording,xr=vt(e.liveMetrics),z=w,ki(e.ruleset,e.simulationGridFormat),await Ii(e.canvas),await Ts(),V(!0),Be(),k=e.running,ne=e.speed<0?0:1e3/e.speed,k?ce():Ar()}function Ms(e){xr=vt(e.liveMetrics),V(!0)}async function Es(e){console.log("[GOLT worker] Ruleset update received",{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length});let r=Ee();if(Et(e.ruleset.tribes.length,e.ruleset,r))I("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),ki(e.ruleset,e.simulationGridFormat),await Cs()&&(b=0,St(),await fi(0),V(!0),k?ce():Ar());else{let o=`Requested ruleset requires at least ${Dn(e.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",o,{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length,maxBytes:r}),self.postMessage({type:"gpuError",reason:o})}}function vs(e){k=e.running,e.running?h||ce():h&&J(h)?vi(!1):h?I("manual"):(te&&ue(),Ri(),Ar())}function Bs(e){let r=ne<=0,t=e.speed<0?0:1e3/e.speed;ne=t,h&&!J(h)&&k?(I("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&t>0?jo(()=>{U(),ce()}):ce()):k&&!h?ce():r&&t>0&&jo(()=>{U(),Ar()})}function Ps(e){Jo=e.scale,ei=e.offsetX,ri=e.offsetY,!h&&!B&&!v&&U()}function ks(e){Me.width=e.width,Me.height=e.height,!h&&!B&&!v&&U()}function Is(e){let r=e.tribes.map(t=>Ke.get(t)).filter(t=>t!==void 0);if(r.length>0){let t={square:0,round:1,diamond:2,vline:3,hline:4},n={full:0,spray:1,outline:2};rt={centerX:e.x,centerY:e.y,brushSize:e.size,shape:t[e.shape]??0,fill:n[e.fill]??0,density:wn(e.density),tribeIds:r}}}function ws(e){let r={square:0,round:1,diamond:2,vline:3,hline:4};ti={centerX:e.x,centerY:e.y,brushSize:e.size,shape:r[e.shape]??0,visible:e.visible},!h&&!B&&!v&&ne<=0&&U()}function As(e){ni={originX:e.origin?.originX??0,originY:e.origin?.originY??0,visible:e.visible&&e.origin!==null},!h&&!B&&!v&&ne<=0&&U()}async function Ds(){try{let e=await es();Ft({type:"snapshot",grid:e,generation:b,cols:A,rows:D,gridFormat:me()},[e.buffer])}catch{let e=new Uint32Array(0);Ft({type:"snapshot",grid:e,generation:b,cols:A,rows:D,gridFormat:me()},[e.buffer])}}async function Gs(e){let r=Lr(e.gridFormat),t=H();if(e.grid.byteLength===ie(t,r)){let n=zr(e.grid,t,r,P);c.queue.writeBuffer(N?O:L,0,n),b=e.generation,St(),await fi(e.generation)}}function Ls(e){let r=h?.request,t=le();e.recording&&t&&!w?(w=!0,z=!0,V(!0),Be()):(!e.recording||!t)&&(e.recording&&!t&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:y,maxRecordingBufferBytes:Pr()}),w=!1,z=!1),r&&h?fs(r):!h&&k&&ce()}async function Os(){Mr||(await _n(),Ir(!1),_>0&&kr(),q>0?Mr=!0:Br())}async function Fs(e){let r=mr(T),t=Jt(T,r,_,e.count);if(t){let n=N?O:L;if(t.source==="buffered"){let o=Xo(E,t);_=o.chunkFrameIndex,E.length=_,b=o.generation,fe=b;let i=c.createCommandEncoder({label:f.recordingRestoreCopyEncoder});i.copyBufferToBuffer(K,t.frameInChunk*y,n,0,y),c.queue.submit([i.finish()])}else{q>0&&(await Rs(),r=mr(T));let o=T[t.sealedIndex],i=await bi(o.filename,o.codec),s=H(),a=Lr(o.gridFormat),l=en(i,t.frameInChunk,y,s,a,P);if(c.queue.writeBuffer(K,0,l.chunkPrefix),!l.sameFormat&&l.activeFrame&&c.queue.writeBuffer(n,0,l.activeFrame),_=t.frameInChunk+1,E=o.generations.slice(0,t.frameInChunk+1),b=E[t.frameInChunk],fe=b,l.sameFormat){let d=c.createCommandEncoder({label:f.recordingRestoreCopyEncoder});d.copyBufferToBuffer(K,t.frameInChunk*y,n,0,y),c.queue.submit([d.finish()])}let u=T.splice(t.sealedIndex);hn(u.map(d=>d.filename))}pr(re,T,E),Be(),St(),V(!0),U()}}function Us(){Rn(),Ir(!0),!w||xi()?(ls(),He++,w&&vr()&&(_>=x&&kr(),Tn(b)),je(!1)):je(!0),V(!0),U()}function Ns(e){self.postMessage({type:"stepping",active:!0}),Ir(!0),vn(En(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:b+e},restoreAfterStop:{running:k,targetStepDuration:ne}})}function $s(e){e.count===1?Us():Ns(e.count)}function Ws(){vi(h?.request.restoreAfterStop?.running??k)}function zs(e){let r=T.find(t=>t.filename===e.filename);r&&(r.codec=e.codec,r.storedBytes=e.storedBytes,r.gridFormat=e.gridFormat,re.chunks=[...T],Be(),Br())}function Ks(){let e=T.filter(r=>r.codec===Ce).map(r=>({filename:r.filename,rawBytes:r.uncompressedBytes,blockCount:r.blockCount,cols:A,rows:D,rawGridFormat:r.gridFormat,storageGridFormat:Qe(Gr($.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:e})}async function Ys(e){switch(e.type){case"init":await xs(e);break;case"setLiveMetrics":Ms(e);break;case"setRuleset":await Es(e);break;case"setRunning":vs(e);break;case"setSpeed":Bs(e);break;case"camera":Ps(e);break;case"resize":ks(e);break;case"draw":Is(e);break;case"brushPreview":ws(e);break;case"exportFrameOverlay":As(e);break;case"getSnapshot":await Ds();break;case"loadSnapshot":await Gs(e);break;case"setRecording":Ls(e);break;case"getRecording":await Os();break;case"stepBack":await Fs(e);break;case"stepForward":$s(e);break;case"cancelStepping":Ws();break;case"updateChunkCodec":zs(e);break;case"getUncompressedChunks":Ks();break}}self.onmessage=async e=>{await Ys(e.data)};
