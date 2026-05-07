import {AND_CLAUSE_KIND, ANY_TRIBE_ID, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Tribe, XOR_CLAUSE_KIND} from '../model/rule';

export interface RuleSummaryPart {
  kind: 'text' | 'tribe';
  text?: string;
  tribeId?: string;
}

export function buildClauseSummaryParts(clause: Clause<Tribe[]>): RuleSummaryPart[] {
  const parts: RuleSummaryPart[] = [];
  appendClauseSummaryParts(parts, clause);
  return parts;
}

function appendClauseSummaryParts(parts: RuleSummaryPart[], clause: Clause<Tribe[]>, parentClause: Clause<Tribe[]> | null = null): void {
  const wrapWithParentheses = parentClause ? shouldWrapClause(parentClause, clause) : false;
  if (wrapWithParentheses) {
    pushSummaryText(parts, '(');
  }

  switch (clause.kind) {
    case EMPTY_CLAUSE_KIND:
      pushSummaryText(parts, '∅');
      break;
    case IS_CLAUSE_KIND:
      pushSummaryText(parts, 'is ');
      appendTribeSummaryParts(parts, clause.tribes as string[]);
      break;
    case COUNT_CLAUSE_KIND:
      appendTribeSummaryParts(parts, clause.tribes as string[]);
      pushSummaryText(parts, ` ∈ [${clause.interval[0]},${clause.interval[1]}]`);
      break;
    case NONE_CLAUSE_KIND:
      pushSummaryText(parts, 'none of ');
      appendTribeSummaryParts(parts, clause.tribes as string[]);
      break;
    case EXACTLY_CLAUSE_KIND:
      pushSummaryText(parts, `exactly ${clause.value} `);
      appendTribeSummaryParts(parts, clause.tribes as string[]);
      break;
    case MIN_CLAUSE_KIND:
      pushSummaryText(parts, `min ${clause.value} `);
      appendTribeSummaryParts(parts, clause.tribes as string[]);
      break;
    case MAX_CLAUSE_KIND:
      pushSummaryText(parts, `max ${clause.value} `);
      appendTribeSummaryParts(parts, clause.tribes as string[]);
      break;
    case COMPARISON_CLAUSE_KIND:
      pushSummaryText(parts, '#');
      appendTribeSummaryParts(parts, clause.tribe1 as string[]);
      pushSummaryText(parts, ` ${clause.operator ?? '='} #`);
      appendTribeSummaryParts(parts, clause.tribe2 as string[]);
      if ((clause.margin ?? 0) !== 0) {
        const margin = clause.margin ?? 0;
        pushSummaryText(parts, margin >= 0 ? ` + ${margin}` : ` - ${Math.abs(margin)}`);
      }
      break;
    case NOT_CLAUSE_KIND:
      pushSummaryText(parts, '¬');
      appendClauseSummaryParts(parts, clause.clause, clause);
      break;
    case AND_CLAUSE_KIND:
      clause.clauses.forEach((sub, index) => {
        if (index > 0) {
          pushSummaryText(parts, ' ∧ ');
        }
        appendClauseSummaryParts(parts, sub, clause);
      });
      break;
    case OR_CLAUSE_KIND:
      clause.clauses.forEach((sub, index) => {
        if (index > 0) {
          pushSummaryText(parts, ' ∨ ');
        }
        appendClauseSummaryParts(parts, sub, clause);
      });
      break;
    case XOR_CLAUSE_KIND:
      clause.clauses.forEach((sub, index) => {
        if (index > 0) {
          pushSummaryText(parts, ' ⊕ ');
        }
        appendClauseSummaryParts(parts, sub, clause);
      });
      break;
  }

  if (wrapWithParentheses) {
    pushSummaryText(parts, ')');
  }
}

function shouldWrapClause(parentClause: Clause<Tribe[]>, childClause: Clause<Tribe[]>): boolean {
  const parentPrecedence = clausePrecedence(parentClause);
  const childPrecedence = clausePrecedence(childClause);
  if (childPrecedence < parentPrecedence) {
    return true;
  }

  if (childPrecedence !== parentPrecedence) {
    return false;
  }

  return isBinaryLogicalClause(parentClause) && isBinaryLogicalClause(childClause) && parentClause.kind !== childClause.kind;
}

function clausePrecedence(clause: Clause<Tribe[]>): number {
  switch (clause.kind) {
    case OR_CLAUSE_KIND:
    case XOR_CLAUSE_KIND:
      return 1;
    case AND_CLAUSE_KIND:
      return 2;
    case NOT_CLAUSE_KIND:
      return 3;
    default:
      return 4;
  }
}

function isBinaryLogicalClause(clause: Clause<Tribe[]>): clause is Extract<Clause<Tribe[]>, {kind: typeof AND_CLAUSE_KIND | typeof OR_CLAUSE_KIND | typeof XOR_CLAUSE_KIND}> {
  return clause.kind === AND_CLAUSE_KIND || clause.kind === OR_CLAUSE_KIND || clause.kind === XOR_CLAUSE_KIND;
}

function appendTribeSummaryParts(parts: RuleSummaryPart[], tribeIds: string[]): void {
  tribeIds.forEach(tribeId => {
    if (tribeId === ANY_TRIBE_ID) {
      pushSummaryText(parts, ANY_TRIBE_ID);
      return;
    }

    parts.push({
      kind: 'tribe',
      tribeId
    });
  });
}

function pushSummaryText(parts: RuleSummaryPart[], text: string): void {
  if (!text) {
    return;
  }

  const last = parts.at(-1);
  if (last?.kind === 'text') {
    last.text = `${last.text ?? ''}${text}`;
    return;
  }

  parts.push({
    kind: 'text',
    text
  });
}
