import {InteractiveMetricSection} from './metrics-types';

export const DEFAULT_INTERACTIVE_METRIC_SECTIONS: readonly InteractiveMetricSection[] = [
  'population',
  'diversity',
  'boundary'
];

export function hasInteractiveMetricSection(sections: readonly InteractiveMetricSection[], section: InteractiveMetricSection): boolean {
  return sections.includes(section);
}
