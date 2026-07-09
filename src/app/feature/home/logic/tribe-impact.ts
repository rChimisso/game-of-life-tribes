import {gridByteSize, requiredGridFormatForStateCount, validatePackingAgainstStateCount} from './grid-format';
import {normalizeBecome, normalizeCountExpression, normalizeRule, normalizeSelector} from './rule-editor';
import {Grid} from '../model/grid';
import {BitsPerCell} from '../model/grid-format';
import {RECORDING_MAX_FRAME_BYTES} from '../model/recording-limits';
import {AND_CLAUSE_KIND, Become, Clause, COMBINE_BECOME_KIND, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, DIFFERENT_IN_TRIBE_SELECTOR_KIND, EditableTribe, EXACTLY_CLAUSE_KIND, TRIBES_SELECTOR_KIND, FIXED_BECOME_KIND, IS_CLAUSE_KIND, MAJORITY_BECOME_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, MINORITY_BECOME_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Rule, TIE_SELECTOR_KIND, Tribe, TribeSelector, XOR_CLAUSE_KIND} from '../model/rule';
import {TribeApplyImpact, TribePackingImpact, TribeRenamePair} from '../model/tribe-impact';

/**
 * Collects every tribe id referenced by the provided rules and clauses.
 *
 * @param {readonly Rule<Tribe[]>[]} rules Rules to scan for tribe references.
 * @returns {Set<string>} Referenced tribe IDs.
 */
function collectReferencedTribeIds(rules: readonly Rule<Tribe[]>[]): Set<string> {
  const ids = new Set<string>();
  for (const rule of rules) {
    collectBecomeTribeIds(normalizeBecome(rule.become), ids);
    collectClauseTribeIds(rule.clause, ids);
  }
  return ids;
}

/**
 * Visits each mutable tribe id list contained in a clause tree.
 *
 * @param {Clause<Tribe[]>} clause Clause tree to traverse.
 * @param {(ids: [string, ...string[]]) => void} visit Callback invoked for each tribe id list.
 */
function visitClauseTribeIdLists(clause: Clause<Tribe[]>, visit: (ids: [string, ...string[]]) => void): void {
  switch (clause.kind) {
    case IS_CLAUSE_KIND:
      visit(clause.tribes);
      break;
    case NOT_CLAUSE_KIND:
      visitClauseTribeIdLists(clause.clause, visit);
      break;
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND:
      for (const child of clause.clauses) {
        visitClauseTribeIdLists(child, visit);
      }
      break;
  }
}

/**
 * Adds every tribe id referenced by a clause tree into a set.
 *
 * @param {Clause<Tribe[]>} clause Clause tree to scan.
 * @param {Set<string>} ids Output set receiving referenced IDs.
 */
function collectClauseTribeIds(clause: Clause<Tribe[]>, ids: Set<string>): void {
  visitClauseTribeIdLists(clause, tribeIds => {
    for (const id of tribeIds) {
      ids.add(id);
    }
  });
  collectClauseSelectorTribeIds(clause, ids);
}

/**
 * Adds every tribe id referenced by clause selectors into a set.
 *
 * @param {Clause<Tribe[]>} clause Clause tree to scan.
 * @param {Set<string>} ids Output set receiving referenced IDs.
 */
function collectClauseSelectorTribeIds(clause: Clause<Tribe[]>, ids: Set<string>): void {
  switch (clause.kind) {
    case COUNT_CLAUSE_KIND:
    case NONE_CLAUSE_KIND:
    case EXACTLY_CLAUSE_KIND:
    case MIN_CLAUSE_KIND:
    case MAX_CLAUSE_KIND:
      collectSelectorTribeIds(normalizeSelector(clause.selector), ids);
      break;
    case COMPARISON_CLAUSE_KIND:
      collectSelectorTribeIds(normalizeCountExpression(clause.left).selector, ids);
      collectSelectorTribeIds(normalizeCountExpression(clause.right).selector, ids);
      break;
    case NOT_CLAUSE_KIND:
      collectClauseSelectorTribeIds(clause.clause, ids);
      break;
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND:
      for (const child of clause.clauses) {
        collectClauseSelectorTribeIds(child, ids);
      }
      break;
  }
}

