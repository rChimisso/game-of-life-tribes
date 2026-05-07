import {Clause, Tribe} from '../model/rule';

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
    case 'empty':
      pushSummaryText(parts, '∅');
      break;
    case 'is':
      pushSummaryText(parts, 'is ');
      appendTribeSummaryParts(parts, clause.tribes as string[]);
      break;
    case 'count':
      appendTribeSummaryParts(parts, clause.tribes as string[]);
      pushSummaryText(parts, ` ∈ [${clause.interval[0]},${clause.interval[1]}]`);
      break;
    case 'none':
      pushSummaryText(parts, 'none of ');
      appendTribeSummaryParts(parts, clause.tribes as string[]);
      break;
    case 'exactly':
      pushSummaryText(parts, `exactly ${clause.value} `);
      appendTribeSummaryParts(parts, clause.tribes as string[]);
      break;
    case 'atLeast':
      pushSummaryText(parts, `at least ${clause.value} `);
      appendTribeSummaryParts(parts, clause.tribes as string[]);
      break;
    case 'atMost':
      pushSummaryText(parts, `at most ${clause.value} `);
      appendTribeSummaryParts(parts, clause.tribes as string[]);
      break;
    case 'comparison':
    case 'equality':
      pushSummaryText(parts, '#');
      appendTribeSummaryParts(parts, clause.tribe1 as string[]);
      pushSummaryText(parts, ` ${clause.operator ?? '='} #`);
      appendTribeSummaryParts(parts, clause.tribe2 as string[]);
      if ((clause.margin ?? 0) !== 0) {
        const margin = clause.margin ?? 0;
        pushSummaryText(parts, margin >= 0 ? ` + ${margin}` : ` - ${Math.abs(margin)}`);
      }
      break;
    case 'not':
      pushSummaryText(parts, '¬');
      appendClauseSummaryParts(parts, clause.clause, clause);
      break;
    case 'and':
      clause.clauses.forEach((sub, index) => {
        if (index > 0) {
          pushSummaryText(parts, ' ∧ ');
        }
        appendClauseSummaryParts(parts, sub, clause);
      });
      break;
    case 'or':
      clause.clauses.forEach((sub, index) => {
        if (index > 0) {
          pushSummaryText(parts, ' ∨ ');
        }
        appendClauseSummaryParts(parts, sub, clause);
      });
      break;
    case 'xor':
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
    case 'or':
    case 'xor':
      return 1;
    case 'and':
      return 2;
    case 'not':
      return 3;
    default:
      return 4;
  }
}

function isBinaryLogicalClause(clause: Clause<Tribe[]>): clause is Extract<Clause<Tribe[]>, {kind: 'and' | 'or' | 'xor'}> {
  return clause.kind === 'and' || clause.kind === 'or' || clause.kind === 'xor';
}

function appendTribeSummaryParts(parts: RuleSummaryPart[], tribeIds: string[]): void {
  tribeIds.forEach(tribeId => {
    if (tribeId === 'any') {
      pushSummaryText(parts, 'any');
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
