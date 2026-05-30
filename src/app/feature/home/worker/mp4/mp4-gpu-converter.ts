import {buildMp4GpuPalette} from './mp4-palette';
import {Mp4OutputSize} from './mp4-types';
import {PackedRecordedFrame} from '../frame/recording-frame-stream';
import {GPU_LABELS} from '../gpu-labels';

import {Tribe} from '~gol/feature/home/model/rule';
import {packedColsForFormat} from '~gol/feature/home/util/grid-format';

/**
 * Uniform config u32 count, padded to a 16-byte boundary.
 *
 * @type {number}
 */
const MP4_CONVERSION_CONFIG_U32_COUNT = 12;

/**
 * Minimum storage-buffer size accepted by WebGPU.
 *
 * @type {number}
 */
const MIN_GPU_BUFFER_BYTES = 4;

/**
 * WGSL shader used to convert packed recorded frames to video pixels.
 *
 * @type {string}
 */
const MP4_CONVERSION_SHADER = `
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
  pad0: u32,
  pad1: u32,
  pad2: u32,
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

fn readPackedState(sourceX: u32, sourceY: u32) -> u32 {
  let wordIndex = (sourceY * config.packedCols) + (sourceX / config.cellsPerWord);
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

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let outX = min(u32(position.x), config.outputWidth - 1u);
  let outY = min(u32(position.y), config.outputHeight - 1u);
  let sourceX = min(config.sourceCols - 1u, u32(floor((f32(outX) + 0.5) * f32(config.sourceCols) / f32(config.outputWidth))));
  let sourceY = min(config.sourceRows - 1u, u32(floor((f32(outY) + 0.5) * f32(config.sourceRows) / f32(config.outputHeight))));
  return palette[readPackedState(sourceX, sourceY)];
}
`;

/**
 * Resources owned by an MP4 GPU converter.
 *
 * @interface Mp4GpuFrameConverterResources
 * @typedef {Mp4GpuFrameConverterResources}
 */
interface Mp4GpuFrameConverterResources {
  /**
   * WebGPU device.
   *
   * @type {GPUDevice}
   */
  device: GPUDevice;
  /**
   * MP4 output size.
   *
   * @type {Mp4OutputSize}
   */
  outputSize: Mp4OutputSize;
  /**
   * WebGPU canvas format.
   *
   * @type {GPUTextureFormat}
   */
  canvasFormat: GPUTextureFormat;
  /**
   * Number of GPU palette entries.
   *
   * @type {number}
   */
  paletteLength: number;
  /**
   * Conversion render pipeline.
   *
   * @type {GPURenderPipeline}
   */
  pipeline: GPURenderPipeline;
  /**
   * GPU palette buffer.
   *
   * @type {GPUBuffer}
   */
  paletteBuffer: GPUBuffer;
  /**
   * Conversion config buffer.
   *
   * @type {GPUBuffer}
   */
  configBuffer: GPUBuffer;
  /**
   * Initial frame storage buffer.
   *
   * @type {GPUBuffer}
   */
  frameBuffer: GPUBuffer;
  /**
   * Initial frame storage buffer byte size.
   *
   * @type {number}
   */
  frameBufferBytes: number;
}

/**
 * GPU converter for packed recorded frames.
 *
 * @export
 * @class Mp4GpuFrameConverter
 * @typedef {Mp4GpuFrameConverter}
 */
class Mp4GpuFrameConverter {
  /**
   * WebGPU device.
   *
   * @private
   * @readonly
   * @type {GPUDevice}
   */
  private readonly device: GPUDevice;

  /**
   * MP4 output size.
   *
   * @private
   * @readonly
   * @type {Mp4OutputSize}
   */
  private readonly outputSize: Mp4OutputSize;

  /**
   * WebGPU canvas format.
   *
   * @private
   * @readonly
   * @type {GPUTextureFormat}
   */
  private readonly canvasFormat: GPUTextureFormat;

