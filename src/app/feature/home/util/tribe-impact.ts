import {AND_CLAUSE_KIND, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, EditableTribe, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Rule, Tribe, XOR_CLAUSE_KIND} from '../model/rule';

export interface TribeRenamePair {
  fromId: string;
  toId: string;
}

export interface TribeApplyImpact {
  blocked: boolean;
  message: string | null;
  renamePairs: TribeRenamePair[];
  blockingRemovedTribeIds: string[];
}

export function analyzeTribeApplyImpact(committedTribes: readonly EditableTribe[], pendingTribes: readonly EditableTribe[], committedRules: readonly Rule<Tribe[]>[]): TribeApplyImpact {
  const committedByKey = new Map(committedTribes.map(tribe => [tribe.key, tribe]));
  const pendingByKey = new Map(pendingTribes.map(tribe => [tribe.key, tribe]));

  const renamePairs: TribeRenamePair[] = [];
  for (const pending of pendingTribes) {
    const committed = committedByKey.get(pending.key);
    if (!committed || committed.id === pending.id) {
      continue;
    }
    renamePairs.push({fromId: committed.id, toId: pending.id});
  }

  const removedCommittedTribes = committedTribes.filter(tribe => !pendingByKey.has(tribe.key) && tribe.id !== 'dead');
  const referencedTribeIds = collectReferencedTribeIds(committedRules);
  const blockingRemovedTribes = removedCommittedTribes.filter(tribe => referencedTribeIds.has(tribe.id));

  if (blockingRemovedTribes.length === 0) {
    return {
      blocked: false,
      message: null,
      renamePairs,
      blockingRemovedTribeIds: []
    };
  }

  const blockedIds = blockingRemovedTribes.map(tribe => tribe.id).sort((a, b) => a.localeCompare(b));
  const plural = blockedIds.length > 1 ? 's are' : ' is';
  return {
    blocked: true,
    message: `Cannot apply tribes: ${blockedIds.join(', ')}${plural} still used by committed rules.`,
    renamePairs,
    blockingRemovedTribeIds: blockedIds
  };
}

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

function collectReferencedTribeIds(rules: readonly Rule<Tribe[]>[]): Set<string> {
  const ids = new Set<string>();
  for (const rule of rules) {
    ids.add(rule.tribe);
    collectClauseTribeIds(rule.clause, ids);
  }
  return ids;
}

function collectClauseTribeIds(clause: Clause<Tribe[]>, ids: Set<string>): void {
  switch (clause.kind) {
    case IS_CLAUSE_KIND:
    case COUNT_CLAUSE_KIND:
    case NONE_CLAUSE_KIND:
    case EXACTLY_CLAUSE_KIND:
    case MIN_CLAUSE_KIND:
    case MAX_CLAUSE_KIND:
      clause.tribes.forEach(id => ids.add(id));
      break;
    case COMPARISON_CLAUSE_KIND:
      clause.tribe1.forEach(id => ids.add(id));
      clause.tribe2.forEach(id => ids.add(id));
      break;
    case NOT_CLAUSE_KIND:
      collectClauseTribeIds(clause.clause, ids);
      break;
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND:
      clause.clauses.forEach(child => collectClauseTribeIds(child, ids));
      break;
    default:
      break;
  }
}

function renameClauseTribes(clause: Clause<Tribe[]>, renameMap: ReadonlyMap<string, string>): void {
  switch (clause.kind) {
    case IS_CLAUSE_KIND:
    case COUNT_CLAUSE_KIND:
    case NONE_CLAUSE_KIND:
    case EXACTLY_CLAUSE_KIND:
    case MIN_CLAUSE_KIND:
    case MAX_CLAUSE_KIND:
      for (let i = 0; i < clause.tribes.length; i++) {
        const currentId = clause.tribes[i]!;
        clause.tribes[i] = renameMap.get(currentId) ?? currentId;
      }
      break;
    case COMPARISON_CLAUSE_KIND:
      for (let i = 0; i < clause.tribe1.length; i++) {
        const currentId = clause.tribe1[i]!;
        clause.tribe1[i] = renameMap.get(currentId) ?? currentId;
      }
      for (let i = 0; i < clause.tribe2.length; i++) {
        const currentId = clause.tribe2[i]!;
        clause.tribe2[i] = renameMap.get(currentId) ?? currentId;
      }
      break;
    case NOT_CLAUSE_KIND:
      renameClauseTribes(clause.clause, renameMap);
      break;
    case AND_CLAUSE_KIND:
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND:
      clause.clauses.forEach(child => renameClauseTribes(child, renameMap));
      break;
    default:
      break;
  }
}
