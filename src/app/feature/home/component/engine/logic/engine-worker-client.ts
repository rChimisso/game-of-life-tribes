import {EngineWorkerOutputMessage, EngineWorkerOutputHandlers} from '../model/engine-worker-output';

import {GridFormatMetadata} from '~gol/feature/home/model/grid-format';
import {LiveMetricsSettings} from '~gol/feature/home/model/metrics';
import {Ruleset, Tribe} from '~gol/feature/home/model/rule';
import {BrushPreviewMessage, CameraMessage, DrawMessage, InitMessage, WorkerMessage} from '~gol/feature/home/model/worker-message';

/**
 * Worker transport and output dispatch for the engine component.
 *
 * @class EngineWorkerClient
 * @typedef {EngineWorkerClient}
 */
export class EngineWorkerClient {
  /**
   * Render worker instance.
   *
   * @private
   * @type {(Worker | undefined)}
   */
  private worker?: Worker;

  /**
   * Whether the worker has been initialized.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get initialized(): boolean {
    return this.worker !== undefined;
  }

  /**
   * @constructor
   * @public
   * @param {EngineWorkerOutputHandlers} outputHandlers output handlers keyed by worker message type.
   */
  public constructor(private readonly outputHandlers: EngineWorkerOutputHandlers) {}

  /**
   * Creates the worker and sends its init payload.
   *
   * @public
   * @param {InitMessage} message worker init message.
   * @param {Transferable[]} transfer transfer list.
   */
  public initialize(message: InitMessage, transfer: Transferable[]): void {
    this.worker = new Worker(new URL('../../../worker/webengine.ts', import.meta.url), {type: 'module'});
    this.worker.onmessage = (ev: MessageEvent<EngineWorkerOutputMessage>) => {
      this.dispatchOutput(ev.data);
    };
    this.worker.onerror = (err: ErrorEvent) => {
      this.outputHandlers.gpuError({
        type: 'gpuError',
        reason: err.message || 'Worker crashed unexpectedly'
      });
    };
    this.post(message, transfer);
  }

  /**
   * Terminates the worker.
   *
   * @public
   */
  public terminate(): void {
    this.worker?.terminate();
  }

  /**
   * Sends a snapshot request.
   *
   * @public
   */
  public requestSnapshot(): void {
    this.post({type: 'getSnapshot'});
  }

  /**
   * Loads a snapshot into the worker.
   *
   * @public
   * @param {Uint32Array} grid snapshot grid.
   * @param {number} generation snapshot generation.
   * @param {GridFormatMetadata} gridFormat snapshot grid format.
   */
  public loadSnapshot(grid: Uint32Array, generation: number, gridFormat: GridFormatMetadata): void {
    this.post({
      type: 'loadSnapshot',
      grid,
      generation,
      gridFormat
    }, [grid.buffer]);
  }

  /**
   * Updates recording state.
   *
   * @public
   * @param {boolean} recording whether recording is enabled.
   */
  public setRecording(recording: boolean): void {
    this.post({type: 'setRecording', recording});
  }

  /**
   * Updates simulation running state.
   *
   * @public
   * @param {boolean} running whether the simulation should run.
   */
  public setRunning(running: boolean): void {
    this.post({type: 'setRunning', running});
  }

  /**
   * Requests the recording manifest.
   *
   * @public
   */
  public requestRecording(): void {
    this.post({type: 'getRecording'});
  }

  /**
   * Requests a backward step.
   *
   * @public
   * @param {number} count step count.
   */
  public stepBack(count: number): void {
    this.post({type: 'stepBack', count});
  }

  /**
   * Requests a forward step.
   *
   * @public
   * @param {number} count step count.
   */
  public stepForward(count: number): void {
    this.post({type: 'stepForward', count});
  }

  /**
   * Cancels the active stepping operation.
   *
   * @public
   */
  public cancelStepping(): void {
    this.post({type: 'cancelStepping'});
  }

