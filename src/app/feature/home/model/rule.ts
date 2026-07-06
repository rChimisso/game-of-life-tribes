import {Grid, GridTopology} from '~gol/feature/home/model/grid';

/**
 * Valid number for the count of a cell's neighbors.
 *
 * @typedef {NeighborCount}
 */
export type NeighborCount = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Tribe.
 *
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
 * Concrete tribe id used in rules and clauses.
 *
 * @typedef {TribeId}
 * @template {readonly Tribe[]} T
 */
export type TribeId<T extends readonly Tribe[]> = T[number]['id'];

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
 * Toroidal grid topology.
 *
 * @type {"toroidal"}
 */
export const TOROIDAL_GRID_TOPOLOGY = 'toroidal';

/**
 * Bounded grid topology.
 *
 * @type {"bounded"}
 */
export const BOUNDED_GRID_TOPOLOGY = 'bounded';

/**
 * Valid grid topologies.
 *
 * @type {readonly string[]}
 */
export const GRID_TOPOLOGY_VALUES = [TOROIDAL_GRID_TOPOLOGY, BOUNDED_GRID_TOPOLOGY] as const;

/**
 * Default deterministic random seed used by rulesets.
 *
 * @type {number}
 */
export const DEFAULT_RANDOM_SEED = 42;

/**
 * Minimum deterministic random seed accepted by rulesets.
 *
 * @type {number}
 */
export const MIN_RANDOM_SEED = 1;

/**
 * Maximum deterministic random seed accepted by rulesets.
 *
 * @type {number}
 */
export const MAX_RANDOM_SEED = 0xffffffff;

/**
 * Default rule application probability percentage.
 *
 * @type {number}
 */
export const DEFAULT_RULE_PROBABILITY = 100;

/**
 * Minimum rule application probability percentage.
 *
 * @type {number}
 */
export const MIN_RULE_PROBABILITY = 0;

/**
 * Maximum rule application probability percentage.
 *
 * @type {number}
 */
export const MAX_RULE_PROBABILITY = 100;

/**
 * Scale used by integer probability inputs to represent three decimal places.
 *
 * @type {number}
 */
export const RULE_PROBABILITY_INPUT_SCALE = 1000;

/**
 * Minimum scaled probability input value.
 *
 * @type {number}
 */
export const MIN_RULE_PROBABILITY_INPUT = MIN_RULE_PROBABILITY * RULE_PROBABILITY_INPUT_SCALE;

/**
 * Maximum scaled probability input value.
 *
 * @type {number}
 */
export const MAX_RULE_PROBABILITY_INPUT = MAX_RULE_PROBABILITY * RULE_PROBABILITY_INPUT_SCALE;

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
 * Explicit tribes selector kind.
 *
 * @type {"tribes"}
 */
export const TRIBES_SELECTOR_KIND = 'tribes';

/**
 * Same tribe selector kind.
 *
 * @type {"same"}
 */
export const SAME_TRIBE_SELECTOR_KIND = 'same';

/**
 * Different tribe selector kind.
 *
 * @type {"different"}
 */
export const DIFFERENT_TRIBE_SELECTOR_KIND = 'different';

/**
 * Tie selector kind.
 *
 * @type {"tie"}
 */
export const TIE_SELECTOR_KIND = 'tie';

/**
 * Fixed outcome kind.
 *
 * @type {"fixed"}
 */
export const FIXED_BECOME_KIND = 'fixed';

/**
 * Same outcome kind.
 *
 * @type {"same"}
 */
export const SAME_BECOME_KIND = 'same';

/**
 * Majority outcome kind.
 *
 * @type {"majority"}
 */
export const MAJORITY_BECOME_KIND = 'majority';

/**
 * Minority outcome kind.
 *
 * @type {"minority"}
 */
export const MINORITY_BECOME_KIND = 'minority';

/**
 * Lookup combine strategy kind.
 *
 * @type {"lookup"}
 */
export const LOOKUP_STRATEGY_KIND = 'lookup';

/**
 * Combine outcome kind.
 *
 * @type {"combine"}
 */
export const COMBINE_BECOME_KIND = 'combine';

/**
 * Maximum number of selector inputs in one combination row.
 *
 * @type {8}
 */
export const MAX_COMBINATION_INPUTS = 8;