/**
 * Adds every tribe id referenced by a selector expression into a set.
 *
 * @param {TribeSelector<Tribe[]>} selector Selector expression to scan.
 * @param {Set<string>} ids Output set receiving referenced IDs.
 */
function collectSelectorTribeIds(selector: TribeSelector<Tribe[]>, ids: Set<string>): void {
  switch (selector.kind) {
    case TRIBES_SELECTOR_KIND:
    case DIFFERENT_IN_TRIBE_SELECTOR_KIND:
      for (const id of selector.tribes) {
        ids.add(id);
      }
      break;
    case TIE_SELECTOR_KIND:
      collectSelectorTribeIds(selector.source, ids);
      break;
  }
}

/**
 * Adds every tribe id referenced by a become expression into a set.
 *
 * @param {Become<Tribe[]>} become Outcome expression to scan.
 * @param {Set<string>} ids Output set receiving referenced IDs.
 */
function collectBecomeTribeIds(become: Become<Tribe[]>, ids: Set<string>): void {
  switch (become.kind) {
    case FIXED_BECOME_KIND:
      ids.add(become.tribe);
      break;
    case MAJORITY_BECOME_KIND:
    case MINORITY_BECOME_KIND:
      collectSelectorTribeIds(become.selector, ids);
      if (become.tie) {
        collectBecomeTribeIds(become.tie, ids);
      }
      if (become.fallback) {
        collectBecomeTribeIds(become.fallback, ids);
      }
      break;
    case COMBINE_BECOME_KIND:
      for (const entry of become.strategy.entries) {
        for (const selector of entry.inputs) {
          collectSelectorTribeIds(selector, ids);
        }
        ids.add(entry.output);
      }
      if (become.strategy.default) {
        collectBecomeTribeIds(become.strategy.default, ids);
      }
      break;
  }
}

/**
 * Applies tribe id renames to every tribe id list within a clause tree.
 *
 * @param {Clause<Tribe[]>} clause Clause tree to mutate.
 * @param {ReadonlyMap<string, string>} renameMap Mapping from committed IDs to pending IDs.
 */
function renameClauseTribes(clause: Clause<Tribe[]>, renameMap: ReadonlyMap<string, string>): void {
  visitClauseTribeIdLists(clause, tribeIds => {
    for (let i = 0; i < tribeIds.length; i++) {
      const currentId = tribeIds[i]!;
      tribeIds[i] = renameMap.get(currentId) ?? currentId;
    }
  });
  renameClauseSelectorTribes(clause, renameMap);
}

/**
 * Applies tribe id renames to clause selectors.
 *
 * @param {Clause<Tribe[]>} clause Clause tree to mutate.
 * @param {ReadonlyMap<string, string>} renameMap Mapping from committed IDs to pending IDs.
 */
function renameClauseSelectorTribes(clause: Clause<Tribe[]>, renameMap: ReadonlyMap<string, string>): void {
  switch (clause.kind) {
    case COUNT_CLAUSE_KIND:
    case NONE_CLAUSE_KIND:
    case EXACTLY_CLAUSE_KIND:
    case MIN_CLAUSE_KIND:
    case MAX_CLAUSE_KIND:
      clause.selector = normalizeSelector(clause.selector);
      renameSelectorTribes(clause.selector, renameMap);
      break;
    case COMPARISON_CLAUSE_KIND:
      clause.left = normalizeCountExpression(clause.left);
      clause.right = normalizeCountExpression(clause.right);
      renameSelectorTribes(clause.left.selector, renameMap);
      renameSelectorTribes(clause.right.selector, renameMap);
      break;
    case NOT_CLAUSE_KIND:
      renameClauseSelectorTribes(clause.clause, renameMap);
      break;
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND:
      for (const child of clause.clauses) {
        renameClauseSelectorTribes(child, renameMap);
      }
      break;
  }
}

/**
 * Applies tribe id renames to a selector expression.
 *
 * @param {TribeSelector<Tribe[]>} selector Selector expression to mutate.
 * @param {ReadonlyMap<string, string>} renameMap Mapping from committed IDs to pending IDs.
 */
