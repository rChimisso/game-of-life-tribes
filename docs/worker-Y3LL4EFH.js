var nt=1073741824;var zt=`// Render shader: draws the grid as a full-screen quad.\r
// Reads cell tribe IDs from a storage buffer, looks up colors from a uniform array.\r
// Supports zoom, pan, and toroidal tiling.\r
\r
struct Uniforms {\r
  canvas_size: vec2f,    // Canvas width, height in pixels.\r
  grid_size: vec2f,      // Grid cols, rows.\r
  scale: f32,            // Pixels per cell.\r
  offset: vec2f,         // Camera offset in cell units.\r
  tribe_count: u32,      // Number of tribes.\r
};\r
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
const CELL_INDEX_MASK: u32 = __CELL_INDEX_MASK__;\r
const CELL_MASK: u32 = __CELL_MASK__;\r
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
fn fs_main(in: VertexOutput) -> @location(0) vec4f {\r
  // Convert pixel coordinate to world (cell) coordinate.\r
  let px = in.uv * u.canvas_size;\r
  let world = px / u.scale + u.offset;\r
\r
  // Toroidal wrap.\r
  let cols = u.grid_size.x;\r
  let rows = u.grid_size.y;\r
  let cx = ((world.x % cols) + cols) % cols;\r
  let cy = ((world.y % rows) + rows) % rows;\r
\r
  let ix = u32(cx);\r
  let iy = u32(cy);\r
\r
  // Read tribe ID from the active packed grid buffer.\r
  let packed_cols = (u32(cols) + CELLS_PER_WORD - 1u) >> WORD_SHIFT;\r
  let word_idx = iy * packed_cols + (ix >> WORD_SHIFT);\r
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
`;var Nt=[1,2,4,8,16,32],T={1:{bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},2:{bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},4:{bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},8:{bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},16:{bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},32:{bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295}},bn=T[1],hn=T[2],yn=T[4],st=T[8],Sn=T[16],Tr=T[32];function qt(e){return Nt.includes(e)}function Ar(e){return 2**e}function it(e,t){return t<=Ar(e)}function at(e,t,r,n){return xe(e,t,r)<=n}function ot(e){return e<=2?T[1]:e<=4?T[2]:e<=16?T[4]:e<=256?T[8]:e<=65536?T[16]:T[32]}function _e(e){return T[e]}function Ht(e,t=1,r=1,n=Number.POSITIVE_INFINITY){for(let i of Nt){let u=_e(i);if(it(i,e)&&at(t,r,u,n))return u}return Tr}function ut(e){return _e(e?.bitsPerCell??8)}function Me(e){return{bitsPerCell:e.bitsPerCell}}function Pe(e,t){return Math.ceil(e/t.cellsPerWord)}function xe(e,t,r){return Pe(e,r)*t*Uint32Array.BYTES_PER_ELEMENT}function Lr(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function ct(e,t,r,n){let i=Pe(t,n),u=new Uint32Array(i*r);for(let l=0;l<r;l++)for(let c=0;c<i;c++){let p=c*n.cellsPerWord,o=0;for(let f=0;f<n.cellsPerWord&&p+f<t;f++){let a=e[l*t+p+f]&n.cellMask;o|=a<<(f<<n.cellShift)}u[l*i+c]=o>>>0}return u}function lt(e,t,r,n){let i=Pe(t,n),u=new Uint8Array(t*r);for(let l=0;l<r;l++)for(let c=0;c<i;c++){let p=e[l*i+c],o=c*n.cellsPerWord;for(let f=0;f<n.cellsPerWord&&o+f<t;f++)u[l*t+o+f]=p>>>(f<<n.cellShift)&n.cellMask}return u}function Yt(e,t,r,n){return lt(Lr(e),t,r,n)}var Te={id:"dead",color:"000000"};var s,le=!1,dt,pt,fe,K,_=0,B=0,Qe=0,d=st,E=[],te=new Map,G,R,Ge,pe,Ke,ar,or,ke,Rt,Tt,F=!1,ur=1,cr=0,lr=0,L=!1,re=!1,k=100,X=0,j=0,h=0,Ue,ge,fr,dr,Ur=0,Ie=null,Oe,pr,gr,be,he,De,mr,br,ye,Se,O=-1,v=!1,N=!1,de=0,gt=new Map,mt=new Set,M=!1,H={chunks:[],generationStart:0,generationEnd:0,gridFormat:Me(st)},hr=0,y=[],U=-1,bt=!1,We=100,I=0,ht=!1,Ce=!1;function yr(){return L&&k<=0&&U<0&&!M}function yt(){re||le||Ce||!yr()||q(performance.now())}function $e(){re||le||self.requestAnimationFrame(q)}var A=null,m=0,x=[],S=64,g=0,Je=3,J=[],$=[],ze="gol-recording",Ee=null,ie=null,Q=0,ce=0,Kt=12,P=!1,we=0;var At=256,Ir=At*Uint32Array.BYTES_PER_ELEMENT,St=At*Uint32Array.BYTES_PER_ELEMENT,Ct=Uint32Array.BYTES_PER_ELEMENT,Xt=256*1024*1024,Or=512*1024*1024,Dr=512*1024*1024,jt=128*1024*1024*1024,Ne=0,qe=0,Fe=[];async function Lt(){await s.queue.onSubmittedWorkDone()}function Vt(e){Ne=0,qe=2+(e?1+Je:0),Fe=[]}async function Xe(){if(Fe.length===0)return;let e=s.createCommandEncoder();for(let t of Fe)e.clearBuffer(t);s.queue.submit([e.finish()]),await Lt(),Fe=[]}async function je(e,t){!re||qe<=0||(Ne+=e,qe--,Fe.push(t),Ne>=Wr()&&qe>0&&(await Xe(),Ne=0))}function Wr(){return Math.min(Be(),Dr)}function Be(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function Ut(){return Math.min(Be(),1073741824)}function Sr(){return Math.max(Be()*2,Ut()*6)}function ne(){return g>0&&g<=Ut()}function $r(){return g<=0?0:g*2+Ot+Ir+Dt+St*2+Ct*2}function zr(){return S<1||g<=0?0:S*g*(1+Je)}function Ve(){A?.destroy(),A=null;for(let e of J)e?.destroy();J=[],$=[],S=0,m=0,x=[]}function Zt(){G?.destroy(),R?.destroy(),be?.destroy(),he?.destroy(),ye?.destroy(),Se?.destroy(),ge?.destroy(),Ve()}function ft(e){let t=Q>0;Q+=e;let r=Q>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function me(){if(S<1||J.length===0){P&&(P=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=_r(),t=!$.some(i=>i)&&m>=S,r=ce>=e,n;if(P){let i=$.some(l=>l),u=ce<=Math.floor(e/2);n=!(i&&u)}else n=t||r;n!==P&&(P=n,self.postMessage({type:"backpressure",active:n}))}async function ve(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??jt/128,jt),r=e.usage??0,n=0,i=0;for(let c of y)c.codec==="raw-packed"?n+=c.storedBytes:i+=c.storedBytes;let u=S*g,l=M?(1+Je)*u:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:l})}var Re=!1;async function Nr(e){let t=new DecompressionStream("deflate-raw"),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:p,value:o}=await i.read();if(p)break;n.push(o)}let u=0;for(let p of n)u+=p.byteLength;let l=new Uint8Array(u),c=0;for(let p of n)l.set(p,c),c+=p.byteLength;return l.buffer}var ae=0,Ae=0,It=0;function qr(e){e.push(`const CELLS_PER_WORD: u32 = ${d.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${d.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${d.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${d.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${d.cellMask}u;`)}function Hr(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Yr(){let e=[],t=Qe;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${E.map(o=>o.id).join(", ")}`),e.push(`// Rules: ${K.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${_}u;`),e.push(`const ROWS: u32 = ${B}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),qr(e),e.push(""),Hr(e,"gridIn","PACKED_COLS"),e.push("");let r=te.get(Te.id)??0;e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let n=Xr(K.rules.map(o=>o.clause)),i=new Map,u=0;for(let o of n){let f=`count_${u++}`;i.set(o,f)}for(let[o,f]of i){let a=o.split(",").map(Number),w=Qt().map(z=>`select(0u, 1u, ${a.map(C=>`${z} == ${C}u`).join(" || ")})`);e.push(`  let ${f} = ${w.join(" + ")};`)}n.size>0&&e.push("");let l=jr(K.rules.map(o=>o.clause)),c=new Map,p=0;for(let o of l)if(i.has(o))c.set(o,i.get(o));else{let f=`eq_count_${p++}`;c.set(o,f)}for(let[o,f]of c){if(i.has(o))continue;let a=o.split(",").map(Number),w=Qt().map(z=>`select(0u, 1u, ${a.map(C=>`${z} == ${C}u`).join(" || ")})`);e.push(`  let ${f} = ${w.join(" + ")};`)}l.size>0&&p>0&&e.push(""),e.push(`  var result: u32 = ${r}u;`),e.push("");for(let o=0;o<K.rules.length;o++){let f=K.rules[o],a=He(f.clause,i,c),b=Kr(f.tribe);o===0?e.push(`  if (${a}) {`):e.push(`  } else if (${a}) {`),e.push(`    result = ${b}u;`)}K.rules.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let o=-1;o<=1;o++)for(let f=-1;f<=1;f++){if(f===0&&o===0)continue;let a=Cr(f,o),b=Jt("x",f,"COLS"),w=Jt("y",o,"ROWS");e.push(`    let ${a} = readCell(${b}, ${w});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function Cr(e,t){return`n${t===-1?"T":t===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function Qt(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(Cr(r,t));return e}function Jt(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function ue(e){let t=[];for(let r of e)if(r==="any")for(let n=0;n<E.length;n++)t.push(n);else{let n=te.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function Kr(e){return e==="any"?0:te.get(e)??0}function Xr(e){let t=new Set;for(let r of e)Bt(r,t);return t}function Bt(e,t){switch(e.kind){case"count":{let r=ue(e.tribes).sort();t.add(r.join(","));break}case"not":Bt(e.clause,t);break;case"and":case"or":for(let r of e.clauses)Bt(r,t);break}}function jr(e){let t=new Set;for(let r of e)_t(r,t);return t}function _t(e,t){switch(e.kind){case"equality":{let r=ue(e.tribe1).sort(),n=ue(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case"not":_t(e.clause,t);break;case"and":case"or":for(let r of e.clauses)_t(r,t);break}}function He(e,t,r){switch(e.kind){case"is":{let n=ue(e.tribes);return n.length===0?"false":n.length===E.length?"true":`(${n.map(u=>`selfTribe == ${u}u`).join(" || ")})`}case"count":{let n=ue(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case"equality":{let n=ue(e.tribe1).sort(),i=ue(e.tribe2).sort(),u=r.get(n.join(",")),l=r.get(i.join(","));return`(${u} == ${l})`}case"not":return`!(${He(e.clause,t,r)})`;case"and":return`(${e.clauses.map(i=>He(i,t,r)).join(" && ")})`;case"or":return`(${e.clauses.map(i=>He(i,t,r)).join(" || ")})`;default:return"false"}}var Ot=48;function Mt(){Ge?.destroy(),Ge=s.createBuffer({size:Ot,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Vr(){let e=new ArrayBuffer(Ot),t=new Float32Array(e),r=new Uint32Array(e);t[0]=fe.width,t[1]=fe.height,t[2]=_,t[3]=B,t[4]=ur,t[6]=cr,t[7]=lr,r[8]=E.length,s.queue.writeBuffer(Ge,0,e)}function et(){return xe(_,B,d)}function se(){return Me(d)}async function Pt(){let e=et();G=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await je(e,G),R=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await je(e,R);let t=s.createCommandEncoder();t.clearBuffer(G),t.clearBuffer(R),s.queue.submit([t.finish()]),F=!1}function xt(){let e=new Uint32Array(At);for(let t=0;t<E.length;t++){let r=E[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),u=parseInt(r.substring(4,6),16);e[t]=n|i<<8|u<<16}pe&&pe.destroy(),pe=s.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(pe,0,e)}function Zr(){return zt.replace("__CELLS_PER_WORD__",`${d.cellsPerWord}u`).replace("__WORD_SHIFT__",`${d.wordShift}u`).replace("__CELL_SHIFT__",`${d.cellShift}u`).replace("__CELL_INDEX_MASK__",`${d.cellIndexMask}u`).replace("__CELL_MASK__",`${d.cellMask}u`)}function wt(){let e=s.createShaderModule({code:Zr()});Ke=s.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:pt}]},primitive:{topology:"triangle-list"}})}function kt(){ar=s.createBindGroup({layout:Ke.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ge}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:pe}}]}),or=s.createBindGroup({layout:Ke.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ge}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:pe}}]})}function Et(){let e=Yr(),t=s.createShaderModule({code:e});ke=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),Rt=s.createBindGroup({layout:ke.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:R}}]}),Tt=s.createBindGroup({layout:ke.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:G}}]})}function Qr(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = ${_}u;
const ROWS: u32 = ${B}u;
const CELLS_PER_WORD: u32 = ${d.cellsPerWord}u;
const WORD_SHIFT: u32 = ${d.wordShift}u;
const CELL_SHIFT: u32 = ${d.cellShift}u;
const CELL_INDEX_MASK: u32 = ${d.cellIndexMask}u;
const CELL_MASK: u32 = ${d.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

  let x = gid.x;
  let y = gid.y;
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
`}function Jr(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${_}u;
const ROWS: u32 = ${B}u;
const CELLS_PER_WORD: u32 = ${d.cellsPerWord}u;
const WORD_SHIFT: u32 = ${d.wordShift}u;
const CELL_SHIFT: u32 = ${d.cellShift}u;
const CELL_INDEX_MASK: u32 = ${d.cellIndexMask}u;
const CELL_MASK: u32 = ${d.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

  let x = gid.x;
  let y = gid.y;
  if (x < COLS && y < ROWS) {
    var edges = 0u;
    let self_tribe = readCell(x, y);

    // Check right neighbor.
    if (readCell((x + 1u) % COLS, y) != self_tribe) {
      edges += 1u;
    }

    // Check bottom neighbor.
    if (readCell(x, (y + 1u) % ROWS) != self_tribe) {
      edges += 1u;
    }

    if (edges > 0u) {
      atomicAdd(&localCount, edges);
    }
  }
  workgroupBarrier();

  // One thread flushes the workgroup sum to the global counter.
  if (lid == 0u) {
    let sum = atomicLoad(&localCount);
    if (sum > 0u) {
      atomicAdd(&boundary, sum);
    }
  }
}
`}function Ft(){let e=s.createShaderModule({code:Qr()});Oe=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),be=s.createBuffer({size:St,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),he=s.createBuffer({size:St,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),pr=s.createBindGroup({layout:Oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:be}}]}),gr=s.createBindGroup({layout:Oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:be}}]});let t=s.createShaderModule({code:Jr()});De=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),ye=s.createBuffer({size:Ct,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),Se=s.createBuffer({size:Ct,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),mr=s.createBindGroup({layout:De.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:ye}}]}),br=s.createBindGroup({layout:De.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:ye}}]})}var Dt=176;function en(){return`
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

const CELLS_PER_WORD: u32 = ${d.cellsPerWord}u;
const WORD_SHIFT: u32 = ${d.wordShift}u;
const CELL_SHIFT: u32 = ${d.cellShift}u;
const CELL_INDEX_MASK: u32 = ${d.cellIndexMask}u;
const CELL_MASK: u32 = ${d.cellMask}u;

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
`}function vt(){let e=s.createShaderModule({code:en()});Ue=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),ge?.destroy(),ge=s.createBuffer({size:Dt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),fr=s.createBindGroup({layout:Ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:ge}}]}),dr=s.createBindGroup({layout:Ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:ge}}]})}function tn(e,t,r,n,i,u,l){let c=te.get(Te.id)??0,p=Ur++,o=new ArrayBuffer(Dt),f=new Int32Array(o),a=new Uint32Array(o);f[0]=t,f[1]=r,a[2]=_,a[3]=B,a[4]=n,a[5]=i,a[6]=u,a[7]=c,a[8]=p,a[9]=l.length,a[10]=0;for(let z=0;z<l.length&&z<32;z++)a[11+z]=l[z];s.queue.writeBuffer(ge,0,o);let b=Math.ceil(n/8),w=e.beginComputePass();w.setPipeline(Ue),w.setBindGroup(0,F?dr:fr),w.dispatchWorkgroups(b,b),w.end()}function rn(){let e=F?R:G,t=et(),r;try{r=s.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder();return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function Br(){if(g=et(),!ne()){S=0;return}let e=nn();S=Math.max(1,Math.floor(e/g))}function nn(){return g>=Xt?g:Math.min(Math.max(Xt,g),Ut())}function _r(){if(S<1||g<=0)return Kt;let e=Math.max(g,S*g),t=Math.floor(Or/e);return Math.max(1,Math.min(Kt,t||1))}function Gt(){let e=ne();self.postMessage({type:"limits",maxBytes:Be(),vramBudgetBytes:Sr(),frameByteSize:g,recordingAvailable:e,vramSimulationBytes:$r(),vramRecordingBytes:zr(),gridFormat:se()})}function ee(){return!ne()||S<1||A===null||J.length===0||ce>=_r()?!1:m<S?!0:J.some((e,t)=>$[t]&&e.mapState==="unmapped")}function V(e){if(S<1||A===null||m>=S)return;let t=F?R:G,r=m*g,n=s.createCommandEncoder();n.copyBufferToBuffer(t,0,A,r,g),s.queue.submit([n.finish()]),x.push(e),m++}function Z(){if(A===null||m===0||J.length===0)return;let e=$.indexOf(!0);if(e<0)return;$[e]=!1;let t=J[e];if(t.mapState!=="unmapped"){$[e]=!0;return}let r=m*g,n=hr++,i=[...x],u=i[0],l=i[i.length-1],c=`chunk-${String(n).padStart(6,"0")}.bin`,p=m,o=s.createCommandEncoder();o.copyBufferToBuffer(A,0,t,0,r),s.queue.submit([o.finish()]);let f={chunkId:n,generationStart:u,generationEnd:l,blockCount:p,codec:"raw-packed",uncompressedBytes:r,storedBytes:r,gridFormat:se(),generations:i,filename:c};ft(1),ce++,me();let a=we;t.mapAsync(GPUMapMode.READ).then(async()=>{let b=t.getMappedRange(),w=new ArrayBuffer(r);new Uint8Array(w).set(new Uint8Array(b,0,r)),t.unmap(),a===we&&($[e]=!0,me(),y.push(f),Wt(),sn(f,w).then(()=>{a===we&&(ce--,me(),ft(-1),ve(),self.postMessage({type:"chunkSealed",filename:f.filename,rawBytes:r,blockCount:f.blockCount,cols:_,rows:B,rawGridFormat:f.gridFormat,storageGridFormat:Me(ot(K.tribes.length))}),Re&&Q===0&&(Re=!1,Pr()))}))}).catch(()=>{a===we&&($[e]=!0,ce--,me(),ft(-1))}),m=0,x=[]}function Wt(){y.length>0&&(H.generationStart=y[0].generationStart,H.generationEnd=y[y.length-1].generationEnd),x.length>0&&(y.length===0&&(H.generationStart=x[0]),H.generationEnd=x[x.length-1]),H.chunks=[...y]}async function er(e){we++,hr=0,m=0,x=[],y=[],ce=0,Q>0&&(Q=0,self.postMessage({type:"chunksSaving",active:!1})),P&&(P=!1,self.postMessage({type:"backpressure",active:!1})),Re=!1,H={chunks:[],generationStart:e,generationEnd:e,gridFormat:se()},await Mr(),ve()}async function $t(){return ie&&await ie,Ee||(Ee=await(await navigator.storage.getDirectory()).getDirectoryHandle(ze,{create:!0})),Ee}async function sn(e,t){let i=await(await(await $t()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function an(e){let t=await $t();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function Mr(){if(ie){await ie;return}ie=(async()=>{let e=await navigator.storage.getDirectory();Ee=null;try{await e.removeEntry(ze,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${ze}:`,t)}Ee=await e.getDirectoryHandle(ze,{create:!0})})();try{await ie}finally{ie=null}}function Pr(){Wt(),self.postMessage({type:"recording",manifest:{chunks:y.map(e=>({...e,generations:[...e.generations]})),generationStart:H.generationStart,generationEnd:H.generationEnd,gridFormat:se()},cols:_,rows:B})}function Ze(){return m>0?x[m-1]!==h:y.length>0?y[y.length-1].generationEnd!==h:!0}function tr(){!M||!Ze()||!ee()||(m>=S&&Z(),V(h))}function xr(){if(!Ie)return;let e=Ie;Ie=null;let t=s.createCommandEncoder();tn(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),M&&m>0&&x[m-1]===h&&(m--,x.pop(),V(h))}async function on(e,t="raw-packed"){let u=await(await(await(await $t()).getFileHandle(e)).getFile()).arrayBuffer();return t==="deflate-raw"?Nr(u):u}function rr(){let e=m;for(let t of y)e+=t.blockCount;return e}function D(e){let t=Math.ceil(_/16),r=Math.ceil(B/16),n=new Uint32Array(256);s.queue.writeBuffer(be,0,n);let i=e.beginComputePass();i.setPipeline(Oe),i.setBindGroup(0,F?gr:pr),i.dispatchWorkgroups(t,r),i.end(),e.copyBufferToBuffer(be,0,he,0,256*4);let u=new Uint32Array([0]);s.queue.writeBuffer(ye,0,u);let l=e.beginComputePass();l.setPipeline(De),l.setBindGroup(0,F?br:mr),l.dispatchWorkgroups(t,r),l.end(),e.copyBufferToBuffer(ye,0,Se,0,4)}function W(){let e=h;if(e===O||v)return;O=e,v=!0;let t=[];t.push(he.mapAsync(GPUMapMode.READ)),t.push(Se.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=te.get(Te.id)??0,n={},i=0,u=0,l={},c=new Uint32Array(he.getMappedRange().slice(0));he.unmap();let p=0;for(let a=0;a<E.length;a++){let b=c[a]??0;n[E[a].id]=b,a!==r&&(p+=b,b>0&&(gt.set(a,e),mt.add(a)))}if(p>0)for(let a=0;a<E.length;a++){if(a===r)continue;let b=(c[a]??0)/p;b>0&&(i-=b*Math.log2(b),u+=b*b)}for(let a=0;a<E.length;a++){if(a===r)continue;(c[a]??0)>0?l[E[a].id]=null:mt.has(a)?l[E[a].id]=gt.get(a)??0:l[E[a].id]=0}let o=new Uint32Array(Se.getMappedRange().slice(0));Se.unmap();let f=o[0]??0;if(v=!1,self.postMessage({type:"metrics",generation:e,population:n,shannonEntropy:i,simpsonIndex:1-u,boundaryLength:f,extinctionTime:l,totalFrames:rr(),fps:It,canStepBack:rr()>1,recordingBytes:y.reduce((a,b)=>a+b.storedBytes,0),recordingRawBytes:y.reduce((a,b)=>a+b.uncompressedBytes,0)}),N){N=!1,O=-1;let a=s.createCommandEncoder();D(a),s.queue.submit([a.finish()]),W()}}).catch(()=>{v=!1})}function nr(){let e=_*B;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function un(){let e=_*B;return e>1e7?2:e>1e6?4:e>1e5?8:16}function sr(e){if(e<=0)return;let t=Math.ceil(Qe/16),r=Math.ceil(B/16),n=s.createCommandEncoder();for(let i=0;i<e;i++){let u=n.beginComputePass();u.setPipeline(ke),u.setBindGroup(0,F?Tt:Rt),u.dispatchWorkgroups(t,r),u.end(),F=!F,h++}s.queue.submit([n.finish()]),ae+=e}function Le(){self.postMessage({type:"generation",generation:h,fps:It})}function Ye(){let e=s.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(ke),t.setBindGroup(0,F?Tt:Rt);let r=Math.ceil(Qe/16),n=Math.ceil(B/16);t.dispatchWorkgroups(r,n),t.end(),s.queue.submit([e.finish()]),F=!F,h++}function oe(){Vr();let e=dt.getCurrentTexture().createView(),t=s.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(Ke),r.setBindGroup(0,F?or:ar),r.draw(3),r.end(),s.queue.submit([t.finish()])}function q(e){if(re||le){self.requestAnimationFrame(q);return}Ae===0&&(Ae=e);let t=e-Ae;if(t>=1e3&&(It=ae/(t/1e3),ae=0,Ae=e),U>=0){if(M){let n=!1,i=performance.now()+14;for(;h<U&&performance.now()<i;){if(!ee()){n=!0;break}m>=S&&Z(),Ye(),ae++,V(h)}if(n){P||(P=!0,self.postMessage({type:"backpressure",active:!0})),e-I>=1e3&&(I=e,Le()),s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(q)});return}P&&(P=!1,self.postMessage({type:"backpressure",active:!1}))}else{let n=Math.min(nr(),U-h);sr(n)}if(e-I>=1e3&&(I=e,Le()),h>=U){if(U=-1,L=bt,k=We,j=0,X=0,I=0,P&&(P=!1,self.postMessage({type:"backpressure",active:!1})),O=-1,v)N=!0;else{let n=s.createCommandEncoder();D(n),s.queue.submit([n.finish()]),W()}oe(),self.postMessage({type:"stepping",active:!1}),self.requestAnimationFrame(q)}else M?self.requestAnimationFrame(q):s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(q)});return}xr();let r=!1;if(L){M&&Ze()&&ee()&&(m>=S&&Z(),V(h));let n=!1;j===0&&(j=e);let i=e-j;if(j=e,k<=0){if(M){let u=!1,l=performance.now()+14;for(;performance.now()<l;){if(!ee()){u=!0;break}m>=S&&Z(),Ye(),ae++,n=!0,V(h)}if(u){if(P||(P=!0,self.postMessage({type:"backpressure",active:!0})),e-I>=1e3&&(I=e,Le()),n&&(e-de>=1e3||de===0)&&!v){de=e;let p=s.createCommandEncoder();D(p),s.queue.submit([p.finish()]),W()}s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(q)});return}P&&(P=!1,self.postMessage({type:"backpressure",active:!1}))}else if(!Ce){let u=nr(),l=un();for(let c=0;c<l;c++)sr(u),n=!0;Ce=!0,s.queue.onSubmittedWorkDone().then(()=>{Ce=!1,yr()?yt():$e()})}e-I>=1e3&&(I=e,Le())}else for(X+=i;X>=k;){if(M){if(!ee())break;m>=S&&Z()}Ye(),ae++,X-=k,n=!0,M&&V(h)}n&&(r=(e-de>=1e3||de===0)&&!v)}if(k>0&&!ht&&oe(),r){de=e;let n=s.createCommandEncoder();D(n),s.queue.submit([n.finish()]),W()}k<=0&&!M&&L||self.requestAnimationFrame(q)}function cn(e,t){let r=s?Be():Number.POSITIVE_INFINITY;return qt(t.bitsPerCell)&&it(t.bitsPerCell,e.tribes.length)&&at(e.cols,e.rows,_e(t.bitsPerCell),r)?_e(t.bitsPerCell):Ht(e.tribes.length,e.cols,e.rows,r)}function ir(e,t){K=e,_=e.cols,B=e.rows,d=cn(e,t),Qe=Pe(_,d),E=[...e.tribes],H.gridFormat=se(),te.clear(),E.forEach((r,n)=>te.set(r.id,n))}async function wr(e){fe=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");s=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),le=!1,s.lost.then(r=>{let n=r.message||r.reason||"unknown";le=!0,L=!1,re=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:Be(),vramBudgetBytes:Sr(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:se()}),dt=fe.getContext("webgpu"),pt=navigator.gpu.getPreferredCanvasFormat(),dt.configure({device:s,format:pt,alphaMode:"opaque"})}async function ln(){try{return await wr(fe),!0}catch(e){let t=e instanceof Error?e.message:String(e);return le=!0,L=!1,re=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function kr(){A=s.createBuffer({size:S*g,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await je(S*g,A),m=0,x=[]}async function Er(){let e=S*g;J=[],$=[];for(let t=0;t<Je;t++){let r=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});J.push(r),$.push(!0),await je(e,r)}}async function fn(){await Mr()}async function dn(){Mt(),Br(),await Pt(),xt(),wt(),kt(),Et(),vt(),Ft(),await fn(),ne()?(await kr(),await Er()):(Ve(),M=!1),await Xe(),Gt()}async function pn(){re=!0,self.postMessage({type:"rebuilding",active:!0});try{await Lt()}catch{}if(le&&!await ln())return!1;Zt(),Mt(),Br(),Vt(ne());try{await Pt(),xt(),wt(),Et(),vt(),kt(),Ft(),ne()?(await kr(),await Er()):(Ve(),M=!1),await Xe(),Gt()}catch(e){let t=e instanceof Error?e.message:String(e);self.postMessage({type:"gpuError",reason:t});try{Zt(),Mt(),Vt(!1),await Pt(),xt(),wt(),Et(),vt(),kt(),Ft(),M=!1,g=et(),Ve(),await Xe(),Gt()}catch(r){return console.warn("GPU recovery also failed, device may be lost:",r),!1}}return re=!1,self.postMessage({type:"rebuilding",active:!1}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{M=t.recording,ir(t.ruleset,t.simulationGridFormat),await wr(t.canvas),await dn(),L=t.running,k=t.speed<0?0:1e3/t.speed,j=0,X=0,self.requestAnimationFrame(q);break}case"setRuleset":{if(ir(t.ruleset,t.simulationGridFormat),!await pn())break;if(h=0,O=-1,await er(0),gt=new Map,mt=new Set,v)N=!0;else{let n=s.createCommandEncoder();D(n),s.queue.submit([n.finish()]),W()}break}case"setRunning":if(!t.running&&U>=0){if(U=-1,L=!1,k=We,j=0,X=0,P&&me(),O=-1,v)N=!0;else{let r=s.createCommandEncoder();D(r),s.queue.submit([r.finish()]),W()}oe(),self.postMessage({type:"stepping",active:!1});break}if(L=t.running,t.running)j=0,X=0,yt();else{if(P&&me(),O=-1,v)N=!0;else{let r=s.createCommandEncoder();D(r),s.queue.submit([r.finish()]),W()}k<=0&&!M&&U<0&&!Ce&&$e()}break;case"setSpeed":{let r=k<=0,n=t.speed<0?0:1e3/t.speed;r&&n>0&&(ht=!0,s.queue.onSubmittedWorkDone().then(()=>{ht=!1,oe(),$e()})),k=n,X=0,I=0,!r&&n<=0?yt():r&&n>0&&!Ce&&$e();break}case"camera":ur=t.scale,cr=t.offsetX,lr=t.offsetY;break;case"resize":fe.width=t.width,fe.height=t.height;break;case"draw":{let r=t.tribes.map(n=>te.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};Ie={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{rn().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:h,cols:_,rows:B,gridFormat:se()},[r.buffer])}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:h,cols:_,rows:B,gridFormat:se()})});break}case"loadSnapshot":{let r=F?R:G,n=ut(t.gridFormat),i=xe(_,B,n);if(t.grid.byteLength!==i)break;let u=n.bitsPerCell===d.bitsPerCell?t.grid:ct(lt(t.grid,_,B,n),_,B,d);s.queue.writeBuffer(r,0,u),h=t.generation,await er(t.generation);break}case"setRecording":{if(t.recording&&ne()&&!M){if(M=!0,tr(),O=-1,v)N=!0;else{let r=s.createCommandEncoder();D(r),s.queue.submit([r.finish()]),W()}ve()}else(!t.recording||!ne())&&(M=!1);break}case"getRecording":{if(Re)break;await Lt(),tr(),m>0&&Z(),Q>0?Re=!0:Pr();break}case"stepBack":{let r=0;for(let c of y)r+=c.blockCount;let n=r+m,i=Math.min(t.count,n-1);if(i<=0)break;let u=n-1-i,l=F?R:G;if(u>=r){let c=u-r;m=c+1,x.length=m,h=x[c];let p=s.createCommandEncoder();p.copyBufferToBuffer(A,c*g,l,0,g),s.queue.submit([p.finish()])}else{if(Q>0){await new Promise(C=>{let Y=setInterval(()=>{Q===0&&(clearInterval(Y),C())},10)}),r=0;for(let C of y)r+=C.blockCount}let c=0,p=0,o=0;for(let C=0;C<y.length;C++){let Y=y[C];if(u<c+Y.blockCount){p=C,o=u-c;break}c+=Y.blockCount}let f=y[p],a=await on(f.filename,f.codec),b=ut(f.gridFormat),w=xe(_,B,b);if(b.bitsPerCell===d.bitsPerCell){let C=(o+1)*g;s.queue.writeBuffer(A,0,new Uint8Array(a,0,C))}else{let C=new Uint8Array((o+1)*g);for(let Y=0;Y<=o;Y++){let Fr=Y*w,vr=new Uint8Array(a,Fr,w),Gr=Yt(vr,_,B,b),rt=ct(Gr,_,B,d);C.set(new Uint8Array(rt.buffer,rt.byteOffset,rt.byteLength),Y*g)}s.queue.writeBuffer(A,0,C),s.queue.writeBuffer(l,0,C.subarray(o*g,(o+1)*g))}if(m=o+1,x=f.generations.slice(0,o+1),h=x[o],b.bitsPerCell===d.bitsPerCell){let C=s.createCommandEncoder();C.copyBufferToBuffer(A,o*g,l,0,g),s.queue.submit([C.finish()])}let tt=y.splice(p).map(C=>C.filename);an(tt)}if(Wt(),ve(),O=-1,v)N=!0;else{let c=s.createCommandEncoder();D(c),s.queue.submit([c.finish()]),W()}oe();break}case"stepForward":{if(xr(),t.count===1){if(M&&Ze()&&ee()&&(m>=S&&Z(),V(h)),Ye(),ae++,M&&ee()&&(m>=S&&Z(),V(h)),O=-1,v)N=!0;else{let r=s.createCommandEncoder();D(r),s.queue.submit([r.finish()]),W()}oe()}else self.postMessage({type:"stepping",active:!0}),M&&Ze()&&ee()&&(m>=S&&Z(),V(h)),bt=L,We=k,U=h+t.count,L=!0,k=0,I=0;break}case"cancelStepping":{if(U>=0){if(U=-1,L=bt,k=We,j=0,X=0,O=-1,v)N=!0;else{let r=s.createCommandEncoder();D(r),s.queue.submit([r.finish()]),W()}oe(),self.postMessage({type:"stepping",active:!1})}break}case"updateChunkCodec":{let r=y.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,H.chunks=[...y],ve());break}case"getUncompressedChunks":{let r=y.filter(n=>n.codec==="raw-packed").map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:_,rows:B,rawGridFormat:n.gridFormat,storageGridFormat:Me(ot(K.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};export{nt as RECORDING_MAX_FRAME_BYTES};
