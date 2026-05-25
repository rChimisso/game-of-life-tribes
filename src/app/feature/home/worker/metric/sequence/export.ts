import {createAttractorTracker, finalizeActiveAttractor, observeAttractorFrame} from './attractor';
import {createExtinctionTracker, finalizeExtinctionTracker, observeExtinctionMetric} from './extinction';
import {DownloadFrameRange} from '../../../model/download';
import {RecordingManifest} from '../../../model/recording';
import {iterateRecordedFrames, resolveRecordingFrameSelection} from '../../frame/recording-frame-stream';
import {ZipWriter} from '../../zip/zip-writer';
import {buildMetricsCsv} from '../core/csv';
import {buildMetricsJson} from '../core/json';
import {computeOfflineMetricEntry, createPreviousOfflineMetricFrame, OfflineMetricsTribe, PreviousOfflineMetricFrame} from '../core/offline';
import {OfflineMetricEntry} from '../core/offline-types';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Metrics export progress update.
 *
 * @export
 * @interface MetricsExportProgress
 * @typedef {MetricsExportProgress}
 */
interface MetricsExportProgress {
  /**
   * Metrics phase percent.
   *
   * @type {number}
   */
  percent: number;
  /**
   * Metrics phase status.
   *
   * @type {string}
   */
  status: string;
}

/**
 * Metrics export options.
 *
 * @export
 * @interface MetricsExportOptions
 * @typedef {MetricsExportOptions}
 */
interface MetricsExportOptions {
  /**
   * Throws or reports cancellation through the caller when true.
   *
   * @type {() => boolean}
   */
  shouldCancel: () => boolean;
  /**
   * Receives determinate metrics progress.
   *
   * @type {(progress: MetricsExportProgress) => void}
   */
  onProgress: (progress: MetricsExportProgress) => void;
}

/**
 * Text encoder for Metrics ZIP entries.
 *
 * @type {TextEncoder}
 */
const TEXT_ENCODER = new TextEncoder();

/**
 * Writes Metrics CSV and JSON entries to the ZIP archive.
 *
 * @export
 * @async
 * @param {ZipWriter} zip zip writer.
 * @param {Grid & {manifest: RecordingManifest}} recording recording dimensions and manifest.
 * @param {(DownloadFrameRange | null)} frameRange selected UI frame range.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {MetricsExportOptions} options export options.
 */
async function writeMetricsEntries(zip: ZipWriter, recording: Grid & {manifest: RecordingManifest}, frameRange: DownloadFrameRange | null, tribes: readonly OfflineMetricsTribe[], options: MetricsExportOptions): Promise<void> {
  const selection = resolveRecordingFrameSelection(recording.manifest, frameRange);
  const attractorTracker = createAttractorTracker();
  const extinctionTracker = createExtinctionTracker(tribes);
  const metrics: OfflineMetricEntry[] = [];
  let previous: PreviousOfflineMetricFrame | null = null;

  console.log('[GOLT] Metrics export started', {
    selectedStartFrame: selection.selectedStartFrame,
    selectedEndFrame: selection.selectedEndFrame,
    selectedFrameCount: selection.framesTotal
  });
  options.onProgress({percent: 0, status: 'Reading recorded frames'});

  for await (const frame of iterateRecordedFrames(recording, frameRange, {
    shouldCancel: options.shouldCancel,
    onProgress: progress => {
      const percent = progress.framesTotal > 0 ? Math.min(80, Math.round((progress.framesProcessed / progress.framesTotal) * 80)) : 0;
      options.onProgress({
        percent,
        status: 'Computing metrics'
      });
    }
  })) {
    assertNotCancelled(options);
    const metric = computeOfflineMetricEntry(frame, tribes, previous);
    observeAttractorFrame(attractorTracker, frame);
    observeExtinctionMetric(extinctionTracker, metric);
    metrics.push(metric);
    previous = createPreviousOfflineMetricFrame(frame, metric);
  }

  assertNotCancelled(options);
  finalizeActiveAttractor(attractorTracker);
  finalizeExtinctionTracker(extinctionTracker);
  options.onProgress({percent: 88, status: 'Writing metrics CSV'});
  await zip.addEntry('metrics.csv', entry => entry.write(TEXT_ENCODER.encode(buildMetricsCsv(metrics, tribes))));
  assertNotCancelled(options);
  options.onProgress({percent: 94, status: 'Writing metrics summary'});
  await zip.addEntry('metrics.json', entry => entry.write(TEXT_ENCODER.encode(buildMetricsJson(metrics, {
    cols: recording.cols,
    rows: recording.rows,
    selectedStartFrame: selection.selectedStartFrame,
    selectedEndFrame: selection.selectedEndFrame,
    selectedFrameCount: selection.framesTotal,
    generationGapCount: attractorTracker.generationGapCount,
    attractors: attractorTracker.attractors,
    extinctions: extinctionTracker.extinctions
  }))));
  console.log('[GOLT] Metrics export finished', {
    metricRows: metrics.length,
    generationGapCount: attractorTracker.generationGapCount,
    attractorCount: attractorTracker.attractors.length
  });
  options.onProgress({percent: 100, status: 'Metrics complete'});
}

/**
 * Throws when Metrics export cancellation has been requested.
 *
 * @param {MetricsExportOptions} options export options.
 */
function assertNotCancelled(options: MetricsExportOptions): void {
  if (options.shouldCancel()) {
    throw new Error('Metrics export cancelled');
  }
}

export {writeMetricsEntries};

export type {MetricsExportOptions, MetricsExportProgress};
