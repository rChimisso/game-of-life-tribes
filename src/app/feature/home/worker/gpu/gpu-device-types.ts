/**
 * Callback that validates adapter limits before requesting a device.
 *
 * @param {GPUSupportedLimits} adapterLimits adapter limits exposed by the selected GPU adapter.
 */
export type GpuAdapterLimitValidator = (adapterLimits: GPUSupportedLimits) => void;
