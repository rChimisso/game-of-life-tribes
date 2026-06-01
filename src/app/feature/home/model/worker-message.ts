import {BrushFill, BrushShape} from './draw-mode';
import {GridFormatMetadata} from './grid-format';
import {LiveInterfaceMetrics, LiveMetricsSettings, MetricAvailability} from './metrics';
import {RecordingManifest} from './recording';
import {Ruleset, Tribe} from './rule';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Initial worker bootstrap payload.
 *
 * @interface InitMessage
 * @typedef {InitMessage}
 */
export interface InitMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'init'}
   */
  type: 'init';
  /**
   * Offscreen canvas bound to the worker renderer.
   *
   * @type {OffscreenCanvas}
   */
  canvas: OffscreenCanvas;
  /**
   * Active ruleset to compile.
   *
   * @type {Ruleset<readonly Tribe[]>}
   */
  ruleset: Ruleset<readonly Tribe[]>;
  /**
   * Active simulation grid packing.
   *
   * @type {GridFormatMetadata}
   */
  simulationGridFormat: GridFormatMetadata;
  /**
   * Whether recording mode starts enabled.
   *
   * @type {boolean}
   */
  recording: boolean;
  /**
   * Initial simulation speed multiplier.
   *
   * @type {number}
   */
  speed: number;
  /**
   * Whether simulation starts running immediately.
   *
   * @type {boolean}
   */
  running: boolean;
  /**
   * Live-metrics configuration.
   *
   * @type {LiveMetricsSettings}
   */
  liveMetrics: LiveMetricsSettings;
}

/**
 * Ruleset rebuild request payload.
 *
 * @interface SetRulesetMessage
 * @typedef {SetRulesetMessage}
 */
export interface SetRulesetMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'setRuleset'}
   */
  type: 'setRuleset';
  /**
   * Replacement ruleset.
   *
   * @type {Ruleset<readonly Tribe[]>}
   */
  ruleset: Ruleset<readonly Tribe[]>;
  /**
   * Replacement simulation grid packing.
   *
   * @type {GridFormatMetadata}
   */
  simulationGridFormat: GridFormatMetadata;
}

/**
 * Simulation running-state update payload.
 *
 * @interface SetRunningMessage
 * @typedef {SetRunningMessage}
 */
export interface SetRunningMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'setRunning'}
   */
  type: 'setRunning';
  /**
   * Next running state.
   *
   * @type {boolean}
   */
  running: boolean;
}

/**
 * Simulation speed update payload.
 *
 * @interface SetSpeedMessage
 * @typedef {SetSpeedMessage}
 */
export interface SetSpeedMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'setSpeed'}
   */
  type: 'setSpeed';
  /**
   * Next simulation speed multiplier.
   *
   * @type {number}
   */
  speed: number;
}

/**
 * Brush draw command payload.
 *
 * @interface DrawMessage
 * @typedef {DrawMessage}
 */
export interface DrawMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'draw'}
   */
  type: 'draw';
  /**
   * Draw center x coordinate.
   *
   * @type {number}
   */
  x: number;
  /**
   * Draw center y coordinate.
   *
   * @type {number}
   */
  y: number;
  /**
   * Brush size in cells.
   *
   * @type {number}
   */
  size: number;
  /**
   * Brush footprint shape.
   *
   * @type {BrushShape}
   */
  shape: BrushShape;
  /**
   * Brush fill strategy.
   *
   * @type {BrushFill}
   */
  fill: BrushFill;
  /**
   * Selected tribe ids for painting.
   *
   * @type {string[]}
   */
  tribes: string[];
}

/**
 * Brush footprint preview shown over the rendered grid.
 *
 * @interface BrushPreviewMessage
 * @typedef {BrushPreviewMessage}
 */
