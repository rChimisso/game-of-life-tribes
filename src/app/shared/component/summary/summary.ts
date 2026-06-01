import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

import {SummaryPart, SummaryTribeColor} from './model/summary';
import {isBinaryLogicalClause} from './util/clause';
import {AND_CLAUSE_KIND, ANY_TRIBE_ID, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Tribe, XOR_CLAUSE_KIND} from '../../../feature/home/model/rule';
import {TribeSwatch} from '../tribe-swatch/tribe-swatch';

import {TypedChanges} from '~gol/core/model/typed-change';

/**
 * Clause/rule summary component.
 *
 * @class SummaryComponent
 * @typedef {SummaryComponent}
 * @implements {OnChanges}
 */
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
  /**
   * Clause to summarize.
   *
   * @public
   * @type {Clause<Tribe[]> | null}
   */
  @Input({required: true})
  public clause: Clause<Tribe[]> | null = null;

  /**
   * Colors for the tribes.
   *
   * @public
   * @type {readonly SummaryTribeColor[]}
   */
  @Input()
  public tribeColors: readonly SummaryTribeColor[] = [];

  /**
   * Maximum number of tribes to display before overflowing into a single swatch.
   *
   * @public
   * @type {number}
   */
  @Input()
  public overflowThreshold = 4;

  /**
   * Parts of the clause summary to display.
   *
   * @public
   * @type {SummaryPart[]}
   */
  public displayParts: SummaryPart[] = [];

  /**
   * Tooltip for the clause summary.
   *
   * @public
   * @type {string | null}
   */
  public summaryTitle: string | null = null;

  /**
   * Tokens used for summarizing clauses.
   *
   * @private
   * @readonly
   * @type {Record<string, string>}
   */
  private readonly summaryTokens = {
    openParen: '(',
    closeParen: ')',
    comparisonCountPrefix: '#',
    [EMPTY_CLAUSE_KIND]: '∅',
    [NOT_CLAUSE_KIND]: '¬',
    [IS_CLAUSE_KIND]: 'is ',
    [NONE_CLAUSE_KIND]: 'none of ',
    [EXACTLY_CLAUSE_KIND]: 'exactly ',
    [MIN_CLAUSE_KIND]: 'min ',
    [MAX_CLAUSE_KIND]: 'max ',
    [ANY_TRIBE_ID]: ANY_TRIBE_ID
  };

  /**
   * Characters used to join binary logical clauses.
   *
   * @private
   * @readonly
   * @type {Record<string, string>}
   */
  private readonly binaryClauseJoiners = {
    [AND_CLAUSE_KIND]: ' ∧ ',
    [OR_CLAUSE_KIND]: ' ∨ ',
    [XOR_CLAUSE_KIND]: ' ⊻ '
  };

  /**
   * Mapping of tribe IDs to their corresponding colors.
   *
   * @private
   * @type {Map<string, string>}
   */
  private tribeColorById = new Map<string, string>();

  /**
   * Set of all tribe IDs.
   *
   * @private
   * @type {Set<string>}
   */
  private allTribeIds = new Set<string>();

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<SummaryComponent>): void {
    if (changes.tribeColors) {
      this.tribeColorById = new Map(this.tribeColors.map(tribe => [tribe.id, tribe.color]));
      this.allTribeIds = new Set(this.tribeColors.map(tribe => tribe.id));
    }
    if (changes.clause || changes.tribeColors) {
      this.displayParts = this.clause ? this.buildClauseSummaryParts(this.clause) : [];
      this.summaryTitle = this.displayParts.map(part => part.kind === 'text' ? part.text : part.tribes.join('/')).join('');
    }
  }

  /**
   * Returns the color for the given tribe ID, or a default color if the tribe ID is not found.
   *
   * @public
   * @param {string} tribeId tribe ID.
   * @returns {string} hex color code for the tribe.
   */
  public tribeColor(tribeId: string): string {
    return this.tribeColorById.get(tribeId) ?? '888888';
  }

  /**
   * Returns the overflow label for the given tribe IDs.
   *
   * @public
   * @param {readonly string[]} tribeIds tribe IDs.
   * @returns {string} overflow label for the tribes.
   */
  public summaryOverflowLabel(tribeIds: readonly string[]): string {
    return tribeIds.join(' / ');
  }

  /**
   * Builds the summary parts for the given clause.
   *
   * @private
   * @param {Clause<Tribe[]>} clause clause to summarize.
   * @returns {SummaryPart[]} summary parts for the clause.
   */
  private buildClauseSummaryParts(clause: Clause<Tribe[]>): SummaryPart[] {
    const parts: SummaryPart[] = [];
    this.appendClauseSummaryParts(parts, clause);
    return parts;
  }

  /**
   * Appends the summary parts for the given clause, optionally wrapping them in parentheses if needed.
   *
   * @private
   * @param {SummaryPart[]} parts summary parts to append to.
   * @param {Clause<Tribe[]>} clause clause to summarize.
   * @param {Clause<Tribe[]> | null} [parentClause=null] parent clause, if any.
   */
  private appendClauseSummaryParts(parts: SummaryPart[], clause: Clause<Tribe[]>, parentClause: Clause<Tribe[]> | null = null): void {
    const wrapWithParentheses = !!parentClause && isBinaryLogicalClause(clause) && (parentClause.kind === NOT_CLAUSE_KIND || (isBinaryLogicalClause(parentClause) && parentClause.kind !== clause.kind));
    if (wrapWithParentheses) {
      this.appendSummaryText(parts, this.summaryTokens.openParen);
    }
    this.appendClauseContent(parts, clause);
    if (wrapWithParentheses) {
      this.appendSummaryText(parts, this.summaryTokens.closeParen);
    }
  }

  /**
   * Appends the content of the given clause to the summary parts.
   *
   * @private
   * @param {SummaryPart[]} parts summary parts to append to.
   * @param {Clause<Tribe[]>} clause clause to summarize.
   */
  private appendClauseContent(parts: SummaryPart[], clause: Clause<Tribe[]>): void {
    switch (clause.kind) {
      case EMPTY_CLAUSE_KIND:
        this.appendSummaryText(parts, this.summaryTokens.empty);
        break;
      case IS_CLAUSE_KIND:
      case NONE_CLAUSE_KIND:
        this.appendSummaryText(parts, this.summaryTokens[clause.kind]);
        this.appendTribeSummaryParts(parts, clause.tribes);
        break;
      case EXACTLY_CLAUSE_KIND:
      case MIN_CLAUSE_KIND:
      case MAX_CLAUSE_KIND:
        this.appendSummaryText(parts, `${this.summaryTokens[clause.kind]}${clause.value} `);
        this.appendTribeSummaryParts(parts, clause.tribes);
        break;
      case COUNT_CLAUSE_KIND:
        this.appendTribeSummaryParts(parts, clause.tribes);
        this.appendSummaryText(parts, ` ∈ [${clause.interval[0]},${clause.interval[1]}]`);
        break;
      case COMPARISON_CLAUSE_KIND: {
        this.appendSummaryText(parts, this.summaryTokens.comparisonCountPrefix);
        this.appendTribeSummaryParts(parts, clause.tribe1);
        this.appendSummaryText(parts, ` ${clause.operator} ${this.summaryTokens.comparisonCountPrefix}`);
        this.appendTribeSummaryParts(parts, clause.tribe2);
        const {margin = 0} = clause;
        if (margin !== 0) {
          this.appendSummaryText(parts, margin >= 0 ? ` +${margin}` : ` -${Math.abs(margin)}`);
        }
        break;
      }
      case NOT_CLAUSE_KIND:
        this.appendSummaryText(parts, this.summaryTokens.not);
        this.appendClauseSummaryParts(parts, clause.clause, clause);
        break;
      case AND_CLAUSE_KIND:
      case XOR_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
        const joiner = this.binaryClauseJoiners[clause.kind];
        clause.clauses.forEach((sub, index) => {
          if (index > 0) {
            this.appendSummaryText(parts, joiner);
          }
          this.appendClauseSummaryParts(parts, sub, clause);
        });
        break;
    }
  }

  /**
   * Appends the summary parts for the given tribe IDs.
   *
   * @private
   * @param {SummaryPart[]} parts summary parts to append to.
   * @param {string[]} tribeIds tribe IDs.
   */
  private appendTribeSummaryParts(parts: SummaryPart[], tribeIds: string[]): void {
    const normalized = this.normalizeTribeSelection(new Set(tribeIds));
    switch (normalized.kind) {
      case 'empty':
        break;
      case 'any':
        this.appendSummaryText(parts, this.summaryTokens.any);
        break;
      case 'tribes':
        const last = parts.at(-1);
        if (last?.kind === 'tribes') {
          last.tribes.push(...normalized.tribes);
        } else {
          parts.push({kind: 'tribes', tribes: normalized.tribes});
        }
        break;
    }
  }

  /**
   * Normalizes the given tribe selection.
   *
   * @private
   * @param {ReadonlySet<string>} tribes tribe IDs to normalize.
   * @returns {{kind: 'empty'} | {kind: 'any'} | {kind: 'tribes'; tribes: string[]}} normalized tribe selection.
   */
  private normalizeTribeSelection(tribes: ReadonlySet<string>): {kind: 'empty'} | {kind: 'any'} | {kind: 'tribes'; tribes: string[]} {
    switch (true) {
      case tribes.size === 0:
        return {kind: 'empty'};
      case tribes.has(ANY_TRIBE_ID) || (this.allTribeIds.size > 0 && this.allTribeIds.isSubsetOf(tribes)):
        return {kind: 'any'};
      default:
        return {kind: 'tribes', tribes: [...tribes]};
    }
  }

  /**
   * Appends the given text to the summary parts.
   *
   * @private
   * @param {SummaryPart[]} parts summary parts to append to.
   * @param {string} text text to append.
   */
  private appendSummaryText(parts: SummaryPart[], text: string): void {
    if (text) {
      const last = parts.at(-1);
      if (last?.kind === 'text') {
        last.text += text;
      } else {
        parts.push({kind: 'text', text});
      }
    }
  }
}
