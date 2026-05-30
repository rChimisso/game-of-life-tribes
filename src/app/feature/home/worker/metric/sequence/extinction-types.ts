import {ExtinctionEpisode} from '../core/offline-types';

/**
 * Per-tribe extinction tracker state.
 *
 * @interface TribeExtinctionState
 * @typedef {TribeExtinctionState}
 */
interface TribeExtinctionState {
  everAlive: boolean;
  currentlyAlive: boolean;
  currentExtinctionStart: number | null;
}

/**
 * Extinction tracker for an offline Metrics export.
 *
 * @interface ExtinctionTracker
 * @typedef {ExtinctionTracker}
 */
interface ExtinctionTracker {
  states: Record<string, TribeExtinctionState>;
  extinctions: Record<string, ExtinctionEpisode[]>;
  lastGeneration: number | null;
}

export type {ExtinctionTracker, TribeExtinctionState};
