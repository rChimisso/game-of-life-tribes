import {Clause, Tribe, AND_CLAUSE_KIND, OR_CLAUSE_KIND, XOR_CLAUSE_KIND} from '~gol/feature/home/model/rule';
import {ClauseDraft} from '~gol/feature/home/model/rule-draft';

/**
 * Checks if the given clause is a binary logical clause (AND, OR, XOR).
 *
 * @private
 * @param {Clause<Tribe[]> | ClauseDraft} clause clause to check.
 * @returns {boolean} `true` if the clause is a binary logical clause, `false` otherwise.
 */
export function isBinaryLogicalClause(clause: Clause<Tribe[]> | ClauseDraft): boolean {
  return clause.kind === AND_CLAUSE_KIND || clause.kind === OR_CLAUSE_KIND || clause.kind === XOR_CLAUSE_KIND;
}
