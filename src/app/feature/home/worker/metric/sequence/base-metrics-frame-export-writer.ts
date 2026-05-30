import {createAttractorTracker, finalizeActiveAttractor, observeAttractorFrame} from './attractor';
import {assertNotCancelled, computeMetricWithFallback, createMetricComputeOptions} from './export-logic';
import {MetricsExportOptions, MetricsFrameExportWriter, MetricsFrameProgressReporter} from './export-types';
import {createExtinctionTracker, finalizeExtinctionTracker, observeExtinctionMetric} from './extinction';
import {RecordingManifest} from '../../../model/recording';
import {PackedRecordedFrame, RecordingFrameSelection} from '../../frame/recording-frame-stream';
import {ZipWriter} from '../../zip/zip-writer';
import {createPreviousOfflineMetricFrame, OfflineMetricsTribe, PreviousOfflineMetricFrame} from '../core/offline';
import {OfflineMetricEntry} from '../core/offline-types';
import {RecordedGpuMetricBackend} from '../gpu/recorded-gpu-metrics';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Shared Metrics writer state and frame processing.
 *
 * @abstract
 * @class BaseMetricsFrameExportWriter
 * @typedef {BaseMetricsFrameExportWriter}
 * @implements {MetricsFrameExportWriter}
 */
abstract class BaseMetricsFrameExportWriter implements MetricsFrameExportWriter {
  /**
   * Attractor episode tracker.
   *
   * @protected
   * @readonly
   * @type {ReturnType<typeof createAttractorTracker>}
   */
  protected readonly attractorTracker = createAttractorTracker();

  /**
   * Extinction episode tracker.
   *
   * @protected
   * @readonly
   * @type {ReturnType<typeof createExtinctionTracker>}
   */
  protected readonly extinctionTracker: ReturnType<typeof createExtinctionTracker>;

  /**
   * Previously processed frame state.
   *
   * @protected
   * @type {(PreviousOfflineMetricFrame | null)}
   */
  protected previous: PreviousOfflineMetricFrame | null = null;

  /**
   * Completed Metrics frame count.
   *
   * @protected
   * @type {number}
   */
  protected metricsFramesCompleted = 0;

  /**
   * Completed Metrics frame count.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get framesCompleted(): number {
    return this.metricsFramesCompleted;
  }

  /**
   * Creates a shared Metrics frame writer.
   *
   * @param {ZipWriter} zip target ZIP writer.
   * @param {Grid & {manifest: RecordingManifest}} recording recording dimensions and manifest.
   * @param {RecordingFrameSelection} selection selected frame range.
   * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
   * @param {MetricsExportOptions} options export options.
   * @param {(RecordedGpuMetricBackend | null)} gpuBackend gpu backend, if available.
   */
  public constructor(
    protected readonly zip: ZipWriter,
    protected readonly recording: Grid & {manifest: RecordingManifest},
    protected readonly selection: RecordingFrameSelection,
    protected readonly tribes: readonly OfflineMetricsTribe[],
    protected readonly options: MetricsExportOptions,
    protected gpuBackend: RecordedGpuMetricBackend | null
  ) {
    this.extinctionTracker = createExtinctionTracker(tribes);
  }

  /**
   * Computes and stores Metrics for one frame.
   *
   * @public
   * @async
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {MetricsFrameProgressReporter} [onProgress] row progress reporter.
   */
  public async writeFrame(frame: PackedRecordedFrame, onProgress?: MetricsFrameProgressReporter): Promise<void> {
    assertNotCancelled(this.options);
    const state = {backend: this.gpuBackend};
    const metric = await computeMetricWithFallback(frame, this.tribes, this.previous, createMetricComputeOptions(this.metricsFramesCompleted, this.selection.framesTotal, this.options, onProgress), state, this.options.onWarning);
    this.gpuBackend = state.backend;
    observeAttractorFrame(this.attractorTracker, frame, metric);
    observeExtinctionMetric(this.extinctionTracker, metric);
    await this.storeMetric(metric);
    this.previous = createPreviousOfflineMetricFrame(frame, metric);
    this.metricsFramesCompleted++;
  }

  /**
   * Writes final Metrics outputs.
   *
   * @public
   * @async
   */
  public async finish(): Promise<void> {
    assertNotCancelled(this.options);
    finalizeActiveAttractor(this.attractorTracker);
    finalizeExtinctionTracker(this.extinctionTracker);
    await this.writeOutputs();
    console.log('[GOLT] Metrics export finished', {
      metricRows: this.metricsFramesCompleted,
      generationGapCount: this.attractorTracker.generationGapCount,
      attractorCount: this.attractorTracker.attractors.length,
      streamEntries: this.options.streamEntries
    });
  }

  /**
   * Releases retained resources.
   *
   * @public
   * @async
   */
  public async dispose(): Promise<void> {
    this.gpuBackend?.dispose();
  }

  /**
   * Stores one computed metric row.
   *
   * @protected
   * @abstract
   * @param {OfflineMetricEntry} metric computed metric row.
   * @returns {Promise<void>} promise resolved after the row is stored.
   */
  protected abstract storeMetric(metric: OfflineMetricEntry): Promise<void>;

  /**
   * Writes final Metrics ZIP outputs.
   *
   * @protected
   * @abstract
   * @returns {Promise<void>} promise resolved after outputs are written.
   */
  protected abstract writeOutputs(): Promise<void>;
}

export {BaseMetricsFrameExportWriter};