  /**
   * Offscreen canvas used as VideoFrame source.
   *
   * @private
   * @readonly
   * @type {OffscreenCanvas}
   */
  private readonly canvas: OffscreenCanvas;

  /**
   * WebGPU canvas context.
   *
   * @private
   * @readonly
   * @type {GPUCanvasContext}
   */
  private readonly context: GPUCanvasContext;

  /**
   * Render pipeline used for packed-frame conversion.
   *
   * @private
   * @readonly
   * @type {GPURenderPipeline}
   */
  private readonly pipeline: GPURenderPipeline;

  /**
   * Palette buffer shared by all converted frames.
   *
   * @private
   * @readonly
   * @type {GPUBuffer}
   */
  private readonly paletteBuffer: GPUBuffer;

  /**
   * Conversion config buffer.
   *
   * @private
   * @readonly
   * @type {GPUBuffer}
   */
  private readonly configBuffer: GPUBuffer;

  /**
   * Number of GPU palette entries.
   *
   * @private
   * @readonly
   * @type {number}
   */
  private readonly paletteLength: number;

  /**
   * Frame storage buffer.
   *
   * @private
   * @type {GPUBuffer}
   */
  private frameBuffer: GPUBuffer;

  /**
   * Size of the current frame storage buffer.
   *
   * @private
   * @type {number}
   */
  private frameBufferBytes: number;

  /**
   * Bind group referencing current conversion buffers.
   *
   * @private
   * @type {GPUBindGroup}
   */
  private bindGroup: GPUBindGroup;

  /**
   * Whether this converter has been disposed.
   *
   * @private
   * @type {boolean}
   */
  private disposed = false;

  /**
   * Creates a GPU frame converter.
   *
   * @param {Mp4GpuFrameConverterResources} resources converter resources.
   */
  private constructor(resources: Mp4GpuFrameConverterResources) {
    this.device = resources.device;
    this.outputSize = resources.outputSize;
    this.canvasFormat = resources.canvasFormat;
    this.canvas = new OffscreenCanvas(resources.outputSize.width, resources.outputSize.height);
    const context = this.canvas.getContext('webgpu');
    if (!context) {
      throw new Error('WebGPU canvas context is unavailable for MP4 export.');
    }
    this.context = context;
    this.context.configure({
      device: resources.device,
      format: resources.canvasFormat,
      alphaMode: 'opaque'
    });
    this.pipeline = resources.pipeline;
    this.paletteBuffer = resources.paletteBuffer;
    this.configBuffer = resources.configBuffer;
    this.paletteLength = resources.paletteLength;
    this.frameBuffer = resources.frameBuffer;
    this.frameBufferBytes = Math.max(MIN_GPU_BUFFER_BYTES, resources.frameBufferBytes);
    this.bindGroup = this.createBindGroup();
  }

