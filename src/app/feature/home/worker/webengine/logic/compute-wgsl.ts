import {COMPARISON_OPERATOR_WGSL} from '../model/comparison-operator-wgsl';
import {DispatchPlan2D} from '../model/dispatch-plan';

import {normalizeBecome, normalizeBecomeExpression, normalizeCountExpression, normalizeSelector, normalizeSelectorForSignature, selectorSignature} from '~gol/feature/home/logic/rule-editor';
import {Grid} from '~gol/feature/home/model/grid';
import {GridFormat} from '~gol/feature/home/model/grid-format';
import {AND_CLAUSE_KIND, Become, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Rule, Ruleset, Tribe, TribeSelector, XOR_CLAUSE_KIND} from '~gol/feature/home/model/rule';

/**
 * Emits remapped dispatch constants when the workgroups cannot be submitted directly.
 *
 * @param {string[]} lines WGSL output lines.
 * @param {DispatchPlan2D} plan dispatch plan.
 */
function pushDispatchPlanWgslConstants(lines: string[], plan: DispatchPlan2D): void {
  if (plan.remapped) {
    lines.push(`const LOGICAL_WG_X: u32 = ${plan.logicalWgX}u;`);
    lines.push(`const DISPATCH_WG_X: u32 = ${plan.dispatchWgX}u;`);
  }
}

/**
 * Emits WGSL constants derived from the active packed grid format.
 *
 * @param {string[]} lines WGSL output lines.
 * @param {GridFormat} gridFormat active packed grid format.
 */
function pushGridFormatWgslConstants(lines: string[], gridFormat: GridFormat): void {
  lines.push(`const CELLS_PER_WORD: u32 = ${gridFormat.cellsPerWord}u;`);
  lines.push(`const WORD_SHIFT: u32 = ${gridFormat.wordShift}u;`);
  lines.push(`const CELL_SHIFT: u32 = ${gridFormat.cellShift}u;`);
  lines.push(`const CELL_INDEX_MASK: u32 = ${gridFormat.cellIndexMask}u;`);
  lines.push(`const CELL_MASK: u32 = ${gridFormat.cellMask}u;`);
}

/**
 * Emits the WGSL helper for reading one packed cell.
 *
 * @param {string[]} lines WGSL output lines.
 * @param {string} storageVar storage buffer variable name.
 * @param {string} packedColsExpr WGSL expression for packed columns.
 */
function pushReadCellWgsl(lines: string[], storageVar: string, packedColsExpr: string): void {
  lines.push('fn readCell(x: u32, y: u32) -> u32 {');
  lines.push(`  let wordIdx = y * ${packedColsExpr} + (x >> WORD_SHIFT);`);
  lines.push('  let shift = (x & CELL_INDEX_MASK) << CELL_SHIFT;');
  lines.push(`  return (${storageVar}[wordIdx] >> shift) & CELL_MASK;`);
  lines.push('}');
}

/**
 * Emits either direct or remapped invocation coordinates.
 *
 * @param {string[]} lines WGSL output lines.
 * @param {DispatchPlan2D} plan dispatch plan.
 * @param {string} xName name of the x coordinate variable.
 */
function pushLogicalInvocation2DWgsl(lines: string[], plan: DispatchPlan2D, xName: string): void {
  if (plan.remapped) {
    lines.push('  let flatWg = workgroup_id.y * DISPATCH_WG_X + workgroup_id.x;');
    lines.push('  let logicalWgX = flatWg % LOGICAL_WG_X;');
    lines.push('  let logicalWgY = flatWg / LOGICAL_WG_X;');
    lines.push('');
    lines.push(`  let ${xName} = logicalWgX * 16u + local_invocation_id.x;`);
    lines.push('  let y = logicalWgY * 16u + local_invocation_id.y;');
  } else {
    lines.push(`  let ${xName} = gid.x;`);
    lines.push('  let y = gid.y;');
  }
}

/**
 * Builds the mapping from unique count-set keys to WGSL variable names.
 *
 * @param {Clause<Tribe[]>[]} clauses active rule clauses.
 * @returns {Map<string, string>} count variable mapping.
 */
function buildCountVarMap(clauses: Clause<Tribe[]>[]): Map<string, string> {
  const countSets = collectCountSelectors(clauses);
  const countVarMap = new Map<string, string>();
  let countIdx = 0;
  for (const key of countSets) {
    countVarMap.set(key, `count_${countIdx++}`);
  }
  return countVarMap;
}

/**
 * Builds the mapping from equality-set keys to WGSL variable names.
 *
 * @param {Clause<Tribe[]>[]} clauses active rule clauses.
 * @param {Map<string, string>} countVarMap existing count variable mapping.
 * @returns {Map<string, string>} equality variable mapping.
 */
function buildEqualityVarMap(clauses: Clause<Tribe[]>[], countVarMap: Map<string, string>): Map<string, string> {
  const equalitySets = collectEqualitySelectors(clauses);
  const eqVarMap = new Map<string, string>();
  let eqIdx = 0;
  for (const key of equalitySets) {
    const existingCountVar = countVarMap.get(key);
    if (existingCountVar) {
      eqVarMap.set(key, existingCountVar);
    } else {
      eqVarMap.set(key, `eq_count_${eqIdx++}`);
    }
  }
  return eqVarMap;
}

