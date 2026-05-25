import {OfflineMetricEntry} from './offline-types';
import {GridFormat} from '../../../model/grid-format';
import {DEAD_TRIBE_ID, Tribe} from '../../../model/rule';
import {PackedRecordedFrame} from '../../frame/recording-frame-stream';
import {readPackedCell} from '../../snapshot/packed-access';

/**
 * Previous packed frame retained for transition metrics.
 *
 * @export
 * @interface PreviousOfflineMetricFrame
 * @typedef {PreviousOfflineMetricFrame}
 */
interface PreviousOfflineMetricFrame {
  /**
   * Generation represented by the previous frame.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Previous packed frame words.
   *
   * @type {Uint32Array}
   */
  words: Uint32Array;
  /**
   * Previous frame packing format.
   *
   * @type {GridFormat}
   */
  format: GridFormat;
  /**
   * Previous metric row.
   *
   * @type {OfflineMetricEntry}
   */
  metric: OfflineMetricEntry;
}

/**
 * Offline metrics tribe metadata.
 *
 * @export
 * @typedef {OfflineMetricsTribe}
 */
type OfflineMetricsTribe = Pick<Tribe, 'id' | 'color'>;

/**
 * Computes one offline Metrics row from a packed recorded frame.
 *
 * @export
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
 * @returns {OfflineMetricEntry} metric row.
 */
function computeOfflineMetricEntry(
  frame: PackedRecordedFrame,
  tribes: readonly OfflineMetricsTribe[],
  previous: PreviousOfflineMetricFrame | null
): OfflineMetricEntry {
  const totalCells = frame.cols * frame.rows;
  const deadIndex = tribes.findIndex(tribe => tribe.id === DEAD_TRIBE_ID);
  const stats = collectFrameMetricStats(frame, previous, deadIndex, tribes.length);

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
 * @export
 * @param {PackedRecordedFrame} frame current packed recorded frame.
 * @param {OfflineMetricEntry} metric current metric row.
 * @returns {PreviousOfflineMetricFrame} retained previous-frame state.
 */
function createPreviousOfflineMetricFrame(frame: PackedRecordedFrame, metric: OfflineMetricEntry): PreviousOfflineMetricFrame {
  return {
    generation: frame.generation,
    words: new Uint32Array(frame.words),
    format: frame.format,
    metric
  };
}

/**
 * Transition metric accumulator.
 *
 * @interface TransitionAccumulator
 * @typedef {TransitionAccumulator}
 */
interface TransitionAccumulator {
  /**
   * Whether previous and current generations are consecutive.
   *
   * @type {boolean}
   */
  exact: boolean;
  /**
   * Changed cell count.
   *
   * @type {number}
   */
  changedCells: number;
  /**
   * Birth count.
   *
   * @type {number}
   */
  births: number;
  /**
   * Death count.
   *
   * @type {number}
   */
  deaths: number;
  /**
   * Live tribe switch count.
   *
   * @type {number}
   */
  tribeSwitches: number;
}

/**
 * Raw stats collected while scanning a packed frame.
 *
 * @interface FrameMetricStats
 * @typedef {FrameMetricStats}
 */
interface FrameMetricStats {
  /**
   * Population counts by state index.
   *
   * @type {number[]}
   */
  counts: number[];
  /**
   * Frontier counts by state index.
   *
   * @type {number[]}
   */
  frontierCounts: number[];
  /**
   * Contact edges whose endpoints have different states.
   *
   * @type {number}
   */
  crossStateContactEdges: number;
  /**
   * Transition metrics.
   *
   * @type {TransitionAccumulator}
   */
  transition: TransitionAccumulator;
}

/**
 * Scans one packed frame to collect raw offline metric stats.
 *
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
 * @param {number} deadIndex dead tribe index.
 * @param {number} tribeCount known tribe count.
 * @returns {FrameMetricStats} collected frame stats.
 */
function collectFrameMetricStats(frame: PackedRecordedFrame, previous: PreviousOfflineMetricFrame | null, deadIndex: number, tribeCount: number): FrameMetricStats {
  const counts = new Array<number>(tribeCount).fill(0);
  const frontierCounts = new Array<number>(tribeCount).fill(0);
  const transition = createTransitionAccumulator(previous, frame.generation);
  let crossStateContactEdges = 0;
  for (let y = 0; y < frame.rows; y++) {
    const bottomY = (y + 1) % frame.rows;
    for (let x = 0; x < frame.cols; x++) {
      const state = readPackedCell(frame.words, frame, frame.format, x, y);
      const right = readPackedCell(frame.words, frame, frame.format, (x + 1) % frame.cols, y);
      const bottom = readPackedCell(frame.words, frame, frame.format, x, bottomY);
      countState(counts, state);
      crossStateContactEdges += countCrossStateEdges(frontierCounts, state, right, bottom);
      accumulateTransition(transition, frame, previous, state, x, y, deadIndex);
    }
  }
  return {
    counts,
    frontierCounts,
    crossStateContactEdges,
    transition
  };
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
 * @param {PackedRecordedFrame} frame current frame.
 * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
 * @param {number} state current cell state.
 * @param {number} x cell column.
 * @param {number} y cell row.
 * @param {number} deadIndex dead tribe index.
 */
function accumulateTransition(transition: TransitionAccumulator, frame: PackedRecordedFrame, previous: PreviousOfflineMetricFrame | null, state: number, x: number, y: number, deadIndex: number): void {
  if (transition.exact && previous) {
    const previousState = readPackedCell(previous.words, frame, previous.format, x, y);
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
 * Counts one cell state when it belongs to a known tribe.
 *
 * @param {number[]} counts population counts.
 * @param {number} state cell state.
 */
function countState(counts: number[], state: number): void {
  if (state < counts.length) {
    counts[state]!++;
  }
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
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {number[]} counts population counts.
 * @returns {Record<string, number>} population record.
 */
function buildPopulationRecord(tribes: readonly OfflineMetricsTribe[], counts: number[]): Record<string, number> {
  const population: Record<string, number> = {};
  for (let index = 0; index < tribes.length; index++) {
    population[tribes[index]!.id] = counts[index] ?? 0;
  }
  return population;
}

/**
 * Builds a population delta record in tribe order.
 *
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {Record<string, number>} population current population.
 * @param {Record<string, number>} previousPopulation previous population.
 * @returns {Record<string, number>} population delta.
 */
function buildPopulationDelta(tribes: readonly OfflineMetricsTribe[], population: Record<string, number>, previousPopulation: Record<string, number>): Record<string, number> {
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
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {number[]} frontierCounts frontier counts.
 * @param {number} deadIndex dead tribe index.
 * @returns {Record<string, number>} frontier length record.
 */
function buildFrontierRecord(tribes: readonly OfflineMetricsTribe[], frontierCounts: number[], deadIndex: number): Record<string, number> {
  const frontierLength: Record<string, number> = {};
  for (let index = 0; index < tribes.length; index++) {
    if (index !== deadIndex) {
      frontierLength[tribes[index]!.id] = frontierCounts[index] ?? 0;
    }
  }
  return frontierLength;
}

export {computeOfflineMetricEntry, createPreviousOfflineMetricFrame};

export type {OfflineMetricsTribe, PreviousOfflineMetricFrame};
