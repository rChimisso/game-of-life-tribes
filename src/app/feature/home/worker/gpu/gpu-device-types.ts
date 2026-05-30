/**
 * Callback that validates adapter limits before requesting a device.
 *
 * @export
 * @param {GPUSupportedLimits} adapterLimits adapter limits exposed by the selected GPU adapter.
 */
type GpuAdapterLimitValidator = (adapterLimits: GPUSupportedLimits) => void;

export type {GpuAdapterLimitValidator};
