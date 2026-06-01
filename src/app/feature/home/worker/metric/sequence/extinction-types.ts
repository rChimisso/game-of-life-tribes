import {ExtinctionEpisode} from '../core/offline-types';

/**
 * Per-tribe extinction tracker state.
 *
 * @interface TribeExtinctionState
 * @typedef {TribeExtinctionState}
 */
export interface TribeExtinctionState {
  /**
   * Whether this tribe has appeared alive at least once.
   *
   * @type {boolean}
   */
  everAlive: boolean;
  /**
   * Whether this tribe is alive in the current tracked frame.
   *
   * @type {boolean}
   */
  currentlyAlive: boolean;
  /**
   * Generation where the current extinction interval started.
   *
   * @type {(number | null)}
   */
  currentExtinctionStart: number | null;
}

/**
 * Extinction tracker for an offline Metrics export.
 *
 * @interface ExtinctionTracker
 * @typedef {ExtinctionTracker}
 */
export interface ExtinctionTracker {
  /**
   * Per-tribe extinction state keyed by tribe id.
   *
   * @type {Record<string, TribeExtinctionState>}
   */
  states: Record<string, TribeExtinctionState>;
  /**
   * Completed extinction episodes keyed by tribe id.
   *
   * @type {Record<string, ExtinctionEpisode[]>}
   */
  extinctions: Record<string, ExtinctionEpisode[]>;
  /**
   * Last generation observed by the tracker.
   *
   * @type {(number | null)}
   */
  lastGeneration: number | null;
}
