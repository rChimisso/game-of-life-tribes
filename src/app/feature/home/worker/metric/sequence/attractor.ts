import {PackedRecordedFrame} from '../../frame/recording-frame-stream';
import {finalizeCrc32, updateCrc32} from '../../zip/zip-crc32';
import {AttractorEpisode} from '../core/offline-types';

/**
 * Hash-only pending frame used for bounded attractor detection.
 *
 * @interface PendingAttractorFrame
 * @typedef {PendingAttractorFrame}
 */
interface PendingAttractorFrame {
  /**
   * Generation represented by the frame.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Frame CRC-32 hash.
   *
   * @type {number}
   */
  hash: number;
}

/**
 * Active hash-only attractor candidate.
 *
 * @interface ActiveAttractor
 * @typedef {ActiveAttractor}
 */
interface ActiveAttractor {
  /**
   * First generation in the detected orbit.
   *
   * @type {number}
   */
  startGeneration: number;
  /**
   * First generation that repeated the orbit start.
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
   * Hashes for one orbit.
   *
   * @type {number[]}
   */
  orbitHashes: number[];
  /**
   * Last generation matching the active orbit.
   *
   * @type {number}
   */
  lastMatchingGeneration: number;
}

/**
 * Hash-only attractor tracker state.
 *
 * @export
 * @interface AttractorTracker
 * @typedef {AttractorTracker}
 */
interface AttractorTracker {
  /**
   * First observed generation.
   *
   * @type {(number | null)}
   */
  generationStart: number | null;
  /**
   * Last observed generation.
   *
   * @type {(number | null)}
   */
  lastGeneration: number | null;
  /**
   * Number of non-consecutive generation gaps.
   *
   * @type {number}
   */
  generationGapCount: number;
  /**
   * Candidate frame indexes by CRC-32 hash.
   *
   * @type {Map<number, number[]>}
   */
  candidatesByHash: Map<number, number[]>;
  /**
   * Hash-only candidate frames.
   *
   * @type {PendingAttractorFrame[]}
   */
  pendingFrames: PendingAttractorFrame[];
  /**
   * Active attractor, if one is currently matching.
   *
   * @type {(ActiveAttractor | null)}
   */
  active: ActiveAttractor | null;
  /**
   * Finalized attractor episodes.
   *
   * @type {AttractorEpisode[]}
   */
  attractors: AttractorEpisode[];
}

/**
 * Creates an empty hash-only attractor tracker.
 *
 * @export
 * @returns {AttractorTracker} attractor tracker.
 */
function createAttractorTracker(): AttractorTracker {
  return {
    generationStart: null,
    lastGeneration: null,
    generationGapCount: 0,
    candidatesByHash: new Map<number, number[]>(),
    pendingFrames: [],
    active: null,
    attractors: []
  };
}

/**
 * Observes one frame in the hash-only attractor tracker.
 *
 * @export
 * @param {AttractorTracker} tracker attractor tracker.
 * @param {PackedRecordedFrame} frame packed recorded frame.
 */
function observeAttractorFrame(tracker: AttractorTracker, frame: PackedRecordedFrame): void {
  const hash = hashFrame(frame.packed);
  const {generation} = frame;
  const gapAfterLastFrame = tracker.lastGeneration !== null && generation - tracker.lastGeneration !== 1;
  if (tracker.generationStart === null) {
    tracker.generationStart = generation;
  }
  if (gapAfterLastFrame) {
    tracker.generationGapCount++;
    finalizeActiveAttractor(tracker);
    resetAttractorCandidates(tracker);
  }
  if (tracker.active) {
    updateActiveAttractor(tracker, hash, generation);
  } else {
    detectOrAddCandidate(tracker, hash, generation);
  }
  tracker.lastGeneration = generation;
}

/**
 * Finalizes any active attractor episode.
 *
 * @export
 * @param {AttractorTracker} tracker attractor tracker.
 */
