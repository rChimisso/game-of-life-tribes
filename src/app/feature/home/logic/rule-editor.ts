import {AND_CLAUSE_KIND, Become, Clause, COMPARISON_CLAUSE_KIND, CountExpression, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, EMPTY_CLAUSE, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NormalizedRule, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Rule, Tribe, TribeId, TribeSelector, XOR_CLAUSE_KIND} from '../model/rule';

/**
 * Normalizes one combination row input, including previous string-only rows.
 *
 * @template {readonly Tribe[]} T
 * @param {TribeSelector<T> | TribeId<T>} input row input.
 * @returns {TribeSelector<T>} normalized selector.
 */
function normalizeCombinationInput<T extends readonly Tribe[]>(input: TribeSelector<T> | TribeId<T>): TribeSelector<T> {
  let selector: TribeSelector<T>;
  if (typeof input === 'string') {
    selector = explicitTribesSelector([input]);
  } else {
    selector = normalizeSelector(input);
  }
  return selector;
}

/**
 * Creates a legacy explicit-tribe selector.
 *
 * @template {readonly Tribe[]} T
 * @param {readonly TribeId<T>[] | undefined} tribes selected tribe ids.
 * @returns {TribeSelector<T>} explicit selector.
 */
export function explicitTribesSelector<T extends readonly Tribe[]>(tribes: readonly TribeId<T>[] | undefined): TribeSelector<T> {
  const selectedTribes = tribes && tribes.length > 0 ? tribes : [DEAD_TRIBE_ID as TribeId<T>];
  return {
    kind: 'tribes',
    tribes: [...selectedTribes] as [TribeId<T>, ...TribeId<T>[]]
  };
}

/**
 * Normalizes a selector expression.
 *
 * @template {readonly Tribe[]} T
 * @param {TribeSelector<T> | undefined} selector selector to normalize.
 * @param {readonly TribeId<T>[] | undefined} legacyTribes legacy tribe list.
 * @returns {TribeSelector<T>} normalized selector.
 */
export function normalizeSelector<T extends readonly Tribe[]>(selector: TribeSelector<T> | undefined, legacyTribes?: readonly TribeId<T>[]): TribeSelector<T> {
  const normalized = selector ?? explicitTribesSelector(legacyTribes);
  let result: TribeSelector<T>;
  switch (normalized.kind) {
    case 'tribes':
      result = {
        ...normalized,
        tribes: [...normalized.tribes] as [TribeId<T>, ...TribeId<T>[]]
      };
      break;
    case 'tiedMajority':
      result = {
        ...normalized,
        source: normalizeSelector(normalized.source)
      };
      break;
    default:
      result = {...normalized};
      break;
  }
  return result;
}

/**
 * Normalizes a count expression.
 *
 * @template {readonly Tribe[]} T
 * @param {CountExpression<T> | undefined} expression expression to normalize.
 * @param {readonly TribeId<T>[] | undefined} legacyTribes legacy tribe list.
 * @returns {CountExpression<T>} normalized count expression.
 */
export function normalizeCountExpression<T extends readonly Tribe[]>(expression: CountExpression<T> | undefined, legacyTribes?: readonly TribeId<T>[]): CountExpression<T> {
  return {
    kind: 'count',
    selector: normalizeSelector(expression?.selector, legacyTribes)
  };
}

/**
 * Serializes a selector after canonical normalization.
 *
 * @template {readonly Tribe[]} T
 * @param {TribeSelector<T>} selector selector to sign.
 * @returns {string} selector signature.
 */
export function selectorSignature<T extends readonly Tribe[]>(selector: TribeSelector<T>): string {
  return JSON.stringify(normalizeSelectorForSignature(selector));
}

/**
 * Normalizes selector ordering for signatures and lookup keys.
 *
 * @template {readonly Tribe[]} T
 * @param {TribeSelector<T>} selector selector to normalize.
 * @returns {TribeSelector<T>} normalized selector.
 */
