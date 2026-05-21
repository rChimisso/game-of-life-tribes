var l={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer"};var Mr=4294967295;function q(e,t){return e.includes(t)}function At(e,t){return e?t?"ok":"tooLarge":"disabled"}function vr(e,t,r,n){let i=e*t,s=i<=Mr,a=i*2<=Mr;return{population:At(r&&n.population,s),diversity:At(r&&n.diversity,s),interfaces:At(r&&n.interfaces,a)}}function Er(e){let t=[];return e.population==="ok"&&t.push("population"),e.diversity==="ok"&&t.push("diversity"),e.interfaces==="ok"&&t.push("interfaces"),t}var ve=256*Uint32Array.BYTES_PER_ELEMENT,Ee=Uint32Array.BYTES_PER_ELEMENT;function Pr(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function Br(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function Tr(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function En(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${Pr(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Br(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${Tr(i)}
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
`}function Pn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${Pr(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${Br(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${Tr(i)}
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
`}function xr(e){let{device:t}=e,r=t.createShaderModule({label:l.histogramMetricsShaderModule,code:En(e)}),n=t.createComputePipeline({label:l.histogramMetricsPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),i=t.createBuffer({label:l.histogramMetricsBuffer,size:ve,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),s=t.createBuffer({label:l.histogramMetricsReadBuffer,size:ve,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),a=t.createShaderModule({label:l.interfaceMetricsShaderModule,code:Pn(e)}),d=t.createComputePipeline({label:l.interfaceMetricsPipeline,layout:"auto",compute:{module:a,entryPoint:"main"}}),f=t.createBuffer({label:l.interfaceMetricsBuffer,size:Ee,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),u=t.createBuffer({label:l.interfaceMetricsReadBuffer,size:Ee,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:s,boundaryPipeline:d,boundaryBuffer:f,boundaryReadBuffer:u}}function kr(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function Ar(e){let{device:t,encoder:r,resources:n,sourceBuffer:i,dispatchPlan:s,enabledSections:a}=e;if(q(a,"population")||q(a,"diversity")){let d=new Uint32Array(256);t.queue.writeBuffer(n.histogramBuffer,0,d);let f=t.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),u=r.beginComputePass({label:l.histogramMetricsPass});u.setPipeline(n.histogramPipeline),u.setBindGroup(0,f),u.dispatchWorkgroups(s.dispatchWgX,s.dispatchWgY),u.end(),r.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,ve)}if(q(a,"interfaces")){let d=new Uint32Array([0]);t.queue.writeBuffer(n.boundaryBuffer,0,d);let f=t.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),u=r.beginComputePass({label:l.interfaceMetricsPass});u.setPipeline(n.boundaryPipeline),u.setBindGroup(0,f),u.dispatchWorkgroups(s.dispatchWgX,s.dispatchWgY),u.end(),r.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Ee)}}async function Ir(e){let{resources:t,enabledSections:r}=e,n=q(r,"population")||q(r,"diversity"),i=q(r,"interfaces"),s=[];n&&s.push(t.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&s.push(t.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(s);let a=new Uint32Array(256);n&&(a=new Uint32Array(t.histogramReadBuffer.getMappedRange().slice(0)),t.histogramReadBuffer.unmap());let d=0;if(i){let f=new Uint32Array(t.boundaryReadBuffer.getMappedRange().slice(0));t.boundaryReadBuffer.unmap(),d=f[0]??0}return{histogram:a,crossStateContactEdges:d}}function Lr(e){let{generation:t,tribes:r,deadTribeIndex:n,readback:i,enabledSections:s,availability:a,liveMetricSettings:d,cols:f,rows:u,totalFrames:v,fps:c,canStepBack:g,recordingBytes:R,recordingRawBytes:A}=e,D=q(s,"population")&&d.population,h=q(s,"diversity")&&d.diversity,T=q(s,"interfaces")&&d.interfaces,j={},He=0,je=0,me={},Re=0,Ve=f*u;for(let E=0;E<r.length;E++){let ee=D?i.histogram[E]??0:0;j[r[E].id]=ee,E!==n&&(Re+=ee)}if(h){Re=0;for(let E=0;E<r.length;E++)E!==n&&(Re+=i.histogram[E]??0)}if(h&&Re>0){for(let E=0;E<r.length;E++)if(E!==n){let ee=(i.histogram[E]??0)/Re;ee>0&&(He-=ee*Math.log2(ee),je+=ee*ee)}}for(let E=0;E<r.length;E++)E!==n&&(me[r[E].id]=0);let _r=D?j[r[n]?.id??""]??0:0,Cr=D?Math.max(0,Ve-_r):0,Me=Ve*2,kt=T?i.crossStateContactEdges:0,Rr=T?Math.max(0,Me-kt):0,vn={sameStateContactEdges:Rr,crossStateContactEdges:kt,sameStateContactFraction:T&&Me>0?Rr/Me:0,crossStateContactFraction:T&&Me>0?kt/Me:0};return{type:"metrics",generation:t,population:j,aliveCells:Cr,deadCells:_r,occupancy:D&&Ve>0?Cr/Ve:0,shannonEntropy:He,simpsonIndex:h?1-je:0,interfaces:vn,metricsAvailability:a,extinctionTime:me,totalFrames:v,fps:c,canStepBack:g,recordingBytes:R,recordingRawBytes:A}}var wr=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var It=[1,2,4,8,16,32],Tn={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},xn={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},kn={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Ze={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},An={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},Lt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},te={1:Tn,2:xn,4:kn,8:Ze,16:An,32:Lt};var Pe={population:!0,diversity:!0,interfaces:!1},Qe={enabled:!0,sections:Pe};var wt="any",Je="dead";var et="empty",tt="is",Gt="comparison",rt="count",nt="none",it="exactly",st="min",ot="max",at="not",ut="and",ct="or",lt="xor";function Gr(e){return It.includes(e)}function In(e){return 2**e}function Ft(e,t){return t<=In(e)}function Ut(e,t,r){return ke(e,t)<=r}function Dt(e){return e<=2?te[1]:e<=4?te[2]:e<=16?te[4]:e<=256?te[8]:e<=65536?te[16]:te[32]}function Be(e){return te[e]}function Fr(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of It){let i=Be(n);if(Ft(n,e)&&Ut(t,i,r))return i}return Lt}function Ot(e){return Be(e?.bitsPerCell??8)}function Te(e){return{bitsPerCell:e.bitsPerCell}}function xe(e,t){return Math.ceil(e/t.cellsPerWord)}function ke(e,t){return xe(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Ln(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function Wt(e,t,r){let n=xe(t.cols,r),i=new Uint32Array(n*t.rows);for(let s=0;s<t.rows;s++)for(let a=0;a<n;a++){let d=a*r.cellsPerWord,f=0;for(let u=0;u<r.cellsPerWord&&d+u<t.cols;u++){let v=e[s*t.cols+d+u]&r.cellMask;f|=v<<(u<<r.cellShift)}i[s*n+a]=f>>>0}return i}function Nt(e,t,r){let n=xe(t.cols,r),i=new Uint8Array(t.cols*t.rows);for(let s=0;s<t.rows;s++)for(let a=0;a<n;a++){let d=e[s*n+a],f=a*r.cellsPerWord;for(let u=0;u<r.cellsPerWord&&f+u<t.cols;u++)i[s*t.cols+f+u]=d>>>(u<<r.cellShift)&r.cellMask}return i}function Ur(e,t,r){return Nt(Ln(e),t,r)}function wn(e){return{population:typeof e?.population=="boolean"?e.population:Pe.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Pe.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Pe.interfaces}}function $t(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Qe.enabled,sections:wn(e?.sections)}}var o,K=!1,qt,ft,pe,Oe,m=0,b=0,sr=0,S=Ze,Q=[],se=new Map,vt,Xt,F,U,We,be,yt,Hr,jr,Ge,or,ar,L=!1,Vr=1,Zr=0,Qr=0,x=!1,W=!1,ne=100,M=0,pt,he,Jr,en,Fn=0,gt=null,oe=null,V=-1,$=!1,X=!1,zt=0,Ne=Qe,mt=[],I=!1,H=!1,Y={chunks:[],generationStart:0,generationEnd:0,gridFormat:Te(Ze)},tn=0,C=[],_=null,rn=0,Ae=!1,G=null,y=0,B=[],P=64,p=0,Et=3,J=[],z=[],bt="gol-recording",Pt="raw-packed",nn="deflate-raw",Fe=null,ce=null,Z=0,fe=0,Dr=12,w=!1,Ie=0,sn=256,Un=sn*Uint32Array.BYTES_PER_ELEMENT,Or=256*1024*1024,Dn=512*1024*1024,On=512*1024*1024,Wr=128*1024*1024*1024,ht=0,St=0,Ue=[];function Wn(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function on(e){console.error("[GOLT worker] Worker GPU error:",e),k("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),x=!1,self.postMessage({type:"gpuError",reason:Wn(e)})}self.addEventListener("error",e=>{e.preventDefault(),on(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),on(e.reason)});async function ur(){await o.queue.onSubmittedWorkDone()}function Nr(e){ht=0,St=2+(e?1+Et:0),Ue=[]}async function _t(){if(Ue.length===0)return;let e=o.createCommandEncoder({label:l.trackedAllocationClearEncoder});for(let t of Ue)e.clearBuffer(t);o.queue.submit([e.finish()]),await ur(),Ue=[]}async function Ct(e,t){!W||St<=0||(ht+=e,St--,Ue.push(t),ht>=Nn()&&St>0&&(await _t(),ht=0))}function Nn(){return Math.min(Ce(),On)}function Ce(){return Math.min(o.limits.maxBufferSize,o.limits.maxStorageBufferBindingSize)}function Ke(){return Math.min(Ce(),1073741824)}function an(){return Math.max(Ce()*2,Ke()*6)}function O(){return p>0&&p<=Ke()}function $n(){return p<=0?0:p*2+lr+Un+dr+ve*2+Ee*2}function zn(){return P<1||p<=0?0:P*p*(1+Et)}function Rt(){G?.destroy(),G=null;for(let e of J)e?.destroy();J=[],z=[],P=0,y=0,B=[]}function $r(){F?.destroy(),U?.destroy(),kr(oe),oe=null,he?.destroy(),Rt()}function Kt(e){let t=Z>0;Z+=e;let r=Z>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function Se(){if(P<1||J.length===0){w&&(w=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=dn(),t=!z.some(i=>i)&&y>=P,r=fe>=e,n;if(w){let i=z.some(a=>a),s=fe<=Math.floor(e/2);n=!(i&&s)}else n=t||r;n!==w&&(w=n,self.postMessage({type:"backpressure",active:n}))}async function ye(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??Wr/128,Wr),r=e.usage??0,n=0,i=0;for(let d of C)d.codec===Pt?n+=d.storedBytes:i+=d.storedBytes;let s=P*p,a=I?(1+Et)*s:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:a})}var $e=!1;async function Kn(e){let t=new DecompressionStream(nn),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:f,value:u}=await i.read();if(f)break;n.push(u)}let s=0;for(let f of n)s+=f.byteLength;let a=new Uint8Array(s),d=0;for(let f of n)a.set(f,d),d+=f.byteLength;return a.buffer}var _e=0,dt=0,cr=0;function un(e,t,r=o.limits.maxComputeWorkgroupsPerDimension){if(e<=r&&t<=r)return{logicalWgX:e,logicalWgY:t,dispatchWgX:e,dispatchWgY:t,remapped:!1};let n=e*t,i=Math.min(n,r),s=Math.ceil(n/i);if(s>r)throw new Error(`Grid requires ${e}x${t} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${r}.`);return{logicalWgX:e,logicalWgY:t,dispatchWgX:i,dispatchWgY:s,remapped:!0}}function qn(){return un(Math.ceil(sr/16),Math.ceil(b/16))}function Xn(){return un(Math.ceil(m/16),Math.ceil(b/16))}function Yn(e,t){t.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${t.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${t.dispatchWgX}u;`))}function Hn(e){e.push(`const CELLS_PER_WORD: u32 = ${S.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${S.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${S.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${S.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${S.cellMask}u;`)}function jn(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Vn(e,t,r){if(t.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${r} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${r} = gid.x;`),e.push("  let y = gid.y;")}function Zn(){let e=[],t=sr,r=vt;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${Q.map(c=>c.id).join(", ")}`),e.push(`// Rules: ${Oe.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${m}u;`),e.push(`const ROWS: u32 = ${b}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),Yn(e,r),Hn(e),e.push(""),jn(e,"gridIn","PACKED_COLS"),e.push("");let n=se.get(Je)??0,i=Oe.rules.filter(c=>!c.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let s=Jn(i.map(c=>c.clause)),a=new Map,d=0;for(let c of s){let g=`count_${d++}`;a.set(c,g)}for(let[c,g]of a){let R=c.split(",").map(Number),D=zr().map(h=>`select(0u, 1u, ${R.map(j=>`${h} == ${j}u`).join(" || ")})`);e.push(`  let ${g} = ${D.join(" + ")};`)}s.size>0&&e.push("");let f=ei(i.map(c=>c.clause)),u=new Map,v=0;for(let c of f)if(a.has(c))u.set(c,a.get(c));else{let g=`eq_count_${v++}`;u.set(c,g)}for(let[c,g]of u){if(a.has(c))continue;let R=c.split(",").map(Number),D=zr().map(h=>`select(0u, 1u, ${R.map(j=>`${h} == ${j}u`).join(" || ")})`);e.push(`  let ${g} = ${D.join(" + ")};`)}f.size>0&&v>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let c=0;c<i.length;c++){let g=i[c],R=Le(g.clause,a,u),A=Qn(g.tribe);c===0?e.push(`  if (${R}) {`):e.push(`  } else if (${R}) {`),e.push(`    result = ${A}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),r.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),Vn(e,r,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let c=-1;c<=1;c++)for(let g=-1;g<=1;g++){if(g===0&&c===0)continue;let R=cn(g,c),A=Kr("x",g,"COLS"),D=Kr("y",c,"ROWS");e.push(`    let ${R} = readCell(${A}, ${D});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function cn(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function zr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(cn(r,t));return e}function Kr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function N(e){let t=[];for(let r of e)if(r===wt)for(let n=0;n<Q.length;n++)t.push(n);else{let n=se.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function Qn(e){return e===wt?0:se.get(e)??0}function Jn(e){let t=new Set;for(let r of e)Yt(r,t);return t}function Yt(e,t){switch(e.kind){case et:case tt:break;case nt:case it:case st:case ot:case rt:{let r=N(e.tribes).sort();t.add(r.join(","));break}case at:Yt(e.clause,t);break;case ut:case ct:case lt:for(let r of e.clauses)Yt(r,t);break}}function ei(e){let t=new Set;for(let r of e)Ht(r,t);return t}function Ht(e,t){switch(e.kind){case et:case tt:case rt:case nt:case it:case st:case ot:break;case Gt:{let r=N(e.tribe1).sort(),n=N(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case at:Ht(e.clause,t);break;case ut:case ct:case lt:for(let r of e.clauses)Ht(r,t);break}}function Le(e,t,r){switch(e.kind){case et:return"false";case tt:{let n=N(e.tribes);return n.length===0?"false":n.length===Q.length?"true":`(${n.map(s=>`selfTribe == ${s}u`).join(" || ")})`}case rt:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case nt:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case it:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case st:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case ot:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case Gt:{let n=r.get(N(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),s=`(i32(${r.get(N(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${s})`;case">":return`(i32(${n}) > ${s})`;case"<":return`(i32(${n}) < ${s})`;case"\u2265":return`(i32(${n}) >= ${s})`;case"\u2264":return`(i32(${n}) <= ${s})`;default:return`(i32(${n}) == ${s})`}}case at:return`!(${Le(e.clause,t,r)})`;case ut:return`(${e.clauses.map(i=>Le(i,t,r)).join(" && ")})`;case ct:return`(${e.clauses.map(i=>Le(i,t,r)).join(" || ")})`;case lt:return`(((${e.clauses.map(s=>Le(s,t,r)).map(s=>`select(0u, 1u, ${s})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var lr=48;function jt(){We?.destroy(),We=o.createBuffer({label:l.uniformBuffer,size:lr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function ti(){let e=new ArrayBuffer(lr),t=new Float32Array(e),r=new Uint32Array(e),n=(Zr%m+m)%m,i=(Qr%b+b)%b,s=Math.floor(n),a=Math.floor(i);t[0]=pe.width,t[1]=pe.height,t[2]=Vr,t[4]=n-s,t[5]=i-a,r[6]=m,r[7]=b,r[8]=s,r[9]=a,r[10]=Q.length,o.queue.writeBuffer(We,0,e)}function Bt(){return ke({cols:m,rows:b},S)}function ae(){return Te(S)}async function Vt(){let e=Bt();F=o.createBuffer({label:l.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Ct(e,F),U=o.createBuffer({label:l.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Ct(e,U);let t=o.createCommandEncoder({label:l.gridClearEncoder});t.clearBuffer(F),t.clearBuffer(U),o.queue.submit([t.finish()]),L=!1}function Zt(){let e=new Uint32Array(sn);for(let t=0;t<Q.length;t++){let r=Q[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),s=parseInt(r.substring(4,6),16);e[t]=n|i<<8|s<<16}be&&be.destroy(),be=o.createBuffer({label:l.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),o.queue.writeBuffer(be,0,e)}function ri(){return wr.replace("__CELLS_PER_WORD__",`${S.cellsPerWord}u`).replace("__WORD_SHIFT__",`${S.wordShift}u`).replace("__CELL_SHIFT__",`${S.cellShift}u`).replace("__CELL_INDEX_MASK__",`${S.cellIndexMask}u`).replace("__CELL_MASK__",`${S.cellMask}u`)}function Qt(){let e=o.createShaderModule({label:l.renderShaderModule,code:ri()});yt=o.createRenderPipeline({label:l.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:ft}]},primitive:{topology:"triangle-list"}})}function Jt(){Hr=o.createBindGroup({layout:yt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:We}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:be}}]}),jr=o.createBindGroup({layout:yt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:We}},{binding:1,resource:{buffer:U}},{binding:2,resource:{buffer:be}}]})}function er(){vt=qn();let e=Zn(),t=o.createShaderModule({label:l.simulationShaderModule,code:e});Ge=o.createComputePipeline({label:l.simulationPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),or=o.createBindGroup({layout:Ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:U}}]}),ar=o.createBindGroup({layout:Ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:F}}]})}function tr(){Xt=Xn(),oe=xr({device:o,cols:m,rows:b,gridFormat:S,dispatchPlan:Xt})}var dr=176;function ni(){return`
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
`}function rr(){let e=o.createShaderModule({label:l.brushShaderModule,code:ni()});pt=o.createComputePipeline({label:l.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),he?.destroy(),he=o.createBuffer({label:l.brushUniformBuffer,size:dr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Jr=o.createBindGroup({layout:pt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:he}}]}),en=o.createBindGroup({layout:pt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:he}}]})}function ii(e,t,r,n,i,s,a){let d=se.get(Je)??0,f=Fn++,u=new ArrayBuffer(dr),v=new Int32Array(u),c=new Uint32Array(u);v[0]=t,v[1]=r,c[2]=m,c[3]=b,c[4]=n,c[5]=i,c[6]=s,c[7]=d,c[8]=f,c[9]=a.length,c[10]=0;for(let A=0;A<a.length&&A<32;A++)c[11+A]=a[A];o.queue.writeBuffer(he,0,u);let g=Math.ceil(n/8),R=e.beginComputePass({label:l.brushPass});R.setPipeline(pt),R.setBindGroup(0,L?en:Jr),R.dispatchWorkgroups(g,g),R.end()}function si(){let e=L?U:F,t=Bt(),r;try{r=o.createBuffer({label:l.gridReadbackBuffer,size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=o.createCommandEncoder({label:l.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,r,0,t),o.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function ln(){if(p=Bt(),!O()){P=0;return}let e=oi();P=Math.max(1,Math.floor(e/p))}function oi(){return p>=Or?p:Math.min(Math.max(Or,p),Ke())}function dn(){if(P<1||p<=0)return Dr;let e=Math.max(p,P*p),t=Math.floor(Dn/e);return Math.max(1,Math.min(Dr,t||1))}function nr(){let e=O();self.postMessage({type:"limits",maxBytes:Ce(),vramBudgetBytes:an(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:$n(),vramRecordingBytes:zn(),gridFormat:ae()})}function ze(){return!O()||P<1||G===null||J.length===0||fe>=dn()?!1:y<P?!0:J.some((e,t)=>z[t]&&e.mapState==="unmapped")}function qe(e){if(P<1||G===null||y>=P)return;let t=L?U:F,r=y*p,n=o.createCommandEncoder({label:l.recordingFrameCopyEncoder});n.copyBufferToBuffer(t,0,G,r,p),o.queue.submit([n.finish()]),B.push(e),y++}function Mt(){if(G===null||y===0||J.length===0)return;let e=z.indexOf(!0);if(e<0)return;z[e]=!1;let t=J[e];if(t.mapState!=="unmapped"){z[e]=!0;return}let r=y*p,n=tn++,i=[...B],s=i[0],a=i[i.length-1],d=`chunk-${String(n).padStart(6,"0")}.bin`,f=y,u=o.createCommandEncoder({label:l.recordingSealCopyEncoder});u.copyBufferToBuffer(G,0,t,0,r),o.queue.submit([u.finish()]);let v={chunkId:n,generationStart:s,generationEnd:a,blockCount:f,codec:Pt,uncompressedBytes:r,storedBytes:r,gridFormat:ae(),generations:i,filename:d};Kt(1),fe++,Se();let c=Ie;t.mapAsync(GPUMapMode.READ).then(async()=>{let g=t.getMappedRange(),R=new ArrayBuffer(r);new Uint8Array(R).set(new Uint8Array(g,0,r)),t.unmap(),c===Ie&&(z[e]=!0,Se(),C.push(v),fr(),ai(v,R).then(()=>{c===Ie&&(fe--,Se(),Kt(-1),ye(),self.postMessage({type:"chunkSealed",filename:v.filename,rawBytes:r,blockCount:v.blockCount,cols:m,rows:b,rawGridFormat:v.gridFormat,storageGridFormat:Te(Dt(Oe.tribes.length))}),$e&&Z===0&&($e=!1,pn()))}))}).catch(()=>{c===Ie&&(z[e]=!0,fe--,Se(),Kt(-1))}),y=0,B=[]}function fr(){C.length>0&&(Y.generationStart=C[0].generationStart,Y.generationEnd=C[C.length-1].generationEnd),B.length>0&&(C.length===0&&(Y.generationStart=B[0]),Y.generationEnd=B[B.length-1]),Y.chunks=[...C]}async function qr(e){Ie++,tn=0,y=0,B=[],C=[],fe=0,Z>0&&(Z=0,self.postMessage({type:"chunksSaving",active:!1})),w&&(w=!1,self.postMessage({type:"backpressure",active:!1})),$e=!1,H=I,Y={chunks:[],generationStart:e,generationEnd:e,gridFormat:ae()},await fn(),ye()}async function pr(){return ce&&await ce,Fe||(Fe=await(await navigator.storage.getDirectory()).getDirectoryHandle(bt,{create:!0})),Fe}async function ai(e,t){let i=await(await(await pr()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function ui(e){let t=await pr();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function fn(){if(ce){await ce;return}ce=(async()=>{let e=await navigator.storage.getDirectory();Fe=null;try{await e.removeEntry(bt,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${bt}:`,t)}Fe=await e.getDirectoryHandle(bt,{create:!0})})();try{await ce}finally{ce=null}}function pn(){fr(),self.postMessage({type:"recording",manifest:{chunks:C.map(e=>({...e,generations:[...e.generations]})),generationStart:Y.generationStart,generationEnd:Y.generationEnd,gridFormat:ae()},cols:m,rows:b})}function ci(){return y>0?B[y-1]!==M:C.length>0?C[C.length-1].generationEnd!==M:!0}function De(e=!1){if(I){if(e){if(H){if(!ze())return;H=!1}}else if(H)return;!ci()||!ze()||(y>=P&&Mt(),qe(M))}}function gr(){if(!gt)return;let e=gt;gt=null;let t=o.createCommandEncoder({label:l.brushEncoder});ii(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),o.queue.submit([t.finish()]),I&&y>0&&B[y-1]===M&&(y--,B.pop(),qe(M))}async function li(e,t=Pt){let s=await(await(await(await pr()).getFileHandle(e)).getFile()).arrayBuffer();return t===nn?Kn(s):s}function di(){let e=y;for(let t of C)e+=t.blockCount;return e}function gn(){return vr(m,b,Ne.enabled,Ne.sections)}function fi(){return Er(gn())}function le(e){mt=fi(),oe&&mt.length!==0&&Ar({device:o,encoder:e,resources:oe,sourceBuffer:L?U:F,dispatchPlan:Xt,enabledSections:mt})}function de(){let e=M;if(!oe||e===V||$)return;let t=oe,r=[...mt],n=gn();V=e,$=!0,Ir({resources:t,enabledSections:r}).then(i=>{let s=se.get(Je)??0,a=di(),d=Lr({generation:e,tribes:Q,deadTribeIndex:s,readback:i,enabledSections:r,availability:n,liveMetricSettings:Ne.sections,cols:m,rows:b,totalFrames:a,fps:cr,canStepBack:a>1,recordingBytes:C.reduce((f,u)=>f+u.storedBytes,0),recordingRawBytes:C.reduce((f,u)=>f+u.uncompressedBytes,0)});if($=!1,self.postMessage(d),X)if(X=!1,V=-1,hn()){let f=o.createCommandEncoder({label:l.interactiveMetricsEncoder});le(f),o.queue.submit([f.finish()]),de()}else X=!0}).catch(()=>{$=!1})}function pi(){let e=m*b;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function gi(){let e=m*b;return e>1e7?2:e>1e6?4:e>1e5?8:16}function mn(e){if(e<=0)return;let t=vt,r=o.createCommandEncoder({label:l.simulationBatchEncoder});for(let n=0;n<e;n++){let i=r.beginComputePass({label:l.simulationStepPass});i.setPipeline(Ge),i.setBindGroup(0,L?ar:or),i.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),i.end(),L=!L,M++}o.queue.submit([r.finish()]),_e+=e}function mi(){self.postMessage({type:"generation",generation:M,fps:cr})}function mr(){let e=o.createCommandEncoder({label:l.simulationSingleStepEncoder}),t=e.beginComputePass({label:l.simulationStepPass});t.setPipeline(Ge),t.setBindGroup(0,L?ar:or);let r=vt;t.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),t.end(),o.queue.submit([e.finish()]),L=!L,M++}function ie(){ti();let e=qt.getCurrentTexture().createView(),t=o.createCommandEncoder({label:l.renderEncoder}),r=t.beginRenderPass({label:l.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(yt),r.setBindGroup(0,L?jr:Hr),r.draw(3),r.end(),o.queue.submit([t.finish()])}function bn(e){dt===0&&(dt=e);let t=e-dt;t>=1e3&&(cr=_e/(t/1e3),_e=0,dt=e)}function br(){return I&&O()?"recording":"nonRecording"}function bi(){return ne<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/ne}}function ue(e){return e.request.stopCondition.kind==="targetGeneration"}function Xe(e){return e.request.stopCondition.kind==="targetGeneration"&&M>=e.request.stopCondition.generation}function Tt(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-M)}function hn(){return!!(o&&oe&&!W&&!K)}function hr(e=!1){if(e&&(V=-1),!hn())X=!0;else if($)X=!0;else{let t=o.createCommandEncoder({label:l.interactiveMetricsEncoder});le(t),o.queue.submit([t.finish()]),de()}}function Sn(){hr(!0),ie()}function xt(e,t){if(!t)return;(e-zt>=1e3||zt===0)&&!$&&(zt=e,hr())}function Ye(e,t){e.request.pacing.kind!=="max"&&!ue(e)||t-e.lastProgressTime>=1e3&&(e.lastProgressTime=t,mi())}function Sr(){w&&(w=!1,self.postMessage({type:"backpressure",active:!1}))}function hi(){w||(w=!0,self.postMessage({type:"backpressure",active:!0}))}function yn(){return ze()?(y>=P&&Mt(),ze()):!1}function we(){W||K||_||self.requestAnimationFrame(ir)}function ge(e){let t=_;if(!t||t.pumpPending||W||K)return;let{token:r}=t;t.pumpPending=!0;let n=()=>{!_||_.token!==r||(_.pumpPending=!1,Mi(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?o.queue.onSubmittedWorkDone().then(n).catch(()=>{_?.token===r&&(_.pumpPending=!1)}):queueMicrotask(n)}function yr(e,t){_&&k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),_={kind:e,request:t,token:++rn,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0},ge(t.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function re(){x&&yr(br(),{pacing:bi(),stopCondition:{kind:"none"}})}function k(e,t={}){let r=_;if(!r)return;_=null,rn++;let n=ue(r),i=t.restore!==!1&&!!r.request.restoreAfterStop;i&&r.request.restoreAfterStop&&(x=r.request.restoreAfterStop.running,ne=r.request.restoreAfterStop.targetStepDuration),n&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?Sr():w&&Se(),t.render!==!1&&!W&&!K&&Sn(),t.restartRestoredRun!==!1&&i&&x&&!W&&!K?re():we()}function Xr(e){let t=_;!t||!ue(t)||(t.request.restoreAfterStop&&(t.request.restoreAfterStop.running=e),k("cancelled"))}function Si(e){k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),yr(br(),e)}function _n(e,t,r){hi(),Ye(e,t),xt(t,r),ge("drain")}function yi(e,t){let r=pi(),n=gi(),i=!1;for(let s=0;s<n;s++){let a=Tt(e);if(a<=0)break;let d=Math.min(r,a);mn(d),i=!0}if(Ye(e,t),Xe(e)){k("targetReached");return}ge(i?"drain":"raf")}function _i(e,t){De(!0);let r=!1,n=performance.now()+14;for(;Tt(e)>0&&performance.now()<n;){if(!yn()){_n(e,t,r);return}mr(),_e++,r=!0,qe(M)}if(Sr(),Ye(e,t),xt(t,r),Xe(e)){k("targetReached");return}ge("raf")}function Ci(e,t,r){e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=Math.floor(e.stepAccumulator/t),s=Math.min(i,Tt(e)),a=s>0;if(a&&(mn(s),e.stepAccumulator-=t*s),Ye(e,r),Xe(e)){k("targetReached");return}ue(e)||(ie(),xt(r,a)),ge("raf")}function Ri(e,t,r){De(!0),e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=!1;for(;e.stepAccumulator>=t&&Tt(e)>0;){if(!yn()){_n(e,r,i);return}mr(),_e++,e.stepAccumulator-=t,i=!0,qe(M)}if(Sr(),Ye(e,r),Xe(e)){k("targetReached");return}ue(e)||(ie(),xt(r,i)),ge("raf")}function Mi(e){let t=_;if(!t||W||K)return;if(bn(e),ue(t)||gr(),Xe(t)){k("targetReached");return}if(t.request.pacing.kind==="max"){t.kind==="recording"?_i(t,e):yi(t,e);return}let r=1e3/t.request.pacing.genPerSecond;t.kind==="recording"?Ri(t,r,e):Ci(t,r,e)}function ir(e){if(W||K){self.requestAnimationFrame(ir);return}bn(e),!_&&(gr(),ne>0&&!Ae&&ie(),self.requestAnimationFrame(ir))}function vi(e,t){let r=o?Ce():Number.POSITIVE_INFINITY;return Gr(t.bitsPerCell)&&Ft(t.bitsPerCell,e.tribes.length)&&Ut(e,Be(t.bitsPerCell),r)?Be(t.bitsPerCell):Fr(e.tribes.length,e,r)}function Yr(e,t){Oe=e,m=e.cols,b=e.rows,S=vi(e,t),sr=xe(m,S),Q=[...e.tribes],Y.gridFormat=ae(),se.clear(),Q.forEach((r,n)=>se.set(r.id,n))}async function Cn(e){console.log("[GOLT worker] Initializing WebGPU"),pe=e;let t=await navigator.gpu.requestAdapter();if(!t)throw console.error("[GOLT worker] WebGPU adapter not available"),new Error("WebGPU adapter not available");o=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),K=!1,o.lost.then(n=>{let i=n.message||n.reason||"unknown";console.error("[GOLT worker] GPU device lost:",i),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),K=!0,x=!1,W=!0,self.postMessage({type:"deviceLost",reason:i})}),self.postMessage({type:"limits",maxBytes:Ce(),vramBudgetBytes:an(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:ae()});let r=pe.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");qt=r,ft=navigator.gpu.getPreferredCanvasFormat(),qt.configure({device:o,format:ft,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:ft,maxBufferSize:o.limits.maxBufferSize,maxStorageBufferBindingSize:o.limits.maxStorageBufferBindingSize})}async function Ei(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Cn(pe),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let t=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",t),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),K=!0,x=!1,W=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function Rn(){G=o.createBuffer({label:l.recordingChunkBuffer,size:P*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Ct(P*p,G),y=0,B=[]}async function Mn(){let e=P*p;J=[],z=[];for(let t=0;t<Et;t++){let r=o.createBuffer({label:`${l.recordingStagingBuffer} ${t}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});J.push(r),z.push(!0),await Ct(e,r)}}async function Pi(){await fn()}async function Bi(){console.log("[GOLT worker] Building GPU resources",{cols:m,rows:b,bitsPerCell:S.bitsPerCell,recordingAvailable:O()}),jt(),ln(),await Vt(),Zt(),Qt(),Jt(),er(),rr(),tr(),await Pi(),O()?(await Rn(),await Mn()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:p,maxRecordingBufferBytes:Ke()}),Rt(),I=!1,H=!1),await _t(),nr(),console.log("[GOLT worker] GPU resources ready")}async function Ti(){console.log("[GOLT worker] Rebuild started",{cols:m,rows:b,bitsPerCell:S.bitsPerCell}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),W=!0,self.postMessage({type:"rebuilding",active:!0});try{await ur()}catch{}if(K&&!await Ei())return!1;$r(),jt(),ln(),Nr(O());try{await Vt(),Zt(),Qt(),er(),rr(),Jt(),tr(),O()?(await Rn(),await Mn()):(Rt(),I=!1,H=!1),await _t(),nr()}catch(e){let t=e instanceof Error?e.message:String(e);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{$r(),jt(),Nr(!1),await Vt(),Zt(),Qt(),er(),rr(),Jt(),tr(),I=!1,H=!1,p=Bt(),Rt(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await _t(),nr()}catch(r){return console.error("[GOLT worker] GPU rebuild recovery failed:",r),!1}}return W=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:O(),frameByteSize:p}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(console.log("[GOLT worker] Init message received",{cols:t.ruleset.cols,rows:t.ruleset.rows,recording:t.recording,running:t.running,speed:t.speed}),I=t.recording,Ne=$t(t.liveMetrics),H=I,Yr(t.ruleset,t.simulationGridFormat),await Cn(t.canvas),await Bi(),$)X=!0;else{let r=o.createCommandEncoder({label:l.interactiveMetricsEncoder});le(r),o.queue.submit([r.finish()]),de()}ye(),x=t.running,ne=t.speed<0?0:1e3/t.speed,x?re():we();break}case"setLiveMetrics":{Ne=$t(t.liveMetrics),V=-1,hr(!0);break}case"setRuleset":{if(console.log("[GOLT worker] Ruleset update received",{cols:t.ruleset.cols,rows:t.ruleset.rows,tribes:t.ruleset.tribes.length}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Yr(t.ruleset,t.simulationGridFormat),!await Ti())break;if(M=0,V=-1,await qr(0),x?re():we(),$)X=!0;else{let n=o.createCommandEncoder({label:l.interactiveMetricsEncoder});le(n),o.queue.submit([n.finish()]),de()}break}case"setRunning":if(x=t.running,t.running){_||re();break}_&&ue(_)?Xr(!1):_?k("manual"):(w&&Se(),Sn(),we());break;case"setSpeed":{let r=ne<=0,n=t.speed<0?0:1e3/t.speed;ne=n,_&&!ue(_)&&x?(k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&n>0?(Ae=!0,o.queue.onSubmittedWorkDone().then(()=>{Ae=!1,ie(),re()})):re()):x&&!_?re():r&&n>0&&(Ae=!0,o.queue.onSubmittedWorkDone().then(()=>{Ae=!1,ie(),we()}));break}case"camera":Vr=t.scale,Zr=t.offsetX,Qr=t.offsetY;break;case"resize":pe.width=t.width,pe.height=t.height;break;case"draw":{let r=t.tribes.map(n=>se.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};gt={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{si().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:M,cols:m,rows:b,gridFormat:ae()})}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:M,cols:m,rows:b,gridFormat:ae()})});break}case"loadSnapshot":{let r=L?U:F,n=Ot(t.gridFormat),i=ke({cols:m,rows:b},n);if(t.grid.byteLength!==i)break;let s=n.bitsPerCell===S.bitsPerCell?t.grid:Wt(Nt(t.grid,{cols:m,rows:b},n),{cols:m,rows:b},S);o.queue.writeBuffer(r,0,s),M=t.generation,await qr(t.generation);break}case"setRecording":{let r=_?.request;if(t.recording&&O()&&!I){if(I=!0,H=!0,V=-1,$)X=!0;else{let n=o.createCommandEncoder({label:l.interactiveMetricsEncoder});le(n),o.queue.submit([n.finish()]),de()}ye()}else(!t.recording||!O())&&(t.recording&&!O()&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:p,maxRecordingBufferBytes:Ke()}),I=!1,H=!1);r&&_?Si(r):!_&&x&&re();break}case"getRecording":{if($e)break;await ur(),De(!1),y>0&&Mt(),Z>0?$e=!0:pn();break}case"stepBack":{let r=0;for(let d of C)r+=d.blockCount;let n=r+y,i=Math.min(t.count,n-1);if(i<=0)break;let s=n-1-i,a=L?U:F;if(s>=r){let d=s-r;y=d+1,B.length=y,M=B[d];let f=o.createCommandEncoder({label:l.recordingRestoreCopyEncoder});f.copyBufferToBuffer(G,d*p,a,0,p),o.queue.submit([f.finish()])}else{if(Z>0){await new Promise(h=>{let T=setInterval(()=>{Z===0&&(clearInterval(T),h())},10)}),r=0;for(let h of C)r+=h.blockCount}let d=0,f=0,u=0;for(let h=0;h<C.length;h++){let T=C[h];if(s<d+T.blockCount){f=h,u=s-d;break}d+=T.blockCount}let v=C[f],c=await li(v.filename,v.codec),g=Ot(v.gridFormat),R=ke({cols:m,rows:b},g);if(g.bitsPerCell===S.bitsPerCell){let h=(u+1)*p;o.queue.writeBuffer(G,0,new Uint8Array(c,0,h))}else{let h=new Uint8Array((u+1)*p);for(let T=0;T<=u;T++){let j=T*R,He=new Uint8Array(c,j,R),je=Ur(He,{cols:m,rows:b},g),me=Wt(je,{cols:m,rows:b},S);h.set(new Uint8Array(me.buffer,me.byteOffset,me.byteLength),T*p)}o.queue.writeBuffer(G,0,h),o.queue.writeBuffer(a,0,h.subarray(u*p,(u+1)*p))}if(y=u+1,B=v.generations.slice(0,u+1),M=B[u],g.bitsPerCell===S.bitsPerCell){let h=o.createCommandEncoder({label:l.recordingRestoreCopyEncoder});h.copyBufferToBuffer(G,u*p,a,0,p),o.queue.submit([h.finish()])}let D=C.splice(f).map(h=>h.filename);ui(D)}if(fr(),ye(),V=-1,$)X=!0;else{let d=o.createCommandEncoder({label:l.interactiveMetricsEncoder});le(d),o.queue.submit([d.finish()]),de()}ie();break}case"stepForward":{if(gr(),t.count===1){if(De(!0),mr(),_e++,I&&ze()&&(y>=P&&Mt(),qe(M)),V=-1,$)X=!0;else{let r=o.createCommandEncoder({label:l.interactiveMetricsEncoder});le(r),o.queue.submit([r.finish()]),de()}ie()}else self.postMessage({type:"stepping",active:!0}),De(!0),yr(br(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:M+t.count},restoreAfterStop:{running:x,targetStepDuration:ne}});break}case"cancelStepping":{Xr(_?.request.restoreAfterStop?.running??x);break}case"updateChunkCodec":{let r=C.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,Y.chunks=[...C],ye());break}case"getUncompressedChunks":{let r=C.filter(n=>n.codec===Pt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:m,rows:b,rawGridFormat:n.gridFormat,storageGridFormat:Te(Dt(Oe.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
