var at=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var ye={id:"dead",color:"000000"};var n,Te=!1,Ie,ze,ce,V,R=0,M=0,me=0,S=[],H=new Map,G,U,Re,ne,Ae,gt,mt,fe,tt,rt,k=!1,bt=1,ht=0,yt=0,L=!1,_e=!1,T=100,q=0,$=0,g=0,Se,Ce,Bt,xt,It=0,ve=null,ke,St,Ct,ie,ae,we,vt,kt,oe,ue,E=-1,P=!1,D=!1,re=0,Le=new Map,De=new Set,C=!0,W={chunks:[],generationStart:0,generationEnd:0},wt=0,m=[],I=-1,qe=!1,Me=100,A=0,$e=!1,ee,d=0,x=[],v=64,y=0,Mt=3,pe=[],z=[],We="gol-recording",Pe=null,N=0,te=0,Ne=12,h=!1,le=0;var Pt=1024*1024*1024,zt=256*1024*1024,ot=128*1024*1024*1024;function Fe(e){let t=N>0;N+=e;let r=N>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function se(){let e=!z.some(s=>s)&&d>=v,t=te>=Ne,r;if(h){let s=z.some(u=>u),i=te<=Math.floor(Ne/2);r=!(s&&i)}else r=e||t;r!==h&&(h=r,self.postMessage({type:"backpressure",active:r}))}async function de(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??ot/128,ot),r=e.usage??0,s=0,i=0;for(let c of m)c.codec==="raw-packed"?s+=c.storedBytes:i+=c.storedBytes;let u=v*y,l=C?(1+Mt)*u:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:s,compressedBytes:i,gpuBufferMarginBytes:l})}var ge=!1;async function Lt(e){let t=new DecompressionStream("deflate-raw"),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let s=[],i=t.readable.getReader();for(;;){let{done:b,value:o}=await i.read();if(b)break;s.push(o)}let u=0;for(let b of s)u+=b.byteLength;let l=new Uint8Array(u),c=0;for(let b of s)l.set(b,c),c+=b.byteLength;return l.buffer}var K=0,Be=0,nt=0;function Dt(){let e=[],t=me;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${S.map(o=>o.id).join(", ")}`),e.push(`// Rules: ${V.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${R}u;`),e.push(`const ROWS: u32 = ${M}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),e.push(""),e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push("  let wordIdx = y * PACKED_COLS + (x >> 2u);"),e.push("  let shift = (x & 3u) * 8u;"),e.push("  return (gridIn[wordIdx] >> shift) & 0xFFu;"),e.push("}"),e.push("");let r=H.get(ye.id)??0;e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let s=$t(V.rules.map(o=>o.clause)),i=new Map,u=0;for(let o of s){let f=`count_${u++}`;i.set(o,f)}for(let[o,f]of i){let a=o.split(",").map(Number),B=ut().map(_=>`select(0u, 1u, ${a.map(w=>`${_} == ${w}u`).join(" || ")})`);e.push(`  let ${f} = ${B.join(" + ")};`)}s.size>0&&e.push("");let l=Wt(V.rules.map(o=>o.clause)),c=new Map,b=0;for(let o of l)if(i.has(o))c.set(o,i.get(o));else{let f=`eq_count_${b++}`;c.set(o,f)}for(let[o,f]of c){if(i.has(o))continue;let a=o.split(",").map(Number),B=ut().map(_=>`select(0u, 1u, ${a.map(w=>`${_} == ${w}u`).join(" || ")})`);e.push(`  let ${f} = ${B.join(" + ")};`)}l.size>0&&b>0&&e.push(""),e.push(`  var result: u32 = ${r}u;`),e.push("");for(let o=0;o<V.rules.length;o++){let f=V.rules[o],a=Ge(f.clause,i,c),p=qt(f.tribe);o===0?e.push(`  if (${a}) {`):e.push(`  } else if (${a}) {`),e.push(`    result = ${p}u;`)}V.rules.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px * 4u;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < 4u; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let o=-1;o<=1;o++)for(let f=-1;f<=1;f++){if(f===0&&o===0)continue;let a=Gt(f,o),p=ct("x",f,"COLS"),B=ct("y",o,"ROWS");e.push(`    let ${a} = readCell(${p}, ${B});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & 0xFFu) << (i * 8u));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function Gt(e,t){return`n${t===-1?"T":t===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function ut(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(Gt(r,t));return e}function ct(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function Z(e){let t=[];for(let r of e)if(r==="any")for(let s=0;s<S.length;s++)t.push(s);else{let s=H.get(r);s!==void 0&&t.push(s)}return[...new Set(t)]}function qt(e){return e==="any"?0:H.get(e)??0}function $t(e){let t=new Set;for(let r of e)Ye(r,t);return t}function Ye(e,t){switch(e.kind){case"count":{let r=Z(e.tribes).sort();t.add(r.join(","));break}case"not":Ye(e.clause,t);break;case"and":case"or":for(let r of e.clauses)Ye(r,t);break}}function Wt(e){let t=new Set;for(let r of e)Xe(r,t);return t}function Xe(e,t){switch(e.kind){case"equality":{let r=Z(e.tribe1).sort(),s=Z(e.tribe2).sort();t.add(r.join(",")),t.add(s.join(","));break}case"not":Xe(e.clause,t);break;case"and":case"or":for(let r of e.clauses)Xe(r,t);break}}function Ge(e,t,r){switch(e.kind){case"is":{let s=Z(e.tribes);return s.length===0?"false":s.length===S.length?"true":`(${s.map(u=>`selfTribe == ${u}u`).join(" || ")})`}case"count":{let s=Z(e.tribes).sort(),i=t.get(s.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case"equality":{let s=Z(e.tribe1).sort(),i=Z(e.tribe2).sort(),u=r.get(s.join(",")),l=r.get(i.join(","));return`(${u} == ${l})`}case"not":return`!(${Ge(e.clause,t,r)})`;case"and":return`(${e.clauses.map(i=>Ge(i,t,r)).join(" && ")})`;case"or":return`(${e.clauses.map(i=>Ge(i,t,r)).join(" || ")})`;default:return"false"}}var Ut=48;function Nt(){let e=new ArrayBuffer(Ut),t=new Float32Array(e),r=new Uint32Array(e);t[0]=ce.width,t[1]=ce.height,t[2]=R,t[3]=M,t[4]=bt,t[6]=ht,t[7]=yt,r[8]=S.length,n.queue.writeBuffer(Re,0,e)}function be(){return me*M*4}function je(){let e=be();G=n.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),U=n.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});let t=n.createCommandEncoder();t.clearBuffer(G),t.clearBuffer(U),n.queue.submit([t.finish()]),k=!1}function He(){let e=new Uint32Array(256);for(let t=0;t<S.length;t++){let r=S[t].color,s=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),u=parseInt(r.substring(4,6),16);e[t]=s|i<<8|u<<16}ne&&ne.destroy(),ne=n.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),n.queue.writeBuffer(ne,0,e)}function Yt(){let e=n.createShaderModule({code:at});Ae=n.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:ze}]},primitive:{topology:"triangle-list"}})}function Ve(){gt=n.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Re}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:ne}}]}),mt=n.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Re}},{binding:1,resource:{buffer:U}},{binding:2,resource:{buffer:ne}}]})}function Ke(){let e=Dt(),t=n.createShaderModule({code:e});fe=n.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),tt=n.createBindGroup({layout:fe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:U}}]}),rt=n.createBindGroup({layout:fe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:G}}]})}var Xt=`
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
`;function jt(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${R}u;
const ROWS: u32 = ${M}u;

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
`}function Qe(){let e=Xt.replace("const COLS: u32 = 0u;",`const COLS: u32 = ${R}u;`).replace("const ROWS: u32 = 0u;",`const ROWS: u32 = ${M}u;`),t=n.createShaderModule({code:e});ke=n.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),ie=n.createBuffer({size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),ae=n.createBuffer({size:256*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),St=n.createBindGroup({layout:ke.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:ie}}]}),Ct=n.createBindGroup({layout:ke.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:ie}}]});let r=n.createShaderModule({code:jt()});we=n.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),oe=n.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),ue=n.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),vt=n.createBindGroup({layout:we.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:oe}}]}),kt=n.createBindGroup({layout:we.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:oe}}]})}var Tt=176,Ht=`
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
`;function Ze(){let e=n.createShaderModule({code:Ht});Se=n.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),Ce=n.createBuffer({size:Tt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Bt=n.createBindGroup({layout:Se.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:Ce}}]}),xt=n.createBindGroup({layout:Se.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:Ce}}]})}function Vt(e,t,r,s,i,u,l){let c=H.get(ye.id)??0,b=It++,o=new ArrayBuffer(Tt),f=new Int32Array(o),a=new Uint32Array(o);f[0]=t,f[1]=r,a[2]=R,a[3]=M,a[4]=s,a[5]=i,a[6]=u,a[7]=c,a[8]=b,a[9]=l.length,a[10]=0;for(let _=0;_<l.length&&_<32;_++)a[11+_]=l[_];n.queue.writeBuffer(Ce,0,o);let p=Math.ceil(s/8),B=e.beginComputePass();B.setPipeline(Se),B.setBindGroup(0,k?xt:Bt),B.dispatchWorkgroups(p,p),B.end()}function Kt(){let e=k?U:G,t=be(),r;try{r=n.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let s=n.createCommandEncoder();return s.copyBufferToBuffer(e,0,r,0,t),n.queue.submit([s.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function Qt(){y=be();let e=Math.min(zt,n.limits.maxBufferSize,n.limits.maxStorageBufferBindingSize);v=Math.max(1,Math.floor(e/y))}function Je(){let e=Math.min(n.limits.maxBufferSize,n.limits.maxStorageBufferBindingSize),t=y<=Pt;self.postMessage({type:"limits",maxBytes:e,frameByteSize:y,recordingAvailable:t})}function J(){return y>Pt||te>=Ne?!1:d<v?!0:pe.some((e,t)=>z[t]&&e.mapState==="unmapped")}function X(e){if(d>=v)return;let t=k?U:G,r=d*y,s=n.createCommandEncoder();s.copyBufferToBuffer(t,0,ee,r,y),n.queue.submit([s.finish()]),x.push(e),d++}function j(){if(d===0)return;let e=z.indexOf(!0);if(e<0)return;z[e]=!1;let t=pe[e];if(t.mapState!=="unmapped"){z[e]=!0;return}let r=d*y,s=wt++,i=[...x],u=i[0],l=i[i.length-1],c=`chunk-${String(s).padStart(6,"0")}.bin`,b=d,o=n.createCommandEncoder();o.copyBufferToBuffer(ee,0,t,0,r),n.queue.submit([o.finish()]);let f={chunkId:s,generationStart:u,generationEnd:l,blockCount:b,codec:"raw-packed",uncompressedBytes:r,storedBytes:r,generations:i,filename:c};Fe(1),te++,se();let a=le;t.mapAsync(GPUMapMode.READ).then(async()=>{let p=t.getMappedRange(),B=new ArrayBuffer(r);new Uint8Array(B).set(new Uint8Array(p,0,r)),t.unmap(),a===le&&(z[e]=!0,se(),m.push(f),st(),Zt(f,B).then(()=>{a===le&&(te--,se(),Fe(-1),de(),self.postMessage({type:"chunkSealed",filename:f.filename,rawBytes:r}),ge&&N===0&&(ge=!1,At()))}))}).catch(()=>{a===le&&(z[e]=!0,te--,se(),Fe(-1))}),d=0,x=[]}function st(){m.length>0&&(W.generationStart=m[0].generationStart,W.generationEnd=m[m.length-1].generationEnd),x.length>0&&(m.length===0&&(W.generationStart=x[0]),W.generationEnd=x[x.length-1]),W.chunks=[...m]}function Ee(e){le++,wt=0,d=0,x=[],m=[],te=0,N>0&&(N=0,self.postMessage({type:"chunksSaving",active:!1})),h&&(h=!1,self.postMessage({type:"backpressure",active:!1})),ge=!1,W={chunks:[],generationStart:e,generationEnd:e},Rt(),de()}async function it(){return Pe||(Pe=await(await navigator.storage.getDirectory()).getDirectoryHandle(We,{create:!0})),Pe}async function Zt(e,t){let i=await(await(await it()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function Jt(e){let t=await it();for(let r of e)try{await t.removeEntry(r)}catch(s){console.warn("Failed to remove OPFS entry:",r,s)}}async function Rt(){let e=await navigator.storage.getDirectory();try{await e.removeEntry(We,{recursive:!0})}catch(t){console.warn("Failed to remove OPFS directory:",t)}Pe=await e.getDirectoryHandle(We,{create:!0})}function At(){st(),self.postMessage({type:"recording",manifest:{chunks:m.map(e=>({...e,generations:[...e.generations]})),generationStart:W.generationStart,generationEnd:W.generationEnd},cols:R,rows:M})}function et(){return d>0?x[d-1]!==g:m.length>0?m[m.length-1].generationEnd!==g:!0}function _t(){if(!ve)return;let e=ve;ve=null;let t=n.createCommandEncoder();Vt(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),n.queue.submit([t.finish()]),C&&d>0&&x[d-1]===g&&(d--,x.pop(),X(g))}async function er(e,t="raw-packed"){let u=await(await(await(await it()).getFileHandle(e)).getFile()).arrayBuffer();return t==="deflate-raw"?Lt(u):u}function lt(){let e=d;for(let t of m)e+=t.blockCount;return e}function O(e){let t=Math.ceil(R/16),r=Math.ceil(M/16),s=new Uint32Array(256);n.queue.writeBuffer(ie,0,s);let i=e.beginComputePass();i.setPipeline(ke),i.setBindGroup(0,k?Ct:St),i.dispatchWorkgroups(t,r),i.end(),e.copyBufferToBuffer(ie,0,ae,0,256*4);let u=new Uint32Array([0]);n.queue.writeBuffer(oe,0,u);let l=e.beginComputePass();l.setPipeline(we),l.setBindGroup(0,k?kt:vt),l.dispatchWorkgroups(t,r),l.end(),e.copyBufferToBuffer(oe,0,ue,0,4)}function F(){let e=g;if(e===E||P)return;E=e,P=!0;let t=[];t.push(ae.mapAsync(GPUMapMode.READ)),t.push(ue.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=H.get(ye.id)??0,s={},i=0,u=0,l={},c=new Uint32Array(ae.getMappedRange().slice(0));ae.unmap();let b=0;for(let a=0;a<S.length;a++){let p=c[a]??0;s[S[a].id]=p,a!==r&&(b+=p,p>0&&(Le.set(a,e),De.add(a)))}if(b>0)for(let a=0;a<S.length;a++){if(a===r)continue;let p=(c[a]??0)/b;p>0&&(i-=p*Math.log2(p),u+=p*p)}for(let a=0;a<S.length;a++){if(a===r)continue;(c[a]??0)>0?l[S[a].id]=null:De.has(a)?l[S[a].id]=Le.get(a)??0:l[S[a].id]=0}let o=new Uint32Array(ue.getMappedRange().slice(0));ue.unmap();let f=o[0]??0;if(P=!1,self.postMessage({type:"metrics",generation:e,population:s,shannonEntropy:i,simpsonIndex:1-u,boundaryLength:f,extinctionTime:l,totalFrames:lt(),fps:nt,canStepBack:lt()>1,recordingBytes:m.reduce((a,p)=>a+p.storedBytes,0),recordingRawBytes:m.reduce((a,p)=>a+p.uncompressedBytes,0)}),D){D=!1,E=-1;let a=n.createCommandEncoder();O(a),n.queue.submit([a.finish()]),F()}}).catch(()=>{P=!1})}function ft(){let e=R*M;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function dt(e){if(e<=0)return;let t=Math.ceil(me/16),r=Math.ceil(M/16),s=n.createCommandEncoder();for(let i=0;i<e;i++){let u=s.beginComputePass();u.setPipeline(fe),u.setBindGroup(0,k?rt:tt),u.dispatchWorkgroups(t,r),u.end(),k=!k,g++}n.queue.submit([s.finish()]),K+=e}function xe(){self.postMessage({type:"generation",generation:g,fps:nt})}function Ue(){let e=n.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(fe),t.setBindGroup(0,k?rt:tt);let r=Math.ceil(me/16),s=Math.ceil(M/16);t.dispatchWorkgroups(r,s),t.end(),n.queue.submit([e.finish()]),k=!k,g++}function Q(){Nt();let e=Ie.getCurrentTexture().createView(),t=n.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(Ae),r.setBindGroup(0,k?mt:gt),r.draw(3),r.end(),n.queue.submit([t.finish()])}function Y(e){if(_e||Te){self.requestAnimationFrame(Y);return}Be===0&&(Be=e);let t=e-Be;if(t>=1e3&&(nt=K/(t/1e3),K=0,Be=e),I>=0){if(C){let r=!1,s=performance.now()+14;for(;g<I&&performance.now()<s;){if(!J()){r=!0;break}d>=v&&j(),Ue(),K++,X(g)}if(r){h||(h=!0,self.postMessage({type:"backpressure",active:!0})),e-A>=1e3&&(A=e,xe()),n.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(Y)});return}h&&(h=!1,self.postMessage({type:"backpressure",active:!1}))}else{let r=Math.min(ft(),I-g);dt(r)}if(e-A>=1e3&&(A=e,xe()),g>=I){if(I=-1,L=qe,T=Me,$=0,q=0,A=0,h&&(h=!1,self.postMessage({type:"backpressure",active:!1})),E=-1,P)D=!0;else{let r=n.createCommandEncoder();O(r),n.queue.submit([r.finish()]),F()}Q(),self.postMessage({type:"stepping",active:!1}),self.requestAnimationFrame(Y)}else C?self.requestAnimationFrame(Y):n.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(Y)});return}if(_t(),L){C&&et()&&J()&&(d>=v&&j(),X(g));let r=!1;$===0&&($=e);let s=e-$;if($=e,T<=0){if(C){let i=!1,u=performance.now()+14;for(;performance.now()<u;){if(!J()){i=!0;break}d>=v&&j(),Ue(),K++,r=!0,X(g)}if(i){if(h||(h=!0,self.postMessage({type:"backpressure",active:!0})),e-A>=1e3&&(A=e,xe()),r&&(e-re>=1e3||re===0)&&!P){re=e;let c=n.createCommandEncoder();O(c),n.queue.submit([c.finish()]),F()}n.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(Y)});return}h&&(h=!1,self.postMessage({type:"backpressure",active:!1}))}else{let i=performance.now()+14,u=ft();for(;performance.now()<i;)dt(u),r=!0}e-A>=1e3&&(A=e,xe())}else for(q+=s;q>=T;){if(C){if(!J())break;d>=v&&j()}Ue(),K++,q-=T,r=!0,C&&X(g)}if(r&&(e-re>=1e3||re===0)&&!P){re=e;let u=n.createCommandEncoder();O(u),n.queue.submit([u.finish()]),F()}}T>0&&!$e&&Q(),self.requestAnimationFrame(Y)}function pt(e){V=e,R=e.cols,M=e.rows,me=Math.ceil(R/4),S=[...e.tribes],H.clear(),S.forEach((t,r)=>H.set(t.id,r))}async function tr(e){ce=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");n=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),Te=!1,n.lost.then(s=>{Te=!0,L=!1,_e=!0;let i=s.message||s.reason||"unknown";self.postMessage({type:"deviceLost",reason:i})});let r=Math.min(n.limits.maxBufferSize,n.limits.maxStorageBufferBindingSize);self.postMessage({type:"limits",maxBytes:r,frameByteSize:0,recordingAvailable:!0}),Ie=ce.getContext("webgpu"),ze=navigator.gpu.getPreferredCanvasFormat(),Ie.configure({device:n,format:ze,alphaMode:"opaque"})}function Et(){Qt(),ee=n.createBuffer({size:v*y,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),d=0,x=[]}function Ot(){let e=v*y;pe=[],z=[];for(let t=0;t<Mt;t++)pe.push(n.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})),z.push(!0)}function rr(){Rt()}function nr(){Re=n.createBuffer({size:Ut,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),je(),He(),Yt(),Ve(),Ke(),Ze(),Qe(),rr(),Et(),Ot(),Je()}async function sr(){if(_e=!0,self.postMessage({type:"rebuilding",active:!0}),await new Promise(e=>setTimeout(e,0)),!Te){G?.destroy(),U?.destroy(),ie?.destroy(),ae?.destroy(),oe?.destroy(),ue?.destroy(),ee?.destroy();for(let e of pe)e?.destroy();try{je(),He(),Ke(),Ze(),Ve(),Qe(),Et(),Ot(),Je(),Ee(g)}catch(e){let t=e instanceof Error?e.message:String(e);self.postMessage({type:"gpuError",reason:t});try{je(),He(),Ke(),Ze(),Ve(),Qe(),C=!1,v=0,y=be(),Je(),Ee(g)}catch(r){console.warn("GPU recovery also failed, device may be lost:",r);return}}_e=!1,self.postMessage({type:"rebuilding",active:!1})}}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{pt(t.ruleset),await tr(t.canvas),nr(),L=t.running,T=t.speed<0?0:1e3/t.speed,$=0,q=0,self.requestAnimationFrame(Y);break}case"setRuleset":{if(pt(t.ruleset),await sr(),g=0,E=-1,Ee(0),Le=new Map,De=new Set,P)D=!0;else{let r=n.createCommandEncoder();O(r),n.queue.submit([r.finish()]),F()}break}case"setRunning":if(!t.running&&I>=0){if(I=-1,L=!1,T=Me,$=0,q=0,h&&se(),E=-1,P)D=!0;else{let r=n.createCommandEncoder();O(r),n.queue.submit([r.finish()]),F()}Q(),self.postMessage({type:"stepping",active:!1});break}if(L=t.running,t.running)$=0,q=0;else if(h&&se(),E=-1,P)D=!0;else{let r=n.createCommandEncoder();O(r),n.queue.submit([r.finish()]),F()}break;case"setSpeed":{let r=t.speed<0?0:1e3/t.speed;T<=0&&r>0&&($e=!0,n.queue.onSubmittedWorkDone().then(()=>{$e=!1,Q()})),T=r,q=0,A=0;break}case"camera":bt=t.scale,ht=t.offsetX,yt=t.offsetY;break;case"resize":ce.width=t.width,ce.height=t.height;break;case"draw":{let r=t.tribes.map(s=>H.get(s)).filter(s=>s!==void 0);if(r.length>0){let s={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};ve={centerX:t.x,centerY:t.y,brushSize:t.size,shape:s[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{Kt().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:g,cols:R,rows:M},[r.buffer])}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:g,cols:R,rows:M})});break}case"loadSnapshot":{let r=k?U:G,s=be();if(t.grid.byteLength!==s)break;n.queue.writeBuffer(r,0,t.grid),g=t.generation,Ee(t.generation);break}case"setRecording":{t.recording&&!C?(C=!0,de()):t.recording||(C=!1);break}case"getRecording":{if(ge)break;d>0&&j(),N>0?ge=!0:At();break}case"stepBack":{let r=0;for(let c of m)r+=c.blockCount;let s=r+d,i=Math.min(t.count,s-1);if(i<=0)break;let u=s-1-i,l=k?U:G;if(u>=r){let c=u-r;d=c+1,x.length=d,g=x[c];let b=n.createCommandEncoder();b.copyBufferToBuffer(ee,c*y,l,0,y),n.queue.submit([b.finish()])}else{if(N>0){await new Promise(w=>{let he=setInterval(()=>{N===0&&(clearInterval(he),w())},10)}),r=0;for(let w of m)r+=w.blockCount}let c=0,b=0,o=0;for(let w=0;w<m.length;w++){let he=m[w];if(u<c+he.blockCount){b=w,o=u-c;break}c+=he.blockCount}let f=m[b],a=await er(f.filename,f.codec),p=(o+1)*y;n.queue.writeBuffer(ee,0,new Uint8Array(a,0,p)),d=o+1,x=f.generations.slice(0,o+1),g=x[o];let B=n.createCommandEncoder();B.copyBufferToBuffer(ee,o*y,l,0,y),n.queue.submit([B.finish()]);let Oe=m.splice(b).map(w=>w.filename);Jt(Oe)}if(st(),de(),E=-1,P)D=!0;else{let c=n.createCommandEncoder();O(c),n.queue.submit([c.finish()]),F()}Q();break}case"stepForward":{if(_t(),t.count===1){if(C&&et()&&J()&&(d>=v&&j(),X(g)),Ue(),K++,C&&J()&&(d>=v&&j(),X(g)),E=-1,P)D=!0;else{let r=n.createCommandEncoder();O(r),n.queue.submit([r.finish()]),F()}Q()}else self.postMessage({type:"stepping",active:!0}),C&&et()&&J()&&(d>=v&&j(),X(g)),qe=L,Me=T,I=g+t.count,L=!0,T=0,A=0;break}case"cancelStepping":{if(I>=0){if(I=-1,L=qe,T=Me,$=0,q=0,E=-1,P)D=!0;else{let r=n.createCommandEncoder();O(r),n.queue.submit([r.finish()]),F()}Q(),self.postMessage({type:"stepping",active:!1})}break}case"updateChunkCodec":{let r=m.find(s=>s.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,W.chunks=[...m],de());break}case"getUncompressedChunks":{let r=m.filter(s=>s.codec==="raw-packed").map(s=>({filename:s.filename,rawBytes:s.uncompressedBytes}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};
