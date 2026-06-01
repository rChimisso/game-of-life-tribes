/**
 * Completed snapshot save output.
 *
 * @interface SnapshotSaveOutput
 * @typedef {SnapshotSaveOutput}
 */
export interface SnapshotSaveOutput {
  /**
   * User-visible download filename.
   *
   * @type {string}
   */
  filename: string;
  /**
   * Snapshot file data.
   *
   * @type {Blob}
   */
  blob: Blob;
}
