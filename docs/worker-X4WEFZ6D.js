var yr="goltTimestampedConsoleInstalled";function Rn(){let e=globalThis;e[yr]||(e[yr]=!0,kt("log"),kt("warn"),kt("error"))}function kt(e){let t=console[e].bind(console);console[e]=(...r)=>{t(`[${new Date().toISOString()}]`,...r)}}Rn();async function Cr(e,t){if(!navigator.gpu)throw new Error("WebGPU is unavailable.");let r=await navigator.gpu.requestAdapter();if(!r)throw new Error("WebGPU adapter is unavailable.");return t?.(r.limits),r.requestDevice({label:e,requiredLimits:{maxBufferSize:r.limits.maxBufferSize,maxStorageBufferBindingSize:r.limits.maxStorageBufferBindingSize}})}var f={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer",webengineDevice:"webengine WebGPU device",recordedGpuMetricsDevice:"recorded GPU Metrics device",mp4ConversionDevice:"MP4 conversion device",mp4ConversionFrameBuffer:"MP4 conversion frame buffer",mp4ConversionPaletteBuffer:"MP4 conversion palette buffer",mp4ConversionConfigBuffer:"MP4 conversion config buffer",mp4ConversionShaderModule:"MP4 conversion shader module",mp4ConversionPipeline:"MP4 conversion pipeline",mp4ConversionBindGroup:"MP4 conversion bind group",mp4ConversionEncoder:"MP4 conversion encoder",mp4ConversionPass:"MP4 conversion pass"};var _r=4294967295;function K(e,t){return e.includes(t)}function xt(e,t){let r;return e?r=t?"ok":"tooLarge":r="disabled",r}function vr(e,t,r,n){let i=e*t,o=i<=_r,a=i*2<=_r;return{population:xt(r&&n.population,o),diversity:xt(r&&n.diversity,o),interfaces:xt(r&&n.interfaces,a)}}function Pr(e){let t=[];return e.population==="ok"&&t.push("population"),e.diversity==="ok"&&t.push("diversity"),e.interfaces==="ok"&&t.push("interfaces"),t}var ve=256*Uint32Array.BYTES_PER_ELEMENT,Pe=Uint32Array.BYTES_PER_ELEMENT;function Rr(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function Mr(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function Er(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function Mn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${Rr(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Mr(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${Er(i)}
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
`}function En(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${Rr(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Mr(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${Er(i)}
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
`}function Br(e){let{device:t}=e,r=t.createShaderModule({label:f.histogramMetricsShaderModule,code:Mn(e)}),n=t.createComputePipeline({label:f.histogramMetricsPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),i=t.createBuffer({label:f.histogramMetricsBuffer,size:ve,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=t.createBuffer({label:f.histogramMetricsReadBuffer,size:ve,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),a=t.createShaderModule({label:f.interfaceMetricsShaderModule,code:En(e)}),c=t.createComputePipeline({label:f.interfaceMetricsPipeline,layout:"auto",compute:{module:a,entryPoint:"main"}}),l=t.createBuffer({label:f.interfaceMetricsBuffer,size:Pe,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),u=t.createBuffer({label:f.interfaceMetricsReadBuffer,size:Pe,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:c,boundaryBuffer:l,boundaryReadBuffer:u}}function Tr(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function kr(e){let{device:t,encoder:r,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:a}=e;if(K(a,"population")||K(a,"diversity")){let c=new Uint32Array(256);t.queue.writeBuffer(n.histogramBuffer,0,c);let l=t.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),u=r.beginComputePass({label:f.histogramMetricsPass});u.setPipeline(n.histogramPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),u.end(),r.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,ve)}if(K(a,"interfaces")){let c=new Uint32Array([0]);t.queue.writeBuffer(n.boundaryBuffer,0,c);let l=t.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),u=r.beginComputePass({label:f.interfaceMetricsPass});u.setPipeline(n.boundaryPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),u.end(),r.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Pe)}}async function xr(e){let{resources:t,enabledSections:r}=e,n=K(r,"population")||K(r,"diversity"),i=K(r,"interfaces"),o=[];n&&o.push(t.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(t.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let a=new Uint32Array(256);n&&(a=new Uint32Array(t.histogramReadBuffer.getMappedRange().slice(0)),t.histogramReadBuffer.unmap());let c=0;if(i){let l=new Uint32Array(t.boundaryReadBuffer.getMappedRange().slice(0));t.boundaryReadBuffer.unmap(),c=l[0]??0}return{histogram:a,crossStateContactEdges:c}}function Bn(e,t){let{tribes:r,deadTribeIndex:n,readback:i,cols:o,rows:a}=e,c=o*a,l={};for(let y=0;y<r.length;y++){let d=t?i.histogram[y]??0:0;l[r[y].id]=d}let u=t?l[r[n]?.id??""]??0:0;return{population:l,aliveCells:t?Math.max(0,c-u):0,deadCells:u}}function Tn(e){let{tribes:t,deadTribeIndex:r,readback:n}=e,i=0;for(let o=0;o<t.length;o++)o!==r&&(i+=n.histogram[o]??0);return i}function kn(e,t){let{tribes:r,deadTribeIndex:n,readback:i}=e,o=t?Tn(e):0,a=0,c=0;for(let l=0;l<r.length;l++){let u=l!==n&&o>0?(i.histogram[l]??0)/o:0;u>0&&(a-=u*Math.log2(u),c+=u*u)}return{shannonEntropy:a,simpsonSum:c}}function xn(e,t){let r=e.cols*e.rows*2,n=t?e.readback.crossStateContactEdges:0,i=t?Math.max(0,r-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:t&&r>0?i/r:0,crossStateContactFraction:t&&r>0?n/r:0}}function Ar(e){let{generation:t,enabledSections:r,availability:n,liveMetricSettings:i,cols:o,rows:a,totalFrames:c,fps:l,canStepBack:u,recordingBytes:y,recordingRawBytes:d}=e,m=K(r,"population")&&i.population,v=K(r,"diversity")&&i.diversity,x=K(r,"interfaces")&&i.interfaces,z=o*a,g=Bn(e,m),A=kn(e,v),ae=xn(e,x);return{type:"metrics",generation:t,population:g.population,aliveCells:g.aliveCells,deadCells:g.deadCells,occupancy:m&&z>0?g.aliveCells/z:0,shannonEntropy:A.shannonEntropy,simpsonIndex:v?1-A.simpsonSum:0,interfaces:ae,metricsAvailability:n,extinctionTime:{},totalFrames:c,fps:l,canStepBack:u,recordingBytes:y,recordingRawBytes:d}}var wr=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var At=[1,2,4,8,16,32],wn={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},In={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Ln={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Ye={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Gn={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},wt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},Q={1:wn,2:In,4:Ln,8:Ye,16:Gn,32:wt};var Re={population:!0,diversity:!0,interfaces:!1},Xe={enabled:!0,sections:Re};var It="any",He="dead";var je="empty",Ve="is",Lt="comparison",Ze="count",Qe="none",Je="exactly",et="min",tt="max",rt="not",nt="and",it="or",ot="xor";function Ir(e){return At.includes(e)}function Fn(e){return 2**e}function Gt(e,t){return t<=Fn(e)}function Ft(e,t,r){return ue(e,t)<=r}function Ut(e){return e<=2?Q[1]:e<=4?Q[2]:e<=16?Q[4]:e<=256?Q[8]:e<=65536?Q[16]:Q[32]}function Me(e){return Q[e]}function Lr(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of At){let i=Me(n);if(Gt(n,e)&&Ft(t,i,r))return i}return wt}function Dt(e){return Me(e?.bitsPerCell??8)}function Ee(e){return{bitsPerCell:e.bitsPerCell}}function ce(e,t){return Math.ceil(e/t.cellsPerWord)}function ue(e,t){return ce(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Gr(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function Un(e){return{population:typeof e?.population=="boolean"?e.population:Re.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Re.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Re.interfaces}}function Ot(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Xe.enabled,sections:Un(e?.sections)}}function Fr(e,t,r,n,i){let o=ce(t.cols,r),a=e[i*o+(n>>r.wordShift)]??0;return Dn(a,r,n&r.cellIndexMask)}function Ur(e,t,r,n,i,o){let a=ce(t.cols,r),c=i*a+(n>>r.wordShift),l=(n&r.cellIndexMask)<<r.cellShift,u=~(r.cellMask<<l),y=e[c]??0;e[c]=(y&u|(o&r.cellMask)<<l)>>>0}function Dn(e,t,r){return t.bitsPerCell===32?e>>>0:e>>>(r<<t.cellShift)&t.cellMask}var no=64*1024*1024;function Wt(e,t,r,n){let i=e,o;if(r.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(ue(t,n)/Uint32Array.BYTES_PER_ELEMENT);for(let a=0;a<t.rows;a++)for(let c=0;c<t.cols;c++)Ur(o,t,n,c,a,Fr(i,t,r,c,a))}return o}var s,$=!1,Kt,at,pe,Ge,b=0,h=0,ir=0,S=Ye,V=[],ne=new Map,Ct,qt,G,F,Fe,be,gt,Hr,jr,Ae,or,sr,w=!1,Vr=1,Zr=0,Qr=0,B=!1,D=!1,ee=100,P=0,ct,he,Jr,en,Nn=0,ut=null,ie=null,H=-1,W=!1,q=!1,Nt=0,Ue=Xe,lt=[],T=!1,X=!1,Y={chunks:[],generationStart:0,generationEnd:0,gridFormat:Ee(Ye)},tn=0,R=[],C=null,rn=0,Be=!1,L=null,_=0,E=[],me=null,M=64,p=0,_t=3,Z=[],N=[],dt="gol-recording",vt="raw-packed",nn="deflate-raw",we=null,le=null,j=0,De=0,te=0,Dr=12,I=!1,Te=0,on=256,$n=on*Uint32Array.BYTES_PER_ELEMENT,Or=256*1024*1024,zn=512*1024*1024,Wr=128*1024*1024*1024,ft=0,pt=0,Ie=[];function Kn(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function sn(e){console.error("[GOLT worker] Worker GPU error:",e),k("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),B=!1,self.postMessage({type:"gpuError",reason:Kn(e)})}self.addEventListener("error",e=>{e.preventDefault(),sn(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),sn(e.reason)});async function ar(){await s.queue.onSubmittedWorkDone()}function Nr(e){ft=0,pt=2+(e?1+_t:0),Ie=[]}async function bt(){if(Ie.length===0)return;let e=s.createCommandEncoder({label:f.trackedAllocationClearEncoder});for(let t of Ie)e.clearBuffer(t);s.queue.submit([e.finish()]),await ar(),Ie=[]}async function ht(e,t){!D||pt<=0||(ft+=e,pt--,Ie.push(t),ft>=qn()&&pt>0&&(await bt(),ft=0))}function qn(){return Math.min(_e(),zn)}function _e(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function $e(){return Math.min(_e(),1073741824)}function an(){return Math.max(_e()*2,$e()*6)}function U(){return p>0&&p<=$e()}function Yn(){return p<=0?0:p*2+ur+$n+lr+ve*2+Pe*2}function Xn(){return M<1||p<=0?0:M*p*(1+_t)}function St(){L?.destroy(),L=null;for(let e of Z)e?.destroy();Z=[],N=[],M=0,_=0,E=[],me=null,De=0}function $r(){G?.destroy(),F?.destroy(),Tr(ie),ie=null,he?.destroy(),St()}function $t(e){let t=j>0;j+=e;let r=j>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function Se(){if(M<1||Z.length===0){I&&(I=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=dr(),t=!N.some(i=>i)&&_>=M,r=te>=e,n;if(I){let i=N.some(a=>a),o=te<=Math.floor(e/2);n=!(i&&o)}else n=t||r;n!==I&&(I=n,self.postMessage({type:"backpressure",active:n}))}async function ye(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??Wr/128,Wr),r=e.usage??0,n=0,i=0;for(let c of R)c.codec===vt?n+=c.storedBytes:i+=c.storedBytes;let o=M*p,a=T?(1+_t)*o:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:a})}var Oe=!1;async function Hn(e){let t=new DecompressionStream(nn),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:l,value:u}=await i.read();if(l)break;n.push(u)}let o=0;for(let l of n)o+=l.byteLength;let a=new Uint8Array(o),c=0;for(let l of n)a.set(l,c),c+=l.byteLength;return a.buffer}var Ce=0,st=0,cr=0;function cn(e,t,r=s.limits.maxComputeWorkgroupsPerDimension){if(e<=r&&t<=r)return{logicalWgX:e,logicalWgY:t,dispatchWgX:e,dispatchWgY:t,remapped:!1};let n=e*t,i=Math.min(n,r),o=Math.ceil(n/i);if(o>r)throw new Error(`Grid requires ${e}x${t} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${r}.`);return{logicalWgX:e,logicalWgY:t,dispatchWgX:i,dispatchWgY:o,remapped:!0}}function jn(){return cn(Math.ceil(ir/16),Math.ceil(h/16))}function Vn(){return cn(Math.ceil(b/16),Math.ceil(h/16))}function Zn(e,t){t.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${t.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${t.dispatchWgX}u;`))}function Qn(e){e.push(`const CELLS_PER_WORD: u32 = ${S.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${S.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${S.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${S.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${S.cellMask}u;`)}function Jn(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function ei(e,t,r){if(t.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${r} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${r} = gid.x;`),e.push("  let y = gid.y;")}function ti(){let e=[],t=ir,r=Ct;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${V.map(d=>d.id).join(", ")}`),e.push(`// Rules: ${Ge.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${b}u;`),e.push(`const ROWS: u32 = ${h}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),Zn(e,r),Qn(e),e.push(""),Jn(e,"gridIn","PACKED_COLS"),e.push("");let n=ne.get(He)??0,i=Ge.rules.filter(d=>!d.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let o=ni(i.map(d=>d.clause)),a=new Map,c=0;for(let d of o){let m=`count_${c++}`;a.set(d,m)}for(let[d,m]of a){let v=d.split(",").map(Number),z=zr().map(g=>`select(0u, 1u, ${v.map(ae=>`${g} == ${ae}u`).join(" || ")})`);e.push(`  let ${m} = ${z.join(" + ")};`)}o.size>0&&e.push("");let l=ii(i.map(d=>d.clause)),u=new Map,y=0;for(let d of l)if(a.has(d))u.set(d,a.get(d));else{let m=`eq_count_${y++}`;u.set(d,m)}for(let[d,m]of u){if(a.has(d))continue;let v=d.split(",").map(Number),z=zr().map(g=>`select(0u, 1u, ${v.map(ae=>`${g} == ${ae}u`).join(" || ")})`);e.push(`  let ${m} = ${z.join(" + ")};`)}l.size>0&&y>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let d=0;d<i.length;d++){let m=i[d],v=ke(m.clause,a,u),x=ri(m.tribe);d===0?e.push(`  if (${v}) {`):e.push(`  } else if (${v}) {`),e.push(`    result = ${x}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),r.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),ei(e,r,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let d=-1;d<=1;d++)for(let m=-1;m<=1;m++){if(m===0&&d===0)continue;let v=un(m,d),x=Kr("x",m,"COLS"),z=Kr("y",d,"ROWS");e.push(`    let ${v} = readCell(${x}, ${z});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function un(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function zr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(un(r,t));return e}function Kr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function O(e){let t=[];for(let r of e)if(r===It)for(let n=0;n<V.length;n++)t.push(n);else{let n=ne.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function ri(e){return e===It?0:ne.get(e)??0}function ni(e){let t=new Set;for(let r of e)Yt(r,t);return t}function Yt(e,t){switch(e.kind){case je:case Ve:break;case Qe:case Je:case et:case tt:case Ze:{let r=O(e.tribes).sort();t.add(r.join(","));break}case rt:Yt(e.clause,t);break;case nt:case it:case ot:for(let r of e.clauses)Yt(r,t);break}}function ii(e){let t=new Set;for(let r of e)Xt(r,t);return t}function Xt(e,t){switch(e.kind){case je:case Ve:case Ze:case Qe:case Je:case et:case tt:break;case Lt:{let r=O(e.tribe1).sort(),n=O(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case rt:Xt(e.clause,t);break;case nt:case it:case ot:for(let r of e.clauses)Xt(r,t);break}}function ke(e,t,r){switch(e.kind){case je:return"false";case Ve:{let n=O(e.tribes);return n.length===0?"false":n.length===V.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case Ze:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case Qe:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case Je:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case et:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case tt:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case Lt:{let n=r.get(O(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),o=`(i32(${r.get(O(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${o})`;case">":return`(i32(${n}) > ${o})`;case"<":return`(i32(${n}) < ${o})`;case"\u2265":return`(i32(${n}) >= ${o})`;case"\u2264":return`(i32(${n}) <= ${o})`;default:return`(i32(${n}) == ${o})`}}case rt:return`!(${ke(e.clause,t,r)})`;case nt:return`(${e.clauses.map(i=>ke(i,t,r)).join(" && ")})`;case it:return`(${e.clauses.map(i=>ke(i,t,r)).join(" || ")})`;case ot:return`(((${e.clauses.map(o=>ke(o,t,r)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var ur=48;function Ht(){Fe?.destroy(),Fe=s.createBuffer({label:f.uniformBuffer,size:ur,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function oi(){let e=new ArrayBuffer(ur),t=new Float32Array(e),r=new Uint32Array(e),n=(Zr%b+b)%b,i=(Qr%h+h)%h,o=Math.floor(n),a=Math.floor(i);t[0]=pe.width,t[1]=pe.height,t[2]=Vr,t[4]=n-o,t[5]=i-a,r[6]=b,r[7]=h,r[8]=o,r[9]=a,r[10]=V.length,s.queue.writeBuffer(Fe,0,e)}function Pt(){return ue({cols:b,rows:h},S)}function oe(){return Ee(S)}async function jt(){let e=Pt();G=s.createBuffer({label:f.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ht(e,G),F=s.createBuffer({label:f.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ht(e,F);let t=s.createCommandEncoder({label:f.gridClearEncoder});t.clearBuffer(G),t.clearBuffer(F),s.queue.submit([t.finish()]),w=!1}function Vt(){let e=new Uint32Array(on);for(let t=0;t<V.length;t++){let r=V[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),o=parseInt(r.substring(4,6),16);e[t]=n|i<<8|o<<16}be&&be.destroy(),be=s.createBuffer({label:f.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(be,0,e)}function si(){return wr.replace("__CELLS_PER_WORD__",`${S.cellsPerWord}u`).replace("__WORD_SHIFT__",`${S.wordShift}u`).replace("__CELL_SHIFT__",`${S.cellShift}u`).replace("__CELL_INDEX_MASK__",`${S.cellIndexMask}u`).replace("__CELL_MASK__",`${S.cellMask}u`)}function Zt(){let e=s.createShaderModule({label:f.renderShaderModule,code:si()});gt=s.createRenderPipeline({label:f.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:at}]},primitive:{topology:"triangle-list"}})}function Qt(){Hr=s.createBindGroup({layout:gt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Fe}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:be}}]}),jr=s.createBindGroup({layout:gt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Fe}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:be}}]})}function Jt(){Ct=jn();let e=ti(),t=s.createShaderModule({label:f.simulationShaderModule,code:e});Ae=s.createComputePipeline({label:f.simulationPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),or=s.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:F}}]}),sr=s.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:G}}]})}function er(){qt=Vn(),ie=Br({device:s,cols:b,rows:h,gridFormat:S,dispatchPlan:qt})}var lr=176;function ai(){return`
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
`}function tr(){let e=s.createShaderModule({label:f.brushShaderModule,code:ai()});ct=s.createComputePipeline({label:f.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),he?.destroy(),he=s.createBuffer({label:f.brushUniformBuffer,size:lr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Jr=s.createBindGroup({layout:ct.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:he}}]}),en=s.createBindGroup({layout:ct.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:he}}]})}function ci(e,t,r,n,i,o,a){let c=ne.get(He)??0,l=Nn++,u=new ArrayBuffer(lr),y=new Int32Array(u),d=new Uint32Array(u);y[0]=t,y[1]=r,d[2]=b,d[3]=h,d[4]=n,d[5]=i,d[6]=o,d[7]=c,d[8]=l,d[9]=a.length,d[10]=0;for(let x=0;x<a.length&&x<32;x++)d[11+x]=a[x];s.queue.writeBuffer(he,0,u);let m=Math.ceil(n/8),v=e.beginComputePass({label:f.brushPass});v.setPipeline(ct),v.setBindGroup(0,w?en:Jr),v.dispatchWorkgroups(m,m),v.end()}function ui(){let e=w?F:G,t=Pt(),r;try{r=s.createBuffer({label:f.gridReadbackBuffer,size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder({label:f.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function ln(){if(p=Pt(),!U()){M=0;return}let e=li();M=Math.max(1,Math.floor(e/p))}function li(){return p>=Or?p:Math.min(Math.max(Or,p),$e())}function dr(){if(M<1||p<=0)return Dr;let e=Math.max(p,M*p),t=Math.floor(536870912/e);return Math.max(1,Math.min(Dr,t||1))}function rr(){let e=U();self.postMessage({type:"limits",maxBytes:_e(),vramBudgetBytes:an(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:Yn(),vramRecordingBytes:Xn(),gridFormat:oe()})}function We(){return!U()||M<1||L===null||Z.length===0?!1:_<M?!0:dn()}function dn(){return te>=dr()?!1:Z.some((e,t)=>N[t]&&e.mapState==="unmapped")}function ze(e){if(M<1||L===null||_>=M)return;let t=w?F:G,r=_*p,n=s.createCommandEncoder({label:f.recordingFrameCopyEncoder});n.copyBufferToBuffer(t,0,L,r,p),s.queue.submit([n.finish()]),E.push(e),me=e,_++,mt()}function zt(e){De=Math.max(0,De+e)}function mt(){M>0&&_>=M&&dn()&&Ne()}function Ne(){if(L===null||_===0||Z.length===0||te>=dr())return;let e=N.indexOf(!0);if(e<0)return;N[e]=!1;let t=Z[e];if(t.mapState!=="unmapped"){N[e]=!0;return}let r=_*p,n=tn++,i=[...E],o=i[0],a=i[i.length-1],c=`chunk-${String(n).padStart(6,"0")}.bin`,l=_,u=s.createCommandEncoder({label:f.recordingSealCopyEncoder});u.copyBufferToBuffer(L,0,t,0,r),s.queue.submit([u.finish()]);let y={chunkId:n,generationStart:o,generationEnd:a,blockCount:l,codec:vt,uncompressedBytes:r,storedBytes:r,gridFormat:oe(),generations:i,filename:c};$t(1),zt(l),te++,Se();let d=Te;t.mapAsync(GPUMapMode.READ).then(async()=>{let m=t.getMappedRange(),v=new ArrayBuffer(r);new Uint8Array(v).set(new Uint8Array(m,0,r)),t.unmap(),d===Te&&(N[e]=!0,R.push(y),zt(-l),fr(),Se(),mt(),di(y,v).then(()=>{d===Te&&(te--,Se(),$t(-1),ye(),yt(),Mt(!0),mt(),self.postMessage({type:"chunkSealed",filename:y.filename,rawBytes:r,blockCount:y.blockCount,cols:b,rows:h,rawGridFormat:y.gridFormat,storageGridFormat:Ee(Ut(Ge.tribes.length))}),Oe&&j===0&&(Oe=!1,yt()))}))}).catch(()=>{d===Te&&(N[e]=!0,te--,zt(-l),Se(),$t(-1),mt())}),_=0,E=[]}function fr(){R.length>0&&(Y.generationStart=R[0].generationStart,Y.generationEnd=R[R.length-1].generationEnd),E.length>0&&(R.length===0&&(Y.generationStart=E[0]),Y.generationEnd=E[E.length-1]),Y.chunks=[...R]}async function qr(e){Te++,tn=0,_=0,E=[],R=[],me=null,De=0,te=0,j>0&&(j=0,self.postMessage({type:"chunksSaving",active:!1})),I&&(I=!1,self.postMessage({type:"backpressure",active:!1})),Oe=!1,X=T,Y={chunks:[],generationStart:e,generationEnd:e,gridFormat:oe()},await fn(),ye()}async function pr(){return le&&await le,we||(we=await(await navigator.storage.getDirectory()).getDirectoryHandle(dt,{create:!0})),we}async function di(e,t){let i=await(await(await pr()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function fi(e){let t=await pr();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function fn(){if(le){await le;return}le=(async()=>{let e=await navigator.storage.getDirectory();we=null;try{await e.removeEntry(dt,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${dt}:`,t)}we=await e.getDirectoryHandle(dt,{create:!0})})();try{await le}finally{le=null}}function yt(){fr(),self.postMessage({type:"recording",manifest:{chunks:R.map(e=>({...e,generations:[...e.generations]})),generationStart:Y.generationStart,generationEnd:Y.generationEnd,gridFormat:oe()},cols:b,rows:h})}function pi(){return me!==P}function Le(e=!1){if(T){if(e){if(X){if(!We())return;X=!1}}else if(X)return;!pi()||!We()||(_>=M&&Ne(),ze(P))}}function mr(){if(!ut)return;let e=ut;ut=null;let t=s.createCommandEncoder({label:f.brushEncoder});ci(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),T&&_>0&&E[_-1]===P&&(_--,E.pop(),ze(P))}async function mi(e,t=vt){let o=await(await(await(await pr()).getFileHandle(e)).getFile()).arrayBuffer();return t===nn?Hn(o):o}function gi(){let e=_+De;for(let t of R)e+=t.blockCount;return e}function pn(){return vr(b,h,Ue.enabled,Ue.sections)}function bi(){return Pr(pn())}function de(e){lt=bi(),ie&&lt.length!==0&&kr({device:s,encoder:e,resources:ie,sourceBuffer:w?F:G,dispatchPlan:qt,enabledSections:lt})}function fe(){let e=P;if(!ie||e===H||W)return;let t=ie,r=[...lt],n=pn();H=e,W=!0,xr({resources:t,enabledSections:r}).then(i=>{let o=ne.get(He)??0,a=gi(),c=Ar({generation:e,tribes:V,deadTribeIndex:o,readback:i,enabledSections:r,availability:n,liveMetricSettings:Ue.sections,cols:b,rows:h,totalFrames:a,fps:cr,canStepBack:a>1,recordingBytes:R.reduce((l,u)=>l+u.storedBytes,0),recordingRawBytes:R.reduce((l,u)=>l+u.uncompressedBytes,0)});if(W=!1,self.postMessage(c),q)if(q=!1,H=-1,bn()){let l=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(l),s.queue.submit([l.finish()]),fe()}else q=!0}).catch(()=>{W=!1})}function hi(){let e=b*h;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function Si(){let e=b*h;return e>1e7?2:e>1e6?4:e>1e5?8:16}function mn(e){if(e<=0)return;let t=Ct,r=s.createCommandEncoder({label:f.simulationBatchEncoder});for(let n=0;n<e;n++){let i=r.beginComputePass({label:f.simulationStepPass});i.setPipeline(Ae),i.setBindGroup(0,w?sr:or),i.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),i.end(),w=!w,P++}s.queue.submit([r.finish()]),Ce+=e}function yi(){self.postMessage({type:"generation",generation:P,fps:cr})}function gr(){let e=s.createCommandEncoder({label:f.simulationSingleStepEncoder}),t=e.beginComputePass({label:f.simulationStepPass});t.setPipeline(Ae),t.setBindGroup(0,w?sr:or);let r=Ct;t.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),t.end(),s.queue.submit([e.finish()]),w=!w,P++}function re(){oi();let e=Kt.getCurrentTexture().createView(),t=s.createCommandEncoder({label:f.renderEncoder}),r=t.beginRenderPass({label:f.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(gt),r.setBindGroup(0,w?jr:Hr),r.draw(3),r.end(),s.queue.submit([t.finish()])}function gn(e){st===0&&(st=e);let t=e-st;t>=1e3&&(cr=Ce/(t/1e3),Ce=0,st=e)}function br(){return T&&U()?"recording":"nonRecording"}function Ci(){return ee<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/ee}}function se(e){return e.request.stopCondition.kind==="targetGeneration"}function Ke(e){return e.request.stopCondition.kind==="targetGeneration"&&P>=e.request.stopCondition.generation}function Rt(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-P)}function bn(){return!!(s&&ie&&!D&&!$)}function Mt(e=!1){if(e&&(H=-1),!bn())q=!0;else if(W)q=!0;else{let t=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(t),s.queue.submit([t.finish()]),fe()}}function hn(){Mt(!0),re()}function Et(e,t){if(!t)return;(e-Nt>=1e3||Nt===0)&&!W&&(Nt=e,Mt())}function qe(e,t){e.request.pacing.kind!=="max"&&!se(e)||t-e.lastProgressTime>=1e3&&(e.lastProgressTime=t,yi())}function Bt(){I&&(I=!1,self.postMessage({type:"backpressure",active:!1}))}function Sn(){I||(I=!0,self.postMessage({type:"backpressure",active:!0}))}function hr(){return We()?(_>=M&&Ne(),We()):!1}function xe(){D||$||C||self.requestAnimationFrame(nr)}function ge(e){let t=C;if(!t||t.pumpPending||D||$)return;let{token:r}=t;t.pumpPending=!0;let n=()=>{!C||C.token!==r||(C.pumpPending=!1,Ei(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?s.queue.onSubmittedWorkDone().then(n).catch(()=>{C?.token===r&&(C.pumpPending=!1)}):queueMicrotask(n)}function Sr(e,t){C&&k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),C={kind:e,request:t,token:++rn,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0},ge(t.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function J(){B&&Sr(br(),{pacing:Ci(),stopCondition:{kind:"none"}})}function k(e,t={}){let r=C;if(!r)return;C=null,rn++;let n=se(r),i=t.restore!==!1&&!!r.request.restoreAfterStop;i&&r.request.restoreAfterStop&&(B=r.request.restoreAfterStop.running,ee=r.request.restoreAfterStop.targetStepDuration),n&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?Bt():I&&Se(),t.render!==!1&&!D&&!$&&hn(),t.restartRestoredRun!==!1&&i&&B&&!D&&!$?J():xe()}function Yr(e){let t=C;!t||!se(t)||(t.request.restoreAfterStop&&(t.request.restoreAfterStop.running=e),k("cancelled"))}function _i(e){k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Sr(br(),e)}function yn(e,t,r){Sn(),qe(e,t),Et(t,r),ge("drain")}function vi(e,t){let r=hi(),n=Si(),i=!1;for(let o=0;o<n;o++){let a=Rt(e);if(a<=0)break;let c=Math.min(r,a);mn(c),i=!0}if(qe(e,t),Ke(e)){k("targetReached");return}ge(i?"drain":"raf")}function Pi(e,t){Le(!0);let r=!1,n=performance.now()+14;for(;Rt(e)>0&&performance.now()<n;){if(!hr()){yn(e,t,r);return}gr(),Ce++,r=!0,ze(P)}if(Bt(),qe(e,t),Et(t,r),Ke(e)){k("targetReached");return}ge("raf")}function Ri(e,t,r){e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=Math.floor(e.stepAccumulator/t),o=Math.min(i,Rt(e)),a=o>0;if(a&&(mn(o),e.stepAccumulator-=t*o),qe(e,r),Ke(e)){k("targetReached");return}se(e)||(re(),Et(r,a)),ge("raf")}function Mi(e,t,r){Le(!0),e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=!1;for(;e.stepAccumulator>=t&&Rt(e)>0;){if(!hr()){yn(e,r,i);return}gr(),Ce++,e.stepAccumulator-=t,i=!0,ze(P)}if(Bt(),qe(e,r),Ke(e)){k("targetReached");return}se(e)||(re(),Et(r,i)),ge("raf")}function Ei(e){let t=C;if(!t||D||$)return;if(gn(e),se(t)||mr(),Ke(t)){k("targetReached");return}if(t.request.pacing.kind==="max"){t.kind==="recording"?Pi(t,e):vi(t,e);return}let r=1e3/t.request.pacing.genPerSecond;t.kind==="recording"?Mi(t,r,e):Ri(t,r,e)}function nr(e){if(D||$){self.requestAnimationFrame(nr);return}gn(e),!C&&(mr(),ee>0&&!Be&&re(),self.requestAnimationFrame(nr))}function Bi(e,t){let r=s?_e():Number.POSITIVE_INFINITY;return Ir(t.bitsPerCell)&&Gt(t.bitsPerCell,e.tribes.length)&&Ft(e,Me(t.bitsPerCell),r)?Me(t.bitsPerCell):Lr(e.tribes.length,e,r)}function Xr(e,t){Ge=e,b=e.cols,h=e.rows,S=Bi(e,t),ir=ce(b,S),V=[...e.tribes],Y.gridFormat=oe(),ne.clear(),V.forEach((r,n)=>ne.set(r.id,n))}async function Cn(e){console.log("[GOLT worker] Initializing WebGPU"),pe=e,s=await Cr(f.webengineDevice),$=!1,s.lost.then(r=>{let n=r.message||r.reason||"unknown";console.error("[GOLT worker] GPU device lost:",n),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),$=!0,B=!1,D=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:_e(),vramBudgetBytes:an(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:oe()});let t=pe.getContext("webgpu");if(!t)throw new Error("WebGPU canvas context not available");Kt=t,at=navigator.gpu.getPreferredCanvasFormat(),Kt.configure({device:s,format:at,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:at,maxBufferSize:s.limits.maxBufferSize,maxStorageBufferBindingSize:s.limits.maxStorageBufferBindingSize})}async function Ti(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Cn(pe),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let t=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",t),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),$=!0,B=!1,D=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function _n(){L=s.createBuffer({label:f.recordingChunkBuffer,size:M*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ht(M*p,L),_=0,E=[],me=null}async function vn(){let e=M*p;Z=[],N=[];for(let t=0;t<_t;t++){let r=s.createBuffer({label:`${f.recordingStagingBuffer} ${t}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});Z.push(r),N.push(!0),await ht(e,r)}}async function ki(){await fn()}async function xi(){console.log("[GOLT worker] Building GPU resources",{cols:b,rows:h,bitsPerCell:S.bitsPerCell,recordingAvailable:U()}),Ht(),ln(),await jt(),Vt(),Zt(),Qt(),Jt(),tr(),er(),await ki(),U()?(await _n(),await vn()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:p,maxRecordingBufferBytes:$e()}),St(),T=!1,X=!1),await bt(),rr(),console.log("[GOLT worker] GPU resources ready")}async function Ai(){console.log("[GOLT worker] Rebuild started",{cols:b,rows:h,bitsPerCell:S.bitsPerCell}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),D=!0,self.postMessage({type:"rebuilding",active:!0});try{await ar()}catch{}if($&&!await Ti())return!1;$r(),Ht(),ln(),Nr(U());try{await jt(),Vt(),Zt(),Jt(),tr(),Qt(),er(),U()?(await _n(),await vn()):(St(),T=!1,X=!1),await bt(),rr()}catch(e){let t=e instanceof Error?e.message:String(e);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{$r(),Ht(),Nr(!1),await jt(),Vt(),Zt(),Jt(),tr(),Qt(),er(),T=!1,X=!1,p=Pt(),St(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await bt(),rr()}catch(r){return console.error("[GOLT worker] GPU rebuild recovery failed:",r),!1}}return D=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:U(),frameByteSize:p}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(console.log("[GOLT worker] Init message received",{cols:t.ruleset.cols,rows:t.ruleset.rows,recording:t.recording,running:t.running,speed:t.speed}),T=t.recording,Ue=Ot(t.liveMetrics),X=T,Xr(t.ruleset,t.simulationGridFormat),await Cn(t.canvas),await xi(),W)q=!0;else{let r=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(r),s.queue.submit([r.finish()]),fe()}ye(),B=t.running,ee=t.speed<0?0:1e3/t.speed,B?J():xe();break}case"setLiveMetrics":{Ue=Ot(t.liveMetrics),H=-1,Mt(!0);break}case"setRuleset":{if(console.log("[GOLT worker] Ruleset update received",{cols:t.ruleset.cols,rows:t.ruleset.rows,tribes:t.ruleset.tribes.length}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Xr(t.ruleset,t.simulationGridFormat),!await Ai())break;if(P=0,H=-1,await qr(0),B?J():xe(),W)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(n),s.queue.submit([n.finish()]),fe()}break}case"setRunning":if(B=t.running,t.running){C||J();break}C&&se(C)?Yr(!1):C?k("manual"):(I&&Se(),hn(),xe());break;case"setSpeed":{let r=ee<=0,n=t.speed<0?0:1e3/t.speed;ee=n,C&&!se(C)&&B?(k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&n>0?(Be=!0,s.queue.onSubmittedWorkDone().then(()=>{Be=!1,re(),J()})):J()):B&&!C?J():r&&n>0&&(Be=!0,s.queue.onSubmittedWorkDone().then(()=>{Be=!1,re(),xe()}));break}case"camera":Vr=t.scale,Zr=t.offsetX,Qr=t.offsetY;break;case"resize":pe.width=t.width,pe.height=t.height;break;case"draw":{let r=t.tribes.map(n=>ne.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};ut={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{ui().then(r=>{let n={type:"snapshot",grid:r,generation:P,cols:b,rows:h,gridFormat:oe()};self.postMessage(n,[r.buffer])}).catch(()=>{let r=new Uint32Array(0),n={type:"snapshot",grid:r,generation:P,cols:b,rows:h,gridFormat:oe()};self.postMessage(n,[r.buffer])});break}case"loadSnapshot":{let r=w?F:G,n=Dt(t.gridFormat),i=ue({cols:b,rows:h},n);if(t.grid.byteLength!==i)break;let o=Wt(t.grid,{cols:b,rows:h},n,S);s.queue.writeBuffer(r,0,o),P=t.generation,await qr(t.generation);break}case"setRecording":{let r=C?.request;if(t.recording&&U()&&!T){if(T=!0,X=!0,H=-1,W)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(n),s.queue.submit([n.finish()]),fe()}ye()}else(!t.recording||!U())&&(t.recording&&!U()&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:p,maxRecordingBufferBytes:$e()}),T=!1,X=!1);r&&C?_i(r):!C&&B&&J();break}case"getRecording":{if(Oe)break;await ar(),Le(!1),_>0&&Ne(),j>0?Oe=!0:yt();break}case"stepBack":{let r=0;for(let c of R)r+=c.blockCount;let n=r+_,i=Math.min(t.count,n-1);if(i<=0)break;let o=n-1-i,a=w?F:G;if(o>=r){let c=o-r;_=c+1,E.length=_,P=E[c],me=P;let l=s.createCommandEncoder({label:f.recordingRestoreCopyEncoder});l.copyBufferToBuffer(L,c*p,a,0,p),s.queue.submit([l.finish()])}else{if(j>0){await new Promise(g=>{let A=setInterval(()=>{j===0&&(clearInterval(A),g())},10)}),r=0;for(let g of R)r+=g.blockCount}let c=0,l=0,u=0;for(let g=0;g<R.length;g++){let A=R[g];if(o<c+A.blockCount){l=g,u=o-c;break}c+=A.blockCount}let y=R[l],d=await mi(y.filename,y.codec),m=Dt(y.gridFormat),v=ue({cols:b,rows:h},m);if(m.bitsPerCell===S.bitsPerCell){let g=(u+1)*p;s.queue.writeBuffer(L,0,new Uint8Array(d,0,g))}else{let g=new Uint8Array((u+1)*p);for(let A=0;A<=u;A++){let ae=A*v,Pn=new Uint8Array(d,ae,v),Tt=Wt(Gr(Pn),{cols:b,rows:h},m,S);g.set(new Uint8Array(Tt.buffer,Tt.byteOffset,Tt.byteLength),A*p)}s.queue.writeBuffer(L,0,g),s.queue.writeBuffer(a,0,g.subarray(u*p,(u+1)*p))}if(_=u+1,E=y.generations.slice(0,u+1),P=E[u],me=P,m.bitsPerCell===S.bitsPerCell){let g=s.createCommandEncoder({label:f.recordingRestoreCopyEncoder});g.copyBufferToBuffer(L,u*p,a,0,p),s.queue.submit([g.finish()])}let z=R.splice(l).map(g=>g.filename);fi(z)}if(fr(),ye(),H=-1,W)q=!0;else{let c=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(c),s.queue.submit([c.finish()]),fe()}re();break}case"stepForward":{if(mr(),t.count===1){Le(!0);let r=!T||hr();if(r?(gr(),Ce++,T&&We()&&(_>=M&&Ne(),ze(P))):Sn(),r&&Bt(),H=-1,W)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});de(n),s.queue.submit([n.finish()]),fe()}re()}else self.postMessage({type:"stepping",active:!0}),Le(!0),Sr(br(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:P+t.count},restoreAfterStop:{running:B,targetStepDuration:ee}});break}case"cancelStepping":{Yr(C?.request.restoreAfterStop?.running??B);break}case"updateChunkCodec":{let r=R.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,Y.chunks=[...R],ye(),yt());break}case"getUncompressedChunks":{let r=R.filter(n=>n.codec===vt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:b,rows:h,rawGridFormat:n.gridFormat,storageGridFormat:Ee(Ut(Ge.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
