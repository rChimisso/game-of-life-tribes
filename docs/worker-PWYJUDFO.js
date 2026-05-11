var er=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var tr=[1,2,4,8,16,32],F={1:{bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},2:{bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},4:{bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},8:{bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},16:{bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},32:{bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295}},Ln=F[1],Fn=F[2],In=F[4],mt=F[8],Gn=F[16],Xr=F[32];function rr(e){return tr.includes(e)}function jr(e){return 2**e}function bt(e,t){return t<=jr(e)}function ht(e,t,r,n){return Te(e,t,r)<=n}function yt(e){return e<=2?F[1]:e<=4?F[2]:e<=16?F[4]:e<=256?F[8]:e<=65536?F[16]:F[32]}function Ee(e){return F[e]}function nr(e,t=1,r=1,n=Number.POSITIVE_INFINITY){for(let i of tr){let o=Ee(i);if(bt(i,e)&&ht(t,r,o,n))return o}return Xr}function Ct(e){return Ee(e?.bitsPerCell??8)}function Pe(e){return{bitsPerCell:e.bitsPerCell}}function xe(e,t){return Math.ceil(e/t.cellsPerWord)}function Te(e,t,r){return xe(e,r)*t*Uint32Array.BYTES_PER_ELEMENT}function Zr(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function _t(e,t,r,n){let i=xe(t,n),o=new Uint32Array(i*r);for(let c=0;c<r;c++)for(let l=0;l<i;l++){let f=l*n.cellsPerWord,b=0;for(let u=0;u<n.cellsPerWord&&f+u<t;u++){let a=e[c*t+f+u]&n.cellMask;b|=a<<(u<<n.cellShift)}o[c*i+l]=b>>>0}return o}function St(e,t,r,n){let i=xe(t,n),o=new Uint8Array(t*r);for(let c=0;c<r;c++)for(let l=0;l<i;l++){let f=e[c*i+l],b=l*n.cellsPerWord;for(let u=0;u<n.cellsPerWord&&b+u<t;u++)o[c*t+b+u]=f>>>(u<<n.cellShift)&n.cellMask}return o}function sr(e,t,r,n){return St(Zr(e),t,r,n)}var Ie="dead";var Ge="empty",Ue="is",Bt="comparison",De="count",Oe="none",Ne="exactly",$e="min",We="max",Ke="not",ze="and",qe="or",Ye="xor";var s,le=!1,Pt,xt,ce,Re,S=0,_=0,ct=0,d=mt,w=[],te=new Map,v,R,Le,de,it,Cr,_r,Ae,zt,qt,A=!1,Sr=1,Br=0,Er=0,I=!1,re=!1,k=100,X=0,j=0,h=0,je,pe,Pr,xr,Qr=0,Ze=null,Ve,Tr,kr,be,he,Qe,wr,Ar,ye,Ce,$=-1,M=!1,q=!1,fe=0,Tt=new Map,kt=new Set,B=!1,H={chunks:[],generationStart:0,generationEnd:0,gridFormat:Pe(mt)},Mr=0,y=[],D=-1,wt=!1,Je=100,O=0,At=!1,_e=!1;function vr(){return I&&k<=0&&D<0&&!B}function Mt(){re||le||_e||!vr()||Y(performance.now())}function et(){re||le||self.requestAnimationFrame(Y)}var G=null,m=0,x=[],C=64,g=0,ft=3,J=[],z=[],tt="gol-recording",dt="raw-packed",Rr="deflate-raw",Me=null,ie=null,Q=0,ue=0,ir=12,P=!1,ke=0,Yt=256,Jr=Yt*Uint32Array.BYTES_PER_ELEMENT,vt=Yt*Uint32Array.BYTES_PER_ELEMENT,Rt=Uint32Array.BYTES_PER_ELEMENT,or=256*1024*1024,en=512*1024*1024,tn=512*1024*1024,ar=128*1024*1024*1024,rt=0,nt=0,ve=[];function rn(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function Lr(e){I=!1,self.postMessage({type:"gpuError",reason:rn(e)})}self.addEventListener("error",e=>{e.preventDefault(),Lr(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),Lr(e.reason)});async function Ht(){await s.queue.onSubmittedWorkDone()}function ur(e){rt=0,nt=2+(e?1+ft:0),ve=[]}async function ot(){if(ve.length===0)return;let e=s.createCommandEncoder();for(let t of ve)e.clearBuffer(t);s.queue.submit([e.finish()]),await Ht(),ve=[]}async function at(e,t){!re||nt<=0||(rt+=e,nt--,ve.push(t),rt>=nn()&&nt>0&&(await ot(),rt=0))}function nn(){return Math.min(Se(),tn)}function Se(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function Xt(){return Math.min(Se(),1073741824)}function Fr(){return Math.max(Se()*2,Xt()*6)}function ne(){return g>0&&g<=Xt()}function sn(){return g<=0?0:g*2+Zt+Jr+Vt+vt*2+Rt*2}function on(){return C<1||g<=0?0:C*g*(1+ft)}function ut(){G?.destroy(),G=null;for(let e of J)e?.destroy();J=[],z=[],C=0,m=0,x=[]}function lr(){v?.destroy(),R?.destroy(),be?.destroy(),he?.destroy(),ye?.destroy(),Ce?.destroy(),pe?.destroy(),ut()}function Et(e){let t=Q>0;Q+=e;let r=Q>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function ge(){if(C<1||J.length===0){P&&(P=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=Ur(),t=!z.some(i=>i)&&m>=C,r=ue>=e,n;if(P){let i=z.some(c=>c),o=ue<=Math.floor(e/2);n=!(i&&o)}else n=t||r;n!==P&&(P=n,self.postMessage({type:"backpressure",active:n}))}async function me(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??ar/128,ar),r=e.usage??0,n=0,i=0;for(let l of y)l.codec===dt?n+=l.storedBytes:i+=l.storedBytes;let o=C*g,c=B?(1+ft)*o:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:c})}var Fe=!1;async function an(e){let t=new DecompressionStream(Rr),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:f,value:b}=await i.read();if(f)break;n.push(b)}let o=0;for(let f of n)o+=f.byteLength;let c=new Uint8Array(o),l=0;for(let f of n)c.set(f,l),l+=f.byteLength;return c.buffer}var oe=0,He=0,jt=0;function un(e){e.push(`const CELLS_PER_WORD: u32 = ${d.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${d.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${d.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${d.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${d.cellMask}u;`)}function ln(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function cn(){let e=[],t=ct;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${w.map(u=>u.id).join(", ")}`),e.push(`// Rules: ${Re.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${S}u;`),e.push(`const ROWS: u32 = ${_}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),un(e),e.push(""),ln(e,"gridIn","PACKED_COLS"),e.push("");let r=te.get(Ie)??0,n=Re.rules.filter(u=>!u.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let i=dn(n.map(u=>u.clause)),o=new Map,c=0;for(let u of i){let a=`count_${c++}`;o.set(u,a)}for(let[u,a]of o){let p=u.split(",").map(Number),U=cr().map(Be=>`select(0u, 1u, ${p.map(L=>`${Be} == ${L}u`).join(" || ")})`);e.push(`  let ${a} = ${U.join(" + ")};`)}i.size>0&&e.push("");let l=pn(n.map(u=>u.clause)),f=new Map,b=0;for(let u of l)if(o.has(u))f.set(u,o.get(u));else{let a=`eq_count_${b++}`;f.set(u,a)}for(let[u,a]of f){if(o.has(u))continue;let p=u.split(",").map(Number),U=cr().map(Be=>`select(0u, 1u, ${p.map(L=>`${Be} == ${L}u`).join(" || ")})`);e.push(`  let ${a} = ${U.join(" + ")};`)}l.size>0&&b>0&&e.push(""),e.push(`  var result: u32 = ${r}u;`),e.push("");for(let u=0;u<n.length;u++){let a=n[u],p=we(a.clause,o,f),T=fn(a.tribe);u===0?e.push(`  if (${p}) {`):e.push(`  } else if (${p}) {`),e.push(`    result = ${T}u;`)}n.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let u=-1;u<=1;u++)for(let a=-1;a<=1;a++){if(a===0&&u===0)continue;let p=Ir(a,u),T=fr("x",a,"COLS"),U=fr("y",u,"ROWS");e.push(`    let ${p} = readCell(${T}, ${U});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function Ir(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function cr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(Ir(r,t));return e}function fr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function N(e){let t=[];for(let r of e)if(r==="any")for(let n=0;n<w.length;n++)t.push(n);else{let n=te.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function fn(e){return e==="any"?0:te.get(e)??0}function dn(e){let t=new Set;for(let r of e)Lt(r,t);return t}function Lt(e,t){switch(e.kind){case Ge:case Ue:break;case Oe:case Ne:case $e:case We:case De:{let r=N(e.tribes).sort();t.add(r.join(","));break}case Ke:Lt(e.clause,t);break;case ze:case qe:case Ye:for(let r of e.clauses)Lt(r,t);break}}function pn(e){let t=new Set;for(let r of e)Ft(r,t);return t}function Ft(e,t){switch(e.kind){case Ge:case Ue:case De:case Oe:case Ne:case $e:case We:break;case Bt:{let r=N(e.tribe1).sort(),n=N(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case Ke:Ft(e.clause,t);break;case ze:case qe:case Ye:for(let r of e.clauses)Ft(r,t);break}}function we(e,t,r){switch(e.kind){case Ge:return"false";case Ue:{let n=N(e.tribes);return n.length===0?"false":n.length===w.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case De:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case Oe:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case Ne:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case $e:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case We:{let n=N(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case Bt:{let n=r.get(N(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),o=`(i32(${r.get(N(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${o})`;case">":return`(i32(${n}) > ${o})`;case"<":return`(i32(${n}) < ${o})`;case"\u2265":return`(i32(${n}) >= ${o})`;case"\u2264":return`(i32(${n}) <= ${o})`;default:return`(i32(${n}) == ${o})`}}case Ke:return`!(${we(e.clause,t,r)})`;case ze:return`(${e.clauses.map(i=>we(i,t,r)).join(" && ")})`;case qe:return`(${e.clauses.map(i=>we(i,t,r)).join(" || ")})`;case Ye:return`(((${e.clauses.map(o=>we(o,t,r)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var Zt=48;function It(){Le?.destroy(),Le=s.createBuffer({size:Zt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function gn(){let e=new ArrayBuffer(Zt),t=new Float32Array(e),r=new Uint32Array(e);t[0]=ce.width,t[1]=ce.height,t[2]=S,t[3]=_,t[4]=Sr,t[6]=Br,t[7]=Er,r[8]=w.length,s.queue.writeBuffer(Le,0,e)}function pt(){return Te(S,_,d)}function se(){return Pe(d)}async function Gt(){let e=pt();v=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await at(e,v),R=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await at(e,R);let t=s.createCommandEncoder();t.clearBuffer(v),t.clearBuffer(R),s.queue.submit([t.finish()]),A=!1}function Ut(){let e=new Uint32Array(Yt);for(let t=0;t<w.length;t++){let r=w[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),o=parseInt(r.substring(4,6),16);e[t]=n|i<<8|o<<16}de&&de.destroy(),de=s.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(de,0,e)}function mn(){return er.replace("__CELLS_PER_WORD__",`${d.cellsPerWord}u`).replace("__WORD_SHIFT__",`${d.wordShift}u`).replace("__CELL_SHIFT__",`${d.cellShift}u`).replace("__CELL_INDEX_MASK__",`${d.cellIndexMask}u`).replace("__CELL_MASK__",`${d.cellMask}u`)}function Dt(){let e=s.createShaderModule({code:mn()});it=s.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:xt}]},primitive:{topology:"triangle-list"}})}function Ot(){Cr=s.createBindGroup({layout:it.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Le}},{binding:1,resource:{buffer:v}},{binding:2,resource:{buffer:de}}]}),_r=s.createBindGroup({layout:it.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Le}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:de}}]})}function Nt(){let e=cn(),t=s.createShaderModule({code:e});Ae=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),zt=s.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:R}}]}),qt=s.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:v}}]})}function bn(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = ${S}u;
const ROWS: u32 = ${_}u;
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
`}function hn(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${S}u;
const ROWS: u32 = ${_}u;
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
`}function $t(){let e=s.createShaderModule({code:bn()});Ve=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),be=s.createBuffer({size:vt,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),he=s.createBuffer({size:vt,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Tr=s.createBindGroup({layout:Ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:be}}]}),kr=s.createBindGroup({layout:Ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:be}}]});let t=s.createShaderModule({code:hn()});Qe=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),ye=s.createBuffer({size:Rt,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),Ce=s.createBuffer({size:Rt,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),wr=s.createBindGroup({layout:Qe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:ye}}]}),Ar=s.createBindGroup({layout:Qe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:ye}}]})}var Vt=176;function yn(){return`
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
`}function Wt(){let e=s.createShaderModule({code:yn()});je=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),pe?.destroy(),pe=s.createBuffer({size:Vt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Pr=s.createBindGroup({layout:je.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:pe}}]}),xr=s.createBindGroup({layout:je.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:pe}}]})}function Cn(e,t,r,n,i,o,c){let l=te.get(Ie)??0,f=Qr++,b=new ArrayBuffer(Vt),u=new Int32Array(b),a=new Uint32Array(b);u[0]=t,u[1]=r,a[2]=S,a[3]=_,a[4]=n,a[5]=i,a[6]=o,a[7]=l,a[8]=f,a[9]=c.length,a[10]=0;for(let U=0;U<c.length&&U<32;U++)a[11+U]=c[U];s.queue.writeBuffer(pe,0,b);let p=Math.ceil(n/8),T=e.beginComputePass();T.setPipeline(je),T.setBindGroup(0,A?xr:Pr),T.dispatchWorkgroups(p,p),T.end()}function _n(){let e=A?R:v,t=pt(),r;try{r=s.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder();return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function Gr(){if(g=pt(),!ne()){C=0;return}let e=Sn();C=Math.max(1,Math.floor(e/g))}function Sn(){return g>=or?g:Math.min(Math.max(or,g),Xt())}function Ur(){if(C<1||g<=0)return ir;let e=Math.max(g,C*g),t=Math.floor(en/e);return Math.max(1,Math.min(ir,t||1))}function Kt(){let e=ne();self.postMessage({type:"limits",maxBytes:Se(),vramBudgetBytes:Fr(),frameByteSize:g,recordingAvailable:e,vramSimulationBytes:sn(),vramRecordingBytes:on(),gridFormat:se()})}function ee(){return!ne()||C<1||G===null||J.length===0||ue>=Ur()?!1:m<C?!0:J.some((e,t)=>z[t]&&e.mapState==="unmapped")}function Z(e){if(C<1||G===null||m>=C)return;let t=A?R:v,r=m*g,n=s.createCommandEncoder();n.copyBufferToBuffer(t,0,G,r,g),s.queue.submit([n.finish()]),x.push(e),m++}function V(){if(G===null||m===0||J.length===0)return;let e=z.indexOf(!0);if(e<0)return;z[e]=!1;let t=J[e];if(t.mapState!=="unmapped"){z[e]=!0;return}let r=m*g,n=Mr++,i=[...x],o=i[0],c=i[i.length-1],l=`chunk-${String(n).padStart(6,"0")}.bin`,f=m,b=s.createCommandEncoder();b.copyBufferToBuffer(G,0,t,0,r),s.queue.submit([b.finish()]);let u={chunkId:n,generationStart:o,generationEnd:c,blockCount:f,codec:dt,uncompressedBytes:r,storedBytes:r,gridFormat:se(),generations:i,filename:l};Et(1),ue++,ge();let a=ke;t.mapAsync(GPUMapMode.READ).then(async()=>{let p=t.getMappedRange(),T=new ArrayBuffer(r);new Uint8Array(T).set(new Uint8Array(p,0,r)),t.unmap(),a===ke&&(z[e]=!0,ge(),y.push(u),Qt(),Bn(u,T).then(()=>{a===ke&&(ue--,ge(),Et(-1),me(),self.postMessage({type:"chunkSealed",filename:u.filename,rawBytes:r,blockCount:u.blockCount,cols:S,rows:_,rawGridFormat:u.gridFormat,storageGridFormat:Pe(yt(Re.tribes.length))}),Fe&&Q===0&&(Fe=!1,Or()))}))}).catch(()=>{a===ke&&(z[e]=!0,ue--,ge(),Et(-1))}),m=0,x=[]}function Qt(){y.length>0&&(H.generationStart=y[0].generationStart,H.generationEnd=y[y.length-1].generationEnd),x.length>0&&(y.length===0&&(H.generationStart=x[0]),H.generationEnd=x[x.length-1]),H.chunks=[...y]}async function dr(e){ke++,Mr=0,m=0,x=[],y=[],ue=0,Q>0&&(Q=0,self.postMessage({type:"chunksSaving",active:!1})),P&&(P=!1,self.postMessage({type:"backpressure",active:!1})),Fe=!1,H={chunks:[],generationStart:e,generationEnd:e,gridFormat:se()},await Dr(),me()}async function Jt(){return ie&&await ie,Me||(Me=await(await navigator.storage.getDirectory()).getDirectoryHandle(tt,{create:!0})),Me}async function Bn(e,t){let i=await(await(await Jt()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function En(e){let t=await Jt();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function Dr(){if(ie){await ie;return}ie=(async()=>{let e=await navigator.storage.getDirectory();Me=null;try{await e.removeEntry(tt,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${tt}:`,t)}Me=await e.getDirectoryHandle(tt,{create:!0})})();try{await ie}finally{ie=null}}function Or(){Qt(),self.postMessage({type:"recording",manifest:{chunks:y.map(e=>({...e,generations:[...e.generations]})),generationStart:H.generationStart,generationEnd:H.generationEnd,gridFormat:se()},cols:S,rows:_})}function lt(){return m>0?x[m-1]!==h:y.length>0?y[y.length-1].generationEnd!==h:!0}function pr(){!B||!lt()||!ee()||(m>=C&&V(),Z(h))}function Nr(){if(!Ze)return;let e=Ze;Ze=null;let t=s.createCommandEncoder();Cn(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),B&&m>0&&x[m-1]===h&&(m--,x.pop(),Z(h))}async function Pn(e,t=dt){let o=await(await(await(await Jt()).getFileHandle(e)).getFile()).arrayBuffer();return t===Rr?an(o):o}function gr(){let e=m;for(let t of y)e+=t.blockCount;return e}function W(e){let t=Math.ceil(S/16),r=Math.ceil(_/16),n=new Uint32Array(256);s.queue.writeBuffer(be,0,n);let i=e.beginComputePass();i.setPipeline(Ve),i.setBindGroup(0,A?kr:Tr),i.dispatchWorkgroups(t,r),i.end(),e.copyBufferToBuffer(be,0,he,0,256*4);let o=new Uint32Array([0]);s.queue.writeBuffer(ye,0,o);let c=e.beginComputePass();c.setPipeline(Qe),c.setBindGroup(0,A?Ar:wr),c.dispatchWorkgroups(t,r),c.end(),e.copyBufferToBuffer(ye,0,Ce,0,4)}function K(){let e=h;if(e===$||M)return;$=e,M=!0;let t=[];t.push(he.mapAsync(GPUMapMode.READ)),t.push(Ce.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=te.get(Ie)??0,n={},i=0,o=0,c={},l=new Uint32Array(he.getMappedRange().slice(0));he.unmap();let f=0;for(let a=0;a<w.length;a++){let p=l[a]??0;n[w[a].id]=p,a!==r&&(f+=p,p>0&&(Tt.set(a,e),kt.add(a)))}if(f>0)for(let a=0;a<w.length;a++){if(a===r)continue;let p=(l[a]??0)/f;p>0&&(i-=p*Math.log2(p),o+=p*p)}for(let a=0;a<w.length;a++){if(a===r)continue;(l[a]??0)>0?c[w[a].id]=null:kt.has(a)?c[w[a].id]=Tt.get(a)??0:c[w[a].id]=0}let b=new Uint32Array(Ce.getMappedRange().slice(0));Ce.unmap();let u=b[0]??0;if(M=!1,self.postMessage({type:"metrics",generation:e,population:n,shannonEntropy:i,simpsonIndex:1-o,boundaryLength:u,extinctionTime:c,totalFrames:gr(),fps:jt,canStepBack:gr()>1,recordingBytes:y.reduce((a,p)=>a+p.storedBytes,0),recordingRawBytes:y.reduce((a,p)=>a+p.uncompressedBytes,0)}),q){q=!1,$=-1;let a=s.createCommandEncoder();W(a),s.queue.submit([a.finish()]),K()}}).catch(()=>{M=!1})}function mr(){let e=S*_;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function xn(){let e=S*_;return e>1e7?2:e>1e6?4:e>1e5?8:16}function br(e){if(e<=0)return;let t=Math.ceil(ct/16),r=Math.ceil(_/16),n=s.createCommandEncoder();for(let i=0;i<e;i++){let o=n.beginComputePass();o.setPipeline(Ae),o.setBindGroup(0,A?qt:zt),o.dispatchWorkgroups(t,r),o.end(),A=!A,h++}s.queue.submit([n.finish()]),oe+=e}function Xe(){self.postMessage({type:"generation",generation:h,fps:jt})}function st(){let e=s.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(Ae),t.setBindGroup(0,A?qt:zt);let r=Math.ceil(ct/16),n=Math.ceil(_/16);t.dispatchWorkgroups(r,n),t.end(),s.queue.submit([e.finish()]),A=!A,h++}function ae(){gn();let e=Pt.getCurrentTexture().createView(),t=s.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(it),r.setBindGroup(0,A?_r:Cr),r.draw(3),r.end(),s.queue.submit([t.finish()])}function Y(e){if(re||le){self.requestAnimationFrame(Y);return}He===0&&(He=e);let t=e-He;if(t>=1e3&&(jt=oe/(t/1e3),oe=0,He=e),D>=0){if(B){let n=!1,i=performance.now()+14;for(;h<D&&performance.now()<i;){if(!ee()){n=!0;break}m>=C&&V(),st(),oe++,Z(h)}if(n){P||(P=!0,self.postMessage({type:"backpressure",active:!0})),e-O>=1e3&&(O=e,Xe()),s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(Y)});return}P&&(P=!1,self.postMessage({type:"backpressure",active:!1}))}else{let n=Math.min(mr(),D-h);br(n)}if(e-O>=1e3&&(O=e,Xe()),h>=D){if(D=-1,I=wt,k=Je,j=0,X=0,O=0,P&&(P=!1,self.postMessage({type:"backpressure",active:!1})),$=-1,M)q=!0;else{let n=s.createCommandEncoder();W(n),s.queue.submit([n.finish()]),K()}ae(),self.postMessage({type:"stepping",active:!1}),self.requestAnimationFrame(Y)}else B?self.requestAnimationFrame(Y):s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(Y)});return}Nr();let r=!1;if(I){B&&lt()&&ee()&&(m>=C&&V(),Z(h));let n=!1;j===0&&(j=e);let i=e-j;if(j=e,k<=0){if(B){let o=!1,c=performance.now()+14;for(;performance.now()<c;){if(!ee()){o=!0;break}m>=C&&V(),st(),oe++,n=!0,Z(h)}if(o){if(P||(P=!0,self.postMessage({type:"backpressure",active:!0})),e-O>=1e3&&(O=e,Xe()),n&&(e-fe>=1e3||fe===0)&&!M){fe=e;let f=s.createCommandEncoder();W(f),s.queue.submit([f.finish()]),K()}s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(Y)});return}P&&(P=!1,self.postMessage({type:"backpressure",active:!1}))}else if(!_e){let o=mr(),c=xn();for(let l=0;l<c;l++)br(o),n=!0;_e=!0,s.queue.onSubmittedWorkDone().then(()=>{_e=!1,vr()?Mt():et()})}e-O>=1e3&&(O=e,Xe())}else for(X+=i;X>=k;){if(B){if(!ee())break;m>=C&&V()}st(),oe++,X-=k,n=!0,B&&Z(h)}n&&(r=(e-fe>=1e3||fe===0)&&!M)}if(k>0&&!At&&ae(),r){fe=e;let n=s.createCommandEncoder();W(n),s.queue.submit([n.finish()]),K()}k<=0&&!B&&I||self.requestAnimationFrame(Y)}function Tn(e,t){let r=s?Se():Number.POSITIVE_INFINITY;return rr(t.bitsPerCell)&&bt(t.bitsPerCell,e.tribes.length)&&ht(e.cols,e.rows,Ee(t.bitsPerCell),r)?Ee(t.bitsPerCell):nr(e.tribes.length,e.cols,e.rows,r)}function hr(e,t){Re=e,S=e.cols,_=e.rows,d=Tn(e,t),ct=xe(S,d),w=[...e.tribes],H.gridFormat=se(),te.clear(),w.forEach((r,n)=>te.set(r.id,n))}async function $r(e){ce=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");s=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),le=!1,s.lost.then(n=>{let i=n.message||n.reason||"unknown";le=!0,I=!1,re=!0,self.postMessage({type:"deviceLost",reason:i})}),self.postMessage({type:"limits",maxBytes:Se(),vramBudgetBytes:Fr(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:se()});let r=ce.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");Pt=r,xt=navigator.gpu.getPreferredCanvasFormat(),Pt.configure({device:s,format:xt,alphaMode:"opaque"})}async function kn(){try{return await $r(ce),!0}catch(e){let t=e instanceof Error?e.message:String(e);return le=!0,I=!1,re=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function Wr(){G=s.createBuffer({size:C*g,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await at(C*g,G),m=0,x=[]}async function Kr(){let e=C*g;J=[],z=[];for(let t=0;t<ft;t++){let r=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});J.push(r),z.push(!0),await at(e,r)}}async function wn(){await Dr()}async function An(){It(),Gr(),await Gt(),Ut(),Dt(),Ot(),Nt(),Wt(),$t(),await wn(),ne()?(await Wr(),await Kr()):(ut(),B=!1),await ot(),Kt()}async function Mn(){re=!0,self.postMessage({type:"rebuilding",active:!0});try{await Ht()}catch{}if(le&&!await kn())return!1;lr(),It(),Gr(),ur(ne());try{await Gt(),Ut(),Dt(),Nt(),Wt(),Ot(),$t(),ne()?(await Wr(),await Kr()):(ut(),B=!1),await ot(),Kt()}catch(e){let t=e instanceof Error?e.message:String(e);self.postMessage({type:"gpuError",reason:t});try{lr(),It(),ur(!1),await Gt(),Ut(),Dt(),Nt(),Wt(),Ot(),$t(),B=!1,g=pt(),ut(),await ot(),Kt()}catch(r){return console.warn("GPU recovery also failed, device may be lost:",r),!1}}return re=!1,self.postMessage({type:"rebuilding",active:!1}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{B=t.recording,hr(t.ruleset,t.simulationGridFormat),await $r(t.canvas),await An(),me(),I=t.running,k=t.speed<0?0:1e3/t.speed,j=0,X=0,self.requestAnimationFrame(Y);break}case"setRuleset":{if(hr(t.ruleset,t.simulationGridFormat),!await Mn())break;if(h=0,$=-1,await dr(0),Tt=new Map,kt=new Set,M)q=!0;else{let n=s.createCommandEncoder();W(n),s.queue.submit([n.finish()]),K()}break}case"setRunning":if(!t.running&&D>=0){if(D=-1,I=!1,k=Je,j=0,X=0,P&&ge(),$=-1,M)q=!0;else{let r=s.createCommandEncoder();W(r),s.queue.submit([r.finish()]),K()}ae(),self.postMessage({type:"stepping",active:!1});break}if(I=t.running,t.running)j=0,X=0,Mt();else{if(P&&ge(),$=-1,M)q=!0;else{let r=s.createCommandEncoder();W(r),s.queue.submit([r.finish()]),K()}k<=0&&!B&&D<0&&!_e&&et()}break;case"setSpeed":{let r=k<=0,n=t.speed<0?0:1e3/t.speed;r&&n>0&&(At=!0,s.queue.onSubmittedWorkDone().then(()=>{At=!1,ae(),et()})),k=n,X=0,O=0,!r&&n<=0?Mt():r&&n>0&&!_e&&et();break}case"camera":Sr=t.scale,Br=t.offsetX,Er=t.offsetY;break;case"resize":ce.width=t.width,ce.height=t.height;break;case"draw":{let r=t.tribes.map(n=>te.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};Ze={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{_n().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:h,cols:S,rows:_,gridFormat:se()},[r.buffer])}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:h,cols:S,rows:_,gridFormat:se()})});break}case"loadSnapshot":{let r=A?R:v,n=Ct(t.gridFormat),i=Te(S,_,n);if(t.grid.byteLength!==i)break;let o=n.bitsPerCell===d.bitsPerCell?t.grid:_t(St(t.grid,S,_,n),S,_,d);s.queue.writeBuffer(r,0,o),h=t.generation,await dr(t.generation);break}case"setRecording":{if(t.recording&&ne()&&!B){if(B=!0,pr(),$=-1,M)q=!0;else{let r=s.createCommandEncoder();W(r),s.queue.submit([r.finish()]),K()}me()}else(!t.recording||!ne())&&(B=!1);break}case"getRecording":{if(Fe)break;await Ht(),pr(),m>0&&V(),Q>0?Fe=!0:Or();break}case"stepBack":{let r=0;for(let l of y)r+=l.blockCount;let n=r+m,i=Math.min(t.count,n-1);if(i<=0)break;let o=n-1-i,c=A?R:v;if(o>=r){let l=o-r;m=l+1,x.length=m,h=x[l];let f=s.createCommandEncoder();f.copyBufferToBuffer(G,l*g,c,0,g),s.queue.submit([f.finish()])}else{if(Q>0){await new Promise(E=>{let L=setInterval(()=>{Q===0&&(clearInterval(L),E())},10)}),r=0;for(let E of y)r+=E.blockCount}let l=0,f=0,b=0;for(let E=0;E<y.length;E++){let L=y[E];if(o<l+L.blockCount){f=E,b=o-l;break}l+=L.blockCount}let u=y[f],a=await Pn(u.filename,u.codec),p=Ct(u.gridFormat),T=Te(S,_,p);if(p.bitsPerCell===d.bitsPerCell){let E=(b+1)*g;s.queue.writeBuffer(G,0,new Uint8Array(a,0,E))}else{let E=new Uint8Array((b+1)*g);for(let L=0;L<=b;L++){let zr=L*T,qr=new Uint8Array(a,zr,T),Yr=sr(qr,S,_,p),gt=_t(Yr,S,_,d);E.set(new Uint8Array(gt.buffer,gt.byteOffset,gt.byteLength),L*g)}s.queue.writeBuffer(G,0,E),s.queue.writeBuffer(c,0,E.subarray(b*g,(b+1)*g))}if(m=b+1,x=u.generations.slice(0,b+1),h=x[b],p.bitsPerCell===d.bitsPerCell){let E=s.createCommandEncoder();E.copyBufferToBuffer(G,b*g,c,0,g),s.queue.submit([E.finish()])}let Be=y.splice(f).map(E=>E.filename);En(Be)}if(Qt(),me(),$=-1,M)q=!0;else{let l=s.createCommandEncoder();W(l),s.queue.submit([l.finish()]),K()}ae();break}case"stepForward":{if(Nr(),t.count===1){if(B&&lt()&&ee()&&(m>=C&&V(),Z(h)),st(),oe++,B&&ee()&&(m>=C&&V(),Z(h)),$=-1,M)q=!0;else{let r=s.createCommandEncoder();W(r),s.queue.submit([r.finish()]),K()}ae()}else self.postMessage({type:"stepping",active:!0}),B&&lt()&&ee()&&(m>=C&&V(),Z(h)),wt=I,Je=k,D=h+t.count,I=!0,k=0,O=0;break}case"cancelStepping":{if(D>=0){if(D=-1,I=wt,k=Je,j=0,X=0,$=-1,M)q=!0;else{let r=s.createCommandEncoder();W(r),s.queue.submit([r.finish()]),K()}ae(),self.postMessage({type:"stepping",active:!1})}break}case"updateChunkCodec":{let r=y.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,H.chunks=[...y],me());break}case"getUncompressedChunks":{let r=y.filter(n=>n.codec===dt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:S,rows:_,rawGridFormat:n.gridFormat,storageGridFormat:Pe(yt(Re.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
