/**
 * Live metric section.
 *
 * @export
 * @typedef {LiveMetricSection}
 */
export type LiveMetricSection = 'population' | 'diversity' | 'interfaces';

/**
 * Metric availability status.
 *
 * @export
 * @typedef {MetricAvailabilityStatus}
 */
export type MetricAvailabilityStatus = 'ok' | 'disabled' | 'tooLarge';

/**
 * Metric availability by live section.
 *
 * @export
 * @typedef {MetricAvailability}
 */
export type MetricAvailability = Record<LiveMetricSection, MetricAvailabilityStatus>;

/**
 * Live metric section settings.
 *
 * @export
 * @interface LiveMetricSectionSettings
 * @typedef {LiveMetricSectionSettings}
 */
export interface LiveMetricSectionSettings {
  /**
   * Whether population metrics are enabled.
   *
   * @type {boolean}
   */
  population: boolean;
  /**
   * Whether diversity metrics are enabled.
   *
   * @type {boolean}
   */
  diversity: boolean;
  /**
   * Whether interface metrics are enabled.
   *
   * @type {boolean}
   */
  interfaces: boolean;
}

/**
 * Live metrics settings.
 *
 * @export
 * @interface LiveMetricsSettings
 * @typedef {LiveMetricsSettings}
 */
export interface LiveMetricsSettings {
  /**
   * Whether live metrics are enabled.
   *
   * @type {boolean}
   */
  enabled: boolean;
  /**
   * Enabled live metric sections.
   *
   * @type {LiveMetricSectionSettings}
   */
  sections: LiveMetricSectionSettings;
}

/**
 * Live interface metrics.
 *
 * @export
 * @interface LiveInterfaceMetrics
 * @typedef {LiveInterfaceMetrics}
 */
export interface LiveInterfaceMetrics {
  /**
   * Number of same-state contact edges.
   *
   * @type {number}
   */
  sameStateContactEdges: number;
  /**
   * Number of cross-state contact edges.
   *
   * @type {number}
   */
  crossStateContactEdges: number;
  /**
   * Fraction of same-state contact edges.
   *
   * @type {number}
   */
  sameStateContactFraction: number;
  /**
   * Fraction of cross-state contact edges.
   *
   * @type {number}
   */
  crossStateContactFraction: number;
}

/**
 * Default live metric section settings.
 *
 * @type {LiveMetricSectionSettings}
 */
export const DEFAULT_LIVE_METRIC_SECTION_SETTINGS: LiveMetricSectionSettings = {
  population: true,
  diversity: true,
  interfaces: false
};

/**
 * Default live metrics settings.
 *
 * @type {LiveMetricsSettings}
 */
export const DEFAULT_LIVE_METRICS_SETTINGS: LiveMetricsSettings = {
  enabled: true,
  sections: DEFAULT_LIVE_METRIC_SECTION_SETTINGS
};
