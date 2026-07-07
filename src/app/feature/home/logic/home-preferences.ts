import {clampBrushDensity} from './brush-density';
import {normalizeBrushSize} from './brush-size';
import {normalizeLiveMetricSectionSettings} from './metric-settings';
import {BRUSH_FILL_VALUES, BRUSH_SHAPE_VALUES, BrushDensityByFill} from '../model/draw-mode';
import {DrawSectionPreferences, GridSectionPreferences, MetricsSectionPreferences, SpeedSectionPreferences} from '../model/preferences';
import {GRID_TOPOLOGY_VALUES} from '../model/rule';

/**
 * Normalizes persisted brush densities.
 *
 * @param {(Partial<BrushDensityByFill> | undefined)} stored stored brush densities.
 * @param {BrushDensityByFill} defaults default brush densities.
 * @returns {BrushDensityByFill} normalized brush densities.
 */
function normalizeBrushDensityByFill(stored: Partial<BrushDensityByFill> | undefined, defaults: BrushDensityByFill): BrushDensityByFill {
  const normalizedStored = stored ?? {};
  return {
    full: typeof normalizedStored.full === 'number' ? clampBrushDensity(normalizedStored.full) : defaults.full,
    spray: typeof normalizedStored.spray === 'number' ? clampBrushDensity(normalizedStored.spray) : defaults.spray,
    outline: typeof normalizedStored.outline === 'number' ? clampBrushDensity(normalizedStored.outline) : defaults.outline
  };
}

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
    brushSize: typeof normalizedStored.brushSize === 'number' ? normalizeBrushSize(normalizedStored.brushSize) : defaults.brushSize,
    brushShape: normalizedStored.brushShape && BRUSH_SHAPE_VALUES.includes(normalizedStored.brushShape) ? normalizedStored.brushShape : defaults.brushShape,
    brushFill: normalizedStored.brushFill && BRUSH_FILL_VALUES.includes(normalizedStored.brushFill) ? normalizedStored.brushFill : defaults.brushFill,
    brushDensityByFill: normalizeBrushDensityByFill(normalizedStored.brushDensityByFill, defaults.brushDensityByFill)
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

/**
 * Normalizes persisted grid-section preferences.
 *
 * @param {(Partial<GridSectionPreferences> | undefined)} stored stored preferences.
 * @param {GridSectionPreferences} defaults default preferences.
 * @returns {GridSectionPreferences} normalized preferences.
 */
export function normalizeGridSectionPreferences(stored: Partial<GridSectionPreferences> | undefined, defaults: GridSectionPreferences): GridSectionPreferences {
  const normalizedStored = stored ?? {};
  return {
    topology: normalizedStored.topology && GRID_TOPOLOGY_VALUES.includes(normalizedStored.topology) ? normalizedStored.topology : defaults.topology,
    boundaryTribe: typeof normalizedStored.boundaryTribe === 'string' && normalizedStored.boundaryTribe.length > 0 ? normalizedStored.boundaryTribe : defaults.boundaryTribe
  };
}
