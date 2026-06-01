import {PackedRecordedFrame} from '../../frame/recording-frame-types';

/**
 * MP4 ZIP entry path.
 *
 * @type {string}
 */
export const MP4_ZIP_ENTRY_PATH = 'simulation.mp4';

/**
 * MP4 output size resolved from source grid dimensions.
 *
 * @interface Mp4OutputSize
 * @typedef {Mp4OutputSize}
 */
export interface Mp4OutputSize {
  /**
   * Source grid columns.
   *
   * @type {number}
   */
  sourceCols: number;
  /**
   * Source grid rows.
   *
   * @type {number}
   */
  sourceRows: number;
  /**
   * Encoded video width.
   *
   * @type {number}
   */
  width: number;
  /**
   * Encoded video height.
   *
   * @type {number}
   */
  height: number;
  /**
   * Source cells represented by one output pixel on the X axis.
   *
   * @type {number}
   */
  xScale: number;
  /**
   * Source cells represented by one output pixel on the Y axis.
   *
   * @type {number}
   */
  yScale: number;
  /**
   * Whether the output width was clamped from the source width.
   *
   * @type {boolean}
   */
  xClamped: boolean;
  /**
   * Whether the output height was clamped from the source height.
   *
   * @type {boolean}
   */
  yClamped: boolean;
}

/**
 * MP4 frame progress callback.
 *
 * @param {number} processed completed units for the current frame operation.
 * @param {number} total total units for the current frame operation.
 */
export type Mp4FrameProgressReporter = (processed: number, total: number) => void;

/**
 * MP4 export writer.
 *
 * @interface Mp4FrameExportWriter
 * @typedef {Mp4FrameExportWriter}
 */
export interface Mp4FrameExportWriter {
  /**
   * Encodes one packed recorded frame.
   *
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {Mp4FrameProgressReporter} [onProgress] current-frame progress reporter.
   * @returns {Promise<void>} promise resolved after the frame has been queued.
   */
  writeFrame(frame: PackedRecordedFrame, onProgress?: Mp4FrameProgressReporter): Promise<void>;
  /**
   * Finalizes the MP4 file and writes it to the ZIP archive.
   *
   * @returns {Promise<void>} promise resolved after the MP4 ZIP entry is written.
   */
  finish(): Promise<void>;
  /**
   * Releases encoder, GPU, and OPFS resources.
   *
   * @returns {Promise<void>} promise resolved after resources are released.
   */
  dispose(): Promise<void>;
}
