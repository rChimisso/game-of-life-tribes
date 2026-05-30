import {EncodedPacket, EncodedVideoPacketSource, Mp4OutputFormat, Output, StreamTarget} from 'mediabunny';
import type {VideoTrackMetadata} from 'mediabunny';

import {Mp4GpuFrameConverter} from './mp4-gpu-converter';
import {resolveMp4OutputSize} from './mp4-output-size';
import {Mp4TempOutput} from './mp4-temp-output';
import {Mp4FrameExportWriter, Mp4FrameProgressReporter, Mp4OutputSize} from './mp4-types';
import {PackedRecordedFrame, RecordingFrameSelection} from '../frame/recording-frame-stream';
import {ZipWriter} from '../zip/zip-writer';

import {Grid} from '~gol/feature/home/model/grid';
import {Tribe} from '~gol/feature/home/model/rule';

/**
 * H.264/AVC codec strings probed for browser encoder support.
 *
 * @type {readonly string[]}
 */
const AVC_CODEC_CANDIDATES = [
  'avc1.64003D',
  'avc1.64003C',
  'avc1.640034',
  'avc1.640033',
  'avc1.640032',
  'avc1.640029',
  'avc1.640028',
  'avc1.64001F',
  'avc1.4D0029',
  'avc1.4D0028',
  'avc1.42001F'
] as const;

/**
 * Encoded packets queued before the writer waits for muxer backpressure.
 *
 * @type {number}
 */
const MP4_PACKET_DRAIN_THRESHOLD = 8;

/**
 * VideoEncoder queue size where frame writes wait for backpressure.
 *
 * @type {number}
 */
const MP4_ENCODER_QUEUE_HIGH_WATERMARK = 4;

/**
 * VideoEncoder queue size target after backpressure wait.
 *
 * @type {number}
 */
const MP4_ENCODER_QUEUE_LOW_WATERMARK = 2;

/**
 * MP4 stream target chunk size.
 *
 * @type {number}
 */
const MP4_STREAM_TARGET_CHUNK_BYTES = 16 * 1024 * 1024;

/**
 * Options for MP4 frame export.
 *
 * @interface Mp4FrameExportOptions
 * @typedef {Mp4FrameExportOptions}
 */
interface Mp4FrameExportOptions {
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
 * Supported VideoEncoder config result.
 *
 * @interface SupportedMp4VideoConfig
 * @typedef {SupportedMp4VideoConfig}
 */
interface SupportedMp4VideoConfig {
  /**
   * Supported WebCodecs encoder config.
   *
   * @type {VideoEncoderConfig}
   */
  config: VideoEncoderConfig;
  /**
   * Codec string accepted by the browser.
   *
   * @type {string}
   */
  codec: string;
}

/**
 * Resources owned by an MP4 frame export writer.
 *
 * @interface Mp4FrameExportWriterResources
 * @typedef {Mp4FrameExportWriterResources}
 */
interface Mp4FrameExportWriterResources {
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

/**
 * Creates an MP4 frame export writer.
 *
 * @export
 * @async
 * @param {ZipWriter} zip target zip archive.
 * @param {Grid} recording recording dimensions.
 * @param {RecordingFrameSelection} selection selected frame range.
 * @param {readonly Pick<Tribe, 'id' | 'color'>[]} tribes ordered tribe metadata.
 * @param {PackedRecordedFrame} firstFrame first selected frame.
 * @param {Mp4FrameExportOptions} options mp4 export options.
 * @returns {Promise<Mp4FrameExportWriter>} MP4 export writer.
 */
async function createMp4FrameExportWriter(
  zip: ZipWriter,
  recording: Grid,
  selection: RecordingFrameSelection,
  tribes: readonly Pick<Tribe, 'id' | 'color'>[],
  firstFrame: PackedRecordedFrame,
  options: Mp4FrameExportOptions
): Promise<Mp4FrameExportWriter> {
  assertVideoEncoderAvailable();
  const outputSize = resolveMp4OutputSize(recording.cols, recording.rows, true);
  const supportedConfig = await resolveSupportedAvcConfig(outputSize, options);
  const tempOutput = await Mp4TempOutput.create();
  const converter = await Mp4GpuFrameConverter.create(outputSize, tribes, firstFrame);
  const writer = await Mp4FrameExportWriterImpl.create(zip, selection, outputSize, supportedConfig, tempOutput, converter, options);
  console.log('[GOLT] MP4 export started', {
    selectedStartFrame: selection.selectedStartFrame,
    selectedEndFrame: selection.selectedEndFrame,
    selectedFrameCount: selection.framesTotal,
    sourceCols: recording.cols,
    sourceRows: recording.rows,
    outputWidth: outputSize.width,
    outputHeight: outputSize.height,
    xScale: outputSize.xScale,
    yScale: outputSize.yScale,
    fps: options.fps,
    bitrate: options.bitrate,
    codec: supportedConfig.codec,
    estimatedDurationSeconds: selection.framesTotal / options.fps,
    estimatedEncodedBytes: Math.round((selection.framesTotal / options.fps) * (options.bitrate / 8)),
    rawOutputRgbaBytesPerFrame: outputSize.width * outputSize.height * 4
  });
  return writer;
}

/**
 * MP4 frame export writer implementation.
 *
 * @class Mp4FrameExportWriterImpl
 * @typedef {Mp4FrameExportWriterImpl}
 * @implements {Mp4FrameExportWriter}
 */
class Mp4FrameExportWriterImpl implements Mp4FrameExportWriter {
  /**
   * Encoded packet source used by Mediabunny.
   *
   * @private
   * @readonly
   * @type {EncodedVideoPacketSource}
   */
  private readonly videoSource = new EncodedVideoPacketSource('avc');

