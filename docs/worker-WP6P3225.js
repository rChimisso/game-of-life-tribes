var We=1073741824;var vt=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var xe={id:"dead",color:"000000"};var s,Ie=!1,Xe,je,de,Q,A=0,G=0,Se=0,C=[],Z=new Map,M,P,Le,ie,ze,At,Et,me,dt,pt,x=!1,_t=1,Ft=0,Ot=0,D=!1,ye=!1,U=100,$=0,Y=0,m=0,Pe,ae,It,Lt,er=0,Ge=null,Re,zt,Dt,ue,ce,Ue,qt,$t,le,fe,O=-1,R=!1,q=!1,se=0,Ve=new Map,Ze=new Set,S=!0,N={chunks:[],generationStart:0,generationEnd:0},Yt=0,b=[],z=-1,Ke=!1,Te=100,E=0,Qe=!1,T=null,f=0,v=[],y=64,h=0,Ye=3,H=[],_=[],pe="gol-recording",Ae=null,W=0,ne=0,Je=12,B=!1,ge=0;var gt=256,tr=gt*Uint32Array.BYTES_PER_ELEMENT,et=gt*Uint32Array.BYTES_PER_ELEMENT,tt=Uint32Array.BYTES_PER_ELEMENT,rr=256*1024*1024,nr=512*1024*1024,wt=128*1024*1024*1024,Ee=0,_e=0,be=[];async function Nt(){await s.queue.onSubmittedWorkDone()}function Ct(e){Ee=0,_e=2+(e?1+Ye:0),be=[]}async function De(){if(be.length===0)return;let e=s.createCommandEncoder();for(let t of be)e.clearBuffer(t);s.queue.submit([e.finish()]),await Nt(),be=[]}async function qe(e,t){!ye||_e<=0||(Ee+=e,_e--,be.push(t),Ee>=sr()&&_e>0&&(await De(),Ee=0))}function sr(){return Math.min(ve(),nr)}function ve(){return Math.min(s.limits.maxBufferSize,s.limits.maxStorageBufferBindingSize)}function mt(){return Math.min(ve(),1073741824)}function Wt(){return Math.max(ve()*2,mt()*6)}function K(){return h>0&&h<=mt()}function ir(){return h<=0?0:h*2+ht+tr+yt+et*2+tt*2}function ar(){return y<1||h<=0?0:y*h*(1+Ye)}function $e(){T?.destroy(),T=null;for(let e of H)e?.destroy();H=[],_=[],y=0,f=0,v=[]}function xt(){M?.destroy(),P?.destroy(),ue?.destroy(),ce?.destroy(),le?.destroy(),fe?.destroy(),ae?.destroy(),$e()}function He(e){let t=W>0;W+=e;let r=W>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}function oe(){if(y<1||H.length===0){B&&(B=!1,self.postMessage({type:"backpressure",active:!1}));return}let e=!_.some(n=>n)&&f>=y,t=ne>=Je,r;if(B){let n=_.some(u=>u),i=ne<=Math.floor(Je/2);r=!(n&&i)}else r=e||t;r!==B&&(B=r,self.postMessage({type:"backpressure",active:r}))}async function he(){let e=await navigator.storage.estimate(),t=Math.min(e.quota??wt/128,wt),r=e.usage??0,n=0,i=0;for(let c of b)c.codec==="raw-packed"?n+=c.storedBytes:i+=c.storedBytes;let u=y*h,l=S?(1+Ye)*u:0;self.postMessage({type:"storageQuota",usedBytes:r,quotaBytes:t,pendingRawBytes:n,compressedBytes:i,gpuBufferMarginBytes:l})}var Be=!1;async function or(e){let t=new DecompressionStream("deflate-raw"),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let n=[],i=t.readable.getReader();for(;;){let{done:p,value:o}=await i.read();if(p)break;n.push(o)}let u=0;for(let p of n)u+=p.byteLength;let l=new Uint8Array(u),c=0;for(let p of n)l.set(p,c),c+=p.byteLength;return l.buffer}var J=0,ke=0,bt=0;function ur(){let e=[],t=Se;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${C.map(o=>o.id).join(", ")}`),e.push(`// Rules: ${Q.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${A}u;`),e.push(`const ROWS: u32 = ${G}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),e.push(""),e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push("  let wordIdx = y * PACKED_COLS + (x >> 2u);"),e.push("  let shift = (x & 3u) * 8u;"),e.push("  return (gridIn[wordIdx] >> shift) & 0xFFu;"),e.push("}"),e.push("");let r=Z.get(xe.id)??0;e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let n=lr(Q.rules.map(o=>o.clause)),i=new Map,u=0;for(let o of n){let d=`count_${u++}`;i.set(o,d)}for(let[o,d]of i){let a=o.split(",").map(Number),w=kt().map(F=>`select(0u, 1u, ${a.map(k=>`${F} == ${k}u`).join(" || ")})`);e.push(`  let ${d} = ${w.join(" + ")};`)}n.size>0&&e.push("");let l=fr(Q.rules.map(o=>o.clause)),c=new Map,p=0;for(let o of l)if(i.has(o))c.set(o,i.get(o));else{let d=`eq_count_${p++}`;c.set(o,d)}for(let[o,d]of c){if(i.has(o))continue;let a=o.split(",").map(Number),w=kt().map(F=>`select(0u, 1u, ${a.map(k=>`${F} == ${k}u`).join(" || ")})`);e.push(`  let ${d} = ${w.join(" + ")};`)}l.size>0&&p>0&&e.push(""),e.push(`  var result: u32 = ${r}u;`),e.push("");for(let o=0;o<Q.rules.length;o++){let d=Q.rules[o],a=Fe(d.clause,i,c),g=cr(d.tribe);o===0?e.push(`  if (${a}) {`):e.push(`  } else if (${a}) {`),e.push(`    result = ${g}u;`)}Q.rules.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px * 4u;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < 4u; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let o=-1;o<=1;o++)for(let d=-1;d<=1;d++){if(d===0&&o===0)continue;let a=Ht(d,o),g=Mt("x",d,"COLS"),w=Mt("y",o,"ROWS");e.push(`    let ${a} = readCell(${g}, ${w});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & 0xFFu) << (i * 8u));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function Ht(e,t){return`n${t===-1?"T":t===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function kt(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(Ht(r,t));return e}function Mt(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function te(e){let t=[];for(let r of e)if(r==="any")for(let n=0;n<C.length;n++)t.push(n);else{let n=Z.get(r);n!==void 0&&t.push(n)}return[...new Set(t)]}function cr(e){return e==="any"?0:Z.get(e)??0}function lr(e){let t=new Set;for(let r of e)rt(r,t);return t}function rt(e,t){switch(e.kind){case"count":{let r=te(e.tribes).sort();t.add(r.join(","));break}case"not":rt(e.clause,t);break;case"and":case"or":for(let r of e.clauses)rt(r,t);break}}function fr(e){let t=new Set;for(let r of e)nt(r,t);return t}function nt(e,t){switch(e.kind){case"equality":{let r=te(e.tribe1).sort(),n=te(e.tribe2).sort();t.add(r.join(",")),t.add(n.join(","));break}case"not":nt(e.clause,t);break;case"and":case"or":for(let r of e.clauses)nt(r,t);break}}function Fe(e,t,r){switch(e.kind){case"is":{let n=te(e.tribes);return n.length===0?"false":n.length===C.length?"true":`(${n.map(u=>`selfTribe == ${u}u`).join(" || ")})`}case"count":{let n=te(e.tribes).sort(),i=t.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case"equality":{let n=te(e.tribe1).sort(),i=te(e.tribe2).sort(),u=r.get(n.join(",")),l=r.get(i.join(","));return`(${u} == ${l})`}case"not":return`!(${Fe(e.clause,t,r)})`;case"and":return`(${e.clauses.map(i=>Fe(i,t,r)).join(" && ")})`;case"or":return`(${e.clauses.map(i=>Fe(i,t,r)).join(" || ")})`;default:return"false"}}var ht=48;function dr(){let e=new ArrayBuffer(ht),t=new Float32Array(e),r=new Uint32Array(e);t[0]=de.width,t[1]=de.height,t[2]=A,t[3]=G,t[4]=_t,t[6]=Ft,t[7]=Ot,r[8]=C.length,s.queue.writeBuffer(Le,0,e)}function we(){return Se*G*4}async function st(){let e=we();M=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await qe(e,M),P=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await qe(e,P);let t=s.createCommandEncoder();t.clearBuffer(M),t.clearBuffer(P),s.queue.submit([t.finish()]),x=!1}function it(){let e=new Uint32Array(gt);for(let t=0;t<C.length;t++){let r=C[t].color,n=parseInt(r.substring(0,2),16),i=parseInt(r.substring(2,4),16),u=parseInt(r.substring(4,6),16);e[t]=n|i<<8|u<<16}ie&&ie.destroy(),ie=s.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(ie,0,e)}function pr(){let e=s.createShaderModule({code:vt});ze=s.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:je}]},primitive:{topology:"triangle-list"}})}function at(){At=s.createBindGroup({layout:ze.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Le}},{binding:1,resource:{buffer:M}},{binding:2,resource:{buffer:ie}}]}),Et=s.createBindGroup({layout:ze.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Le}},{binding:1,resource:{buffer:P}},{binding:2,resource:{buffer:ie}}]})}function ot(){let e=ur(),t=s.createShaderModule({code:e});me=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),dt=s.createBindGroup({layout:me.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:M}},{binding:1,resource:{buffer:P}}]}),pt=s.createBindGroup({layout:me.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:M}}]})}var gr=`
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
`;function mr(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${A}u;
const ROWS: u32 = ${G}u;

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
`}function ut(){let e=gr.replace("const COLS: u32 = 0u;",`const COLS: u32 = ${A}u;`).replace("const ROWS: u32 = 0u;",`const ROWS: u32 = ${G}u;`),t=s.createShaderModule({code:e});Re=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),ue=s.createBuffer({size:et,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),ce=s.createBuffer({size:et,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),zt=s.createBindGroup({layout:Re.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:M}},{binding:1,resource:{buffer:ue}}]}),Dt=s.createBindGroup({layout:Re.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:ue}}]});let r=s.createShaderModule({code:mr()});Ue=s.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),le=s.createBuffer({size:tt,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),fe=s.createBuffer({size:tt,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),qt=s.createBindGroup({layout:Ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:M}},{binding:1,resource:{buffer:le}}]}),$t=s.createBindGroup({layout:Ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:le}}]})}var yt=176,br=`
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
`;function ct(){let e=s.createShaderModule({code:br});Pe=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),ae?.destroy(),ae=s.createBuffer({size:yt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),It=s.createBindGroup({layout:Pe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:M}},{binding:1,resource:{buffer:ae}}]}),Lt=s.createBindGroup({layout:Pe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:ae}}]})}function hr(e,t,r,n,i,u,l){let c=Z.get(xe.id)??0,p=er++,o=new ArrayBuffer(yt),d=new Int32Array(o),a=new Uint32Array(o);d[0]=t,d[1]=r,a[2]=A,a[3]=G,a[4]=n,a[5]=i,a[6]=u,a[7]=c,a[8]=p,a[9]=l.length,a[10]=0;for(let F=0;F<l.length&&F<32;F++)a[11+F]=l[F];s.queue.writeBuffer(ae,0,o);let g=Math.ceil(n/8),w=e.beginComputePass();w.setPipeline(Pe),w.setBindGroup(0,x?Lt:It),w.dispatchWorkgroups(g,g),w.end()}function yr(){let e=x?P:M,t=we(),r;try{r=s.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch(i){return console.warn("GPU readback buffer allocation failed:",i),Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let n=s.createCommandEncoder();return n.copyBufferToBuffer(e,0,r,0,t),s.queue.submit([n.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),i})}function Xt(){if(h=we(),!K()){y=0;return}let e=Math.min(Math.max(rr,h),mt());y=Math.max(1,Math.floor(e/h))}function lt(){let e=K();self.postMessage({type:"limits",maxBytes:ve(),vramBudgetBytes:Wt(),frameByteSize:h,recordingAvailable:e,vramSimulationBytes:ir(),vramRecordingBytes:ar()})}function re(){return!K()||y<1||T===null||H.length===0||ne>=Je?!1:f<y?!0:H.some((e,t)=>_[t]&&e.mapState==="unmapped")}function j(e){if(y<1||T===null||f>=y)return;let t=x?P:M,r=f*h,n=s.createCommandEncoder();n.copyBufferToBuffer(t,0,T,r,h),s.queue.submit([n.finish()]),v.push(e),f++}function V(){if(T===null||f===0||H.length===0)return;let e=_.indexOf(!0);if(e<0)return;_[e]=!1;let t=H[e];if(t.mapState!=="unmapped"){_[e]=!0;return}let r=f*h,n=Yt++,i=[...v],u=i[0],l=i[i.length-1],c=`chunk-${String(n).padStart(6,"0")}.bin`,p=f,o=s.createCommandEncoder();o.copyBufferToBuffer(T,0,t,0,r),s.queue.submit([o.finish()]);let d={chunkId:n,generationStart:u,generationEnd:l,blockCount:p,codec:"raw-packed",uncompressedBytes:r,storedBytes:r,generations:i,filename:c};He(1),ne++,oe();let a=ge;t.mapAsync(GPUMapMode.READ).then(async()=>{let g=t.getMappedRange(),w=new ArrayBuffer(r);new Uint8Array(w).set(new Uint8Array(g,0,r)),t.unmap(),a===ge&&(_[e]=!0,oe(),b.push(d),Bt(),Br(d,w).then(()=>{a===ge&&(ne--,oe(),He(-1),he(),self.postMessage({type:"chunkSealed",filename:d.filename,rawBytes:r}),Be&&W===0&&(Be=!1,Vt()))}))}).catch(()=>{a===ge&&(_[e]=!0,ne--,oe(),He(-1))}),f=0,v=[]}function Bt(){b.length>0&&(N.generationStart=b[0].generationStart,N.generationEnd=b[b.length-1].generationEnd),v.length>0&&(b.length===0&&(N.generationStart=v[0]),N.generationEnd=v[v.length-1]),N.chunks=[...b]}function Pt(e){ge++,Yt=0,f=0,v=[],b=[],ne=0,W>0&&(W=0,self.postMessage({type:"chunksSaving",active:!1})),B&&(B=!1,self.postMessage({type:"backpressure",active:!1})),Be=!1,N={chunks:[],generationStart:e,generationEnd:e},jt(),he()}async function St(){return Ae||(Ae=await(await navigator.storage.getDirectory()).getDirectoryHandle(pe,{create:!0})),Ae}async function Br(e,t){let i=await(await(await St()).getFileHandle(e.filename,{create:!0})).createWritable();await i.write(t),await i.close()}async function Sr(e){let t=await St();for(let r of e)try{console.log(`Trying to remove OPFS entry ${r}...`),await t.removeEntry(r)}catch(n){console.warn(`Failed to remove OPFS entry ${r}:`,n)}}async function jt(){let e=await navigator.storage.getDirectory();try{console.log(`Trying to remove OPFS directory ${pe}...`),await e.removeEntry(pe,{recursive:!0})}catch(t){console.warn(`Failed to remove OPFS directory ${pe}:`,t)}Ae=await e.getDirectoryHandle(pe,{create:!0})}function Vt(){Bt(),self.postMessage({type:"recording",manifest:{chunks:b.map(e=>({...e,generations:[...e.generations]})),generationStart:N.generationStart,generationEnd:N.generationEnd},cols:A,rows:G})}function ft(){return f>0?v[f-1]!==m:b.length>0?b[b.length-1].generationEnd!==m:!0}function Zt(){if(!Ge)return;let e=Ge;Ge=null;let t=s.createCommandEncoder();hr(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),s.queue.submit([t.finish()]),S&&f>0&&v[f-1]===m&&(f--,v.pop(),j(m))}async function vr(e,t="raw-packed"){let u=await(await(await(await St()).getFileHandle(e)).getFile()).arrayBuffer();return t==="deflate-raw"?or(u):u}function Gt(){let e=f;for(let t of b)e+=t.blockCount;return e}function I(e){let t=Math.ceil(A/16),r=Math.ceil(G/16),n=new Uint32Array(256);s.queue.writeBuffer(ue,0,n);let i=e.beginComputePass();i.setPipeline(Re),i.setBindGroup(0,x?Dt:zt),i.dispatchWorkgroups(t,r),i.end(),e.copyBufferToBuffer(ue,0,ce,0,256*4);let u=new Uint32Array([0]);s.queue.writeBuffer(le,0,u);let l=e.beginComputePass();l.setPipeline(Ue),l.setBindGroup(0,x?$t:qt),l.dispatchWorkgroups(t,r),l.end(),e.copyBufferToBuffer(le,0,fe,0,4)}function L(){let e=m;if(e===O||R)return;O=e,R=!0;let t=[];t.push(ce.mapAsync(GPUMapMode.READ)),t.push(fe.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=Z.get(xe.id)??0,n={},i=0,u=0,l={},c=new Uint32Array(ce.getMappedRange().slice(0));ce.unmap();let p=0;for(let a=0;a<C.length;a++){let g=c[a]??0;n[C[a].id]=g,a!==r&&(p+=g,g>0&&(Ve.set(a,e),Ze.add(a)))}if(p>0)for(let a=0;a<C.length;a++){if(a===r)continue;let g=(c[a]??0)/p;g>0&&(i-=g*Math.log2(g),u+=g*g)}for(let a=0;a<C.length;a++){if(a===r)continue;(c[a]??0)>0?l[C[a].id]=null:Ze.has(a)?l[C[a].id]=Ve.get(a)??0:l[C[a].id]=0}let o=new Uint32Array(fe.getMappedRange().slice(0));fe.unmap();let d=o[0]??0;if(R=!1,self.postMessage({type:"metrics",generation:e,population:n,shannonEntropy:i,simpsonIndex:1-u,boundaryLength:d,extinctionTime:l,totalFrames:Gt(),fps:bt,canStepBack:Gt()>1,recordingBytes:b.reduce((a,g)=>a+g.storedBytes,0),recordingRawBytes:b.reduce((a,g)=>a+g.uncompressedBytes,0)}),q){q=!1,O=-1;let a=s.createCommandEncoder();I(a),s.queue.submit([a.finish()]),L()}}).catch(()=>{R=!1})}function Rt(){let e=A*G;return e>1e7?10:e>1e6?50:e>1e5?200:1e3}function Ut(e){if(e<=0)return;let t=Math.ceil(Se/16),r=Math.ceil(G/16),n=s.createCommandEncoder();for(let i=0;i<e;i++){let u=n.beginComputePass();u.setPipeline(me),u.setBindGroup(0,x?pt:dt),u.dispatchWorkgroups(t,r),u.end(),x=!x,m++}s.queue.submit([n.finish()]),J+=e}function Me(){self.postMessage({type:"generation",generation:m,fps:bt})}function Oe(){let e=s.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(me),t.setBindGroup(0,x?pt:dt);let r=Math.ceil(Se/16),n=Math.ceil(G/16);t.dispatchWorkgroups(r,n),t.end(),s.queue.submit([e.finish()]),x=!x,m++}function ee(){dr();let e=Xe.getCurrentTexture().createView(),t=s.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(ze),r.setBindGroup(0,x?Et:At),r.draw(3),r.end(),s.queue.submit([t.finish()])}function X(e){if(ye||Ie){self.requestAnimationFrame(X);return}ke===0&&(ke=e);let t=e-ke;if(t>=1e3&&(bt=J/(t/1e3),J=0,ke=e),z>=0){if(S){let n=!1,i=performance.now()+14;for(;m<z&&performance.now()<i;){if(!re()){n=!0;break}f>=y&&V(),Oe(),J++,j(m)}if(n){B||(B=!0,self.postMessage({type:"backpressure",active:!0})),e-E>=1e3&&(E=e,Me()),s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(X)});return}B&&(B=!1,self.postMessage({type:"backpressure",active:!1}))}else{let n=Math.min(Rt(),z-m);Ut(n)}if(e-E>=1e3&&(E=e,Me()),m>=z){if(z=-1,D=Ke,U=Te,Y=0,$=0,E=0,B&&(B=!1,self.postMessage({type:"backpressure",active:!1})),O=-1,R)q=!0;else{let n=s.createCommandEncoder();I(n),s.queue.submit([n.finish()]),L()}ee(),self.postMessage({type:"stepping",active:!1}),self.requestAnimationFrame(X)}else S?self.requestAnimationFrame(X):s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(X)});return}Zt();let r=!1;if(D){S&&ft()&&re()&&(f>=y&&V(),j(m));let n=!1;Y===0&&(Y=e);let i=e-Y;if(Y=e,U<=0){if(S){let u=!1,l=performance.now()+14;for(;performance.now()<l;){if(!re()){u=!0;break}f>=y&&V(),Oe(),J++,n=!0,j(m)}if(u){if(B||(B=!0,self.postMessage({type:"backpressure",active:!0})),e-E>=1e3&&(E=e,Me()),n&&(e-se>=1e3||se===0)&&!R){se=e;let p=s.createCommandEncoder();I(p),s.queue.submit([p.finish()]),L()}s.queue.onSubmittedWorkDone().then(()=>{self.requestAnimationFrame(X)});return}B&&(B=!1,self.postMessage({type:"backpressure",active:!1}))}else{let u=performance.now()+14,l=Rt();for(;performance.now()<u;)Ut(l),n=!0}e-E>=1e3&&(E=e,Me())}else for($+=i;$>=U;){if(S){if(!re())break;f>=y&&V()}Oe(),J++,$-=U,n=!0,S&&j(m)}n&&(r=(e-se>=1e3||se===0)&&!R)}if(U>0&&!Qe&&ee(),r){se=e;let n=s.createCommandEncoder();I(n),s.queue.submit([n.finish()]),L()}self.requestAnimationFrame(X)}function Tt(e){Q=e,A=e.cols,G=e.rows,Se=Math.ceil(A/4),C=[...e.tribes],Z.clear(),C.forEach((t,r)=>Z.set(t.id,r))}async function wr(e){de=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");s=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),Ie=!1,s.lost.then(r=>{Ie=!0,D=!1,ye=!0;let n=r.message||r.reason||"unknown";self.postMessage({type:"deviceLost",reason:n})}),self.postMessage({type:"limits",maxBytes:ve(),vramBudgetBytes:Wt(),frameByteSize:0,recordingAvailable:!0,vramSimulationBytes:0,vramRecordingBytes:0}),Xe=de.getContext("webgpu"),je=navigator.gpu.getPreferredCanvasFormat(),Xe.configure({device:s,format:je,alphaMode:"opaque"})}async function Kt(){T=s.createBuffer({size:y*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),await qe(y*h,T),f=0,v=[]}async function Qt(){let e=y*h;H=[],_=[];for(let t=0;t<Ye;t++){let r=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});H.push(r),_.push(!0),await qe(e,r)}}function Cr(){jt()}async function xr(){Le=s.createBuffer({size:ht,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Xt(),await st(),it(),pr(),at(),ot(),ct(),ut(),Cr(),K()?(await Kt(),await Qt()):($e(),S=!1),await De(),lt()}async function kr(){if(ye=!0,self.postMessage({type:"rebuilding",active:!0}),await Nt(),!Ie){xt(),Xt(),Ct(K());try{await st(),it(),ot(),ct(),at(),ut(),K()?(await Kt(),await Qt()):($e(),S=!1),await De(),lt()}catch(e){let t=e instanceof Error?e.message:String(e);self.postMessage({type:"gpuError",reason:t});try{xt(),Ct(!1),await st(),it(),ot(),ct(),at(),ut(),S=!1,h=we(),$e(),await De(),lt()}catch(r){console.warn("GPU recovery also failed, device may be lost:",r);return}}ye=!1,self.postMessage({type:"rebuilding",active:!1})}}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{Tt(t.ruleset),await wr(t.canvas),await xr(),D=t.running,U=t.speed<0?0:1e3/t.speed,Y=0,$=0,self.requestAnimationFrame(X);break}case"setRuleset":{if(Tt(t.ruleset),await kr(),m=0,O=-1,Pt(0),Ve=new Map,Ze=new Set,R)q=!0;else{let r=s.createCommandEncoder();I(r),s.queue.submit([r.finish()]),L()}break}case"setRunning":if(!t.running&&z>=0){if(z=-1,D=!1,U=Te,Y=0,$=0,B&&oe(),O=-1,R)q=!0;else{let r=s.createCommandEncoder();I(r),s.queue.submit([r.finish()]),L()}ee(),self.postMessage({type:"stepping",active:!1});break}if(D=t.running,t.running)Y=0,$=0;else if(B&&oe(),O=-1,R)q=!0;else{let r=s.createCommandEncoder();I(r),s.queue.submit([r.finish()]),L()}break;case"setSpeed":{let r=t.speed<0?0:1e3/t.speed;U<=0&&r>0&&(Qe=!0,s.queue.onSubmittedWorkDone().then(()=>{Qe=!1,ee()})),U=r,$=0,E=0;break}case"camera":_t=t.scale,Ft=t.offsetX,Ot=t.offsetY;break;case"resize":de.width=t.width,de.height=t.height;break;case"draw":{let r=t.tribes.map(n=>Z.get(n)).filter(n=>n!==void 0);if(r.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};Ge={centerX:t.x,centerY:t.y,brushSize:t.size,shape:n[t.shape]??0,fill:i[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{yr().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:m,cols:A,rows:G},[r.buffer])}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:m,cols:A,rows:G})});break}case"loadSnapshot":{let r=x?P:M,n=we();if(t.grid.byteLength!==n)break;s.queue.writeBuffer(r,0,t.grid),m=t.generation,Pt(t.generation);break}case"setRecording":{t.recording&&K()&&!S?(S=!0,he()):(!t.recording||!K())&&(S=!1);break}case"getRecording":{if(Be)break;f>0&&V(),W>0?Be=!0:Vt();break}case"stepBack":{let r=0;for(let c of b)r+=c.blockCount;let n=r+f,i=Math.min(t.count,n-1);if(i<=0)break;let u=n-1-i,l=x?P:M;if(u>=r){let c=u-r;f=c+1,v.length=f,m=v[c];let p=s.createCommandEncoder();p.copyBufferToBuffer(T,c*h,l,0,h),s.queue.submit([p.finish()])}else{if(W>0){await new Promise(k=>{let Ce=setInterval(()=>{W===0&&(clearInterval(Ce),k())},10)}),r=0;for(let k of b)r+=k.blockCount}let c=0,p=0,o=0;for(let k=0;k<b.length;k++){let Ce=b[k];if(u<c+Ce.blockCount){p=k,o=u-c;break}c+=Ce.blockCount}let d=b[p],a=await vr(d.filename,d.codec),g=(o+1)*h;s.queue.writeBuffer(T,0,new Uint8Array(a,0,g)),f=o+1,v=d.generations.slice(0,o+1),m=v[o];let w=s.createCommandEncoder();w.copyBufferToBuffer(T,o*h,l,0,h),s.queue.submit([w.finish()]);let Ne=b.splice(p).map(k=>k.filename);Sr(Ne)}if(Bt(),he(),O=-1,R)q=!0;else{let c=s.createCommandEncoder();I(c),s.queue.submit([c.finish()]),L()}ee();break}case"stepForward":{if(Zt(),t.count===1){if(S&&ft()&&re()&&(f>=y&&V(),j(m)),Oe(),J++,S&&re()&&(f>=y&&V(),j(m)),O=-1,R)q=!0;else{let r=s.createCommandEncoder();I(r),s.queue.submit([r.finish()]),L()}ee()}else self.postMessage({type:"stepping",active:!0}),S&&ft()&&re()&&(f>=y&&V(),j(m)),Ke=D,Te=U,z=m+t.count,D=!0,U=0,E=0;break}case"cancelStepping":{if(z>=0){if(z=-1,D=Ke,U=Te,Y=0,$=0,O=-1,R)q=!0;else{let r=s.createCommandEncoder();I(r),s.queue.submit([r.finish()]),L()}ee(),self.postMessage({type:"stepping",active:!1})}break}case"updateChunkCodec":{let r=b.find(n=>n.filename===t.filename);r&&(r.codec=t.codec,r.storedBytes=t.storedBytes,N.chunks=[...b],he());break}case"getUncompressedChunks":{let r=b.filter(n=>n.codec==="raw-packed").map(n=>({filename:n.filename,rawBytes:n.uncompressedBytes}));self.postMessage({type:"uncompressedChunks",chunks:r});break}}};export{We as RECORDING_MAX_FRAME_BYTES};
