import {AND_CLAUSE_KIND, Become, COMPARISON_CLAUSE_KIND, CountExpression, COUNT_CLAUSE_KIND, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, Operator, OR_CLAUSE_KIND, Tribe, TribeSelector, XOR_CLAUSE_KIND} from './rule';

/**
 * Numeric draft value kept exactly as typed in an editor.
 *
 * @typedef {NumericDraft}
 */
export type NumericDraft = number | null;

/**
 * Count interval draft with explicit tuple shape.
 *
 * @typedef {IntervalDraft}
 */
export type IntervalDraft = [NumericDraft, NumericDraft];

/**
 * Empty clause draft.
 *
 * @interface EmptyClauseDraft
 * @typedef {EmptyClauseDraft}
 */
export interface EmptyClauseDraft {
  /**
   * Clause type.
   *
   * @readonly
   * @type {typeof EMPTY_CLAUSE_KIND}
   */
  readonly kind: typeof EMPTY_CLAUSE_KIND;
}

/**
 * IS clause draft.
 *
 * @interface IsClauseDraft
 * @typedef {IsClauseDraft}
 */
export interface IsClauseDraft {
  /**
   * Clause type.
   *
   * @readonly
   * @type {typeof IS_CLAUSE_KIND}
   */
  readonly kind: typeof IS_CLAUSE_KIND;
  /**
   * Selected tribe IDs.
   *
   * @type {string[]}
   */
  tribes: string[];
}

/**
 * Count interval clause draft.
 *
 * @interface IntervalClauseDraft
 * @typedef {IntervalClauseDraft}
 */
export interface IntervalClauseDraft {
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
   * @type {?TribeSelector<Tribe[]>}
   */
  selector?: TribeSelector<Tribe[]>;
  /**
   * Count interval draft.
   *
   * @type {IntervalDraft}
   */
  interval: IntervalDraft;
}

/**
 * NONE clause draft.
 *
 * @interface NoneClauseDraft
 * @typedef {NoneClauseDraft}
 */
export interface NoneClauseDraft {
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
   * @type {?TribeSelector<Tribe[]>}
   */
  selector?: TribeSelector<Tribe[]>;
}

/**
 * Single-value count clause draft.
 *
 * @interface CountValueClauseDraft
 * @typedef {CountValueClauseDraft}
 */
export interface CountValueClauseDraft {
  /**
   * Clause type.
   *
   * @readonly
   * @type {typeof EXACTLY_CLAUSE_KIND | typeof MIN_CLAUSE_KIND | typeof MAX_CLAUSE_KIND}
   */
  readonly kind: typeof EXACTLY_CLAUSE_KIND | typeof MIN_CLAUSE_KIND | typeof MAX_CLAUSE_KIND;
  /**
   * Selector counted by this clause.
   *
   * @type {?TribeSelector<Tribe[]>}
   */
  selector?: TribeSelector<Tribe[]>;
  /**
   * Count value draft.
   *
   * @type {NumericDraft}
   */
  value: NumericDraft;
}

/**
 * Comparison clause draft.
 *
 * @interface ComparisonClauseDraft
 * @typedef {ComparisonClauseDraft}
 */
export interface ComparisonClauseDraft {
  /**
   * Clause type.
   *
   * @readonly
   * @type {typeof COMPARISON_CLAUSE_KIND}
   */
  readonly kind: typeof COMPARISON_CLAUSE_KIND;
  /**
   * Left-hand count expression.
   *
   * @type {?CountExpression<Tribe[]>}
   */
  left?: CountExpression<Tribe[]>;
  /**
   * Right-hand count expression.
   *
   * @type {?CountExpression<Tribe[]>}
   */
  right?: CountExpression<Tribe[]>;
  /**
   * Comparison operator.
   *
   * @type {Operator}
   */
  operator: Operator;
  /**
   * Right-side margin draft.
   *
   * @type {?NumericDraft}
   */
  margin?: NumericDraft;
}

/**
 * NOT clause draft.
 *
 * @interface NotClauseDraft
 * @typedef {NotClauseDraft}
 */
export interface NotClauseDraft {
  /**
   * Clause type.
   *
   * @readonly
   * @type {typeof NOT_CLAUSE_KIND}
   */
  readonly kind: typeof NOT_CLAUSE_KIND;
  /**
   * Child clause draft.
   *
   * @type {ClauseDraft}
   */
  clause: ClauseDraft;
}

/**
 * Logical clause draft.
 *
 * @interface LogicalClauseDraft
 * @typedef {LogicalClauseDraft}
 */
export interface LogicalClauseDraft {
  /**
   * Clause type.
   *
   * @readonly
   * @type {typeof AND_CLAUSE_KIND | typeof OR_CLAUSE_KIND | typeof XOR_CLAUSE_KIND}
   */
  readonly kind: typeof AND_CLAUSE_KIND | typeof OR_CLAUSE_KIND | typeof XOR_CLAUSE_KIND;
  /**
   * Child clause drafts.
   *
   * @type {ClauseDraft[]}
   */
  clauses: ClauseDraft[];
}

/**
 * Clause editor draft.
 *
 * @typedef {ClauseDraft}
 */
export type ClauseDraft = EmptyClauseDraft | IsClauseDraft | IntervalClauseDraft | NoneClauseDraft | CountValueClauseDraft | ComparisonClauseDraft | NotClauseDraft | LogicalClauseDraft;

/**
 * Rule editor draft.
 *
 * @interface RuleDraft
 * @typedef {RuleDraft}
 */
export interface RuleDraft {
  /**
   * Stable UI key.
   *
   * @type {?string}
   */
  key?: string;
  /**
   * Clause draft.
   *
   * @type {ClauseDraft}
   */
  clause: ClauseDraft;
  /**
   * Outcome expression.
   *
   * @type {?Become<Tribe[]>}
   */
  become?: Become<Tribe[]>;
  /**
   * Legacy fixed outcome target.
   *
   * @type {?string}
   */
  tribe?: string;
  /**
   * Probability draft.
   *
   * @type {?NumericDraft}
   */
  probability?: NumericDraft;
  /**
   * Whether the rule is muted.
   *
   * @type {?boolean}
   */
  muted?: boolean;
}
