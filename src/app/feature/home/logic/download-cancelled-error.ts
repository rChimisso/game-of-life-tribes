/**
 * Error used to stop download work after cancellation.
 *
 * @class DownloadCancelledError
 * @typedef {DownloadCancelledError}
 * @extends {Error}
 */
export class DownloadCancelledError extends Error {
  /**
   * Creates a download cancellation error.
   */
  public constructor() {
    super('Download cancelled');
    this.name = 'DownloadCancelledError';
  }
}
