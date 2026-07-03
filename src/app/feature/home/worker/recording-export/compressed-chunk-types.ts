import {DownloadFrameRange} from '../../model/download';
import {GridSettings} from '../../model/grid';
import {ChunkMeta, Recording} from '../../model/recording';

import {Rule, Tribe} from '~gol/feature/home/model/rule';

/**
 * Cancellation and progress hooks for compressed chunk export.
 *
 * @interface CompressedChunkExportOptions
 * @typedef {CompressedChunkExportOptions}
 */
export interface CompressedChunkExportOptions {
  /**
   * Returns whether export cancellation was requested.
   *
   * @type {() => boolean}
   */
  shouldCancel: () => boolean;
  /**
   * Reports export progress.
   *
   * @type {(percent: number, status: string) => void}
   */
  onProgress: (percent: number, status: string) => void;
}

/**
 * Simulation metadata written beside exported recording chunks.
 *
 * @interface CompressedChunkExportMetadata
 * @typedef {CompressedChunkExportMetadata}
 */
export interface CompressedChunkExportMetadata extends Pick<GridSettings, 'topology' | 'boundaryTribe'> {
  /**
   * Deterministic random seed for probabilistic rules.
   *
   * @type {number}
   */
  randomSeed: number;
  /**
   * Snapshot tribe color metadata.
   *
   * @type {readonly Tribe[]}
   */
  tribes: readonly Tribe[];
  /**
   * Snapshot rule metadata.
   *
   * @type {Rule<Tribe[]>[]}
   */
  rules: Rule<Tribe[]>[];
}

/**
 * Exported chunk source type.
 *
 * @typedef {CompressedChunkExportSource}
 */
export type CompressedChunkExportSource = 'copied' | 'rebuilt';

/**
 * Planned output chunk.
 *
 * @interface PlannedCompressedChunk
 * @typedef {PlannedCompressedChunk}
 */
export interface PlannedCompressedChunk {
  /**
   * Original source chunk metadata.
   *
   * @type {ChunkMeta}
   */
  sourceChunk: ChunkMeta;
  /**
   * Source chunk global frame start index.
   *
   * @type {number}
   */
  sourceStartIndex: number;
  /**
   * Local start frame included from the source chunk.
   *
   * @type {number}
   */
  localStart: number;
  /**
   * Local end frame included from the source chunk.
   *
   * @type {number}
   */
  localEnd: number;
  /**
   * Whether this output chunk can copy source bytes directly.
   *
   * @type {CompressedChunkExportSource}
   */
  source: CompressedChunkExportSource;
}

/**
 * Exported chunk file ready for ZIP writing.
 *
 * @interface PreparedCompressedChunk
 * @typedef {PreparedCompressedChunk}
 */
export interface PreparedCompressedChunk {
  /**
   * Output chunk metadata.
   *
   * @type {ChunkMeta}
   */
  chunk: ChunkMeta;
  /**
   * Output source type.
   *
   * @type {CompressedChunkExportSource}
   */
  source: CompressedChunkExportSource;
  /**
   * File object containing output chunk bytes.
   *
   * @type {File}
   */
  file: File;
  /**
   * Optional cleanup for download-only rebuilt chunk data.
   *
   * @type {(() => Promise<void>) | null}
   */
  cleanup: (() => Promise<void>) | null;
}

/**
 * Compressed chunk export request.
 *
 * @interface CompressedChunkExportRequest
 * @typedef {CompressedChunkExportRequest}
 */
export interface CompressedChunkExportRequest {
  /**
   * Recording dimensions and manifest.
   *
   * @type {Recording}
   */
  recording: Recording;
  /**
   * Selected frame range.
   *
   * @type {(DownloadFrameRange | null)}
   */
  frameRange: DownloadFrameRange | null;
  /**
   * Simulation metadata.
   *
   * @type {CompressedChunkExportMetadata}
   */
  metadata: CompressedChunkExportMetadata;
}
