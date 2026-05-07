var Nt=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var zt=[1,2,4,8,16,32],A={1:{bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},2:{bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},4:{bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},8:{bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},16:{bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},32:{bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295}},Sn=A[1],Bn=A[2],_n=A[4],st=A[8],Pn=A[16],Lr=A[32];function qt(e){return zt.includes(e)}function Ur(e){return 2**e}function it(e,t){return t<=Ur(e)}function at(e,t,r,n){return ke(e,t,r)<=n}function ot(e){return e<=2?A[1]:e<=4?A[2]:e<=16?A[4]:e<=256?A[8]:e<=65536?A[16]:A[32]}function Pe(e){return A[e]}function Ht(e,t=1,r=1,n=Number.POSITIVE_INFINITY){for(let i of zt){let a=Pe(i);if(it(i,e)&&at(t,r,a,n))return a}return Lr}function ut(e){return Pe(e?.bitsPerCell??8)}function xe(e){return{bitsPerCell:e.bitsPerCell}}function Ee(e,t){return Math.ceil(e/t.cellsPerWord)}function ke(e,t,r){return Ee(e,r)*t*Uint32Array.BYTES_PER_ELEMENT}function Ir(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function lt(e,t,r,n){let i=Ee(t,n),a=new Uint32Array(i*r);for(let c=0;c<r;c++)for(let l=0;l<i;l++){let d=l*n.cellsPerWord,f=0;for(let u=0;u<n.cellsPerWord&&d+u<t;u++){let o=e[c*t+d+u]&n.cellMask;f|=o<<(u<<n.cellShift)}a[c*i+l]=f>>>0}return a}function ct(e,t,r,n){let i=Ee(t,n),a=new Uint8Array(t*r);for(let c=0;c<r;c++)for(let l=0;l<i;l++){let d=e[c*i+l],f=l*n.cellsPerWord;for(let u=0;u<n.cellsPerWord&&f+u<t;u++)a[c*t+f+u]=d>>>(u<<n.cellShift)&n.cellMask}return a}function Yt(e,t,r,n){return ct(Ir(e),t,r,n)}var Le={id:"dead",color:"000000"};var s,le=!1,dt,pt,ce,Re,B=0,S=0,Je=0,p=st,T=[],te=new Map,F,R,Ge,de,Xe,ar,or,Me,Rt,Gt,M=!1,ur=1,lr=0,cr=0,L=!1,re=!1,w=100,X=0,j=0,h=0,Oe,pe,fr,dr,Dr=0,De=null,$e,pr,gr,be,he,We,mr,br,ye,Ce,W=-1,v=!1,H=!1,fe=0,gt=new Map,mt=new Set,_=!1,K={chunks:[],generationStart:0,generationEnd:0,gridFormat:xe(st)},hr=0,y=[],D=-1,bt=!1,Ne=100,$=0,ht=!1,Se=!1;function yr(){return L&&w<=0&&D<0&&!_}function yt(){re||le||Se||!yr()||Y(performance.now())}function ze(){re||le||self.requestAnimationFrame(Y)}var U=null,b=0,E=[],C=64,m=0,et=3,J=[],q=[],qe="gol-recording",tt="raw-packed",Cr="deflate-raw",ve=null,ie=null,Q=0,ue=0,Kt=12,x=!1,we=0,At=256,$r=At*Uint32Array.BYTES_PER_ELEMENT,Ct=At*Uint32Array.BYTES_PER_ELEMENT,St=Uint32Array.BYTES_PER_ELEMENT,Xt=256*1024*1024,Wr=512*1024*1024,Nr=512*1024*1024,jt=128*1024*1024*1024,He=0,Ye=0,Fe=[];function zr(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function Sr(e){L=!1,self.postMessage({type:"gpuError",reason:zr(e)})}self.addEventListener("error",e=>{e.preventDefault(),Sr(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),Sr(e.reason)});async function Lt(){await s.queue.onSubmittedWorkDone()}function Zt(e){He=0,Ye=2+(e?1+et:0),Fe=[]}async function je(){if(Fe.length===0)return;let e=s.createCommandEncoder();for(let t of Fe)e.clearBuffer(t);s.queue.submit([e.finish()]),await Lt(),Fe=[]}async function Ze(e,t){!re||Ye<=0||(He+=e,Ye--,Fe.push(t),He>=qr()&&Ye>0&&(await je(),He=0))}function qr(){return Math.min(Be(),Nr)}function Be(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function Ut(){return Math.min(Be(),1073741824)}function Br(){return Math.max(Be()*2,Ut()*6)}function ne(){return m>0&&m<=Ut()}function Hr(){return m<=0?0:m*2+Ot+$r+Dt+Ct*2+St*2}function Yr(){return C<1||m<=0?0:C*m*(1+et)}function Ve(){U?.destroy(),U=null;for(let e of J)e?.destroy();J=[],q=[],C=0,b=0,E=[]}function Vt(){F?.destroy(),R?.destroy(),be?.destroy(),he?.destroy(),ye?.destroy(),Ce?.destroy(),pe?.destroy(),Ve()}function ft(e){let t=Q>0;Q+=e;let r=Q>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function ge(){if(C<1||J.length===0){x&&(x=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=xr(),t=!q.some(i=>i)&&b>=C,r=ue>=e,n;if(x){let i=q.some(c=>c),a=ue<=Math.floor(e/2);n=!(i&&a)}else n=t||r;n!==x&&(x=n,self.postMessage({type:"backpressure",active:n}))}async function me(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??jt/128,jt),r=e.usage??0,n=0,i=0;for(let l of y)l.codec===tt?n+=l.storedBytes:i+=l.storedBytes;let a=C*m,c=_?(1+et)*a:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:c})}var Ae=!1;async function Kr(e){let t=new DecompressionStream(Cr),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:d,value:f}=await i.read();if(d)break;n.push(f)}let a=0;for(let d of n)a+=d.byteLength;let c=new Uint8Array(a),l=0;for(let d of n)c.set(d,l),l+=d.byteLength;return c.buffer}var ae=0,Ue=0,It=0;function Xr(e){e.push(`const CELLS_PER_WORD: u32 = ${p.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${p.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${p.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${p.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${p.cellMask}u;`)}function jr(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function Zr(){let e=[],t=Je;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${T.map(u=>u.id).join(", ")}`),e.push(`// Rules: ${Re.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${B}u;`),e.push(`const ROWS: u32 = ${S}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),Xr(e),e.push(""),jr(e,"gridIn","PACKED_COLS"),e.push("");let r=te.get(Le.id)??0,n=Re.rules.filter(u=>!u.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let i=Qr(n.map(u=>u.clause)),a=new Map,c=0;for(let u of i){let o=`count_${c++}`;a.set(u,o)}for(let[u,o]of a){let g=u.split(",").map(Number),I=Qt().map(_e=>`select(0u, 1u, ${g.map(G=>`${_e} == ${G}u`).join(" || ")})`);e.push(`  let ${o} = ${I.join(" + ")};`)}i.size>0&&e.push("");let l=Jr(n.map(u=>u.clause)),d=new Map,f=0;for(let u of l)if(a.has(u))d.set(u,a.get(u));else{let o=`eq_count_${f++}`;d.set(u,o)}for(let[u,o]of d){if(a.has(u))continue;let g=u.split(",").map(Number),I=Qt().map(_e=>`select(0u, 1u, ${g.map(G=>`${_e} == ${G}u`).join(" || ")})`);e.push(`  let ${o} = ${I.join(" + ")};`)}l.size>0&&f>0&&e.push(""),e.push(`  var result: u32 = ${r}u;`),e.push("");for(let u=0;u<n.length;u++){let o=n[u],g=Te(o.clause,a,d),k=Vr(o.tribe);u===0?e.push(`  if (${g}) {`):e.push(`  } else if (${g}) {`),e.push(`    result = ${k}u;`)}n.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let u=-1;u<=1;u++)for(let o=-1;o<=1;o++){if(o===0&&u===0)continue;let g=_r(o,u),k=Jt("x",o,"COLS"),I=Jt("y",u,"ROWS");e.push(`    let ${g} = readCell(${k}, ${I});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function _r(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function Qt(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(_r(r,t));return e}function Jt(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function O(e){let t=[];for(let r of e)if(r==="any")for(let n=0;n<T.length;n++)t.push(n);else{let n=te.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function Vr(e){return e==="any"?0:te.get(e)??0}function Qr(e){let t=new Set;for(let r of e)Bt(r,t);return t}function Bt(e,t){switch(e.kind){case"empty":case"is":break;case"count":{let r=O(e.tribes).sort();t.add(r.join(","));break}case"none":case"exactly":case"atLeast":case"atMost":{let r=O(e.tribes).sort();t.add(r.join(","));break}case"not":Bt(e.clause,t);break;case"and":case"or":case"xor":for(let r of e.clauses)Bt(r,t);break}}function Jr(e){let t=new Set;for(let r of e)_t(r,t);return t}function _t(e,t){switch(e.kind){case"empty":case"is":case"count":case"none":case"exactly":case"atLeast":case"atMost":break;case"comparison":case"equality":{let r=O(e.tribe1).sort(),n=O(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case"not":_t(e.clause,t);break;case"and":case"or":case"xor":for(let r of e.clauses)_t(r,t);break}}function Te(e,t,r){switch(e.kind){case"empty":return"false";case"is":{let n=O(e.tribes);return n.length===0?"false":n.length===T.length?"true":`(${n.map(a=>`selfTribe == ${a}u`).join(" || ")})`}case"count":{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case"none":{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case"exactly":{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case"atLeast":{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case"atMost":{let n=O(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case"comparison":case"equality":{let n=O(e.tribe1).sort(),i=O(e.tribe2).sort(),a=r.get(n.join(",")),c=r.get(i.join(",")),l=e.operator??"=",d=Math.max(-8,Math.min(8,e.margin??0)),f=`(i32(${c}) + ${d}i)`;switch(l){case"!=":return`(i32(${a}) != ${f})`;case">":return`(i32(${a}) > ${f})`;case"<":return`(i32(${a}) < ${f})`;case">=":return`(i32(${a}) >= ${f})`;case"<=":return`(i32(${a}) <= ${f})`;default:return`(i32(${a}) == ${f})`}}case"not":return`!(${Te(e.clause,t,r)})`;case"and":return`(${e.clauses.map(i=>Te(i,t,r)).join(" && ")})`;case"or":return`(${e.clauses.map(i=>Te(i,t,r)).join(" || ")})`;case"xor":return`(((${e.clauses.map(a=>Te(a,t,r)).map(a=>`select(0u, 1u, ${a})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var Ot=48;function Pt(){Ge?.destroy(),Ge=s.createBuffer({size:Ot,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function en(){let e=new ArrayBuffer(Ot),t=new Float32Array(e),r=new Uint32Array(e);t[0]=ce.width,t[1]=ce.height,t[2]=B,t[3]=S,t[4]=ur,t[6]=lr,t[7]=cr,r[8]=T.length,s.queue.writeBuffer(Ge,0,e)}function rt(){return ke(B,S,p)}function se(){return xe(p)}async function xt(){let e=rt();F=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Ze(e,F),R=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Ze(e,R);let t=s.createCommandEncoder();t.clearBuffer(F),t.clearBuffer(R),s.queue.submit([t.finish()]),M=!1}function Et(){let e=new Uint32Array(At);for(let t=0;t<T.length;t++){let r=T[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),a=parseInt(r.substring(4,6),16);e[t]=n|i<<8|a<<16}de&&de.destroy(),de=s.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(de,0,e)}function tn(){return Nt.replace("__CELLS_PER_WORD__",`${p.cellsPerWord}u`).replace("__WORD_SHIFT__",`${p.wordShift}u`).replace("__CELL_SHIFT__",`${p.cellShift}u`).replace("__CELL_INDEX_MASK__",`${p.cellIndexMask}u`).replace("__CELL_MASK__",`${p.cellMask}u`)}function kt(){let e=s.createShaderModule({code:tn()});Xe=s.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:pt}]},primitive:{topology:"triangle-list"}})}function wt(){ar=s.createBindGroup({layout:Xe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ge}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:de}}]}),or=s.createBindGroup({layout:Xe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ge}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:de}}]})}function Tt(){let e=Zr(),t=s.createShaderModule({code:e});Me=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),Rt=s.createBindGroup({layout:Me.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:R}}]}),Gt=s.createBindGroup({layout:Me.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:F}}]})}function rn(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = ${B}u;
const ROWS: u32 = ${S}u;
const CELLS_PER_WORD: u32 = ${p.cellsPerWord}u;
const WORD_SHIFT: u32 = ${p.wordShift}u;
const CELL_SHIFT: u32 = ${p.cellShift}u;
const CELL_INDEX_MASK: u32 = ${p.cellIndexMask}u;
const CELL_MASK: u32 = ${p.cellMask}u;
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

const COLS: u32 = ${B}u;
const ROWS: u32 = ${S}u;
const CELLS_PER_WORD: u32 = ${p.cellsPerWord}u;
const WORD_SHIFT: u32 = ${p.wordShift}u;
const CELL_SHIFT: u32 = ${p.cellShift}u;
const CELL_INDEX_MASK: u32 = ${p.cellIndexMask}u;
const CELL_MASK: u32 = ${p.cellMask}u;
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
`}function Mt(){let e=s.createShaderModule({code:rn()});$e=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),be=s.createBuffer({size:Ct,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),he=s.createBuffer({size:Ct,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),pr=s.createBindGroup({layout:$e.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:be}}]}),gr=s.createBindGroup({layout:$e.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:be}}]});let t=s.createShaderModule({code:nn()});We=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),ye=s.createBuffer({size:St,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),Ce=s.createBuffer({size:St,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),mr=s.createBindGroup({layout:We.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:ye}}]}),br=s.createBindGroup({layout:We.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:ye}}]})}var Dt=176;function sn(){return`
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

const CELLS_PER_WORD: u32 = ${p.cellsPerWord}u;
const WORD_SHIFT: u32 = ${p.wordShift}u;
const CELL_SHIFT: u32 = ${p.cellShift}u;
const CELL_INDEX_MASK: u32 = ${p.cellIndexMask}u;
const CELL_MASK: u32 = ${p.cellMask}u;

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
`}function vt(){let e=s.createShaderModule({code:sn()});Oe=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),pe?.destroy(),pe=s.createBuffer({size:Dt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),fr=s.createBindGroup({layout:Oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:pe}}]}),dr=s.createBindGroup({layout:Oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:pe}}]})}function an(e,t,r,n,i,a,c){let l=te.get(Le.id)??0,d=Dr++,f=new ArrayBuffer(Dt),u=new Int32Array(f),o=new Uint32Array(f);u[0]=t,u[1]=r,o[2]=B,o[3]=S,o[4]=n,o[5]=i,o[6]=a,o[7]=l,o[8]=d,o[9]=c.length,o[10]=0;for(let I=0;I<c.length&&I<32;I++)o[11+I]=c[I];s.queue.writeBuffer(pe,0,f);let g=Math.ceil(n/8),k=e.beginComputePass();k.setPipeline(Oe),k.setBindGroup(0,M?dr:fr),k.dispatchWorkgroups(g,g),k.end()}function on(){let e=M?R:F,t=rt(),r;try{r=s.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder();return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function Pr(){if(m=rt(),!ne()){C=0;return}let e=un();C=Math.max(1,Math.floor(e/m))}function un(){return m>=Xt?m:Math.min(Math.max(Xt,m),Ut())}function xr(){if(C<1||m<=0)return Kt;let e=Math.max(m,C*m),t=Math.floor(Wr/e);return Math.max(1,Math.min(Kt,t||1))}function Ft(){let e=ne();self.postMessage({type:"limits",maxBytes:Be(),vramBudgetBytes:Br(),frameByteSize:m,recordingAvailable:e,vramSimulationBytes:Hr(),vramRecordingBytes:Yr(),gridFormat:se()})}function ee(){return!ne()||C<1||U===null||J.length===0||ue>=xr()?!1:b<C?!0:J.some((e,t)=>q[t]&&e.mapState==="unmapped")}function Z(e){if(C<1||U===null||b>=C)return;let t=M?R:F,r=b*m,n=s.createCommandEncoder();n.copyBufferToBuffer(t,0,U,r,m),s.queue.submit([n.finish()]),E.push(e),b++}function V(){if(U===null||b===0||J.length===0)return;let e=q.indexOf(!0);if(e<0)return;q[e]=!1;let t=J[e];if(t.mapState!=="unmapped"){q[e]=!0;return}let r=b*m,n=hr++,i=[...E],a=i[0],c=i[i.length-1],l=`chunk-${String(n).padStart(6,"0")}.bin`,d=b,f=s.createCommandEncoder();f.copyBufferToBuffer(U,0,t,0,r),s.queue.submit([f.finish()]);let u={chunkId:n,generationStart:a,generationEnd:c,blockCount:d,codec:tt,uncompressedBytes:r,storedBytes:r,gridFormat:se(),generations:i,filename:l};ft(1),ue++,ge();let o=we;t.mapAsync(GPUMapMode.READ).then(async()=>{let g=t.getMappedRange(),k=new ArrayBuffer(r);new Uint8Array(k).set(new Uint8Array(g,0,r)),t.unmap(),o===we&&(q[e]=!0,ge(),y.push(u),$t(),ln(u,k).then(()=>{o===we&&(ue--,ge(),ft(-1),me(),self.postMessage({type:"chunkSealed",filename:u.filename,rawBytes:r,blockCount:u.blockCount,cols:B,rows:S,rawGridFormat:u.gridFormat,storageGridFormat:xe(ot(Re.tribes.length))}),Ae&&Q===0&&(Ae=!1,kr()))}))}).catch(()=>{o===we&&(q[e]=!0,ue--,ge(),ft(-1))}),b=0,E=[]}function $t(){y.length>0&&(K.generationStart=y[0].generationStart,K.generationEnd=y[y.length-1].generationEnd),E.length>0&&(y.length===0&&(K.generationStart=E[0]),K.generationEnd=E[E.length-1]),K.chunks=[...y]}async function er(e){we++,hr=0,b=0,E=[],y=[],ue=0,Q>0&&(Q=0,self.postMessage({type:"chunksSaving",active:!1})),x&&(x=!1,self.postMessage({type:"backpressure",active:!1})),Ae=!1,K={chunks:[],generationStart:e,generationEnd:e,gridFormat:se()},await Er(),me()}async function Wt(){return ie&&await ie,ve||(ve=await(await navigator.storage.getDirectory()).getDirectoryHandle(qe,{create:!0})),ve}async function ln(e,t){let i=await(await(await Wt()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function cn(e){let t=await Wt();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function Er(){if(ie){await ie;return}ie=(async()=>{let e=await navigator.storage.getDirectory();ve=null;try{await e.removeEntry(qe,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${qe}:`,t)}ve=await e.getDirectoryHandle(qe,{create:!0})})();try{await ie}finally{ie=null}}function kr(){$t(),self.postMessage({type:"recording",manifest:{chunks:y.map(e=>({...e,generations:[...e.generations]})),generationStart:K.generationStart,generationEnd:K.generationEnd,gridFormat:se()},cols:B,rows:S})}function Qe(){return b>0?E[b-1]!==h:y.length>0?y[y.length-1].generationEnd!==h:!0}function tr(){!_||!Qe()||!ee()||(b>=C&&V(),Z(h))}function wr(){if(!De)return;let e=De;De=null;let t=s.createCommandEncoder();an(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),_&&b>0&&E[b-1]===h&&(b--,E.pop(),Z(h))}async function fn(e,t=tt){let a=await(await(await(await Wt()).getFileHandle(e)).getFile()).arrayBuffer();return t===Cr?Kr(a):a}function rr(){let e=b;for(let t of y)e+=t.blockCount;return e}function N(e){let t=Math.ceil(B/16),r=Math.ceil(S/16),n=new Uint32Array(256);s.queue.writeBuffer(be,0,n);let i=e.beginComputePass();i.setPipeline($e),i.setBindGroup(0,M?gr:pr),i.dispatchWorkgroups(t,r),i.end(),e.copyBufferToBuffer(be,0,he,0,256*4);let a=new Uint32Array([0]);s.queue.writeBuffer(ye,0,a);let c=e.beginComputePass();c.setPipeline(We),c.setBindGroup(0,M?br:mr),c.dispatchWorkgroups(t,r),c.end(),e.copyBufferToBuffer(ye,0,Ce,0,4)}function z(){let e=h;if(e===W||v)return;W=e,v=!0;let t=[];t.push(he.mapAsync(GPUMapMode.READ)),t.push(Ce.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=te.get(Le.id)??0,n={},i=0,a=0,c={},l=new Uint32Array(he.getMappedRange().slice(0));he.unmap();let d=0;for(let o=0;o<T.length;o++){let g=l[o]??0;n[T[o].id]=g,o!==r&&(d+=g,g>0&&(gt.set(o,e),mt.add(o)))}if(d>0)for(let o=0;o<T.length;o++){if(o===r)continue;let g=(l[o]??0)/d;g>0&&(i-=g*Math.log2(g),a+=g*g)}for(let o=0;o<T.length;o++){if(o===r)continue;(l[o]??0)>0?c[T[o].id]=null:mt.has(o)?c[T[o].id]=gt.get(o)??0:c[T[o].id]=0}let f=new Uint32Array(Ce.getMappedRange().slice(0));Ce.unmap();let u=f[0]??0;if(v=!1,self.postMessage({type:"metrics",generation:e,population:n,shannonEntropy:i,simpsonIndex:1-a,boundaryLength:u,extinctionTime:c,totalFrames:rr(),fps:It,canStepBack:rr()>1,recordingBytes:y.reduce((o,g)=>o+g.storedBytes,0),recordingRawBytes:y.reduce((o,g)=>o+g.uncompressedBytes,0)}),H){H=!1,W=-1;let o=s.createCommandEncoder();N(o),s.queue.submit([o.finish()]),z()}}).catch(()=>{v=!1})}function nr(){let e=B*S;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function dn(){let e=B*S;return e>1e7?2:e>1e6?4:e>1e5?8:16}function sr(e){if(e<=0)return;let t=Math.ceil(Je/16),r=Math.ceil(S/16),n=s.createCommandEncoder();for(let i=0;i<e;i++){let a=n.beginComputePass();a.setPipeline(Me),a.setBindGroup(0,M?Gt:Rt),a.dispatchWorkgroups(t,r),a.end(),M=!M,h++}s.queue.submit([n.finish()]),ae+=e}function Ie(){self.postMessage({type:"generation",generation:h,fps:It})}function Ke(){let e=s.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(Me),t.setBindGroup(0,M?Gt:Rt);let r=Math.ceil(Je/16),n=Math.ceil(S/16);t.dispatchWorkgroups(r,n),t.end(),s.queue.submit([e.finish()]),M=!M,h++}function oe(){en();let e=dt.getCurrentTexture().createView(),t=s.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(Xe),r.setBindGroup(0,M?or:ar),r.draw(3),r.end(),s.queue.submit([t.finish()])}function Y(e){if(re||le){self.requestAnimationFrame(Y);return}Ue===0&&(Ue=e);let t=e-Ue;if(t>=1e3&&(It=ae/(t/1e3),ae=0,Ue=e),D>=0){if(_){let n=!1,i=performance.now()+14;for(;h<D&&performance.now()<i;){if(!ee()){n=!0;break}b>=C&&V(),Ke(),ae++,Z(h)}if(n){x||(x=!0,self.postMessage({type:"backpressure",active:!0})),e-$>=1e3&&($=e,Ie()),s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(Y)});return}x&&(x=!1,self.postMessage({type:"backpressure",active:!1}))}else{let n=Math.min(nr(),D-h);sr(n)}if(e-$>=1e3&&($=e,Ie()),h>=D){if(D=-1,L=bt,w=Ne,j=0,X=0,$=0,x&&(x=!1,self.postMessage({type:"backpressure",active:!1})),W=-1,v)H=!0;else{let n=s.createCommandEncoder();N(n),s.queue.submit([n.finish()]),z()}oe(),self.postMessage({type:"stepping",active:!1}),self.requestAnimationFrame(Y)}else _?self.requestAnimationFrame(Y):s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(Y)});return}wr();let r=!1;if(L){_&&Qe()&&ee()&&(b>=C&&V(),Z(h));let n=!1;j===0&&(j=e);let i=e-j;if(j=e,w<=0){if(_){let a=!1,c=performance.now()+14;for(;performance.now()<c;){if(!ee()){a=!0;break}b>=C&&V(),Ke(),ae++,n=!0,Z(h)}if(a){if(x||(x=!0,self.postMessage({type:"backpressure",active:!0})),e-$>=1e3&&($=e,Ie()),n&&(e-fe>=1e3||fe===0)&&!v){fe=e;let d=s.createCommandEncoder();N(d),s.queue.submit([d.finish()]),z()}s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(Y)});return}x&&(x=!1,self.postMessage({type:"backpressure",active:!1}))}else if(!Se){let a=nr(),c=dn();for(let l=0;l<c;l++)sr(a),n=!0;Se=!0,s.queue.onSubmittedWorkDone().then(()=>{Se=!1,yr()?yt():ze()})}e-$>=1e3&&($=e,Ie())}else for(X+=i;X>=w;){if(_){if(!ee())break;b>=C&&V()}Ke(),ae++,X-=w,n=!0,_&&Z(h)}n&&(r=(e-fe>=1e3||fe===0)&&!v)}if(w>0&&!ht&&oe(),r){fe=e;let n=s.createCommandEncoder();N(n),s.queue.submit([n.finish()]),z()}w<=0&&!_&&L||self.requestAnimationFrame(Y)}function pn(e,t){let r=s?Be():Number.POSITIVE_INFINITY;return qt(t.bitsPerCell)&&it(t.bitsPerCell,e.tribes.length)&&at(e.cols,e.rows,Pe(t.bitsPerCell),r)?Pe(t.bitsPerCell):Ht(e.tribes.length,e.cols,e.rows,r)}function ir(e,t){Re=e,B=e.cols,S=e.rows,p=pn(e,t),Je=Ee(B,p),T=[...e.tribes],K.gridFormat=se(),te.clear(),T.forEach((r,n)=>te.set(r.id,n))}async function Tr(e){ce=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");s=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),le=!1,s.lost.then(n=>{let i=n.message||n.reason||"unknown";le=!0,L=!1,re=!0,self.postMessage({type:"deviceLost",reason:i})}),self.postMessage({type:"limits",maxBytes:Be(),vramBudgetBytes:Br(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:se()});let r=ce.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");dt=r,pt=navigator.gpu.getPreferredCanvasFormat(),dt.configure({device:s,format:pt,alphaMode:"opaque"})}async function gn(){try{return await Tr(ce),!0}catch(e){let t=e instanceof Error?e.message:String(e);return le=!0,L=!1,re=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function Mr(){U=s.createBuffer({size:C*m,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Ze(C*m,U),b=0,E=[]}async function vr(){let e=C*m;J=[],q=[];for(let t=0;t<et;t++){let r=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});J.push(r),q.push(!0),await Ze(e,r)}}async function mn(){await Er()}async function bn(){Pt(),Pr(),await xt(),Et(),kt(),wt(),Tt(),vt(),Mt(),await mn(),ne()?(await Mr(),await vr()):(Ve(),_=!1),await je(),Ft()}async function hn(){re=!0,self.postMessage({type:"rebuilding",active:!0});try{await Lt()}catch{}if(le&&!await gn())return!1;Vt(),Pt(),Pr(),Zt(ne());try{await xt(),Et(),kt(),Tt(),vt(),wt(),Mt(),ne()?(await Mr(),await vr()):(Ve(),_=!1),await je(),Ft()}catch(e){let t=e instanceof Error?e.message:String(e);self.postMessage({type:"gpuError",reason:t});try{Vt(),Pt(),Zt(!1),await xt(),Et(),kt(),Tt(),vt(),wt(),Mt(),_=!1,m=rt(),Ve(),await je(),Ft()}catch(r){return console.warn("GPU recovery also failed, device may be lost:",r),!1}}return re=!1,self.postMessage({type:"rebuilding",active:!1}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{_=t.recording,ir(t.ruleset,t.simulationGridFormat),await Tr(t.canvas),await bn(),me(),L=t.running,w=t.speed<0?0:1e3/t.speed,j=0,X=0,self.requestAnimationFrame(Y);break}case"setRuleset":{if(ir(t.ruleset,t.simulationGridFormat),!await hn())break;if(h=0,W=-1,await er(0),gt=new Map,mt=new Set,v)H=!0;else{let n=s.createCommandEncoder();N(n),s.queue.submit([n.finish()]),z()}break}case"setRunning":if(!t.running&&D>=0){if(D=-1,L=!1,w=Ne,j=0,X=0,x&&ge(),W=-1,v)H=!0;else{let r=s.createCommandEncoder();N(r),s.queue.submit([r.finish()]),z()}oe(),self.postMessage({type:"stepping",active:!1});break}if(L=t.running,t.running)j=0,X=0,yt();else{if(x&&ge(),W=-1,v)H=!0;else{let r=s.createCommandEncoder();N(r),s.queue.submit([r.finish()]),z()}w<=0&&!_&&D<0&&!Se&&ze()}break;case"setSpeed":{let r=w<=0,n=t.speed<0?0:1e3/t.speed;r&&n>0&&(ht=!0,s.queue.onSubmittedWorkDone().then(()=>{ht=!1,oe(),ze()})),w=n,X=0,$=0,!r&&n<=0?yt():r&&n>0&&!Se&&ze();break}case"camera":ur=t.scale,lr=t.offsetX,cr=t.offsetY;break;case"resize":ce.width=t.width,ce.height=t.height;break;case"draw":{let r=t.tribes.map(n=>te.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};De={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{on().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:h,cols:B,rows:S,gridFormat:se()},[r.buffer])}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:h,cols:B,rows:S,gridFormat:se()})});break}case"loadSnapshot":{let r=M?R:F,n=ut(t.gridFormat),i=ke(B,S,n);if(t.grid.byteLength!==i)break;let a=n.bitsPerCell===p.bitsPerCell?t.grid:lt(ct(t.grid,B,S,n),B,S,p);s.queue.writeBuffer(r,0,a),h=t.generation,await er(t.generation);break}case"setRecording":{if(t.recording&&ne()&&!_){if(_=!0,tr(),W=-1,v)H=!0;else{let r=s.createCommandEncoder();N(r),s.queue.submit([r.finish()]),z()}me()}else(!t.recording||!ne())&&(_=!1);break}case"getRecording":{if(Ae)break;await Lt(),tr(),b>0&&V(),Q>0?Ae=!0:kr();break}case"stepBack":{let r=0;for(let l of y)r+=l.blockCount;let n=r+b,i=Math.min(t.count,n-1);if(i<=0)break;let a=n-1-i,c=M?R:F;if(a>=r){let l=a-r;b=l+1,E.length=b,h=E[l];let d=s.createCommandEncoder();d.copyBufferToBuffer(U,l*m,c,0,m),s.queue.submit([d.finish()])}else{if(Q>0){await new Promise(P=>{let G=setInterval(()=>{Q===0&&(clearInterval(G),P())},10)}),r=0;for(let P of y)r+=P.blockCount}let l=0,d=0,f=0;for(let P=0;P<y.length;P++){let G=y[P];if(a<l+G.blockCount){d=P,f=a-l;break}l+=G.blockCount}let u=y[d],o=await fn(u.filename,u.codec),g=ut(u.gridFormat),k=ke(B,S,g);if(g.bitsPerCell===p.bitsPerCell){let P=(f+1)*m;s.queue.writeBuffer(U,0,new Uint8Array(o,0,P))}else{let P=new Uint8Array((f+1)*m);for(let G=0;G<=f;G++){let Fr=G*k,Rr=new Uint8Array(o,Fr,k),Gr=Yt(Rr,B,S,g),nt=lt(Gr,B,S,p);P.set(new Uint8Array(nt.buffer,nt.byteOffset,nt.byteLength),G*m)}s.queue.writeBuffer(U,0,P),s.queue.writeBuffer(c,0,P.subarray(f*m,(f+1)*m))}if(b=f+1,E=u.generations.slice(0,f+1),h=E[f],g.bitsPerCell===p.bitsPerCell){let P=s.createCommandEncoder();P.copyBufferToBuffer(U,f*m,c,0,m),s.queue.submit([P.finish()])}let _e=y.splice(d).map(P=>P.filename);cn(_e)}if($t(),me(),W=-1,v)H=!0;else{let l=s.createCommandEncoder();N(l),s.queue.submit([l.finish()]),z()}oe();break}case"stepForward":{if(wr(),t.count===1){if(_&&Qe()&&ee()&&(b>=C&&V(),Z(h)),Ke(),ae++,_&&ee()&&(b>=C&&V(),Z(h)),W=-1,v)H=!0;else{let r=s.createCommandEncoder();N(r),s.queue.submit([r.finish()]),z()}oe()}else self.postMessage({type:"stepping",active:!0}),_&&Qe()&&ee()&&(b>=C&&V(),Z(h)),bt=L,Ne=w,D=h+t.count,L=!0,w=0,$=0;break}case"cancelStepping":{if(D>=0){if(D=-1,L=bt,w=Ne,j=0,X=0,W=-1,v)H=!0;else{let r=s.createCommandEncoder();N(r),s.queue.submit([r.finish()]),z()}oe(),self.postMessage({type:"stepping",active:!1})}break}case"updateChunkCodec":{let r=y.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,K.chunks=[...y],me());break}case"getUncompressedChunks":{let r=y.filter(n=>n.codec===tt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:B,rows:S,rawGridFormat:n.gridFormat,storageGridFormat:xe(ot(Re.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
