/**
 * Valid number for the count of a cell's neighbors.
 *
 * @export
 * @typedef {NeighborCount}
 */
export type NeighborCount = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Tribe.
 *
 * @export
 * @interface Tribe
 * @typedef {Tribe}
 */
export interface Tribe<T extends string = string> {
  /**
   * Tribe ID.
   *
   * @type {TribeId}
   */
  id: T;
  /**
   * Tribe color in RGB hex, no #.
   *
   * @type {string}
   */
  color: string;
}

/**
 * Editable tribe draft used only by the UI.
 *
 * @export
 * @interface EditableTribe
 * @typedef {EditableTribe}
 */
export interface EditableTribe<T extends string = string> extends Tribe<T> {
  /**
   * Stable UI key for Angular tracking.
   *
   * @type {string}
   */
  key: string;
}

/**
 * Type utility for allowed tribes in rules and clauses.
 *
 * @export
 * @typedef {AllowedTribe}
 * @template {readonly Tribe[]} T
 */
export type AllowedTribe<T extends readonly Tribe[]> = T[number]['id'] | typeof ANY_TRIBE_ID;

/**
 * Tribe ID to identify any tribe.
 *
 * @type {TribeId}
 */
export const ANY_TRIBE_ID = 'any';

/**
 * Tribe for "empty" cells.
 *
 * @type {Tribe}
 */
export const DEAD_TRIBE: Tribe<'dead'> = {
  id: 'dead',
  color: '000000'
};

/**
 * Interval for counting a cell's neighbors (both inclusive).
 *
 * @export
 * @typedef {Interval}
 */
export type Interval = [NeighborCount, NeighborCount];

/**
 * Rule logical clause.
 *
 * @export
 * @typedef {Clause}
 */
export type Clause<T extends readonly Tribe[]> = EmptyClause | IsClause<T> | IntervalClause<T> | NoneClause<T> | ExactlyClause<T> | AtLeastClause<T> | AtMostClause<T> | ComparisonClause<T> | NotClause<T> | AndClause<T> | OrClause<T> | XorClause<T>;

/**
 * Placeholder clause used while building rule expressions.
 *
 * @export
 * @interface EmptyClause
 * @typedef {EmptyClause}
 */
export interface EmptyClause {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'empty'}
   */
  readonly kind: 'empty';
}

/**
 * Clause specifying the belonging of a cell to a set of tribes.
 *
 * @export
 * @interface IsClause<T extends readonly Tribe[]>
 * @typedef {IsClause<T extends readonly Tribe[]>}
 */
export interface IsClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'is'}
   */
  readonly kind: 'is';
  /**
   * Set of tribes that make this clause true if the cell belongs to any of them.
   *
   * @type {[AllowedTribe<T>, ...AllowedTribe<T>[]]}
   */
  tribes: [AllowedTribe<T>, ...AllowedTribe<T>[]];
}

/**
 * Clause specifying a cell's neighbor count interval.
 *
 * @export
 * @interface IntervalClause<T extends readonly Tribe[]>
 * @typedef {IntervalClause<T extends readonly Tribe[]>}
 */
export interface IntervalClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'count'}
   */
  readonly kind: 'count';
  /**
   * Set of tribes that this clause counts.
   *
   * @type {[AllowedTribe<T>, ...AllowedTribe<T>[]]}
   */
  tribes: [AllowedTribe<T>, ...AllowedTribe<T>[]];
  /**
   * Count interval for the cell's neighbors that makes this clause true.
   *
   * @type {Interval}
   */
  interval: Interval;
}

/**
 * Clause specifying a comparison between neighbor counts of two tribe groups.
 *
 * @export
 * @interface ComparisonClause<T extends readonly Tribe[]>
 * @typedef {ComparisonClause<T extends readonly Tribe[]>}
 */
export interface ComparisonClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'comparison' | 'equality'}
   */
  readonly kind: 'comparison' | 'equality';
  /**
   * Tribes for the left-hand side count.
   *
   * @type {AllowedTribe<T>}
   */
  tribe1: [AllowedTribe<T>, ...AllowedTribe<T>[]];
  /**
   * Tribes for the right-hand side count.
   *
   * @type {AllowedTribe<T>}
   */
  tribe2: [AllowedTribe<T>, ...AllowedTribe<T>[]];
  /**
   * Comparison operator between the two counts.
   *
   * @type {'=' | '!=' | '>' | '<' | '>=' | '<='}
   */
  operator?: '=' | '!=' | '>' | '<' | '>=' | '<=';
  /**
   * Right-side margin applied to tribe2 count before comparison.
   * Effective expression: count(tribe1) operator (count(tribe2) + margin).
   *
   * @type {number}
   */
  margin?: number;
}

/**
 * Alias clause: no matching neighbors from selected tribes.
 *
 * @export
 * @interface NoneClause<T extends readonly Tribe[]>
 * @typedef {NoneClause<T extends readonly Tribe[]>}
 */
export interface NoneClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'none'}
   */
  readonly kind: 'none';
  /**
   * Set of tribes this alias counts.
   *
   * @type {[AllowedTribe<T>, ...AllowedTribe<T>[]]}
   */
  tribes: [AllowedTribe<T>, ...AllowedTribe<T>[]];
}

