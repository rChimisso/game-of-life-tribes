var v={id:"dead",color:"000000"};var e,F,s=0,i=0,m=[],u=new Map,c,d=1,h=0,w=0,C=!1,p=100,y=0,T=0,L=0,f,B,k,_,A,x,R,b=null,O=`#version 300 es

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
}`;function I(t,r){let n=e.createShader(r);if(e.shaderSource(n,t),e.compileShader(n),!e.getShaderParameter(n,e.COMPILE_STATUS))throw Error(`Shader compile error: ${e.getShaderInfoLog(n)}`);return n}function W(t,r){let n=I(t,e.VERTEX_SHADER),a=I(r,e.FRAGMENT_SHADER),o=e.createProgram();if(e.attachShader(o,n),e.attachShader(o,a),e.linkProgram(o),!e.getProgramParameter(o,e.LINK_STATUS))throw Error(`Program link error: ${e.getProgramInfoLog(o)}`);return o}function S(t,r){let n=(t+s)%s;return(r+i)%i*s+n}function D(t,r,n){let a=0;for(let o=-1;o<=1;o++)for(let l=-1;l<=1;l++)l===0&&o===0||n.has(c[S(t+l,r+o)])&&a++;return a}function g(t,r,n){switch(t.kind){case"is":{let a=m[c[S(r,n)]].id;return t.tribes.includes(a)}case"count":{let a=new Set(t.tribes.map(l=>u.get(l))),o=D(r,n,a);return o>=t.interval[0]&&o<=t.interval[1]}case"equality":return t.tribe1===t.tribe2;case"not":return!g(t.clause,r,n);case"and":return t.clauses.every(a=>g(a,r,n));case"or":return t.clauses.some(a=>g(a,r,n));default:return!1}}function G(){let t=new Uint8Array(s*i),r=u.get(v.id);for(let n=0;n<i;n++)for(let a=0;a<s;a++){let o=r;for(let l of F.rules)if(g(l.clause,a,n)){o=u.get(l.tribe);break}t[n*s+a]=o}c=t,T++}function N(){let t=s*i,r=new Float32Array(t*3),n=0;for(let a=0;a<t;a++){let o=m[c[a]].color;r[n++]=parseInt(o.substring(0,2),16),r[n++]=parseInt(o.substring(2,4),16),r[n++]=parseInt(o.substring(4,6),16)}e.bindBuffer(e.ARRAY_BUFFER,R),e.bufferData(e.ARRAY_BUFFER,r,e.STREAM_DRAW)}function Y(){let t=e.canvas;e.viewport(0,0,t.width,t.height),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(f),e.uniform2f(B,t.width,t.height),e.uniform1f(k,d),e.uniform2f(_,h,w),N(),e.bindVertexArray(A),e.drawArrays(e.POINTS,0,s*i)}function V(){let t=s*i;b=new Float32Array(t*2);let r=0;for(let n=0;n<i;n++)for(let a=0;a<s;a++)b[r++]=a+.5,b[r++]=n+.5;e.bindBuffer(e.ARRAY_BUFFER,x),e.bufferData(e.ARRAY_BUFFER,b,e.STATIC_DRAW)}function q(t){if(e=t.getContext("webgl2",{alpha:!1,antialias:!1}),!e)throw Error("WebGL2 not available inside worker");f=W(O,U),B=e.getUniformLocation(f,"uCanvas"),k=e.getUniformLocation(f,"uScale"),_=e.getUniformLocation(f,"uOffset"),A=e.createVertexArray(),x=e.createBuffer(),R=e.createBuffer(),e.bindVertexArray(A),e.bindBuffer(e.ARRAY_BUFFER,x),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,R),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,3,e.FLOAT,!1,0,0),e.clearColor(0,0,0,1)}function M(t){F=t,s=t.cols,i=t.rows,m=t.tribes,u.clear(),m.forEach((r,n)=>u.set(r.id,n)),c=new Uint8Array(s*i),c.fill(u.get(v.id)),V(),T=0}function E(t,r){d=Math.floor(Math.min(t/s,r/i)),d<.5&&(d=.5),h=0,w=0}function P(t){if(C){let r=t-y;if(p<=0||r>=p){let n=performance.now();G(),L=1e3/(performance.now()-n),y=t,T%15===0&&self.postMessage({type:"metrics",generation:T,simFps:L})}}Y(),self.requestAnimationFrame(P)}self.onmessage=t=>{let r=t.data;switch(r.type){case"init":{q(r.canvas),M(r.ruleset),E(r.canvas.width,r.canvas.height),C=r.running,p=r.speed<0?0:1e3/r.speed,y=performance.now(),self.requestAnimationFrame(P);break}case"resize":{let n=e.canvas;n.width=r.width,n.height=r.height,e.viewport(0,0,r.width,r.height);break}case"camera":{d=r.scale,h=r.offsetX,w=r.offsetY;break}case"setRunning":C=r.running;break;case"setSpeed":p=r.speed<0?0:1e3/r.speed;break;case"setRuleset":{let n=s,a=i;M(r.ruleset);let o=e.canvas;(n!==s||a!==i)&&E(o.width,o.height);break}case"draw":{let n=u.get(r.tribe);if(n===void 0)break;for(let a of r.cells){let o=S(a.x,a.y);c[o]=n}break}}};