export interface BrushPreviewMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'brushPreview'}
   */
  type: 'brushPreview';
  /**
   * Whether the preview should be visible.
   *
   * @type {boolean}
   */
  visible: boolean;
  /**
   * Preview center x coordinate.
   *
   * @type {number}
   */
  x: number;
  /**
   * Preview center y coordinate.
   *
   * @type {number}
   */
  y: number;
  /**
   * Preview brush size.
   *
   * @type {number}
   */
  size: number;
  /**
   * Preview brush shape.
   *
   * @type {BrushShape}
   */
  shape: BrushShape;
}

/**
 * Camera update payload.
 *
 * @interface CameraMessage
 * @typedef {CameraMessage}
 */
export interface CameraMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'camera'}
   */
  type: 'camera';
  /**
   * Viewport scale.
   *
   * @type {number}
   */
  scale: number;
  /**
   * Viewport x offset in world space.
   *
   * @type {number}
   */
  offsetX: number;
  /**
   * Viewport y offset in world space.
   *
   * @type {number}
   */
  offsetY: number;
}

/**
 * Canvas resize payload.
 *
 * @interface ResizeMessage
 * @typedef {ResizeMessage}
 */
export interface ResizeMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'resize'}
   */
  type: 'resize';
  /**
   * Canvas width in pixels.
   *
   * @type {number}
   */
  width: number;
  /**
   * Canvas height in pixels.
   *
   * @type {number}
   */
  height: number;
}

/**
 * Snapshot request payload.
 *
 * @interface GetSnapshotMessage
 * @typedef {GetSnapshotMessage}
 */
export interface GetSnapshotMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'getSnapshot'}
   */
  type: 'getSnapshot';
}

/**
 * Snapshot load payload.
 *
 * @interface LoadSnapshotMessage
 * @typedef {LoadSnapshotMessage}
 */
export interface LoadSnapshotMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'loadSnapshot'}
   */
  type: 'loadSnapshot';
  /**
   * Packed grid payload to load.
   *
   * @type {Uint32Array}
   */
  grid: Uint32Array;
  /**
   * Generation counter for the snapshot.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Packed grid format for the payload.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
}

/**
 * Recording toggle payload.
 *
 * @interface SetRecordingMessage
 * @typedef {SetRecordingMessage}
 */
export interface SetRecordingMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'setRecording'}
   */
  type: 'setRecording';
  /**
   * Whether recording should be enabled.
   *
   * @type {boolean}
   */
  recording: boolean;
}

/**
 * Live-metrics configuration payload.
 *
 * @interface SetLiveMetricsMessage
 * @typedef {SetLiveMetricsMessage}
 */
export interface SetLiveMetricsMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'setLiveMetrics'}
   */
  type: 'setLiveMetrics';
  /**
   * Live-metrics configuration.
   *
   * @type {LiveMetricsSettings}
   */
  liveMetrics: LiveMetricsSettings;
}

/**
 * Recording manifest request payload.
 *
 * @interface GetRecordingMessage
 * @typedef {GetRecordingMessage}
 */
export interface GetRecordingMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'getRecording'}
   */
  type: 'getRecording';
}

/**
 * Step-back request payload.
 *
 * @interface StepBackMessage
 * @typedef {StepBackMessage}
 */
export interface StepBackMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'stepBack'}
   */
  type: 'stepBack';
  /**
   * Number of generations to step back.
   *
   * @type {number}
   */
  count: number;
}

/**
 * Step-forward request payload.
 *
 * @interface StepForwardMessage
 * @typedef {StepForwardMessage}
 */
export interface StepForwardMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'stepForward'}
   */
  type: 'stepForward';
  /**
   * Number of generations to step forward.
   *
   * @type {number}
   */
  count: number;
}

/**
 * Step-cancellation request payload.
 *
 * @interface CancelSteppingMessage
 * @typedef {CancelSteppingMessage}
 */
export interface CancelSteppingMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'cancelStepping'}
   */
  type: 'cancelStepping';
}

/**
 * Request for raw recorded chunks.
 *
 * @interface GetUncompressedChunksMessage
 * @typedef {GetUncompressedChunksMessage}
 */
