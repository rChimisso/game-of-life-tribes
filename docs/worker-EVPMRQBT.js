var C={id:"dead",color:"000000"};var e,m,s=0,i=0,p=[],u=new Map,c,d=1,T=0,v=0,x=!1,A=100,R=0,y=0,M=0,f,k,_,h,w,S,L,b=null,P=`#version 300 es

layout(location=0) in vec2 aPos;
layout(location=1) in vec3 aCol;

uniform vec2 uCanvas;
uniform float uScale;
uniform vec2 uOffset;

out vec3 vCol;

void main(){
  vec2 world = (aPos - uOffset) * uScale;
  vec2 clip = (world / uCanvas) * 2.0 - 1.0;
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = uScale;
  vCol = aCol;
}`,U=`#version 300 es

precision highp float;

in vec3 vCol;

out vec4 outCol;

void main(){
  outCol = vec4(vCol, 1.0);
}`;function E(n,r){let t=e.createShader(r);if(e.shaderSource(t,n),e.compileShader(t),!e.getShaderParameter(t,e.COMPILE_STATUS))throw Error(`Shader compile error: ${e.getShaderInfoLog(t)}`);return t}function W(n,r){let t=E(n,e.VERTEX_SHADER),a=E(r,e.FRAGMENT_SHADER),o=e.createProgram();if(e.attachShader(o,t),e.attachShader(o,a),e.linkProgram(o),!e.getProgramParameter(o,e.LINK_STATUS))throw Error(`Program link error: ${e.getProgramInfoLog(o)}`);return o}function I(n,r){let t=(n+s)%s;return(r+i)%i*s+t}function D(n,r,t){let a=0;for(let o=-1;o<=1;o++)for(let l=-1;l<=1;l++)l===0&&o===0||t.has(c[I(n+l,r+o)])&&a++;return a}function g(n,r,t){switch(n.kind){case"is":{let a=p[c[I(r,t)]].id;return n.tribes.includes(a)}case"count":{let a=new Set(n.tribes.map(l=>u.get(l))),o=D(r,t,a);return o>=n.interval[0]&&o<=n.interval[1]}case"equality":return n.tribe1===n.tribe2;case"not":return!g(n.clause,r,t);case"and":return n.clauses.every(a=>g(a,r,t));case"or":return n.clauses.some(a=>g(a,r,t));default:return!1}}function G(){let n=new Uint8Array(s*i),r=u.get(C.id);for(let t=0;t<i;t++)for(let a=0;a<s;a++){let o=r;for(let l of m.rules)if(g(l.clause,a,t)){o=u.get(l.tribe);break}n[t*s+a]=o}c=n,y++}function Y(){let n=s*i,r=new Float32Array(n*3),t=0;for(let a=0;a<n;a++){let o=p[c[a]].color;r[t++]=parseInt(o.substring(0,2),16),r[t++]=parseInt(o.substring(2,4),16),r[t++]=parseInt(o.substring(4,6),16)}e.bindBuffer(e.ARRAY_BUFFER,L),e.bufferData(e.ARRAY_BUFFER,r,e.STREAM_DRAW)}function N(){let n=e.canvas;e.viewport(0,0,n.width,n.height),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(f),e.uniform2f(k,n.width,n.height),e.uniform1f(_,d),e.uniform2f(h,T,v),Y(),e.bindVertexArray(w);for(let r=-1;r<=1;r++)for(let t=-1;t<=1;t++){let a=T-t*m.cols,o=v-r*m.rows;e.uniform2f(h,a,o),e.drawArrays(e.POINTS,0,s*i)}}function V(){let n=s*i;b=new Float32Array(n*2);let r=0;for(let t=0;t<i;t++)for(let a=0;a<s;a++)b[r++]=a+.5,b[r++]=t+.5;e.bindBuffer(e.ARRAY_BUFFER,S),e.bufferData(e.ARRAY_BUFFER,b,e.STATIC_DRAW)}function q(n){if(e=n.getContext("webgl2",{alpha:!1,antialias:!1}),!e)throw Error("WebGL2 not available inside worker");f=W(P,U),k=e.getUniformLocation(f,"uCanvas"),_=e.getUniformLocation(f,"uScale"),h=e.getUniformLocation(f,"uOffset"),w=e.createVertexArray(),S=e.createBuffer(),L=e.createBuffer(),e.bindVertexArray(w),e.bindBuffer(e.ARRAY_BUFFER,S),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,L),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,3,e.FLOAT,!1,0,0),e.clearColor(0,0,0,1)}function F(n){m=n,s=n.cols,i=n.rows,p=n.tribes,u.clear(),p.forEach((r,t)=>u.set(r.id,t)),c=new Uint8Array(s*i),c.fill(u.get(C.id)),V(),y=0}function B(n,r){d=Math.floor(Math.min(n/s,r/i)),d<.5&&(d=.5),T=0,v=0}function O(n){if(x){let r=n-R;if(A<=0||r>=A){let t=performance.now();G(),M=1e3/(performance.now()-t),R=n,y%15===0&&self.postMessage({type:"metrics",generation:y,simFps:M})}}N(),self.requestAnimationFrame(O)}self.onmessage=n=>{let r=n.data;switch(r.type){case"init":{q(r.canvas),F(r.ruleset),B(r.canvas.width,r.canvas.height),x=r.running,A=r.speed<0?0:1e3/r.speed,R=performance.now(),self.requestAnimationFrame(O);break}case"resize":{let t=e.canvas;t.width=r.width,t.height=r.height,e.viewport(0,0,r.width,r.height);break}case"camera":{d=r.scale,T=r.offsetX,v=r.offsetY;break}case"setRunning":x=r.running;break;case"setSpeed":A=r.speed<0?0:1e3/r.speed;break;case"setRuleset":{let t=s,a=i;F(r.ruleset);let o=e.canvas;(t!==s||a!==i)&&B(o.width,o.height);break}case"draw":{let t=u.get(r.tribe);if(t===void 0)break;for(let a of r.cells){let o=I(a.x,a.y);c[o]=t}break}}};
