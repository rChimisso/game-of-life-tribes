/**
 * Run stop condition for the active simulation loop.
 *
 * @typedef {RunStopCondition}
 */
export type RunStopCondition = {kind: 'none'} | {kind: 'targetGeneration'; generation: number};

/**
 * Run pacing strategy for the active simulation loop.
 *
 * @typedef {RunPacing}
 */
export type RunPacing = {kind: 'max'} | {kind: 'fixedGenPerSecond'; genPerSecond: number};

/**
 * Active run mode for the simulation loop.
 *
 * @typedef {RunKind}
 */
export type RunKind = 'nonRecording' | 'recording';

/**
 * Reason why an active run stopped.
 *
 * @typedef {RunStopReason}
 */
export type RunStopReason = 'manual' | 'targetReached' | 'cancelled' | 'restart' | 'rebuild' | 'deviceLost' | 'error';

/**
 * Adaptive batching state for non-recording high-throughput runs.
 *
 * @interface AdaptiveBatchState
 * @typedef {AdaptiveBatchState}
 */
export interface AdaptiveBatchState {
  /**
   * Current generation budget submitted before draining the GPU queue.
   *
   * @type {number}
   */
  generationsPerDrain: number;
  /**
   * Target GPU queue drain duration in milliseconds.
   *
   * @type {number}
   */
  targetDrainMs: number;
  /**
   * Smoothed GPU queue drain duration in milliseconds.
   *
   * @type {number}
   */
  smoothedDrainMs: number;
  /**
   * Timestamp when the latest measured drain started.
   *
   * @type {number}
   */
  lastDrainStartedAt: number;
  /**
   * Generation count submitted for the latest measured drain.
   *
   * @type {number}
   */
  lastSubmittedGenerations: number;
}

/**
 * Runtime state to restore after a temporary run interruption.
 *
 * @interface RunRestoreAfterStop
 * @typedef {RunRestoreAfterStop}
 */
export interface RunRestoreAfterStop {
  /**
   * Whether simulation should resume immediately.
   *
   * @type {boolean}
   */
  running: boolean;
  /**
   * Target fixed-step duration in milliseconds.
   *
   * @type {number}
   */
  targetStepDuration: number;
}

/**
 * Requested configuration for a simulation run.
 *
 * @interface RunRequest
 * @typedef {RunRequest}
 */
export interface RunRequest {
  /**
   * Pacing strategy for the run loop.
   *
   * @type {RunPacing}
   */
  pacing: RunPacing;
  /**
   * Stop condition for the run loop.
   *
   * @type {RunStopCondition}
   */
  stopCondition: RunStopCondition;
  /**
   * Runtime state to restore after the run stops.
   *
   * @type {RunRestoreAfterStop}
   */
  restoreAfterStop?: RunRestoreAfterStop;
}

/**
 * Mutable runtime bookkeeping for an active run.
 *
 * @interface RunState
 * @typedef {RunState}
 */
export interface RunState {
  /**
   * Active run mode.
   *
   * @type {RunKind}
   */
  kind: RunKind;
  /**
   * Current run request.
   *
   * @type {RunRequest}
   */
  request: RunRequest;
  /**
   * Cancellation token for the active run.
   *
   * @type {number}
   */
  token: number;
  /**
   * Whether another pump callback is already scheduled.
   *
   * @type {boolean}
   */
  pumpPending: boolean;
  /**
   * Timestamp of the previous frame.
   *
   * @type {number}
   */
  lastFrameTime: number;
  /**
   * Accumulated fixed-step time.
   *
   * @type {number}
   */
  stepAccumulator: number;
  /**
   * Timestamp of the last progress message.
   *
   * @type {number}
   */
  lastProgressTime: number;
  /**
   * Timestamp of the last render.
   *
   * @type {number}
   */
  lastRenderTime: number;
  /**
   * Adaptive batching state for non-recording runs.
   *
   * @type {(AdaptiveBatchState | null)}
   */
  adaptiveBatch: AdaptiveBatchState | null;
}
