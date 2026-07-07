import {Become, MAJORITY_BECOME_KIND, MINORITY_BECOME_KIND, Tribe} from './rule';

/**
 * Ranked outcome that provides context for rank-derived combination inputs.
 *
 * @typedef {RankedBecome}
 */
export type RankedBecome = Extract<Become<Tribe[]>, {kind: typeof MAJORITY_BECOME_KIND | typeof MINORITY_BECOME_KIND}>;

/**
 * One semantic validation issue.
 *
 * @interface BecomeValidationIssue
 * @typedef {BecomeValidationIssue}
 */
export interface BecomeValidationIssue {
  /**
   * Invalid value path.
   *
   * @type {string}
   */
  path: string;
  /**
   * Validation message.
   *
   * @type {string}
   */
  message: string;
}

/**
 * Select value prefix for concrete tribe inputs.
 *
 * @type {"tribe:"}
 */
export const TRIBE_INPUT_PREFIX = 'tribe:';

/**
 * Select value for the current-cell tribe input.
 *
 * @type {"selector:same"}
 */
export const SAME_INPUT_VALUE = 'selector:same';

/**
 * Select value for tribes different from the current-cell tribe.
 *
 * @type {"selector:different"}
 */
export const DIFFERENT_INPUT_VALUE = 'selector:different';

/**
 * Select value for the active ranked candidates.
 *
 * @type {"selector:rank"}
 */
export const RANK_INPUT_VALUE = 'selector:rank';
