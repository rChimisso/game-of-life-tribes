/**
 * Source data loaded for one OPFS compression chunk.
 *
 * @export
 * @interface CompressionChunkSource
 * @typedef {CompressionChunkSource}
 */
export interface CompressionChunkSource {
  /**
   * OPFS file handle to overwrite with packed or compressed bytes.
   *
   * @type {FileSystemFileHandle}
   */
  fileHandle: FileSystemFileHandle;
  /**
   * Raw bytes read from the OPFS file.
   *
   * @type {Uint8Array}
   */
  rawBytes: Uint8Array;
}
