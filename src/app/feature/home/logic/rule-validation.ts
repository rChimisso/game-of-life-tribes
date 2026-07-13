import {normalizeCountExpression, normalizeSelector} from './rule-editor';

import {AND_CLAUSE_KIND, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DIFFERENT_IN_TRIBE_SELECTOR_KIND, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, TRIBES_SELECTOR_KIND, Tribe, TribeSelector, XOR_CLAUSE_KIND} from '~gol/feature/home/model/rule';
import {ClauseDraft} from '~gol/feature/home/model/rule-draft';

/**
 * Checks whether a clause tree contains an empty placeholder.
 *
 * @param {Clause<Tribe[]>} clause clause to inspect.
 * @returns {boolean} `true` if an empty placeholder exists.
 */
function containsEmptyClause(clause: Clause<Tribe[]> | ClauseDraft): boolean {
  let invalid = false;
  switch (clause.kind) {
    case EMPTY_CLAUSE_KIND:
      invalid = true;
      break;
    case NOT_CLAUSE_KIND:
      invalid = containsEmptyClause(clause.clause);
      break;
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND:
      invalid = clause.clauses.some(child => containsEmptyClause(child));
      break;
  }
  return invalid;
}

/**
 * Checks whether a clause tree contains an invalid selector.
 *
 * @param {Clause<Tribe[]>} clause clause to inspect.
 * @param {readonly Tribe[]} tribes known tribes.
 * @returns {boolean} `true` if an invalid selector exists.
 */
function containsInvalidSelector(clause: Clause<Tribe[]> | ClauseDraft, tribes: readonly Tribe[]): boolean {
  let invalid = false;
  switch (clause.kind) {
    case IS_CLAUSE_KIND:
      invalid = clause.tribes.length === 0 || isSelectorInvalid({
        kind: TRIBES_SELECTOR_KIND,
        tribes: [clause.tribes[0] ?? '', ...clause.tribes.slice(1)]
      }, tribes);
      break;
    case COUNT_CLAUSE_KIND:
    case NONE_CLAUSE_KIND:
    case EXACTLY_CLAUSE_KIND:
    case MIN_CLAUSE_KIND:
    case MAX_CLAUSE_KIND:
      invalid = isSelectorInvalid(normalizeSelector(clause.selector), tribes);
      break;
    case COMPARISON_CLAUSE_KIND:
      invalid = isSelectorInvalid(normalizeCountExpression(clause.left).selector, tribes) || isSelectorInvalid(normalizeCountExpression(clause.right).selector, tribes);
      break;
    case NOT_CLAUSE_KIND:
      invalid = containsInvalidSelector(clause.clause, tribes);
      break;
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND:
      invalid = clause.clauses.some(child => containsInvalidSelector(child, tribes));
      break;
  }
  return invalid;
}

/**
 * Checks whether a selector is invalid.
 *
 * @param {TribeSelector<Tribe[]>} selector selector to inspect.
 * @param {readonly Tribe[]} tribes known tribes.
 * @returns {boolean} `true` if the selector is invalid.
 */
function isSelectorInvalid(selector: TribeSelector<Tribe[]>, tribes: readonly Tribe[]): boolean {
  const knownIds = new Set(tribes.map(tribe => tribe.id));
  let invalid = false;
  switch (selector.kind) {
    case TRIBES_SELECTOR_KIND:
    case DIFFERENT_IN_TRIBE_SELECTOR_KIND:
      invalid = selector.tribes.length === 0 || selector.tribes.some(id => !knownIds.has(id));
      break;
  }
  return invalid;
}

/**
 * Checks whether a clause tree contains an invalid count interval.
 *
 * @param {Clause<Tribe[]>} clause clause to inspect.
 * @returns {boolean} `true` if a lower bound is greater than an upper bound.
 */
function containsInvalidCountInterval(clause: Clause<Tribe[]> | ClauseDraft): boolean {
  let invalid = false;
  switch (clause.kind) {
    case COUNT_CLAUSE_KIND:
      invalid = typeof clause.interval[0] === 'number' && typeof clause.interval[1] === 'number' && clause.interval[0] > clause.interval[1];
      break;
    case NOT_CLAUSE_KIND:
      invalid = containsInvalidCountInterval(clause.clause);
      break;
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND:
      invalid = clause.clauses.some(child => containsInvalidCountInterval(child));
      break;
  }
  return invalid;
}

/**
 * Checks whether a clause has intrinsic validation errors.
 *
 * @param {Clause<Tribe[]> | ClauseDraft} clause clause to inspect.
 * @param {readonly Tribe[]} tribes known tribes.
 * @returns {boolean} `true` if the clause has intrinsic errors.
 */
export function hasInvalidClauseStructure(clause: Clause<Tribe[]> | ClauseDraft, tribes: readonly Tribe[]): boolean {
  return containsEmptyClause(clause) || containsInvalidSelector(clause, tribes) || containsInvalidCountInterval(clause);
}
