import {normalizeLiveMetricSectionSettings} from './metric-settings';
import {BRUSH_FILL_VALUES, BRUSH_SHAPE_VALUES} from '../model/draw-mode';
import {DrawSectionPreferences, MetricsSectionPreferences, SpeedSectionPreferences} from '../model/preferences';

/**
 * Normalizes persisted draw-section preferences.
 *
 * @param {(Partial<DrawSectionPreferences> | undefined)} stored stored preferences.
 * @param {DrawSectionPreferences} defaults default preferences.
 * @returns {DrawSectionPreferences} normalized preferences.
 */
export function normalizeDrawSectionPreferences(stored: Partial<DrawSectionPreferences> | undefined, defaults: DrawSectionPreferences): DrawSectionPreferences {
  const normalizedStored = stored ?? {};
  return {
    brushSize: typeof normalizedStored.brushSize === 'number' && normalizedStored.brushSize >= 1 ? Math.floor(normalizedStored.brushSize) : defaults.brushSize,
    brushShape: normalizedStored.brushShape && BRUSH_SHAPE_VALUES.includes(normalizedStored.brushShape) ? normalizedStored.brushShape : defaults.brushShape,
    brushFill: normalizedStored.brushFill && BRUSH_FILL_VALUES.includes(normalizedStored.brushFill) ? normalizedStored.brushFill : defaults.brushFill
  };
}

/**
 * Normalizes persisted speed-section preferences.
 *
 * @param {(Partial<SpeedSectionPreferences> | undefined)} stored stored preferences.
 * @param {SpeedSectionPreferences} defaults default preferences.
 * @returns {SpeedSectionPreferences} normalized preferences.
 */
export function normalizeSpeedSectionPreferences(stored: Partial<SpeedSectionPreferences> | undefined, defaults: SpeedSectionPreferences): SpeedSectionPreferences {
  const normalizedStored = stored ?? {};
  return {
    speed: typeof normalizedStored.speed === 'number' && normalizedStored.speed >= 1 ? Math.floor(normalizedStored.speed) : defaults.speed,
    maxSpeed: typeof normalizedStored.maxSpeed === 'boolean' ? normalizedStored.maxSpeed : defaults.maxSpeed,
    recording: typeof normalizedStored.recording === 'boolean' ? normalizedStored.recording : defaults.recording,
    liveMetricsEnabled: typeof normalizedStored.liveMetricsEnabled === 'boolean' ? normalizedStored.liveMetricsEnabled : defaults.liveMetricsEnabled
  };
}

/**
 * Normalizes persisted metrics-section preferences.
 *
 * @param {(Partial<MetricsSectionPreferences> | undefined)} stored stored preferences.
 * @param {MetricsSectionPreferences} defaults default preferences.
 * @returns {MetricsSectionPreferences} normalized preferences.
 */
export function normalizeMetricsSectionPreferences(stored: Partial<MetricsSectionPreferences> | undefined, defaults: MetricsSectionPreferences): MetricsSectionPreferences {
  const normalizedStored = stored ?? {};
  return {
    liveMetricSettings: normalizeLiveMetricSectionSettings(normalizedStored.liveMetricSettings ?? defaults.liveMetricSettings),
    populationExpanded: typeof normalizedStored.populationExpanded === 'boolean' ? normalizedStored.populationExpanded : defaults.populationExpanded,
    diversityExpanded: typeof normalizedStored.diversityExpanded === 'boolean' ? normalizedStored.diversityExpanded : defaults.diversityExpanded,
    interfacesExpanded: typeof normalizedStored.interfacesExpanded === 'boolean' ? normalizedStored.interfacesExpanded : defaults.interfacesExpanded
  };
}
