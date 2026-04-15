var U=new Uint32Array(256);for(let e=0;e<256;e++){let s=e;for(let r=0;r<8;r++)s=s&1?3988292384^s>>>1:s>>>1;U[e]=s}function P(e){let s=4294967295;for(let r=0;r<e.length;r++)s=U[(s^e[r])&255]^s>>>8;return(s^4294967295)>>>0}function b(e,s,r){e.setUint16(s,r,!0)}function x(e,s,r){e.setUint32(s,r,!0)}function k(e){let s=new TextEncoder,r=e.map(i=>s.encode(i.path)),c=0;for(let i=0;i<e.length;i++)c+=30+r[i].length+e[i].data.length;let a=0;for(let i=0;i<e.length;i++)a+=46+r[i].length;let u=c+a+22,p=new ArrayBuffer(u),t=new DataView(p),l=new Uint8Array(p),n=0,h=[];for(let i=0;i<e.length;i++){let g=e[i],m=r[i],f=P(g.data);h.push(n),x(t,n,67324752),b(t,n+4,20),b(t,n+6,0),b(t,n+8,0),b(t,n+10,0),b(t,n+12,0),x(t,n+14,f),x(t,n+18,g.data.length),x(t,n+22,g.data.length),b(t,n+26,m.length),b(t,n+28,0),n+=30,l.set(m,n),n+=m.length,l.set(g.data,n),n+=g.data.length}let w=n;for(let i=0;i<e.length;i++){let g=e[i],m=r[i],f=P(g.data);x(t,n,33639248),b(t,n+4,20),b(t,n+6,20),b(t,n+8,0),b(t,n+10,0),b(t,n+12,0),b(t,n+14,0),x(t,n+16,f),x(t,n+20,g.data.length),x(t,n+24,g.data.length),b(t,n+28,m.length),b(t,n+30,0),b(t,n+32,0),b(t,n+34,0),b(t,n+36,0),x(t,n+38,0),x(t,n+42,h[i]),n+=46,l.set(m,n),n+=m.length}return x(t,n,101010256),b(t,n+4,0),b(t,n+6,0),b(t,n+8,e.length),b(t,n+10,e.length),x(t,n+12,a),x(t,n+16,w),b(t,n+20,0),p}function R(e,s,r,c,a,u){let p=s*r,t=c.findIndex(o=>o.id===a),l=new Array(c.length).fill(0);for(let o=0;o<p;o++)l[e[o]]++;let n={},h=0;for(let o=0;o<c.length;o++)n[c[o].id]=l[o],o!==t&&(h+=l[o]);let w=0,i=0;if(h>0)for(let o=0;o<c.length;o++){if(o===t)continue;let d=l[o]/h;d>0&&(w-=d*Math.log2(d),i+=d*d)}let g=0,m=new Array(c.length).fill(0);for(let o=0;o<r;o++)for(let d=0;d<s;d++){let y=e[o*s+d];e[o*s+(d+1)%s]!==y&&(g++,m[y]++),e[(o+1)%r*s+d]!==y&&(g++,m[y]++)}let f={};for(let o=0;o<c.length;o++)o!==t&&(f[c[o].id]=m[o]);return{type:"metrics",generation:u,population:n,shannonEntropy:w,simpsonIndex:1-i,boundaryLength:g,frontierLength:f}}var V=`
self.onmessage = function(e) {
  var d = e.data;
  var results = [];
  for (var fi = 0; fi < d.frameCount; fi++) {
    var frame = new Uint8Array(d.buffer, d.offsets[fi], d.frameSize);
    var total = d.cols * d.rows;
    var counts = new Array(d.tribeCount).fill(0);
    for (var i = 0; i < total; i++) counts[frame[i]]++;
    var population = {};
    var totalAlive = 0;
    for (var t = 0; t < d.tribeCount; t++) {
      population[d.tribeIds[t]] = counts[t];
      if (t !== d.deadIdx) totalAlive += counts[t];
    }
    var shannonEntropy = 0, simpsonSum = 0;
    if (totalAlive > 0) {
      for (var t = 0; t < d.tribeCount; t++) {
        if (t === d.deadIdx) continue;
        var p = counts[t] / totalAlive;
        if (p > 0) { shannonEntropy -= p * Math.log2(p); simpsonSum += p * p; }
      }
    }
    var boundaryLength = 0;
    var frontierCounts = new Array(d.tribeCount).fill(0);
    for (var y = 0; y < d.rows; y++) {
      for (var x = 0; x < d.cols; x++) {
        var selfTribe = frame[y * d.cols + x];
        var right = frame[y * d.cols + ((x + 1) % d.cols)];
        if (right !== selfTribe) { boundaryLength++; frontierCounts[selfTribe]++; }
        var bottom = frame[((y + 1) % d.rows) * d.cols + x];
        if (bottom !== selfTribe) { boundaryLength++; frontierCounts[selfTribe]++; }
      }
    }
    var frontierLength = {};
    for (var t = 0; t < d.tribeCount; t++) {
      if (t !== d.deadIdx) frontierLength[d.tribeIds[t]] = frontierCounts[t];
    }
    results.push({
      type: 'metrics',
      generation: d.startGen + d.globalOffset + fi,
      population: population,
      shannonEntropy: shannonEntropy,
      simpsonIndex: 1 - simpsonSum,
      boundaryLength: boundaryLength,
      frontierLength: frontierLength
    });
  }
  self.postMessage({results: results});
};
`;function B(e,s,r,c,a,u){let p=e.length;if(p===0)return Promise.resolve([]);let t=Math.min(typeof navigator<"u"&&navigator.hardwareConcurrency||4,8,p);if(t<=1||p<=4)return Promise.resolve(e.map((m,f)=>R(m,s,r,c,a,u+f)));let l=s*r,n=c.findIndex(m=>m.id===a),h=c.map(m=>m.id),w=Math.ceil(p/t),i=URL.createObjectURL(new Blob([V],{type:"application/javascript"})),g=[];for(let m=0;m<t;m++){let f=m*w,o=Math.min(f+w,p);if(f>=o)break;let d=o-f,y=d*l,M=new ArrayBuffer(y),I=new Uint8Array(M),A=[];for(let E=0;E<d;E++){let S=E*l;A.push(S),I.set(e[f+E],S)}g.push(new Promise((E,S)=>{let v=new Worker(i);v.onmessage=C=>{E(C.data.results),v.terminate()},v.onerror=C=>{S(C),v.terminate()},v.postMessage({buffer:M,offsets:A,frameSize:l,frameCount:d,cols:s,rows:r,tribeCount:c.length,tribeIds:h,deadIdx:n,startGen:u,globalOffset:f},[M])}))}return Promise.all(g).then(m=>(URL.revokeObjectURL(i),m.flat()))}function j(e,s,r){let u=Math.max(e,s),p;u<=480?p=Math.max(1,Math.floor(480/u)):u>4096?p=4096/u:p=1;let t=Math.round(e*p),l=Math.round(s*p);return r&&(t+=t%2,l+=l%2),{width:t,height:l,scale:p}}function _(e){return e.map(s=>{let r=s.color;return[parseInt(r.substring(0,2),16),parseInt(r.substring(2,4),16),parseInt(r.substring(4,6),16)]})}function O(e,s,r,c,a,u,p,t){let l=a.createImageData(u,p),n=l.data;for(let h=0;h<p;h++){let w=Math.min(Math.floor(h/t),r-1);for(let i=0;i<u;i++){let g=Math.min(Math.floor(i/t),s-1),m=e[w*s+g],f=c[m]??[0,0,0],o=(h*u+i)*4;n[o]=f[0],n[o+1]=f[1],n[o+2]=f[2],n[o+3]=255}}a.putImageData(l,0,0)}function D(e){let s=new Set,r=new Set;for(let t of e){for(let l of Object.keys(t.population))s.add(l);if(t.frontierLength)for(let l of Object.keys(t.frontierLength))r.add(l)}let c=[...s],a=[...r],u=["generation",...c.map(t=>`pop_${t}`),"shannon_entropy","simpson_index","boundary_length",...a.map(t=>`frontier_${t}`)].join(","),p=e.map(t=>[t.generation,...c.map(l=>t.population[l]??0),t.shannonEntropy,t.simpsonIndex,t.boundaryLength,...a.map(l=>t.frontierLength?.[l]??0)].join(","));return[u,...p].join(`
`)}var T=["avc1.64003D","avc1.64003C","avc1.640034","avc1.640033","avc1.640032","avc1.640029","avc1.640028","avc1.64001F","avc1.4D0029","avc1.4D0028","avc1.42001F"];async function F(e,s,r){for(let c of T)try{let a=await VideoEncoder.isConfigSupported({codec:c,width:e,height:s,bitrate:r});if(a.supported)return{config:a.config,width:e,height:s}}catch{}for(let c=2;c<=16;c++){let a=Math.floor(e/c),u=Math.floor(s/c);if(a+=a%2,u+=u%2,a<16||u<16)break;for(let p of T)try{let t=await VideoEncoder.isConfigSupported({codec:p,width:a,height:u,bitrate:r});if(t.supported)return{config:t.config,width:a,height:u}}catch{}}return null}async function L(e,s,r){let{Output:c,Mp4OutputFormat:a,BufferTarget:u,EncodedVideoPacketSource:p,EncodedPacket:t}=await import("./chunk-2M62DS4B.js"),{width:l,height:n}=j(e.cols,e.rows,!0),h=await F(l,n,2e6);if(!h)return null;let{config:w,width:i,height:g}=h,m=i/e.cols,f=new u,o=new c({format:new a({fastStart:"in-memory"}),target:f}),d=new p("avc");o.addVideoTrack(d,{frameRate:r}),await o.start();let y=[],M=new VideoEncoder({output:(v,C)=>{y.push(d.add(t.fromEncodedChunk(v),C))},error:v=>console.error("VideoEncoder error",v)});M.configure(w);let I=_(s),A=1e6/r,E=new OffscreenCanvas(i,g),S=E.getContext("2d");for(let v=0;v<e.frames.length;v++){O(e.frames[v],e.cols,e.rows,I,S,i,g,m);let C=new VideoFrame(E,{timestamp:v*A,duration:A});M.encode(C),C.close()}return await M.flush(),M.close(),await Promise.all(y),await o.finalize(),f.buffer}async function z(e,s,r){let{width:c,height:a,scale:u}=j(e.cols,e.rows,!1),p=_(s),t=Math.min(typeof navigator<"u"&&navigator.hardwareConcurrency||4,8,e.frames.length),l=String(Math.max(0,e.frames.length-1)).length,n=new Array(e.frames.length),h=Array.from({length:t},()=>new OffscreenCanvas(c,a)),w=0;for(let i=0;i<e.frames.length;i+=t){let g=Math.min(i+t,e.frames.length),m=[];for(let f=i;f<g;f++){let o=f-i,d=h[o],y=d.getContext("2d");O(e.frames[f],e.cols,e.rows,p,y,c,a,u);let M=f;m.push(d.convertToBlob({type:"image/png"}).then(async I=>{let A=new Uint8Array(await I.arrayBuffer()),E=String(M).padStart(l,"0");n[M]={path:`frames/${E}.png`,data:A},w++,r?.(w,e.frames.length)}))}await Promise.all(m)}return n}self.onmessage=async e=>{let s=e.data,{opts:r,snapshot:c,recording:a,tribes:u,rules:p,metricsHistory:t}=s,l=new TextEncoder,n=[],h=(f,o="")=>self.postMessage({type:"progress",percent:f,status:o});h(2,"Preparing state");let w=c.grid instanceof Uint32Array?Array.from(c.grid):c.grid,i={version:1,generation:c.generation,cols:c.cols,rows:c.rows,tribes:[...u],rules:p,grid:w};n.push({path:"state.json",data:l.encode(JSON.stringify(i))}),h(5,"Computing metrics");let g=a!==null&&a.frames.length>0;if(g&&(r.csv||r.json)){let f=u.find(y=>y.id==="dead")?.id??"dead",o=await B(a.frames,a.cols,a.rows,u,f,a.startGeneration),d=o.map(({type:y,fps:M,...I})=>I);r.json&&n.push({path:"metrics.json",data:l.encode(JSON.stringify(d,null,2))}),r.csv&&n.push({path:"metrics.csv",data:l.encode(D(o))})}else if(r.csv||r.json){let f=t.map(({type:o,fps:d,...y})=>y);r.json&&f.length>0&&n.push({path:"metrics.json",data:l.encode(JSON.stringify(f,null,2))}),r.csv&&t.length>0&&n.push({path:"metrics.csv",data:l.encode(D(t))})}if(h(15,"Packing raw frames"),g&&r.frames){let f=String(Math.max(0,a.frames.length-1)).length,o=JSON.stringify({cols:a.cols,rows:a.rows,startGeneration:a.startGeneration,frameCount:a.frames.length,format:{description:"Each frame file is a flat binary array of unsigned 8-bit integers (one byte per cell). Cells are stored in row-major order: the first `cols` bytes represent row 0 (left to right), the next `cols` bytes represent row 1, and so on. Each byte is a 0-based index into the `tribes` array below. File size is always cols * rows bytes.",bytesPerCell:1,cellOrder:"row-major, top-to-bottom, left-to-right",valueType:"uint8 (tribe index)"},tribes:u.map((d,y)=>({id:d.id,color:d.color,index:y}))},null,2);n.push({path:"frames/metadata.json",data:l.encode(o)});for(let d=0;d<a.frames.length;d++){let y=String(d).padStart(f,"0");n.push({path:`frames/${y}`,data:a.frames[d]})}}if(h(25,"Encoding MP4"),g&&r.mp4)try{h(30,"Encoding MP4");let f=await L(a,u,r.fps);f&&n.push({path:"recording.mp4",data:new Uint8Array(f)})}catch{}if(h(65,"Rendering PNGs"),g&&r.png){let f=await z(a,u,(o,d)=>{let y=65+Math.round(o/d*25);h(y,`Rendering PNGs (${o}/${d})`)});n.push(...f)}h(90,"Building ZIP");let m=k(n);h(100,"Done"),self.postMessage({type:"done",zip:m},[m])};
