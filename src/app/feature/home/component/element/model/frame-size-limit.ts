/**
 * Computed display model for frame size and limit indicators.
 *
 * @interface FrameSizeLimitInfo
 * @typedef {FrameSizeLimitInfo}
 */
export interface FrameSizeLimitInfo {
  /**
   * Raw bytes required by one frame.
   *
   * @type {number}
   */
  frameBytes: number;
  /**
   * Human-readable frame byte size.
   *
   * @type {string}
   */
  formatted: string;
  /**
   * Whether the frame exceeds the recording limit.
   *
   * @type {boolean}
   */
  overRecordingLimit: boolean;
  /**
   * Whether the frame exceeds the absolute allowed limit.
   *
   * @type {boolean}
   */
  overAllowedLimit: boolean;
  /**
   * Display labels for the size details.
   *
   * @type {{bytes: string; recording: string; allowed: string}}
   */
  labels: {
    /**
     * Frame byte-size label.
     *
     * @type {string}
     */
    bytes: string;
    /**
     * Recording-limit label.
     *
     * @type {string}
     */
    recording: string;
    /**
     * Absolute-limit label.
     *
     * @type {string}
     */
    allowed: string;
  };
  /**
   * Visible status title.
   *
   * @type {string}
   */
  title: string;
  /**
   * Detailed tooltip text.
   *
   * @type {string}
   */
  tooltip: string;
}