  /**
   * Video frame duration in microseconds.
   *
   * @private
   * @readonly
   * @type {number}
   */
  private readonly frameDurationUs: number;

  /**
   * MP4 keyframe interval in encoded frames.
   *
   * @private
   * @readonly
   * @type {number}
   */
  private readonly keyFrameInterval: number;

  /**
   * WebCodecs encoder.
   *
   * @private
   * @readonly
   * @type {VideoEncoder}
   */
  private readonly encoder: VideoEncoder;

  /**
   * Pending muxer packet additions.
   *
   * @private
   * @type {Promise<void>[]}
   */
  private pendingPacketAdds: Promise<void>[] = [];

  /**
   * Async encoder or packet error.
   *
   * @private
   * @type {(Error | null)}
   */
  private asyncError: Error | null = null;

  /**
   * Encoded frame count.
   *
   * @private
   * @type {number}
   */
  private framesEncoded = 0;

  /**
   * Whether the writer has already finalized.
   *
   * @private
   * @type {boolean}
   */
  private finalized = false;

  /**
   * Whether the writer has been disposed.
   *
   * @private
   * @type {boolean}
   */
  private disposed = false;

  /**
   * Creates an MP4 frame export writer.
   *
   * @param {Mp4FrameExportWriterResources} resources writer resources.
   */
  private constructor(private readonly resources: Mp4FrameExportWriterResources) {
    this.frameDurationUs = Math.max(1, Math.round(1_000_000 / resources.options.fps));
    this.keyFrameInterval = Math.max(1, Math.round(resources.options.fps * 2));
    this.encoder = this.createEncoder();
  }

  /**
   * Creates and starts an MP4 writer.
   *
   * @public
   * @static
   * @async
   * @param {ZipWriter} zip target zip archive.
   * @param {RecordingFrameSelection} selection selected frame range.
   * @param {Mp4OutputSize} outputSize output video size.
   * @param {SupportedMp4VideoConfig} supportedConfig supported encoder config.
   * @param {Mp4TempOutput} tempOutput temporary OPFS MP4 output.
   * @param {Mp4GpuFrameConverter} converter gpu frame converter.
   * @param {Mp4FrameExportOptions} options export options.
   * @returns {Promise<Mp4FrameExportWriterImpl>} started writer.
   */
  public static async create(
    zip: ZipWriter,
    selection: RecordingFrameSelection,
    outputSize: Mp4OutputSize,
    supportedConfig: SupportedMp4VideoConfig,
    tempOutput: Mp4TempOutput,
    converter: Mp4GpuFrameConverter,
    options: Mp4FrameExportOptions
  ): Promise<Mp4FrameExportWriterImpl> {
    const target = new StreamTarget(tempOutput.createWritableStream(), {
      chunked: true,
      chunkSize: MP4_STREAM_TARGET_CHUNK_BYTES
    });
    const output = new Output({
      format: new Mp4OutputFormat({fastStart: false}),
      target
    });
    const writer = new Mp4FrameExportWriterImpl({
      zip,
      selection,
      outputSize,
      supportedConfig,
      tempOutput,
      converter,
      options,
      output
    });
    writer.startOutput();
    await output.start();
    writer.encoder.configure(supportedConfig.config);
    return writer;
  }

