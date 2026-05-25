var l={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer"};var vr=4294967295;function q(e,t){return e.includes(t)}function It(e,t){return e?t?"ok":"tooLarge":"disabled"}function Br(e,t,r,n){let i=e*t,o=i<=vr,a=i*2<=vr;return{population:It(r&&n.population,o),diversity:It(r&&n.diversity,o),interfaces:It(r&&n.interfaces,a)}}function Mr(e){let t=[];return e.population==="ok"&&t.push("population"),e.diversity==="ok"&&t.push("diversity"),e.interfaces==="ok"&&t.push("interfaces"),t}var Me=256*Uint32Array.BYTES_PER_ELEMENT,Te=Uint32Array.BYTES_PER_ELEMENT;function Tr(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function kr(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function xr(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function kn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${Tr(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${kr(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${xr(i)}
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
`}function xn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${Tr(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${kr(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${xr(i)}
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
`}function Ar(e){let{device:t}=e,r=t.createShaderModule({label:l.histogramMetricsShaderModule,code:kn(e)}),n=t.createComputePipeline({label:l.histogramMetricsPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),i=t.createBuffer({label:l.histogramMetricsBuffer,size:Me,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=t.createBuffer({label:l.histogramMetricsReadBuffer,size:Me,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),a=t.createShaderModule({label:l.interfaceMetricsShaderModule,code:xn(e)}),c=t.createComputePipeline({label:l.interfaceMetricsPipeline,layout:"auto",compute:{module:a,entryPoint:"main"}}),f=t.createBuffer({label:l.interfaceMetricsBuffer,size:Te,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),d=t.createBuffer({label:l.interfaceMetricsReadBuffer,size:Te,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:c,boundaryBuffer:f,boundaryReadBuffer:d}}function Ir(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function wr(e){let{device:t,encoder:r,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:a}=e;if(q(a,"population")||q(a,"diversity")){let c=new Uint32Array(256);t.queue.writeBuffer(n.histogramBuffer,0,c);let f=t.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),d=r.beginComputePass({label:l.histogramMetricsPass});d.setPipeline(n.histogramPipeline),d.setBindGroup(0,f),d.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),d.end(),r.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Me)}if(q(a,"interfaces")){let c=new Uint32Array([0]);t.queue.writeBuffer(n.boundaryBuffer,0,c);let f=t.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),d=r.beginComputePass({label:l.interfaceMetricsPass});d.setPipeline(n.boundaryPipeline),d.setBindGroup(0,f),d.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),d.end(),r.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Te)}}async function Lr(e){let{resources:t,enabledSections:r}=e,n=q(r,"population")||q(r,"diversity"),i=q(r,"interfaces"),o=[];n&&o.push(t.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(t.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let a=new Uint32Array(256);n&&(a=new Uint32Array(t.histogramReadBuffer.getMappedRange().slice(0)),t.histogramReadBuffer.unmap());let c=0;if(i){let f=new Uint32Array(t.boundaryReadBuffer.getMappedRange().slice(0));t.boundaryReadBuffer.unmap(),c=f[0]??0}return{histogram:a,crossStateContactEdges:c}}function Gr(e){let{generation:t,tribes:r,deadTribeIndex:n,readback:i,enabledSections:o,availability:a,liveMetricSettings:c,cols:f,rows:d,totalFrames:v,fps:u,canStepBack:m,recordingBytes:R,recordingRawBytes:A}=e,D=q(o,"population")&&c.population,g=q(o,"diversity")&&c.diversity,T=q(o,"interfaces")&&c.interfaces,j={},Ve=0,he=0,Cr={},ve=0,Ze=f*d;for(let B=0;B<r.length;B++){let ee=D?i.histogram[B]??0:0;j[r[B].id]=ee,B!==n&&(ve+=ee)}if(g){ve=0;for(let B=0;B<r.length;B++)B!==n&&(ve+=i.histogram[B]??0)}if(g&&ve>0){for(let B=0;B<r.length;B++)if(B!==n){let ee=(i.histogram[B]??0)/ve;ee>0&&(Ve-=ee*Math.log2(ee),he+=ee*ee)}}for(let B=0;B<r.length;B++)B!==n&&(Cr[r[B].id]=0);let Pr=D?j[r[n]?.id??""]??0:0,Rr=D?Math.max(0,Ze-Pr):0,Be=Ze*2,At=T?i.crossStateContactEdges:0,Er=T?Math.max(0,Be-At):0,Tn={sameStateContactEdges:Er,crossStateContactEdges:At,sameStateContactFraction:T&&Be>0?Er/Be:0,crossStateContactFraction:T&&Be>0?At/Be:0};return{type:"metrics",generation:t,population:j,aliveCells:Rr,deadCells:Pr,occupancy:D&&Ze>0?Rr/Ze:0,shannonEntropy:Ve,simpsonIndex:g?1-he:0,interfaces:Tn,metricsAvailability:a,extinctionTime:Cr,totalFrames:v,fps:u,canStepBack:m,recordingBytes:R,recordingRawBytes:A}}var Fr=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var wt=[1,2,4,8,16,32],In={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},wn={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Ln={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Qe={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Gn={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},Lt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},te={1:In,2:wn,4:Ln,8:Qe,16:Gn,32:Lt};var ke={population:!0,diversity:!0,interfaces:!1},Je={enabled:!0,sections:ke};var Gt="any",et="dead";var tt="empty",rt="is",Ft="comparison",nt="count",it="none",ot="exactly",st="min",at="max",ct="not",ut="and",lt="or",dt="xor";function Ur(e){return wt.includes(e)}function Fn(e){return 2**e}function Ut(e,t){return t<=Fn(e)}function Dt(e,t,r){return le(e,t)<=r}function Ot(e){return e<=2?te[1]:e<=4?te[2]:e<=16?te[4]:e<=256?te[8]:e<=65536?te[16]:te[32]}function xe(e){return te[e]}function Dr(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of wt){let i=xe(n);if(Ut(n,e)&&Dt(t,i,r))return i}return Lt}function Wt(e){return xe(e?.bitsPerCell??8)}function Ae(e){return{bitsPerCell:e.bitsPerCell}}function ue(e,t){return Math.ceil(e/t.cellsPerWord)}function le(e,t){return ue(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Or(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function Un(e){return{population:typeof e?.population=="boolean"?e.population:ke.population,diversity:typeof e?.diversity=="boolean"?e.diversity:ke.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:ke.interfaces}}function Nt(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Je.enabled,sections:Un(e?.sections)}}function Wr(e,t,r,n,i){let o=ue(t.cols,r);return(e[i*o+(n>>r.wordShift)]??0)>>>((n&r.cellIndexMask)<<r.cellShift)&r.cellMask}function Nr(e,t,r,n,i,o){let a=ue(t.cols,r),c=i*a+(n>>r.wordShift),f=(n&r.cellIndexMask)<<r.cellShift,d=~(r.cellMask<<f),v=e[c]??0;e[c]=(v&d|(o&r.cellMask)<<f)>>>0}var to=32*1024*1024;function $t(e,t,r,n){let i=e,o;if(r.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(le(t,n)/Uint32Array.BYTES_PER_ELEMENT);for(let a=0;a<t.rows;a++)for(let c=0;c<t.cols;c++)Nr(o,t,n,c,a,Wr(i,t,r,c,a))}return o}var s,K=!1,Xt,pt,ge,We,h=0,S=0,ar=0,y=Qe,Q=[],oe=new Map,Et,Ht,F,U,Ne,Se,_t,Qr,Jr,Fe,cr,ur,w=!1,en=1,tn=0,rn=0,k=!1,W=!1,ne=100,E=0,mt,ye,nn,on,Wn=0,gt=null,se=null,V=-1,$=!1,Y=!1,zt=0,$e=Je,bt=[],I=!1,H=!1,X={chunks:[],generationStart:0,generationEnd:0,gridFormat:Ae(Qe)},sn=0,C=[],_=null,an=0,Ie=!1,G=null,b=0,M=[],P=64,p=0,vt=3,J=[],z=[],ht="gol-recording",Bt="raw-packed",cn="deflate-raw",Ue=null,de=null,Z=0,ze=0,me=0,$r=12,L=!1,we=0,un=256,Nn=un*Uint32Array.BYTES_PER_ELEMENT,zr=256*1024*1024,$n=512*1024*1024,Kr=128*1024*1024*1024,St=0,yt=0,De=[];function zn(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function ln(e){console.error("[GOLT worker] Worker GPU error:",e),x("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),k=!1,self.postMessage({type:"gpuError",reason:zn(e)})}self.addEventListener("error",e=>{e.preventDefault(),ln(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),ln(e.reason)});async function lr(){await s.queue.onSubmittedWorkDone()}function qr(e){St=0,yt=2+(e?1+vt:0),De=[]}async function Ct(){if(De.length===0)return;let e=s.createCommandEncoder({label:l.trackedAllocationClearEncoder});for(let t of De)e.clearBuffer(t);s.queue.submit([e.finish()]),await lr(),De=[]}async function Pt(e,t){!W||yt<=0||(St+=e,yt--,De.push(t),St>=Kn()&&yt>0&&(await Ct(),St=0))}function Kn(){return Math.min(Ee(),$n)}function Ee(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function Ye(){return Math.min(Ee(),1073741824)}function dn(){return Math.max(Ee()*2,Ye()*6)}function O(){return p>0&&p<=Ye()}function qn(){return p<=0?0:p*2+fr+Nn+pr+Me*2+Te*2}function Yn(){return P<1||p<=0?0:P*p*(1+vt)}function Rt(){G?.destroy(),G=null;for(let e of J)e?.destroy();J=[],z=[],P=0,b=0,M=[],ze=0}function Yr(){F?.destroy(),U?.destroy(),Ir(se),se=null,ye?.destroy(),Rt()}function Kt(e){let t=Z>0;Z+=e;let r=Z>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function _e(){if(P<1||J.length===0){L&&(L=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=gn(),t=!z.some(i=>i)&&b>=P,r=me>=e,n;if(L){let i=z.some(a=>a),o=me<=Math.floor(e/2);n=!(i&&o)}else n=t||r;n!==L&&(L=n,self.postMessage({type:"backpressure",active:n}))}async function Ce(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??Kr/128,Kr),r=e.usage??0,n=0,i=0;for(let c of C)c.codec===Bt?n+=c.storedBytes:i+=c.storedBytes;let o=P*p,a=I?(1+vt)*o:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:a})}var Ke=!1;async function Xn(e){let t=new DecompressionStream(cn),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:f,value:d}=await i.read();if(f)break;n.push(d)}let o=0;for(let f of n)o+=f.byteLength;let a=new Uint8Array(o),c=0;for(let f of n)a.set(f,c),c+=f.byteLength;return a.buffer}var Pe=0,ft=0,dr=0;function fn(e,t,r=s.limits.maxComputeWorkgroupsPerDimension){if(e<=r&&t<=r)return{logicalWgX:e,logicalWgY:t,dispatchWgX:e,dispatchWgY:t,remapped:!1};let n=e*t,i=Math.min(n,r),o=Math.ceil(n/i);if(o>r)throw new Error(`Grid requires ${e}x${t} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${r}.`);return{logicalWgX:e,logicalWgY:t,dispatchWgX:i,dispatchWgY:o,remapped:!0}}function Hn(){return fn(Math.ceil(ar/16),Math.ceil(S/16))}function jn(){return fn(Math.ceil(h/16),Math.ceil(S/16))}function Vn(e,t){t.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${t.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${t.dispatchWgX}u;`))}function Zn(e){e.push(`const CELLS_PER_WORD: u32 = ${y.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${y.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${y.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${y.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${y.cellMask}u;`)}function Qn(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Jn(e,t,r){if(t.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${r} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${r} = gid.x;`),e.push("  let y = gid.y;")}function ei(){let e=[],t=ar,r=Et;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${Q.map(u=>u.id).join(", ")}`),e.push(`// Rules: ${We.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${h}u;`),e.push(`const ROWS: u32 = ${S}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),Vn(e,r),Zn(e),e.push(""),Qn(e,"gridIn","PACKED_COLS"),e.push("");let n=oe.get(et)??0,i=We.rules.filter(u=>!u.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let o=ri(i.map(u=>u.clause)),a=new Map,c=0;for(let u of o){let m=`count_${c++}`;a.set(u,m)}for(let[u,m]of a){let R=u.split(",").map(Number),D=Xr().map(g=>`select(0u, 1u, ${R.map(j=>`${g} == ${j}u`).join(" || ")})`);e.push(`  let ${m} = ${D.join(" + ")};`)}o.size>0&&e.push("");let f=ni(i.map(u=>u.clause)),d=new Map,v=0;for(let u of f)if(a.has(u))d.set(u,a.get(u));else{let m=`eq_count_${v++}`;d.set(u,m)}for(let[u,m]of d){if(a.has(u))continue;let R=u.split(",").map(Number),D=Xr().map(g=>`select(0u, 1u, ${R.map(j=>`${g} == ${j}u`).join(" || ")})`);e.push(`  let ${m} = ${D.join(" + ")};`)}f.size>0&&v>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let u=0;u<i.length;u++){let m=i[u],R=Le(m.clause,a,d),A=ti(m.tribe);u===0?e.push(`  if (${R}) {`):e.push(`  } else if (${R}) {`),e.push(`    result = ${A}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),r.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),Jn(e,r,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let u=-1;u<=1;u++)for(let m=-1;m<=1;m++){if(m===0&&u===0)continue;let R=pn(m,u),A=Hr("x",m,"COLS"),D=Hr("y",u,"ROWS");e.push(`    let ${R} = readCell(${A}, ${D});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function pn(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function Xr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(pn(r,t));return e}function Hr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function N(e){let t=[];for(let r of e)if(r===Gt)for(let n=0;n<Q.length;n++)t.push(n);else{let n=oe.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function ti(e){return e===Gt?0:oe.get(e)??0}function ri(e){let t=new Set;for(let r of e)jt(r,t);return t}function jt(e,t){switch(e.kind){case tt:case rt:break;case it:case ot:case st:case at:case nt:{let r=N(e.tribes).sort();t.add(r.join(","));break}case ct:jt(e.clause,t);break;case ut:case lt:case dt:for(let r of e.clauses)jt(r,t);break}}function ni(e){let t=new Set;for(let r of e)Vt(r,t);return t}function Vt(e,t){switch(e.kind){case tt:case rt:case nt:case it:case ot:case st:case at:break;case Ft:{let r=N(e.tribe1).sort(),n=N(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case ct:Vt(e.clause,t);break;case ut:case lt:case dt:for(let r of e.clauses)Vt(r,t);break}}function Le(e,t,r){switch(e.kind){case tt:return"false";case rt:{let n=N(e.tribes);return n.length===0?"false":n.length===Q.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case nt:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case it:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case ot:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case st:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case at:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case Ft:{let n=r.get(N(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),o=`(i32(${r.get(N(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${o})`;case">":return`(i32(${n}) > ${o})`;case"<":return`(i32(${n}) < ${o})`;case"\u2265":return`(i32(${n}) >= ${o})`;case"\u2264":return`(i32(${n}) <= ${o})`;default:return`(i32(${n}) == ${o})`}}case ct:return`!(${Le(e.clause,t,r)})`;case ut:return`(${e.clauses.map(i=>Le(i,t,r)).join(" && ")})`;case lt:return`(${e.clauses.map(i=>Le(i,t,r)).join(" || ")})`;case dt:return`(((${e.clauses.map(o=>Le(o,t,r)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var fr=48;function Zt(){Ne?.destroy(),Ne=s.createBuffer({label:l.uniformBuffer,size:fr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function ii(){let e=new ArrayBuffer(fr),t=new Float32Array(e),r=new Uint32Array(e),n=(tn%h+h)%h,i=(rn%S+S)%S,o=Math.floor(n),a=Math.floor(i);t[0]=ge.width,t[1]=ge.height,t[2]=en,t[4]=n-o,t[5]=i-a,r[6]=h,r[7]=S,r[8]=o,r[9]=a,r[10]=Q.length,s.queue.writeBuffer(Ne,0,e)}function Mt(){return le({cols:h,rows:S},y)}function ae(){return Ae(y)}async function Qt(){let e=Mt();F=s.createBuffer({label:l.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Pt(e,F),U=s.createBuffer({label:l.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Pt(e,U);let t=s.createCommandEncoder({label:l.gridClearEncoder});t.clearBuffer(F),t.clearBuffer(U),s.queue.submit([t.finish()]),w=!1}function Jt(){let e=new Uint32Array(un);for(let t=0;t<Q.length;t++){let r=Q[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),o=parseInt(r.substring(4,6),16);e[t]=n|i<<8|o<<16}Se&&Se.destroy(),Se=s.createBuffer({label:l.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(Se,0,e)}function oi(){return Fr.replace("__CELLS_PER_WORD__",`${y.cellsPerWord}u`).replace("__WORD_SHIFT__",`${y.wordShift}u`).replace("__CELL_SHIFT__",`${y.cellShift}u`).replace("__CELL_INDEX_MASK__",`${y.cellIndexMask}u`).replace("__CELL_MASK__",`${y.cellMask}u`)}function er(){let e=s.createShaderModule({label:l.renderShaderModule,code:oi()});_t=s.createRenderPipeline({label:l.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:pt}]},primitive:{topology:"triangle-list"}})}function tr(){Qr=s.createBindGroup({layout:_t.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ne}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:Se}}]}),Jr=s.createBindGroup({layout:_t.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ne}},{binding:1,resource:{buffer:U}},{binding:2,resource:{buffer:Se}}]})}function rr(){Et=Hn();let e=ei(),t=s.createShaderModule({label:l.simulationShaderModule,code:e});Fe=s.createComputePipeline({label:l.simulationPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),cr=s.createBindGroup({layout:Fe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:U}}]}),ur=s.createBindGroup({layout:Fe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:F}}]})}function nr(){Ht=jn(),se=Ar({device:s,cols:h,rows:S,gridFormat:y,dispatchPlan:Ht})}var pr=176;function si(){return`
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
`}function ir(){let e=s.createShaderModule({label:l.brushShaderModule,code:si()});mt=s.createComputePipeline({label:l.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),ye?.destroy(),ye=s.createBuffer({label:l.brushUniformBuffer,size:pr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),nn=s.createBindGroup({layout:mt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:ye}}]}),on=s.createBindGroup({layout:mt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:ye}}]})}function ai(e,t,r,n,i,o,a){let c=oe.get(et)??0,f=Wn++,d=new ArrayBuffer(pr),v=new Int32Array(d),u=new Uint32Array(d);v[0]=t,v[1]=r,u[2]=h,u[3]=S,u[4]=n,u[5]=i,u[6]=o,u[7]=c,u[8]=f,u[9]=a.length,u[10]=0;for(let A=0;A<a.length&&A<32;A++)u[11+A]=a[A];s.queue.writeBuffer(ye,0,d);let m=Math.ceil(n/8),R=e.beginComputePass({label:l.brushPass});R.setPipeline(mt),R.setBindGroup(0,w?on:nn),R.dispatchWorkgroups(m,m),R.end()}function ci(){let e=w?U:F,t=Mt(),r;try{r=s.createBuffer({label:l.gridReadbackBuffer,size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder({label:l.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function mn(){if(p=Mt(),!O()){P=0;return}let e=ui();P=Math.max(1,Math.floor(e/p))}function ui(){return p>=zr?p:Math.min(Math.max(zr,p),Ye())}function gn(){if(P<1||p<=0)return $r;let e=Math.max(p,P*p),t=Math.floor(536870912/e);return Math.max(1,Math.min($r,t||1))}function or(){let e=O();self.postMessage({type:"limits",maxBytes:Ee(),vramBudgetBytes:dn(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:qn(),vramRecordingBytes:Yn(),gridFormat:ae()})}function Re(){return!O()||P<1||G===null||J.length===0||me>=gn()?!1:b<P?!0:J.some((e,t)=>z[t]&&e.mapState==="unmapped")}function Xe(e){if(P<1||G===null||b>=P)return;let t=w?U:F,r=b*p,n=s.createCommandEncoder({label:l.recordingFrameCopyEncoder});n.copyBufferToBuffer(t,0,G,r,p),s.queue.submit([n.finish()]),M.push(e),b++}function qt(e){ze=Math.max(0,ze+e)}function Yt(){P>0&&b>=P&&Re()&&qe()}function qe(){if(G===null||b===0||J.length===0)return;let e=z.indexOf(!0);if(e<0)return;z[e]=!1;let t=J[e];if(t.mapState!=="unmapped"){z[e]=!0;return}let r=b*p,n=sn++,i=[...M],o=i[0],a=i[i.length-1],c=`chunk-${String(n).padStart(6,"0")}.bin`,f=b,d=s.createCommandEncoder({label:l.recordingSealCopyEncoder});d.copyBufferToBuffer(G,0,t,0,r),s.queue.submit([d.finish()]);let v={chunkId:n,generationStart:o,generationEnd:a,blockCount:f,codec:Bt,uncompressedBytes:r,storedBytes:r,gridFormat:ae(),generations:i,filename:c};Kt(1),qt(f),me++,_e();let u=we;t.mapAsync(GPUMapMode.READ).then(async()=>{let m=t.getMappedRange(),R=new ArrayBuffer(r);new Uint8Array(R).set(new Uint8Array(m,0,r)),t.unmap(),u===we&&(z[e]=!0,C.push(v),qt(-f),mr(),_e(),Yt(),li(v,R).then(()=>{u===we&&(me--,_e(),Kt(-1),Ce(),kt(!0),Yt(),self.postMessage({type:"chunkSealed",filename:v.filename,rawBytes:r,blockCount:v.blockCount,cols:h,rows:S,rawGridFormat:v.gridFormat,storageGridFormat:Ae(Ot(We.tribes.length))}),Ke&&Z===0&&(Ke=!1,hn()))}))}).catch(()=>{u===we&&(z[e]=!0,me--,qt(-f),_e(),Kt(-1),Yt())}),b=0,M=[]}function mr(){C.length>0&&(X.generationStart=C[0].generationStart,X.generationEnd=C[C.length-1].generationEnd),M.length>0&&(C.length===0&&(X.generationStart=M[0]),X.generationEnd=M[M.length-1]),X.chunks=[...C]}async function jr(e){we++,sn=0,b=0,M=[],C=[],ze=0,me=0,Z>0&&(Z=0,self.postMessage({type:"chunksSaving",active:!1})),L&&(L=!1,self.postMessage({type:"backpressure",active:!1})),Ke=!1,H=I,X={chunks:[],generationStart:e,generationEnd:e,gridFormat:ae()},await bn(),Ce()}async function gr(){return de&&await de,Ue||(Ue=await(await navigator.storage.getDirectory()).getDirectoryHandle(ht,{create:!0})),Ue}async function li(e,t){let i=await(await(await gr()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function di(e){let t=await gr();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function bn(){if(de){await de;return}de=(async()=>{let e=await navigator.storage.getDirectory();Ue=null;try{await e.removeEntry(ht,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${ht}:`,t)}Ue=await e.getDirectoryHandle(ht,{create:!0})})();try{await de}finally{de=null}}function hn(){mr(),self.postMessage({type:"recording",manifest:{chunks:C.map(e=>({...e,generations:[...e.generations]})),generationStart:X.generationStart,generationEnd:X.generationEnd,gridFormat:ae()},cols:h,rows:S})}function fi(){return b>0?M[b-1]!==E:C.length>0?C[C.length-1].generationEnd!==E:!0}function Oe(e=!1){if(I){if(e){if(H){if(!Re())return;H=!1}}else if(H)return;!fi()||!Re()||(b>=P&&qe(),Xe(E))}}function br(){if(!gt)return;let e=gt;gt=null;let t=s.createCommandEncoder({label:l.brushEncoder});ai(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),I&&b>0&&M[b-1]===E&&(b--,M.pop(),Xe(E))}async function pi(e,t=Bt){let o=await(await(await(await gr()).getFileHandle(e)).getFile()).arrayBuffer();return t===cn?Xn(o):o}function mi(){let e=b+ze;for(let t of C)e+=t.blockCount;return e}function Sn(){return Br(h,S,$e.enabled,$e.sections)}function gi(){return Mr(Sn())}function fe(e){bt=gi(),se&&bt.length!==0&&wr({device:s,encoder:e,resources:se,sourceBuffer:w?U:F,dispatchPlan:Ht,enabledSections:bt})}function pe(){let e=E;if(!se||e===V||$)return;let t=se,r=[...bt],n=Sn();V=e,$=!0,Lr({resources:t,enabledSections:r}).then(i=>{let o=oe.get(et)??0,a=mi(),c=Gr({generation:e,tribes:Q,deadTribeIndex:o,readback:i,enabledSections:r,availability:n,liveMetricSettings:$e.sections,cols:h,rows:S,totalFrames:a,fps:dr,canStepBack:a>1,recordingBytes:C.reduce((f,d)=>f+d.storedBytes,0),recordingRawBytes:C.reduce((f,d)=>f+d.uncompressedBytes,0)});if($=!1,self.postMessage(c),Y)if(Y=!1,V=-1,Cn()){let f=s.createCommandEncoder({label:l.interactiveMetricsEncoder});fe(f),s.queue.submit([f.finish()]),pe()}else Y=!0}).catch(()=>{$=!1})}function bi(){let e=h*S;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function hi(){let e=h*S;return e>1e7?2:e>1e6?4:e>1e5?8:16}function yn(e){if(e<=0)return;let t=Et,r=s.createCommandEncoder({label:l.simulationBatchEncoder});for(let n=0;n<e;n++){let i=r.beginComputePass({label:l.simulationStepPass});i.setPipeline(Fe),i.setBindGroup(0,w?ur:cr),i.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),i.end(),w=!w,E++}s.queue.submit([r.finish()]),Pe+=e}function Si(){self.postMessage({type:"generation",generation:E,fps:dr})}function hr(){let e=s.createCommandEncoder({label:l.simulationSingleStepEncoder}),t=e.beginComputePass({label:l.simulationStepPass});t.setPipeline(Fe),t.setBindGroup(0,w?ur:cr);let r=Et;t.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),t.end(),s.queue.submit([e.finish()]),w=!w,E++}function ie(){ii();let e=Xt.getCurrentTexture().createView(),t=s.createCommandEncoder({label:l.renderEncoder}),r=t.beginRenderPass({label:l.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(_t),r.setBindGroup(0,w?Jr:Qr),r.draw(3),r.end(),s.queue.submit([t.finish()])}function _n(e){ft===0&&(ft=e);let t=e-ft;t>=1e3&&(dr=Pe/(t/1e3),Pe=0,ft=e)}function Sr(){return I&&O()?"recording":"nonRecording"}function yi(){return ne<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/ne}}function ce(e){return e.request.stopCondition.kind==="targetGeneration"}function He(e){return e.request.stopCondition.kind==="targetGeneration"&&E>=e.request.stopCondition.generation}function Tt(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-E)}function Cn(){return!!(s&&se&&!W&&!K)}function kt(e=!1){if(e&&(V=-1),!Cn())Y=!0;else if($)Y=!0;else{let t=s.createCommandEncoder({label:l.interactiveMetricsEncoder});fe(t),s.queue.submit([t.finish()]),pe()}}function Pn(){kt(!0),ie()}function xt(e,t){if(!t)return;(e-zt>=1e3||zt===0)&&!$&&(zt=e,kt())}function je(e,t){e.request.pacing.kind!=="max"&&!ce(e)||t-e.lastProgressTime>=1e3&&(e.lastProgressTime=t,Si())}function yr(){L&&(L=!1,self.postMessage({type:"backpressure",active:!1}))}function _i(){L||(L=!0,self.postMessage({type:"backpressure",active:!0}))}function Rn(){return Re()?(b>=P&&qe(),Re()):!1}function Ge(){W||K||_||self.requestAnimationFrame(sr)}function be(e){let t=_;if(!t||t.pumpPending||W||K)return;let{token:r}=t;t.pumpPending=!0;let n=()=>{!_||_.token!==r||(_.pumpPending=!1,Bi(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?s.queue.onSubmittedWorkDone().then(n).catch(()=>{_?.token===r&&(_.pumpPending=!1)}):queueMicrotask(n)}function _r(e,t){_&&x("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),_={kind:e,request:t,token:++an,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0},be(t.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function re(){k&&_r(Sr(),{pacing:yi(),stopCondition:{kind:"none"}})}function x(e,t={}){let r=_;if(!r)return;_=null,an++;let n=ce(r),i=t.restore!==!1&&!!r.request.restoreAfterStop;i&&r.request.restoreAfterStop&&(k=r.request.restoreAfterStop.running,ne=r.request.restoreAfterStop.targetStepDuration),n&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?yr():L&&_e(),t.render!==!1&&!W&&!K&&Pn(),t.restartRestoredRun!==!1&&i&&k&&!W&&!K?re():Ge()}function Vr(e){let t=_;!t||!ce(t)||(t.request.restoreAfterStop&&(t.request.restoreAfterStop.running=e),x("cancelled"))}function Ci(e){x("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),_r(Sr(),e)}function En(e,t,r){_i(),je(e,t),xt(t,r),be("drain")}function Pi(e,t){let r=bi(),n=hi(),i=!1;for(let o=0;o<n;o++){let a=Tt(e);if(a<=0)break;let c=Math.min(r,a);yn(c),i=!0}if(je(e,t),He(e)){x("targetReached");return}be(i?"drain":"raf")}function Ri(e,t){Oe(!0);let r=!1,n=performance.now()+14;for(;Tt(e)>0&&performance.now()<n;){if(!Rn()){En(e,t,r);return}hr(),Pe++,r=!0,Xe(E)}if(yr(),je(e,t),xt(t,r),He(e)){x("targetReached");return}be("raf")}function Ei(e,t,r){e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=Math.floor(e.stepAccumulator/t),o=Math.min(i,Tt(e)),a=o>0;if(a&&(yn(o),e.stepAccumulator-=t*o),je(e,r),He(e)){x("targetReached");return}ce(e)||(ie(),xt(r,a)),be("raf")}function vi(e,t,r){Oe(!0),e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=!1;for(;e.stepAccumulator>=t&&Tt(e)>0;){if(!Rn()){En(e,r,i);return}hr(),Pe++,e.stepAccumulator-=t,i=!0,Xe(E)}if(yr(),je(e,r),He(e)){x("targetReached");return}ce(e)||(ie(),xt(r,i)),be("raf")}function Bi(e){let t=_;if(!t||W||K)return;if(_n(e),ce(t)||br(),He(t)){x("targetReached");return}if(t.request.pacing.kind==="max"){t.kind==="recording"?Ri(t,e):Pi(t,e);return}let r=1e3/t.request.pacing.genPerSecond;t.kind==="recording"?vi(t,r,e):Ei(t,r,e)}function sr(e){if(W||K){self.requestAnimationFrame(sr);return}_n(e),!_&&(br(),ne>0&&!Ie&&ie(),self.requestAnimationFrame(sr))}function Mi(e,t){let r=s?Ee():Number.POSITIVE_INFINITY;return Ur(t.bitsPerCell)&&Ut(t.bitsPerCell,e.tribes.length)&&Dt(e,xe(t.bitsPerCell),r)?xe(t.bitsPerCell):Dr(e.tribes.length,e,r)}function Zr(e,t){We=e,h=e.cols,S=e.rows,y=Mi(e,t),ar=ue(h,y),Q=[...e.tribes],X.gridFormat=ae(),oe.clear(),Q.forEach((r,n)=>oe.set(r.id,n))}async function vn(e){console.log("[GOLT worker] Initializing WebGPU"),ge=e;let t=await navigator.gpu.requestAdapter();if(!t)throw console.error("[GOLT worker] WebGPU adapter not available"),new Error("WebGPU adapter not available");s=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),K=!1,s.lost.then(n=>{let i=n.message||n.reason||"unknown";console.error("[GOLT worker] GPU device lost:",i),x("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),K=!0,k=!1,W=!0,self.postMessage({type:"deviceLost",reason:i})}),self.postMessage({type:"limits",maxBytes:Ee(),vramBudgetBytes:dn(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:ae()});let r=ge.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");Xt=r,pt=navigator.gpu.getPreferredCanvasFormat(),Xt.configure({device:s,format:pt,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:pt,maxBufferSize:s.limits.maxBufferSize,maxStorageBufferBindingSize:s.limits.maxStorageBufferBindingSize})}async function Ti(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await vn(ge),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let t=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",t),x("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),K=!0,k=!1,W=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function Bn(){G=s.createBuffer({label:l.recordingChunkBuffer,size:P*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Pt(P*p,G),b=0,M=[]}async function Mn(){let e=P*p;J=[],z=[];for(let t=0;t<vt;t++){let r=s.createBuffer({label:`${l.recordingStagingBuffer} ${t}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});J.push(r),z.push(!0),await Pt(e,r)}}async function ki(){await bn()}async function xi(){console.log("[GOLT worker] Building GPU resources",{cols:h,rows:S,bitsPerCell:y.bitsPerCell,recordingAvailable:O()}),Zt(),mn(),await Qt(),Jt(),er(),tr(),rr(),ir(),nr(),await ki(),O()?(await Bn(),await Mn()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:p,maxRecordingBufferBytes:Ye()}),Rt(),I=!1,H=!1),await Ct(),or(),console.log("[GOLT worker] GPU resources ready")}async function Ai(){console.log("[GOLT worker] Rebuild started",{cols:h,rows:S,bitsPerCell:y.bitsPerCell}),x("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),W=!0,self.postMessage({type:"rebuilding",active:!0});try{await lr()}catch{}if(K&&!await Ti())return!1;Yr(),Zt(),mn(),qr(O());try{await Qt(),Jt(),er(),rr(),ir(),tr(),nr(),O()?(await Bn(),await Mn()):(Rt(),I=!1,H=!1),await Ct(),or()}catch(e){let t=e instanceof Error?e.message:String(e);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{Yr(),Zt(),qr(!1),await Qt(),Jt(),er(),rr(),ir(),tr(),nr(),I=!1,H=!1,p=Mt(),Rt(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await Ct(),or()}catch(r){return console.error("[GOLT worker] GPU rebuild recovery failed:",r),!1}}return W=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:O(),frameByteSize:p}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(console.log("[GOLT worker] Init message received",{cols:t.ruleset.cols,rows:t.ruleset.rows,recording:t.recording,running:t.running,speed:t.speed}),I=t.recording,$e=Nt(t.liveMetrics),H=I,Zr(t.ruleset,t.simulationGridFormat),await vn(t.canvas),await xi(),$)Y=!0;else{let r=s.createCommandEncoder({label:l.interactiveMetricsEncoder});fe(r),s.queue.submit([r.finish()]),pe()}Ce(),k=t.running,ne=t.speed<0?0:1e3/t.speed,k?re():Ge();break}case"setLiveMetrics":{$e=Nt(t.liveMetrics),V=-1,kt(!0);break}case"setRuleset":{if(console.log("[GOLT worker] Ruleset update received",{cols:t.ruleset.cols,rows:t.ruleset.rows,tribes:t.ruleset.tribes.length}),x("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Zr(t.ruleset,t.simulationGridFormat),!await Ai())break;if(E=0,V=-1,await jr(0),k?re():Ge(),$)Y=!0;else{let n=s.createCommandEncoder({label:l.interactiveMetricsEncoder});fe(n),s.queue.submit([n.finish()]),pe()}break}case"setRunning":if(k=t.running,t.running){_||re();break}_&&ce(_)?Vr(!1):_?x("manual"):(L&&_e(),Pn(),Ge());break;case"setSpeed":{let r=ne<=0,n=t.speed<0?0:1e3/t.speed;ne=n,_&&!ce(_)&&k?(x("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&n>0?(Ie=!0,s.queue.onSubmittedWorkDone().then(()=>{Ie=!1,ie(),re()})):re()):k&&!_?re():r&&n>0&&(Ie=!0,s.queue.onSubmittedWorkDone().then(()=>{Ie=!1,ie(),Ge()}));break}case"camera":en=t.scale,tn=t.offsetX,rn=t.offsetY;break;case"resize":ge.width=t.width,ge.height=t.height;break;case"draw":{let r=t.tribes.map(n=>oe.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};gt={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{ci().then(r=>{let n={type:"snapshot",grid:r,generation:E,cols:h,rows:S,gridFormat:ae()};self.postMessage(n,[r.buffer])}).catch(()=>{let r=new Uint32Array(0),n={type:"snapshot",grid:r,generation:E,cols:h,rows:S,gridFormat:ae()};self.postMessage(n,[r.buffer])});break}case"loadSnapshot":{let r=w?U:F,n=Wt(t.gridFormat),i=le({cols:h,rows:S},n);if(t.grid.byteLength!==i)break;let o=$t(t.grid,{cols:h,rows:S},n,y);s.queue.writeBuffer(r,0,o),E=t.generation,await jr(t.generation);break}case"setRecording":{let r=_?.request;if(t.recording&&O()&&!I){if(I=!0,H=!0,V=-1,$)Y=!0;else{let n=s.createCommandEncoder({label:l.interactiveMetricsEncoder});fe(n),s.queue.submit([n.finish()]),pe()}Ce()}else(!t.recording||!O())&&(t.recording&&!O()&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:p,maxRecordingBufferBytes:Ye()}),I=!1,H=!1);r&&_?Ci(r):!_&&k&&re();break}case"getRecording":{if(Ke)break;await lr(),Oe(!1),b>0&&qe(),Z>0?Ke=!0:hn();break}case"stepBack":{let r=0;for(let c of C)r+=c.blockCount;let n=r+b,i=Math.min(t.count,n-1);if(i<=0)break;let o=n-1-i,a=w?U:F;if(o>=r){let c=o-r;b=c+1,M.length=b,E=M[c];let f=s.createCommandEncoder({label:l.recordingRestoreCopyEncoder});f.copyBufferToBuffer(G,c*p,a,0,p),s.queue.submit([f.finish()])}else{if(Z>0){await new Promise(g=>{let T=setInterval(()=>{Z===0&&(clearInterval(T),g())},10)}),r=0;for(let g of C)r+=g.blockCount}let c=0,f=0,d=0;for(let g=0;g<C.length;g++){let T=C[g];if(o<c+T.blockCount){f=g,d=o-c;break}c+=T.blockCount}let v=C[f],u=await pi(v.filename,v.codec),m=Wt(v.gridFormat),R=le({cols:h,rows:S},m);if(m.bitsPerCell===y.bitsPerCell){let g=(d+1)*p;s.queue.writeBuffer(G,0,new Uint8Array(u,0,g))}else{let g=new Uint8Array((d+1)*p);for(let T=0;T<=d;T++){let j=T*R,Ve=new Uint8Array(u,j,R),he=$t(Or(Ve),{cols:h,rows:S},m,y);g.set(new Uint8Array(he.buffer,he.byteOffset,he.byteLength),T*p)}s.queue.writeBuffer(G,0,g),s.queue.writeBuffer(a,0,g.subarray(d*p,(d+1)*p))}if(b=d+1,M=v.generations.slice(0,d+1),E=M[d],m.bitsPerCell===y.bitsPerCell){let g=s.createCommandEncoder({label:l.recordingRestoreCopyEncoder});g.copyBufferToBuffer(G,d*p,a,0,p),s.queue.submit([g.finish()])}let D=C.splice(f).map(g=>g.filename);di(D)}if(mr(),Ce(),V=-1,$)Y=!0;else{let c=s.createCommandEncoder({label:l.interactiveMetricsEncoder});fe(c),s.queue.submit([c.finish()]),pe()}ie();break}case"stepForward":{if(br(),t.count===1){if(Oe(!0),hr(),Pe++,I&&Re()&&(b>=P&&qe(),Xe(E)),V=-1,$)Y=!0;else{let r=s.createCommandEncoder({label:l.interactiveMetricsEncoder});fe(r),s.queue.submit([r.finish()]),pe()}ie()}else self.postMessage({type:"stepping",active:!0}),Oe(!0),_r(Sr(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:E+t.count},restoreAfterStop:{running:k,targetStepDuration:ne}});break}case"cancelStepping":{Vr(_?.request.restoreAfterStop?.running??k);break}case"updateChunkCodec":{let r=C.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,X.chunks=[...C],Ce());break}case"getUncompressedChunks":{let r=C.filter(n=>n.codec===Bt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:h,rows:S,rawGridFormat:n.gridFormat,storageGridFormat:Ae(Ot(We.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
