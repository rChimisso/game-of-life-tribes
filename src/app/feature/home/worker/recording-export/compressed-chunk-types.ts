import {DownloadFrameRange} from '../../model/download';
import {ChunkMeta, RecordingManifest} from '../../model/recording';
import {GoltStateData} from '../snapshot/model/golt-types';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Cancellation and progress hooks for compressed chunk export.
 *
 * @export
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
 * Recording data used by compressed chunk export.
 *
 * @export
 * @typedef {CompressedChunkExportRecording}
 */
export type CompressedChunkExportRecording = Grid & {manifest: RecordingManifest};

/**
 * Simulation metadata written beside exported recording chunks.
 *
 * @export
 * @interface CompressedChunkExportMetadata
 * @typedef {CompressedChunkExportMetadata}
 */
export interface CompressedChunkExportMetadata {
  /**
   * Snapshot tribe color metadata.
   *
   * @type {GoltStateData['tribes']}
   */
  tribes: GoltStateData['tribes'];
  /**
   * Snapshot rule metadata.
   *
   * @type {GoltStateData['rules']}
   */
  rules: GoltStateData['rules'];
}

/**
 * Exported chunk source type.
 *
 * @export
 * @typedef {CompressedChunkExportSource}
 */
export type CompressedChunkExportSource = 'copied' | 'rebuilt';

/**
 * Planned output chunk.
 *
 * @export
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
 * @export
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
 * @export
 * @interface CompressedChunkExportRequest
 * @typedef {CompressedChunkExportRequest}
 */
export interface CompressedChunkExportRequest {
  /**
   * Recording dimensions and manifest.
   *
   * @type {CompressedChunkExportRecording}
   */
  recording: CompressedChunkExportRecording;
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