  /**
   * Updates a sealed chunk codec.
   *
   * @public
   * @param {string} filename chunk filename.
   * @param {number} rawBytes raw chunk byte count.
   * @param {string} codec stored chunk codec.
   * @param {number} storedBytes stored chunk byte count.
   * @param {GridFormatMetadata} gridFormat stored chunk grid format.
   */
  public updateChunkCodec(filename: string, rawBytes: number, codec: string, storedBytes: number, gridFormat: GridFormatMetadata): void {
    this.post({
      type: 'updateChunkCodec',
      filename,
      rawBytes,
      codec,
      storedBytes,
      gridFormat
    });
  }

  /**
   * Requests chunks that still need compression.
   *
   * @public
   */
  public requestUncompressedChunks(): void {
    this.post({type: 'getUncompressedChunks'});
  }

  /**
   * Updates simulation speed.
   *
   * @public
   * @param {number} speed simulation speed.
   */
  public setSpeed(speed: number): void {
    this.post({type: 'setSpeed', speed});
  }

  /**
   * Updates live metrics settings.
   *
   * @public
   * @param {LiveMetricsSettings} liveMetrics live metrics settings.
   */
  public setLiveMetrics(liveMetrics: LiveMetricsSettings): void {
    this.post({type: 'setLiveMetrics', liveMetrics});
  }

  /**
   * Updates worker rules and grid format.
   *
   * @public
   * @param {Ruleset<readonly Tribe[]>} ruleset current ruleset.
   * @param {GridFormatMetadata} simulationGridFormat current grid format.
   */
  public setRuleset(ruleset: Ruleset<readonly Tribe[]>, simulationGridFormat: GridFormatMetadata): void {
    this.post({
      type: 'setRuleset',
      ruleset,
      simulationGridFormat
    });
  }

  /**
   * Resizes the worker canvas.
   *
   * @public
   * @param {number} width canvas width.
   * @param {number} height canvas height.
   */
  public resize(width: number, height: number): void {
    this.post({
      type: 'resize',
      width,
      height
    });
  }

  /**
   * Sends a camera update.
   *
   * @public
   * @param {CameraMessage} camera camera message.
   */
  public sendCamera(camera: CameraMessage): void {
    this.post(camera);
  }

  /**
   * Sends a draw command.
   *
   * @public
   * @param {DrawMessage} message draw message.
   */
  public draw(message: DrawMessage): void {
    this.post(message);
  }

  /**
   * Sends a brush preview update.
   *
   * @public
   * @param {BrushPreviewMessage} message brush preview message.
   */
  public setBrushPreview(message: BrushPreviewMessage): void {
    this.post(message);
  }

  /**
   * Posts a typed worker message.
   *
   * @private
   * @param {WorkerMessage} message worker message.
   * @param {Transferable[]} [transfer] transfer list.
   */
  private post(message: WorkerMessage, transfer?: Transferable[]): void {
    if (transfer) {
      this.worker?.postMessage(message, transfer);
    } else {
      this.worker?.postMessage(message);
    }
  }

  /**
   * Dispatches a worker output message.
   *
   * @private
   * @param {EngineWorkerOutputMessage} message worker output message.
   */
  private dispatchOutput(message: EngineWorkerOutputMessage): void {
    switch (message?.type) {
      case 'metrics': this.outputHandlers.metrics(message); break;
      case 'snapshot': this.outputHandlers.snapshot(message); break;
      case 'recording': this.outputHandlers.recording(message); break;
      case 'limits': this.outputHandlers.limits(message); break;
      case 'stepping': this.outputHandlers.stepping(message); break;
      case 'chunksSaving': this.outputHandlers.chunksSaving(message); break;
      case 'backpressure': this.outputHandlers.backpressure(message); break;
      case 'storageQuota': this.outputHandlers.storageQuota(message); break;
      case 'chunkSealed': this.outputHandlers.chunkSealed(message); break;
      case 'uncompressedChunks': this.outputHandlers.uncompressedChunks(message); break;
      case 'generation': this.outputHandlers.generation(message); break;
      case 'rebuilding': this.outputHandlers.rebuilding(message); break;
      case 'deviceLost': this.outputHandlers.deviceLost(message); break;
      case 'gpuError': this.outputHandlers.gpuError(message); break;
      default: console.warn('Unknown message from worker:', message); break;
    }
  }
}
