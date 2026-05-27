import {createAttractorTracker, finalizeActiveAttractor, observeAttractorFrame} from './attractor';
import {createExtinctionTracker, finalizeExtinctionTracker, observeExtinctionMetric} from './extinction';
import {DownloadFrameRange} from '../../../model/download';
import {RecordingManifest} from '../../../model/recording';
import {iterateRecordedFrames, resolveRecordingFrameSelection} from '../../frame/recording-frame-stream';
import {STREAM_REPACK_BLOCK_BYTES} from '../../snapshot/packed-repack';
import {ZipEntrySink} from '../../zip/zip-types';
import {ZipWriter} from '../../zip/zip-writer';
import {buildMetricsCsv, buildMetricsCsvHeader, buildMetricsCsvRow} from '../core/csv';
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
  /**
   * Receives visible Metrics export warnings.
   *
   * @type {(message: string) => void}
   */
  onWarning: (message: string) => void;
  /**
   * Streams Metrics output rows instead of retaining them in memory.
   *
   * @type {boolean}
   */
  streamEntries: boolean;
}

/**
 * Mutable GPU backend holder used when a failed backend is retired.
 *
 * @interface RecordedGpuMetricBackendState
 * @typedef {RecordedGpuMetricBackendState}
 */
interface RecordedGpuMetricBackendState {
  /**
   * Active recorded-frame GPU Metrics backend.
   *
   * @type {(RecordedGpuMetricBackend | null)}
   */
  backend: RecordedGpuMetricBackend | null;
}

/**
 * Text encoder for Metrics ZIP entries.
 *
 * @type {TextEncoder}
 */
const TEXT_ENCODER = new TextEncoder();

/**
 * Status label used while Metrics rows are computed.
 *
 * @type {string}
 */
const COMPUTING_METRICS_STATUS = 'Computing metrics';

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
  console.log('[GOLT] Metrics export started', {
    selectedStartFrame: selection.selectedStartFrame,
    selectedEndFrame: selection.selectedEndFrame,
    selectedFrameCount: selection.framesTotal,
    streamEntries: options.streamEntries
  });
  options.onProgress({percent: 0, status: 'Reading recorded frames'});
  if (options.streamEntries) {
    await writeStreamingMetricsEntries(zip, recording, frameRange, tribes, selection, options);
  } else {
    await writeBufferedMetricsEntries(zip, recording, frameRange, tribes, selection, options);
  }
  options.onProgress({percent: 100, status: 'Metrics complete'});
}

/**
 * Writes Metrics entries after retaining rows in memory.
 *
 * @async
 * @param {ZipWriter} zip zip writer.
 * @param {Grid & {manifest: RecordingManifest}} recording recording dimensions and manifest.
 * @param {(DownloadFrameRange | null)} frameRange selected UI frame range.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {ReturnType<typeof resolveRecordingFrameSelection>} selection resolved frame selection.
 * @param {MetricsExportOptions} options export options.
 */
