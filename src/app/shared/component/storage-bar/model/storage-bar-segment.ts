/**
 * Storage bar segment data.
 *
 * @interface StorageBarSegment
 * @typedef {StorageBarSegment}
 */
export interface StorageBarSegment {
  /**
   * Label.
   *
   * @type {string}
   */
  label: string;
  /**
   * Raw value.
   *
   * @type {number}
   */
  value: number;
  /**
   * Formatted value.
   *
   * @type {string}
   */
  formatted: string;
  /**
   * Segment color.
   *
   * @type {string}
   */
  color: string;
}
