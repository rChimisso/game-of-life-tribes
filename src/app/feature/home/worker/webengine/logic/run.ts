import {StopRunOptions} from '../model/run-control';
import {AdaptiveBatchState, RunKind, RunPacing, RunRestoreAfterStop, RunState, RunStopReason} from '../model/run-state';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Target GPU queue drain duration for max-speed adaptive non-recording batches.
 *
 * @type {number}
 */
const ADAPTIVE_MAX_TARGET_DRAIN_MS = 500;
/**
 * Target GPU queue drain duration for fixed-speed catch-up adaptive non-recording batches.
 *
 * @type {number}
 */
const ADAPTIVE_FIXED_TARGET_DRAIN_MS = 33;
/**
 * Maximum adaptive batch growth after one measured drain.
 *
 * @type {number}
 */
const ADAPTIVE_MAX_GROWTH = 2;
/**
 * Maximum adaptive batch shrink after one measured drain.
 *
 * @type {number}
 */
const ADAPTIVE_MAX_SHRINK = 0.5;
/**
 * Smoothing factor for measured drain durations.
 *
 * @type {number}
 */
const ADAPTIVE_SMOOTHING = 0.2;
/**
 * Minimum generation budget for adaptive drains.
 *
 * @type {number}
 */
const ADAPTIVE_MIN_GENERATIONS_PER_DRAIN = 1;
/**
 * Maximum generation budget for adaptive drains.
 *
 * @type {number}
 */
const ADAPTIVE_MAX_GENERATIONS_PER_DRAIN = 1_048_576;

/**
 * Maps the current grid size to one of the predefined non-recording run tiers.
 *
 * @param {Grid} grid logical grid dimensions.
 * @returns {number} tier index from `0` through `3`.
 */
function gridSizeTier(grid: Grid): number {
  return Math.min(3, Math.max(0, Math.ceil(Math.log10(grid.cols * grid.rows / 100_000))));
}

/**
 * Returns the preferred simulation batch size for the current grid.
 *
 * @param {Grid} grid logical grid dimensions.
 * @returns {number} preferred batch size.
 */
export function skipBatchSize(grid: Grid): number {
  return 1024 / (4 ** gridSizeTier(grid));
}

/**
 * Returns the max-speed batch budget before yielding back to the event loop.
 *
 * @param {Grid} grid logical grid dimensions.
 * @returns {number} per-drain batch budget.
 */
export function nonRecordingMaxSpeedBatchesPerDrain(grid: Grid): number {
  return 16 / (2 ** gridSizeTier(grid));
}

/**
 * Returns the tiered generation budget used to seed adaptive batching.
 *
 * @param {Grid} grid logical grid dimensions.
 * @returns {number} initial generation budget per GPU drain.
 */
export function initialAdaptiveGenerationsPerDrain(grid: Grid): number {
  return Math.max(ADAPTIVE_MIN_GENERATIONS_PER_DRAIN, Math.round(skipBatchSize(grid) * nonRecordingMaxSpeedBatchesPerDrain(grid)));
}

/**
 * Creates fresh adaptive batching state for a non-recording run.
 *
 * @param {Grid} grid logical grid dimensions.
 * @param {RunPacing} pacing run pacing strategy.
 * @returns {AdaptiveBatchState} adaptive batch state.
 */
export function createAdaptiveBatchState(grid: Grid, pacing: RunPacing): AdaptiveBatchState {
  return {
    generationsPerDrain: initialAdaptiveGenerationsPerDrain(grid),
    targetDrainMs: pacing.kind === 'max' ? ADAPTIVE_MAX_TARGET_DRAIN_MS : ADAPTIVE_FIXED_TARGET_DRAIN_MS,
    smoothedDrainMs: 0,
    lastDrainStartedAt: 0,
    lastSubmittedGenerations: 0
  };
}

/**
 * Updates adaptive batch state from a measured GPU queue drain.
 *
 * @param {AdaptiveBatchState} state adaptive batch state to update.
 * @param {number} measuredDrainMs measured drain duration in milliseconds.
 */
export function updateAdaptiveBatchState(state: AdaptiveBatchState, measuredDrainMs: number): void {
  if (measuredDrainMs > 0 && state.lastSubmittedGenerations > 0) {
    const smoothed = state.smoothedDrainMs === 0 ? measuredDrainMs : state.smoothedDrainMs * (1 - ADAPTIVE_SMOOTHING) + measuredDrainMs * ADAPTIVE_SMOOTHING;
    const scale = Math.min(ADAPTIVE_MAX_GROWTH, Math.max(ADAPTIVE_MAX_SHRINK, state.targetDrainMs / smoothed));
    state.smoothedDrainMs = smoothed;
    state.generationsPerDrain = Math.max(ADAPTIVE_MIN_GENERATIONS_PER_DRAIN, Math.min(ADAPTIVE_MAX_GENERATIONS_PER_DRAIN, Math.round(state.generationsPerDrain * scale)));
  }
}

