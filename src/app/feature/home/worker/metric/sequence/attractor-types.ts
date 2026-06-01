import {AttractorEpisode} from '../core/offline-types';

/**
 * Compact signature used for bounded attractor detection.
 *
 * @interface AttractorFrameSignature
 * @typedef {AttractorFrameSignature}
 */
export interface AttractorFrameSignature {
  /**
   * Frame generation number.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Compact state hash for the frame.
   *
   * @type {number}
   */
  hash: number;
  /**
   * Population counts by tribe index.
   *
   * @type {number[]}
   */
  population: number[];
  /**
   * Live cell count.
   *
   * @type {number}
   */
  aliveCells: number;
  /**
   * Dead cell count.
   *
   * @type {number}
   */
  deadCells: number;
  /**
   * Adjacent edges with matching cell state.
   *
   * @type {number}
   */
  sameStateContactEdges: number;
  /**
   * Adjacent edges with differing cell state.
   *
   * @type {number}
   */
  crossStateContactEdges: number;
}

/**
 * Active attractor candidate.
 *
 * @interface ActiveAttractor
 * @typedef {ActiveAttractor}
 */
export interface ActiveAttractor {
  /**
   * Generation where the attractor candidate starts.
   *
   * @type {number}
   */
  startGeneration: number;
  /**
   * First generation that repeated a previous signature.
   *
   * @type {number}
   */
  firstRepeatGeneration: number;
  /**
   * Orbit period length in generations.
   *
   * @type {number}
   */
  orbitPeriodLength: number;
  /**
   * Frame signatures that make up the orbit.
   *
   * @type {AttractorFrameSignature[]}
   */
  orbitSignatures: AttractorFrameSignature[];
  /**
   * Last generation matching the active orbit.
   *
   * @type {number}
   */
  lastMatchingGeneration: number;
}

/**
 * Attractor tracker state.
 *
 * @interface AttractorTracker
 * @typedef {AttractorTracker}
 */
export interface AttractorTracker {
  /**
   * First generation observed by the tracker.
   *
   * @type {(number | null)}
   */
  generationStart: number | null;
  /**
   * Last generation observed by the tracker.
   *
   * @type {(number | null)}
   */
  lastGeneration: number | null;
  /**
   * Number of non-contiguous generation gaps encountered.
   *
   * @type {number}
   */
  generationGapCount: number;
  /**
   * Pending frame indexes grouped by frame hash.
   *
   * @type {Map<number, number[]>}
   */
  candidatesByHash: Map<number, number[]>;
  /**
   * Recent signatures still available for attractor matching.
   *
   * @type {AttractorFrameSignature[]}
   */
  pendingFrames: AttractorFrameSignature[];
  /**
   * Currently active attractor candidate.
   *
   * @type {(ActiveAttractor | null)}
   */
  active: ActiveAttractor | null;
  /**
   * Completed attractor episodes.
   *
   * @type {AttractorEpisode[]}
   */
  attractors: AttractorEpisode[];
}
