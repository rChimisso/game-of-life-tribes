import {AttractorTracker} from './attractor-types';
import {COMPUTING_METRICS_STATUS, METRICS_TEXT_ENCODER, BufferedTextEntryWriter, MetricsExportOptions, MetricsFrameProgressReporter, RecordedGpuMetricBackendState} from './export-types';
import {ExtinctionTracker} from './extinction-types';
import {PackedRecordedFrame, RecordingFrameSelection} from '../../frame/recording-frame-types';
import {ByteSink} from '../../io/model/stream';
import {STREAM_REPACK_BLOCK_BYTES} from '../../snapshot/model/golt-types';
import {computeOfflineMetricEntryAsync} from '../core/offline';
import {OfflineMetricComputeOptions, PreviousOfflineMetricFrame} from '../core/offline-compute-types';
import {OfflineMetricEntry} from '../core/offline-types';
import {RecordedGpuMetricBackend} from '../gpu/recorded-gpu-metrics';

import {Recording} from '~gol/feature/home/model/recording';
import {Tribe} from '~gol/feature/home/model/rule';

/**
 * Logs a GPU Metrics failure with device loss treated as an error.
 *
 * @param {RecordedGpuMetricBackend} backend active GPU backend.
 * @param {unknown} error failure reason.
 */
function logGpuMetricFailure(backend: RecordedGpuMetricBackend, error: unknown): void {
  if (backend.isDeviceLost()) {
    console.error('[GOLT] Recorded GPU Metrics device lost during export; using TypeScript Metrics for remaining frames', error);
  } else {
    console.warn('[GOLT] Recorded GPU Metrics failed; falling back to TypeScript Metrics', error);
  }
}

/**
 * Retires the GPU Metrics backend after fallback becomes permanent.
 *
 * @param {RecordedGpuMetricBackendState} gpuBackend mutable backend holder.
 */
function retireGpuMetricBackend(gpuBackend: RecordedGpuMetricBackendState): void {
  gpuBackend.backend?.dispose();
  gpuBackend.backend = null;
}

/**
 * Creates compute options for one metric frame.
 *
 * @param {number} completedBeforeFrame completed frame count before this frame.
 * @param {number} framesTotal selected frame count.
 * @param {MetricsExportOptions} options export options.
 * @param {MetricsFrameProgressReporter} [onProgress] row progress reporter.
 * @returns {OfflineMetricComputeOptions} compute options.
 */
export function createMetricComputeOptions(completedBeforeFrame: number, framesTotal: number, options: MetricsExportOptions, onProgress?: MetricsFrameProgressReporter): OfflineMetricComputeOptions {
  return {
    shouldCancel: options.shouldCancel,
    onRowsProcessed: (rowsProcessed, rowsTotal) => {
      if (onProgress) {
        onProgress(rowsProcessed, rowsTotal);
      } else {
        const frameFraction = rowsTotal > 0 ? rowsProcessed / rowsTotal : 1;
        const percent = framesTotal > 0 ? Math.min(80, Math.round(((completedBeforeFrame + frameFraction) / framesTotal) * 80)) : 0;
        options.onProgress({
          percent,
          status: COMPUTING_METRICS_STATUS
        });
      }
    }
  };
}

/**
 * Creates a buffered line writer for streamed text entries.
 *
 * @param {ByteSink} sink byte sink.
 * @returns {BufferedTextEntryWriter} buffered line writer.
 */
export function createBufferedTextEntryWriter(sink: ByteSink): BufferedTextEntryWriter {
  let pending = '';
  let pendingBytesEstimate = 0;
  const flush = async(): Promise<void> => {
    if (pending.length > 0) {
      await sink.write(METRICS_TEXT_ENCODER.encode(pending));
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
 * @param {Recording} recording recording dimensions and manifest.
 * @param {RecordingFrameSelection} selection resolved frame selection.
 * @param {AttractorTracker} attractorTracker attractor tracker.
 * @param {ExtinctionTracker} extinctionTracker extinction tracker.
 * @returns {string} JSON document.
 */
export function buildMetricsJsonSummary(
  firstMetric: OfflineMetricEntry | null,
  lastMetric: OfflineMetricEntry | null,
  frameCount: number,
  recording: Recording,
  selection: RecordingFrameSelection,
  attractorTracker: AttractorTracker,
  extinctionTracker: ExtinctionTracker
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
export async function createRecordedGpuMetricBackend(): Promise<RecordedGpuMetricBackend | null> {
  let backend: RecordedGpuMetricBackend | null;
  try {
    backend = await RecordedGpuMetricBackend.create();
  } catch (error) {
    console.warn('[GOLT] Recorded GPU Metrics unavailable; using TypeScript Metrics', error);
    backend = null;
  }
  return backend;
}

/**
 * Computes one metric row and permanently falls back after a GPU failure.
 *
 * @async
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {readonly Tribe[]} tribes ordered tribe metadata.
 * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
 * @param {OfflineMetricComputeOptions} options compute options.
 * @param {RecordedGpuMetricBackendState} gpuBackend recorded GPU backend state.
 * @param {(message: string) => void} onWarning warning receiver.
 * @returns {Promise<OfflineMetricEntry>} metric row.
 */
export async function computeMetricWithFallback(
  frame: PackedRecordedFrame,
  tribes: readonly Tribe[],
  previous: PreviousOfflineMetricFrame | null,
  options: OfflineMetricComputeOptions,
  gpuBackend: RecordedGpuMetricBackendState,
  onWarning: (message: string) => void
): Promise<OfflineMetricEntry> {
  let metric: OfflineMetricEntry | null = null;
  if (gpuBackend.backend) {
    const {backend} = gpuBackend;
    const unsupportedReason = backend.unsupportedReason(frame, tribes, previous);
    if (backend.isDeviceLost()) {
      retireGpuMetricBackend(gpuBackend);
    } else if (!unsupportedReason) {
      try {
        metric = await backend.computeFrameMetric(frame, tribes, previous, options);
      } catch (error) {
        logGpuMetricFailure(backend, error);
        retireGpuMetricBackend(gpuBackend);
      }
    } else {
      const visibleWarning = backend.warnUnsupported(unsupportedReason);
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
 * Checks for a missing OPFS entry error.
 *
 * @param {unknown} error error thrown by OPFS.
 * @returns {boolean} true when the entry was already missing.
 */
export function isMissingOpfsEntry(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

/**
 * Throws when Metrics export cancellation has been requested.
 *
 * @param {MetricsExportOptions} options export options.
 */
export function assertNotCancelled(options: MetricsExportOptions): void {
  if (options.shouldCancel()) {
    throw new Error('Metrics export cancelled');
  }
}
