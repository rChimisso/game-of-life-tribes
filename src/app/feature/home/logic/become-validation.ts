import {normalizeSelector, selectorSignature} from './rule-editor';

import {DIFFERENT_INPUT_VALUE, SAME_INPUT_VALUE, TRIBE_INPUT_PREFIX, type BecomeValidationIssue, type RankedBecome} from '~gol/feature/home/model/become-validation';
import {Become, COMBINE_BECOME_KIND, CombinationEntry, DEAD_TRIBE_ID, DIFFERENT_IN_TRIBE_SELECTOR_KIND, DIFFERENT_TRIBE_SELECTOR_KIND, FIXED_BECOME_KIND, MAJORITY_BECOME_KIND, MAX_COMBINATION_INPUTS, MINORITY_BECOME_KIND, SAME_TRIBE_SELECTOR_KIND, Tribe, TribeSelector, TRIBES_SELECTOR_KIND} from '~gol/feature/home/model/rule';

/**
 * Appends a field path segment.
 *
 * @param {string} path parent path.
 * @param {string} field field name.
 * @returns {string} child path.
 */
function childPath(path: string, field: string): string {
  return path ? `${path}.${field}` : field;
}

/**
 * Appends an array index path segment.
 *
 * @param {string} path parent path.
 * @param {number} index array index.
 * @returns {string} child path.
 */
function indexedPath(path: string, index: number): string {
  return `${path}[${index}]`;
}

/**
 * Adds one validation issue.
 *
 * @param {BecomeValidationIssue[]} issues issue sink.
 * @param {string} path invalid value path.
 * @param {string} message validation message.
 */
function addIssue(issues: BecomeValidationIssue[], path: string, message: string): void {
  issues.push({path, message});
}

/**
 * Returns whether an outcome is majority/minority ranked.
 *
 * @param {Become<Tribe[]>} become outcome expression.
 * @returns {become is RankedBecome} whether the outcome is ranked.
 */
export function isRankedBecome(become: Become<Tribe[]>): become is RankedBecome {
  return become.kind === MAJORITY_BECOME_KIND || become.kind === MINORITY_BECOME_KIND;
}

/**
 * Returns the select value for a combination input selector.
 *
 * @param {TribeSelector<Tribe[]>} input input selector.
 * @returns {string} select value.
 */
export function combinationInputValue(input: TribeSelector<Tribe[]>): string {
  const selector = normalizeSelector(input);
  let value: string;
  switch (selector.kind) {
    case SAME_TRIBE_SELECTOR_KIND:
      value = SAME_INPUT_VALUE;
      break;
    case DIFFERENT_TRIBE_SELECTOR_KIND:
      value = DIFFERENT_INPUT_VALUE;
      break;
    case DIFFERENT_IN_TRIBE_SELECTOR_KIND:
      value = selectorSignature(selector);
      break;
    case TRIBES_SELECTOR_KIND:
      value = `${TRIBE_INPUT_PREFIX}${selector.tribes[0]}`;
      break;
  }
  return value;
}

/**
 * Returns tribe IDs available as combination inputs for the ranked context.
 *
 * @param {readonly Tribe[]} tribes known tribes.
 * @param {(RankedBecome | null)} ranked ranked context.
 * @returns {string[]} selectable tribe IDs.
 */
export function combinationTribeIds(tribes: readonly Tribe[], ranked: RankedBecome | null): string[] {
  const allowedIds = ranked?.selector.kind === TRIBES_SELECTOR_KIND || ranked?.selector.kind === DIFFERENT_IN_TRIBE_SELECTOR_KIND ? new Set(ranked.selector.tribes) : null;
  return tribes.filter(tribe => !allowedIds || allowedIds.has(tribe.id) || tribe.id === DEAD_TRIBE_ID).map(tribe => tribe.id);
}

/**
 * Returns effective combination input values available in a context.
 *
 * @param {readonly Tribe[]} tribes known tribes.
 * @param {(RankedBecome | null)} ranked ranked context.
 * @returns {Set<string>} allowed input values.
 */
export function availableCombinationInputValues(tribes: readonly Tribe[], ranked: RankedBecome | null): Set<string> {
  const values = new Set(combinationTribeIds(tribes, ranked).map(id => `${TRIBE_INPUT_PREFIX}${id}`));
  values.add(SAME_INPUT_VALUE);
  values.add(DIFFERENT_INPUT_VALUE);
  return values;
}

/**
 * Validates a selector in the given semantic context.
 *
 * @param {TribeSelector<Tribe[]>} selector selector expression.
 * @param {readonly Tribe[]} tribes known tribes.
 * @param {string} path selector path.
 * @param {(RankedBecome | null)} _ranked ranked input context.
 * @returns {BecomeValidationIssue[]} validation issues.
 */