async function writeBufferedMetricsEntries(
  zip: ZipWriter,
  recording: Grid & {manifest: RecordingManifest},
  frameRange: DownloadFrameRange | null,
  tribes: readonly OfflineMetricsTribe[],
  selection: ReturnType<typeof resolveRecordingFrameSelection>,
  options: MetricsExportOptions
): Promise<void> {
  const attractorTracker = createAttractorTracker();
  const extinctionTracker = createExtinctionTracker(tribes);
  const metrics: OfflineMetricEntry[] = [];
  let previous: PreviousOfflineMetricFrame | null = null;
  let metricsFramesCompleted = 0;
  const gpuBackend = {backend: await createRecordedGpuMetricBackend()};
  try {
    for await (const frame of iterateRecordedFrames(recording, frameRange, {
      shouldCancel: options.shouldCancel,
      onProgress: progress => {
        const percent = progress.framesTotal > 0 ? Math.min(80, Math.round((metricsFramesCompleted / progress.framesTotal) * 80)) : 0;
        options.onProgress({
          percent,
          status: COMPUTING_METRICS_STATUS
        });
      }
    })) {
      assertNotCancelled(options);
      const metric = await computeMetricWithFallback(frame, tribes, previous, createMetricComputeOptions(metricsFramesCompleted, selection.framesTotal, options), gpuBackend, options.onWarning);
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
  } finally {
    gpuBackend.backend?.dispose();
  }
}

/**
 * Writes Metrics CSV rows as they are computed.
 *
 * @async
 * @param {ZipWriter} zip zip writer.
 * @param {Grid & {manifest: RecordingManifest}} recording recording dimensions and manifest.
 * @param {(DownloadFrameRange | null)} frameRange selected UI frame range.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {ReturnType<typeof resolveRecordingFrameSelection>} selection resolved frame selection.
 * @param {MetricsExportOptions} options export options.
 */
async function writeStreamingMetricsEntries(
  zip: ZipWriter,
  recording: Grid & {manifest: RecordingManifest},
  frameRange: DownloadFrameRange | null,
  tribes: readonly OfflineMetricsTribe[],
  selection: ReturnType<typeof resolveRecordingFrameSelection>,
  options: MetricsExportOptions
): Promise<void> {
  const attractorTracker = createAttractorTracker();
  const extinctionTracker = createExtinctionTracker(tribes);
  let previous: PreviousOfflineMetricFrame | null = null;
  let metricsFramesCompleted = 0;
  let gpuBackend = await createRecordedGpuMetricBackend();
  let firstMetric: OfflineMetricEntry | null = null;
  let lastMetric: OfflineMetricEntry | null = null;
  try {
    options.onProgress({percent: 0, status: COMPUTING_METRICS_STATUS});
    await zip.addEntry('metrics.csv', async entry => {
      const csvWriter = createBufferedTextEntryWriter(entry);
      await csvWriter.writeLine(buildMetricsCsvHeader(tribes));
      for await (const frame of iterateRecordedFrames(recording, frameRange, {
        shouldCancel: options.shouldCancel,
        onProgress: progress => {
          const percent = progress.framesTotal > 0 ? Math.min(80, Math.round((metricsFramesCompleted / progress.framesTotal) * 80)) : 0;
          options.onProgress({
            percent,
            status: COMPUTING_METRICS_STATUS
          });
        }
      })) {
        assertNotCancelled(options);
        const state = {backend: gpuBackend};
        const metric = await computeMetricWithFallback(frame, tribes, previous, createMetricComputeOptions(metricsFramesCompleted, selection.framesTotal, options), state, options.onWarning);
        gpuBackend = state.backend;
        observeAttractorFrame(attractorTracker, frame, metric);
        observeExtinctionMetric(extinctionTracker, metric);
        firstMetric ??= metric;
        lastMetric = metric;
        previous = createPreviousOfflineMetricFrame(frame, metric);
        metricsFramesCompleted++;
        await csvWriter.writeLine(buildMetricsCsvRow(metric, tribes));
      }
      await csvWriter.flush();
    });
    assertNotCancelled(options);
    finalizeActiveAttractor(attractorTracker);
    finalizeExtinctionTracker(extinctionTracker);
    options.onProgress({percent: 94, status: 'Writing metrics summary'});
    await zip.addEntry('metrics.json', entry => entry.write(TEXT_ENCODER.encode(buildMetricsJsonSummary(firstMetric, lastMetric, metricsFramesCompleted, recording, selection, attractorTracker, extinctionTracker))));
    console.log('[GOLT] Streaming Metrics export finished', {
      metricRows: metricsFramesCompleted,
      generationGapCount: attractorTracker.generationGapCount,
      attractorCount: attractorTracker.attractors.length
    });
  } finally {
    gpuBackend?.dispose();
  }
}

/**
 * Creates compute options for one metric frame.
 *
 * @param {number} completedBeforeFrame completed frame count before this frame.
 * @param {number} framesTotal selected frame count.
 * @param {MetricsExportOptions} options export options.
 * @returns {OfflineMetricComputeOptions} compute options.
 */
function createMetricComputeOptions(completedBeforeFrame: number, framesTotal: number, options: MetricsExportOptions): OfflineMetricComputeOptions {
  return {
    shouldCancel: options.shouldCancel,
    onRowsProcessed: (rowsProcessed, rowsTotal) => {
      const frameFraction = rowsTotal > 0 ? rowsProcessed / rowsTotal : 1;
      const percent = framesTotal > 0 ? Math.min(80, Math.round(((completedBeforeFrame + frameFraction) / framesTotal) * 80)) : 0;
      options.onProgress({
        percent,
        status: COMPUTING_METRICS_STATUS
      });
    }
  };
}

/**
 * Creates a buffered line writer for streamed text ZIP entries.
 *
 * @param {ZipEntrySink} entry zip entry sink.
 * @returns {{writeLine: (line: string) => Promise<void>; flush: () => Promise<void>}} buffered line writer.
 */
function createBufferedTextEntryWriter(entry: ZipEntrySink): {writeLine: (line: string) => Promise<void>; flush: () => Promise<void>} {
  let pending = '';
  let pendingBytesEstimate = 0;
  const flush = async(): Promise<void> => {
    if (pending.length > 0) {
      await entry.write(TEXT_ENCODER.encode(pending));
      pending = '';
      pendingBytesEstimate = 0;
    }
  };
  return {
    writeLine: async line => {
      pending += `${line}\n`;
      pendingBytesEstimate += line.length + 1;
      if (pendingBytesEstimate >= STREAM_REPACK_BLOCK_BYTES) {
        await flush();
      }
    },
    flush
  };
}

/**
 * Builds the streaming Metrics JSON summary document.
 *
 * @param {(OfflineMetricEntry | null)} firstMetric first metric row.
 * @param {(OfflineMetricEntry | null)} lastMetric last metric row.
 * @param {number} frameCount number of streamed metric rows.
 * @param {Grid & {manifest: RecordingManifest}} recording recording dimensions and manifest.
 * @param {ReturnType<typeof resolveRecordingFrameSelection>} selection resolved frame selection.
 * @param {ReturnType<typeof createAttractorTracker>} attractorTracker attractor tracker.
 * @param {ReturnType<typeof createExtinctionTracker>} extinctionTracker extinction tracker.
 * @returns {string} JSON document.
 */
function buildMetricsJsonSummary(
  firstMetric: OfflineMetricEntry | null,
  lastMetric: OfflineMetricEntry | null,
  frameCount: number,
  recording: Grid & {manifest: RecordingManifest},
  selection: ReturnType<typeof resolveRecordingFrameSelection>,
  attractorTracker: ReturnType<typeof createAttractorTracker>,
  extinctionTracker: ReturnType<typeof createExtinctionTracker>
): string {
  return JSON.stringify({
    generationStart: firstMetric?.generation ?? null,
    generationEnd: lastMetric?.generation ?? null,
    frameCount,
    cols: recording.cols,
    rows: recording.rows,
    selectedStartFrame: selection.selectedStartFrame,
    selectedEndFrame: selection.selectedEndFrame,
    selectedFrameCount: selection.framesTotal,
    generationGapCount: attractorTracker.generationGapCount,
    attractors: attractorTracker.attractors,
    extinctions: extinctionTracker.extinctions
  }, null, 2);
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
 * Computes one metric row and permanently falls back after a GPU failure.
 *
 * @async
 * @param {Parameters<typeof computeOfflineMetricEntryAsync>[0]} frame packed recorded frame.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
 * @param {OfflineMetricComputeOptions} options compute options.
 * @param {RecordedGpuMetricBackendState} gpuBackend recorded GPU backend state.
 * @param {(message: string) => void} onWarning warning receiver.
 * @returns {Promise<OfflineMetricEntry>} metric row.
 */
async function computeMetricWithFallback(
  frame: Parameters<typeof computeOfflineMetricEntryAsync>[0],
  tribes: readonly OfflineMetricsTribe[],
  previous: PreviousOfflineMetricFrame | null,
  options: OfflineMetricComputeOptions,
  gpuBackend: RecordedGpuMetricBackendState,
  onWarning: (message: string) => void
): Promise<OfflineMetricEntry> {
  let metric: OfflineMetricEntry | null = null;
  if (gpuBackend.backend) {
    const unsupportedReason = gpuBackend.backend.unsupportedReason(frame, tribes, previous);
    if (!unsupportedReason) {
      try {
        metric = await gpuBackend.backend.computeFrameMetric(frame, tribes, previous, options);
      } catch (error) {
        console.warn('[GOLT] Recorded GPU Metrics failed; falling back to TypeScript Metrics', error);
        gpuBackend.backend.dispose();
        gpuBackend.backend = null;
      }
    } else {
      const visibleWarning = gpuBackend.backend.warnUnsupported(unsupportedReason);
      if (visibleWarning) {
        onWarning(`${unsupportedReason} Using TypeScript Metrics instead.`);
      } else {
        console.warn(`[GOLT] ${unsupportedReason} Using TypeScript Metrics for this frame.`);
      }
    }
  }
  if (metric === null) {
    metric = await computeOfflineMetricEntryAsync(frame, tribes, previous, options);
  }
  return metric;
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
