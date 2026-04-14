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
`;var Z={id:"dead",color:"000000"};var s,me,he,V,_,l=0,f=0,m=[],T=new Map,U,G,pe,I,ge,_e,ke,ne,Oe,ze,w=!1,Ee=1,Ie=0,$e=0,A=!1,P=100,z=0,k=0,h=0,se,ie,De,Le,ir=0,oe=null,ae,qe,Fe,F,Y,ue,Ye,Ne,N,W,M=-1,v=!1,be=0,j,ye=new Map,Be=new Set,C=!0,p=[],R=0,J=!1,$=-1,xe=!1,Se=100,we,Ce,ce=!1,le=!0,fe=!0,O=0,te=0,K=0;function or(){let e=[];e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${m.map(u=>u.id).join(", ")}`),e.push(`// Rules: ${_.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${l}u;`),e.push(`const ROWS: u32 = ${f}u;`),e.push(`const TOTAL: u32 = ${l*f}u;`),e.push(""),e.push("fn readCell(idx: u32) -> u32 {"),e.push("  return gridIn[idx];"),e.push("}"),e.push(""),e.push("fn writeCell(idx: u32, tribe: u32) {"),e.push("  gridOut[idx] = tribe;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let x = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (x >= COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let idx = y * COLS + x;"),e.push(""),e.push("  let selfTribe = readCell(idx);"),e.push(""),e.push("  // Neighbor tribe IDs (toroidal wrapping).");for(let u=-1;u<=1;u++)for(let d=-1;d<=1;d++){if(d===0&&u===0)continue;let y=We(d,u),g=Ae("x",d,"COLS"),S=Ae("y",u,"ROWS");e.push(`  let ${y} = readCell(${S} * COLS + ${g});`)}e.push("");let r=ur(_.rules.map(u=>u.clause)),t=new Map,n=0;for(let u of r){let d=`count_${n++}`;t.set(u,d)}for(let[u,d]of t){let y=u.split(",").map(Number),S=Te().map(B=>`select(0u, 1u, ${y.map(b=>`${B} == ${b}u`).join(" || ")})`);e.push(`  let ${d} = ${S.join(" + ")};`)}r.size>0&&e.push("");let o=cr(_.rules.map(u=>u.clause)),i=new Map,a=0;for(let u of o)if(t.has(u))i.set(u,t.get(u));else{let d=`eq_count_${a++}`;i.set(u,d)}for(let[u,d]of i){if(t.has(u))continue;let y=u.split(",").map(Number),S=Te().map(B=>`select(0u, 1u, ${y.map(b=>`${B} == ${b}u`).join(" || ")})`);e.push(`  let ${d} = ${S.join(" + ")};`)}o.size>0&&a>0&&e.push("");let x=T.get(Z.id)??0;e.push(`  var result: u32 = ${x}u;`),e.push("");for(let u=0;u<_.rules.length;u++){let d=_.rules[u],y=de(d.clause,t,i),g=ar(d.tribe);u===0?e.push(`  if (${y}) {`):e.push(`  } else if (${y}) {`),e.push(`    result = ${g}u;`)}return _.rules.length>0&&e.push("  }"),e.push(""),e.push("  writeCell(idx, result);"),e.push("}"),e.join(`
`)}function We(e,r){return`n${r===-1?"T":r===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function Te(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(We(t,r));return e}function Ae(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function E(e){let r=[];for(let t of e)if(t==="any")for(let n=0;n<m.length;n++)r.push(n);else{let n=T.get(t);n!==void 0&&r.push(n)}return[...new Set(r)]}function ar(e){return e==="any"?0:T.get(e)??0}function ur(e){let r=new Set;for(let t of e)Ue(t,r);return r}function Ue(e,r){switch(e.kind){case"count":{let t=E(e.tribes).sort();r.add(t.join(","));break}case"not":Ue(e.clause,r);break;case"and":case"or":for(let t of e.clauses)Ue(t,r);break}}function cr(e){let r=new Set;for(let t of e)Ge(t,r);return r}function Ge(e,r){switch(e.kind){case"equality":{let t=E(e.tribe1).sort(),n=E(e.tribe2).sort();r.add(t.join(",")),r.add(n.join(","));break}case"not":Ge(e.clause,r);break;case"and":case"or":for(let t of e.clauses)Ge(t,r);break}}function de(e,r,t){switch(e.kind){case"is":{let n=E(e.tribes);return n.length===0?"false":n.length===m.length?"true":`(${n.map(i=>`selfTribe == ${i}u`).join(" || ")})`}case"count":{let n=E(e.tribes).sort(),o=r.get(n.join(","));return`(${o} >= ${e.interval[0]}u && ${o} <= ${e.interval[1]}u)`}case"equality":{let n=E(e.tribe1).sort(),o=E(e.tribe2).sort(),i=t.get(n.join(",")),a=t.get(o.join(","));return`(${i} == ${a})`}case"not":return`!(${de(e.clause,r,t)})`;case"and":return`(${e.clauses.map(o=>de(o,r,t)).join(" && ")})`;case"or":return`(${e.clauses.map(o=>de(o,r,t)).join(" || ")})`;default:return"false"}}var je=48;function lr(){let e=new ArrayBuffer(je),r=new Float32Array(e),t=new Uint32Array(e);r[0]=V.width,r[1]=V.height,r[2]=l,r[3]=f,r[4]=Ee,r[6]=Ie,r[7]=$e,t[8]=m.length,s.queue.writeBuffer(pe,0,e)}function H(){return l*f*4}function Xe(){let e=H();U=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),G=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});let r=T.get(Z.id)??0,t=new Uint32Array(l*f);t.fill(r),s.queue.writeBuffer(U,0,t),s.queue.writeBuffer(G,0,t),w=!1}function Ve(){let e=new Uint32Array(256);for(let r=0;r<m.length;r++){let t=m[r].color,n=parseInt(t.substring(0,2),16),o=parseInt(t.substring(2,4),16),i=parseInt(t.substring(4,6),16);e[r]=n|o<<8|i<<16}I&&I.destroy(),I=s.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(I,0,e)}function fr(){let e=s.createShaderModule({code:ve});ge=s.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:he}]},primitive:{topology:"triangle-list"}})}function He(){_e=s.createBindGroup({layout:ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:pe}},{binding:1,resource:{buffer:U}},{binding:2,resource:{buffer:I}}]}),ke=s.createBindGroup({layout:ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:pe}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:I}}]})}function Ze(){let e=or(),r=s.createShaderModule({code:e});ne=s.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),Oe=s.createBindGroup({layout:ne.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:G}}]}),ze=s.createBindGroup({layout:ne.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:U}}]})}var dr=`
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
`;function pr(){return`
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
`}function Je(){let e=dr.replace("const COLS: u32 = 0u;",`const COLS: u32 = ${l}u;`).replace("const ROWS: u32 = 0u;",`const ROWS: u32 = ${f}u;`),r=s.createShaderModule({code:e});ae=s.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),F=s.createBuffer({size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),Y=s.createBuffer({size:256*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),qe=s.createBindGroup({layout:ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:F}}]}),Fe=s.createBindGroup({layout:ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:F}}]});let t=s.createShaderModule({code:pr()});ue=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),N=s.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),W=s.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),j=s.createBuffer({size:H(),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Ye=s.createBindGroup({layout:ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:N}}]}),Ne=s.createBindGroup({layout:ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:N}}]})}var Ke=176,gr=`
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
`;function Qe(){let e=s.createShaderModule({code:gr});se=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),ie=s.createBuffer({size:Ke,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),De=s.createBindGroup({layout:se.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}},{binding:1,resource:{buffer:ie}}]}),Le=s.createBindGroup({layout:se.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:ie}}]})}function br(e,r,t,n,o,i,a){let x=T.get(Z.id)??0,u=ir++,d=new ArrayBuffer(Ke),y=new Int32Array(d),g=new Uint32Array(d);y[0]=r,y[1]=t,g[2]=l,g[3]=f,g[4]=n,g[5]=o,g[6]=i,g[7]=x,g[8]=u,g[9]=a.length,g[10]=0;for(let c=0;c<a.length&&c<32;c++)g[11+c]=a[c];s.queue.writeBuffer(ie,0,d);let S=Math.ceil(n/8),B=e.beginComputePass();B.setPipeline(se),B.setBindGroup(0,w?Le:De),B.dispatchWorkgroups(S,S),B.end()}function D(){let e=w?G:U,r=H(),t=s.createBuffer({size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),n=s.createCommandEncoder();return n.copyBufferToBuffer(e,0,t,0,r),s.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let o=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),o})}function mr(){let e=l*f,r=e>1e6?10:e>1e5?3:1;if(P<=0)return 60*r;let t=1e3/P,n=Math.max(1,Math.round(t));return K>0&&K<1&&(n=Math.max(n,Math.ceil(1/K))),n*r}function hr(e){if(e.length===0)return e;let r=new Uint8Array(e.length*2),t=0,n=0;for(;n<e.length;){let o=e[n],i=1;for(;n+i<e.length&&e[n+i]===o&&i<255;)i++;r[t++]=i,r[t++]=o,n+=i}return r.slice(0,t)}function yr(e,r){let t=new Uint8Array(r),n=0;for(let o=0;o<e.length;o+=2){let i=e[o],a=e[o+1];t.fill(a,n,n+i),n+=i}return t}function X(e){let r=hr(e);return r.length<e.length?r:e}function Re(e){let r=l*f;return e.length<r?yr(e,r):e}function L(e){let r=Math.ceil(l/16),t=Math.ceil(f/16),n=new Uint32Array(256);s.queue.writeBuffer(F,0,n);let o=e.beginComputePass();o.setPipeline(ae),o.setBindGroup(0,w?Fe:qe),o.dispatchWorkgroups(r,t),o.end(),e.copyBufferToBuffer(F,0,Y,0,256*4);let i=new Uint32Array([0]);s.queue.writeBuffer(N,0,i);let a=e.beginComputePass();a.setPipeline(ue),a.setBindGroup(0,w?Ne:Ye),a.dispatchWorkgroups(r,t),a.end(),e.copyBufferToBuffer(N,0,W,0,4);let x=w?G:U;e.copyBufferToBuffer(x,0,j,0,H())}function q(){let e=h;if(e===M||v)return;M=e,v=!0;let r=[];r.push(Y.mapAsync(GPUMapMode.READ)),r.push(W.mapAsync(GPUMapMode.READ)),r.push(j.mapAsync(GPUMapMode.READ)),Promise.all(r).then(()=>{let t=T.get(Z.id)??0,n={},o=0,i=0,a={},x=new Uint32Array(Y.getMappedRange().slice(0));Y.unmap();let u=0;for(let c=0;c<m.length;c++){let b=x[c]??0;n[m[c].id]=b,c!==t&&(u+=b,b>0&&(ye.set(c,e),Be.add(c)))}if(u>0)for(let c=0;c<m.length;c++){if(c===t)continue;let b=(x[c]??0)/u;b>0&&(o-=b*Math.log2(b),i+=b*b)}for(let c=0;c<m.length;c++){if(c===t)continue;(x[c]??0)>0?a[m[c].id]=null:Be.has(c)?a[m[c].id]=ye.get(c)??0:a[m[c].id]=0}let d=0,y={},g=new Uint32Array(W.getMappedRange().slice(0));W.unmap(),d=g[0]??0;let S=new Uint32Array(j.getMappedRange().slice(0));j.unmap();let B=new Uint32Array(m.length);for(let c=0;c<f;c++)for(let b=0;b<l;b++){let rr=c*l+b,re=S[rr],tr=(b+1)%l;S[c*l+tr]!==re&&B[re]++;let nr=(c+1)%f;S[nr*l+b]!==re&&B[re]++}for(let c=0;c<m.length;c++)c!==t&&(y[m[c].id]=B[c]);v=!1,self.postMessage({type:"metrics",generation:e,population:n,shannonEntropy:o,simpsonIndex:1-i,boundaryLength:d,frontierLength:y,extinctionTime:a,fps:K})})}function Q(){let e=s.createCommandEncoder(),r=e.beginComputePass();r.setPipeline(ne),r.setBindGroup(0,w?ze:Oe);let t=Math.ceil(l/16),n=Math.ceil(f/16);r.dispatchWorkgroups(t,n),r.end(),s.queue.submit([e.finish()]),w=!w,h++}function ee(){lr();let e=me.getCurrentTexture().createView(),r=s.createCommandEncoder(),t=r.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(ge),t.setBindGroup(0,w?ke:_e),t.draw(3),t.end(),s.queue.submit([r.finish()])}function Pe(e){if($>=0){let t=performance.now()+14;for(;h<$&&performance.now()<t;)Q(),O++;if(h>=$){if($=-1,A=xe,P=Se,k=0,z=0,C&&D().then(n=>{let o=new Uint8Array(l*f);for(let i=0;i<l*f;i++)o[i]=n[i];p.push(X(o))}),M=-1,!v){let n=s.createCommandEncoder();L(n),s.queue.submit([n.finish()]),q()}ee(),self.postMessage({type:"stepping",active:!1})}self.requestAnimationFrame(Pe);return}if(oe){let t=oe;oe=null;let n=s.createCommandEncoder();br(n,t.centerX,t.centerY,t.brushSize,t.shape,t.fill,t.tribeIds),s.queue.submit([n.finish()])}C&&J&&(J=!1,D().then(t=>{let n=new Uint8Array(l*f);for(let a=0;a<l*f;a++)n[a]=t[a];let o=X(n),i=h-R;i>=0&&i<p.length?p[i]=o:p.push(o),p.length=i+1})),te===0&&(te=e);let r=e-te;if(r>=1e3&&(K=O/(r/1e3),O=0,te=e),A){let t=!1;k===0&&(k=e);let n=e-k;k=e;let o=mr();if(P<=0){let i=performance.now()+14;for(;performance.now()<i&&(Q(),O++,h%o!==0););t=!0}else for(z+=n;z>=P;)Q(),O++,z-=P,t=!0;if(t){if(C){let i=!ce,a=i?we:Ce;if(i?le:fe){let u=w?G:U,d=H(),y=s.createCommandEncoder();y.copyBufferToBuffer(u,0,a,0,d),s.queue.submit([y.finish()]),i?le=!1:fe=!1,a.mapAsync(GPUMapMode.READ).then(()=>{let g=new Uint32Array(a.getMappedRange()),S=new Uint8Array(l*f);for(let B=0;B<l*f;B++)S[B]=g[B];a.unmap(),i?le=!0:fe=!0,p.push(X(S))}),ce=!ce}}if(h%o===0||h-M>=o*2){let i=e-be,a=l*f>1e6?3e3:l*f>1e5?2e3:1e3;if((i>=a||be===0)&&!v){be=e;let x=s.createCommandEncoder();L(x),s.queue.submit([x.finish()]),q()}}}}P>0&&ee(),self.requestAnimationFrame(Pe)}function Me(e){_=e,l=e.cols,f=e.rows,m=[...e.tribes],T.clear(),m.forEach((r,t)=>T.set(r.id,t))}async function Br(e){V=e;let r=await navigator.gpu.requestAdapter();if(!r)throw new Error("WebGPU adapter not available");s=await r.requestDevice({requiredLimits:{maxBufferSize:r.limits.maxBufferSize,maxStorageBufferBindingSize:r.limits.maxStorageBufferBindingSize}});let t=Math.floor(s.limits.maxBufferSize/4);self.postMessage({type:"limits",maxCells:t}),me=V.getContext("webgpu"),he=navigator.gpu.getPreferredCanvasFormat(),me.configure({device:s,format:he,alphaMode:"opaque"})}function er(){let e=H();we=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Ce=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),ce=!1,le=!0,fe=!0}function xr(){pe=s.createBuffer({size:je,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Xe(),Ve(),fr(),He(),Ze(),Qe(),Je(),er()}function Sr(){U?.destroy(),G?.destroy(),F?.destroy(),Y?.destroy(),N?.destroy(),W?.destroy(),j?.destroy(),we?.destroy(),Ce?.destroy(),Xe(),Ve(),Ze(),Qe(),He(),Je(),er(),p=[],R=h}self.onmessage=async e=>{let r=e.data;switch(r.type){case"init":{Me(r.ruleset),await Br(r.canvas),xr(),A=r.running,P=r.speed<0?0:1e3/r.speed,k=0,z=0,self.requestAnimationFrame(Pe);break}case"setRuleset":{if(Me(r.ruleset),Sr(),h=0,M=-1,p=[],R=0,J=!1,ye=new Map,Be=new Set,!v){let t=s.createCommandEncoder();L(t),s.queue.submit([t.finish()]),q()}break}case"setRunning":A=r.running,r.running&&(k=0,z=0,C&&(J=!0));break;case"setSpeed":P=r.speed<0?0:1e3/r.speed,z=0;break;case"camera":Ee=r.scale,Ie=r.offsetX,$e=r.offsetY;break;case"resize":V.width=r.width,V.height=r.height;break;case"draw":{let t=r.tribes.map(n=>T.get(n)).filter(n=>n!==void 0);if(t.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},o={full:0,spray:1,outline:2};oe={centerX:r.x,centerY:r.y,brushSize:r.size,shape:n[r.shape]??0,fill:o[r.fill]??0,tribeIds:t}}break}case"getSnapshot":{D().then(t=>{self.postMessage({type:"snapshot",grid:t,generation:h,cols:l,rows:f},[t.buffer])});break}case"loadSnapshot":{let t=w?G:U;s.queue.writeBuffer(t,0,r.grid),h=r.generation;break}case"setRecording":{r.recording&&!C?(C=!0,p=[],R=h,J=!0):r.recording||(C=!1);break}case"getRecording":{let n=p.map(i=>Re(i)).map(i=>new Uint8Array(i)),o=n.map(i=>i.buffer).filter(i=>i.byteLength>0);self.postMessage({type:"recording",frames:n,startGeneration:R,cols:l,rows:f},o);break}case"stepBack":{let t=Math.min(r.count,p.length-1);if(t<=0)break;p.splice(p.length-t,t);let n=Re(p[p.length-1]),o=new Uint32Array(l*f);for(let a=0;a<l*f;a++)o[a]=n[a];let i=w?G:U;if(s.queue.writeBuffer(i,0,o),h=R+p.length-1,M=-1,!v){let a=s.createCommandEncoder();L(a),s.queue.submit([a.finish()]),q()}ee();break}case"stepForward":{if(r.count===1)if(C)D().then(t=>{let n=new Uint8Array(l*f);for(let a=0;a<l*f;a++)n[a]=t[a];let o=X(n),i=h-R;i>=0&&i<p.length?p[i]=o:p.push(o),p.length=i+1,Q(),O++,D().then(a=>{let x=new Uint8Array(l*f);for(let u=0;u<l*f;u++)x[u]=a[u];if(p.push(X(x)),M=-1,!v){let u=s.createCommandEncoder();L(u),s.queue.submit([u.finish()]),q()}ee()})});else{if(Q(),O++,M=-1,!v){let t=s.createCommandEncoder();L(t),s.queue.submit([t.finish()]),q()}ee()}else self.postMessage({type:"stepping",active:!0}),C?D().then(t=>{let n=new Uint8Array(l*f);for(let a=0;a<l*f;a++)n[a]=t[a];let o=X(n),i=h-R;i>=0&&i<p.length?p[i]=o:p.push(o),p.length=i+1,xe=A,Se=P,$=h+r.count,A=!0,P=0}):(xe=A,Se=P,$=h+r.count,A=!0,P=0);break}}};
