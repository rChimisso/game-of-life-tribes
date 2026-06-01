import type {Output, StreamTargetChunk} from 'mediabunny';

import {SupportedMp4VideoConfig} from './mp4-avc-types';
import {Mp4OutputSize} from './mp4-types';
import {RecordingFrameSelection, PackedRecordedFrame} from '../../frame/recording-frame-types';
import {ZipWriter} from '../../zip/zip-writer';

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
 * Temporary MP4 output resource used by the writer.
 *
 * @interface Mp4TempOutputResource
 * @typedef {Mp4TempOutputResource}
 */
export interface Mp4TempOutputResource {
  /**
   * Creates the writable stream used by Mediabunny.
   *
   * @returns {WritableStream<StreamTargetChunk>} MP4 byte target stream.
   */
  createWritableStream(): WritableStream<StreamTargetChunk>;
  /**
   * Writes the finalized MP4 file into the ZIP archive.
   *
   * @param {ZipWriter} zip target ZIP archive.
   * @param {{shouldCancel: () => boolean; onProgress: (bytesWritten: number, totalBytes: number) => void}} options zip copy options.
   * @returns {Promise<void>} promise resolved after the MP4 is copied.
   */
  writeToZip(zip: ZipWriter, options: {shouldCancel: () => boolean; onProgress: (bytesWritten: number, totalBytes: number) => void}): Promise<void>;
  /**
   * Releases temporary MP4 resources.
   *
   * @returns {Promise<void>} promise resolved after disposal.
   */
  dispose(): Promise<void>;
}

/**
 * GPU frame converter resource used by the writer.
 *
 * @interface Mp4GpuFrameConverterResource
 * @typedef {Mp4GpuFrameConverterResource}
 */
export interface Mp4GpuFrameConverterResource {
  /**
   * Converts one packed recorded frame to a VideoFrame.
   *
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {number} timestampUs frame timestamp in microseconds.
   * @param {number} durationUs frame duration in microseconds.
   * @param {() => boolean} shouldCancel cancellation predicate.
   * @returns {Promise<VideoFrame>} converted video frame.
   */
  convert(frame: PackedRecordedFrame, timestampUs: number, durationUs: number, shouldCancel: () => boolean): Promise<VideoFrame>;
  /**
   * Releases GPU resources held by the converter.
   */
  dispose(): void;
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
   * @type {Mp4TempOutputResource}
   */
  tempOutput: Mp4TempOutputResource;
  /**
   * GPU frame converter.
   *
   * @type {Mp4GpuFrameConverterResource}
   */
  converter: Mp4GpuFrameConverterResource;
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
