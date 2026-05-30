/**
 * Progress callback used while copying the finalized MP4 into the ZIP.
 *
 * @param {number} bytesWritten copied bytes.
 * @param {number} totalBytes mp4 file bytes.
 */
type Mp4ZipCopyProgressReporter = (bytesWritten: number, totalBytes: number) => void;

/**
 * Options used while writing the finalized MP4 to the ZIP.
 *
 * @interface Mp4ZipCopyOptions
 * @typedef {Mp4ZipCopyOptions}
 */
interface Mp4ZipCopyOptions {
  /**
   * Returns whether the active download has been cancelled.
   *
   * @type {() => boolean}
   */
  shouldCancel: () => boolean;
  /**
   * Receives determinate ZIP copy progress.
   *
   * @type {Mp4ZipCopyProgressReporter}
   */
  onProgress: Mp4ZipCopyProgressReporter;
}

export type {Mp4ZipCopyOptions, Mp4ZipCopyProgressReporter};
