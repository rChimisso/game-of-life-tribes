/**
 * WGSL shader used to convert packed recorded frames to video pixels.
 *
 * @type {string}
 */
export const MP4_CONVERSION_SHADER = `
struct ConvertConfig {
  sourceCols: u32,
  sourceRows: u32,
  outputWidth: u32,
  outputHeight: u32,
  packedCols: u32,
  cellsPerWord: u32,
  bitsPerCell: u32,
  cellMask: u32,
  paletteLength: u32,
  sampledRows: u32,
  exportOriginX: u32,
  exportOriginY: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
};

@group(0) @binding(0) var<storage, read> frameWords: array<u32>;
@group(0) @binding(1) var<storage, read> palette: array<vec4f>;
@group(0) @binding(2) var<uniform> config: ConvertConfig;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -3.0),
    vec2f(3.0, 1.0),
    vec2f(-1.0, 1.0)
  );
  let position = positions[vertexIndex];
  return vec4f(position, 0.0, 1.0);
}

fn readPackedState(sourceX: u32, sourceY: u32, outY: u32) -> u32 {
  let bufferY = select(sourceY, outY, config.sampledRows != 0u);
  let wordIndex = (bufferY * config.packedCols) + (sourceX / config.cellsPerWord);
  let word = frameWords[wordIndex];
  var state: u32;
  if (config.bitsPerCell == 32u) {
    state = word;
  } else {
    let shift = (sourceX % config.cellsPerWord) * config.bitsPerCell;
    state = (word >> shift) & config.cellMask;
  }
  return min(state, config.paletteLength - 1u);
}

fn wrapAdd(base: u32, delta: u32, size: u32) -> u32 {
  let rem = delta % size;
  if (base >= size - rem) {
    return base - (size - rem);
  }
  return base + rem;
}

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let outX = min(u32(position.x), config.outputWidth - 1u);
  let outY = min(u32(position.y), config.outputHeight - 1u);
  let unwrappedSourceX = min(config.sourceCols - 1u, u32(floor((f32(outX) + 0.5) * f32(config.sourceCols) / f32(config.outputWidth))));
  let unwrappedSourceY = min(config.sourceRows - 1u, u32(floor((f32(outY) + 0.5) * f32(config.sourceRows) / f32(config.outputHeight))));
  let sourceX = wrapAdd(config.exportOriginX, unwrappedSourceX, config.sourceCols);
  let sourceY = wrapAdd(config.exportOriginY, unwrappedSourceY, config.sourceRows);
  return palette[readPackedState(sourceX, sourceY, outY)];
}
`;
