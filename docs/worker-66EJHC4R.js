var zt=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var Nt=[1,2,4,8,16,32],G={1:{bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},2:{bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},4:{bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},8:{bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},16:{bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},32:{bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295}},Sn=G[1],Bn=G[2],_n=G[4],it=G[8],Pn=G[16],Lr=G[32];function qt(e){return Nt.includes(e)}function Ur(e){return 2**e}function st(e,t){return t<=Ur(e)}function ot(e,t,r,n){return ke(e,t,r)<=n}function at(e){return e<=2?G[1]:e<=4?G[2]:e<=16?G[4]:e<=256?G[8]:e<=65536?G[16]:G[32]}function _e(e){return G[e]}function Ht(e,t=1,r=1,n=Number.POSITIVE_INFINITY){for(let s of Nt){let u=_e(s);if(st(s,e)&&ot(t,r,u,n))return u}return Lr}function ut(e){return _e(e?.bitsPerCell??8)}function Pe(e){return{bitsPerCell:e.bitsPerCell}}function Ee(e,t){return Math.ceil(e/t.cellsPerWord)}function ke(e,t,r){return Ee(e,r)*t*Uint32Array.BYTES_PER_ELEMENT}function Ir(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function lt(e,t,r,n){let s=Ee(t,n),u=new Uint32Array(s*r);for(let c=0;c<r;c++)for(let l=0;l<s;l++){let p=l*n.cellsPerWord,a=0;for(let f=0;f<n.cellsPerWord&&p+f<t;f++){let o=e[c*t+p+f]&n.cellMask;a|=o<<(f<<n.cellShift)}u[c*s+l]=a>>>0}return u}function ct(e,t,r,n){let s=Ee(t,n),u=new Uint8Array(t*r);for(let c=0;c<r;c++)for(let l=0;l<s;l++){let p=e[c*s+l],a=l*n.cellsPerWord;for(let f=0;f<n.cellsPerWord&&a+f<t;f++)u[c*t+a+f]=p>>>(f<<n.cellShift)&n.cellMask}return u}function Yt(e,t,r,n){return ct(Ir(e),t,r,n)}var Ge={id:"dead",color:"000000"};var i,ce=!1,dt,pt,fe,K,_=0,B=0,Qe=0,d=it,M=[],te=new Map,T,R,Te,pe,Ke,or,ar,xe,Rt,Gt,v=!1,ur=1,lr=0,cr=0,A=!1,re=!1,x=100,X=0,j=0,h=0,Ue,ge,fr,dr,Dr=0,Ie=null,Oe,pr,gr,be,he,De,mr,br,ye,Ce,O=-1,F=!1,N=!1,de=0,gt=new Map,mt=new Set,P=!1,H={chunks:[],generationStart:0,generationEnd:0,gridFormat:Pe(it)},hr=0,y=[],U=-1,bt=!1,We=100,I=0,ht=!1,Se=!1;function yr(){return A&&x<=0&&U<0&&!P}function yt(){re||ce||Se||!yr()||q(performance.now())}function $e(){re||ce||self.requestAnimationFrame(q)}var L=null,m=0,k=[],C=64,g=0,Je=3,J=[],$=[],ze="gol-recording",et="raw-packed",Cr="deflate-raw",Me=null,se=null,Q=0,le=0,Kt=12,E=!1,we=0,At=256,Wr=At*Uint32Array.BYTES_PER_ELEMENT,Ct=At*Uint32Array.BYTES_PER_ELEMENT,St=Uint32Array.BYTES_PER_ELEMENT,Xt=256*1024*1024,$r=512*1024*1024,zr=512*1024*1024,jt=128*1024*1024*1024,Ne=0,qe=0,ve=[];function Nr(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function Sr(e){A=!1,self.postMessage({type:"gpuError",reason:Nr(e)})}self.addEventListener("error",e=>{e.preventDefault(),Sr(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),Sr(e.reason)});async function Lt(){await i.queue.onSubmittedWorkDone()}function Vt(e){Ne=0,qe=2+(e?1+Je:0),ve=[]}async function Xe(){if(ve.length===0)return;let e=i.createCommandEncoder();for(let t of ve)e.clearBuffer(t);i.queue.submit([e.finish()]),await Lt(),ve=[]}async function je(e,t){!re||qe<=0||(Ne+=e,qe--,ve.push(t),Ne>=qr()&&qe>0&&(await Xe(),Ne=0))}function qr(){return Math.min(Be(),zr)}function Be(){return Math.min(i.limits.maxBufferSize,i.limits.maxStorageBufferBindingSize)}function Ut(){return Math.min(Be(),1073741824)}function Br(){return Math.max(Be()*2,Ut()*6)}function ne(){return g>0&&g<=Ut()}function Hr(){return g<=0?0:g*2+Ot+Wr+Dt+Ct*2+St*2}function Yr(){return C<1||g<=0?0:C*g*(1+Je)}function Ve(){L?.destroy(),L=null;for(let e of J)e?.destroy();J=[],$=[],C=0,m=0,k=[]}function Zt(){T?.destroy(),R?.destroy(),be?.destroy(),he?.destroy(),ye?.destroy(),Ce?.destroy(),ge?.destroy(),Ve()}function ft(e){let t=Q>0;Q+=e;let r=Q>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function me(){if(C<1||J.length===0){E&&(E=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=Er(),t=!$.some(s=>s)&&m>=C,r=le>=e,n;if(E){let s=$.some(c=>c),u=le<=Math.floor(e/2);n=!(s&&u)}else n=t||r;n!==E&&(E=n,self.postMessage({type:"backpressure",active:n}))}async function Fe(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??jt/128,jt),r=e.usage??0,n=0,s=0;for(let l of y)l.codec===et?n+=l.storedBytes:s+=l.storedBytes;let u=C*g,c=P?(1+Je)*u:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:s,gpuBufferMarginBytes:c})}var Re=!1;async function Kr(e){let t=new DecompressionStream(Cr),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],s=t.readable.getReader();for(;;){let{done:p,value:a}=await s.read();if(p)break;n.push(a)}let u=0;for(let p of n)u+=p.byteLength;let c=new Uint8Array(u),l=0;for(let p of n)c.set(p,l),l+=p.byteLength;return c.buffer}var oe=0,Ae=0,It=0;function Xr(e){e.push(`const CELLS_PER_WORD: u32 = ${d.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${d.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${d.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${d.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${d.cellMask}u;`)}function jr(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Vr(){let e=[],t=Qe;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${M.map(a=>a.id).join(", ")}`),e.push(`// Rules: ${K.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${_}u;`),e.push(`const ROWS: u32 = ${B}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),Xr(e),e.push(""),jr(e,"gridIn","PACKED_COLS"),e.push("");let r=te.get(Ge.id)??0;e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let n=Qr(K.rules.map(a=>a.clause)),s=new Map,u=0;for(let a of n){let f=`count_${u++}`;s.set(a,f)}for(let[a,f]of s){let o=a.split(",").map(Number),w=Qt().map(z=>`select(0u, 1u, ${o.map(S=>`${z} == ${S}u`).join(" || ")})`);e.push(`  let ${f} = ${w.join(" + ")};`)}n.size>0&&e.push("");let c=Jr(K.rules.map(a=>a.clause)),l=new Map,p=0;for(let a of c)if(s.has(a))l.set(a,s.get(a));else{let f=`eq_count_${p++}`;l.set(a,f)}for(let[a,f]of l){if(s.has(a))continue;let o=a.split(",").map(Number),w=Qt().map(z=>`select(0u, 1u, ${o.map(S=>`${z} == ${S}u`).join(" || ")})`);e.push(`  let ${f} = ${w.join(" + ")};`)}c.size>0&&p>0&&e.push(""),e.push(`  var result: u32 = ${r}u;`),e.push("");for(let a=0;a<K.rules.length;a++){let f=K.rules[a],o=He(f.clause,s,l),b=Zr(f.tribe);a===0?e.push(`  if (${o}) {`):e.push(`  } else if (${o}) {`),e.push(`    result = ${b}u;`)}K.rules.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let a=-1;a<=1;a++)for(let f=-1;f<=1;f++){if(f===0&&a===0)continue;let o=_r(f,a),b=Jt("x",f,"COLS"),w=Jt("y",a,"ROWS");e.push(`    let ${o} = readCell(${b}, ${w});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function _r(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function Qt(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(_r(r,t));return e}function Jt(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function ue(e){let t=[];for(let r of e)if(r==="any")for(let n=0;n<M.length;n++)t.push(n);else{let n=te.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function Zr(e){return e==="any"?0:te.get(e)??0}function Qr(e){let t=new Set;for(let r of e)Bt(r,t);return t}function Bt(e,t){switch(e.kind){case"count":{let r=ue(e.tribes).sort();t.add(r.join(","));break}case"not":Bt(e.clause,t);break;case"and":case"or":for(let r of e.clauses)Bt(r,t);break}}function Jr(e){let t=new Set;for(let r of e)_t(r,t);return t}function _t(e,t){switch(e.kind){case"equality":{let r=ue(e.tribe1).sort(),n=ue(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case"not":_t(e.clause,t);break;case"and":case"or":for(let r of e.clauses)_t(r,t);break}}function He(e,t,r){switch(e.kind){case"is":{let n=ue(e.tribes);return n.length===0?"false":n.length===M.length?"true":`(${n.map(u=>`selfTribe == ${u}u`).join(" || ")})`}case"count":{let n=ue(e.tribes).sort(),s=t.get(n.join(","));return`(${s} >= ${e.interval[0]}u && ${s} <= ${e.interval[1]}u)`}case"equality":{let n=ue(e.tribe1).sort(),s=ue(e.tribe2).sort(),u=r.get(n.join(",")),c=r.get(s.join(","));return`(${u} == ${c})`}case"not":return`!(${He(e.clause,t,r)})`;case"and":return`(${e.clauses.map(s=>He(s,t,r)).join(" && ")})`;case"or":return`(${e.clauses.map(s=>He(s,t,r)).join(" || ")})`;default:return"false"}}var Ot=48;function Pt(){Te?.destroy(),Te=i.createBuffer({size:Ot,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function en(){let e=new ArrayBuffer(Ot),t=new Float32Array(e),r=new Uint32Array(e);t[0]=fe.width,t[1]=fe.height,t[2]=_,t[3]=B,t[4]=ur,t[6]=lr,t[7]=cr,r[8]=M.length,i.queue.writeBuffer(Te,0,e)}function tt(){return ke(_,B,d)}function ie(){return Pe(d)}async function Et(){let e=tt();T=i.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await je(e,T),R=i.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await je(e,R);let t=i.createCommandEncoder();t.clearBuffer(T),t.clearBuffer(R),i.queue.submit([t.finish()]),v=!1}function kt(){let e=new Uint32Array(At);for(let t=0;t<M.length;t++){let r=M[t].color,n=parseInt(r.substring(0,2),16),s=parseInt(r.substring(2,4),16),u=parseInt(r.substring(4,6),16);e[t]=n|s<<8|u<<16}pe&&pe.destroy(),pe=i.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),i.queue.writeBuffer(pe,0,e)}function tn(){return zt.replace("__CELLS_PER_WORD__",`${d.cellsPerWord}u`).replace("__WORD_SHIFT__",`${d.wordShift}u`).replace("__CELL_SHIFT__",`${d.cellShift}u`).replace("__CELL_INDEX_MASK__",`${d.cellIndexMask}u`).replace("__CELL_MASK__",`${d.cellMask}u`)}function wt(){let e=i.createShaderModule({code:tn()});Ke=i.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:pt}]},primitive:{topology:"triangle-list"}})}function xt(){or=i.createBindGroup({layout:Ke.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Te}},{binding:1,resource:{buffer:T}},{binding:2,resource:{buffer:pe}}]}),ar=i.createBindGroup({layout:Ke.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Te}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:pe}}]})}function Mt(){let e=Vr(),t=i.createShaderModule({code:e});xe=i.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),Rt=i.createBindGroup({layout:xe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:T}},{binding:1,resource:{buffer:R}}]}),Gt=i.createBindGroup({layout:xe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:T}}]})}function rn(){return`
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
`}function nn(){return`
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
`}function vt(){let e=i.createShaderModule({code:rn()});Oe=i.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),be=i.createBuffer({size:Ct,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),he=i.createBuffer({size:Ct,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),pr=i.createBindGroup({layout:Oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:T}},{binding:1,resource:{buffer:be}}]}),gr=i.createBindGroup({layout:Oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:be}}]});let t=i.createShaderModule({code:nn()});De=i.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),ye=i.createBuffer({size:St,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),Ce=i.createBuffer({size:St,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),mr=i.createBindGroup({layout:De.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:T}},{binding:1,resource:{buffer:ye}}]}),br=i.createBindGroup({layout:De.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:ye}}]})}var Dt=176;function sn(){return`
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
`}function Ft(){let e=i.createShaderModule({code:sn()});Ue=i.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),ge?.destroy(),ge=i.createBuffer({size:Dt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),fr=i.createBindGroup({layout:Ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:T}},{binding:1,resource:{buffer:ge}}]}),dr=i.createBindGroup({layout:Ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:ge}}]})}function on(e,t,r,n,s,u,c){let l=te.get(Ge.id)??0,p=Dr++,a=new ArrayBuffer(Dt),f=new Int32Array(a),o=new Uint32Array(a);f[0]=t,f[1]=r,o[2]=_,o[3]=B,o[4]=n,o[5]=s,o[6]=u,o[7]=l,o[8]=p,o[9]=c.length,o[10]=0;for(let z=0;z<c.length&&z<32;z++)o[11+z]=c[z];i.queue.writeBuffer(ge,0,a);let b=Math.ceil(n/8),w=e.beginComputePass();w.setPipeline(Ue),w.setBindGroup(0,v?dr:fr),w.dispatchWorkgroups(b,b),w.end()}function an(){let e=v?R:T,t=tt(),r;try{r=i.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(s){return console.warn("GPU readback buffer allocation failed:",s),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=i.createCommandEncoder();return n.copyBufferToBuffer(e,0,r,0,t),i.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let s=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),s})}function Pr(){if(g=tt(),!ne()){C=0;return}let e=un();C=Math.max(1,Math.floor(e/g))}function un(){return g>=Xt?g:Math.min(Math.max(Xt,g),Ut())}function Er(){if(C<1||g<=0)return Kt;let e=Math.max(g,C*g),t=Math.floor($r/e);return Math.max(1,Math.min(Kt,t||1))}function Tt(){let e=ne();self.postMessage({type:"limits",maxBytes:Be(),vramBudgetBytes:Br(),frameByteSize:g,recordingAvailable:e,vramSimulationBytes:Hr(),vramRecordingBytes:Yr(),gridFormat:ie()})}function ee(){return!ne()||C<1||L===null||J.length===0||le>=Er()?!1:m<C?!0:J.some((e,t)=>$[t]&&e.mapState==="unmapped")}function V(e){if(C<1||L===null||m>=C)return;let t=v?R:T,r=m*g,n=i.createCommandEncoder();n.copyBufferToBuffer(t,0,L,r,g),i.queue.submit([n.finish()]),k.push(e),m++}function Z(){if(L===null||m===0||J.length===0)return;let e=$.indexOf(!0);if(e<0)return;$[e]=!1;let t=J[e];if(t.mapState!=="unmapped"){$[e]=!0;return}let r=m*g,n=hr++,s=[...k],u=s[0],c=s[s.length-1],l=`chunk-${String(n).padStart(6,"0")}.bin`,p=m,a=i.createCommandEncoder();a.copyBufferToBuffer(L,0,t,0,r),i.queue.submit([a.finish()]);let f={chunkId:n,generationStart:u,generationEnd:c,blockCount:p,codec:et,uncompressedBytes:r,storedBytes:r,gridFormat:ie(),generations:s,filename:l};ft(1),le++,me();let o=we;t.mapAsync(GPUMapMode.READ).then(async()=>{let b=t.getMappedRange(),w=new ArrayBuffer(r);new Uint8Array(w).set(new Uint8Array(b,0,r)),t.unmap(),o===we&&($[e]=!0,me(),y.push(f),Wt(),ln(f,w).then(()=>{o===we&&(le--,me(),ft(-1),Fe(),self.postMessage({type:"chunkSealed",filename:f.filename,rawBytes:r,blockCount:f.blockCount,cols:_,rows:B,rawGridFormat:f.gridFormat,storageGridFormat:Pe(at(K.tribes.length))}),Re&&Q===0&&(Re=!1,wr()))}))}).catch(()=>{o===we&&($[e]=!0,le--,me(),ft(-1))}),m=0,k=[]}function Wt(){y.length>0&&(H.generationStart=y[0].generationStart,H.generationEnd=y[y.length-1].generationEnd),k.length>0&&(y.length===0&&(H.generationStart=k[0]),H.generationEnd=k[k.length-1]),H.chunks=[...y]}async function er(e){we++,hr=0,m=0,k=[],y=[],le=0,Q>0&&(Q=0,self.postMessage({type:"chunksSaving",active:!1})),E&&(E=!1,self.postMessage({type:"backpressure",active:!1})),Re=!1,H={chunks:[],generationStart:e,generationEnd:e,gridFormat:ie()},await kr(),Fe()}async function $t(){return se&&await se,Me||(Me=await(await navigator.storage.getDirectory()).getDirectoryHandle(ze,{create:!0})),Me}async function ln(e,t){let s=await(await(await $t()).getFileHandle(e.filename,{create:!0})).createWritable();await s.write(t),await s.close()}async function cn(e){let t=await $t();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function kr(){if(se){await se;return}se=(async()=>{let e=await navigator.storage.getDirectory();Me=null;try{await e.removeEntry(ze,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${ze}:`,t)}Me=await e.getDirectoryHandle(ze,{create:!0})})();try{await se}finally{se=null}}function wr(){Wt(),self.postMessage({type:"recording",manifest:{chunks:y.map(e=>({...e,generations:[...e.generations]})),generationStart:H.generationStart,generationEnd:H.generationEnd,gridFormat:ie()},cols:_,rows:B})}function Ze(){return m>0?k[m-1]!==h:y.length>0?y[y.length-1].generationEnd!==h:!0}function tr(){!P||!Ze()||!ee()||(m>=C&&Z(),V(h))}function xr(){if(!Ie)return;let e=Ie;Ie=null;let t=i.createCommandEncoder();on(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),i.queue.submit([t.finish()]),P&&m>0&&k[m-1]===h&&(m--,k.pop(),V(h))}async function fn(e,t=et){let u=await(await(await(await $t()).getFileHandle(e)).getFile()).arrayBuffer();return t===Cr?Kr(u):u}function rr(){let e=m;for(let t of y)e+=t.blockCount;return e}function D(e){let t=Math.ceil(_/16),r=Math.ceil(B/16),n=new Uint32Array(256);i.queue.writeBuffer(be,0,n);let s=e.beginComputePass();s.setPipeline(Oe),s.setBindGroup(0,v?gr:pr),s.dispatchWorkgroups(t,r),s.end(),e.copyBufferToBuffer(be,0,he,0,256*4);let u=new Uint32Array([0]);i.queue.writeBuffer(ye,0,u);let c=e.beginComputePass();c.setPipeline(De),c.setBindGroup(0,v?br:mr),c.dispatchWorkgroups(t,r),c.end(),e.copyBufferToBuffer(ye,0,Ce,0,4)}function W(){let e=h;if(e===O||F)return;O=e,F=!0;let t=[];t.push(he.mapAsync(GPUMapMode.READ)),t.push(Ce.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=te.get(Ge.id)??0,n={},s=0,u=0,c={},l=new Uint32Array(he.getMappedRange().slice(0));he.unmap();let p=0;for(let o=0;o<M.length;o++){let b=l[o]??0;n[M[o].id]=b,o!==r&&(p+=b,b>0&&(gt.set(o,e),mt.add(o)))}if(p>0)for(let o=0;o<M.length;o++){if(o===r)continue;let b=(l[o]??0)/p;b>0&&(s-=b*Math.log2(b),u+=b*b)}for(let o=0;o<M.length;o++){if(o===r)continue;(l[o]??0)>0?c[M[o].id]=null:mt.has(o)?c[M[o].id]=gt.get(o)??0:c[M[o].id]=0}let a=new Uint32Array(Ce.getMappedRange().slice(0));Ce.unmap();let f=a[0]??0;if(F=!1,self.postMessage({type:"metrics",generation:e,population:n,shannonEntropy:s,simpsonIndex:1-u,boundaryLength:f,extinctionTime:c,totalFrames:rr(),fps:It,canStepBack:rr()>1,recordingBytes:y.reduce((o,b)=>o+b.storedBytes,0),recordingRawBytes:y.reduce((o,b)=>o+b.uncompressedBytes,0)}),N){N=!1,O=-1;let o=i.createCommandEncoder();D(o),i.queue.submit([o.finish()]),W()}}).catch(()=>{F=!1})}function nr(){let e=_*B;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function dn(){let e=_*B;return e>1e7?2:e>1e6?4:e>1e5?8:16}function ir(e){if(e<=0)return;let t=Math.ceil(Qe/16),r=Math.ceil(B/16),n=i.createCommandEncoder();for(let s=0;s<e;s++){let u=n.beginComputePass();u.setPipeline(xe),u.setBindGroup(0,v?Gt:Rt),u.dispatchWorkgroups(t,r),u.end(),v=!v,h++}i.queue.submit([n.finish()]),oe+=e}function Le(){self.postMessage({type:"generation",generation:h,fps:It})}function Ye(){let e=i.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(xe),t.setBindGroup(0,v?Gt:Rt);let r=Math.ceil(Qe/16),n=Math.ceil(B/16);t.dispatchWorkgroups(r,n),t.end(),i.queue.submit([e.finish()]),v=!v,h++}function ae(){en();let e=dt.getCurrentTexture().createView(),t=i.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(Ke),r.setBindGroup(0,v?ar:or),r.draw(3),r.end(),i.queue.submit([t.finish()])}function q(e){if(re||ce){self.requestAnimationFrame(q);return}Ae===0&&(Ae=e);let t=e-Ae;if(t>=1e3&&(It=oe/(t/1e3),oe=0,Ae=e),U>=0){if(P){let n=!1,s=performance.now()+14;for(;h<U&&performance.now()<s;){if(!ee()){n=!0;break}m>=C&&Z(),Ye(),oe++,V(h)}if(n){E||(E=!0,self.postMessage({type:"backpressure",active:!0})),e-I>=1e3&&(I=e,Le()),i.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(q)});return}E&&(E=!1,self.postMessage({type:"backpressure",active:!1}))}else{let n=Math.min(nr(),U-h);ir(n)}if(e-I>=1e3&&(I=e,Le()),h>=U){if(U=-1,A=bt,x=We,j=0,X=0,I=0,E&&(E=!1,self.postMessage({type:"backpressure",active:!1})),O=-1,F)N=!0;else{let n=i.createCommandEncoder();D(n),i.queue.submit([n.finish()]),W()}ae(),self.postMessage({type:"stepping",active:!1}),self.requestAnimationFrame(q)}else P?self.requestAnimationFrame(q):i.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(q)});return}xr();let r=!1;if(A){P&&Ze()&&ee()&&(m>=C&&Z(),V(h));let n=!1;j===0&&(j=e);let s=e-j;if(j=e,x<=0){if(P){let u=!1,c=performance.now()+14;for(;performance.now()<c;){if(!ee()){u=!0;break}m>=C&&Z(),Ye(),oe++,n=!0,V(h)}if(u){if(E||(E=!0,self.postMessage({type:"backpressure",active:!0})),e-I>=1e3&&(I=e,Le()),n&&(e-de>=1e3||de===0)&&!F){de=e;let p=i.createCommandEncoder();D(p),i.queue.submit([p.finish()]),W()}i.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(q)});return}E&&(E=!1,self.postMessage({type:"backpressure",active:!1}))}else if(!Se){let u=nr(),c=dn();for(let l=0;l<c;l++)ir(u),n=!0;Se=!0,i.queue.onSubmittedWorkDone().then(()=>{Se=!1,yr()?yt():$e()})}e-I>=1e3&&(I=e,Le())}else for(X+=s;X>=x;){if(P){if(!ee())break;m>=C&&Z()}Ye(),oe++,X-=x,n=!0,P&&V(h)}n&&(r=(e-de>=1e3||de===0)&&!F)}if(x>0&&!ht&&ae(),r){de=e;let n=i.createCommandEncoder();D(n),i.queue.submit([n.finish()]),W()}x<=0&&!P&&A||self.requestAnimationFrame(q)}function pn(e,t){let r=i?Be():Number.POSITIVE_INFINITY;return qt(t.bitsPerCell)&&st(t.bitsPerCell,e.tribes.length)&&ot(e.cols,e.rows,_e(t.bitsPerCell),r)?_e(t.bitsPerCell):Ht(e.tribes.length,e.cols,e.rows,r)}function sr(e,t){K=e,_=e.cols,B=e.rows,d=pn(e,t),Qe=Ee(_,d),M=[...e.tribes],H.gridFormat=ie(),te.clear(),M.forEach((r,n)=>te.set(r.id,n))}async function Mr(e){fe=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");i=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),ce=!1,i.lost.then(n=>{let s=n.message||n.reason||"unknown";ce=!0,A=!1,re=!0,self.postMessage({type:"deviceLost",reason:s})}),self.postMessage({type:"limits",maxBytes:Be(),vramBudgetBytes:Br(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:ie()});let r=fe.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");dt=r,pt=navigator.gpu.getPreferredCanvasFormat(),dt.configure({device:i,format:pt,alphaMode:"opaque"})}async function gn(){try{return await Mr(fe),!0}catch(e){let t=e instanceof Error?e.message:String(e);return ce=!0,A=!1,re=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function vr(){L=i.createBuffer({size:C*g,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await je(C*g,L),m=0,k=[]}async function Fr(){let e=C*g;J=[],$=[];for(let t=0;t<Je;t++){let r=i.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});J.push(r),$.push(!0),await je(e,r)}}async function mn(){await kr()}async function bn(){Pt(),Pr(),await Et(),kt(),wt(),xt(),Mt(),Ft(),vt(),await mn(),ne()?(await vr(),await Fr()):(Ve(),P=!1),await Xe(),Tt()}async function hn(){re=!0,self.postMessage({type:"rebuilding",active:!0});try{await Lt()}catch{}if(ce&&!await gn())return!1;Zt(),Pt(),Pr(),Vt(ne());try{await Et(),kt(),wt(),Mt(),Ft(),xt(),vt(),ne()?(await vr(),await Fr()):(Ve(),P=!1),await Xe(),Tt()}catch(e){let t=e instanceof Error?e.message:String(e);self.postMessage({type:"gpuError",reason:t});try{Zt(),Pt(),Vt(!1),await Et(),kt(),wt(),Mt(),Ft(),xt(),vt(),P=!1,g=tt(),Ve(),await Xe(),Tt()}catch(r){return console.warn("GPU recovery also failed, device may be lost:",r),!1}}return re=!1,self.postMessage({type:"rebuilding",active:!1}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{P=t.recording,sr(t.ruleset,t.simulationGridFormat),await Mr(t.canvas),await bn(),A=t.running,x=t.speed<0?0:1e3/t.speed,j=0,X=0,self.requestAnimationFrame(q);break}case"setRuleset":{if(sr(t.ruleset,t.simulationGridFormat),!await hn())break;if(h=0,O=-1,await er(0),gt=new Map,mt=new Set,F)N=!0;else{let n=i.createCommandEncoder();D(n),i.queue.submit([n.finish()]),W()}break}case"setRunning":if(!t.running&&U>=0){if(U=-1,A=!1,x=We,j=0,X=0,E&&me(),O=-1,F)N=!0;else{let r=i.createCommandEncoder();D(r),i.queue.submit([r.finish()]),W()}ae(),self.postMessage({type:"stepping",active:!1});break}if(A=t.running,t.running)j=0,X=0,yt();else{if(E&&me(),O=-1,F)N=!0;else{let r=i.createCommandEncoder();D(r),i.queue.submit([r.finish()]),W()}x<=0&&!P&&U<0&&!Se&&$e()}break;case"setSpeed":{let r=x<=0,n=t.speed<0?0:1e3/t.speed;r&&n>0&&(ht=!0,i.queue.onSubmittedWorkDone().then(()=>{ht=!1,ae(),$e()})),x=n,X=0,I=0,!r&&n<=0?yt():r&&n>0&&!Se&&$e();break}case"camera":ur=t.scale,lr=t.offsetX,cr=t.offsetY;break;case"resize":fe.width=t.width,fe.height=t.height;break;case"draw":{let r=t.tribes.map(n=>te.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},s={full:0,spray:1,outline:2};Ie={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:s[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{an().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:h,cols:_,rows:B,gridFormat:ie()},[r.buffer])}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:h,cols:_,rows:B,gridFormat:ie()})});break}case"loadSnapshot":{let r=v?R:T,n=ut(t.gridFormat),s=ke(_,B,n);if(t.grid.byteLength!==s)break;let u=n.bitsPerCell===d.bitsPerCell?t.grid:lt(ct(t.grid,_,B,n),_,B,d);i.queue.writeBuffer(r,0,u),h=t.generation,await er(t.generation);break}case"setRecording":{if(t.recording&&ne()&&!P){if(P=!0,tr(),O=-1,F)N=!0;else{let r=i.createCommandEncoder();D(r),i.queue.submit([r.finish()]),W()}Fe()}else(!t.recording||!ne())&&(P=!1);break}case"getRecording":{if(Re)break;await Lt(),tr(),m>0&&Z(),Q>0?Re=!0:wr();break}case"stepBack":{let r=0;for(let l of y)r+=l.blockCount;let n=r+m,s=Math.min(t.count,n-1);if(s<=0)break;let u=n-1-s,c=v?R:T;if(u>=r){let l=u-r;m=l+1,k.length=m,h=k[l];let p=i.createCommandEncoder();p.copyBufferToBuffer(L,l*g,c,0,g),i.queue.submit([p.finish()])}else{if(Q>0){await new Promise(S=>{let Y=setInterval(()=>{Q===0&&(clearInterval(Y),S())},10)}),r=0;for(let S of y)r+=S.blockCount}let l=0,p=0,a=0;for(let S=0;S<y.length;S++){let Y=y[S];if(u<l+Y.blockCount){p=S,a=u-l;break}l+=Y.blockCount}let f=y[p],o=await fn(f.filename,f.codec),b=ut(f.gridFormat),w=ke(_,B,b);if(b.bitsPerCell===d.bitsPerCell){let S=(a+1)*g;i.queue.writeBuffer(L,0,new Uint8Array(o,0,S))}else{let S=new Uint8Array((a+1)*g);for(let Y=0;Y<=a;Y++){let Tr=Y*w,Rr=new Uint8Array(o,Tr,w),Gr=Yt(Rr,_,B,b),nt=lt(Gr,_,B,d);S.set(new Uint8Array(nt.buffer,nt.byteOffset,nt.byteLength),Y*g)}i.queue.writeBuffer(L,0,S),i.queue.writeBuffer(c,0,S.subarray(a*g,(a+1)*g))}if(m=a+1,k=f.generations.slice(0,a+1),h=k[a],b.bitsPerCell===d.bitsPerCell){let S=i.createCommandEncoder();S.copyBufferToBuffer(L,a*g,c,0,g),i.queue.submit([S.finish()])}let rt=y.splice(p).map(S=>S.filename);cn(rt)}if(Wt(),Fe(),O=-1,F)N=!0;else{let l=i.createCommandEncoder();D(l),i.queue.submit([l.finish()]),W()}ae();break}case"stepForward":{if(xr(),t.count===1){if(P&&Ze()&&ee()&&(m>=C&&Z(),V(h)),Ye(),oe++,P&&ee()&&(m>=C&&Z(),V(h)),O=-1,F)N=!0;else{let r=i.createCommandEncoder();D(r),i.queue.submit([r.finish()]),W()}ae()}else self.postMessage({type:"stepping",active:!0}),P&&Ze()&&ee()&&(m>=C&&Z(),V(h)),bt=A,We=x,U=h+t.count,A=!0,x=0,I=0;break}case"cancelStepping":{if(U>=0){if(U=-1,A=bt,x=We,j=0,X=0,O=-1,F)N=!0;else{let r=i.createCommandEncoder();D(r),i.queue.submit([r.finish()]),W()}ae(),self.postMessage({type:"stepping",active:!1})}break}case"updateChunkCodec":{let r=y.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,H.chunks=[...y],Fe());break}case"getUncompressedChunks":{let r=y.filter(n=>n.codec===et).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:_,rows:B,rawGridFormat:n.gridFormat,storageGridFormat:Pe(at(K.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
