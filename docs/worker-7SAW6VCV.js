var ce=`// Render shader: draws the grid as a full-screen quad.\r
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
`;var E={id:"dead",color:"000000"};var i,ee,re,$,U,c=0,l=0,b=[],T=new Map,m,y,H,w,Z,be,me,q,ye,he,h=!1,Be=1,xe=0,Ge=0,te=!1,C=100,R=0,S=0,x=0,F=[],B=null,N,Te,Pe,M,_,Y,Ce,Ue,O,k,le=0,ne=-1,J,A=!0,I=[],se=0,K=!1,ae,ue,W=!1,j=!0,V=!0,z=0,L=0,ve=0;function qe(){let e=[];e.push("// Auto-generated simulation compute shader."),e.push(`// Tribes: ${b.map(a=>a.id).join(", ")}`),e.push(`// Rules: ${U.rules.length}`),e.push(""),e.push("@group(0) @binding(0) var<storage, read> gridIn: array<u32>;"),e.push("@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;"),e.push(""),e.push(`const COLS: u32 = ${c}u;`),e.push(`const ROWS: u32 = ${l}u;`),e.push(`const TOTAL: u32 = ${c*l}u;`),e.push(""),e.push("fn readCell(idx: u32) -> u32 {"),e.push("  return gridIn[idx];"),e.push("}"),e.push(""),e.push("fn writeCell(idx: u32, tribe: u32) {"),e.push("  gridOut[idx] = tribe;"),e.push("}"),e.push(""),e.push("@compute @workgroup_size(256)"),e.push("fn main(@builtin(global_invocation_id) gid: vec3u) {"),e.push("  let idx = gid.x;"),e.push("  if (idx >= TOTAL) { return; }"),e.push(""),e.push("  let x = idx % COLS;"),e.push("  let y = idx / COLS;"),e.push(""),e.push("  let selfTribe = readCell(idx);"),e.push(""),e.push("  // Neighbor tribe IDs (toroidal wrapping).");for(let a=-1;a<=1;a++)for(let u=-1;u<=1;u++){if(u===0&&a===0)continue;let d=we(u,a),G=fe("x",u,"COLS"),g=fe("y",a,"ROWS");e.push(`  let ${d} = readCell(${g} * COLS + ${G});`)}e.push("");let r=Ne(U.rules.map(a=>a.clause)),t=new Map,n=0;for(let a of r){let u=`count_${n++}`;t.set(a,u)}for(let[a,u]of t){let d=a.split(",").map(Number),g=de().map(P=>`select(0u, 1u, ${d.map(Q=>`${P} == ${Q}u`).join(" || ")})`);e.push(`  let ${u} = ${g.join(" + ")};`)}r.size>0&&e.push("");let s=Ye(U.rules.map(a=>a.clause)),o=new Map,f=0;for(let a of s)if(t.has(a))o.set(a,t.get(a));else{let u=`eq_count_${f++}`;o.set(a,u)}for(let[a,u]of o){if(t.has(a))continue;let d=a.split(",").map(Number),g=de().map(P=>`select(0u, 1u, ${d.map(Q=>`${P} == ${Q}u`).join(" || ")})`);e.push(`  let ${u} = ${g.join(" + ")};`)}s.size>0&&f>0&&e.push("");let p=T.get(E.id)??0;e.push(`  var result: u32 = ${p}u;`),e.push("");for(let a=0;a<U.rules.length;a++){let u=U.rules[a],d=X(u.clause,t,o),G=Fe(u.tribe);a===0?e.push(`  if (${d}) {`):e.push(`  } else if (${d}) {`),e.push(`    result = ${G}u;`)}return U.rules.length>0&&e.push("  }"),e.push(""),e.push("  writeCell(idx, result);"),e.push("}"),e.join(`
`)}function we(e,r){return`n${r===-1?"T":r===1?"B":"C"}${e===-1?"L":e===1?"R":"C"}`}function de(){let e=[];for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++)t===0&&r===0||e.push(we(t,r));return e}function fe(e,r,t){return r===0?e:r===-1?`(${e} + ${t} - 1u) % ${t}`:`(${e} + 1u) % ${t}`}function v(e){let r=[];for(let t of e)if(t==="any")for(let n=0;n<b.length;n++)r.push(n);else{let n=T.get(t);n!==void 0&&r.push(n)}return[...new Set(r)]}function Fe(e){return e==="any"?0:T.get(e)??0}function Ne(e){let r=new Set;for(let t of e)ie(t,r);return r}function ie(e,r){switch(e.kind){case"count":{let t=v(e.tribes).sort();r.add(t.join(","));break}case"not":ie(e.clause,r);break;case"and":case"or":for(let t of e.clauses)ie(t,r);break}}function Ye(e){let r=new Set;for(let t of e)oe(t,r);return r}function oe(e,r){switch(e.kind){case"equality":{let t=v(e.tribe1).sort(),n=v(e.tribe2).sort();r.add(t.join(",")),r.add(n.join(","));break}case"not":oe(e.clause,r);break;case"and":case"or":for(let t of e.clauses)oe(t,r);break}}function X(e,r,t){switch(e.kind){case"is":{let n=v(e.tribes);return n.length===0?"false":n.length===b.length?"true":`(${n.map(o=>`selfTribe == ${o}u`).join(" || ")})`}case"count":{let n=v(e.tribes).sort(),s=r.get(n.join(","));return`(${s} >= ${e.interval[0]}u && ${s} <= ${e.interval[1]}u)`}case"equality":{let n=v(e.tribe1).sort(),s=v(e.tribe2).sort(),o=t.get(n.join(",")),f=t.get(s.join(","));return`(${o} == ${f})`}case"not":return`!(${X(e.clause,r,t)})`;case"and":return`(${e.clauses.map(s=>X(s,r,t)).join(" && ")})`;case"or":return`(${e.clauses.map(s=>X(s,r,t)).join(" || ")})`;default:return"false"}}var Se=48;function We(){let e=new ArrayBuffer(Se),r=new Float32Array(e),t=new Uint32Array(e);r[0]=$.width,r[1]=$.height,r[2]=c,r[3]=l,r[4]=Be,r[6]=xe,r[7]=Ge,t[8]=b.length,i.queue.writeBuffer(H,0,e)}function D(){return c*l*4}function Ae(){let e=D();m=i.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),y=i.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});let r=T.get(E.id)??0,t=new Uint32Array(c*l);t.fill(r),i.queue.writeBuffer(m,0,t),i.queue.writeBuffer(y,0,t),h=!1}function Re(){let e=new Uint32Array(256);for(let r=0;r<b.length;r++){let t=b[r].color,n=parseInt(t.substring(0,2),16),s=parseInt(t.substring(2,4),16),o=parseInt(t.substring(4,6),16);e[r]=n|s<<8|o<<16}w&&w.destroy(),w=i.createBuffer({size:e.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),i.queue.writeBuffer(w,0,e)}function je(){let e=i.createShaderModule({code:ce});Z=i.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:"vs_main"},fragment:{module:e,entryPoint:"fs_main",targets:[{format:re}]},primitive:{topology:"triangle-list"}})}function Me(){be=i.createBindGroup({layout:Z.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:H}},{binding:1,resource:{buffer:m}},{binding:2,resource:{buffer:w}}]}),me=i.createBindGroup({layout:Z.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:H}},{binding:1,resource:{buffer:y}},{binding:2,resource:{buffer:w}}]})}function _e(){let e=qe(),r=i.createShaderModule({code:e});q=i.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),ye=i.createBindGroup({layout:q.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:y}}]}),he=i.createBindGroup({layout:q.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:m}}]})}var Ve=`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> hist: array<atomic<u32>>;

const TOTAL: u32 = 0u; // placeholder, replaced at creation time

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if (idx >= TOTAL) { return; }
  let tribe = grid[idx];
  atomicAdd(&hist[tribe], 1u);
}
`;function Xe(){return`
@group(0) @binding(0) var<storage, read> grid: array<u32>;
@group(0) @binding(1) var<storage, read_write> boundary: atomic<u32>;

const COLS: u32 = ${c}u;
const ROWS: u32 = ${l}u;
const TOTAL: u32 = ${c*l}u;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if (idx >= TOTAL) { return; }
  let x = idx % COLS;
  let y = idx / COLS;
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
`}function Oe(){let e=Ve.replace("0u",`${c*l}u`),r=i.createShaderModule({code:e});N=i.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),M=i.createBuffer({size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),_=i.createBuffer({size:256*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Te=i.createBindGroup({layout:N.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:M}}]}),Pe=i.createBindGroup({layout:N.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:M}}]});let t=i.createShaderModule({code:Xe()});Y=i.createComputePipeline({layout:"auto",compute:{module:t,entryPoint:"main"}}),O=i.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),k=i.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),Ce=i.createBindGroup({layout:Y.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:O}}]}),Ue=i.createBindGroup({layout:Y.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:O}}]})}function He(){if(F.length===0)return;let e=h?y:m;for(let{cellIndex:r,tribeId:t}of F){let n=new Uint32Array([t]);i.queue.writeBuffer(e,r*4,n),B&&(B[r]=t)}F=[]}function ke(){B=new Uint8Array(c*l);let e=T.get(E.id)??0;B.fill(e)}function Ze(){if(!B)return;let e=h?y:m,r=D(),t=i.createBuffer({size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),n=i.createCommandEncoder();n.copyBufferToBuffer(e,0,t,0,r),i.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let s=new Uint32Array(t.getMappedRange());for(let o=0;o<c*l;o++)B[o]=s[o];t.unmap(),t.destroy()})}function Ie(){let e=h?y:m,r=D(),t=i.createBuffer({size:r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),n=i.createCommandEncoder();return n.copyBufferToBuffer(e,0,t,0,r),i.queue.submit([n.finish()]),t.mapAsync(GPUMapMode.READ).then(()=>{let s=new Uint32Array(t.getMappedRange().slice(0));return t.unmap(),t.destroy(),s})}function $e(){if(C<=0)return 60;let e=1e3/C;return Math.max(1,Math.round(e))}function Je(){return Math.max(5,$e()*4)}function Ke(e){let r=new Uint32Array(256);i.queue.writeBuffer(M,0,r);let t=new Uint32Array([0]);i.queue.writeBuffer(O,0,t);let n=Math.ceil(c*l/256),s=e.beginComputePass();s.setPipeline(N),s.setBindGroup(0,h?Pe:Te),s.dispatchWorkgroups(n),s.end();let o=e.beginComputePass();o.setPipeline(Y),o.setBindGroup(0,h?Ue:Ce),o.dispatchWorkgroups(n),o.end(),e.copyBufferToBuffer(M,0,_,0,256*4),e.copyBufferToBuffer(O,0,k,0,4)}function Qe(e){let r=x;r!==ne&&(ne=r,_.mapAsync(GPUMapMode.READ).then(()=>{let t=new Uint32Array(_.getMappedRange().slice(0));return _.unmap(),k.mapAsync(GPUMapMode.READ).then(()=>{let n=new Uint32Array(k.getMappedRange().slice(0));k.unmap();let s={},o=0,f=T.get(E.id)??0;for(let u=0;u<b.length;u++){let d=t[u]??0;s[b[u].id]=d,u!==f&&(o+=d)}let p=0,a=0;if(o>0)for(let u=0;u<b.length;u++){if(u===f)continue;let d=(t[u]??0)/o;d>0&&(p-=d*Math.log2(d),a+=d*d)}e&&B&&(J=er()),self.postMessage({type:"metrics",generation:r,population:s,shannonEntropy:p,simpsonIndex:1-a,boundaryLength:n[0]??0,meanClusterSize:J,fps:ve})})}))}function er(){if(!B)return{};let e=c*l,r=new Uint8Array(e),t=new Map;for(let s=0;s<e;s++){if(r[s])continue;let o=B[s];r[s]=1;let f=0,p=[s];for(;p.length>0;){let a=p.pop();f++;let u=a%c,d=(a-u)/c,G=[(d+l-1)%l*c+u,(d+1)%l*c+u,d*c+(u+c-1)%c,d*c+(u+1)%c];for(let g of G)!r[g]&&B[g]===o&&(r[g]=1,p.push(g))}t.has(o)||t.set(o,[]),t.get(o).push(f)}let n={};for(let[s,o]of t)if(s<b.length){let f=o.reduce((p,a)=>p+a,0)/o.length;n[b[s].id]=f}return n}function pe(){let e=i.createCommandEncoder(),r=e.beginComputePass();r.setPipeline(q),r.setBindGroup(0,h?he:ye);let t=Math.ceil(c*l/256);r.dispatchWorkgroups(t),r.end(),i.queue.submit([e.finish()]),h=!h,x++}function rr(){We();let e=ee.getCurrentTexture().createView(),r=i.createCommandEncoder(),t=r.beginRenderPass({colorAttachments:[{view:e,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});t.setPipeline(Z),t.setBindGroup(0,h?me:be),t.draw(3),t.end(),i.queue.submit([r.finish()])}function Ee(e){He(),A&&K&&(K=!1,Ie().then(t=>{let n=new Uint8Array(c*l);for(let s=0;s<c*l;s++)n[s]=t[s];I.unshift(n)})),L===0&&(L=e);let r=e-L;if(r>=1e3&&(ve=z/(r/1e3),z=0,L=e),te){let t=!1;S===0&&(S=e);let n=e-S;if(S=e,C<=0){let s=performance.now()+14;for(;performance.now()<s;)pe(),z++;t=!0}else for(R+=n;R>=C;)pe(),z++,R-=C,t=!0;if(t){if(A){let o=!W,f=o?ae:ue;if(o?j:V){let a=h?y:m,u=D(),d=i.createCommandEncoder();d.copyBufferToBuffer(a,0,f,0,u),i.queue.submit([d.finish()]),o?j=!1:V=!1,f.mapAsync(GPUMapMode.READ).then(()=>{let G=new Uint32Array(f.getMappedRange()),g=new Uint8Array(c*l);for(let P=0;P<c*l;P++)g[P]=G[P];f.unmap(),o?j=!0:V=!0,I.push(g)}),W=!W}}let s=$e();if(x-ne>=s){let o=i.createCommandEncoder();Ke(o),i.queue.submit([o.finish()]);let f=Je(),p=x-le>=f;p&&(Ze(),le=x),Qe(p)}}}C>0&&rr(),self.requestAnimationFrame(Ee)}function ge(e){U=e,c=e.cols,l=e.rows,b=[...e.tribes],T.clear(),b.forEach((r,t)=>T.set(r.id,t))}async function tr(e){$=e;let r=await navigator.gpu.requestAdapter();if(!r)throw new Error("WebGPU adapter not available");i=await r.requestDevice(),ee=$.getContext("webgpu"),re=navigator.gpu.getPreferredCanvasFormat(),ee.configure({device:i,format:re,alphaMode:"opaque"})}function De(){let e=D();ae=i.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),ue=i.createBuffer({size:e,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),W=!1,j=!0,V=!0}function nr(){H=i.createBuffer({size:Se,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Ae(),Re(),ke(),je(),Me(),_e(),Oe(),De()}function sr(){m?.destroy(),y?.destroy(),M?.destroy(),_?.destroy(),O?.destroy(),k?.destroy(),ae?.destroy(),ue?.destroy(),Ae(),Re(),ke(),_e(),Me(),Oe(),De(),J=void 0,I=[],se=x}self.onmessage=async e=>{let r=e.data;switch(r.type){case"init":{ge(r.ruleset),await tr(r.canvas),nr(),te=r.running,C=r.speed<0?0:1e3/r.speed,S=0,R=0,self.requestAnimationFrame(Ee);break}case"setRuleset":{ge(r.ruleset),sr(),x=0;break}case"setRunning":te=r.running,r.running&&(S=0,R=0,A&&I.length===0&&(K=!0));break;case"setSpeed":C=r.speed<0?0:1e3/r.speed,R=0;break;case"camera":Be=r.scale,xe=r.offsetX,Ge=r.offsetY;break;case"resize":$.width=r.width,$.height=r.height;break;case"draw":{let t=T.get(r.tribe);if(t===void 0)break;for(let n of r.cells){let s=(n.x%c+c)%c,f=(n.y%l+l)%l*c+s;F.push({cellIndex:f,tribeId:t})}break}case"getSnapshot":{Ie().then(t=>{self.postMessage({type:"snapshot",grid:t,generation:x,cols:c,rows:l},{transfer:[t.buffer]})});break}case"loadSnapshot":{let t=h?y:m;if(i.queue.writeBuffer(t,0,r.grid),B)for(let n=0;n<r.grid.length;n++)B[n]=r.grid[n];x=r.generation,J=void 0;break}case"setRecording":{r.recording&&!A?(A=!0,I=[],se=x,K=!0):r.recording||(A=!1);break}case"getRecording":{let t=I.map(s=>new Uint8Array(s)),n=t.map(s=>s.buffer);self.postMessage({type:"recording",frames:t,startGeneration:se,cols:c,rows:l},{transfer:n});break}}};
