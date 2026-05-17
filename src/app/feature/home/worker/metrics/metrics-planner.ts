import {LiveMetricSectionSettings, MetricAvailability, MetricAvailabilityStatus} from '../../model/metrics';
import {InteractiveMetricSection} from './metrics-types';

const U32_MAX = 0xffff_ffff;

export function hasInteractiveMetricSection(sections: readonly InteractiveMetricSection[], section: InteractiveMetricSection): boolean {
  return sections.includes(section);
}

function availabilityFor(enabled: boolean, safe: boolean): MetricAvailabilityStatus {
  if (!enabled) {
    return 'disabled';
  }
  return safe ? 'ok' : 'tooLarge';
}

export function planInteractiveMetricAvailability(
  cols: number,
  rows: number,
  liveMetricsEnabled: boolean,
  settings: LiveMetricSectionSettings
): MetricAvailability {
  const totalCells = cols * rows;
  const populationSafe = totalCells <= U32_MAX;
  const interfacesSafe = totalCells * 2 <= U32_MAX;

  return {
    population: availabilityFor(liveMetricsEnabled && settings.population, populationSafe),
    diversity: availabilityFor(liveMetricsEnabled && settings.diversity, populationSafe),
    interfaces: availabilityFor(liveMetricsEnabled && settings.interfaces, interfacesSafe)
  };
}

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
