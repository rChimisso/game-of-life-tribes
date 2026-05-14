var dr=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var yt=[1,2,4,8,16,32],an={bitsPerCell:1,cellsPerWord:32,wordShift:5,cellShift:0,cellIndexMask:31,cellMask:1},un={bitsPerCell:2,cellsPerWord:16,wordShift:4,cellShift:1,cellIndexMask:15,cellMask:3},cn={bitsPerCell:4,cellsPerWord:8,wordShift:3,cellShift:2,cellIndexMask:7,cellMask:15},Oe={bitsPerCell:8,cellsPerWord:4,wordShift:2,cellShift:3,cellIndexMask:3,cellMask:255},ln={bitsPerCell:16,cellsPerWord:2,wordShift:1,cellShift:4,cellIndexMask:1,cellMask:65535},Ct={bitsPerCell:32,cellsPerWord:1,wordShift:0,cellShift:5,cellIndexMask:0,cellMask:4294967295},Y={1:an,2:un,4:cn,8:Oe,16:ln,32:Ct};var St="any",We="dead";var Ne="empty",$e="is",Pt="comparison",Ke="count",ze="none",Xe="exactly",qe="min",Ye="max",He="not",je="and",Ve="or",Ze="xor";function fr(e){return yt.includes(e)}function dn(e){return 2**e}function Rt(e,t){return t<=dn(e)}function Bt(e,t,r){return Re(e,t)<=r}function Et(e){return e<=2?Y[1]:e<=4?Y[2]:e<=16?Y[4]:e<=256?Y[8]:e<=65536?Y[16]:Y[32]}function Ce(e){return Y[e]}function pr(e,t={cols:3,rows:3},r=Number.POSITIVE_INFINITY){for(let n of yt){let i=Ce(n);if(Rt(n,e)&&Bt(t,i,r))return i}return Ct}function xt(e){return Ce(e?.bitsPerCell??8)}function Se(e){return{bitsPerCell:e.bitsPerCell}}function Pe(e,t){return Math.ceil(e/t.cellsPerWord)}function Re(e,t){return Pe(e.cols,t)*e.rows*Uint32Array.BYTES_PER_ELEMENT}function fn(e){if(e.byteOffset%Uint32Array.BYTES_PER_ELEMENT===0)return new Uint32Array(e.buffer,e.byteOffset,e.byteLength/Uint32Array.BYTES_PER_ELEMENT);let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),new Uint32Array(t)}function Tt(e,t,r){let n=Pe(t.cols,r),i=new Uint32Array(n*t.rows);for(let a=0;a<t.rows;a++)for(let u=0;u<n;u++){let d=u*r.cellsPerWord,g=0;for(let l=0;l<r.cellsPerWord&&d+l<t.cols;l++){let P=e[a*t.cols+d+l]&r.cellMask;g|=P<<(l<<r.cellShift)}i[a*n+u]=g>>>0}return i}function kt(e,t,r){let n=Pe(t.cols,r),i=new Uint8Array(t.cols*t.rows);for(let a=0;a<t.rows;a++)for(let u=0;u<n;u++){let d=e[a*n+u],g=u*r.cellsPerWord;for(let l=0;l<r.cellsPerWord&&g+l<t.cols;l++)i[a*t.cols+g+l]=d>>>(l<<r.cellShift)&r.cellMask}return i}function gr(e,t,r){return kt(fn(e),t,r)}var s,K=!1,Gt,wt,ae,we,h=0,_=0,jt=0,f=Oe,T=[],J=new Map,dt,ft,G,w,Me,ce,ot,xr,Tr,ke,Vt,Zt,k=!1,kr=1,Ar=0,vr=0,x=!1,W=!1,V=100,S=0,Je,le,Gr,wr,gn=0,et=null,tt,Mr,Lr,pe,ge,rt,Ir,Fr,me,be,Z=-1,U=!1,j=!1,At=0,Mt=new Map,Lt=new Set,v=!1,$=!1,N={chunks:[],generationStart:0,generationEnd:0,gridFormat:Se(Oe)},Dr=0,y=[],b=null,Ur=0,Be=!1,L=null,m=0,E=[],R=64,p=0,pt=3,X=[],O=[],nt="gol-recording",gt="raw-packed",Or="deflate-raw",Ae=null,ne=null,z=0,oe=0,mr=12,M=!1,Ee=0,Qt=256,mn=Qt*Uint32Array.BYTES_PER_ELEMENT,It=Qt*Uint32Array.BYTES_PER_ELEMENT,Ft=Uint32Array.BYTES_PER_ELEMENT,br=256*1024*1024,bn=512*1024*1024,hn=512*1024*1024,hr=128*1024*1024*1024,it=0,st=0,ve=[];function _n(e){return e instanceof Error?e.message:typeof e=="string"?e:e&&typeof e=="object"&&"message"in e&&typeof e.message=="string"?e.message:String(e??"Unknown worker error")}function Wr(e){A("error",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),x=!1,self.postMessage({type:"gpuError",reason:_n(e)})}self.addEventListener("error",e=>{e.preventDefault(),Wr(e.error??e.message)});self.addEventListener("unhandledrejection",e=>{e.preventDefault(),Wr(e.reason)});async function Jt(){await s.queue.onSubmittedWorkDone()}function _r(e){it=0,st=2+(e?1+pt:0),ve=[]}async function at(){if(ve.length===0)return;let e=s.createCommandEncoder();for(let t of ve)e.clearBuffer(t);s.queue.submit([e.finish()]),await Jt(),ve=[]}async function ut(e,t){!W||st<=0||(it+=e,st--,ve.push(t),it>=yn()&&st>0&&(await at(),it=0))}function yn(){return Math.min(_e(),hn)}function _e(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function er(){return Math.min(_e(),1073741824)}function Nr(){return Math.max(_e()*2,er()*6)}function q(){return p>0&&p<=er()}function Cn(){return p<=0?0:p*2+rr+mn+nr+It*2+Ft*2}function Sn(){return R<1||p<=0?0:R*p*(1+pt)}function ct(){L?.destroy(),L=null;for(let e of X)e?.destroy();X=[],O=[],R=0,m=0,E=[]}function yr(){G?.destroy(),w?.destroy(),pe?.destroy(),ge?.destroy(),me?.destroy(),be?.destroy(),le?.destroy(),ct()}function vt(e){let t=z>0;z+=e;let r=z>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function de(){if(R<1||X.length===0){M&&(M=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=Xr(),t=!O.some(i=>i)&&m>=R,r=oe>=e,n;if(M){let i=O.some(u=>u),a=oe<=Math.floor(e/2);n=!(i&&a)}else n=t||r;n!==M&&(M=n,self.postMessage({type:"backpressure",active:n}))}async function fe(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??hr/128,hr),r=e.usage??0,n=0,i=0;for(let d of y)d.codec===gt?n+=d.storedBytes:i+=d.storedBytes;let a=R*p,u=v?(1+pt)*a:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:u})}var Le=!1;async function Pn(e){let t=new DecompressionStream(Or),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:g,value:l}=await i.read();if(g)break;n.push(l)}let a=0;for(let g of n)a+=g.byteLength;let u=new Uint8Array(a),d=0;for(let g of n)u.set(g,d),d+=g.byteLength;return u.buffer}var he=0,Qe=0,tr=0;function $r(e,t,r=s.limits.maxComputeWorkgroupsPerDimension){if(e<=r&&t<=r)return{logicalWgX:e,logicalWgY:t,dispatchWgX:e,dispatchWgY:t,remapped:!1};let n=e*t,i=Math.min(n,r),a=Math.ceil(n/i);if(a>r)throw new Error(`Grid requires ${e}x${t} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${r}.`);return{logicalWgX:e,logicalWgY:t,dispatchWgX:i,dispatchWgY:a,remapped:!0}}function Rn(){return $r(Math.ceil(jt/16),Math.ceil(_/16))}function Bn(){return $r(Math.ceil(h/16),Math.ceil(_/16))}function En(e,t){t.remapped&&(e.push(`const LOGICAL_WG_X: u32 = ${t.logicalWgX}u;`),e.push(`const DISPATCH_WG_X: u32 = ${t.dispatchWgX}u;`))}function xn(e){e.push(`const CELLS_PER_WORD: u32 = ${f.cellsPerWord}u;`),e.push(`const WORD_SHIFT: u32 = ${f.wordShift}u;`),e.push(`const CELL_SHIFT: u32 = ${f.cellShift}u;`),e.push(`const CELL_INDEX_MASK: u32 = ${f.cellIndexMask}u;`),e.push(`const CELL_MASK: u32 = ${f.cellMask}u;`)}function Tn(e,t,r){e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push(`  let wordIdx = y * ${r} + (x >> WORD_SHIFT);`),e.push("  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;"),e.push(`  return (${t}[wordIdx] >> shift) & CELL_MASK;`),e.push("}")}function kn(e,t,r){if(t.remapped){e.push("  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;"),e.push("  let logicalWgX = flatWg % LOGICAL_WG_X;"),e.push("  let logicalWgY = flatWg / LOGICAL_WG_X;"),e.push(""),e.push(`  let ${r} = logicalWgX * 16u + local_invocation_id.x;`),e.push("  let y = logicalWgY * 16u + local_invocation_id.y;");return}e.push(`  let ${r} = gid.x;`),e.push("  let y = gid.y;")}function An(){let e=[],t=jt,r=dt;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${T.map(o=>o.id).join(", ")}`),e.push(`// Rules: ${we.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${h}u;`),e.push(`const ROWS: u32 = ${_}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),En(e,r),xn(e),e.push(""),Tn(e,"gridIn","PACKED_COLS"),e.push("");let n=J.get(We)??0,i=we.rules.filter(o=>!o.muted);e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let a=Gn(i.map(o=>o.clause)),u=new Map,d=0;for(let o of a){let c=`count_${d++}`;u.set(o,c)}for(let[o,c]of u){let B=o.split(",").map(Number),re=Cr().map(C=>`select(0u, 1u, ${B.map(ye=>`${C} == ${ye}u`).join(" || ")})`);e.push(`  let ${c} = ${re.join(" + ")};`)}a.size>0&&e.push("");let g=wn(i.map(o=>o.clause)),l=new Map,P=0;for(let o of g)if(u.has(o))l.set(o,u.get(o));else{let c=`eq_count_${P++}`;l.set(o,c)}for(let[o,c]of l){if(u.has(o))continue;let B=o.split(",").map(Number),re=Cr().map(C=>`select(0u, 1u, ${B.map(ye=>`${C} == ${ye}u`).join(" || ")})`);e.push(`  let ${c} = ${re.join(" + ")};`)}g.size>0&&P>0&&e.push(""),e.push(`  var result: u32 = ${n}u;`),e.push("");for(let o=0;o<i.length;o++){let c=i[o],B=xe(c.clause,u,l),I=vn(c.tribe);o===0?e.push(`  if (${B}) {`):e.push(`  } else if (${B}) {`),e.push(`    result = ${I}u;`)}i.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),r.remapped?e.push("fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {"):e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),kn(e,r,"px"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px << WORD_SHIFT;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let o=-1;o<=1;o++)for(let c=-1;c<=1;c++){if(c===0&&o===0)continue;let B=Kr(c,o),I=Sr("x",c,"COLS"),re=Sr("y",o,"ROWS");e.push(`    let ${B} = readCell(${I}, ${re});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function Kr(e,t){let r="C";e===-1?r="L":e===1&&(r="R");let n="C";return t===-1?n="T":t===1&&(n="B"),`n${n}${r}`}function Cr(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(Kr(r,t));return e}function Sr(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function D(e){let t=[];for(let r of e)if(r===St)for(let n=0;n<T.length;n++)t.push(n);else{let n=J.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function vn(e){return e===St?0:J.get(e)??0}function Gn(e){let t=new Set;for(let r of e)Dt(r,t);return t}function Dt(e,t){switch(e.kind){case Ne:case $e:break;case ze:case Xe:case qe:case Ye:case Ke:{let r=D(e.tribes).sort();t.add(r.join(","));break}case He:Dt(e.clause,t);break;case je:case Ve:case Ze:for(let r of e.clauses)Dt(r,t);break}}function wn(e){let t=new Set;for(let r of e)Ut(r,t);return t}function Ut(e,t){switch(e.kind){case Ne:case $e:case Ke:case ze:case Xe:case qe:case Ye:break;case Pt:{let r=D(e.tribe1).sort(),n=D(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case He:Ut(e.clause,t);break;case je:case Ve:case Ze:for(let r of e.clauses)Ut(r,t);break}}function xe(e,t,r){switch(e.kind){case Ne:return"false";case $e:{let n=D(e.tribes);return n.length===0?"false":n.length===T.length?"true":`(${n.map(a=>`selfTribe == ${a}u`).join(" || ")})`}case Ke:{let n=D(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case ze:{let n=D(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= 0u)`}case Xe:{let n=D(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= ${e.value}u)`}case qe:{let n=D(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.value}u && ${i} <= 8u)`}case Ye:{let n=D(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= 0u && ${i} <= ${e.value}u)`}case Pt:{let n=r.get(D(e.tribe1).sort().join(",")),i=Math.max(-8,Math.min(8,e.margin??0)),a=`(i32(${r.get(D(e.tribe2).sort().join(","))}) + ${i}i)`;switch(e.operator){case"\u2260":return`(i32(${n}) != ${a})`;case">":return`(i32(${n}) > ${a})`;case"<":return`(i32(${n}) < ${a})`;case"\u2265":return`(i32(${n}) >= ${a})`;case"\u2264":return`(i32(${n}) <= ${a})`;default:return`(i32(${n}) == ${a})`}}case He:return`!(${xe(e.clause,t,r)})`;case je:return`(${e.clauses.map(i=>xe(i,t,r)).join(" && ")})`;case Ve:return`(${e.clauses.map(i=>xe(i,t,r)).join(" || ")})`;case Ze:return`(((${e.clauses.map(a=>xe(a,t,r)).map(a=>`select(0u, 1u, ${a})`).join(" + ")}) & 1u) == 1u)`;default:return"false"}}var rr=48;function Ot(){Me?.destroy(),Me=s.createBuffer({size:rr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Mn(){let e=new ArrayBuffer(rr),t=new Float32Array(e),r=new Uint32Array(e),n=(Ar%h+h)%h,i=(vr%_+_)%_,a=Math.floor(n),u=Math.floor(i);t[0]=ae.width,t[1]=ae.height,t[2]=kr,t[4]=n-a,t[5]=i-u,r[6]=h,r[7]=_,r[8]=a,r[9]=u,r[10]=T.length,s.queue.writeBuffer(Me,0,e)}function mt(){return Re({cols:h,rows:_},f)}function ee(){return Se(f)}async function Wt(){let e=mt();G=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ut(e,G),w=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ut(e,w);let t=s.createCommandEncoder();t.clearBuffer(G),t.clearBuffer(w),s.queue.submit([t.finish()]),k=!1}function Nt(){let e=new Uint32Array(Qt);for(let t=0;t<T.length;t++){let r=T[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),a=parseInt(r.substring(4,6),16);e[t]=n|i<<8|a<<16}ce&&ce.destroy(),ce=s.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(ce,0,e)}function Ln(){return dr.replace("__CELLS_PER_WORD__",`${f.cellsPerWord}u`).replace("__WORD_SHIFT__",`${f.wordShift}u`).replace("__CELL_SHIFT__",`${f.cellShift}u`).replace("__CELL_INDEX_MASK__",`${f.cellIndexMask}u`).replace("__CELL_MASK__",`${f.cellMask}u`)}function $t(){let e=s.createShaderModule({code:Ln()});ot=s.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:wt}]},primitive:{topology:"triangle-list"}})}function Kt(){xr=s.createBindGroup({layout:ot.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Me}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:ce}}]}),Tr=s.createBindGroup({layout:ot.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Me}},{binding:1,resource:{buffer:w}},{binding:2,resource:{buffer:ce}}]})}function zt(){dt=Rn();let e=An(),t=s.createShaderModule({code:e});ke=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),Vt=s.createBindGroup({layout:ke.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:w}}]}),Zt=s.createBindGroup({layout:ke.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:G}}]})}function In(){let e=ft,t=e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:"",r=e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`,n=e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`;return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = ${h}u;
const ROWS: u32 = ${_}u;
const CELLS_PER_WORD: u32 = ${f.cellsPerWord}u;
const WORD_SHIFT: u32 = ${f.wordShift}u;
const CELL_SHIFT: u32 = ${f.cellShift}u;
const CELL_INDEX_MASK: u32 = ${f.cellIndexMask}u;
const CELL_MASK: u32 = ${f.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
${t}

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${r}
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

${n}
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
`}function Fn(){let e=ft,t=e.remapped?`
const LOGICAL_WG_X: u32 = ${e.logicalWgX}u;
const DISPATCH_WG_X: u32 = ${e.dispatchWgX}u;
`:"",r=e.remapped?`fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`:`fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {`,n=e.remapped?`  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;
  let logicalWgX = flatWg % LOGICAL_WG_X;
  let logicalWgY = flatWg / LOGICAL_WG_X;

  let x = logicalWgX * 16u + local_invocation_id.x;
  let y = logicalWgY * 16u + local_invocation_id.y;`:`  let x = gid.x;
  let y = gid.y;`;return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${h}u;
const ROWS: u32 = ${_}u;
const CELLS_PER_WORD: u32 = ${f.cellsPerWord}u;
const WORD_SHIFT: u32 = ${f.wordShift}u;
const CELL_SHIFT: u32 = ${f.cellShift}u;
const CELL_INDEX_MASK: u32 = ${f.cellIndexMask}u;
const CELL_MASK: u32 = ${f.cellMask}u;
const PACKED_COLS: u32 = (COLS + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
${t}

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let wordIdx = y * PACKED_COLS + (x >> WORD_SHIFT);
  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;
  return (grid[wordIdx] >> shift) & CELL_MASK;
}

@compute @workgroup_size(16, 16)
${r}
  if (lid == 0u) {
    atomicStore(&localCount, 0u);
  }
  workgroupBarrier();

${n}
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
`}function Xt(){ft=Bn();let e=s.createShaderModule({code:In()});tt=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),pe=s.createBuffer({size:It,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),ge=s.createBuffer({size:It,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Mr=s.createBindGroup({layout:tt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:pe}}]}),Lr=s.createBindGroup({layout:tt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:pe}}]});let t=s.createShaderModule({code:Fn()});rt=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),me=s.createBuffer({size:Ft,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),be=s.createBuffer({size:Ft,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Ir=s.createBindGroup({layout:rt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:me}}]}),Fr=s.createBindGroup({layout:rt.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:me}}]})}var nr=176;function Dn(){return`
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

const CELLS_PER_WORD: u32 = ${f.cellsPerWord}u;
const WORD_SHIFT: u32 = ${f.wordShift}u;
const CELL_SHIFT: u32 = ${f.cellShift}u;
const CELL_INDEX_MASK: u32 = ${f.cellIndexMask}u;
const CELL_MASK: u32 = ${f.cellMask}u;

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
`}function qt(){let e=s.createShaderModule({code:Dn()});Je=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),le?.destroy(),le=s.createBuffer({size:nr,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Gr=s.createBindGroup({layout:Je.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:le}}]}),wr=s.createBindGroup({layout:Je.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:le}}]})}function Un(e,t,r,n,i,a,u){let d=J.get(We)??0,g=gn++,l=new ArrayBuffer(nr),P=new Int32Array(l),o=new Uint32Array(l);P[0]=t,P[1]=r,o[2]=h,o[3]=_,o[4]=n,o[5]=i,o[6]=a,o[7]=d,o[8]=g,o[9]=u.length,o[10]=0;for(let I=0;I<u.length&&I<32;I++)o[11+I]=u[I];s.queue.writeBuffer(le,0,l);let c=Math.ceil(n/8),B=e.beginComputePass();B.setPipeline(Je),B.setBindGroup(0,k?wr:Gr),B.dispatchWorkgroups(c,c),B.end()}function On(){let e=k?w:G,t=mt(),r;try{r=s.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder();return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function zr(){if(p=mt(),!q()){R=0;return}let e=Wn();R=Math.max(1,Math.floor(e/p))}function Wn(){return p>=br?p:Math.min(Math.max(br,p),er())}function Xr(){if(R<1||p<=0)return mr;let e=Math.max(p,R*p),t=Math.floor(bn/e);return Math.max(1,Math.min(mr,t||1))}function Yt(){let e=q();self.postMessage({type:"limits",maxBytes:_e(),vramBudgetBytes:Nr(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:Cn(),vramRecordingBytes:Sn(),gridFormat:ee()})}function Ie(){return!q()||R<1||L===null||X.length===0||oe>=Xr()?!1:m<R?!0:X.some((e,t)=>O[t]&&e.mapState==="unmapped")}function Fe(e){if(R<1||L===null||m>=R)return;let t=k?w:G,r=m*p,n=s.createCommandEncoder();n.copyBufferToBuffer(t,0,L,r,p),s.queue.submit([n.finish()]),E.push(e),m++}function lt(){if(L===null||m===0||X.length===0)return;let e=O.indexOf(!0);if(e<0)return;O[e]=!1;let t=X[e];if(t.mapState!=="unmapped"){O[e]=!0;return}let r=m*p,n=Dr++,i=[...E],a=i[0],u=i[i.length-1],d=`chunk-${String(n).padStart(6,"0")}.bin`,g=m,l=s.createCommandEncoder();l.copyBufferToBuffer(L,0,t,0,r),s.queue.submit([l.finish()]);let P={chunkId:n,generationStart:a,generationEnd:u,blockCount:g,codec:gt,uncompressedBytes:r,storedBytes:r,gridFormat:ee(),generations:i,filename:d};vt(1),oe++,de();let o=Ee;t.mapAsync(GPUMapMode.READ).then(async()=>{let c=t.getMappedRange(),B=new ArrayBuffer(r);new Uint8Array(B).set(new Uint8Array(c,0,r)),t.unmap(),o===Ee&&(O[e]=!0,de(),y.push(P),ir(),Nn(P,B).then(()=>{o===Ee&&(oe--,de(),vt(-1),fe(),self.postMessage({type:"chunkSealed",filename:P.filename,rawBytes:r,blockCount:P.blockCount,cols:h,rows:_,rawGridFormat:P.gridFormat,storageGridFormat:Se(Et(we.tribes.length))}),Le&&z===0&&(Le=!1,Yr()))}))}).catch(()=>{o===Ee&&(O[e]=!0,oe--,de(),vt(-1))}),m=0,E=[]}function ir(){y.length>0&&(N.generationStart=y[0].generationStart,N.generationEnd=y[y.length-1].generationEnd),E.length>0&&(y.length===0&&(N.generationStart=E[0]),N.generationEnd=E[E.length-1]),N.chunks=[...y]}async function Pr(e){Ee++,Dr=0,m=0,E=[],y=[],oe=0,z>0&&(z=0,self.postMessage({type:"chunksSaving",active:!1})),M&&(M=!1,self.postMessage({type:"backpressure",active:!1})),Le=!1,$=v,N={chunks:[],generationStart:e,generationEnd:e,gridFormat:ee()},await qr(),fe()}async function sr(){return ne&&await ne,Ae||(Ae=await(await navigator.storage.getDirectory()).getDirectoryHandle(nt,{create:!0})),Ae}async function Nn(e,t){let i=await(await(await sr()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function $n(e){let t=await sr();for(let r of e)try{await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function qr(){if(ne){await ne;return}ne=(async()=>{let e=await navigator.storage.getDirectory();Ae=null;try{await e.removeEntry(nt,{recursive:!0})}catch(t){t instanceof DOMException&&t.name==="NotFoundError"||console.warn(`Failed to remove OPFS directory ${nt}:`,t)}Ae=await e.getDirectoryHandle(nt,{create:!0})})();try{await ne}finally{ne=null}}function Yr(){ir(),self.postMessage({type:"recording",manifest:{chunks:y.map(e=>({...e,generations:[...e.generations]})),generationStart:N.generationStart,generationEnd:N.generationEnd,gridFormat:ee()},cols:h,rows:_})}function Kn(){return m>0?E[m-1]!==S:y.length>0?y[y.length-1].generationEnd!==S:!0}function Ge(e=!1){if(v){if(e){if($){if(!Ie())return;$=!1}}else if($)return;!Kn()||!Ie()||(m>=R&&lt(),Fe(S))}}function or(){if(!et)return;let e=et;et=null;let t=s.createCommandEncoder();Un(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),v&&m>0&&E[m-1]===S&&(m--,E.pop(),Fe(S))}async function zn(e,t=gt){let a=await(await(await(await sr()).getFileHandle(e)).getFile()).arrayBuffer();return t===Or?Pn(a):a}function Rr(){let e=m;for(let t of y)e+=t.blockCount;return e}function ie(e){let t=ft,r=new Uint32Array(256);s.queue.writeBuffer(pe,0,r);let n=e.beginComputePass();n.setPipeline(tt),n.setBindGroup(0,k?Lr:Mr),n.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),n.end(),e.copyBufferToBuffer(pe,0,ge,0,256*4);let i=new Uint32Array([0]);s.queue.writeBuffer(me,0,i);let a=e.beginComputePass();a.setPipeline(rt),a.setBindGroup(0,k?Fr:Ir),a.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),a.end(),e.copyBufferToBuffer(me,0,be,0,4)}function se(){let e=S;if(e===Z||U)return;Z=e,U=!0;let t=[];t.push(ge.mapAsync(GPUMapMode.READ)),t.push(be.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=J.get(We)??0,n={},i=0,a=0,u={},d=new Uint32Array(ge.getMappedRange().slice(0));ge.unmap();let g=0;for(let o=0;o<T.length;o++){let c=d[o]??0;n[T[o].id]=c,o!==r&&(g+=c,c>0&&(Mt.set(o,e),Lt.add(o)))}if(g>0)for(let o=0;o<T.length;o++){if(o===r)continue;let c=(d[o]??0)/g;c>0&&(i-=c*Math.log2(c),a+=c*c)}for(let o=0;o<T.length;o++){if(o===r)continue;(d[o]??0)>0?u[T[o].id]=null:Lt.has(o)?u[T[o].id]=Mt.get(o)??0:u[T[o].id]=0}let l=new Uint32Array(be.getMappedRange().slice(0));be.unmap();let P=l[0]??0;if(U=!1,self.postMessage({type:"metrics",generation:e,population:n,shannonEntropy:i,simpsonIndex:1-a,boundaryLength:P,extinctionTime:u,totalFrames:Rr(),fps:tr,canStepBack:Rr()>1,recordingBytes:y.reduce((o,c)=>o+c.storedBytes,0),recordingRawBytes:y.reduce((o,c)=>o+c.uncompressedBytes,0)}),j){j=!1,Z=-1;let o=s.createCommandEncoder();ie(o),s.queue.submit([o.finish()]),se()}}).catch(()=>{U=!1})}function Xn(){let e=h*_;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function qn(){let e=h*_;return e>1e7?2:e>1e6?4:e>1e5?8:16}function Hr(e){if(e<=0)return;let t=dt,r=s.createCommandEncoder();for(let n=0;n<e;n++){let i=r.beginComputePass();i.setPipeline(ke),i.setBindGroup(0,k?Zt:Vt),i.dispatchWorkgroups(t.dispatchWgX,t.dispatchWgY),i.end(),k=!k,S++}s.queue.submit([r.finish()]),he+=e}function Yn(){self.postMessage({type:"generation",generation:S,fps:tr})}function ar(){let e=s.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(ke),t.setBindGroup(0,k?Zt:Vt);let r=dt;t.dispatchWorkgroups(r.dispatchWgX,r.dispatchWgY),t.end(),s.queue.submit([e.finish()]),k=!k,S++}function Q(){Mn();let e=Gt.getCurrentTexture().createView(),t=s.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(ot),r.setBindGroup(0,k?Tr:xr),r.draw(3),r.end(),s.queue.submit([t.finish()])}function jr(e){Qe===0&&(Qe=e);let t=e-Qe;t>=1e3&&(tr=he/(t/1e3),he=0,Qe=e)}function ur(){return v&&q()?"recording":"nonRecording"}function Hn(){return V<=0?{kind:"max"}:{kind:"fixedGenPerSecond",genPerSecond:1e3/V}}function te(e){return e.request.stopCondition.kind==="targetGeneration"}function De(e){return e.request.stopCondition.kind==="targetGeneration"&&S>=e.request.stopCondition.generation}function bt(e){return e.request.stopCondition.kind!=="targetGeneration"?Number.POSITIVE_INFINITY:Math.max(0,e.request.stopCondition.generation-S)}function Vr(e=!1){if(e&&(Z=-1),U)j=!0;else{let t=s.createCommandEncoder();ie(t),s.queue.submit([t.finish()]),se()}}function Zr(){Vr(!0),Q()}function ht(e,t){if(!t)return;(e-At>=1e3||At===0)&&!U&&(At=e,Vr())}function Ue(e,t){e.request.pacing.kind!=="max"&&!te(e)||t-e.lastProgressTime>=1e3&&(e.lastProgressTime=t,Yn())}function cr(){M&&(M=!1,self.postMessage({type:"backpressure",active:!1}))}function jn(){M||(M=!0,self.postMessage({type:"backpressure",active:!0}))}function Qr(){return Ie()?(m>=R&&lt(),Ie()):!1}function Te(){W||K||b||self.requestAnimationFrame(Ht)}function ue(e){let t=b;if(!t||t.pumpPending||W||K)return;let r=t.token;t.pumpPending=!0;let n=()=>{!b||b.token!==r||(b.pumpPending=!1,ti(performance.now()))};e==="raf"?self.requestAnimationFrame(()=>n()):e==="drain"?s.queue.onSubmittedWorkDone().then(n).catch(()=>{b?.token===r&&(b.pumpPending=!1)}):queueMicrotask(n)}function lr(e,t){b&&A("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),b={kind:e,request:t,token:++Ur,pumpPending:!1,lastFrameTime:0,stepAccumulator:0,lastProgressTime:0},ue(t.pacing.kind==="fixedGenPerSecond"?"raf":"microtask")}function H(){x&&lr(ur(),{pacing:Hn(),stopCondition:{kind:"none"}})}function A(e,t={}){let r=b;if(!r)return;b=null,Ur++;let n=te(r),i=t.restore!==!1&&!!r.request.restoreAfterStop;i&&r.request.restoreAfterStop&&(x=r.request.restoreAfterStop.running,V=r.request.restoreAfterStop.targetStepDuration),n&&t.postStepping!==!1&&(e==="targetReached"||e==="cancelled")&&self.postMessage({type:"stepping",active:!1}),n||e==="cancelled"?cr():M&&de(),t.render!==!1&&!W&&!K&&Zr(),t.restartRestoredRun!==!1&&i&&x&&!W&&!K?H():Te()}function Br(e){let t=b;!t||!te(t)||(t.request.restoreAfterStop&&(t.request.restoreAfterStop.running=e),A("cancelled"))}function Vn(e){A("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),lr(ur(),e)}function Jr(e,t,r){jn(),Ue(e,t),ht(t,r),ue("drain")}function Zn(e,t){let r=Xn(),n=qn(),i=!1;for(let a=0;a<n;a++){let u=bt(e);if(u<=0)break;let d=Math.min(r,u);Hr(d),i=!0}if(Ue(e,t),De(e)){A("targetReached");return}ue(i?"drain":"raf")}function Qn(e,t){Ge(!0);let r=!1,n=performance.now()+14;for(;bt(e)>0&&performance.now()<n;){if(!Qr()){Jr(e,t,r);return}ar(),he++,r=!0,Fe(S)}if(cr(),Ue(e,t),ht(t,r),De(e)){A("targetReached");return}ue("raf")}function Jn(e,t,r){e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=Math.floor(e.stepAccumulator/t),a=Math.min(i,bt(e)),u=a>0;if(u&&(Hr(a),e.stepAccumulator-=t*a),Ue(e,r),De(e)){A("targetReached");return}te(e)||(Q(),ht(r,u)),ue("raf")}function ei(e,t,r){Ge(!0),e.lastFrameTime===0&&(e.lastFrameTime=r);let n=r-e.lastFrameTime;e.lastFrameTime=r,e.stepAccumulator+=n;let i=!1;for(;e.stepAccumulator>=t&&bt(e)>0;){if(!Qr()){Jr(e,r,i);return}ar(),he++,e.stepAccumulator-=t,i=!0,Fe(S)}if(cr(),Ue(e,r),De(e)){A("targetReached");return}te(e)||(Q(),ht(r,i)),ue("raf")}function ti(e){let t=b;if(!t||W||K)return;if(jr(e),te(t)||or(),De(t)){A("targetReached");return}if(t.request.pacing.kind==="max"){t.kind==="recording"?Qn(t,e):Zn(t,e);return}let r=1e3/t.request.pacing.genPerSecond;t.kind==="recording"?ei(t,r,e):Jn(t,r,e)}function Ht(e){if(W||K){self.requestAnimationFrame(Ht);return}jr(e),!b&&(or(),V>0&&!Be&&Q(),self.requestAnimationFrame(Ht))}function ri(e,t){let r=s?_e():Number.POSITIVE_INFINITY;return fr(t.bitsPerCell)&&Rt(t.bitsPerCell,e.tribes.length)&&Bt(e,Ce(t.bitsPerCell),r)?Ce(t.bitsPerCell):pr(e.tribes.length,e,r)}function Er(e,t){we=e,h=e.cols,_=e.rows,f=ri(e,t),jt=Pe(h,f),T=[...e.tribes],N.gridFormat=ee(),J.clear(),T.forEach((r,n)=>J.set(r.id,n))}async function en(e){ae=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");s=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),K=!1,s.lost.then(n=>{let i=n.message||n.reason||"unknown";A("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),K=!0,x=!1,W=!0,self.postMessage({type:"deviceLost",reason:i})}),self.postMessage({type:"limits",maxBytes:_e(),vramBudgetBytes:Nr(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0,gridFormat:ee()});let r=ae.getContext("webgpu");if(!r)throw new Error("WebGPU canvas context not available");Gt=r,wt=navigator.gpu.getPreferredCanvasFormat(),Gt.configure({device:s,format:wt,alphaMode:"opaque"})}async function ni(){try{return await en(ae),!0}catch(e){let t=e instanceof Error?e.message:String(e);return A("deviceLost",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),K=!0,x=!1,W=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function tn(){L=s.createBuffer({size:R*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await ut(R*p,L),m=0,E=[]}async function rn(){let e=R*p;X=[],O=[];for(let t=0;t<pt;t++){let r=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});X.push(r),O.push(!0),await ut(e,r)}}async function ii(){await qr()}async function si(){Ot(),zr(),await Wt(),Nt(),$t(),Kt(),zt(),qt(),Xt(),await ii(),q()?(await tn(),await rn()):(ct(),v=!1,$=!1),await at(),Yt()}async function oi(){A("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),W=!0,self.postMessage({type:"rebuilding",active:!0});try{await Jt()}catch{}if(K&&!await ni())return!1;yr(),Ot(),zr(),_r(q());try{await Wt(),Nt(),$t(),zt(),qt(),Kt(),Xt(),q()?(await tn(),await rn()):(ct(),v=!1,$=!1),await at(),Yt()}catch(e){let t=e instanceof Error?e.message:String(e);self.postMessage({type:"gpuError",reason:t});try{yr(),Ot(),_r(!1),await Wt(),Nt(),$t(),zt(),qt(),Kt(),Xt(),v=!1,$=!1,p=mt(),ct(),await at(),Yt()}catch(r){return console.warn("GPU recovery also failed, device may be lost:",r),!1}}return W=!1,self.postMessage({type:"rebuilding",active:!1}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{if(v=t.recording,$=v,Er(t.ruleset,t.simulationGridFormat),await en(t.canvas),await si(),U)j=!0;else{let r=s.createCommandEncoder();ie(r),s.queue.submit([r.finish()]),se()}fe(),x=t.running,V=t.speed<0?0:1e3/t.speed,x?H():Te();break}case"setRuleset":{if(A("rebuild",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),Er(t.ruleset,t.simulationGridFormat),!await oi())break;if(S=0,Z=-1,await Pr(0),x?H():Te(),Mt=new Map,Lt=new Set,U)j=!0;else{let n=s.createCommandEncoder();ie(n),s.queue.submit([n.finish()]),se()}break}case"setRunning":if(x=t.running,t.running){b||H();break}b&&te(b)?Br(!1):b?A("manual"):(M&&de(),Zr(),Te());break;case"setSpeed":{let r=V<=0,n=t.speed<0?0:1e3/t.speed;V=n,b&&!te(b)&&x?(A("restart",{render:!1,postStepping:!1,restore:!1,restartRestoredRun:!1}),r&&n>0?(Be=!0,s.queue.onSubmittedWorkDone().then(()=>{Be=!1,Q(),H()})):H()):x&&!b?H():r&&n>0&&(Be=!0,s.queue.onSubmittedWorkDone().then(()=>{Be=!1,Q(),Te()}));break}case"camera":kr=t.scale,Ar=t.offsetX,vr=t.offsetY;break;case"resize":ae.width=t.width,ae.height=t.height;break;case"draw":{let r=t.tribes.map(n=>J.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};et={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{On().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:S,cols:h,rows:_,gridFormat:ee()})}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:S,cols:h,rows:_,gridFormat:ee()})});break}case"loadSnapshot":{let r=k?w:G,n=xt(t.gridFormat),i=Re({cols:h,rows:_},n);if(t.grid.byteLength!==i)break;let a=n.bitsPerCell===f.bitsPerCell?t.grid:Tt(kt(t.grid,{cols:h,rows:_},n),{cols:h,rows:_},f);s.queue.writeBuffer(r,0,a),S=t.generation,await Pr(t.generation);break}case"setRecording":{let r=b?.request;if(t.recording&&q()&&!v){if(v=!0,$=!0,Z=-1,U)j=!0;else{let n=s.createCommandEncoder();ie(n),s.queue.submit([n.finish()]),se()}fe()}else(!t.recording||!q())&&(v=!1,$=!1);r&&b?Vn(r):!b&&x&&H();break}case"getRecording":{if(Le)break;await Jt(),Ge(!1),m>0&&lt(),z>0?Le=!0:Yr();break}case"stepBack":{let r=0;for(let d of y)r+=d.blockCount;let n=r+m,i=Math.min(t.count,n-1);if(i<=0)break;let a=n-1-i,u=k?w:G;if(a>=r){let d=a-r;m=d+1,E.length=m,S=E[d];let g=s.createCommandEncoder();g.copyBufferToBuffer(L,d*p,u,0,p),s.queue.submit([g.finish()])}else{if(z>0){await new Promise(C=>{let F=setInterval(()=>{z===0&&(clearInterval(F),C())},10)}),r=0;for(let C of y)r+=C.blockCount}let d=0,g=0,l=0;for(let C=0;C<y.length;C++){let F=y[C];if(a<d+F.blockCount){g=C,l=a-d;break}d+=F.blockCount}let P=y[g],o=await zn(P.filename,P.codec),c=xt(P.gridFormat),B=Re({cols:h,rows:_},c);if(c.bitsPerCell===f.bitsPerCell){let C=(l+1)*p;s.queue.writeBuffer(L,0,new Uint8Array(o,0,C))}else{let C=new Uint8Array((l+1)*p);for(let F=0;F<=l;F++){let ye=F*B,nn=new Uint8Array(o,ye,B),sn=gr(nn,{cols:h,rows:_},c),_t=Tt(sn,{cols:h,rows:_},f);C.set(new Uint8Array(_t.buffer,_t.byteOffset,_t.byteLength),F*p)}s.queue.writeBuffer(L,0,C),s.queue.writeBuffer(u,0,C.subarray(l*p,(l+1)*p))}if(m=l+1,E=P.generations.slice(0,l+1),S=E[l],c.bitsPerCell===f.bitsPerCell){let C=s.createCommandEncoder();C.copyBufferToBuffer(L,l*p,u,0,p),s.queue.submit([C.finish()])}let re=y.splice(g).map(C=>C.filename);$n(re)}if(ir(),fe(),Z=-1,U)j=!0;else{let d=s.createCommandEncoder();ie(d),s.queue.submit([d.finish()]),se()}Q();break}case"stepForward":{if(or(),t.count===1){if(Ge(!0),ar(),he++,v&&Ie()&&(m>=R&&lt(),Fe(S)),Z=-1,U)j=!0;else{let r=s.createCommandEncoder();ie(r),s.queue.submit([r.finish()]),se()}Q()}else self.postMessage({type:"stepping",active:!0}),Ge(!0),lr(ur(),{pacing:{kind:"max"},stopCondition:{kind:"targetGeneration",generation:S+t.count},restoreAfterStop:{running:x,targetStepDuration:V}});break}case"cancelStepping":{Br(b?.request.restoreAfterStop?.running??x);break}case"updateChunkCodec":{let r=y.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,r.gridFormat=t.gridFormat,N.chunks=[...y],fe());break}case"getUncompressedChunks":{let r=y.filter(n=>n.codec===gt).map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes,blockCount:n.blockCount,cols:h,rows:_,rawGridFormat:n.gridFormat,storageGridFormat:Se(Et(we.tribes.length))}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
