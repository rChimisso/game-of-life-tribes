/**
 * Download form value.
 *
 * @interface DownloadFormValue
 * @typedef {DownloadFormValue}
 */
export interface DownloadFormValue {
  /**
   * Selected output formats.
   *
   * @type {{saves: boolean; metrics: boolean; png: boolean; mp4: boolean}}
   */
  outputs: {
    saves: boolean;
    metrics: boolean;
    png: boolean;
    mp4: boolean;
  };
  /**
   * Selected frame range.
   *
   * @type {{allFrames: boolean; startFrame: number | null; endFrame: number | null}}
   */
  selection: {
    allFrames: boolean;
    startFrame: number | null;
    endFrame: number | null;
  };
  /**
   * MP4 export settings.
   *
   * @type {{fps: number | null; bitrateMbps: number | null}}
   */
  mp4Settings: {
    fps: number | null;
    bitrateMbps: number | null;
  };
  /**
   * Whether compressed recording chunks are exported.
   *
   * @type {boolean}
   */
  forceChunkDownload: boolean;
}
