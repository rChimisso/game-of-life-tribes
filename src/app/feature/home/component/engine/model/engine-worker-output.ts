import {BackpressureMessage, ChunkSealedMessage, ChunksSavingMessage, DeviceLostMessage, GenerationMessage, GpuErrorMessage, GpuWarningMessage, LimitsMessage, MetricMessage, RebuildingMessage, RecordingMessage, RecordingStoppedMessage, SnapshotMessage, SteppingMessage, StorageQuotaMessage, UncompressedChunksMessage} from '~gol/feature/home/model/worker-message';
import {WorkerMessageHandlerMap} from '~gol/feature/home/model/worker-runner';

/**
 * Messages emitted by the engine worker.
 *
 * @typedef {EngineWorkerOutputMessage}
 */
export type EngineWorkerOutputMessage =
  | MetricMessage
  | SnapshotMessage
  | RecordingMessage
  | RecordingStoppedMessage
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
  | GpuErrorMessage
  | GpuWarningMessage;

/**
 * Output callbacks used by the engine worker client.
 *
 * @typedef {EngineWorkerOutputHandlers}
 */
export type EngineWorkerOutputHandlers = WorkerMessageHandlerMap<EngineWorkerOutputMessage>;
