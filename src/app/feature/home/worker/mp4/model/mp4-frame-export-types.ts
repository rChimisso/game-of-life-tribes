import type {Output} from 'mediabunny';

import {SupportedMp4VideoConfig} from './mp4-avc-types';
import {Mp4OutputSize} from './mp4-types';
import {RecordingFrameSelection} from '../../frame/recording-frame-types';
import {ZipWriter} from '../../zip/zip-writer';
import {Mp4GpuFrameConverter} from '../class/mp4-gpu-converter';
import {Mp4TempOutput} from '../class/mp4-temp-output';

/**
 * Encoded packets queued before the writer waits for muxer backpressure.
 *
 * @type {number}
 */
export const MP4_PACKET_DRAIN_THRESHOLD = 8;

/**
 * VideoEncoder queue size where frame writes wait for backpressure.
 *
 * @type {number}
 */
export const MP4_ENCODER_QUEUE_HIGH_WATERMARK = 4;

/**
 * VideoEncoder queue size target after backpressure wait.
 *
 * @type {number}
 */
export const MP4_ENCODER_QUEUE_LOW_WATERMARK = 2;

/**
 * MP4 stream target chunk size.
 *
 * @type {number}
 */
export const MP4_STREAM_TARGET_CHUNK_BYTES = 16 * 1024 * 1024;

/**
 * Options for MP4 frame export.
 *
 * @interface Mp4FrameExportOptions
 * @typedef {Mp4FrameExportOptions}
 */
export interface Mp4FrameExportOptions {
  /**
   * MP4 frames per second.
   *
   * @type {number}
   */
  fps: number;
  /**
   * Target MP4 bitrate in bits per second.
   *
   * @type {number}
   */
  bitrate: number;
  /**
   * Returns whether the active download has been cancelled.
   *
   * @type {() => boolean}
   */
  shouldCancel: () => boolean;
  /**
   * Receives visible MP4 status messages.
   *
   * @type {(status: string) => void}
   */
  onStatus: (status: string) => void;
}

/**
 * Resources owned by an MP4 frame export writer.
 *
 * @interface Mp4FrameExportWriterResources
 * @typedef {Mp4FrameExportWriterResources}
 */
export interface Mp4FrameExportWriterResources {
  /**
   * Target ZIP archive.
   *
   * @type {ZipWriter}
   */
  zip: ZipWriter;
  /**
   * Selected frame range.
   *
   * @type {RecordingFrameSelection}
   */
  selection: RecordingFrameSelection;
  /**
   * Output video size.
   *
   * @type {Mp4OutputSize}
   */
  outputSize: Mp4OutputSize;
  /**
   * Supported encoder config.
   *
   * @type {SupportedMp4VideoConfig}
   */
  supportedConfig: SupportedMp4VideoConfig;
  /**
   * Temporary OPFS output.
   *
   * @type {Mp4TempOutput}
   */
  tempOutput: Mp4TempOutput;
  /**
   * GPU frame converter.
   *
   * @type {Mp4GpuFrameConverter}
   */
  converter: Mp4GpuFrameConverter;
  /**
   * MP4 export options.
   *
   * @type {Mp4FrameExportOptions}
   */
  options: Mp4FrameExportOptions;
  /**
   * Mediabunny output.
   *
   * @type {Output}
   */
  output: Output;
}
