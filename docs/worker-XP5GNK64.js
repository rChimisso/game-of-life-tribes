var f={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer"};var gr=4294967295;function Y(e,t){return e.includes(t)}function Bt(e,t){let r;return e?r=t?"ok":"tooLarge":r="disabled",r}function br(e,t,r,n){let i=e*t,o=i<=gr,c=i*2<=gr;return{population:Bt(r&&n.population,o),diversity:Bt(r&&n.diversity,o),interfaces:Bt(r&&n.interfaces,c)}}function hr(e){let t=[];return e.population==="ok"&&t.push("population"),e.diversity==="ok"&&t.push("diversity"),e.interfaces==="ok"&&t.push("interfaces"),t}var Re=256*Uint32Array.BYTES_PER_ELEMENT,Ee=Uint32Array.BYTES_PER_ELEMENT;function Sr(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function yr(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function Cr(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function Cn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${Sr(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${yr(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${Cr(i)}
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
`}function _n(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${Sr(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${yr(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${Cr(i)}
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
`}function _r(e){let{device:t}=e,r=t.createShaderModule({label:f.histogramMetricsShaderModule,code:Cn(e)}),n=t.createComputePipeline({label:f.histogramMetricsPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),i=t.createBuffer({label:f.histogramMetricsBuffer,size:Re,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=t.createBuffer({label:f.histogramMetricsReadBuffer,size:Re,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),c=t.createShaderModule({label:f.interfaceMetricsShaderModule,code:_n(e)}),a=t.createComputePipeline({label:f.interfaceMetricsPipeline,layout:"auto",compute:{module:c,entryPoint:"main"}}),u=t.createBuffer({label:f.interfaceMetricsBuffer,size:Ee,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),l=t.createBuffer({label:f.interfaceMetricsReadBuffer,size:Ee,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:a,boundaryBuffer:u,boundaryReadBuffer:l}}function vr(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function Pr(e){let{device:t,encoder:r,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:c}=e;if(Y(c,"population")||Y(c,"diversity")){let a=new Uint32Array(256);t.queue.writeBuffer(n.histogramBuffer,0,a);let u=t.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),l=r.beginComputePass({label:f.histogramMetricsPass});l.setPipeline(n.histogramPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),r.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Re)}if(Y(c,"interfaces")){let a=new Uint32Array([0]);t.queue.writeBuffer(n.boundaryBuffer,0,a);let u=t.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),l=r.beginComputePass({label:f.interfaceMetricsPass});l.setPipeline(n.boundaryPipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),l.end(),r.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Ee)}}async function Rr(e){let{resources:t,enabledSections:r}=e,n=Y(r,"population")||Y(r,"diversity"),i=Y(r,"interfaces"),o=[];n&&o.push(t.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(t.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let c=new Uint32Array(256);n&&(c=new Uint32Array(t.histogramReadBuffer.getMappedRange().slice(0)),t.histogramReadBuffer.unmap());let a=0;if(i){let u=new Uint32Array(t.boundaryReadBuffer.getMappedRange().slice(0));t.boundaryReadBuffer.unmap(),a=u[0]??0}return{histogram:c,crossStateContactEdges:a}}function vn(e,t){let{tribes:r,deadTribeIndex:n,readback:i,cols:o,rows:c}=e,a=o*c,u={};for(let _=0;_<r.length;_++){let d=t?i.histogram[_]??0:0;u[r[_].id]=d}let l=t?u[r[n]?.id??""]??0:0;return{population:u,aliveCells:t?Math.max(0,a-l):0,deadCells:l}}function Pn(e){let{tribes:t,deadTribeIndex:r,readback:n}=e,i=0;for(let o=0;o<t.length;o++)o!==r&&(i+=n.histogram[o]??0);return i}function Rn(e,t){let{tribes:r,deadTribeIndex:n,readback:i}=e,o=t?Pn(e):0,c=0,a=0;for(let u=0;u<r.length;u++){let l=u!==n&&o>0?(i.histogram[u]??0)/o:0;l>0&&(c-=l*Math.log2(l),a+=l*l)}return{shannonEntropy:c,simpsonSum:a}}function En(){return{}}function Bn(e,t){let r=e.cols*e.rows*2,n=t?e.readback.crossStateContactEdges:0,i=t?Math.max(0,r-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:t&&r>0?i/r:0,crossStateContactFraction:t&&r>0?n/r:0}}function Er(e){let{generation:t,enabledSections:r,availability:n,liveMetricSettings:i,cols:o,rows:c,totalFrames:a,fps:u,canStepBack:l,recordingBytes:_,recordingRawBytes:d}=e,m=Y(r,"population")&&i.population,E=Y(r,"diversity")&&i.diversity,T=Y(r,"interfaces")&&i.interfaces,q=o*c,g=vn(e,m),x=Rn(e,E),ce=Bn(e,T);return{type:"metrics",generation:t,population:g.population,aliveCells:g.aliveCells,deadCells:g.deadCells,occupancy:m&&q>0?g.aliveCells/q:0,shannonEntropy:x.shannonEntropy,simpsonIndex:E?1-x.simpsonSum:0,interfaces:ce,metricsAvailability:n,extinctionTime:En(),totalFrames:a,fps:u,canStepBack:l,recordingBytes:_,recordingRawBytes:d}}var Br=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var Mt=[1,2,4,8,16,32],kn={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Tn={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},xn={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Ye={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},An={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},kt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},Q={1:kn,2:Tn,4:xn,8:Ye,16:An,32:kt};var Be={population:!0,diversity:!0,interfaces:!1},Xe={enabled:!0,sections:Be};var Tt="any",He="dead";var je="empty",Ve="is",xt="comparison",Ze="count",Qe="none",Je="exactly",et="min",tt="max",rt="not",nt="and",it="or",ot="xor";function Mr(e){return Mt.includes(e)}function In(e){return 2**e}function At(e,t){return t<=In(e)}function It(e,t,r){return le(e,t)<=r}function wt(e){return e<=2?Q[1]:e<=4?Q[2]:e<=16?Q[4]:e<=256?Q[8]:e<=65536?Q[16]:Q[32]}function Me(e){return Q[e]}function kr(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of Mt){let i=Me(n);if(At(n,e)&&It(t,i,r))return i}return kt}function Lt(e){return Me(e?.bitsPerCell??8)}function ke(e){return{bitsPerCell:e.bitsPerCell}}function ue(e,t){return Math.ceil(e/t.cellsPerWord)}function le(e,t){return ue(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Tr(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function wn(e){return{population:typeof e?.population=="boolean"?e.population:Be.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Be.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Be.interfaces}}function Gt(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Xe.enabled,sections:wn(e?.sections)}}function xr(e,t,r,n,i){let o=ue(t.cols,r),c=e[i*o+(n>>r.wordShift)]??0;return Ln(c,r,n&r.cellIndexMask)}function Ar(e,t,r,n,i,o){let c=ue(t.cols,r),a=i*c+(n>>r.wordShift),u=(n&r.cellIndexMask)<<r.cellShift,l=~(r.cellMask<<u),_=e[a]??0;e[a]=(_&l|(o&r.cellMask)<<u)>>>0}function Ln(e,t,r){return t.bitsPerCell===32?e>>>0:e>>>(r<<t.cellShift)&t.cellMask}var Qi=32*1024*1024;function Ft(e,t,r,n){let i=e,o;if(r.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(le(t,n)/Uint32Array.BYTES_PER_ELEMENT);for(let c=0;c<t.rows;c++)for(let a=0;a<t.cols;a++)Ar(o,t,n,a,c,xr(i,t,r,a,c))}return o}var s,K=!1,Nt,at,me,Ue,S=0,y=0,tr=0,C=Ye,V=[],ne=new Map,St,$t,F,U,De,he,mt,$r,zr,we,rr,nr,L=!1,Kr=1,qr=0,Yr=0,M=!1,O=!1,ee=100,P=0,ct,Se,Xr,Hr,Un=0,ut=null,ie=null,j=-1,N=!1,X=!1,Ut=0,Oe=Xe,lt=[],A=!1,z=!1,I={chunks:[],generationStart:0,generationEnd:0,gridFormat:ke(Ye)},jr=0,h=[],v=null,Vr=0,Te=!1,G=null,b=0,B=[],oe=null,R=64,p=0,yt=3,Z=[],$=[],dt="gol-recording",Ct="raw-packed",Zr="deflate-raw",Le=null,de=null,H=0,ge=0,re=0,Ir=12,w=!1,xe=0,Qr=256,Dn=Qr*Uint32Array.BYTES_PER_ELEMENT,wr=256*1024*1024,On=512*1024*1024,Lr=128*1024*1024*1024,ft=0,pt=0,Ge=[];function Wn(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function Jr(e){console.error("[GOLT worker] Worker GPU error:",e),k("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),M=!1,self.postMessage({type:"gpuError",reason:Wn(e)})}self.addEventListener("error",e=>{e.preventDefault(),Jr(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),Jr(e.reason)});async function ir(){await s.queue.onSubmittedWorkDone()}function Gr(e){ft=0,pt=2+(e?1+yt:0),Ge=[]}async function gt(){if(Ge.length===0)return;let e=s.createCommandEncoder({label:f.trackedAllocationClearEncoder});for(let t of Ge)e.clearBuffer(t);s.queue.submit([e.finish()]),await ir(),Ge=[]}async function bt(e,t){!O||pt<=0||(ft+=e,pt--,Ge.push(t),ft>=Nn()&&pt>0&&(await gt(),ft=0))}function Nn(){return Math.min(Pe(),On)}function Pe(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function $e(){return Math.min(Pe(),1073741824)}function en(){return Math.max(Pe()*2,$e()*6)}function D(){return p>0&&p<=$e()}function $n(){return p<=0?0:p*2+sr+Dn+ar+Re*2+Ee*2}function zn(){return R<1||p<=0?0:R*p*(1+yt)}function ht(){G?.destroy(),G=null;for(let e of Z)e?.destroy();Z=[],$=[],R=0,b=0,B=[],oe=null,ge=0}function Fr(){F?.destroy(),U?.destroy(),vr(ie),ie=null,Se?.destroy(),ht()}function Dt(e){let t=H>0;H+=e;let r=H>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function ye(){if(R<1||Z.length===0){w&&(w=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=on(),t=!$.some(i=>i)&&b>=R,r=re>=e,n;if(w){let i=$.some(c=>c),o=re<=Math.floor(e/2);n=!(i&&o)}else n=t||r;n!==w&&(w=n,self.postMessage({type:"backpressure",active:n}))}async function Ce(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??Lr/128,Lr),r=e.usage??0,n=0,i=0;for(let a of h)a.codec===Ct?n+=a.storedBytes:i+=a.storedBytes;let o=R*p,c=A?(1+yt)*o:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:c})}var We=!1;async function Kn(e){let t=new DecompressionStream(Zr),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:u,value:l}=await i.read();if(u)break;n.push(l)}let o=0;for(let u of n)o+=u.byteLength;let c=new Uint8Array(o),a=0;for(let u of n)c.set(u,a),a+=u.byteLength;return c.buffer}var _e=0,st=0,or=0;function tn(e,t,r=s.limits.maxComputeWorkgroupsPerDimension){if(e<=r&&t<=r)return{logicalWgX:e,logicalWgY:t,dispatchWgX:e,dispatchWgY:t,remapped:!1};let n=e*t,i=Math.min(n,r),o=Math.ceil(n/i);if(o>r)throw new Error(`Grid requires ${e}x${t} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${r}.`);return{logicalWgX:e,logicalWgY:t,dispatchWgX:i,dispatchWgY:o,remapped:!0}}function qn(){return tn(Math.ceil(tr/16),Math.ceil(y/16))}function Yn(){return tn(Math.ceil(S/16),Math.ceil(y/16))}function Xn(e,t){t.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${t.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${t.dispatchWgX}u;`))}function Hn(e){e.push(`const CELLS_PER_WORD: u32 = ${C.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${C.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${C.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${C.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${C.cellMask}u;`)}function jn(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Vn(e,t,r){if(t.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${r} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${r} = gid.x;`),e.push("  let y = gid.y;")}function Zn(){let e=[],t=tr,r=St;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${V.map(d=>d.id).join(", ")}`),e.push(`// Rules: ${Ue.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${S}u;`),e.push(`const ROWS: u32 = ${y}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),Xn(e,r),Hn(e),e.push(""),jn(e,"gridIn","PACKED_COLS"),e.push("");let n=ne.get(He)??0,i=Ue.rules.filter(d=>!d.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let o=Jn(i.map(d=>d.clause)),c=new Map,a=0;for(let d of o){let m=`count_${a++}`;c.set(d,m)}for(let[d,m]of c){let E=d.split(",").map(Number),q=Ur().map(g=>`select(0u, 1u, ${E.map(ce=>`${g} == ${ce}u`).join(" || ")})`);e.push(`  let ${m} = ${q.join(" + ")};`)}o.size>0&&e.push("");let u=ei(i.map(d=>d.clause)),l=new Map,_=0;for(let d of u)if(c.has(d))l.set(d,c.get(d));else{let m=`eq_count_${_++}`;l.set(d,m)}for(let[d,m]of l){if(c.has(d))continue;let E=d.split(",").map(Number),q=Ur().map(g=>`select(0u, 1u, ${E.map(ce=>`${g} == ${ce}u`).join(" || ")})`);e.push(`  let ${m} = ${q.join(" + ")};`)}u.size>0&&_>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let d=0;d<i.length;d++){let m=i[d],E=Ae(m.clause,c,l),T=Qn(m.tribe);d===0?e.push(`  if (${E}) {`):e.push(`  } else if (${E}) {`),e.push(`    result = ${T}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),r.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),Vn(e,r,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let d=-1;d<=1;d++)for(let m=-1;m<=1;m++){if(m===0&&d===0)continue;let E=rn(m,d),T=Dr("x",m,"COLS"),q=Dr("y",d,"ROWS");e.push(`    let ${E} = readCell(${T}, ${q});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function rn(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function Ur(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(rn(r,t));return e}function Dr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function W(e){let t=[];for(let r of e)if(r===Tt)for(let n=0;n<V.length;n++)t.push(n);else{let n=ne.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function Qn(e){return e===Tt?0:ne.get(e)??0}function Jn(e){let t=new Set;for(let r of e)zt(r,t);return t}function zt(e,t){switch(e.kind){case je:case Ve:break;case Qe:case Je:case et:case tt:case Ze:{let r=W(e.tribes).sort();t.add(r.join(","));break}case rt:zt(e.clause,t);break;case nt:case it:case ot:for(let r of e.clauses)zt(r,t);break}}function ei(e){let t=new Set;for(let r of e)Kt(r,t);return t}function Kt(e,t){switch(e.kind){case je:case Ve:case Ze:case Qe:case Je:case et:case tt:break;case xt:{let r=W(e.tribe1).sort(),n=W(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case rt:Kt(e.clause,t);break;case nt:case it:case ot:for(let r of e.clauses)Kt(r,t);break}}function Ae(e,t,r){switch(e.kind){case je:return"false";case Ve:{let n=W(e.tribes);return n.length===0?"false":n.length===V.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case Ze:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case Qe:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case Je:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case et:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case tt:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case xt:{let n=r.get(W(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),o=`(i32(${r.get(W(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${o})`;case">":return`(i32(${n}) > ${o})`;case"<":return`(i32(${n}) < ${o})`;case"\u2265":return`(i32(${n}) >= ${o})`;case"\u2264":return`(i32(${n}) <= ${o})`;default:return`(i32(${n}) == ${o})`}}case rt:return`!(${Ae(e.clause,t,r)})`;case nt:return`(${e.clauses.map(i=>Ae(i,t,r)).join(" && ")})`;case it:return`(${e.clauses.map(i=>Ae(i,t,r)).join(" || ")})`;case ot:return`(((${e.clauses.map(o=>Ae(o,t,r)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var sr=48;function qt(){De?.destroy(),De=s.createBuffer({label:f.uniformBuffer,size:sr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function ti(){let e=new ArrayBuffer(sr),t=new Float32Array(e),r=new Uint32Array(e),n=(qr%S+S)%S,i=(Yr%y+y)%y,o=Math.floor(n),c=Math.floor(i);t[0]=me.width,t[1]=me.height,t[2]=Kr,t[4]=n-o,t[5]=i-c,r[6]=S,r[7]=y,r[8]=o,r[9]=c,r[10]=V.length,s.queue.writeBuffer(De,0,e)}function _t(){return le({cols:S,rows:y},C)}function se(){return ke(C)}async function Yt(){let e=_t();F=s.createBuffer({label:f.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await bt(e,F),U=s.createBuffer({label:f.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await bt(e,U);let t=s.createCommandEncoder({label:f.gridClearEncoder});t.clearBuffer(F),t.clearBuffer(U),s.queue.submit([t.finish()]),L=!1}function Xt(){let e=new Uint32Array(Qr);for(let t=0;t<V.length;t++){let r=V[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),o=parseInt(r.substring(4,6),16);e[t]=n|i<<8|o<<16}he&&he.destroy(),he=s.createBuffer({label:f.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(he,0,e)}function ri(){return Br.replace("__CELLS_PER_WORD__",`${C.cellsPerWord}u`).replace("__WORD_SHIFT__",`${C.wordShift}u`).replace("__CELL_SHIFT__",`${C.cellShift}u`).replace("__CELL_INDEX_MASK__",`${C.cellIndexMask}u`).replace("__CELL_MASK__",`${C.cellMask}u`)}function Ht(){let e=s.createShaderModule({label:f.renderShaderModule,code:ri()});mt=s.createRenderPipeline({label:f.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:at}]},primitive:{topology:"triangle-list"}})}function jt(){$r=s.createBindGroup({layout:mt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:De}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:he}}]}),zr=s.createBindGroup({layout:mt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:De}},{binding:1,resource:{buffer:U}},{binding:2,resource:{buffer:he}}]})}function Vt(){St=qn();let e=Zn(),t=s.createShaderModule({label:f.simulationShaderModule,code:e});we=s.createComputePipeline({label:f.simulationPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),rr=s.createBindGroup({layout:we.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:U}}]}),nr=s.createBindGroup({layout:we.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:F}}]})}function Zt(){$t=Yn(),ie=_r({device:s,cols:S,rows:y,gridFormat:C,dispatchPlan:$t})}var ar=176;function ni(){return`
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

const CELLS_PER_WORD: u32 = ${C.cellsPerWord}u;
const WORD_SHIFT: u32 = ${C.wordShift}u;
const CELL_SHIFT: u32 = ${C.cellShift}u;
const CELL_INDEX_MASK: u32 = ${C.cellIndexMask}u;
const CELL_MASK: u32 = ${C.cellMask}u;

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
`}function Qt(){let e=s.createShaderModule({label:f.brushShaderModule,code:ni()});ct=s.createComputePipeline({label:f.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),Se?.destroy(),Se=s.createBuffer({label:f.brushUniformBuffer,size:ar,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Xr=s.createBindGroup({layout:ct.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:Se}}]}),Hr=s.createBindGroup({layout:ct.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:Se}}]})}function ii(e,t,r,n,i,o,c){let a=ne.get(He)??0,u=Un++,l=new ArrayBuffer(ar),_=new Int32Array(l),d=new Uint32Array(l);_[0]=t,_[1]=r,d[2]=S,d[3]=y,d[4]=n,d[5]=i,d[6]=o,d[7]=a,d[8]=u,d[9]=c.length,d[10]=0;for(let T=0;T<c.length&&T<32;T++)d[11+T]=c[T];s.queue.writeBuffer(Se,0,l);let m=Math.ceil(n/8),E=e.beginComputePass({label:f.brushPass});E.setPipeline(ct),E.setBindGroup(0,L?Hr:Xr),E.dispatchWorkgroups(m,m),E.end()}function oi(){let e=L?U:F,t=_t(),r;try{r=s.createBuffer({label:f.gridReadbackBuffer,size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder({label:f.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function nn(){if(p=_t(),!D()){R=0;return}let e=si();R=Math.max(1,Math.floor(e/p))}function si(){return p>=wr?p:Math.min(Math.max(wr,p),$e())}function on(){if(R<1||p<=0)return Ir;let e=Math.max(p,R*p),t=Math.floor(536870912/e);return Math.max(1,Math.min(Ir,t||1))}function Jt(){let e=D();self.postMessage({type:"limits",maxBytes:Pe(),vramBudgetBytes:en(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:$n(),vramRecordingBytes:zn(),gridFormat:se()})}function ve(){return!D()||R<1||G===null||Z.length===0||re>=on()?!1:b<R?!0:Z.some((e,t)=>$[t]&&e.mapState==="unmapped")}function ze(e){if(R<1||G===null||b>=R)return;let t=L?U:F,r=b*p,n=s.createCommandEncoder({label:f.recordingFrameCopyEncoder});n.copyBufferToBuffer(t,0,G,r,p),s.queue.submit([n.finish()]),B.push(e),oe=e,b++}function Ot(e){ge=Math.max(0,ge+e)}function Wt(){R>0&&b>=R&&ve()&&Ne()}function Ne(){if(G===null||b===0||Z.length===0)return;let e=$.indexOf(!0);if(e<0)return;$[e]=!1;let t=Z[e];if(t.mapState!=="unmapped"){$[e]=!0;return}let r=b*p,n=jr++,i=[...B],o=i[0],c=i[i.length-1],a=`chunk-${String(n).padStart(6,"0")}.bin`,u=b,l=s.createCommandEncoder({label:f.recordingSealCopyEncoder});l.copyBufferToBuffer(G,0,t,0,r),s.queue.submit([l.finish()]);let _={chunkId:n,generationStart:o,generationEnd:c,blockCount:u,codec:Ct,uncompressedBytes:r,storedBytes:r,gridFormat:se(),generations:i,filename:a};Dt(1),Ot(u),re++,ye();let d=xe;t.mapAsync(GPUMapMode.READ).then(async()=>{let m=t.getMappedRange(),E=new ArrayBuffer(r);new Uint8Array(E).set(new Uint8Array(m,0,r)),t.unmap(),d===xe&&($[e]=!0,h.push(_),Ot(-u),cr(),ye(),Wt(),ai(_,E).then(()=>{d===xe&&(re--,ye(),Dt(-1),Ce(),Pt(!0),Wt(),self.postMessage({type:"chunkSealed",filename:_.filename,rawBytes:r,blockCount:_.blockCount,cols:S,rows:y,rawGridFormat:_.gridFormat,storageGridFormat:ke(wt(Ue.tribes.length))}),We&&H===0&&(We=!1,an()))}))}).catch(()=>{d===xe&&($[e]=!0,re--,Ot(-u),ye(),Dt(-1),Wt())}),b=0,B=[]}function cr(){h.length>0&&(I.generationStart=h[0].generationStart,I.generationEnd=h[h.length-1].generationEnd),B.length>0&&(h.length===0&&(I.generationStart=B[0]),I.generationEnd=B[B.length-1]),I.chunks=[...h]}async function Or(e){xe++,jr=0,b=0,B=[],h=[],oe=null,ge=0,re=0,H>0&&(H=0,self.postMessage({type:"chunksSaving",active:!1})),w&&(w=!1,self.postMessage({type:"backpressure",active:!1})),We=!1,z=A,I={chunks:[],generationStart:e,generationEnd:e,gridFormat:se()},await sn(),Ce()}async function ur(){return de&&await de,Le||(Le=await(await navigator.storage.getDirectory()).getDirectoryHandle(dt,{create:!0})),Le}async function ai(e,t){let i=await(await(await ur()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function ci(e){let t=await ur();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function sn(){if(de){await de;return}de=(async()=>{let e=await navigator.storage.getDirectory();Le=null;try{await e.removeEntry(dt,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${dt}:`,t)}Le=await e.getDirectoryHandle(dt,{create:!0})})();try{await de}finally{de=null}}function an(){cr(),console.log("[GOLT worker] Recording manifest diagnostics",cn("manifest")),self.postMessage({type:"recording",manifest:{chunks:h.map(e=>({...e,generations:[...e.generations]})),generationStart:I.generationStart,generationEnd:I.generationEnd,gridFormat:se()},cols:S,rows:y})}function ui(){return oe!==P}function Fe(e=!1){if(A){if(e){if(z){if(!ve())return;z=!1}}else if(z)return;!ui()||!ve()||(b>=R&&Ne(),ze(P))}}function lr(){if(!ut)return;let e=ut;ut=null;let t=s.createCommandEncoder({label:f.brushEncoder});ii(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),A&&b>0&&B[b-1]===P&&(b--,B.pop(),ze(P))}async function li(e,t=Ct){let o=await(await(await(await ur()).getFileHandle(e)).getFile()).arrayBuffer();return t===Zr?Kn(o):o}function di(){let e=b+ge;for(let t of h)e+=t.blockCount;return e}function cn(e){let t=h.reduce((a,u)=>a+u.blockCount,0),r=h.reduce((a,u)=>a+u.generations.length,0),n=B.length,i=t+b+ge,o=I.generationEnd>=I.generationStart?I.generationEnd-I.generationStart+1:0,c=h.slice(-16).map(a=>({chunkId:a.chunkId,filename:a.filename,blockCount:a.blockCount,generationCount:a.generations.length,generationStart:a.generationStart,generationEnd:a.generationEnd,uncompressedBytes:a.uncompressedBytes,storedBytes:a.storedBytes,codec:a.codec}));return{source:e,generationCounter:P,liveTotalFrames:i,manifestGenerationSpanFrames:o,sealedChunkCount:h.length,sealedBlockCount:t,sealedGenerationCount:r,currentChunkFrameIndex:b,currentChunkGenerationCount:n,inflightSealFrames:ge,inflightSeals:H,pendingOpfsWrites:re,chunkFrameCapacity:R,latestRecordedGeneration:oe,recordingAwaitingForward:z,backpressureActive:w,currentChunkGenerations:[...B],recentSealedChunks:c}}function un(){return br(S,y,Oe.enabled,Oe.sections)}function fi(){return hr(un())}function fe(e){lt=fi(),ie&&lt.length!==0&&Pr({device:s,encoder:e,resources:ie,sourceBuffer:L?U:F,dispatchPlan:$t,enabledSections:lt})}function pe(){let e=P;if(!ie||e===j||N)return;let t=ie,r=[...lt],n=un();j=e,N=!0,Rr({resources:t,enabledSections:r}).then(i=>{let o=ne.get(He)??0,c=di();console.log("[GOLT worker] Recording live counter diagnostics",cn("metrics"));let a=Er({generation:e,tribes:V,deadTribeIndex:o,readback:i,enabledSections:r,availability:n,liveMetricSettings:Oe.sections,cols:S,rows:y,totalFrames:c,fps:or,canStepBack:c>1,recordingBytes:h.reduce((u,l)=>u+l.storedBytes,0),recordingRawBytes:h.reduce((u,l)=>u+l.uncompressedBytes,0)});if(N=!1,self.postMessage(a),X)if(X=!1,j=-1,fn()){let u=s.createCommandEncoder({label:f.interactiveMetricsEncoder});fe(u),s.queue.submit([u.finish()]),pe()}else X=!0}).catch(()=>{N=!1})}function pi(){let e=S*y;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function mi(){let e=S*y;return e>1e7?2:e>1e6?4:e>1e5?8:16}function ln(e){if(e<=0)return;let t=St,r=s.createCommandEncoder({label:f.simulationBatchEncoder});for(let n=0;n<e;n++){let i=r.beginComputePass({label:f.simulationStepPass});i.setPipeline(we),i.setBindGroup(0,L?nr:rr),i.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),i.end(),L=!L,P++}s.queue.submit([r.finish()]),_e+=e}function gi(){self.postMessage({type:"generation",generation:P,fps:or})}function dr(){let e=s.createCommandEncoder({label:f.simulationSingleStepEncoder}),t=e.beginComputePass({label:f.simulationStepPass});t.setPipeline(we),t.setBindGroup(0,L?nr:rr);let r=St;t.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),t.end(),s.queue.submit([e.finish()]),L=!L,P++}function te(){ti();let e=Nt.getCurrentTexture().createView(),t=s.createCommandEncoder({label:f.renderEncoder}),r=t.beginRenderPass({label:f.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(mt),r.setBindGroup(0,L?zr:$r),r.draw(3),r.end(),s.queue.submit([t.finish()])}function dn(e){st===0&&(st=e);let t=e-st;t>=1e3&&(or=_e/(t/1e3),_e=0,st=e)}function fr(){return A&&D()?"recording":"nonRecording"}function bi(){return ee<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/ee}}function ae(e){return e.request.stopCondition.kind==="targetGeneration"}function Ke(e){return e.request.stopCondition.kind==="targetGeneration"&&P>=e.request.stopCondition.generation}function vt(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-P)}function fn(){return!!(s&&ie&&!O&&!K)}function Pt(e=!1){if(e&&(j=-1),!fn())X=!0;else if(N)X=!0;else{let t=s.createCommandEncoder({label:f.interactiveMetricsEncoder});fe(t),s.queue.submit([t.finish()]),pe()}}function pn(){Pt(!0),te()}function Rt(e,t){if(!t)return;(e-Ut>=1e3||Ut===0)&&!N&&(Ut=e,Pt())}function qe(e,t){e.request.pacing.kind!=="max"&&!ae(e)||t-e.lastProgressTime>=1e3&&(e.lastProgressTime=t,gi())}function pr(){w&&(w=!1,self.postMessage({type:"backpressure",active:!1}))}function hi(){w||(w=!0,self.postMessage({type:"backpressure",active:!0}))}function mn(){return ve()?(b>=R&&Ne(),ve()):!1}function Ie(){O||K||v||self.requestAnimationFrame(er)}function be(e){let t=v;if(!t||t.pumpPending||O||K)return;let{token:r}=t;t.pumpPending=!0;let n=()=>{!v||v.token!==r||(v.pumpPending=!1,Pi(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?s.queue.onSubmittedWorkDone().then(n).catch(()=>{v?.token===r&&(v.pumpPending=!1)}):queueMicrotask(n)}function mr(e,t){v&&k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),v={kind:e,request:t,token:++Vr,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0},be(t.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function J(){M&&mr(fr(),{pacing:bi(),stopCondition:{kind:"none"}})}function k(e,t={}){let r=v;if(!r)return;v=null,Vr++;let n=ae(r),i=t.restore!==!1&&!!r.request.restoreAfterStop;i&&r.request.restoreAfterStop&&(M=r.request.restoreAfterStop.running,ee=r.request.restoreAfterStop.targetStepDuration),n&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?pr():w&&ye(),t.render!==!1&&!O&&!K&&pn(),t.restartRestoredRun!==!1&&i&&M&&!O&&!K?J():Ie()}function Wr(e){let t=v;!t||!ae(t)||(t.request.restoreAfterStop&&(t.request.restoreAfterStop.running=e),k("cancelled"))}function Si(e){k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),mr(fr(),e)}function gn(e,t,r){hi(),qe(e,t),Rt(t,r),be("drain")}function yi(e,t){let r=pi(),n=mi(),i=!1;for(let o=0;o<n;o++){let c=vt(e);if(c<=0)break;let a=Math.min(r,c);ln(a),i=!0}if(qe(e,t),Ke(e)){k("targetReached");return}be(i?"drain":"raf")}function Ci(e,t){Fe(!0);let r=!1,n=performance.now()+14;for(;vt(e)>0&&performance.now()<n;){if(!mn()){gn(e,t,r);return}dr(),_e++,r=!0,ze(P)}if(pr(),qe(e,t),Rt(t,r),Ke(e)){k("targetReached");return}be("raf")}function _i(e,t,r){e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=Math.floor(e.stepAccumulator/t),o=Math.min(i,vt(e)),c=o>0;if(c&&(ln(o),e.stepAccumulator-=t*o),qe(e,r),Ke(e)){k("targetReached");return}ae(e)||(te(),Rt(r,c)),be("raf")}function vi(e,t,r){Fe(!0),e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=!1;for(;e.stepAccumulator>=t&&vt(e)>0;){if(!mn()){gn(e,r,i);return}dr(),_e++,e.stepAccumulator-=t,i=!0,ze(P)}if(pr(),qe(e,r),Ke(e)){k("targetReached");return}ae(e)||(te(),Rt(r,i)),be("raf")}function Pi(e){let t=v;if(!t||O||K)return;if(dn(e),ae(t)||lr(),Ke(t)){k("targetReached");return}if(t.request.pacing.kind==="max"){t.kind==="recording"?Ci(t,e):yi(t,e);return}let r=1e3/t.request.pacing.genPerSecond;t.kind==="recording"?vi(t,r,e):_i(t,r,e)}function er(e){if(O||K){self.requestAnimationFrame(er);return}dn(e),!v&&(lr(),ee>0&&!Te&&te(),self.requestAnimationFrame(er))}function Ri(e,t){let r=s?Pe():Number.POSITIVE_INFINITY;return Mr(t.bitsPerCell)&&At(t.bitsPerCell,e.tribes.length)&&It(e,Me(t.bitsPerCell),r)?Me(t.bitsPerCell):kr(e.tribes.length,e,r)}function Nr(e,t){Ue=e,S=e.cols,y=e.rows,C=Ri(e,t),tr=ue(S,C),V=[...e.tribes],I.gridFormat=se(),ne.clear(),V.forEach((r,n)=>ne.set(r.id,n))}async function bn(e){console.log("[GOLT worker] Initializing WebGPU"),me=e;let t=await navigator.gpu.requestAdapter();if(!t)throw console.error("[GOLT worker] WebGPU adapter not available"),new Error("WebGPU adapter not available");s=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),K=!1,s.lost.then(n=>{let i=n.message||n.reason||"unknown";console.error("[GOLT worker] GPU device lost:",i),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),K=!0,M=!1,O=!0,self.postMessage({type:"deviceLost",reason:i})}),self.postMessage({type:"limits",maxBytes:Pe(),vramBudgetBytes:en(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:se()});let r=me.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");Nt=r,at=navigator.gpu.getPreferredCanvasFormat(),Nt.configure({device:s,format:at,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:at,maxBufferSize:s.limits.maxBufferSize,maxStorageBufferBindingSize:s.limits.maxStorageBufferBindingSize})}async function Ei(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await bn(me),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let t=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",t),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),K=!0,M=!1,O=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function hn(){G=s.createBuffer({label:f.recordingChunkBuffer,size:R*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await bt(R*p,G),b=0,B=[],oe=null}async function Sn(){let e=R*p;Z=[],$=[];for(let t=0;t<yt;t++){let r=s.createBuffer({label:`${f.recordingStagingBuffer} ${t}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});Z.push(r),$.push(!0),await bt(e,r)}}async function Bi(){await sn()}async function Mi(){console.log("[GOLT worker] Building GPU resources",{cols:S,rows:y,bitsPerCell:C.bitsPerCell,recordingAvailable:D()}),qt(),nn(),await Yt(),Xt(),Ht(),jt(),Vt(),Qt(),Zt(),await Bi(),D()?(await hn(),await Sn()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:p,maxRecordingBufferBytes:$e()}),ht(),A=!1,z=!1),await gt(),Jt(),console.log("[GOLT worker] GPU resources ready")}async function ki(){console.log("[GOLT worker] Rebuild started",{cols:S,rows:y,bitsPerCell:C.bitsPerCell}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),O=!0,self.postMessage({type:"rebuilding",active:!0});try{await ir()}catch{}if(K&&!await Ei())return!1;Fr(),qt(),nn(),Gr(D());try{await Yt(),Xt(),Ht(),Vt(),Qt(),jt(),Zt(),D()?(await hn(),await Sn()):(ht(),A=!1,z=!1),await gt(),Jt()}catch(e){let t=e instanceof Error?e.message:String(e);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{Fr(),qt(),Gr(!1),await Yt(),Xt(),Ht(),Vt(),Qt(),jt(),Zt(),A=!1,z=!1,p=_t(),ht(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await gt(),Jt()}catch(r){return console.error("[GOLT worker] GPU rebuild recovery failed:",r),!1}}return O=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:D(),frameByteSize:p}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(console.log("[GOLT worker] Init message received",{cols:t.ruleset.cols,rows:t.ruleset.rows,recording:t.recording,running:t.running,speed:t.speed}),A=t.recording,Oe=Gt(t.liveMetrics),z=A,Nr(t.ruleset,t.simulationGridFormat),await bn(t.canvas),await Mi(),N)X=!0;else{let r=s.createCommandEncoder({label:f.interactiveMetricsEncoder});fe(r),s.queue.submit([r.finish()]),pe()}Ce(),M=t.running,ee=t.speed<0?0:1e3/t.speed,M?J():Ie();break}case"setLiveMetrics":{Oe=Gt(t.liveMetrics),j=-1,Pt(!0);break}case"setRuleset":{if(console.log("[GOLT worker] Ruleset update received",{cols:t.ruleset.cols,rows:t.ruleset.rows,tribes:t.ruleset.tribes.length}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Nr(t.ruleset,t.simulationGridFormat),!await ki())break;if(P=0,j=-1,await Or(0),M?J():Ie(),N)X=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});fe(n),s.queue.submit([n.finish()]),pe()}break}case"setRunning":if(M=t.running,t.running){v||J();break}v&&ae(v)?Wr(!1):v?k("manual"):(w&&ye(),pn(),Ie());break;case"setSpeed":{let r=ee<=0,n=t.speed<0?0:1e3/t.speed;ee=n,v&&!ae(v)&&M?(k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&n>0?(Te=!0,s.queue.onSubmittedWorkDone().then(()=>{Te=!1,te(),J()})):J()):M&&!v?J():r&&n>0&&(Te=!0,s.queue.onSubmittedWorkDone().then(()=>{Te=!1,te(),Ie()}));break}case"camera":Kr=t.scale,qr=t.offsetX,Yr=t.offsetY;break;case"resize":me.width=t.width,me.height=t.height;break;case"draw":{let r=t.tribes.map(n=>ne.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};ut={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{oi().then(r=>{let n={type:"snapshot",grid:r,generation:P,cols:S,rows:y,gridFormat:se()};self.postMessage(n,[r.buffer])}).catch(()=>{let r=new Uint32Array(0),n={type:"snapshot",grid:r,generation:P,cols:S,rows:y,gridFormat:se()};self.postMessage(n,[r.buffer])});break}case"loadSnapshot":{let r=L?U:F,n=Lt(t.gridFormat),i=le({cols:S,rows:y},n);if(t.grid.byteLength!==i)break;let o=Ft(t.grid,{cols:S,rows:y},n,C);s.queue.writeBuffer(r,0,o),P=t.generation,await Or(t.generation);break}case"setRecording":{let r=v?.request;if(t.recording&&D()&&!A){if(A=!0,z=!0,j=-1,N)X=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});fe(n),s.queue.submit([n.finish()]),pe()}Ce()}else(!t.recording||!D())&&(t.recording&&!D()&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:p,maxRecordingBufferBytes:$e()}),A=!1,z=!1);r&&v?Si(r):!v&&M&&J();break}case"getRecording":{if(We)break;await ir(),Fe(!1),b>0&&Ne(),H>0?We=!0:an();break}case"stepBack":{let r=0;for(let a of h)r+=a.blockCount;let n=r+b,i=Math.min(t.count,n-1);if(i<=0)break;let o=n-1-i,c=L?U:F;if(o>=r){let a=o-r;b=a+1,B.length=b,P=B[a],oe=P;let u=s.createCommandEncoder({label:f.recordingRestoreCopyEncoder});u.copyBufferToBuffer(G,a*p,c,0,p),s.queue.submit([u.finish()])}else{if(H>0){await new Promise(g=>{let x=setInterval(()=>{H===0&&(clearInterval(x),g())},10)}),r=0;for(let g of h)r+=g.blockCount}let a=0,u=0,l=0;for(let g=0;g<h.length;g++){let x=h[g];if(o<a+x.blockCount){u=g,l=o-a;break}a+=x.blockCount}let _=h[u],d=await li(_.filename,_.codec),m=Lt(_.gridFormat),E=le({cols:S,rows:y},m);if(m.bitsPerCell===C.bitsPerCell){let g=(l+1)*p;s.queue.writeBuffer(G,0,new Uint8Array(d,0,g))}else{let g=new Uint8Array((l+1)*p);for(let x=0;x<=l;x++){let ce=x*E,yn=new Uint8Array(d,ce,E),Et=Ft(Tr(yn),{cols:S,rows:y},m,C);g.set(new Uint8Array(Et.buffer,Et.byteOffset,Et.byteLength),x*p)}s.queue.writeBuffer(G,0,g),s.queue.writeBuffer(c,0,g.subarray(l*p,(l+1)*p))}if(b=l+1,B=_.generations.slice(0,l+1),P=B[l],oe=P,m.bitsPerCell===C.bitsPerCell){let g=s.createCommandEncoder({label:f.recordingRestoreCopyEncoder});g.copyBufferToBuffer(G,l*p,c,0,p),s.queue.submit([g.finish()])}let q=h.splice(u).map(g=>g.filename);ci(q)}if(cr(),Ce(),j=-1,N)X=!0;else{let a=s.createCommandEncoder({label:f.interactiveMetricsEncoder});fe(a),s.queue.submit([a.finish()]),pe()}te();break}case"stepForward":{if(lr(),t.count===1){if(Fe(!0),dr(),_e++,A&&ve()&&(b>=R&&Ne(),ze(P)),j=-1,N)X=!0;else{let r=s.createCommandEncoder({label:f.interactiveMetricsEncoder});fe(r),s.queue.submit([r.finish()]),pe()}te()}else self.postMessage({type:"stepping",active:!0}),Fe(!0),mr(fr(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:P+t.count},restoreAfterStop:{running:M,targetStepDuration:ee}});break}case"cancelStepping":{Wr(v?.request.restoreAfterStop?.running??M);break}case"updateChunkCodec":{let r=h.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,I.chunks=[...h],Ce());break}case"getUncompressedChunks":{let r=h.filter(n=>n.codec===Ct).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:S,rows:y,rawGridFormat:n.gridFormat,storageGridFormat:ke(wt(Ue.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
