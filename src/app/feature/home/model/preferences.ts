import {BrushFill, BrushShape} from './draw-mode';
import {LiveMetricSectionSettings} from './metrics';

/**
 * Home preferences.
 *
 * @export
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
}

/**
 * Sidebar preferences.
 *
 * @export
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
 * Home section preferences.
 *
 * @export
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
 * @export
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
 * @export
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
 * @export
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
 * @export
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
}

/**
 * Default draw section preferences.
 *
 * @type {DrawSectionPreferences}
 */
export const DEFAULT_DRAW_SECTION_PREFERENCES: DrawSectionPreferences = {
  brushSize: 1,
  brushShape: 'square',
  brushFill: 'full'
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
 * Default home preferences.
 *
 * @type {HomePreferences}
 */
export const DEFAULT_HOME_PREFERENCES: HomePreferences = {
  draw: DEFAULT_DRAW_SECTION_PREFERENCES,
  speed: DEFAULT_SPEED_SECTION_PREFERENCES,
  metrics: DEFAULT_METRICS_SECTION_PREFERENCES
};

/**
 * Default sidebar preferences.
 *
 * @type {SidebarPreferences}
 */
export const DEFAULT_SIDEBAR_PREFERENCES: SidebarPreferences = {
  sidebarWidth: 300
};
