import {MetricsJsonMetadata} from './json-types';
import {MetricsJsonSummary, OfflineMetricEntry} from './offline-types';

/**
 * Builds the Metrics JSON summary document.
 *
 * @export
 * @param {readonly OfflineMetricEntry[]} metrics offline metric rows.
 * @param {MetricsJsonMetadata} metadata export metadata.
 * @returns {string} JSON document.
 */
function buildMetricsJson(metrics: readonly OfflineMetricEntry[], metadata: MetricsJsonMetadata): string {
  const first = metrics[0] ?? null;
  const last = metrics[metrics.length - 1] ?? null;
  const summary: MetricsJsonSummary = {
    generationStart: first?.generation ?? null,
    generationEnd: last?.generation ?? null,
    frameCount: metrics.length,
    cols: metadata.cols,
    rows: metadata.rows,
    selectedStartFrame: metadata.selectedStartFrame,
    selectedEndFrame: metadata.selectedEndFrame,
    selectedFrameCount: metadata.selectedFrameCount,
    generationGapCount: metadata.generationGapCount,
    attractors: metadata.attractors,
    extinctions: metadata.extinctions
  };
  return JSON.stringify(summary, null, 2);
}

export {buildMetricsJson};

export type {MetricsJsonMetadata} from './json-types';
