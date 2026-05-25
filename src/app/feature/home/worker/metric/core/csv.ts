import {OfflineMetricsTribe} from './offline';
import {OfflineMetricEntry} from './offline-types';
import {DEAD_TRIBE_ID} from '../../../model/rule';

/**
 * Builds the Metrics CSV document.
 *
 * @export
 * @param {readonly OfflineMetricEntry[]} metrics offline metric rows.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @returns {string} CSV document.
 */
function buildMetricsCsv(metrics: readonly OfflineMetricEntry[], tribes: readonly OfflineMetricsTribe[]): string {
  const populationColumns = tribes.map(tribe => tribe.id);
  const frontierColumns = tribes.filter(tribe => tribe.id !== DEAD_TRIBE_ID).map(tribe => tribe.id);
  const header = [
    'generation',
    ...populationColumns,
    ...populationColumns.map(column => `delta_${column}`),
    'alive_cells',
    'dead_cells',
    'occupancy',
    'shannon_entropy',
    'simpson_index',
    'same_state_contact_edges',
    'cross_state_contact_edges',
    'same_state_contact_fraction',
    'cross_state_contact_fraction',
    'changed_cells',
    'changed_fraction',
    'births',
    'deaths',
    'tribe_switches',
    'net_growth',
    ...frontierColumns.map(column => `frontier_${column}`)
  ];
  const rows = metrics.map(metric => [
    metric.generation,
    ...populationColumns.map(column => metric.population[column] ?? 0),
    ...populationColumns.map(column => metric.populationDelta?.[column] ?? ''),
    metric.aliveCells,
    metric.deadCells,
    metric.occupancy,
    metric.shannonEntropy,
    metric.simpsonIndex,
    metric.sameStateContactEdges,
    metric.crossStateContactEdges,
    metric.sameStateContactFraction,
    metric.crossStateContactFraction,
    csvValue(metric.changedCells),
    csvValue(metric.changedFraction),
    csvValue(metric.births),
    csvValue(metric.deaths),
    csvValue(metric.tribeSwitches),
    csvValue(metric.netGrowth),
    ...frontierColumns.map(column => metric.frontierLength[column] ?? 0)
  ]);
  return [header.map(csvCell).join(','), ...rows.map(row => row.map(csvCell).join(','))].join('\n');
}

/**
 * Converts nullable metric values to CSV cells.
 *
 * @param {(number | null)} value nullable metric value.
 * @returns {(number | string)} csv value.
 */
function csvValue(value: number | null): number | string {
  return value ?? '';
}

/**
 * Escapes one CSV cell.
 *
 * @param {(number | string)} value csv value.
 * @returns {string} escaped cell value.
 */
function csvCell(value: number | string): string {
  const text = String(value);
  return text.includes(',') || text.includes('"') || text.includes('\n') ? `"${text.replaceAll('"', '""')}"` : text;
}

export {buildMetricsCsv};
