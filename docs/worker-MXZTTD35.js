var vr=4294967295;function $(e,t){return e.includes(t)}function xt(e,t){return e?t?"ok":"tooLarge":"disabled"}function Mr(e,t,r,n){let i=e*t,s=i<=vr,a=i*2<=vr;return{population:xt(r&&n.population,s),diversity:xt(r&&n.diversity,s),interfaces:xt(r&&n.interfaces,a)}}function Er(e){let t=[];return e.population==="ok"&&t.push("population"),e.diversity==="ok"&&t.push("diversity"),e.interfaces==="ok"&&t.push("interfaces"),t}var ve=256*Uint32Array.BYTES_PER_ELEMENT,Me=Uint32Array.BYTES_PER_ELEMENT;function Pr(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function Br(e){return e.remapped?`fn main(
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
  let y = gid.y;`}function vn(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
`}function Tr(e){let{device:t}=e,r=t.createShaderModule({code:vn(e)}),n=t.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),i=t.createBuffer({size:ve,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),s=t.createBuffer({size:ve,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),a=t.createShaderModule({code:Mn(e)}),l=t.createComputePipeline({layout:"auto",compute:{module:a,entryPoint:"main"}}),f=t.createBuffer({size:Me,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),u=t.createBuffer({size:Me,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:s,boundaryPipeline:l,boundaryBuffer:f,boundaryReadBuffer:u}}function Ir(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function Ar(e){let{device:t,encoder:r,resources:n,sourceBuffer:i,dispatchPlan:s,enabledSections:a}=e;if($(a,"population")||$(a,"diversity")){let l=new Uint32Array(256);t.queue.writeBuffer(n.histogramBuffer,0,l);let f=t.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),u=r.beginComputePass();u.setPipeline(n.histogramPipeline),u.setBindGroup(0,f),u.dispatchWorkgroups(s.dispatchWgX,s.dispatchWgY),u.end(),r.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,ve)}if($(a,"interfaces")){let l=new Uint32Array([0]);t.queue.writeBuffer(n.boundaryBuffer,0,l);let f=t.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),u=r.beginComputePass();u.setPipeline(n.boundaryPipeline),u.setBindGroup(0,f),u.dispatchWorkgroups(s.dispatchWgX,s.dispatchWgY),u.end(),r.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,Me)}}async function kr(e){let{resources:t,enabledSections:r}=e,n=$(r,"population")||$(r,"diversity"),i=$(r,"interfaces"),s=[];n&&s.push(t.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&s.push(t.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(s);let a=new Uint32Array(256);n&&(a=new Uint32Array(t.histogramReadBuffer.getMappedRange().slice(0)),t.histogramReadBuffer.unmap());let l=0;if(i){let f=new Uint32Array(t.boundaryReadBuffer.getMappedRange().slice(0));t.boundaryReadBuffer.unmap(),l=f[0]??0}return{histogram:a,boundaryLength:l}}function Lr(e){let{generation:t,tribes:r,deadTribeIndex:n,readback:i,enabledSections:s,availability:a,liveMetricSettings:l,cols:f,rows:u,totalFrames:v,fps:c,canStepBack:p,recordingBytes:C,recordingRawBytes:I}=e,D=$(s,"population")&&l.population,g=$(s,"diversity")&&l.diversity,B=$(s,"interfaces")&&l.interfaces,X={},Xe=0,Ye=0,ge={},Ce=0,He=f*u;for(let M=0;M<r.length;M++){let Q=D?i.histogram[M]??0:0;X[r[M].id]=Q,M!==n&&(Ce+=Q)}if(g){Ce=0;for(let M=0;M<r.length;M++)M!==n&&(Ce+=i.histogram[M]??0)}if(g&&Ce>0)for(let M=0;M<r.length;M++){if(M===n)continue;let Q=(i.histogram[M]??0)/Ce;Q>0&&(Xe-=Q*Math.log2(Q),Ye+=Q*Q)}for(let M=0;M<r.length;M++)M!==n&&(ge[r[M].id]=0);let yr=D?X[r[n]?.id??""]??0:0,_r=D?Math.max(0,He-yr):0,Re=He*2,je=B?i.boundaryLength:0,Cr=B?Math.max(0,Re-je):0,Rr={boundaryLength:je,sameStateContactEdges:Cr,crossStateContactEdges:je,sameStateContactFraction:B&&Re>0?Cr/Re:0,crossStateContactFraction:B&&Re>0?je/Re:0};return{type:"metrics",generation:t,population:X,aliveCells:_r,deadCells:yr,occupancy:D&&He>0?_r/He:0,shannonEntropy:Xe,simpsonIndex:g?1-Ye:0,boundaryLength:Rr.boundaryLength,interfaces:Rr,metricsAvailability:a,extinctionTime:ge,totalFrames:v,fps:c,canStepBack:p,recordingBytes:C,recordingRawBytes:I}}var wr=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var Tt=[1,2,4,8,16,32],Pn={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Bn={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},xn={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Ve={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Tn={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},It={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},J={1:Pn,2:Bn,4:xn,8:Ve,16:Tn,32:It};var Ee={population:!0,diversity:!0,interfaces:!1},Ze={enabled:!0,sections:Ee};var At="any",Qe="dead";var Je="empty",et="is",kt="comparison",tt="count",rt="none",nt="exactly",it="min",st="max",ot="not",at="and",ut="or",ct="xor";function Fr(e){return Tt.includes(e)}function In(e){return 2**e}function Lt(e,t){return t<=In(e)}function wt(e,t,r){return Te(e,t)<=r}function Ft(e){return e<=2?J[1]:e<=4?J[2]:e<=16?J[4]:e<=256?J[8]:e<=65536?J[16]:J[32]}function Pe(e){return J[e]}function Gr(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of Tt){let i=Pe(n);if(Lt(n,e)&&wt(t,i,r))return i}return It}function Gt(e){return Pe(e?.bitsPerCell??8)}function Be(e){return{bitsPerCell:e.bitsPerCell}}function xe(e,t){return Math.ceil(e/t.cellsPerWord)}function Te(e,t){return xe(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function An(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function Dt(e,t,r){let n=xe(t.cols,r),i=new Uint32Array(n*t.rows);for(let s=0;s<t.rows;s++)for(let a=0;a<n;a++){let l=a*r.cellsPerWord,f=0;for(let u=0;u<r.cellsPerWord&&l+u<t.cols;u++){let v=e[s*t.cols+l+u]&r.cellMask;f|=v<<(u<<r.cellShift)}i[s*n+a]=f>>>0}return i}function Ut(e,t,r){let n=xe(t.cols,r),i=new Uint8Array(t.cols*t.rows);for(let s=0;s<t.rows;s++)for(let a=0;a<n;a++){let l=e[s*n+a],f=a*r.cellsPerWord;for(let u=0;u<r.cellsPerWord&&f+u<t.cols;u++)i[s*t.cols+f+u]=l>>>(u<<r.cellShift)&r.cellMask}return i}function Dr(e,t,r){return Ut(An(e),t,r)}function kn(e){return{population:typeof e?.population=="boolean"?e.population:Ee.population,diversity:typeof e?.diversity=="boolean"?e.diversity:Ee.diversity,interfaces:typeof e?.interfaces=="boolean"?e.interfaces:Ee.interfaces}}function Ot(e){return{enabled:typeof e?.enabled=="boolean"?e.enabled:Ze.enabled,sections:kn(e?.sections)}}var o,q=!1,$t,Kt,fe,Ue,m=0,b=0,nr=0,_=Ve,j=[],ie=new Map,Rt,zt,F,G,Oe,me,ht,Hr,jr,we,ir,sr,k=!1,Vr=1,Zr=0,Qr=0,x=!1,W=!1,re=100,R=0,ft,be,Jr,en,wn=0,dt=null,de=null,Y=-1,O=!1,te=!1,Nt=0,Ne=Ze,pt=[],A=!1,z=!1,K={chunks:[],generationStart:0,generationEnd:0,gridFormat:Be(Ve)},tn=0,y=[],S=null,rn=0,Ie=!1,w=null,h=0,P=[],E=64,d=0,vt=3,V=[],N=[],gt="gol-recording",Mt="raw-packed",nn="deflate-raw",Fe=null,ae=null,H=0,le=0,Ur=12,L=!1,Ae=0,sn=256,Fn=sn*Uint32Array.BYTES_PER_ELEMENT,Or=256*1024*1024,Gn=512*1024*1024,Dn=512*1024*1024,Nr=128*1024*1024*1024,mt=0,bt=0,Ge=[];function Un(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function on(e){T("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),x=!1,self.postMessage({type:"gpuError",reason:Un(e)})}self.addEventListener("error",e=>{e.preventDefault(),on(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),on(e.reason)});async function or(){await o.queue.onSubmittedWorkDone()}function Wr(e){mt=0,bt=2+(e?1+vt:0),Ge=[]}async function St(){if(Ge.length===0)return;let e=o.createCommandEncoder();for(let t of Ge)e.clearBuffer(t);o.queue.submit([e.finish()]),await or(),Ge=[]}async function yt(e,t){!W||bt<=0||(mt+=e,bt--,Ge.push(t),mt>=On()&&bt>0&&(await St(),mt=0))}function On(){return Math.min(_e(),Dn)}function _e(){return Math.min(o.limits.maxBufferSize,o.limits.maxStorageBufferBindingSize)}function ar(){return Math.min(_e(),1073741824)}function an(){return Math.max(_e()*2,ar()*6)}function Z(){return d>0&&d<=ar()}function Nn(){return d<=0?0:d*2+cr+Fn+lr+ve*2+Me*2}function Wn(){return E<1||d<=0?0:E*d*(1+vt)}function _t(){w?.destroy(),w=null;for(let e of V)e?.destroy();V=[],N=[],E=0,h=0,P=[]}function $r(){F?.destroy(),G?.destroy(),Ir(de),de=null,be?.destroy(),_t()}function Wt(e){let t=H>0;H+=e;let r=H>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function he(){if(E<1||V.length===0){L&&(L=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=fn(),t=!N.some(i=>i)&&h>=E,r=le>=e,n;if(L){let i=N.some(a=>a),s=le<=Math.floor(e/2);n=!(i&&s)}else n=t||r;n!==L&&(L=n,self.postMessage({type:"backpressure",active:n}))}async function Se(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??Nr/128,Nr),r=e.usage??0,n=0,i=0;for(let l of y)l.codec===Mt?n+=l.storedBytes:i+=l.storedBytes;let s=E*d,a=A?(1+vt)*s:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:a})}var We=!1;async function $n(e){let t=new DecompressionStream(nn),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:f,value:u}=await i.read();if(f)break;n.push(u)}let s=0;for(let f of n)s+=f.byteLength;let a=new Uint8Array(s),l=0;for(let f of n)a.set(f,l),l+=f.byteLength;return a.buffer}var ye=0,lt=0,ur=0;function un(e,t,r=o.limits.maxComputeWorkgroupsPerDimension){if(e<=r&&t<=r)return{logicalWgX:e,logicalWgY:t,dispatchWgX:e,dispatchWgY:t,remapped:!1};let n=e*t,i=Math.min(n,r),s=Math.ceil(n/i);if(s>r)throw new Error(`Grid requires ${e}x${t} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${r}.`);return{logicalWgX:e,logicalWgY:t,dispatchWgX:i,dispatchWgY:s,remapped:!0}}function Kn(){return un(Math.ceil(nr/16),Math.ceil(b/16))}function zn(){return un(Math.ceil(m/16),Math.ceil(b/16))}function qn(e,t){t.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${t.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${t.dispatchWgX}u;`))}function Xn(e){e.push(`const CELLS_PER_WORD: u32 = ${_.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${_.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${_.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${_.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${_.cellMask}u;`)}function Yn(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Hn(e,t,r){if(t.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${r} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${r} = gid.x;`),e.push("  let y = gid.y;")}function jn(){let e=[],t=nr,r=Rt;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${j.map(c=>c.id).join(", ")}`),e.push(`// Rules: ${Ue.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${m}u;`),e.push(`const ROWS: u32 = ${b}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),qn(e,r),Xn(e),e.push(""),Yn(e,"gridIn","PACKED_COLS"),e.push("");let n=ie.get(Qe)??0,i=Ue.rules.filter(c=>!c.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let s=Zn(i.map(c=>c.clause)),a=new Map,l=0;for(let c of s){let p=`count_${l++}`;a.set(c,p)}for(let[c,p]of a){let C=c.split(",").map(Number),D=Kr().map(g=>`select(0u, 1u, ${C.map(X=>`${g} == ${X}u`).join(" || ")})`);e.push(`  let ${p} = ${D.join(" + ")};`)}s.size>0&&e.push("");let f=Qn(i.map(c=>c.clause)),u=new Map,v=0;for(let c of f)if(a.has(c))u.set(c,a.get(c));else{let p=`eq_count_${v++}`;u.set(c,p)}for(let[c,p]of u){if(a.has(c))continue;let C=c.split(",").map(Number),D=Kr().map(g=>`select(0u, 1u, ${C.map(X=>`${g} == ${X}u`).join(" || ")})`);e.push(`  let ${p} = ${D.join(" + ")};`)}f.size>0&&v>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let c=0;c<i.length;c++){let p=i[c],C=ke(p.clause,a,u),I=Vn(p.tribe);c===0?e.push(`  if (${C}) {`):e.push(`  } else if (${C}) {`),e.push(`    result = ${I}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),r.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),Hn(e,r,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let c=-1;c<=1;c++)for(let p=-1;p<=1;p++){if(p===0&&c===0)continue;let C=cn(p,c),I=zr("x",p,"COLS"),D=zr("y",c,"ROWS");e.push(`    let ${C} = readCell(${I}, ${D});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function cn(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function Kr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(cn(r,t));return e}function zr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function U(e){let t=[];for(let r of e)if(r===At)for(let n=0;n<j.length;n++)t.push(n);else{let n=ie.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function Vn(e){return e===At?0:ie.get(e)??0}function Zn(e){let t=new Set;for(let r of e)qt(r,t);return t}function qt(e,t){switch(e.kind){case Je:case et:break;case rt:case nt:case it:case st:case tt:{let r=U(e.tribes).sort();t.add(r.join(","));break}case ot:qt(e.clause,t);break;case at:case ut:case ct:for(let r of e.clauses)qt(r,t);break}}function Qn(e){let t=new Set;for(let r of e)Xt(r,t);return t}function Xt(e,t){switch(e.kind){case Je:case et:case tt:case rt:case nt:case it:case st:break;case kt:{let r=U(e.tribe1).sort(),n=U(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case ot:Xt(e.clause,t);break;case at:case ut:case ct:for(let r of e.clauses)Xt(r,t);break}}function ke(e,t,r){switch(e.kind){case Je:return"false";case et:{let n=U(e.tribes);return n.length===0?"false":n.length===j.length?"true":`(${n.map(s=>`selfTribe == ${s}u`).join(" || ")})`}case tt:{let n=U(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case rt:{let n=U(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case nt:{let n=U(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case it:{let n=U(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case st:{let n=U(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case kt:{let n=r.get(U(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),s=`(i32(${r.get(U(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${s})`;case">":return`(i32(${n}) > ${s})`;case"<":return`(i32(${n}) < ${s})`;case"\u2265":return`(i32(${n}) >= ${s})`;case"\u2264":return`(i32(${n}) <= ${s})`;default:return`(i32(${n}) == ${s})`}}case ot:return`!(${ke(e.clause,t,r)})`;case at:return`(${e.clauses.map(i=>ke(i,t,r)).join(" && ")})`;case ut:return`(${e.clauses.map(i=>ke(i,t,r)).join(" || ")})`;case ct:return`(((${e.clauses.map(s=>ke(s,t,r)).map(s=>`select(0u, 1u, ${s})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var cr=48;function Yt(){Oe?.destroy(),Oe=o.createBuffer({size:cr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Jn(){let e=new ArrayBuffer(cr),t=new Float32Array(e),r=new Uint32Array(e),n=(Zr%m+m)%m,i=(Qr%b+b)%b,s=Math.floor(n),a=Math.floor(i);t[0]=fe.width,t[1]=fe.height,t[2]=Vr,t[4]=n-s,t[5]=i-a,r[6]=m,r[7]=b,r[8]=s,r[9]=a,r[10]=j.length,o.queue.writeBuffer(Oe,0,e)}function Et(){return Te({cols:m,rows:b},_)}function se(){return Be(_)}async function Ht(){let e=Et();F=o.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await yt(e,F),G=o.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await yt(e,G);let t=o.createCommandEncoder();t.clearBuffer(F),t.clearBuffer(G),o.queue.submit([t.finish()]),k=!1}function jt(){let e=new Uint32Array(sn);for(let t=0;t<j.length;t++){let r=j[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),s=parseInt(r.substring(4,6),16);e[t]=n|i<<8|s<<16}me&&me.destroy(),me=o.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),o.queue.writeBuffer(me,0,e)}function ei(){return wr.replace("__CELLS_PER_WORD__",`${_.cellsPerWord}u`).replace("__WORD_SHIFT__",`${_.wordShift}u`).replace("__CELL_SHIFT__",`${_.cellShift}u`).replace("__CELL_INDEX_MASK__",`${_.cellIndexMask}u`).replace("__CELL_MASK__",`${_.cellMask}u`)}function Vt(){let e=o.createShaderModule({code:ei()});ht=o.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:Kt}]},primitive:{topology:"triangle-list"}})}function Zt(){Hr=o.createBindGroup({layout:ht.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Oe}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:me}}]}),jr=o.createBindGroup({layout:ht.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Oe}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:me}}]})}function Qt(){Rt=Kn();let e=jn(),t=o.createShaderModule({code:e});we=o.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),ir=o.createBindGroup({layout:we.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:G}}]}),sr=o.createBindGroup({layout:we.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:F}}]})}function Jt(){zt=zn(),de=Tr({device:o,cols:m,rows:b,gridFormat:_,dispatchPlan:zt})}var lr=176;function ti(){return`
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

const CELLS_PER_WORD: u32 = ${_.cellsPerWord}u;
const WORD_SHIFT: u32 = ${_.wordShift}u;
const CELL_SHIFT: u32 = ${_.cellShift}u;
const CELL_INDEX_MASK: u32 = ${_.cellIndexMask}u;
const CELL_MASK: u32 = ${_.cellMask}u;

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
`}function er(){let e=o.createShaderModule({code:ti()});ft=o.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),be?.destroy(),be=o.createBuffer({size:lr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Jr=o.createBindGroup({layout:ft.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:be}}]}),en=o.createBindGroup({layout:ft.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:be}}]})}function ri(e,t,r,n,i,s,a){let l=ie.get(Qe)??0,f=wn++,u=new ArrayBuffer(lr),v=new Int32Array(u),c=new Uint32Array(u);v[0]=t,v[1]=r,c[2]=m,c[3]=b,c[4]=n,c[5]=i,c[6]=s,c[7]=l,c[8]=f,c[9]=a.length,c[10]=0;for(let I=0;I<a.length&&I<32;I++)c[11+I]=a[I];o.queue.writeBuffer(be,0,u);let p=Math.ceil(n/8),C=e.beginComputePass();C.setPipeline(ft),C.setBindGroup(0,k?en:Jr),C.dispatchWorkgroups(p,p),C.end()}function ni(){let e=k?G:F,t=Et(),r;try{r=o.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=o.createCommandEncoder();return n.copyBufferToBuffer(e,0,r,0,t),o.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function ln(){if(d=Et(),!Z()){E=0;return}let e=ii();E=Math.max(1,Math.floor(e/d))}function ii(){return d>=Or?d:Math.min(Math.max(Or,d),ar())}function fn(){if(E<1||d<=0)return Ur;let e=Math.max(d,E*d),t=Math.floor(Gn/e);return Math.max(1,Math.min(Ur,t||1))}function tr(){let e=Z();self.postMessage({type:"limits",maxBytes:_e(),vramBudgetBytes:an(),frameByteSize:d,recordingAvailable:e,vramSimulationBytes:Nn(),vramRecordingBytes:Wn(),gridFormat:se()})}function $e(){return!Z()||E<1||w===null||V.length===0||le>=fn()?!1:h<E?!0:V.some((e,t)=>N[t]&&e.mapState==="unmapped")}function Ke(e){if(E<1||w===null||h>=E)return;let t=k?G:F,r=h*d,n=o.createCommandEncoder();n.copyBufferToBuffer(t,0,w,r,d),o.queue.submit([n.finish()]),P.push(e),h++}function Ct(){if(w===null||h===0||V.length===0)return;let e=N.indexOf(!0);if(e<0)return;N[e]=!1;let t=V[e];if(t.mapState!=="unmapped"){N[e]=!0;return}let r=h*d,n=tn++,i=[...P],s=i[0],a=i[i.length-1],l=`chunk-${String(n).padStart(6,"0")}.bin`,f=h,u=o.createCommandEncoder();u.copyBufferToBuffer(w,0,t,0,r),o.queue.submit([u.finish()]);let v={chunkId:n,generationStart:s,generationEnd:a,blockCount:f,codec:Mt,uncompressedBytes:r,storedBytes:r,gridFormat:se(),generations:i,filename:l};Wt(1),le++,he();let c=Ae;t.mapAsync(GPUMapMode.READ).then(async()=>{let p=t.getMappedRange(),C=new ArrayBuffer(r);new Uint8Array(C).set(new Uint8Array(p,0,r)),t.unmap(),c===Ae&&(N[e]=!0,he(),y.push(v),fr(),si(v,C).then(()=>{c===Ae&&(le--,he(),Wt(-1),Se(),self.postMessage({type:"chunkSealed",filename:v.filename,rawBytes:r,blockCount:v.blockCount,cols:m,rows:b,rawGridFormat:v.gridFormat,storageGridFormat:Be(Ft(Ue.tribes.length))}),We&&H===0&&(We=!1,pn()))}))}).catch(()=>{c===Ae&&(N[e]=!0,le--,he(),Wt(-1))}),h=0,P=[]}function fr(){y.length>0&&(K.generationStart=y[0].generationStart,K.generationEnd=y[y.length-1].generationEnd),P.length>0&&(y.length===0&&(K.generationStart=P[0]),K.generationEnd=P[P.length-1]),K.chunks=[...y]}async function qr(e){Ae++,tn=0,h=0,P=[],y=[],le=0,H>0&&(H=0,self.postMessage({type:"chunksSaving",active:!1})),L&&(L=!1,self.postMessage({type:"backpressure",active:!1})),We=!1,z=A,K={chunks:[],generationStart:e,generationEnd:e,gridFormat:se()},await dn(),Se()}async function dr(){return ae&&await ae,Fe||(Fe=await(await navigator.storage.getDirectory()).getDirectoryHandle(gt,{create:!0})),Fe}async function si(e,t){let i=await(await(await dr()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function oi(e){let t=await dr();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function dn(){if(ae){await ae;return}ae=(async()=>{let e=await navigator.storage.getDirectory();Fe=null;try{await e.removeEntry(gt,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${gt}:`,t)}Fe=await e.getDirectoryHandle(gt,{create:!0})})();try{await ae}finally{ae=null}}function pn(){fr(),self.postMessage({type:"recording",manifest:{chunks:y.map(e=>({...e,generations:[...e.generations]})),generationStart:K.generationStart,generationEnd:K.generationEnd,gridFormat:se()},cols:m,rows:b})}function ai(){return h>0?P[h-1]!==R:y.length>0?y[y.length-1].generationEnd!==R:!0}function De(e=!1){if(A){if(e){if(z){if(!$e())return;z=!1}}else if(z)return;!ai()||!$e()||(h>=E&&Ct(),Ke(R))}}function pr(){if(!dt)return;let e=dt;dt=null;let t=o.createCommandEncoder();ri(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),o.queue.submit([t.finish()]),A&&h>0&&P[h-1]===R&&(h--,P.pop(),Ke(R))}async function ui(e,t=Mt){let s=await(await(await(await dr()).getFileHandle(e)).getFile()).arrayBuffer();return t===nn?$n(s):s}function ci(){let e=h;for(let t of y)e+=t.blockCount;return e}function gn(){return Mr(m,b,Ne.enabled,Ne.sections)}function li(){return Er(gn())}function ue(e){pt=li(),de&&pt.length!==0&&Ar({device:o,encoder:e,resources:de,sourceBuffer:k?G:F,dispatchPlan:zt,enabledSections:pt})}function ce(){let e=R;if(!de||e===Y||O)return;let t=de,r=[...pt],n=gn();Y=e,O=!0,kr({resources:t,enabledSections:r}).then(i=>{let s=ie.get(Qe)??0,a=ci(),l=Lr({generation:e,tribes:j,deadTribeIndex:s,readback:i,enabledSections:r,availability:n,liveMetricSettings:Ne.sections,cols:m,rows:b,totalFrames:a,fps:ur,canStepBack:a>1,recordingBytes:y.reduce((f,u)=>f+u.storedBytes,0),recordingRawBytes:y.reduce((f,u)=>f+u.uncompressedBytes,0)});if(O=!1,self.postMessage(l),te){te=!1,Y=-1;let f=o.createCommandEncoder();ue(f),o.queue.submit([f.finish()]),ce()}}).catch(()=>{O=!1})}function fi(){let e=m*b;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function di(){let e=m*b;return e>1e7?2:e>1e6?4:e>1e5?8:16}function mn(e){if(e<=0)return;let t=Rt,r=o.createCommandEncoder();for(let n=0;n<e;n++){let i=r.beginComputePass();i.setPipeline(we),i.setBindGroup(0,k?sr:ir),i.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),i.end(),k=!k,R++}o.queue.submit([r.finish()]),ye+=e}function pi(){self.postMessage({type:"generation",generation:R,fps:ur})}function gr(){let e=o.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(we),t.setBindGroup(0,k?sr:ir);let r=Rt;t.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),t.end(),o.queue.submit([e.finish()]),k=!k,R++}function ne(){Jn();let e=$t.getCurrentTexture().createView(),t=o.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(ht),r.setBindGroup(0,k?jr:Hr),r.draw(3),r.end(),o.queue.submit([t.finish()])}function bn(e){lt===0&&(lt=e);let t=e-lt;t>=1e3&&(ur=ye/(t/1e3),ye=0,lt=e)}function mr(){return A&&Z()?"recording":"nonRecording"}function gi(){return re<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/re}}function oe(e){return e.request.stopCondition.kind==="targetGeneration"}function ze(e){return e.request.stopCondition.kind==="targetGeneration"&&R>=e.request.stopCondition.generation}function Pt(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-R)}function br(e=!1){if(e&&(Y=-1),O)te=!0;else{let t=o.createCommandEncoder();ue(t),o.queue.submit([t.finish()]),ce()}}function hn(){br(!0),ne()}function Bt(e,t){if(!t)return;(e-Nt>=1e3||Nt===0)&&!O&&(Nt=e,br())}function qe(e,t){e.request.pacing.kind!=="max"&&!oe(e)||t-e.lastProgressTime>=1e3&&(e.lastProgressTime=t,pi())}function hr(){L&&(L=!1,self.postMessage({type:"backpressure",active:!1}))}function mi(){L||(L=!0,self.postMessage({type:"backpressure",active:!0}))}function Sn(){return $e()?(h>=E&&Ct(),$e()):!1}function Le(){W||q||S||self.requestAnimationFrame(rr)}function pe(e){let t=S;if(!t||t.pumpPending||W||q)return;let r=t.token;t.pumpPending=!0;let n=()=>{!S||S.token!==r||(S.pumpPending=!1,Ci(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?o.queue.onSubmittedWorkDone().then(n).catch(()=>{S?.token===r&&(S.pumpPending=!1)}):queueMicrotask(n)}function Sr(e,t){S&&T("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),S={kind:e,request:t,token:++rn,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0},pe(t.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function ee(){x&&Sr(mr(),{pacing:gi(),stopCondition:{kind:"none"}})}function T(e,t={}){let r=S;if(!r)return;S=null,rn++;let n=oe(r),i=t.restore!==!1&&!!r.request.restoreAfterStop;i&&r.request.restoreAfterStop&&(x=r.request.restoreAfterStop.running,re=r.request.restoreAfterStop.targetStepDuration),n&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?hr():L&&he(),t.render!==!1&&!W&&!q&&hn(),t.restartRestoredRun!==!1&&i&&x&&!W&&!q?ee():Le()}function Xr(e){let t=S;!t||!oe(t)||(t.request.restoreAfterStop&&(t.request.restoreAfterStop.running=e),T("cancelled"))}function bi(e){T("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Sr(mr(),e)}function yn(e,t,r){mi(),qe(e,t),Bt(t,r),pe("drain")}function hi(e,t){let r=fi(),n=di(),i=!1;for(let s=0;s<n;s++){let a=Pt(e);if(a<=0)break;let l=Math.min(r,a);mn(l),i=!0}if(qe(e,t),ze(e)){T("targetReached");return}pe(i?"drain":"raf")}function Si(e,t){De(!0);let r=!1,n=performance.now()+14;for(;Pt(e)>0&&performance.now()<n;){if(!Sn()){yn(e,t,r);return}gr(),ye++,r=!0,Ke(R)}if(hr(),qe(e,t),Bt(t,r),ze(e)){T("targetReached");return}pe("raf")}function yi(e,t,r){e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=Math.floor(e.stepAccumulator/t),s=Math.min(i,Pt(e)),a=s>0;if(a&&(mn(s),e.stepAccumulator-=t*s),qe(e,r),ze(e)){T("targetReached");return}oe(e)||(ne(),Bt(r,a)),pe("raf")}function _i(e,t,r){De(!0),e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=!1;for(;e.stepAccumulator>=t&&Pt(e)>0;){if(!Sn()){yn(e,r,i);return}gr(),ye++,e.stepAccumulator-=t,i=!0,Ke(R)}if(hr(),qe(e,r),ze(e)){T("targetReached");return}oe(e)||(ne(),Bt(r,i)),pe("raf")}function Ci(e){let t=S;if(!t||W||q)return;if(bn(e),oe(t)||pr(),ze(t)){T("targetReached");return}if(t.request.pacing.kind==="max"){t.kind==="recording"?Si(t,e):hi(t,e);return}let r=1e3/t.request.pacing.genPerSecond;t.kind==="recording"?_i(t,r,e):yi(t,r,e)}function rr(e){if(W||q){self.requestAnimationFrame(rr);return}bn(e),!S&&(pr(),re>0&&!Ie&&ne(),self.requestAnimationFrame(rr))}function Ri(e,t){let r=o?_e():Number.POSITIVE_INFINITY;return Fr(t.bitsPerCell)&&Lt(t.bitsPerCell,e.tribes.length)&&wt(e,Pe(t.bitsPerCell),r)?Pe(t.bitsPerCell):Gr(e.tribes.length,e,r)}function Yr(e,t){Ue=e,m=e.cols,b=e.rows,_=Ri(e,t),nr=xe(m,_),j=[...e.tribes],K.gridFormat=se(),ie.clear(),j.forEach((r,n)=>ie.set(r.id,n))}async function _n(e){fe=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");o=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),q=!1,o.lost.then(n=>{let i=n.message||n.reason||"unknown";T("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),q=!0,x=!1,W=!0,self.postMessage({type:"deviceLost",reason:i})}),self.postMessage({type:"limits",maxBytes:_e(),vramBudgetBytes:an(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:se()});let r=fe.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");$t=r,Kt=navigator.gpu.getPreferredCanvasFormat(),$t.configure({device:o,format:Kt,alphaMode:"opaque"})}async function vi(){try{return await _n(fe),!0}catch(e){let t=e instanceof Error?e.message:String(e);return T("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),q=!0,x=!1,W=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function Cn(){w=o.createBuffer({size:E*d,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await yt(E*d,w),h=0,P=[]}async function Rn(){let e=E*d;V=[],N=[];for(let t=0;t<vt;t++){let r=o.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});V.push(r),N.push(!0),await yt(e,r)}}async function Mi(){await dn()}async function Ei(){Yt(),ln(),await Ht(),jt(),Vt(),Zt(),Qt(),er(),Jt(),await Mi(),Z()?(await Cn(),await Rn()):(_t(),A=!1,z=!1),await St(),tr()}async function Pi(){T("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),W=!0,self.postMessage({type:"rebuilding",active:!0});try{await or()}catch{}if(q&&!await vi())return!1;$r(),Yt(),ln(),Wr(Z());try{await Ht(),jt(),Vt(),Qt(),er(),Zt(),Jt(),Z()?(await Cn(),await Rn()):(_t(),A=!1,z=!1),await St(),tr()}catch(e){let t=e instanceof Error?e.message:String(e);self.postMessage({type:"gpuError",reason:t});try{$r(),Yt(),Wr(!1),await Ht(),jt(),Vt(),Qt(),er(),Zt(),Jt(),A=!1,z=!1,d=Et(),_t(),await St(),tr()}catch(r){return console.warn("GPU recovery also failed, device may be lost:",r),!1}}return W=!1,self.postMessage({type:"rebuilding",active:!1}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(A=t.recording,Ne=Ot(t.liveMetrics),z=A,Yr(t.ruleset,t.simulationGridFormat),await _n(t.canvas),await Ei(),O)te=!0;else{let r=o.createCommandEncoder();ue(r),o.queue.submit([r.finish()]),ce()}Se(),x=t.running,re=t.speed<0?0:1e3/t.speed,x?ee():Le();break}case"setLiveMetrics":{Ne=Ot(t.liveMetrics),Y=-1,br(!0);break}case"setRuleset":{if(T("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Yr(t.ruleset,t.simulationGridFormat),!await Pi())break;if(R=0,Y=-1,await qr(0),x?ee():Le(),O)te=!0;else{let n=o.createCommandEncoder();ue(n),o.queue.submit([n.finish()]),ce()}break}case"setRunning":if(x=t.running,t.running){S||ee();break}S&&oe(S)?Xr(!1):S?T("manual"):(L&&he(),hn(),Le());break;case"setSpeed":{let r=re<=0,n=t.speed<0?0:1e3/t.speed;re=n,S&&!oe(S)&&x?(T("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&n>0?(Ie=!0,o.queue.onSubmittedWorkDone().then(()=>{Ie=!1,ne(),ee()})):ee()):x&&!S?ee():r&&n>0&&(Ie=!0,o.queue.onSubmittedWorkDone().then(()=>{Ie=!1,ne(),Le()}));break}case"camera":Vr=t.scale,Zr=t.offsetX,Qr=t.offsetY;break;case"resize":fe.width=t.width,fe.height=t.height;break;case"draw":{let r=t.tribes.map(n=>ie.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};dt={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{ni().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:R,cols:m,rows:b,gridFormat:se()})}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:R,cols:m,rows:b,gridFormat:se()})});break}case"loadSnapshot":{let r=k?G:F,n=Gt(t.gridFormat),i=Te({cols:m,rows:b},n);if(t.grid.byteLength!==i)break;let s=n.bitsPerCell===_.bitsPerCell?t.grid:Dt(Ut(t.grid,{cols:m,rows:b},n),{cols:m,rows:b},_);o.queue.writeBuffer(r,0,s),R=t.generation,await qr(t.generation);break}case"setRecording":{let r=S?.request;if(t.recording&&Z()&&!A){if(A=!0,z=!0,Y=-1,O)te=!0;else{let n=o.createCommandEncoder();ue(n),o.queue.submit([n.finish()]),ce()}Se()}else(!t.recording||!Z())&&(A=!1,z=!1);r&&S?bi(r):!S&&x&&ee();break}case"getRecording":{if(We)break;await or(),De(!1),h>0&&Ct(),H>0?We=!0:pn();break}case"stepBack":{let r=0;for(let l of y)r+=l.blockCount;let n=r+h,i=Math.min(t.count,n-1);if(i<=0)break;let s=n-1-i,a=k?G:F;if(s>=r){let l=s-r;h=l+1,P.length=h,R=P[l];let f=o.createCommandEncoder();f.copyBufferToBuffer(w,l*d,a,0,d),o.queue.submit([f.finish()])}else{if(H>0){await new Promise(g=>{let B=setInterval(()=>{H===0&&(clearInterval(B),g())},10)}),r=0;for(let g of y)r+=g.blockCount}let l=0,f=0,u=0;for(let g=0;g<y.length;g++){let B=y[g];if(s<l+B.blockCount){f=g,u=s-l;break}l+=B.blockCount}let v=y[f],c=await ui(v.filename,v.codec),p=Gt(v.gridFormat),C=Te({cols:m,rows:b},p);if(p.bitsPerCell===_.bitsPerCell){let g=(u+1)*d;o.queue.writeBuffer(w,0,new Uint8Array(c,0,g))}else{let g=new Uint8Array((u+1)*d);for(let B=0;B<=u;B++){let X=B*C,Xe=new Uint8Array(c,X,C),Ye=Dr(Xe,{cols:m,rows:b},p),ge=Dt(Ye,{cols:m,rows:b},_);g.set(new Uint8Array(ge.buffer,ge.byteOffset,ge.byteLength),B*d)}o.queue.writeBuffer(w,0,g),o.queue.writeBuffer(a,0,g.subarray(u*d,(u+1)*d))}if(h=u+1,P=v.generations.slice(0,u+1),R=P[u],p.bitsPerCell===_.bitsPerCell){let g=o.createCommandEncoder();g.copyBufferToBuffer(w,u*d,a,0,d),o.queue.submit([g.finish()])}let D=y.splice(f).map(g=>g.filename);oi(D)}if(fr(),Se(),Y=-1,O)te=!0;else{let l=o.createCommandEncoder();ue(l),o.queue.submit([l.finish()]),ce()}ne();break}case"stepForward":{if(pr(),t.count===1){if(De(!0),gr(),ye++,A&&$e()&&(h>=E&&Ct(),Ke(R)),Y=-1,O)te=!0;else{let r=o.createCommandEncoder();ue(r),o.queue.submit([r.finish()]),ce()}ne()}else self.postMessage({type:"stepping",active:!0}),De(!0),Sr(mr(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:R+t.count},restoreAfterStop:{running:x,targetStepDuration:re}});break}case"cancelStepping":{Xr(S?.request.restoreAfterStop?.running??x);break}case"updateChunkCodec":{let r=y.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,K.chunks=[...y],Se());break}case"getUncompressedChunks":{let r=y.filter(n=>n.codec===Mt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:m,rows:b,rawGridFormat:n.gridFormat,storageGridFormat:Be(Ft(Ue.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
