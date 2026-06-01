/**
 * Receives byte chunks from streaming writers.
 *
 * @interface ByteSink
 * @typedef {ByteSink}
 */
export interface ByteSink {
  /**
   * Writes a byte chunk.
   *
   * @param {Uint8Array} chunk byte chunk.
   * @returns {Promise<void>} write completion promise.
   */
  write: (chunk: Uint8Array) => Promise<void>;
}

/**
 * Cancellation hooks used by worker streaming operations.
 *
 * @interface StreamCancellationOptions
 * @typedef {StreamCancellationOptions}
 */
export interface StreamCancellationOptions {
  /**
   * Returns whether the active stream has been cancelled.
   *
   * @type {() => boolean}
   */
  shouldCancel: () => boolean;
  /**
   * Registers a listener for active stream cancellation.
   *
   * @type {(listener: () => void) => () => void}
   */
  onCancelRequested: (listener: () => void) => () => void;
}

/**
 * Cancellation state shared by worker stream operations.
 *
 * @interface StreamCancellationState
 * @typedef {StreamCancellationState}
 */
export interface StreamCancellationState {
  /**
   * Whether cancellation has been requested.
   *
   * @type {boolean}
   */
  cancelled: boolean;
  /**
   * Promise resolved when cancellation is requested.
   *
   * @type {Promise<void>}
   */
  promise: Promise<void>;
  /**
   * Removes the active cancellation listener.
   *
   * @type {() => void}
   */
  unregister: () => void;
}

/**
 * Result of an awaited operation raced against stream cancellation.
 *
 * @typedef {StreamCancellableResult}
 * @template T
 */
export type StreamCancellableResult<T> = {
  /**
   * Operation result type.
   *
   * @type {'value'}
   */
  type: 'value';
  /**
   * Operation result value.
   *
   * @type {T}
   */
  value: T;
} | {
  /**
   * Operation result type.
   *
   * @type {'error'}
   */
  type: 'error';
  /**
   * Operation rejection reason.
   *
   * @type {unknown}
   */
  error: unknown;
} | {
  /**
   * Operation result type.
   *
   * @type {'cancelled'}
   */
  type: 'cancelled';
};

/**
 * Observed state for a parallel stream pump.
 *
 * @interface StreamPumpState
 * @typedef {StreamPumpState}
 */
export interface StreamPumpState {
  /**
   * Error captured from the stream pump.
   *
   * @type {(unknown | null)}
   */
  error: unknown | null;
}
