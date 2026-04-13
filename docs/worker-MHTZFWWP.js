var ye=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var A={id:"dead",color:"000000"};var s,ce,le,L,T,l=0,d=0,G=[],U=new Map,y,B,ie,_,oe,Pe,Ue,j,Ce,we,S=!1,Te=1,ve=0,Re=0,de=!1,w=100,k=0,O=0,h=0,X,V,Me,Ae,Ke=0,H=null,P=null,Z,_e,Oe,I,z,J,ke,Ie,E,$,Be=0,D=-1,M=!1,ue=0,Y,C=!0,p=[],v=0,F=!1,me,he,K=!1,Q=!0,ee=!0,q=0,W=0,ze=0;function Qe(){let e=[];e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${G.map(u=>u.id).join(", ")}`),e.push(`// Rules: ${T.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${l}u;`),e.push(`const ROWS: u32 = ${d}u;`),e.push(`const TOTAL: u32 = ${l*d}u;`),e.push(""),e.push("fn readCell(idx: u32) -> u32 {"),e.push("  return gridIn[idx];"),e.push("}"),e.push(""),e.push("fn writeCell(idx: u32, tribe: u32) {"),e.push("  gridOut[idx] = tribe;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(16, 16)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let x = gid.x;"),e.push("  let y = gid.y;"),e.push("  if (x >= COLS || y >= ROWS) { return; }"),e.push(""),e.push("  let idx = y * COLS + x;"),e.push(""),e.push("  let selfTribe = readCell(idx);"),e.push(""),e.push("  // Neighbor tribe IDs (toroidal wrapping).");for(let u=-1;u<=1;u++)for(let c=-1;c<=1;c++){if(c===0&&u===0)continue;let f=Ee(c,u),g=Ge("x",c,"COLS"),b=Ge("y",u,"ROWS");e.push(`  let ${f} = readCell(${b} * COLS + ${g});`)}e.push("");let r=rr(T.rules.map(u=>u.clause)),t=new Map,n=0;for(let u of r){let c=`count_${n++}`;t.set(u,c)}for(let[u,c]of t){let f=u.split(",").map(Number),b=xe().map(x=>`select(0u, 1u, ${f.map(ae=>`${x} == ${ae}u`).join(" || ")})`);e.push(`  let ${c} = ${b.join(" + ")};`)}r.size>0&&e.push("");let i=tr(T.rules.map(u=>u.clause)),o=new Map,a=0;for(let u of i)if(t.has(u))o.set(u,t.get(u));else{let c=`eq_count_${a++}`;o.set(u,c)}for(let[u,c]of o){if(t.has(u))continue;let f=u.split(",").map(Number),b=xe().map(x=>`select(0u, 1u, ${f.map(ae=>`${x} == ${ae}u`).join(" || ")})`);e.push(`  let ${c} = ${b.join(" + ")};`)}i.size>0&&a>0&&e.push("");let m=U.get(A.id)??0;e.push(`  var result: u32 = ${m}u;`),e.push("");for(let u=0;u<T.rules.length;u++){let c=T.rules[u],f=re(c.clause,t,o),g=er(c.tribe);u===0?e.push(`  if (${f}) {`):e.push(`  } else if (${f}) {`),e.push(`    result = ${g}u;`)}return T.rules.length>0&&e.push("  }"),e.push(""),e.push("  writeCell(idx, result);"),e.push("}"),e.join(`
`)}function Ee(e,r){return`n${r===-1?"T":r===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function xe(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(Ee(t,r));return e}function Ge(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function R(e){let r=[];for(let t of e)if(t==="any")for(let n=0;n<G.length;n++)r.push(n);else{let n=U.get(t);n!==void 0&&r.push(n)}return[...new Set(r)]}function er(e){return e==="any"?0:U.get(e)??0}function rr(e){let r=new Set;for(let t of e)fe(t,r);return r}function fe(e,r){switch(e.kind){case"count":{let t=R(e.tribes).sort();r.add(t.join(","));break}case"not":fe(e.clause,r);break;case"and":case"or":for(let t of e.clauses)fe(t,r);break}}function tr(e){let r=new Set;for(let t of e)pe(t,r);return r}function pe(e,r){switch(e.kind){case"equality":{let t=R(e.tribe1).sort(),n=R(e.tribe2).sort();r.add(t.join(",")),r.add(n.join(","));break}case"not":pe(e.clause,r);break;case"and":case"or":for(let t of e.clauses)pe(t,r);break}}function re(e,r,t){switch(e.kind){case"is":{let n=R(e.tribes);return n.length===0?"false":n.length===G.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case"count":{let n=R(e.tribes).sort(),i=r.get(n.join(","));return`(${i} >= ${e.interval[0]}u && ${i} <= ${e.interval[1]}u)`}case"equality":{let n=R(e.tribe1).sort(),i=R(e.tribe2).sort(),o=t.get(n.join(",")),a=t.get(i.join(","));return`(${o} == ${a})`}case"not":return`!(${re(e.clause,r,t)})`;case"and":return`(${e.clauses.map(i=>re(i,r,t)).join(" && ")})`;case"or":return`(${e.clauses.map(i=>re(i,r,t)).join(" || ")})`;default:return"false"}}var $e=48;function nr(){let e=new ArrayBuffer($e),r=new Float32Array(e),t=new Uint32Array(e);r[0]=L.width,r[1]=L.height,r[2]=l,r[3]=d,r[4]=Te,r[6]=ve,r[7]=Re,t[8]=G.length,s.queue.writeBuffer(ie,0,e)}function N(){return l*d*4}function De(){let e=N();y=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),B=s.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});let r=U.get(A.id)??0,t=new Uint32Array(l*d);t.fill(r),s.queue.writeBuffer(y,0,t),s.queue.writeBuffer(B,0,t),S=!1}function Le(){let e=new Uint32Array(256);for(let r=0;r<G.length;r++){let t=G[r].color,n=parseInt(t.substring(0,2),16),i=parseInt(t.substring(2,4),16),o=parseInt(t.substring(4,6),16);e[r]=n|i<<8|o<<16}_&&_.destroy(),_=s.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s.queue.writeBuffer(_,0,e)}function sr(){let e=s.createShaderModule({code:ye});oe=s.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:le}]},primitive:{topology:"triangle-list"}})}function qe(){Pe=s.createBindGroup({layout:oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ie}},{binding:1,resource:{buffer:y}},{binding:2,resource:{buffer:_}}]}),Ue=s.createBindGroup({layout:oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ie}},{binding:1,resource:{buffer:B}},{binding:2,resource:{buffer:_}}]})}function Fe(){let e=Qe(),r=s.createShaderModule({code:e});j=s.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),Ce=s.createBindGroup({layout:j.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:B}}]}),we=s.createBindGroup({layout:j.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:B}},{binding:1,resource:{buffer:y}}]})}var ir=`
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
`;function or(){return`
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
`}function Ye(){let e=ir.replace("const COLS: u32 = 0u;",`const COLS: u32 = ${l}u;`).replace("const ROWS: u32 = 0u;",`const ROWS: u32 = ${d}u;`),r=s.createShaderModule({code:e});Z=s.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),I=s.createBuffer({size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),z=s.createBuffer({size:256*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),_e=s.createBindGroup({layout:Z.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:I}}]}),Oe=s.createBindGroup({layout:Z.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:B}},{binding:1,resource:{buffer:I}}]});let t=s.createShaderModule({code:or()});J=s.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),E=s.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),$=s.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),ke=s.createBindGroup({layout:J.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:E}}]}),Ie=s.createBindGroup({layout:J.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:B}},{binding:1,resource:{buffer:E}}]})}var Ne=40,ar=`
struct BrushParams {
  centerX: i32,
  centerY: i32,
  cols: u32,
  rows: u32,
  brushSize: u32,
  shape: u32,
  fill: u32,
  tribeId: u32,
  deadId: u32,
  seed: u32,
}

@group(0) @binding(0) var<storage, read_write> grid: array<u32>;
@group(0) @binding(1) var<uniform> params: BrushParams;

fn pcg(inp: u32) -> u32 {
  var state = inp * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
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

  // Round brush: skip cells outside the radius.
  if (params.shape == 1u) {
    let fhalf = f32(params.brushSize - 1u) / 2.0;
    let fdx = f32(dx) - fhalf + f32(half);
    let fdy = f32(dy) - fhalf + f32(half);
    let r = f32(params.brushSize) / 2.0 - 0.25;
    if (fdx * fdx + fdy * fdy > r * r) { return; }
  }

  // Toroidal wrapping.
  let cx = ((params.centerX + dx) % i32(params.cols) + i32(params.cols)) % i32(params.cols);
  let cy = ((params.centerY + dy) % i32(params.rows) + i32(params.rows)) % i32(params.rows);
  let cellIdx = u32(cy) * params.cols + u32(cx);

  // Spray fill: 50% chance to skip/set-dead.
  if (params.fill == 1u) {
    let h = pcg(params.seed ^ idx);
    if ((h & 1u) != 0u) {
      if (params.tribeId != params.deadId) {
        grid[cellIdx] = params.deadId;
      }
      return;
    }
  }

  grid[cellIdx] = params.tribeId;
}
`;function We(){let e=s.createShaderModule({code:ar});X=s.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),V=s.createBuffer({size:Ne,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Me=s.createBindGroup({layout:X.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:V}}]}),Ae=s.createBindGroup({layout:X.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:B}},{binding:1,resource:{buffer:V}}]})}function ur(e,r,t,n,i,o,a){let m=U.get(A.id)??0,u=Ke++,c=new ArrayBuffer(Ne),f=new Int32Array(c),g=new Uint32Array(c);f[0]=r,f[1]=t,g[2]=l,g[3]=d,g[4]=n,g[5]=i,g[6]=o,g[7]=a,g[8]=m,g[9]=u,s.queue.writeBuffer(V,0,c);let b=Math.ceil(n/8),x=e.beginComputePass();x.setPipeline(X),x.setBindGroup(0,S?Ae:Me),x.dispatchWorkgroups(b,b),x.end()}function je(){P=new Uint8Array(l*d);let e=U.get(A.id)??0;P.fill(e)}function cr(){if(!P)return;let e=S?B:y,r=N(),t=s.createBuffer({size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),n=s.createCommandEncoder();n.copyBufferToBuffer(e,0,t,0,r),s.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(t.getMappedRange());for(let o=0;o<l*d;o++)P[o]=i[o];t.unmap(),t.destroy()})}function te(){let e=S?B:y,r=N(),t=s.createBuffer({size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),n=s.createCommandEncoder();return n.copyBufferToBuffer(e,0,t,0,r),s.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let i=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),i})}function Xe(){if(w<=0)return 60;let e=1e3/w;return Math.max(1,Math.round(e))}function lr(){return Math.max(5,Xe()*4)}function ne(e){let r=new Uint32Array(256);s.queue.writeBuffer(I,0,r);let t=new Uint32Array([0]);s.queue.writeBuffer(E,0,t);let n=Math.ceil(l/16),i=Math.ceil(d/16),o=e.beginComputePass();o.setPipeline(Z),o.setBindGroup(0,S?Oe:_e),o.dispatchWorkgroups(n,i),o.end();let a=e.beginComputePass();a.setPipeline(J),a.setBindGroup(0,S?Ie:ke),a.dispatchWorkgroups(n,i),a.end(),e.copyBufferToBuffer(I,0,z,0,256*4),e.copyBufferToBuffer(E,0,$,0,4)}function se(e){let r=h;r===D||M||(D=r,M=!0,z.mapAsync(GPUMapMode.READ).then(()=>{let t=new Uint32Array(z.getMappedRange().slice(0));return z.unmap(),$.mapAsync(GPUMapMode.READ).then(()=>{let n=new Uint32Array($.getMappedRange().slice(0));$.unmap(),M=!1;let i={},o=0,a=U.get(A.id)??0;for(let c=0;c<G.length;c++){let f=t[c]??0;i[G[c].id]=f,c!==a&&(o+=f)}let m=0,u=0;if(o>0)for(let c=0;c<G.length;c++){if(c===a)continue;let f=(t[c]??0)/o;f>0&&(m-=f*Math.log2(f),u+=f*f)}e&&P&&(Y=dr()),self.postMessage({type:"metrics",generation:r,population:i,shannonEntropy:m,simpsonIndex:1-u,boundaryLength:n[0]??0,meanClusterSize:Y,fps:ze})})}))}function dr(){if(!P)return{};let e=l*d,r=new Uint8Array(e),t=new Map;for(let i=0;i<e;i++){if(r[i])continue;let o=P[i];r[i]=1;let a=0,m=[i];for(;m.length>0;){let u=m.pop();a++;let c=u%l,f=(u-c)/l,g=[(f+d-1)%d*l+c,(f+1)%d*l+c,f*l+(c+l-1)%l,f*l+(c+1)%l];for(let b of g)!r[b]&&P[b]===o&&(r[b]=1,m.push(b))}t.has(o)||t.set(o,[]),t.get(o).push(a)}let n={};for(let[i,o]of t)if(i<G.length){let a=o.reduce((m,u)=>m+u,0)/o.length;n[G[i].id]=a}return n}function ge(){let e=s.createCommandEncoder(),r=e.beginComputePass();r.setPipeline(j),r.setBindGroup(0,S?we:Ce);let t=Math.ceil(l/16),n=Math.ceil(d/16);r.dispatchWorkgroups(t,n),r.end(),s.queue.submit([e.finish()]),S=!S,h++}function be(){nr();let e=ce.getCurrentTexture().createView(),r=s.createCommandEncoder(),t=r.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(oe),t.setBindGroup(0,S?Ue:Pe),t.draw(3),t.end(),s.queue.submit([r.finish()])}function Ve(e){if(H){let t=H;H=null;let n=s.createCommandEncoder();ur(n,t.centerX,t.centerY,t.brushSize,t.shape,t.fill,t.tribeId),s.queue.submit([n.finish()])}C&&F&&(F=!1,te().then(t=>{let n=new Uint8Array(l*d);for(let o=0;o<l*d;o++)n[o]=t[o];let i=h-v;i>=0&&i<p.length?p[i]=n:p.push(n),p.length=i+1})),W===0&&(W=e);let r=e-W;if(r>=1e3&&(ze=q/(r/1e3),q=0,W=e),de){let t=!1;O===0&&(O=e);let n=e-O;O=e;let i=Xe();if(w<=0){let o=performance.now()+14;for(;performance.now()<o&&(ge(),q++,h%i!==0););t=!0}else for(k+=n;k>=w;)ge(),q++,k-=w,t=!0;if(t){if(C){let o=!K,a=o?me:he;if(o?Q:ee){let u=S?B:y,c=N(),f=s.createCommandEncoder();f.copyBufferToBuffer(u,0,a,0,c),s.queue.submit([f.finish()]),o?Q=!1:ee=!1,a.mapAsync(GPUMapMode.READ).then(()=>{let g=new Uint32Array(a.getMappedRange()),b=new Uint8Array(l*d);for(let x=0;x<l*d;x++)b[x]=g[x];a.unmap(),o?Q=!0:ee=!0,p.push(b)}),K=!K}}if((h%i===0||h-D>=i*2)&&(e-ue>=1e3||ue===0)&&!M){ue=e;let a=s.createCommandEncoder();ne(a),s.queue.submit([a.finish()]);let m=lr(),u=h-Be>=m;u&&(cr(),Be=h),se(u)}}}w>0&&be(),self.requestAnimationFrame(Ve)}function Se(e){T=e,l=e.cols,d=e.rows,G=[...e.tribes],U.clear(),G.forEach((r,t)=>U.set(r.id,t))}async function fr(e){L=e;let r=await navigator.gpu.requestAdapter();if(!r)throw new Error("WebGPU adapter not available");s=await r.requestDevice({requiredLimits:{maxBufferSize:r.limits.maxBufferSize,maxStorageBufferBindingSize:r.limits.maxStorageBufferBindingSize}});let t=Math.floor(s.limits.maxBufferSize/4);self.postMessage({type:"limits",maxCells:t}),ce=L.getContext("webgpu"),le=navigator.gpu.getPreferredCanvasFormat(),ce.configure({device:s,format:le,alphaMode:"opaque"})}function He(){let e=N();me=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),he=s.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),K=!1,Q=!0,ee=!0}function pr(){ie=s.createBuffer({size:$e,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),De(),Le(),je(),sr(),qe(),Fe(),We(),Ye(),He()}function gr(){y?.destroy(),B?.destroy(),I?.destroy(),z?.destroy(),E?.destroy(),$?.destroy(),me?.destroy(),he?.destroy(),De(),Le(),je(),Fe(),We(),qe(),Ye(),He(),Y=void 0,p=[],v=h}self.onmessage=async e=>{let r=e.data;switch(r.type){case"init":{Se(r.ruleset),await fr(r.canvas),pr(),de=r.running,w=r.speed<0?0:1e3/r.speed,O=0,k=0,self.requestAnimationFrame(Ve);break}case"setRuleset":{if(Se(r.ruleset),gr(),h=0,D=-1,p=[],v=0,F=!1,!M){let t=s.createCommandEncoder();ne(t),s.queue.submit([t.finish()]),se(!0)}break}case"setRunning":de=r.running,r.running&&(O=0,k=0,C&&(F=!0));break;case"setSpeed":w=r.speed<0?0:1e3/r.speed,k=0;break;case"camera":Te=r.scale,ve=r.offsetX,Re=r.offsetY;break;case"resize":L.width=r.width,L.height=r.height;break;case"draw":{let t=U.get(r.tribe);t!==void 0&&(H={centerX:r.x,centerY:r.y,brushSize:r.size,shape:r.shape==="round"?1:0,fill:r.fill==="spray"?1:0,tribeId:t});break}case"getSnapshot":{te().then(t=>{self.postMessage({type:"snapshot",grid:t,generation:h,cols:l,rows:d},{transfer:[t.buffer]})});break}case"loadSnapshot":{let t=S?B:y;if(s.queue.writeBuffer(t,0,r.grid),P)for(let n=0;n<r.grid.length;n++)P[n]=r.grid[n];h=r.generation,Y=void 0;break}case"setRecording":{r.recording&&!C?(C=!0,p=[],v=h,F=!0):r.recording||(C=!1);break}case"getRecording":{let t=p.map(i=>new Uint8Array(i)),n=t.map(i=>i.buffer);self.postMessage({type:"recording",frames:t,startGeneration:v,cols:l,rows:d},{transfer:n});break}case"stepBack":{let t=Math.min(r.count,p.length-1);if(t<=0)break;p.splice(p.length-t,t);let n=p[p.length-1],i=new Uint32Array(l*d);for(let a=0;a<l*d;a++)i[a]=n[a];let o=S?B:y;if(s.queue.writeBuffer(o,0,i),P)for(let a=0;a<l*d;a++)P[a]=n[a];if(h=v+p.length-1,Y=void 0,D=-1,!M){let a=s.createCommandEncoder();ne(a),s.queue.submit([a.finish()]),se(!0)}be();break}case"stepForward":{(async()=>{if(r.count>1&&self.postMessage({type:"stepping",active:!0}),C){let n=await te(),i=new Uint8Array(l*d);for(let a=0;a<l*d;a++)i[a]=n[a];let o=h-v;o>=0&&o<p.length?p[o]=i:p.push(i),p.length=o+1}for(let n=0;n<r.count;n++)if(ge(),q++,C){let i=await te(),o=new Uint8Array(l*d);for(let a=0;a<l*d;a++)o[a]=i[a];p.push(o)}if(D=-1,!M){let n=s.createCommandEncoder();ne(n),s.queue.submit([n.finish()]),se(!0)}be(),r.count>1&&self.postMessage({type:"stepping",active:!1})})();break}}};