export function validateSelectorInContext(selector: TribeSelector<Tribe[]>, tribes: readonly Tribe[], path: string, _ranked: RankedBecome | null = null): BecomeValidationIssue[] {
  const knownIds = new Set(tribes.map(tribe => tribe.id));
  const issues: BecomeValidationIssue[] = [];
  switch (selector.kind) {
    case TRIBES_SELECTOR_KIND:
    case DIFFERENT_IN_TRIBE_SELECTOR_KIND:
      if (selector.tribes.length === 0) {
        addIssue(issues, childPath(path, 'tribes'), 'Choose at least one tribe.');
      } else if (selector.tribes.some(id => !knownIds.has(id))) {
        addIssue(issues, childPath(path, 'tribes'), 'Choose only existing tribes.');
      }
      break;
  }
  return issues;
}

/**
 * Creates the duplicate-row signature for one combination entry.
 *
 * @param {CombinationEntry<Tribe[]>} entry combination row.
 * @returns {string} normalized row signature.
 */
export function combinationRowSignature(entry: CombinationEntry<Tribe[]>): string {
  return entry.inputs.map(selector => selectorSignature(selector)).sort().join('|');
}

/**
 * Validates one combination row.
 *
 * @param {CombinationEntry<Tribe[]>} entry combination row.
 * @param {readonly Tribe[]} tribes known tribes.
 * @param {(RankedBecome | null)} ranked ranked context.
 * @param {Set<string>} seenRows normalized row signatures.
 * @param {string} path row path.
 * @returns {BecomeValidationIssue[]} validation issues.
 */
export function validateCombinationEntry(entry: CombinationEntry<Tribe[]>, tribes: readonly Tribe[], ranked: RankedBecome | null, seenRows: Set<string>, path: string): BecomeValidationIssue[] {
  const knownIds = new Set(tribes.map(tribe => tribe.id));
  const allowedValues = availableCombinationInputValues(tribes, ranked);
  const issues: BecomeValidationIssue[] = [];
  if (entry.inputs.length === 0) {
    addIssue(issues, childPath(path, 'inputs'), 'Combination rows need at least one input.');
  } else if (entry.inputs.length > MAX_COMBINATION_INPUTS) {
    addIssue(issues, childPath(path, 'inputs'), 'Combination rows can use at most eight inputs.');
  } else if (new Set(entry.inputs.map(input => combinationInputValue(input))).size !== entry.inputs.length) {
    addIssue(issues, childPath(path, 'inputs'), 'Combination rows cannot repeat the same input.');
  }
  for (let index = 0; index < entry.inputs.length; index++) {
    const input = entry.inputs[index]!;
    issues.push(...validateSelectorInContext(input, tribes, indexedPath(childPath(path, 'inputs'), index), ranked));
    if (!allowedValues.has(combinationInputValue(input))) {
      addIssue(issues, indexedPath(childPath(path, 'inputs'), index), 'Combination rows can only use inputs available in this context.');
    }
  }
  if (!knownIds.has(entry.output)) {
    addIssue(issues, childPath(path, 'output'), 'Combination rows can only reference existing tribes.');
  }
  if (issues.length === 0) {
    const rowKey = combinationRowSignature(entry);
    if (seenRows.has(rowKey)) {
      addIssue(issues, path, 'Combination table has duplicate input rows.');
    } else {
      seenRows.add(rowKey);
    }
  }
  return issues;
}

/**
 * Validates an outcome expression.
 *
 * @param {Become<Tribe[]>} become outcome expression.
 * @param {readonly Tribe[]} tribes known tribes.
 * @param {string} path outcome path.
 * @param {(RankedBecome | null)} ranked ranked context.
 * @returns {BecomeValidationIssue[]} validation issues.
 */
export function validateBecomeSemantics(become: Become<Tribe[]>, tribes: readonly Tribe[], path: string, ranked: RankedBecome | null = null): BecomeValidationIssue[] {
  const knownIds = new Set(tribes.map(tribe => tribe.id));
  const issues: BecomeValidationIssue[] = [];
  switch (become.kind) {
    case FIXED_BECOME_KIND:
      if (!knownIds.has(become.tribe)) {
        addIssue(issues, childPath(path, 'tribe'), 'Choose a valid fixed tribe.');
      }
      break;
    case MAJORITY_BECOME_KIND:
    case MINORITY_BECOME_KIND:
      issues.push(...validateSelectorInContext(become.selector, tribes, childPath(path, 'selector')));
      if (become.tie) {
        issues.push(...validateBecomeSemantics(become.tie, tribes, childPath(path, 'tie'), become));
      } else {
        addIssue(issues, childPath(path, 'tie'), 'Choose a tie behavior.');
      }
      if (become.fallback) {
        issues.push(...validateBecomeSemantics(become.fallback, tribes, childPath(path, 'fallback'), become));
      } else {
        addIssue(issues, childPath(path, 'fallback'), 'Choose a fallback.');
      }
      break;
    case COMBINE_BECOME_KIND: {
      const seenRows = new Set<string>();
      for (let index = 0; index < become.entries.length; index++) {
        issues.push(...validateCombinationEntry(become.entries[index]!, tribes, ranked, seenRows, indexedPath(childPath(path, 'entries'), index)));
      }
      if (become.default) {
        issues.push(...validateBecomeSemantics(become.default, tribes, childPath(path, 'default')));
      } else {
        addIssue(issues, childPath(path, 'default'), 'Choose a combination default.');
      }
      break;
    }
  }
  return issues;
}