export interface GetUncompressedChunksMessage {
  /**
   * Worker request discriminator.
   *
   * @type {'getUncompressedChunks'}
   */
  type: 'getUncompressedChunks';
}

/**
 * Recorded chunk payload with grid dimensions and storage metadata.
 *
 * @interface RecordedChunk
 * @typedef {RecordedChunk}
 */
export interface RecordedChunk extends Grid {
  /**
   * Chunk filename.
   *
   * @type {string}
   */
  filename: string;
  /**
   * Raw byte size of the chunk.
   *
   * @type {number}
   */
  rawBytes: number;
  /**
   * Number of packed blocks in the chunk.
   *
   * @type {number}
   */
  blockCount: number;
  /**
   * Raw packed grid format.
   *
   * @type {GridFormatMetadata}
   */
  rawGridFormat: GridFormatMetadata;
  /**
   * Persisted storage grid format.
   *
   * @type {GridFormatMetadata}
   */
  storageGridFormat: GridFormatMetadata;
}

/**
 * Raw recorded chunk payload.
 *
 * @interface UncompressedChunksMessage
 * @typedef {UncompressedChunksMessage}
 */
export interface UncompressedChunksMessage {
  /**
   * Worker response discriminator.
   *
   * @type {'uncompressedChunks'}
   */
  type: 'uncompressedChunks';
  /**
   * Raw chunk payloads with storage metadata.
   *
   * @type {RecordedChunk[]}
   */
  chunks: RecordedChunk[];
}

/**
 * Live metrics payload emitted by the worker.
 *
 * @interface MetricMessage
 * @typedef {MetricMessage}
 */
export interface MetricMessage {
  /**
   * Worker response discriminator.
   *
   * @type {'metrics'}
   */
  type: 'metrics';
  /**
   * Current generation.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Population counts by tribe id.
   *
   * @type {Record<string, number>}
   */
  population: Record<string, number>;
  /**
   * Number of alive cells when available.
   *
   * @type {number}
   */
  aliveCells?: number;
  /**
   * Number of dead cells when available.
   *
   * @type {number}
   */
  deadCells?: number;
  /**
   * Occupied-cell ratio when available.
   *
   * @type {number}
   */
  occupancy?: number;
  /**
   * Shannon entropy of the current population.
   *
   * @type {number}
   */
  shannonEntropy: number;
  /**
   * Simpson diversity index of the current population.
   *
   * @type {number}
   */
  simpsonIndex: number;
  /**
   * Live interface metrics when available.
   *
   * @type {LiveInterfaceMetrics}
   */
  interfaces?: LiveInterfaceMetrics;
  /**
   * Availability of optional metrics.
   *
   * @type {MetricAvailability}
   */
  metricsAvailability?: MetricAvailability;
  /**
   * Extinction generation by tribe id.
   *
   * @type {Record<string, number | null>}
   */
  extinctionTime: Record<string, number | null>;
  /**
   * Total rendered frames.
   *
   * @type {number}
   */
  totalFrames: number;
  /**
   * Current frames per second.
   *
   * @type {number}
   */
  fps: number;
  /**
   * Whether step-back is currently possible.
   *
   * @type {boolean}
   */
  canStepBack: boolean;
  /**
   * Current compressed recording byte count.
   *
   * @type {number}
   */
  recordingBytes: number;
  /**
   * Current raw recording byte count.
   *
   * @type {number}
   */
  recordingRawBytes: number;
}

/**
 * Snapshot payload emitted by the worker.
 *
 * @interface SnapshotMessage
 * @typedef {SnapshotMessage}
 */
