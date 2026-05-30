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

export {ZIP64_END_OF_CENTRAL_DIRECTORY, ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR, ZIP64_EXTRA_FIELD, ZIP64_LIMIT, ZIP_CENTRAL_DIRECTORY, ZIP_DATA_DESCRIPTOR, ZIP_END_OF_CENTRAL_DIRECTORY, ZIP_LOCAL_FILE_HEADER};

export type {CentralDirectoryRecord};
