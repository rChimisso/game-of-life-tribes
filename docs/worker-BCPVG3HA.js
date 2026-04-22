var Xe=1073741824;var kt=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var Pe={id:"dead",color:"000000"};var s,ie=!1,Ve,Ke,ae,J,T=0,M=0,Ce=0,w=[],K=new Map,R,G,ve,ue,qe,It,Lt,ye,bt,ht,k=!1,Dt=1,zt=0,qt=0,A=!1,Z=!1,C=100,N=0,Y=0,b=0,Ue,ce,$t,Nt,ur=0,Te=null,Ae,Yt,Wt,fe,de,_e,Ht,Xt,pe,ge,D=-1,U=!1,$=!1,oe=0,Ze=new Map,Qe=new Set,B=!0,W={chunks:[],generationStart:0,generationEnd:0},jt=0,h=[],_=-1,Je=!1,Ee=100,F=0,et=!1,me=!1;function Vt(){return A&&C<=0&&_<0&&!B}function tt(){Z||ie||me||!Vt()||L(performance.now())}function Fe(){Z||ie||self.requestAnimationFrame(L)}var E=null,f=0,v=[],y=64,p=0,We=3,X=[],O=[],be="gol-recording",Oe=null,H=0,se=0,Mt=12,S=!1,he=0;var yt=256,cr=yt*Uint32Array.BYTES_PER_ELEMENT,rt=yt*Uint32Array.BYTES_PER_ELEMENT,nt=Uint32Array.BYTES_PER_ELEMENT,lr=256*1024*1024,fr=64*1024*1024,dr=512*1024*1024,pr=512*1024*1024,Pt=128*1024*1024*1024,Ie=0,Le=0,Be=[];async function Kt(){await s.queue.onSubmittedWorkDone()}function Rt(e){Ie=0,Le=2+(e?1+We:0),Be=[]}async function $e(){if(Be.length===0)return;let e=s.createCommandEncoder();for(let t of Be)e.clearBuffer(t);s.queue.submit([e.finish()]),await Kt(),Be=[]}async function Ne(e,t){!Z||Le<=0||(Ie+=e,Le--,Be.push(t),Ie>=gr()&&Le>0&&(await $e(),Ie=0))}function gr(){return Math.min(we(),pr)}function we(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function Bt(){return Math.min(we(),1073741824)}function Zt(){return Math.max(we()*2,Bt()*6)}function Q(){return p>0&&p<=Bt()}function mr(){return p<=0?0:p*2+vt+cr+xt+rt*2+nt*2}function br(){return y<1||p<=0?0:y*p*(1+We)}function Ye(){E?.destroy(),E=null;for(let e of X)e?.destroy();X=[],O=[],y=0,f=0,v=[]}function Gt(){R?.destroy(),G?.destroy(),fe?.destroy(),de?.destroy(),pe?.destroy(),ge?.destroy(),ce?.destroy(),Ye()}function je(e){let t=H>0;H+=e;let r=H>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function le(){if(y<1||X.length===0){S&&(S=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=er(),t=!O.some(i=>i)&&f>=y,r=se>=e,n;if(S){let i=O.some(l=>l),u=se<=Math.floor(e/2);n=!(i&&u)}else n=t||r;n!==S&&(S=n,self.postMessage({type:"backpressure",active:n}))}async function Se(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??Pt/128,Pt),r=e.usage??0,n=0,i=0;for(let c of h)c.codec==="raw-packed"?n+=c.storedBytes:i+=c.storedBytes;let u=y*p,l=B?(1+We)*u:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:l})}var xe=!1;async function hr(e){let t=new DecompressionStream("deflate-raw"),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:g,value:o}=await i.read();if(g)break;n.push(o)}let u=0;for(let g of n)u+=g.byteLength;let l=new Uint8Array(u),c=0;for(let g of n)l.set(g,c),c+=g.byteLength;return l.buffer}var ee=0,Re=0,St=0;function yr(){let e=[],t=Ce;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${w.map(o=>o.id).join(", ")}`),e.push(`// Rules: ${J.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${T}u;`),e.push(`const ROWS: u32 = ${M}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),e.push(""),e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push("  let wordIdx = y * PACKED_COLS + (x >> 2u);"),e.push("  let shift = (x & 3u) * 8u;"),e.push("  return (gridIn[wordIdx] >> shift) & 0xFFu;"),e.push("}"),e.push("");let r=K.get(Pe.id)??0;e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let n=Sr(J.rules.map(o=>o.clause)),i=new Map,u=0;for(let o of n){let d=`count_${u++}`;i.set(o,d)}for(let[o,d]of i){let a=o.split(",").map(Number),x=Ut().map(I=>`select(0u, 1u, ${a.map(P=>`${I} == ${P}u`).join(" || ")})`);e.push(`  let ${d} = ${x.join(" + ")};`)}n.size>0&&e.push("");let l=vr(J.rules.map(o=>o.clause)),c=new Map,g=0;for(let o of l)if(i.has(o))c.set(o,i.get(o));else{let d=`eq_count_${g++}`;c.set(o,d)}for(let[o,d]of c){if(i.has(o))continue;let a=o.split(",").map(Number),x=Ut().map(I=>`select(0u, 1u, ${a.map(P=>`${I} == ${P}u`).join(" || ")})`);e.push(`  let ${d} = ${x.join(" + ")};`)}l.size>0&&g>0&&e.push(""),e.push(`  var result: u32 = ${r}u;`),e.push("");for(let o=0;o<J.rules.length;o++){let d=J.rules[o],a=De(d.clause,i,c),m=Br(d.tribe);o===0?e.push(`  if (${a}) {`):e.push(`  } else if (${a}) {`),e.push(`    result = ${m}u;`)}J.rules.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px * 4u;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < 4u; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let o=-1;o<=1;o++)for(let d=-1;d<=1;d++){if(d===0&&o===0)continue;let a=Qt(d,o),m=Tt("x",d,"COLS"),x=Tt("y",o,"ROWS");e.push(`    let ${a} = readCell(${m}, ${x});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & 0xFFu) << (i * 8u));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function Qt(e,t){return`n${t===-1?"T":t===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function Ut(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(Qt(r,t));return e}function Tt(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function re(e){let t=[];for(let r of e)if(r==="any")for(let n=0;n<w.length;n++)t.push(n);else{let n=K.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function Br(e){return e==="any"?0:K.get(e)??0}function Sr(e){let t=new Set;for(let r of e)st(r,t);return t}function st(e,t){switch(e.kind){case"count":{let r=re(e.tribes).sort();t.add(r.join(","));break}case"not":st(e.clause,t);break;case"and":case"or":for(let r of e.clauses)st(r,t);break}}function vr(e){let t=new Set;for(let r of e)it(r,t);return t}function it(e,t){switch(e.kind){case"equality":{let r=re(e.tribe1).sort(),n=re(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case"not":it(e.clause,t);break;case"and":case"or":for(let r of e.clauses)it(r,t);break}}function De(e,t,r){switch(e.kind){case"is":{let n=re(e.tribes);return n.length===0?"false":n.length===w.length?"true":`(${n.map(u=>`selfTribe == ${u}u`).join(" || ")})`}case"count":{let n=re(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case"equality":{let n=re(e.tribe1).sort(),i=re(e.tribe2).sort(),u=r.get(n.join(",")),l=r.get(i.join(","));return`(${u} == ${l})`}case"not":return`!(${De(e.clause,t,r)})`;case"and":return`(${e.clauses.map(i=>De(i,t,r)).join(" && ")})`;case"or":return`(${e.clauses.map(i=>De(i,t,r)).join(" || ")})`;default:return"false"}}var vt=48;function at(){ve?.destroy(),ve=s.createBuffer({size:vt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function xr(){let e=new ArrayBuffer(vt),t=new Float32Array(e),r=new Uint32Array(e);t[0]=ae.width,t[1]=ae.height,t[2]=T,t[3]=M,t[4]=Dt,t[6]=zt,t[7]=qt,r[8]=w.length,s.queue.writeBuffer(ve,0,e)}function ke(){return Ce*M*4}async function ot(){let e=ke();R=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Ne(e,R),G=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Ne(e,G);let t=s.createCommandEncoder();t.clearBuffer(R),t.clearBuffer(G),s.queue.submit([t.finish()]),k=!1}function ut(){let e=new Uint32Array(yt);for(let t=0;t<w.length;t++){let r=w[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),u=parseInt(r.substring(4,6),16);e[t]=n|i<<8|u<<16}ue&&ue.destroy(),ue=s.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(ue,0,e)}function ct(){let e=s.createShaderModule({code:kt});qe=s.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:Ke}]},primitive:{topology:"triangle-list"}})}function lt(){It=s.createBindGroup({layout:qe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ve}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:ue}}]}),Lt=s.createBindGroup({layout:qe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ve}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:ue}}]})}function ft(){let e=yr(),t=s.createShaderModule({code:e});ye=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),bt=s.createBindGroup({layout:ye.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:G}}]}),ht=s.createBindGroup({layout:ye.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:R}}]})}var Cr=`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = 0u; // placeholder, replaced at creation time
const ROWS: u32 = 0u; // placeholder, replaced at creation time

var<workgroup> localHist: array<atomic<u32>, 256>;

fn readCell(x: u32, y: u32) -> u32 {
  let packed_cols = (COLS + 3u) / 4u;
  let wordIdx = y * packed_cols + (x >> 2u);
  let shift = (x & 3u) * 8u;
  return (grid[wordIdx] >> shift) & 0xFFu;
}

@compute @workgroup_size(16, 16)
fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32
) {
  // Cooperatively zero the workgroup-local histogram (256 bins, 256 threads).
  atomicStore(&localHist[lid], 0u);
  workgroupBarrier();

  let x = gid.x;
  let y = gid.y;
  if (x < COLS && y < ROWS) {
    let tribe = readCell(x, y);
    atomicAdd(&localHist[tribe], 1u);
  }
  workgroupBarrier();

  // Flush nonzero local bins to the global histogram.
  let count = atomicLoad(&localHist[lid]);
  if (count > 0u) {
    atomicAdd(&hist[lid], count);
  }
}
`;function wr(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${T}u;
const ROWS: u32 = ${M}u;

var<workgroup> localCount: atomic<u32>;

fn readCell(x: u32, y: u32) -> u32 {
  let packed_cols = (COLS + 3u) / 4u;
  let wordIdx = y * packed_cols + (x >> 2u);
  let shift = (x & 3u) * 8u;
  return (grid[wordIdx] >> shift) & 0xFFu;
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
`}function dt(){let e=Cr.replace("const COLS: u32 = 0u;",`const COLS: u32 = ${T}u;`).replace("const ROWS: u32 = 0u;",`const ROWS: u32 = ${M}u;`),t=s.createShaderModule({code:e});Ae=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),fe=s.createBuffer({size:rt,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),de=s.createBuffer({size:rt,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Yt=s.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:fe}}]}),Wt=s.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:fe}}]});let r=s.createShaderModule({code:wr()});_e=s.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),pe=s.createBuffer({size:nt,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),ge=s.createBuffer({size:nt,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Ht=s.createBindGroup({layout:_e.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:pe}}]}),Xt=s.createBindGroup({layout:_e.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:pe}}]})}var xt=176,kr=`
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
`;function pt(){let e=s.createShaderModule({code:kr});Ue=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),ce?.destroy(),ce=s.createBuffer({size:xt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),$t=s.createBindGroup({layout:Ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:ce}}]}),Nt=s.createBindGroup({layout:Ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:ce}}]})}function Mr(e,t,r,n,i,u,l){let c=K.get(Pe.id)??0,g=ur++,o=new ArrayBuffer(xt),d=new Int32Array(o),a=new Uint32Array(o);d[0]=t,d[1]=r,a[2]=T,a[3]=M,a[4]=n,a[5]=i,a[6]=u,a[7]=c,a[8]=g,a[9]=l.length,a[10]=0;for(let I=0;I<l.length&&I<32;I++)a[11+I]=l[I];s.queue.writeBuffer(ce,0,o);let m=Math.ceil(n/8),x=e.beginComputePass();x.setPipeline(Ue),x.setBindGroup(0,k?Nt:$t),x.dispatchWorkgroups(m,m),x.end()}function Pr(){let e=k?G:R,t=ke(),r;try{r=s.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder();return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function Jt(){if(p=ke(),!Q()){y=0;return}let e=Rr();y=Math.max(1,Math.floor(e/p))}function Rr(){return p>=fr?p:Math.min(Math.max(lr,p),Bt())}function er(){if(y<1||p<=0)return Mt;let e=Math.max(p,y*p),t=Math.floor(dr/e);return Math.max(1,Math.min(Mt,t||1))}function gt(){let e=Q();self.postMessage({type:"limits",maxBytes:we(),vramBudgetBytes:Zt(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:mr(),vramRecordingBytes:br()})}function ne(){return!Q()||y<1||E===null||X.length===0||se>=er()?!1:f<y?!0:X.some((e,t)=>O[t]&&e.mapState==="unmapped")}function j(e){if(y<1||E===null||f>=y)return;let t=k?G:R,r=f*p,n=s.createCommandEncoder();n.copyBufferToBuffer(t,0,E,r,p),s.queue.submit([n.finish()]),v.push(e),f++}function V(){if(E===null||f===0||X.length===0)return;let e=O.indexOf(!0);if(e<0)return;O[e]=!1;let t=X[e];if(t.mapState!=="unmapped"){O[e]=!0;return}let r=f*p,n=jt++,i=[...v],u=i[0],l=i[i.length-1],c=`chunk-${String(n).padStart(6,"0")}.bin`,g=f,o=s.createCommandEncoder();o.copyBufferToBuffer(E,0,t,0,r),s.queue.submit([o.finish()]);let d={chunkId:n,generationStart:u,generationEnd:l,blockCount:g,codec:"raw-packed",uncompressedBytes:r,storedBytes:r,generations:i,filename:c};je(1),se++,le();let a=he;t.mapAsync(GPUMapMode.READ).then(async()=>{let m=t.getMappedRange(),x=new ArrayBuffer(r);new Uint8Array(x).set(new Uint8Array(m,0,r)),t.unmap(),a===he&&(O[e]=!0,le(),h.push(d),Ct(),Gr(d,x).then(()=>{a===he&&(se--,le(),je(-1),Se(),self.postMessage({type:"chunkSealed",filename:d.filename,rawBytes:r}),xe&&H===0&&(xe=!1,rr()))}))}).catch(()=>{a===he&&(O[e]=!0,se--,le(),je(-1))}),f=0,v=[]}function Ct(){h.length>0&&(W.generationStart=h[0].generationStart,W.generationEnd=h[h.length-1].generationEnd),v.length>0&&(h.length===0&&(W.generationStart=v[0]),W.generationEnd=v[v.length-1]),W.chunks=[...h]}function At(e){he++,jt=0,f=0,v=[],h=[],se=0,H>0&&(H=0,self.postMessage({type:"chunksSaving",active:!1})),S&&(S=!1,self.postMessage({type:"backpressure",active:!1})),xe=!1,W={chunks:[],generationStart:e,generationEnd:e},tr(),Se()}async function wt(){return Oe||(Oe=await(await navigator.storage.getDirectory()).getDirectoryHandle(be,{create:!0})),Oe}async function Gr(e,t){let i=await(await(await wt()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function Ur(e){let t=await wt();for(let r of e)try{console.log(`Trying to remove OPFS entry ${r}...`),await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function tr(){let e=await navigator.storage.getDirectory();try{console.log(`Trying to remove OPFS directory ${be}...`),await e.removeEntry(be,{recursive:!0})}catch(t){console.warn(`Failed to remove OPFS directory ${be}:`,t)}Oe=await e.getDirectoryHandle(be,{create:!0})}function rr(){Ct(),self.postMessage({type:"recording",manifest:{chunks:h.map(e=>({...e,generations:[...e.generations]})),generationStart:W.generationStart,generationEnd:W.generationEnd},cols:T,rows:M})}function mt(){return f>0?v[f-1]!==b:h.length>0?h[h.length-1].generationEnd!==b:!0}function nr(){if(!Te)return;let e=Te;Te=null;let t=s.createCommandEncoder();Mr(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),B&&f>0&&v[f-1]===b&&(f--,v.pop(),j(b))}async function Tr(e,t="raw-packed"){let u=await(await(await(await wt()).getFileHandle(e)).getFile()).arrayBuffer();return t==="deflate-raw"?hr(u):u}function _t(){let e=f;for(let t of h)e+=t.blockCount;return e}function z(e){let t=Math.ceil(T/16),r=Math.ceil(M/16),n=new Uint32Array(256);s.queue.writeBuffer(fe,0,n);let i=e.beginComputePass();i.setPipeline(Ae),i.setBindGroup(0,k?Wt:Yt),i.dispatchWorkgroups(t,r),i.end(),e.copyBufferToBuffer(fe,0,de,0,256*4);let u=new Uint32Array([0]);s.queue.writeBuffer(pe,0,u);let l=e.beginComputePass();l.setPipeline(_e),l.setBindGroup(0,k?Xt:Ht),l.dispatchWorkgroups(t,r),l.end(),e.copyBufferToBuffer(pe,0,ge,0,4)}function q(){let e=b;if(e===D||U)return;D=e,U=!0;let t=[];t.push(de.mapAsync(GPUMapMode.READ)),t.push(ge.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=K.get(Pe.id)??0,n={},i=0,u=0,l={},c=new Uint32Array(de.getMappedRange().slice(0));de.unmap();let g=0;for(let a=0;a<w.length;a++){let m=c[a]??0;n[w[a].id]=m,a!==r&&(g+=m,m>0&&(Ze.set(a,e),Qe.add(a)))}if(g>0)for(let a=0;a<w.length;a++){if(a===r)continue;let m=(c[a]??0)/g;m>0&&(i-=m*Math.log2(m),u+=m*m)}for(let a=0;a<w.length;a++){if(a===r)continue;(c[a]??0)>0?l[w[a].id]=null:Qe.has(a)?l[w[a].id]=Ze.get(a)??0:l[w[a].id]=0}let o=new Uint32Array(ge.getMappedRange().slice(0));ge.unmap();let d=o[0]??0;if(U=!1,self.postMessage({type:"metrics",generation:e,population:n,shannonEntropy:i,simpsonIndex:1-u,boundaryLength:d,extinctionTime:l,totalFrames:_t(),fps:St,canStepBack:_t()>1,recordingBytes:h.reduce((a,m)=>a+m.storedBytes,0),recordingRawBytes:h.reduce((a,m)=>a+m.uncompressedBytes,0)}),$){$=!1,D=-1;let a=s.createCommandEncoder();z(a),s.queue.submit([a.finish()]),q()}}).catch(()=>{U=!1})}function Et(){let e=T*M;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function Ar(){let e=T*M;return e>1e7?2:e>1e6?4:e>1e5?8:16}function Ft(e){if(e<=0)return;let t=Math.ceil(Ce/16),r=Math.ceil(M/16),n=s.createCommandEncoder();for(let i=0;i<e;i++){let u=n.beginComputePass();u.setPipeline(ye),u.setBindGroup(0,k?ht:bt),u.dispatchWorkgroups(t,r),u.end(),k=!k,b++}s.queue.submit([n.finish()]),ee+=e}function Ge(){self.postMessage({type:"generation",generation:b,fps:St})}function ze(){let e=s.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(ye),t.setBindGroup(0,k?ht:bt);let r=Math.ceil(Ce/16),n=Math.ceil(M/16);t.dispatchWorkgroups(r,n),t.end(),s.queue.submit([e.finish()]),k=!k,b++}function te(){xr();let e=Ve.getCurrentTexture().createView(),t=s.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(qe),r.setBindGroup(0,k?Lt:It),r.draw(3),r.end(),s.queue.submit([t.finish()])}function L(e){if(Z||ie){self.requestAnimationFrame(L);return}Re===0&&(Re=e);let t=e-Re;if(t>=1e3&&(St=ee/(t/1e3),ee=0,Re=e),_>=0){if(B){let n=!1,i=performance.now()+14;for(;b<_&&performance.now()<i;){if(!ne()){n=!0;break}f>=y&&V(),ze(),ee++,j(b)}if(n){S||(S=!0,self.postMessage({type:"backpressure",active:!0})),e-F>=1e3&&(F=e,Ge()),s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(L)});return}S&&(S=!1,self.postMessage({type:"backpressure",active:!1}))}else{let n=Math.min(Et(),_-b);Ft(n)}if(e-F>=1e3&&(F=e,Ge()),b>=_){if(_=-1,A=Je,C=Ee,Y=0,N=0,F=0,S&&(S=!1,self.postMessage({type:"backpressure",active:!1})),D=-1,U)$=!0;else{let n=s.createCommandEncoder();z(n),s.queue.submit([n.finish()]),q()}te(),self.postMessage({type:"stepping",active:!1}),self.requestAnimationFrame(L)}else B?self.requestAnimationFrame(L):s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(L)});return}nr();let r=!1;if(A){B&&mt()&&ne()&&(f>=y&&V(),j(b));let n=!1;Y===0&&(Y=e);let i=e-Y;if(Y=e,C<=0){if(B){let u=!1,l=performance.now()+14;for(;performance.now()<l;){if(!ne()){u=!0;break}f>=y&&V(),ze(),ee++,n=!0,j(b)}if(u){if(S||(S=!0,self.postMessage({type:"backpressure",active:!0})),e-F>=1e3&&(F=e,Ge()),n&&(e-oe>=1e3||oe===0)&&!U){oe=e;let g=s.createCommandEncoder();z(g),s.queue.submit([g.finish()]),q()}s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(L)});return}S&&(S=!1,self.postMessage({type:"backpressure",active:!1}))}else if(!me){let u=Et(),l=Ar();for(let c=0;c<l;c++)Ft(u),n=!0;me=!0,s.queue.onSubmittedWorkDone().then(()=>{me=!1,Vt()?tt():Fe()})}e-F>=1e3&&(F=e,Ge())}else for(N+=i;N>=C;){if(B){if(!ne())break;f>=y&&V()}ze(),ee++,N-=C,n=!0,B&&j(b)}n&&(r=(e-oe>=1e3||oe===0)&&!U)}if(C>0&&!et&&te(),r){oe=e;let n=s.createCommandEncoder();z(n),s.queue.submit([n.finish()]),q()}C<=0&&!B&&A||self.requestAnimationFrame(L)}function Ot(e){J=e,T=e.cols,M=e.rows,Ce=Math.ceil(T/4),w=[...e.tribes],K.clear(),w.forEach((t,r)=>K.set(t.id,r))}async function sr(e){ae=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");s=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),ie=!1,s.lost.then(r=>{let n=r.message||r.reason||"unknown";ie=!0,A=!1,Z=!0,self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:we(),vramBudgetBytes:Zt(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0}),Ve=ae.getContext("webgpu"),Ke=navigator.gpu.getPreferredCanvasFormat(),Ve.configure({device:s,format:Ke,alphaMode:"opaque"})}async function _r(){try{return await sr(ae),!0}catch(e){let t=e instanceof Error?e.message:String(e);return ie=!0,A=!1,Z=!0,self.postMessage({type:"deviceLost",reason:t}),!1}}async function ir(){E=s.createBuffer({size:y*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Ne(y*p,E),f=0,v=[]}async function ar(){let e=y*p;X=[],O=[];for(let t=0;t<We;t++){let r=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});X.push(r),O.push(!0),await Ne(e,r)}}function Er(){tr()}async function Fr(){at(),Jt(),await ot(),ut(),ct(),lt(),ft(),pt(),dt(),Er(),Q()?(await ir(),await ar()):(Ye(),B=!1),await $e(),gt()}async function Or(){Z=!0,self.postMessage({type:"rebuilding",active:!0});try{await Kt()}catch{}if(ie&&!await _r())return!1;Gt(),at(),Jt(),Rt(Q());try{await ot(),ut(),ct(),ft(),pt(),lt(),dt(),Q()?(await ir(),await ar()):(Ye(),B=!1),await $e(),gt()}catch(e){let t=e instanceof Error?e.message:String(e);self.postMessage({type:"gpuError",reason:t});try{Gt(),at(),Rt(!1),await ot(),ut(),ct(),ft(),pt(),lt(),dt(),B=!1,p=ke(),Ye(),await $e(),gt()}catch(r){return console.warn("GPU recovery also failed, device may be lost:",r),!1}}return Z=!1,self.postMessage({type:"rebuilding",active:!1}),!0}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{Ot(t.ruleset),await sr(t.canvas),await Fr(),A=t.running,C=t.speed<0?0:1e3/t.speed,Y=0,N=0,self.requestAnimationFrame(L);break}case"setRuleset":{if(Ot(t.ruleset),!await Or())break;if(b=0,D=-1,At(0),Ze=new Map,Qe=new Set,U)$=!0;else{let n=s.createCommandEncoder();z(n),s.queue.submit([n.finish()]),q()}break}case"setRunning":if(!t.running&&_>=0){if(_=-1,A=!1,C=Ee,Y=0,N=0,S&&le(),D=-1,U)$=!0;else{let r=s.createCommandEncoder();z(r),s.queue.submit([r.finish()]),q()}te(),self.postMessage({type:"stepping",active:!1});break}if(A=t.running,t.running)Y=0,N=0,tt();else{if(S&&le(),D=-1,U)$=!0;else{let r=s.createCommandEncoder();z(r),s.queue.submit([r.finish()]),q()}C<=0&&!B&&_<0&&!me&&Fe()}break;case"setSpeed":{let r=C<=0,n=t.speed<0?0:1e3/t.speed;r&&n>0&&(et=!0,s.queue.onSubmittedWorkDone().then(()=>{et=!1,te(),Fe()})),C=n,N=0,F=0,!r&&n<=0?tt():r&&n>0&&!me&&Fe();break}case"camera":Dt=t.scale,zt=t.offsetX,qt=t.offsetY;break;case"resize":ae.width=t.width,ae.height=t.height;break;case"draw":{let r=t.tribes.map(n=>K.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};Te={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{Pr().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:b,cols:T,rows:M},[r.buffer])}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:b,cols:T,rows:M})});break}case"loadSnapshot":{let r=k?G:R,n=ke();if(t.grid.byteLength!==n)break;s.queue.writeBuffer(r,0,t.grid),b=t.generation,At(t.generation);break}case"setRecording":{t.recording&&Q()&&!B?(B=!0,Se()):(!t.recording||!Q())&&(B=!1);break}case"getRecording":{if(xe)break;f>0&&V(),H>0?xe=!0:rr();break}case"stepBack":{let r=0;for(let c of h)r+=c.blockCount;let n=r+f,i=Math.min(t.count,n-1);if(i<=0)break;let u=n-1-i,l=k?G:R;if(u>=r){let c=u-r;f=c+1,v.length=f,b=v[c];let g=s.createCommandEncoder();g.copyBufferToBuffer(E,c*p,l,0,p),s.queue.submit([g.finish()])}else{if(H>0){await new Promise(P=>{let Me=setInterval(()=>{H===0&&(clearInterval(Me),P())},10)}),r=0;for(let P of h)r+=P.blockCount}let c=0,g=0,o=0;for(let P=0;P<h.length;P++){let Me=h[P];if(u<c+Me.blockCount){g=P,o=u-c;break}c+=Me.blockCount}let d=h[g],a=await Tr(d.filename,d.codec),m=(o+1)*p;s.queue.writeBuffer(E,0,new Uint8Array(a,0,m)),f=o+1,v=d.generations.slice(0,o+1),b=v[o];let x=s.createCommandEncoder();x.copyBufferToBuffer(E,o*p,l,0,p),s.queue.submit([x.finish()]);let He=h.splice(g).map(P=>P.filename);Ur(He)}if(Ct(),Se(),D=-1,U)$=!0;else{let c=s.createCommandEncoder();z(c),s.queue.submit([c.finish()]),q()}te();break}case"stepForward":{if(nr(),t.count===1){if(B&&mt()&&ne()&&(f>=y&&V(),j(b)),ze(),ee++,B&&ne()&&(f>=y&&V(),j(b)),D=-1,U)$=!0;else{let r=s.createCommandEncoder();z(r),s.queue.submit([r.finish()]),q()}te()}else self.postMessage({type:"stepping",active:!0}),B&&mt()&&ne()&&(f>=y&&V(),j(b)),Je=A,Ee=C,_=b+t.count,A=!0,C=0,F=0;break}case"cancelStepping":{if(_>=0){if(_=-1,A=Je,C=Ee,Y=0,N=0,D=-1,U)$=!0;else{let r=s.createCommandEncoder();z(r),s.queue.submit([r.finish()]),q()}te(),self.postMessage({type:"stepping",active:!1})}break}case"updateChunkCodec":{let r=h.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,W.chunks=[...h],Se());break}case"getUncompressedChunks":{let r=h.filter(n=>n.codec==="raw-packed").map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};export{Xe as RECORDING_MAX_FRAME_BYTES};