/**
 * Returns the maximum fixed-speed work encoded from one animation frame.
 *
 * @param {RunKind} kind active run kind.
 * @param {Grid} grid logical grid dimensions.
 * @returns {number} simulation step budget.
 */
export function fixedRunStepBudget(kind: RunKind, grid: Grid): number {
  return kind === 'recording' ? Number.MAX_SAFE_INTEGER : skipBatchSize(grid) * nonRecordingMaxSpeedBatchesPerDrain(grid);
}

/**
 * Drops unreachable fixed-speed debt after bounded frame work is encoded.
 *
 * @param {number} startingAccumulator accumulator value before frame work.
 * @param {number} duration target step duration in milliseconds.
 * @param {number} dueSteps steps requested by the current accumulator.
 * @param {number} completedSteps steps actually encoded this frame.
 * @param {number} stepBudget maximum steps allowed this frame.
 * @returns {number} next accumulator value.
 */
export function nextFixedRunAccumulator(startingAccumulator: number, duration: number, dueSteps: number, completedSteps: number, stepBudget: number): number {
  const remainingAccumulator = startingAccumulator - duration * completedSteps;
  if (dueSteps > completedSteps || dueSteps > stepBudget) {
    return Math.min(remainingAccumulator, duration);
  }
  return remainingAccumulator;
}

/**
 * Converts the current target step duration into a run pacing descriptor.
 *
 * @param {number} targetStepDuration target step duration in milliseconds.
 * @returns {RunPacing} pacing for continuous runs.
 */
export function currentRunPacing(targetStepDuration: number): RunPacing {
  return targetStepDuration <= 0 ? {kind: 'max'} : {kind: 'fixedGenPerSecond', genPerSecond: 1000 / targetStepDuration};
}

/**
 * Checks whether the run stops at a target generation.
 *
 * @param {RunState} run active run state.
 * @returns {boolean} true when the run has a target generation.
 */
export function isTargetRun(run: RunState): boolean {
  return run.request.stopCondition.kind === 'targetGeneration';
}

/**
 * Checks whether the active generation has reached the run target.
 *
 * @param {RunState} run active run state.
 * @param {number} generation current generation.
 * @returns {boolean} true when the run target is satisfied.
 */
export function runTargetReached(run: RunState, generation: number): boolean {
  return run.request.stopCondition.kind === 'targetGeneration' && generation >= run.request.stopCondition.generation;
}

/**
 * Computes how many generations remain before the run target is reached.
 *
 * @param {RunState} run active run state.
 * @param {number} generation current generation.
 * @returns {number} remaining target steps, or infinity for non-target runs.
 */
export function remainingTargetSteps(run: RunState, generation: number): number {
  return run.request.stopCondition.kind === 'targetGeneration' ? Math.max(0, run.request.stopCondition.generation - generation) : Number.POSITIVE_INFINITY;
}

/**
 * Returns the saved run settings that should be restored after stopping.
 *
 * @param {RunState} run active run state.
 * @param {StopRunOptions} options stop-time side-effect controls.
 * @returns {RunRestoreAfterStop | null} restore-after-stop state, if enabled.
 */
export function restoreAfterStopState(run: RunState, options: StopRunOptions): RunRestoreAfterStop | null {
  return (options.restore !== false && run.request.restoreAfterStop) || null;
}

/**
 * Checks whether stopping should post `stepping=false` back to the main thread.
 *
 * @param {RunStopReason} reason reason the run is stopping.
 * @param {boolean} targetRun whether the run stops at a target generation.
 * @param {StopRunOptions} options stop-time side-effect controls.
 * @returns {boolean} true when the stepping notification should be posted.
 */
export function shouldPostStopStepping(reason: RunStopReason, targetRun: boolean, options: StopRunOptions): boolean {
  return targetRun && options.postStepping !== false && (reason === 'targetReached' || reason === 'cancelled');
}

/**
 * Checks whether a restored continuous run should restart immediately.
 *
 * @param {StopRunOptions} options stop-time side-effect controls.
 * @param {boolean} restored whether restore-after-stop state was applied.
 * @param {boolean} simulationRunning whether simulation is enabled after restore.
 * @param {boolean} rebuilding whether the worker is rebuilding GPU state.
 * @param {boolean} deviceLost whether the WebGPU device is currently lost.
 * @returns {boolean} true when the previous run should resume.
 */
export function shouldRestartRestoredRun(options: StopRunOptions, restored: boolean, simulationRunning: boolean, rebuilding: boolean, deviceLost: boolean): boolean {
  return options.restartRestoredRun !== false && restored && simulationRunning && !rebuilding && !deviceLost;
}
