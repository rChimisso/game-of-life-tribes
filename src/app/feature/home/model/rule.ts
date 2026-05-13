import {Grid} from '~gol/core/model/grid';

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
   * @type {T}
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
 * @type {"any"}
 */
export const ANY_TRIBE_ID = 'any';

/**
 * Tribe ID to identify the dead tribe.
 *
 * @type {"dead"}
 */
export const DEAD_TRIBE_ID = 'dead';

/**
 * Tribe for "empty" cells.
 *
 * @type {Tribe}
 */
export const DEAD_TRIBE: Tribe<typeof DEAD_TRIBE_ID> = {id: DEAD_TRIBE_ID, color: '000000'};

/**
 * Empty clause kind.
 *
 * @type {"empty"}
 */
export const EMPTY_CLAUSE_KIND = 'empty';
/**
 * Is clause kind.
 *
 * @type {"is"}
 */
export const IS_CLAUSE_KIND = 'is';
/**
 * Comparison clause kind.
 *
 * @type {"comparison"}
 */
export const COMPARISON_CLAUSE_KIND = 'comparison';
/**
 * Count clause kind.
 *
 * @type {"count"}
 */
export const COUNT_CLAUSE_KIND = 'count';
/**
 * None clause kind.
 *
 * @type {"none"}
 */
export const NONE_CLAUSE_KIND = 'none';
/**
 * Exactly clause kind.
 *
 * @type {"exactly"}
 */
export const EXACTLY_CLAUSE_KIND = 'exactly';
/**
 * Min clause kind.
 *
 * @type {"min"}
 */
export const MIN_CLAUSE_KIND = 'min';
/**
 * Max clause kind.
 *
 * @type {"max"}
 */
export const MAX_CLAUSE_KIND = 'max';
/**
 * Not clause kind.
 *
 * @type {"not"}
 */
export const NOT_CLAUSE_KIND = 'not';
/**
 * And clause kind.
 *
 * @type {"and"}
 */
export const AND_CLAUSE_KIND = 'and';
/**
 * Or clause kind.
 *
 * @type {"or"}
 */
export const OR_CLAUSE_KIND = 'or';
/**
 * Xor clause kind.
 *
 * @type {"xor"}
 */
export const XOR_CLAUSE_KIND = 'xor';

/**
 * Interval for counting a cell's neighbors (both inclusive).
 *
 * @export
 * @typedef {Interval}
 */
export type Interval = [NeighborCount, NeighborCount];

/**
 * Comparison operator.
 *
 * @export
 * @typedef {Operator}
 */
export type Operator = '=' | '≠' | '>' | '<' | '≥' | '≤';

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
   * @type {typeof EMPTY_CLAUSE_KIND}
   */
  readonly kind: typeof EMPTY_CLAUSE_KIND;
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
   * @type {typeof IS_CLAUSE_KIND}
   */
  readonly kind: typeof IS_CLAUSE_KIND;
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
   * @type {typeof COUNT_CLAUSE_KIND}
   */
  readonly kind: typeof COUNT_CLAUSE_KIND;
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
   * @type {typeof COMPARISON_CLAUSE_KIND}
   */
  readonly kind: typeof COMPARISON_CLAUSE_KIND;
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
   * @type {Operator}
   */
  operator: Operator;
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
   * @type {typeof NONE_CLAUSE_KIND}
   */
  readonly kind: typeof NONE_CLAUSE_KIND;
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
   * @type {typeof EXACTLY_CLAUSE_KIND}
   */
  readonly kind: typeof EXACTLY_CLAUSE_KIND;
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
 * @interface MinClause<T extends readonly Tribe[]>
 * @typedef {MinClause<T extends readonly Tribe[]>}
 */
export interface MinClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {typeof MIN_CLAUSE_KIND}
   */
  readonly kind: typeof MIN_CLAUSE_KIND;
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
 * @interface MaxClause<T extends readonly Tribe[]>
 * @typedef {MaxClause<T extends readonly Tribe[]>}
 */
export interface MaxClause<T extends readonly Tribe[]> {
  /**
   * Clause type.
   *
   * @readonly
   * @type {typeof MAX_CLAUSE_KIND}
   */
  readonly kind: typeof MAX_CLAUSE_KIND;
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
   * @type {typeof NOT_CLAUSE_KIND}
   */
  readonly kind: typeof NOT_CLAUSE_KIND;
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
   * @type {typeof AND_CLAUSE_KIND}
   */
  readonly kind: typeof AND_CLAUSE_KIND;
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
   * @type {typeof OR_CLAUSE_KIND}
   */
  readonly kind: typeof OR_CLAUSE_KIND;
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
   * @type {typeof XOR_CLAUSE_KIND}
   */
  readonly kind: typeof XOR_CLAUSE_KIND;
  /**
   * Affected clauses.
   *
   * @type {[Clause<T>, Clause<T>, ...Clause<T>[]]}
   */
  clauses: [Clause<T>, Clause<T>, ...Clause<T>[]];
}

/**
 * Rule logical clause.
 *
 * @export
 * @typedef {Clause}
 */
export type Clause<T extends readonly Tribe[]> = EmptyClause | IsClause<T> | IntervalClause<T> | NoneClause<T> | ExactlyClause<T> | MinClause<T> | MaxClause<T> | ComparisonClause<T> | NotClause<T> | AndClause<T> | OrClause<T> | XorClause<T>;

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
 * @extends {Grid}
 */
export interface Ruleset<T extends readonly Tribe[] = Tribe[]> extends Grid {
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
}

/**
 * Empty clause.
 *
 * @type {EmptyClause}
 */
export const EMPTY_CLAUSE: EmptyClause = {kind: EMPTY_CLAUSE_KIND};
