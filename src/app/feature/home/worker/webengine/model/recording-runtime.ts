import {GridFormatMetadata} from '../../../model/grid-format';

/**
 * Storage-quota snapshot posted through the worker protocol.
 *
 * @export
 * @interface StorageQuotaSnapshot
 * @typedef {StorageQuotaSnapshot}
 */
export interface StorageQuotaSnapshot {
	/**
	 * Effective browser storage quota in bytes.
	 *
	 * @type {number}
	 */
	quotaBytes: number;
	/**
	 * Current browser-reported storage usage in bytes.
	 *
	 * @type {number}
	 */
	usedBytes: number;
	/**
	 * Bytes still waiting to be compressed or persisted.
	 *
	 * @type {number}
	 */
	pendingRawBytes: number;
	/**
	 * Bytes already stored in compressed chunks.
	 *
	 * @type {number}
	 */
	compressedBytes: number;
	/**
	 * Bytes reserved for worker recording buffers.
	 *
	 * @type {number}
	 */
	gpuBufferMarginBytes: number;
}

/**
 * Recording-limit payload posted through the worker protocol.
 *
 * @export
 * @interface RecordingLimitsPayload
 * @typedef {RecordingLimitsPayload}
 */
export interface RecordingLimitsPayload {
	/**
	 * Maximum simulation buffer size supported by the device.
	 *
	 * @type {number}
	 */
	maxBytes: number;
	/**
	 * Combined worker VRAM budget for simulation and recording buffers.
	 *
	 * @type {number}
	 */
	vramBudgetBytes: number;
	/**
	 * Byte size of one packed simulation frame.
	 *
	 * @type {number}
	 */
	frameByteSize: number;
	/**
	 * Whether recording can use the current frame size.
	 *
	 * @type {boolean}
	 */
	recordingAvailable: boolean;
	/**
	 * VRAM used by simulation-only buffers.
	 *
	 * @type {number}
	 */
	vramSimulationBytes: number;
	/**
	 * VRAM used by recording buffers.
	 *
	 * @type {number}
	 */
	vramRecordingBytes: number;
	/**
	 * Active simulation grid format metadata.
	 *
	 * @type {GridFormatMetadata}
	 */
	gridFormat: GridFormatMetadata;
}

/**
 * Number of mapped staging buffers used for chunk readback.
 */
export const STAGING_RING_SIZE = 3;

/**
 * OPFS directory name used for worker recording chunks.
 */
export const OPFS_DIR = 'gol-recording';

/**
 * Codec name for raw packed chunk payloads.
 */
export const RAW_PACKED_CODEC = 'raw-packed';

/**
 * Codec name for raw deflate-compressed chunk payloads.
 */
export const RAW_DEFLATE_CODEC = 'deflate-raw';

/**
 * Maximum count of queued OPFS writes before hard backpressure.
 */
export const MAX_PENDING_OPFS_WRITES = 12;

/**
 * Preferred upper bound for one recording chunk buffer.
 */
export const CHUNK_BUFFER_CAP = 256 * 1024 * 1024;

/**
 * Maximum bytes allocated before rebuild allocation yields.
 */
export const MAJOR_BUFFER_ALLOCATION_YIELD_BYTES = 512 * 1024 * 1024;

/**
 * Storage quota ceiling assumed when the browser estimate is missing.
 */
export const STORAGE_CAP = 128 * 1024 * 1024 * 1024;
