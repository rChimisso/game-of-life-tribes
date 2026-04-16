var Fe=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var re={id:"dead",color:"000000"};var n,Pe,ke,te,F,C=0,B=0,ae=0,x=[],E=new Map,v,P,ye,V,Be,qe,Ye,ce,Ne,We,U=!1,je=1,Xe=0,He=0,K=!1,T=100,D=0,L=0,b=0,le,fe,Ve,Ke,Bt=0,de=null,pe,Ze,Je,Z,J,ge,Qe,et,Q,ee,R=-1,A=!1,$=!1,Ce=0,Ge=new Map,Ue=new Set,w=!0,O={chunks:[],generationStart:0,generationEnd:0},tt=0,m=[],ne=-1,rt=!1,nt=100,X,p=0,y=[],M=64,G=0,xt=2,xe=[],q=[],Te="gol-recording",be=null,_=0,St=4096,wt=.9;function ve(e){let t=_>0;_+=e;let r=_>0;t!==r&&self.postMessage({type:"chunksSaving",active:r})}var se=!1;async function Ct(e){if(e.byteLength<St)return{data:e,codec:"raw-packed"};let t=new CompressionStream("deflate-raw"),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let i=[],s=t.readable.getReader();for(;;){let{done:f,value:o}=await s.read();if(f)break;i.push(o)}let u=0;for(let f of i)u+=f.byteLength;if(u>e.byteLength*wt)return{data:e,codec:"raw-packed"};let l=new Uint8Array(u),c=0;for(let f of i)l.set(f,c),c+=f.byteLength;return{data:l.buffer,codec:"deflate-raw"}}async function vt(e){let t=new DecompressionStream("deflate-raw"),r=t.writable.getWriter();r.write(new Uint8Array(e)),r.close();let i=[],s=t.readable.getReader();for(;;){let{done:f,value:o}=await s.read();if(f)break;i.push(o)}let u=0;for(let f of i)u+=f.byteLength;let l=new Uint8Array(u),c=0;for(let f of i)l.set(f,c),c+=f.byteLength;return l.buffer}var H=0,ue=0,ie=0;function Pt(){let e=[],t=ae;e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${x.map(o=>o.id).join(", ")}`),e.push(`// Rules: ${F.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${C}u;`),e.push(`const ROWS: u32 = ${B}u;`),e.push(`const PACKED_COLS: u32 = ${t}u;`),e.push(""),e.push("fn readCell(x: u32, y: u32) -> u32 {"),e.push("  let wordIdx = y * PACKED_COLS + (x >> 2u);"),e.push("  let shift = (x & 3u) * 8u;"),e.push("  return (gridIn[wordIdx] >> shift) & 0xFFu;"),e.push("}"),e.push("");let r=E.get(re.id)??0;e.push("fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {");let i=Gt(F.rules.map(o=>o.clause)),s=new Map,u=0;for(let o of i){let d=`count_${u++}`;s.set(o,d)}for(let[o,d]of s){let a=o.split(",").map(Number),h=Le().map(k=>`select(0u, 1u, ${a.map(S=>`${k} == ${S}u`).join(" || ")})`);e.push(`  let ${d} = ${h.join(" + ")};`)}i.size>0&&e.push("");let l=Ut(F.rules.map(o=>o.clause)),c=new Map,f=0;for(let o of l)if(s.has(o))c.set(o,s.get(o));else{let d=`eq_count_${f++}`;c.set(o,d)}for(let[o,d]of c){if(s.has(o))continue;let a=o.split(",").map(Number),h=Le().map(k=>`select(0u, 1u, ${a.map(S=>`${k} == ${S}u`).join(" || ")})`);e.push(`  let ${d} = ${h.join(" + ")};`)}l.size>0&&f>0&&e.push(""),e.push(`  var result: u32 = ${r}u;`),e.push("");for(let o=0;o<F.rules.length;o++){let d=F.rules[o],a=me(d.clause,s,c),g=kt(d.tribe);o===0?e.push(`  if (${a}) {`):e.push(`  } else if (${a}) {`),e.push(`    result = ${g}u;`)}F.rules.length>0&&e.push("  }"),e.push(""),e.push("  return result;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let px = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (px >= PACKED_COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let baseX = px * 4u;"),e.push("  var packed: u32 = 0u;"),e.push(""),e.push("  for (var i: u32 = 0u; i < 4u; i = i + 1u) {"),e.push("    let x = baseX + i;"),e.push("    if (x >= COLS) { break; }"),e.push(""),e.push("    let selfTribe = readCell(x, y);");for(let o=-1;o<=1;o++)for(let d=-1;d<=1;d++){if(d===0&&o===0)continue;let a=it(d,o),g=De("x",d,"COLS"),h=De("y",o,"ROWS");e.push(`    let ${a} = readCell(${g}, ${h});`)}return e.push(""),e.push("    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & 0xFFu) << (i * 8u));"),e.push("  }"),e.push(""),e.push("  gridOut[y * PACKED_COLS + px] = packed;"),e.push("}"),e.join(`
`)}function it(e,t){return`n${t===-1?"T":t===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function Le(){let e=[];for(let t=-1;t<=1;t++)for(let r=-1;r<=1;r++)r===0&&t===0||e.push(it(r,t));return e}function De(e,t,r){return t===0?e:t===-1?`(${e} + ${r} - 1u) % ${r}`:`(${e} + 1u) % ${r}`}function Y(e){let t=[];for(let r of e)if(r==="any")for(let i=0;i<x.length;i++)t.push(i);else{let i=E.get(r);i!==void 0&&t.push(i)}return[...new Set(t)]}function kt(e){return e==="any"?0:E.get(e)??0}function Gt(e){let t=new Set;for(let r of e)Me(r,t);return t}function Me(e,t){switch(e.kind){case"count":{let r=Y(e.tribes).sort();t.add(r.join(","));break}case"not":Me(e.clause,t);break;case"and":case"or":for(let r of e.clauses)Me(r,t);break}}function Ut(e){let t=new Set;for(let r of e)Re(r,t);return t}function Re(e,t){switch(e.kind){case"equality":{let r=Y(e.tribe1).sort(),i=Y(e.tribe2).sort();t.add(r.join(",")),t.add(i.join(","));break}case"not":Re(e.clause,t);break;case"and":case"or":for(let r of e.clauses)Re(r,t);break}}function me(e,t,r){switch(e.kind){case"is":{let i=Y(e.tribes);return i.length===0?"false":i.length===x.length?"true":`(${i.map(u=>`selfTribe == ${u}u`).join(" || ")})`}case"count":{let i=Y(e.tribes).sort(),s=t.get(i.join(","));return`(${s} >= ${e.interval[0]}u && ${s} <= ${e.interval[1]}u)`}case"equality":{let i=Y(e.tribe1).sort(),s=Y(e.tribe2).sort(),u=r.get(i.join(",")),l=r.get(s.join(","));return`(${u} == ${l})`}case"not":return`!(${me(e.clause,t,r)})`;case"and":return`(${e.clauses.map(s=>me(s,t,r)).join(" && ")})`;case"or":return`(${e.clauses.map(s=>me(s,t,r)).join(" || ")})`;default:return"false"}}var st=48;function Tt(){let e=new ArrayBuffer(st),t=new Float32Array(e),r=new Uint32Array(e);t[0]=te.width,t[1]=te.height,t[2]=C,t[3]=B,t[4]=je,t[6]=Xe,t[7]=He,r[8]=x.length,n.queue.writeBuffer(ye,0,e)}function Oe(){return ae*B*4}function at(){let e=Oe();v=n.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),P=n.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});let t=E.get(re.id)??0,r=t|t<<8|t<<16|t<<24,i=new Uint32Array(ae*B);i.fill(r),n.queue.writeBuffer(v,0,i),n.queue.writeBuffer(P,0,i),U=!1}function ot(){let e=new Uint32Array(256);for(let t=0;t<x.length;t++){let r=x[t].color,i=parseInt(r.substring(0,2),16),s=parseInt(r.substring(2,4),16),u=parseInt(r.substring(4,6),16);e[t]=i|s<<8|u<<16}V&&V.destroy(),V=n.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),n.queue.writeBuffer(V,0,e)}function Mt(){let e=n.createShaderModule({code:Fe});Be=n.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:ke}]},primitive:{topology:"triangle-list"}})}function ut(){qe=n.createBindGroup({layout:Be.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ye}},{binding:1,resource:{buffer:v}},{binding:2,resource:{buffer:V}}]}),Ye=n.createBindGroup({layout:Be.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ye}},{binding:1,resource:{buffer:P}},{binding:2,resource:{buffer:V}}]})}function ct(){let e=Pt(),t=n.createShaderModule({code:e});ce=n.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),Ne=n.createBindGroup({layout:ce.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:P}}]}),We=n.createBindGroup({layout:ce.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:v}}]})}var Rt=`
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
`;function At(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${C}u;
const ROWS: u32 = ${B}u;

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
`}function lt(){let e=Rt.replace("const COLS: u32 = 0u;",`const COLS: u32 = ${C}u;`).replace("const ROWS: u32 = 0u;",`const ROWS: u32 = ${B}u;`),t=n.createShaderModule({code:e});pe=n.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),Z=n.createBuffer({size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),J=n.createBuffer({size:256*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Ze=n.createBindGroup({layout:pe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:Z}}]}),Je=n.createBindGroup({layout:pe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:Z}}]});let r=n.createShaderModule({code:At()});ge=n.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),Q=n.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),ee=n.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Qe=n.createBindGroup({layout:ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:Q}}]}),et=n.createBindGroup({layout:ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:Q}}]})}var ft=176,_t=`
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
`;function dt(){let e=n.createShaderModule({code:_t});le=n.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),fe=n.createBuffer({size:ft,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Ve=n.createBindGroup({layout:le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:fe}}]}),Ke=n.createBindGroup({layout:le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:fe}}]})}function Et(e,t,r,i,s,u,l){let c=E.get(re.id)??0,f=Bt++,o=new ArrayBuffer(ft),d=new Int32Array(o),a=new Uint32Array(o);d[0]=t,d[1]=r,a[2]=C,a[3]=B,a[4]=i,a[5]=s,a[6]=u,a[7]=c,a[8]=f,a[9]=l.length,a[10]=0;for(let k=0;k<l.length&&k<32;k++)a[11+k]=l[k];n.queue.writeBuffer(fe,0,o);let g=Math.ceil(i/8),h=e.beginComputePass();h.setPipeline(le),h.setBindGroup(0,U?Ke:Ve),h.dispatchWorkgroups(g,g),h.end()}function Ot(){let e=U?P:v,t=Oe(),r;try{r=n.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch{return Promise.reject(new Error(`Failed to allocate ${t} byte readback buffer`))}let i=n.createCommandEncoder();return i.copyBufferToBuffer(e,0,r,0,t),n.queue.submit([i.finish()]),r.mapAsync(GPUMapMode.READ).then(()=>{let s=new Uint32Array(r.getMappedRange().slice(0));return r.unmap(),r.destroy(),s})}function It(){let e=C*B,t=e>1e6?10:e>1e5?3:1;if(T<=0)return 60*t;let r=1e3/T,i=Math.max(1,Math.round(r));return ie>0&&ie<1&&(i=Math.max(i,Math.ceil(1/ie))),i*t}function zt(){G=Oe();let e=n.limits.maxBufferSize,t=32*1024*1024;M=Math.min(256,Math.max(1,Math.floor(Math.min(t,e)/G)))}function N(){return p<M?!0:q.some(e=>e)}function I(e){let t=U?P:v,r=p*G,i=n.createCommandEncoder();i.copyBufferToBuffer(t,0,X,r,G),n.queue.submit([i.finish()]),y.push(e),p++}function z(){if(p===0)return;let e=q.indexOf(!0);if(e<0)return;q[e]=!1;let t=xe[e],r=p*G,i=tt++,s=[...y],u=s[0],l=s[s.length-1],c=`chunk-${String(i).padStart(6,"0")}.bin`,f=p,o=n.createCommandEncoder();o.copyBufferToBuffer(X,0,t,0,r),n.queue.submit([o.finish()]);let d={chunkId:i,generationStart:u,generationEnd:l,blockCount:f,codec:"raw-packed",uncompressedBytes:r,storedBytes:r,generations:s,filename:c};ve(1),t.mapAsync(GPUMapMode.READ).then(async()=>{let a=t.getMappedRange(),g=new ArrayBuffer(r);new Uint8Array(g).set(new Uint8Array(a,0,r)),t.unmap(),q[e]=!0;let{data:h,codec:k}=await Ct(g);d.codec=k,d.storedBytes=h.byteLength,m.push(d),Ie(),Ft(d,h).then(()=>{ve(-1),se&&_===0&&(se=!1,gt())})}).catch(()=>{q[e]=!0,ve(-1)}),p=0,y=[]}function Ie(){m.length>0&&(O.generationStart=m[0].generationStart,O.generationEnd=m[m.length-1].generationEnd),y.length>0&&(m.length===0&&(O.generationStart=y[0]),O.generationEnd=y[y.length-1]),O.chunks=[...m]}function Ae(e){tt=0,p=0,y=[],m=[],_>0&&(_=0,self.postMessage({type:"chunksSaving",active:!1})),se=!1,O={chunks:[],generationStart:e,generationEnd:e},pt()}async function ze(){return be||(be=await(await navigator.storage.getDirectory()).getDirectoryHandle(Te,{create:!0})),be}async function Ft(e,t){let s=await(await(await ze()).getFileHandle(e.filename,{create:!0})).createWritable();await s.write(t),await s.close()}async function Lt(e){let t=await ze();for(let r of e)try{await t.removeEntry(r)}catch{}}async function pt(){let e=await navigator.storage.getDirectory();try{await e.removeEntry(Te,{recursive:!0})}catch{}be=await e.getDirectoryHandle(Te,{create:!0})}function gt(){Ie(),self.postMessage({type:"recording",manifest:{chunks:m.map(e=>({...e,generations:[...e.generations]})),generationStart:O.generationStart,generationEnd:O.generationEnd},cols:C,rows:B})}function _e(){return p>0?y[p-1]!==b:m.length>0?m[m.length-1].generationEnd!==b:!0}function bt(){if(!de)return;let e=de;de=null;let t=n.createCommandEncoder();Et(t,e.centerX,e.centerY,e.brushSize,e.shape,e.fill,e.tribeIds),n.queue.submit([t.finish()]),w&&p>0&&y[p-1]===b&&(p--,y.pop(),I(b))}async function Dt(e,t="raw-packed"){let u=await(await(await(await ze()).getFileHandle(e)).getFile()).arrayBuffer();return t==="deflate-raw"?vt(u):u}function $t(){let e=p;for(let t of m)e+=t.blockCount;return e}function W(e){let t=Math.ceil(C/16),r=Math.ceil(B/16),i=new Uint32Array(256);n.queue.writeBuffer(Z,0,i);let s=e.beginComputePass();s.setPipeline(pe),s.setBindGroup(0,U?Je:Ze),s.dispatchWorkgroups(t,r),s.end(),e.copyBufferToBuffer(Z,0,J,0,256*4);let u=new Uint32Array([0]);n.queue.writeBuffer(Q,0,u);let l=e.beginComputePass();l.setPipeline(ge),l.setBindGroup(0,U?et:Qe),l.dispatchWorkgroups(t,r),l.end(),e.copyBufferToBuffer(Q,0,ee,0,4)}function j(){let e=b;if(e===R||A)return;R=e,A=!0;let t=[];t.push(J.mapAsync(GPUMapMode.READ)),t.push(ee.mapAsync(GPUMapMode.READ)),Promise.all(t).then(()=>{let r=E.get(re.id)??0,i={},s=0,u=0,l={},c=new Uint32Array(J.getMappedRange().slice(0));J.unmap();let f=0;for(let a=0;a<x.length;a++){let g=c[a]??0;i[x[a].id]=g,a!==r&&(f+=g,g>0&&(Ge.set(a,e),Ue.add(a)))}if(f>0)for(let a=0;a<x.length;a++){if(a===r)continue;let g=(c[a]??0)/f;g>0&&(s-=g*Math.log2(g),u+=g*g)}for(let a=0;a<x.length;a++){if(a===r)continue;(c[a]??0)>0?l[x[a].id]=null:Ue.has(a)?l[x[a].id]=Ge.get(a)??0:l[x[a].id]=0}let o=new Uint32Array(ee.getMappedRange().slice(0));ee.unmap();let d=o[0]??0;if(A=!1,self.postMessage({type:"metrics",generation:e,population:i,shannonEntropy:s,simpsonIndex:1-u,boundaryLength:d,extinctionTime:l,fps:ie,canStepBack:$t()>1,recordingBytes:m.reduce((a,g)=>a+g.storedBytes,0)}),$){$=!1,R=-1;let a=n.createCommandEncoder();W(a),n.queue.submit([a.finish()]),j()}})}function he(){let e=n.createCommandEncoder(),t=e.beginComputePass();t.setPipeline(ce),t.setBindGroup(0,U?We:Ne);let r=Math.ceil(ae/16),i=Math.ceil(B/16);t.dispatchWorkgroups(r,i),t.end(),n.queue.submit([e.finish()]),U=!U,b++}function Se(){Tt();let e=Pe.getCurrentTexture().createView(),t=n.createCommandEncoder(),r=t.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(Be),r.setBindGroup(0,U?Ye:qe),r.draw(3),r.end(),n.queue.submit([t.finish()])}function Ee(e){if(ne>=0){let r=performance.now()+14;for(;b<ne&&performance.now()<r;){if(w){if(!N())break;p>=M&&z()}he(),H++,w&&I(b)}if(b>=ne){if(ne=-1,K=rt,T=nt,L=0,D=0,R=-1,A)$=!0;else{let i=n.createCommandEncoder();W(i),n.queue.submit([i.finish()]),j()}Se(),self.postMessage({type:"stepping",active:!1})}self.requestAnimationFrame(Ee);return}bt(),ue===0&&(ue=e);let t=e-ue;if(t>=1e3&&(ie=H/(t/1e3),H=0,ue=e),K){w&&_e()&&N()&&(p>=M&&z(),I(b));let r=!1;L===0&&(L=e);let i=e-L;L=e;let s=It();if(T<=0){let u=performance.now()+14;for(;performance.now()<u;){if(w){if(!N())break;p>=M&&z()}he(),H++,r=!0,w&&I(b)}}else for(D+=i;D>=T;){if(w){if(!N())break;p>=M&&z()}he(),H++,D-=T,r=!0,w&&I(b)}if(r&&(b%s===0||b-R>=s*2)){let u=e-Ce,l=C*B>1e6?3e3:C*B>1e5?2e3:1e3;if((u>=l||Ce===0)&&!A){Ce=e;let c=n.createCommandEncoder();W(c),n.queue.submit([c.finish()]),j()}}}T>0&&Se(),self.requestAnimationFrame(Ee)}function $e(e){F=e,C=e.cols,B=e.rows,ae=Math.ceil(C/4),x=[...e.tribes],E.clear(),x.forEach((t,r)=>E.set(t.id,r))}async function qt(e){te=e;let t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");n=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize}}),self.postMessage({type:"limits",maxBytes:Math.min(n.limits.maxBufferSize,n.limits.maxStorageBufferBindingSize)}),Pe=te.getContext("webgpu"),ke=navigator.gpu.getPreferredCanvasFormat(),Pe.configure({device:n,format:ke,alphaMode:"opaque"})}function mt(){zt(),X=n.createBuffer({size:M*G,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),p=0,y=[]}function ht(){let e=M*G;xe=[],q=[];for(let t=0;t<xt;t++)xe.push(n.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})),q.push(!0)}function Yt(){pt()}function Nt(){ye=n.createBuffer({size:st,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),at(),ot(),Mt(),ut(),ct(),dt(),lt(),Yt(),mt(),ht()}function Wt(){v?.destroy(),P?.destroy(),Z?.destroy(),J?.destroy(),Q?.destroy(),ee?.destroy(),X?.destroy();for(let e of xe)e?.destroy();at(),ot(),ct(),dt(),ut(),lt(),mt(),ht(),Ae(b)}self.onmessage=async e=>{let t=e.data;switch(t.type){case"init":{$e(t.ruleset),await qt(t.canvas),Nt(),K=t.running,T=t.speed<0?0:1e3/t.speed,L=0,D=0,self.requestAnimationFrame(Ee);break}case"setRuleset":{if($e(t.ruleset),Wt(),b=0,R=-1,Ae(0),Ge=new Map,Ue=new Set,A)$=!0;else{let r=n.createCommandEncoder();W(r),n.queue.submit([r.finish()]),j()}break}case"setRunning":if(K=t.running,t.running)L=0,D=0;else if(R=-1,A)$=!0;else{let r=n.createCommandEncoder();W(r),n.queue.submit([r.finish()]),j()}break;case"setSpeed":T=t.speed<0?0:1e3/t.speed,D=0;break;case"camera":je=t.scale,Xe=t.offsetX,He=t.offsetY;break;case"resize":te.width=t.width,te.height=t.height;break;case"draw":{let r=t.tribes.map(i=>E.get(i)).filter(i=>i!==void 0);if(r.length>0){let i={square:0,round:1,diamond:2,vline:3,hline:4},s={full:0,spray:1,outline:2};de={centerX:t.x,centerY:t.y,brushSize:t.size,shape:i[t.shape]??0,fill:s[t.fill]??0,tribeIds:r}}break}case"getSnapshot":{Ot().then(r=>{self.postMessage({type:"snapshot",grid:r,generation:b,cols:C,rows:B},[r.buffer])}).catch(()=>{let r=new Uint32Array(0);self.postMessage({type:"snapshot",grid:r,generation:b,cols:C,rows:B})});break}case"loadSnapshot":{let r=U?P:v;n.queue.writeBuffer(r,0,t.grid),b=t.generation,Ae(t.generation);break}case"setRecording":{t.recording&&!w?w=!0:t.recording||(w=!1);break}case"getRecording":{if(se)break;p>0&&z(),_>0?se=!0:gt();break}case"stepBack":{let r=0;for(let c of m)r+=c.blockCount;let i=r+p,s=Math.min(t.count,i-1);if(s<=0)break;let u=i-1-s,l=U?P:v;if(u>=r){let c=u-r;p=c+1,y.length=p,b=y[c];let f=n.createCommandEncoder();f.copyBufferToBuffer(X,c*G,l,0,G),n.queue.submit([f.finish()])}else{if(_>0){await new Promise(S=>{let oe=setInterval(()=>{_===0&&(clearInterval(oe),S())},10)}),r=0;for(let S of m)r+=S.blockCount}let c=0,f=0,o=0;for(let S=0;S<m.length;S++){let oe=m[S];if(u<c+oe.blockCount){f=S,o=u-c;break}c+=oe.blockCount}let d=m[f],a=await Dt(d.filename,d.codec),g=(o+1)*G;n.queue.writeBuffer(X,0,new Uint8Array(a,0,g)),p=o+1,y=d.generations.slice(0,o+1),b=y[o];let h=n.createCommandEncoder();h.copyBufferToBuffer(X,o*G,l,0,G),n.queue.submit([h.finish()]);let we=m.splice(f).map(S=>S.filename);Lt(we)}if(Ie(),R=-1,A)$=!0;else{let c=n.createCommandEncoder();W(c),n.queue.submit([c.finish()]),j()}Se();break}case"stepForward":{if(bt(),t.count===1){if(w&&_e()&&N()&&(p>=M&&z(),I(b)),he(),H++,w&&N()&&(p>=M&&z(),I(b)),R=-1,A)$=!0;else{let r=n.createCommandEncoder();W(r),n.queue.submit([r.finish()]),j()}Se()}else self.postMessage({type:"stepping",active:!0}),w&&_e()&&N()&&(p>=M&&z(),I(b)),rt=K,nt=T,ne=b+t.count,K=!0,T=0;break}}};
