import {PackedRecordedFrame} from '../../frame/recording-frame-stream';
import {requestWorkerGpuDevice} from '../../gpu/gpu-device';
import {GPU_LABELS} from '../../gpu/gpu-labels';
import {MIN_GPU_BUFFER_BYTES, MP4_CONVERSION_CONFIG_U32_COUNT} from '../model/mp4-gpu-converter-types';
import {Mp4OutputSize} from '../model/mp4-types';

import {packedColsForFormat} from '~gol/feature/home/util/grid-format';

/**
 * Requests a WebGPU device suitable for MP4 conversion.
 *
 * @export
 * @async
 * @returns {Promise<GPUDevice>} WebGPU device.
 */
async function requestMp4GpuDevice(): Promise<GPUDevice> {
  return requestWorkerGpuDevice(GPU_LABELS.mp4ConversionDevice);
}

/**
 * Creates the user-facing MP4 device-loss error.
 *
 * @export
 * @param {GPUDeviceLostInfo} info device loss information.
 * @returns {Error} MP4 device-loss error.
 */
function createMp4GpuDeviceLostError(info: GPUDeviceLostInfo): Error {
  const suffix = info.message ? ` ${info.message}` : '';
  return new Error(`MP4 GPU device lost during export.${suffix} Try again, reduce the MP4 output size, or disable MP4 export.`);
}

/**
 * Creates a GPU storage buffer.
 *
 * @export
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
 * @export
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
 * @export
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
 * @export
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
 * @export
 * @param {number} bytes byte count.
 * @returns {string} formatted byte count.
 */
function formatBytes(bytes: number): string {
  const gib = bytes / (1024 ** 3);
  const mib = bytes / (1024 ** 2);
  return gib >= 1 ? `${gib.toFixed(2)} GiB` : `${mib.toFixed(1)} MiB`;
}

export {assertNotCancelled, assertNotDisposed, createConversionConfig, createMp4GpuDeviceLostError, createStorageBuffer, formatBytes, requestMp4GpuDevice};
