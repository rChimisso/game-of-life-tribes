/* eslint-disable jsdoc/require-jsdoc */
import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

import {SummaryPart, SummaryTribeColor} from './model/summary';
import {AND_CLAUSE_KIND, ANY_TRIBE_ID, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Tribe, XOR_CLAUSE_KIND} from '../../../feature/home/model/rule';
import {TribeSwatch} from '../tribe-swatch/tribe-swatch';

import {TypedChanges} from '~gol/core/model/typed-change';

@Component({
  selector: 'gol-summary',
  standalone: true,
  imports: [MatIconModule, TribeSwatch],
  templateUrl: './summary.html',
  styleUrl: './summary.scss',
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.title]': 'summaryTitle'
  }
})
export class SummaryComponent implements OnChanges {
  @Input({required: true})
  public clause: Clause<Tribe[]> | null = null;

  @Input()
  public tribeColors: readonly SummaryTribeColor[] = [];

  @Input()
  public overflowThreshold = 4;

  public displayParts: SummaryPart[] = [];

  public summaryTitle: string | null = null;

  private readonly summaryTokens = {
    openParen: '(',
    closeParen: ')',
    empty: '∅',
    not: '¬',
    comparisonCountPrefix: '#',
    any: ANY_TRIBE_ID
  } as const;

  private readonly binaryClauseJoiners: Record<typeof AND_CLAUSE_KIND | typeof OR_CLAUSE_KIND | typeof XOR_CLAUSE_KIND, string> = {
    [AND_CLAUSE_KIND]: ' ∧ ',
    [OR_CLAUSE_KIND]: ' ∨ ',
    [XOR_CLAUSE_KIND]: ' ⊕ '
  };

  private tribeColorById = new Map<string, string>();

  private allTribeIds = new Set<string>();

  public ngOnChanges(changes: TypedChanges<SummaryComponent>): void {
    if (changes.tribeColors) {
      this.tribeColorById = new Map(this.tribeColors.map(tribe => [tribe.id, tribe.color]));
      this.allTribeIds = new Set(this.tribeColors.map(tribe => tribe.id));
    }

    if (changes.clause || changes.tribeColors) {
      this.displayParts = this.clause ? this.buildClauseSummaryParts(this.clause) : [];
      this.summaryTitle = this.buildSummaryTitle();
    }
  }

  public tribeColor(tribeId: string): string {
    return this.tribeColorById.get(tribeId) ?? '888888';
  }

  public summaryOverflowLabel(tribeIds: readonly string[]): string {
    return tribeIds.join(', ');
  }

  private buildSummaryTitle(): string | null {
    const title = this.displayParts.map(part => part.kind === 'text' ? part.text : part.tribes.join('/')).join('');
    return title || null;
  }

  private buildClauseSummaryParts(clause: Clause<Tribe[]>): SummaryPart[] {
    const parts: SummaryPart[] = [];
    this.appendClauseSummaryParts(parts, clause);
    return parts;
  }

  private appendClauseSummaryParts(parts: SummaryPart[], clause: Clause<Tribe[]>, parentClause: Clause<Tribe[]> | null = null): void {
    const wrapWithParentheses = parentClause ? this.shouldWrapClause(parentClause, clause) : false;
    if (wrapWithParentheses) {
      this.pushSummaryText(parts, this.summaryTokens.openParen);
    }

    this.appendClauseContent(parts, clause);

    if (wrapWithParentheses) {
      this.pushSummaryText(parts, this.summaryTokens.closeParen);
    }
  }