/**
 * Emits neighbor-count declarations for the active rule count sets.
 *
 * @param {string[]} lines WGSL output lines.
 * @param {Map<string, string>} countVarMap count variable mapping.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 */
function pushNeighborCountDeclarations(lines: string[], countVarMap: Map<string, string>, tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): void {
  for (const [key, varName] of countVarMap) {
    lines.push(`  let ${varName} = ${buildNeighborCountExpr(deserializeSelectorKey(key), tribes, tribeIndex)};`);
  }
  if (countVarMap.size > 0) {
    lines.push('');
  }
}

/**
 * Emits equality-count declarations not already covered by the count variables.
 *
 * @param {string[]} lines WGSL output lines.
 * @param {Map<string, string>} countVarMap count variable mapping.
 * @param {Map<string, string>} eqVarMap equality variable mapping.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 */
function pushEqualityCountDeclarations(lines: string[], countVarMap: Map<string, string>, eqVarMap: Map<string, string>, tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): void {
  let emitted = 0;
  for (const [key, varName] of eqVarMap) {
    if (!countVarMap.has(key)) {
      lines.push(`  let ${varName} = ${buildNeighborCountExpr(deserializeSelectorKey(key), tribes, tribeIndex)};`);
      emitted++;
    }
  }
  if (emitted > 0) {
    lines.push('');
  }
}

/**
 * Emits the first-match-wins rule chain.
 *
 * @param {string[]} lines WGSL output lines.
 * @param {Rule<readonly Tribe[]>[]} activeRules active unmuted rules.
 * @param {Map<string, string>} countVarMap count variable mapping.
 * @param {Map<string, string>} eqVarMap equality variable mapping.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 */
function pushRuleChain(lines: string[], activeRules: Rule<readonly Tribe[]>[], countVarMap: Map<string, string>, eqVarMap: Map<string, string>, tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): void {
  for (let index = 0; index < activeRules.length; index++) {
    const rule = activeRules[index]!;
    const condition = generateClauseExpr(rule.clause, countVarMap, eqVarMap, tribes, tribeIndex);
    lines.push(index === 0 ? `  if (${condition}) {` : `  } else if (${condition}) {`);
    pushBecomeAssignment(lines, normalizeBecomeExpression(normalizeBecome(rule)), tribes, tribeIndex, `rule_${index}`, '    ');
  }
  if (activeRules.length > 0) {
    lines.push('  }');
  }
  lines.push('');
}

/**
 * Majority tie context used by nested combine outcomes.
 *
 * @interface MajorityTieContext
 * @typedef {MajorityTieContext}
 */
interface MajorityTieContext {
  /**
   * Source selector.
   *
   * @type {TribeSelector<readonly Tribe[]>}
   */
  selector: TribeSelector<readonly Tribe[]>;
  /**
   * Best-count WGSL variable.
   *
   * @type {string}
   */
  bestCountVar: string;
  /**
   * Tie-count WGSL variable.
   *
   * @type {string}
   */
  tieCountVar: string;
}

/**
 * Emits the WGSL result assignment for a rule outcome.
 *
 * @param {string[]} lines WGSL output lines.
 * @param {Become<readonly Tribe[]>} become normalized rule outcome.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @param {string} label label suffix for generated local variables.
 * @param {string} indent line indentation.
 * @param {MajorityTieContext | null} [tieContext=null] active majority tie context.
 */
function pushBecomeAssignment(lines: string[], become: Become<readonly Tribe[]>, tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>, label: string, indent: string, tieContext: MajorityTieContext | null = null): void {
  switch (become.kind) {
    case 'fixed':
      lines.push(`${indent}result = ${resolveTribeTarget(become.tribe, tribeIndex)}u;`);
      break;
    case 'same':
      lines.push(`${indent}result = selfTribe;`);
      break;
    case 'majority':
    case 'minority':
      pushRankedBecomeAssignment(lines, become, tribes, tribeIndex, label, indent);
      break;
    case 'combine':
      pushCombineBecomeAssignment(lines, become, tribes, tribeIndex, label, indent, tieContext);
      break;
  }
}

/**
 * Emits WGSL for a ranked majority or minority outcome.
 *
 * @param {string[]} lines WGSL output lines.
 * @param {Extract<Become<readonly Tribe[]>, {kind: 'majority' | 'minority'}>} become ranked outcome.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @param {string} label label suffix for generated local variables.
 * @param {string} indent line indentation.
 */
