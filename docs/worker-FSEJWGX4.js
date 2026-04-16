var De=`// Render shader: draws the grid as a full-screen quad.\r
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
  // Read tribe ID from packed grid buffer (4 cells per u32, row-packed).\r
  let packed_cols = (u32(cols) + 3u) / 4u;\r
  let word_idx = iy * packed_cols + (ix >> 2u);\r
  let shift = (ix & 3u) * 8u;\r
  let tribe_id = (grid[word_idx] >> shift) & 0xFFu;\r
\r
  // Look up tribe color (packed as 0x00BBGGRR).\r
  let color_packed = tribe_colors[tribe_id];\r
  let r = f32(color_packed & 0xFFu) / 255.0;\r
  let g = f32((color_packed >> 8u) & 0xFFu) / 255.0;\r
  let b = f32((color_packed >> 16u) & 0xFFu) / 255.0;\r
\r
  return vec4f(r, g, b, 1.0);\r
}\r
`;var se={id:"dead",color:"000000"};var n,Ge,ke,ie,q,S=0,y=0,ue=0,x=[],E=new Map,w,P,xe,Z,Be,Ye,We,le,Ne,je,k=!1,Xe=1,He=0,Ve=0,J=!1,U=100,W=0,Y=0,g=0,K=!1,fe,de,Ke,Ze,Bt=0,pe=null,ge,Je,Qe,Q,ee,be,et,tt,te,re,R=-1,A=!1,N=!1,we=0,Ue=new Map,Te=new Set,C=!0,z={chunks:[],generationStart:0,generationEnd:0},rt=0,b=[],ae=-1,nt=!1,it=100,V,l=0,h=[],T=64,G=0,Ct=2,Ce=[],j=[],Me="gol-recording",me=null,_=0;function Pe(e){let t=_>0;_+=e;let r=_>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}var oe=!1,I=0,O=0,ne=0;function St(){let e=[],t=ue;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${x.map(o=>o.id).join(", ")}`),e.push(`// Rules: ${q.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${S}u;`),e.push(`const ROWS: u32 = ${y}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),e.push(""),e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push("  let wordIdx = y * PACKED_COLS + (x >> 2u);"),e.push("  let shift = (x & 3u) * 8u;"),e.push("  return (gridIn[wordIdx] >> shift) & 0xFFu;"),e.push("}"),e.push("");let r=E.get(se.id)??0;e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let i=wt(q.rules.map(o=>o.clause)),a=new Map,d=0;for(let o of i){let c=`count_${d++}`;a.set(o,c)}for(let[o,c]of a){let s=o.split(",").map(Number),v=Le().map(M=>`select(0u, 1u, ${s.map(B=>`${M} == ${B}u`).join(" || ")})`);e.push(`  let ${c} = ${v.join(" + ")};`)}i.size>0&&e.push("");let p=Pt(q.rules.map(o=>o.clause)),u=new Map,m=0;for(let o of p)if(a.has(o))u.set(o,a.get(o));else{let c=`eq_count_${m++}`;u.set(o,c)}for(let[o,c]of u){if(a.has(o))continue;let s=o.split(",").map(Number),v=Le().map(M=>`select(0u, 1u, ${s.map(B=>`${M} == ${B}u`).join(" || ")})`);e.push(`  let ${c} = ${v.join(" + ")};`)}p.size>0&&m>0&&e.push(""),e.push(`  var result: u32 = ${r}u;`),e.push("");for(let o=0;o<q.rules.length;o++){let c=q.rules[o],s=he(c.clause,a,u),f=vt(c.tribe);o===0?e.push(`  if (${s}) {`):e.push(`  } else if (${s}) {`),e.push(`    result = ${f}u;`)}q.rules.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px * 4u;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < 4u; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let o=-1;o<=1;o++)for(let c=-1;c<=1;c++){if(c===0&&o===0)continue;let s=st(c,o),f=$e("x",c,"COLS"),v=$e("y",o,"ROWS");e.push(`    let ${s} = readCell(${f}, ${v});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & 0xFFu) << (i * 8u));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function st(e,t){return`n${t===-1?"T":t===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function Le(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(st(r,t));return e}function $e(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function X(e){let t=[];for(let r of e)if(r==="any")for(let i=0;i<x.length;i++)t.push(i);else{let i=E.get(r);i!==void 0&&t.push(i)}return[...new Set(t)]}function vt(e){return e==="any"?0:E.get(e)??0}function wt(e){let t=new Set;for(let r of e)Re(r,t);return t}function Re(e,t){switch(e.kind){case"count":{let r=X(e.tribes).sort();t.add(r.join(","));break}case"not":Re(e.clause,t);break;case"and":case"or":for(let r of e.clauses)Re(r,t);break}}function Pt(e){let t=new Set;for(let r of e)Ae(r,t);return t}function Ae(e,t){switch(e.kind){case"equality":{let r=X(e.tribe1).sort(),i=X(e.tribe2).sort();t.add(r.join(",")),t.add(i.join(","));break}case"not":Ae(e.clause,t);break;case"and":case"or":for(let r of e.clauses)Ae(r,t);break}}function he(e,t,r){switch(e.kind){case"is":{let i=X(e.tribes);return i.length===0?"false":i.length===x.length?"true":`(${i.map(d=>`selfTribe == ${d}u`).join(" || ")})`}case"count":{let i=X(e.tribes).sort(),a=t.get(i.join(","));return`(${a} >= ${e.interval[0]}u && ${a} <= ${e.interval[1]}u)`}case"equality":{let i=X(e.tribe1).sort(),a=X(e.tribe2).sort(),d=r.get(i.join(",")),p=r.get(a.join(","));return`(${d} == ${p})`}case"not":return`!(${he(e.clause,t,r)})`;case"and":return`(${e.clauses.map(a=>he(a,t,r)).join(" && ")})`;case"or":return`(${e.clauses.map(a=>he(a,t,r)).join(" || ")})`;default:return"false"}}var at=48;function Gt(){let e=new ArrayBuffer(at),t=new Float32Array(e),r=new Uint32Array(e);t[0]=ie.width,t[1]=ie.height,t[2]=S,t[3]=y,t[4]=Xe,t[6]=He,t[7]=Ve,r[8]=x.length,n.queue.writeBuffer(xe,0,e)}function Ie(){return ue*y*4}function ot(){let e=Ie();w=n.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),P=n.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});let t=E.get(se.id)??0,r=t|t<<8|t<<16|t<<24,i=new Uint32Array(ue*y);i.fill(r),n.queue.writeBuffer(w,0,i),n.queue.writeBuffer(P,0,i),k=!1}function ut(){let e=new Uint32Array(256);for(let t=0;t<x.length;t++){let r=x[t].color,i=parseInt(r.substring(0,2),16),a=parseInt(r.substring(2,4),16),d=parseInt(r.substring(4,6),16);e[t]=i|a<<8|d<<16}Z&&Z.destroy(),Z=n.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),n.queue.writeBuffer(Z,0,e)}function kt(){let e=n.createShaderModule({code:De});Be=n.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:ke}]},primitive:{topology:"triangle-list"}})}function ct(){Ye=n.createBindGroup({layout:Be.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:xe}},{binding:1,resource:{buffer:w}},{binding:2,resource:{buffer:Z}}]}),We=n.createBindGroup({layout:Be.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:xe}},{binding:1,resource:{buffer:P}},{binding:2,resource:{buffer:Z}}]})}function lt(){let e=St(),t=n.createShaderModule({code:e});le=n.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),Ne=n.createBindGroup({layout:le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:P}}]}),je=n.createBindGroup({layout:le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:w}}]})}var Ut=`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = 0u; // placeholder, replaced at creation time
const ROWS: u32 = 0u; // placeholder, replaced at creation time

fn readCell(x: u32, y: u32) -> u32 {
  let packed_cols = (COLS + 3u) / 4u;
  let wordIdx = y * packed_cols + (x >> 2u);
  let shift = (x & 3u) * 8u;
  return (grid[wordIdx] >> shift) & 0xFFu;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x;
  let y = gid.y;
  if (x >= COLS || y >= ROWS) { return; }
  let tribe = readCell(x, y);
  atomicAdd(&hist[tribe], 1u);
}
`;function Tt(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${S}u;
const ROWS: u32 = ${y}u;

fn readCell(x: u32, y: u32) -> u32 {
  let packed_cols = (COLS + 3u) / 4u;
  let wordIdx = y * packed_cols + (x >> 2u);
  let shift = (x & 3u) * 8u;
  return (grid[wordIdx] >> shift) & 0xFFu;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x;
  let y = gid.y;
  if (x >= COLS || y >= ROWS) { return; }
  let self_tribe = readCell(x, y);

  // Check right neighbor.
  let rx = (x + 1u) % COLS;
  if (readCell(rx, y) != self_tribe) {
    atomicAdd(&boundary, 1u);
  }

  // Check bottom neighbor.
  let by = (y + 1u) % ROWS;
  if (readCell(x, by) != self_tribe) {
    atomicAdd(&boundary, 1u);
  }
}
`}function ft(){let e=Ut.replace("const COLS: u32 = 0u;",`const COLS: u32 = ${S}u;`).replace("const ROWS: u32 = 0u;",`const ROWS: u32 = ${y}u;`),t=n.createShaderModule({code:e});ge=n.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),Q=n.createBuffer({size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),ee=n.createBuffer({size:256*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Je=n.createBindGroup({layout:ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:Q}}]}),Qe=n.createBindGroup({layout:ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:Q}}]});let r=n.createShaderModule({code:Tt()});be=n.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),te=n.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),re=n.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),et=n.createBindGroup({layout:be.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:te}}]}),tt=n.createBindGroup({layout:be.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:te}}]})}var dt=176,Mt=`
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

fn pcg(inp: u32) -> u32 {
  var state = inp * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn writePackedCell(cx: u32, cy: u32, value: u32) {
  let packed_cols = (params.cols + 3u) / 4u;
  let wordIdx = cy * packed_cols + (cx >> 2u);
  let shift = (cx & 3u) * 8u;
  let mask = 0xFFu << shift;
  let newBits = (value & 0xFFu) << shift;
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
  let h = pcg(params.seed ^ idx);
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
`;function pt(){let e=n.createShaderModule({code:Mt});fe=n.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),de=n.createBuffer({size:dt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Ke=n.createBindGroup({layout:fe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:de}}]}),Ze=n.createBindGroup({layout:fe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:de}}]})}function Rt(e,t,r,i,a,d,p){let u=E.get(se.id)??0,m=Bt++,o=new ArrayBuffer(dt),c=new Int32Array(o),s=new Uint32Array(o);c[0]=t,c[1]=r,s[2]=S,s[3]=y,s[4]=i,s[5]=a,s[6]=d,s[7]=u,s[8]=m,s[9]=p.length,s[10]=0;for(let M=0;M<p.length&&M<32;M++)s[11+M]=p[M];n.queue.writeBuffer(de,0,o);let f=Math.ceil(i/8),v=e.beginComputePass();v.setPipeline(fe),v.setBindGroup(0,k?Ze:Ke),v.dispatchWorkgroups(f,f),v.end()}function At(){let e=k?P:w,t=Ie(),r;try{r=n.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch{return Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let i=n.createCommandEncoder();return i.copyBufferToBuffer(e,0,r,0,t),n.queue.submit([i.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let a=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),a})}function _t(){let e=S*y,t=e>1e6?10:e>1e5?3:1;if(U<=0)return 60*t;let r=1e3/U,i=Math.max(1,Math.round(r));return ne>0&&ne<1&&(i=Math.max(i,Math.ceil(1/ne))),i*t}function Et(){G=Ie();let e=n.limits.maxBufferSize,t=32*1024*1024;T=Math.min(256,Math.max(1,Math.floor(Math.min(t,e)/G)))}function H(){return l<T?!0:j.some(e=>e)}function F(e){let t=k?P:w,r=l*G,i=n.createCommandEncoder();i.copyBufferToBuffer(t,0,V,r,G),n.queue.submit([i.finish()]),h.push(e),l++}function D(){if(l===0)return;let e=j.indexOf(!0);if(e<0)return;j[e]=!1;let t=Ce[e],r=l*G,i=rt++,a=[...h],d=a[0],p=a[a.length-1],u=`chunk-${String(i).padStart(6,"0")}.bin`,m=l,o=n.createCommandEncoder();o.copyBufferToBuffer(V,0,t,0,r),n.queue.submit([o.finish()]);let c={chunkId:i,generationStart:d,generationEnd:p,blockCount:m,codec:"raw-packed",uncompressedBytes:r,storedBytes:r,generations:a,filename:u};Pe(1),t.mapAsync(GPUMapMode.READ).then(()=>{let s=t.getMappedRange(),f=new ArrayBuffer(r);new Uint8Array(f).set(new Uint8Array(s,0,r)),t.unmap(),j[e]=!0,b.push(c),ze(),Ot(c,f).then(()=>{Pe(-1),oe&&_===0&&(oe=!1,bt())})}).catch(()=>{j[e]=!0,Pe(-1)}),l=0,h=[]}function ze(){b.length>0&&(z.generationStart=b[0].generationStart,z.generationEnd=b[b.length-1].generationEnd),h.length>0&&(b.length===0&&(z.generationStart=h[0]),z.generationEnd=h[h.length-1]),z.chunks=[...b]}function _e(e){rt=0,l=0,h=[],b=[],_>0&&(_=0,self.postMessage({type:"chunksSaving",active:!1})),oe=!1,z={chunks:[],generationStart:e,generationEnd:e},gt()}async function Fe(){return me||(me=await(await navigator.storage.getDirectory()).getDirectoryHandle(Me,{create:!0})),me}async function Ot(e,t){let a=await(await(await Fe()).getFileHandle(e.filename,{create:!0})).createWritable();await a.write(t),await a.close()}async function It(e){let t=await Fe();for(let r of e)try{await t.removeEntry(r)}catch{}}async function gt(){let e=await navigator.storage.getDirectory();try{await e.removeEntry(Me,{recursive:!0})}catch{}me=await e.getDirectoryHandle(Me,{create:!0})}function bt(){ze(),self.postMessage({type:"recording",manifest:{chunks:b.map(e=>({...e,generations:[...e.generations]})),generationStart:z.generationStart,generationEnd:z.generationEnd},cols:S,rows:y})}function Ee(){return l>0?h[l-1]!==g:b.length>0?b[b.length-1].generationEnd!==g:!0}function mt(){if(!pe)return;let e=pe;pe=null;let t=n.createCommandEncoder();Rt(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),n.queue.submit([t.finish()]),C&&l>0&&h[l-1]===g&&(l--,h.pop(),F(g))}async function zt(e){return(await(await(await Fe()).getFileHandle(e)).getFile()).arrayBuffer()}function Ft(){let e=l;for(let t of b)e+=t.blockCount;return e}function L(e){let t=Math.ceil(S/16),r=Math.ceil(y/16),i=new Uint32Array(256);n.queue.writeBuffer(Q,0,i);let a=e.beginComputePass();a.setPipeline(ge),a.setBindGroup(0,k?Qe:Je),a.dispatchWorkgroups(t,r),a.end(),e.copyBufferToBuffer(Q,0,ee,0,256*4);let d=new Uint32Array([0]);n.queue.writeBuffer(te,0,d);let p=e.beginComputePass();p.setPipeline(be),p.setBindGroup(0,k?tt:et),p.dispatchWorkgroups(t,r),p.end(),e.copyBufferToBuffer(te,0,re,0,4)}function $(){let e=g;if(e===R||A)return;R=e,A=!0;let t=[];t.push(ee.mapAsync(GPUMapMode.READ)),t.push(re.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=E.get(se.id)??0,i={},a=0,d=0,p={},u=new Uint32Array(ee.getMappedRange().slice(0));ee.unmap();let m=0;for(let s=0;s<x.length;s++){let f=u[s]??0;i[x[s].id]=f,s!==r&&(m+=f,f>0&&(Ue.set(s,e),Te.add(s)))}if(m>0)for(let s=0;s<x.length;s++){if(s===r)continue;let f=(u[s]??0)/m;f>0&&(a-=f*Math.log2(f),d+=f*f)}for(let s=0;s<x.length;s++){if(s===r)continue;(u[s]??0)>0?p[x[s].id]=null:Te.has(s)?p[x[s].id]=Ue.get(s)??0:p[x[s].id]=0}let o=new Uint32Array(re.getMappedRange().slice(0));re.unmap();let c=o[0]??0;if(A=!1,self.postMessage({type:"metrics",generation:e,population:i,shannonEntropy:a,simpsonIndex:1-d,boundaryLength:c,extinctionTime:p,fps:ne,canStepBack:Ft()>1,recordingBytes:b.reduce((s,f)=>s+f.storedBytes,0)}),N){N=!1,R=-1;let s=n.createCommandEncoder();L(s),n.queue.submit([s.finish()]),$()}})}function ye(){let e=n.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(le),t.setBindGroup(0,k?je:Ne);let r=Math.ceil(ue/16),i=Math.ceil(y/16);t.dispatchWorkgroups(r,i),t.end(),n.queue.submit([e.finish()]),k=!k,g++}function Se(){Gt();let e=Ge.getCurrentTexture().createView(),t=n.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(Be),r.setBindGroup(0,k?We:Ye),r.draw(3),r.end(),n.queue.submit([t.finish()])}function Oe(e){if(ae>=0){if(!K){let i=performance.now()+14;for(;g<ae&&performance.now()<i;){if(C){if(!H())break;l>=T&&D()}ye(),I++,C&&F(g)}K=!0,n.queue.onSubmittedWorkDone().then(()=>{K=!1})}O===0&&(O=e);let r=e-O;if(r>=1e3&&(ne=I/(r/1e3),I=0,O=e,!A)){R=-1;let i=n.createCommandEncoder();L(i),n.queue.submit([i.finish()]),$()}if(g>=ae){if(ae=-1,J=nt,U=it,Y=0,W=0,R=-1,A)N=!0;else{let i=n.createCommandEncoder();L(i),n.queue.submit([i.finish()]),$()}Se(),self.postMessage({type:"stepping",active:!1})}self.requestAnimationFrame(Oe);return}mt(),O===0&&(O=e);let t=e-O;if(t>=1e3&&(ne=I/(t/1e3),I=0,O=e),J){C&&Ee()&&H()&&(l>=T&&D(),F(g));let r=!1;Y===0&&(Y=e);let i=e-Y;Y=e;let a=_t();if(U<=0){if(!K){let d=performance.now()+14;for(;performance.now()<d;){if(C){if(!H())break;l>=T&&D()}ye(),I++,r=!0,C&&F(g)}K=!0,n.queue.onSubmittedWorkDone().then(()=>{K=!1})}}else for(W+=i;W>=U;){if(C){if(!H())break;l>=T&&D()}ye(),I++,W-=U,r=!0,C&&F(g)}if(r&&(g%a===0||g-R>=a*2)){let d=e-we,p=S*y>1e6?3e3:S*y>1e5?2e3:1e3;if((d>=p||we===0)&&!A){we=e;let u=n.createCommandEncoder();L(u),n.queue.submit([u.finish()]),$()}}}U>0&&Se(),self.requestAnimationFrame(Oe)}function qe(e){q=e,S=e.cols,y=e.rows,ue=Math.ceil(S/4),x=[...e.tribes],E.clear(),x.forEach((t,r)=>E.set(t.id,r))}async function Dt(e){ie=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");n=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),self.postMessage({type:"limits",maxBytes:Math.min(n.limits.maxBufferSize,n.limits.maxStorageBufferBindingSize)}),Ge=ie.getContext("webgpu"),ke=navigator.gpu.getPreferredCanvasFormat(),Ge.configure({device:n,format:ke,alphaMode:"opaque"})}function ht(){Et(),V=n.createBuffer({size:T*G,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),l=0,h=[]}function yt(){let e=T*G;Ce=[],j=[];for(let t=0;t<Ct;t++)Ce.push(n.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})),j.push(!0)}function Lt(){gt()}function $t(){xe=n.createBuffer({size:at,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),ot(),ut(),kt(),ct(),lt(),pt(),ft(),Lt(),ht(),yt()}function qt(){w?.destroy(),P?.destroy(),Q?.destroy(),ee?.destroy(),te?.destroy(),re?.destroy(),V?.destroy();for(let e of Ce)e?.destroy();ot(),ut(),lt(),pt(),ct(),ft(),ht(),yt(),_e(g)}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{qe(t.ruleset),await Dt(t.canvas),$t(),J=t.running,U=t.speed<0?0:1e3/t.speed,Y=0,W=0,self.requestAnimationFrame(Oe);break}case"setRuleset":{if(qe(t.ruleset),qt(),g=0,R=-1,_e(0),Ue=new Map,Te=new Set,A)N=!0;else{let r=n.createCommandEncoder();L(r),n.queue.submit([r.finish()]),$()}break}case"setRunning":if(J=t.running,t.running)Y=0,W=0;else if(R=-1,A)N=!0;else{let r=n.createCommandEncoder();L(r),n.queue.submit([r.finish()]),$()}break;case"setSpeed":U=t.speed<0?0:1e3/t.speed,W=0;break;case"camera":Xe=t.scale,He=t.offsetX,Ve=t.offsetY;break;case"resize":ie.width=t.width,ie.height=t.height;break;case"draw":{let r=t.tribes.map(i=>E.get(i)).filter(i=>i!==void 0);if(r.length>0){let i={square:0,round:1,diamond:2,vline:3,hline:4},a={full:0,spray:1,outline:2};pe={centerX:t.x,centerY:t.y,brushSize:t.size,shape:i[t.shape]??0,fill:a[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{At().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:g,cols:S,rows:y},[r.buffer])}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:g,cols:S,rows:y})});break}case"loadSnapshot":{let r=k?P:w;n.queue.writeBuffer(r,0,t.grid),g=t.generation,_e(t.generation);break}case"setRecording":{t.recording&&!C?C=!0:t.recording||(C=!1);break}case"getRecording":{if(oe)break;l>0&&D(),_>0?oe=!0:bt();break}case"stepBack":{let r=0;for(let u of b)r+=u.blockCount;let i=r+l,a=Math.min(t.count,i-1);if(a<=0)break;let d=i-1-a,p=k?P:w;if(d>=r){let u=d-r;l=u+1,h.length=l,g=h[u];let m=n.createCommandEncoder();m.copyBufferToBuffer(V,u*G,p,0,G),n.queue.submit([m.finish()])}else{if(_>0){await new Promise(B=>{let ce=setInterval(()=>{_===0&&(clearInterval(ce),B())},10)}),r=0;for(let B of b)r+=B.blockCount}let u=0,m=0,o=0;for(let B=0;B<b.length;B++){let ce=b[B];if(d<u+ce.blockCount){m=B,o=d-u;break}u+=ce.blockCount}let c=b[m],s=await zt(c.filename),f=(o+1)*G;n.queue.writeBuffer(V,0,new Uint8Array(s,0,f)),l=o+1,h=c.generations.slice(0,o+1),g=h[o];let v=n.createCommandEncoder();v.copyBufferToBuffer(V,o*G,p,0,G),n.queue.submit([v.finish()]);let ve=b.splice(m).map(B=>B.filename);It(ve)}if(ze(),R=-1,A)N=!0;else{let u=n.createCommandEncoder();L(u),n.queue.submit([u.finish()]),$()}Se();break}case"stepForward":{if(mt(),t.count===1){if(C&&Ee()&&H()&&(l>=T&&D(),F(g)),ye(),I++,C&&H()&&(l>=T&&D(),F(g)),R=-1,A)N=!0;else{let r=n.createCommandEncoder();L(r),n.queue.submit([r.finish()]),$()}Se()}else self.postMessage({type:"stepping",active:!0}),C&&Ee()&&H()&&(l>=T&&D(),F(g)),nt=J,it=U,ae=g+t.count,J=!0,U=0;break}}};
