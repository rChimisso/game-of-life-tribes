import {COMPARISON_OPERATOR_WGSL} from '../model/comparison-operator-wgsl';
import {DispatchPlan2D} from '../model/dispatch-plan';

import {Grid} from '~gol/feature/home/model/grid';
import {GridFormat} from '~gol/feature/home/model/grid-format';
import {AND_CLAUSE_KIND, ANY_TRIBE_ID, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Rule, Ruleset, Tribe, XOR_CLAUSE_KIND} from '~gol/feature/home/model/rule';

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
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {Map<string, string>} count variable mapping.
 */
function buildCountVarMap(clauses: Clause<Tribe[]>[], tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): Map<string, string> {
  const countSets = collectCountSets(clauses, tribes, tribeIndex);
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
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @param {Map<string, string>} countVarMap existing count variable mapping.
 * @returns {Map<string, string>} equality variable mapping.
 */
function buildEqualityVarMap(clauses: Clause<Tribe[]>[], tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>, countVarMap: Map<string, string>): Map<string, string> {
  const equalitySets = collectEqualitySets(clauses, tribes, tribeIndex);
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
 */
function pushNeighborCountDeclarations(lines: string[], countVarMap: Map<string, string>): void {
  for (const [key, varName] of countVarMap) {
    lines.push(`  let ${varName} = ${buildNeighborCountExpr(key)};`);
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
 */
function pushEqualityCountDeclarations(lines: string[], countVarMap: Map<string, string>, eqVarMap: Map<string, string>): void {
  let emitted = 0;
  for (const [key, varName] of eqVarMap) {
    if (!countVarMap.has(key)) {
      lines.push(`  let ${varName} = ${buildNeighborCountExpr(key)};`);
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
    lines.push(`    result = ${resolveTribeTarget(rule.tribe, tribeIndex)}u;`);
  }
  if (activeRules.length > 0) {
    lines.push('  }');
  }
  lines.push('');
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
 * Builds the WGSL sum expression for one set of eligible tribe ids.
 *
 * @param {string} key serialized tribe-id set key.
 * @returns {string} WGSL sum expression.
 */
function buildNeighborCountExpr(key: string): string {
  const tribeIds = key.split(',').filter(Boolean).map(Number);
  return getNeighborVarNames().map(neighbor => `select(0u, 1u, ${tribeIds.map(id => `${neighbor} == ${id}u`).join(' || ')})`).join(' + ');
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
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {number[]} numeric tribe ids.
 */
function resolveTribeIds(tribeNames: string[], tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): number[] {
  const ids: number[] = [];
  for (const name of tribeNames) {
    if (name === ANY_TRIBE_ID) {
      for (let index = 0; index < tribes.length; index++) {
        ids.push(index);
      }
    } else {
      const idx = tribeIndex.get(name);
      if (idx !== undefined) {
        ids.push(idx);
      }
    }
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
  return tribeName === ANY_TRIBE_ID ? 0 : tribeIndex.get(tribeName) ?? 0;
}

/**
 * Serializes one resolved tribe-id set into the canonical lookup key.
 *
 * @param {string[]} tribeIds selected tribe ids.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {string} canonical serialized tribe-set key.
 */
function tribeSetKey(tribeIds: string[], tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): string {
  return resolveTribeIds(tribeIds, tribes, tribeIndex).sort().join(',');
}

/**
 * Traverses one or more clause trees and collects serialized tribe-set keys.
 *
 * @param {Clause<Tribe[]>[]} clauses rule clauses.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @param {(clause: Clause<Tribe[]>, addTribeSet: (tribeIds: string[]) => void) => void} collectFromClause per-clause collection callback.
 * @returns {Set<string>} collected serialized tribe-set keys.
 */
function collectClauseSets(clauses: Clause<Tribe[]>[], tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>, collectFromClause: (clause: Clause<Tribe[]>, addTribeSet: (tribeIds: string[]) => void) => void): Set<string> {
  const result = new Set<string>();
  const addTribeSet = (tribeIds: string[]): void => {
    result.add(tribeSetKey(tribeIds, tribes, tribeIndex));
  };
  const visit = (clause: Clause<Tribe[]>): void => {
    collectFromClause(clause, addTribeSet);
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
 * Collects the unique count-set keys required by the rule clauses.
 *
 * @param {Clause<Tribe[]>[]} clauses rule clauses.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {Set<string>} unique count-set keys.
 */
function collectCountSets(clauses: Clause<Tribe[]>[], tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): Set<string> {
  return collectClauseSets(clauses, tribes, tribeIndex, (clause, addTribeSet) => {
    switch (clause.kind) {
      case NONE_CLAUSE_KIND:
      case EXACTLY_CLAUSE_KIND:
      case MIN_CLAUSE_KIND:
      case MAX_CLAUSE_KIND:
      case COUNT_CLAUSE_KIND:
        addTribeSet(clause.tribes as string[]);
        break;
    }
  });
}

/**
 * Collects the unique equality-set keys required by the rule clauses.
 *
 * @param {Clause<Tribe[]>[]} clauses rule clauses.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {Set<string>} unique equality-set keys.
 */
function collectEqualitySets(clauses: Clause<Tribe[]>[], tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): Set<string> {
  return collectClauseSets(clauses, tribes, tribeIndex, (clause, addTribeSet) => {
    if (clause.kind === COMPARISON_CLAUSE_KIND) {
      addTribeSet(clause.tribe1 as string[]);
      addTribeSet(clause.tribe2 as string[]);
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
      return generateClosedRangeExpr(resolveVarName(clause.tribes as string[], countVarMap, tribes, tribeIndex), clause.interval[0], clause.interval[1]);
    case NONE_CLAUSE_KIND:
      return generateClosedRangeExpr(resolveVarName(clause.tribes as string[], countVarMap, tribes, tribeIndex), 0, 0);
    case EXACTLY_CLAUSE_KIND:
      return generateClosedRangeExpr(resolveVarName(clause.tribes as string[], countVarMap, tribes, tribeIndex), clause.value, clause.value);
    case MIN_CLAUSE_KIND:
      return generateClosedRangeExpr(resolveVarName(clause.tribes as string[], countVarMap, tribes, tribeIndex), clause.value, 8);
    case MAX_CLAUSE_KIND:
      return generateClosedRangeExpr(resolveVarName(clause.tribes as string[], countVarMap, tribes, tribeIndex), 0, clause.value);
    case COMPARISON_CLAUSE_KIND:
      return generateComparisonClauseExpr(clause, eqVarMap, tribes, tribeIndex);
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
  const ids = resolveTribeIds(tribeNames, tribes, tribeIndex);
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
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {string} WGSL comparison expression.
 */
function generateComparisonClauseExpr(clause: Extract<Clause<Tribe[]>, {kind: typeof COMPARISON_CLAUSE_KIND}>, eqVarMap: Map<string, string>, tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): string {
  const leftTribeIds = resolveTribeIds(clause.tribe1 as string[], tribes, tribeIndex).sort().join(',');
  const rightTribeIds = resolveTribeIds(clause.tribe2 as string[], tribes, tribeIndex).sort().join(',');
  const operator = COMPARISON_OPERATOR_WGSL[clause.operator] ?? '==';
  const margin = Math.max(-8, Math.min(8, clause.margin ?? 0));
  return `(i32(${eqVarMap.get(leftTribeIds)}) ${operator} (i32(${eqVarMap.get(rightTribeIds)}) + ${margin}i))`;
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
 * Resolves the precomputed variable name for one serialized tribe-set key.
 *
 * @param {string[]} tribeNames selected tribe names.
 * @param {Map<string, string>} varMap variable mapping.
 * @param {readonly Tribe[]} tribes active tribe list.
 * @param {ReadonlyMap<string, number>} tribeIndex runtime tribe lookup.
 * @returns {string} WGSL variable name.
 */
function resolveVarName(tribeNames: string[], varMap: Map<string, string>, tribes: readonly Tribe[], tribeIndex: ReadonlyMap<string, number>): string {
  return varMap.get(resolveTribeIds(tribeNames, tribes, tribeIndex).sort().join(','))!;
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
  const countVarMap = buildCountVarMap(activeRules.map(rule => rule.clause), tribes, tribeIndex);
  const eqVarMap = buildEqualityVarMap(activeRules.map(rule => rule.clause), tribes, tribeIndex, countVarMap);
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
  pushNeighborCountDeclarations(lines, countVarMap);
  pushEqualityCountDeclarations(lines, countVarMap, eqVarMap);
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
