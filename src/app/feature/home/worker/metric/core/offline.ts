import {addPackedRowToHistogram} from './histogram-lookup';
import {FrameMetricStats, OfflineMetricComputeOptions, PreviousOfflineMetricFrame, TransitionAccumulator} from './offline-compute-types';
import {OfflineMetricEntry} from './offline-types';
import {PackedRecordedFrame} from '../../frame/recording-frame-types';
import {decodePackedRow} from '../../snapshot/packing/packed-access';
import {DecodedPackedRow} from '../../snapshot/packing/packed-access-types';

import {GridFormat} from '~gol/feature/home/model/grid-format';
import {DEAD_TRIBE_ID, Tribe} from '~gol/feature/home/model/rule';

/**
 * Default row cadence for yielding during CPU-heavy metric scans.
 *
 * @type {number}
 */
const DEFAULT_METRIC_YIELD_EVERY_ROWS = 128;

/**
 * Scans one packed frame to collect raw offline metric stats.
 *
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
 * @param {number} deadIndex dead tribe index.
 * @param {number} tribeCount known tribe count.
 * @param {OfflineMetricComputeOptions} options compute options.
 * @returns {Promise<FrameMetricStats>} collected frame stats.
 */
async function collectFrameMetricStats(frame: PackedRecordedFrame, previous: PreviousOfflineMetricFrame | null, deadIndex: number, tribeCount: number, options: OfflineMetricComputeOptions): Promise<FrameMetricStats> {
  const counts = new Array<number>(tribeCount).fill(0);
  const frontierCounts = new Array<number>(tribeCount).fill(0);
  const transition = createTransitionAccumulator(previous, frame.generation);
  let currentRow = createMetricRowBuffer(frame.format, frame.cols);
  let nextRow = createMetricRowBuffer(frame.format, frame.cols);
  let scratchRow = createMetricRowBuffer(frame.format, frame.cols);
  const previousRow = transition.exact && previous ? createMetricRowBuffer(previous.format, frame.cols) : null;
  let crossStateContactEdges = 0;

  assertNotCancelled(options);
  if (frame.rows > 0) {
    decodePackedRow(frame.words, frame, frame.format, 0, currentRow);
    decodePackedRow(frame.words, frame, frame.format, frame.rows > 1 ? 1 : 0, nextRow);
  }

  for (let y = 0; y < frame.rows; y++) {
    addPackedRowToHistogram(frame.words, frame, frame.format, y, counts);
    if (previousRow && previous) {
      decodePackedRow(previous.words, frame, previous.format, y, previousRow);
    }
    for (let x = 0; x < frame.cols; x++) {
      const state = currentRow[x]!;
      const right = currentRow[(x + 1) % frame.cols]!;
      const bottom = nextRow[x]!;
      crossStateContactEdges += countCrossStateEdges(frontierCounts, state, right, bottom);
      accumulateTransition(transition, previousRow, state, x, deadIndex);
    }
    if (y < frame.rows - 1) {
      const previousCurrentRow = currentRow;
      currentRow = nextRow;
      nextRow = scratchRow;
      scratchRow = previousCurrentRow;
      decodePackedRow(frame.words, frame, frame.format, (y + 2) % frame.rows, nextRow);
    }
    await maybeYieldMetricScan(y + 1, frame.rows, options);
  }
  return {
    counts,
    frontierCounts,
    crossStateContactEdges,
    transition
  };
}

/**
 * Yields during long metric scans and reports row progress.
 *
 * @async
 * @param {number} rowsProcessed rows scanned so far.
 * @param {number} rowsTotal total rows in the frame.
 * @param {OfflineMetricComputeOptions} options compute options.
 */
async function maybeYieldMetricScan(rowsProcessed: number, rowsTotal: number, options: OfflineMetricComputeOptions): Promise<void> {
  const yieldEveryRows = Math.max(1, options.yieldEveryRows ?? DEFAULT_METRIC_YIELD_EVERY_ROWS);
  const shouldYield = rowsTotal >= yieldEveryRows && (rowsProcessed % yieldEveryRows === 0 || rowsProcessed === rowsTotal);
  if (!shouldYield) {
    return;
  }

  assertNotCancelled(options);
  options.onRowsProcessed?.(rowsProcessed, rowsTotal);
  await yieldToEventLoop();
  assertNotCancelled(options);
}

/**
 * Yields worker execution back to the event loop.
 *
 * @async
 */
async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
}

/**
 * Throws when Metrics computation has been cancelled.
 *
 * @param {OfflineMetricComputeOptions} options compute options.
 */
function assertNotCancelled(options: OfflineMetricComputeOptions): void {
  if (options.shouldCancel()) {
    throw new Error('Metrics computation cancelled');
  }
}

