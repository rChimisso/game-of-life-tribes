import {ExtinctionTracker, TribeExtinctionState} from './extinction-types';
import {DEAD_TRIBE_ID} from '../../../model/rule';
import {OfflineMetricsTribe} from '../core/offline';
import {OfflineMetricEntry} from '../core/offline-types';

/**
 * Creates an extinction tracker for all non-dead tribes.
 *
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @returns {ExtinctionTracker} extinction tracker.
 */
function createExtinctionTracker(tribes: readonly OfflineMetricsTribe[]): ExtinctionTracker {
  const states: Record<string, TribeExtinctionState> = {};
  const extinctions: Record<string, ExtinctionEpisode[]> = {};
  for (const tribe of tribes) {
    if (tribe.id !== DEAD_TRIBE_ID) {
      states[tribe.id] = {
        everAlive: false,
        currentlyAlive: false,
        currentExtinctionStart: null
      };
      extinctions[tribe.id] = [];
    }
  }
  return {
    states,
    extinctions,
    lastGeneration: null
  };
}

/**
 * Observes one metric row and updates extinction episodes.
 *
 * @param {ExtinctionTracker} tracker extinction tracker.
 * @param {OfflineMetricEntry} metric metric row.
 */
function observeExtinctionMetric(tracker: ExtinctionTracker, metric: OfflineMetricEntry): void {
  for (const [tribeId, state] of Object.entries(tracker.states)) {
    const alive = (metric.population[tribeId] ?? 0) > 0;
    if (alive) {
      closeExtinctionEpisode(tracker, state, tribeId, metric.generation);
      state.everAlive = true;
      state.currentlyAlive = true;
    } else if (state.everAlive && state.currentlyAlive) {
      state.currentlyAlive = false;
      state.currentExtinctionStart = metric.generation;
    }
  }
  tracker.lastGeneration = metric.generation;
}

/**
 * Finalizes open extinction episodes at export end.
 *
 * @param {ExtinctionTracker} tracker extinction tracker.
 */
function finalizeExtinctionTracker(tracker: ExtinctionTracker): void {
  for (const [tribeId, state] of Object.entries(tracker.states)) {
    if (state.currentExtinctionStart !== null) {
      tracker.extinctions[tribeId]!.push({
        startGeneration: state.currentExtinctionStart,
        endGeneration: null,
        duration: null
      });
      state.currentExtinctionStart = null;
    }
  }
}

/**
 * Closes the current extinction episode when a tribe reappears.
 *
 * @param {ExtinctionTracker} tracker extinction tracker.
 * @param {TribeExtinctionState} state tribe extinction state.
 * @param {string} tribeId tribe ID.
 * @param {number} generation current generation.
 */
function closeExtinctionEpisode(tracker: ExtinctionTracker, state: TribeExtinctionState, tribeId: string, generation: number): void {
  if (state.currentExtinctionStart !== null) {
    const endGeneration = tracker.lastGeneration ?? generation - 1;
    tracker.extinctions[tribeId]!.push({
      startGeneration: state.currentExtinctionStart,
      endGeneration,
      duration: endGeneration - state.currentExtinctionStart + 1
    });
    state.currentExtinctionStart = null;
  }
}

export {createExtinctionTracker, finalizeExtinctionTracker, observeExtinctionMetric};

export type {ExtinctionTracker} from './extinction-types';
