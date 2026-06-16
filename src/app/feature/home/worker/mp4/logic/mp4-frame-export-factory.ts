import {assertVideoEncoderAvailable, resolveSupportedAvcConfig} from './mp4-avc-config';
import {Mp4FrameExportWriterImpl} from './mp4-frame-export-writer';
import {Mp4GpuFrameConverter} from './mp4-gpu-converter';
import {resolveMp4OutputSize} from './mp4-output-size';
import {Mp4TempOutput} from './mp4-temp-output';
import {RecordingFrameSelection, PackedRecordedFrame} from '../../frame/recording-frame-types';
import {ZipWriter} from '../../zip/zip-writer';
import {Mp4FrameExportOptions} from '../model/mp4-frame-export-types';
import {Mp4FrameExportWriter} from '../model/mp4-types';

import {Grid} from '~gol/feature/home/model/grid';
import {Tribe} from '~gol/feature/home/model/rule';

/**
 * Creates an MP4 frame export writer.
 *
 * @async
 * @param {ZipWriter} zip target zip archive.
 * @param {Grid} recording recording dimensions.
 * @param {RecordingFrameSelection} selection selected frame range.
 * @param {readonly Tribe[]} tribes ordered tribe metadata.
 * @param {PackedRecordedFrame} firstFrame first selected frame.
 * @param {Mp4FrameExportOptions} options mp4 export options.
 * @returns {Promise<Mp4FrameExportWriter>} MP4 export writer.
 */
export async function createMp4FrameExportWriter(zip: ZipWriter, recording: Grid, selection: RecordingFrameSelection, tribes: readonly Tribe[], firstFrame: PackedRecordedFrame, options: Mp4FrameExportOptions): Promise<Mp4FrameExportWriter> {
  assertVideoEncoderAvailable();
  const initialOutputSize = resolveMp4OutputSize(recording.cols, recording.rows, true);
  const supportedConfig = await resolveSupportedAvcConfig(initialOutputSize, options);
  const {outputSize} = supportedConfig;
  const tempOutput = await Mp4TempOutput.create();
  const converter = await Mp4GpuFrameConverter.create(outputSize, tribes, firstFrame, options.exportFrameOrigin ?? null);
  const writer = await Mp4FrameExportWriterImpl.create(zip, selection, outputSize, supportedConfig, tempOutput, converter, options);
  console.log('[GOLT] MP4 export started', {
    selectedStartFrame: selection.selectedStartFrame,
    selectedEndFrame: selection.selectedEndFrame,
    selectedFrameCount: selection.framesTotal,
    sourceCols: recording.cols,
    sourceRows: recording.rows,
    exportFrameOrigin: options.exportFrameOrigin ?? null,
    outputWidth: outputSize.width,
    outputHeight: outputSize.height,
    xScale: outputSize.xScale,
    yScale: outputSize.yScale,
    fps: options.fps,
    bitrate: options.bitrate,
    codec: supportedConfig.codec,
    profile: supportedConfig.profile,
    level: supportedConfig.level,
    estimatedDurationSeconds: selection.framesTotal / options.fps,
    estimatedEncodedBytes: Math.round((selection.framesTotal / options.fps) * (options.bitrate / 8)),
    rawOutputRgbaBytesPerFrame: outputSize.width * outputSize.height * 4
  });
  return writer;
}
