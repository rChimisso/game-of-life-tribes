import {InteractiveMetricSection} from './types';

import {LiveMetricSectionSettings, MetricAvailability, MetricAvailabilityStatus} from '~gol/feature/home/model/metrics';

/**
 * Maximum value representable by a WebGPU unsigned integer counter.
 *
 * @type {number}
 */
const U32_MAX = 0xffff_ffff;

/**
 * Resolves one metric section availability status.
 *
 * @param {boolean} enabled whether the section is enabled.
 * @param {boolean} safe whether the section can fit in GPU counters.
 * @returns {MetricAvailabilityStatus} availability status.
 */
function availabilityFor(enabled: boolean, safe: boolean): MetricAvailabilityStatus {
  let availability: MetricAvailabilityStatus;
  if (enabled) {
    availability = safe ? 'ok' : 'tooLarge';
  } else {
    availability = 'disabled';
  }
  return availability;
}

/**
 * Checks whether a live metric section is active.
 *
 * @param {readonly InteractiveMetricSection[]} sections active sections.
 * @param {InteractiveMetricSection} section section to find.
 * @returns {boolean} whether the section is active.
 */
export function hasInteractiveMetricSection(sections: readonly InteractiveMetricSection[], section: InteractiveMetricSection): boolean {
  return sections.includes(section);
}

/**
 * Plans live metric availability for the current grid and settings.
 *
 * @param {number} cols grid columns.
 * @param {number} rows grid rows.
 * @param {boolean} liveMetricsEnabled whether live metrics are enabled.
 * @param {LiveMetricSectionSettings} settings live metric section settings.
 * @returns {MetricAvailability} availability by section.
 */
export function planInteractiveMetricAvailability(cols: number, rows: number, liveMetricsEnabled: boolean, settings: LiveMetricSectionSettings): MetricAvailability {
  const totalCells = cols * rows;
  const populationSafe = totalCells <= U32_MAX;
  const interfacesSafe = totalCells * 2 <= U32_MAX;

  return {
    population: availabilityFor(liveMetricsEnabled && settings.population, populationSafe),
    diversity: availabilityFor(liveMetricsEnabled && settings.diversity, populationSafe),
    interfaces: availabilityFor(liveMetricsEnabled && settings.interfaces, interfacesSafe)
  };
}

/**
 * Lists sections that can be computed by the live metrics pipeline.
 *
 * @param {MetricAvailability} availability availability by section.
 * @returns {InteractiveMetricSection[]} active metric sections.
 */
export function activeInteractiveMetricSections(availability: MetricAvailability): InteractiveMetricSection[] {
  const sections: InteractiveMetricSection[] = [];
  if (availability.population === 'ok') {
    sections.push('population');
  }
  if (availability.diversity === 'ok') {
    sections.push('diversity');
  }
  if (availability.interfaces === 'ok') {
    sections.push('interfaces');
  }
  return sections;
}
