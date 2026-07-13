import {AND_CLAUSE_KIND, Become, Clause, COMBINE_BECOME_KIND, COMPARISON_CLAUSE_KIND, CountExpression, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, DEFAULT_RANDOM_SEED, DEFAULT_RULE_PROBABILITY, DIFFERENT_IN_TRIBE_SELECTOR_KIND, EMPTY_CLAUSE, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, TRIBES_SELECTOR_KIND, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MAJORITY_BECOME_KIND, MAX_CLAUSE_KIND, MAX_RANDOM_SEED, MAX_RULE_PROBABILITY, MIN_CLAUSE_KIND, MINORITY_BECOME_KIND, MIN_RANDOM_SEED, MIN_RULE_PROBABILITY, NeighborCount, NONE_CLAUSE_KIND, NormalizedRule, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, RULE_PROBABILITY_INPUT_SCALE, Rule, Ruleset, Tribe, TribeId, TribeSelector, XOR_CLAUSE_KIND} from '../model/rule';
import {ClauseDraft, RuleDraft} from '../model/rule-draft';

/**
 * Serializes a value with deterministic object key order.
 *
 * @param {unknown} value value to serialize.
 * @returns {string} stable JSON representation.
 */
function stableStringify(value: unknown): string {
  let serialized: string;
  if (Array.isArray(value)) {
    serialized = `[${value.map(item => stableStringify(item)).join(',')}]`;
  } else if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined).sort(([left], [right]) => left.localeCompare(right));
    serialized = `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
  } else {
    serialized = JSON.stringify(value);
  }
  return serialized;
}

/**
 * Checks whether a numeric draft is a valid neighbor count.
 *
 * @param {number | null | undefined} value draft value.
 * @returns {value is NeighborCount} `true` if the value is a valid neighbor count.
 */
function isNeighborCount(value: number | null | undefined): value is NeighborCount {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 8;
}

/**
 * Checks whether a numeric draft is a valid comparison margin.
 *
 * @param {number | null | undefined} value draft value.
 * @returns {value is number} `true` if the value is a valid margin.
 */
function isComparisonMargin(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= -8 && value <= 8;
}

/**
 * Checks whether a numeric draft is a valid rule probability.
 *
 * @param {number | null | undefined} value draft value.
 * @returns {value is number} `true` if the value is a valid probability.
 */
function isRuleProbability(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_RULE_PROBABILITY && value <= MAX_RULE_PROBABILITY;
}

/**
 * Converts a string list into a non-empty tribe list.
 *
 * @param {readonly string[]} tribes tribe IDs.
 * @returns {[string, ...string[]]} non-empty tribe IDs.
 */
function toNonEmptyTribeIds(tribes: readonly string[]): [string, ...string[]] {
  const [first, ...rest] = tribes;
  if (first === undefined) {
    throw new Error('Cannot convert an empty tribe draft to a canonical clause.');
  }
  return [first, ...rest];
}

/**
 * Converts a valid clause draft into a canonical clause.
 *
 * @param {ClauseDraft} clause clause draft.
 * @returns {Clause<Tribe[]>} canonical clause.
 */
function toCanonicalClause(clause: ClauseDraft): Clause<Tribe[]> {
  let canonical: Clause<Tribe[]>;
  switch (clause.kind) {
    case EMPTY_CLAUSE_KIND:
      canonical = EMPTY_CLAUSE;
      break;
    case IS_CLAUSE_KIND:
      canonical = {
        kind: IS_CLAUSE_KIND,
        tribes: toNonEmptyTribeIds(clause.tribes)
      };
      break;
    case COUNT_CLAUSE_KIND: {
      const [min, max] = clause.interval;
      if (!isNeighborCount(min) || !isNeighborCount(max)) {
        throw new Error('Cannot convert an invalid count interval draft to a canonical clause.');
      }
      canonical = {
        kind: COUNT_CLAUSE_KIND,
        selector: normalizeSelector(clause.selector),
        interval: [min, max]
      };
      break;
    }
    case NONE_CLAUSE_KIND:
      canonical = {
        kind: NONE_CLAUSE_KIND,
        selector: normalizeSelector(clause.selector)
      };
      break;
    case EXACTLY_CLAUSE_KIND:
    case MIN_CLAUSE_KIND:
    case MAX_CLAUSE_KIND:
      if (!isNeighborCount(clause.value)) {
        throw new Error('Cannot convert an invalid count value draft to a canonical clause.');
      }
      canonical = {
        kind: clause.kind,
        selector: normalizeSelector(clause.selector),
        value: clause.value
      };
      break;
    case COMPARISON_CLAUSE_KIND: {
      const margin = clause.margin ?? 0;
      if (!isComparisonMargin(margin)) {
        throw new Error('Cannot convert an invalid comparison margin draft to a canonical clause.');
      }
      canonical = {
        kind: COMPARISON_CLAUSE_KIND,
        left: normalizeCountExpression(clause.left),
        right: normalizeCountExpression(clause.right),
        operator: clause.operator,
        margin
      };
      break;
    }
    case NOT_CLAUSE_KIND:
      canonical = {
        kind: NOT_CLAUSE_KIND,
        clause: toCanonicalClause(clause.clause)
      };
      break;
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND: {
      const canonicalClauses = clause.clauses.map(child => toCanonicalClause(child));
      const [first, second, ...rest] = canonicalClauses;
      if (first === undefined || second === undefined) {
        throw new Error('Cannot convert a logical clause draft with fewer than two children.');
      }
      canonical = {
        kind: clause.kind,
        clauses: [first, second, ...rest]
      };
      break;
    }
  }
  return canonical;
}

/**
 * Normalizes a clause draft for editor comparison without coercing invalid drafts.
 *
 * @param {ClauseDraft} clause clause draft.
 * @returns {ClauseDraft} comparable clause draft.
 */
function normalizeClauseDraftForComparison(clause: ClauseDraft): ClauseDraft {
  let normalized: ClauseDraft;
  switch (clause.kind) {
    case EMPTY_CLAUSE_KIND:
      normalized = EMPTY_CLAUSE;
      break;
    case COUNT_CLAUSE_KIND:
    case NONE_CLAUSE_KIND:
    case EXACTLY_CLAUSE_KIND:
    case MIN_CLAUSE_KIND:
    case MAX_CLAUSE_KIND:
      normalized = {
        ...clause,
        selector: normalizeSelector(clause.selector)
      };
      break;
    case COMPARISON_CLAUSE_KIND:
      normalized = {
        ...clause,
        left: normalizeCountExpression(clause.left),
        right: normalizeCountExpression(clause.right),
        margin: clause.margin === undefined ? 0 : clause.margin
      };
      break;
    case NOT_CLAUSE_KIND:
      normalized = {
        ...clause,
        clause: normalizeClauseDraftForComparison(clause.clause)
      };
      break;
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND: {
      const normalizedClauses = clause.clauses.map(sub => normalizeClauseDraftForComparison(sub));
      while (normalizedClauses.length < 2) {
        normalizedClauses.push(EMPTY_CLAUSE);
      }
      normalized = {
        ...clause,
        clauses: normalizedClauses
      };
      break;
    }
    default:
      normalized = clause;
      break;
  }
  return normalized;
}

/**
 * Normalizes a rule draft for editor comparison without persisted numeric coercion.
 *
 * @param {RuleDraft} rule rule draft.
 * @returns {RuleDraft} comparable rule draft.
 */
function normalizeRuleDraftForComparison(rule: RuleDraft): RuleDraft {
  const draft = structuredClone(rule);
  const {probability} = draft;
  const normalizedDraft: RuleDraft = {
    ...draft,
    muted: !!draft.muted,
    clause: normalizeClauseDraftForComparison(draft.clause),
    become: normalizeBecomeExpression(normalizeBecome(draft.become))
  };
  delete normalizedDraft.key;
  normalizedDraft.probability = probability === undefined ? DEFAULT_RULE_PROBABILITY : probability;
  return normalizedDraft;
}

/**
 * Normalizes a ruleset random seed into a WebGPU-safe unsigned 32-bit integer.
 *
 * @param {number | undefined} seed seed value to normalize.
 * @returns {number} normalized random seed.
 */
export function normalizeRandomSeed(seed: number | undefined): number {
  const numericSeed = typeof seed === 'number' && Number.isFinite(seed) ? seed : DEFAULT_RANDOM_SEED;
  return Math.max(MIN_RANDOM_SEED, Math.min(MAX_RANDOM_SEED, Math.trunc(numericSeed)));
}

/**
 * Normalizes a rule probability into a percentage using the configured input scale.
 *
 * @param {number | undefined} probability probability value to normalize.
 * @returns {number} normalized probability percentage.
 */
export function normalizeRuleProbability(probability: number | undefined): number {
  const numericProbability = typeof probability === 'number' && Number.isFinite(probability) ? probability : DEFAULT_RULE_PROBABILITY;
  const scaledProbability = Math.round(numericProbability * RULE_PROBABILITY_INPUT_SCALE) / RULE_PROBABILITY_INPUT_SCALE;
  return Math.max(MIN_RULE_PROBABILITY, Math.min(MAX_RULE_PROBABILITY, scaledProbability));
}

/**
 * Converts a probability percentage into a u32 shader threshold.
 *
 * @param {number | undefined} probability probability percentage.
 * @returns {number} u32 threshold.
 */
export function probabilityThresholdU32(probability: number | undefined): number {
  return Math.floor((normalizeRuleProbability(probability) / MAX_RULE_PROBABILITY) * MAX_RANDOM_SEED);
}

/**
 * Creates an explicit-tribe selector.
 *
 * @template {readonly Tribe[]} T
 * @param {readonly TribeId<T>[] | undefined} tribes selected tribe IDs.
 * @returns {TribeSelector<T>} explicit selector.
 */
export function explicitTribesSelector<T extends readonly Tribe[]>(tribes: readonly TribeId<T>[] | undefined): TribeSelector<T> {
  const selectedTribes = tribes && tribes.length > 0 ? tribes : [DEAD_TRIBE_ID as TribeId<T>];
  return {
    kind: TRIBES_SELECTOR_KIND,
    tribes: [...selectedTribes] as [TribeId<T>, ...TribeId<T>[]]
  };
}

/**
 * Toggles one tribe in an explicit tribe selection.
 *
 * @template {readonly Tribe[]} T
 * @param {readonly TribeId<T>[]} tribes current selected tribe IDs.
 * @param {TribeId<T>} tribeId tribe ID to toggle.
 * @param {TribeId<T>} fallbackTribeId tribe ID used when the toggle would clear the selection.
 * @returns {[TribeId<T>, ...TribeId<T>[]]} next selected tribe IDs.
 */
export function toggleExplicitTribeSelection<T extends readonly Tribe[]>(tribes: readonly TribeId<T>[], tribeId: TribeId<T>, fallbackTribeId: TribeId<T>): [TribeId<T>, ...TribeId<T>[]] {
  const selected = new Set(tribes);
  if (selected.has(tribeId)) {
    selected.delete(tribeId);
  } else {
    selected.add(tribeId);
  }
  const nextTribes = [...selected];
  return (nextTribes.length > 0 ? nextTribes : [fallbackTribeId]) as [TribeId<T>, ...TribeId<T>[]];
}

/**
 * Normalizes a selector expression.
 *
 * @template {readonly Tribe[]} T
 * @param {TribeSelector<T> | undefined} selector selector to normalize.
 * @returns {TribeSelector<T>} normalized selector.
 */
export function normalizeSelector<T extends readonly Tribe[]>(selector: TribeSelector<T> | undefined): TribeSelector<T> {
  const normalized = selector ?? explicitTribesSelector(undefined);
  let result: TribeSelector<T>;
  switch (normalized.kind) {
    case TRIBES_SELECTOR_KIND:
    case DIFFERENT_IN_TRIBE_SELECTOR_KIND:
      result = {
        ...normalized,
        tribes: [...normalized.tribes] as [TribeId<T>, ...TribeId<T>[]]
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
 * @returns {CountExpression<T>} normalized count expression.
 */
export function normalizeCountExpression<T extends readonly Tribe[]>(expression: CountExpression<T> | undefined): CountExpression<T> {
  return {
    kind: 'count',
    selector: normalizeSelector(expression?.selector)
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
  return stableStringify(normalizeSelectorForSignature(selector));
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
    case TRIBES_SELECTOR_KIND:
    case DIFFERENT_IN_TRIBE_SELECTOR_KIND:
      normalized = {
        ...selector,
        tribes: [...new Set(selector.tribes)].sort() as [TribeId<T>, ...TribeId<T>[]]
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
        selector: normalizeSelector(clause.selector)
      };
    case COMPARISON_CLAUSE_KIND:
      return {
        ...clause,
        left: normalizeCountExpression(clause.left),
        right: normalizeCountExpression(clause.right),
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
 * Normalizes a clause for persistence.
 *
 * @template {readonly Tribe[]} T
 * @param {Clause<T>} clause clause to normalize.
 * @returns {Clause<T>} persisted clause shape.
 */
export function normalizeClauseForPersistence<T extends readonly Tribe[]>(clause: Clause<T>): Clause<T> {
  const normalized = normalizeClauseForEditor(clause);
  switch (normalized.kind) {
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
 * Normalizes an optional canonical outcome expression.
 *
 * @template {readonly Tribe[]} T
 * @param {Become<T> | undefined} become outcome expression.
 * @returns {Become<T>} normalized outcome expression.
 */
export function normalizeBecome<T extends readonly Tribe[]>(become: Become<T> | undefined): Become<T> {
  return become ?? {
    kind: FIXED_BECOME_KIND,
    tribe: DEAD_TRIBE_ID as TribeId<T>
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
    case MAJORITY_BECOME_KIND:
    case MINORITY_BECOME_KIND:
      normalized = {
        ...become,
        selector: normalizeSelector(become.selector),
        tie: become.tie ? normalizeBecomeExpression(become.tie) : undefined,
        fallback: become.fallback ? normalizeBecomeExpression(become.fallback) : undefined
      };
      break;
    case COMBINE_BECOME_KIND:
      normalized = {
        kind: COMBINE_BECOME_KIND,
        entries: become.entries.map(entry => ({
          ...entry,
          inputs: entry.inputs.map(input => normalizeSelector(input)).sort((left, right) => selectorSignature(left).localeCompare(selectorSignature(right)))
        })),
        default: become.default ? normalizeBecomeExpression(become.default) : undefined
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
  normalizedRule.become = normalizeBecomeExpression(normalizeBecome(rule.become));
  normalizedRule.probability = normalizeRuleProbability(rule.probability);
  return normalizedRule;
}

/**
 * Normalizes ruleset-level fields and contained rules.
 *
 * @template {readonly Tribe[]} T
 * @param {Ruleset<T>} ruleset ruleset to normalize.
 * @returns {Ruleset<T>} normalized ruleset.
 */
export function normalizeRuleset<T extends readonly Tribe[]>(ruleset: Ruleset<T>): Ruleset<T> {
  return {
    ...ruleset,
    randomSeed: normalizeRandomSeed(ruleset.randomSeed),
    rules: ruleset.rules.map(rule => toPersistedRule(rule))
  };
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
  persistedRule.muted = !!persistedRule.muted;
  persistedRule.probability = normalizeRuleProbability(persistedRule.probability);
  return persistedRule;
}

/**
 * Converts a valid rule draft into a persisted canonical rule.
 *
 * @param {RuleDraft} rule rule draft.
 * @returns {Rule<Tribe[]>} persisted canonical rule.
 */
export function toPersistedRuleDraft(rule: RuleDraft): Rule<Tribe[]> {
  const canonicalRule: Rule<Tribe[]> = {
    key: rule.key,
    muted: !!rule.muted,
    clause: toCanonicalClause(rule.clause),
    become: normalizeBecomeExpression(normalizeBecome(rule.become))
  };
  if (rule.probability !== undefined) {
    if (!isRuleProbability(rule.probability)) {
      throw new Error('Cannot convert an invalid probability draft to a canonical rule.');
    }
    canonicalRule.probability = rule.probability;
  }
  return toPersistedRule(canonicalRule);
}

/**
 * Creates a comparable clause signature.
 *
 * @template {readonly Tribe[]} T
 * @param {Clause<T>} clause clause to sign.
 * @returns {string} serialized normalized clause.
 */
export function clauseSignature<T extends readonly Tribe[]>(clause: Clause<T>): string {
  return stableStringify(normalizeClauseForEditor(clause));
}

/**
 * Creates a comparable rule signature.
 *
 * @template {readonly Tribe[]} T
 * @param {Rule<T>} rule rule to sign.
 * @returns {string} serialized persisted rule.
 */
export function ruleSignature<T extends readonly Tribe[]>(rule: Rule<T>): string {
  return stableStringify(toPersistedRule(rule));
}

/**
 * Creates a comparable rule draft without editor-only identity.
 *
 * @param {RuleDraft} rule rule draft to sign.
 * @returns {string} serialized rule draft.
 */
export function ruleDraftSignature(rule: RuleDraft): string {
  return stableStringify(normalizeRuleDraftForComparison(rule));
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
 * Compares two rule drafts without persisted normalization.
 *
 * @param {RuleDraft} editableRule editable rule.
 * @param {RuleDraft} baseRule baseline rule.
 * @returns {boolean} `true` if equal.
 */
export function ruleDraftsEqual(editableRule: RuleDraft, baseRule: RuleDraft): boolean {
  return ruleDraftSignature(editableRule) === ruleDraftSignature(baseRule);
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

/**
 * Compares two rule draft lists without persisted normalization.
 *
 * @param {readonly RuleDraft[]} editableRules editable rules.
 * @param {readonly RuleDraft[]} baseRules baseline rules.
 * @returns {boolean} `true` if equal.
 */
export function ruleDraftListsEqual(editableRules: readonly RuleDraft[], baseRules: readonly RuleDraft[]): boolean {
  return editableRules.length === baseRules.length && editableRules.every((rule, index) => ruleDraftsEqual(rule, baseRules[index]!));
}