  /**
   * Encodes one frame.
   *
   * @public
   * @async
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {Mp4FrameProgressReporter} [onProgress] frame progress reporter.
   */
  public async writeFrame(frame: PackedRecordedFrame, onProgress?: Mp4FrameProgressReporter): Promise<void> {
    this.assertWritable();
    this.assertNotCancelled();
    const timestampUs = this.framesEncoded * this.frameDurationUs;
    const videoFrame = await this.resources.converter.convert(frame, timestampUs, this.frameDurationUs, this.resources.options.shouldCancel);
    this.assertNotCancelled();
    this.encoder.encode(videoFrame, {
      keyFrame: this.framesEncoded % this.keyFrameInterval === 0
    });
    videoFrame.close();
    this.framesEncoded++;
    onProgress?.(1, 1);
    await this.waitForEncoderBackpressure();
    await this.drainPacketsWhenNeeded();
    this.throwAsyncError();
  }

  /**
   * Finalizes the MP4 and writes it into the ZIP.
   *
   * @public
   * @async
   */
  public async finish(): Promise<void> {
    this.assertWritable();
    this.assertNotCancelled();
    this.resources.options.onStatus('Finalizing MP4');
    await this.encoder.flush();
    this.encoder.close();
    await this.drainPackets();
    this.throwAsyncError();
    this.videoSource.close();
    await this.resources.output.finalize();
    this.finalized = true;
    this.assertNotCancelled();
    this.resources.options.onStatus('Writing MP4 to ZIP');
    await this.resources.tempOutput.writeToZip(this.resources.zip, {
      shouldCancel: this.resources.options.shouldCancel,
      onProgress: (bytesWritten, totalBytes) => {
        const progressTotal = Math.max(1, totalBytes);
        this.resources.options.onStatus(`Writing MP4 to ZIP ${formatPercent(bytesWritten / progressTotal)}`);
      }
    });
    console.log('[GOLT] MP4 export finished', {
      framesEncoded: this.framesEncoded,
      selectedFrameCount: this.resources.selection.framesTotal,
      outputWidth: this.resources.outputSize.width,
      outputHeight: this.resources.outputSize.height,
      codec: this.resources.supportedConfig.codec
    });
  }

  /**
   * Releases MP4 resources.
   *
   * @public
   * @async
   */
  public async dispose(): Promise<void> {
    if (!this.disposed) {
      this.disposed = true;
      this.resources.converter.dispose();
      await this.cancelOutputIfNeeded();
      await this.resources.tempOutput.dispose();
    }
  }

  /**
   * Starts the Mediabunny output track and encoder callbacks.
   *
   * @private
   */
  private startOutput(): void {
    const metadata: VideoTrackMetadata = {
      frameRate: this.resources.options.fps,
      maximumPacketCount: this.resources.selection.framesTotal
    };
    this.resources.output.addVideoTrack(this.videoSource, metadata);
    this.encoder.ondequeue = () => {};
  }

  /**
   * Waits for encoder backpressure when the encode queue grows.
   *
   * @private
   * @async
   */
  private async waitForEncoderBackpressure(): Promise<void> {
    if (this.encoder.encodeQueueSize > MP4_ENCODER_QUEUE_HIGH_WATERMARK) {
      await new Promise<void>(resolve => {
        const checkQueue = (): void => {
          if (this.encoder.encodeQueueSize <= MP4_ENCODER_QUEUE_LOW_WATERMARK) {
            resolve();
          } else {
            setTimeout(checkQueue, 0);
          }
        };
        checkQueue();
      });
    }
  }

  /**
   * Drains muxer packet additions when enough are pending.
   *
   * @private
   * @async
   */
  private async drainPacketsWhenNeeded(): Promise<void> {
    if (this.pendingPacketAdds.length >= MP4_PACKET_DRAIN_THRESHOLD) {
      await this.drainPackets();
    }
  }

  /**
   * Waits for all currently pending packet additions.
   *
   * @private
   * @async
   */
  private async drainPackets(): Promise<void> {
    const pending = this.pendingPacketAdds;
    this.pendingPacketAdds = [];
    await Promise.all(pending);
  }

