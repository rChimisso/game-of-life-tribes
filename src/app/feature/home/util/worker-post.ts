/**
 * Minimal postMessage surface used by worker helper utilities.
 *
 * @interface WorkerTransferPostTarget
 * @typedef {WorkerTransferPostTarget}
 */
interface WorkerTransferPostTarget {
  /**
   * Posts a worker message with optional transferables.
   *
   * @param {unknown} message worker payload.
   * @param {Transferable[]} [transferables] transferable payloads.
   */
  postMessage: (message: unknown, transferables?: Transferable[]) => void;
}

/**
 * Posts a worker message with transferable payloads through the current worker global scope.
 *
 * @param {unknown} message worker message payload.
 * @param {Transferable[]} transferables transferable payload list.
 */
export function postWorkerTransfer(message: unknown, transferables: Transferable[]): void {
  (self as unknown as WorkerTransferPostTarget).postMessage(message, transferables);
}
