import {AND_CLAUSE_KIND, Clause, COMPARISON_CLAUSE_KIND, EMPTY_CLAUSE, EMPTY_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Rule, Tribe, XOR_CLAUSE_KIND} from '../model/rule';

/**
 * Normalizes editor-only clause defaults before comparison or persistence.
 *
 * @template {readonly Tribe[]} T
 * @param {Clause<T>} clause clause to normalize.
 * @returns {Clause<T>} normalized clause.
 */
export function normalizeClauseForEditor<T extends readonly Tribe[]>(clause: Clause<T>): Clause<T> {
  switch (clause.kind) {
    case EMPTY_CLAUSE_KIND:
      return EMPTY_CLAUSE;
    case COMPARISON_CLAUSE_KIND:
      return {
        ...clause,
        margin: clause.margin ?? 0
      };
    case NOT_CLAUSE_KIND:
      return {
        ...clause,
        clause: normalizeClauseForEditor(clause.clause)
      };
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND: {
      const normalizedClauses = clause.clauses.map(sub => normalizeClauseForEditor(sub));
      while (normalizedClauses.length < 2) {
        normalizedClauses.push(EMPTY_CLAUSE);
      }
      return {
        ...clause,
        clauses: normalizedClauses as [Clause<T>, Clause<T>, ...Clause<T>[]]
      };
    }
    default:
      return clause;
  }
}

/**
 * Removes editor-only rule state before persistence or comparison.
 *
 * @template {readonly Tribe[]} T
 * @param {Rule<T>} rule rule to normalize.
 * @returns {Rule<T>} persisted rule shape.
 */
export function toPersistedRule<T extends readonly Tribe[]>(rule: Rule<T>): Rule<T> {
  const persistedRule = structuredClone(rule);
  persistedRule.clause = normalizeClauseForEditor(persistedRule.clause);
  delete persistedRule.key;
  persistedRule.muted = !!persistedRule.muted;
  return persistedRule;
}

/**
 * Creates a comparable clause signature.
 *
 * @template {readonly Tribe[]} T
 * @param {Clause<T>} clause clause to sign.
 * @returns {string} serialized normalized clause.
 */
export function clauseSignature<T extends readonly Tribe[]>(clause: Clause<T>): string {
  return JSON.stringify(normalizeClauseForEditor(clause));
}

/**
 * Creates a comparable rule signature.
 *
 * @template {readonly Tribe[]} T
 * @param {Rule<T>} rule rule to sign.
 * @returns {string} serialized persisted rule.
 */
export function ruleSignature<T extends readonly Tribe[]>(rule: Rule<T>): string {
  return JSON.stringify(toPersistedRule(rule));
}

/**
 * Compares two clauses after editor normalization.
 *
 * @template {readonly Tribe[]} T
 * @param {Clause<T>} editableClause editable clause.
 * @param {Clause<T>} baseClause baseline clause.
 * @returns {boolean} `true` if equal.
 */
export function clausesEqual<T extends readonly Tribe[]>(editableClause: Clause<T>, baseClause: Clause<T>): boolean {
  return clauseSignature(editableClause) === clauseSignature(baseClause);
}

/**
 * Compares two rules after persisted normalization.
 *
 * @template {readonly Tribe[]} T
 * @param {Rule<T>} editableRule editable rule.
 * @param {Rule<T>} baseRule baseline rule.
 * @returns {boolean} `true` if equal.
 */
export function rulesEqual<T extends readonly Tribe[]>(editableRule: Rule<T>, baseRule: Rule<T>): boolean {
  return ruleSignature(editableRule) === ruleSignature(baseRule);
}

/**
 * Compares two rule lists after persisted normalization.
 *
 * @template {readonly Tribe[]} T
 * @param {readonly Rule<T>[]} editableRules editable rules.
 * @param {readonly Rule<T>[]} baseRules baseline rules.
 * @returns {boolean} `true` if equal.
 */
export function ruleListsEqual<T extends readonly Tribe[]>(editableRules: readonly Rule<T>[], baseRules: readonly Rule<T>[]): boolean {
  return editableRules.length === baseRules.length && editableRules.every((rule, index) => ruleSignature(rule) === ruleSignature(baseRules[index]!));
}