export interface SnapshotMessage extends Grid {
  /**
   * Worker response discriminator.
   *
   * @type {'snapshot'}
   */
  type: 'snapshot';
  /**
   * Packed snapshot grid.
   *
   * @type {Uint32Array}
   */
  grid: Uint32Array;
  /**
   * Snapshot generation counter.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Packed grid format for the snapshot.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
}

/**
 * Recording manifest payload emitted by the worker.
 *
 * @interface RecordingMessage
 * @typedef {RecordingMessage}
 */
export interface RecordingMessage extends Grid {
  /**
   * Worker response discriminator.
   *
   * @type {'recording'}
   */
  type: 'recording';
  /**
   * Recording manifest data.
   *
   * @type {RecordingManifest}
   */
  manifest: RecordingManifest;
}

/**
 * Runtime limits payload emitted by the worker.
 *
 * @interface LimitsMessage
 * @typedef {LimitsMessage}
 */
export interface LimitsMessage {
  /**
   * Worker response discriminator.
   *
   * @type {'limits'}
   */
  type: 'limits';
  /**
   * Maximum supported recording bytes.
   *
   * @type {number}
   */
  maxBytes: number;
  /**
   * VRAM budget for buffers.
   *
   * @type {number}
   */
  vramBudgetBytes: number;
  /**
   * Byte size of one frame.
   *
   * @type {number}
   */
  frameByteSize: number;
  /**
   * Whether recording is available for the current frame size.
   *
   * @type {boolean}
   */
  recordingAvailable: boolean;
  /**
   * VRAM used by simulation buffers.
   *
   * @type {number}
   */
  vramSimulationBytes: number;
  /**
   * VRAM used by recording buffers.
   *
   * @type {number}
   */
  vramRecordingBytes: number;
  /**
   * Active recording grid format.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
}

/**
 * Step activity payload emitted by the worker.
 *
 * @interface SteppingMessage
 * @typedef {SteppingMessage}
 */
export interface SteppingMessage {
  /**
   * Worker response discriminator.
   *
   * @type {'stepping'}
   */
  type: 'stepping';
  /**
   * Whether stepping is currently active.
   *
   * @type {boolean}
   */
  active: boolean;
}

/**
 * Chunk-save activity payload emitted by the worker.
 *
 * @interface ChunksSavingMessage
 * @typedef {ChunksSavingMessage}
 */
export interface ChunksSavingMessage {
  /**
   * Worker response discriminator.
   *
   * @type {'chunksSaving'}
   */
  type: 'chunksSaving';
  /**
   * Whether chunk saving is currently active.
   *
   * @type {boolean}
   */
  active: boolean;
}

/**
 * Recording backpressure payload emitted by the worker.
 *
 * @interface BackpressureMessage
 * @typedef {BackpressureMessage}
 */
export interface BackpressureMessage {
  /**
   * Worker response discriminator.
   *
   * @type {'backpressure'}
   */
  type: 'backpressure';
  /**
   * Whether recording backpressure is currently active.
   *
   * @type {boolean}
   */
  active: boolean;
}

/**
 * Storage quota payload emitted by the worker.
 *
 * @interface StorageQuotaMessage
 * @typedef {StorageQuotaMessage}
 */
export interface StorageQuotaMessage {
  /**
   * Worker response discriminator.
   *
   * @type {'storageQuota'}
   */
  type: 'storageQuota';
  /**
   * Estimated used storage bytes.
   *
   * @type {number}
   */
  usedBytes: number;
  /**
   * Estimated storage quota bytes.
   *
   * @type {number}
   */
  quotaBytes: number;
  /**
   * Raw bytes pending compression or persistence.
   *
   * @type {number}
   */
  pendingRawBytes: number;
  /**
   * Compressed bytes already stored.
   *
   * @type {number}
   */
  compressedBytes: number;
  /**
   * Remaining GPU buffer safety margin.
   *
   * @type {number}
   */
  gpuBufferMarginBytes: number;
}

/**
 * Chunk-sealed payload emitted by the worker.
 *
 * @interface ChunkSealedMessage
 * @typedef {ChunkSealedMessage}
 */
export interface ChunkSealedMessage extends Grid {
  /**
   * Worker response discriminator.
   *
   * @type {'chunkSealed'}
   */
  type: 'chunkSealed';
  /**
   * Sealed chunk filename.
   *
   * @type {string}
   */
  filename: string;
  /**
   * Raw byte size of the sealed chunk.
   *
   * @type {number}
   */
  rawBytes: number;
  /**
   * Number of packed blocks in the sealed chunk.
   *
   * @type {number}
   */
  blockCount: number;
  /**
   * Raw packed grid format.
   *
   * @type {GridFormatMetadata}
   */
  rawGridFormat: GridFormatMetadata;
  /**
   * Persisted storage grid format.
   *
   * @type {GridFormatMetadata}
   */
  storageGridFormat: GridFormatMetadata;
}

/**
 * Chunk-codec update payload.
 *
 * @interface UpdateChunkCodecMessage
 * @typedef {UpdateChunkCodecMessage}
 */
export interface UpdateChunkCodecMessage {
  /**
   * Worker request or response discriminator.
   *
   * @type {'updateChunkCodec'}
   */
  type: 'updateChunkCodec';
  /**
   * Chunk filename.
   *
   * @type {string}
   */
  filename: string;
  /**
   * Raw byte size for the chunk.
   *
   * @type {number}
   */
  rawBytes: number;
  /**
   * Codec used to store the chunk.
   *
   * @type {string}
   */
  codec: string;
  /**
   * Stored byte size after compression.
   *
   * @type {number}
   */
  storedBytes: number;
  /**
   * Storage grid format for the chunk.
   *
   * @type {GridFormatMetadata}
   */
  gridFormat: GridFormatMetadata;
}

/**
 * Lightweight generation progress payload.
 *
 * @interface GenerationMessage
 * @typedef {GenerationMessage}
 */
export interface GenerationMessage {
  /**
   * Worker response discriminator.
   *
   * @type {'generation'}
   */
  type: 'generation';
  /**
   * Current generation counter.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Current frames per second.
   *
   * @type {number}
   */
  fps: number;
}

/**
 * Rebuild activity payload emitted by the worker.
 *
 * @interface RebuildingMessage
 * @typedef {RebuildingMessage}
 */
export interface RebuildingMessage {
  /**
   * Worker response discriminator.
   *
   * @type {'rebuilding'}
   */
  type: 'rebuilding';
  /**
   * Whether rebuild is currently active.
   *
   * @type {boolean}
   */
  active: boolean;
}

/**
 * GPU device loss payload emitted by the worker.
 *
 * @interface DeviceLostMessage
 * @typedef {DeviceLostMessage}
 */
export interface DeviceLostMessage {
  /**
   * Worker response discriminator.
   *
   * @type {'deviceLost'}
   */
  type: 'deviceLost';
  /**
   * Device-loss reason string.
   *
   * @type {string}
   */
  reason: string;
}

/**
 * GPU error payload emitted by the worker.
 *
 * @interface GpuErrorMessage
 * @typedef {GpuErrorMessage}
 */
export interface GpuErrorMessage {
  /**
   * Worker response discriminator.
   *
   * @type {'gpuError'}
   */
  type: 'gpuError';
  /**
   * GPU error reason string.
   *
   * @type {string}
   */
  reason: string;
}

/**
 * Inbound messages accepted by the simulation worker.
 *
 * @typedef {WorkerMessage}
 */
export type WorkerMessage =
  | InitMessage
  | SetRulesetMessage
  | SetRunningMessage
  | SetSpeedMessage
  | DrawMessage
  | BrushPreviewMessage
  | CameraMessage
  | ResizeMessage
  | GetSnapshotMessage
  | LoadSnapshotMessage
  | SetRecordingMessage
  | SetLiveMetricsMessage
  | GetRecordingMessage
  | StepBackMessage
  | StepForwardMessage
  | CancelSteppingMessage
  | GetUncompressedChunksMessage
  | UpdateChunkCodecMessage;
