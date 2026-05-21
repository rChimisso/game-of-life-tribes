import {finalizeCrc32, updateCrc32} from './zip-crc32';
import {ZipEntrySink, ZipEntryWriter} from './zip-types';

/**
 * Directory name for OPFS download storage.
 *
 * @type {string}
 */
const OPFS_DOWNLOAD_DIR = 'gol-downloads';

/**
 * ZIP local file header signature.
 *
 * @type {number}
 */
const ZIP_LOCAL_FILE_HEADER = 0x04034b50;

/**
 * ZIP data descriptor signature.
 *
 * @type {number}
 */
const ZIP_DATA_DESCRIPTOR = 0x08074b50;

/**
 * ZIP central directory file header signature.
 *
 * @type {number}
 */
const ZIP_CENTRAL_DIRECTORY = 0x02014b50;

/**
 * ZIP end of central directory record signature.
 *
 * @type {number}
 */
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;

/**
 * ZIP64 end of central directory record signature.
 *
 * @type {number}
 */
const ZIP64_END_OF_CENTRAL_DIRECTORY = 0x06064b50;

/**
 * ZIP64 end of central directory locator signature.
 *
 * @type {number}
 */
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR = 0x07064b50;

/**
 * ZIP64 extra field signature.
 *
 * @type {number}
 */
const ZIP64_EXTRA_FIELD = 0x0001;

/**
 * ZIP64 size limit.
 *
 * @type {number}
 */
const ZIP64_LIMIT = 0xffffffff;

/**
 * Central-directory metadata retained for one streamed ZIP entry.
 *
 * @interface CentralDirectoryRecord
 * @typedef {CentralDirectoryRecord}
 */
interface CentralDirectoryRecord {
  /**
   * Encoded entry path.
   *
   * @type {Uint8Array}
   */
  nameBytes: Uint8Array;
  /**
   * Entry CRC-32 value.
   *
   * @type {number}
   */
  crc: number;
  /**
   * Uncompressed entry size.
   *
   * @type {number}
   */
  size: number;
  /**
   * Local file header offset.
   *
   * @type {number}
   */
  localOffset: number;
}

/**
 * Writes a little-endian unsigned 64-bit integer.
 *
 * @param {DataView} view target data view.
 * @param {number} offset byte offset.
 * @param {number} value integer value.
 */
function setUint64(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value % 0x100000000, true);
  view.setUint32(offset + 4, Math.floor(value / 0x100000000), true);
}

/**
 * OPFS-backed ZIP writer using data descriptors for streamed entries.
 *
 * @export
 * @class ZipWriter
 * @typedef {ZipWriter}
 */
export class ZipWriter {
  /**
   * Text encoder for entry paths.
   *
   * @private
   * @readonly
   * @type {TextEncoder}
   */
  private readonly encoder = new TextEncoder();

  /**
   * Central directory records for streamed entries.
   *
   * @private
   * @readonly
   * @type {CentralDirectoryRecord[]}
   */
  private readonly records: CentralDirectoryRecord[] = [];

  /**
   * Current byte offset in the ZIP file.
   *
   * @private
   * @type {number}
   */
  private offset = 0;

  /**
   * Whether the ZIP file has been finalized or aborted.
   *
   * @private
   * @type {boolean}
   */
  private closed = false;

  /**
   * Creates a ZIP writer around an OPFS writable stream.
   *
   * @param {FileSystemWritableFileStream} writable opfs writable stream.
   * @param {FileSystemFileHandle} fileHandle opfs file handle for the archive.
   */
  private constructor(private readonly writable: FileSystemWritableFileStream, private readonly fileHandle: FileSystemFileHandle) {}

  /**
   * Opens a new ZIP file in OPFS.
   *
   * @public
   * @static
   * @async
   * @param {string} filename opfs filename for the ZIP archive.
   * @returns {Promise<ZipWriter>} opened ZIP writer.
   */
  public static async open(filename: string): Promise<ZipWriter> {
    const fileHandle = await (await (await navigator.storage.getDirectory()).getDirectoryHandle(OPFS_DOWNLOAD_DIR, {create: true})).getFileHandle(filename, {create: true});
    return new ZipWriter(await fileHandle.createWritable(), fileHandle);
  }

