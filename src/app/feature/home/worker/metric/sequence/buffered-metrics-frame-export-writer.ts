import {BaseMetricsFrameExportWriter} from './base-metrics-frame-export-writer';
import {assertNotCancelled, METRICS_TEXT_ENCODER} from './export-logic';
import {buildMetricsCsv} from '../core/csv';
import {buildMetricsJson} from '../core/json';
import {OfflineMetricEntry} from '../core/offline-types';

/**
 * In-memory Metrics frame writer.
 *
 * @class BufferedMetricsFrameExportWriter
 * @typedef {BufferedMetricsFrameExportWriter}
 * @extends {BaseMetricsFrameExportWriter}
 */
export class BufferedMetricsFrameExportWriter extends BaseMetricsFrameExportWriter {
  /**
   * Retained metric rows.
   *
   * @private
   * @readonly
   * @type {OfflineMetricEntry[]}
   */
  private readonly metrics: OfflineMetricEntry[] = [];

  /**
   * Stores one computed metric row in memory.
   *
   * @protected
   * @async
   * @param {OfflineMetricEntry} metric computed metric row.
   */
  protected async storeMetric(metric: OfflineMetricEntry): Promise<void> {
    this.metrics.push(metric);
  }

  /**
   * Writes buffered Metrics CSV and JSON entries.
   *
   * @protected
   * @async
   */
  protected async writeOutputs(): Promise<void> {
    this.options.onProgress({percent: 88, status: 'Writing metrics CSV'});
    await this.zip.addEntry('metrics.csv', entry => entry.write(METRICS_TEXT_ENCODER.encode(buildMetricsCsv(this.metrics, this.tribes))));
    assertNotCancelled(this.options);
    this.options.onProgress({percent: 94, status: 'Writing metrics summary'});
    await this.zip.addEntry('metrics.json', entry => entry.write(METRICS_TEXT_ENCODER.encode(buildMetricsJson(this.metrics, {
      cols: this.recording.cols,
      rows: this.recording.rows,
      selectedStartFrame: this.selection.selectedStartFrame,
      selectedEndFrame: this.selection.selectedEndFrame,
      selectedFrameCount: this.selection.framesTotal,
      generationGapCount: this.attractorTracker.generationGapCount,
      attractors: this.attractorTracker.attractors,
      extinctions: this.extinctionTracker.extinctions
    }))));
  }
}