function pushRankedBecomeAssignment(lines: string[], become: Extract<Become<readonly Tribe[]>, {kind: 'majority' | 'minority'}>, tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>, label: string, indent: string): void {
  const selector = normalizeSelector(become.selector);
  const bestVar = `${label}_${become.kind}`;
  const bestCountVar = `${label}_${become.kind}_count`;
  const tieCountVar = `${label}_${become.kind}_ties`;
  const initialBestCount = become.kind === 'majority' ? '0u' : '9u';
  const betterExpr = become.kind === 'majority' ? `candidateCount > ${bestCountVar}` : `candidateCount < ${bestCountVar}`;
  lines.push(`${indent}var ${bestVar}: u32 = ${resolveTribeTarget(DEAD_TRIBE_ID, tribeIndex)}u;`);
  lines.push(`${indent}var ${bestCountVar}: u32 = ${initialBestCount};`);
  lines.push(`${indent}var ${tieCountVar}: u32 = 0u;`);
  for (const candidateId of selectorCandidateIds(selector, tribes, tribeIndex)) {
    const countExpr = buildNeighborPredicateCountExpr(neighbor => `${neighbor} == ${candidateId}u`);
    const eligibleExpr = selectorCandidateEligibilityExpr(selector, candidateId, tribeIndex);
    lines.push(`${indent}{`);
    lines.push(`${indent}  let candidateCount = ${countExpr};`);
    lines.push(`${indent}  if (${eligibleExpr} && candidateCount > 0u) {`);
    lines.push(`${indent}    if (${betterExpr}) {`);
    lines.push(`${indent}      ${bestVar} = ${candidateId}u;`);
    lines.push(`${indent}      ${bestCountVar} = candidateCount;`);
    lines.push(`${indent}      ${tieCountVar} = 1u;`);
    lines.push(`${indent}    } else if (candidateCount == ${bestCountVar}) {`);
    lines.push(`${indent}      ${tieCountVar} = ${tieCountVar} + 1u;`);
    lines.push(`${indent}    }`);
    lines.push(`${indent}  }`);
    lines.push(`${indent}}`);
  }
  lines.push(`${indent}if (${tieCountVar} == 1u) {`);
  lines.push(`${indent}  result = ${bestVar};`);
  lines.push(`${indent}} else if (${tieCountVar} > 1u) {`);
  if (become.tie) {
    pushBecomeAssignment(lines, become.tie, tribes, tribeIndex, `${label}_tie`, `${indent}  `, {
      selector,
      bestCountVar,
      tieCountVar
    });
  } else {
    pushFallbackBecomeAssignment(lines, become.fallback, tribes, tribeIndex, `${label}_tie_fallback`, `${indent}  `);
  }
  lines.push(`${indent}} else {`);
  pushFallbackBecomeAssignment(lines, become.fallback, tribes, tribeIndex, `${label}_fallback`, `${indent}  `);
  lines.push(`${indent}}`);
}

/**
 * Emits WGSL for a fallback outcome.
 *
 * @param {string[]} lines WGSL output lines.
 * @param {Become<readonly Tribe[]> | undefined} become fallback outcome.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @param {string} label label suffix for generated local variables.
 * @param {string} indent line indentation.
 */
function pushFallbackBecomeAssignment(lines: string[], become: Become<readonly Tribe[]> | undefined, tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>, label: string, indent: string): void {
  if (become) {
    pushBecomeAssignment(lines, become, tribes, tribeIndex, label, indent);
  } else {
    lines.push(`${indent}result = ${resolveTribeTarget(DEAD_TRIBE_ID, tribeIndex)}u;`);
  }
}

/**
 * Emits WGSL for a combine outcome.
 *
 * @param {string[]} lines WGSL output lines.
 * @param {Extract<Become<readonly Tribe[]>, {kind: 'combine'}>} become combine outcome.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @param {string} label label suffix for generated local variables.
 * @param {string} indent line indentation.
 * @param {MajorityTieContext | null} tieContext active majority tie context.
 */
function pushCombineBecomeAssignment(
  lines: string[],
  become: Extract<Become<readonly Tribe[]>, {kind: 'combine'}>,
  tribes: readonly Tribe[],
  tribeIndex: ReadonlyMap<string, number>,
  label: string,
  indent: string,
  tieContext: MajorityTieContext | null
): void {
  const maskVar = `${label}_input_mask`;
  lines.push(`${indent}var ${maskVar}: u32 = 0u;`);
  for (const candidateId of combineCandidateIds(tribes, tribeIndex, tieContext)) {
    const participationExpr = combineBaseParticipationExpr(candidateId, tribeIndex, tieContext);
    lines.push(`${indent}if (${participationExpr}) {`);
    lines.push(`${indent}  ${maskVar} = ${maskVar} | ${maskBitExpr(candidateId)};`);
    lines.push(`${indent}}`);
  }
  const entries = [...become.strategy.entries];
  entries.forEach((entry, index) => {
    const rowMask = combineRowMaskExpr(entry.inputs, tribes, tribeIndex, tieContext);
    lines.push(index === 0 ? `${indent}if (${maskVar} == (${rowMask})) {` : `${indent}} else if (${maskVar} == (${rowMask})) {`);
    lines.push(`${indent}  result = ${resolveTribeTarget(entry.output, tribeIndex)}u;`);
  });
  if (entries.length > 0) {
    lines.push(`${indent}} else {`);
    pushFallbackBecomeAssignment(lines, become.strategy.default ?? become.fallback, tribes, tribeIndex, `${label}_fallback`, `${indent}  `);
    lines.push(`${indent}}`);
  } else {
    pushFallbackBecomeAssignment(lines, become.strategy.default ?? become.fallback, tribes, tribeIndex, `${label}_fallback`, indent);
  }
}

/**
 * Emits neighbor read statements for the current cell.
 *
 * @param {string[]} lines WGSL output lines.
 */
function pushNeighborReads(lines: string[]): void {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!(dx === 0 && dy === 0)) {
        lines.push(`    let ${neighborVarName(dx, dy)} = readCell(${wrapExpr('x', dx, 'COLS')}, ${wrapExpr('y', dy, 'ROWS')});`);
      }
    }
  }
}

