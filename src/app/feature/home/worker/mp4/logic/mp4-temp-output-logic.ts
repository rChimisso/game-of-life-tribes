import {Mp4ZipCopyOptions} from '../model/mp4-temp-output-types';

/**
 * Removes stale temporary MP4 files.
 *
 * @async
 * @param {FileSystemDirectoryHandle} directory temporary mp4 directory.
 */
export async function removeStaleMp4Files(directory: FileSystemDirectoryHandle): Promise<void> {
  for await (const name of directory.keys()) {
    try {
      await directory.removeEntry(name);
    } catch (error) {
      console.warn('[GOLT] Failed to remove stale MP4 output:', name, error);
    }
  }
}

/**
 * Creates a unique temporary MP4 filename.
 *
 * @returns {string} temporary filename.
 */
export function createUniqueMp4TempFilename(): string {
  const suffix = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${Date.now()}-${suffix}-simulation.mp4`;
}

/**
 * Checks for a missing OPFS entry error.
 *
 * @param {unknown} error error thrown by OPFS.
 * @returns {boolean} true when the entry was already missing.
 */
export function isMissingOpfsEntry(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

/**
 * Throws when MP4 ZIP copy cancellation has been requested.
 *
 * @param {Mp4ZipCopyOptions} options zip copy options.
 */
export function assertNotCancelled(options: Mp4ZipCopyOptions): void {
  if (options.shouldCancel()) {
    throw new Error('MP4 export cancelled');
  }
}
