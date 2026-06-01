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

/**
 * Compression worker queue status.
 *
 * @interface CompressionStatusMessage
 * @typedef {CompressionStatusMessage}
 */
export interface CompressionStatusMessage {
  /**
   * Compression status message type.
   *
   * @type {'compressionStatus'}
   */
  type: 'compressionStatus';
  /**
   * Number of active compression jobs.
   *
   * @type {number}
   */
  activeJobs: number;
  /**
   * Number of queued compression jobs.
   *
   * @type {number}
   */
  queuedJobs: number;
}

/**
 * Compression worker failed-job completion message.
 *
 * @interface CompressionFailedMessage
 * @typedef {CompressionFailedMessage}
 */
export interface CompressionFailedMessage {
  /**
   * Compression failure message type.
   *
   * @type {'compressionFailed'}
   */
  type: 'compressionFailed';
  /**
   * Chunk filename.
   *
   * @type {string}
   */
  filename: string;
  /**
   * Original raw chunk bytes.
   *
   * @type {number}
   */
  rawBytes: number;
}

/**
 * Download frame range.
 *
 * @interface DownloadFrameRange
 * @typedef {DownloadFrameRange}
 */
export interface DownloadFrameRange {
  /**
   * First selected frame.
   *
   * @type {number}
   */
  startFrame: number;
  /**
   * Last selected frame.
   *
   * @type {number}
   */
  endFrame: number;
}

/**
 * Download request payload.
 *
 * @interface DownloadRequestPayload
 * @typedef {DownloadRequestPayload}
 */
export interface DownloadRequestPayload {
  /**
   * Whether metrics are included.
   *
   * @type {boolean}
   */
  metrics: boolean;
  /**
   * Whether MP4 output is included.
   *
   * @type {boolean}
   */
  mp4: boolean;
  /**
   * Whether PNG frames are included.
   *
   * @type {boolean}
   */
  png: boolean;
  /**
   * Whether save files are included.
   *
   * @type {boolean}
   */
  saves: boolean;
  /**
   * MP4 frames per second.
   *
   * @type {number}
   */
  fps: number;
  /**
   * MP4 bitrate in bits per second.
   *
   * @type {number}
   */
  bitrate: number;
  /**
   * Selected frame range, or null for all frames.
   *
   * @type {(DownloadFrameRange | null)}
   */
  frameRange: DownloadFrameRange | null;
  /**
   * Whether compressed recording chunk export is forced.
   *
   * @type {boolean}
   */
  forceChunkDownload: boolean;
}

/**
 * Download section preferences.
 *
 * @interface DownloadSectionPreferences
 * @typedef {DownloadSectionPreferences}
 */
export interface DownloadSectionPreferences {
  /**
   * Whether metrics are selected.
   *
   * @type {boolean}
   */
  metrics: boolean;
  /**
   * Whether save files are selected.
   *
   * @type {boolean}
   */
  saves: boolean;
  /**
   * Whether MP4 output is selected.
   *
   * @type {boolean}
   */
  mp4: boolean;
  /**
   * Whether PNG output is selected.
   *
   * @type {boolean}
   */
  png: boolean;
  /**
   * Whether all recorded frames are selected.
   *
   * @type {boolean}
   */
  allFrames: boolean;
  /**
   * Whether compressed recording chunks should be exported instead of selected outputs.
   *
   * @type {boolean}
   */
  forceChunkDownload: boolean;
  /**
   * MP4 frames per second.
   *
   * @type {number}
   */
  mp4Fps: number;
  /**
   * MP4 bitrate in megabits per second.
   *
   * @type {number}
   */
  mp4BitrateMbps: number;
  /**
   * Whether the MP4 settings subsection is expanded.
   *
   * @type {boolean}
   */
  mp4SettingsExpanded: boolean;
  /**
   * Whether the selection subsection is expanded.
   *
   * @type {boolean}
   */
  selectionExpanded: boolean;
}

/**
 * Download frame range form value.
 *
 * @interface DownloadFrameRangeFormValue
 * @typedef {DownloadFrameRangeFormValue}
 */
export interface DownloadFrameRangeFormValue {
  /**
   * Whether all recorded frames are selected.
   *
   * @type {boolean}
   */
  allFrames: boolean;
  /**
   * First selected frame.
   *
   * @type {number}
   */
  startFrame: number;
  /**
   * Last selected frame.
   *
   * @type {number}
   */
  endFrame: number;
}

/**
 * Download MP4 settings form value.
 *
 * @interface DownloadMp4SettingsFormValue
 * @typedef {DownloadMp4SettingsFormValue}
 */
export interface DownloadMp4SettingsFormValue {
  /**
   * MP4 frames per second.
   *
   * @type {number}
   */
  mp4Fps: number;
  /**
   * MP4 bitrate in megabits per second.
   *
   * @type {number}
   */
  mp4BitrateMbps: number;
}
