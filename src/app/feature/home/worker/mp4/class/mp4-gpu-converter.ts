import {PackedRecordedFrame} from '../../frame/recording-frame-stream';
import {GPU_LABELS} from '../../gpu/gpu-labels';
import {assertNotCancelled, assertNotDisposed, createConversionConfig, createMp4FrameUpload, createMp4GpuDeviceLostError, createStorageBuffer, formatBytes, requestMp4GpuDevice} from '../logic/mp4-gpu-converter-logic';
import {MP4_CONVERSION_SHADER} from '../logic/mp4-gpu-shader';
import {buildMp4GpuPalette} from '../logic/mp4-palette';
import {MIN_GPU_BUFFER_BYTES, MP4_CONVERSION_CONFIG_U32_COUNT, Mp4GpuFrameConverterResources} from '../model/mp4-gpu-converter-types';
import {Mp4OutputSize} from '../model/mp4-types';

import {Tribe} from '~gol/feature/home/model/rule';

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
   * Device-loss promise for the MP4 conversion device.
   *
   * @private
   * @readonly
   * @type {Promise<GPUDeviceLostInfo>}
   */
  private readonly deviceLost: Promise<GPUDeviceLostInfo>;

  /**
   * Device-loss information when MP4 conversion can no longer continue.
   *
   * @private
   * @type {(GPUDeviceLostInfo | null)}
   */
  private deviceLostInfo: GPUDeviceLostInfo | null = null;

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
    this.deviceLost = this.device.lost.then(info => {
      this.deviceLostInfo = info;
      if (!this.disposed) {
        console.error('[GOLT] MP4 conversion GPU device lost:', info);
      }
      return info;
    });
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
    const device = await requestMp4GpuDevice();
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
    const initialUpload = createMp4FrameUpload(firstFrame, outputSize);
    const frameBuffer = createStorageBuffer(device, GPU_LABELS.mp4ConversionFrameBuffer, initialUpload.words.byteLength);
    console.log('[GOLT] MP4 GPU converter initialized', {
      outputWidth: outputSize.width,
      outputHeight: outputSize.height,
      sourceCols: firstFrame.cols,
      sourceRows: firstFrame.rows,
      frameBytes: firstFrame.words.byteLength,
      uploadBytes: initialUpload.words.byteLength,
      sampledRows: initialUpload.sampledRows
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
      frameBufferBytes: initialUpload.words.byteLength
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
    this.assertDeviceAvailable();
    const upload = createMp4FrameUpload(frame, this.outputSize);
    this.ensureFrameBuffer(upload.words.byteLength);
    this.device.queue.writeBuffer(this.frameBuffer, 0, upload.words);
    this.device.queue.writeBuffer(this.configBuffer, 0, createConversionConfig(frame, this.outputSize, this.paletteLength, upload.sampledRows));
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
    await this.waitForSubmittedWork();
    assertNotCancelled(shouldCancel);
    this.assertDeviceAvailable();
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

  /**
   * Waits for submitted GPU work and rejects when the device is lost.
   *
   * @private
   * @async
   */
  private async waitForSubmittedWork(): Promise<void> {
    await Promise.race([
      this.device.queue.onSubmittedWorkDone(),
      this.deviceLost.then(info => {
        throw createMp4GpuDeviceLostError(info);
      })
    ]);
  }

  /**
   * Throws when MP4 conversion can no longer use its GPU device.
   *
   * @private
   */
  private assertDeviceAvailable(): void {
    if (this.deviceLostInfo) {
      throw createMp4GpuDeviceLostError(this.deviceLostInfo);
    }
  }
}

export {Mp4GpuFrameConverter};
