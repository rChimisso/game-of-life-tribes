/**
 * Common OPFS directory for temporary download handoff files.
 *
 * @type {string}
 */
export const GOLT_TEMP_OPFS_DIR = 'gol-temp';

/**
 * OPFS subdirectory for temporary ZIP files.
 *
 * @type {string}
 */
export const GOLT_TEMP_DOWNLOAD_DIR = 'downloads';

/**
 * OPFS subdirectory for temporary snapshot files.
 *
 * @type {string}
 */
export const GOLT_TEMP_SNAPSHOT_DIR = 'snapshots';

/**
 * OPFS subdirectory for temporary Metrics export files.
 *
 * @type {string}
 */
export const GOLT_TEMP_METRICS_DIR = 'metrics';

/**
 * OPFS subdirectory for temporary MP4 export files.
 *
 * @type {string}
 */
export const GOLT_TEMP_MP4_DIR = 'mp4';

/**
 * Directory name for OPFS recording storage.
 *
 * @type {string}
 */
export const OPFS_RECORDING_DIR = 'gol-recording';

/**
 * OPFS directory handle with browser entry iteration support.
 *
 * @interface IterableFileSystemDirectoryHandle
 * @typedef {IterableFileSystemDirectoryHandle}
 * @extends {FileSystemDirectoryHandle}
 */
export interface IterableFileSystemDirectoryHandle extends FileSystemDirectoryHandle {
  /**
   * Iterates child entries.
   *
   * @returns {AsyncIterableIterator<[string, FileSystemHandle]>} child entry iterator.
   */
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}
