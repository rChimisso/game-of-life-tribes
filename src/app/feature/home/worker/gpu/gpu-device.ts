import {GpuAdapterLimitValidator} from './gpu-device-types';

/**
 * Requests a WebGPU device with the worker-wide buffer limit policy.
 *
 * @export
 * @async
 * @param {string} label gpu label for the requested device.
 * @param {GpuAdapterLimitValidator} [validateAdapterLimits] adapter-limit validation hook.
 * @returns {Promise<GPUDevice>} requested GPU device.
 */
async function requestWorkerGpuDevice(label: string, validateAdapterLimits?: GpuAdapterLimitValidator): Promise<GPUDevice> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is unavailable.');
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPU adapter is unavailable.');
  }
  validateAdapterLimits?.(adapter.limits);
  return adapter.requestDevice({
    label,
    requiredLimits: {
      maxBufferSize: adapter.limits.maxBufferSize,
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
    }
  });
}

export {requestWorkerGpuDevice};

export type {GpuAdapterLimitValidator} from './gpu-device-types';
