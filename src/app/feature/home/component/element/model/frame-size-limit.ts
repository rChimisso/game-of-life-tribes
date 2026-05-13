/**
 * Computed display model for frame size and limit indicators.
 *
 * @export
 * @interface FrameSizeLimitInfo
 * @typedef {FrameSizeLimitInfo}
 */
export interface FrameSizeLimitInfo {
  frameBytes: number;
  formatted: string;
  overRecordingLimit: boolean;
  overAllowedLimit: boolean;
  labels: {
    bytes: string;
    recording: string;
    allowed: string;
  };
  title: string;
  tooltip: string;
}
