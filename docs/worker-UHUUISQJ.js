var br="goltTimestampedConsoleInstalled";function vn(){let e=globalThis;e[br]||(e[br]=!0,Et("log"),Et("warn"),Et("error"))}function Et(e){let t=console[e].bind(console);console[e]=(...r)=>{t(`[${new Date().toISOString()}]`,...r)}}vn();async function hr(e,t){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let r=await navigator.gpu.requestAdapter();if(!r)throw new Error("WebGPU adapter is unavailable.");return t?.(r.limits),r.requestDevice({label:e,requiredLimits:{maxBufferSize:r.limits.maxBufferSize,maxStorageBufferBindingSize:r.limits.maxStorageBufferBindingSize}})}var f={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var Sr=4294967295;function K(e,t){return e.includes(t)}function Bt(e,t){let r;return e?r=t?"ok":"tooLarge":r="disabled",r}function yr(e,t,r,n){let i=e*t,o=i<=Sr,a=i*2<=Sr;return{population:Bt(r&&n.population,o),diversity:Bt(r&&n.diversity,o),interfaces:Bt(r&&n.interfaces,a)}}function Cr(e){let t=[];return e.population==="ok"&&t.push("population"),e.diversity==="ok"&&t.push("diversity"),e.interfaces==="ok"&&t.push("interfaces"),t}var Pe=256*Uint32Array.BYTES_PER_ELEMENT,Me=Uint32Array.BYTES_PER_ELEMENT;function _r(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function vr(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function Pr(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function Pn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = ${t}u;
const ROWS: u32 = ${r}u;
const CELLS_PER_WORD: u32 = ${n.cellsPerWord}u;
const WORD_SHIFT: u32 = ${n.wordShift}u;
const CELL_SHIFT: u32 = ${n.cellShift}u;
const CELL_INDEX_MASK: u32 = ${n.cellIndexMask}u;
const CELL_MASK: u32 = ${n.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
${_r(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${vr(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${Pr(i)}
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
`}function Mn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${t}u;
const ROWS: u32 = ${r}u;
const CELLS_PER_WORD: u32 = ${n.cellsPerWord}u;
const WORD_SHIFT: u32 = ${n.wordShift}u;
const CELL_SHIFT: u32 = ${n.cellShift}u;
const CELL_INDEX_MASK: u32 = ${n.cellIndexMask}u;
const CELL_MASK: u32 = ${n.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
${_r(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${vr(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${Pr(i)}
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
`}function Mr(e){let{device:t}=e,r=t.createShaderModule({label:f.histogramMetricsShaderModule,code:Pn(e)}),n=t.createComputePipeline({label:f.histogramMetricsPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),i=t.createBuffer({label:f.histogramMetricsBuffer,size:Pe,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=t.createBuffer({label:f.histogramMetricsReadBuffer,size:Pe,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),a=t.createShaderModule({label:f.interfaceMetricsShaderModule,code:Mn(e)}),c=t.createComputePipeline({label:f.interfaceMetricsPipeline,layout:"auto",compute:{module:a,entryPoint:"main"}}),l=t.createBuffer({label:f.interfaceMetricsBuffer,size:Me,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),u=t.createBuffer({label:f.interfaceMetricsReadBuffer,size:Me,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:c,boundaryBuffer:l,boundaryReadBuffer:u}}function Rr(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function Er(e){let{device:t,encoder:r,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:a}=e;if(K(a,"population")||K(a,"diversity")){let c=new Uint32Array(256);t.queue.writeBuffer(n.histogramBuffer,0,c);let l=t.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),u=r.beginComputePass({label:f.histogramMetricsPass});u.setPipeline(n.histogramPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),u.end(),r.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Pe)}if(K(a,"interfaces")){let c=new Uint32Array([0]);t.queue.writeBuffer(n.boundaryBuffer,0,c);let l=t.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),u=r.beginComputePass({label:f.interfaceMetricsPass});u.setPipeline(n.boundaryPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),u.end(),r.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Me)}}async function Br(e){let{resources:t,enabledSections:r}=e,n=K(r,"population")||K(r,"diversity"),i=K(r,"interfaces"),o=[];n&&o.push(t.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(t.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let a=new Uint32Array(256);n&&(a=new Uint32Array(t.histogramReadBuffer.getMappedRange().slice(0)),t.histogramReadBuffer.unmap());let c=0;if(i){let l=new Uint32Array(t.boundaryReadBuffer.getMappedRange().slice(0));t.boundaryReadBuffer.unmap(),c=l[0]??0}return{histogram:a,crossStateContactEdges:c}}function Rn(e,t){let{tribes:r,deadTribeIndex:n,readback:i,cols:o,rows:a}=e,c=o*a,l={};for(let y=0;y<r.length;y++){let d=t?i.histogram[y]??0:0;l[r[y].id]=d}let u=t?l[r[n]?.id??""]??0:0;return{population:l,aliveCells:t?Math.max(0,c-u):0,deadCells:u}}function En(e){let{tribes:t,deadTribeIndex:r,readback:n}=e,i=0;for(let o=0;o<t.length;o++)o!==r&&(i+=n.histogram[o]??0);return i}function Bn(e,t){let{tribes:r,deadTribeIndex:n,readback:i}=e,o=t?En(e):0,a=0,c=0;for(let l=0;l<r.length;l++){let u=l!==n&&o>0?(i.histogram[l]??0)/o:0;u>0&&(a-=u*Math.log2(u),c+=u*u)}return{shannonEntropy:a,simpsonSum:c}}function Tn(e,t){let r=e.cols*e.rows*2,n=t?e.readback.crossStateContactEdges:0,i=t?Math.max(0,r-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:t&&r>0?i/r:0,crossStateContactFraction:t&&r>0?n/r:0}}function Tr(e){let{generation:t,enabledSections:r,availability:n,liveMetricSettings:i,cols:o,rows:a,totalFrames:c,fps:l,canStepBack:u,recordingBytes:y,recordingRawBytes:d}=e,m=K(r,"population")&&i.population,v=K(r,"diversity")&&i.diversity,k=K(r,"interfaces")&&i.interfaces,z=o*a,g=Rn(e,m),x=Bn(e,v),se=Tn(e,k);return{type:"metrics",generation:t,population:g.population,aliveCells:g.aliveCells,deadCells:g.deadCells,occupancy:m&&z>0?g.aliveCells/z:0,shannonEntropy:x.shannonEntropy,simpsonIndex:v?1-x.simpsonSum:0,interfaces:se,metricsAvailability:n,extinctionTime:{},totalFrames:c,fps:l,canStepBack:u,recordingBytes:y,recordingRawBytes:d}}var kr=`// Render shader: draws the grid as a full-screen quad.\r
// Reads cell tribe IDs from a storage buffer, looks up colors from a uniform array.\r
// Supports zoom, pan, and toroidal tiling.\r
\r
struct Uniforms {
  canvas_size: vec2f,    // Canvas width, height in pixels.
  scale: f32,            // Pixels per cell.
  offset_frac: vec2f,    // Fractional camera offset in cell units.
  grid_size: vec2u,      // Grid cols, rows.
  offset_cell: vec2u,    // Integer camera offset in cell units.
  tribe_count: u32,      // Number of tribes.
};
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
const CELL_INDEX_MASK: u32 = __CELL_INDEX_MASK__;
const CELL_MASK: u32 = __CELL_MASK__;

fn wrapAdd(base: u32, delta: u32, size: u32) -> u32 {
  let rem = delta % size;
  if (base >= size - rem) {
    return base - (size - rem);
  }
  return base + rem;
}
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
  let shift = (ix & CELL_INDEX_MASK) << CELL_SHIFT;\r
  let tribe_id = (grid[word_idx] >> shift) & CELL_MASK;\r
\r
  // Look up tribe color (packed as 0x00BBGGRR).\r
  let color_packed = tribe_colors[tribe_id];\r
  let r = f32(color_packed & 0xFFu) / 255.0;\r
  let g = f32((color_packed >> 8u) & 0xFFu) / 255.0;\r
  let b = f32((color_packed >> 16u) & 0xFFu) / 255.0;\r
\r
  return vec4f(r, g, b, 1.0);\r
}\r
`;var Tt=[1,2,4,8,16,32],xn={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},An={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},wn={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Ye={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},In={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},kt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},Q={1:xn,2:An,4:wn,8:Ye,16:In,32:kt};var Re={population:!0,diversity:!0,interfaces:!1},Xe={enabled:!0,sections:Re};var xt="any",He="dead";var je="empty",Ve="is",At="comparison",Ze="count",Qe="none",Je="exactly",et="min",tt="max",rt="not",nt="and",it="or",ot="xor";function xr(e){return Tt.includes(e)}function Ln(e){return 2**e}function wt(e,t){return t<=Ln(e)}function It(e,t,r){return ce(e,t)<=r}function Lt(e){return e<=2?Q[1]:e<=4?Q[2]:e<=16?Q[4]:e<=256?Q[8]:e<=65536?Q[16]:Q[32]}function Ee(e){return Q[e]}function Ar(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of Tt){let i=Ee(n);if(wt(n,e)&&It(t,i,r))return i}return kt}function Gt(e){return Ee(e?.bitsPerCell??8)}function Be(e){return{bitsPerCell:e.bitsPerCell}}function ae(e,t){return Math.ceil(e/t.cellsPerWord)}function ce(e,t){return ae(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function wr(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function Gn(e){return{population:typeof e?.population=="boolean"?e.population:Re.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Re.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Re.interfaces}}function Ft(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Xe.enabled,sections:Gn(e?.sections)}}function Ir(e,t,r,n,i){let o=ae(t.cols,r),a=e[i*o+(n>>r.wordShift)]??0;return Fn(a,r,n&r.cellIndexMask)}function Lr(e,t,r,n,i,o){let a=ae(t.cols,r),c=i*a+(n>>r.wordShift),l=(n&r.cellIndexMask)<<r.cellShift,u=~(r.cellMask<<l),y=e[c]??0;e[c]=(y&u|(o&r.cellMask)<<l)>>>0}function Fn(e,t,r){return t.bitsPerCell===32?e>>>0:e>>>(r<<t.cellShift)&t.cellMask}var ro=64*1024*1024;function Ut(e,t,r,n){let i=e,o;if(r.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(ce(t,n)/Uint32Array.BYTES_PER_ELEMENT);for(let a=0;a<t.rows;a++)for(let c=0;c<t.cols;c++)Lr(o,t,n,c,a,Ir(i,t,r,c,a))}return o}var s,$=!1,$t,at,pe,Fe,b=0,h=0,rr=0,S=Ye,V=[],re=new Map,St,zt,G,F,Ue,be,mt,qr,Yr,we,nr,ir,w=!1,Xr=1,Hr=0,jr=0,B=!1,D=!1,ee=100,P=0,ct,he,Vr,Zr,On=0,ut=null,ne=null,H=-1,W=!1,q=!1,Dt=0,De=Xe,lt=[],A=!1,X=!1,Y={chunks:[],generationStart:0,generationEnd:0,gridFormat:Be(Ye)},Qr=0,M=[],C=null,Jr=0,Te=!1,L=null,_=0,E=[],me=null,R=64,p=0,yt=3,Z=[],N=[],dt="gol-recording",Ct="raw-packed",en="deflate-raw",Ie=null,ue=null,j=0,Oe=0,fe=0,Gr=12,I=!1,ke=0,tn=256,Wn=tn*Uint32Array.BYTES_PER_ELEMENT,Fr=256*1024*1024,Nn=512*1024*1024,Ur=128*1024*1024*1024,ft=0,pt=0,Le=[];function $n(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function rn(e){console.error("[GOLT worker] Worker GPU error:",e),T("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),B=!1,self.postMessage({type:"gpuError",reason:$n(e)})}self.addEventListener("error",e=>{e.preventDefault(),rn(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),rn(e.reason)});async function or(){await s.queue.onSubmittedWorkDone()}function Dr(e){ft=0,pt=2+(e?1+yt:0),Le=[]}async function gt(){if(Le.length===0)return;let e=s.createCommandEncoder({label:f.trackedAllocationClearEncoder});for(let t of Le)e.clearBuffer(t);s.queue.submit([e.finish()]),await or(),Le=[]}async function bt(e,t){!D||pt<=0||(ft+=e,pt--,Le.push(t),ft>=zn()&&pt>0&&(await gt(),ft=0))}function zn(){return Math.min(ve(),Nn)}function ve(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function $e(){return Math.min(ve(),1073741824)}function nn(){return Math.max(ve()*2,$e()*6)}function U(){return p>0&&p<=$e()}function Kn(){return p<=0?0:p*2+ar+Wn+cr+Pe*2+Me*2}function qn(){return R<1||p<=0?0:R*p*(1+yt)}function ht(){L?.destroy(),L=null;for(let e of Z)e?.destroy();Z=[],N=[],R=0,_=0,E=[],me=null,Oe=0}function Or(){G?.destroy(),F?.destroy(),Rr(ne),ne=null,he?.destroy(),ht()}function Ot(e){let t=j>0;j+=e;let r=j>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function Se(){if(R<1||Z.length===0){I&&(I=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=cn(),t=!N.some(i=>i)&&_>=R,r=fe>=e,n;if(I){let i=N.some(a=>a),o=fe<=Math.floor(e/2);n=!(i&&o)}else n=t||r;n!==I&&(I=n,self.postMessage({type:"backpressure",active:n}))}async function ye(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??Ur/128,Ur),r=e.usage??0,n=0,i=0;for(let c of M)c.codec===Ct?n+=c.storedBytes:i+=c.storedBytes;let o=R*p,a=A?(1+yt)*o:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:a})}var We=!1;async function Yn(e){let t=new DecompressionStream(en),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:l,value:u}=await i.read();if(l)break;n.push(u)}let o=0;for(let l of n)o+=l.byteLength;let a=new Uint8Array(o),c=0;for(let l of n)a.set(l,c),c+=l.byteLength;return a.buffer}var Ce=0,st=0,sr=0;function on(e,t,r=s.limits.maxComputeWorkgroupsPerDimension){if(e<=r&&t<=r)return{logicalWgX:e,logicalWgY:t,dispatchWgX:e,dispatchWgY:t,remapped:!1};let n=e*t,i=Math.min(n,r),o=Math.ceil(n/i);if(o>r)throw new Error(`Grid requires ${e}x${t} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${r}.`);return{logicalWgX:e,logicalWgY:t,dispatchWgX:i,dispatchWgY:o,remapped:!0}}function Xn(){return on(Math.ceil(rr/16),Math.ceil(h/16))}function Hn(){return on(Math.ceil(b/16),Math.ceil(h/16))}function jn(e,t){t.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${t.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${t.dispatchWgX}u;`))}function Vn(e){e.push(`const CELLS_PER_WORD: u32 = ${S.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${S.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${S.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${S.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${S.cellMask}u;`)}function Zn(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Qn(e,t,r){if(t.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${r} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${r} = gid.x;`),e.push("  let y = gid.y;")}function Jn(){let e=[],t=rr,r=St;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${V.map(d=>d.id).join(", ")}`),e.push(`// Rules: ${Fe.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${b}u;`),e.push(`const ROWS: u32 = ${h}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),jn(e,r),Vn(e),e.push(""),Zn(e,"gridIn","PACKED_COLS"),e.push("");let n=re.get(He)??0,i=Fe.rules.filter(d=>!d.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let o=ti(i.map(d=>d.clause)),a=new Map,c=0;for(let d of o){let m=`count_${c++}`;a.set(d,m)}for(let[d,m]of a){let v=d.split(",").map(Number),z=Wr().map(g=>`select(0u, 1u, ${v.map(se=>`${g} == ${se}u`).join(" || ")})`);e.push(`  let ${m} = ${z.join(" + ")};`)}o.size>0&&e.push("");let l=ri(i.map(d=>d.clause)),u=new Map,y=0;for(let d of l)if(a.has(d))u.set(d,a.get(d));else{let m=`eq_count_${y++}`;u.set(d,m)}for(let[d,m]of u){if(a.has(d))continue;let v=d.split(",").map(Number),z=Wr().map(g=>`select(0u, 1u, ${v.map(se=>`${g} == ${se}u`).join(" || ")})`);e.push(`  let ${m} = ${z.join(" + ")};`)}l.size>0&&y>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let d=0;d<i.length;d++){let m=i[d],v=xe(m.clause,a,u),k=ei(m.tribe);d===0?e.push(`  if (${v}) {`):e.push(`  } else if (${v}) {`),e.push(`    result = ${k}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),r.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),Qn(e,r,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let d=-1;d<=1;d++)for(let m=-1;m<=1;m++){if(m===0&&d===0)continue;let v=sn(m,d),k=Nr("x",m,"COLS"),z=Nr("y",d,"ROWS");e.push(`    let ${v} = readCell(${k}, ${z});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function sn(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function Wr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(sn(r,t));return e}function Nr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function O(e){let t=[];for(let r of e)if(r===xt)for(let n=0;n<V.length;n++)t.push(n);else{let n=re.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function ei(e){return e===xt?0:re.get(e)??0}function ti(e){let t=new Set;for(let r of e)Kt(r,t);return t}function Kt(e,t){switch(e.kind){case je:case Ve:break;case Qe:case Je:case et:case tt:case Ze:{let r=O(e.tribes).sort();t.add(r.join(","));break}case rt:Kt(e.clause,t);break;case nt:case it:case ot:for(let r of e.clauses)Kt(r,t);break}}function ri(e){let t=new Set;for(let r of e)qt(r,t);return t}function qt(e,t){switch(e.kind){case je:case Ve:case Ze:case Qe:case Je:case et:case tt:break;case At:{let r=O(e.tribe1).sort(),n=O(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case rt:qt(e.clause,t);break;case nt:case it:case ot:for(let r of e.clauses)qt(r,t);break}}function xe(e,t,r){switch(e.kind){case je:return"false";case Ve:{let n=O(e.tribes);return n.length===0?"false":n.length===V.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case Ze:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case Qe:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case Je:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case et:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case tt:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case At:{let n=r.get(O(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),o=`(i32(${r.get(O(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${o})`;case">":return`(i32(${n}) > ${o})`;case"<":return`(i32(${n}) < ${o})`;case"\u2265":return`(i32(${n}) >= ${o})`;case"\u2264":return`(i32(${n}) <= ${o})`;default:return`(i32(${n}) == ${o})`}}case rt:return`!(${xe(e.clause,t,r)})`;case nt:return`(${e.clauses.map(i=>xe(i,t,r)).join(" && ")})`;case it:return`(${e.clauses.map(i=>xe(i,t,r)).join(" || ")})`;case ot:return`(((${e.clauses.map(o=>xe(o,t,r)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var ar=48;function Yt(){Ue?.destroy(),Ue=s.createBuffer({label:f.uniformBuffer,size:ar,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function ni(){let e=new ArrayBuffer(ar),t=new Float32Array(e),r=new Uint32Array(e),n=(Hr%b+b)%b,i=(jr%h+h)%h,o=Math.floor(n),a=Math.floor(i);t[0]=pe.width,t[1]=pe.height,t[2]=Xr,t[4]=n-o,t[5]=i-a,r[6]=b,r[7]=h,r[8]=o,r[9]=a,r[10]=V.length,s.queue.writeBuffer(Ue,0,e)}function _t(){return ce({cols:b,rows:h},S)}function ie(){return Be(S)}async function Xt(){let e=_t();G=s.createBuffer({label:f.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await bt(e,G),F=s.createBuffer({label:f.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await bt(e,F);let t=s.createCommandEncoder({label:f.gridClearEncoder});t.clearBuffer(G),t.clearBuffer(F),s.queue.submit([t.finish()]),w=!1}function Ht(){let e=new Uint32Array(tn);for(let t=0;t<V.length;t++){let r=V[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),o=parseInt(r.substring(4,6),16);e[t]=n|i<<8|o<<16}be&&be.destroy(),be=s.createBuffer({label:f.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(be,0,e)}function ii(){return kr.replace("__CELLS_PER_WORD__",`${S.cellsPerWord}u`).replace("__WORD_SHIFT__",`${S.wordShift}u`).replace("__CELL_SHIFT__",`${S.cellShift}u`).replace("__CELL_INDEX_MASK__",`${S.cellIndexMask}u`).replace("__CELL_MASK__",`${S.cellMask}u`)}function jt(){let e=s.createShaderModule({label:f.renderShaderModule,code:ii()});mt=s.createRenderPipeline({label:f.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:at}]},primitive:{topology:"triangle-list"}})}function Vt(){qr=s.createBindGroup({layout:mt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ue}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:be}}]}),Yr=s.createBindGroup({layout:mt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ue}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:be}}]})}function Zt(){St=Xn();let e=Jn(),t=s.createShaderModule({label:f.simulationShaderModule,code:e});we=s.createComputePipeline({label:f.simulationPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),nr=s.createBindGroup({layout:we.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:F}}]}),ir=s.createBindGroup({layout:we.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:G}}]})}function Qt(){zt=Hn(),ne=Mr({device:s,cols:b,rows:h,gridFormat:S,dispatchPlan:zt})}var cr=176;function oi(){return`
struct BrushParams {
  centerX: i32,
  centerY: i32,
  cols: u32,
  rows: u32,
  brushSize: u32,
  shape: u32,      // 0=square 1=round 2=diamond 3=vline, 4=hline
  fill: u32,        // 0=full 1=spray 2=outline
  deadId: u32,
  seed: u32,
  tribeCount: u32,
  pad: u32,
  tribeIds: array<u32, 32>,
}

@group(0) @binding(0) var<storage, read_write> grid: array<atomic<u32>>;
@group(0) @binding(1) var<uniform> params: BrushParams;

const CELLS_PER_WORD: u32 = ${S.cellsPerWord}u;
const WORD_SHIFT: u32 = ${S.wordShift}u;
const CELL_SHIFT: u32 = ${S.cellShift}u;
const CELL_INDEX_MASK: u32 = ${S.cellIndexMask}u;
const CELL_MASK: u32 = ${S.cellMask}u;

fn pcg(inp: u32) -> u32 {
  var state = inp * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn writePackedCell(cx: u32, cy: u32, value: u32) {
  let packed_cols = (params.cols + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
  let wordIdx = cy * packed_cols + (cx >> WORD_SHIFT);
  let shift = (cx & CELL_INDEX_MASK) << CELL_SHIFT;
  let mask = CELL_MASK << shift;
  let newBits = (value & CELL_MASK) << shift;
  var old = atomicLoad(&grid[wordIdx]);
  loop {
    let updated = (old & ~mask) | newBits;
    let result = atomicCompareExchangeWeak(&grid[wordIdx], old, updated);
    if (result.exchanged) { break; }
    old = result.old_value;
  }
}

fn inShape(bx: i32, by: i32, size: u32, shape: u32) -> bool {
  if (bx < 0 || by < 0 || bx >= i32(size) || by >= i32(size)) { return false; }
  let hf = f32(size - 1u) / 2.0;
  let fdx = f32(bx) - hf;
  let fdy = f32(by) - hf;
  switch (shape) {
    case 1u: { // round
      let r = f32(size) / 2.0 - 0.25;
      return fdx * fdx + fdy * fdy <= r * r;
    }
    case 2u: { // diamond
      return abs(fdx) + abs(fdy) <= f32(size) / 2.0;
    }
    case 3u: { // vline
      return bx == i32(size - 1u) / 2;
    }
    case 4u: { // hline
      return by == i32(size - 1u) / 2;
    }
    default: { // 0 = square
      return true; // bounds already checked above
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
  let bx = i32(gid.x);
  let by = i32(gid.y);
  if (bx >= i32(params.brushSize) || by >= i32(params.brushSize)) { return; }
  let idx = u32(by) * params.brushSize + u32(bx);

  // Shape test.
  if (params.fill == 2u) {
    if (!onBorder(bx, by, params.brushSize, params.shape)) { return; }
  } else {
    if (!inShape(bx, by, params.brushSize, params.shape)) { return; }
  }

  // Toroidal wrapping.
  let half = i32(params.brushSize - 1u) / 2;
  let dx = bx - half;
  let dy = by - half;
  let cx = ((params.centerX + dx) % i32(params.cols) + i32(params.cols)) % i32(params.cols);
  let cy = ((params.centerY + dy) % i32(params.rows) + i32(params.rows)) % i32(params.rows);

  // Pick a random tribe from the list.
  let spatialHash = (u32(cx) * 73856093u) ^ (u32(cy) * 19349663u);
  let h = pcg(params.seed ^ idx ^ spatialHash);
  let selectedTribe = params.tribeIds[h % params.tribeCount];

  // Spray fill: 50% chance to skip/set-dead (use high bits to avoid
  // correlation with tribe selection which uses low bits via modulo).
  if (params.fill == 1u) {
    if (((h >> 16u) & 1u) != 0u) {
      if (selectedTribe != params.deadId) {
        writePackedCell(u32(cx), u32(cy), params.deadId);
      }
      return;
    }
  }

  writePackedCell(u32(cx), u32(cy), selectedTribe);
}
`}function Jt(){let e=s.createShaderModule({label:f.brushShaderModule,code:oi()});ct=s.createComputePipeline({label:f.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),he?.destroy(),he=s.createBuffer({label:f.brushUniformBuffer,size:cr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Vr=s.createBindGroup({layout:ct.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:he}}]}),Zr=s.createBindGroup({layout:ct.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:he}}]})}function si(e,t,r,n,i,o,a){let c=re.get(He)??0,l=On++,u=new ArrayBuffer(cr),y=new Int32Array(u),d=new Uint32Array(u);y[0]=t,y[1]=r,d[2]=b,d[3]=h,d[4]=n,d[5]=i,d[6]=o,d[7]=c,d[8]=l,d[9]=a.length,d[10]=0;for(let k=0;k<a.length&&k<32;k++)d[11+k]=a[k];s.queue.writeBuffer(he,0,u);let m=Math.ceil(n/8),v=e.beginComputePass({label:f.brushPass});v.setPipeline(ct),v.setBindGroup(0,w?Zr:Vr),v.dispatchWorkgroups(m,m),v.end()}function ai(){let e=w?F:G,t=_t(),r;try{r=s.createBuffer({label:f.gridReadbackBuffer,size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder({label:f.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function an(){if(p=_t(),!U()){R=0;return}let e=ci();R=Math.max(1,Math.floor(e/p))}function ci(){return p>=Fr?p:Math.min(Math.max(Fr,p),$e())}function cn(){if(R<1||p<=0)return Gr;let e=Math.max(p,R*p),t=Math.floor(536870912/e);return Math.max(1,Math.min(Gr,t||1))}function er(){let e=U();self.postMessage({type:"limits",maxBytes:ve(),vramBudgetBytes:nn(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:Kn(),vramRecordingBytes:qn(),gridFormat:ie()})}function _e(){return!U()||R<1||L===null||Z.length===0||fe>=cn()?!1:_<R?!0:Z.some((e,t)=>N[t]&&e.mapState==="unmapped")}function ze(e){if(R<1||L===null||_>=R)return;let t=w?F:G,r=_*p,n=s.createCommandEncoder({label:f.recordingFrameCopyEncoder});n.copyBufferToBuffer(t,0,L,r,p),s.queue.submit([n.finish()]),E.push(e),me=e,_++}function Wt(e){Oe=Math.max(0,Oe+e)}function Nt(){R>0&&_>=R&&_e()&&Ne()}function Ne(){if(L===null||_===0||Z.length===0)return;let e=N.indexOf(!0);if(e<0)return;N[e]=!1;let t=Z[e];if(t.mapState!=="unmapped"){N[e]=!0;return}let r=_*p,n=Qr++,i=[...E],o=i[0],a=i[i.length-1],c=`chunk-${String(n).padStart(6,"0")}.bin`,l=_,u=s.createCommandEncoder({label:f.recordingSealCopyEncoder});u.copyBufferToBuffer(L,0,t,0,r),s.queue.submit([u.finish()]);let y={chunkId:n,generationStart:o,generationEnd:a,blockCount:l,codec:Ct,uncompressedBytes:r,storedBytes:r,gridFormat:ie(),generations:i,filename:c};Ot(1),Wt(l),fe++,Se();let d=ke;t.mapAsync(GPUMapMode.READ).then(async()=>{let m=t.getMappedRange(),v=new ArrayBuffer(r);new Uint8Array(v).set(new Uint8Array(m,0,r)),t.unmap(),d===ke&&(N[e]=!0,M.push(y),Wt(-l),ur(),Se(),Nt(),ui(y,v).then(()=>{d===ke&&(fe--,Se(),Ot(-1),ye(),Pt(!0),Nt(),self.postMessage({type:"chunkSealed",filename:y.filename,rawBytes:r,blockCount:y.blockCount,cols:b,rows:h,rawGridFormat:y.gridFormat,storageGridFormat:Be(Lt(Fe.tribes.length))}),We&&j===0&&(We=!1,ln()))}))}).catch(()=>{d===ke&&(N[e]=!0,fe--,Wt(-l),Se(),Ot(-1),Nt())}),_=0,E=[]}function ur(){M.length>0&&(Y.generationStart=M[0].generationStart,Y.generationEnd=M[M.length-1].generationEnd),E.length>0&&(M.length===0&&(Y.generationStart=E[0]),Y.generationEnd=E[E.length-1]),Y.chunks=[...M]}async function $r(e){ke++,Qr=0,_=0,E=[],M=[],me=null,Oe=0,fe=0,j>0&&(j=0,self.postMessage({type:"chunksSaving",active:!1})),I&&(I=!1,self.postMessage({type:"backpressure",active:!1})),We=!1,X=A,Y={chunks:[],generationStart:e,generationEnd:e,gridFormat:ie()},await un(),ye()}async function lr(){return ue&&await ue,Ie||(Ie=await(await navigator.storage.getDirectory()).getDirectoryHandle(dt,{create:!0})),Ie}async function ui(e,t){let i=await(await(await lr()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function li(e){let t=await lr();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function un(){if(ue){await ue;return}ue=(async()=>{let e=await navigator.storage.getDirectory();Ie=null;try{await e.removeEntry(dt,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${dt}:`,t)}Ie=await e.getDirectoryHandle(dt,{create:!0})})();try{await ue}finally{ue=null}}function ln(){ur(),self.postMessage({type:"recording",manifest:{chunks:M.map(e=>({...e,generations:[...e.generations]})),generationStart:Y.generationStart,generationEnd:Y.generationEnd,gridFormat:ie()},cols:b,rows:h})}function di(){return me!==P}function Ge(e=!1){if(A){if(e){if(X){if(!_e())return;X=!1}}else if(X)return;!di()||!_e()||(_>=R&&Ne(),ze(P))}}function dr(){if(!ut)return;let e=ut;ut=null;let t=s.createCommandEncoder({label:f.brushEncoder});si(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),A&&_>0&&E[_-1]===P&&(_--,E.pop(),ze(P))}async function fi(e,t=Ct){let o=await(await(await(await lr()).getFileHandle(e)).getFile()).arrayBuffer();return t===en?Yn(o):o}function pi(){let e=_+Oe;for(let t of M)e+=t.blockCount;return e}function dn(){return yr(b,h,De.enabled,De.sections)}function mi(){return Cr(dn())}function le(e){lt=mi(),ne&&lt.length!==0&&Er({device:s,encoder:e,resources:ne,sourceBuffer:w?F:G,dispatchPlan:zt,enabledSections:lt})}function de(){let e=P;if(!ne||e===H||W)return;let t=ne,r=[...lt],n=dn();H=e,W=!0,Br({resources:t,enabledSections:r}).then(i=>{let o=re.get(He)??0,a=pi(),c=Tr({generation:e,tribes:V,deadTribeIndex:o,readback:i,enabledSections:r,availability:n,liveMetricSettings:De.sections,cols:b,rows:h,totalFrames:a,fps:sr,canStepBack:a>1,recordingBytes:M.reduce((l,u)=>l+u.storedBytes,0),recordingRawBytes:M.reduce((l,u)=>l+u.uncompressedBytes,0)});if(W=!1,self.postMessage(c),q)if(q=!1,H=-1,mn()){let l=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(l),s.queue.submit([l.finish()]),de()}else q=!0}).catch(()=>{W=!1})}function gi(){let e=b*h;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function bi(){let e=b*h;return e>1e7?2:e>1e6?4:e>1e5?8:16}function fn(e){if(e<=0)return;let t=St,r=s.createCommandEncoder({label:f.simulationBatchEncoder});for(let n=0;n<e;n++){let i=r.beginComputePass({label:f.simulationStepPass});i.setPipeline(we),i.setBindGroup(0,w?ir:nr),i.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),i.end(),w=!w,P++}s.queue.submit([r.finish()]),Ce+=e}function hi(){self.postMessage({type:"generation",generation:P,fps:sr})}function fr(){let e=s.createCommandEncoder({label:f.simulationSingleStepEncoder}),t=e.beginComputePass({label:f.simulationStepPass});t.setPipeline(we),t.setBindGroup(0,w?ir:nr);let r=St;t.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),t.end(),s.queue.submit([e.finish()]),w=!w,P++}function te(){ni();let e=$t.getCurrentTexture().createView(),t=s.createCommandEncoder({label:f.renderEncoder}),r=t.beginRenderPass({label:f.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(mt),r.setBindGroup(0,w?Yr:qr),r.draw(3),r.end(),s.queue.submit([t.finish()])}function pn(e){st===0&&(st=e);let t=e-st;t>=1e3&&(sr=Ce/(t/1e3),Ce=0,st=e)}function pr(){return A&&U()?"recording":"nonRecording"}function Si(){return ee<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/ee}}function oe(e){return e.request.stopCondition.kind==="targetGeneration"}function Ke(e){return e.request.stopCondition.kind==="targetGeneration"&&P>=e.request.stopCondition.generation}function vt(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-P)}function mn(){return!!(s&&ne&&!D&&!$)}function Pt(e=!1){if(e&&(H=-1),!mn())q=!0;else if(W)q=!0;else{let t=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(t),s.queue.submit([t.finish()]),de()}}function gn(){Pt(!0),te()}function Mt(e,t){if(!t)return;(e-Dt>=1e3||Dt===0)&&!W&&(Dt=e,Pt())}function qe(e,t){e.request.pacing.kind!=="max"&&!oe(e)||t-e.lastProgressTime>=1e3&&(e.lastProgressTime=t,hi())}function mr(){I&&(I=!1,self.postMessage({type:"backpressure",active:!1}))}function yi(){I||(I=!0,self.postMessage({type:"backpressure",active:!0}))}function bn(){return _e()?(_>=R&&Ne(),_e()):!1}function Ae(){D||$||C||self.requestAnimationFrame(tr)}function ge(e){let t=C;if(!t||t.pumpPending||D||$)return;let{token:r}=t;t.pumpPending=!0;let n=()=>{!C||C.token!==r||(C.pumpPending=!1,Ri(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?s.queue.onSubmittedWorkDone().then(n).catch(()=>{C?.token===r&&(C.pumpPending=!1)}):queueMicrotask(n)}function gr(e,t){C&&T("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),C={kind:e,request:t,token:++Jr,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0},ge(t.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function J(){B&&gr(pr(),{pacing:Si(),stopCondition:{kind:"none"}})}function T(e,t={}){let r=C;if(!r)return;C=null,Jr++;let n=oe(r),i=t.restore!==!1&&!!r.request.restoreAfterStop;i&&r.request.restoreAfterStop&&(B=r.request.restoreAfterStop.running,ee=r.request.restoreAfterStop.targetStepDuration),n&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?mr():I&&Se(),t.render!==!1&&!D&&!$&&gn(),t.restartRestoredRun!==!1&&i&&B&&!D&&!$?J():Ae()}function zr(e){let t=C;!t||!oe(t)||(t.request.restoreAfterStop&&(t.request.restoreAfterStop.running=e),T("cancelled"))}function Ci(e){T("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),gr(pr(),e)}function hn(e,t,r){yi(),qe(e,t),Mt(t,r),ge("drain")}function _i(e,t){let r=gi(),n=bi(),i=!1;for(let o=0;o<n;o++){let a=vt(e);if(a<=0)break;let c=Math.min(r,a);fn(c),i=!0}if(qe(e,t),Ke(e)){T("targetReached");return}ge(i?"drain":"raf")}function vi(e,t){Ge(!0);let r=!1,n=performance.now()+14;for(;vt(e)>0&&performance.now()<n;){if(!bn()){hn(e,t,r);return}fr(),Ce++,r=!0,ze(P)}if(mr(),qe(e,t),Mt(t,r),Ke(e)){T("targetReached");return}ge("raf")}function Pi(e,t,r){e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=Math.floor(e.stepAccumulator/t),o=Math.min(i,vt(e)),a=o>0;if(a&&(fn(o),e.stepAccumulator-=t*o),qe(e,r),Ke(e)){T("targetReached");return}oe(e)||(te(),Mt(r,a)),ge("raf")}function Mi(e,t,r){Ge(!0),e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=!1;for(;e.stepAccumulator>=t&&vt(e)>0;){if(!bn()){hn(e,r,i);return}fr(),Ce++,e.stepAccumulator-=t,i=!0,ze(P)}if(mr(),qe(e,r),Ke(e)){T("targetReached");return}oe(e)||(te(),Mt(r,i)),ge("raf")}function Ri(e){let t=C;if(!t||D||$)return;if(pn(e),oe(t)||dr(),Ke(t)){T("targetReached");return}if(t.request.pacing.kind==="max"){t.kind==="recording"?vi(t,e):_i(t,e);return}let r=1e3/t.request.pacing.genPerSecond;t.kind==="recording"?Mi(t,r,e):Pi(t,r,e)}function tr(e){if(D||$){self.requestAnimationFrame(tr);return}pn(e),!C&&(dr(),ee>0&&!Te&&te(),self.requestAnimationFrame(tr))}function Ei(e,t){let r=s?ve():Number.POSITIVE_INFINITY;return xr(t.bitsPerCell)&&wt(t.bitsPerCell,e.tribes.length)&&It(e,Ee(t.bitsPerCell),r)?Ee(t.bitsPerCell):Ar(e.tribes.length,e,r)}function Kr(e,t){Fe=e,b=e.cols,h=e.rows,S=Ei(e,t),rr=ae(b,S),V=[...e.tribes],Y.gridFormat=ie(),re.clear(),V.forEach((r,n)=>re.set(r.id,n))}async function Sn(e){console.log("[GOLT worker] Initializing WebGPU"),pe=e,s=await hr(f.webengineDevice),$=!1,s.lost.then(r=>{let n=r.message||r.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),T("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),$=!0,B=!1,D=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:ve(),vramBudgetBytes:nn(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:ie()});let t=pe.getContext("webgpu");if(!t)throw new Error("WebGPU canvas context not available");$t=t,at=navigator.gpu.getPreferredCanvasFormat(),$t.configure({device:s,format:at,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:at,maxBufferSize:s.limits.maxBufferSize,maxStorageBufferBindingSize:s.limits.maxStorageBufferBindingSize})}async function Bi(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Sn(pe),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let t=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",t),T("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),$=!0,B=!1,D=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function yn(){L=s.createBuffer({label:f.recordingChunkBuffer,size:R*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await bt(R*p,L),_=0,E=[],me=null}async function Cn(){let e=R*p;Z=[],N=[];for(let t=0;t<yt;t++){let r=s.createBuffer({label:`${f.recordingStagingBuffer} ${t}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});Z.push(r),N.push(!0),await bt(e,r)}}async function Ti(){await un()}async function ki(){console.log("[GOLT worker] Building GPU resources",{cols:b,rows:h,bitsPerCell:S.bitsPerCell,recordingAvailable:U()}),Yt(),an(),await Xt(),Ht(),jt(),Vt(),Zt(),Jt(),Qt(),await Ti(),U()?(await yn(),await Cn()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:p,maxRecordingBufferBytes:$e()}),ht(),A=!1,X=!1),await gt(),er(),console.log("[GOLT worker] GPU resources ready")}async function xi(){console.log("[GOLT worker] Rebuild started",{cols:b,rows:h,bitsPerCell:S.bitsPerCell}),T("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),D=!0,self.postMessage({type:"rebuilding",active:!0});try{await or()}catch{}if($&&!await Bi())return!1;Or(),Yt(),an(),Dr(U());try{await Xt(),Ht(),jt(),Zt(),Jt(),Vt(),Qt(),U()?(await yn(),await Cn()):(ht(),A=!1,X=!1),await gt(),er()}catch(e){let t=e instanceof Error?e.message:String(e);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{Or(),Yt(),Dr(!1),await Xt(),Ht(),jt(),Zt(),Jt(),Vt(),Qt(),A=!1,X=!1,p=_t(),ht(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await gt(),er()}catch(r){return console.error("[GOLT worker] GPU rebuild recovery failed:",r),!1}}return D=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:U(),frameByteSize:p}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(console.log("[GOLT worker] Init message received",{cols:t.ruleset.cols,rows:t.ruleset.rows,recording:t.recording,running:t.running,speed:t.speed}),A=t.recording,De=Ft(t.liveMetrics),X=A,Kr(t.ruleset,t.simulationGridFormat),await Sn(t.canvas),await ki(),W)q=!0;else{let r=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(r),s.queue.submit([r.finish()]),de()}ye(),B=t.running,ee=t.speed<0?0:1e3/t.speed,B?J():Ae();break}case"setLiveMetrics":{De=Ft(t.liveMetrics),H=-1,Pt(!0);break}case"setRuleset":{if(console.log("[GOLT worker] Ruleset update received",{cols:t.ruleset.cols,rows:t.ruleset.rows,tribes:t.ruleset.tribes.length}),T("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Kr(t.ruleset,t.simulationGridFormat),!await xi())break;if(P=0,H=-1,await $r(0),B?J():Ae(),W)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(n),s.queue.submit([n.finish()]),de()}break}case"setRunning":if(B=t.running,t.running){C||J();break}C&&oe(C)?zr(!1):C?T("manual"):(I&&Se(),gn(),Ae());break;case"setSpeed":{let r=ee<=0,n=t.speed<0?0:1e3/t.speed;ee=n,C&&!oe(C)&&B?(T("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&n>0?(Te=!0,s.queue.onSubmittedWorkDone().then(()=>{Te=!1,te(),J()})):J()):B&&!C?J():r&&n>0&&(Te=!0,s.queue.onSubmittedWorkDone().then(()=>{Te=!1,te(),Ae()}));break}case"camera":Xr=t.scale,Hr=t.offsetX,jr=t.offsetY;break;case"resize":pe.width=t.width,pe.height=t.height;break;case"draw":{let r=t.tribes.map(n=>re.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};ut={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{ai().then(r=>{let n={type:"snapshot",grid:r,generation:P,cols:b,rows:h,gridFormat:ie()};self.postMessage(n,[r.buffer])}).catch(()=>{let r=new Uint32Array(0),n={type:"snapshot",grid:r,generation:P,cols:b,rows:h,gridFormat:ie()};self.postMessage(n,[r.buffer])});break}case"loadSnapshot":{let r=w?F:G,n=Gt(t.gridFormat),i=ce({cols:b,rows:h},n);if(t.grid.byteLength!==i)break;let o=Ut(t.grid,{cols:b,rows:h},n,S);s.queue.writeBuffer(r,0,o),P=t.generation,await $r(t.generation);break}case"setRecording":{let r=C?.request;if(t.recording&&U()&&!A){if(A=!0,X=!0,H=-1,W)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(n),s.queue.submit([n.finish()]),de()}ye()}else(!t.recording||!U())&&(t.recording&&!U()&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:p,maxRecordingBufferBytes:$e()}),A=!1,X=!1);r&&C?Ci(r):!C&&B&&J();break}case"getRecording":{if(We)break;await or(),Ge(!1),_>0&&Ne(),j>0?We=!0:ln();break}case"stepBack":{let r=0;for(let c of M)r+=c.blockCount;let n=r+_,i=Math.min(t.count,n-1);if(i<=0)break;let o=n-1-i,a=w?F:G;if(o>=r){let c=o-r;_=c+1,E.length=_,P=E[c],me=P;let l=s.createCommandEncoder({label:f.recordingRestoreCopyEncoder});l.copyBufferToBuffer(L,c*p,a,0,p),s.queue.submit([l.finish()])}else{if(j>0){await new Promise(g=>{let x=setInterval(()=>{j===0&&(clearInterval(x),g())},10)}),r=0;for(let g of M)r+=g.blockCount}let c=0,l=0,u=0;for(let g=0;g<M.length;g++){let x=M[g];if(o<c+x.blockCount){l=g,u=o-c;break}c+=x.blockCount}let y=M[l],d=await fi(y.filename,y.codec),m=Gt(y.gridFormat),v=ce({cols:b,rows:h},m);if(m.bitsPerCell===S.bitsPerCell){let g=(u+1)*p;s.queue.writeBuffer(L,0,new Uint8Array(d,0,g))}else{let g=new Uint8Array((u+1)*p);for(let x=0;x<=u;x++){let se=x*v,_n=new Uint8Array(d,se,v),Rt=Ut(wr(_n),{cols:b,rows:h},m,S);g.set(new Uint8Array(Rt.buffer,Rt.byteOffset,Rt.byteLength),x*p)}s.queue.writeBuffer(L,0,g),s.queue.writeBuffer(a,0,g.subarray(u*p,(u+1)*p))}if(_=u+1,E=y.generations.slice(0,u+1),P=E[u],me=P,m.bitsPerCell===S.bitsPerCell){let g=s.createCommandEncoder({label:f.recordingRestoreCopyEncoder});g.copyBufferToBuffer(L,u*p,a,0,p),s.queue.submit([g.finish()])}let z=M.splice(l).map(g=>g.filename);li(z)}if(ur(),ye(),H=-1,W)q=!0;else{let c=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(c),s.queue.submit([c.finish()]),de()}te();break}case"stepForward":{if(dr(),t.count===1){if(Ge(!0),fr(),Ce++,A&&_e()&&(_>=R&&Ne(),ze(P)),H=-1,W)q=!0;else{let r=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(r),s.queue.submit([r.finish()]),de()}te()}else self.postMessage({type:"stepping",active:!0}),Ge(!0),gr(pr(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:P+t.count},restoreAfterStop:{running:B,targetStepDuration:ee}});break}case"cancelStepping":{zr(C?.request.restoreAfterStop?.running??B);break}case"updateChunkCodec":{let r=M.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,Y.chunks=[...M],ye());break}case"getUncompressedChunks":{let r=M.filter(n=>n.codec===Ct).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:b,rows:h,rawGridFormat:n.gridFormat,storageGridFormat:Be(Lt(Fe.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
