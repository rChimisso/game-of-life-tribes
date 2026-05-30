import {Mp4OutputSize} from './mp4-types';

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

export {MIN_GPU_BUFFER_BYTES, MP4_CONVERSION_CONFIG_U32_COUNT};

export type {Mp4GpuFrameConverterResources};
