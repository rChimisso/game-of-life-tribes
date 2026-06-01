import {AND_CLAUSE_KIND, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, EditableTribe, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Rule, Tribe, XOR_CLAUSE_KIND} from '../model/rule';
import {TribeApplyImpact, TribeRenamePair} from '../model/tribe-impact';

/**
 * Collects every tribe id referenced by the provided rules and clauses.
 *
 * @param {readonly Rule<Tribe[]>[]} rules Rules to scan for tribe references.
 * @returns {Set<string>} Referenced tribe ids.
 */
function collectReferencedTribeIds(rules: readonly Rule<Tribe[]>[]): Set<string> {
  const ids = new Set<string>();
  for (const rule of rules) {
    ids.add(rule.tribe);
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
    case COUNT_CLAUSE_KIND:
    case NONE_CLAUSE_KIND:
    case EXACTLY_CLAUSE_KIND:
    case MIN_CLAUSE_KIND:
    case MAX_CLAUSE_KIND:
      visit(clause.tribes);
      break;
    case COMPARISON_CLAUSE_KIND:
      visit(clause.tribe1);
      visit(clause.tribe2);
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
 * @param {Set<string>} ids Output set receiving referenced ids.
 */
function collectClauseTribeIds(clause: Clause<Tribe[]>, ids: Set<string>): void {
  visitClauseTribeIdLists(clause, tribeIds => {
    for (const id of tribeIds) {
      ids.add(id);
    }
  });
}

/**
 * Applies tribe id renames to every tribe id list within a clause tree.
 *
 * @param {Clause<Tribe[]>} clause Clause tree to mutate.
 * @param {ReadonlyMap<string, string>} renameMap Mapping from committed ids to pending ids.
 */
function renameClauseTribes(clause: Clause<Tribe[]>, renameMap: ReadonlyMap<string, string>): void {
  visitClauseTribeIdLists(clause, tribeIds => {
    for (let i = 0; i < tribeIds.length; i++) {
      const currentId = tribeIds[i]!;
      tribeIds[i] = renameMap.get(currentId) ?? currentId;
    }
  });
}

/**
 * Computes whether pending tribe edits can be applied to the committed ruleset.
 *
 * @param {readonly EditableTribe[]} committedTribes Baseline tribes currently applied.
 * @param {readonly EditableTribe[]} pendingTribes Pending tribe edits.
 * @param {readonly Rule<Tribe[]>[]} committedRules Rules that may reference committed tribes.
 * @returns {TribeApplyImpact} Apply impact details for the pending tribe edits.
 */
export function analyzeTribeApplyImpact(committedTribes: readonly EditableTribe[], pendingTribes: readonly EditableTribe[], committedRules: readonly Rule<Tribe[]>[]): TribeApplyImpact {
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
  const blockingRemovedTribes = committedTribes.filter(tribe => !pendingByKey.has(tribe.key) && tribe.id !== 'dead').filter(tribe => referencedTribeIds.has(tribe.id));
  if (blockingRemovedTribes.length === 0) {
    return {
      blocked: false,
      message: null,
      renamePairs,
      blockingRemovedTribeIds: []
    };
  }
  const blockedIds = blockingRemovedTribes.map(tribe => tribe.id).sort((a, b) => a.localeCompare(b));
  return {
    blocked: true,
    message: `Cannot apply tribes: ${blockedIds.join(', ')}${blockedIds.length > 1 ? 's are' : ' is'} still used by committed rules.`,
    renamePairs,
    blockingRemovedTribeIds: blockedIds
  };
}

/**
 * Clones rules and rewrites tribe ids using the provided rename pairs.
 *
 * @param {readonly Rule<Tribe[]>[]} rules Rules to clone and update.
 * @param {readonly TribeRenamePair[]} renamePairs Rename pairs to apply.
 * @returns {Rule<Tribe[]>[]} Cloned rules with updated tribe ids.
 */
export function applyRuleTribeRenames(rules: readonly Rule<Tribe[]>[], renamePairs: readonly TribeRenamePair[]): Rule<Tribe[]>[] {
  if (renamePairs.length === 0) {
    return rules.map(rule => structuredClone(rule));
  }
  const renameMap = new Map(renamePairs.map(pair => [pair.fromId, pair.toId]));
  const renamedRules = rules.map(rule => structuredClone(rule));
  for (const rule of renamedRules) {
    rule.tribe = renameMap.get(rule.tribe) ?? rule.tribe;
    renameClauseTribes(rule.clause, renameMap);
  }
  return renamedRules;
}