  /**
   * Creates a GPU converter for one MP4 export.
   *
   * @public
   * @static
   * @async
   * @param {Mp4OutputSize} outputSize output video size.
   * @param {readonly Pick<Tribe, 'id' | 'color'>[]} tribes ordered tribe metadata.
   * @param {PackedRecordedFrame} firstFrame first frame used for initial buffer sizing.
   * @returns {Promise<Mp4GpuFrameConverter>} GPU converter.
   */
  public static async create(outputSize: Mp4OutputSize, tribes: readonly Pick<Tribe, 'id' | 'color'>[], firstFrame: PackedRecordedFrame): Promise<Mp4GpuFrameConverter> {
    const device = await requestMp4GpuDevice(outputSize, firstFrame);
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    const shaderModule = device.createShaderModule({
      label: GPU_LABELS.mp4ConversionShaderModule,
      code: MP4_CONVERSION_SHADER
    });
    const pipeline = device.createRenderPipeline({
      label: GPU_LABELS.mp4ConversionPipeline,
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain'
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{format: canvasFormat}]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });
    const palette = buildMp4GpuPalette(tribes);
    const paletteBuffer = createStorageBuffer(device, GPU_LABELS.mp4ConversionPaletteBuffer, palette.byteLength);
    device.queue.writeBuffer(paletteBuffer, 0, palette);
    const configBuffer = device.createBuffer({
      label: GPU_LABELS.mp4ConversionConfigBuffer,
      size: MP4_CONVERSION_CONFIG_U32_COUNT * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const frameBuffer = createStorageBuffer(device, GPU_LABELS.mp4ConversionFrameBuffer, firstFrame.words.byteLength);
    console.log('[GOLT] MP4 GPU converter initialized', {
      outputWidth: outputSize.width,
      outputHeight: outputSize.height,
      sourceCols: firstFrame.cols,
      sourceRows: firstFrame.rows,
      frameBytes: firstFrame.words.byteLength
    });
    return new Mp4GpuFrameConverter({
      device,
      outputSize,
      canvasFormat,
      paletteLength: palette.length / 4,
      pipeline,
      paletteBuffer,
      configBuffer,
      frameBuffer,
      frameBufferBytes: firstFrame.words.byteLength
    });
  }

  /**
   * Converts one packed recorded frame to a VideoFrame.
   *
   * @public
   * @async
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {number} timestampUs frame timestamp in microseconds.
   * @param {number} durationUs frame duration in microseconds.
   * @param {() => boolean} shouldCancel cancellation predicate.
   * @returns {Promise<VideoFrame>} converted video frame.
   */
  public async convert(frame: PackedRecordedFrame, timestampUs: number, durationUs: number, shouldCancel: () => boolean): Promise<VideoFrame> {
    assertNotDisposed(this.disposed);
    assertNotCancelled(shouldCancel);
    this.ensureFrameBuffer(frame.words.byteLength);
    this.device.queue.writeBuffer(this.frameBuffer, 0, frame.words);
    this.device.queue.writeBuffer(this.configBuffer, 0, createConversionConfig(frame, this.outputSize, this.paletteLength));
    const encoder = this.device.createCommandEncoder({label: GPU_LABELS.mp4ConversionEncoder});
    const pass = encoder.beginRenderPass({
      label: GPU_LABELS.mp4ConversionPass,
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: {
            r: 0,
            g: 0,
            b: 0,
            a: 1
          }
        }
      ]
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    assertNotCancelled(shouldCancel);
    return new VideoFrame(this.canvas, {
      timestamp: timestampUs,
      duration: durationUs
    });
  }

  /**
   * Releases GPU resources held by the converter.
   *
   * @public
   */
  public dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.frameBuffer.destroy();
      this.paletteBuffer.destroy();
      this.configBuffer.destroy();
    }
  }

  /**
   * Ensures the frame storage buffer can hold the current packed frame.
   *
   * @private
   * @param {number} byteLength required byte length.
   */
  private ensureFrameBuffer(byteLength: number): void {
    if (byteLength > this.frameBufferBytes) {
      if (byteLength > this.device.limits.maxBufferSize || byteLength > this.device.limits.maxStorageBufferBindingSize) {
        throw new Error(`MP4 source frame size ${formatBytes(byteLength)} exceeds this GPU storage-buffer limit.`);
      }
      this.frameBuffer.destroy();
      this.frameBuffer = createStorageBuffer(this.device, GPU_LABELS.mp4ConversionFrameBuffer, byteLength);
      this.frameBufferBytes = Math.max(MIN_GPU_BUFFER_BYTES, byteLength);
      this.bindGroup = this.createBindGroup();
    }
  }

  /**
   * Creates a bind group for the current conversion buffers.
   *
   * @private
   * @returns {GPUBindGroup} conversion bind group.
   */
  private createBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      label: GPU_LABELS.mp4ConversionBindGroup,
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {buffer: this.frameBuffer}
        },
        {
          binding: 1,
          resource: {buffer: this.paletteBuffer}
        },
        {
          binding: 2,
          resource: {buffer: this.configBuffer}
        }
      ]
    });
  }
}