function finalizeActiveAttractor(tracker: AttractorTracker): void {
  const {active} = tracker;
  if (active) {
    const previousAttractor = tracker.attractors[tracker.attractors.length - 1] ?? null;
    tracker.attractors.push({
      periodicOrbitReached: active.orbitPeriodLength > 1,
      attractorClass: active.orbitPeriodLength === 1 ? 'fixed' : 'periodic',
      startGeneration: active.startGeneration,
      firstRepeatGeneration: active.firstRepeatGeneration,
      endGeneration: active.lastMatchingGeneration,
      transientLength: previousAttractor ? active.startGeneration - previousAttractor.endGeneration : active.startGeneration,
      orbitPeriodLength: active.orbitPeriodLength,
      exact: false
    });
    tracker.active = null;
  }
}

/**
 * Updates an active attractor match or restarts detection when the sequence diverges.
 *
 * @param {AttractorTracker} tracker attractor tracker.
 * @param {number} hash current frame hash.
 * @param {number} generation current generation.
 */
function updateActiveAttractor(tracker: AttractorTracker, hash: number, generation: number): void {
  const {active} = tracker;
  if (active) {
    const phase = (generation - active.startGeneration) % active.orbitPeriodLength;
    if (active.orbitHashes[phase] === hash) {
      active.lastMatchingGeneration = generation;
    } else {
      finalizeActiveAttractor(tracker);
      resetAttractorCandidates(tracker);
      detectOrAddCandidate(tracker, hash, generation);
    }
  }
}

/**
 * Detects an attractor from existing hash candidates or stores the current frame as a candidate.
 *
 * @param {AttractorTracker} tracker attractor tracker.
 * @param {number} hash current frame hash.
 * @param {number} generation current generation.
 */
function detectOrAddCandidate(tracker: AttractorTracker, hash: number, generation: number): void {
  const candidates = tracker.candidatesByHash.get(hash) ?? [];
  let detected = false;
  for (const candidateIndex of candidates) {
    const candidate = tracker.pendingFrames[candidateIndex] ?? null;
    if (!detected && candidate) {
      const period = generation - candidate.generation;
      const orbitFrames = tracker.pendingFrames.slice(candidateIndex);
      if (period > 0 && period === orbitFrames.length) {
        tracker.active = {
          startGeneration: candidate.generation,
          firstRepeatGeneration: generation,
          orbitPeriodLength: period,
          orbitHashes: orbitFrames.map(entry => entry.hash),
          lastMatchingGeneration: generation
        };
        resetAttractorCandidates(tracker);
        detected = true;
      }
    }
  }
  if (!detected) {
    addAttractorCandidate(tracker, hash, generation);
  }
}

/**
 * Adds a hash-only attractor candidate.
 *
 * @param {AttractorTracker} tracker attractor tracker.
 * @param {number} hash frame hash.
 * @param {number} generation frame generation.
 */
function addAttractorCandidate(tracker: AttractorTracker, hash: number, generation: number): void {
  const index = tracker.pendingFrames.length;
  tracker.pendingFrames.push({generation, hash});
  const candidates = tracker.candidatesByHash.get(hash) ?? [];
  candidates.push(index);
  tracker.candidatesByHash.set(hash, candidates);
}

/**
 * Clears pending hash candidates.
 *
 * @param {AttractorTracker} tracker attractor tracker.
 */
function resetAttractorCandidates(tracker: AttractorTracker): void {
  tracker.candidatesByHash = new Map<number, number[]>();
  tracker.pendingFrames = [];
}

/**
 * Hashes a packed frame.
 *
 * @param {Uint8Array} packed packed frame bytes.
 * @returns {number} frame CRC-32.
 */
function hashFrame(packed: Uint8Array): number {
  return finalizeCrc32(updateCrc32(0xffffffff, packed));
}

export {createAttractorTracker, finalizeActiveAttractor, observeAttractorFrame};

export type {AttractorTracker};
