import {writeIndexedPngFrame} from './indexed-png';
import {buildIndexedPngPalette} from './indexed-png-palette';
import {createPngFrameEntryPath} from './png-frame-entry-path';
import {PngFrameExportOptions, PngFrameProgressReporter} from './png-frame-export-types';
import {ZipWriter} from '../../zip/zip-writer';
import {PackedRecordedFrame} from '../recording-frame-stream';

import {Tribe} from '~gol/feature/home/model/rule';

/**
 * Writes recorded frames as indexed-color PNG ZIP entries.
 *
 * @export
 * @class PngFrameExportWriter
 * @typedef {PngFrameExportWriter}
 */
class PngFrameExportWriter {
  /**
   * PNG palette shared by all frames in this export.
   *
   * @private
   * @readonly
   * @type {ReturnType<typeof buildIndexedPngPalette>}
   */
  private readonly palette: ReturnType<typeof buildIndexedPngPalette>;

  /**
   * Width used for zero-padded frame numbers.
   *
   * @private
   * @readonly
   * @type {number}
   */
  private readonly filenameFrameWidth: number;

  /**
   * Number of PNG frames written so far.
   *
   * @private
   * @type {number}
   */
  private framesWritten = 0;

  /**
   * Creates a PNG frame export writer.
   *
   * @param {ZipWriter} zip target ZIP writer.
   * @param {readonly Pick<Tribe, 'id' | 'color'>[]} tribes ordered tribe metadata.
   * @param {number} selectedFrameCount selected frame count.
   * @param {PngFrameExportOptions} options export options.
   */
  public constructor(
    private readonly zip: ZipWriter,
    tribes: readonly Pick<Tribe, 'id' | 'color'>[],
    selectedFrameCount: number,
    private readonly options: PngFrameExportOptions
  ) {
    this.palette = buildIndexedPngPalette(tribes);
    this.filenameFrameWidth = Math.max(1, String(selectedFrameCount).length);
  }

  /**
   * Writes one frame to the ZIP archive.
   *
   * @public
   * @async
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {PngFrameProgressReporter} [onProgress] current-frame progress reporter.
   */
  public async writeFrame(frame: PackedRecordedFrame, onProgress?: PngFrameProgressReporter): Promise<void> {
    this.framesWritten++;
    const entryPath = this.createEntryPath(frame);
    await this.zip.addEntry(entryPath, entry => writeIndexedPngFrame(entry, frame, this.palette, {
      shouldCancel: this.options.shouldCancel,
      onRowsProcessed: onProgress
    }));
  }

  /**
   * Finishes PNG export.
   *
   * @public
   * @async
   */
  public async finish(): Promise<void> {
    console.log('[GOLT] PNG frame export finished', {
      framesWritten: this.framesWritten,
      bitDepth: this.palette.bitDepth,
      stateCount: this.palette.stateCount
    });
  }

  /**
   * Creates a stable ZIP entry path for one PNG frame.
   *
   * @private
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @returns {string} PNG ZIP entry path.
   */
  private createEntryPath(frame: PackedRecordedFrame): string {
    return createPngFrameEntryPath(this.framesWritten, this.filenameFrameWidth, frame.generation);
  }
}

export {PngFrameExportWriter};

export type {PngFrameExportOptions, PngFrameProgressReporter};
