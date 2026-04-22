var Xe=1073741824;var vt=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var Me={id:"dead",color:"000000"};var s,ge=!1,Ve,Ke,me,Q,T=0,M=0,Ce=0,w=[],K=new Map,R,G,ze,ae,qe,Ft,Ot,ye,gt,mt,k=!1,It=1,Lt=0,Dt=0,F=!1,se=!1,v=100,N=0,Y=0,b=0,Ge,oe,zt,qt,ir=0,Ue=null,Te,$t,Nt,ce,le,Ae,Yt,Wt,fe,de,D=-1,U=!1,$=!1,ie=0,Ze=new Map,Qe=new Set,B=!0,W={chunks:[],generationStart:0,generationEnd:0},Ht=0,h=[],A=-1,Je=!1,_e=100,E=0,et=!1,pe=!1;function Xt(){return F&&v<=0&&A<0&&!B}function tt(){se||ge||pe||!Xt()||L(performance.now())}function Ee(){se||ge||self.requestAnimationFrame(L)}var _=null,f=0,x=[],y=64,p=0,We=3,X=[],O=[],be="gol-recording",Fe=null,H=0,ne=0,wt=12,S=!1,he=0;var bt=256,ar=bt*Uint32Array.BYTES_PER_ELEMENT,rt=bt*Uint32Array.BYTES_PER_ELEMENT,nt=Uint32Array.BYTES_PER_ELEMENT,or=256*1024*1024,ur=64*1024*1024,cr=512*1024*1024,lr=512*1024*1024,kt=128*1024*1024*1024,Oe=0,Ie=0,Be=[];async function jt(){await s.queue.onSubmittedWorkDone()}function Mt(e){Oe=0,Ie=2+(e?1+We:0),Be=[]}async function $e(){if(Be.length===0)return;let e=s.createCommandEncoder();for(let t of Be)e.clearBuffer(t);s.queue.submit([e.finish()]),await jt(),Be=[]}async function Ne(e,t){!se||Ie<=0||(Oe+=e,Ie--,Be.push(t),Oe>=fr()&&Ie>0&&(await $e(),Oe=0))}function fr(){return Math.min(ve(),lr)}function ve(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function ht(){return Math.min(ve(),1073741824)}function Vt(){return Math.max(ve()*2,ht()*6)}function Z(){return p>0&&p<=ht()}function dr(){return p<=0?0:p*2+Bt+ar+St+rt*2+nt*2}function pr(){return y<1||p<=0?0:y*p*(1+We)}function Ye(){_?.destroy(),_=null;for(let e of X)e?.destroy();X=[],O=[],y=0,f=0,x=[]}function Pt(){R?.destroy(),G?.destroy(),ce?.destroy(),le?.destroy(),fe?.destroy(),de?.destroy(),oe?.destroy(),Ye()}function je(e){let t=H>0;H+=e;let r=H>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function ue(){if(y<1||X.length===0){S&&(S=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=Qt(),t=!O.some(i=>i)&&f>=y,r=ne>=e,n;if(S){let i=O.some(l=>l),u=ne<=Math.floor(e/2);n=!(i&&u)}else n=t||r;n!==S&&(S=n,self.postMessage({type:"backpressure",active:n}))}async function Se(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??kt/128,kt),r=e.usage??0,n=0,i=0;for(let c of h)c.codec==="raw-packed"?n+=c.storedBytes:i+=c.storedBytes;let u=y*p,l=B?(1+We)*u:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:l})}var xe=!1;async function gr(e){let t=new DecompressionStream("deflate-raw"),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:g,value:o}=await i.read();if(g)break;n.push(o)}let u=0;for(let g of n)u+=g.byteLength;let l=new Uint8Array(u),c=0;for(let g of n)l.set(g,c),c+=g.byteLength;return l.buffer}var J=0,Pe=0,yt=0;function mr(){let e=[],t=Ce;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${w.map(o=>o.id).join(", ")}`),e.push(`// Rules: ${Q.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${T}u;`),e.push(`const ROWS: u32 = ${M}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),e.push(""),e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push("  let wordIdx = y * PACKED_COLS + (x >> 2u);"),e.push("  let shift = (x & 3u) * 8u;"),e.push("  return (gridIn[wordIdx] >> shift) & 0xFFu;"),e.push("}"),e.push("");let r=K.get(Me.id)??0;e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let n=hr(Q.rules.map(o=>o.clause)),i=new Map,u=0;for(let o of n){let d=`count_${u++}`;i.set(o,d)}for(let[o,d]of i){let a=o.split(",").map(Number),C=Rt().map(I=>`select(0u, 1u, ${a.map(P=>`${I} == ${P}u`).join(" || ")})`);e.push(`  let ${d} = ${C.join(" + ")};`)}n.size>0&&e.push("");let l=yr(Q.rules.map(o=>o.clause)),c=new Map,g=0;for(let o of l)if(i.has(o))c.set(o,i.get(o));else{let d=`eq_count_${g++}`;c.set(o,d)}for(let[o,d]of c){if(i.has(o))continue;let a=o.split(",").map(Number),C=Rt().map(I=>`select(0u, 1u, ${a.map(P=>`${I} == ${P}u`).join(" || ")})`);e.push(`  let ${d} = ${C.join(" + ")};`)}l.size>0&&g>0&&e.push(""),e.push(`  var result: u32 = ${r}u;`),e.push("");for(let o=0;o<Q.rules.length;o++){let d=Q.rules[o],a=Le(d.clause,i,c),m=br(d.tribe);o===0?e.push(`  if (${a}) {`):e.push(`  } else if (${a}) {`),e.push(`    result = ${m}u;`)}Q.rules.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px * 4u;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < 4u; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let o=-1;o<=1;o++)for(let d=-1;d<=1;d++){if(d===0&&o===0)continue;let a=Kt(d,o),m=Gt("x",d,"COLS"),C=Gt("y",o,"ROWS");e.push(`    let ${a} = readCell(${m}, ${C});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & 0xFFu) << (i * 8u));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function Kt(e,t){return`n${t===-1?"T":t===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function Rt(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(Kt(r,t));return e}function Gt(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function te(e){let t=[];for(let r of e)if(r==="any")for(let n=0;n<w.length;n++)t.push(n);else{let n=K.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function br(e){return e==="any"?0:K.get(e)??0}function hr(e){let t=new Set;for(let r of e)st(r,t);return t}function st(e,t){switch(e.kind){case"count":{let r=te(e.tribes).sort();t.add(r.join(","));break}case"not":st(e.clause,t);break;case"and":case"or":for(let r of e.clauses)st(r,t);break}}function yr(e){let t=new Set;for(let r of e)it(r,t);return t}function it(e,t){switch(e.kind){case"equality":{let r=te(e.tribe1).sort(),n=te(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case"not":it(e.clause,t);break;case"and":case"or":for(let r of e.clauses)it(r,t);break}}function Le(e,t,r){switch(e.kind){case"is":{let n=te(e.tribes);return n.length===0?"false":n.length===w.length?"true":`(${n.map(u=>`selfTribe == ${u}u`).join(" || ")})`}case"count":{let n=te(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case"equality":{let n=te(e.tribe1).sort(),i=te(e.tribe2).sort(),u=r.get(n.join(",")),l=r.get(i.join(","));return`(${u} == ${l})`}case"not":return`!(${Le(e.clause,t,r)})`;case"and":return`(${e.clauses.map(i=>Le(i,t,r)).join(" && ")})`;case"or":return`(${e.clauses.map(i=>Le(i,t,r)).join(" || ")})`;default:return"false"}}var Bt=48;function Br(){let e=new ArrayBuffer(Bt),t=new Float32Array(e),r=new Uint32Array(e);t[0]=me.width,t[1]=me.height,t[2]=T,t[3]=M,t[4]=It,t[6]=Lt,t[7]=Dt,r[8]=w.length,s.queue.writeBuffer(ze,0,e)}function we(){return Ce*M*4}async function at(){let e=we();R=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Ne(e,R),G=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Ne(e,G);let t=s.createCommandEncoder();t.clearBuffer(R),t.clearBuffer(G),s.queue.submit([t.finish()]),k=!1}function ot(){let e=new Uint32Array(bt);for(let t=0;t<w.length;t++){let r=w[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),u=parseInt(r.substring(4,6),16);e[t]=n|i<<8|u<<16}ae&&ae.destroy(),ae=s.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(ae,0,e)}function Sr(){let e=s.createShaderModule({code:vt});qe=s.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:Ke}]},primitive:{topology:"triangle-list"}})}function ut(){Ft=s.createBindGroup({layout:qe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ze}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:ae}}]}),Ot=s.createBindGroup({layout:qe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ze}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:ae}}]})}function ct(){let e=mr(),t=s.createShaderModule({code:e});ye=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),gt=s.createBindGroup({layout:ye.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:G}}]}),mt=s.createBindGroup({layout:ye.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:R}}]})}var xr=`
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
`;function Cr(){return`
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
`}function lt(){let e=xr.replace("const COLS: u32 = 0u;",`const COLS: u32 = ${T}u;`).replace("const ROWS: u32 = 0u;",`const ROWS: u32 = ${M}u;`),t=s.createShaderModule({code:e});Te=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),ce=s.createBuffer({size:rt,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),le=s.createBuffer({size:rt,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),$t=s.createBindGroup({layout:Te.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:ce}}]}),Nt=s.createBindGroup({layout:Te.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:ce}}]});let r=s.createShaderModule({code:Cr()});Ae=s.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),fe=s.createBuffer({size:nt,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),de=s.createBuffer({size:nt,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Yt=s.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:fe}}]}),Wt=s.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:fe}}]})}var St=176,vr=`
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
`;function ft(){let e=s.createShaderModule({code:vr});Ge=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),oe?.destroy(),oe=s.createBuffer({size:St,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),zt=s.createBindGroup({layout:Ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:oe}}]}),qt=s.createBindGroup({layout:Ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:oe}}]})}function wr(e,t,r,n,i,u,l){let c=K.get(Me.id)??0,g=ir++,o=new ArrayBuffer(St),d=new Int32Array(o),a=new Uint32Array(o);d[0]=t,d[1]=r,a[2]=T,a[3]=M,a[4]=n,a[5]=i,a[6]=u,a[7]=c,a[8]=g,a[9]=l.length,a[10]=0;for(let I=0;I<l.length&&I<32;I++)a[11+I]=l[I];s.queue.writeBuffer(oe,0,o);let m=Math.ceil(n/8),C=e.beginComputePass();C.setPipeline(Ge),C.setBindGroup(0,k?qt:zt),C.dispatchWorkgroups(m,m),C.end()}function kr(){let e=k?G:R,t=we(),r;try{r=s.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder();return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function Zt(){if(p=we(),!Z()){y=0;return}let e=Mr();y=Math.max(1,Math.floor(e/p))}function Mr(){return p>=ur?p:Math.min(Math.max(or,p),ht())}function Qt(){if(y<1||p<=0)return wt;let e=Math.max(p,y*p),t=Math.floor(cr/e);return Math.max(1,Math.min(wt,t||1))}function dt(){let e=Z();self.postMessage({type:"limits",maxBytes:ve(),vramBudgetBytes:Vt(),frameByteSize:p,recordingAvailable:e,vramSimulationBytes:dr(),vramRecordingBytes:pr()})}function re(){return!Z()||y<1||_===null||X.length===0||ne>=Qt()?!1:f<y?!0:X.some((e,t)=>O[t]&&e.mapState==="unmapped")}function j(e){if(y<1||_===null||f>=y)return;let t=k?G:R,r=f*p,n=s.createCommandEncoder();n.copyBufferToBuffer(t,0,_,r,p),s.queue.submit([n.finish()]),x.push(e),f++}function V(){if(_===null||f===0||X.length===0)return;let e=O.indexOf(!0);if(e<0)return;O[e]=!1;let t=X[e];if(t.mapState!=="unmapped"){O[e]=!0;return}let r=f*p,n=Ht++,i=[...x],u=i[0],l=i[i.length-1],c=`chunk-${String(n).padStart(6,"0")}.bin`,g=f,o=s.createCommandEncoder();o.copyBufferToBuffer(_,0,t,0,r),s.queue.submit([o.finish()]);let d={chunkId:n,generationStart:u,generationEnd:l,blockCount:g,codec:"raw-packed",uncompressedBytes:r,storedBytes:r,generations:i,filename:c};je(1),ne++,ue();let a=he;t.mapAsync(GPUMapMode.READ).then(async()=>{let m=t.getMappedRange(),C=new ArrayBuffer(r);new Uint8Array(C).set(new Uint8Array(m,0,r)),t.unmap(),a===he&&(O[e]=!0,ue(),h.push(d),xt(),Pr(d,C).then(()=>{a===he&&(ne--,ue(),je(-1),Se(),self.postMessage({type:"chunkSealed",filename:d.filename,rawBytes:r}),xe&&H===0&&(xe=!1,er()))}))}).catch(()=>{a===he&&(O[e]=!0,ne--,ue(),je(-1))}),f=0,x=[]}function xt(){h.length>0&&(W.generationStart=h[0].generationStart,W.generationEnd=h[h.length-1].generationEnd),x.length>0&&(h.length===0&&(W.generationStart=x[0]),W.generationEnd=x[x.length-1]),W.chunks=[...h]}function Ut(e){he++,Ht=0,f=0,x=[],h=[],ne=0,H>0&&(H=0,self.postMessage({type:"chunksSaving",active:!1})),S&&(S=!1,self.postMessage({type:"backpressure",active:!1})),xe=!1,W={chunks:[],generationStart:e,generationEnd:e},Jt(),Se()}async function Ct(){return Fe||(Fe=await(await navigator.storage.getDirectory()).getDirectoryHandle(be,{create:!0})),Fe}async function Pr(e,t){let i=await(await(await Ct()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function Rr(e){let t=await Ct();for(let r of e)try{console.log(`Trying to remove OPFS entry ${r}...`),await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function Jt(){let e=await navigator.storage.getDirectory();try{console.log(`Trying to remove OPFS directory ${be}...`),await e.removeEntry(be,{recursive:!0})}catch(t){console.warn(`Failed to remove OPFS directory ${be}:`,t)}Fe=await e.getDirectoryHandle(be,{create:!0})}function er(){xt(),self.postMessage({type:"recording",manifest:{chunks:h.map(e=>({...e,generations:[...e.generations]})),generationStart:W.generationStart,generationEnd:W.generationEnd},cols:T,rows:M})}function pt(){return f>0?x[f-1]!==b:h.length>0?h[h.length-1].generationEnd!==b:!0}function tr(){if(!Ue)return;let e=Ue;Ue=null;let t=s.createCommandEncoder();wr(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),B&&f>0&&x[f-1]===b&&(f--,x.pop(),j(b))}async function Gr(e,t="raw-packed"){let u=await(await(await(await Ct()).getFileHandle(e)).getFile()).arrayBuffer();return t==="deflate-raw"?gr(u):u}function Tt(){let e=f;for(let t of h)e+=t.blockCount;return e}function z(e){let t=Math.ceil(T/16),r=Math.ceil(M/16),n=new Uint32Array(256);s.queue.writeBuffer(ce,0,n);let i=e.beginComputePass();i.setPipeline(Te),i.setBindGroup(0,k?Nt:$t),i.dispatchWorkgroups(t,r),i.end(),e.copyBufferToBuffer(ce,0,le,0,256*4);let u=new Uint32Array([0]);s.queue.writeBuffer(fe,0,u);let l=e.beginComputePass();l.setPipeline(Ae),l.setBindGroup(0,k?Wt:Yt),l.dispatchWorkgroups(t,r),l.end(),e.copyBufferToBuffer(fe,0,de,0,4)}function q(){let e=b;if(e===D||U)return;D=e,U=!0;let t=[];t.push(le.mapAsync(GPUMapMode.READ)),t.push(de.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=K.get(Me.id)??0,n={},i=0,u=0,l={},c=new Uint32Array(le.getMappedRange().slice(0));le.unmap();let g=0;for(let a=0;a<w.length;a++){let m=c[a]??0;n[w[a].id]=m,a!==r&&(g+=m,m>0&&(Ze.set(a,e),Qe.add(a)))}if(g>0)for(let a=0;a<w.length;a++){if(a===r)continue;let m=(c[a]??0)/g;m>0&&(i-=m*Math.log2(m),u+=m*m)}for(let a=0;a<w.length;a++){if(a===r)continue;(c[a]??0)>0?l[w[a].id]=null:Qe.has(a)?l[w[a].id]=Ze.get(a)??0:l[w[a].id]=0}let o=new Uint32Array(de.getMappedRange().slice(0));de.unmap();let d=o[0]??0;if(U=!1,self.postMessage({type:"metrics",generation:e,population:n,shannonEntropy:i,simpsonIndex:1-u,boundaryLength:d,extinctionTime:l,totalFrames:Tt(),fps:yt,canStepBack:Tt()>1,recordingBytes:h.reduce((a,m)=>a+m.storedBytes,0),recordingRawBytes:h.reduce((a,m)=>a+m.uncompressedBytes,0)}),$){$=!1,D=-1;let a=s.createCommandEncoder();z(a),s.queue.submit([a.finish()]),q()}}).catch(()=>{U=!1})}function At(){let e=T*M;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function Ur(){let e=T*M;return e>1e7?2:e>1e6?4:e>1e5?8:16}function _t(e){if(e<=0)return;let t=Math.ceil(Ce/16),r=Math.ceil(M/16),n=s.createCommandEncoder();for(let i=0;i<e;i++){let u=n.beginComputePass();u.setPipeline(ye),u.setBindGroup(0,k?mt:gt),u.dispatchWorkgroups(t,r),u.end(),k=!k,b++}s.queue.submit([n.finish()]),J+=e}function Re(){self.postMessage({type:"generation",generation:b,fps:yt})}function De(){let e=s.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(ye),t.setBindGroup(0,k?mt:gt);let r=Math.ceil(Ce/16),n=Math.ceil(M/16);t.dispatchWorkgroups(r,n),t.end(),s.queue.submit([e.finish()]),k=!k,b++}function ee(){Br();let e=Ve.getCurrentTexture().createView(),t=s.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(qe),r.setBindGroup(0,k?Ot:Ft),r.draw(3),r.end(),s.queue.submit([t.finish()])}function L(e){if(se||ge){self.requestAnimationFrame(L);return}Pe===0&&(Pe=e);let t=e-Pe;if(t>=1e3&&(yt=J/(t/1e3),J=0,Pe=e),A>=0){if(B){let n=!1,i=performance.now()+14;for(;b<A&&performance.now()<i;){if(!re()){n=!0;break}f>=y&&V(),De(),J++,j(b)}if(n){S||(S=!0,self.postMessage({type:"backpressure",active:!0})),e-E>=1e3&&(E=e,Re()),s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(L)});return}S&&(S=!1,self.postMessage({type:"backpressure",active:!1}))}else{let n=Math.min(At(),A-b);_t(n)}if(e-E>=1e3&&(E=e,Re()),b>=A){if(A=-1,F=Je,v=_e,Y=0,N=0,E=0,S&&(S=!1,self.postMessage({type:"backpressure",active:!1})),D=-1,U)$=!0;else{let n=s.createCommandEncoder();z(n),s.queue.submit([n.finish()]),q()}ee(),self.postMessage({type:"stepping",active:!1}),self.requestAnimationFrame(L)}else B?self.requestAnimationFrame(L):s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(L)});return}tr();let r=!1;if(F){B&&pt()&&re()&&(f>=y&&V(),j(b));let n=!1;Y===0&&(Y=e);let i=e-Y;if(Y=e,v<=0){if(B){let u=!1,l=performance.now()+14;for(;performance.now()<l;){if(!re()){u=!0;break}f>=y&&V(),De(),J++,n=!0,j(b)}if(u){if(S||(S=!0,self.postMessage({type:"backpressure",active:!0})),e-E>=1e3&&(E=e,Re()),n&&(e-ie>=1e3||ie===0)&&!U){ie=e;let g=s.createCommandEncoder();z(g),s.queue.submit([g.finish()]),q()}s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(L)});return}S&&(S=!1,self.postMessage({type:"backpressure",active:!1}))}else if(!pe){let u=At(),l=Ur();for(let c=0;c<l;c++)_t(u),n=!0;pe=!0,s.queue.onSubmittedWorkDone().then(()=>{pe=!1,Xt()?tt():Ee()})}e-E>=1e3&&(E=e,Re())}else for(N+=i;N>=v;){if(B){if(!re())break;f>=y&&V()}De(),J++,N-=v,n=!0,B&&j(b)}n&&(r=(e-ie>=1e3||ie===0)&&!U)}if(v>0&&!et&&ee(),r){ie=e;let n=s.createCommandEncoder();z(n),s.queue.submit([n.finish()]),q()}v<=0&&!B&&F||self.requestAnimationFrame(L)}function Et(e){Q=e,T=e.cols,M=e.rows,Ce=Math.ceil(T/4),w=[...e.tribes],K.clear(),w.forEach((t,r)=>K.set(t.id,r))}async function Tr(e){me=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");s=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),ge=!1,s.lost.then(r=>{ge=!0,F=!1,se=!0;let n=r.message||r.reason||"unknown";self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:ve(),vramBudgetBytes:Vt(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0}),Ve=me.getContext("webgpu"),Ke=navigator.gpu.getPreferredCanvasFormat(),Ve.configure({device:s,format:Ke,alphaMode:"opaque"})}async function rr(){_=s.createBuffer({size:y*p,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await Ne(y*p,_),f=0,x=[]}async function nr(){let e=y*p;X=[],O=[];for(let t=0;t<We;t++){let r=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});X.push(r),O.push(!0),await Ne(e,r)}}function Ar(){Jt()}async function _r(){ze=s.createBuffer({size:Bt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Zt(),await at(),ot(),Sr(),ut(),ct(),ft(),lt(),Ar(),Z()?(await rr(),await nr()):(Ye(),B=!1),await $e(),dt()}async function Er(){if(se=!0,self.postMessage({type:"rebuilding",active:!0}),await jt(),!ge){Pt(),Zt(),Mt(Z());try{await at(),ot(),ct(),ft(),ut(),lt(),Z()?(await rr(),await nr()):(Ye(),B=!1),await $e(),dt()}catch(e){let t=e instanceof Error?e.message:String(e);self.postMessage({type:"gpuError",reason:t});try{Pt(),Mt(!1),await at(),ot(),ct(),ft(),ut(),lt(),B=!1,p=we(),Ye(),await $e(),dt()}catch(r){console.warn("GPU recovery also failed, device may be lost:",r);return}}se=!1,self.postMessage({type:"rebuilding",active:!1})}}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{Et(t.ruleset),await Tr(t.canvas),await _r(),F=t.running,v=t.speed<0?0:1e3/t.speed,Y=0,N=0,self.requestAnimationFrame(L);break}case"setRuleset":{if(Et(t.ruleset),await Er(),b=0,D=-1,Ut(0),Ze=new Map,Qe=new Set,U)$=!0;else{let r=s.createCommandEncoder();z(r),s.queue.submit([r.finish()]),q()}break}case"setRunning":if(!t.running&&A>=0){if(A=-1,F=!1,v=_e,Y=0,N=0,S&&ue(),D=-1,U)$=!0;else{let r=s.createCommandEncoder();z(r),s.queue.submit([r.finish()]),q()}ee(),self.postMessage({type:"stepping",active:!1});break}if(F=t.running,t.running)Y=0,N=0,tt();else{if(S&&ue(),D=-1,U)$=!0;else{let r=s.createCommandEncoder();z(r),s.queue.submit([r.finish()]),q()}v<=0&&!B&&A<0&&!pe&&Ee()}break;case"setSpeed":{let r=v<=0,n=t.speed<0?0:1e3/t.speed;r&&n>0&&(et=!0,s.queue.onSubmittedWorkDone().then(()=>{et=!1,ee(),Ee()})),v=n,N=0,E=0,!r&&n<=0?tt():r&&n>0&&!pe&&Ee();break}case"camera":It=t.scale,Lt=t.offsetX,Dt=t.offsetY;break;case"resize":me.width=t.width,me.height=t.height;break;case"draw":{let r=t.tribes.map(n=>K.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};Ue={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{kr().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:b,cols:T,rows:M},[r.buffer])}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:b,cols:T,rows:M})});break}case"loadSnapshot":{let r=k?G:R,n=we();if(t.grid.byteLength!==n)break;s.queue.writeBuffer(r,0,t.grid),b=t.generation,Ut(t.generation);break}case"setRecording":{t.recording&&Z()&&!B?(B=!0,Se()):(!t.recording||!Z())&&(B=!1);break}case"getRecording":{if(xe)break;f>0&&V(),H>0?xe=!0:er();break}case"stepBack":{let r=0;for(let c of h)r+=c.blockCount;let n=r+f,i=Math.min(t.count,n-1);if(i<=0)break;let u=n-1-i,l=k?G:R;if(u>=r){let c=u-r;f=c+1,x.length=f,b=x[c];let g=s.createCommandEncoder();g.copyBufferToBuffer(_,c*p,l,0,p),s.queue.submit([g.finish()])}else{if(H>0){await new Promise(P=>{let ke=setInterval(()=>{H===0&&(clearInterval(ke),P())},10)}),r=0;for(let P of h)r+=P.blockCount}let c=0,g=0,o=0;for(let P=0;P<h.length;P++){let ke=h[P];if(u<c+ke.blockCount){g=P,o=u-c;break}c+=ke.blockCount}let d=h[g],a=await Gr(d.filename,d.codec),m=(o+1)*p;s.queue.writeBuffer(_,0,new Uint8Array(a,0,m)),f=o+1,x=d.generations.slice(0,o+1),b=x[o];let C=s.createCommandEncoder();C.copyBufferToBuffer(_,o*p,l,0,p),s.queue.submit([C.finish()]);let He=h.splice(g).map(P=>P.filename);Rr(He)}if(xt(),Se(),D=-1,U)$=!0;else{let c=s.createCommandEncoder();z(c),s.queue.submit([c.finish()]),q()}ee();break}case"stepForward":{if(tr(),t.count===1){if(B&&pt()&&re()&&(f>=y&&V(),j(b)),De(),J++,B&&re()&&(f>=y&&V(),j(b)),D=-1,U)$=!0;else{let r=s.createCommandEncoder();z(r),s.queue.submit([r.finish()]),q()}ee()}else self.postMessage({type:"stepping",active:!0}),B&&pt()&&re()&&(f>=y&&V(),j(b)),Je=F,_e=v,A=b+t.count,F=!0,v=0,E=0;break}case"cancelStepping":{if(A>=0){if(A=-1,F=Je,v=_e,Y=0,N=0,D=-1,U)$=!0;else{let r=s.createCommandEncoder();z(r),s.queue.submit([r.finish()]),q()}ee(),self.postMessage({type:"stepping",active:!1})}break}case"updateChunkCodec":{let r=h.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,W.chunks=[...h],Se());break}case"getUncompressedChunks":{let r=h.filter(n=>n.codec==="raw-packed").map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};export{Xe as RECORDING_MAX_FRAME_BYTES};