/**
 * Interval for counting a cell's neighbors (both inclusive).
 *
 * @typedef {Interval}
 */
export type Interval = [NeighborCount, NeighborCount];

/**
 * Comparison operator.
 *
 * @typedef {Operator}
 */
export type Operator = '=' | '\u2260' | '>' | '<' | '\u2265' | '\u2264';

/**
 * Selector that targets one explicit set of tribes.
 *
 * @interface ExplicitTribesSelector<T extends readonly Tribe[]>
 * @typedef {ExplicitTribesSelector<T extends readonly Tribe[]>}
 */
export interface ExplicitTribesSelector<T extends readonly Tribe[]> {
  /**
   * Selector type.
   *
   * @type {typeof TRIBES_SELECTOR_KIND}
   */
  kind: typeof TRIBES_SELECTOR_KIND;
  /**
   * Explicit tribes selected by this selector.
   *
   * @type {[TribeId<T>, ...TribeId<T>[]]}
   */
  tribes: [TribeId<T>, ...TribeId<T>[]];
}

/**
 * Selector that targets neighbors matching the current cell tribe.
 *
 * @interface SameTribeSelector
 * @typedef {SameTribeSelector}
 */
export interface SameTribeSelector {
  /**
   * Selector type.
   *
   * @type {typeof SAME_TRIBE_SELECTOR_KIND}
   */
  kind: typeof SAME_TRIBE_SELECTOR_KIND;
}

/**
 * Selector that targets neighbors different from the current cell tribe.
 *
 * @interface DifferentTribeSelector
 * @typedef {DifferentTribeSelector}
 */
export interface DifferentTribeSelector {
  /**
   * Selector type.
   *
   * @type {typeof DIFFERENT_TRIBE_SELECTOR_KIND}
   */
  kind: typeof DIFFERENT_TRIBE_SELECTOR_KIND;
}

/**
 * Selector that targets tied ranked candidates from another selector.
 *
 * @interface TieSelector<T extends readonly Tribe[]>
 * @typedef {TieSelector<T extends readonly Tribe[]>}
 */
export interface TieSelector<T extends readonly Tribe[]> {
  /**
   * Selector type.
   *
   * @type {typeof TIE_SELECTOR_KIND}
   */
  kind: typeof TIE_SELECTOR_KIND;
  /**
   * Source selector used to find ranked ties.
   *
   * @type {TribeSelector<T>}
   */
  source: TribeSelector<T>;
}

/**
 * Rule tribe selector expression.
 *
 * @typedef {TribeSelector}
 */
export type TribeSelector<T extends readonly Tribe[]> = ExplicitTribesSelector<T> | SameTribeSelector | DifferentTribeSelector | TieSelector<T>;

/**
 * Fixed rule outcome.
 *
 * @interface FixedBecome<T extends readonly Tribe[]>
 * @typedef {FixedBecome<T extends readonly Tribe[]>}
 */
export interface FixedBecome<T extends readonly Tribe[]> {
  /**
   * Outcome type.
   *
   * @type {typeof FIXED_BECOME_KIND}
   */
  kind: typeof FIXED_BECOME_KIND;
  /**
   * Fixed output tribe.
   *
   * @type {TribeId<T>}
   */
  tribe: TribeId<T>;
}

/**
 * Rule outcome that keeps the current cell tribe.
 *
 * @interface SameBecome
 * @typedef {SameBecome}
 */
export interface SameBecome {
  /**
   * Outcome type.
   *
   * @type {typeof SAME_BECOME_KIND}
   */
  kind: typeof SAME_BECOME_KIND;
}

/**
 * Rule outcome that chooses the most common selected neighbor tribe.
 *
 * @interface MajorityBecome<T extends readonly Tribe[]>
 * @typedef {MajorityBecome<T extends readonly Tribe[]>}
 */
export interface MajorityBecome<T extends readonly Tribe[]> {
  /**
   * Outcome type.
   *
   * @type {typeof MAJORITY_BECOME_KIND}
   */
  kind: typeof MAJORITY_BECOME_KIND;
  /**
   * Selector used to choose majority candidates.
   *
   * @type {TribeSelector<T>}
   */
  selector: TribeSelector<T>;
  /**
   * Outcome evaluated when multiple candidates tie.
   *
   * @type {?Become<T>}
   */
  tie?: Become<T>;
  /**
   * Outcome evaluated when no candidates exist.
   *
   * @type {?Become<T>}
   */
  fallback?: Become<T>;
}