  /**
   * Adds a streamed entry to the ZIP archive.
   *
   * @public
   * @async
   * @param {string} path zip entry path.
   * @param {ZipEntryWriter} writer callback that writes entry bytes.
   */
  public async addEntry(path: string, writer: ZipEntryWriter): Promise<void> {
    const nameBytes = this.encoder.encode(path);
    const localOffset = this.offset;
    await this.writeLocalHeader(nameBytes);
    let crc = 0xffffffff;
    let size = 0;
    const entry: ZipEntrySink = {
      get bytesWritten(): number {
        return size;
      },
      write: async chunk => {
        crc = updateCrc32(crc, chunk);
        size += chunk.byteLength;
        await this.write(chunk);
      }
    };
    await writer(entry);
    const finalCrc = finalizeCrc32(crc);
    await this.writeDataDescriptor(finalCrc, size);
    this.records.push({
      nameBytes,
      crc: finalCrc,
      size,
      localOffset
    });
  }

  /**
   * Finalizes the ZIP archive and returns the OPFS file.
   *
   * @public
   * @async
   * @returns {Promise<File>} finalized OPFS-backed ZIP file.
   */
  public async finalize(): Promise<File> {
    const centralDirOffset = this.offset;
    let centralDirSize = 0;
    for (const record of this.records) {
      const entry = this.createCentralDirectoryEntry(record);
      centralDirSize += entry.byteLength;
      await this.write(entry);
    }
    await this.writeEndRecords(centralDirOffset, centralDirSize);
    await this.writable.close();
    this.closed = true;
    return this.fileHandle.getFile();
  }

  /**
   * Aborts the underlying OPFS write.
   *
   * @public
   * @async
   */
  public async abort(): Promise<void> {
    if (!this.closed) {
      await this.writable.abort();
      this.closed = true;
    }
  }

  /**
   * Writes one local file header with descriptor mode enabled.
   *
   * @private
   * @async
   * @param {Uint8Array} nameBytes encoded entry path bytes.
   */
  private async writeLocalHeader(nameBytes: Uint8Array): Promise<void> {
    const header = new Uint8Array(30 + nameBytes.byteLength);
    const view = new DataView(header.buffer);
    view.setUint32(0, ZIP_LOCAL_FILE_HEADER, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0008, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, 0, true);
    view.setUint32(18, 0, true);
    view.setUint32(22, 0, true);
    view.setUint16(26, nameBytes.byteLength, true);
    view.setUint16(28, 0, true);
    header.set(nameBytes, 30);
    await this.write(header);
  }

  /**
   * Writes a data descriptor after streamed entry bytes.
   *
   * @private
   * @async
   * @param {number} crc finalized entry CRC-32.
   * @param {number} size entry byte size.
   */
  private async writeDataDescriptor(crc: number, size: number): Promise<void> {
    const zip64 = size > ZIP64_LIMIT;
    const descriptor = new Uint8Array(zip64 ? 24 : 16);
    const view = new DataView(descriptor.buffer);
    view.setUint32(0, ZIP_DATA_DESCRIPTOR, true);
    view.setUint32(4, crc, true);
    if (zip64) {
      setUint64(view, 8, size);
      setUint64(view, 16, size);
    } else {
      view.setUint32(8, size, true);
      view.setUint32(12, size, true);
    }
    await this.write(descriptor);
  }

