import {Clause, Tribe, AND_CLAUSE_KIND, OR_CLAUSE_KIND, XOR_CLAUSE_KIND} from '~gol/feature/home/model/rule';

/**
 * Checks if the given clause is a binary logical clause (AND, OR, XOR).
 *
 * @private
 * @param {Clause<Tribe[]>} clause clause to check.
 * @returns {clause is Extract<Clause<Tribe[]>, {kind: typeof AND_CLAUSE_KIND | typeof OR_CLAUSE_KIND | typeof XOR_CLAUSE_KIND}>} `true` if the clause is a binary logical clause, `false` otherwise.
 */
export function isBinaryLogicalClause(clause: Clause<Tribe[]>): clause is Extract<Clause<Tribe[]>, {kind: typeof AND_CLAUSE_KIND | typeof OR_CLAUSE_KIND | typeof XOR_CLAUSE_KIND}> {
  return clause.kind === AND_CLAUSE_KIND || clause.kind === OR_CLAUSE_KIND || clause.kind === XOR_CLAUSE_KIND;
}
