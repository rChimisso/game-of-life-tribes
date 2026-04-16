var ze=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var te={id:"dead",color:"000000"};var n,we,ve,ee,F,S=0,y=0,se=0,x=[],_=new Map,v,P,he,H,ye,$e,qe,ue,Ye,Ne,U=!1,We=1,je=0,Xe=0,V=!1,k=100,L=0,D=0,p=0,ce,le,He,Ve,yt=0,fe=null,de,Ke,Ze,K,Z,pe,Je,Qe,J,Q,M=-1,A=!1,Pe=!1,Se=0,Ge=new Map,Ue=new Set,C=!0,E={chunks:[],generationStart:0,generationEnd:0},et=0,b=[],re=-1,tt=!1,rt=100,j,l=0,h=[],T=64,G=0,xt=2,xe=[],$=[],ke="gol-recording",ge=null,O=0,ie=!1,X=0,ae=0,ne=0;function Bt(){let e=[],t=se;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${x.map(a=>a.id).join(", ")}`),e.push(`// Rules: ${F.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${S}u;`),e.push(`const ROWS: u32 = ${y}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),e.push(""),e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push("  let wordIdx = y * PACKED_COLS + (x >> 2u);"),e.push("  let shift = (x & 3u) * 8u;"),e.push("  return (gridIn[wordIdx] >> shift) & 0xFFu;"),e.push("}"),e.push("");let r=_.get(te.id)??0;e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let i=St(F.rules.map(a=>a.clause)),o=new Map,f=0;for(let a of i){let c=`count_${f++}`;o.set(a,c)}for(let[a,c]of o){let s=a.split(",").map(Number),w=Fe().map(R=>`select(0u, 1u, ${s.map(B=>`${R} == ${B}u`).join(" || ")})`);e.push(`  let ${c} = ${w.join(" + ")};`)}i.size>0&&e.push("");let d=wt(F.rules.map(a=>a.clause)),u=new Map,m=0;for(let a of d)if(o.has(a))u.set(a,o.get(a));else{let c=`eq_count_${m++}`;u.set(a,c)}for(let[a,c]of u){if(o.has(a))continue;let s=a.split(",").map(Number),w=Fe().map(R=>`select(0u, 1u, ${s.map(B=>`${R} == ${B}u`).join(" || ")})`);e.push(`  let ${c} = ${w.join(" + ")};`)}d.size>0&&m>0&&e.push(""),e.push(`  var result: u32 = ${r}u;`),e.push("");for(let a=0;a<F.rules.length;a++){let c=F.rules[a],s=be(c.clause,o,u),g=Ct(c.tribe);a===0?e.push(`  if (${s}) {`):e.push(`  } else if (${s}) {`),e.push(`    result = ${g}u;`)}F.rules.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px * 4u;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < 4u; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let a=-1;a<=1;a++)for(let c=-1;c<=1;c++){if(c===0&&a===0)continue;let s=nt(c,a),g=De("x",c,"COLS"),w=De("y",a,"ROWS");e.push(`    let ${s} = readCell(${g}, ${w});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & 0xFFu) << (i * 8u));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function nt(e,t){return`n${t===-1?"T":t===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function Fe(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(nt(r,t));return e}function De(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function q(e){let t=[];for(let r of e)if(r==="any")for(let i=0;i<x.length;i++)t.push(i);else{let i=_.get(r);i!==void 0&&t.push(i)}return[...new Set(t)]}function Ct(e){return e==="any"?0:_.get(e)??0}function St(e){let t=new Set;for(let r of e)Te(r,t);return t}function Te(e,t){switch(e.kind){case"count":{let r=q(e.tribes).sort();t.add(r.join(","));break}case"not":Te(e.clause,t);break;case"and":case"or":for(let r of e.clauses)Te(r,t);break}}function wt(e){let t=new Set;for(let r of e)Re(r,t);return t}function Re(e,t){switch(e.kind){case"equality":{let r=q(e.tribe1).sort(),i=q(e.tribe2).sort();t.add(r.join(",")),t.add(i.join(","));break}case"not":Re(e.clause,t);break;case"and":case"or":for(let r of e.clauses)Re(r,t);break}}function be(e,t,r){switch(e.kind){case"is":{let i=q(e.tribes);return i.length===0?"false":i.length===x.length?"true":`(${i.map(f=>`selfTribe == ${f}u`).join(" || ")})`}case"count":{let i=q(e.tribes).sort(),o=t.get(i.join(","));return`(${o} >= ${e.interval[0]}u && ${o} <= ${e.interval[1]}u)`}case"equality":{let i=q(e.tribe1).sort(),o=q(e.tribe2).sort(),f=r.get(i.join(",")),d=r.get(o.join(","));return`(${f} == ${d})`}case"not":return`!(${be(e.clause,t,r)})`;case"and":return`(${e.clauses.map(o=>be(o,t,r)).join(" && ")})`;case"or":return`(${e.clauses.map(o=>be(o,t,r)).join(" || ")})`;default:return"false"}}var it=48;function vt(){let e=new ArrayBuffer(it),t=new Float32Array(e),r=new Uint32Array(e);t[0]=ee.width,t[1]=ee.height,t[2]=S,t[3]=y,t[4]=We,t[6]=je,t[7]=Xe,r[8]=x.length,n.queue.writeBuffer(he,0,e)}function Ee(){return se*y*4}function st(){let e=Ee();v=n.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),P=n.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});let t=_.get(te.id)??0,r=t|t<<8|t<<16|t<<24,i=new Uint32Array(se*y);i.fill(r),n.queue.writeBuffer(v,0,i),n.queue.writeBuffer(P,0,i),U=!1}function ot(){let e=new Uint32Array(256);for(let t=0;t<x.length;t++){let r=x[t].color,i=parseInt(r.substring(0,2),16),o=parseInt(r.substring(2,4),16),f=parseInt(r.substring(4,6),16);e[t]=i|o<<8|f<<16}H&&H.destroy(),H=n.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),n.queue.writeBuffer(H,0,e)}function Pt(){let e=n.createShaderModule({code:ze});ye=n.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:ve}]},primitive:{topology:"triangle-list"}})}function at(){$e=n.createBindGroup({layout:ye.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:he}},{binding:1,resource:{buffer:v}},{binding:2,resource:{buffer:H}}]}),qe=n.createBindGroup({layout:ye.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:he}},{binding:1,resource:{buffer:P}},{binding:2,resource:{buffer:H}}]})}function ut(){let e=Bt(),t=n.createShaderModule({code:e});ue=n.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),Ye=n.createBindGroup({layout:ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:P}}]}),Ne=n.createBindGroup({layout:ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:v}}]})}var Gt=`
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
`;function Ut(){return`
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
`}function ct(){let e=Gt.replace("const COLS: u32 = 0u;",`const COLS: u32 = ${S}u;`).replace("const ROWS: u32 = 0u;",`const ROWS: u32 = ${y}u;`),t=n.createShaderModule({code:e});de=n.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),K=n.createBuffer({size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),Z=n.createBuffer({size:256*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Ke=n.createBindGroup({layout:de.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:K}}]}),Ze=n.createBindGroup({layout:de.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:K}}]});let r=n.createShaderModule({code:Ut()});pe=n.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),J=n.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),Q=n.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Je=n.createBindGroup({layout:pe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:J}}]}),Qe=n.createBindGroup({layout:pe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:J}}]})}var lt=176,kt=`
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
`;function ft(){let e=n.createShaderModule({code:kt});ce=n.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),le=n.createBuffer({size:lt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),He=n.createBindGroup({layout:ce.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:le}}]}),Ve=n.createBindGroup({layout:ce.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:le}}]})}function Tt(e,t,r,i,o,f,d){let u=_.get(te.id)??0,m=yt++,a=new ArrayBuffer(lt),c=new Int32Array(a),s=new Uint32Array(a);c[0]=t,c[1]=r,s[2]=S,s[3]=y,s[4]=i,s[5]=o,s[6]=f,s[7]=u,s[8]=m,s[9]=d.length,s[10]=0;for(let R=0;R<d.length&&R<32;R++)s[11+R]=d[R];n.queue.writeBuffer(le,0,a);let g=Math.ceil(i/8),w=e.beginComputePass();w.setPipeline(ce),w.setBindGroup(0,U?Ve:He),w.dispatchWorkgroups(g,g),w.end()}function Rt(){let e=U?P:v,t=Ee(),r;try{r=n.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch{return Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let i=n.createCommandEncoder();return i.copyBufferToBuffer(e,0,r,0,t),n.queue.submit([i.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let o=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),o})}function Mt(){let e=S*y,t=e>1e6?10:e>1e5?3:1;if(k<=0)return 60*t;let r=1e3/k,i=Math.max(1,Math.round(r));return ne>0&&ne<1&&(i=Math.max(i,Math.ceil(1/ne))),i*t}function At(){G=Ee();let e=n.limits.maxBufferSize,t=32*1024*1024;T=Math.min(256,Math.max(1,Math.floor(Math.min(t,e)/G)))}function Y(){return l<T?!0:$.some(e=>e)}function I(e){let t=U?P:v,r=l*G,i=n.createCommandEncoder();i.copyBufferToBuffer(t,0,j,r,G),n.queue.submit([i.finish()]),h.push(e),l++}function z(){if(l===0)return;let e=$.indexOf(!0);if(e<0)return;$[e]=!1;let t=xe[e],r=l*G,i=et++,o=[...h],f=o[0],d=o[o.length-1],u=`chunk-${String(i).padStart(6,"0")}.bin`,m=l,a=n.createCommandEncoder();a.copyBufferToBuffer(j,0,t,0,r),n.queue.submit([a.finish()]);let c={chunkId:i,generationStart:f,generationEnd:d,blockCount:m,codec:"raw-packed",uncompressedBytes:r,storedBytes:r,generations:o,filename:u};O++,t.mapAsync(GPUMapMode.READ).then(()=>{let s=t.getMappedRange(),g=new ArrayBuffer(r);new Uint8Array(g).set(new Uint8Array(s,0,r)),t.unmap(),$[e]=!0,b.push(c),Oe(),_t(c,g).then(()=>{O--,ie&&O===0&&(ie=!1,pt())})}).catch(()=>{$[e]=!0,O--}),l=0,h=[]}function Oe(){b.length>0&&(E.generationStart=b[0].generationStart,E.generationEnd=b[b.length-1].generationEnd),h.length>0&&(b.length===0&&(E.generationStart=h[0]),E.generationEnd=h[h.length-1]),E.chunks=[...b]}function Me(e){et=0,l=0,h=[],b=[],O=0,ie=!1,E={chunks:[],generationStart:e,generationEnd:e},dt()}async function Ie(){return ge||(ge=await(await navigator.storage.getDirectory()).getDirectoryHandle(ke,{create:!0})),ge}async function _t(e,t){let o=await(await(await Ie()).getFileHandle(e.filename,{create:!0})).createWritable();await o.write(t),await o.close()}async function Et(e){let t=await Ie();for(let r of e)try{await t.removeEntry(r)}catch{}}async function dt(){let e=await navigator.storage.getDirectory();try{await e.removeEntry(ke,{recursive:!0})}catch{}ge=await e.getDirectoryHandle(ke,{create:!0})}function pt(){Oe(),self.postMessage({type:"recording",manifest:{chunks:b.map(e=>({...e,generations:[...e.generations]})),generationStart:E.generationStart,generationEnd:E.generationEnd},cols:S,rows:y})}function Ae(){return l>0?h[l-1]!==p:b.length>0?b[b.length-1].generationEnd!==p:!0}function gt(){if(!fe)return;let e=fe;fe=null;let t=n.createCommandEncoder();Tt(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),n.queue.submit([t.finish()]),C&&l>0&&h[l-1]===p&&(l--,h.pop(),I(p))}async function Ot(e){return(await(await(await Ie()).getFileHandle(e)).getFile()).arrayBuffer()}function It(){let e=l;for(let t of b)e+=t.blockCount;return e}function N(e){let t=Math.ceil(S/16),r=Math.ceil(y/16),i=new Uint32Array(256);n.queue.writeBuffer(K,0,i);let o=e.beginComputePass();o.setPipeline(de),o.setBindGroup(0,U?Ze:Ke),o.dispatchWorkgroups(t,r),o.end(),e.copyBufferToBuffer(K,0,Z,0,256*4);let f=new Uint32Array([0]);n.queue.writeBuffer(J,0,f);let d=e.beginComputePass();d.setPipeline(pe),d.setBindGroup(0,U?Qe:Je),d.dispatchWorkgroups(t,r),d.end(),e.copyBufferToBuffer(J,0,Q,0,4)}function W(){let e=p;if(e===M||A)return;M=e,A=!0;let t=[];t.push(Z.mapAsync(GPUMapMode.READ)),t.push(Q.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=_.get(te.id)??0,i={},o=0,f=0,d={},u=new Uint32Array(Z.getMappedRange().slice(0));Z.unmap();let m=0;for(let s=0;s<x.length;s++){let g=u[s]??0;i[x[s].id]=g,s!==r&&(m+=g,g>0&&(Ge.set(s,e),Ue.add(s)))}if(m>0)for(let s=0;s<x.length;s++){if(s===r)continue;let g=(u[s]??0)/m;g>0&&(o-=g*Math.log2(g),f+=g*g)}for(let s=0;s<x.length;s++){if(s===r)continue;(u[s]??0)>0?d[x[s].id]=null:Ue.has(s)?d[x[s].id]=Ge.get(s)??0:d[x[s].id]=0}let a=new Uint32Array(Q.getMappedRange().slice(0));Q.unmap();let c=a[0]??0;if(A=!1,self.postMessage({type:"metrics",generation:e,population:i,shannonEntropy:o,simpsonIndex:1-f,boundaryLength:c,extinctionTime:d,fps:ne,canStepBack:It()>1}),Pe){Pe=!1,M=-1;let s=n.createCommandEncoder();N(s),n.queue.submit([s.finish()]),W()}})}function me(){let e=n.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(ue),t.setBindGroup(0,U?Ne:Ye);let r=Math.ceil(se/16),i=Math.ceil(y/16);t.dispatchWorkgroups(r,i),t.end(),n.queue.submit([e.finish()]),U=!U,p++}function Be(){vt();let e=we.getCurrentTexture().createView(),t=n.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(ye),r.setBindGroup(0,U?qe:$e),r.draw(3),r.end(),n.queue.submit([t.finish()])}function _e(e){if(re>=0){let r=performance.now()+14;for(;p<re&&performance.now()<r;){if(C){if(!Y())break;l>=T&&z()}me(),X++,C&&I(p)}if(p>=re){if(re=-1,V=tt,k=rt,D=0,L=0,M=-1,!A){let i=n.createCommandEncoder();N(i),n.queue.submit([i.finish()]),W()}Be(),self.postMessage({type:"stepping",active:!1})}self.requestAnimationFrame(_e);return}gt(),ae===0&&(ae=e);let t=e-ae;if(t>=1e3&&(ne=X/(t/1e3),X=0,ae=e),V){C&&Ae()&&Y()&&(l>=T&&z(),I(p));let r=!1;D===0&&(D=e);let i=e-D;D=e;let o=Mt();if(k<=0){let f=performance.now()+14;for(;performance.now()<f;){if(C){if(!Y())break;l>=T&&z()}me(),X++,r=!0,C&&I(p)}}else for(L+=i;L>=k;){if(C){if(!Y())break;l>=T&&z()}me(),X++,L-=k,r=!0,C&&I(p)}if(r&&(p%o===0||p-M>=o*2)){let f=e-Se,d=S*y>1e6?3e3:S*y>1e5?2e3:1e3;if((f>=d||Se===0)&&!A){Se=e;let u=n.createCommandEncoder();N(u),n.queue.submit([u.finish()]),W()}}}k>0&&Be(),self.requestAnimationFrame(_e)}function Le(e){F=e,S=e.cols,y=e.rows,se=Math.ceil(S/4),x=[...e.tribes],_.clear(),x.forEach((t,r)=>_.set(t.id,r))}async function zt(e){ee=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");n=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),self.postMessage({type:"limits",maxBytes:Math.min(n.limits.maxBufferSize,n.limits.maxStorageBufferBindingSize)}),we=ee.getContext("webgpu"),ve=navigator.gpu.getPreferredCanvasFormat(),we.configure({device:n,format:ve,alphaMode:"opaque"})}function bt(){At(),j=n.createBuffer({size:T*G,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),l=0,h=[]}function mt(){let e=T*G;xe=[],$=[];for(let t=0;t<xt;t++)xe.push(n.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})),$.push(!0)}function Ft(){dt()}function Dt(){he=n.createBuffer({size:it,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),st(),ot(),Pt(),at(),ut(),ft(),ct(),Ft(),bt(),mt()}function Lt(){v?.destroy(),P?.destroy(),K?.destroy(),Z?.destroy(),J?.destroy(),Q?.destroy(),j?.destroy();for(let e of xe)e?.destroy();st(),ot(),ut(),ft(),at(),ct(),bt(),mt(),Me(p)}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{Le(t.ruleset),await zt(t.canvas),Dt(),V=t.running,k=t.speed<0?0:1e3/t.speed,D=0,L=0,self.requestAnimationFrame(_e);break}case"setRuleset":{if(Le(t.ruleset),Lt(),p=0,M=-1,Me(0),Ge=new Map,Ue=new Set,!A){let r=n.createCommandEncoder();N(r),n.queue.submit([r.finish()]),W()}break}case"setRunning":if(V=t.running,t.running)D=0,L=0;else if(M=-1,!A){let r=n.createCommandEncoder();N(r),n.queue.submit([r.finish()]),W()}break;case"setSpeed":k=t.speed<0?0:1e3/t.speed,L=0;break;case"camera":We=t.scale,je=t.offsetX,Xe=t.offsetY;break;case"resize":ee.width=t.width,ee.height=t.height;break;case"draw":{let r=t.tribes.map(i=>_.get(i)).filter(i=>i!==void 0);if(r.length>0){let i={square:0,round:1,diamond:2,vline:3,hline:4},o={full:0,spray:1,outline:2};fe={centerX:t.x,centerY:t.y,brushSize:t.size,shape:i[t.shape]??0,fill:o[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{Rt().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:p,cols:S,rows:y},[r.buffer])}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:p,cols:S,rows:y})});break}case"loadSnapshot":{let r=U?P:v;n.queue.writeBuffer(r,0,t.grid),p=t.generation,Me(t.generation);break}case"setRecording":{t.recording&&!C?C=!0:t.recording||(C=!1);break}case"getRecording":{if(ie)break;l>0&&z(),O>0?ie=!0:pt();break}case"stepBack":{let r=0;for(let u of b)r+=u.blockCount;let i=r+l,o=Math.min(t.count,i-1);if(o<=0)break;let f=i-1-o,d=U?P:v;if(f>=r){let u=f-r;l=u+1,h.length=l,p=h[u];let m=n.createCommandEncoder();m.copyBufferToBuffer(j,u*G,d,0,G),n.queue.submit([m.finish()])}else{if(O>0){await new Promise(B=>{let oe=setInterval(()=>{O===0&&(clearInterval(oe),B())},10)}),r=0;for(let B of b)r+=B.blockCount}let u=0,m=0,a=0;for(let B=0;B<b.length;B++){let oe=b[B];if(f<u+oe.blockCount){m=B,a=f-u;break}u+=oe.blockCount}let c=b[m],s=await Ot(c.filename),g=(a+1)*G;n.queue.writeBuffer(j,0,new Uint8Array(s,0,g)),l=a+1,h=c.generations.slice(0,a+1),p=h[a];let w=n.createCommandEncoder();w.copyBufferToBuffer(j,a*G,d,0,G),n.queue.submit([w.finish()]);let Ce=b.splice(m).map(B=>B.filename);Et(Ce)}if(Oe(),M=-1,A)Pe=!0;else{let u=n.createCommandEncoder();N(u),n.queue.submit([u.finish()]),W()}Be();break}case"stepForward":{if(gt(),t.count===1){if(C&&Ae()&&Y()&&(l>=T&&z(),I(p)),me(),X++,C&&Y()&&(l>=T&&z(),I(p)),M=-1,!A){let r=n.createCommandEncoder();N(r),n.queue.submit([r.finish()]),W()}Be()}else self.postMessage({type:"stepping",active:!0}),C&&Ae()&&Y()&&(l>=T&&z(),I(p)),tt=V,rt=k,re=p+t.count,V=!0,k=0;break}}};
