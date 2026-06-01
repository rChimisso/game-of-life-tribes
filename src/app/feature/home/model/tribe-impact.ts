/**
 * Tribe id rename to apply to committed rules.
 *
 * @interface TribeRenamePair
 * @typedef {TribeRenamePair}
 */
export interface TribeRenamePair {
  /**
   * Original tribe id in committed rules.
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
   * User-facing reason why applying tribes is blocked.
   *
   * @type {(string | null)}
   */
  message: string | null;
  /**
   * Tribe id renames that should be propagated to rules.
   *
   * @type {TribeRenamePair[]}
   */
  renamePairs: TribeRenamePair[];
  /**
   * Removed tribe ids that are still referenced by committed rules.
   *
   * @type {string[]}
   */
  blockingRemovedTribeIds: string[];
}
