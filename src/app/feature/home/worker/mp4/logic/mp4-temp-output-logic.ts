import {Mp4ZipCopyOptions} from '../model/mp4-temp-output-types';

/**
 * Creates a unique temporary MP4 filename.
 *
 * @export
 * @returns {string} temporary filename.
 */
function createUniqueMp4TempFilename(): string {
  const suffix = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${Date.now()}-${suffix}-simulation.mp4`;
}

/**
 * Removes stale temporary MP4 files.
 *
 * @export
 * @async
 * @param {FileSystemDirectoryHandle} directory temporary mp4 directory.
 */
async function removeStaleMp4Files(directory: FileSystemDirectoryHandle): Promise<void> {
  for await (const name of directory.keys()) {
    try {
      await directory.removeEntry(name);
    } catch (error) {
      console.warn('[GOLT] Failed to remove stale MP4 output:', name, error);
    }
  }
}

/**
 * Checks for a missing OPFS entry error.
 *
 * @export
 * @param {unknown} error error thrown by OPFS.
 * @returns {boolean} true when the entry was already missing.
 */
function isMissingOpfsEntry(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

/**
 * Throws when MP4 ZIP copy cancellation has been requested.
 *
 * @export
 * @param {Mp4ZipCopyOptions} options zip copy options.
 */
function assertNotCancelled(options: Mp4ZipCopyOptions): void {
  if (options.shouldCancel()) {
    throw new Error('MP4 export cancelled');
  }
}

export {assertNotCancelled, createUniqueMp4TempFilename, isMissingOpfsEntry, removeStaleMp4Files};
