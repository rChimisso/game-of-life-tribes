export type LiveMetricSection = 'population' | 'diversity' | 'interfaces';

export type MetricAvailabilityStatus = 'ok' | 'disabled' | 'tooLarge';

export type MetricAvailability = Record<LiveMetricSection, MetricAvailabilityStatus>;

export interface LiveMetricSectionSettings {
  population: boolean;
  diversity: boolean;
  interfaces: boolean;
}

export interface LiveMetricsSettings {
  enabled: boolean;
  sections: LiveMetricSectionSettings;
}

export interface LiveInterfaceMetrics {
  boundaryLength: number;
  sameStateContactEdges: number;
  crossStateContactEdges: number;
  sameStateContactFraction: number;
  crossStateContactFraction: number;
}

export const DEFAULT_LIVE_METRIC_SECTION_SETTINGS: LiveMetricSectionSettings = {
  population: true,
  diversity: true,
  interfaces: false
};

export const DEFAULT_LIVE_METRICS_SETTINGS: LiveMetricsSettings = {
  enabled: true,
  sections: DEFAULT_LIVE_METRIC_SECTION_SETTINGS
};
