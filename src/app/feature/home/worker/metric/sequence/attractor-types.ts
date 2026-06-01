import {AttractorEpisode} from '../core/offline-types';

/**
 * Compact signature used for bounded attractor detection.
 *
 * @interface AttractorFrameSignature
 * @typedef {AttractorFrameSignature}
 */
interface AttractorFrameSignature {
  generation: number;
  hash: number;
  population: number[];
  aliveCells: number;
  deadCells: number;
  sameStateContactEdges: number;
  crossStateContactEdges: number;
}

/**
 * Active attractor candidate.
 *
 * @interface ActiveAttractor
 * @typedef {ActiveAttractor}
 */
interface ActiveAttractor {
  startGeneration: number;
  firstRepeatGeneration: number;
  orbitPeriodLength: number;
  orbitSignatures: AttractorFrameSignature[];
  lastMatchingGeneration: number;
}

/**
 * Attractor tracker state.
 *
 * @interface AttractorTracker
 * @typedef {AttractorTracker}
 */
interface AttractorTracker {
  generationStart: number | null;
  lastGeneration: number | null;
  generationGapCount: number;
  candidatesByHash: Map<number, number[]>;
  pendingFrames: AttractorFrameSignature[];
  active: ActiveAttractor | null;
  attractors: AttractorEpisode[];
}

export type {ActiveAttractor, AttractorFrameSignature, AttractorTracker};
