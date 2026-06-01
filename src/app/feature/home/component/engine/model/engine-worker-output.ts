import {BackpressureMessage, ChunkSealedMessage, ChunksSavingMessage, DeviceLostMessage, GenerationMessage, GpuErrorMessage, LimitsMessage, MetricMessage, RebuildingMessage, RecordingMessage, SnapshotMessage, SteppingMessage, StorageQuotaMessage, UncompressedChunksMessage} from '~gol/feature/home/model/worker-message';

/**
 * Messages emitted by the engine worker.
 *
 * @typedef {EngineWorkerOutputMessage}
 */
export type EngineWorkerOutputMessage =
  | MetricMessage
  | SnapshotMessage
  | RecordingMessage
  | LimitsMessage
  | SteppingMessage
  | ChunksSavingMessage
  | BackpressureMessage
  | StorageQuotaMessage
  | ChunkSealedMessage
  | UncompressedChunksMessage
  | GenerationMessage
  | RebuildingMessage
  | DeviceLostMessage
  | GpuErrorMessage;

/**
 * Output callbacks used by the engine worker client.
 *
 * @interface EngineWorkerOutputHandlers
 * @typedef {EngineWorkerOutputHandlers}
 */
export interface EngineWorkerOutputHandlers {
  /**
   * Metrics message handler.
   *
   * @type {(message: MetricMessage) => void}
   */
  metrics: (message: MetricMessage) => void;
  /**
   * Snapshot message handler.
   *
   * @type {(message: SnapshotMessage) => void}
   */
  snapshot: (message: SnapshotMessage) => void;
  /**
   * Recording message handler.
   *
   * @type {(message: RecordingMessage) => void}
   */
  recording: (message: RecordingMessage) => void;
  /**
   * Limits message handler.
   *
   * @type {(message: LimitsMessage) => void}
   */
  limits: (message: LimitsMessage) => void;
  /**
   * Stepping message handler.
   *
   * @type {(message: SteppingMessage) => void}
   */
  stepping: (message: SteppingMessage) => void;
  /**
   * Chunk-saving message handler.
   *
   * @type {(message: ChunksSavingMessage) => void}
   */
  chunksSaving: (message: ChunksSavingMessage) => void;
  /**
   * Backpressure message handler.
   *
   * @type {(message: BackpressureMessage) => void}
   */
  backpressure: (message: BackpressureMessage) => void;
  /**
   * Storage quota message handler.
   *
   * @type {(message: StorageQuotaMessage) => void}
   */
  storageQuota: (message: StorageQuotaMessage) => void;
  /**
   * Sealed chunk message handler.
   *
   * @type {(message: ChunkSealedMessage) => void}
   */
  chunkSealed: (message: ChunkSealedMessage) => void;
  /**
   * Uncompressed-chunks message handler.
   *
   * @type {(message: UncompressedChunksMessage) => void}
   */
  uncompressedChunks: (message: UncompressedChunksMessage) => void;
  /**
   * Generation message handler.
   *
   * @type {(message: GenerationMessage) => void}
   */
  generation: (message: GenerationMessage) => void;
  /**
   * Rebuild message handler.
   *
   * @type {(message: RebuildingMessage) => void}
   */
  rebuilding: (message: RebuildingMessage) => void;
  /**
   * Device-loss message handler.
   *
   * @type {(message: DeviceLostMessage) => void}
   */
  deviceLost: (message: DeviceLostMessage) => void;
  /**
   * GPU error message handler.
   *
   * @type {(message: GpuErrorMessage) => void}
   */
  gpuError: (message: GpuErrorMessage) => void;
}
