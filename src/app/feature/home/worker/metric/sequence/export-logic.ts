import {createAttractorTracker} from './attractor';
import {MetricsExportOptions, MetricsFrameProgressReporter, RecordedGpuMetricBackendState} from './export-types';
import {createExtinctionTracker} from './extinction';
import {Recording} from '../../../model/recording';
import {RecordingFrameSelection} from '../../frame/recording-frame-types';
import {ByteSink, STREAM_REPACK_BLOCK_BYTES} from '../../snapshot/model/golt-types';
import {computeOfflineMetricEntryAsync} from '../core/offline';
import {OfflineMetricComputeOptions, OfflineMetricsTribe, PreviousOfflineMetricFrame} from '../core/offline-compute-types';
import {OfflineMetricEntry} from '../core/offline-types';
import {RecordedGpuMetricBackend} from '../gpu/recorded-gpu-metrics';

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
 * Text encoder for Metrics ZIP entries.
 *
 * @type {TextEncoder}
 */
export const METRICS_TEXT_ENCODER = new TextEncoder();

/**
 * Status label used while Metrics rows are computed.
 *
 * @type {string}
 */
export const COMPUTING_METRICS_STATUS = 'Computing metrics';

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
 * @returns {{writeLine: (line: string) => Promise<void>; flush: () => Promise<void>}} buffered line writer.
 */
export function createBufferedTextEntryWriter(sink: ByteSink): {writeLine: (line: string) => Promise<void>; flush: () => Promise<void>} {
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
 * @param {ReturnType<typeof createAttractorTracker>} attractorTracker attractor tracker.
 * @param {ReturnType<typeof createExtinctionTracker>} extinctionTracker extinction tracker.
 * @returns {string} JSON document.
 */
export function buildMetricsJsonSummary(
  firstMetric: OfflineMetricEntry | null,
  lastMetric: OfflineMetricEntry | null,
  frameCount: number,
  recording: Recording,
  selection: RecordingFrameSelection,
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
 * @param {Parameters<typeof computeOfflineMetricEntryAsync>[0]} frame packed recorded frame.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
 * @param {OfflineMetricComputeOptions} options compute options.
 * @param {RecordedGpuMetricBackendState} gpuBackend recorded GPU backend state.
 * @param {(message: string) => void} onWarning warning receiver.
 * @returns {Promise<OfflineMetricEntry>} metric row.
 */
export async function computeMetricWithFallback(
  frame: Parameters<typeof computeOfflineMetricEntryAsync>[0],
  tribes: readonly OfflineMetricsTribe[],
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
 * Creates a unique temporary Metrics CSV filename.
 *
 * @returns {string} temporary filename.
 */
export function createUniqueMetricsTempFilename(): string {
  const suffix = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${Date.now()}-${suffix}-metrics.csv`;
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