  /**
   * Creates a central-directory entry.
   *
   * @private
   * @param {CentralDirectoryRecord} record entry metadata.
   * @returns {Uint8Array} encoded central-directory entry.
   */
  private createCentralDirectoryEntry(record: CentralDirectoryRecord): Uint8Array {
    const needsZip64 = record.size > ZIP64_LIMIT || record.localOffset > ZIP64_LIMIT;
    const extraLength = needsZip64 ? 28 : 0;
    const entry = new Uint8Array(46 + record.nameBytes.byteLength + extraLength);
    const view = new DataView(entry.buffer);
    view.setUint32(0, ZIP_CENTRAL_DIRECTORY, true);
    view.setUint16(4, 45, true);
    view.setUint16(6, needsZip64 ? 45 : 20, true);
    view.setUint16(8, 0x0008, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, record.crc, true);
    view.setUint32(20, needsZip64 ? ZIP64_LIMIT : record.size, true);
    view.setUint32(24, needsZip64 ? ZIP64_LIMIT : record.size, true);
    view.setUint16(28, record.nameBytes.byteLength, true);
    view.setUint16(30, extraLength, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, needsZip64 ? ZIP64_LIMIT : record.localOffset, true);
    entry.set(record.nameBytes, 46);

    if (needsZip64) {
      const extraOffset = 46 + record.nameBytes.byteLength;
      view.setUint16(extraOffset, ZIP64_EXTRA_FIELD, true);
      view.setUint16(extraOffset + 2, 24, true);
      setUint64(view, extraOffset + 4, record.size);
      setUint64(view, extraOffset + 12, record.size);
      setUint64(view, extraOffset + 20, record.localOffset);
    }

    return entry;
  }

  /**
   * Writes ZIP end records.
   *
   * @private
   * @async
   * @param {number} centralDirOffset central-directory byte offset.
   * @param {number} centralDirSize central-directory byte size.
   */
  private async writeEndRecords(centralDirOffset: number, centralDirSize: number): Promise<void> {
    const needsZip64 = this.records.length > 0xffff || centralDirOffset > ZIP64_LIMIT || centralDirSize > ZIP64_LIMIT;
    if (needsZip64) {
      await this.writeZip64EndRecords(centralDirOffset, centralDirSize);
    }
    const eocd = new Uint8Array(22);
    const view = new DataView(eocd.buffer);
    view.setUint32(0, ZIP_END_OF_CENTRAL_DIRECTORY, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, needsZip64 ? 0xffff : this.records.length, true);
    view.setUint16(10, needsZip64 ? 0xffff : this.records.length, true);
    view.setUint32(12, needsZip64 ? ZIP64_LIMIT : centralDirSize, true);
    view.setUint32(16, needsZip64 ? ZIP64_LIMIT : centralDirOffset, true);
    view.setUint16(20, 0, true);
    await this.write(eocd);
  }

  /**
   * Writes ZIP64 end records.
   *
   * @private
   * @async
   * @param {number} centralDirOffset central-directory byte offset.
   * @param {number} centralDirSize central-directory byte size.
   */
  private async writeZip64EndRecords(centralDirOffset: number, centralDirSize: number): Promise<void> {
    const zip64EocdOffset = this.offset;
    const eocd = new Uint8Array(56);
    const view = new DataView(eocd.buffer);
    view.setUint32(0, ZIP64_END_OF_CENTRAL_DIRECTORY, true);
    setUint64(view, 4, 44);
    view.setUint16(12, 45, true);
    view.setUint16(14, 45, true);
    view.setUint32(16, 0, true);
    view.setUint32(20, 0, true);
    setUint64(view, 24, this.records.length);
    setUint64(view, 32, this.records.length);
    setUint64(view, 40, centralDirSize);
    setUint64(view, 48, centralDirOffset);
    await this.write(eocd);
    const locator = new Uint8Array(20);
    const locatorView = new DataView(locator.buffer);
    locatorView.setUint32(0, ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR, true);
    locatorView.setUint32(4, 0, true);
    setUint64(locatorView, 8, zip64EocdOffset);
    locatorView.setUint32(16, 1, true);
    await this.write(locator);
  }

  /**
   * Writes raw bytes to OPFS and advances the archive offset.
   *
   * @private
   * @async
   * @param {Uint8Array} chunk bytes to write.
   */
  private async write(chunk: Uint8Array): Promise<void> {
    await this.writable.write(chunk);
    this.offset += chunk.byteLength;
  }
}
