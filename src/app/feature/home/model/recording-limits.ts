/**
 * Maximum size of one frame that can be recorded.
 *
 * @type {number}
 */
export const RECORDING_MAX_FRAME_BYTES = 1024 * 1024 * 1024;

/**
 * Maximum queued raw OPFS write bytes before recording backpressure applies.
 *
 * @type {number}
 */
export const OPFS_PENDING_WRITE_BYTE_BUDGET = 512 * 1024 * 1024;

/**
 * Maximum queued compression bytes before compression jobs are throttled.
 *
 * @type {number}
 */
export const OPFS_PENDING_COMPRESSION_BYTE_BUDGET = 1024 * 1024 * 1024;
