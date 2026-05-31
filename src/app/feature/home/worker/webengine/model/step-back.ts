/**
 * Target inside the in-memory chunk buffer for a step-back request.
 *
 * @interface BufferedStepBackTarget
 * @typedef {BufferedStepBackTarget}
 */
export interface BufferedStepBackTarget {
  /**
   * Source kind for the resolved target.
   *
   * @type {'buffered'}
   */
  source: 'buffered';
  /**
   * Frame index inside the current in-memory chunk.
   *
   * @type {number}
   */
  frameInChunk: number;
}

/**
 * Target inside a sealed OPFS chunk for a step-back request.
 *
 * @interface SealedStepBackTarget
 * @typedef {SealedStepBackTarget}
 */
export interface SealedStepBackTarget {
  /**
   * Source kind for the resolved target.
   *
   * @type {'sealed'}
   */
  source: 'sealed';
  /**
   * Index of the sealed chunk that owns the target frame.
   *
   * @type {number}
   */
  sealedIndex: number;
  /**
   * Frame index inside the sealed chunk.
   *
   * @type {number}
   */
  frameInChunk: number;
}

/**
 * Resolved step-back target.
 *
 * @typedef {StepBackTarget}
 */
export type StepBackTarget = BufferedStepBackTarget | SealedStepBackTarget;

/**
 * Repacked chunk prefix used to restore a sealed step-back target.
 *
 * @export
 * @interface StepBackPrefix
 * @typedef {StepBackPrefix}
 */
export interface StepBackPrefix {
  /**
   * Whether the stored and active grid formats match.
   *
   * @type {boolean}
   */
  sameFormat: boolean;
  /**
   * Prefix bytes for all restored frames up to the target frame.
   *
   * @type {Uint8Array}
   */
  chunkPrefix: Uint8Array;
  /**
   * Active frame payload when the restored prefix was repacked.
   *
   * @type {Uint8Array | null}
   */
  activeFrame: Uint8Array | null;
}
