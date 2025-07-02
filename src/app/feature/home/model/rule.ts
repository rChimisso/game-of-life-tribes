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
export type Clause<T extends readonly Tribe[]> = IsClause<T> | IntervalClause<T> | EqualityClause<T> | NotClause<T> | AndClause<T> | OrClause<T>;

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
 * Clause specifying equality for a cell's neighbor count of two different tribes.
 *
 * @export
 * @interface EqualityClause<T extends readonly Tribe[]>
 * @typedef {EqualityClause<T extends readonly Tribe[]>}
 */
export interface EqualityClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {'equality'}
   */
  readonly kind: 'equality';
  /**
   * Tribe to check the equality count for.
   *
   * @type {AllowedTribe<T>}
   */
  tribe1: AllowedTribe<T>;
  /**
   * Tribe to check the equality count for.
   *
   * @type {AllowedTribe<T>}
   */
  tribe2: AllowedTribe<T>;
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
 * Rule.
 *
 * @export
 * @interface Rule
 * @typedef {Rule}
 */
export interface Rule<T extends readonly Tribe[]> {
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
