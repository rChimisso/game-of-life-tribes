/**
 * Tribe id rename to apply to committed references.
 *
 * @interface TribeRenamePair
 * @typedef {TribeRenamePair}
 */
export interface TribeRenamePair {
  /**
   * Original tribe id in committed references.
   *
   * @type {string}
   */
  fromId: string;
  /**
   * Replacement tribe id from pending tribes.
   *
   * @type {string}
   */
  toId: string;
}

/**
 * Result of checking whether pending tribe edits can be applied.
 *
 * @interface TribeApplyImpact
 * @typedef {TribeApplyImpact}
 */
export interface TribeApplyImpact {
  /**
   * Whether applying the pending tribes must be blocked.
   *
   * @type {boolean}
   */
  blocked: boolean;
  /**
   * User-facing reasons why applying tribes is blocked.
   *
   * @type {string[]}
   */
  messages: string[];
  /**
   * Tribe id renames that should be propagated to rules and boundary settings.
   *
   * @type {TribeRenamePair[]}
   */
  renamePairs: TribeRenamePair[];
  /**
   * Removed tribe IDs that are still referenced by committed rules.
   *
   * @type {string[]}
   */
  blockingRemovedTribeIds: string[];
  /**
   * Removed tribe IDs that are still used by the active bounded-grid boundary.
   *
   * @type {string[]}
   */
  blockingBoundaryTribeIds: string[];
}

/**
 * Severity of pending tribe packing impact.
 *
 * @typedef {TribePackingImpactLevel}
 */
export type TribePackingImpactLevel = 'none' | 'warning' | 'error';

/**
 * Result of checking whether pending tribe edits require tighter cell packing.
 *
 * @interface TribePackingImpact
 * @typedef {TribePackingImpact}
 */
export interface TribePackingImpact {
  /**
   * Message severity.
   *
   * @type {TribePackingImpactLevel}
   */
  level: TribePackingImpactLevel;
  /**
   * User-facing packing impact message.
   *
   * @type {(string | null)}
   */
  message: string | null;
  /**
   * Whether applying the pending tribes must be blocked.
   *
   * @type {boolean}
   */
  blocked: boolean;
}
