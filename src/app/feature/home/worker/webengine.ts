/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable import/exports-last */
/* eslint-disable max-depth */
/* eslint-disable complexity */
/* Webengine.ts – WebWorker that simulates the multi‑tribe Game‑of‑Life superset **and** renders it with WebGL2 on an OffscreenCanvas.
 *
 *  – Each cell holds an 8‑bit tribe id (0‥254). Dead tribe **must** be present in the ruleset and is hard‑mapped to colour #000000.
 *  – The world is toroidal (Pac‑Man).  X wraps columns, Y wraps rows.
 *  – The worker understands a small command protocol (Init / Resize / Camera / …) whose
 *    TypeScript definitions live below so the Angular host can import them for type safety.
 *
 *  The code tries to stay reasonably small but still prioritises clarity over micro‑optimisations.
 *  Feel free to tweak buffer update strategies or add instancing if you hit very large grids.
 */

// --------------------------------------------------------------------------------------
//  Public message contracts
// --------------------------------------------------------------------------------------

// --------------------------------------------------------------------------------------
//  Types shared with the UI (imported from the model).
// --------------------------------------------------------------------------------------
import {Ruleset, Tribe, DEAD_TRIBE, Clause} from '../model/rule';

export interface InitMessage {
  type: 'init';
  canvas: OffscreenCanvas;
  ruleset: Ruleset;
  speed: number; // Steps per second (–1 ⇒ max‑speed)
  running: boolean;
}

export interface ResizeMessage { type: 'resize'; width: number; height: number }
export interface SetRulesetMessage { type: 'setRuleset'; ruleset: Ruleset }
export interface SetRunningMessage { type: 'setRunning'; running: boolean }
export interface SetSpeedMessage { type: 'setSpeed'; speed: number }
export interface DrawMessage { type: 'draw'; cells: {x:number; y:number}[]; tribe: string }
export interface CameraMessage { type: 'camera'; scale:number; offsetX:number; offsetY:number }

export type WorkerMessage =
  | InitMessage
  | ResizeMessage
  | SetRulesetMessage
  | SetRunningMessage
  | SetSpeedMessage
  | DrawMessage
  | CameraMessage;

export interface MetricMessage {
  type: 'metrics';
  generation: number;
  simFps: number; // Simulation steps / second actually achieved
}

// --------------------------------------------------------------------------------------
//  Globals (kept module‑local – there’s only one worker instance).
// --------------------------------------------------------------------------------------
let gl: WebGL2RenderingContext;

// Simulation data  ----------------------------------------------------------------------
let ruleset: Ruleset;
let cols = 0;
let rows = 0;
let tribes: Tribe[] = [];
const tribeIndex = new Map<string, number>(); // TribeId → index in tribes[]  (0‑based)
let grid: Uint8Array; // Current generation (row‑major)

// Camera / view state ------------------------------------------------------------------
let scale = 1; // Px per cell (sent from the UI)
let offsetX = 0; // In **cells**
let offsetY = 0;

// Timing -------------------------------------------------------------------------------
let simulationRunning = false;
let targetStepDuration = 100; // Ms  (10 fps default – will be overwritten by init)
let lastStepTime = 0; // Ms timestamp of last sim step
let genCounter = 0;
let simFps = 0;

// WebGL objects ------------------------------------------------------------------------
let program: WebGLProgram;
let uCanvasLoc: WebGLUniformLocation;
let uScaleLoc: WebGLUniformLocation;
let uOffsetLoc: WebGLUniformLocation;
let vao: WebGLVertexArrayObject;
let positionBuf: WebGLBuffer;
let colorBuf: WebGLBuffer;
// We cache a never‑changing Float32Array with vertex positions (2 floats per cell)
let precomputedPositions: Float32Array | null = null;

const vs = `#version 300 es

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
}`;

const fs = `#version 300 es

precision highp float;

in vec3 vCol;

out vec4 outCol;

void main(){
  outCol = vec4(vCol, 1.0);
}`;

function buildShader(src: string, type: GLenum): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw Error(`Shader compile error: ${ gl.getShaderInfoLog(s)}`);
  }
  return s;
}

