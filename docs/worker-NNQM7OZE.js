var Ue=`// Render shader: draws the grid as a full-screen quad.\r
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
  // Read tribe ID from grid buffer (one u32 per cell).\r
  let cell_index = iy * u32(cols) + ix;\r
  let tribe_id = grid[cell_index];\r
\r
  // Look up tribe color (packed as 0x00BBGGRR).\r
  let color_packed = tribe_colors[tribe_id];\r
  let r = f32(color_packed & 0xFFu) / 255.0;\r
  let g = f32((color_packed >> 8u) & 0xFFu) / 255.0;\r
  let b = f32((color_packed >> 16u) & 0xFFu) / 255.0;\r
\r
  return vec4f(r, g, b, 1.0);\r
}\r
`;var H={id:"dead",color:"000000"};var s,pe,ge,X,_,l=0,f=0,h=[],T=new Map,x,S,le,I,de,ve,Re,ee,Me,Ae,P=!1,_e=1,Oe=0,ke=0,R=!1,G=100,z=0,O=0,y=0,re,te,ze,Ee,rr=0,ne=null,se,Ie,$e,F,Y,ie,De,Le,N,W,A=-1,w=!1,fe=0,j,be=new Map,me=new Set,C=!0,g=[],M=0,Z=!1,$=-1,he=!1,ye=100,Ge,Pe,ae=!1,oe=!0,ue=!0,k=0,Q=0,qe=0;function tr(){let e=[];e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${h.map(c=>c.id).join(", ")}`),e.push(`// Rules: ${_.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${l}u;`),e.push(`const ROWS: u32 = ${f}u;`),e.push(`const TOTAL: u32 = ${l*f}u;`),e.push(""),e.push("fn readCell(idx: u32) -> u32 {"),e.push("  return gridIn[idx];"),e.push("}"),e.push(""),e.push("fn writeCell(idx: u32, tribe: u32) {"),e.push("  gridOut[idx] = tribe;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let x = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (x >= COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let idx = y * COLS + x;"),e.push(""),e.push("  let selfTribe = readCell(idx);"),e.push(""),e.push("  // Neighbor tribe IDs (toroidal wrapping).");for(let c=-1;c<=1;c++)for(let p=-1;p<=1;p++){if(p===0&&c===0)continue;let m=Fe(p,c),b=we("x",p,"COLS"),o=we("y",c,"ROWS");e.push(`  let ${m} = readCell(${o} * COLS + ${b});`)}e.push("");let r=sr(_.rules.map(c=>c.clause)),t=new Map,n=0;for(let c of r){let p=`count_${n++}`;t.set(c,p)}for(let[c,p]of t){let m=c.split(",").map(Number),o=Ce().map(d=>`select(0u, 1u, ${m.map(v=>`${d} == ${v}u`).join(" || ")})`);e.push(`  let ${p} = ${o.join(" + ")};`)}r.size>0&&e.push("");let i=ir(_.rules.map(c=>c.clause)),a=new Map,u=0;for(let c of i)if(t.has(c))a.set(c,t.get(c));else{let p=`eq_count_${u++}`;a.set(c,p)}for(let[c,p]of a){if(t.has(c))continue;let m=c.split(",").map(Number),o=Ce().map(d=>`select(0u, 1u, ${m.map(v=>`${d} == ${v}u`).join(" || ")})`);e.push(`  let ${p} = ${o.join(" + ")};`)}i.size>0&&u>0&&e.push("");let B=T.get(H.id)??0;e.push(`  var result: u32 = ${B}u;`),e.push("");for(let c=0;c<_.rules.length;c++){let p=_.rules[c],m=ce(p.clause,t,a),b=nr(p.tribe);c===0?e.push(`  if (${m}) {`):e.push(`  } else if (${m}) {`),e.push(`    result = ${b}u;`)}return _.rules.length>0&&e.push("  }"),e.push(""),e.push("  writeCell(idx, result);"),e.push("}"),e.join(`
`)}function Fe(e,r){return`n${r===-1?"T":r===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function Ce(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(Fe(t,r));return e}function we(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function E(e){let r=[];for(let t of e)if(t==="any")for(let n=0;n<h.length;n++)r.push(n);else{let n=T.get(t);n!==void 0&&r.push(n)}return[...new Set(r)]}function nr(e){return e==="any"?0:T.get(e)??0}function sr(e){let r=new Set;for(let t of e)Be(t,r);return r}function Be(e,r){switch(e.kind){case"count":{let t=E(e.tribes).sort();r.add(t.join(","));break}case"not":Be(e.clause,r);break;case"and":case"or":for(let t of e.clauses)Be(t,r);break}}function ir(e){let r=new Set;for(let t of e)xe(t,r);return r}function xe(e,r){switch(e.kind){case"equality":{let t=E(e.tribe1).sort(),n=E(e.tribe2).sort();r.add(t.join(",")),r.add(n.join(","));break}case"not":xe(e.clause,r);break;case"and":case"or":for(let t of e.clauses)xe(t,r);break}}function ce(e,r,t){switch(e.kind){case"is":{let n=E(e.tribes);return n.length===0?"false":n.length===h.length?"true":`(${n.map(a=>`selfTribe == ${a}u`).join(" || ")})`}case"count":{let n=E(e.tribes).sort(),i=r.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case"equality":{let n=E(e.tribe1).sort(),i=E(e.tribe2).sort(),a=t.get(n.join(",")),u=t.get(i.join(","));return`(${a} == ${u})`}case"not":return`!(${ce(e.clause,r,t)})`;case"and":return`(${e.clauses.map(i=>ce(i,r,t)).join(" && ")})`;case"or":return`(${e.clauses.map(i=>ce(i,r,t)).join(" || ")})`;default:return"false"}}var Ye=48;function ar(){let e=new ArrayBuffer(Ye),r=new Float32Array(e),t=new Uint32Array(e);r[0]=X.width,r[1]=X.height,r[2]=l,r[3]=f,r[4]=_e,r[6]=Oe,r[7]=ke,t[8]=h.length,s.queue.writeBuffer(le,0,e)}function V(){return l*f*4}function Ne(){let e=V();x=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),S=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});let r=T.get(H.id)??0,t=new Uint32Array(l*f);t.fill(r),s.queue.writeBuffer(x,0,t),s.queue.writeBuffer(S,0,t),P=!1}function We(){let e=new Uint32Array(256);for(let r=0;r<h.length;r++){let t=h[r].color,n=parseInt(t.substring(0,2),16),i=parseInt(t.substring(2,4),16),a=parseInt(t.substring(4,6),16);e[r]=n|i<<8|a<<16}I&&I.destroy(),I=s.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(I,0,e)}function or(){let e=s.createShaderModule({code:Ue});de=s.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:ge}]},primitive:{topology:"triangle-list"}})}function je(){ve=s.createBindGroup({layout:de.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:le}},{binding:1,resource:{buffer:x}},{binding:2,resource:{buffer:I}}]}),Re=s.createBindGroup({layout:de.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:le}},{binding:1,resource:{buffer:S}},{binding:2,resource:{buffer:I}}]})}function Xe(){let e=tr(),r=s.createShaderModule({code:e});ee=s.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),Me=s.createBindGroup({layout:ee.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:S}}]}),Ae=s.createBindGroup({layout:ee.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:x}}]})}var ur=`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const COLS: u32 = 0u; // placeholder, replaced at creation time
const ROWS: u32 = 0u; // placeholder, replaced at creation time

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x;
  let y = gid.y;
  if (x >= COLS || y >= ROWS) { return; }
  let tribe = grid[y * COLS + x];
  atomicAdd(&hist[tribe], 1u);
}
`;function cr(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${l}u;
const ROWS: u32 = ${f}u;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x;
  let y = gid.y;
  if (x >= COLS || y >= ROWS) { return; }
  let idx = y * COLS + x;
  let self_tribe = grid[idx];

  // Check right neighbor.
  let rx = (x + 1u) % COLS;
  if (grid[y * COLS + rx] != self_tribe) {
    atomicAdd(&boundary, 1u);
  }

  // Check bottom neighbor.
  let by = (y + 1u) % ROWS;
  if (grid[by * COLS + x] != self_tribe) {
    atomicAdd(&boundary, 1u);
  }
}
`}function Ve(){let e=ur.replace("const COLS: u32 = 0u;",`const COLS: u32 = ${l}u;`).replace("const ROWS: u32 = 0u;",`const ROWS: u32 = ${f}u;`),r=s.createShaderModule({code:e});se=s.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),F=s.createBuffer({size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),Y=s.createBuffer({size:256*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Ie=s.createBindGroup({layout:se.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:F}}]}),$e=s.createBindGroup({layout:se.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:F}}]});let t=s.createShaderModule({code:cr()});ie=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),N=s.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),W=s.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),j=s.createBuffer({size:V(),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),De=s.createBindGroup({layout:ie.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:N}}]}),Le=s.createBindGroup({layout:ie.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:N}}]})}var He=176,lr=`
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

