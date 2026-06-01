/**
 * Message shape used by typed worker dispatch helpers.
 *
 * @interface TypedWorkerMessage
 * @typedef {TypedWorkerMessage}
 */
export interface TypedWorkerMessage {
  /**
   * Worker message discriminator.
   *
   * @type {string}
   */
  type: string;
}

/**
 * Worker message handlers keyed by message discriminator.
 *
 * @typedef {WorkerMessageHandlerMap}
 * @template Message
 */
export type WorkerMessageHandlerMap<Message extends TypedWorkerMessage> = {
  [K in Message['type']]: (message: Extract<Message, {type: K}>) => void | Promise<void>;
};

/**
 * Context passed to worker response handlers.
 *
 * @interface WorkerRunnerContext
 * @typedef {WorkerRunnerContext}
 * @template Result
 */
export interface WorkerRunnerContext<Result> {
  /**
   * Active worker instance.
   *
   * @type {Worker}
   */
  worker: Worker;
  /**
   * Resolves the worker runner promise.
   *
   * @type {(result: Result) => void}
   */
  resolve: (result: Result) => void;
  /**
   * Rejects the worker runner promise.
   *
   * @type {(error: unknown) => void}
   */
  reject: (error: unknown) => void;
  /**
   * Terminates the active worker.
   *
   * @type {() => void}
   */
  terminate: () => void;
}

/**
 * Options for one typed worker run.
 *
 * @interface WorkerRunnerOptions
 * @typedef {WorkerRunnerOptions}
 * @template Request
 * @template Response
 * @template Result
 */
export interface WorkerRunnerOptions<Request, Response, Result> {
  /**
   * Creates the worker instance.
   *
   * @type {() => Worker}
   */
  createWorker: () => Worker;
  /**
   * Initial request sent to the worker.
   *
   * @type {Request}
   */
  request: Request;
  /**
   * Optional initial request transfer list.
   *
   * @type {Transferable[]}
   */
  transfer?: Transferable[];
  /**
   * Handles worker response messages.
   *
   * @type {(message: Response, context: WorkerRunnerContext<Result>) => (void | Promise<void>)}
   */
  onMessage: (message: Response, context: WorkerRunnerContext<Result>) => void | Promise<void>;
  /**
   * Converts unexpected worker errors into rejection errors.
   *
   * @type {((error: ErrorEvent) => unknown)}
   */
  onUnexpectedError?: (error: ErrorEvent) => unknown;
}
