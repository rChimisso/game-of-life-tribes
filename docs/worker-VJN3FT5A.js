var we=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var X={id:"dead",color:"000000"};var i,ge,be,j,R,l=0,d=0,h=[],C=new Map,S,P,ce,E,le,Ae,Re,Q,_e,ke,G=!1,Oe=1,ze=0,Ee=0,v=!1,x=100,O=0,_=0,b=0,ee,re,Ie,$e,er=0,te=null,ne,Le,De,q,F,se,qe,Fe,Y,N,M=-1,w=!1,pe=0,me=new Map,he=new Set,U=!0,f=[],T=0,V=!1,I=-1,ye=!1,Be=100,Ge,Ue,ie=!1,oe=!0,ae=!0,k=0,K=0,H=0;function rr(){let e=[];e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${h.map(u=>u.id).join(", ")}`),e.push(`// Rules: ${R.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${l}u;`),e.push(`const ROWS: u32 = ${d}u;`),e.push(`const TOTAL: u32 = ${l*d}u;`),e.push(""),e.push("fn readCell(idx: u32) -> u32 {"),e.push("  return gridIn[idx];"),e.push("}"),e.push(""),e.push("fn writeCell(idx: u32, tribe: u32) {"),e.push("  gridOut[idx] = tribe;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let x = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (x >= COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let idx = y * COLS + x;"),e.push(""),e.push("  let selfTribe = readCell(idx);"),e.push(""),e.push("  // Neighbor tribe IDs (toroidal wrapping).");for(let u=-1;u<=1;u++)for(let p=-1;p<=1;p++){if(p===0&&u===0)continue;let m=Ye(p,u),c=ve("x",p,"COLS"),g=ve("y",u,"ROWS");e.push(`  let ${m} = readCell(${g} * COLS + ${c});`)}e.push("");let r=nr(R.rules.map(u=>u.clause)),t=new Map,n=0;for(let u of r){let p=`count_${n++}`;t.set(u,p)}for(let[u,p]of t){let m=u.split(",").map(Number),g=Ce().map(B=>`select(0u, 1u, ${m.map(fe=>`${B} == ${fe}u`).join(" || ")})`);e.push(`  let ${p} = ${g.join(" + ")};`)}r.size>0&&e.push("");let o=sr(R.rules.map(u=>u.clause)),s=new Map,a=0;for(let u of o)if(t.has(u))s.set(u,t.get(u));else{let p=`eq_count_${a++}`;s.set(u,p)}for(let[u,p]of s){if(t.has(u))continue;let m=u.split(",").map(Number),g=Ce().map(B=>`select(0u, 1u, ${m.map(fe=>`${B} == ${fe}u`).join(" || ")})`);e.push(`  let ${p} = ${g.join(" + ")};`)}o.size>0&&a>0&&e.push("");let y=C.get(X.id)??0;e.push(`  var result: u32 = ${y}u;`),e.push("");for(let u=0;u<R.rules.length;u++){let p=R.rules[u],m=ue(p.clause,t,s),c=tr(p.tribe);u===0?e.push(`  if (${m}) {`):e.push(`  } else if (${m}) {`),e.push(`    result = ${c}u;`)}return R.rules.length>0&&e.push("  }"),e.push(""),e.push("  writeCell(idx, result);"),e.push("}"),e.join(`
`)}function Ye(e,r){return`n${r===-1?"T":r===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function Ce(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(Ye(t,r));return e}function ve(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function z(e){let r=[];for(let t of e)if(t==="any")for(let n=0;n<h.length;n++)r.push(n);else{let n=C.get(t);n!==void 0&&r.push(n)}return[...new Set(r)]}function tr(e){return e==="any"?0:C.get(e)??0}function nr(e){let r=new Set;for(let t of e)xe(t,r);return r}function xe(e,r){switch(e.kind){case"count":{let t=z(e.tribes).sort();r.add(t.join(","));break}case"not":xe(e.clause,r);break;case"and":case"or":for(let t of e.clauses)xe(t,r);break}}function sr(e){let r=new Set;for(let t of e)Se(t,r);return r}function Se(e,r){switch(e.kind){case"equality":{let t=z(e.tribe1).sort(),n=z(e.tribe2).sort();r.add(t.join(",")),r.add(n.join(","));break}case"not":Se(e.clause,r);break;case"and":case"or":for(let t of e.clauses)Se(t,r);break}}function ue(e,r,t){switch(e.kind){case"is":{let n=z(e.tribes);return n.length===0?"false":n.length===h.length?"true":`(${n.map(s=>`selfTribe == ${s}u`).join(" || ")})`}case"count":{let n=z(e.tribes).sort(),o=r.get(n.join(","));return`(${o} >= ${e.interval[0]}u && ${o} <= ${e.interval[1]}u)`}case"equality":{let n=z(e.tribe1).sort(),o=z(e.tribe2).sort(),s=t.get(n.join(",")),a=t.get(o.join(","));return`(${s} == ${a})`}case"not":return`!(${ue(e.clause,r,t)})`;case"and":return`(${e.clauses.map(o=>ue(o,r,t)).join(" && ")})`;case"or":return`(${e.clauses.map(o=>ue(o,r,t)).join(" || ")})`;default:return"false"}}var Ne=48;function ir(){let e=new ArrayBuffer(Ne),r=new Float32Array(e),t=new Uint32Array(e);r[0]=j.width,r[1]=j.height,r[2]=l,r[3]=d,r[4]=Oe,r[6]=ze,r[7]=Ee,t[8]=h.length,i.queue.writeBuffer(ce,0,e)}function de(){return l*d*4}function We(){let e=de();S=i.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),P=i.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});let r=C.get(X.id)??0,t=new Uint32Array(l*d);t.fill(r),i.queue.writeBuffer(S,0,t),i.queue.writeBuffer(P,0,t),G=!1}function je(){let e=new Uint32Array(256);for(let r=0;r<h.length;r++){let t=h[r].color,n=parseInt(t.substring(0,2),16),o=parseInt(t.substring(2,4),16),s=parseInt(t.substring(4,6),16);e[r]=n|o<<8|s<<16}E&&E.destroy(),E=i.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),i.queue.writeBuffer(E,0,e)}function or(){let e=i.createShaderModule({code:we});le=i.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:be}]},primitive:{topology:"triangle-list"}})}function Xe(){Ae=i.createBindGroup({layout:le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ce}},{binding:1,resource:{buffer:S}},{binding:2,resource:{buffer:E}}]}),Re=i.createBindGroup({layout:le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ce}},{binding:1,resource:{buffer:P}},{binding:2,resource:{buffer:E}}]})}function Ve(){let e=rr(),r=i.createShaderModule({code:e});Q=i.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),_e=i.createBindGroup({layout:Q.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:P}}]}),ke=i.createBindGroup({layout:Q.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:S}}]})}var ar=`
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
`;function ur(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${l}u;
const ROWS: u32 = ${d}u;

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
`}function He(){let e=ar.replace("const COLS: u32 = 0u;",`const COLS: u32 = ${l}u;`).replace("const ROWS: u32 = 0u;",`const ROWS: u32 = ${d}u;`),r=i.createShaderModule({code:e});ne=i.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),q=i.createBuffer({size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),F=i.createBuffer({size:256*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Le=i.createBindGroup({layout:ne.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:q}}]}),De=i.createBindGroup({layout:ne.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:q}}]});let t=i.createShaderModule({code:ur()});se=i.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),Y=i.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),N=i.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),qe=i.createBindGroup({layout:se.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:Y}}]}),Fe=i.createBindGroup({layout:se.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:Y}}]})}var Ze=176,cr=`
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
`;function Je(){let e=i.createShaderModule({code:cr});ee=i.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),re=i.createBuffer({size:Ze,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Ie=i.createBindGroup({layout:ee.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:re}}]}),$e=i.createBindGroup({layout:ee.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:re}}]})}function lr(e,r,t,n,o,s,a){let y=C.get(X.id)??0,u=er++,p=new ArrayBuffer(Ze),m=new Int32Array(p),c=new Uint32Array(p);m[0]=r,m[1]=t,c[2]=l,c[3]=d,c[4]=n,c[5]=o,c[6]=s,c[7]=y,c[8]=u,c[9]=a.length,c[10]=0;for(let A=0;A<a.length&&A<32;A++)c[11+A]=a[A];i.queue.writeBuffer(re,0,p);let g=Math.ceil(n/8),B=e.beginComputePass();B.setPipeline(ee),B.setBindGroup(0,G?$e:Ie),B.dispatchWorkgroups(g,g),B.end()}function $(){let e=G?P:S,r=de(),t;try{t=i.createBuffer({size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}catch{return Promise.reject(new Error(`Failed to allocate ${r} byte readback buffer`))}let n=i.createCommandEncoder();return n.copyBufferToBuffer(e,0,t,0,r),i.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let o=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),o})}function dr(){let e=l*d,r=e>1e6?10:e>1e5?3:1;if(x<=0)return 60*r;let t=1e3/x,n=Math.max(1,Math.round(t));return H>0&&H<1&&(n=Math.max(n,Math.ceil(1/H))),n*r}function fr(e){if(e.length===0)return e;let r=new Uint8Array(e.length*2),t=0,n=0;for(;n<e.length;){let o=e[n],s=1;for(;n+s<e.length&&e[n+s]===o&&s<255;)s++;r[t++]=s,r[t++]=o,n+=s}return r.slice(0,t)}function pr(e,r){let t=new Uint8Array(r),n=0;for(let o=0;o<e.length;o+=2){let s=e[o],a=e[o+1];t.fill(a,n,n+s),n+=s}return t}function W(e){let r=fr(e);return r.length<e.length?r:e}function Te(e){let r=l*d;return e.length<r?pr(e,r):e}function L(e){let r=Math.ceil(l/16),t=Math.ceil(d/16),n=new Uint32Array(256);i.queue.writeBuffer(q,0,n);let o=e.beginComputePass();o.setPipeline(ne),o.setBindGroup(0,G?De:Le),o.dispatchWorkgroups(r,t),o.end(),e.copyBufferToBuffer(q,0,F,0,256*4);let s=new Uint32Array([0]);i.queue.writeBuffer(Y,0,s);let a=e.beginComputePass();a.setPipeline(se),a.setBindGroup(0,G?Fe:qe),a.dispatchWorkgroups(r,t),a.end(),e.copyBufferToBuffer(Y,0,N,0,4)}function D(){let e=b;if(e===M||w)return;M=e,w=!0;let r=[];r.push(F.mapAsync(GPUMapMode.READ)),r.push(N.mapAsync(GPUMapMode.READ)),Promise.all(r).then(()=>{let t=C.get(X.id)??0,n={},o=0,s=0,a={},y=new Uint32Array(F.getMappedRange().slice(0));F.unmap();let u=0;for(let c=0;c<h.length;c++){let g=y[c]??0;n[h[c].id]=g,c!==t&&(u+=g,g>0&&(me.set(c,e),he.add(c)))}if(u>0)for(let c=0;c<h.length;c++){if(c===t)continue;let g=(y[c]??0)/u;g>0&&(o-=g*Math.log2(g),s+=g*g)}for(let c=0;c<h.length;c++){if(c===t)continue;(y[c]??0)>0?a[h[c].id]=null:he.has(c)?a[h[c].id]=me.get(c)??0:a[h[c].id]=0}let p=new Uint32Array(N.getMappedRange().slice(0));N.unmap();let m=p[0]??0;w=!1,self.postMessage({type:"metrics",generation:e,population:n,shannonEntropy:o,simpsonIndex:1-s,boundaryLength:m,extinctionTime:a,fps:H})})}function Z(){let e=i.createCommandEncoder(),r=e.beginComputePass();r.setPipeline(Q),r.setBindGroup(0,G?ke:_e);let t=Math.ceil(l/16),n=Math.ceil(d/16);r.dispatchWorkgroups(t,n),r.end(),i.queue.submit([e.finish()]),G=!G,b++}function J(){ir();let e=ge.getCurrentTexture().createView(),r=i.createCommandEncoder(),t=r.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(le),t.setBindGroup(0,G?Re:Ae),t.draw(3),t.end(),i.queue.submit([r.finish()])}function Pe(e){if(I>=0){let t=performance.now()+14;for(;b<I&&performance.now()<t;)Z(),k++;if(b>=I){if(I=-1,v=ye,x=Be,_=0,O=0,U&&$().then(n=>{let o=new Uint8Array(l*d);for(let s=0;s<l*d;s++)o[s]=n[s];f.push(W(o))}),M=-1,!w){let n=i.createCommandEncoder();L(n),i.queue.submit([n.finish()]),D()}J(),self.postMessage({type:"stepping",active:!1})}self.requestAnimationFrame(Pe);return}if(te){let t=te;te=null;let n=i.createCommandEncoder();lr(n,t.centerX,t.centerY,t.brushSize,t.shape,t.fill,t.tribeIds),i.queue.submit([n.finish()])}U&&V&&(V=!1,$().then(t=>{let n=new Uint8Array(l*d);for(let a=0;a<l*d;a++)n[a]=t[a];let o=W(n),s=b-T;s>=0&&s<f.length?f[s]=o:f.push(o),f.length=s+1})),K===0&&(K=e);let r=e-K;if(r>=1e3&&(H=k/(r/1e3),k=0,K=e),v){let t=!1;_===0&&(_=e);let n=e-_;_=e;let o=dr();if(x<=0){let s=performance.now()+14;for(;performance.now()<s&&(Z(),k++,b%o!==0););t=!0}else for(O+=n;O>=x;)Z(),k++,O-=x,t=!0;if(t){if(U){let s=!ie,a=s?Ge:Ue;if(s?oe:ae){let u=G?P:S,p=de(),m=i.createCommandEncoder();m.copyBufferToBuffer(u,0,a,0,p),i.queue.submit([m.finish()]),s?oe=!1:ae=!1,a.mapAsync(GPUMapMode.READ).then(()=>{let c=new Uint32Array(a.getMappedRange()),g=new Uint8Array(l*d);for(let B=0;B<l*d;B++)g[B]=c[B];a.unmap(),s?oe=!0:ae=!0,f.push(W(g))}),ie=!ie}}if(b%o===0||b-M>=o*2){let s=e-pe,a=l*d>1e6?3e3:l*d>1e5?2e3:1e3;if((s>=a||pe===0)&&!w){pe=e;let y=i.createCommandEncoder();L(y),i.queue.submit([y.finish()]),D()}}}}x>0&&J(),self.requestAnimationFrame(Pe)}function Me(e){R=e,l=e.cols,d=e.rows,h=[...e.tribes],C.clear(),h.forEach((r,t)=>C.set(r.id,t))}async function gr(e){j=e;let r=await navigator.gpu.requestAdapter();if(!r)throw new Error("WebGPU adapter not available");i=await r.requestDevice({requiredLimits:{maxBufferSize:r.limits.maxBufferSize,maxStorageBufferBindingSize:r.limits.maxStorageBufferBindingSize}});let t=Math.floor(i.limits.maxBufferSize/4);self.postMessage({type:"limits",maxCells:t}),ge=j.getContext("webgpu"),be=navigator.gpu.getPreferredCanvasFormat(),ge.configure({device:i,format:be,alphaMode:"opaque"})}function Ke(){let e=de();Ge=i.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Ue=i.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),ie=!1,oe=!0,ae=!0}function br(){ce=i.createBuffer({size:Ne,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),We(),je(),or(),Xe(),Ve(),Je(),He(),Ke()}function mr(){S?.destroy(),P?.destroy(),q?.destroy(),F?.destroy(),Y?.destroy(),N?.destroy(),Ge?.destroy(),Ue?.destroy(),We(),je(),Ve(),Je(),Xe(),He(),Ke(),f=[],T=b}self.onmessage=async e=>{let r=e.data;switch(r.type){case"init":{Me(r.ruleset),await gr(r.canvas),br(),v=r.running,x=r.speed<0?0:1e3/r.speed,_=0,O=0,self.requestAnimationFrame(Pe);break}case"setRuleset":{if(Me(r.ruleset),mr(),b=0,M=-1,f=[],T=0,V=!1,me=new Map,he=new Set,!w){let t=i.createCommandEncoder();L(t),i.queue.submit([t.finish()]),D()}break}case"setRunning":v=r.running,r.running&&(_=0,O=0,U&&(V=!0));break;case"setSpeed":x=r.speed<0?0:1e3/r.speed,O=0;break;case"camera":Oe=r.scale,ze=r.offsetX,Ee=r.offsetY;break;case"resize":j.width=r.width,j.height=r.height;break;case"draw":{let t=r.tribes.map(n=>C.get(n)).filter(n=>n!==void 0);if(t.length>0){let n={square:0,round:1,diamond:2,vline:3,hline:4},o={full:0,spray:1,outline:2};te={centerX:r.x,centerY:r.y,brushSize:r.size,shape:n[r.shape]??0,fill:o[r.fill]??0,tribeIds:t}}break}case"getSnapshot":{$().then(t=>{self.postMessage({type:"snapshot",grid:t,generation:b,cols:l,rows:d},[t.buffer])}).catch(()=>{let t=new Uint32Array(0);self.postMessage({type:"snapshot",grid:t,generation:b,cols:l,rows:d})});break}case"loadSnapshot":{let t=G?P:S;i.queue.writeBuffer(t,0,r.grid),b=r.generation;break}case"setRecording":{r.recording&&!U?(U=!0,f=[],T=b,V=!0):r.recording||(U=!1);break}case"getRecording":{let n=f.map(s=>Te(s)).map(s=>new Uint8Array(s)),o=n.map(s=>s.buffer).filter(s=>s.byteLength>0);self.postMessage({type:"recording",frames:n,startGeneration:T,cols:l,rows:d},o);break}case"stepBack":{let t=Math.min(r.count,f.length-1);if(t<=0)break;f.splice(f.length-t,t);let n=Te(f[f.length-1]),o=new Uint32Array(l*d);for(let a=0;a<l*d;a++)o[a]=n[a];let s=G?P:S;if(i.queue.writeBuffer(s,0,o),b=T+f.length-1,M=-1,!w){let a=i.createCommandEncoder();L(a),i.queue.submit([a.finish()]),D()}J();break}case"stepForward":{if(r.count===1)if(U)$().then(t=>{let n=new Uint8Array(l*d);for(let a=0;a<l*d;a++)n[a]=t[a];let o=W(n),s=b-T;s>=0&&s<f.length?f[s]=o:f.push(o),f.length=s+1,Z(),k++,$().then(a=>{let y=new Uint8Array(l*d);for(let u=0;u<l*d;u++)y[u]=a[u];if(f.push(W(y)),M=-1,!w){let u=i.createCommandEncoder();L(u),i.queue.submit([u.finish()]),D()}J()})});else{if(Z(),k++,M=-1,!w){let t=i.createCommandEncoder();L(t),i.queue.submit([t.finish()]),D()}J()}else self.postMessage({type:"stepping",active:!0}),U?$().then(t=>{let n=new Uint8Array(l*d);for(let a=0;a<l*d;a++)n[a]=t[a];let o=W(n),s=b-T;s>=0&&s<f.length?f[s]=o:f.push(o),f.length=s+1,ye=v,Be=x,I=b+r.count,v=!0,x=0}):(ye=v,Be=x,I=b+r.count,v=!0,x=0);break}}};
