import {AttractorFrameSignature, AttractorTracker} from './attractor-types';
import {PackedRecordedFrame} from '../../frame/recording-frame-stream';
import {finalizeCrc32, updateCrc32} from '../../zip/zip-crc32';
import {OfflineMetricEntry} from '../core/offline-types';

/**
 * Creates an empty attractor tracker.
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
 * Observes one frame in the attractor tracker.
 *
 * @export
 * @param {AttractorTracker} tracker attractor tracker.
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {OfflineMetricEntry} metric metric row for the frame.
 */
function observeAttractorFrame(tracker: AttractorTracker, frame: PackedRecordedFrame, metric: OfflineMetricEntry): void {
  const signature = createFrameSignature(frame, metric);
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
    updateActiveAttractor(tracker, signature);
  } else {
    detectOrAddCandidate(tracker, signature);
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
      orbitPeriodLength: active.orbitPeriodLength
    });
    tracker.active = null;
  }
}

/**
 * Updates an active attractor match or restarts detection when the sequence diverges.
 *
 * @param {AttractorTracker} tracker attractor tracker.
 * @param {AttractorFrameSignature} signature current frame signature.
 */
function updateActiveAttractor(tracker: AttractorTracker, signature: AttractorFrameSignature): void {
  const {active} = tracker;
  if (active) {
    const phase = (signature.generation - active.startGeneration) % active.orbitPeriodLength;
    if (sameFrameSignature(active.orbitSignatures[phase]!, signature)) {
      active.lastMatchingGeneration = signature.generation;
    } else {
      finalizeActiveAttractor(tracker);
      resetAttractorCandidates(tracker);
      detectOrAddCandidate(tracker, signature);
    }
  }
}

/**
 * Detects an attractor from existing hash candidates or stores the current frame as a candidate.
 *
 * @param {AttractorTracker} tracker attractor tracker.
 * @param {AttractorFrameSignature} signature current frame signature.
 */
function detectOrAddCandidate(tracker: AttractorTracker, signature: AttractorFrameSignature): void {
  const candidates = tracker.candidatesByHash.get(signature.hash) ?? [];
  let detected = false;
  for (const candidateIndex of candidates) {
    const candidate = tracker.pendingFrames[candidateIndex] ?? null;
    if (!detected && candidate && sameFrameSignature(candidate, signature)) {
      const period = signature.generation - candidate.generation;
      const orbitFrames = tracker.pendingFrames.slice(candidateIndex);
      if (period > 0 && period === orbitFrames.length) {
        tracker.active = {
          startGeneration: candidate.generation,
          firstRepeatGeneration: signature.generation,
          orbitPeriodLength: period,
          orbitSignatures: orbitFrames,
          lastMatchingGeneration: signature.generation
        };
        resetAttractorCandidates(tracker);
        detected = true;
      }
    }
  }
  if (!detected) {
    addAttractorCandidate(tracker, signature);
  }
}

/**
 * Adds an attractor candidate signature.
 *
 * @param {AttractorTracker} tracker attractor tracker.
 * @param {AttractorFrameSignature} signature frame signature.
 */
function addAttractorCandidate(tracker: AttractorTracker, signature: AttractorFrameSignature): void {
  const index = tracker.pendingFrames.length;
  tracker.pendingFrames.push(signature);
  const candidates = tracker.candidatesByHash.get(signature.hash) ?? [];
  candidates.push(index);
  tracker.candidatesByHash.set(signature.hash, candidates);
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
 * Creates a compact frame signature from packed bytes and precomputed metrics.
 *
 * @param {PackedRecordedFrame} frame packed recorded frame.
 * @param {OfflineMetricEntry} metric metric row.
 * @returns {AttractorFrameSignature} attractor frame signature.
 */
function createFrameSignature(frame: PackedRecordedFrame, metric: OfflineMetricEntry): AttractorFrameSignature {
  return {
    generation: frame.generation,
    hash: hashFrame(frame.packed),
    population: Object.values(metric.population),
    aliveCells: metric.aliveCells,
    deadCells: metric.deadCells,
    sameStateContactEdges: metric.sameStateContactEdges,
    crossStateContactEdges: metric.crossStateContactEdges
  };
}

/**
 * Checks whether two compact frame signatures match.
 *
 * @param {AttractorFrameSignature} a first signature.
 * @param {AttractorFrameSignature} b second signature.
 * @returns {boolean} whether the signatures match.
 */
function sameFrameSignature(a: AttractorFrameSignature, b: AttractorFrameSignature): boolean {
  let matches = a.hash === b.hash &&
    a.aliveCells === b.aliveCells &&
    a.deadCells === b.deadCells &&
    a.sameStateContactEdges === b.sameStateContactEdges &&
    a.crossStateContactEdges === b.crossStateContactEdges &&
    a.population.length === b.population.length;
  for (let index = 0; matches && index < a.population.length; index++) {
    matches = a.population[index] === b.population[index];
  }
  return matches;
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

export type {AttractorTracker} from './attractor-types';
