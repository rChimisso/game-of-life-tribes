/**
 * User-visible message for canonical snapshot payload validation failures.
 *
 * @type {string}
 */
export const INVALID_SNAPSHOT_PAYLOAD_MESSAGE = 'Snapshot contains invalid or unsupported data and could not be loaded.';

/**
 * Sanitizer context.
 *
 * @interface SanitizerContext
 * @typedef {SanitizerContext}
 */
export interface SanitizerContext {
  /**
   * Stripped unsupported field paths.
   *
   * @type {string[]}
   */
  strippedFields: string[];
  /**
   * Invalid canonical payload details.
   *
   * @type {string[]}
   */
  errors: string[];
}

/**
 * Plain object shape used while handling untrusted JSON.
 *
 * @typedef {UnknownRecord}
 */
export type UnknownRecord = Record<string, unknown>;

/**
 * Operator values accepted by comparison clauses.
 *
 * @type {ReadonlySet<string>}
 */
export const OPERATORS: ReadonlySet<string> = new Set([
  '=',
  '\u2260',
  '>',
  '<',
  '\u2265',
  '\u2264'
]);

/**
 * Validation reason used for invalid tribe references.
 *
 * @type {string}
 */
export const EXPECTED_KNOWN_TRIBE_ID_ERROR = 'expected known tribe id';
