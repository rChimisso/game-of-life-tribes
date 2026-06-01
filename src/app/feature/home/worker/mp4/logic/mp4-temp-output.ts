import type {StreamTargetChunk} from 'mediabunny';

import {assertNotCancelled, createUniqueMp4TempFilename, isMissingOpfsEntry, removeStaleMp4Files} from './mp4-temp-output-logic';
import {ZipWriter} from '../../zip/zip-writer';
import {Mp4ZipCopyOptions} from '../model/mp4-temp-output-types';
import {MP4_ZIP_ENTRY_PATH} from '../model/mp4-types';

import {openTempOpfsDirectory} from '~gol/feature/home/logic/opfs-temp';
import {GOLT_TEMP_MP4_DIR} from '~gol/feature/home/model/opfs';

/**
 * OPFS-backed temporary MP4 output.
 *
 * @class Mp4TempOutput
 * @typedef {Mp4TempOutput}
 */
export class Mp4TempOutput {
  /**
   * Whether the OPFS writable stream has been closed or aborted.
   *
   * @private
   * @type {boolean}
   */
  private writableClosed = false;

  /**
   * Whether the temporary file has already been removed.
   *
   * @private
   * @type {boolean}
   */
  private removed = false;

  /**
   * Creates a temporary MP4 output.
   *
   * @param {FileSystemDirectoryHandle} directory temporary mp4 directory.
   * @param {FileSystemFileHandle} fileHandle temporary mp4 file handle.
   * @param {FileSystemWritableFileStream} writable writable OPFS stream.
   * @param {string} filename temporary MP4 filename.
   */
  private constructor(private readonly directory: FileSystemDirectoryHandle, private readonly fileHandle: FileSystemFileHandle, private readonly writable: FileSystemWritableFileStream, private readonly filename: string) {}

  /**
   * Opens a new temporary MP4 output file.
   *
   * @public
   * @static
   * @async
   * @returns {Promise<Mp4TempOutput>} temporary MP4 output.
   */
  public static async create(): Promise<Mp4TempOutput> {
    const directory = await openTempOpfsDirectory(GOLT_TEMP_MP4_DIR);
    await removeStaleMp4Files(directory);
    const filename = createUniqueMp4TempFilename();
    const fileHandle = await directory.getFileHandle(filename, {create: true});
    const writable = await fileHandle.createWritable();
    return new Mp4TempOutput(directory, fileHandle, writable, filename);
  }

  /**
   * Creates the writable stream used by Mediabunny.
   *
   * @public
   * @returns {WritableStream<StreamTargetChunk>} MP4 byte target stream.
   */
  public createWritableStream(): WritableStream<StreamTargetChunk> {
    return new WritableStream<StreamTargetChunk>({
      write: chunk => this.writeChunk(chunk),
      close: () => this.closeWritable(),
      abort: () => this.abortWritable()
    });
  }

  /**
   * Writes the finalized MP4 file into the ZIP archive.
   *
   * @public
   * @async
   * @param {ZipWriter} zip target ZIP archive.
   * @param {Mp4ZipCopyOptions} options zip copy options.
   */
  public async writeToZip(zip: ZipWriter, options: Mp4ZipCopyOptions): Promise<void> {
    const file = await this.fileHandle.getFile();
    const totalBytes = file.size;
    await zip.addEntry(MP4_ZIP_ENTRY_PATH, async entry => {
      const reader = file.stream().getReader();
      let bytesWritten = 0;
      let done = false;
      while (!done) {
        assertNotCancelled(options);
        const result = await reader.read();
        done = result.done;
        if (!done && result.value) {
          await entry.write(result.value);
          bytesWritten += result.value.byteLength;
          options.onProgress(bytesWritten, totalBytes);
        }
      }
    });
  }

  /**
   * Releases and removes the temporary MP4 output.
   *
   * @public
   * @async
   */
  public async dispose(): Promise<void> {
    if (!this.writableClosed) {
      try {
        await this.abortWritable();
      } catch (error) {
        console.warn('[GOLT] Failed to abort temporary MP4 output:', error);
      }
    }
    await this.removeFile();
  }

  /**
   * Writes one positioned Mediabunny stream chunk.
   *
   * @private
   * @async
   * @param {StreamTargetChunk} chunk positioned stream chunk.
   */
  private async writeChunk(chunk: StreamTargetChunk): Promise<void> {
    await this.writable.write({
      type: chunk.type,
      position: chunk.position,
      data: chunk.data
    });
  }

  /**
   * Closes the OPFS writable stream.
   *
   * @private
   * @async
   */
  private async closeWritable(): Promise<void> {
    if (!this.writableClosed) {
      await this.writable.close();
      this.writableClosed = true;
    }
  }

  /**
   * Aborts the OPFS writable stream.
   *
   * @private
   * @async
   */
  private async abortWritable(): Promise<void> {
    if (!this.writableClosed) {
      await this.writable.abort();
      this.writableClosed = true;
    }
  }

  /**
   * Removes the temporary MP4 file.
   *
   * @private
   * @async
   */
  private async removeFile(): Promise<void> {
    if (!this.removed) {
      this.removed = true;
      try {
        await this.directory.removeEntry(this.filename);
      } catch (error) {
        if (!isMissingOpfsEntry(error)) {
          console.warn('[GOLT] Failed to remove temporary MP4 file:', this.filename, error);
        }
      }
    }
  }
}
