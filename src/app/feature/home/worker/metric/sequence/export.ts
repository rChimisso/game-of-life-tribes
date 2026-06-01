import {BufferedMetricsFrameExportWriter} from './buffered-metrics-frame-export-writer';
import {COMPUTING_METRICS_STATUS, createRecordedGpuMetricBackend} from './export-logic';
import {CountingMetricsFrameExportWriter, MetricsExportOptions} from './export-types';
import {StreamingMetricsFrameExportWriter} from './streaming-metrics-frame-export-writer';
import {DownloadFrameRange} from '../../../model/download';
import {Recording} from '../../../model/recording';
import {iterateRecordedFrames, resolveRecordingFrameSelection} from '../../frame/recording-frame-stream';
import {RecordingFrameSelection} from '../../frame/recording-frame-types';
import {ZipWriter} from '../../zip/zip-writer';
import {OfflineMetricsTribe} from '../core/offline-compute-types';

/**
 * Writes Metrics CSV and JSON entries to the ZIP archive.
 *
 * @async
 * @param {ZipWriter} zip zip writer.
 * @param {Recording} recording recording dimensions and manifest.
 * @param {(DownloadFrameRange | null)} frameRange selected UI frame range.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {MetricsExportOptions} options export options.
 */
export async function writeMetricsEntries(zip: ZipWriter, recording: Recording, frameRange: DownloadFrameRange | null, tribes: readonly OfflineMetricsTribe[], options: MetricsExportOptions): Promise<void> {
  const selection = resolveRecordingFrameSelection(recording.manifest, frameRange);
  const writer = await createMetricsExportWriter(zip, recording, selection, tribes, options);
  console.log('[GOLT] Metrics export started', {
    selectedStartFrame: selection.selectedStartFrame,
    selectedEndFrame: selection.selectedEndFrame,
    selectedFrameCount: selection.framesTotal,
    streamEntries: options.streamEntries
  });
  options.onProgress({percent: 0, status: 'Reading recorded frames'});
  try {
    for await (const frame of iterateRecordedFrames(recording, frameRange, {
      shouldCancel: options.shouldCancel,
      onProgress: progress => {
        const percent = progress.framesTotal > 0 ? Math.min(80, Math.round((writer.framesCompleted / progress.framesTotal) * 80)) : 0;
        options.onProgress({
          percent,
          status: COMPUTING_METRICS_STATUS
        });
      }
    })) {
      await writer.writeFrame(frame);
    }
    await writer.finish();
    options.onProgress({percent: 100, status: 'Metrics complete'});
  } finally {
    await writer.dispose();
  }
}

/**
 * Creates a per-frame Metrics export writer.
 *
 * @async
 * @param {ZipWriter} zip target ZIP writer.
 * @param {Recording} recording recording dimensions and manifest.
 * @param {RecordingFrameSelection} selection selected frame range.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {MetricsExportOptions} options export options.
 * @returns {Promise<CountingMetricsFrameExportWriter>} Metrics writer.
 */
export async function createMetricsExportWriter(
  zip: ZipWriter,
  recording: Recording,
  selection: RecordingFrameSelection,
  tribes: readonly OfflineMetricsTribe[],
  options: MetricsExportOptions
): Promise<CountingMetricsFrameExportWriter> {
  const gpuBackend = await createRecordedGpuMetricBackend();
  let writer: CountingMetricsFrameExportWriter;
  if (options.streamEntries) {
    writer = await StreamingMetricsFrameExportWriter.create(zip, recording, selection, tribes, options, gpuBackend);
  } else {
    writer = new BufferedMetricsFrameExportWriter(zip, recording, selection, tribes, options, gpuBackend);
  }
  return writer;
}
