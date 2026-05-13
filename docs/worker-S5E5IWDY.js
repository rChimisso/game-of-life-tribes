var sr=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var ht=[1,2,4,8,16,32],jr={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},Zr={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},Vr={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Ie={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},Qr={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},yt={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},Q={1:jr,2:Zr,4:Vr,8:Ie,16:Qr,32:yt};var Ct="any",Ue="dead";var De="empty",Oe="is",_t="comparison",Ne="count",$e="none",We="exactly",Ke="min",ze="max",qe="not",Ye="and",He="or",Xe="xor";function ir(e){return ht.includes(e)}function Jr(e){return 2**e}function St(e,t){return t<=Jr(e)}function Et(e,t,r){return we(e,t)<=r}function Bt(e){return e<=2?Q[1]:e<=4?Q[2]:e<=16?Q[4]:e<=256?Q[8]:e<=65536?Q[16]:Q[32]}function Pe(e){return Q[e]}function or(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of ht){let i=Pe(n);if(St(n,e)&&Et(t,i,r))return i}return yt}function Pt(e){return Pe(e?.bitsPerCell??8)}function xe(e){return{bitsPerCell:e.bitsPerCell}}function Te(e,t){return Math.ceil(e/t.cellsPerWord)}function we(e,t){return Te(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function en(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function xt(e,t,r){let n=Te(t.cols,r),i=new Uint32Array(n*t.rows);for(let o=0;o<t.rows;o++)for(let l=0;l<n;l++){let c=l*r.cellsPerWord,d=0;for(let f=0;f<r.cellsPerWord&&c+f<t.cols;f++){let u=e[o*t.cols+c+f]&r.cellMask;d|=u<<(f<<r.cellShift)}i[o*n+l]=d>>>0}return i}function Tt(e,t,r){let n=Te(t.cols,r),i=new Uint8Array(t.cols*t.rows);for(let o=0;o<t.rows;o++)for(let l=0;l<n;l++){let c=e[o*n+l],d=l*r.cellsPerWord;for(let f=0;f<r.cellsPerWord&&d+f<t.cols;f++)i[o*t.cols+d+f]=c>>>(f<<r.cellShift)&r.cellMask}return i}function ar(e,t,r){return Tt(en(e),t,r)}var s,ae=!1,kt,At,ue,Fe,_=0,y=0,dt=0,p=Ie,A=[],J=new Map,v,R,Ge,ce,ut,_r,Sr,Me,Xt,jt,M=!1,Er=1,Br=0,Pr=0,G=!1,ee=!1,w=100,X=0,j=0,C=0,Ve,fe,xr,Tr,rn=0,Qe=null,Je,wr,kr,ge,me,et,Ar,Mr,be,he,K=-1,k=!1,$=!1,le=0,Mt=new Map,vt=new Set,B=!1,H=!1,Y={chunks:[],generationStart:0,generationEnd:0,gridFormat:xe(Ie)},vr=0,h=[],O=-1,Rt=!1,tt=100,N=0,Ft=!1,ye=!1;function Rr(){return G&&w<=0&&O<0&&!B}function Gt(){ee||ae||ye||!Rr()||q(performance.now())}function rt(){ee||ae||self.requestAnimationFrame(q)}var L=null,b=0,x=[],S=64,m=0,pt=3,V=[],z=[],nt="gol-recording",gt="raw-packed",Fr="deflate-raw",ve=null,ne=null,Z=0,oe=0,ur=12,P=!1,ke=0,Zt=256,nn=Zt*Uint32Array.BYTES_PER_ELEMENT,Lt=Zt*Uint32Array.BYTES_PER_ELEMENT,It=Uint32Array.BYTES_PER_ELEMENT,lr=256*1024*1024,sn=512*1024*1024,on=512*1024*1024,cr=128*1024*1024*1024,st=0,it=0,Re=[];function an(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function Gr(e){G=!1,self.postMessage({type:"gpuError",reason:an(e)})}self.addEventListener("error",e=>{e.preventDefault(),Gr(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),Gr(e.reason)});async function Vt(){await s.queue.onSubmittedWorkDone()}function fr(e){st=0,it=2+(e?1+pt:0),Re=[]}async function lt(){if(Re.length===0)return;let e=s.createCommandEncoder();for(let t of Re)e.clearBuffer(t);s.queue.submit([e.finish()]),await Vt(),Re=[]}async function ct(e,t){!ee||it<=0||(st+=e,it--,Re.push(t),st>=un()&&it>0&&(await lt(),st=0))}function un(){return Math.min(Ee(),on)}function Ee(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function Qt(){return Math.min(Ee(),1073741824)}function Lr(){return Math.max(Ee()*2,Qt()*6)}function te(){return m>0&&m<=Qt()}function ln(){return m<=0?0:m*2+er+nn+tr+Lt*2+It*2}function cn(){return S<1||m<=0?0:S*m*(1+pt)}function ft(){L?.destroy(),L=null;for(let e of V)e?.destroy();V=[],z=[],S=0,b=0,x=[]}function dr(){v?.destroy(),R?.destroy(),ge?.destroy(),me?.destroy(),be?.destroy(),he?.destroy(),fe?.destroy(),ft()}function wt(e){let t=Z>0;Z+=e;let r=Z>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function de(){if(S<1||V.length===0){P&&(P=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=Dr(),t=!z.some(i=>i)&&b>=S,r=oe>=e,n;if(P){let i=z.some(l=>l),o=oe<=Math.floor(e/2);n=!(i&&o)}else n=t||r;n!==P&&(P=n,self.postMessage({type:"backpressure",active:n}))}async function pe(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??cr/128,cr),r=e.usage??0,n=0,i=0;for(let c of h)c.codec===gt?n+=c.storedBytes:i+=c.storedBytes;let o=S*m,l=B?(1+pt)*o:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:l})}var Le=!1;async function fn(e){let t=new DecompressionStream(Fr),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:d,value:f}=await i.read();if(d)break;n.push(f)}let o=0;for(let d of n)o+=d.byteLength;let l=new Uint8Array(o),c=0;for(let d of n)l.set(d,c),c+=d.byteLength;return l.buffer}var se=0,je=0,Jt=0;function dn(e){e.push(`const CELLS_PER_WORD: u32 = ${p.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${p.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${p.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${p.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${p.cellMask}u;`)}function pn(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function gn(){let e=[],t=dt;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${A.map(u=>u.id).join(", ")}`),e.push(`// Rules: ${Fe.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${_}u;`),e.push(`const ROWS: u32 = ${y}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),dn(e),e.push(""),pn(e,"gridIn","PACKED_COLS"),e.push("");let r=J.get(Ue)??0,n=Fe.rules.filter(u=>!u.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let i=bn(n.map(u=>u.clause)),o=new Map,l=0;for(let u of i){let a=`count_${l++}`;o.set(u,a)}for(let[u,a]of o){let g=u.split(",").map(Number),I=pr().map(Be=>`select(0u, 1u, ${g.map(F=>`${Be} == ${F}u`).join(" || ")})`);e.push(`  let ${a} = ${I.join(" + ")};`)}i.size>0&&e.push("");let c=hn(n.map(u=>u.clause)),d=new Map,f=0;for(let u of c)if(o.has(u))d.set(u,o.get(u));else{let a=`eq_count_${f++}`;d.set(u,a)}for(let[u,a]of d){if(o.has(u))continue;let g=u.split(",").map(Number),I=pr().map(Be=>`select(0u, 1u, ${g.map(F=>`${Be} == ${F}u`).join(" || ")})`);e.push(`  let ${a} = ${I.join(" + ")};`)}c.size>0&&f>0&&e.push(""),e.push(`  var result: u32 = ${r}u;`),e.push("");for(let u=0;u<n.length;u++){let a=n[u],g=Ae(a.clause,o,d),T=mn(a.tribe);u===0?e.push(`  if (${g}) {`):e.push(`  } else if (${g}) {`),e.push(`    result = ${T}u;`)}n.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let u=-1;u<=1;u++)for(let a=-1;a<=1;a++){if(a===0&&u===0)continue;let g=Ir(a,u),T=gr("x",a,"COLS"),I=gr("y",u,"ROWS");e.push(`    let ${g} = readCell(${T}, ${I});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function Ir(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function pr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(Ir(r,t));return e}function gr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function W(e){let t=[];for(let r of e)if(r===Ct)for(let n=0;n<A.length;n++)t.push(n);else{let n=J.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function mn(e){return e===Ct?0:J.get(e)??0}function bn(e){let t=new Set;for(let r of e)Ut(r,t);return t}function Ut(e,t){switch(e.kind){case De:case Oe:break;case $e:case We:case Ke:case ze:case Ne:{let r=W(e.tribes).sort();t.add(r.join(","));break}case qe:Ut(e.clause,t);break;case Ye:case He:case Xe:for(let r of e.clauses)Ut(r,t);break}}function hn(e){let t=new Set;for(let r of e)Dt(r,t);return t}function Dt(e,t){switch(e.kind){case De:case Oe:case Ne:case $e:case We:case Ke:case ze:break;case _t:{let r=W(e.tribe1).sort(),n=W(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case qe:Dt(e.clause,t);break;case Ye:case He:case Xe:for(let r of e.clauses)Dt(r,t);break}}function Ae(e,t,r){switch(e.kind){case De:return"false";case Oe:{let n=W(e.tribes);return n.length===0?"false":n.length===A.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case Ne:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case $e:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case We:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case Ke:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case ze:{let n=W(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case _t:{let n=r.get(W(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),o=`(i32(${r.get(W(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${o})`;case">":return`(i32(${n}) > ${o})`;case"<":return`(i32(${n}) < ${o})`;case"\u2265":return`(i32(${n}) >= ${o})`;case"\u2264":return`(i32(${n}) <= ${o})`;default:return`(i32(${n}) == ${o})`}}case qe:return`!(${Ae(e.clause,t,r)})`;case Ye:return`(${e.clauses.map(i=>Ae(i,t,r)).join(" && ")})`;case He:return`(${e.clauses.map(i=>Ae(i,t,r)).join(" || ")})`;case Xe:return`(((${e.clauses.map(o=>Ae(o,t,r)).map(o=>`select(0u, 1u, ${o})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var er=48;function Ot(){Ge?.destroy(),Ge=s.createBuffer({size:er,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function yn(){let e=new ArrayBuffer(er),t=new Float32Array(e),r=new Uint32Array(e);t[0]=ue.width,t[1]=ue.height,t[2]=_,t[3]=y,t[4]=Er,t[6]=Br,t[7]=Pr,r[8]=A.length,s.queue.writeBuffer(Ge,0,e)}function mt(){return we({cols:_,rows:y},p)}function re(){return xe(p)}async function Nt(){let e=mt();v=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ct(e,v),R=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ct(e,R);let t=s.createCommandEncoder();t.clearBuffer(v),t.clearBuffer(R),s.queue.submit([t.finish()]),M=!1}function $t(){let e=new Uint32Array(Zt);for(let t=0;t<A.length;t++){let r=A[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),o=parseInt(r.substring(4,6),16);e[t]=n|i<<8|o<<16}ce&&ce.destroy(),ce=s.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(ce,0,e)}function Cn(){return sr.replace("__CELLS_PER_WORD__",`${p.cellsPerWord}u`).replace("__WORD_SHIFT__",`${p.wordShift}u`).replace("__CELL_SHIFT__",`${p.cellShift}u`).replace("__CELL_INDEX_MASK__",`${p.cellIndexMask}u`).replace("__CELL_MASK__",`${p.cellMask}u`)}function Wt(){let e=s.createShaderModule({code:Cn()});ut=s.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:At}]},primitive:{topology:"triangle-list"}})}function Kt(){_r=s.createBindGroup({layout:ut.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ge}},{binding:1,resource:{buffer:v}},{binding:2,resource:{buffer:ce}}]}),Sr=s.createBindGroup({layout:ut.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ge}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:ce}}]})}function zt(){let e=gn(),t=s.createShaderModule({code:e});Me=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),Xt=s.createBindGroup({layout:Me.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:R}}]}),jt=s.createBindGroup({layout:Me.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:v}}]})}function _n(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = ${_}u;
const ROWS: u32 = ${y}u;
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
`}function Sn(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${_}u;
const ROWS: u32 = ${y}u;
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
`}function qt(){let e=s.createShaderModule({code:_n()});Je=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),ge=s.createBuffer({size:Lt,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),me=s.createBuffer({size:Lt,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),wr=s.createBindGroup({layout:Je.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:ge}}]}),kr=s.createBindGroup({layout:Je.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:ge}}]});let t=s.createShaderModule({code:Sn()});et=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),be=s.createBuffer({size:It,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),he=s.createBuffer({size:It,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Ar=s.createBindGroup({layout:et.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:be}}]}),Mr=s.createBindGroup({layout:et.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:be}}]})}var tr=176;function En(){return`
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
`}function Yt(){let e=s.createShaderModule({code:En()});Ve=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),fe?.destroy(),fe=s.createBuffer({size:tr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),xr=s.createBindGroup({layout:Ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:fe}}]}),Tr=s.createBindGroup({layout:Ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:fe}}]})}function Bn(e,t,r,n,i,o,l){let c=J.get(Ue)??0,d=rn++,f=new ArrayBuffer(tr),u=new Int32Array(f),a=new Uint32Array(f);u[0]=t,u[1]=r,a[2]=_,a[3]=y,a[4]=n,a[5]=i,a[6]=o,a[7]=c,a[8]=d,a[9]=l.length,a[10]=0;for(let I=0;I<l.length&&I<32;I++)a[11+I]=l[I];s.queue.writeBuffer(fe,0,f);let g=Math.ceil(n/8),T=e.beginComputePass();T.setPipeline(Ve),T.setBindGroup(0,M?Tr:xr),T.dispatchWorkgroups(g,g),T.end()}function Pn(){let e=M?R:v,t=mt(),r;try{r=s.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder();return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function Ur(){if(m=mt(),!te()){S=0;return}let e=xn();S=Math.max(1,Math.floor(e/m))}function xn(){return m>=lr?m:Math.min(Math.max(lr,m),Qt())}function Dr(){if(S<1||m<=0)return ur;let e=Math.max(m,S*m),t=Math.floor(sn/e);return Math.max(1,Math.min(ur,t||1))}function Ht(){let e=te();self.postMessage({type:"limits",maxBytes:Ee(),vramBudgetBytes:Lr(),frameByteSize:m,recordingAvailable:e,vramSimulationBytes:ln(),vramRecordingBytes:cn(),gridFormat:re()})}function Ce(){return!te()||S<1||L===null||V.length===0||oe>=Dr()?!1:b<S?!0:V.some((e,t)=>z[t]&&e.mapState==="unmapped")}function _e(e){if(S<1||L===null||b>=S)return;let t=M?R:v,r=b*m,n=s.createCommandEncoder();n.copyBufferToBuffer(t,0,L,r,m),s.queue.submit([n.finish()]),x.push(e),b++}function Se(){if(L===null||b===0||V.length===0)return;let e=z.indexOf(!0);if(e<0)return;z[e]=!1;let t=V[e];if(t.mapState!=="unmapped"){z[e]=!0;return}let r=b*m,n=vr++,i=[...x],o=i[0],l=i[i.length-1],c=`chunk-${String(n).padStart(6,"0")}.bin`,d=b,f=s.createCommandEncoder();f.copyBufferToBuffer(L,0,t,0,r),s.queue.submit([f.finish()]);let u={chunkId:n,generationStart:o,generationEnd:l,blockCount:d,codec:gt,uncompressedBytes:r,storedBytes:r,gridFormat:re(),generations:i,filename:c};wt(1),oe++,de();let a=ke;t.mapAsync(GPUMapMode.READ).then(async()=>{let g=t.getMappedRange(),T=new ArrayBuffer(r);new Uint8Array(T).set(new Uint8Array(g,0,r)),t.unmap(),a===ke&&(z[e]=!0,de(),h.push(u),rr(),Tn(u,T).then(()=>{a===ke&&(oe--,de(),wt(-1),pe(),self.postMessage({type:"chunkSealed",filename:u.filename,rawBytes:r,blockCount:u.blockCount,cols:_,rows:y,rawGridFormat:u.gridFormat,storageGridFormat:xe(Bt(Fe.tribes.length))}),Le&&Z===0&&(Le=!1,Nr()))}))}).catch(()=>{a===ke&&(z[e]=!0,oe--,de(),wt(-1))}),b=0,x=[]}function rr(){h.length>0&&(Y.generationStart=h[0].generationStart,Y.generationEnd=h[h.length-1].generationEnd),x.length>0&&(h.length===0&&(Y.generationStart=x[0]),Y.generationEnd=x[x.length-1]),Y.chunks=[...h]}async function mr(e){ke++,vr=0,b=0,x=[],h=[],oe=0,Z>0&&(Z=0,self.postMessage({type:"chunksSaving",active:!1})),P&&(P=!1,self.postMessage({type:"backpressure",active:!1})),Le=!1,H=B,Y={chunks:[],generationStart:e,generationEnd:e,gridFormat:re()},await Or(),pe()}async function nr(){return ne&&await ne,ve||(ve=await(await navigator.storage.getDirectory()).getDirectoryHandle(nt,{create:!0})),ve}async function Tn(e,t){let i=await(await(await nr()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function wn(e){let t=await nr();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function Or(){if(ne){await ne;return}ne=(async()=>{let e=await navigator.storage.getDirectory();ve=null;try{await e.removeEntry(nt,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${nt}:`,t)}ve=await e.getDirectoryHandle(nt,{create:!0})})();try{await ne}finally{ne=null}}function Nr(){rr(),self.postMessage({type:"recording",manifest:{chunks:h.map(e=>({...e,generations:[...e.generations]})),generationStart:Y.generationStart,generationEnd:Y.generationEnd,gridFormat:re()},cols:_,rows:y})}function kn(){return b>0?x[b-1]!==C:h.length>0?h[h.length-1].generationEnd!==C:!0}function ot(e=!1){if(B){if(e){if(H){if(!Ce())return;H=!1}}else if(H)return;!kn()||!Ce()||(b>=S&&Se(),_e(C))}}function $r(){if(!Qe)return;let e=Qe;Qe=null;let t=s.createCommandEncoder();Bn(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),B&&b>0&&x[b-1]===C&&(b--,x.pop(),_e(C))}async function An(e,t=gt){let o=await(await(await(await nr()).getFileHandle(e)).getFile()).arrayBuffer();return t===Fr?fn(o):o}function br(){let e=b;for(let t of h)e+=t.blockCount;return e}function U(e){let t=Math.ceil(_/16),r=Math.ceil(y/16),n=new Uint32Array(256);s.queue.writeBuffer(ge,0,n);let i=e.beginComputePass();i.setPipeline(Je),i.setBindGroup(0,M?kr:wr),i.dispatchWorkgroups(t,r),i.end(),e.copyBufferToBuffer(ge,0,me,0,256*4);let o=new Uint32Array([0]);s.queue.writeBuffer(be,0,o);let l=e.beginComputePass();l.setPipeline(et),l.setBindGroup(0,M?Mr:Ar),l.dispatchWorkgroups(t,r),l.end(),e.copyBufferToBuffer(be,0,he,0,4)}function D(){let e=C;if(e===K||k)return;K=e,k=!0;let t=[];t.push(me.mapAsync(GPUMapMode.READ)),t.push(he.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=J.get(Ue)??0,n={},i=0,o=0,l={},c=new Uint32Array(me.getMappedRange().slice(0));me.unmap();let d=0;for(let a=0;a<A.length;a++){let g=c[a]??0;n[A[a].id]=g,a!==r&&(d+=g,g>0&&(Mt.set(a,e),vt.add(a)))}if(d>0)for(let a=0;a<A.length;a++){if(a===r)continue;let g=(c[a]??0)/d;g>0&&(i-=g*Math.log2(g),o+=g*g)}for(let a=0;a<A.length;a++){if(a===r)continue;(c[a]??0)>0?l[A[a].id]=null:vt.has(a)?l[A[a].id]=Mt.get(a)??0:l[A[a].id]=0}let f=new Uint32Array(he.getMappedRange().slice(0));he.unmap();let u=f[0]??0;if(k=!1,self.postMessage({type:"metrics",generation:e,population:n,shannonEntropy:i,simpsonIndex:1-o,boundaryLength:u,extinctionTime:l,totalFrames:br(),fps:Jt,canStepBack:br()>1,recordingBytes:h.reduce((a,g)=>a+g.storedBytes,0),recordingRawBytes:h.reduce((a,g)=>a+g.uncompressedBytes,0)}),$){$=!1,K=-1;let a=s.createCommandEncoder();U(a),s.queue.submit([a.finish()]),D()}}).catch(()=>{k=!1})}function hr(){let e=_*y;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function Mn(){let e=_*y;return e>1e7?2:e>1e6?4:e>1e5?8:16}function yr(e){if(e<=0)return;let t=Math.ceil(dt/16),r=Math.ceil(y/16),n=s.createCommandEncoder();for(let i=0;i<e;i++){let o=n.beginComputePass();o.setPipeline(Me),o.setBindGroup(0,M?jt:Xt),o.dispatchWorkgroups(t,r),o.end(),M=!M,C++}s.queue.submit([n.finish()]),se+=e}function Ze(){self.postMessage({type:"generation",generation:C,fps:Jt})}function at(){let e=s.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(Me),t.setBindGroup(0,M?jt:Xt);let r=Math.ceil(dt/16),n=Math.ceil(y/16);t.dispatchWorkgroups(r,n),t.end(),s.queue.submit([e.finish()]),M=!M,C++}function ie(){yn();let e=kt.getCurrentTexture().createView(),t=s.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(ut),r.setBindGroup(0,M?Sr:_r),r.draw(3),r.end(),s.queue.submit([t.finish()])}function q(e){if(ee||ae){self.requestAnimationFrame(q);return}je===0&&(je=e);let t=e-je;if(t>=1e3&&(Jt=se/(t/1e3),se=0,je=e),O>=0){if(B){let n=!1,i=performance.now()+14;for(;C<O&&performance.now()<i;){if(!Ce()){n=!0;break}b>=S&&Se(),at(),se++,_e(C)}if(n){P||(P=!0,self.postMessage({type:"backpressure",active:!0})),e-N>=1e3&&(N=e,Ze()),s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(q)});return}P&&(P=!1,self.postMessage({type:"backpressure",active:!1}))}else{let n=Math.min(hr(),O-C);yr(n)}if(e-N>=1e3&&(N=e,Ze()),C>=O){if(O=-1,G=Rt,w=tt,j=0,X=0,N=0,P&&(P=!1,self.postMessage({type:"backpressure",active:!1})),K=-1,k)$=!0;else{let n=s.createCommandEncoder();U(n),s.queue.submit([n.finish()]),D()}ie(),self.postMessage({type:"stepping",active:!1}),self.requestAnimationFrame(q)}else B?self.requestAnimationFrame(q):s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(q)});return}$r();let r=!1;if(G){ot(!0);let n=!1;j===0&&(j=e);let i=e-j;if(j=e,w<=0){if(B){let o=!1,l=performance.now()+14;for(;performance.now()<l;){if(!Ce()){o=!0;break}b>=S&&Se(),at(),se++,n=!0,_e(C)}if(o){if(P||(P=!0,self.postMessage({type:"backpressure",active:!0})),e-N>=1e3&&(N=e,Ze()),n&&(e-le>=1e3||le===0)&&!k){le=e;let d=s.createCommandEncoder();U(d),s.queue.submit([d.finish()]),D()}s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(q)});return}P&&(P=!1,self.postMessage({type:"backpressure",active:!1}))}else if(!ye){let o=hr(),l=Mn();for(let c=0;c<l;c++)yr(o),n=!0;ye=!0,s.queue.onSubmittedWorkDone().then(()=>{ye=!1,Rr()?Gt():rt()})}e-N>=1e3&&(N=e,Ze())}else for(X+=i;X>=w;){if(B){if(!Ce())break;b>=S&&Se()}at(),se++,X-=w,n=!0,B&&_e(C)}n&&(r=(e-le>=1e3||le===0)&&!k)}if(w>0&&!Ft&&ie(),r){le=e;let n=s.createCommandEncoder();U(n),s.queue.submit([n.finish()]),D()}w<=0&&!B&&G||self.requestAnimationFrame(q)}function vn(e,t){let r=s?Ee():Number.POSITIVE_INFINITY;return ir(t.bitsPerCell)&&St(t.bitsPerCell,e.tribes.length)&&Et(e,Pe(t.bitsPerCell),r)?Pe(t.bitsPerCell):or(e.tribes.length,e,r)}function Cr(e,t){Fe=e,_=e.cols,y=e.rows,p=vn(e,t),dt=Te(_,p),A=[...e.tribes],Y.gridFormat=re(),J.clear(),A.forEach((r,n)=>J.set(r.id,n))}async function Wr(e){ue=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");s=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),ae=!1,s.lost.then(n=>{let i=n.message||n.reason||"unknown";ae=!0,G=!1,ee=!0,self.postMessage({type:"deviceLost",reason:i})}),self.postMessage({type:"limits",maxBytes:Ee(),vramBudgetBytes:Lr(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:re()});let r=ue.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");kt=r,At=navigator.gpu.getPreferredCanvasFormat(),kt.configure({device:s,format:At,alphaMode:"opaque"})}async function Rn(){try{return await Wr(ue),!0}catch(e){let t=e instanceof Error?e.message:String(e);return ae=!0,G=!1,ee=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function Kr(){L=s.createBuffer({size:S*m,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ct(S*m,L),b=0,x=[]}async function zr(){let e=S*m;V=[],z=[];for(let t=0;t<pt;t++){let r=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});V.push(r),z.push(!0),await ct(e,r)}}async function Fn(){await Or()}async function Gn(){Ot(),Ur(),await Nt(),$t(),Wt(),Kt(),zt(),Yt(),qt(),await Fn(),te()?(await Kr(),await zr()):(ft(),B=!1,H=!1),await lt(),Ht()}async function Ln(){ee=!0,self.postMessage({type:"rebuilding",active:!0});try{await Vt()}catch{}if(ae&&!await Rn())return!1;dr(),Ot(),Ur(),fr(te());try{await Nt(),$t(),Wt(),zt(),Yt(),Kt(),qt(),te()?(await Kr(),await zr()):(ft(),B=!1,H=!1),await lt(),Ht()}catch(e){let t=e instanceof Error?e.message:String(e);self.postMessage({type:"gpuError",reason:t});try{dr(),Ot(),fr(!1),await Nt(),$t(),Wt(),zt(),Yt(),Kt(),qt(),B=!1,H=!1,m=mt(),ft(),await lt(),Ht()}catch(r){return console.warn("GPU recovery also failed, device may be lost:",r),!1}}return ee=!1,self.postMessage({type:"rebuilding",active:!1}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(B=t.recording,H=B,Cr(t.ruleset,t.simulationGridFormat),await Wr(t.canvas),await Gn(),k)$=!0;else{let r=s.createCommandEncoder();U(r),s.queue.submit([r.finish()]),D()}pe(),G=t.running,w=t.speed<0?0:1e3/t.speed,j=0,X=0,self.requestAnimationFrame(q);break}case"setRuleset":{if(Cr(t.ruleset,t.simulationGridFormat),!await Ln())break;if(C=0,K=-1,await mr(0),Mt=new Map,vt=new Set,k)$=!0;else{let n=s.createCommandEncoder();U(n),s.queue.submit([n.finish()]),D()}break}case"setRunning":if(!t.running&&O>=0){if(O=-1,G=!1,w=tt,j=0,X=0,P&&de(),K=-1,k)$=!0;else{let r=s.createCommandEncoder();U(r),s.queue.submit([r.finish()]),D()}ie(),self.postMessage({type:"stepping",active:!1});break}if(G=t.running,t.running)j=0,X=0,Gt();else{if(P&&de(),K=-1,k)$=!0;else{let r=s.createCommandEncoder();U(r),s.queue.submit([r.finish()]),D()}w<=0&&!B&&O<0&&!ye&&rt()}break;case"setSpeed":{let r=w<=0,n=t.speed<0?0:1e3/t.speed;r&&n>0&&(Ft=!0,s.queue.onSubmittedWorkDone().then(()=>{Ft=!1,ie(),rt()})),w=n,X=0,N=0,!r&&n<=0?Gt():r&&n>0&&!ye&&rt();break}case"camera":Er=t.scale,Br=t.offsetX,Pr=t.offsetY;break;case"resize":ue.width=t.width,ue.height=t.height;break;case"draw":{let r=t.tribes.map(n=>J.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};Qe={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{Pn().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:C,cols:_,rows:y,gridFormat:re()})}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:C,cols:_,rows:y,gridFormat:re()})});break}case"loadSnapshot":{let r=M?R:v,n=Pt(t.gridFormat),i=we({cols:_,rows:y},n);if(t.grid.byteLength!==i)break;let o=n.bitsPerCell===p.bitsPerCell?t.grid:xt(Tt(t.grid,{cols:_,rows:y},n),{cols:_,rows:y},p);s.queue.writeBuffer(r,0,o),C=t.generation,await mr(t.generation);break}case"setRecording":{if(t.recording&&te()&&!B){if(B=!0,H=!0,K=-1,k)$=!0;else{let r=s.createCommandEncoder();U(r),s.queue.submit([r.finish()]),D()}pe()}else(!t.recording||!te())&&(B=!1,H=!1);break}case"getRecording":{if(Le)break;await Vt(),ot(!1),b>0&&Se(),Z>0?Le=!0:Nr();break}case"stepBack":{let r=0;for(let c of h)r+=c.blockCount;let n=r+b,i=Math.min(t.count,n-1);if(i<=0)break;let o=n-1-i,l=M?R:v;if(o>=r){let c=o-r;b=c+1,x.length=b,C=x[c];let d=s.createCommandEncoder();d.copyBufferToBuffer(L,c*m,l,0,m),s.queue.submit([d.finish()])}else{if(Z>0){await new Promise(E=>{let F=setInterval(()=>{Z===0&&(clearInterval(F),E())},10)}),r=0;for(let E of h)r+=E.blockCount}let c=0,d=0,f=0;for(let E=0;E<h.length;E++){let F=h[E];if(o<c+F.blockCount){d=E,f=o-c;break}c+=F.blockCount}let u=h[d],a=await An(u.filename,u.codec),g=Pt(u.gridFormat),T=we({cols:_,rows:y},g);if(g.bitsPerCell===p.bitsPerCell){let E=(f+1)*m;s.queue.writeBuffer(L,0,new Uint8Array(a,0,E))}else{let E=new Uint8Array((f+1)*m);for(let F=0;F<=f;F++){let qr=F*T,Yr=new Uint8Array(a,qr,T),Hr=ar(Yr,{cols:_,rows:y},g),bt=xt(Hr,{cols:_,rows:y},p);E.set(new Uint8Array(bt.buffer,bt.byteOffset,bt.byteLength),F*m)}s.queue.writeBuffer(L,0,E),s.queue.writeBuffer(l,0,E.subarray(f*m,(f+1)*m))}if(b=f+1,x=u.generations.slice(0,f+1),C=x[f],g.bitsPerCell===p.bitsPerCell){let E=s.createCommandEncoder();E.copyBufferToBuffer(L,f*m,l,0,m),s.queue.submit([E.finish()])}let Be=h.splice(d).map(E=>E.filename);wn(Be)}if(rr(),pe(),K=-1,k)$=!0;else{let c=s.createCommandEncoder();U(c),s.queue.submit([c.finish()]),D()}ie();break}case"stepForward":{if($r(),t.count===1){if(ot(!0),at(),se++,B&&Ce()&&(b>=S&&Se(),_e(C)),K=-1,k)$=!0;else{let r=s.createCommandEncoder();U(r),s.queue.submit([r.finish()]),D()}ie()}else self.postMessage({type:"stepping",active:!0}),ot(!0),Rt=G,tt=w,O=C+t.count,G=!0,w=0,N=0;break}case"cancelStepping":{if(O>=0){if(O=-1,G=Rt,w=tt,j=0,X=0,K=-1,k)$=!0;else{let r=s.createCommandEncoder();U(r),s.queue.submit([r.finish()]),D()}ie(),self.postMessage({type:"stepping",active:!1})}break}case"updateChunkCodec":{let r=h.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,Y.chunks=[...h],pe());break}case"getUncompressedChunks":{let r=h.filter(n=>n.codec===gt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:_,rows:y,rawGridFormat:n.gridFormat,storageGridFormat:xe(Bt(Fe.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