export function normalizeSelectorForSignature<T extends readonly Tribe[]>(selector: TribeSelector<T>): TribeSelector<T> {
  let normalized: TribeSelector<T>;
  switch (selector.kind) {
    case 'tribes':
      normalized = {
        ...selector,
        tribes: [...new Set(selector.tribes)].sort() as [TribeId<T>, ...TribeId<T>[]]
      };
      break;
    case 'tiedMajority':
      normalized = {
        ...selector,
        source: normalizeSelectorForSignature(selector.source)
      };
      break;
    default:
      normalized = selector;
      break;
  }
  return normalized;
}

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
    case COUNT_CLAUSE_KIND:
    case NONE_CLAUSE_KIND:
    case EXACTLY_CLAUSE_KIND:
    case MIN_CLAUSE_KIND:
    case MAX_CLAUSE_KIND:
      return {
        ...clause,
        selector: normalizeSelector(clause.selector, clause.tribes)
      };
    case COMPARISON_CLAUSE_KIND:
      return {
        ...clause,
        left: normalizeCountExpression(clause.left, clause.tribe1),
        right: normalizeCountExpression(clause.right, clause.tribe2),
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
 * Normalizes a clause for persistence by removing legacy selector aliases.
 *
 * @template {readonly Tribe[]} T
 * @param {Clause<T>} clause clause to normalize.
 * @returns {Clause<T>} persisted clause shape.
 */
export function normalizeClauseForPersistence<T extends readonly Tribe[]>(clause: Clause<T>): Clause<T> {
  const normalized = normalizeClauseForEditor(clause);
  switch (normalized.kind) {
    case COUNT_CLAUSE_KIND:
    case NONE_CLAUSE_KIND:
    case EXACTLY_CLAUSE_KIND:
    case MIN_CLAUSE_KIND:
    case MAX_CLAUSE_KIND: {
      const persistedClause = structuredClone(normalized);
      delete persistedClause.tribes;
      return persistedClause;
    }
    case COMPARISON_CLAUSE_KIND: {
      const persistedClause = structuredClone(normalized);
      delete persistedClause.tribe1;
      delete persistedClause.tribe2;
      return persistedClause;
    }
    case NOT_CLAUSE_KIND:
      return {
        ...normalized,
        clause: normalizeClauseForPersistence(normalized.clause)
      };
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND:
      return {
        ...normalized,
        clauses: normalized.clauses.map(sub => normalizeClauseForPersistence(sub)) as [Clause<T>, Clause<T>, ...Clause<T>[]]
      };
    default:
      return normalized;
  }
}

/**
 * Normalizes legacy rule targets into the current outcome expression.
 *
 * @template {readonly Tribe[]} T
 * @param {Pick<Rule<T>, 'become' | 'tribe'>} rule rule target data to normalize.
 * @returns {Become<T>} normalized outcome expression.
 */
export function normalizeBecome<T extends readonly Tribe[]>(rule: Pick<Rule<T>, 'become' | 'tribe'>): Become<T> {
  return rule.become ?? {
    kind: 'fixed',
    tribe: (rule.tribe ?? DEAD_TRIBE_ID) as TribeId<T>
  };
}

/**
 * Normalizes an outcome expression for editor comparison and persistence.
 *
 * @template {readonly Tribe[]} T
 * @param {Become<T>} become outcome to normalize.
 * @returns {Become<T>} normalized outcome.
 */
export function normalizeBecomeExpression<T extends readonly Tribe[]>(become: Become<T>): Become<T> {
  let normalized: Become<T>;
  switch (become.kind) {
    case 'majority':
    case 'minority':
      normalized = {
        ...become,
        selector: normalizeSelector(become.selector),
        tie: become.tie ? normalizeBecomeExpression(become.tie) : undefined,
        fallback: become.fallback ? normalizeBecomeExpression(become.fallback) : undefined
      };
      break;
    case 'combine':
      normalized = {
        kind: 'combine',
        strategy: {
          ...become.strategy,
          entries: become.strategy.entries.map(entry => ({
            ...entry,
            inputs: entry.inputs.map(input => normalizeCombinationInput(input as TribeSelector<T> | TribeId<T>)).sort((left, right) => selectorSignature(left).localeCompare(selectorSignature(right)))
          })),
          default: become.strategy.default ? normalizeBecomeExpression(become.strategy.default) : undefined
        },
        fallback: become.fallback ? normalizeBecomeExpression(become.fallback) : undefined
      };
      break;
    default:
      normalized = {...become};
      break;
  }
  return normalized;
}

/**
 * Normalizes a rule for runtime and editor use.
 *
 * @template {readonly Tribe[]} T
 * @param {Rule<T>} rule rule to normalize.
 * @returns {NormalizedRule<T>} cloned rule with a normalized outcome.
 */
export function normalizeRule<T extends readonly Tribe[]>(rule: Rule<T>): NormalizedRule<T> {
  const normalizedRule = structuredClone(rule) as NormalizedRule<T>;
  normalizedRule.become = normalizeBecomeExpression(normalizeBecome(rule));
  return normalizedRule;
}

/**
 * Removes editor-only rule state before persistence or comparison.
 *
 * @template {readonly Tribe[]} T
 * @param {Rule<T>} rule rule to normalize.
 * @returns {Rule<T>} persisted rule shape.
 */
export function toPersistedRule<T extends readonly Tribe[]>(rule: Rule<T>): Rule<T> {
  const persistedRule = normalizeRule(rule);
  persistedRule.clause = normalizeClauseForPersistence(persistedRule.clause);
  delete persistedRule.key;
  delete persistedRule.tribe;
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
