import {StorageBarSegment} from '../../../../../shared/component/storage-bar/model/storage-bar-segment';
import {formatBinaryBytes, formatDecimalBytes} from '../../../logic/byte-format';
import {SidebarGridDisplayInput, SidebarStorageDisplayInput, SidebarVramDisplayInput} from '../model/sidebar-display';

/**
 * Formats the VRAM section title size.
 *
 * @export
 * @param {SidebarVramDisplayInput} input VRAM display input.
 * @returns {string} formatted title size.
 */
export function formatVramTitleSize(input: SidebarVramDisplayInput): string {
  return formatBinaryBytes(input.simulationBytes + input.recordingBytes);
}

/**
 * Formats the detected VRAM quota.
 *
 * @export
 * @param {SidebarVramDisplayInput} input VRAM display input.
 * @returns {string} formatted quota.
 */
export function formatVramQuota(input: SidebarVramDisplayInput): string {
  return Number.isFinite(input.budgetBytes) ? formatBinaryBytes(input.budgetBytes) : 'Detecting…';
}

/**
 * Formats the recording storage section title size.
 *
 * @export
 * @param {SidebarStorageDisplayInput} input storage display input.
 * @returns {string} formatted title size.
 */
export function formatDownloadStorageTitleSize(input: SidebarStorageDisplayInput): string {
  return formatDecimalBytes(input.pendingRawBytes + input.compressedBytes);
}

/**
 * Formats the recording storage quota.
 *
 * @export
 * @param {SidebarStorageDisplayInput} input storage display input.
 * @returns {string} formatted quota.
 */
export function formatDownloadStorageQuota(input: SidebarStorageDisplayInput): string {
  return formatBinaryBytes(input.quotaBytes);
}

/**
 * Formats simulation VRAM usage.
 *
 * @export
 * @param {SidebarVramDisplayInput} input VRAM display input.
 * @returns {string} formatted simulation bytes.
 */
export function formatVramSimulation(input: SidebarVramDisplayInput): string {
  return formatBinaryBytes(input.simulationBytes);
}

/**
 * Formats recording VRAM usage.
 *
 * @export
 * @param {SidebarVramDisplayInput} input VRAM display input.
 * @returns {string} formatted recording bytes.
 */
export function formatVramRecording(input: SidebarVramDisplayInput): string {
  return formatBinaryBytes(input.recordingBytes);
}

/**
 * Calculates the simulation VRAM percentage.
 *
 * @export
 * @param {SidebarVramDisplayInput} input VRAM display input.
 * @returns {number} simulation percentage.
 */
export function calculateVramSimulationPct(input: SidebarVramDisplayInput): number {
  return Number.isFinite(input.budgetBytes) && input.budgetBytes > 0 ? (input.simulationBytes / input.budgetBytes) * 100 : 0;
}

/**
 * Calculates the recording VRAM percentage.
 *
 * @export
 * @param {SidebarVramDisplayInput} input VRAM display input.
 * @returns {number} recording percentage.
 */
export function calculateVramRecordingPct(input: SidebarVramDisplayInput): number {
  return Number.isFinite(input.budgetBytes) && input.budgetBytes > 0 ? (input.recordingBytes / input.budgetBytes) * 100 : 0;
}

/**
 * Builds the VRAM usage tooltip.
 *
 * @export
 * @param {SidebarVramDisplayInput} input VRAM display input.
 * @returns {string} tooltip text.
 */
export function createVramBarTooltip(input: SidebarVramDisplayInput): string {
  return `${formatVramSimulation(input)} simulation / ${formatVramRecording(input)} recording / ${formatVramQuota(input)} budget`;
}

/**
 * Calculates the total value used by the VRAM usage bar.
 *
 * @export
 * @param {SidebarVramDisplayInput} input VRAM display input.
 * @returns {number} VRAM bar total.
 */
export function calculateVramBarTotal(input: SidebarVramDisplayInput): number {
  return Number.isFinite(input.budgetBytes) && input.budgetBytes > 0 ? input.budgetBytes : input.simulationBytes + input.recordingBytes;
}

/**
 * Builds VRAM storage bar segments.
 *
 * @export
 * @param {SidebarVramDisplayInput} input VRAM display input.
 * @returns {StorageBarSegment[]} storage bar segments.
 */
export function createVramSegments(input: SidebarVramDisplayInput): StorageBarSegment[] {
  return [
    {
      label: 'simulation',
      value: input.simulationBytes,
      formatted: formatVramSimulation(input),
      color: '#f59e0b'
    },
    {
      label: 'recording',
      value: input.recordingBytes,
      formatted: formatVramRecording(input),
      color: '#e91e8a'
    }
  ];
}

/**
 * Calculates the maximum allowed brush size for the current grid.
 *
 * @export
 * @param {SidebarGridDisplayInput} input grid display input.
 * @returns {number} maximum brush size.
 */
export function calculateBrushMaxSize(input: SidebarGridDisplayInput): number {
  return Math.max(1, Math.floor(Math.min(input.cols, input.rows) / 4));
}
