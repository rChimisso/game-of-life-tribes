import {createAttractorTracker, finalizeActiveAttractor, observeAttractorFrame} from './attractor';
import {createExtinctionTracker, finalizeExtinctionTracker, observeExtinctionMetric} from './extinction';
import {DownloadFrameRange} from '../../../model/download';
import {RecordingManifest} from '../../../model/recording';
import {iterateRecordedFrames, resolveRecordingFrameSelection} from '../../frame/recording-frame-stream';
import {ZipWriter} from '../../zip/zip-writer';
import {buildMetricsCsv} from '../core/csv';
import {buildMetricsJson} from '../core/json';
import {computeOfflineMetricEntryAsync, createPreviousOfflineMetricFrame, OfflineMetricComputeOptions, OfflineMetricsTribe, PreviousOfflineMetricFrame} from '../core/offline';
import {OfflineMetricEntry} from '../core/offline-types';
import {RecordedGpuMetricBackend} from '../gpu/recorded-gpu-metrics';

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
  let metricsFramesCompleted = 0;
  let gpuBackend = await createRecordedGpuMetricBackend();

  console.log('[GOLT] Metrics export started', {
    selectedStartFrame: selection.selectedStartFrame,
    selectedEndFrame: selection.selectedEndFrame,
    selectedFrameCount: selection.framesTotal
  });
  try {
    options.onProgress({percent: 0, status: 'Reading recorded frames'});

    for await (const frame of iterateRecordedFrames(recording, frameRange, {
      shouldCancel: options.shouldCancel,
      onProgress: progress => {
        const percent = progress.framesTotal > 0 ? Math.min(80, Math.round((metricsFramesCompleted / progress.framesTotal) * 80)) : 0;
        options.onProgress({
          percent,
          status: 'Computing metrics'
        });
      }
    })) {
      assertNotCancelled(options);
      const completedBeforeFrame = metricsFramesCompleted;
      const computeOptions = {
        shouldCancel: options.shouldCancel,
        onRowsProcessed: (rowsProcessed, rowsTotal) => {
          const frameFraction = rowsTotal > 0 ? rowsProcessed / rowsTotal : 1;
          const percent = selection.framesTotal > 0 ? Math.min(80, Math.round(((completedBeforeFrame + frameFraction) / selection.framesTotal) * 80)) : 0;
          options.onProgress({
            percent,
            status: 'Computing metrics'
          });
        }
      } satisfies OfflineMetricComputeOptions;
      const framePrevious = previous;
      let metric: OfflineMetricEntry;
      try {
        metric = await computeMetricEntry(frame, tribes, framePrevious, computeOptions, gpuBackend);
      } catch (error) {
        console.warn('[GOLT] Recorded GPU Metrics failed; falling back to TypeScript Metrics', error);
        gpuBackend?.dispose();
        gpuBackend = null;
        metric = await computeOfflineMetricEntryAsync(frame, tribes, framePrevious, computeOptions);
      }
      observeAttractorFrame(attractorTracker, frame, metric);
      observeExtinctionMetric(extinctionTracker, metric);
      metrics.push(metric);
      previous = createPreviousOfflineMetricFrame(frame, metric);
      metricsFramesCompleted++;
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
  } finally {
    gpuBackend?.dispose();
  }
}

/**
 * Creates the recorded-frame GPU backend when possible.
 *
 * @async
 * @returns {Promise<(RecordedGpuMetricBackend | null)>} GPU backend or null.
 */
async function createRecordedGpuMetricBackend(): Promise<RecordedGpuMetricBackend | null> {
  try {
    return await RecordedGpuMetricBackend.create();
  } catch (error) {
    console.warn('[GOLT] Recorded GPU Metrics unavailable; using TypeScript Metrics', error);
    return null;
  }
}

/**
 * Computes one metric row with GPU acceleration when available.
 *
 * @async
 * @param {Parameters<typeof computeOfflineMetricEntryAsync>[0]} frame packed recorded frame.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
 * @param {OfflineMetricComputeOptions} options compute options.
 * @param {(RecordedGpuMetricBackend | null)} gpuBackend recorded GPU backend.
 * @returns {Promise<OfflineMetricEntry>} metric row.
 */
async function computeMetricEntry(
  frame: Parameters<typeof computeOfflineMetricEntryAsync>[0],
  tribes: readonly OfflineMetricsTribe[],
  previous: PreviousOfflineMetricFrame | null,
  options: OfflineMetricComputeOptions,
  gpuBackend: RecordedGpuMetricBackend | null
): Promise<OfflineMetricEntry> {
  if (gpuBackend) {
    return gpuBackend.computeFrameMetric(frame, tribes, previous, options);
  }
  return computeOfflineMetricEntryAsync(frame, tribes, previous, options);
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
