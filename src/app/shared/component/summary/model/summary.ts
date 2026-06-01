/**
 * Part of a summary for a clause/rule.
 *
 * @typedef {SummaryPart}
 */
export type SummaryPart = {
  kind: 'text';
  text: string;
} | {
  kind: 'tribes';
  tribes: string[];
};

/**
 * Color information for a tribe in a summary.
 *
 * @interface SummaryTribeColor
 * @typedef {SummaryTribeColor}
 */
export interface SummaryTribeColor {
  /**
   * Tribe ID.
   *
   * @type {string}
   */
  id: string;
  /**
   * Tribe color.
   *
   * @type {string}
   */
  color: string;
}