/**
 * Rule outcome that chooses the least common selected neighbor tribe.
 *
 * @interface MinorityBecome<T extends readonly Tribe[]>
 * @typedef {MinorityBecome<T extends readonly Tribe[]>}
 */
export interface MinorityBecome<T extends readonly Tribe[]> {
  /**
   * Outcome type.
   *
   * @type {typeof MINORITY_BECOME_KIND}
   */
  kind: typeof MINORITY_BECOME_KIND;
  /**
   * Selector used to choose minority candidates.
   *
   * @type {TribeSelector<T>}
   */
  selector: TribeSelector<T>;
  /**
   * Outcome evaluated when multiple candidates tie.
   *
   * @type {?Become<T>}
   */
  tie?: Become<T>;
  /**
   * Outcome evaluated when no candidates exist.
   *
   * @type {?Become<T>}
   */
  fallback?: Become<T>;
}

/**
 * Lookup-table combination strategy.
 *
 * @interface LookupCombineStrategy<T extends readonly Tribe[]>
 * @typedef {LookupCombineStrategy<T extends readonly Tribe[]>}
 */
export interface LookupCombineStrategy<T extends readonly Tribe[]> {
  /**
   * Strategy type.
   *
   * @type {typeof LOOKUP_STRATEGY_KIND}
   */
  kind: typeof LOOKUP_STRATEGY_KIND;
  /**
   * Lookup rows.
   *
   * @type {readonly CombinationEntry<T>[]}
   */
  entries: readonly CombinationEntry<T>[];
  /**
   * Default outcome for unmatched input sets.
   *
   * @type {?Become<T>}
   */
  default?: Become<T>;
}

/**
 * Combine strategy expression.
 *
 * @typedef {CombineStrategy}
 */
export type CombineStrategy<T extends readonly Tribe[]> = LookupCombineStrategy<T>;

/**
 * One unordered combination lookup row.
 *
 * @interface CombinationEntry<T extends readonly Tribe[]>
 * @typedef {CombinationEntry<T extends readonly Tribe[]>}
 */
export interface CombinationEntry<T extends readonly Tribe[]> {
  /**
   * Input selectors.
   *
   * @type {readonly TribeSelector<T>[]}
   */
  inputs: readonly TribeSelector<T>[];
  /**
   * Output tribe.
   *
   * @type {TribeId<T>}
   */
  output: TribeId<T>;
}

/**
 * Rule outcome that combines selected tribes with a declared strategy.
 *
 * @interface CombineBecome<T extends readonly Tribe[]>
 * @typedef {CombineBecome<T extends readonly Tribe[]>}
 */
export interface CombineBecome<T extends readonly Tribe[]> {
  /**
   * Outcome type.
   *
   * @type {typeof COMBINE_BECOME_KIND}
   */
  kind: typeof COMBINE_BECOME_KIND;
  /**
   * Combination strategy.
   *
   * @type {CombineStrategy<T>}
   */
  strategy: CombineStrategy<T>;
}

/**
 * Rule outcome expression.
 *
 * @typedef {Become}
 */
export type Become<T extends readonly Tribe[]> = FixedBecome<T> | SameBecome | MajorityBecome<T> | MinorityBecome<T> | CombineBecome<T>;

/**
 * Neighbor count expression.
 *
 * @interface CountExpression<T extends readonly Tribe[]>
 * @typedef {CountExpression<T extends readonly Tribe[]>}
 */
export interface CountExpression<T extends readonly Tribe[]> {
  /**
   * Expression type.
   *
   * @type {"count"}
   */
  kind: 'count';
  /**
   * Selector counted by the expression.
   *
   * @type {TribeSelector<T>}
   */
  selector: TribeSelector<T>;
}

/**
 * Placeholder clause used while building rule expressions.
 *
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
   * @type {[TribeId<T>, ...TribeId<T>[]]}
   */
  tribes: [TribeId<T>, ...TribeId<T>[]];
}

