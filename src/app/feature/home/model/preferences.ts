import {BrushDensityByFill, BrushFill, BrushShape, DEFAULT_BRUSH_DENSITY_BY_FILL} from './draw-mode';
import {GridTopology} from './grid';
import {LiveMetricSectionSettings} from './metrics';
import {DEAD_TRIBE_ID, TOROIDAL_GRID_TOPOLOGY} from './rule';

/**
 * Home preferences.
 *
 * @interface HomePreferences
 * @typedef {HomePreferences}
 */
export interface HomePreferences {
  /**
   * Draw section preferences.
   *
   * @type {DrawSectionPreferences}
   */
  draw: DrawSectionPreferences;
  /**
   * Speed section preferences.
   *
   * @type {SpeedSectionPreferences}
   */
  speed: SpeedSectionPreferences;
  /**
   * Metrics section preferences.
   *
   * @type {MetricsSectionPreferences}
   */
  metrics: MetricsSectionPreferences;
  /**
   * Grid section preferences.
   *
   * @type {GridSectionPreferences}
   */
  grid: GridSectionPreferences;
}

/**
 * Sidebar preferences.
 *
 * @interface SidebarPreferences
 * @typedef {SidebarPreferences}
 */
export interface SidebarPreferences {
  /**
   * Desktop sidebar width.
   *
   * @type {number}
   */
  sidebarWidth: number;
}

/**
 * Minimum desktop sidebar width in CSS pixels.
 *
 * @type {number}
 */
export const MIN_SIDEBAR_WIDTH = 320;

/**
 * Maximum desktop sidebar width in CSS pixels.
 *
 * @type {number}
 */
export const MAX_SIDEBAR_WIDTH = 600;

/**
 * Home section preferences.
 *
 * @interface HomeSectionPreferences
 * @typedef {HomeSectionPreferences}
 */
export interface HomeSectionPreferences {
  /**
   * Whether the section is expanded.
   *
   * @type {boolean}
   */
  expanded: boolean;
}

/**
 * Playback section preferences.
 *
 * @interface PlaybackSectionPreferences
 * @typedef {PlaybackSectionPreferences}
 */
export interface PlaybackSectionPreferences {
  /**
   * Number of generations stepped by the playback controls.
   *
   * @type {number}
   */
  skipAmount: number;
}

/**
 * Speed section preferences.
 *
 * @interface SpeedSectionPreferences
 * @typedef {SpeedSectionPreferences}
 */
export interface SpeedSectionPreferences {
  /**
   * Target generations per second.
   *
   * @type {number}
   */
  speed: number;
  /**
   * Whether max speed is enabled.
   *
   * @type {boolean}
   */
  maxSpeed: boolean;
  /**
   * Whether recording is enabled.
   *
   * @type {boolean}
   */
  recording: boolean;
  /**
   * Whether live metrics are enabled.
   *
   * @type {boolean}
   */
  liveMetricsEnabled: boolean;
}

/**
 * Metrics section preferences.
 *
 * @interface MetricsSectionPreferences
 * @typedef {MetricsSectionPreferences}
 */
export interface MetricsSectionPreferences {
  /**
   * Live metric subsection settings.
   *
   * @type {LiveMetricSectionSettings}
   */
  liveMetricSettings: LiveMetricSectionSettings;
  /**
   * Whether the population subsection is expanded.
   *
   * @type {boolean}
   */
  populationExpanded: boolean;
  /**
   * Whether the diversity subsection is expanded.
   *
   * @type {boolean}
   */
  diversityExpanded: boolean;
  /**
   * Whether the interfaces subsection is expanded.
   *
   * @type {boolean}
   */
  interfacesExpanded: boolean;
}

/**
 * Draw section preferences.
 *
 * @interface DrawSectionPreferences
 * @typedef {DrawSectionPreferences}
 */
export interface DrawSectionPreferences {
  /**
   * Brush size.
   *
   * @type {number}
   */
  brushSize: number;
  /**
   * Brush shape.
   *
   * @type {BrushShape}
   */
  brushShape: BrushShape;
  /**
   * Brush fill mode.
   *
   * @type {BrushFill}
   */
  brushFill: BrushFill;
  /**
   * Brush density percentages by fill mode.
   *
   * @type {BrushDensityByFill}
   */
  brushDensityByFill: BrushDensityByFill;
}

/**
 * Grid section preferences.
 *
 * @interface GridSectionPreferences
 * @typedef {GridSectionPreferences}
 */
export interface GridSectionPreferences {
  /**
   * Grid topology.
   *
   * @type {GridTopology}
   */
  topology: GridTopology;
  /**
   * Virtual bounded-grid boundary tribe.
   *
   * @type {string}
   */
  boundaryTribe: string;
}

/**
 * Default draw section preferences.
 *
 * @type {DrawSectionPreferences}
 */
export const DEFAULT_DRAW_SECTION_PREFERENCES: DrawSectionPreferences = {
  brushSize: 1,
  brushShape: 'square',
  brushFill: 'full',
  brushDensityByFill: DEFAULT_BRUSH_DENSITY_BY_FILL
};

/**
 * Default speed section preferences.
 *
 * @type {SpeedSectionPreferences}
 */
export const DEFAULT_SPEED_SECTION_PREFERENCES: SpeedSectionPreferences = {
  speed: 1,
  maxSpeed: false,
  recording: false,
  liveMetricsEnabled: true
};

/**
 * Default metrics section preferences.
 *
 * @type {MetricsSectionPreferences}
 */
export const DEFAULT_METRICS_SECTION_PREFERENCES: MetricsSectionPreferences = {
  liveMetricSettings: {
    population: true,
    diversity: true,
    interfaces: false
  },
  populationExpanded: true,
  diversityExpanded: true,
  interfacesExpanded: true
};

/**
 * Default grid section preferences.
 *
 * @type {GridSectionPreferences}
 */
export const DEFAULT_GRID_SECTION_PREFERENCES: GridSectionPreferences = {
  topology: TOROIDAL_GRID_TOPOLOGY,
  boundaryTribe: DEAD_TRIBE_ID
};

/**
 * Default home preferences.
 *
 * @type {HomePreferences}
 */
export const DEFAULT_HOME_PREFERENCES: HomePreferences = {
  draw: DEFAULT_DRAW_SECTION_PREFERENCES,
  speed: DEFAULT_SPEED_SECTION_PREFERENCES,
  metrics: DEFAULT_METRICS_SECTION_PREFERENCES,
  grid: DEFAULT_GRID_SECTION_PREFERENCES
};

/**
 * Default sidebar preferences.
 *
 * @type {SidebarPreferences}
 */
export const DEFAULT_SIDEBAR_PREFERENCES: SidebarPreferences = {
  sidebarWidth: MIN_SIDEBAR_WIDTH
};
