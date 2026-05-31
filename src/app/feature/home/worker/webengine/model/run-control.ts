/**
 * Scheduling primitive used to resume the active run.
 *
 * @typedef {PumpSchedule}
 */
export type PumpSchedule = 'raf' | 'drain' | 'microtask';

/**
 * Options controlling the side effects of stopping the active run.
 *
 * @interface StopRunOptions
 * @typedef {StopRunOptions}
 */
export interface StopRunOptions {
  /**
   * Whether to render and refresh metrics after stopping.
   *
   * @type {boolean}
   */
  render?: boolean;
  /**
   * Whether to post a `stepping=false` message for target runs.
   *
   * @type {boolean}
   */
  postStepping?: boolean;
  /**
   * Whether to restore saved run settings after stopping.
   *
   * @type {boolean}
   */
  restore?: boolean;
  /**
   * Whether a restored continuous run should restart automatically.
   *
   * @type {boolean}
   */
  restartRestoredRun?: boolean;
}
