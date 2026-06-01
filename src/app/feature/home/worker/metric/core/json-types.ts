import {MetricsJsonSummary} from './offline-types';

/**
 * Metrics JSON metadata supplied by the export pipeline.
 *
 * @typedef {MetricsJsonMetadata}
 */
type MetricsJsonMetadata = Omit<MetricsJsonSummary, 'generationStart' | 'generationEnd' | 'frameCount'>;

export type {MetricsJsonMetadata};
