import {ByteSink} from '../snapshot/model/golt-types';

/**
 * Writable ZIP entry stream.
 *
 * @export
 * @interface ZipEntrySink
 * @typedef {ZipEntrySink}
 * @extends {ByteSink}
 */
export interface ZipEntrySink extends ByteSink {
  /**
   * Bytes written to the current ZIP entry.
   *
   * @readonly
   * @type {number}
   */
  readonly bytesWritten: number;
}

/**
 * Callback that writes one ZIP entry.
 *
 * @export
 * @param {ZipEntrySink} entry writable entry sink.
 * @returns {Promise<void>} promise resolved after entry data is written.
 */
export type ZipEntryWriter = (entry: ZipEntrySink) => Promise<void>;