/**
 * Builds the WGSL sum expression for one selector.
 *
 * @param {TribeSelector<readonly Tribe[]>} selector selector to count.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {string} WGSL sum expression.
 */
function buildNeighborCountExpr(selector: TribeSelector<readonly Tribe[]>, tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): string {
  const normalized = normalizeSelectorForSignature(selector);
  let expression: string;
  switch (normalized.kind) {
    case 'same':
      expression = buildNeighborPredicateCountExpr(neighbor => `${neighbor} == selfTribe`);
      break;
    case 'different':
      expression = buildNeighborPredicateCountExpr(neighbor => `${neighbor} != selfTribe`);
      break;
    case 'tiedMajority':
      expression = buildNeighborCountExpr(normalized.source, tribes, tribeIndex);
      break;
    case 'tribes': {
      const ids = resolveTribeIds(normalized.tribes as string[], tribeIndex);
      expression = ids.length === 0 ? '0u' : buildNeighborPredicateCountExpr(neighbor => ids.map(id => `${neighbor} == ${id}u`).join(' || '));
      break;
    }
  }
  return expression;
}

/**
 * Builds a neighbor count expression from one predicate factory.
 *
 * @param {(neighbor: string) => string} predicateFactory predicate factory for each neighbor variable.
 * @returns {string} WGSL count expression.
 */
function buildNeighborPredicateCountExpr(predicateFactory: (neighbor: string) => string): string {
  return getNeighborVarNames().map(neighbor => `select(0u, 1u, ${predicateFactory(neighbor)})`).join(' + ');
}

/**
 * Resolves the canonical name for one neighbor variable.
 *
 * @param {number} dx x delta.
 * @param {number} dy y delta.
 * @returns {string} neighbor variable name.
 */
function neighborVarName(dx: number, dy: number): string {
  let xName = 'C';
  if (dx === -1) {
    xName = 'L';
  } else if (dx === 1) {
    xName = 'R';
  }
  let yName = 'C';
  if (dy === -1) {
    yName = 'T';
  } else if (dy === 1) {
    yName = 'B';
  }
  return `n${yName}${xName}`;
}

/**
 * Enumerates the eight neighbor variable names used by the shader.
 *
 * @returns {string[]} ordered neighbor variable names.
 */
function getNeighborVarNames(): string[] {
  const names: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!(dx === 0 && dy === 0)) {
        names.push(neighborVarName(dx, dy));
      }
    }
  }
  return names;
}

/**
 * Builds a wrapping WGSL expression for one axis delta.
 *
 * @param {string} varName base variable name.
 * @param {number} delta axis delta.
 * @param {string} limit WGSL extent expression.
 * @returns {string} wrapped WGSL expression.
 */
function wrapExpr(varName: string, delta: number, limit: string): string {
  if (delta === 0) {
    return varName;
  }
  if (delta === -1) {
    return `(${varName} + ${limit} - 1u) % ${limit}`;
  }
  return `(${varName} + 1u) % ${limit}`;
}

/**
 * Resolves the numeric tribe ids for a tribe selector list.
 *
 * @param {string[]} tribeNames tribe selector names.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {number[]} numeric tribe ids.
 */
function resolveTribeIds(tribeNames: string[], tribeIndex: ReadonlyMap<string, number>): number[] {
  const ids: number[] = [];
  for (const name of tribeNames) {
    ids.push(resolveRuleTribeIndex(name, tribeIndex, 'selector'));
  }
  return [...new Set(ids)];
}

/**
 * Resolves the numeric target tribe id for a rule result.
 *
 * @param {string} tribeName rule target tribe name.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {number} numeric target tribe id.
 */
function resolveTribeTarget(tribeName: string, tribeIndex: ReadonlyMap<string, number>): number {
  return resolveRuleTribeIndex(tribeName, tribeIndex, 'target');
}

/**
 * Resolves the numeric tribe id for one rule reference.
 *
 * @param {string} tribeName rule tribe name.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @param {'selector' | 'target'} context rule reference context.
 * @returns {number} numeric tribe id, falling back to the dead tribe for unknown references.
 */
function resolveRuleTribeIndex(tribeName: string, tribeIndex: ReadonlyMap<string, number>, context: 'selector' | 'target'): number {
  const resolved = tribeIndex.get(tribeName);
  const dead = tribeIndex.get(DEAD_TRIBE_ID) ?? 0;
  if (resolved === undefined) {
    console.error(`Unknown rule ${context} tribe; using dead tribe instead.`, {tribe: tribeName});
  }
  return resolved ?? dead;
}

/**
 * Returns candidate runtime ids considered by a selector.
 *
 * @param {TribeSelector<readonly Tribe[]>} selector selector expression.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {number[]} candidate runtime ids.
 */
