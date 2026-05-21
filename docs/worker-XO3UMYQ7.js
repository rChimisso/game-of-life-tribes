var l={trackedAllocationClearEncoder:"tracked allocation clear encoder",gridClearEncoder:"grid clear encoder",gridReadbackEncoder:"grid readback encoder",simulationBatchEncoder:"simulation batch encoder",simulationSingleStepEncoder:"simulation single-step encoder",simulationStepPass:"simulation step pass",interactiveMetricsEncoder:"interactive metrics encoder",histogramMetricsPass:"histogram metrics pass",interfaceMetricsPass:"interface metrics pass",renderEncoder:"render encoder",renderPass:"render pass",brushEncoder:"brush encoder",brushPass:"brush pass",recordingFrameCopyEncoder:"recording frame copy encoder",recordingSealCopyEncoder:"recording seal copy encoder",recordingRestoreCopyEncoder:"recording restore copy encoder",uniformBuffer:"render uniform buffer",gridBufferA:"grid buffer A",gridBufferB:"grid buffer B",tribeColorBuffer:"tribe color buffer",renderShaderModule:"render shader module",renderPipeline:"render pipeline",simulationShaderModule:"simulation shader module",simulationPipeline:"simulation pipeline",brushShaderModule:"brush shader module",brushPipeline:"brush pipeline",brushUniformBuffer:"brush uniform buffer",gridReadbackBuffer:"grid readback buffer",recordingChunkBuffer:"recording chunk buffer",recordingStagingBuffer:"recording staging buffer",histogramMetricsShaderModule:"histogram metrics shader module",histogramMetricsPipeline:"histogram metrics pipeline",histogramMetricsBuffer:"histogram metrics buffer",histogramMetricsReadBuffer:"histogram metrics read buffer",interfaceMetricsShaderModule:"interface metrics shader module",interfaceMetricsPipeline:"interface metrics pipeline",interfaceMetricsBuffer:"interface metrics buffer",interfaceMetricsReadBuffer:"interface metrics read buffer"};var Rr=4294967295;function q(e,t){return e.includes(t)}function kt(e,t){return e?t?"ok":"tooLarge":"disabled"}function Pr(e,t,r,n){let i=e*t,o=i<=Rr,a=i*2<=Rr;return{population:kt(r&&n.population,o),diversity:kt(r&&n.diversity,o),interfaces:kt(r&&n.interfaces,a)}}function Er(e){let t=[];return e.population==="ok"&&t.push("population"),e.diversity==="ok"&&t.push("diversity"),e.interfaces==="ok"&&t.push("interfaces"),t}var Me=256*Uint32Array.BYTES_PER_ELEMENT,Be=Uint32Array.BYTES_PER_ELEMENT;function vr(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function Mr(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function Br(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
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
${vr(i)}

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

${Br(i)}
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
`}function Bn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${vr(i)}

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

${Br(i)}
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
`}function Tr(e){let{device:t}=e,r=t.createShaderModule({label:l.histogramMetricsShaderModule,code:Mn(e)}),n=t.createComputePipeline({label:l.histogramMetricsPipeline,layout:"auto",compute:{module:r,entryPoint:"main"}}),i=t.createBuffer({label:l.histogramMetricsBuffer,size:Me,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=t.createBuffer({label:l.histogramMetricsReadBuffer,size:Me,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),a=t.createShaderModule({label:l.interfaceMetricsShaderModule,code:Bn(e)}),u=t.createComputePipeline({label:l.interfaceMetricsPipeline,layout:"auto",compute:{module:a,entryPoint:"main"}}),f=t.createBuffer({label:l.interfaceMetricsBuffer,size:Be,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),d=t.createBuffer({label:l.interfaceMetricsReadBuffer,size:Be,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:o,boundaryPipeline:u,boundaryBuffer:f,boundaryReadBuffer:d}}function xr(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function kr(e){let{device:t,encoder:r,resources:n,sourceBuffer:i,dispatchPlan:o,enabledSections:a}=e;if(q(a,"population")||q(a,"diversity")){let u=new Uint32Array(256);t.queue.writeBuffer(n.histogramBuffer,0,u);let f=t.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),d=r.beginComputePass({label:l.histogramMetricsPass});d.setPipeline(n.histogramPipeline),d.setBindGroup(0,f),d.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),d.end(),r.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,Me)}if(q(a,"interfaces")){let u=new Uint32Array([0]);t.queue.writeBuffer(n.boundaryBuffer,0,u);let f=t.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),d=r.beginComputePass({label:l.interfaceMetricsPass});d.setPipeline(n.boundaryPipeline),d.setBindGroup(0,f),d.dispatchWorkgroups(o.dispatchWgX,o.dispatchWgY),d.end(),r.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Be)}}async function Ar(e){let{resources:t,enabledSections:r}=e,n=q(r,"population")||q(r,"diversity"),i=q(r,"interfaces"),o=[];n&&o.push(t.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&o.push(t.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(o);let a=new Uint32Array(256);n&&(a=new Uint32Array(t.histogramReadBuffer.getMappedRange().slice(0)),t.histogramReadBuffer.unmap());let u=0;if(i){let f=new Uint32Array(t.boundaryReadBuffer.getMappedRange().slice(0));t.boundaryReadBuffer.unmap(),u=f[0]??0}return{histogram:a,crossStateContactEdges:u}}function Ir(e){let{generation:t,tribes:r,deadTribeIndex:n,readback:i,enabledSections:o,availability:a,liveMetricSettings:u,cols:f,rows:d,totalFrames:E,fps:c,canStepBack:g,recordingBytes:R,recordingRawBytes:A}=e,D=q(o,"population")&&u.population,m=q(o,"diversity")&&u.diversity,T=q(o,"interfaces")&&u.interfaces,j={},He=0,be=0,Sr={},Ee=0,je=f*d;for(let v=0;v<r.length;v++){let ee=D?i.histogram[v]??0:0;j[r[v].id]=ee,v!==n&&(Ee+=ee)}if(m){Ee=0;for(let v=0;v<r.length;v++)v!==n&&(Ee+=i.histogram[v]??0)}if(m&&Ee>0){for(let v=0;v<r.length;v++)if(v!==n){let ee=(i.histogram[v]??0)/Ee;ee>0&&(He-=ee*Math.log2(ee),be+=ee*ee)}}for(let v=0;v<r.length;v++)v!==n&&(Sr[r[v].id]=0);let yr=D?j[r[n]?.id??""]??0:0,_r=D?Math.max(0,je-yr):0,ve=je*2,xt=T?i.crossStateContactEdges:0,Cr=T?Math.max(0,ve-xt):0,vn={sameStateContactEdges:Cr,crossStateContactEdges:xt,sameStateContactFraction:T&&ve>0?Cr/ve:0,crossStateContactFraction:T&&ve>0?xt/ve:0};return{type:"metrics",generation:t,population:j,aliveCells:_r,deadCells:yr,occupancy:D&&je>0?_r/je:0,shannonEntropy:He,simpsonIndex:m?1-be:0,interfaces:vn,metricsAvailability:a,extinctionTime:Sr,totalFrames:E,fps:c,canStepBack:g,recordingBytes:R,recordingRawBytes:A}}var Lr=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var At=[1,2,4,8,16,32],xn={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},kn={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},An={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Ve={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},In={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},It={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},te={1:xn,2:kn,4:An,8:Ve,16:In,32:It};var Te={population:!0,diversity:!0,interfaces:!1},Ze={enabled:!0,sections:Te};var Lt="any",Qe="dead";var Je="empty",et="is",wt="comparison",tt="count",rt="none",nt="exactly",it="min",ot="max",st="not",at="and",ut="or",ct="xor";function wr(e){return At.includes(e)}function Ln(e){return 2**e}function Gt(e,t){return t<=Ln(e)}function Ft(e,t,r){return ce(e,t)<=r}function Ut(e){return e<=2?te[1]:e<=4?te[2]:e<=16?te[4]:e<=256?te[8]:e<=65536?te[16]:te[32]}function xe(e){return te[e]}function Gr(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of At){let i=xe(n);if(Gt(n,e)&&Ft(t,i,r))return i}return It}function Dt(e){return xe(e?.bitsPerCell??8)}function ke(e){return{bitsPerCell:e.bitsPerCell}}function he(e,t){return Math.ceil(e/t.cellsPerWord)}function ce(e,t){return he(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function Fr(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function wn(e){return{population:typeof e?.population=="boolean"?e.population:Te.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Te.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Te.interfaces}}function Ot(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Ze.enabled,sections:wn(e?.sections)}}function Ur(e,t,r,n,i){let o=he(t.cols,r);return(e[i*o+(n>>r.wordShift)]??0)>>>((n&r.cellIndexMask)<<r.cellShift)&r.cellMask}function Dr(e,t,r,n,i,o){let a=he(t.cols,r),u=i*a+(n>>r.wordShift),f=(n&r.cellIndexMask)<<r.cellShift,d=~(r.cellMask<<f),E=e[u]??0;e[u]=(E&d|(o&r.cellMask)<<f)>>>0}function Wt(e,t,r,n){let i=e,o;if(r.bitsPerCell===n.bitsPerCell)o=e;else{o=new Uint32Array(ce(t,n)/Uint32Array.BYTES_PER_ELEMENT);for(let a=0;a<t.rows;a++)for(let u=0;u<t.cols;u++)Dr(o,t,n,u,a,Ur(i,t,r,u,a))}return o}var s,K=!1,zt,dt,ge,Oe,b=0,h=0,nr=0,y=Ve,Q=[],oe=new Map,Pt,Kt,F,U,We,Se,St,jr,Vr,Ge,ir,or,L=!1,Zr=1,Qr=0,Jr=0,x=!1,W=!1,ne=100,P=0,ft,ye,en,tn,Fn=0,pt=null,se=null,V=-1,$=!1,X=!1,Nt=0,Ne=Ze,gt=[],I=!1,H=!1,Y={chunks:[],generationStart:0,generationEnd:0,gridFormat:ke(Ve)},rn=0,C=[],_=null,nn=0,Ae=!1,G=null,S=0,B=[],M=64,p=0,Et=3,J=[],z=[],mt="gol-recording",vt="raw-packed",on="deflate-raw",Fe=null,le=null,Z=0,pe=0,Or=12,w=!1,Ie=0,sn=256,Un=sn*Uint32Array.BYTES_PER_ELEMENT,Wr=256*1024*1024,Dn=512*1024*1024,On=512*1024*1024,Nr=128*1024*1024*1024,bt=0,ht=0,Ue=[];function Wn(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function an(e){console.error("[GOLT worker] Worker GPU error:",e),k("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),x=!1,self.postMessage({type:"gpuError",reason:Wn(e)})}self.addEventListener("error",e=>{e.preventDefault(),an(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),an(e.reason)});async function sr(){await s.queue.onSubmittedWorkDone()}function $r(e){bt=0,ht=2+(e?1+Et:0),Ue=[]}async function yt(){if(Ue.length===0)return;let e=s.createCommandEncoder({label:l.trackedAllocationClearEncoder});for(let t of Ue)e.clearBuffer(t);s.queue.submit([e.finish()]),await sr(),Ue=[]}async function _t(e,t){!W||ht<=0||(bt+=e,ht--,Ue.push(t),bt>=Nn()&&ht>0&&(await yt(),bt=0))}function Nn(){return Math.min(Pe(),On)}function Pe(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function Ke(){return Math.min(Pe(),1073741824)}function un(){return Math.max(Pe()*2,Ke()*6)}function O(){return p>0&&p<=Ke()}function $n(){return p<=0?0:p*2+ur+Un+cr+Me*2+Be*2}function zn(){return M<1||p<=0?0:M*p*(1+Et)}function Ct(){G?.destroy(),G=null;for(let e of J)e?.destroy();J=[],z=[],M=0,S=0,B=[]}function zr(){F?.destroy(),U?.destroy(),xr(se),se=null,ye?.destroy(),Ct()}function $t(e){let t=Z>0;Z+=e;let r=Z>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function _e(){if(M<1||J.length===0){w&&(w=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=fn(),t=!z.some(i=>i)&&S>=M,r=pe>=e,n;if(w){let i=z.some(a=>a),o=pe<=Math.floor(e/2);n=!(i&&o)}else n=t||r;n!==w&&(w=n,self.postMessage({type:"backpressure",active:n}))}async function Ce(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??Nr/128,Nr),r=e.usage??0,n=0,i=0;for(let u of C)u.codec===vt?n+=u.storedBytes:i+=u.storedBytes;let o=M*p,a=I?(1+Et)*o:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:a})}var $e=!1;async function Kn(e){let t=new DecompressionStream(on),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:f,value:d}=await i.read();if(f)break;n.push(d)}let o=0;for(let f of n)o+=f.byteLength;let a=new Uint8Array(o),u=0;for(let f of n)a.set(f,u),u+=f.byteLength;return a.buffer}var Re=0,lt=0,ar=0;function cn(e,t,r=s.limits.maxComputeWorkgroupsPerDimension){if(e<=r&&t<=r)return{logicalWgX:e,logicalWgY:t,dispatchWgX:e,dispatchWgY:t,remapped:!1};let n=e*t,i=Math.min(n,r),o=Math.ceil(n/i);if(o>r)throw new Error(`Grid requires ${e}x${t} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${r}.`);return{logicalWgX:e,logicalWgY:t,dispatchWgX:i,dispatchWgY:o,remapped:!0}}function qn(){return cn(Math.ceil(nr/16),Math.ceil(h/16))}function Xn(){return cn(Math.ceil(b/16),Math.ceil(h/16))}function Yn(e,t){t.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${t.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${t.dispatchWgX}u;`))}function Hn(e){e.push(`const CELLS_PER_WORD: u32 = ${y.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${y.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${y.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${y.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${y.cellMask}u;`)}function jn(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Vn(e,t,r){if(t.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${r} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${r} = gid.x;`),e.push("  let y = gid.y;")}function Zn(){let e=[],t=nr,r=Pt;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${Q.map(c=>c.id).join(", ")}`),e.push(`// Rules: ${Oe.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${b}u;`),e.push(`const ROWS: u32 = ${h}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),Yn(e,r),Hn(e),e.push(""),jn(e,"gridIn","PACKED_COLS"),e.push("");let n=oe.get(Qe)??0,i=Oe.rules.filter(c=>!c.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let o=Jn(i.map(c=>c.clause)),a=new Map,u=0;for(let c of o){let g=`count_${u++}`;a.set(c,g)}for(let[c,g]of a){let R=c.split(",").map(Number),D=Kr().map(m=>`select(0u, 1u, ${R.map(j=>`${m} == ${j}u`).join(" || ")})`);e.push(`  let ${g} = ${D.join(" + ")};`)}o.size>0&&e.push("");let f=ei(i.map(c=>c.clause)),d=new Map,E=0;for(let c of f)if(a.has(c))d.set(c,a.get(c));else{let g=`eq_count_${E++}`;d.set(c,g)}for(let[c,g]of d){if(a.has(c))continue;let R=c.split(",").map(Number),D=Kr().map(m=>`select(0u, 1u, ${R.map(j=>`${m} == ${j}u`).join(" || ")})`);e.push(`  let ${g} = ${D.join(" + ")};`)}f.size>0&&E>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let c=0;c<i.length;c++){let g=i[c],R=Le(g.clause,a,d),A=Qn(g.tribe);c===0?e.push(`  if (${R}) {`):e.push(`  } else if (${R}) {`),e.push(`    result = ${A}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),r.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),Vn(e,r,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let c=-1;c<=1;c++)for(let g=-1;g<=1;g++){if(g===0&&c===0)continue;let R=ln(g,c),A=qr("x",g,"COLS"),D=qr("y",c,"ROWS");e.push(`    let ${R} = readCell(${A}, ${D});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function ln(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function Kr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(ln(r,t));return e}function qr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function N(e){let t=[];for(let r of e)if(r===Lt)for(let n=0;n<Q.length;n++)t.push(n);else{let n=oe.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function Qn(e){return e===Lt?0:oe.get(e)??0}function Jn(e){let t=new Set;for(let r of e)qt(r,t);return t}function qt(e,t){switch(e.kind){case Je:case et:break;case rt:case nt:case it:case ot:case tt:{let r=N(e.tribes).sort();t.add(r.join(","));break}case st:qt(e.clause,t);break;case at:case ut:case ct:for(let r of e.clauses)qt(r,t);break}}function ei(e){let t=new Set;for(let r of e)Xt(r,t);return t}function Xt(e,t){switch(e.kind){case Je:case et:case tt:case rt:case nt:case it:case ot:break;case wt:{let r=N(e.tribe1).sort(),n=N(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case st:Xt(e.clause,t);break;case at:case ut:case ct:for(let r of e.clauses)Xt(r,t);break}}function Le(e,t,r){switch(e.kind){case Je:return"false";case et:{let n=N(e.tribes);return n.length===0?"false":n.length===Q.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case tt:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case rt:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case nt:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case it:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case ot:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case wt:{let n=r.get(N(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),o=`(i32(${r.get(N(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${o})`;case">":return`(i32(${n}) > ${o})`;case"<":return`(i32(${n}) < ${o})`;case"\u2265":return`(i32(${n}) >= ${o})`;case"\u2264":return`(i32(${n}) <= ${o})`;default:return`(i32(${n}) == ${o})`}}case st:return`!(${Le(e.clause,t,r)})`;case at:return`(${e.clauses.map(i=>Le(i,t,r)).join(" && ")})`;case ut:return`(${e.clauses.map(i=>Le(i,t,r)).join(" || ")})`;case ct:return`(((${e.clauses.map(o=>Le(o,t,r)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var ur=48;function Yt(){We?.destroy(),We=s.createBuffer({label:l.uniformBuffer,size:ur,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function ti(){let e=new ArrayBuffer(ur),t=new Float32Array(e),r=new Uint32Array(e),n=(Qr%b+b)%b,i=(Jr%h+h)%h,o=Math.floor(n),a=Math.floor(i);t[0]=ge.width,t[1]=ge.height,t[2]=Zr,t[4]=n-o,t[5]=i-a,r[6]=b,r[7]=h,r[8]=o,r[9]=a,r[10]=Q.length,s.queue.writeBuffer(We,0,e)}function Mt(){return ce({cols:b,rows:h},y)}function ae(){return ke(y)}async function Ht(){let e=Mt();F=s.createBuffer({label:l.gridBufferA,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await _t(e,F),U=s.createBuffer({label:l.gridBufferB,size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await _t(e,U);let t=s.createCommandEncoder({label:l.gridClearEncoder});t.clearBuffer(F),t.clearBuffer(U),s.queue.submit([t.finish()]),L=!1}function jt(){let e=new Uint32Array(sn);for(let t=0;t<Q.length;t++){let r=Q[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),o=parseInt(r.substring(4,6),16);e[t]=n|i<<8|o<<16}Se&&Se.destroy(),Se=s.createBuffer({label:l.tribeColorBuffer,size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(Se,0,e)}function ri(){return Lr.replace("__CELLS_PER_WORD__",`${y.cellsPerWord}u`).replace("__WORD_SHIFT__",`${y.wordShift}u`).replace("__CELL_SHIFT__",`${y.cellShift}u`).replace("__CELL_INDEX_MASK__",`${y.cellIndexMask}u`).replace("__CELL_MASK__",`${y.cellMask}u`)}function Vt(){let e=s.createShaderModule({label:l.renderShaderModule,code:ri()});St=s.createRenderPipeline({label:l.renderPipeline,layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:dt}]},primitive:{topology:"triangle-list"}})}function Zt(){jr=s.createBindGroup({layout:St.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:We}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:Se}}]}),Vr=s.createBindGroup({layout:St.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:We}},{binding:1,resource:{buffer:U}},{binding:2,resource:{buffer:Se}}]})}function Qt(){Pt=qn();let e=Zn(),t=s.createShaderModule({label:l.simulationShaderModule,code:e});Ge=s.createComputePipeline({label:l.simulationPipeline,layout:"auto",compute:{module:t,entryPoint:"main"}}),ir=s.createBindGroup({layout:Ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:U}}]}),or=s.createBindGroup({layout:Ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:F}}]})}function Jt(){Kt=Xn(),se=Tr({device:s,cols:b,rows:h,gridFormat:y,dispatchPlan:Kt})}var cr=176;function ni(){return`
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
`}function er(){let e=s.createShaderModule({label:l.brushShaderModule,code:ni()});ft=s.createComputePipeline({label:l.brushPipeline,layout:"auto",compute:{module:e,entryPoint:"main"}}),ye?.destroy(),ye=s.createBuffer({label:l.brushUniformBuffer,size:cr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),en=s.createBindGroup({layout:ft.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:ye}}]}),tn=s.createBindGroup({layout:ft.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:ye}}]})}function ii(e,t,r,n,i,o,a){let u=oe.get(Qe)??0,f=Fn++,d=new ArrayBuffer(cr),E=new Int32Array(d),c=new Uint32Array(d);E[0]=t,E[1]=r,c[2]=b,c[3]=h,c[4]=n,c[5]=i,c[6]=o,c[7]=u,c[8]=f,c[9]=a.length,c[10]=0;for(let A=0;A<a.length&&A<32;A++)c[11+A]=a[A];s.queue.writeBuffer(ye,0,d);let g=Math.ceil(n/8),R=e.beginComputePass({label:l.brushPass});R.setPipeline(ft),R.setBindGroup(0,L?tn:en),R.dispatchWorkgroups(g,g),R.end()}function oi(){let e=L?U:F,t=Mt(),r;try{r=s.createBuffer({label:l.gridReadbackBuffer,size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder({label:l.gridReadbackEncoder});return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function dn(){if(p=Mt(),!O()){M=0;return}let e=si();M=Math.max(1,Math.floor(e/p))}function si(){return p>=Wr?p:Math.min(Math.max(Wr,p),Ke())}function fn(){if(M<1||p<=0)return Or;let e=Math.max(p,M*p),t=Math.floor(Dn/e);return Math.max(1,Math.min(Or,t||1))}function tr(){let e=O();self.postMessage({type:"limits",maxBytes:Pe(),vramBudgetBytes:un(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:$n(),vramRecordingBytes:zn(),gridFormat:ae()})}function ze(){return!O()||M<1||G===null||J.length===0||pe>=fn()?!1:S<M?!0:J.some((e,t)=>z[t]&&e.mapState==="unmapped")}function qe(e){if(M<1||G===null||S>=M)return;let t=L?U:F,r=S*p,n=s.createCommandEncoder({label:l.recordingFrameCopyEncoder});n.copyBufferToBuffer(t,0,G,r,p),s.queue.submit([n.finish()]),B.push(e),S++}function Rt(){if(G===null||S===0||J.length===0)return;let e=z.indexOf(!0);if(e<0)return;z[e]=!1;let t=J[e];if(t.mapState!=="unmapped"){z[e]=!0;return}let r=S*p,n=rn++,i=[...B],o=i[0],a=i[i.length-1],u=`chunk-${String(n).padStart(6,"0")}.bin`,f=S,d=s.createCommandEncoder({label:l.recordingSealCopyEncoder});d.copyBufferToBuffer(G,0,t,0,r),s.queue.submit([d.finish()]);let E={chunkId:n,generationStart:o,generationEnd:a,blockCount:f,codec:vt,uncompressedBytes:r,storedBytes:r,gridFormat:ae(),generations:i,filename:u};$t(1),pe++,_e();let c=Ie;t.mapAsync(GPUMapMode.READ).then(async()=>{let g=t.getMappedRange(),R=new ArrayBuffer(r);new Uint8Array(R).set(new Uint8Array(g,0,r)),t.unmap(),c===Ie&&(z[e]=!0,_e(),C.push(E),lr(),ai(E,R).then(()=>{c===Ie&&(pe--,_e(),$t(-1),Ce(),self.postMessage({type:"chunkSealed",filename:E.filename,rawBytes:r,blockCount:E.blockCount,cols:b,rows:h,rawGridFormat:E.gridFormat,storageGridFormat:ke(Ut(Oe.tribes.length))}),$e&&Z===0&&($e=!1,gn()))}))}).catch(()=>{c===Ie&&(z[e]=!0,pe--,_e(),$t(-1))}),S=0,B=[]}function lr(){C.length>0&&(Y.generationStart=C[0].generationStart,Y.generationEnd=C[C.length-1].generationEnd),B.length>0&&(C.length===0&&(Y.generationStart=B[0]),Y.generationEnd=B[B.length-1]),Y.chunks=[...C]}async function Xr(e){Ie++,rn=0,S=0,B=[],C=[],pe=0,Z>0&&(Z=0,self.postMessage({type:"chunksSaving",active:!1})),w&&(w=!1,self.postMessage({type:"backpressure",active:!1})),$e=!1,H=I,Y={chunks:[],generationStart:e,generationEnd:e,gridFormat:ae()},await pn(),Ce()}async function dr(){return le&&await le,Fe||(Fe=await(await navigator.storage.getDirectory()).getDirectoryHandle(mt,{create:!0})),Fe}async function ai(e,t){let i=await(await(await dr()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function ui(e){let t=await dr();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function pn(){if(le){await le;return}le=(async()=>{let e=await navigator.storage.getDirectory();Fe=null;try{await e.removeEntry(mt,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${mt}:`,t)}Fe=await e.getDirectoryHandle(mt,{create:!0})})();try{await le}finally{le=null}}function gn(){lr(),self.postMessage({type:"recording",manifest:{chunks:C.map(e=>({...e,generations:[...e.generations]})),generationStart:Y.generationStart,generationEnd:Y.generationEnd,gridFormat:ae()},cols:b,rows:h})}function ci(){return S>0?B[S-1]!==P:C.length>0?C[C.length-1].generationEnd!==P:!0}function De(e=!1){if(I){if(e){if(H){if(!ze())return;H=!1}}else if(H)return;!ci()||!ze()||(S>=M&&Rt(),qe(P))}}function fr(){if(!pt)return;let e=pt;pt=null;let t=s.createCommandEncoder({label:l.brushEncoder});ii(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),I&&S>0&&B[S-1]===P&&(S--,B.pop(),qe(P))}async function li(e,t=vt){let o=await(await(await(await dr()).getFileHandle(e)).getFile()).arrayBuffer();return t===on?Kn(o):o}function di(){let e=S;for(let t of C)e+=t.blockCount;return e}function mn(){return Pr(b,h,Ne.enabled,Ne.sections)}function fi(){return Er(mn())}function de(e){gt=fi(),se&&gt.length!==0&&kr({device:s,encoder:e,resources:se,sourceBuffer:L?U:F,dispatchPlan:Kt,enabledSections:gt})}function fe(){let e=P;if(!se||e===V||$)return;let t=se,r=[...gt],n=mn();V=e,$=!0,Ar({resources:t,enabledSections:r}).then(i=>{let o=oe.get(Qe)??0,a=di(),u=Ir({generation:e,tribes:Q,deadTribeIndex:o,readback:i,enabledSections:r,availability:n,liveMetricSettings:Ne.sections,cols:b,rows:h,totalFrames:a,fps:ar,canStepBack:a>1,recordingBytes:C.reduce((f,d)=>f+d.storedBytes,0),recordingRawBytes:C.reduce((f,d)=>f+d.uncompressedBytes,0)});if($=!1,self.postMessage(u),X)if(X=!1,V=-1,Sn()){let f=s.createCommandEncoder({label:l.interactiveMetricsEncoder});de(f),s.queue.submit([f.finish()]),fe()}else X=!0}).catch(()=>{$=!1})}function pi(){let e=b*h;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function gi(){let e=b*h;return e>1e7?2:e>1e6?4:e>1e5?8:16}function bn(e){if(e<=0)return;let t=Pt,r=s.createCommandEncoder({label:l.simulationBatchEncoder});for(let n=0;n<e;n++){let i=r.beginComputePass({label:l.simulationStepPass});i.setPipeline(Ge),i.setBindGroup(0,L?or:ir),i.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),i.end(),L=!L,P++}s.queue.submit([r.finish()]),Re+=e}function mi(){self.postMessage({type:"generation",generation:P,fps:ar})}function pr(){let e=s.createCommandEncoder({label:l.simulationSingleStepEncoder}),t=e.beginComputePass({label:l.simulationStepPass});t.setPipeline(Ge),t.setBindGroup(0,L?or:ir);let r=Pt;t.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),t.end(),s.queue.submit([e.finish()]),L=!L,P++}function ie(){ti();let e=zt.getCurrentTexture().createView(),t=s.createCommandEncoder({label:l.renderEncoder}),r=t.beginRenderPass({label:l.renderPass,colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(St),r.setBindGroup(0,L?Vr:jr),r.draw(3),r.end(),s.queue.submit([t.finish()])}function hn(e){lt===0&&(lt=e);let t=e-lt;t>=1e3&&(ar=Re/(t/1e3),Re=0,lt=e)}function gr(){return I&&O()?"recording":"nonRecording"}function bi(){return ne<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/ne}}function ue(e){return e.request.stopCondition.kind==="targetGeneration"}function Xe(e){return e.request.stopCondition.kind==="targetGeneration"&&P>=e.request.stopCondition.generation}function Bt(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-P)}function Sn(){return!!(s&&se&&!W&&!K)}function mr(e=!1){if(e&&(V=-1),!Sn())X=!0;else if($)X=!0;else{let t=s.createCommandEncoder({label:l.interactiveMetricsEncoder});de(t),s.queue.submit([t.finish()]),fe()}}function yn(){mr(!0),ie()}function Tt(e,t){if(!t)return;(e-Nt>=1e3||Nt===0)&&!$&&(Nt=e,mr())}function Ye(e,t){e.request.pacing.kind!=="max"&&!ue(e)||t-e.lastProgressTime>=1e3&&(e.lastProgressTime=t,mi())}function br(){w&&(w=!1,self.postMessage({type:"backpressure",active:!1}))}function hi(){w||(w=!0,self.postMessage({type:"backpressure",active:!0}))}function _n(){return ze()?(S>=M&&Rt(),ze()):!1}function we(){W||K||_||self.requestAnimationFrame(rr)}function me(e){let t=_;if(!t||t.pumpPending||W||K)return;let{token:r}=t;t.pumpPending=!0;let n=()=>{!_||_.token!==r||(_.pumpPending=!1,Pi(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?s.queue.onSubmittedWorkDone().then(n).catch(()=>{_?.token===r&&(_.pumpPending=!1)}):queueMicrotask(n)}function hr(e,t){_&&k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),_={kind:e,request:t,token:++nn,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0},me(t.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function re(){x&&hr(gr(),{pacing:bi(),stopCondition:{kind:"none"}})}function k(e,t={}){let r=_;if(!r)return;_=null,nn++;let n=ue(r),i=t.restore!==!1&&!!r.request.restoreAfterStop;i&&r.request.restoreAfterStop&&(x=r.request.restoreAfterStop.running,ne=r.request.restoreAfterStop.targetStepDuration),n&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?br():w&&_e(),t.render!==!1&&!W&&!K&&yn(),t.restartRestoredRun!==!1&&i&&x&&!W&&!K?re():we()}function Yr(e){let t=_;!t||!ue(t)||(t.request.restoreAfterStop&&(t.request.restoreAfterStop.running=e),k("cancelled"))}function Si(e){k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),hr(gr(),e)}function Cn(e,t,r){hi(),Ye(e,t),Tt(t,r),me("drain")}function yi(e,t){let r=pi(),n=gi(),i=!1;for(let o=0;o<n;o++){let a=Bt(e);if(a<=0)break;let u=Math.min(r,a);bn(u),i=!0}if(Ye(e,t),Xe(e)){k("targetReached");return}me(i?"drain":"raf")}function _i(e,t){De(!0);let r=!1,n=performance.now()+14;for(;Bt(e)>0&&performance.now()<n;){if(!_n()){Cn(e,t,r);return}pr(),Re++,r=!0,qe(P)}if(br(),Ye(e,t),Tt(t,r),Xe(e)){k("targetReached");return}me("raf")}function Ci(e,t,r){e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=Math.floor(e.stepAccumulator/t),o=Math.min(i,Bt(e)),a=o>0;if(a&&(bn(o),e.stepAccumulator-=t*o),Ye(e,r),Xe(e)){k("targetReached");return}ue(e)||(ie(),Tt(r,a)),me("raf")}function Ri(e,t,r){De(!0),e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=!1;for(;e.stepAccumulator>=t&&Bt(e)>0;){if(!_n()){Cn(e,r,i);return}pr(),Re++,e.stepAccumulator-=t,i=!0,qe(P)}if(br(),Ye(e,r),Xe(e)){k("targetReached");return}ue(e)||(ie(),Tt(r,i)),me("raf")}function Pi(e){let t=_;if(!t||W||K)return;if(hn(e),ue(t)||fr(),Xe(t)){k("targetReached");return}if(t.request.pacing.kind==="max"){t.kind==="recording"?_i(t,e):yi(t,e);return}let r=1e3/t.request.pacing.genPerSecond;t.kind==="recording"?Ri(t,r,e):Ci(t,r,e)}function rr(e){if(W||K){self.requestAnimationFrame(rr);return}hn(e),!_&&(fr(),ne>0&&!Ae&&ie(),self.requestAnimationFrame(rr))}function Ei(e,t){let r=s?Pe():Number.POSITIVE_INFINITY;return wr(t.bitsPerCell)&&Gt(t.bitsPerCell,e.tribes.length)&&Ft(e,xe(t.bitsPerCell),r)?xe(t.bitsPerCell):Gr(e.tribes.length,e,r)}function Hr(e,t){Oe=e,b=e.cols,h=e.rows,y=Ei(e,t),nr=he(b,y),Q=[...e.tribes],Y.gridFormat=ae(),oe.clear(),Q.forEach((r,n)=>oe.set(r.id,n))}async function Rn(e){console.log("[GOLT worker] Initializing WebGPU"),ge=e;let t=await navigator.gpu.requestAdapter();if(!t)throw console.error("[GOLT worker] WebGPU adapter not available"),new Error("WebGPU adapter not available");s=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),K=!1,s.lost.then(n=>{let i=n.message||n.reason||"unknown";console.error("[GOLT worker] GPU device lost:",i),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),K=!0,x=!1,W=!0,self.postMessage({type:"deviceLost",reason:i})}),self.postMessage({type:"limits",maxBytes:Pe(),vramBudgetBytes:un(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:ae()});let r=ge.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");zt=r,dt=navigator.gpu.getPreferredCanvasFormat(),zt.configure({device:s,format:dt,alphaMode:"opaque"}),console.log("[GOLT worker] WebGPU initialized",{canvasFormat:dt,maxBufferSize:s.limits.maxBufferSize,maxStorageBufferBindingSize:s.limits.maxStorageBufferBindingSize})}async function vi(){try{return console.log("[GOLT worker] Restoring WebGPU device"),await Rn(ge),console.log("[GOLT worker] WebGPU device restored"),!0}catch(e){let t=e instanceof Error?e.message:String(e);return console.error("[GOLT worker] WebGPU device restore failed:",t),k("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),K=!0,x=!1,W=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function Pn(){G=s.createBuffer({label:l.recordingChunkBuffer,size:M*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await _t(M*p,G),S=0,B=[]}async function En(){let e=M*p;J=[],z=[];for(let t=0;t<Et;t++){let r=s.createBuffer({label:`${l.recordingStagingBuffer} ${t}`,size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});J.push(r),z.push(!0),await _t(e,r)}}async function Mi(){await pn()}async function Bi(){console.log("[GOLT worker] Building GPU resources",{cols:b,rows:h,bitsPerCell:y.bitsPerCell,recordingAvailable:O()}),Yt(),dn(),await Ht(),jt(),Vt(),Zt(),Qt(),er(),Jt(),await Mi(),O()?(await Pn(),await En()):(console.warn("[GOLT worker] Recording buffers disabled for current frame size",{frameByteSize:p,maxRecordingBufferBytes:Ke()}),Ct(),I=!1,H=!1),await yt(),tr(),console.log("[GOLT worker] GPU resources ready")}async function Ti(){console.log("[GOLT worker] Rebuild started",{cols:b,rows:h,bitsPerCell:y.bitsPerCell}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),W=!0,self.postMessage({type:"rebuilding",active:!0});try{await sr()}catch{}if(K&&!await vi())return!1;zr(),Yt(),dn(),$r(O());try{await Ht(),jt(),Vt(),Qt(),er(),Zt(),Jt(),O()?(await Pn(),await En()):(Ct(),I=!1,H=!1),await yt(),tr()}catch(e){let t=e instanceof Error?e.message:String(e);console.error("[GOLT worker] GPU rebuild failed:",t),self.postMessage({type:"gpuError",reason:t});try{zr(),Yt(),$r(!1),await Ht(),jt(),Vt(),Qt(),er(),Zt(),Jt(),I=!1,H=!1,p=Mt(),Ct(),console.warn("[GOLT worker] GPU rebuild recovered with recording disabled"),await yt(),tr()}catch(r){return console.error("[GOLT worker] GPU rebuild recovery failed:",r),!1}}return W=!1,self.postMessage({type:"rebuilding",active:!1}),console.log("[GOLT worker] Rebuild completed",{recordingAvailable:O(),frameByteSize:p}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(console.log("[GOLT worker] Init message received",{cols:t.ruleset.cols,rows:t.ruleset.rows,recording:t.recording,running:t.running,speed:t.speed}),I=t.recording,Ne=Ot(t.liveMetrics),H=I,Hr(t.ruleset,t.simulationGridFormat),await Rn(t.canvas),await Bi(),$)X=!0;else{let r=s.createCommandEncoder({label:l.interactiveMetricsEncoder});de(r),s.queue.submit([r.finish()]),fe()}Ce(),x=t.running,ne=t.speed<0?0:1e3/t.speed,x?re():we();break}case"setLiveMetrics":{Ne=Ot(t.liveMetrics),V=-1,mr(!0);break}case"setRuleset":{if(console.log("[GOLT worker] Ruleset update received",{cols:t.ruleset.cols,rows:t.ruleset.rows,tribes:t.ruleset.tribes.length}),k("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Hr(t.ruleset,t.simulationGridFormat),!await Ti())break;if(P=0,V=-1,await Xr(0),x?re():we(),$)X=!0;else{let n=s.createCommandEncoder({label:l.interactiveMetricsEncoder});de(n),s.queue.submit([n.finish()]),fe()}break}case"setRunning":if(x=t.running,t.running){_||re();break}_&&ue(_)?Yr(!1):_?k("manual"):(w&&_e(),yn(),we());break;case"setSpeed":{let r=ne<=0,n=t.speed<0?0:1e3/t.speed;ne=n,_&&!ue(_)&&x?(k("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&n>0?(Ae=!0,s.queue.onSubmittedWorkDone().then(()=>{Ae=!1,ie(),re()})):re()):x&&!_?re():r&&n>0&&(Ae=!0,s.queue.onSubmittedWorkDone().then(()=>{Ae=!1,ie(),we()}));break}case"camera":Zr=t.scale,Qr=t.offsetX,Jr=t.offsetY;break;case"resize":ge.width=t.width,ge.height=t.height;break;case"draw":{let r=t.tribes.map(n=>oe.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};pt={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{oi().then(r=>{let n={type:"snapshot",grid:r,generation:P,cols:b,rows:h,gridFormat:ae()};self.postMessage(n,[r.buffer])}).catch(()=>{let r=new Uint32Array(0),n={type:"snapshot",grid:r,generation:P,cols:b,rows:h,gridFormat:ae()};self.postMessage(n,[r.buffer])});break}case"loadSnapshot":{let r=L?U:F,n=Dt(t.gridFormat),i=ce({cols:b,rows:h},n);if(t.grid.byteLength!==i)break;let o=Wt(t.grid,{cols:b,rows:h},n,y);s.queue.writeBuffer(r,0,o),P=t.generation,await Xr(t.generation);break}case"setRecording":{let r=_?.request;if(t.recording&&O()&&!I){if(I=!0,H=!0,V=-1,$)X=!0;else{let n=s.createCommandEncoder({label:l.interactiveMetricsEncoder});de(n),s.queue.submit([n.finish()]),fe()}Ce()}else(!t.recording||!O())&&(t.recording&&!O()&&console.warn("[GOLT worker] Recording requested but unavailable for current frame size",{frameByteSize:p,maxRecordingBufferBytes:Ke()}),I=!1,H=!1);r&&_?Si(r):!_&&x&&re();break}case"getRecording":{if($e)break;await sr(),De(!1),S>0&&Rt(),Z>0?$e=!0:gn();break}case"stepBack":{let r=0;for(let u of C)r+=u.blockCount;let n=r+S,i=Math.min(t.count,n-1);if(i<=0)break;let o=n-1-i,a=L?U:F;if(o>=r){let u=o-r;S=u+1,B.length=S,P=B[u];let f=s.createCommandEncoder({label:l.recordingRestoreCopyEncoder});f.copyBufferToBuffer(G,u*p,a,0,p),s.queue.submit([f.finish()])}else{if(Z>0){await new Promise(m=>{let T=setInterval(()=>{Z===0&&(clearInterval(T),m())},10)}),r=0;for(let m of C)r+=m.blockCount}let u=0,f=0,d=0;for(let m=0;m<C.length;m++){let T=C[m];if(o<u+T.blockCount){f=m,d=o-u;break}u+=T.blockCount}let E=C[f],c=await li(E.filename,E.codec),g=Dt(E.gridFormat),R=ce({cols:b,rows:h},g);if(g.bitsPerCell===y.bitsPerCell){let m=(d+1)*p;s.queue.writeBuffer(G,0,new Uint8Array(c,0,m))}else{let m=new Uint8Array((d+1)*p);for(let T=0;T<=d;T++){let j=T*R,He=new Uint8Array(c,j,R),be=Wt(Fr(He),{cols:b,rows:h},g,y);m.set(new Uint8Array(be.buffer,be.byteOffset,be.byteLength),T*p)}s.queue.writeBuffer(G,0,m),s.queue.writeBuffer(a,0,m.subarray(d*p,(d+1)*p))}if(S=d+1,B=E.generations.slice(0,d+1),P=B[d],g.bitsPerCell===y.bitsPerCell){let m=s.createCommandEncoder({label:l.recordingRestoreCopyEncoder});m.copyBufferToBuffer(G,d*p,a,0,p),s.queue.submit([m.finish()])}let D=C.splice(f).map(m=>m.filename);ui(D)}if(lr(),Ce(),V=-1,$)X=!0;else{let u=s.createCommandEncoder({label:l.interactiveMetricsEncoder});de(u),s.queue.submit([u.finish()]),fe()}ie();break}case"stepForward":{if(fr(),t.count===1){if(De(!0),pr(),Re++,I&&ze()&&(S>=M&&Rt(),qe(P)),V=-1,$)X=!0;else{let r=s.createCommandEncoder({label:l.interactiveMetricsEncoder});de(r),s.queue.submit([r.finish()]),fe()}ie()}else self.postMessage({type:"stepping",active:!0}),De(!0),hr(gr(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:P+t.count},restoreAfterStop:{running:x,targetStepDuration:ne}});break}case"cancelStepping":{Yr(_?.request.restoreAfterStop?.running??x);break}case"updateChunkCodec":{let r=C.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,Y.chunks=[...C],Ce());break}case"getUncompressedChunks":{let r=C.filter(n=>n.codec===vt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:b,rows:h,rawGridFormat:n.gridFormat,storageGridFormat:ke(Ut(Oe.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