function renameSelectorTribes(selector: TribeSelector<Tribe[]>, renameMap: ReadonlyMap<string, string>): void {
  switch (selector.kind) {
    case TRIBES_SELECTOR_KIND:
    case DIFFERENT_IN_TRIBE_SELECTOR_KIND:
      selector.tribes = selector.tribes.map(id => renameMap.get(id) ?? id) as [string, ...string[]];
      break;
    case TIE_SELECTOR_KIND:
      renameSelectorTribes(selector.source, renameMap);
      break;
  }
}

/**
 * Applies tribe id renames to a become expression.
 *
 * @param {Become<Tribe[]>} become Outcome expression to mutate.
 * @param {ReadonlyMap<string, string>} renameMap Mapping from committed IDs to pending IDs.
 */
function renameBecomeTribes(become: Become<Tribe[]>, renameMap: ReadonlyMap<string, string>): void {
  switch (become.kind) {
    case FIXED_BECOME_KIND:
      become.tribe = renameMap.get(become.tribe) ?? become.tribe;
      break;
    case MAJORITY_BECOME_KIND:
    case MINORITY_BECOME_KIND:
      renameSelectorTribes(become.selector, renameMap);
      if (become.tie) {
        renameBecomeTribes(become.tie, renameMap);
      }
      if (become.fallback) {
        renameBecomeTribes(become.fallback, renameMap);
      }
      break;
    case COMBINE_BECOME_KIND:
      for (const entry of become.strategy.entries) {
        entry.inputs = entry.inputs.map(selector => {
          const renamedSelector = structuredClone(selector);
          renameSelectorTribes(renamedSelector, renameMap);
          return renamedSelector;
        });
        entry.output = renameMap.get(entry.output) ?? entry.output;
      }
      if (become.strategy.default) {
        renameBecomeTribes(become.strategy.default, renameMap);
      }
      break;
  }
}

/**
 * Computes whether pending tribe edits can be applied to the committed ruleset.
 *
 * @param {readonly EditableTribe[]} committedTribes Baseline tribes currently applied.
 * @param {readonly EditableTribe[]} pendingTribes Pending tribe edits.
 * @param {readonly Rule<Tribe[]>[]} committedRules Rules that may reference committed tribes.
 * @param {string} boundaryTribe Committed boundary tribe.
 * @param {boolean} boundedTopologyActive Whether bounded topology is currently active.
 * @returns {TribeApplyImpact} Apply impact details for the pending tribe edits.
 */
export function analyzeTribeApplyImpact(committedTribes: readonly EditableTribe[], pendingTribes: readonly EditableTribe[], committedRules: readonly Rule<Tribe[]>[], boundaryTribe = DEAD_TRIBE_ID, boundedTopologyActive = false): TribeApplyImpact {
  const committedByKey = new Map(committedTribes.map(tribe => [tribe.key, tribe]));
  const pendingByKey = new Map(pendingTribes.map(tribe => [tribe.key, tribe]));
  const renamePairs: TribeRenamePair[] = [];
  for (const pending of pendingTribes) {
    const committed = committedByKey.get(pending.key);
    if (committed && committed.id !== pending.id) {
      renamePairs.push({fromId: committed.id, toId: pending.id});
    }
  }
  const referencedTribeIds = collectReferencedTribeIds(committedRules);
  const blockingRemovedTribes = committedTribes.filter(tribe => !pendingByKey.has(tribe.key) && tribe.id !== DEAD_TRIBE_ID).filter(tribe => referencedTribeIds.has(tribe.id));
  const blockedIds = blockingRemovedTribes.map(tribe => tribe.id).sort((a, b) => a.localeCompare(b));
  const boundaryBlockedIds = boundedTopologyActive && committedTribes.some(tribe => !pendingByKey.has(tribe.key) && tribe.id === boundaryTribe) ? [boundaryTribe] : [];
  const messages: string[] = [];
  if (boundaryBlockedIds.length > 0) {
    messages.push(`Cannot apply tribes: ${boundaryBlockedIds[0]} is used as the grid boundary tribe.`);
  }
  if (blockedIds.length > 0) {
    const ruleReferenceSubject = blockedIds.length > 1 ? `${blockedIds.join(', ')} are` : `${blockedIds[0]} is`;
    messages.push(`Cannot apply tribes: ${ruleReferenceSubject} still used by committed rules.`);
  }
  return {
    blocked: messages.length > 0,
    messages,
    renamePairs,
    blockingRemovedTribeIds: blockedIds,
    blockingBoundaryTribeIds: boundaryBlockedIds
  };
}