  private appendClauseContent(parts: SummaryPart[], clause: Clause<Tribe[]>): void {
    switch (clause.kind) {
      case EMPTY_CLAUSE_KIND:
        this.pushSummaryText(parts, this.summaryTokens.empty);
        break;
      case IS_CLAUSE_KIND:
        this.pushSummaryText(parts, 'is ');
        this.appendTribeSummaryParts(parts, clause.tribes as string[]);
        break;
      case COUNT_CLAUSE_KIND:
        this.appendTribeSummaryParts(parts, clause.tribes as string[]);
        this.pushSummaryText(parts, ` ∈ [${clause.interval[0]},${clause.interval[1]}]`);
        break;
      case NONE_CLAUSE_KIND:
        this.pushSummaryText(parts, 'none of ');
        this.appendTribeSummaryParts(parts, clause.tribes as string[]);
        break;
      case EXACTLY_CLAUSE_KIND:
        this.pushSummaryText(parts, `exactly ${clause.value} `);
        this.appendTribeSummaryParts(parts, clause.tribes as string[]);
        break;
      case MIN_CLAUSE_KIND:
        this.pushSummaryText(parts, `min ${clause.value} `);
        this.appendTribeSummaryParts(parts, clause.tribes as string[]);
        break;
      case MAX_CLAUSE_KIND:
        this.pushSummaryText(parts, `max ${clause.value} `);
        this.appendTribeSummaryParts(parts, clause.tribes as string[]);
        break;
      case COMPARISON_CLAUSE_KIND: {
        this.pushSummaryText(parts, this.summaryTokens.comparisonCountPrefix);
        this.appendTribeSummaryParts(parts, clause.tribe1 as string[]);
        this.pushSummaryText(parts, ` ${clause.operator} ${this.summaryTokens.comparisonCountPrefix}`);
        this.appendTribeSummaryParts(parts, clause.tribe2 as string[]);
        const {margin = 0} = clause;
        if (margin !== 0) {
          this.pushSummaryText(parts, margin >= 0 ? ` +${margin}` : ` -${Math.abs(margin)}`);
        }
        break;
      }
      case NOT_CLAUSE_KIND:
        this.pushSummaryText(parts, this.summaryTokens.not);
        this.appendClauseSummaryParts(parts, clause.clause, clause);
        break;
      case AND_CLAUSE_KIND:
      case XOR_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
        this.appendBinaryClauseSummaryParts(parts, clause);
        break;
    }
  }

  private appendBinaryClauseSummaryParts(parts: SummaryPart[], clause: Extract<Clause<Tribe[]>, {kind: typeof AND_CLAUSE_KIND | typeof OR_CLAUSE_KIND | typeof XOR_CLAUSE_KIND}>): void {
    const joiner = this.binaryClauseJoiners[clause.kind];
    clause.clauses.forEach((sub, index) => {
      if (index > 0) {
        this.pushSummaryText(parts, joiner);
      }
      this.appendClauseSummaryParts(parts, sub, clause);
    });
  }

  private shouldWrapClause(parentClause: Clause<Tribe[]>, childClause: Clause<Tribe[]>): boolean {
    if (this.isBinaryLogicalClause(parentClause) && this.isBinaryLogicalClause(childClause)) {
      return parentClause.kind !== childClause.kind;
    }

    return parentClause.kind === NOT_CLAUSE_KIND && this.isBinaryLogicalClause(childClause);
  }

  private isBinaryLogicalClause(clause: Clause<Tribe[]>): clause is Extract<Clause<Tribe[]>, {kind: typeof AND_CLAUSE_KIND | typeof OR_CLAUSE_KIND | typeof XOR_CLAUSE_KIND}> {
    return clause.kind === AND_CLAUSE_KIND || clause.kind === OR_CLAUSE_KIND || clause.kind === XOR_CLAUSE_KIND;
  }

  private appendTribeSummaryParts(parts: SummaryPart[], tribeIds: string[]): void {
    const normalized = this.normalizeTribeSelection(tribeIds);
    if (normalized.kind === 'empty') {
      return;
    }

    if (normalized.kind === 'any') {
      this.pushSummaryText(parts, this.summaryTokens.any);
      return;
    }

    const last = parts.at(-1);
    if (last?.kind === 'tribes') {
      last.tribes.push(...normalized.tribes);
      return;
    }

    parts.push({
      kind: 'tribes',
      tribes: normalized.tribes
    });
  }

  private normalizeTribeSelection(tribeIds: readonly string[]): {kind: 'empty'} | {kind: 'any'} | {kind: 'tribes'; tribes: string[]} {
    const selected = new Set<string>();
    for (const tribeId of tribeIds) {
      if (!tribeId) {
        continue;
      }

      if (tribeId === ANY_TRIBE_ID) {
        return {
          kind: 'any'
        };
      }

      selected.add(tribeId);
    }

    if (selected.size === 0) {
      return {
        kind: 'empty'
      };
    }

    if (this.isAnyTribeSelection(selected)) {
      return {
        kind: 'any'
      };
    }

    return {
      kind: 'tribes',
      tribes: [...selected]
    };
  }

  private isAnyTribeSelection(tribeIds: ReadonlySet<string>): boolean {
    if (tribeIds.has(ANY_TRIBE_ID)) {
      return true;
    }

    if (this.allTribeIds.size === 0) {
      return false;
    }

    if (tribeIds.size < this.allTribeIds.size) {
      return false;
    }

    for (const tribeId of this.allTribeIds) {
      if (!tribeIds.has(tribeId)) {
        return false;
      }
    }

    return true;
  }

  private pushSummaryText(parts: SummaryPart[], text: string): void {
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
}