  /**
   * Cancels the Mediabunny output when finalization did not complete.
   *
   * @private
   * @async
   */
  private async cancelOutputIfNeeded(): Promise<void> {
    if (!this.finalized) {
      try {
        this.encoder.close();
      } catch (error) {
        console.warn('[GOLT] Failed to close MP4 encoder during cancellation:', error);
      }
      try {
        await this.resources.output.cancel();
      } catch (error) {
        console.warn('[GOLT] Failed to cancel MP4 output cleanly:', error);
      }
    }
  }

  /**
   * Checks whether this writer can still accept work.
   *
   * @private
   */
  private assertWritable(): void {
    if (this.disposed || this.finalized) {
      throw new Error('MP4 writer is not writable.');
    }
  }

  /**
   * Throws if cancellation was requested.
   *
   * @private
   */
  private assertNotCancelled(): void {
    if (this.resources.options.shouldCancel()) {
      throw new Error('MP4 export cancelled');
    }
  }

  /**
   * Throws an async encoder or muxer error.
   *
   * @private
   */
  private throwAsyncError(): void {
    if (this.asyncError) {
      throw this.asyncError;
    }
  }

  /**
   * Creates the WebCodecs encoder instance.
   *
   * @private
   * @returns {VideoEncoder} video encoder.
   */
  private createEncoder(): VideoEncoder {
    return new VideoEncoder({
      output: (chunk, meta) => {
        const packetAdd = this.videoSource.add(EncodedPacket.fromEncodedChunk(chunk), meta)
          .catch(error => {
            this.asyncError = error instanceof Error ? error : new Error(String(error));
          });
        this.pendingPacketAdds.push(packetAdd);
      },
      error: error => {
        this.asyncError = error;
      }
    });
  }
}

/**
 * Checks that WebCodecs VideoEncoder exists.
 */
function assertVideoEncoderAvailable(): void {
  if (typeof VideoEncoder === 'undefined') {
    console.error('[GOLT] MP4 export requires WebCodecs VideoEncoder, which is unavailable in this browser.');
    throw new Error('MP4 export requires WebCodecs VideoEncoder, which is unavailable in this browser.');
  }
}

/**
 * Resolves a supported H.264/AVC encoder config.
 *
 * @async
 * @param {Mp4OutputSize} outputSize output video size.
 * @param {Mp4FrameExportOptions} options mp4 export options.
 * @returns {Promise<SupportedMp4VideoConfig>} supported config.
 */
async function resolveSupportedAvcConfig(outputSize: Mp4OutputSize, options: Mp4FrameExportOptions): Promise<SupportedMp4VideoConfig> {
  let supported: SupportedMp4VideoConfig | null = null;
  for (const codec of AVC_CODEC_CANDIDATES) {
    const config = createAvcConfig(codec, outputSize, options);
    try {
      const result = await VideoEncoder.isConfigSupported(config);
      if (!supported && result.supported) {
        supported = {
          config: result.config ?? config,
          codec
        };
      }
    } catch (error) {
      console.warn('[GOLT] MP4 AVC support check failed for codec candidate:', codec, error);
    }
  }
  if (!supported) {
    const reason = `H.264/AVC MP4 export is unsupported for ${outputSize.width} x ${outputSize.height} in this browser.`;
    console.error('[GOLT] MP4 export unsupported:', {
      width: outputSize.width,
      height: outputSize.height,
      fps: options.fps,
      bitrate: options.bitrate
    });
    throw new Error(reason);
  }
  return supported;
}

/**
 * Creates one AVC encoder config.
 *
 * @param {string} codec avc codec string.
 * @param {Mp4OutputSize} outputSize output video size.
 * @param {Mp4FrameExportOptions} options mp4 export options.
 * @returns {VideoEncoderConfig} encoder config.
 */
function createAvcConfig(codec: string, outputSize: Mp4OutputSize, options: Mp4FrameExportOptions): VideoEncoderConfig {
  return {
    codec,
    width: outputSize.width,
    height: outputSize.height,
    bitrate: options.bitrate,
    framerate: options.fps,
    avc: {
      format: 'avc'
    },
    hardwareAcceleration: 'prefer-hardware'
  };
}

/**
 * Formats a fraction as an integer percent.
 *
 * @param {number} fraction completed fraction.
 * @returns {string} percent text.
 */
function formatPercent(fraction: number): string {
  return `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
}

export {createMp4FrameExportWriter};

export type {Mp4FrameExportOptions};