/**
 * Creates a transition accumulator.
 *
 * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
 * @param {number} generation current generation.
 * @returns {TransitionAccumulator} transition accumulator.
 */
function createTransitionAccumulator(previous: PreviousOfflineMetricFrame | null, generation: number): TransitionAccumulator {
  return {
    exact: previous !== null && generation - previous.generation === 1,
    changedCells: 0,
    births: 0,
    deaths: 0,
    tribeSwitches: 0
  };
}

/**
 * Updates transition metrics for one cell.
 *
 * @param {TransitionAccumulator} transition transition accumulator.
 * @param {(DecodedPackedRow | null)} previousRow decoded previous-frame row.
 * @param {number} state current cell state.
 * @param {number} x cell column.
 * @param {number} deadIndex dead tribe index.
 */
function accumulateTransition(transition: TransitionAccumulator, previousRow: DecodedPackedRow | null, state: number, x: number, deadIndex: number): void {
  if (transition.exact && previousRow) {
    const previousState = previousRow[x]!;
    if (previousState !== state) {
      transition.changedCells++;
      if (previousState === deadIndex && state !== deadIndex) {
        transition.births++;
      } else if (previousState !== deadIndex && state === deadIndex) {
        transition.deaths++;
      } else if (previousState !== deadIndex && state !== deadIndex) {
        transition.tribeSwitches++;
      }
    }
  }
}

/**
 * Creates a decoded row buffer sized to the packing format.
 *
 * @param {GridFormat} format packing format.
 * @param {number} cols grid columns.
 * @returns {DecodedPackedRow} decoded row buffer.
 */
function createMetricRowBuffer(format: GridFormat, cols: number): DecodedPackedRow {
  let row: DecodedPackedRow;
  if (format.bitsPerCell <= 8) {
    row = new Uint8Array(cols);
  } else if (format.bitsPerCell <= 16) {
    row = new Uint16Array(cols);
  } else {
    row = new Uint32Array(cols);
  }
  return row;
}

/**
 * Counts cross-state contact edges for one cell.
 *
 * @param {number[]} frontierCounts frontier counts.
 * @param {number} state current cell state.
 * @param {number} right right-neighbor state.
 * @param {number} bottom bottom-neighbor state.
 * @returns {number} number of cross-state edges.
 */
function countCrossStateEdges(frontierCounts: number[], state: number, right: number, bottom: number): number {
  let crossStateContactEdges = 0;
  if (right !== state) {
    crossStateContactEdges++;
    incrementFrontier(frontierCounts, state);
  }
  if (bottom !== state) {
    crossStateContactEdges++;
    incrementFrontier(frontierCounts, state);
  }
  return crossStateContactEdges;
}

/**
 * Increments a frontier count when the state belongs to a known tribe.
 *
 * @param {number[]} frontierCounts frontier counts.
 * @param {number} state cell state.
 */
function incrementFrontier(frontierCounts: number[], state: number): void {
  if (state < frontierCounts.length) {
    frontierCounts[state]!++;
  }
}

/**
 * Builds a population record in tribe order.
 *
 * @param {readonly Tribe[]} tribes ordered tribe metadata.
 * @param {number[]} counts population counts.
 * @returns {Record<string, number>} population record.
 */
function buildPopulationRecord(tribes: readonly Tribe[], counts: number[]): Record<string, number> {
  const population: Record<string, number> = {};
  for (let index = 0; index < tribes.length; index++) {
    population[tribes[index]!.id] = counts[index] ?? 0;
  }
  return population;
}

/**
 * Builds a population delta record in tribe order.
 *
 * @param {readonly Tribe[]} tribes ordered tribe metadata.
 * @param {Record<string, number>} population current population.
 * @param {Record<string, number>} previousPopulation previous population.
 * @returns {Record<string, number>} population delta.
 */
function buildPopulationDelta(tribes: readonly Tribe[], population: Record<string, number>, previousPopulation: Record<string, number>): Record<string, number> {
  const delta: Record<string, number> = {};
  for (const tribe of tribes) {
    delta[tribe.id] = (population[tribe.id] ?? 0) - (previousPopulation[tribe.id] ?? 0);
  }
  return delta;
}

/**
 * Computes diversity metrics among live tribes.
 *
 * @param {number[]} counts population counts.
 * @param {number} deadIndex dead tribe index.
 * @param {number} aliveCells live cell count.
 * @returns {{shannonEntropy: number; simpsonIndex: number}} diversity values.
 */
function computeDiversity(counts: number[], deadIndex: number, aliveCells: number): {shannonEntropy: number; simpsonIndex: number} {
  let shannonEntropy = 0;
  let simpsonSum = 0;
  for (let index = 0; index < counts.length; index++) {
    if (index !== deadIndex && aliveCells > 0) {
      const probability = counts[index]! / aliveCells;
      if (probability > 0) {
        shannonEntropy -= probability * Math.log2(probability);
        simpsonSum += probability * probability;
      }
    }
  }
  return {
    shannonEntropy,
    simpsonIndex: 1 - simpsonSum
  };
}

