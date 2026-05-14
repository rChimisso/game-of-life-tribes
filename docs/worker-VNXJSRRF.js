var bt=["population","diversity","boundary"];function ne(e,t){return e.includes(t)}var ye=256*Uint32Array.BYTES_PER_ELEMENT,_e=Uint32Array.BYTES_PER_ELEMENT;function sr(e){return e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:""}function or(e){return e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`}function ar(e){return e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`}function on(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${sr(i)}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${or(i)}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${ar(i)}
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
`}function an(e){let{cols:t,rows:r,gridFormat:n,dispatchPlan:i}=e;return`
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
${sr(i)}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${or(i)}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${ar(i)}
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
`}function ur(e){let{device:t}=e,r=t.createShaderModule({code:on(e)}),n=t.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),i=t.createBuffer({size:ye,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),s=t.createBuffer({size:ye,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),a=t.createShaderModule({code:an(e)}),l=t.createComputePipeline({layout:"auto",compute:{module:a,entryPoint:"main"}}),f=t.createBuffer({size:_e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),c=t.createBuffer({size:_e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});return{histogramPipeline:n,histogramBuffer:i,histogramReadBuffer:s,boundaryPipeline:l,boundaryBuffer:f,boundaryReadBuffer:c}}function cr(e){e?.histogramBuffer.destroy(),e?.histogramReadBuffer.destroy(),e?.boundaryBuffer.destroy(),e?.boundaryReadBuffer.destroy()}function lr(e){let{device:t,encoder:r,resources:n,sourceBuffer:i,dispatchPlan:s,enabledSections:a}=e;if(ne(a,"population")||ne(a,"diversity")){let l=new Uint32Array(256);t.queue.writeBuffer(n.histogramBuffer,0,l);let f=t.createBindGroup({layout:n.histogramPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.histogramBuffer}}]}),c=r.beginComputePass();c.setPipeline(n.histogramPipeline),c.setBindGroup(0,f),c.dispatchWorkgroups(s.dispatchWgX,s.dispatchWgY),c.end(),r.copyBufferToBuffer(n.histogramBuffer,0,n.histogramReadBuffer,0,ye)}if(ne(a,"boundary")){let l=new Uint32Array([0]);t.queue.writeBuffer(n.boundaryBuffer,0,l);let f=t.createBindGroup({layout:n.boundaryPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:n.boundaryBuffer}}]}),c=r.beginComputePass();c.setPipeline(n.boundaryPipeline),c.setBindGroup(0,f),c.dispatchWorkgroups(s.dispatchWgX,s.dispatchWgY),c.end(),r.copyBufferToBuffer(n.boundaryBuffer,0,n.boundaryReadBuffer,0,_e)}}async function dr(e){let{resources:t,enabledSections:r}=e,n=ne(r,"population")||ne(r,"diversity"),i=ne(r,"boundary"),s=[];n&&s.push(t.histogramReadBuffer.mapAsync(GPUMapMode.READ)),i&&s.push(t.boundaryReadBuffer.mapAsync(GPUMapMode.READ)),await Promise.all(s);let a=new Uint32Array(256);n&&(a=new Uint32Array(t.histogramReadBuffer.getMappedRange().slice(0)),t.histogramReadBuffer.unmap());let l=0;if(i){let f=new Uint32Array(t.boundaryReadBuffer.getMappedRange().slice(0));t.boundaryReadBuffer.unmap(),l=f[0]??0}return{histogram:a,boundaryLength:l}}function fr(e){let{generation:t,tribes:r,deadTribeIndex:n,state:i,readback:s,totalFrames:a,fps:l,canStepBack:f,recordingBytes:c,recordingRawBytes:B}=e,u={},g=0,C=0,v={},G=0;for(let d=0;d<r.length;d++){let R=s.histogram[d]??0;u[r[d].id]=R,d!==n&&(G+=R,R>0&&(i.tribeLastAliveGen.set(d,t),i.tribeEverAlive.add(d)))}if(G>0)for(let d=0;d<r.length;d++){if(d===n)continue;let R=(s.histogram[d]??0)/G;R>0&&(g-=R*Math.log2(R),C+=R*R)}for(let d=0;d<r.length;d++){if(d===n)continue;(s.histogram[d]??0)>0?v[r[d].id]=null:i.tribeEverAlive.has(d)?v[r[d].id]=i.tribeLastAliveGen.get(d)??0:v[r[d].id]=0}return{type:"metrics",generation:t,population:u,shannonEntropy:g,simpsonIndex:1-C,boundaryLength:s.boundaryLength,extinctionTime:v,totalFrames:a,fps:l,canStepBack:f,recordingBytes:c,recordingRawBytes:B}}var pr=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var ht=[1,2,4,8,16,32],cn={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},ln={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},dn={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Oe={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},fn={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},yt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},H={1:cn,2:ln,4:dn,8:Oe,16:fn,32:yt};var _t="any",Ne="dead";var We="empty",$e="is",St="comparison",Ke="count",qe="none",ze="exactly",Xe="min",Ye="max",He="not",je="and",Ve="or",Ze="xor";function gr(e){return ht.includes(e)}function pn(e){return 2**e}function Ct(e,t){return t<=pn(e)}function Rt(e,t,r){return Pe(e,t)<=r}function Pt(e){return e<=2?H[1]:e<=4?H[2]:e<=16?H[4]:e<=256?H[8]:e<=65536?H[16]:H[32]}function Se(e){return H[e]}function mr(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of ht){let i=Se(n);if(Ct(n,e)&&Rt(t,i,r))return i}return yt}function Bt(e){return Se(e?.bitsPerCell??8)}function Ce(e){return{bitsPerCell:e.bitsPerCell}}function Re(e,t){return Math.ceil(e/t.cellsPerWord)}function Pe(e,t){return Re(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function gn(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function Et(e,t,r){let n=Re(t.cols,r),i=new Uint32Array(n*t.rows);for(let s=0;s<t.rows;s++)for(let a=0;a<n;a++){let l=a*r.cellsPerWord,f=0;for(let c=0;c<r.cellsPerWord&&l+c<t.cols;c++){let B=e[s*t.cols+l+c]&r.cellMask;f|=B<<(c<<r.cellShift)}i[s*n+a]=f>>>0}return i}function vt(e,t,r){let n=Re(t.cols,r),i=new Uint8Array(t.cols*t.rows);for(let s=0;s<t.rows;s++)for(let a=0;a<n;a++){let l=e[s*n+a],f=a*r.cellsPerWord;for(let c=0;c<r.cellsPerWord&&f+c<t.cols;c++)i[s*t.cols+f+c]=l>>>(c<<r.cellShift)&r.cellMask}return i}function br(e,t,r){return vt(gn(e),t,r)}var o,K=!1,Mt,At,ue,Ie,_=0,S=0,qt=0,y=Oe,z=[],ee=new Map,ct,kt,F,L,we,de,it,xr,Tr,Te,zt,Xt,k=!1,Mr=1,Ar=0,kr=0,T=!1,N=!1,Z=100,P=0,Je,fe,Ir,wr,bn=0,et=null,ce=null,Q=-1,U=!1,V=!1,xt=0,Fr=new Map,Lr=new Set,A=!1,$=!1,W={chunks:[],generationStart:0,generationEnd:0,gridFormat:Ce(Oe)},Gr=0,h=[],b=null,Dr=0,Be=!1,w=null,m=0,x=[],E=64,p=0,lt=3,X=[],O=[],tt="gol-recording",dt="raw-packed",Ur="deflate-raw",Me=null,ie=null,q=0,ae=0,hr=12,I=!1,Ee=0,Or=256,hn=Or*Uint32Array.BYTES_PER_ELEMENT,yr=256*1024*1024,yn=512*1024*1024,_n=512*1024*1024,_r=128*1024*1024*1024,rt=0,nt=0,Ae=[];function Sn(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function Nr(e){M("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),T=!1,self.postMessage({type:"gpuError",reason:Sn(e)})}self.addEventListener("error",e=>{e.preventDefault(),Nr(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),Nr(e.reason)});async function Yt(){await o.queue.onSubmittedWorkDone()}function Sr(e){rt=0,nt=2+(e?1+lt:0),Ae=[]}async function st(){if(Ae.length===0)return;let e=o.createCommandEncoder();for(let t of Ae)e.clearBuffer(t);o.queue.submit([e.finish()]),await Yt(),Ae=[]}async function ot(e,t){!N||nt<=0||(rt+=e,nt--,Ae.push(t),rt>=Cn()&&nt>0&&(await st(),rt=0))}function Cn(){return Math.min(be(),_n)}function be(){return Math.min(o.limits.maxBufferSize,o.limits.maxStorageBufferBindingSize)}function Ht(){return Math.min(be(),1073741824)}function Wr(){return Math.max(be()*2,Ht()*6)}function Y(){return p>0&&p<=Ht()}function Rn(){return p<=0?0:p*2+Vt+hn+Zt+ye*2+_e*2}function Pn(){return E<1||p<=0?0:E*p*(1+lt)}function at(){w?.destroy(),w=null;for(let e of X)e?.destroy();X=[],O=[],E=0,m=0,x=[]}function Cr(){F?.destroy(),L?.destroy(),cr(ce),ce=null,fe?.destroy(),at()}function Tt(e){let t=q>0;q+=e;let r=q>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function pe(){if(E<1||X.length===0){I&&(I=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=zr(),t=!O.some(i=>i)&&m>=E,r=ae>=e,n;if(I){let i=O.some(a=>a),s=ae<=Math.floor(e/2);n=!(i&&s)}else n=t||r;n!==I&&(I=n,self.postMessage({type:"backpressure",active:n}))}async function ge(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??_r/128,_r),r=e.usage??0,n=0,i=0;for(let l of h)l.codec===dt?n+=l.storedBytes:i+=l.storedBytes;let s=E*p,a=A?(1+lt)*s:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:a})}var Fe=!1;async function Bn(e){let t=new DecompressionStream(Ur),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:f,value:c}=await i.read();if(f)break;n.push(c)}let s=0;for(let f of n)s+=f.byteLength;let a=new Uint8Array(s),l=0;for(let f of n)a.set(f,l),l+=f.byteLength;return a.buffer}var me=0,Qe=0,jt=0;function $r(e,t,r=o.limits.maxComputeWorkgroupsPerDimension){if(e<=r&&t<=r)return{logicalWgX:e,logicalWgY:t,dispatchWgX:e,dispatchWgY:t,remapped:!1};let n=e*t,i=Math.min(n,r),s=Math.ceil(n/i);if(s>r)throw new Error(`Grid requires ${e}x${t} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${r}.`);return{logicalWgX:e,logicalWgY:t,dispatchWgX:i,dispatchWgY:s,remapped:!0}}function En(){return $r(Math.ceil(qt/16),Math.ceil(S/16))}function vn(){return $r(Math.ceil(_/16),Math.ceil(S/16))}function xn(e,t){t.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${t.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${t.dispatchWgX}u;`))}function Tn(e){e.push(`const CELLS_PER_WORD: u32 = ${y.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${y.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${y.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${y.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${y.cellMask}u;`)}function Mn(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function An(e,t,r){if(t.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${r} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${r} = gid.x;`),e.push("  let y = gid.y;")}function kn(){let e=[],t=qt,r=ct;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${z.map(u=>u.id).join(", ")}`),e.push(`// Rules: ${Ie.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${_}u;`),e.push(`const ROWS: u32 = ${S}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),xn(e,r),Tn(e),e.push(""),Mn(e,"gridIn","PACKED_COLS"),e.push("");let n=ee.get(Ne)??0,i=Ie.rules.filter(u=>!u.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let s=wn(i.map(u=>u.clause)),a=new Map,l=0;for(let u of s){let g=`count_${l++}`;a.set(u,g)}for(let[u,g]of a){let C=u.split(",").map(Number),G=Rr().map(d=>`select(0u, 1u, ${C.map(he=>`${d} == ${he}u`).join(" || ")})`);e.push(`  let ${g} = ${G.join(" + ")};`)}s.size>0&&e.push("");let f=Fn(i.map(u=>u.clause)),c=new Map,B=0;for(let u of f)if(a.has(u))c.set(u,a.get(u));else{let g=`eq_count_${B++}`;c.set(u,g)}for(let[u,g]of c){if(a.has(u))continue;let C=u.split(",").map(Number),G=Rr().map(d=>`select(0u, 1u, ${C.map(he=>`${d} == ${he}u`).join(" || ")})`);e.push(`  let ${g} = ${G.join(" + ")};`)}f.size>0&&B>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let u=0;u<i.length;u++){let g=i[u],C=ve(g.clause,a,c),v=In(g.tribe);u===0?e.push(`  if (${C}) {`):e.push(`  } else if (${C}) {`),e.push(`    result = ${v}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),r.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),An(e,r,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let u=-1;u<=1;u++)for(let g=-1;g<=1;g++){if(g===0&&u===0)continue;let C=Kr(g,u),v=Pr("x",g,"COLS"),G=Pr("y",u,"ROWS");e.push(`    let ${C} = readCell(${v}, ${G});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function Kr(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function Rr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(Kr(r,t));return e}function Pr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function D(e){let t=[];for(let r of e)if(r===_t)for(let n=0;n<z.length;n++)t.push(n);else{let n=ee.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function In(e){return e===_t?0:ee.get(e)??0}function wn(e){let t=new Set;for(let r of e)It(r,t);return t}function It(e,t){switch(e.kind){case We:case $e:break;case qe:case ze:case Xe:case Ye:case Ke:{let r=D(e.tribes).sort();t.add(r.join(","));break}case He:It(e.clause,t);break;case je:case Ve:case Ze:for(let r of e.clauses)It(r,t);break}}function Fn(e){let t=new Set;for(let r of e)wt(r,t);return t}function wt(e,t){switch(e.kind){case We:case $e:case Ke:case qe:case ze:case Xe:case Ye:break;case St:{let r=D(e.tribe1).sort(),n=D(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case He:wt(e.clause,t);break;case je:case Ve:case Ze:for(let r of e.clauses)wt(r,t);break}}function ve(e,t,r){switch(e.kind){case We:return"false";case $e:{let n=D(e.tribes);return n.length===0?"false":n.length===z.length?"true":`(${n.map(s=>`selfTribe == ${s}u`).join(" || ")})`}case Ke:{let n=D(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case qe:{let n=D(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case ze:{let n=D(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case Xe:{let n=D(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case Ye:{let n=D(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case St:{let n=r.get(D(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),s=`(i32(${r.get(D(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${s})`;case">":return`(i32(${n}) > ${s})`;case"<":return`(i32(${n}) < ${s})`;case"\u2265":return`(i32(${n}) >= ${s})`;case"\u2264":return`(i32(${n}) <= ${s})`;default:return`(i32(${n}) == ${s})`}}case He:return`!(${ve(e.clause,t,r)})`;case je:return`(${e.clauses.map(i=>ve(i,t,r)).join(" && ")})`;case Ve:return`(${e.clauses.map(i=>ve(i,t,r)).join(" || ")})`;case Ze:return`(((${e.clauses.map(s=>ve(s,t,r)).map(s=>`select(0u, 1u, ${s})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var Vt=48;function Ft(){we?.destroy(),we=o.createBuffer({size:Vt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Ln(){let e=new ArrayBuffer(Vt),t=new Float32Array(e),r=new Uint32Array(e),n=(Ar%_+_)%_,i=(kr%S+S)%S,s=Math.floor(n),a=Math.floor(i);t[0]=ue.width,t[1]=ue.height,t[2]=Mr,t[4]=n-s,t[5]=i-a,r[6]=_,r[7]=S,r[8]=s,r[9]=a,r[10]=z.length,o.queue.writeBuffer(we,0,e)}function ft(){return Pe({cols:_,rows:S},y)}function te(){return Ce(y)}async function Lt(){let e=ft();F=o.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ot(e,F),L=o.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ot(e,L);let t=o.createCommandEncoder();t.clearBuffer(F),t.clearBuffer(L),o.queue.submit([t.finish()]),k=!1}function Gt(){let e=new Uint32Array(Or);for(let t=0;t<z.length;t++){let r=z[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),s=parseInt(r.substring(4,6),16);e[t]=n|i<<8|s<<16}de&&de.destroy(),de=o.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),o.queue.writeBuffer(de,0,e)}function Gn(){return pr.replace("__CELLS_PER_WORD__",`${y.cellsPerWord}u`).replace("__WORD_SHIFT__",`${y.wordShift}u`).replace("__CELL_SHIFT__",`${y.cellShift}u`).replace("__CELL_INDEX_MASK__",`${y.cellIndexMask}u`).replace("__CELL_MASK__",`${y.cellMask}u`)}function Dt(){let e=o.createShaderModule({code:Gn()});it=o.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:At}]},primitive:{topology:"triangle-list"}})}function Ut(){xr=o.createBindGroup({layout:it.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:we}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:de}}]}),Tr=o.createBindGroup({layout:it.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:we}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:de}}]})}function Ot(){ct=En();let e=kn(),t=o.createShaderModule({code:e});Te=o.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),zt=o.createBindGroup({layout:Te.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:L}}]}),Xt=o.createBindGroup({layout:Te.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:F}}]})}function Nt(){kt=vn(),ce=ur({device:o,cols:_,rows:S,gridFormat:y,dispatchPlan:kt})}var Zt=176;function Dn(){return`
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
`}function Wt(){let e=o.createShaderModule({code:Dn()});Je=o.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),fe?.destroy(),fe=o.createBuffer({size:Zt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Ir=o.createBindGroup({layout:Je.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:fe}}]}),wr=o.createBindGroup({layout:Je.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:fe}}]})}function Un(e,t,r,n,i,s,a){let l=ee.get(Ne)??0,f=bn++,c=new ArrayBuffer(Zt),B=new Int32Array(c),u=new Uint32Array(c);B[0]=t,B[1]=r,u[2]=_,u[3]=S,u[4]=n,u[5]=i,u[6]=s,u[7]=l,u[8]=f,u[9]=a.length,u[10]=0;for(let v=0;v<a.length&&v<32;v++)u[11+v]=a[v];o.queue.writeBuffer(fe,0,c);let g=Math.ceil(n/8),C=e.beginComputePass();C.setPipeline(Je),C.setBindGroup(0,k?wr:Ir),C.dispatchWorkgroups(g,g),C.end()}function On(){let e=k?L:F,t=ft(),r;try{r=o.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=o.createCommandEncoder();return n.copyBufferToBuffer(e,0,r,0,t),o.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function qr(){if(p=ft(),!Y()){E=0;return}let e=Nn();E=Math.max(1,Math.floor(e/p))}function Nn(){return p>=yr?p:Math.min(Math.max(yr,p),Ht())}function zr(){if(E<1||p<=0)return hr;let e=Math.max(p,E*p),t=Math.floor(yn/e);return Math.max(1,Math.min(hr,t||1))}function $t(){let e=Y();self.postMessage({type:"limits",maxBytes:be(),vramBudgetBytes:Wr(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:Rn(),vramRecordingBytes:Pn(),gridFormat:te()})}function Le(){return!Y()||E<1||w===null||X.length===0||ae>=zr()?!1:m<E?!0:X.some((e,t)=>O[t]&&e.mapState==="unmapped")}function Ge(e){if(E<1||w===null||m>=E)return;let t=k?L:F,r=m*p,n=o.createCommandEncoder();n.copyBufferToBuffer(t,0,w,r,p),o.queue.submit([n.finish()]),x.push(e),m++}function ut(){if(w===null||m===0||X.length===0)return;let e=O.indexOf(!0);if(e<0)return;O[e]=!1;let t=X[e];if(t.mapState!=="unmapped"){O[e]=!0;return}let r=m*p,n=Gr++,i=[...x],s=i[0],a=i[i.length-1],l=`chunk-${String(n).padStart(6,"0")}.bin`,f=m,c=o.createCommandEncoder();c.copyBufferToBuffer(w,0,t,0,r),o.queue.submit([c.finish()]);let B={chunkId:n,generationStart:s,generationEnd:a,blockCount:f,codec:dt,uncompressedBytes:r,storedBytes:r,gridFormat:te(),generations:i,filename:l};Tt(1),ae++,pe();let u=Ee;t.mapAsync(GPUMapMode.READ).then(async()=>{let g=t.getMappedRange(),C=new ArrayBuffer(r);new Uint8Array(C).set(new Uint8Array(g,0,r)),t.unmap(),u===Ee&&(O[e]=!0,pe(),h.push(B),Qt(),Wn(B,C).then(()=>{u===Ee&&(ae--,pe(),Tt(-1),ge(),self.postMessage({type:"chunkSealed",filename:B.filename,rawBytes:r,blockCount:B.blockCount,cols:_,rows:S,rawGridFormat:B.gridFormat,storageGridFormat:Ce(Pt(Ie.tribes.length))}),Fe&&q===0&&(Fe=!1,Yr()))}))}).catch(()=>{u===Ee&&(O[e]=!0,ae--,pe(),Tt(-1))}),m=0,x=[]}function Qt(){h.length>0&&(W.generationStart=h[0].generationStart,W.generationEnd=h[h.length-1].generationEnd),x.length>0&&(h.length===0&&(W.generationStart=x[0]),W.generationEnd=x[x.length-1]),W.chunks=[...h]}async function Br(e){Ee++,Gr=0,m=0,x=[],h=[],ae=0,q>0&&(q=0,self.postMessage({type:"chunksSaving",active:!1})),I&&(I=!1,self.postMessage({type:"backpressure",active:!1})),Fe=!1,$=A,W={chunks:[],generationStart:e,generationEnd:e,gridFormat:te()},await Xr(),ge()}async function Jt(){return ie&&await ie,Me||(Me=await(await navigator.storage.getDirectory()).getDirectoryHandle(tt,{create:!0})),Me}async function Wn(e,t){let i=await(await(await Jt()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function $n(e){let t=await Jt();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function Xr(){if(ie){await ie;return}ie=(async()=>{let e=await navigator.storage.getDirectory();Me=null;try{await e.removeEntry(tt,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${tt}:`,t)}Me=await e.getDirectoryHandle(tt,{create:!0})})();try{await ie}finally{ie=null}}function Yr(){Qt(),self.postMessage({type:"recording",manifest:{chunks:h.map(e=>({...e,generations:[...e.generations]})),generationStart:W.generationStart,generationEnd:W.generationEnd,gridFormat:te()},cols:_,rows:S})}function Kn(){return m>0?x[m-1]!==P:h.length>0?h[h.length-1].generationEnd!==P:!0}function ke(e=!1){if(A){if(e){if($){if(!Le())return;$=!1}}else if($)return;!Kn()||!Le()||(m>=E&&ut(),Ge(P))}}function er(){if(!et)return;let e=et;et=null;let t=o.createCommandEncoder();Un(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),o.queue.submit([t.finish()]),A&&m>0&&x[m-1]===P&&(m--,x.pop(),Ge(P))}async function qn(e,t=dt){let s=await(await(await(await Jt()).getFileHandle(e)).getFile()).arrayBuffer();return t===Ur?Bn(s):s}function zn(){let e=m;for(let t of h)e+=t.blockCount;return e}function se(e){ce&&lr({device:o,encoder:e,resources:ce,sourceBuffer:k?L:F,dispatchPlan:kt,enabledSections:bt})}function oe(){let e=P;if(!ce||e===Q||U)return;let t=ce;Q=e,U=!0,dr({resources:t,enabledSections:bt}).then(r=>{let n=ee.get(Ne)??0,i=zn(),s=fr({generation:e,tribes:z,deadTribeIndex:n,state:{tribeLastAliveGen:Fr,tribeEverAlive:Lr},readback:r,totalFrames:i,fps:jt,canStepBack:i>1,recordingBytes:h.reduce((a,l)=>a+l.storedBytes,0),recordingRawBytes:h.reduce((a,l)=>a+l.uncompressedBytes,0)});if(U=!1,self.postMessage(s),V){V=!1,Q=-1;let a=o.createCommandEncoder();se(a),o.queue.submit([a.finish()]),oe()}}).catch(()=>{U=!1})}function Xn(){let e=_*S;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function Yn(){let e=_*S;return e>1e7?2:e>1e6?4:e>1e5?8:16}function Hr(e){if(e<=0)return;let t=ct,r=o.createCommandEncoder();for(let n=0;n<e;n++){let i=r.beginComputePass();i.setPipeline(Te),i.setBindGroup(0,k?Xt:zt),i.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),i.end(),k=!k,P++}o.queue.submit([r.finish()]),me+=e}function Hn(){self.postMessage({type:"generation",generation:P,fps:jt})}function tr(){let e=o.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(Te),t.setBindGroup(0,k?Xt:zt);let r=ct;t.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),t.end(),o.queue.submit([e.finish()]),k=!k,P++}function J(){Ln();let e=Mt.getCurrentTexture().createView(),t=o.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(it),r.setBindGroup(0,k?Tr:xr),r.draw(3),r.end(),o.queue.submit([t.finish()])}function jr(e){Qe===0&&(Qe=e);let t=e-Qe;t>=1e3&&(jt=me/(t/1e3),me=0,Qe=e)}function rr(){return A&&Y()?"recording":"nonRecording"}function jn(){return Z<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/Z}}function re(e){return e.request.stopCondition.kind==="targetGeneration"}function De(e){return e.request.stopCondition.kind==="targetGeneration"&&P>=e.request.stopCondition.generation}function pt(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-P)}function Vr(e=!1){if(e&&(Q=-1),U)V=!0;else{let t=o.createCommandEncoder();se(t),o.queue.submit([t.finish()]),oe()}}function Zr(){Vr(!0),J()}function gt(e,t){if(!t)return;(e-xt>=1e3||xt===0)&&!U&&(xt=e,Vr())}function Ue(e,t){e.request.pacing.kind!=="max"&&!re(e)||t-e.lastProgressTime>=1e3&&(e.lastProgressTime=t,Hn())}function nr(){I&&(I=!1,self.postMessage({type:"backpressure",active:!1}))}function Vn(){I||(I=!0,self.postMessage({type:"backpressure",active:!0}))}function Qr(){return Le()?(m>=E&&ut(),Le()):!1}function xe(){N||K||b||self.requestAnimationFrame(Kt)}function le(e){let t=b;if(!t||t.pumpPending||N||K)return;let r=t.token;t.pumpPending=!0;let n=()=>{!b||b.token!==r||(b.pumpPending=!1,ri(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?o.queue.onSubmittedWorkDone().then(n).catch(()=>{b?.token===r&&(b.pumpPending=!1)}):queueMicrotask(n)}function ir(e,t){b&&M("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),b={kind:e,request:t,token:++Dr,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0},le(t.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function j(){T&&ir(rr(),{pacing:jn(),stopCondition:{kind:"none"}})}function M(e,t={}){let r=b;if(!r)return;b=null,Dr++;let n=re(r),i=t.restore!==!1&&!!r.request.restoreAfterStop;i&&r.request.restoreAfterStop&&(T=r.request.restoreAfterStop.running,Z=r.request.restoreAfterStop.targetStepDuration),n&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?nr():I&&pe(),t.render!==!1&&!N&&!K&&Zr(),t.restartRestoredRun!==!1&&i&&T&&!N&&!K?j():xe()}function Er(e){let t=b;!t||!re(t)||(t.request.restoreAfterStop&&(t.request.restoreAfterStop.running=e),M("cancelled"))}function Zn(e){M("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),ir(rr(),e)}function Jr(e,t,r){Vn(),Ue(e,t),gt(t,r),le("drain")}function Qn(e,t){let r=Xn(),n=Yn(),i=!1;for(let s=0;s<n;s++){let a=pt(e);if(a<=0)break;let l=Math.min(r,a);Hr(l),i=!0}if(Ue(e,t),De(e)){M("targetReached");return}le(i?"drain":"raf")}function Jn(e,t){ke(!0);let r=!1,n=performance.now()+14;for(;pt(e)>0&&performance.now()<n;){if(!Qr()){Jr(e,t,r);return}tr(),me++,r=!0,Ge(P)}if(nr(),Ue(e,t),gt(t,r),De(e)){M("targetReached");return}le("raf")}function ei(e,t,r){e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=Math.floor(e.stepAccumulator/t),s=Math.min(i,pt(e)),a=s>0;if(a&&(Hr(s),e.stepAccumulator-=t*s),Ue(e,r),De(e)){M("targetReached");return}re(e)||(J(),gt(r,a)),le("raf")}function ti(e,t,r){ke(!0),e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=!1;for(;e.stepAccumulator>=t&&pt(e)>0;){if(!Qr()){Jr(e,r,i);return}tr(),me++,e.stepAccumulator-=t,i=!0,Ge(P)}if(nr(),Ue(e,r),De(e)){M("targetReached");return}re(e)||(J(),gt(r,i)),le("raf")}function ri(e){let t=b;if(!t||N||K)return;if(jr(e),re(t)||er(),De(t)){M("targetReached");return}if(t.request.pacing.kind==="max"){t.kind==="recording"?Jn(t,e):Qn(t,e);return}let r=1e3/t.request.pacing.genPerSecond;t.kind==="recording"?ti(t,r,e):ei(t,r,e)}function Kt(e){if(N||K){self.requestAnimationFrame(Kt);return}jr(e),!b&&(er(),Z>0&&!Be&&J(),self.requestAnimationFrame(Kt))}function ni(e,t){let r=o?be():Number.POSITIVE_INFINITY;return gr(t.bitsPerCell)&&Ct(t.bitsPerCell,e.tribes.length)&&Rt(e,Se(t.bitsPerCell),r)?Se(t.bitsPerCell):mr(e.tribes.length,e,r)}function vr(e,t){Ie=e,_=e.cols,S=e.rows,y=ni(e,t),qt=Re(_,y),z=[...e.tribes],W.gridFormat=te(),ee.clear(),z.forEach((r,n)=>ee.set(r.id,n))}async function en(e){ue=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");o=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),K=!1,o.lost.then(n=>{let i=n.message||n.reason||"unknown";M("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),K=!0,T=!1,N=!0,self.postMessage({type:"deviceLost",reason:i})}),self.postMessage({type:"limits",maxBytes:be(),vramBudgetBytes:Wr(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:te()});let r=ue.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");Mt=r,At=navigator.gpu.getPreferredCanvasFormat(),Mt.configure({device:o,format:At,alphaMode:"opaque"})}async function ii(){try{return await en(ue),!0}catch(e){let t=e instanceof Error?e.message:String(e);return M("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),K=!0,T=!1,N=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function tn(){w=o.createBuffer({size:E*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ot(E*p,w),m=0,x=[]}async function rn(){let e=E*p;X=[],O=[];for(let t=0;t<lt;t++){let r=o.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});X.push(r),O.push(!0),await ot(e,r)}}async function si(){await Xr()}async function oi(){Ft(),qr(),await Lt(),Gt(),Dt(),Ut(),Ot(),Wt(),Nt(),await si(),Y()?(await tn(),await rn()):(at(),A=!1,$=!1),await st(),$t()}async function ai(){M("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),N=!0,self.postMessage({type:"rebuilding",active:!0});try{await Yt()}catch{}if(K&&!await ii())return!1;Cr(),Ft(),qr(),Sr(Y());try{await Lt(),Gt(),Dt(),Ot(),Wt(),Ut(),Nt(),Y()?(await tn(),await rn()):(at(),A=!1,$=!1),await st(),$t()}catch(e){let t=e instanceof Error?e.message:String(e);self.postMessage({type:"gpuError",reason:t});try{Cr(),Ft(),Sr(!1),await Lt(),Gt(),Dt(),Ot(),Wt(),Ut(),Nt(),A=!1,$=!1,p=ft(),at(),await st(),$t()}catch(r){return console.warn("GPU recovery also failed, device may be lost:",r),!1}}return N=!1,self.postMessage({type:"rebuilding",active:!1}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(A=t.recording,$=A,vr(t.ruleset,t.simulationGridFormat),await en(t.canvas),await oi(),U)V=!0;else{let r=o.createCommandEncoder();se(r),o.queue.submit([r.finish()]),oe()}ge(),T=t.running,Z=t.speed<0?0:1e3/t.speed,T?j():xe();break}case"setRuleset":{if(M("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),vr(t.ruleset,t.simulationGridFormat),!await ai())break;if(P=0,Q=-1,await Br(0),T?j():xe(),Fr=new Map,Lr=new Set,U)V=!0;else{let n=o.createCommandEncoder();se(n),o.queue.submit([n.finish()]),oe()}break}case"setRunning":if(T=t.running,t.running){b||j();break}b&&re(b)?Er(!1):b?M("manual"):(I&&pe(),Zr(),xe());break;case"setSpeed":{let r=Z<=0,n=t.speed<0?0:1e3/t.speed;Z=n,b&&!re(b)&&T?(M("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&n>0?(Be=!0,o.queue.onSubmittedWorkDone().then(()=>{Be=!1,J(),j()})):j()):T&&!b?j():r&&n>0&&(Be=!0,o.queue.onSubmittedWorkDone().then(()=>{Be=!1,J(),xe()}));break}case"camera":Mr=t.scale,Ar=t.offsetX,kr=t.offsetY;break;case"resize":ue.width=t.width,ue.height=t.height;break;case"draw":{let r=t.tribes.map(n=>ee.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};et={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{On().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:P,cols:_,rows:S,gridFormat:te()})}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:P,cols:_,rows:S,gridFormat:te()})});break}case"loadSnapshot":{let r=k?L:F,n=Bt(t.gridFormat),i=Pe({cols:_,rows:S},n);if(t.grid.byteLength!==i)break;let s=n.bitsPerCell===y.bitsPerCell?t.grid:Et(vt(t.grid,{cols:_,rows:S},n),{cols:_,rows:S},y);o.queue.writeBuffer(r,0,s),P=t.generation,await Br(t.generation);break}case"setRecording":{let r=b?.request;if(t.recording&&Y()&&!A){if(A=!0,$=!0,Q=-1,U)V=!0;else{let n=o.createCommandEncoder();se(n),o.queue.submit([n.finish()]),oe()}ge()}else(!t.recording||!Y())&&(A=!1,$=!1);r&&b?Zn(r):!b&&T&&j();break}case"getRecording":{if(Fe)break;await Yt(),ke(!1),m>0&&ut(),q>0?Fe=!0:Yr();break}case"stepBack":{let r=0;for(let l of h)r+=l.blockCount;let n=r+m,i=Math.min(t.count,n-1);if(i<=0)break;let s=n-1-i,a=k?L:F;if(s>=r){let l=s-r;m=l+1,x.length=m,P=x[l];let f=o.createCommandEncoder();f.copyBufferToBuffer(w,l*p,a,0,p),o.queue.submit([f.finish()])}else{if(q>0){await new Promise(d=>{let R=setInterval(()=>{q===0&&(clearInterval(R),d())},10)}),r=0;for(let d of h)r+=d.blockCount}let l=0,f=0,c=0;for(let d=0;d<h.length;d++){let R=h[d];if(s<l+R.blockCount){f=d,c=s-l;break}l+=R.blockCount}let B=h[f],u=await qn(B.filename,B.codec),g=Bt(B.gridFormat),C=Pe({cols:_,rows:S},g);if(g.bitsPerCell===y.bitsPerCell){let d=(c+1)*p;o.queue.writeBuffer(w,0,new Uint8Array(u,0,d))}else{let d=new Uint8Array((c+1)*p);for(let R=0;R<=c;R++){let he=R*C,nn=new Uint8Array(u,he,C),sn=br(nn,{cols:_,rows:S},g),mt=Et(sn,{cols:_,rows:S},y);d.set(new Uint8Array(mt.buffer,mt.byteOffset,mt.byteLength),R*p)}o.queue.writeBuffer(w,0,d),o.queue.writeBuffer(a,0,d.subarray(c*p,(c+1)*p))}if(m=c+1,x=B.generations.slice(0,c+1),P=x[c],g.bitsPerCell===y.bitsPerCell){let d=o.createCommandEncoder();d.copyBufferToBuffer(w,c*p,a,0,p),o.queue.submit([d.finish()])}let G=h.splice(f).map(d=>d.filename);$n(G)}if(Qt(),ge(),Q=-1,U)V=!0;else{let l=o.createCommandEncoder();se(l),o.queue.submit([l.finish()]),oe()}J();break}case"stepForward":{if(er(),t.count===1){if(ke(!0),tr(),me++,A&&Le()&&(m>=E&&ut(),Ge(P)),Q=-1,U)V=!0;else{let r=o.createCommandEncoder();se(r),o.queue.submit([r.finish()]),oe()}J()}else self.postMessage({type:"stepping",active:!0}),ke(!0),ir(rr(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:P+t.count},restoreAfterStop:{running:T,targetStepDuration:Z}});break}case"cancelStepping":{Er(b?.request.restoreAfterStop?.running??T);break}case"updateChunkCodec":{let r=h.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,W.chunks=[...h],ge());break}case"getUncompressedChunks":{let r=h.filter(n=>n.codec===dt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:_,rows:S,rawGridFormat:n.gridFormat,storageGridFormat:Ce(Pt(Ie.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
