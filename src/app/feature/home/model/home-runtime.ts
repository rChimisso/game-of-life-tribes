/**
 * Fixed-speed log message.
 *
 * @type {string}
 */
export const FIXED_SPEED_LOG_MESSAGE = '[GOLT] Fixed speed selected';

/**
 * Status shown while the app is collecting snapshot inputs.
 *
 * @type {string}
 */
export const PREPARING_SNAPSHOT_STATUS = 'Preparing snapshot';

/**
 * Status shown while active compression jobs finish.
 *
 * @type {string}
 */
export const WAITING_COMPRESSION_JOBS_STATUS = 'Waiting for compression jobs to finish';

/**
 * Maximum delayed retries before a failed compression job is deferred.
 *
 * @type {number}
 */
export const MAX_COMPRESSION_RETRIES = 3;

/**
 * Maximum deferred-to-queued cycles before a chunk is left raw.
 *
 * @type {number}
 */
export const MAX_COMPRESSION_DEFERRED_REQUEUES = 3;

/**
 * Initial delayed compression retry interval.
 *
 * @type {number}
 */
export const COMPRESSION_RETRY_DELAY_MS = 2000;

/**
 * Minimum progress UI visibility duration.
 *
 * @type {number}
 */
export const MINIMUM_PROGRESS_VISIBLE_MS = 1000;