function makeProgram(vsSrc: string, fsSrc: string): WebGLProgram {
  const vss = buildShader(vsSrc, gl.VERTEX_SHADER);
  const fss = buildShader(fsSrc, gl.FRAGMENT_SHADER);
  const p = gl.createProgram();
  gl.attachShader(p, vss);
  gl.attachShader(p, fss);
  // Gl.bindAttribLocation(p, 0, 'a_pos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw Error(`Program link error: ${ gl.getProgramInfoLog(p)}`);
  }
  return p;
}

function neighbourIndex(x: number, y: number): number {
  // Wrap toroidally.
  const ix = (x + cols) % cols;
  const iy = (y + rows) % rows;
  return iy * cols + ix;
}

function countNeighbours(x: number, y: number, tribeSet: Set<number>): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      if (tribeSet.has(grid[neighbourIndex(x + dx, y + dy)]!)) {
        n++;
      }
    }
  }
  return n;
}

// The rules are expressed as well‑formed propositional‐logic trees.
function evalClause(clause: Clause<Tribe[]>, x: number, y: number): boolean {
  switch (clause.kind) {
    case 'is': {
      const cellTribe = tribes[grid[neighbourIndex(x, y)]!]!.id;
      return clause.tribes.includes(cellTribe);
    }
    case 'count': {
      const wanted = new Set<number>(clause.tribes.map(id => tribeIndex.get(id)!));
      const cnt = countNeighbours(x, y, wanted);
      return cnt >= clause.interval[0] && cnt <= clause.interval[1];
    }
    case 'equality':
      return clause.tribe1 === clause.tribe2;
    case 'not':
      return !evalClause(clause.clause, x, y);
    case 'and':
      return clause.clauses.every(c => evalClause(c, x, y));
    case 'or':
      return clause.clauses.some(c => evalClause(c, x, y));
    default:
      return false;
  }
}

function stepSimulation(): void {
  const next = new Uint8Array(cols * rows);
  const deadIdx = tribeIndex.get(DEAD_TRIBE.id)!;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let newIdx = deadIdx;
      for (const rule of ruleset.rules) {
        if (evalClause(rule.clause, x, y)) {
          newIdx = tribeIndex.get(rule.tribe)!;
          break; // First matching rule wins
        }
      }
      next[y * cols + x] = newIdx;
    }
  }
  grid = next;
  genCounter++;
}

function uploadColours(): void {
  // Convert each cell’s tribe colour into the colour buffer.
  const total = cols * rows;
  const colours = new Float32Array(total * 3);
  let idx = 0;
  for (let i = 0; i < total; i++) {
    const rgb = tribes[grid[i]!]!.color;
    colours[idx++] = parseInt(rgb.substring(0, 2), 16);
    colours[idx++] = parseInt(rgb.substring(2, 4), 16);
    colours[idx++] = parseInt(rgb.substring(4, 6), 16);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
  gl.bufferData(gl.ARRAY_BUFFER, colours, gl.STREAM_DRAW);
}

function renderFrame(): void {
  const canvas = gl.canvas as OffscreenCanvas;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.uniform2f(uCanvasLoc, canvas.width, canvas.height);
  gl.uniform1f(uScaleLoc, scale);
  gl.uniform2f(uOffsetLoc, offsetX, offsetY);

  uploadColours();

  gl.bindVertexArray(vao);
  gl.drawArrays(gl.POINTS, 0, cols * rows);
}

// --------------------------------------------------------------------------------------
//  Initialisation helpers
// --------------------------------------------------------------------------------------
function buildStaticPositionBuffer(): void {
  const total = cols * rows;
  precomputedPositions = new Float32Array(total * 2);
  let i = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      precomputedPositions[i++] = x + 0.5;
      precomputedPositions[i++] = y + 0.5;
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuf);
  gl.bufferData(gl.ARRAY_BUFFER, precomputedPositions, gl.STATIC_DRAW);
}

