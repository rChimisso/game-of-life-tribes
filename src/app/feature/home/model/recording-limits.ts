/**
 * Maximum size of one frame that can be recorded.
 *
 * @type {number}
 */
const RECORDING_MAX_FRAME_BYTES = 1024 * 1024 * 1024;

/**
 * Maximum queued raw OPFS write bytes before recording backpressure applies.
 *
 * @type {number}
 */
const OPFS_PENDING_WRITE_BYTE_BUDGET = 512 * 1024 * 1024;

export {OPFS_PENDING_WRITE_BYTE_BUDGET, RECORDING_MAX_FRAME_BYTES};
