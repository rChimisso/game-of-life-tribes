import {GridFormatMetadata} from './grid-format';
import {RecordingManifest} from './recording';
import {Ruleset, Tribe} from './rule';

export type BrushShape = 'square' | 'round' | 'diamond' | 'vline' | 'hline';

export interface InitMessage {
  type: 'init';
  canvas: OffscreenCanvas;
  ruleset: Ruleset<readonly Tribe[]>;
  simulationGridFormat: GridFormatMetadata;
  recording: boolean;
  speed: number;
  running: boolean;
}

export interface SetRulesetMessage {
  type: 'setRuleset';
  ruleset: Ruleset<readonly Tribe[]>;
  simulationGridFormat: GridFormatMetadata;
}

export interface SetRunningMessage {
  type: 'setRunning';
  running: boolean;
}

export interface SetSpeedMessage {
  type: 'setSpeed';
  speed: number;
}

export interface DrawMessage {
  type: 'draw';
  x: number;
  y: number;
  size: number;
  shape: BrushShape;
  fill: 'full' | 'spray' | 'outline';
  tribes: string[];
}

export interface CameraMessage {
  type: 'camera';
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ResizeMessage {
  type: 'resize';
  width: number;
  height: number;
}

export interface GetSnapshotMessage {
  type: 'getSnapshot';
}

export interface LoadSnapshotMessage {
  type: 'loadSnapshot';
  grid: Uint32Array;
  generation: number;
  gridFormat: GridFormatMetadata;
}

export interface SetRecordingMessage {
  type: 'setRecording';
  recording: boolean;
}

export interface GetRecordingMessage {
  type: 'getRecording';
}

export interface StepBackMessage {
  type: 'stepBack';
  count: number;
}

export interface StepForwardMessage {
  type: 'stepForward';
  count: number;
}

export interface CancelSteppingMessage {
  type: 'cancelStepping';
}

export interface GetUncompressedChunksMessage {
  type: 'getUncompressedChunks';
}

export interface UncompressedChunksMessage {
  type: 'uncompressedChunks';
  chunks: {
    filename: string;
    rawBytes: number;
    blockCount: number;
    cols: number;
    rows: number;
    rawGridFormat: GridFormatMetadata;
    storageGridFormat: GridFormatMetadata;
  }[];
}

export interface MetricMessage {
  type: 'metrics';
  generation: number;
  population: Record<string, number>;
  shannonEntropy: number;
  simpsonIndex: number;
  boundaryLength: number;
  extinctionTime: Record<string, number | null>;
  totalFrames: number;
  fps: number;
  canStepBack: boolean;
  recordingBytes: number;
  recordingRawBytes: number;
}

export interface SnapshotMessage {
  type: 'snapshot';
  grid: Uint32Array;
  generation: number;
  cols: number;
  rows: number;
  gridFormat: GridFormatMetadata;
}

export interface RecordingMessage {
  type: 'recording';
  manifest: RecordingManifest;
  cols: number;
  rows: number;
}

export interface LimitsMessage {
  type: 'limits';
  maxBytes: number;
  vramBudgetBytes: number;
  frameByteSize: number;
  recordingAvailable: boolean;
  vramSimulationBytes: number;
  vramRecordingBytes: number;
  gridFormat: GridFormatMetadata;
}

export interface SteppingMessage {
  type: 'stepping';
  active: boolean;
}

export interface ChunksSavingMessage {
  type: 'chunksSaving';
  active: boolean;
}

export interface BackpressureMessage {
  type: 'backpressure';
  active: boolean;
}

export interface StorageQuotaMessage {
  type: 'storageQuota';
  usedBytes: number;
  quotaBytes: number;
  pendingRawBytes: number;
  compressedBytes: number;
  gpuBufferMarginBytes: number;
}

export interface ChunkSealedMessage {
  type: 'chunkSealed';
  filename: string;
  rawBytes: number;
  blockCount: number;
  cols: number;
  rows: number;
  rawGridFormat: GridFormatMetadata;
  storageGridFormat: GridFormatMetadata;
}

export interface UpdateChunkCodecMessage {
  type: 'updateChunkCodec';
  filename: string;
  codec: string;
  storedBytes: number;
  gridFormat: GridFormatMetadata;
}

export interface GenerationMessage {
  type: 'generation';
  generation: number;
  fps: number;
}

export interface RebuildingMessage {
  type: 'rebuilding';
  active: boolean;
}

export interface DeviceLostMessage {
  type: 'deviceLost';
  reason: string;
}

export interface GpuErrorMessage {
  type: 'gpuError';
  reason: string;
}

export type WorkerMessage =
  | InitMessage
  | SetRulesetMessage
  | SetRunningMessage
  | SetSpeedMessage
  | DrawMessage
  | CameraMessage
  | ResizeMessage
  | GetSnapshotMessage
  | LoadSnapshotMessage
  | SetRecordingMessage
  | GetRecordingMessage
  | StepBackMessage
  | StepForwardMessage
  | CancelSteppingMessage
  | GetUncompressedChunksMessage
  | UpdateChunkCodecMessage;
