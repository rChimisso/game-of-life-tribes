import {DEFAULT_LIVE_METRIC_SECTION_SETTINGS, DEFAULT_LIVE_METRICS_SETTINGS, LiveMetricSectionSettings, LiveMetricsSettings} from '../model/metrics';

/**
 * Normalizes partial live metric section settings.
 *
 * @param {(Partial<LiveMetricSectionSettings> | null | undefined)} value
 * @returns {LiveMetricSectionSettings}
 */
export function normalizeLiveMetricSectionSettings(value: Partial<LiveMetricSectionSettings> | null | undefined): LiveMetricSectionSettings {
  return {
    population: typeof value?.population === 'boolean' ? value.population : DEFAULT_LIVE_METRIC_SECTION_SETTINGS.population,
    diversity: typeof value?.diversity === 'boolean' ? value.diversity : DEFAULT_LIVE_METRIC_SECTION_SETTINGS.diversity,
    interfaces: typeof value?.interfaces === 'boolean' ? value.interfaces : DEFAULT_LIVE_METRIC_SECTION_SETTINGS.interfaces
  };
}

/**
 * Normalizes partial live metrics settings.
 *
 * @param {(Partial<LiveMetricsSettings> | null | undefined)} value
 * @returns {LiveMetricsSettings}
 */
export function normalizeLiveMetricsSettings(value: Partial<LiveMetricsSettings> | null | undefined): LiveMetricsSettings {
  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : DEFAULT_LIVE_METRICS_SETTINGS.enabled,
    sections: normalizeLiveMetricSectionSettings(value?.sections)
  };
}
