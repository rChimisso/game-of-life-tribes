var Ft="goltTimestampedConsoleInstalled";function gi(){let e=globalThis;e[Ft]||(e[Ft]=!0,Tr("info"),Tr("warn"),Tr("error"),console.log=console.info.bind(console))}function Tr(e){let r=console[e].bind(console);console[e]=(...t)=>{r(`[${new Date().toISOString()}]`,...t)}}gi();var Dt=`// Render shader: draws the grid as a full-screen quad.
// Reads cell tribe IDs from a storage buffer, looks up colors from a uniform array.
// Supports zoom, pan, and toroidal tiling.

struct Uniforms {
  canvas_size: vec2f,    // Canvas width, height in pixels.
  scale: f32,            // Pixels per cell.
  offset_frac: vec2f,    // Fractional camera offset in cell units.
  grid_size: vec2u,      // Grid cols, rows.
  offset_cell: vec2u,    // Integer camera offset in cell units.
  tribe_count: u32,      // Number of tribes.
  preview_center: vec2i, // Brush preview center cell.
  preview_size: u32,     // Brush preview size in cells.
  preview_shape: u32,    // 0=square 1=round 2=diamond 3=vline 4=hline.
  preview_visible: u32,  // 1 when the brush preview should render.
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> grid: array<u32>;
@group(0) @binding(2) var<storage, read> tribe_colors: array<u32>;

const CELLS_PER_WORD: u32 = __CELLS_PER_WORD__;
const WORD_SHIFT: u32 = __WORD_SHIFT__;
const CELL_SHIFT: u32 = __CELL_SHIFT__;
const CELL_INDEX_MASK: u32 = __CELL_INDEX_MASK__;
const CELL_MASK: u32 = __CELL_MASK__;

fn wrapAdd(base: u32, delta: u32, size: u32) -> u32 {
  let rem = delta % size;
  if (base >= size - rem) {
    return base - (size - rem);
  }
  return base + rem;
}

fn wrapCell(value: i32, size: u32) -> i32 {
  return ((value % i32(size)) + i32(size)) % i32(size);
}

fn signedWrapDelta(cell: u32, center: i32, size: u32) -> i32 {
  let wrapped_center = wrapCell(center, size);
  var delta = i32(cell) - wrapped_center;
  let half_size = i32(size) / 2;
  if (delta > half_size) {
    delta = delta - i32(size);
  } else if (delta < -half_size) {
    delta = delta + i32(size);
  }
  return delta;
}

fn previewInShape(bx: i32, by: i32, size: u32, shape: u32) -> bool {
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

fn signedWrapWorldDelta(world: f32, center: i32, size: u32) -> f32 {
  let gridSize = f32(size);
  let wrappedCenter = f32(wrapCell(center, size));
  let delta = world - wrappedCenter;
  return delta - floor((delta + gridSize * 0.5) / gridSize) * gridSize;
}

fn previewRectangleOutline(p: vec2f, halfSize: vec2f, stroke: f32) -> bool {
  let distanceInside = halfSize - abs(p);
  let inside = distanceInside.x >= 0.0 && distanceInside.y >= 0.0;
  return inside && min(distanceInside.x, distanceInside.y) <= stroke;
}

fn previewCellBorderOutlineMask(ix: u32, iy: u32, cell_frac: vec2f) -> bool {
  let size = max(u.preview_size, 1u);
  let half = i32(size - 1u) / 2;
  let bx = signedWrapDelta(ix, u.preview_center.x, u.grid_size.x) + half;
  let by = signedWrapDelta(iy, u.preview_center.y, u.grid_size.y) + half;
  let inside = previewInShape(bx, by, size, u.preview_shape);
  let edge = min(1.0, 1.0 / max(u.scale, 0.001));
  return inside && (
    (!previewInShape(bx - 1, by, size, u.preview_shape) && cell_frac.x <= edge) ||
    (!previewInShape(bx + 1, by, size, u.preview_shape) && cell_frac.x >= 1.0 - edge) ||
    (!previewInShape(bx, by - 1, size, u.preview_shape) && cell_frac.y <= edge) ||
    (!previewInShape(bx, by + 1, size, u.preview_shape) && cell_frac.y >= 1.0 - edge)
  );
}

fn previewContinuousOutlineMask(local: vec2f) -> bool {
  let size = max(u.preview_size, 1u);
  let world = vec2f(f32(u.offset_cell.x), f32(u.offset_cell.y)) + local;
  let delta = vec2f(
    signedWrapWorldDelta(world.x, u.preview_center.x, u.grid_size.x),
    signedWrapWorldDelta(world.y, u.preview_center.y, u.grid_size.y)
  );
  let footprintCenter = vec2f(0.5, 0.5);
  let p = delta - footprintCenter;
  let halfSize = f32(size) * 0.5;
  let stroke = 1.0 / max(u.scale, 0.001);

  switch (u.preview_shape) {
    case 1u: {
      return abs(length(p) - halfSize) <= stroke;
    }
    case 2u: {
      return abs(abs(p.x) + abs(p.y) - halfSize) <= stroke;
    }
    case 3u: {
      return previewRectangleOutline(p, vec2f(0.5, halfSize), stroke);
    }
    case 4u: {
      return previewRectangleOutline(p, vec2f(halfSize, 0.5), stroke);
    }
    default: {
      return previewRectangleOutline(p, vec2f(halfSize, halfSize), stroke);
    }
  }
}

fn previewOutlineMask(ix: u32, iy: u32, local: vec2f) -> bool {
  if (u.scale > 1.0) {
    return previewCellBorderOutlineMask(ix, iy, fract(local));
  }
  return previewContinuousOutlineMask(local);
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
  // Full-screen triangle trick: 3 vertices cover the entire clip space.
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0,  3.0),
  );
  var out: VertexOutput;
  out.position = vec4f(pos[vi], 0.0, 1.0);
  // UV: [0,1] range, y flipped so top-left = (0,0).
  out.uv = (pos[vi] + 1.0) * 0.5;
  out.uv.y = 1.0 - out.uv.y;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  // Convert pixel coordinate to local cell offset. The large integer camera
  // offset is applied separately to avoid f32 precision loss on wide grids.
  let px = in.uv * u.canvas_size;
  let local = px / u.scale + u.offset_frac;

  let ix = wrapAdd(u.offset_cell.x, u32(local.x), u.grid_size.x);
  let iy = wrapAdd(u.offset_cell.y, u32(local.y), u.grid_size.y);

  // Read tribe ID from the active packed grid buffer.
  let packed_cols = (u.grid_size.x + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
  let word_idx = iy * packed_cols + (ix >> WORD_SHIFT);
  let shift = (ix & CELL_INDEX_MASK) << CELL_SHIFT;
  let tribe_id = (grid[word_idx] >> shift) & CELL_MASK;

  // Look up tribe color (packed as 0x00BBGGRR).
  let color_packed = tribe_colors[tribe_id];
  let r = f32(color_packed & 0xFFu) / 255.0;
  let g = f32((color_packed >> 8u) & 0xFFu) / 255.0;
  let b = f32((color_packed >> 16u) & 0xFFu) / 255.0;

  if (u.preview_visible == 1u && previewOutlineMask(ix, iy, local)) {
    return vec4f(0.82, 0.84, 0.86, 1.0);
  }

  return vec4f(r, g, b, 1.0);
}
`;var Er=[1,2,4,8,16,32],hi={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Si={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},yi={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Je={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Ci={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},kr={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},X={1:hi,2:Si,4:yi,8:Je,16:Ci,32:kr};function Ut(e){return Er.includes(e)}function vi(e){return 2**e}function Ar(e,r){return r<=vi(e)}function Ir(e,r,t){return K(e,r)<=t}function er(e){return e<=2?X[1]:e<=4?X[2]:e<=16?X[4]:e<=256?X[8]:e<=65536?X[16]:X[32]}function Ot(e){return er(e)}function Pe(e){return X[e]}function Wt(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){return Gr(e,r,t)??kr}function Gr(e,r={cols:3,rows:3},t=Number.POSITIVE_INFINITY){for(let n of Er){let i=Pe(n);if(Ar(n,e)&&Ir(r,i,t))return i}return null}function Lr(e){return Pe(e?.bitsPerCell??8)}function Be(e){return{bitsPerCell:e.bitsPerCell}}function te(e,r){return Math.ceil(e/r.cellsPerWord)}function K(e,r){return te(e.cols,r)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Nt(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let r=new ArrayBuffer(e.byteLength);return new Uint8Array(r).set(e),new Uint32Array(r)}var xe={population:!0,diversity:!0,interfaces:!1},rr={enabled:!0,sections:xe};function Ri(e){return{population:typeof e?.population=="boolean"?e.population:xe.population,diversity:typeof e?.diversity=="boolean"?e.diversity:xe.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:xe.interfaces}}function Fr(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:rr.enabled,sections:Ri(e?.sections)}}function Dr(e,r){self.postMessage(e,r)}var Ur="any",we="dead";var zt="empty",$t="is",Or="comparison",Wr="count",Nr="none",zr="exactly",$r="min",Xr="max",Kr="not",Yr="and",qr="or",Hr="xor";async function Xt(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter is unavailable.");return r?.(t.limits),t.requestDevice({label:e,requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}})}var d={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var Kt=4294967295;function jr(e,r){let t;return e?t=r?"ok":"tooLarge":t="disabled",t}function F(e,r){return e.includes(r)}function Yt(e,r,t,n){let i=e*r,a=i<=Kt,s=i*2<=Kt;return{population:jr(t&&n.population,a),diversity:jr(t&&n.diversity,a),interfaces:jr(t&&n.interfaces,s)}}function qt(e){let r=[];return e.population==="ok"&&r.push("population"),e.diversity==="ok"&&r.push("diversity"),e.interfaces==="ok"&&r.push("interfaces"),r}var le=256*Uint32Array.BYTES_PER_ELEMENT,de=Uint32Array.BYTES_PER_ELEMENT;function Ht(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function jt(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function Vt(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function Mi(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
${Ht(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${jt(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${Vt(i)}
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
`}function _i(e){let{cols:r,rows:t,gridFormat:n,dispatchPlan:i}=e;return`
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
${Ht(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${jt(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${Vt(i)}
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
`}function Pi(e,r){let{tribes:t,deadTribeIndex:n,readback:i,cols:a,rows:s}=e,o=a*s,u={};for(let f=0;f<t.length;f++){let h=r?i.histogram[f]??0:0;u[t[f].id]=h}let l=r?u[t[n]?.id??""]??0:0;return{population:u,aliveCells:r?Math.max(0,o-l):0,deadCells:l}}function Bi(e){let{tribes:r,deadTribeIndex:t,readback:n}=e,i=0;for(let a=0;a<r.length;a++)a!==t&&(i+=n.histogram[a]??0);return i}function xi(e,r){let{tribes:t,deadTribeIndex:n,readback:i}=e,a=r?Bi(e):0,s=0,o=0;for(let u=0;u<t.length;u++){let l=u!==n&&a>0?(i.histogram[u]??0)/a:0;l>0&&(s-=l*Math.log2(l),o+=l*l)}return{shannonEntropy:s,simpsonSum:o}}function wi(e,r){let t=e.cols*e.rows*2,n=r?e.readback.crossStateContactEdges:0,i=r?Math.max(0,t-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:r&&t>0?i/t:0,crossStateContactFraction:r&&t>0?n/t:0}}function Zt(e){let{device:r}=e,t=r.createShaderModule({label:d.histogramMetricsShaderModule,code:Mi(e)}),n=r.createComputePipeline({label:d.histogramMetricsPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),i=r.createBuffer({label:d.histogramMetricsBuffer,size:le,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),a=r.createBuffer({label:d.histogramMetricsReadBuffer,size:le,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=r.createShaderModule({label:d.interfaceMetricsShaderModule,code:_i(e)}),o=r.createComputePipeline({label:d.interfaceMetricsPipeline,layout:"auto",compute:{module:s,entryPoint:"main"}}),u=r.createBuffer({label:d.interfaceMetricsBuffer,size:de,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),l=r.createBuffer({label:d.interfaceMetricsReadBuffer,size:de,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:a,boundaryPipeline:o,boundaryBuffer:u,boundaryReadBuffer:l}}function Qt(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function Jt(e){let{device:r,encoder:t,resources:n,sourceBuffer:i,dispatchPlan:a,enabledSections:s}=e;if(F(s,"population")||F(s,"diversity")){let o=new Uint32Array(256);r.queue.writeBuffer(n.histogramBuffer,0,o);let u=r.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),l=t.beginComputePass({label:d.histogramMetricsPass});l.setPipeline(n.histogramPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(a.dispatchWgX,a.dispatchWgY),l.end(),t.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,le)}if(F(s,"interfaces")){let o=new Uint32Array([0]);r.queue.writeBuffer(n.boundaryBuffer,0,o);let u=r.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),l=t.beginComputePass({label:d.interfaceMetricsPass});l.setPipeline(n.boundaryPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(a.dispatchWgX,a.dispatchWgY),l.end(),t.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,de)}}async function en(e){let{resources:r,enabledSections:t}=e,n=F(t,"population")||F(t,"diversity"),i=F(t,"interfaces"),a=[];n&&a.push(r.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&a.push(r.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(a);let s=new Uint32Array(256);n&&(s=new Uint32Array(r.histogramReadBuffer.getMappedRange().slice(0)),r.histogramReadBuffer.unmap());let o=0;if(i){let u=new Uint32Array(r.boundaryReadBuffer.getMappedRange().slice(0));r.boundaryReadBuffer.unmap(),o=u[0]??0}return{histogram:s,crossStateContactEdges:o}}function rn(e){let{generation:r,enabledSections:t,availability:n,liveMetricSettings:i,cols:a,rows:s,totalFrames:o,fps:u,canStepBack:l,recordingBytes:f,recordingRawBytes:h}=e,g=F(t,"population")&&i.population,ee=F(t,"diversity")&&i.diversity,y=F(t,"interfaces")&&i.interfaces,_e=a*s,re=Pi(e,g),L=xi(e,ee),Lt=wi(e,y);return{type:"metrics",generation:r,population:re.population,aliveCells:re.aliveCells,deadCells:re.deadCells,occupancy:g&&_e>0?re.aliveCells/_e:0,shannonEntropy:L.shannonEntropy,simpsonIndex:ee?1-L.simpsonSum:0,interfaces:Lt,metricsAvailability:n,extinctionTime:{},totalFrames:o,fps:u,canStepBack:l,recordingBytes:f,recordingRawBytes:h}}function Ti(e,r,t){return r.bitsPerCell===32?e>>>0:e>>>(t<<r.cellShift)&r.cellMask}function tn(e,r,t,n,i){let a=te(r.cols,t),s=e[i*a+(n>>t.wordShift)]??0;return Ti(s,t,n&t.cellIndexMask)}function nn(e,r,t,n,i,a){let s=te(r.cols,t),o=i*s+(n>>t.wordShift),u=(n&t.cellIndexMask)<<t.cellShift,l=~(t.cellMask<<u),f=e[o]??0;e[o]=(f&l|(a&t.cellMask)<<u)>>>0}var Ei=64*1024*1024,xa=256*1024*1024;function tr(e,r,t,n){let i=e,a;if(t.bitsPerCell===n.bitsPerCell)a=e;else{a=new Uint32Array(K(r,n)/Uint32Array.BYTES_PER_ELEMENT);for(let s=0;s<r.rows;s++)for(let o=0;o<r.cols;o++)nn(a,r,n,o,s,tn(i,r,t,o,s))}return a}function on(e,r,t){let n=Math.floor((r-1)/2),i=e-n,a=i+r,s=[];if(i>=0&&a<=t)s.push({destinationStart:i,localStart:0,span:r});else if(i<0){let o=-i;s.push({destinationStart:t-o,localStart:0,span:o}),s.push({destinationStart:0,localStart:o,span:r-o})}else{let o=t-i;s.push({destinationStart:i,localStart:0,span:o}),s.push({destinationStart:0,localStart:o,span:a-t})}return s.filter(o=>o.span>0)}function an(e){return`
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
`}function sn(e,r,t,n){let i=on(e,t,n.cols),a=on(r,t,n.rows),s=[];for(let o of a)for(let u of i)s.push({destinationStartX:u.destinationStart,destinationStartY:o.destinationStart,localStartX:u.localStart,localStartY:o.localStart,spanCols:u.span,spanRows:o.span});return s}var un={"=":"==","\u2260":"!=",">":">","<":"<","\u2265":">=","\u2264":"<="};function ki(e,r){r.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${r.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${r.dispatchWgX}u;`))}function Ai(e,r){e.push(`const CELLS_PER_WORD: u32 = ${r.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${r.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${r.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${r.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${r.cellMask}u;`)}function Ii(e,r,t){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${t} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${r}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Gi(e,r,t){r.remapped?(e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${t} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;")):(e.push(`  let ${t} = gid.x;`),e.push("  let y = gid.y;"))}function Li(e,r,t){let n=Xi(e,r,t),i=new Map,a=0;for(let s of n)i.set(s,`count_${a++}`);return i}function Fi(e,r,t,n){let i=Ki(e,r,t),a=new Map,s=0;for(let o of i){let u=n.get(o);u?a.set(o,u):a.set(o,`eq_count_${s++}`)}return a}function Di(e,r){for(let[t,n]of r)e.push(`  let ${n} = ${ln(t)};`);r.size>0&&e.push("")}function Ui(e,r,t){let n=0;for(let[i,a]of t)r.has(i)||(e.push(`  let ${a} = ${ln(i)};`),n++);n>0&&e.push("")}function Oi(e,r,t,n,i,a){for(let s=0;s<r.length;s++){let o=r[s],u=ke(o.clause,t,n,i,a);e.push(s===0?`  if (${u}) {`:`  } else if (${u}) {`),e.push(`    result = ${zi(o.tribe,a)}u;`)}r.length>0&&e.push("  }"),e.push("")}function Wi(e){for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(`    let ${dn(t,r)} = readCell(${cn("x",t,"COLS")}, ${cn("y",r,"ROWS")});`)}function ln(e){let r=e.split(",").filter(Boolean).map(Number);return Ni().map(t=>`select(0u, 1u, ${r.map(n=>`${t} == ${n}u`).join(" || ")})`).join(" + ")}function dn(e,r){let t="C";e===-1?t="L":e===1&&(t="R");let n="C";return r===-1?n="T":r===1&&(n="B"),`n${n}${t}`}function Ni(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(dn(t,r));return e}function cn(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function Ae(e,r,t){let n=[];for(let i of e)if(i===Ur)for(let a=0;a<r.length;a++)n.push(a);else{let a=t.get(i);a!==void 0&&n.push(a)}return[...new Set(n)]}function zi(e,r){return e===Ur?0:r.get(e)??0}function $i(e,r,t){return Ae(e,r,t).sort().join(",")}function fn(e,r,t,n){let i=new Set,a=o=>{i.add($i(o,r,t))},s=o=>{switch(n(o,a),o.kind){case Kr:s(o.clause);break;case Yr:case qr:case Hr:for(let u of o.clauses)s(u);break}};for(let o of e)s(o);return i}function Xi(e,r,t){return fn(e,r,t,(n,i)=>{switch(n.kind){case Nr:case zr:case $r:case Xr:case Wr:i(n.tribes);break}})}function Ki(e,r,t){return fn(e,r,t,(n,i)=>{n.kind===Or&&(i(n.tribe1),i(n.tribe2))})}function ke(e,r,t,n,i){switch(e.kind){case zt:return"false";case $t:return Yi(e.tribes,n,i);case Wr:return Te(Ee(e.tribes,r,n,i),e.interval[0],e.interval[1]);case Nr:return Te(Ee(e.tribes,r,n,i),0,0);case zr:return Te(Ee(e.tribes,r,n,i),e.value,e.value);case $r:return Te(Ee(e.tribes,r,n,i),e.value,8);case Xr:return Te(Ee(e.tribes,r,n,i),0,e.value);case Or:return qi(e,t,n,i);case Kr:return`!(${ke(e.clause,r,t,n,i)})`;case Yr:return`(${e.clauses.map(a=>ke(a,r,t,n,i)).join(" && ")})`;case qr:return`(${e.clauses.map(a=>ke(a,r,t,n,i)).join(" || ")})`;case Hr:return Hi(e.clauses,r,t,n,i);default:return"false"}}function Yi(e,r,t){let n=Ae(e,r,t);return n.length===0?"false":n.length===r.length?"true":`(${n.map(i=>`selfTribe == ${i}u`).join(" || ")})`}function Te(e,r,t){return`(${e} >= ${r}u && ${e} <= ${t}u)`}function qi(e,r,t,n){let i=Ae(e.tribe1,t,n).sort().join(","),a=Ae(e.tribe2,t,n).sort().join(","),s=un[e.operator]??"==",o=Math.max(-8,Math.min(8,e.margin??0));return`(i32(${r.get(i)}) ${s} (i32(${r.get(a)}) + ${o}i))`}function Hi(e,r,t,n,i){return`(((${e.map(a=>ke(a,r,t,n,i)).map(a=>`select(0u, 1u, ${a})`).join(" + ")}) & 1u) == 1u)`}function Ee(e,r,t,n){return r.get(Ae(e,t,n).sort().join(","))}function Vr(e,r,t){if(e<=t&&r<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:e,dispatchWgY:r,remapped:!1};let n=e*r,i=Math.min(n,t),a=Math.ceil(n/i);if(a<=t)return{logicalWgX:e,logicalWgY:r,dispatchWgX:i,dispatchWgY:a,remapped:!0};throw new Error(`Grid requires ${e}x${r} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${t}.`)}function pn(e,r,t,n,i,a,s){let o=[],u=e.rules.filter(g=>!g.muted),l=s.get(we)??0,f=Li(u.map(g=>g.clause),r,s),h=Fi(u.map(g=>g.clause),r,s,f);return o.push("// Auto-generated simulation compute shader."),o.push(`// Tribes: ${r.map(g=>g.id).join(", ")}`),o.push(`// Rules: ${e.rules.length}`),o.push(""),o.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),o.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),o.push(""),o.push(`const COLS: u32 = ${n.cols}u;`),o.push(`const ROWS: u32 = ${n.rows}u;`),o.push(`const PACKED_COLS: u32 = ${t}u;`),ki(o,i),Ai(o,a),o.push(""),Ii(o,"gridIn","PACKED_COLS"),o.push(""),o.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {"),Di(o,f),Ui(o,f,h),o.push(`  var result: u32 = ${l}u;`),o.push(""),Oi(o,u,f,h,r,s),o.push("  return result;"),o.push("}"),o.push(""),o.push("@compute @workgroup_size(16, 16)"),i.remapped?o.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):o.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),Gi(o,i,"px"),o.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),o.push(""),o.push("  let baseX = px << WORD_SHIFT;"),o.push("  var packed: u32 = 0u;"),o.push(""),o.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),o.push("    let x = baseX + i;"),o.push("    if (x >= COLS) { break; }"),o.push(""),o.push("    let selfTribe = readCell(x, y);"),Wi(o),o.push(""),o.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),o.push("  }"),o.push(""),o.push("  gridOut[y * PACKED_COLS + px] = packed;"),o.push("}"),o.join(`
`)}var fe=3,Ie="gol-recording",pe="raw-packed",Zr="deflate-raw",Qr=12,Jr=256*1024*1024,mn=512*1024*1024,et=128*1024*1024*1024;function rt(e,r,t=0){let n=t;for(let i of e)n+=i[r];return n}function gn(e,r){return Math.min(e,r)}function tt(e){return Math.min(e,1073741824)}function bn(e){return Math.min(e,mn)}function nt(e,r){return Math.max(e*2,r*6)}function nr(e,r){return e>0&&e<=r}function Zi(e,r){return e>0?e*2+r:0}function Qi(e,r){return e>=1&&r>0?e*r*(1+fe):0}function Ji(e,r){return e<Jr?Math.min(Jr,r):e}function hn(e,r){return nr(e,r)?Math.max(1,Math.floor(Ji(e,r)/e)):0}function ir(e,r){return e>=1&&r>0?Math.max(1,Math.min(Qr,Math.floor(536870912/(e*r)))):Qr}function Sn(e,r,t,n,i,a){let s=!r.some(u=>u)&&(i||a>=e),o=i?Math.floor(n/2)+1:n;return e>=1&&r.length>0&&(s||t>=o)}function yn(e,r,t,n){return e<r&&n.some((i,a)=>t[a]&&i.mapState==="unmapped")}function Cn(e,r,t,n,i,a){return e&&r>=1&&t!==null&&n.length>0&&(i<r||a)}function vn(e,r,t,n,i){let a=Math.min(e.quota??et/128,et),s=e.usage??0,o=0,u=0;for(let h of r)h.codec===pe?o+=h.storedBytes:u+=h.storedBytes;let l=t*n,f=i?(1+fe)*l:0;return{quotaBytes:a,usedBytes:s,pendingRawBytes:o,compressedBytes:u,gpuBufferMarginBytes:f}}function Rn(e,r,t,n,i){let a=tt(e);return{maxBytes:e,vramBudgetBytes:nt(e,a),frameByteSize:r,recordingAvailable:nr(r,a),vramSimulationBytes:Zi(r,n),vramRecordingBytes:Qi(t,r),gridFormat:i}}function or(e,r,t){r.length>0&&(e.generationStart=r[0].generationStart,e.generationEnd=r[r.length-1].generationEnd),t.length>0&&(r.length===0&&(e.generationStart=t[0]),e.generationEnd=t[t.length-1]),e.chunks=[...r]}function Mn(e){return e.map(r=>({...r,generations:[...r.generations]}))}function _n(e,r){return e!==r}function ar(e,r=0){return rt(e,"blockCount",r)}function Pn(e){return rt(e,"storedBytes")}function Bn(e){return rt(e,"uncompressedBytes")}var eo=256,Ge=80,xn=eo*Uint32Array.BYTES_PER_ELEMENT;function wn(e){let r=new ArrayBuffer(Ge),t=new Float32Array(r),n=new Int32Array(r),i=new Uint32Array(r),a=(e.offsetX%e.grid.cols+e.grid.cols)%e.grid.cols,s=(e.offsetY%e.grid.rows+e.grid.rows)%e.grid.rows,o=Math.floor(a),u=Math.floor(s);return t[0]=e.canvasWidth,t[1]=e.canvasHeight,t[2]=e.scale,t[4]=a-o,t[5]=s-u,i[6]=e.grid.cols,i[7]=e.grid.rows,i[8]=o,i[9]=u,i[10]=e.tribeCount,n[12]=e.brushPreview.centerX,n[13]=e.brushPreview.centerY,i[14]=e.brushPreview.brushSize,i[15]=e.brushPreview.shape,i[16]=e.brushPreview.visible?1:0,r}function Tn(e){let r=new Uint32Array(e.length);for(let t=0;t<e.length;t++){let n=e[t].color,i=parseInt(n.substring(0,2),16),a=parseInt(n.substring(2,4),16),s=parseInt(n.substring(4,6),16);r[t]=i|a<<8|s<<16}return r}function En(e,r){return e.replace("__CELLS_PER_WORD__",`${r.cellsPerWord}u`).replace("__WORD_SHIFT__",`${r.wordShift}u`).replace("__CELL_SHIFT__",`${r.cellShift}u`).replace("__CELL_INDEX_MASK__",`${r.cellIndexMask}u`).replace("__CELL_MASK__",`${r.cellMask}u`)}function kn(e){return Math.min(3,Math.max(0,Math.ceil(Math.log10(e.cols*e.rows/1e5))))}function it(e){return 1024/4**kn(e)}function ot(e){return 16/2**kn(e)}function at(e,r){return e==="recording"?Number.MAX_SAFE_INTEGER:it(r)*ot(r)}function st(e,r,t,n,i){let a=e-r*n;return t>n||t>i?Math.min(a,r):a}function An(e){return e<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/e}}function W(e){return e.request.stopCondition.kind==="targetGeneration"}function me(e,r){return e.request.stopCondition.kind==="targetGeneration"&&r>=e.request.stopCondition.generation}function Le(e,r){return e.request.stopCondition.kind==="targetGeneration"?Math.max(0,e.request.stopCondition.generation-r):Number.POSITIVE_INFINITY}function In(e,r){return r.restore!==!1&&e.request.restoreAfterStop||null}function Gn(e,r,t){return r&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")}function Ln(e,r,t,n,i){return e.restartRestoredRun!==!1&&r&&t&&!n&&!i}function Fn(e,r,t,n){let i=r+t,a=Math.min(n,i-1);if(a<=0)return null;let s=i-1-a;if(s>=r)return{source:"buffered",frameInChunk:s-r};let o=0;for(let u=0;u<e.length;u++){let l=e[u];if(s<o+l.blockCount)return{source:"sealed",sealedIndex:u,frameInChunk:s-o};o+=l.blockCount}return null}function Dn(e,r){return{chunkFrameIndex:r.frameInChunk+1,generation:e[r.frameInChunk]}}function Un(e,r,t,n,i,a){let s=(r+1)*t;if(i.bitsPerCell===a.bitsPerCell)return{sameFormat:!0,chunkPrefix:new Uint8Array(e,0,s),activeFrame:null};let o=K(n,i),u=new Uint8Array(s);for(let l=0;l<=r;l++){let f=new Uint8Array(e,l*o,o),h=tr(Nt(f),n,i,a);u.set(new Uint8Array(h.buffer,h.byteOffset,h.byteLength),l*t)}return{sameFormat:!1,chunkPrefix:u,activeFrame:u.subarray(r*t,s)}}var c,T=!1,hr,ur,ae,Pr,_=0,P=0,Br=0,E=Je,Se=[],ye=new Map,Sr,dt,A,I,Ce,ge,Ne,ft,pt,De,_t,Pt,w=!1,zn=1,$n=0,Xn=0,B=!1,k=!1,j=100,p=0,ve=0,sr=0,Bt=0,cr,ro=4,xt=192,oe=[],yr=[],Cr=[],to=0,lr=null,Kn={centerX:0,centerY:0,brushSize:1,shape:0,visible:!1},V=null,dr=-1,be=!1,Ue=!1,ut=0,ze=rr,fr=[],M=!1,U=!1,Y={chunks:[],generationStart:0,generationEnd:0,gridFormat:Be(Je)},Yn=0,v=[],$e=!1,m=null,qn=0,pr=!1,G=null,b=0,R=[],se=null,C=64,S=0,Z=[],D=[],Oe=null,ne=null,O=0,Xe=0,ie=0,N=!1,Fe=0,mr=0,gr=0,We=[];function no(e){switch(!0){case e instanceof Error:return e.message;case typeof e=="string":return e;case(e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"):return e.message;default:return String(e??"Unknown worker error")}}function Hn(e){console.error("[GOLT worker] Worker GPU error:",e),x("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),B=!1,self.postMessage({type:"gpuError",reason:no(e)})}self.addEventListener("error",e=>{e.preventDefault(),Hn(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),Hn(e.reason)});async function wt(){await c.queue.onSubmittedWorkDone()}function On(e){mr=0,gr=2+(e?1+fe:0),We=[]}async function vr(){if(We.length>0){let e=c.createCommandEncoder({label:d.trackedAllocationClearEncoder});for(let r of We)e.clearBuffer(r);c.queue.submit([e.finish()]),await wt(),We=[]}}async function Rr(e,r){k&&gr>0&&(mr+=e,gr--,We.push(r),mr>=bn(ue())&&gr>0&&(await vr(),mr=0))}function Mr(){G?.destroy(),G=null;for(let e of Z)e?.destroy();Z=[],D=[],C=0,b=0,R=[],se=null,Xe=0}function Wn(){A?.destroy(),I?.destroy(),Qt(V),V=null,oe.forEach(e=>e.destroy()),oe=[],yr=[],Cr=[],Mr()}function ct(e){let r=O>0;O+=e;let t=O>0;r!==t&&self.postMessage({type:"chunksSaving",active:t})}function he(){let e=Sn(C,D,ie,ir(C,S),N,b);e!==N&&(N=e,self.postMessage({type:"backpressure",active:e}))}async function Me(){self.postMessage({type:"storageQuota",...vn(await navigator.storage.estimate(),v,C,S,M)})}function ue(){return gn(c.limits.maxBufferSize,c.limits.maxStorageBufferBindingSize)}function Ye(){return tt(ue())}function q(){return nr(S,Ye())}function jn(){return yn(ie,ir(C,S),D,Z)}function Ke(){return Cn(q(),C,G,Z,b,jn())}async function io(e){let r=new DecompressionStream(Zr),t=r.writable.getWriter();t.write(new Uint8Array(e)),t.close();let n=[],i=r.readable.getReader();for(;;){let{done:u,value:l}=await i.read();if(u)break;n.push(l)}let a=0;for(let u of n)a+=u.byteLength;let s=new Uint8Array(a),o=0;for(let u of n)s.set(u,o),o+=u.byteLength;return s.buffer}function J(){return{cols:_,rows:P}}function oo(){return Vr(Math.ceil(Br/16),Math.ceil(P/16),c.limits.maxComputeWorkgroupsPerDimension)}function ao(){return Vr(Math.ceil(_/16),Math.ceil(P/16),c.limits.maxComputeWorkgroupsPerDimension)}function mt(){Ce?.destroy(),Ce=c.createBuffer({label:d.uniformBuffer,size:Ge,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function so(){let e=wn({canvasWidth:ae.width,canvasHeight:ae.height,scale:zn,offsetX:$n,offsetY:Xn,grid:J(),tribeCount:Se.length,brushPreview:Kn});c.queue.writeBuffer(Ce,0,e)}function xr(){return K({cols:_,rows:P},E)}function Q(){return Be(E)}async function gt(){let e=xr();A=c.createBuffer({label:d.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Rr(e,A),I=c.createBuffer({label:d.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Rr(e,I);let r=c.createCommandEncoder({label:d.gridClearEncoder});r.clearBuffer(A),r.clearBuffer(I),c.queue.submit([r.finish()]),w=!1}function bt(){let e=Tn(Se);ge&&ge.destroy(),ge=c.createBuffer({label:d.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),c.queue.writeBuffer(ge,0,e)}function ht(){let e=c.createShaderModule({label:d.renderShaderModule,code:En(Dt,E)});Ne=c.createRenderPipeline({label:d.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:ur}]},primitive:{topology:"triangle-list"}})}function St(){ft=c.createBindGroup({layout:Ne.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ce}},{binding:1,resource:{buffer:A}},{binding:2,resource:{buffer:ge}}]}),pt=c.createBindGroup({layout:Ne.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ce}},{binding:1,resource:{buffer:I}},{binding:2,resource:{buffer:ge}}]})}function yt(){Sr=oo();let e=pn(Pr,Se,Br,J(),Sr,E,ye),r=c.createShaderModule({label:d.simulationShaderModule,code:e});De=c.createComputePipeline({label:d.simulationPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),_t=c.createBindGroup({layout:De.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:A}},{binding:1,resource:{buffer:I}}]}),Pt=c.createBindGroup({layout:De.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:I}},{binding:1,resource:{buffer:A}}]})}function Ct(){dt=ao(),V=Zt({device:c,cols:_,rows:P,gridFormat:E,dispatchPlan:dt})}function vt(){let e=c.createShaderModule({label:d.brushShaderModule,code:an(E)});cr=c.createComputePipeline({label:d.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),oe.forEach(r=>r.destroy()),oe=[],yr=[],Cr=[];for(let r=0;r<ro;r++){let t=c.createBuffer({label:`${d.brushUniformBuffer} ${r}`,size:xt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});oe.push(t),yr.push(c.createBindGroup({layout:cr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:A}},{binding:1,resource:{buffer:t}}]})),Cr.push(c.createBindGroup({layout:cr.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:I}},{binding:1,resource:{buffer:t}}]}))}}function uo(e,r,t,n,i,a,s){let o=ye.get(we)??0,u=to++,l=sn(r,t,n,J()),f=w?Cr:yr;for(let[h,g]of l.entries()){let ee=new ArrayBuffer(xt),y=new Uint32Array(ee);y[0]=Br,y[1]=n,y[2]=i,y[3]=a,y[4]=o,y[5]=u,y[6]=s.length,y[7]=g.destinationStartX,y[8]=g.destinationStartY,y[9]=g.localStartX,y[10]=g.localStartY,y[11]=g.spanCols,y[12]=g.spanRows,y[13]=0;for(let L=0;L<s.length&&L<32;L++)y[14+L]=s[L];let _e=oe[h],re=f[h];if(_e&&re){c.queue.writeBuffer(_e,0,ee);let L=Math.floor(g.destinationStartX/E.cellsPerWord),fi=Math.ceil((g.destinationStartX+g.spanCols)/E.cellsPerWord)-L,pi=Math.ceil(fi/8),mi=Math.ceil(g.spanRows/8),Qe=e.beginComputePass({label:d.brushPass});Qe.setPipeline(cr),Qe.setBindGroup(0,re),Qe.dispatchWorkgroups(pi,mi),Qe.end()}else throw console.error("[GOLT worker] Brush dispatch resources are out of sync with the wrapped brush rectangles.",{index:h,rectCount:l.length,bindGroupCount:f.length,uniformBufferCount:oe.length}),new Error("Brush dispatch resources are out of sync with the wrapped brush rectangles.")}}function co(){let e=w?I:A,r=xr(),t;try{t=c.createBuffer({label:d.gridReadbackBuffer,size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=c.createCommandEncoder({label:d.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,t,0,r),c.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),i})}function Vn(){S=xr(),C=hn(S,Ye())}function Rt(){self.postMessage({type:"limits",...Rn(ue(),S,C,Ge+xn+xt+le*2+de*2,Q())})}function qe(e){if(C>=1&&G!==null&&b<C){let r=w?I:A,t=b*S,n=c.createCommandEncoder({label:d.recordingFrameCopyEncoder});n.copyBufferToBuffer(r,0,G,t,S),c.queue.submit([n.finish()]),R.push(e),se=e,b++,br()}}function lt(e){Xe=Math.max(0,Xe+e)}function br(){C>0&&b>=C&&jn()&&He()}function He(){let e=G;if(e!==null&&b>0&&Z.length>0&&ie<ir(C,S)){let r=D.indexOf(!0);if(r>=0){D[r]=!1;let t=Z[r];if(t.mapState==="unmapped"){let n=b*S,i=Yn++,a=[...R],s=a[0],o=a[a.length-1],u=`chunk-${String(i).padStart(6,"0")}.bin`,l=b,f=c.createCommandEncoder({label:d.recordingSealCopyEncoder});f.copyBufferToBuffer(e,0,t,0,n),c.queue.submit([f.finish()]);let h={chunkId:i,generationStart:s,generationEnd:o,blockCount:l,codec:pe,uncompressedBytes:n,storedBytes:n,gridFormat:Q(),generations:a,filename:u};ct(1),lt(l),ie++,he();let g=Fe;t.mapAsync(GPUMapMode.READ).then(async()=>{let ee=t.getMappedRange(),y=new ArrayBuffer(n);new Uint8Array(y).set(new Uint8Array(ee,0,n)),t.unmap(),g===Fe&&(D[r]=!0,v.push(h),lt(-l),or(Y,v,R),he(),br(),lo(h,y).then(()=>{g===Fe&&(ie--,he(),ct(-1),Me(),_r(),$(!0),br(),self.postMessage({type:"chunkSealed",filename:h.filename,rawBytes:n,blockCount:h.blockCount,cols:_,rows:P,rawGridFormat:h.gridFormat,storageGridFormat:Be(er(Pr.tribes.length))}),$e&&O===0&&($e=!1,_r()))}))}).catch(()=>{g===Fe&&(D[r]=!0,ie--,lt(-l),he(),ct(-1),br())}),b=0,R=[]}else D[r]=!0}}}async function Zn(e){Fe++,Yn=0,b=0,R=[],v=[],se=null,Xe=0,ie=0,O>0&&(O=0,self.postMessage({type:"chunksSaving",active:!1})),N&&(N=!1,self.postMessage({type:"backpressure",active:!1})),$e=!1,U=M,Y={chunks:[],generationStart:e,generationEnd:e,gridFormat:Q()},await Qn(),Me()}async function Tt(){return ne&&await ne,Oe||(Oe=await(await navigator.storage.getDirectory()).getDirectoryHandle(Ie,{create:!0})),Oe}async function lo(e,r){let i=await(await(await Tt()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(r),await i.close()}async function fo(e){let r=await Tt();for(let t of e)try{await r.removeEntry(t)}catch(n){console.warn(`Failed to remove OPFS entry ${t}:`,n)}}async function Qn(){if(ne)await ne;else{ne=(async()=>{let e=await navigator.storage.getDirectory();Oe=null;try{await e.removeEntry(Ie,{recursive:!0})}catch(r){r instanceof DOMException&&r.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${Ie}:`,r)}Oe=await e.getDirectoryHandle(Ie,{create:!0})})();try{await ne}finally{ne=null}}}function _r(){or(Y,v,R),self.postMessage({type:"recording",manifest:{chunks:Mn(v),generationStart:Y.generationStart,generationEnd:Y.generationEnd,gridFormat:Q()},cols:_,rows:P})}function je(e=!1){if(M){let r=!U;e&&U&&Ke()&&(U=!1,r=!0),r&&_n(se,p)&&Ke()&&(b>=C&&He(),qe(p))}}function Et(){if(lr){let e=lr;lr=null;let r=M&&b>0&&R[b-1]===p;r&&(b--,R.pop());let t=c.createCommandEncoder({label:d.brushEncoder});uo(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),c.queue.submit([t.finish()]),r&&qe(p)}}async function po(e,r=pe){let a=await(await(await(await Tt()).getFileHandle(e)).getFile()).arrayBuffer();return r===Zr?io(a):a}function Jn(){return Yt(_,P,ze.enabled,ze.sections)}function mo(){return qt(Jn())}function ei(e){fr=mo(),V&&fr.length>0&&Jt({device:c,encoder:e,resources:V,sourceBuffer:w?I:A,dispatchPlan:dt,enabledSections:fr})}function ri(){let e=p;if(V&&e!==dr&&!be){let r=[...fr],t=Jn();dr=e,be=!0,en({resources:V,enabledSections:r}).then(n=>{let i=ye.get(we)??0,a=ar(v,b+Xe),s=rn({generation:e,tribes:Se,deadTribeIndex:i,readback:n,enabledSections:r,availability:t,liveMetricSettings:ze.sections,cols:_,rows:P,totalFrames:a,fps:Bt,canStepBack:a>1,recordingBytes:Pn(v),recordingRawBytes:Bn(v)});if(be=!1,self.postMessage(s),Ue)if(Ue=!1,dr=-1,ii()){let o=c.createCommandEncoder({label:d.interactiveMetricsEncoder});ei(o),c.queue.submit([o.finish()]),ri()}else Ue=!0}).catch(()=>{be=!1})}}function ti(e){if(e>0){let r=Sr,t=c.createCommandEncoder({label:d.simulationBatchEncoder});for(let n=0;n<e;n++){let i=t.beginComputePass({label:d.simulationStepPass});i.setPipeline(De),i.setBindGroup(0,w?Pt:_t),i.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),i.end(),w=!w,p++}c.queue.submit([t.finish()]),ve+=e}}function go(){self.postMessage({type:"generation",generation:p,fps:Bt})}function kt(){let e=c.createCommandEncoder({label:d.simulationSingleStepEncoder}),r=e.beginComputePass({label:d.simulationStepPass});r.setPipeline(De),r.setBindGroup(0,w?Pt:_t);let t=Sr;r.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),r.end(),c.queue.submit([e.finish()]),w=!w,p++}function z(){if(c&&hr&&Ce&&Ne&&ft&&pt&&!k&&!T){so();let e=hr.getCurrentTexture().createView(),r=c.createCommandEncoder({label:d.renderEncoder}),t=r.beginRenderPass({label:d.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(Ne),t.setBindGroup(0,w?pt:ft),t.draw(3),t.end(),c.queue.submit([r.finish()])}}function ni(e){sr===0&&(sr=e);let r=e-sr;r>=1e3&&(Bt=ve/(r/1e3),ve=0,sr=e)}function At(){return M&&q()?"recording":"nonRecording"}function ii(){return!!(c&&V&&!k&&!T)}function $(e=!1){if(e&&(dr=-1),!ii())Ue=!0;else if(be)Ue=!0;else{let r=c.createCommandEncoder({label:d.interactiveMetricsEncoder});ei(r),c.queue.submit([r.finish()]),ri()}}function oi(){$(!0),z()}function wr(e,r){r&&(e-ut>=1e3||ut===0)&&!be&&(ut=e,$())}function Ve(e,r){(e.request.pacing.kind==="max"||W(e))&&r-e.lastProgressTime>=1e3&&(e.lastProgressTime=r,go())}function Re(e){N!==e&&(N=e,self.postMessage({type:"backpressure",active:e}))}function It(){let e=Ke();return e&&b>=C&&(He(),e=Ke()),e}function Ze(){!k&&!T&&!m&&self.requestAnimationFrame(Mt)}function ce(e){let r=m;if(r&&!r.pumpPending&&!k&&!T){let{token:t}=r;r.pumpPending=!0;let n=()=>{m&&m.token===t&&(m.pumpPending=!1,Ro(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?c.queue.onSubmittedWorkDone().then(n).catch(()=>{m?.token===t&&(m.pumpPending=!1)}):queueMicrotask(n)}}function Gt(e,r){m&&x("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),m={kind:e,request:r,token:++qn,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0,lastRenderTime:0},ce(r.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function H(){B&&Gt(At(),{pacing:An(j),stopCondition:{kind:"none"}})}function bo(e,r){r||e==="cancelled"?Re(!1):N&&he()}function x(e,r={}){let t=m;if(t){m=null,qn++;let n=W(t),i=In(t,r),a=!!i;i&&(B=i.running,j=i.targetStepDuration),Gn(e,n,r)&&self.postMessage({type:"stepping",active:!1}),bo(e,n),r.render!==!1&&!k&&!T&&oi(),Ln(r,a,B,k,T)?H():Ze()}}function ai(e){let r=m;r&&W(r)&&(r.request.restoreAfterStop&&(r.request.restoreAfterStop.running=e),x("cancelled"))}function ho(e){x("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Gt(At(),e)}function si(e,r,t){Re(!0),Ve(e,r),wr(r,t),ce("drain")}function So(e,r){let t=J(),n=it(t),i=ot(t),a=!1;for(let s=0;s<i;s++){let o=Le(e,p);if(o<=0)break;ti(Math.min(n,o)),a=!0}Ve(e,r),me(e,p)?x("targetReached"):ce(a?"drain":"raf")}function yo(e,r){je(!0);let t=!1,n=!1,i=performance.now()+14;for(;Le(e,p)>0&&performance.now()<i;)if(It())kt(),ve++,t=!0,qe(p);else{si(e,r,t),n=!0;break}n||(Re(!1),Ve(e,r),wr(r,t),me(e,p)?x("targetReached"):ce("raf"))}function Co(e,r,t){e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=e.stepAccumulator,a=Math.floor(e.stepAccumulator/r),s=at(e.kind,J()),o=Math.min(a,Le(e,p),s),u=o>0;if(u&&ti(o),e.stepAccumulator=st(i,r,a,o,s),Ve(e,t),me(e,p))x("targetReached");else{let l=u&&a>o;(!W(e)&&!l||t-e.lastRenderTime>=33||e.lastRenderTime===0)&&(e.lastRenderTime=t,z(),wr(t,u)),ce(l?"drain":"raf")}}function vo(e,r,t){je(!0),e.lastFrameTime===0&&(e.lastFrameTime=t);let n=t-e.lastFrameTime;e.lastFrameTime=t,e.stepAccumulator+=n;let i=!1,a=0,s=e.stepAccumulator,o=at(e.kind,J()),u=Math.floor(e.stepAccumulator/r),l=performance.now()+14,f=!1;for(;e.stepAccumulator>=r&&Le(e,p)>0&&a<o&&performance.now()<l;)if(It())kt(),ve++,a++,e.stepAccumulator-=r,i=!0,qe(p);else{si(e,t,i),f=!0;break}e.stepAccumulator=st(s,r,u,a,o),f||(Re(!1),Ve(e,t),me(e,p)?x("targetReached"):(W(e)||(z(),wr(t,i)),ce("raf")))}function Ro(e){let r=m;if(r&&!k&&!T)if(ni(e),W(r)||Et(),me(r,p))x("targetReached");else if(r.request.pacing.kind==="max")r.kind==="recording"?yo(r,e):So(r,e);else{let t=1e3/r.request.pacing.genPerSecond;r.kind==="recording"?vo(r,t,e):Co(r,t,e)}}function Mt(e){k||T?self.requestAnimationFrame(Mt):(ni(e),m||(Et(),j>0&&!pr&&z(),self.requestAnimationFrame(Mt)))}function Mo(e,r){let t=c?ue():Number.POSITIVE_INFINITY;return Ut(r.bitsPerCell)&&Ar(r.bitsPerCell,e.tribes.length)&&Ir(e,Pe(r.bitsPerCell),t)?Pe(r.bitsPerCell):Wt(e.tribes.length,e,t)}function ui(e,r){Pr=e,_=e.cols,P=e.rows,E=Mo(e,r),Br=te(_,E),Se=[...e.tribes],Y.gridFormat=Q(),ye.clear(),Se.forEach((t,n)=>ye.set(t.id,n))}async function ci(e){console.log("[GOLT worker] Initializing WebGPU"),ae=e,c=await Xt(d.webengineDevice),T=!1,c.lost.then(t=>{let n=t.message||t.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),x("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),T=!0,B=!1,k=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:ue(),vramBudgetBytes:nt(ue(),Ye()),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:Q()});let r=ae.getContext("webgpu");if(r)hr=r,ur=navigator.gpu.getPreferredCanvasFormat(),hr.configure({device:c,format:ur,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:ur,maxBufferSize:c.limits.maxBufferSize,maxStorageBufferBindingSize:c.limits.maxStorageBufferBindingSize});else throw new Error("WebGPU canvas context not available")}async function _o(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await ci(ae),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let r=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",r),x("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),T=!0,B=!1,k=!0,self.postMessage({type:"deviceLost",reason:r}),!1}}async function li(){G=c.createBuffer({label:d.recordingChunkBuffer,size:C*S,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Rr(C*S,G),b=0,R=[],se=null}async function di(){let e=C*S;Z=[],D=[];for(let r=0;r<fe;r++){let t=c.createBuffer({label:`${d.recordingStagingBuffer} ${r}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});Z.push(t),D.push(!0),await Rr(e,t)}}async function Po(){await Qn()}async function Bo(){console.log("[GOLT worker] Building GPU resources",{cols:_,rows:P,bitsPerCell:E.bitsPerCell,recordingAvailable:q()}),mt(),Vn(),await gt(),bt(),ht(),St(),yt(),vt(),Ct(),await Po(),q()?(await li(),await di()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:S,maxRecordingBufferBytes:Ye()}),Mr(),M=!1,U=!1),await vr(),Rt(),console.log("[GOLT worker] GPU resources ready")}async function xo(){console.log("[GOLT worker] Rebuild started",{cols:_,rows:P,bitsPerCell:E.bitsPerCell}),x("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),k=!0,self.postMessage({type:"rebuilding",active:!0});try{await wt()}catch{console.warn("[GOLT worker] Queue idle wait rejected during rebuild")}let e=!T;if(T&&(e=await _o()),e){Wn(),mt(),Vn(),On(q());try{await gt(),bt(),ht(),yt(),vt(),St(),Ct(),q()?(await li(),await di()):(Mr(),M=!1,U=!1),await vr(),Rt()}catch(r){let t=r instanceof Error?r.message:String(r);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{Wn(),mt(),On(!1),await gt(),bt(),ht(),yt(),vt(),St(),Ct(),M=!1,U=!1,S=xr(),Mr(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await vr(),Rt()}catch(n){console.error("[GOLT worker] GPU rebuild recovery failed:",n),e=!1}}}return e&&(k=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:q(),frameByteSize:S})),e}function Nn(e){pr=!0,c.queue.onSubmittedWorkDone().then(()=>{pr=!1,e()}).catch(()=>{pr=!1})}async function wo(){O>0&&await new Promise(e=>{let r=setInterval(()=>{O===0&&(clearInterval(r),e())},10)})}async function To(e){console.log("[GOLT worker] Init message received",{cols:e.ruleset.cols,rows:e.ruleset.rows,recording:e.recording,running:e.running,speed:e.speed}),M=e.recording,ze=Fr(e.liveMetrics),U=M,ui(e.ruleset,e.simulationGridFormat),await ci(e.canvas),await Bo(),$(!0),Me(),B=e.running,j=e.speed<0?0:1e3/e.speed,B?H():Ze()}function Eo(e){ze=Fr(e.liveMetrics),$(!0)}async function ko(e){console.log("[GOLT worker] Ruleset update received",{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length});let r=ue();if(Gr(e.ruleset.tribes.length,e.ruleset,r))x("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),ui(e.ruleset,e.simulationGridFormat),await xo()&&(p=0,await Zn(0),$(!0),B?H():Ze());else{let i=`Requested ruleset requires at least ${Ot(e.ruleset.tribes.length).bitsPerCell}-bit packing, which exceeds the current GPU frame size limit.`;console.error("[GOLT worker] Rebuild rejected:",i,{cols:e.ruleset.cols,rows:e.ruleset.rows,tribes:e.ruleset.tribes.length,maxBytes:r}),self.postMessage({type:"gpuError",reason:i})}}function Ao(e){B=e.running,e.running?m||H():m&&W(m)?ai(!1):m?x("manual"):(N&&he(),oi(),Ze())}function Io(e){let r=j<=0,t=e.speed<0?0:1e3/e.speed;j=t,m&&!W(m)&&B?(x("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&t>0?Nn(()=>{z(),H()}):H()):B&&!m?H():r&&t>0&&Nn(()=>{z(),Ze()})}function Go(e){zn=e.scale,$n=e.offsetX,Xn=e.offsetY}function Lo(e){ae.width=e.width,ae.height=e.height}function Fo(e){let r=e.tribes.map(t=>ye.get(t)).filter(t=>t!==void 0);if(r.length>0){let t={square:0,round:1,diamond:2,vline:3,hline:4},n={full:0,spray:1,outline:2};lr={centerX:e.x,centerY:e.y,brushSize:e.size,shape:t[e.shape]??0,fill:n[e.fill]??0,tribeIds:r}}}function Do(e){let r={square:0,round:1,diamond:2,vline:3,hline:4};Kn={centerX:e.x,centerY:e.y,brushSize:e.size,shape:r[e.shape]??0,visible:e.visible},!m&&!k&&!T&&j<=0&&z()}async function Uo(){try{let e=await co();Dr({type:"snapshot",grid:e,generation:p,cols:_,rows:P,gridFormat:Q()},[e.buffer])}catch{let e=new Uint32Array(0);Dr({type:"snapshot",grid:e,generation:p,cols:_,rows:P,gridFormat:Q()},[e.buffer])}}async function Oo(e){let r=Lr(e.gridFormat),t=J();if(e.grid.byteLength===K(t,r)){let n=tr(e.grid,t,r,E);c.queue.writeBuffer(w?I:A,0,n),p=e.generation,await Zn(e.generation)}}function Wo(e){let r=m?.request,t=q();e.recording&&t&&!M?(M=!0,U=!0,$(!0),Me()):(!e.recording||!t)&&(e.recording&&!t&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:S,maxRecordingBufferBytes:Ye()}),M=!1,U=!1),r&&m?ho(r):!m&&B&&H()}async function No(){$e||(await wt(),je(!1),b>0&&He(),O>0?$e=!0:_r())}async function zo(e){let r=ar(v),t=Fn(v,r,b,e.count);if(t){let n=w?I:A;if(t.source==="buffered"){let i=Dn(R,t);b=i.chunkFrameIndex,R.length=b,p=i.generation,se=p;let a=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});a.copyBufferToBuffer(G,t.frameInChunk*S,n,0,S),c.queue.submit([a.finish()])}else{O>0&&(await wo(),r=ar(v));let i=v[t.sealedIndex],a=await po(i.filename,i.codec),s=J(),o=Lr(i.gridFormat),u=Un(a,t.frameInChunk,S,s,o,E);if(c.queue.writeBuffer(G,0,u.chunkPrefix),!u.sameFormat&&u.activeFrame&&c.queue.writeBuffer(n,0,u.activeFrame),b=t.frameInChunk+1,R=i.generations.slice(0,t.frameInChunk+1),p=R[t.frameInChunk],se=p,u.sameFormat){let f=c.createCommandEncoder({label:d.recordingRestoreCopyEncoder});f.copyBufferToBuffer(G,t.frameInChunk*S,n,0,S),c.queue.submit([f.finish()])}let l=v.splice(t.sealedIndex);fo(l.map(f=>f.filename))}or(Y,v,R),Me(),$(!0),z()}}function $o(){Et(),je(!0),!M||It()?(kt(),ve++,M&&Ke()&&(b>=C&&He(),qe(p)),Re(!1)):Re(!0),$(!0),z()}function Xo(e){self.postMessage({type:"stepping",active:!0}),je(!0),Gt(At(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:p+e},restoreAfterStop:{running:B,targetStepDuration:j}})}function Ko(e){e.count===1?$o():Xo(e.count)}function Yo(){ai(m?.request.restoreAfterStop?.running??B)}function qo(e){let r=v.find(t=>t.filename===e.filename);r&&(r.codec=e.codec,r.storedBytes=e.storedBytes,r.gridFormat=e.gridFormat,Y.chunks=[...v],Me(),_r())}function Ho(){let e=v.filter(r=>r.codec===pe).map(r=>({filename:r.filename,rawBytes:r.uncompressedBytes,blockCount:r.blockCount,cols:_,rows:P,rawGridFormat:r.gridFormat,storageGridFormat:Be(er(Pr.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:e})}async function jo(e){switch(e.type){case"init":await To(e);break;case"setLiveMetrics":Eo(e);break;case"setRuleset":await ko(e);break;case"setRunning":Ao(e);break;case"setSpeed":Io(e);break;case"camera":Go(e);break;case"resize":Lo(e);break;case"draw":Fo(e);break;case"brushPreview":Do(e);break;case"getSnapshot":await Uo();break;case"loadSnapshot":await Oo(e);break;case"setRecording":Wo(e);break;case"getRecording":await No();break;case"stepBack":await zo(e);break;case"stepForward":Ko(e);break;case"cancelStepping":Yo();break;case"updateChunkCodec":qo(e);break;case"getUncompressedChunks":Ho();break}}self.onmessage=async e=>{await jo(e.data)};
