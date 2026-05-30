/**
 * Common OPFS directory for temporary download handoff files.
 *
 * @type {string}
 */
const GOLT_TEMP_OPFS_DIR = 'gol-temp';

/**
 * OPFS subdirectory for temporary ZIP files.
 *
 * @type {string}
 */
const GOLT_TEMP_DOWNLOAD_DIR = 'downloads';

/**
 * OPFS subdirectory for temporary snapshot files.
 *
 * @type {string}
 */
const GOLT_TEMP_SNAPSHOT_DIR = 'snapshots';

/**
 * OPFS subdirectory for temporary Metrics export files.
 *
 * @type {string}
 */
const GOLT_TEMP_METRICS_DIR = 'metrics';

/**
 * OPFS subdirectory for temporary MP4 export files.
 *
 * @type {string}
 */
const GOLT_TEMP_MP4_DIR = 'mp4';

/**
 * OPFS directory handle with browser entry iteration support.
 *
 * @interface IterableFileSystemDirectoryHandle
 * @typedef {IterableFileSystemDirectoryHandle}
 * @extends {FileSystemDirectoryHandle}
 */
interface IterableFileSystemDirectoryHandle extends FileSystemDirectoryHandle {
  /**
   * Iterates child entries.
   *
   * @returns {AsyncIterableIterator<[string, FileSystemHandle]>} child entry iterator.
   */
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

/**
 * Opens a temporary OPFS subdirectory.
 *
 * @export
 * @async
 * @param {string} name subdirectory name.
 * @returns {Promise<FileSystemDirectoryHandle>} temporary OPFS subdirectory.
 */
async function openTempOpfsDirectory(name: string): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const tempRoot = await root.getDirectoryHandle(GOLT_TEMP_OPFS_DIR, {create: true});
  return tempRoot.getDirectoryHandle(name, {create: true});
}

/**
 * Clears all temporary OPFS handoff files.
 *
 * @export
 * @async
 */
async function clearTempOpfsDirectory(): Promise<void> {
  const root = await navigator.storage.getDirectory();
  try {
    await root.removeEntry(GOLT_TEMP_OPFS_DIR, {recursive: true});
  } catch (error) {
    if (isMissingOpfsEntry(error)) {
      console.log('[GOLT] Temporary OPFS directory already clear');
    } else if (isLockedOpfsEntry(error)) {
      console.warn('[GOLT] Temporary OPFS directory is still in use; attempting entry cleanup:', error);
      await clearLockedTempDirectory(root);
    } else {
      console.warn(`[GOLT] Temporary OPFS cleanup failed for ${GOLT_TEMP_OPFS_DIR}:`, error);
    }
  }
}

/**
 * Clears entries below a locked temporary directory when recursive root removal fails.
 *
 * @async
 * @param {FileSystemDirectoryHandle} root opfs root directory.
 */
async function clearLockedTempDirectory(root: FileSystemDirectoryHandle): Promise<void> {
  try {
    const tempRoot = await root.getDirectoryHandle(GOLT_TEMP_OPFS_DIR);
    await clearDirectoryEntries(tempRoot);
  } catch (error) {
    if (!isMissingOpfsEntry(error)) {
      console.warn('[GOLT] Temporary OPFS entry cleanup could not complete; cleanup will retry on the next reset/download/save:', error);
    }
  }
}

/**
 * Removes every entry in a temporary OPFS directory.
 *
 * @async
 * @param {FileSystemDirectoryHandle} directory directory to clear.
 */
async function clearDirectoryEntries(directory: FileSystemDirectoryHandle): Promise<void> {
  const iterableDirectory = directory as IterableFileSystemDirectoryHandle;
  for await (const [name] of iterableDirectory.entries()) {
    await removeDirectoryEntry(directory, name);
  }
}

/**
 * Removes one OPFS directory entry with lifecycle logging.
 *
 * @async
 * @param {FileSystemDirectoryHandle} directory parent directory.
 * @param {string} name entry name.
 */
async function removeDirectoryEntry(directory: FileSystemDirectoryHandle, name: string): Promise<void> {
  try {
    await directory.removeEntry(name, {recursive: true});
  } catch (error) {
    if (!isMissingOpfsEntry(error)) {
      console.warn(`[GOLT] Temporary OPFS entry ${name} is still in use; leaving it for the next cleanup pass:`, error);
    }
  }
}

/**
 * Checks for a missing OPFS entry error.
 *
 * @param {unknown} error error thrown by OPFS.
 * @returns {boolean} true when the entry was already missing.
 */
function isMissingOpfsEntry(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

/**
 * Checks for an OPFS entry that cannot be modified because it is still in use.
 *
 * @param {unknown} error error thrown by OPFS.
 * @returns {boolean} true when the entry is currently locked.
 */
function isLockedOpfsEntry(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NoModificationAllowedError';
}

export {clearTempOpfsDirectory, GOLT_TEMP_DOWNLOAD_DIR, GOLT_TEMP_METRICS_DIR, GOLT_TEMP_MP4_DIR, GOLT_TEMP_OPFS_DIR, GOLT_TEMP_SNAPSHOT_DIR, openTempOpfsDirectory};
