import {TypedWorkerMessage, WorkerMessageHandlerMap, WorkerRunnerOptions} from '../model/worker-runner';

/**
 * Checks whether an unknown worker payload has a string discriminator.
 *
 * @param {unknown} message worker payload.
 * @returns {boolean} true when the payload is a typed worker message.
 */
function isTypedWorkerMessage(message: unknown): message is TypedWorkerMessage {
  return typeof message === 'object' && message !== null && 'type' in message && typeof (message as {type?: unknown}).type === 'string';
}

/**
 * Dispatches a discriminated worker message through a handler map.
 *
 * @param {unknown} message worker message.
 * @param {WorkerMessageHandlerMap<Message>} handlers message handlers keyed by discriminator.
 * @template Message
 */
export function dispatchWorkerMessage<Message extends TypedWorkerMessage>(message: unknown, handlers: WorkerMessageHandlerMap<Message>): void {
  if (isTypedWorkerMessage(message) && message.type in handlers) {
    handlers[message.type as Message['type']](message as Extract<Message, { type: Message['type'] }>);
  } else {
    console.warn('Unknown message from worker:', message);
  }
}

/**
 * Runs one request/response worker lifecycle.
 *
 * @param {WorkerRunnerOptions<Request, Response, Result>} options worker runner options.
 * @template Request
 * @template Response
 * @template Result
 */
export function runWorker<Request, Response, Result>(options: WorkerRunnerOptions<Request, Response, Result>): Promise<Result> {
  return new Promise<Result>((resolve, reject) => {
    const worker = options.createWorker();
    const terminate = () => {
      worker.terminate();
    };
    worker.onerror = error => {
      terminate();
      reject(options.onUnexpectedError?.(error) ?? error);
    };
    worker.onmessage = event => {
      Promise.resolve(options.onMessage(event.data as Response, {
        worker,
        resolve,
        reject,
        terminate
      })).catch(error => {
        terminate();
        reject(error);
      });
    };
    worker.postMessage(options.request, options.transfer ?? []);
  });
}
