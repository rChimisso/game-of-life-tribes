import {ByteSink, StreamCancellableResult, StreamCancellationOptions, StreamCancellationState, StreamPumpState} from '../model/stream';

/**
 * Creates active worker stream cancellation state.
 *
 * @param {StreamCancellationOptions} options stream cancellation options.
 * @param {() => void} onCancel cancellation side effect.
 * @returns {StreamCancellationState} cancellation state.
 */
export function createStreamCancellationState(options: StreamCancellationOptions, onCancel: () => void): StreamCancellationState {
  let resolveCancel: () => void = () => undefined;
  const state: StreamCancellationState = {
    cancelled: options.shouldCancel(),
    promise: new Promise<void>(resolve => {
      resolveCancel = resolve;
    }),
    unregister: () => undefined
  };
  const cancel = () => {
    if (!state.cancelled) {
      state.cancelled = true;
      resolveCancel();
    }
    onCancel();
  };
  state.unregister = options.onCancelRequested(cancel);
  if (state.cancelled) {
    resolveCancel();
  }
  return state;
}

/**
 * Awaits a promise while allowing active stream cancellation to win the race.
 *
 * @async
 * @template T
 * @param {Promise<T>} promise operation promise.
 * @param {StreamCancellationState} cancellation active cancellation state.
 * @param {string} cancellationMessage cancellation error message.
 * @returns {Promise<T>} operation result.
 */
export async function waitForCancellablePromise<T>(promise: Promise<T>, cancellation: StreamCancellationState, cancellationMessage: string): Promise<T> {
  assertStreamCancellationState(cancellation, cancellationMessage);
  const observedPromise: Promise<StreamCancellableResult<T>> = promise.then(value => ({
    type: 'value',
    value
  }), error => ({
    type: 'error',
    error
  }));
  const result = await Promise.race([observedPromise, cancellation.promise.then((): StreamCancellableResult<T> => ({type: 'cancelled'}))]);
  if (result.type === 'error') {
    throw result.error;
  }
  if (result.type === 'cancelled') {
    throw new Error(cancellationMessage);
  }
  return result.value;
}

/**
 * Throws when stream cancellation has already been requested.
 *
 * @param {StreamCancellationState} cancellation active cancellation state.
 * @param {string} cancellationMessage cancellation error message.
 */
export function assertStreamCancellationState(cancellation: StreamCancellationState, cancellationMessage: string): void {
  if (cancellation.cancelled) {
    throw new Error(cancellationMessage);
  }
}

/**
 * Pumps readable stream chunks through a chunk writer.
 *
 * @async
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader stream reader.
 * @param {(chunk: Uint8Array) => Promise<void>} writeChunk chunk writer.
 * @param {StreamCancellationState} cancellation active cancellation state.
 * @param {string} cancellationMessage cancellation error message.
 */
export async function pumpReadableChunks(reader: ReadableStreamDefaultReader<Uint8Array>, writeChunk: (chunk: Uint8Array) => Promise<void>, cancellation: StreamCancellationState, cancellationMessage: string): Promise<void> {
  let done = false;
  while (!done) {
    const result = await waitForCancellablePromise(reader.read(), cancellation, cancellationMessage);
    done = result.done;
    if (result.value) {
      await waitForCancellablePromise(writeChunk(result.value), cancellation, cancellationMessage);
    }
  }
}

/**
 * Observes a background stream pump without letting it create an unhandled rejection.
 *
 * @param {Promise<void>} pump stream pump promise.
 * @param {StreamPumpState} state pump state to update on failure.
 * @returns {Promise<void>} observed pump promise.
 */
export function observeStreamPump(pump: Promise<void>, state: StreamPumpState): Promise<void> {
  return pump.catch(error => {
    state.error = error;
  });
}

/**
 * Throws the captured stream pump error, when present.
 *
 * @param {StreamPumpState} state observed stream pump state.
 */
export function throwStreamPumpError(state: StreamPumpState): void {
  if (state.error !== null) {
    throw state.error;
  }
}

/**
 * Aborts a writable stream writer and logs abort failure.
 *
 * @param {WritableStreamDefaultWriter<BufferSource>} writer stream writer.
 * @param {unknown} reason original failure reason.
 * @param {string} warning warning message for abort failure.
 */
export function abortWritableStreamWriter(writer: WritableStreamDefaultWriter<BufferSource>, reason: unknown, warning: string): void {
  writer.abort(reason).catch(error => {
    console.warn(warning, error);
  });
}

/**
 * Cancels a readable stream reader and logs cancellation failure.
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader stream reader.
 * @param {unknown} reason original failure reason.
 * @param {string} warning warning message for cancellation failure.
 */
export function cancelReadableStreamReader(reader: ReadableStreamDefaultReader<Uint8Array>, reason: unknown, warning: string): void {
  reader.cancel(reason).catch(error => {
    console.warn(warning, error);
  });
}

/**
 * Collects byte sink output into one byte array.
 *
 * @async
 * @param {(sink: ByteSink) => Promise<void>} writeOutput byte sink writer.
 * @returns {Promise<Uint8Array>} collected bytes.
 */
export async function collectByteSinkOutput(writeOutput: (sink: ByteSink) => Promise<void>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  await writeOutput({
    write: async chunk => {
      chunks.push(chunk);
      totalBytes += chunk.byteLength;
    }
  });
  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