/**
 * Requests a WebGPU device suitable for MP4 conversion.
 *
 * @async
 * @param {Mp4OutputSize} outputSize output video size.
 * @param {PackedRecordedFrame} firstFrame first frame used for size checks.
 * @returns {Promise<GPUDevice>} WebGPU device.
 */
async function requestMp4GpuDevice(outputSize: Mp4OutputSize, firstFrame: PackedRecordedFrame): Promise<GPUDevice> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is unavailable for MP4 export.');
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPU adapter is unavailable for MP4 export.');
  }
  const {limits} = adapter;
  if (outputSize.width > limits.maxTextureDimension2D || outputSize.height > limits.maxTextureDimension2D) {
    throw new Error(`MP4 output dimensions ${outputSize.width} x ${outputSize.height} exceed this GPU limit.`);
  }
  if (firstFrame.words.byteLength > limits.maxBufferSize || firstFrame.words.byteLength > limits.maxStorageBufferBindingSize) {
    throw new Error(`MP4 source frame size ${formatBytes(firstFrame.words.byteLength)} exceeds this GPU storage-buffer limit.`);
  }
  const device = await adapter.requestDevice({
    label: 'MP4 conversion device'
  });
  device.lost.then(info => console.warn('[GOLT] MP4 conversion GPU device lost:', info));
  return device;
}

/**
 * Creates a GPU storage buffer.
 *
 * @param {GPUDevice} device webgpu device.
 * @param {string} label buffer label.
 * @param {number} byteLength requested byte length.
 * @returns {GPUBuffer} storage buffer.
 */
function createStorageBuffer(device: GPUDevice, label: string, byteLength: number): GPUBuffer {
  return device.createBuffer({
    label,
    size: Math.max(MIN_GPU_BUFFER_BYTES, byteLength),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
}

/**
 * Creates the packed-frame conversion uniform config.
 *
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {Mp4OutputSize} outputSize output video size.
 * @param {number} paletteLength number of GPU palette entries.
 * @returns {Uint32Array} conversion config.
 */
function createConversionConfig(frame: PackedRecordedFrame, outputSize: Mp4OutputSize, paletteLength: number): Uint32Array {
  const config = new Uint32Array(MP4_CONVERSION_CONFIG_U32_COUNT);
  config[0] = frame.cols;
  config[1] = frame.rows;
  config[2] = outputSize.width;
  config[3] = outputSize.height;
  config[4] = packedColsForFormat(frame.cols, frame.format);
  config[5] = frame.format.cellsPerWord;
  config[6] = frame.format.bitsPerCell;
  config[7] = frame.format.cellMask;
  config[8] = Math.max(1, paletteLength);
  return config;
}

/**
 * Checks whether a converter has already been disposed.
 *
 * @param {boolean} disposed disposed state.
 */
function assertNotDisposed(disposed: boolean): void {
  if (disposed) {
    throw new Error('MP4 GPU converter has already been disposed.');
  }
}

/**
 * Throws when MP4 conversion cancellation has been requested.
 *
 * @param {() => boolean} shouldCancel cancellation predicate.
 */
function assertNotCancelled(shouldCancel: () => boolean): void {
  if (shouldCancel()) {
    throw new Error('MP4 export cancelled');
  }
}

/**
 * Formats byte counts for diagnostics and error messages.
 *
 * @param {number} bytes byte count.
 * @returns {string} formatted byte count.
 */
function formatBytes(bytes: number): string {
  const gib = bytes / (1024 ** 3);
  const mib = bytes / (1024 ** 2);
  return gib >= 1 ? `${gib.toFixed(2)} GiB` : `${mib.toFixed(1)} MiB`;
}

export {Mp4GpuFrameConverter};