/**
 * Clause specifying a cell's neighbor count interval.
 *
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
   * Selector counted by this clause.
   *
   * @type {?TribeSelector<T>}
   */
  selector?: TribeSelector<T>;
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
   * Left-hand side count expression.
   *
   * @type {?CountExpression<T>}
   */
  left?: CountExpression<T>;
  /**
   * Right-hand side count expression.
   *
   * @type {?CountExpression<T>}
   */
  right?: CountExpression<T>;
  /**
   * Comparison operator between the two counts.
   *
   * @type {Operator}
   */
  operator: Operator;
  /**
   * Right-side margin applied to the right count before comparison.
   * Effective expression: left count operator (right count + margin).
   *
   * @type {number}
   */
  margin?: number;
}

/**
 * Clause requiring no matching neighbors from a selector.
 *
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
   * Selector counted by this clause.
   *
   * @type {?TribeSelector<T>}
   */
  selector?: TribeSelector<T>;
}

/**
 * Clause requiring exactly N neighbors from a selector.
 *
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
   * Selector counted by this clause.
   *
   * @type {?TribeSelector<T>}
   */
  selector?: TribeSelector<T>;
  /**
   * Required exact neighbor count.
   *
   * @type {NeighborCount}
   */
  value: NeighborCount;
}

/**
 * Clause requiring at least N neighbors from a selector.
 *
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
   * Selector counted by this clause.
   *
   * @type {?TribeSelector<T>}
   */
  selector?: TribeSelector<T>;
  /**
   * Minimum neighbor count.
   *
   * @type {NeighborCount}
   */
  value: NeighborCount;
}

/**
 * Clause requiring at most N neighbors from a selector.
 *
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
   * Selector counted by this clause.
   *
   * @type {?TribeSelector<T>}
   */
  selector?: TribeSelector<T>;
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
 * @typedef {Clause}
 */
export type Clause<T extends readonly Tribe[]> = EmptyClause | IsClause<T> | IntervalClause<T> | NoneClause<T> | ExactlyClause<T> | MinClause<T> | MaxClause<T> | ComparisonClause<T> | NotClause<T> | AndClause<T> | OrClause<T> | XorClause<T>;

/**
 * Rule.
 *
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
   * Outcome evaluated when the rule applies.
   *
   * @type {?Become<T>}
   */
  become?: Become<T>;
  /**
   * Rule application probability percentage.
   *
   * @type {?number}
   */
  probability?: number;
  /**
   * Whether this rule is temporarily disabled in the editor/runtime.
   *
   * @type {boolean}
   */
  muted?: boolean;
}

/**
 * Rule with a normalized outcome expression.
 *
 * @interface NormalizedRule<T extends readonly Tribe[]>
 * @typedef {NormalizedRule<T extends readonly Tribe[]>}
 * @extends {Rule<T>}
 */
export interface NormalizedRule<T extends readonly Tribe[]> extends Rule<T> {
  /**
   * Normalized outcome evaluated when the rule applies.
   *
   * @type {Become<T>}
   */
  become: Become<T>;
}

/**
 * Ruleset.
 *
 * @interface Ruleset
 * @typedef {Ruleset}
 * @extends {Grid}
 */
export interface Ruleset<T extends readonly Tribe[] = Tribe[]> extends Grid {
  /**
   * Grid edge topology.
   *
   * @type {GridTopology}
   */
  topology: GridTopology;
  /**
   * Virtual boundary tribe used by bounded grids.
   *
   * @type {string}
   */
  boundaryTribe: string;
  /**
   * Deterministic random seed used by probabilistic rules.
   *
   * @type {number}
   */
  randomSeed: number;
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
 * Minimal ruleset used before bound app state reaches engine consumers.
 *
 * @type {Ruleset<readonly Tribe[]>}
 */
export const DEFAULT_RULESET: Ruleset<readonly Tribe[]> = {
  cols: 512,
  rows: 512,
  topology: TOROIDAL_GRID_TOPOLOGY,
  boundaryTribe: DEAD_TRIBE_ID,
  randomSeed: DEFAULT_RANDOM_SEED,
  tribes: [DEAD_TRIBE],
  rules: []
};

/**
 * Empty clause.
 *
 * @type {EmptyClause}
 */
export const EMPTY_CLAUSE: EmptyClause = {kind: EMPTY_CLAUSE_KIND};