/**
 * Alias clause: exactly N neighbors from selected tribes.
 *
 * @export
 * @interface ExactlyClause<T extends readonly Tribe[]>
 * @typedef {ExactlyClause<T extends readonly Tribe[]>}
 */
export interface ExactlyClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'exactly'}
   */
  readonly kind: 'exactly';
  /**
   * Set of tribes this alias counts.
   *
   * @type {[AllowedTribe<T>, ...AllowedTribe<T>[]]}
   */
  tribes: [AllowedTribe<T>, ...AllowedTribe<T>[]];
  /**
   * Required exact neighbor count.
   *
   * @type {NeighborCount}
   */
  value: NeighborCount;
}

/**
 * Alias clause: at least N neighbors from selected tribes.
 *
 * @export
 * @interface AtLeastClause<T extends readonly Tribe[]>
 * @typedef {AtLeastClause<T extends readonly Tribe[]>}
 */
export interface AtLeastClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'atLeast'}
   */
  readonly kind: 'atLeast';
  /**
   * Set of tribes this alias counts.
   *
   * @type {[AllowedTribe<T>, ...AllowedTribe<T>[]]}
   */
  tribes: [AllowedTribe<T>, ...AllowedTribe<T>[]];
  /**
   * Minimum neighbor count.
   *
   * @type {NeighborCount}
   */
  value: NeighborCount;
}

/**
 * Alias clause: at most N neighbors from selected tribes.
 *
 * @export
 * @interface AtMostClause<T extends readonly Tribe[]>
 * @typedef {AtMostClause<T extends readonly Tribe[]>}
 */
export interface AtMostClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'atMost'}
   */
  readonly kind: 'atMost';
  /**
   * Set of tribes this alias counts.
   *
   * @type {[AllowedTribe<T>, ...AllowedTribe<T>[]]}
   */
  tribes: [AllowedTribe<T>, ...AllowedTribe<T>[]];
  /**
   * Maximum neighbor count.
   *
   * @type {NeighborCount}
   */
  value: NeighborCount;
}

/**
 * Clause inverting the value of another clause.
 *
 * @export
 * @interface NotClause<T extends readonly Tribe[]>
 * @typedef {NotClause<T extends readonly Tribe[]>}
 */
export interface NotClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'not'}
   */
  readonly kind: 'not';
  /**
   * Affected clause.
   *
   * @type {Clause<T>}
   */
  clause: Clause<T>;
}

/**
 * Clause requiring other clauses to be all true.
 *
 * @export
 * @interface AndClause<T extends readonly Tribe[]>
 * @typedef {AndClause<T extends readonly Tribe[]>}
 */
export interface AndClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'and'}
   */
  readonly kind: 'and';
  /**
   * Affected clauses.
   *
   * @type {[Clause<T>, Clause<T>, ...Clause<T>[]]}
   */
  clauses: [Clause<T>, Clause<T>, ...Clause<T>[]];
}

/**
 * Clause requiring at least one of other clauses to be true.
 *
 * @export
 * @interface OrClause<T extends readonly Tribe[]>
 * @typedef {OrClause<T extends readonly Tribe[]>}
 */
export interface OrClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'or'}
   */
  readonly kind: 'or';
  /**
   * Affected clauses.
   *
   * @type {[Clause<T>, Clause<T>, ...Clause<T>[]]}
   */
  clauses: [Clause<T>, Clause<T>, ...Clause<T>[]];
}

/**
 * Clause requiring an odd number of affected clauses to be true.
 *
 * @export
 * @interface XorClause<T extends readonly Tribe[]>
 * @typedef {XorClause<T extends readonly Tribe[]>}
 */
export interface XorClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'xor'}
   */
  readonly kind: 'xor';
  /**
   * Affected clauses.
   *
   * @type {[Clause<T>, Clause<T>, ...Clause<T>[]]}
   */
  clauses: [Clause<T>, Clause<T>, ...Clause<T>[]];
}

/**
 * Rule.
 *
 * @export
 * @interface Rule
 * @typedef {Rule}
 */
export interface Rule<T extends readonly Tribe[]> {
  /**
   * Stable UI key used for Angular list tracking in editors.
   *
   * @type {string}
   */
  key?: string;
  /**
   * Clause that needs to be true for the rule to apply.
   *
   * @type {Clause<T>}
   */
  clause: Clause<T>;
  /**
   * Tribe the cell will transform into if the rule applies.
   *
   * @type {T[number]['id'] | typeof ANY_TRIBE_ID}
   */
  tribe: AllowedTribe<T>;
  /**
   * Whether this rule is temporarily disabled in the editor/runtime.
   *
   * @type {boolean}
   */
  muted?: boolean;
}

/**
 * Ruleset.
 *
 * @export
 * @interface Ruleset
 * @typedef {Ruleset}
 */
export interface Ruleset<T extends readonly Tribe[] = Tribe[]> {
  /**
   * List of valid tribes.
   *
   * @type {T}
   */
  tribes: T;
  /**
   * List of rules.
   *
   * @type {Rule<T>[]}
   */
  rules: Rule<T>[];
  /**
   * Grid columns.
   *
   * @type {number}
   */
  cols: number;
  /**
   * Grid rows.
   *
   * @type {number}
   */
  rows: number;
}