/**
 * Builds frontier length records for non-dead tribes.
 *
 * @param {readonly Tribe[]} tribes ordered tribe metadata.
 * @param {number[]} frontierCounts frontier counts.
 * @param {number} deadIndex dead tribe index.
 * @returns {Record<string, number>} frontier length record.
 */
function buildFrontierRecord(tribes: readonly Tribe[], frontierCounts: number[], deadIndex: number): Record<string, number> {
  const frontierLength: Record<string, number> = {};
  for (let index = 0; index < tribes.length; index++) {
    if (index !== deadIndex) {
      frontierLength[tribes[index]!.id] = frontierCounts[index] ?? 0;
    }
  }
  return frontierLength;
}

/**
 * Computes one offline Metrics row from a packed recorded frame.
 *
 * @async
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {readonly Tribe[]} tribes ordered tribe metadata.
 * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
 * @param {OfflineMetricComputeOptions} options compute options.
 * @returns {Promise<OfflineMetricEntry>} metric row.
 */
export async function computeOfflineMetricEntryAsync(frame: PackedRecordedFrame, tribes: readonly Tribe[], previous: PreviousOfflineMetricFrame | null, options: OfflineMetricComputeOptions): Promise<OfflineMetricEntry> {
  const deadIndex = tribes.findIndex(tribe => tribe.id === DEAD_TRIBE_ID);
  const stats = await collectFrameMetricStats(frame, previous, deadIndex, tribes.length, options);
  return buildOfflineMetricEntry(frame, tribes, previous, stats, deadIndex);
}

/**
 * Builds one offline Metrics row from aggregate frame stats.
 *
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {readonly Tribe[]} tribes ordered tribe metadata.
 * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
 * @param {FrameMetricStats} stats aggregate frame stats.
 * @param {number} deadIndex dead tribe index.
 * @returns {OfflineMetricEntry} metric row.
 */
export function buildOfflineMetricEntry(frame: PackedRecordedFrame, tribes: readonly Tribe[], previous: PreviousOfflineMetricFrame | null, stats: FrameMetricStats, deadIndex: number): OfflineMetricEntry {
  const totalCells = frame.cols * frame.rows;
  const population = buildPopulationRecord(tribes, stats.counts);
  const populationDelta = previous ? buildPopulationDelta(tribes, population, previous.metric.population) : undefined;
  const deadCells = deadIndex >= 0 ? stats.counts[deadIndex]! : 0;
  const aliveCells = Math.max(0, totalCells - deadCells);
  const totalContactEdges = totalCells * 2;
  const sameStateContactEdges = Math.max(0, totalContactEdges - stats.crossStateContactEdges);
  const diversity = computeDiversity(stats.counts, deadIndex, aliveCells);
  return {
    type: 'metrics',
    generation: frame.generation,
    population,
    populationDelta,
    aliveCells,
    deadCells,
    occupancy: totalCells > 0 ? aliveCells / totalCells : 0,
    shannonEntropy: diversity.shannonEntropy,
    simpsonIndex: diversity.simpsonIndex,
    sameStateContactEdges,
    crossStateContactEdges: stats.crossStateContactEdges,
    sameStateContactFraction: totalContactEdges > 0 ? sameStateContactEdges / totalContactEdges : 0,
    crossStateContactFraction: totalContactEdges > 0 ? stats.crossStateContactEdges / totalContactEdges : 0,
    changedCells: stats.transition.exact ? stats.transition.changedCells : null,
    changedFraction: stats.transition.exact && totalCells > 0 ? stats.transition.changedCells / totalCells : null,
    births: stats.transition.exact ? stats.transition.births : null,
    deaths: stats.transition.exact ? stats.transition.deaths : null,
    tribeSwitches: stats.transition.exact ? stats.transition.tribeSwitches : null,
    netGrowth: previous ? aliveCells - previous.metric.aliveCells : null,
    frontierLength: buildFrontierRecord(tribes, stats.frontierCounts, deadIndex)
  };
}

/**
 * Creates retained previous-frame state for the next metric row.
 *
 * @param {PackedRecordedFrame} frame current packed recorded frame.
 * @param {OfflineMetricEntry} metric current metric row.
 * @returns {PreviousOfflineMetricFrame} retained previous-frame state.
 */
export function createPreviousOfflineMetricFrame(frame: PackedRecordedFrame, metric: OfflineMetricEntry): PreviousOfflineMetricFrame {
  return {
    generation: frame.generation,
    words: new Uint32Array(frame.words),
    format: frame.format,
    metric
  };
}