/**
 * Computes the pending tribe impact on simulation packing.
 *
 * @param {number} committedTribeCount Active tribe count including dead.
 * @param {number} pendingTribeCount Pending tribe count including dead.
 * @param {BitsPerCell} simulationBitsPerCell Active simulation packing.
 * @param {Grid} grid Active grid size.
 * @param {number} maxBytes Maximum supported frame bytes.
 * @returns {TribePackingImpact} Packing impact details.
 */
export function analyzeTribePackingImpact(committedTribeCount: number, pendingTribeCount: number, simulationBitsPerCell: BitsPerCell, grid: Grid, maxBytes: number): TribePackingImpact {
  const requiredFormat = requiredGridFormatForStateCount(pendingTribeCount);
  const requiredFrameBytes = gridByteSize(grid, requiredFormat);
  const maxBytesFinite = Number.isFinite(maxBytes);
  const recordingMaxBytes = maxBytesFinite ? Math.min(RECORDING_MAX_FRAME_BYTES, maxBytes) : RECORDING_MAX_FRAME_BYTES;
  let impact: TribePackingImpact = {
    level: 'none',
    message: null,
    blocked: false
  };
  if (pendingTribeCount > committedTribeCount && !validatePackingAgainstStateCount(simulationBitsPerCell, pendingTribeCount)) {
    if (maxBytesFinite && requiredFrameBytes > maxBytes) {
      impact = {
        level: 'error',
        message: `Cannot apply tribes: ${requiredFormat.bitsPerCell}-bit packing is required, but the current grid size exceeds the supported frame size limit.`,
        blocked: true
      };
    } else if (requiredFrameBytes > recordingMaxBytes) {
      impact = {
        level: 'warning',
        message: `Applying these tribes requires ${requiredFormat.bitsPerCell}-bit packing, but the current grid size exceeds the recording frame size limit.`,
        blocked: false
      };
    } else {
      impact = {
        level: 'warning',
        message: `Applying these tribes will increase packing to ${requiredFormat.bitsPerCell} bits per cell.`,
        blocked: false
      };
    }
  }
  return impact;
}

/**
 * Rewrites one boundary tribe id using the provided rename pairs.
 *
 * @param {string} boundaryTribe Boundary tribe id to update.
 * @param {readonly TribeRenamePair[]} renamePairs Rename pairs to apply.
 * @returns {string} Updated boundary tribe id.
 */
export function applyBoundaryTribeRenames(boundaryTribe: string, renamePairs: readonly TribeRenamePair[]): string {
  const renameMap = new Map(renamePairs.map(pair => [pair.fromId, pair.toId]));
  return renameMap.get(boundaryTribe) ?? boundaryTribe;
}

/**
 * Clones rules and rewrites tribe IDs using the provided rename pairs.
 *
 * @param {readonly Rule<Tribe[]>[]} rules Rules to clone and update.
 * @param {readonly TribeRenamePair[]} renamePairs Rename pairs to apply.
 * @returns {Rule<Tribe[]>[]} Cloned rules with updated tribe IDs.
 */
export function applyRuleTribeRenames(rules: readonly Rule<Tribe[]>[], renamePairs: readonly TribeRenamePair[]): Rule<Tribe[]>[] {
  if (renamePairs.length === 0) {
    return rules.map(rule => structuredClone(rule));
  }
  const renameMap = new Map(renamePairs.map(pair => [pair.fromId, pair.toId]));
  const renamedRules = rules.map(rule => normalizeRule(rule));
  for (const rule of renamedRules) {
    renameBecomeTribes(rule.become, renameMap);
    renameClauseTribes(rule.clause, renameMap);
  }
  return renamedRules;
}
