var ve=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var K={id:"dead",color:"000000"};var i,me,he,V,k,g=0,p=0,w=0,m=[],T=new Map,x,B,de,I,fe,ke,_e,re,Oe,Ee,C=!1,ze=1,Ie=0,Fe=0,R=!1,y=100,E=0,_=0,b=0,te,ne,Le,$e,nr=0,se=null,ie,De,qe,q,Y,oe,Ye,We,W,N,M=-1,v=!1,be=0,ye=new Map,xe=new Set,U=!0,l=[],A=0,H=!1,F=-1,Be=!1,Ce=100,Ge,Ue,ae=!1,ue=!0,ce=!0,O=0,ee=0,Z=0;function sr(){let e=[],r=w;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${m.map(c=>c.id).join(", ")}`),e.push(`// Rules: ${k.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${g}u;`),e.push(`const ROWS: u32 = ${p}u;`),e.push(`const PACKED_COLS: u32 = ${r}u;`),e.push(""),e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push("  let wordIdx = y * PACKED_COLS + (x >> 2u);"),e.push("  let shift = (x & 3u) * 8u;"),e.push("  return (gridIn[wordIdx] >> shift) & 0xFFu;"),e.push("}"),e.push("");let t=T.get(K.id)??0;e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let n=or(k.rules.map(c=>c.clause)),s=new Map,o=0;for(let c of n){let d=`count_${o++}`;s.set(c,d)}for(let[c,d]of s){let u=c.split(",").map(Number),P=Te().map(G=>`select(0u, 1u, ${u.map(ge=>`${G} == ${ge}u`).join(" || ")})`);e.push(`  let ${d} = ${P.join(" + ")};`)}n.size>0&&e.push("");let a=ar(k.rules.map(c=>c.clause)),h=new Map,S=0;for(let c of a)if(s.has(c))h.set(c,s.get(c));else{let d=`eq_count_${S++}`;h.set(c,d)}for(let[c,d]of h){if(s.has(c))continue;let u=c.split(",").map(Number),P=Te().map(G=>`select(0u, 1u, ${u.map(ge=>`${G} == ${ge}u`).join(" || ")})`);e.push(`  let ${d} = ${P.join(" + ")};`)}a.size>0&&S>0&&e.push(""),e.push(`  var result: u32 = ${t}u;`),e.push("");for(let c=0;c<k.rules.length;c++){let d=k.rules[c],u=le(d.clause,s,h),f=ir(d.tribe);c===0?e.push(`  if (${u}) {`):e.push(`  } else if (${u}) {`),e.push(`    result = ${f}u;`)}k.rules.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px * 4u;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < 4u; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let c=-1;c<=1;c++)for(let d=-1;d<=1;d++){if(d===0&&c===0)continue;let u=Ne(d,c),f=Re("x",d,"COLS"),P=Re("y",c,"ROWS");e.push(`    let ${u} = readCell(${f}, ${P});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & 0xFFu) << (i * 8u));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function Ne(e,r){return`n${r===-1?"T":r===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function Te(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(Ne(t,r));return e}function Re(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function z(e){let r=[];for(let t of e)if(t==="any")for(let n=0;n<m.length;n++)r.push(n);else{let n=T.get(t);n!==void 0&&r.push(n)}return[...new Set(r)]}function ir(e){return e==="any"?0:T.get(e)??0}function or(e){let r=new Set;for(let t of e)Se(t,r);return r}function Se(e,r){switch(e.kind){case"count":{let t=z(e.tribes).sort();r.add(t.join(","));break}case"not":Se(e.clause,r);break;case"and":case"or":for(let t of e.clauses)Se(t,r);break}}function ar(e){let r=new Set;for(let t of e)Pe(t,r);return r}function Pe(e,r){switch(e.kind){case"equality":{let t=z(e.tribe1).sort(),n=z(e.tribe2).sort();r.add(t.join(",")),r.add(n.join(","));break}case"not":Pe(e.clause,r);break;case"and":case"or":for(let t of e.clauses)Pe(t,r);break}}function le(e,r,t){switch(e.kind){case"is":{let n=z(e.tribes);return n.length===0?"false":n.length===m.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case"count":{let n=z(e.tribes).sort(),s=r.get(n.join(","));return`(${s} >= ${e.interval[0]}u && ${s} <= ${e.interval[1]}u)`}case"equality":{let n=z(e.tribe1).sort(),s=z(e.tribe2).sort(),o=t.get(n.join(",")),a=t.get(s.join(","));return`(${o} == ${a})`}case"not":return`!(${le(e.clause,r,t)})`;case"and":return`(${e.clauses.map(s=>le(s,r,t)).join(" && ")})`;case"or":return`(${e.clauses.map(s=>le(s,r,t)).join(" || ")})`;default:return"false"}}var je=48;function ur(){let e=new ArrayBuffer(je),r=new Float32Array(e),t=new Uint32Array(e);r[0]=V.width,r[1]=V.height,r[2]=g,r[3]=p,r[4]=ze,r[6]=Ie,r[7]=Fe,t[8]=m.length,i.queue.writeBuffer(de,0,e)}function pe(){return w*p*4}function Xe(){let e=pe();x=i.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),B=i.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});let r=T.get(K.id)??0,t=r|r<<8|r<<16|r<<24,n=new Uint32Array(w*p);n.fill(t),i.queue.writeBuffer(x,0,n),i.queue.writeBuffer(B,0,n),C=!1}function Ve(){let e=new Uint32Array(256);for(let r=0;r<m.length;r++){let t=m[r].color,n=parseInt(t.substring(0,2),16),s=parseInt(t.substring(2,4),16),o=parseInt(t.substring(4,6),16);e[r]=n|s<<8|o<<16}I&&I.destroy(),I=i.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),i.queue.writeBuffer(I,0,e)}function cr(){let e=i.createShaderModule({code:ve});fe=i.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:he}]},primitive:{topology:"triangle-list"}})}function Ke(){ke=i.createBindGroup({layout:fe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:de}},{binding:1,resource:{buffer:x}},{binding:2,resource:{buffer:I}}]}),_e=i.createBindGroup({layout:fe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:de}},{binding:1,resource:{buffer:B}},{binding:2,resource:{buffer:I}}]})}function He(){let e=sr(),r=i.createShaderModule({code:e});re=i.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),Oe=i.createBindGroup({layout:re.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:B}}]}),Ee=i.createBindGroup({layout:re.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:B}},{binding:1,resource:{buffer:x}}]})}var lr=`
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
`;function dr(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${g}u;
const ROWS: u32 = ${p}u;

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
`}function Ze(){let e=lr.replace("const COLS: u32 = 0u;",`const COLS: u32 = ${g}u;`).replace("const ROWS: u32 = 0u;",`const ROWS: u32 = ${p}u;`),r=i.createShaderModule({code:e});ie=i.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),q=i.createBuffer({size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),Y=i.createBuffer({size:256*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),De=i.createBindGroup({layout:ie.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:q}}]}),qe=i.createBindGroup({layout:ie.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:B}},{binding:1,resource:{buffer:q}}]});let t=i.createShaderModule({code:dr()});oe=i.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),W=i.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),N=i.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Ye=i.createBindGroup({layout:oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:W}}]}),We=i.createBindGroup({layout:oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:B}},{binding:1,resource:{buffer:W}}]})}var Je=176,fr=`
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
`;function Qe(){let e=i.createShaderModule({code:fr});te=i.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),ne=i.createBuffer({size:Je,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Le=i.createBindGroup({layout:te.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:ne}}]}),$e=i.createBindGroup({layout:te.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:B}},{binding:1,resource:{buffer:ne}}]})}function pr(e,r,t,n,s,o,a){let h=T.get(K.id)??0,S=nr++,c=new ArrayBuffer(Je),d=new Int32Array(c),u=new Uint32Array(c);d[0]=r,d[1]=t,u[2]=g,u[3]=p,u[4]=n,u[5]=s,u[6]=o,u[7]=h,u[8]=S,u[9]=a.length,u[10]=0;for(let G=0;G<a.length&&G<32;G++)u[11+G]=a[G];i.queue.writeBuffer(ne,0,c);let f=Math.ceil(n/8),P=e.beginComputePass();P.setPipeline(te),P.setBindGroup(0,C?$e:Le),P.dispatchWorkgroups(f,f),P.end()}function j(e){let r=new Uint8Array(g*p);for(let t=0;t<p;t++)for(let n=0;n<w;n++){let s=e[t*w+n],o=n*4;for(let a=0;a<4&&o+a<g;a++)r[t*g+o+a]=s>>a*8&255}return r}function gr(e){let r=new Uint32Array(w*p);for(let t=0;t<p;t++)for(let n=0;n<w;n++){let s=n*4,o=0;for(let a=0;a<4&&s+a<g;a++)o|=(e[t*g+s+a]&255)<<a*8;r[t*w+n]=o}return r}function L(){let e=C?B:x,r=pe(),t;try{t=i.createBuffer({size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch{return Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=i.createCommandEncoder();return n.copyBufferToBuffer(e,0,t,0,r),i.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let s=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),s})}function br(){let e=g*p,r=e>1e6?10:e>1e5?3:1;if(y<=0)return 60*r;let t=1e3/y,n=Math.max(1,Math.round(t));return Z>0&&Z<1&&(n=Math.max(n,Math.ceil(1/Z))),n*r}function mr(e){if(e.length===0)return e;let r=new Uint8Array(e.length*2),t=0,n=0;for(;n<e.length;){let s=e[n],o=1;for(;n+o<e.length&&e[n+o]===s&&o<255;)o++;r[t++]=o,r[t++]=s,n+=o}return r.slice(0,t)}function hr(e,r){let t=new Uint8Array(r),n=0;for(let s=0;s<e.length;s+=2){let o=e[s],a=e[s+1];t.fill(a,n,n+o),n+=o}return t}function X(e){let r=mr(e);return r.length<e.length?r:e}function Ae(e){let r=g*p;return e.length<r?hr(e,r):e}function $(e){let r=Math.ceil(g/16),t=Math.ceil(p/16),n=new Uint32Array(256);i.queue.writeBuffer(q,0,n);let s=e.beginComputePass();s.setPipeline(ie),s.setBindGroup(0,C?qe:De),s.dispatchWorkgroups(r,t),s.end(),e.copyBufferToBuffer(q,0,Y,0,256*4);let o=new Uint32Array([0]);i.queue.writeBuffer(W,0,o);let a=e.beginComputePass();a.setPipeline(oe),a.setBindGroup(0,C?We:Ye),a.dispatchWorkgroups(r,t),a.end(),e.copyBufferToBuffer(W,0,N,0,4)}function D(){let e=b;if(e===M||v)return;M=e,v=!0;let r=[];r.push(Y.mapAsync(GPUMapMode.READ)),r.push(N.mapAsync(GPUMapMode.READ)),Promise.all(r).then(()=>{let t=T.get(K.id)??0,n={},s=0,o=0,a={},h=new Uint32Array(Y.getMappedRange().slice(0));Y.unmap();let S=0;for(let u=0;u<m.length;u++){let f=h[u]??0;n[m[u].id]=f,u!==t&&(S+=f,f>0&&(ye.set(u,e),xe.add(u)))}if(S>0)for(let u=0;u<m.length;u++){if(u===t)continue;let f=(h[u]??0)/S;f>0&&(s-=f*Math.log2(f),o+=f*f)}for(let u=0;u<m.length;u++){if(u===t)continue;(h[u]??0)>0?a[m[u].id]=null:xe.has(u)?a[m[u].id]=ye.get(u)??0:a[m[u].id]=0}let c=new Uint32Array(N.getMappedRange().slice(0));N.unmap();let d=c[0]??0;v=!1,self.postMessage({type:"metrics",generation:e,population:n,shannonEntropy:s,simpsonIndex:1-o,boundaryLength:d,extinctionTime:a,fps:Z})})}function J(){let e=i.createCommandEncoder(),r=e.beginComputePass();r.setPipeline(re),r.setBindGroup(0,C?Ee:Oe);let t=Math.ceil(w/16),n=Math.ceil(p/16);r.dispatchWorkgroups(t,n),r.end(),i.queue.submit([e.finish()]),C=!C,b++}function Q(){ur();let e=me.getCurrentTexture().createView(),r=i.createCommandEncoder(),t=r.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(fe),t.setBindGroup(0,C?_e:ke),t.draw(3),t.end(),i.queue.submit([r.finish()])}function we(e){if(F>=0){let t=performance.now()+14;for(;b<F&&performance.now()<t;)J(),O++;if(b>=F){if(F=-1,R=Be,y=Ce,_=0,E=0,U&&L().then(n=>{l.push(X(j(n)))}),M=-1,!v){let n=i.createCommandEncoder();$(n),i.queue.submit([n.finish()]),D()}Q(),self.postMessage({type:"stepping",active:!1})}self.requestAnimationFrame(we);return}if(se){let t=se;se=null;let n=i.createCommandEncoder();pr(n,t.centerX,t.centerY,t.brushSize,t.shape,t.fill,t.tribeIds),i.queue.submit([n.finish()])}U&&H&&(H=!1,L().then(t=>{let n=X(j(t)),s=b-A;s>=0&&s<l.length?l[s]=n:l.push(n),l.length=s+1})),ee===0&&(ee=e);let r=e-ee;if(r>=1e3&&(Z=O/(r/1e3),O=0,ee=e),R){let t=!1;_===0&&(_=e);let n=e-_;_=e;let s=br();if(y<=0){let o=performance.now()+14;for(;performance.now()<o;)J(),O++;t=!0}else for(E+=n;E>=y;)J(),O++,E-=y,t=!0;if(t){if(U){let o=!ae,a=o?Ge:Ue;if(o?ue:ce){let S=C?B:x,c=pe(),d=i.createCommandEncoder();d.copyBufferToBuffer(S,0,a,0,c),i.queue.submit([d.finish()]),o?ue=!1:ce=!1,a.mapAsync(GPUMapMode.READ).then(()=>{let u=new Uint32Array(a.getMappedRange()),f=j(u);a.unmap(),o?ue=!0:ce=!0,l.push(X(f))}),ae=!ae}}if(b%s===0||b-M>=s*2){let o=e-be,a=g*p>1e6?3e3:g*p>1e5?2e3:1e3;if((o>=a||be===0)&&!v){be=e;let h=i.createCommandEncoder();$(h),i.queue.submit([h.finish()]),D()}}}}y>0&&Q(),self.requestAnimationFrame(we)}function Me(e){k=e,g=e.cols,p=e.rows,w=Math.ceil(g/4),m=[...e.tribes],T.clear(),m.forEach((r,t)=>T.set(r.id,t))}async function yr(e){V=e;let r=await navigator.gpu.requestAdapter();if(!r)throw new Error("WebGPU adapter not available");i=await r.requestDevice({requiredLimits:{maxBufferSize:r.limits.maxBufferSize,maxStorageBufferBindingSize:r.limits.maxStorageBufferBindingSize}});let t=Math.floor(i.limits.maxBufferSize);self.postMessage({type:"limits",maxCells:t}),me=V.getContext("webgpu"),he=navigator.gpu.getPreferredCanvasFormat(),me.configure({device:i,format:he,alphaMode:"opaque"})}function er(){let e=pe();Ge=i.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Ue=i.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),ae=!1,ue=!0,ce=!0}function xr(){de=i.createBuffer({size:je,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Xe(),Ve(),cr(),Ke(),He(),Qe(),Ze(),er()}function Br(){x?.destroy(),B?.destroy(),q?.destroy(),Y?.destroy(),W?.destroy(),N?.destroy(),Ge?.destroy(),Ue?.destroy(),Xe(),Ve(),He(),Qe(),Ke(),Ze(),er(),l=[],A=b}self.onmessage=async e=>{let r=e.data;switch(r.type){case"init":{Me(r.ruleset),await yr(r.canvas),xr(),R=r.running,y=r.speed<0?0:1e3/r.speed,_=0,E=0,self.requestAnimationFrame(we);break}case"setRuleset":{if(Me(r.ruleset),Br(),b=0,M=-1,l=[],A=0,H=!1,ye=new Map,xe=new Set,!v){let t=i.createCommandEncoder();$(t),i.queue.submit([t.finish()]),D()}break}case"setRunning":R=r.running,r.running&&(_=0,E=0,U&&(H=!0));break;case"setSpeed":y=r.speed<0?0:1e3/r.speed,E=0;break;case"camera":ze=r.scale,Ie=r.offsetX,Fe=r.offsetY;break;case"resize":V.width=r.width,V.height=r.height;break;case"draw":{let t=r.tribes.map(n=>T.get(n)).filter(n=>n!==void 0);if(t.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},s={full:0,spray:1,outline:2};se={centerX:r.x,centerY:r.y,brushSize:r.size,shape:n[r.shape]??0,fill:s[r.fill]??0,tribeIds:t}}break}case"getSnapshot":{L().then(t=>{self.postMessage({type:"snapshot",grid:t,generation:b,cols:g,rows:p},[t.buffer])}).catch(()=>{let t=new Uint32Array(0);self.postMessage({type:"snapshot",grid:t,generation:b,cols:g,rows:p})});break}case"loadSnapshot":{let t=C?B:x;i.queue.writeBuffer(t,0,r.grid),b=r.generation;break}case"setRecording":{r.recording&&!U?(U=!0,l=[],A=b,H=!0):r.recording||(U=!1);break}case"getRecording":{let n=l.map(o=>Ae(o)).map(o=>new Uint8Array(o)),s=n.map(o=>o.buffer).filter(o=>o.byteLength>0);self.postMessage({type:"recording",frames:n,startGeneration:A,cols:g,rows:p},s);break}case"stepBack":{let t=Math.min(r.count,l.length-1);if(t<=0)break;l.splice(l.length-t,t);let n=Ae(l[l.length-1]),s=gr(n),o=C?B:x;if(i.queue.writeBuffer(o,0,s),b=A+l.length-1,M=-1,!v){let a=i.createCommandEncoder();$(a),i.queue.submit([a.finish()]),D()}Q();break}case"stepForward":{if(r.count===1)if(U)L().then(t=>{let n=X(j(t)),s=b-A;s>=0&&s<l.length?l[s]=n:l.push(n),l.length=s+1,J(),O++,L().then(o=>{if(l.push(X(j(o))),M=-1,!v){let a=i.createCommandEncoder();$(a),i.queue.submit([a.finish()]),D()}Q()})});else{if(J(),O++,M=-1,!v){let t=i.createCommandEncoder();$(t),i.queue.submit([t.finish()]),D()}Q()}else self.postMessage({type:"stepping",active:!0}),U?L().then(t=>{let n=X(j(t)),s=b-A;s>=0&&s<l.length?l[s]=n:l.push(n),l.length=s+1,Be=R,Ce=y,F=b+r.count,R=!0,y=0}):(Be=R,Ce=y,F=b+r.count,R=!0,y=0);break}}};
