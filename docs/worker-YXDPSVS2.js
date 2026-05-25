var f={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer"};var mr=4294967295;function K(e,t){return e.includes(t)}function Et(e,t){let r;return e?r=t?"ok":"tooLarge":r="disabled",r}function gr(e,t,r,n){let i=e*t,o=i<=mr,a=i*2<=mr;return{population:Et(r&&n.population,o),diversity:Et(r&&n.diversity,o),interfaces:Et(r&&n.interfaces,a)}}function br(e){let t=[];return e.population==="ok"&&t.push("population"),e.diversity==="ok"&&t.push("diversity"),e.interfaces==="ok"&&t.push("interfaces"),t}var ve=256*Uint32Array.BYTES_PER_ELEMENT,Pe=Uint32Array.BYTES_PER_ELEMENT;function hr(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function Sr(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function yr(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function Sn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${hr(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Sr(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${yr(i)}
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
`}function yn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${hr(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Sr(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${yr(i)}
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
`}function Cr(e){let{device:t}=e,r=t.createShaderModule({label:f.histogramMetricsShaderModule,code:Sn(e)}),n=t.createComputePipeline({label:f.histogramMetricsPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),i=t.createBuffer({label:f.histogramMetricsBuffer,size:ve,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=t.createBuffer({label:f.histogramMetricsReadBuffer,size:ve,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),a=t.createShaderModule({label:f.interfaceMetricsShaderModule,code:yn(e)}),c=t.createComputePipeline({label:f.interfaceMetricsPipeline,layout:"auto",compute:{module:a,entryPoint:"main"}}),l=t.createBuffer({label:f.interfaceMetricsBuffer,size:Pe,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),u=t.createBuffer({label:f.interfaceMetricsReadBuffer,size:Pe,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:c,boundaryBuffer:l,boundaryReadBuffer:u}}function _r(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function vr(e){let{device:t,encoder:r,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:a}=e;if(K(a,"population")||K(a,"diversity")){let c=new Uint32Array(256);t.queue.writeBuffer(n.histogramBuffer,0,c);let l=t.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),u=r.beginComputePass({label:f.histogramMetricsPass});u.setPipeline(n.histogramPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),u.end(),r.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,ve)}if(K(a,"interfaces")){let c=new Uint32Array([0]);t.queue.writeBuffer(n.boundaryBuffer,0,c);let l=t.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),u=r.beginComputePass({label:f.interfaceMetricsPass});u.setPipeline(n.boundaryPipeline),u.setBindGroup(0,l),u.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),u.end(),r.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Pe)}}async function Pr(e){let{resources:t,enabledSections:r}=e,n=K(r,"population")||K(r,"diversity"),i=K(r,"interfaces"),o=[];n&&o.push(t.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(t.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let a=new Uint32Array(256);n&&(a=new Uint32Array(t.histogramReadBuffer.getMappedRange().slice(0)),t.histogramReadBuffer.unmap());let c=0;if(i){let l=new Uint32Array(t.boundaryReadBuffer.getMappedRange().slice(0));t.boundaryReadBuffer.unmap(),c=l[0]??0}return{histogram:a,crossStateContactEdges:c}}function Cn(e,t){let{tribes:r,deadTribeIndex:n,readback:i,cols:o,rows:a}=e,c=o*a,l={};for(let C=0;C<r.length;C++){let d=t?i.histogram[C]??0:0;l[r[C].id]=d}let u=t?l[r[n]?.id??""]??0:0;return{population:l,aliveCells:t?Math.max(0,c-u):0,deadCells:u}}function _n(e){let{tribes:t,deadTribeIndex:r,readback:n}=e,i=0;for(let o=0;o<t.length;o++)o!==r&&(i+=n.histogram[o]??0);return i}function vn(e,t){let{tribes:r,deadTribeIndex:n,readback:i}=e,o=t?_n(e):0,a=0,c=0;for(let l=0;l<r.length;l++){let u=l!==n&&o>0?(i.histogram[l]??0)/o:0;u>0&&(a-=u*Math.log2(u),c+=u*u)}return{shannonEntropy:a,simpsonSum:c}}function Pn(){return{}}function Rn(e,t){let r=e.cols*e.rows*2,n=t?e.readback.crossStateContactEdges:0,i=t?Math.max(0,r-n):0;return{sameStateContactEdges:i,crossStateContactEdges:n,sameStateContactFraction:t&&r>0?i/r:0,crossStateContactFraction:t&&r>0?n/r:0}}function Rr(e){let{generation:t,enabledSections:r,availability:n,liveMetricSettings:i,cols:o,rows:a,totalFrames:c,fps:l,canStepBack:u,recordingBytes:C,recordingRawBytes:d}=e,m=K(r,"population")&&i.population,P=K(r,"diversity")&&i.diversity,k=K(r,"interfaces")&&i.interfaces,z=o*a,g=Cn(e,m),x=vn(e,P),se=Rn(e,k);return{type:"metrics",generation:t,population:g.population,aliveCells:g.aliveCells,deadCells:g.deadCells,occupancy:m&&z>0?g.aliveCells/z:0,shannonEntropy:x.shannonEntropy,simpsonIndex:P?1-x.simpsonSum:0,interfaces:se,metricsAvailability:n,extinctionTime:Pn(),totalFrames:c,fps:l,canStepBack:u,recordingBytes:C,recordingRawBytes:d}}var Er=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var Mt=[1,2,4,8,16,32],Mn={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Bn={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Tn={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},qe={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},kn={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},Bt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},Q={1:Mn,2:Bn,4:Tn,8:qe,16:kn,32:Bt};var Re={population:!0,diversity:!0,interfaces:!1},Ye={enabled:!0,sections:Re};var Tt="any",Xe="dead";var He="empty",je="is",kt="comparison",Ve="count",Ze="none",Qe="exactly",Je="min",et="max",tt="not",rt="and",nt="or",it="xor";function Mr(e){return Mt.includes(e)}function xn(e){return 2**e}function xt(e,t){return t<=xn(e)}function At(e,t,r){return ce(e,t)<=r}function It(e){return e<=2?Q[1]:e<=4?Q[2]:e<=16?Q[4]:e<=256?Q[8]:e<=65536?Q[16]:Q[32]}function Ee(e){return Q[e]}function Br(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of Mt){let i=Ee(n);if(xt(n,e)&&At(t,i,r))return i}return Bt}function wt(e){return Ee(e?.bitsPerCell??8)}function Me(e){return{bitsPerCell:e.bitsPerCell}}function ae(e,t){return Math.ceil(e/t.cellsPerWord)}function ce(e,t){return ae(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Tr(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function An(e){return{population:typeof e?.population=="boolean"?e.population:Re.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Re.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Re.interfaces}}function Lt(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Ye.enabled,sections:An(e?.sections)}}function kr(e,t,r,n,i){let o=ae(t.cols,r);return(e[i*o+(n>>r.wordShift)]??0)>>>((n&r.cellIndexMask)<<r.cellShift)&r.cellMask}function xr(e,t,r,n,i,o){let a=ae(t.cols,r),c=i*a+(n>>r.wordShift),l=(n&r.cellIndexMask)<<r.cellShift,u=~(r.cellMask<<l),C=e[c]??0;e[c]=(C&u|(o&r.cellMask)<<l)>>>0}var ji=32*1024*1024;function Gt(e,t,r,n){let i=e,o;if(r.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(ce(t,n)/Uint32Array.BYTES_PER_ELEMENT);for(let a=0;a<t.rows;a++)for(let c=0;c<t.cols;c++)xr(o,t,n,c,a,kr(i,t,r,c,a))}return o}var s,$=!1,Nt,st,pe,Ge,h=0,S=0,er=0,y=qe,V=[],re=new Map,ht,Wt,G,F,Fe,ge,pt,Wr,$r,Ae,tr,rr,I=!1,zr=1,Kr=0,qr=0,B=!1,D=!1,ee=100,E=0,at,be,Yr,Xr,Ln=0,ct=null,ne=null,H=-1,N=!1,q=!1,Ft=0,Ue=Ye,ut=[],A=!1,X=!1,Y={chunks:[],generationStart:0,generationEnd:0,gridFormat:Me(qe)},Hr=0,v=[],_=null,jr=0,Be=!1,L=null,b=0,M=[],R=64,p=0,St=3,Z=[],W=[],lt="gol-recording",yt="raw-packed",Vr="deflate-raw",Ie=null,ue=null,j=0,De=0,fe=0,Ar=12,w=!1,Te=0,Zr=256,Gn=Zr*Uint32Array.BYTES_PER_ELEMENT,Ir=256*1024*1024,Fn=512*1024*1024,wr=128*1024*1024*1024,dt=0,ft=0,we=[];function Un(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function Qr(e){console.error("[GOLT worker] Worker GPU error:",e),T("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),B=!1,self.postMessage({type:"gpuError",reason:Un(e)})}self.addEventListener("error",e=>{e.preventDefault(),Qr(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),Qr(e.reason)});async function nr(){await s.queue.onSubmittedWorkDone()}function Lr(e){dt=0,ft=2+(e?1+St:0),we=[]}async function mt(){if(we.length===0)return;let e=s.createCommandEncoder({label:f.trackedAllocationClearEncoder});for(let t of we)e.clearBuffer(t);s.queue.submit([e.finish()]),await nr(),we=[]}async function gt(e,t){!D||ft<=0||(dt+=e,ft--,we.push(t),dt>=Dn()&&ft>0&&(await mt(),dt=0))}function Dn(){return Math.min(_e(),Fn)}function _e(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function We(){return Math.min(_e(),1073741824)}function Jr(){return Math.max(_e()*2,We()*6)}function U(){return p>0&&p<=We()}function On(){return p<=0?0:p*2+or+Gn+sr+ve*2+Pe*2}function Nn(){return R<1||p<=0?0:R*p*(1+St)}function bt(){L?.destroy(),L=null;for(let e of Z)e?.destroy();Z=[],W=[],R=0,b=0,M=[],De=0}function Gr(){G?.destroy(),F?.destroy(),_r(ne),ne=null,be?.destroy(),bt()}function Ut(e){let t=j>0;j+=e;let r=j>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function he(){if(R<1||Z.length===0){w&&(w=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=nn(),t=!W.some(i=>i)&&b>=R,r=fe>=e,n;if(w){let i=W.some(a=>a),o=fe<=Math.floor(e/2);n=!(i&&o)}else n=t||r;n!==w&&(w=n,self.postMessage({type:"backpressure",active:n}))}async function Se(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??wr/128,wr),r=e.usage??0,n=0,i=0;for(let c of v)c.codec===yt?n+=c.storedBytes:i+=c.storedBytes;let o=R*p,a=A?(1+St)*o:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:a})}var Oe=!1;async function Wn(e){let t=new DecompressionStream(Vr),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:l,value:u}=await i.read();if(l)break;n.push(u)}let o=0;for(let l of n)o+=l.byteLength;let a=new Uint8Array(o),c=0;for(let l of n)a.set(l,c),c+=l.byteLength;return a.buffer}var ye=0,ot=0,ir=0;function en(e,t,r=s.limits.maxComputeWorkgroupsPerDimension){if(e<=r&&t<=r)return{logicalWgX:e,logicalWgY:t,dispatchWgX:e,dispatchWgY:t,remapped:!1};let n=e*t,i=Math.min(n,r),o=Math.ceil(n/i);if(o>r)throw new Error(`Grid requires ${e}x${t} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${r}.`);return{logicalWgX:e,logicalWgY:t,dispatchWgX:i,dispatchWgY:o,remapped:!0}}function $n(){return en(Math.ceil(er/16),Math.ceil(S/16))}function zn(){return en(Math.ceil(h/16),Math.ceil(S/16))}function Kn(e,t){t.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${t.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${t.dispatchWgX}u;`))}function qn(e){e.push(`const CELLS_PER_WORD: u32 = ${y.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${y.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${y.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${y.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${y.cellMask}u;`)}function Yn(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Xn(e,t,r){if(t.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${r} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${r} = gid.x;`),e.push("  let y = gid.y;")}function Hn(){let e=[],t=er,r=ht;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${V.map(d=>d.id).join(", ")}`),e.push(`// Rules: ${Ge.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${h}u;`),e.push(`const ROWS: u32 = ${S}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),Kn(e,r),qn(e),e.push(""),Yn(e,"gridIn","PACKED_COLS"),e.push("");let n=re.get(Xe)??0,i=Ge.rules.filter(d=>!d.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let o=Vn(i.map(d=>d.clause)),a=new Map,c=0;for(let d of o){let m=`count_${c++}`;a.set(d,m)}for(let[d,m]of a){let P=d.split(",").map(Number),z=Fr().map(g=>`select(0u, 1u, ${P.map(se=>`${g} == ${se}u`).join(" || ")})`);e.push(`  let ${m} = ${z.join(" + ")};`)}o.size>0&&e.push("");let l=Zn(i.map(d=>d.clause)),u=new Map,C=0;for(let d of l)if(a.has(d))u.set(d,a.get(d));else{let m=`eq_count_${C++}`;u.set(d,m)}for(let[d,m]of u){if(a.has(d))continue;let P=d.split(",").map(Number),z=Fr().map(g=>`select(0u, 1u, ${P.map(se=>`${g} == ${se}u`).join(" || ")})`);e.push(`  let ${m} = ${z.join(" + ")};`)}l.size>0&&C>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let d=0;d<i.length;d++){let m=i[d],P=ke(m.clause,a,u),k=jn(m.tribe);d===0?e.push(`  if (${P}) {`):e.push(`  } else if (${P}) {`),e.push(`    result = ${k}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),r.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),Xn(e,r,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let d=-1;d<=1;d++)for(let m=-1;m<=1;m++){if(m===0&&d===0)continue;let P=tn(m,d),k=Ur("x",m,"COLS"),z=Ur("y",d,"ROWS");e.push(`    let ${P} = readCell(${k}, ${z});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function tn(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function Fr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(tn(r,t));return e}function Ur(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function O(e){let t=[];for(let r of e)if(r===Tt)for(let n=0;n<V.length;n++)t.push(n);else{let n=re.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function jn(e){return e===Tt?0:re.get(e)??0}function Vn(e){let t=new Set;for(let r of e)$t(r,t);return t}function $t(e,t){switch(e.kind){case He:case je:break;case Ze:case Qe:case Je:case et:case Ve:{let r=O(e.tribes).sort();t.add(r.join(","));break}case tt:$t(e.clause,t);break;case rt:case nt:case it:for(let r of e.clauses)$t(r,t);break}}function Zn(e){let t=new Set;for(let r of e)zt(r,t);return t}function zt(e,t){switch(e.kind){case He:case je:case Ve:case Ze:case Qe:case Je:case et:break;case kt:{let r=O(e.tribe1).sort(),n=O(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case tt:zt(e.clause,t);break;case rt:case nt:case it:for(let r of e.clauses)zt(r,t);break}}function ke(e,t,r){switch(e.kind){case He:return"false";case je:{let n=O(e.tribes);return n.length===0?"false":n.length===V.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case Ve:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case Ze:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case Qe:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case Je:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case et:{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case kt:{let n=r.get(O(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),o=`(i32(${r.get(O(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${o})`;case">":return`(i32(${n}) > ${o})`;case"<":return`(i32(${n}) < ${o})`;case"\u2265":return`(i32(${n}) >= ${o})`;case"\u2264":return`(i32(${n}) <= ${o})`;default:return`(i32(${n}) == ${o})`}}case tt:return`!(${ke(e.clause,t,r)})`;case rt:return`(${e.clauses.map(i=>ke(i,t,r)).join(" && ")})`;case nt:return`(${e.clauses.map(i=>ke(i,t,r)).join(" || ")})`;case it:return`(((${e.clauses.map(o=>ke(o,t,r)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var or=48;function Kt(){Fe?.destroy(),Fe=s.createBuffer({label:f.uniformBuffer,size:or,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Qn(){let e=new ArrayBuffer(or),t=new Float32Array(e),r=new Uint32Array(e),n=(Kr%h+h)%h,i=(qr%S+S)%S,o=Math.floor(n),a=Math.floor(i);t[0]=pe.width,t[1]=pe.height,t[2]=zr,t[4]=n-o,t[5]=i-a,r[6]=h,r[7]=S,r[8]=o,r[9]=a,r[10]=V.length,s.queue.writeBuffer(Fe,0,e)}function Ct(){return ce({cols:h,rows:S},y)}function ie(){return Me(y)}async function qt(){let e=Ct();G=s.createBuffer({label:f.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await gt(e,G),F=s.createBuffer({label:f.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await gt(e,F);let t=s.createCommandEncoder({label:f.gridClearEncoder});t.clearBuffer(G),t.clearBuffer(F),s.queue.submit([t.finish()]),I=!1}function Yt(){let e=new Uint32Array(Zr);for(let t=0;t<V.length;t++){let r=V[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),o=parseInt(r.substring(4,6),16);e[t]=n|i<<8|o<<16}ge&&ge.destroy(),ge=s.createBuffer({label:f.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(ge,0,e)}function Jn(){return Er.replace("__CELLS_PER_WORD__",`${y.cellsPerWord}u`).replace("__WORD_SHIFT__",`${y.wordShift}u`).replace("__CELL_SHIFT__",`${y.cellShift}u`).replace("__CELL_INDEX_MASK__",`${y.cellIndexMask}u`).replace("__CELL_MASK__",`${y.cellMask}u`)}function Xt(){let e=s.createShaderModule({label:f.renderShaderModule,code:Jn()});pt=s.createRenderPipeline({label:f.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:st}]},primitive:{topology:"triangle-list"}})}function Ht(){Wr=s.createBindGroup({layout:pt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Fe}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:ge}}]}),$r=s.createBindGroup({layout:pt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Fe}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:ge}}]})}function jt(){ht=$n();let e=Hn(),t=s.createShaderModule({label:f.simulationShaderModule,code:e});Ae=s.createComputePipeline({label:f.simulationPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),tr=s.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:F}}]}),rr=s.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:G}}]})}function Vt(){Wt=zn(),ne=Cr({device:s,cols:h,rows:S,gridFormat:y,dispatchPlan:Wt})}var sr=176;function ei(){return`
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

const CELLS_PER_WORD: u32 = ${y.cellsPerWord}u;
const WORD_SHIFT: u32 = ${y.wordShift}u;
const CELL_SHIFT: u32 = ${y.cellShift}u;
const CELL_INDEX_MASK: u32 = ${y.cellIndexMask}u;
const CELL_MASK: u32 = ${y.cellMask}u;

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
`}function Zt(){let e=s.createShaderModule({label:f.brushShaderModule,code:ei()});at=s.createComputePipeline({label:f.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),be?.destroy(),be=s.createBuffer({label:f.brushUniformBuffer,size:sr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Yr=s.createBindGroup({layout:at.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:be}}]}),Xr=s.createBindGroup({layout:at.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:be}}]})}function ti(e,t,r,n,i,o,a){let c=re.get(Xe)??0,l=Ln++,u=new ArrayBuffer(sr),C=new Int32Array(u),d=new Uint32Array(u);C[0]=t,C[1]=r,d[2]=h,d[3]=S,d[4]=n,d[5]=i,d[6]=o,d[7]=c,d[8]=l,d[9]=a.length,d[10]=0;for(let k=0;k<a.length&&k<32;k++)d[11+k]=a[k];s.queue.writeBuffer(be,0,u);let m=Math.ceil(n/8),P=e.beginComputePass({label:f.brushPass});P.setPipeline(at),P.setBindGroup(0,I?Xr:Yr),P.dispatchWorkgroups(m,m),P.end()}function ri(){let e=I?F:G,t=Ct(),r;try{r=s.createBuffer({label:f.gridReadbackBuffer,size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder({label:f.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function rn(){if(p=Ct(),!U()){R=0;return}let e=ni();R=Math.max(1,Math.floor(e/p))}function ni(){return p>=Ir?p:Math.min(Math.max(Ir,p),We())}function nn(){if(R<1||p<=0)return Ar;let e=Math.max(p,R*p),t=Math.floor(536870912/e);return Math.max(1,Math.min(Ar,t||1))}function Qt(){let e=U();self.postMessage({type:"limits",maxBytes:_e(),vramBudgetBytes:Jr(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:On(),vramRecordingBytes:Nn(),gridFormat:ie()})}function Ce(){return!U()||R<1||L===null||Z.length===0||fe>=nn()?!1:b<R?!0:Z.some((e,t)=>W[t]&&e.mapState==="unmapped")}function $e(e){if(R<1||L===null||b>=R)return;let t=I?F:G,r=b*p,n=s.createCommandEncoder({label:f.recordingFrameCopyEncoder});n.copyBufferToBuffer(t,0,L,r,p),s.queue.submit([n.finish()]),M.push(e),b++}function Dt(e){De=Math.max(0,De+e)}function Ot(){R>0&&b>=R&&Ce()&&Ne()}function Ne(){if(L===null||b===0||Z.length===0)return;let e=W.indexOf(!0);if(e<0)return;W[e]=!1;let t=Z[e];if(t.mapState!=="unmapped"){W[e]=!0;return}let r=b*p,n=Hr++,i=[...M],o=i[0],a=i[i.length-1],c=`chunk-${String(n).padStart(6,"0")}.bin`,l=b,u=s.createCommandEncoder({label:f.recordingSealCopyEncoder});u.copyBufferToBuffer(L,0,t,0,r),s.queue.submit([u.finish()]);let C={chunkId:n,generationStart:o,generationEnd:a,blockCount:l,codec:yt,uncompressedBytes:r,storedBytes:r,gridFormat:ie(),generations:i,filename:c};Ut(1),Dt(l),fe++,he();let d=Te;t.mapAsync(GPUMapMode.READ).then(async()=>{let m=t.getMappedRange(),P=new ArrayBuffer(r);new Uint8Array(P).set(new Uint8Array(m,0,r)),t.unmap(),d===Te&&(W[e]=!0,v.push(C),Dt(-l),ar(),he(),Ot(),ii(C,P).then(()=>{d===Te&&(fe--,he(),Ut(-1),Se(),vt(!0),Ot(),self.postMessage({type:"chunkSealed",filename:C.filename,rawBytes:r,blockCount:C.blockCount,cols:h,rows:S,rawGridFormat:C.gridFormat,storageGridFormat:Me(It(Ge.tribes.length))}),Oe&&j===0&&(Oe=!1,sn()))}))}).catch(()=>{d===Te&&(W[e]=!0,fe--,Dt(-l),he(),Ut(-1),Ot())}),b=0,M=[]}function ar(){v.length>0&&(Y.generationStart=v[0].generationStart,Y.generationEnd=v[v.length-1].generationEnd),M.length>0&&(v.length===0&&(Y.generationStart=M[0]),Y.generationEnd=M[M.length-1]),Y.chunks=[...v]}async function Dr(e){Te++,Hr=0,b=0,M=[],v=[],De=0,fe=0,j>0&&(j=0,self.postMessage({type:"chunksSaving",active:!1})),w&&(w=!1,self.postMessage({type:"backpressure",active:!1})),Oe=!1,X=A,Y={chunks:[],generationStart:e,generationEnd:e,gridFormat:ie()},await on(),Se()}async function cr(){return ue&&await ue,Ie||(Ie=await(await navigator.storage.getDirectory()).getDirectoryHandle(lt,{create:!0})),Ie}async function ii(e,t){let i=await(await(await cr()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function oi(e){let t=await cr();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function on(){if(ue){await ue;return}ue=(async()=>{let e=await navigator.storage.getDirectory();Ie=null;try{await e.removeEntry(lt,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${lt}:`,t)}Ie=await e.getDirectoryHandle(lt,{create:!0})})();try{await ue}finally{ue=null}}function sn(){ar(),self.postMessage({type:"recording",manifest:{chunks:v.map(e=>({...e,generations:[...e.generations]})),generationStart:Y.generationStart,generationEnd:Y.generationEnd,gridFormat:ie()},cols:h,rows:S})}function si(){return b>0?M[b-1]!==E:v.length>0?v[v.length-1].generationEnd!==E:!0}function Le(e=!1){if(A){if(e){if(X){if(!Ce())return;X=!1}}else if(X)return;!si()||!Ce()||(b>=R&&Ne(),$e(E))}}function ur(){if(!ct)return;let e=ct;ct=null;let t=s.createCommandEncoder({label:f.brushEncoder});ti(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),A&&b>0&&M[b-1]===E&&(b--,M.pop(),$e(E))}async function ai(e,t=yt){let o=await(await(await(await cr()).getFileHandle(e)).getFile()).arrayBuffer();return t===Vr?Wn(o):o}function ci(){let e=b+De;for(let t of v)e+=t.blockCount;return e}function an(){return gr(h,S,Ue.enabled,Ue.sections)}function ui(){return br(an())}function le(e){ut=ui(),ne&&ut.length!==0&&vr({device:s,encoder:e,resources:ne,sourceBuffer:I?F:G,dispatchPlan:Wt,enabledSections:ut})}function de(){let e=E;if(!ne||e===H||N)return;let t=ne,r=[...ut],n=an();H=e,N=!0,Pr({resources:t,enabledSections:r}).then(i=>{let o=re.get(Xe)??0,a=ci(),c=Rr({generation:e,tribes:V,deadTribeIndex:o,readback:i,enabledSections:r,availability:n,liveMetricSettings:Ue.sections,cols:h,rows:S,totalFrames:a,fps:ir,canStepBack:a>1,recordingBytes:v.reduce((l,u)=>l+u.storedBytes,0),recordingRawBytes:v.reduce((l,u)=>l+u.uncompressedBytes,0)});if(N=!1,self.postMessage(c),q)if(q=!1,H=-1,ln()){let l=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(l),s.queue.submit([l.finish()]),de()}else q=!0}).catch(()=>{N=!1})}function li(){let e=h*S;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function di(){let e=h*S;return e>1e7?2:e>1e6?4:e>1e5?8:16}function cn(e){if(e<=0)return;let t=ht,r=s.createCommandEncoder({label:f.simulationBatchEncoder});for(let n=0;n<e;n++){let i=r.beginComputePass({label:f.simulationStepPass});i.setPipeline(Ae),i.setBindGroup(0,I?rr:tr),i.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),i.end(),I=!I,E++}s.queue.submit([r.finish()]),ye+=e}function fi(){self.postMessage({type:"generation",generation:E,fps:ir})}function lr(){let e=s.createCommandEncoder({label:f.simulationSingleStepEncoder}),t=e.beginComputePass({label:f.simulationStepPass});t.setPipeline(Ae),t.setBindGroup(0,I?rr:tr);let r=ht;t.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),t.end(),s.queue.submit([e.finish()]),I=!I,E++}function te(){Qn();let e=Nt.getCurrentTexture().createView(),t=s.createCommandEncoder({label:f.renderEncoder}),r=t.beginRenderPass({label:f.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(pt),r.setBindGroup(0,I?$r:Wr),r.draw(3),r.end(),s.queue.submit([t.finish()])}function un(e){ot===0&&(ot=e);let t=e-ot;t>=1e3&&(ir=ye/(t/1e3),ye=0,ot=e)}function dr(){return A&&U()?"recording":"nonRecording"}function pi(){return ee<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/ee}}function oe(e){return e.request.stopCondition.kind==="targetGeneration"}function ze(e){return e.request.stopCondition.kind==="targetGeneration"&&E>=e.request.stopCondition.generation}function _t(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-E)}function ln(){return!!(s&&ne&&!D&&!$)}function vt(e=!1){if(e&&(H=-1),!ln())q=!0;else if(N)q=!0;else{let t=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(t),s.queue.submit([t.finish()]),de()}}function dn(){vt(!0),te()}function Pt(e,t){if(!t)return;(e-Ft>=1e3||Ft===0)&&!N&&(Ft=e,vt())}function Ke(e,t){e.request.pacing.kind!=="max"&&!oe(e)||t-e.lastProgressTime>=1e3&&(e.lastProgressTime=t,fi())}function fr(){w&&(w=!1,self.postMessage({type:"backpressure",active:!1}))}function mi(){w||(w=!0,self.postMessage({type:"backpressure",active:!0}))}function fn(){return Ce()?(b>=R&&Ne(),Ce()):!1}function xe(){D||$||_||self.requestAnimationFrame(Jt)}function me(e){let t=_;if(!t||t.pumpPending||D||$)return;let{token:r}=t;t.pumpPending=!0;let n=()=>{!_||_.token!==r||(_.pumpPending=!1,Ci(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?s.queue.onSubmittedWorkDone().then(n).catch(()=>{_?.token===r&&(_.pumpPending=!1)}):queueMicrotask(n)}function pr(e,t){_&&T("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),_={kind:e,request:t,token:++jr,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0},me(t.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function J(){B&&pr(dr(),{pacing:pi(),stopCondition:{kind:"none"}})}function T(e,t={}){let r=_;if(!r)return;_=null,jr++;let n=oe(r),i=t.restore!==!1&&!!r.request.restoreAfterStop;i&&r.request.restoreAfterStop&&(B=r.request.restoreAfterStop.running,ee=r.request.restoreAfterStop.targetStepDuration),n&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?fr():w&&he(),t.render!==!1&&!D&&!$&&dn(),t.restartRestoredRun!==!1&&i&&B&&!D&&!$?J():xe()}function Or(e){let t=_;!t||!oe(t)||(t.request.restoreAfterStop&&(t.request.restoreAfterStop.running=e),T("cancelled"))}function gi(e){T("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),pr(dr(),e)}function pn(e,t,r){mi(),Ke(e,t),Pt(t,r),me("drain")}function bi(e,t){let r=li(),n=di(),i=!1;for(let o=0;o<n;o++){let a=_t(e);if(a<=0)break;let c=Math.min(r,a);cn(c),i=!0}if(Ke(e,t),ze(e)){T("targetReached");return}me(i?"drain":"raf")}function hi(e,t){Le(!0);let r=!1,n=performance.now()+14;for(;_t(e)>0&&performance.now()<n;){if(!fn()){pn(e,t,r);return}lr(),ye++,r=!0,$e(E)}if(fr(),Ke(e,t),Pt(t,r),ze(e)){T("targetReached");return}me("raf")}function Si(e,t,r){e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=Math.floor(e.stepAccumulator/t),o=Math.min(i,_t(e)),a=o>0;if(a&&(cn(o),e.stepAccumulator-=t*o),Ke(e,r),ze(e)){T("targetReached");return}oe(e)||(te(),Pt(r,a)),me("raf")}function yi(e,t,r){Le(!0),e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=!1;for(;e.stepAccumulator>=t&&_t(e)>0;){if(!fn()){pn(e,r,i);return}lr(),ye++,e.stepAccumulator-=t,i=!0,$e(E)}if(fr(),Ke(e,r),ze(e)){T("targetReached");return}oe(e)||(te(),Pt(r,i)),me("raf")}function Ci(e){let t=_;if(!t||D||$)return;if(un(e),oe(t)||ur(),ze(t)){T("targetReached");return}if(t.request.pacing.kind==="max"){t.kind==="recording"?hi(t,e):bi(t,e);return}let r=1e3/t.request.pacing.genPerSecond;t.kind==="recording"?yi(t,r,e):Si(t,r,e)}function Jt(e){if(D||$){self.requestAnimationFrame(Jt);return}un(e),!_&&(ur(),ee>0&&!Be&&te(),self.requestAnimationFrame(Jt))}function _i(e,t){let r=s?_e():Number.POSITIVE_INFINITY;return Mr(t.bitsPerCell)&&xt(t.bitsPerCell,e.tribes.length)&&At(e,Ee(t.bitsPerCell),r)?Ee(t.bitsPerCell):Br(e.tribes.length,e,r)}function Nr(e,t){Ge=e,h=e.cols,S=e.rows,y=_i(e,t),er=ae(h,y),V=[...e.tribes],Y.gridFormat=ie(),re.clear(),V.forEach((r,n)=>re.set(r.id,n))}async function mn(e){console.log("[GOLT worker] Initializing WebGPU"),pe=e;let t=await navigator.gpu.requestAdapter();if(!t)throw console.error("[GOLT worker] WebGPU adapter not available"),new Error("WebGPU adapter not available");s=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),$=!1,s.lost.then(n=>{let i=n.message||n.reason||"unknown";console.error("[GOLT worker] GPU device lost:",i),T("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),$=!0,B=!1,D=!0,self.postMessage({type:"deviceLost",reason:i})}),self.postMessage({type:"limits",maxBytes:_e(),vramBudgetBytes:Jr(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:ie()});let r=pe.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");Nt=r,st=navigator.gpu.getPreferredCanvasFormat(),Nt.configure({device:s,format:st,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:st,maxBufferSize:s.limits.maxBufferSize,maxStorageBufferBindingSize:s.limits.maxStorageBufferBindingSize})}async function vi(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await mn(pe),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let t=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",t),T("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),$=!0,B=!1,D=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function gn(){L=s.createBuffer({label:f.recordingChunkBuffer,size:R*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await gt(R*p,L),b=0,M=[]}async function bn(){let e=R*p;Z=[],W=[];for(let t=0;t<St;t++){let r=s.createBuffer({label:`${f.recordingStagingBuffer} ${t}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});Z.push(r),W.push(!0),await gt(e,r)}}async function Pi(){await on()}async function Ri(){console.log("[GOLT worker] Building GPU resources",{cols:h,rows:S,bitsPerCell:y.bitsPerCell,recordingAvailable:U()}),Kt(),rn(),await qt(),Yt(),Xt(),Ht(),jt(),Zt(),Vt(),await Pi(),U()?(await gn(),await bn()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:p,maxRecordingBufferBytes:We()}),bt(),A=!1,X=!1),await mt(),Qt(),console.log("[GOLT worker] GPU resources ready")}async function Ei(){console.log("[GOLT worker] Rebuild started",{cols:h,rows:S,bitsPerCell:y.bitsPerCell}),T("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),D=!0,self.postMessage({type:"rebuilding",active:!0});try{await nr()}catch{}if($&&!await vi())return!1;Gr(),Kt(),rn(),Lr(U());try{await qt(),Yt(),Xt(),jt(),Zt(),Ht(),Vt(),U()?(await gn(),await bn()):(bt(),A=!1,X=!1),await mt(),Qt()}catch(e){let t=e instanceof Error?e.message:String(e);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{Gr(),Kt(),Lr(!1),await qt(),Yt(),Xt(),jt(),Zt(),Ht(),Vt(),A=!1,X=!1,p=Ct(),bt(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await mt(),Qt()}catch(r){return console.error("[GOLT worker] GPU rebuild recovery failed:",r),!1}}return D=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:U(),frameByteSize:p}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(console.log("[GOLT worker] Init message received",{cols:t.ruleset.cols,rows:t.ruleset.rows,recording:t.recording,running:t.running,speed:t.speed}),A=t.recording,Ue=Lt(t.liveMetrics),X=A,Nr(t.ruleset,t.simulationGridFormat),await mn(t.canvas),await Ri(),N)q=!0;else{let r=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(r),s.queue.submit([r.finish()]),de()}Se(),B=t.running,ee=t.speed<0?0:1e3/t.speed,B?J():xe();break}case"setLiveMetrics":{Ue=Lt(t.liveMetrics),H=-1,vt(!0);break}case"setRuleset":{if(console.log("[GOLT worker] Ruleset update received",{cols:t.ruleset.cols,rows:t.ruleset.rows,tribes:t.ruleset.tribes.length}),T("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Nr(t.ruleset,t.simulationGridFormat),!await Ei())break;if(E=0,H=-1,await Dr(0),B?J():xe(),N)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(n),s.queue.submit([n.finish()]),de()}break}case"setRunning":if(B=t.running,t.running){_||J();break}_&&oe(_)?Or(!1):_?T("manual"):(w&&he(),dn(),xe());break;case"setSpeed":{let r=ee<=0,n=t.speed<0?0:1e3/t.speed;ee=n,_&&!oe(_)&&B?(T("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&n>0?(Be=!0,s.queue.onSubmittedWorkDone().then(()=>{Be=!1,te(),J()})):J()):B&&!_?J():r&&n>0&&(Be=!0,s.queue.onSubmittedWorkDone().then(()=>{Be=!1,te(),xe()}));break}case"camera":zr=t.scale,Kr=t.offsetX,qr=t.offsetY;break;case"resize":pe.width=t.width,pe.height=t.height;break;case"draw":{let r=t.tribes.map(n=>re.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};ct={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{ri().then(r=>{let n={type:"snapshot",grid:r,generation:E,cols:h,rows:S,gridFormat:ie()};self.postMessage(n,[r.buffer])}).catch(()=>{let r=new Uint32Array(0),n={type:"snapshot",grid:r,generation:E,cols:h,rows:S,gridFormat:ie()};self.postMessage(n,[r.buffer])});break}case"loadSnapshot":{let r=I?F:G,n=wt(t.gridFormat),i=ce({cols:h,rows:S},n);if(t.grid.byteLength!==i)break;let o=Gt(t.grid,{cols:h,rows:S},n,y);s.queue.writeBuffer(r,0,o),E=t.generation,await Dr(t.generation);break}case"setRecording":{let r=_?.request;if(t.recording&&U()&&!A){if(A=!0,X=!0,H=-1,N)q=!0;else{let n=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(n),s.queue.submit([n.finish()]),de()}Se()}else(!t.recording||!U())&&(t.recording&&!U()&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:p,maxRecordingBufferBytes:We()}),A=!1,X=!1);r&&_?gi(r):!_&&B&&J();break}case"getRecording":{if(Oe)break;await nr(),Le(!1),b>0&&Ne(),j>0?Oe=!0:sn();break}case"stepBack":{let r=0;for(let c of v)r+=c.blockCount;let n=r+b,i=Math.min(t.count,n-1);if(i<=0)break;let o=n-1-i,a=I?F:G;if(o>=r){let c=o-r;b=c+1,M.length=b,E=M[c];let l=s.createCommandEncoder({label:f.recordingRestoreCopyEncoder});l.copyBufferToBuffer(L,c*p,a,0,p),s.queue.submit([l.finish()])}else{if(j>0){await new Promise(g=>{let x=setInterval(()=>{j===0&&(clearInterval(x),g())},10)}),r=0;for(let g of v)r+=g.blockCount}let c=0,l=0,u=0;for(let g=0;g<v.length;g++){let x=v[g];if(o<c+x.blockCount){l=g,u=o-c;break}c+=x.blockCount}let C=v[l],d=await ai(C.filename,C.codec),m=wt(C.gridFormat),P=ce({cols:h,rows:S},m);if(m.bitsPerCell===y.bitsPerCell){let g=(u+1)*p;s.queue.writeBuffer(L,0,new Uint8Array(d,0,g))}else{let g=new Uint8Array((u+1)*p);for(let x=0;x<=u;x++){let se=x*P,hn=new Uint8Array(d,se,P),Rt=Gt(Tr(hn),{cols:h,rows:S},m,y);g.set(new Uint8Array(Rt.buffer,Rt.byteOffset,Rt.byteLength),x*p)}s.queue.writeBuffer(L,0,g),s.queue.writeBuffer(a,0,g.subarray(u*p,(u+1)*p))}if(b=u+1,M=C.generations.slice(0,u+1),E=M[u],m.bitsPerCell===y.bitsPerCell){let g=s.createCommandEncoder({label:f.recordingRestoreCopyEncoder});g.copyBufferToBuffer(L,u*p,a,0,p),s.queue.submit([g.finish()])}let z=v.splice(l).map(g=>g.filename);oi(z)}if(ar(),Se(),H=-1,N)q=!0;else{let c=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(c),s.queue.submit([c.finish()]),de()}te();break}case"stepForward":{if(ur(),t.count===1){if(Le(!0),lr(),ye++,A&&Ce()&&(b>=R&&Ne(),$e(E)),H=-1,N)q=!0;else{let r=s.createCommandEncoder({label:f.interactiveMetricsEncoder});le(r),s.queue.submit([r.finish()]),de()}te()}else self.postMessage({type:"stepping",active:!0}),Le(!0),pr(dr(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:E+t.count},restoreAfterStop:{running:B,targetStepDuration:ee}});break}case"cancelStepping":{Or(_?.request.restoreAfterStop?.running??B);break}case"updateChunkCodec":{let r=v.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,Y.chunks=[...v],Se());break}case"getUncompressedChunks":{let r=v.filter(n=>n.codec===yt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:h,rows:S,rawGridFormat:n.gridFormat,storageGridFormat:Me(It(Ge.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