function selectorCandidateIds(selector: TribeSelector<readonly Tribe[]>, tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): number[] {
  const normalized = normalizeSelectorForSignature(selector);
  let ids: number[];
  switch (normalized.kind) {
    case 'tribes':
      ids = resolveTribeIds(normalized.tribes as string[], tribeIndex);
      break;
    case 'tiedMajority':
      ids = selectorCandidateIds(normalized.source, tribes, tribeIndex);
      break;
    default:
      ids = tribes.map(tribe => resolveRuleTribeIndex(tribe.id, tribeIndex, 'selector'));
      break;
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Builds a candidate eligibility expression for one selector and runtime tribe id.
 *
 * @param {TribeSelector<readonly Tribe[]>} selector selector expression.
 * @param {number} candidateId runtime candidate id.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {string} WGSL boolean expression.
 */
function selectorCandidateEligibilityExpr(selector: TribeSelector<readonly Tribe[]>, candidateId: number, tribeIndex: ReadonlyMap<string, number>): string {
  const normalized = normalizeSelectorForSignature(selector);
  let expression: string;
  switch (normalized.kind) {
    case 'same':
      expression = `selfTribe == ${candidateId}u`;
      break;
    case 'different':
      expression = `selfTribe != ${candidateId}u`;
      break;
    case 'tiedMajority':
      expression = selectorCandidateEligibilityExpr(normalized.source, candidateId, tribeIndex);
      break;
    case 'tribes': {
      const explicit = resolveTribeIds(normalized.tribes as string[], tribeIndex);
      expression = explicit.includes(candidateId) ? 'true' : 'false';
      break;
    }
  }
  return expression;
}

/**
 * Builds a selector participation expression for combine input masks.
 *
 * @param {TribeSelector<readonly Tribe[]>} selector selector expression.
 * @param {number} candidateId runtime candidate id.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @param {MajorityTieContext | null} tieContext active majority tie context.
 * @returns {string} WGSL boolean expression.
 */
function selectorParticipationExpr(selector: TribeSelector<readonly Tribe[]>, candidateId: number, tribeIndex: ReadonlyMap<string, number>, tieContext: MajorityTieContext | null): string {
  const normalized = normalizeSelectorForSignature(selector);
  let expression: string;
  if (normalized.kind === 'tiedMajority' && tieContext) {
    const countExpr = buildNeighborPredicateCountExpr(neighbor => `${neighbor} == ${candidateId}u`);
    const eligibleExpr = selectorCandidateEligibilityExpr(tieContext.selector, candidateId, tribeIndex);
    expression = `(${tieContext.tieCountVar} > 1u && ${tieContext.bestCountVar} > 0u && ${eligibleExpr} && ${countExpr} == ${tieContext.bestCountVar})`;
  } else {
    const countExpr = buildNeighborPredicateCountExpr(neighbor => `${neighbor} == ${candidateId}u`);
    const eligibleExpr = selectorCandidateEligibilityExpr(normalized.kind === 'tiedMajority' ? normalized.source : normalized, candidateId, tribeIndex);
    expression = `(${eligibleExpr} && ${countExpr} > 0u)`;
  }
  return expression;
}

/**
 * Returns candidate runtime ids considered by a combine outcome.
 *
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @param {MajorityTieContext | null} tieContext active rank tie context.
 * @returns {number[]} candidate runtime ids.
 */
function combineCandidateIds(tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>, tieContext: MajorityTieContext | null): number[] {
  let ids: number[];
  if (tieContext) {
    ids = selectorCandidateIds(tieContext.selector, tribes, tribeIndex);
  } else {
    ids = tribes.map(tribe => resolveRuleTribeIndex(tribe.id, tribeIndex, 'selector'));
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Builds a combine base-mask participation expression.
 *
 * @param {number} candidateId runtime candidate id.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @param {MajorityTieContext | null} tieContext active rank tie context.
 * @returns {string} WGSL boolean expression.
 */
function combineBaseParticipationExpr(candidateId: number, tribeIndex: ReadonlyMap<string, number>, tieContext: MajorityTieContext | null): string {
  let expression: string;
  if (tieContext) {
    const countExpr = buildNeighborPredicateCountExpr(neighbor => `${neighbor} == ${candidateId}u`);
    const eligibleExpr = selectorCandidateEligibilityExpr(tieContext.selector, candidateId, tribeIndex);
    expression = `(${tieContext.tieCountVar} > 1u && ${tieContext.bestCountVar} > 0u && ${eligibleExpr} && ${countExpr} == ${tieContext.bestCountVar})`;
  } else {
    const countExpr = buildNeighborPredicateCountExpr(neighbor => `${neighbor} == ${candidateId}u`);
    expression = `(${countExpr} > 0u)`;
  }
  return expression;
}

/**
 * Builds the dynamic mask expression for one combination lookup row.
 *
 * @param {readonly TribeSelector<readonly Tribe[]>[]} inputs row input selectors.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @param {MajorityTieContext | null} tieContext active rank tie context.
 * @returns {string} WGSL mask expression.
 */
function combineRowMaskExpr(inputs: readonly TribeSelector<readonly Tribe[]>[], tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>, tieContext: MajorityTieContext | null): string {
  const parts: string[] = [];
  for (const input of inputs) {
    const selector = normalizeSelector(input);
    for (const candidateId of selectorCandidateIds(selector, tribes, tribeIndex)) {
      const participationExpr = combineRowSelectorParticipationExpr(selector, candidateId, tribeIndex, tieContext);
      parts.push(`select(0u, ${maskBitExpr(candidateId)}, ${participationExpr})`);
    }
  }
  return parts.length > 0 ? parts.join(' | ') : '0u';
}

/**
 * Builds a row-selector participation expression for combination lookup matching.
 *
 * @param {TribeSelector<readonly Tribe[]>} selector row input selector.
 * @param {number} candidateId runtime candidate id.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @param {MajorityTieContext | null} tieContext active rank tie context.
 * @returns {string} WGSL boolean expression.
 */
function combineRowSelectorParticipationExpr(selector: TribeSelector<readonly Tribe[]>, candidateId: number, tribeIndex: ReadonlyMap<string, number>, tieContext: MajorityTieContext | null): string {
  const normalized = normalizeSelectorForSignature(selector);
  let expression: string;
  if (tieContext) {
    const baseExpr = combineBaseParticipationExpr(candidateId, tribeIndex, tieContext);
    const eligibleExpr = selectorCandidateEligibilityExpr(normalized.kind === 'tiedMajority' ? normalized.source : normalized, candidateId, tribeIndex);
    expression = `(${baseExpr} && ${eligibleExpr})`;
  } else {
    expression = selectorParticipationExpr(normalized, candidateId, tribeIndex, null);
  }
  return expression;
}

/**
 * Builds a WGSL mask bit expression.
 *
 * @param {number} candidateId runtime tribe id.
 * @returns {string} WGSL mask bit expression.
 */
function maskBitExpr(candidateId: number): string {
  return `(1u << ${candidateId}u)`;
}

/**
 * Serializes one selector into the canonical lookup key.
 *
 * @param {TribeSelector<Tribe[]>} selector selector to serialize.
 * @returns {string} canonical serialized selector key.
 */
function selectorKey(selector: TribeSelector<Tribe[]>): string {
  return selectorSignature(selector);
}

/**
 * Deserializes one selector key.
 *
 * @param {string} key selector key.
 * @returns {TribeSelector<Tribe[]>} selector expression.
 */
function deserializeSelectorKey(key: string): TribeSelector<Tribe[]> {
  return JSON.parse(key);
}

/**
 * Traverses one or more clause trees and collects serialized selector keys.
 *
 * @param {Clause<Tribe[]>[]} clauses rule clauses.
 * @param {(clause: Clause<Tribe[]>, addSelector: (selector: TribeSelector<Tribe[]>) => void) => void} collectFromClause per-clause collection callback.
 * @returns {Set<string>} collected serialized selector keys.
 */
function collectClauseSelectors(clauses: Clause<Tribe[]>[], collectFromClause: (clause: Clause<Tribe[]>, addSelector: (selector: TribeSelector<Tribe[]>) => void) => void): Set<string> {
  const result = new Set<string>();
  const addSelector = (selector: TribeSelector<Tribe[]>): void => {
    result.add(selectorKey(selector));
  };
  const visit = (clause: Clause<Tribe[]>): void => {
    collectFromClause(clause, addSelector);
    switch (clause.kind) {
      case NOT_CLAUSE_KIND:
        visit(clause.clause);
        break;
      case AND_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
      case XOR_CLAUSE_KIND:
        for (const child of clause.clauses) {
          visit(child);
        }
        break;
    }
  };
  for (const clause of clauses) {
    visit(clause);
  }
  return result;
}

/**
 * Collects the unique count-selector keys required by the rule clauses.
 *
 * @param {Clause<Tribe[]>[]} clauses rule clauses.
 * @returns {Set<string>} unique count-selector keys.
 */
function collectCountSelectors(clauses: Clause<Tribe[]>[]): Set<string> {
  return collectClauseSelectors(clauses, (clause, addSelector) => {
    switch (clause.kind) {
      case NONE_CLAUSE_KIND:
      case EXACTLY_CLAUSE_KIND:
      case MIN_CLAUSE_KIND:
      case MAX_CLAUSE_KIND:
      case COUNT_CLAUSE_KIND:
        addSelector(normalizeSelector(clause.selector, clause.tribes));
        break;
    }
  });
}

/**
 * Collects the unique equality-selector keys required by the rule clauses.
 *
 * @param {Clause<Tribe[]>[]} clauses rule clauses.
 * @returns {Set<string>} unique equality-selector keys.
 */
function collectEqualitySelectors(clauses: Clause<Tribe[]>[]): Set<string> {
  return collectClauseSelectors(clauses, (clause, addSelector) => {
    if (clause.kind === COMPARISON_CLAUSE_KIND) {
      addSelector(normalizeCountExpression(clause.left, clause.tribe1).selector);
      addSelector(normalizeCountExpression(clause.right, clause.tribe2).selector);
    }
  });
}

/**
 * Generates the WGSL boolean expression for one rule clause.
 *
 * @param {Clause<Tribe[]>} clause clause to encode.
 * @param {Map<string, string>} countVarMap count variable mapping.
 * @param {Map<string, string>} eqVarMap equality variable mapping.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {string} WGSL boolean expression.
 */
function generateClauseExpr(clause: Clause<Tribe[]>, countVarMap: Map<string, string>, eqVarMap: Map<string, string>, tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): string {
  switch (clause.kind) {
    case EMPTY_CLAUSE_KIND:
      return 'false';
    case IS_CLAUSE_KIND:
      return generateIsClauseExpr(clause.tribes as string[], tribes, tribeIndex);
    case COUNT_CLAUSE_KIND:
      return generateClosedRangeExpr(resolveSelectorVarName(normalizeSelector(clause.selector, clause.tribes), countVarMap), clause.interval[0], clause.interval[1]);
    case NONE_CLAUSE_KIND:
      return generateClosedRangeExpr(resolveSelectorVarName(normalizeSelector(clause.selector, clause.tribes), countVarMap), 0, 0);
    case EXACTLY_CLAUSE_KIND:
      return generateClosedRangeExpr(resolveSelectorVarName(normalizeSelector(clause.selector, clause.tribes), countVarMap), clause.value, clause.value);
    case MIN_CLAUSE_KIND:
      return generateClosedRangeExpr(resolveSelectorVarName(normalizeSelector(clause.selector, clause.tribes), countVarMap), clause.value, 8);
    case MAX_CLAUSE_KIND:
      return generateClosedRangeExpr(resolveSelectorVarName(normalizeSelector(clause.selector, clause.tribes), countVarMap), 0, clause.value);
    case COMPARISON_CLAUSE_KIND:
      return generateComparisonClauseExpr(clause, eqVarMap);
    case NOT_CLAUSE_KIND:
      return `!(${generateClauseExpr(clause.clause, countVarMap, eqVarMap, tribes, tribeIndex)})`;
    case AND_CLAUSE_KIND:
      return `(${clause.clauses.map(child => generateClauseExpr(child, countVarMap, eqVarMap, tribes, tribeIndex)).join(' && ')})`;
    case OR_CLAUSE_KIND:
      return `(${clause.clauses.map(child => generateClauseExpr(child, countVarMap, eqVarMap, tribes, tribeIndex)).join(' || ')})`;
    case XOR_CLAUSE_KIND:
      return generateXorClauseExpr(clause.clauses, countVarMap, eqVarMap, tribes, tribeIndex);
    default:
      return 'false';
  }
}

/**
 * Generates the WGSL expression for an is-clause.
 *
 * @param {string[]} tribeNames selected tribe names.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {string} WGSL boolean expression.
 */
function generateIsClauseExpr(tribeNames: string[], tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): string {
  const ids = resolveTribeIds(tribeNames, tribeIndex);
  if (ids.length === 0) {
    return 'false';
  }
  if (ids.length === tribes.length) {
    return 'true';
  }
  return `(${ids.map(id => `selfTribe == ${id}u`).join(' || ')})`;
}

/**
 * Generates a closed-range WGSL expression for one precomputed variable.
 *
 * @param {string} varName precomputed WGSL variable name.
 * @param {number} min inclusive minimum.
 * @param {number} max inclusive maximum.
 * @returns {string} WGSL range expression.
 */
function generateClosedRangeExpr(varName: string, min: number, max: number): string {
  return `(${varName} >= ${min}u && ${varName} <= ${max}u)`;
}

/**
 * Generates the WGSL expression for a comparison clause.
 *
 * @param {Extract<Clause<Tribe[]>, { kind: typeof COMPARISON_CLAUSE_KIND }>} clause comparison clause.
 * @param {Map<string, string>} eqVarMap equality variable mapping.
 * @returns {string} WGSL comparison expression.
 */
function generateComparisonClauseExpr(clause: Extract<Clause<Tribe[]>, {kind: typeof COMPARISON_CLAUSE_KIND}>, eqVarMap: Map<string, string>): string {
  const leftSelector = normalizeCountExpression(clause.left, clause.tribe1).selector;
  const rightSelector = normalizeCountExpression(clause.right, clause.tribe2).selector;
  const operator = COMPARISON_OPERATOR_WGSL[clause.operator] ?? '==';
  const margin = Math.max(-8, Math.min(8, clause.margin ?? 0));
  return `(i32(${resolveSelectorVarName(leftSelector, eqVarMap)}) ${operator} (i32(${resolveSelectorVarName(rightSelector, eqVarMap)}) + ${margin}i))`;
}

/**
 * Generates the WGSL expression for an xor-clause.
 *
 * @param {Clause<Tribe[]>[]} clauses xor child clauses.
 * @param {Map<string, string>} countVarMap count variable mapping.
 * @param {Map<string, string>} eqVarMap equality variable mapping.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {string} WGSL xor expression.
 */
function generateXorClauseExpr(clauses: Clause<Tribe[]>[], countVarMap: Map<string, string>, eqVarMap: Map<string, string>, tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): string {
  return `(((${clauses.map(child => generateClauseExpr(child, countVarMap, eqVarMap, tribes, tribeIndex)).map(part => `select(0u, 1u, ${part})`).join(' + ')}) & 1u) == 1u)`;
}

/**
 * Resolves the precomputed variable name for one selector.
 *
 * @param {TribeSelector<Tribe[]>} selector selector expression.
 * @param {Map<string, string>} varMap variable mapping.
 * @returns {string} WGSL variable name.
 */
function resolveSelectorVarName(selector: TribeSelector<Tribe[]>, varMap: Map<string, string>): string {
  return varMap.get(selectorKey(selector))!;
}

/**
 * Plans a two-dimensional compute dispatch within the device workgroup limit.
 *
 * @param {number} logicalWgX logical workgroups along x.
 * @param {number} logicalWgY logical workgroups along y.
 * @param {number} limit per-dimension dispatch limit.
 * @returns {DispatchPlan2D} dispatch plan.
 */
export function plan2DDispatch(logicalWgX: number, logicalWgY: number, limit: number): DispatchPlan2D {
  if (logicalWgX <= limit && logicalWgY <= limit) {
    return {
      logicalWgX,
      logicalWgY,
      dispatchWgX: logicalWgX,
      dispatchWgY: logicalWgY,
      remapped: false
    };
  }
  const totalLogicalWorkgroups = logicalWgX * logicalWgY;
  const dispatchWgX = Math.min(totalLogicalWorkgroups, limit);
  const dispatchWgY = Math.ceil(totalLogicalWorkgroups / dispatchWgX);
  if (dispatchWgY <= limit) {
    return {
      logicalWgX,
      logicalWgY,
      dispatchWgX,
      dispatchWgY,
      remapped: true
    };
  }
  throw new Error(`Grid requires ${logicalWgX}x${logicalWgY} logical workgroups, which cannot be remapped within the WebGPU per-dimension dispatch limit ${limit}.`);
}

/**
 * Generates the simulation compute shader for the active ruleset and packing format.
 *
 * @param {Ruleset<readonly Tribe[]>} ruleset active ruleset.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {number} packedCols packed grid words per row.
 * @param {Grid} grid logical grid dimensions.
 * @param {DispatchPlan2D} dispatchPlan simulation dispatch plan.
 * @param {GridFormat} gridFormat active packed grid format.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {string} WGSL source.
 */
export function generateComputeWgsl(ruleset: Ruleset<readonly Tribe[]>, tribes: readonly Tribe[], packedCols: number, grid: Grid, dispatchPlan: DispatchPlan2D, gridFormat: GridFormat, tribeIndex: ReadonlyMap<string, number>): string {
  const lines: string[] = [];
  const activeRules = ruleset.rules.filter(rule => !rule.muted);
  const deadIdx = tribeIndex.get(DEAD_TRIBE_ID) ?? 0;
  const countVarMap = buildCountVarMap(activeRules.map(rule => rule.clause));
  const eqVarMap = buildEqualityVarMap(activeRules.map(rule => rule.clause), countVarMap);
  lines.push('// Auto-generated simulation compute shader.');
  lines.push(`// Tribes: ${tribes.map(tribe => tribe.id).join(', ')}`);
  lines.push(`// Rules: ${ruleset.rules.length}`);
  lines.push('');
  lines.push('@group(0) @binding(0) var<storage, read> gridIn: array<u32>;');
  lines.push('@group(0) @binding(1) var<storage, read_write> gridOut: array<u32>;');
  lines.push('');
  lines.push(`const COLS: u32 = ${grid.cols}u;`);
  lines.push(`const ROWS: u32 = ${grid.rows}u;`);
  lines.push(`const PACKED_COLS: u32 = ${packedCols}u;`);
  pushDispatchPlanWgslConstants(lines, dispatchPlan);
  pushGridFormatWgslConstants(lines, gridFormat);
  lines.push('');
  pushReadCellWgsl(lines, 'gridIn', 'PACKED_COLS');
  lines.push('');
  lines.push('fn applyRules(selfTribe: u32, nTL: u32, nTC: u32, nTR: u32, nCL: u32, nCR: u32, nBL: u32, nBC: u32, nBR: u32) -> u32 {');
  pushNeighborCountDeclarations(lines, countVarMap, tribes, tribeIndex);
  pushEqualityCountDeclarations(lines, countVarMap, eqVarMap, tribes, tribeIndex);
  lines.push(`  var result: u32 = ${deadIdx}u;`);
  lines.push('');
  pushRuleChain(lines, activeRules, countVarMap, eqVarMap, tribes, tribeIndex);
  lines.push('  return result;');
  lines.push('}');
  lines.push('');
  lines.push('@compute @workgroup_size(16, 16)');
  if (dispatchPlan.remapped) {
    lines.push('fn main(@builtin(workgroup_id) workgroup_id: vec3u, @builtin(local_invocation_id) local_invocation_id: vec3u) {');
  } else {
    lines.push('fn main(@builtin(global_invocation_id) gid: vec3u) {');
  }
  pushLogicalInvocation2DWgsl(lines, dispatchPlan, 'px');
  lines.push('  if (px >= PACKED_COLS || y >= ROWS) { return; }');
  lines.push('');
  lines.push('  let baseX = px << WORD_SHIFT;');
  lines.push('  var packed: u32 = 0u;');
  lines.push('');
  lines.push('  for (var i: u32 = 0u; i < CELLS_PER_WORD; i = i + 1u) {');
  lines.push('    let x = baseX + i;');
  lines.push('    if (x >= COLS) { break; }');
  lines.push('');
  lines.push('    let selfTribe = readCell(x, y);');
  pushNeighborReads(lines);
  lines.push('');
  lines.push('    packed = packed | ((applyRules(selfTribe, nTL, nTC, nTR, nCL, nCR, nBL, nBC, nBR) & CELL_MASK) << (i << CELL_SHIFT));');
  lines.push('  }');
  lines.push('');
  lines.push('  gridOut[y * PACKED_COLS + px] = packed;');
  lines.push('}');
  return lines.join('\n');
}