function buildGLObjects(canvas: OffscreenCanvas): void {
  gl = canvas.getContext('webgl2', {alpha: false,
    antialias: false}) as WebGL2RenderingContext;
  if (!gl) {
    throw Error('WebGL2 not available inside worker');
  }

  program = makeProgram(vs, fs);
  uCanvasLoc = gl.getUniformLocation(program, 'uCanvas')!;
  uScaleLoc = gl.getUniformLocation(program, 'uScale')!;
  uOffsetLoc = gl.getUniformLocation(program, 'uOffset')!;

  vao = gl.createVertexArray()!;
  positionBuf = gl.createBuffer()!;
  colorBuf = gl.createBuffer()!;

  gl.bindVertexArray(vao);

  // Attribute 0 – positions (STATIC)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Attribute 1 – colours (STREAM)
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

  gl.clearColor(0, 0, 0, 1);
}

function initRuleset(rs: Ruleset): void {
  ruleset = rs;
  cols = rs.cols;
  rows = rs.rows;
  tribes = rs.tribes;

  tribeIndex.clear();
  tribes.forEach((t, i) => tribeIndex.set(t.id, i));

  grid = new Uint8Array(cols * rows);
  grid.fill(tribeIndex.get(DEAD_TRIBE.id)!);

  buildStaticPositionBuffer();
  genCounter = 0;
}

function resetCamera(canvasW: number, canvasH: number): void {
  // Lowest zoom so that **whole** grid fits inside the shorter canvas dimension.
  scale = Math.floor(Math.min(canvasW / cols, canvasH / rows));
  if (scale < 0.5) {
    scale = 0.5;
  } // Guarantee >0 to avoid division by zero
  offsetX = 0;
  offsetY = 0;
}

// --------------------------------------------------------------------------------------
//  Main render / sim loop (runs forever) ------------------------------------------------
function mainLoop(now: number): void {
  if (simulationRunning) {
    const elapsed = now - lastStepTime;
    if (targetStepDuration <= 0 || elapsed >= targetStepDuration) {
      const start = performance.now();
      stepSimulation();
      const end = performance.now();
      simFps = 1000 / (end - start);
      lastStepTime = now;

      // Send basic metrics every 15 frames (cheap throttling).
      if (genCounter % 15 === 0) {
        self.postMessage({
          type: 'metrics',
          generation: genCounter,
          simFps
        } as MetricMessage);
      }
    }
  }
  renderFrame();
  self.requestAnimationFrame(mainLoop);
}

// --------------------------------------------------------------------------------------
//  Message handler (public API) ---------------------------------------------------------
self.onmessage = (ev: MessageEvent<WorkerMessage>) => {
  const m = ev.data;
  switch (m.type) {
    case 'init': {
      buildGLObjects(m.canvas);
      initRuleset(m.ruleset);
      resetCamera(m.canvas.width, m.canvas.height);
      simulationRunning = m.running;
      targetStepDuration = m.speed < 0 ? 0 : 1000 / m.speed;
      lastStepTime = performance.now();
      self.requestAnimationFrame(mainLoop);
      break;
    }
    case 'resize': {
      const canvas = gl.canvas as OffscreenCanvas;
      canvas.width = m.width;
      canvas.height = m.height;
      gl.viewport(0, 0, m.width, m.height);
      // Keep camera & grid – view simply cuts off; spec requirement.
      break;
    }
    case 'camera': {
      scale = m.scale;
      offsetX = m.offsetX;
      offsetY = m.offsetY;
      break;
    }
    case 'setRunning':
      simulationRunning = m.running;
      break;
    case 'setSpeed':
      targetStepDuration = m.speed < 0 ? 0 : 1000 / m.speed;
      break;
    case 'setRuleset': {
      const prevCols = cols;
      const prevRows = rows;
      initRuleset(m.ruleset);
      // Spec: if grid size changed, camera resets.
      const canvas = gl.canvas as OffscreenCanvas;
      if (prevCols !== cols || prevRows !== rows) {
        resetCamera(canvas.width, canvas.height);
      }
      break;
    }
    case 'draw': {
      const idx = tribeIndex.get(m.tribe);
      if (idx === undefined) {
        break;
      }
      for (const c of m.cells) {
        const i = neighbourIndex(c.x, c.y); // Reuse wrap logic
        grid[i] = idx;
      }
      break;
    }
  }
};
