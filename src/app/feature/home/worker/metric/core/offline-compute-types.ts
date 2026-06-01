import {OfflineMetricEntry} from './offline-types';

import {GridFormat} from '~gol/feature/home/model/grid-format';

/**
 * Previous packed frame retained for transition metrics.
 *
 * @interface PreviousOfflineMetricFrame
 * @typedef {PreviousOfflineMetricFrame}
 */
export interface PreviousOfflineMetricFrame {
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
 * Options for one offline Metrics computation.
 *
 * @interface OfflineMetricComputeOptions
 * @typedef {OfflineMetricComputeOptions}
 */
export interface OfflineMetricComputeOptions {
  /**
   * Returns whether Metrics computation should stop.
   *
   * @type {() => boolean}
   */
  shouldCancel: () => boolean;
  /**
   * Receives row progress for the current frame.
   *
   * @type {(rowsProcessed: number, rowsTotal: number) => void}
   */
  onRowsProcessed?: (rowsProcessed: number, rowsTotal: number) => void;
  /**
   * Number of rows to process before yielding to the event loop.
   *
   * @type {number}
   */
  yieldEveryRows?: number;
}

/**
 * Transition metric accumulator.
 *
 * @interface TransitionAccumulator
 * @typedef {TransitionAccumulator}
 */
export interface TransitionAccumulator {
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
export interface FrameMetricStats {
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