@group(0) @binding(0) var<storage, read_write> grid: array<u32>;
@group(0) @binding(1) var<uniform> params: BrushParams;

fn pcg(inp: u32) -> u32 {
  var state = inp * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn inShape(dx: i32, dy: i32, half: i32, size: u32, shape: u32) -> bool {
  switch (shape) {
    case 1u: { // round
      let fhalf = f32(size - 1u) / 2.0;
      let fdx = f32(dx) - fhalf + f32(half);
      let fdy = f32(dy) - fhalf + f32(half);
      let r = f32(size) / 2.0 - 0.25;
      return fdx * fdx + fdy * fdy <= r * r;
    }
    case 2u: { // diamond
      return abs(dx) + abs(dy) <= half;
    }
    case 3u: { // line (vertical)
      return dx == 0;
    }
    case 4u: { // line (horizontal)
      return dy == 0;
    }
    default: { // 0 = square
      return abs(dx) <= half && abs(dy) <= half;
    }
  }
}

fn onBorder(dx: i32, dy: i32, half: i32, size: u32, shape: u32) -> bool {
  if (!inShape(dx, dy, half, size, shape)) { return false; }
  // Check 4-connected neighbors: if any is outside shape, this is a border cell.
  return !inShape(dx - 1, dy, half, size, shape)
      || !inShape(dx + 1, dy, half, size, shape)
      || !inShape(dx, dy - 1, half, size, shape)
      || !inShape(dx, dy + 1, half, size, shape);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let bx = gid.x;
  let by = gid.y;
  if (bx >= params.brushSize || by >= params.brushSize) { return; }
  let idx = by * params.brushSize + bx;

  let half = i32(params.brushSize - 1u) / 2;
  let dy = i32(by) - half;
  let dx = i32(bx) - half;

  // Shape test.
  if (params.fill == 2u) {
    // Outline mode: only draw border cells.
    if (!onBorder(dx, dy, half, params.brushSize, params.shape)) { return; }
  } else {
    if (!inShape(dx, dy, half, params.brushSize, params.shape)) { return; }
  }

  // Toroidal wrapping.
  let cx = ((params.centerX + dx) % i32(params.cols) + i32(params.cols)) % i32(params.cols);
  let cy = ((params.centerY + dy) % i32(params.rows) + i32(params.rows)) % i32(params.rows);
  let cellIdx = u32(cy) * params.cols + u32(cx);

  // Pick a random tribe from the list.
  let h = pcg(params.seed ^ idx);
  let selectedTribe = params.tribeIds[h % params.tribeCount];

  // Spray fill: 50% chance to skip/set-dead (use high bits to avoid
  // correlation with tribe selection which uses low bits via modulo).
  if (params.fill == 1u) {
    if (((h >> 16u) & 1u) != 0u) {
      if (selectedTribe != params.deadId) {
        grid[cellIdx] = params.deadId;
      }
      return;
    }
  }

  grid[cellIdx] = selectedTribe;
}
`;function Ze(){let e=s.createShaderModule({code:lr});re=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),te=s.createBuffer({size:He,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),ze=s.createBindGroup({layout:re.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:te}}]}),Ee=s.createBindGroup({layout:re.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:te}}]})}function dr(e,r,t,n,i,a,u){let B=T.get(H.id)??0,c=rr++,p=new ArrayBuffer(He),m=new Int32Array(p),b=new Uint32Array(p);m[0]=r,m[1]=t,b[2]=l,b[3]=f,b[4]=n,b[5]=i,b[6]=a,b[7]=B,b[8]=c,b[9]=u.length,b[10]=0;for(let U=0;U<u.length&&U<32;U++)b[11+U]=u[U];s.queue.writeBuffer(te,0,p);let o=Math.ceil(n/8),d=e.beginComputePass();d.setPipeline(re),d.setBindGroup(0,P?Ee:ze),d.dispatchWorkgroups(o,o),d.end()}function D(){let e=P?S:x,r=V(),t=s.createBuffer({size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),n=s.createCommandEncoder();return n.copyBufferToBuffer(e,0,t,0,r),s.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),i})}function fr(){if(G<=0)return 60;let e=1e3/G;return Math.max(1,Math.round(e))}function L(e){let r=new Uint32Array(256);s.queue.writeBuffer(F,0,r);let t=new Uint32Array([0]);s.queue.writeBuffer(N,0,t);let n=Math.ceil(l/16),i=Math.ceil(f/16),a=e.beginComputePass();a.setPipeline(se),a.setBindGroup(0,P?$e:Ie),a.dispatchWorkgroups(n,i),a.end();let u=e.beginComputePass();u.setPipeline(ie),u.setBindGroup(0,P?Le:De),u.dispatchWorkgroups(n,i),u.end(),e.copyBufferToBuffer(F,0,Y,0,256*4),e.copyBufferToBuffer(N,0,W,0,4);let B=P?S:x;e.copyBufferToBuffer(B,0,j,0,V())}function q(){let e=y;e===A||w||(A=e,w=!0,Y.mapAsync(GPUMapMode.READ).then(()=>{let r=new Uint32Array(Y.getMappedRange().slice(0));return Y.unmap(),W.mapAsync(GPUMapMode.READ).then(()=>{let t=new Uint32Array(W.getMappedRange().slice(0));return W.unmap(),j.mapAsync(GPUMapMode.READ).then(()=>{let n=new Uint32Array(j.getMappedRange().slice(0));j.unmap(),w=!1;let i={},a=0,u=T.get(H.id)??0;for(let o=0;o<h.length;o++){let d=r[o]??0;i[h[o].id]=d,o!==u&&(a+=d,d>0&&(be.set(o,e),me.add(o)))}let B=0,c=0;if(a>0)for(let o=0;o<h.length;o++){if(o===u)continue;let d=(r[o]??0)/a;d>0&&(B-=d*Math.log2(d),c+=d*d)}let p={};for(let o=0;o<h.length;o++){if(o===u)continue;(r[o]??0)>0?p[h[o].id]=null:me.has(o)?p[h[o].id]=be.get(o)??0:p[h[o].id]=0}let m=new Uint32Array(h.length);for(let o=0;o<f;o++)for(let d=0;d<l;d++){let U=o*l+d,v=n[U],Ke=(d+1)%l;n[o*l+Ke]!==v&&m[v]++;let Qe=(o+1)%f;n[Qe*l+d]!==v&&m[v]++}let b={};for(let o=0;o<h.length;o++)o!==u&&(b[h[o].id]=m[o]);self.postMessage({type:"metrics",generation:e,population:i,shannonEntropy:B,simpsonIndex:1-c,boundaryLength:t[0]??0,frontierLength:b,extinctionTime:p,fps:qe})})})}))}function J(){let e=s.createCommandEncoder(),r=e.beginComputePass();r.setPipeline(ee),r.setBindGroup(0,P?Ae:Me);let t=Math.ceil(l/16),n=Math.ceil(f/16);r.dispatchWorkgroups(t,n),r.end(),s.queue.submit([e.finish()]),P=!P,y++}function K(){ar();let e=pe.getCurrentTexture().createView(),r=s.createCommandEncoder(),t=r.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(de),t.setBindGroup(0,P?Re:ve),t.draw(3),t.end(),s.queue.submit([r.finish()])}function Se(e){if($>=0){let t=performance.now()+14;for(;y<$&&performance.now()<t;)J(),k++;if(y>=$){if($=-1,R=he,G=ye,O=0,z=0,C&&D().then(n=>{let i=new Uint8Array(l*f);for(let a=0;a<l*f;a++)i[a]=n[a];g.push(i)}),A=-1,!w){let n=s.createCommandEncoder();L(n),s.queue.submit([n.finish()]),q()}K(),self.postMessage({type:"stepping",active:!1})}self.requestAnimationFrame(Se);return}if(ne){let t=ne;ne=null;let n=s.createCommandEncoder();dr(n,t.centerX,t.centerY,t.brushSize,t.shape,t.fill,t.tribeIds),s.queue.submit([n.finish()])}C&&Z&&(Z=!1,D().then(t=>{let n=new Uint8Array(l*f);for(let a=0;a<l*f;a++)n[a]=t[a];let i=y-M;i>=0&&i<g.length?g[i]=n:g.push(n),g.length=i+1})),Q===0&&(Q=e);let r=e-Q;if(r>=1e3&&(qe=k/(r/1e3),k=0,Q=e),R){let t=!1;O===0&&(O=e);let n=e-O;O=e;let i=fr();if(G<=0){let a=performance.now()+14;for(;performance.now()<a&&(J(),k++,y%i!==0););t=!0}else for(z+=n;z>=G;)J(),k++,z-=G,t=!0;if(t){if(C){let a=!ae,u=a?Ge:Pe;if(a?oe:ue){let c=P?S:x,p=V(),m=s.createCommandEncoder();m.copyBufferToBuffer(c,0,u,0,p),s.queue.submit([m.finish()]),a?oe=!1:ue=!1,u.mapAsync(GPUMapMode.READ).then(()=>{let b=new Uint32Array(u.getMappedRange()),o=new Uint8Array(l*f);for(let d=0;d<l*f;d++)o[d]=b[d];u.unmap(),a?oe=!0:ue=!0,g.push(o)}),ae=!ae}}if((y%i===0||y-A>=i*2)&&(e-fe>=1e3||fe===0)&&!w){fe=e;let u=s.createCommandEncoder();L(u),s.queue.submit([u.finish()]),q()}}}G>0&&K(),self.requestAnimationFrame(Se)}function Te(e){_=e,l=e.cols,f=e.rows,h=[...e.tribes],T.clear(),h.forEach((r,t)=>T.set(r.id,t))}async function pr(e){X=e;let r=await navigator.gpu.requestAdapter();if(!r)throw new Error("WebGPU adapter not available");s=await r.requestDevice({requiredLimits:{maxBufferSize:r.limits.maxBufferSize,maxStorageBufferBindingSize:r.limits.maxStorageBufferBindingSize}});let t=Math.floor(s.limits.maxBufferSize/4);self.postMessage({type:"limits",maxCells:t}),pe=X.getContext("webgpu"),ge=navigator.gpu.getPreferredCanvasFormat(),pe.configure({device:s,format:ge,alphaMode:"opaque"})}function Je(){let e=V();Ge=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Pe=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),ae=!1,oe=!0,ue=!0}function gr(){le=s.createBuffer({size:Ye,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Ne(),We(),or(),je(),Xe(),Ze(),Ve(),Je()}function br(){x?.destroy(),S?.destroy(),F?.destroy(),Y?.destroy(),N?.destroy(),W?.destroy(),j?.destroy(),Ge?.destroy(),Pe?.destroy(),Ne(),We(),Xe(),Ze(),je(),Ve(),Je(),g=[],M=y}self.onmessage=async e=>{let r=e.data;switch(r.type){case"init":{Te(r.ruleset),await pr(r.canvas),gr(),R=r.running,G=r.speed<0?0:1e3/r.speed,O=0,z=0,self.requestAnimationFrame(Se);break}case"setRuleset":{if(Te(r.ruleset),br(),y=0,A=-1,g=[],M=0,Z=!1,be=new Map,me=new Set,!w){let t=s.createCommandEncoder();L(t),s.queue.submit([t.finish()]),q()}break}case"setRunning":R=r.running,r.running&&(O=0,z=0,C&&(Z=!0));break;case"setSpeed":G=r.speed<0?0:1e3/r.speed,z=0;break;case"camera":_e=r.scale,Oe=r.offsetX,ke=r.offsetY;break;case"resize":X.width=r.width,X.height=r.height;break;case"draw":{let t=r.tribes.map(n=>T.get(n)).filter(n=>n!==void 0);if(t.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},i={full:0,spray:1,outline:2};ne={centerX:r.x,centerY:r.y,brushSize:r.size,shape:n[r.shape]??0,fill:i[r.fill]??0,tribeIds:t}}break}case"getSnapshot":{D().then(t=>{self.postMessage({type:"snapshot",grid:t,generation:y,cols:l,rows:f},{transfer:[t.buffer]})});break}case"loadSnapshot":{let t=P?S:x;s.queue.writeBuffer(t,0,r.grid),y=r.generation;break}case"setRecording":{r.recording&&!C?(C=!0,g=[],M=y,Z=!0):r.recording||(C=!1);break}case"getRecording":{let t=g.map(i=>new Uint8Array(i)),n=t.map(i=>i.buffer);self.postMessage({type:"recording",frames:t,startGeneration:M,cols:l,rows:f},{transfer:n});break}case"stepBack":{let t=Math.min(r.count,g.length-1);if(t<=0)break;g.splice(g.length-t,t);let n=g[g.length-1],i=new Uint32Array(l*f);for(let u=0;u<l*f;u++)i[u]=n[u];let a=P?S:x;if(s.queue.writeBuffer(a,0,i),y=M+g.length-1,A=-1,!w){let u=s.createCommandEncoder();L(u),s.queue.submit([u.finish()]),q()}K();break}case"stepForward":{if(r.count===1)if(C)D().then(t=>{let n=new Uint8Array(l*f);for(let a=0;a<l*f;a++)n[a]=t[a];let i=y-M;i>=0&&i<g.length?g[i]=n:g.push(n),g.length=i+1,J(),k++,D().then(a=>{let u=new Uint8Array(l*f);for(let B=0;B<l*f;B++)u[B]=a[B];if(g.push(u),A=-1,!w){let B=s.createCommandEncoder();L(B),s.queue.submit([B.finish()]),q()}K()})});else{if(J(),k++,A=-1,!w){let t=s.createCommandEncoder();L(t),s.queue.submit([t.finish()]),q()}K()}else self.postMessage({type:"stepping",active:!0}),C?D().then(t=>{let n=new Uint8Array(l*f);for(let a=0;a<l*f;a++)n[a]=t[a];let i=y-M;i>=0&&i<g.length?g[i]=n:g.push(n),g.length=i+1,he=R,ye=G,$=y+r.count,R=!0,G=0}):(he=R,ye=G,$=y+r.count,R=!0,G=0);break}}};
