/* eslint-disable jsdoc/require-jsdoc */
import {DragDropModule} from '@angular/cdk/drag-drop';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';

import {Button} from '../../../../shared/component/button/button';
import {TribeSwatch} from '../../../../shared/component/tribe-swatch/tribe-swatch';
import {Clause, EditableTribe, Rule, Tribe} from '../../model/rule';
import {buildClauseSummaryParts, RuleSummaryPart} from '../../util/clause-summary';
import {ClauseChangeEvent, ClauseStateChangeEvent, RuleClause} from '../clause/clause';

interface RuleStateChangeEvent {
  index: number;
  dirty: boolean;
  invalid: boolean;
}

interface RuleChangeEvent extends RuleStateChangeEvent {
  rule: Rule<Tribe[]>;
}

type RuleDisplaySummaryPart =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'tribes';
      tribes: string[];
    };

@Component({
  selector: 'gol-rule-card',
  standalone: true,
  imports: [
    FormsModule,
    DragDropModule,
    RuleClause,
    Button,
    TribeSwatch,
    MatIconModule
  ],
  templateUrl: './rule-card.html',
  styleUrl: './rule-card.scss',
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RuleCard implements OnChanges {
  @Input({required: true})
  public rule!: Rule<Tribe[]>;

  @Input()
  public baselineRule: Rule<Tribe[]> | null = null;

  @Input({required: true})
  public ruleIndex!: number;

  @Input({required: true})
  public editTribes: EditableTribe[] = [];

  @Input()
  public expanded = false;

  @Output()
  public readonly toggleExpand = new EventEmitter<number>();

  @Output()
  public readonly removeRule = new EventEmitter<number>();

  @Output()
  public readonly duplicateRule = new EventEmitter<number>();

  @Output()
  public readonly ruleChange = new EventEmitter<RuleChangeEvent>();

  @Output()
  public readonly ruleStateChange = new EventEmitter<RuleStateChangeEvent>();

  @Output()
  public readonly dragHandlePointerDown = new EventEmitter<void>();

  private clauseInvalid = false;

  public get summaryParts(): RuleSummaryPart[] {
    return buildClauseSummaryParts(this.rule.clause);
  }

  public get isDirty(): boolean {
    if (!this.baselineRule) {
      return true;
    }

    return !this.rulesEqual(this.rule, this.baselineRule);
  }

  public get isInvalid(): boolean {
    return this.clauseInvalid;
  }

  public get displaySummaryParts(): RuleDisplaySummaryPart[] {
    const parts: RuleDisplaySummaryPart[] = [];

    this.summaryParts.forEach(part => {
      if (part.kind === 'text') {
        const text = part.text ?? '';
        if (!text) {
          return;
        }

        const lastPart = parts.at(-1);
        if (lastPart?.kind === 'text') {
          lastPart.text += text;
          return;
        }

        parts.push({
          kind: 'text',
          text
        });
        return;
      }

      if (!part.tribeId) {
        return;
      }

      const lastPart = parts.at(-1);
      if (lastPart?.kind === 'tribes') {
        lastPart.tribes.push(part.tribeId);
        return;
      }

      parts.push({
        kind: 'tribes',
        tribes: [part.tribeId]
      });
    });

    return parts;
  }

  public get summaryTooltip(): string {
    return this.displaySummaryParts.map(part => part.kind === 'text' ? part.text : part.tribes.join('/')).reduce((acc, curr) => acc + curr, '');
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['rule'] || changes['baselineRule']) {
      this.emitRuleState();
    }
  }

  public tribeColor(tribeId: string): string {
    return this.editTribes.find(tribe => tribe.id === tribeId)?.color ?? '888888';
  }

  public outputTribeColor(): string {
    return this.editTribes.find(tribe => tribe.id === this.rule.tribe)?.color ?? '888888';
  }

  public summaryOverflowLabel(tribeIds: string[]): string {
    return `${tribeIds.join(', ')}`;
  }

  public onSetRuleOutput(tribeId: string): void {
    this.updateRule(rule => {
      rule.tribe = tribeId;
    });
  }

  public onClauseChanged(event: ClauseChangeEvent): void {
    this.clauseInvalid = event.invalid;
    this.updateRule(rule => {
      rule.clause = event.clause;
    });
  }

  public onClauseStateChanged(event: ClauseStateChangeEvent): void {
    this.clauseInvalid = event.invalid;
    this.emitRuleState();
  }

  public onRemove(event: Event): void {
    event.stopPropagation();
    this.removeRule.emit(this.ruleIndex);
  }

  public onDuplicate(event: Event): void {
    event.stopPropagation();
    this.duplicateRule.emit(this.ruleIndex);
  }

  public onToggleMute(event: Event): void {
    event.stopPropagation();
    this.updateRule(rule => {
      rule.muted = !rule.muted;
    });
  }

  public onDragHandlePointerDown(event: PointerEvent): void {
    event.stopPropagation();
    this.dragHandlePointerDown.emit();
  }

  private updateRule(mutator: (rule: Rule<Tribe[]>) => void): void {
    const nextRule = structuredClone(this.rule);
    mutator(nextRule);
    this.rule = nextRule;
    this.emitRuleChange();
  }

  private emitRuleChange(): void {
    const dirty = this.isDirty;
    const invalid = this.isInvalid;
    this.ruleChange.emit({
      index: this.ruleIndex,
      rule: this.rule,
      dirty,
      invalid
    });
    this.ruleStateChange.emit({
      index: this.ruleIndex,
      dirty,
      invalid
    });
  }

  private emitRuleState(): void {
    this.ruleStateChange.emit({
      index: this.ruleIndex,
      dirty: this.isDirty,
      invalid: this.isInvalid
    });
  }

  private createEmptyClause(): Clause<Tribe[]> {
    return {
      kind: 'empty'
    };
  }

  private rulesEqual(editableRule: Rule<Tribe[]>, baseRule: Rule<Tribe[]>): boolean {
    return JSON.stringify(this.toPersistedRule(editableRule)) === JSON.stringify(this.toPersistedRule(baseRule));
  }

  private toPersistedRule(rule: Rule<Tribe[]>): Rule<Tribe[]> {
    const persistedRule = structuredClone(rule);
    persistedRule.clause = this.normalizeClauseForEditor(persistedRule.clause);
    delete persistedRule.key;
    persistedRule.muted = !!persistedRule.muted;
    return persistedRule;
  }

  private normalizeClauseForEditor(clause: Clause<Tribe[]>): Clause<Tribe[]> {
    switch (clause.kind) {
      case 'empty':
        return this.createEmptyClause();
      case 'equality':
        return {
          ...clause,
          kind: 'comparison',
          margin: clause.margin ?? 0
        };
      case 'comparison':
        return {
          ...clause,
          margin: clause.margin ?? 0
        };
      case 'not':
        return {
          ...clause,
          clause: this.normalizeClauseForEditor(clause.clause)
        };
      case 'and':
      case 'or':
      case 'xor': {
        const normalizedClauses = clause.clauses.map(sub => this.normalizeClauseForEditor(sub));
        while (normalizedClauses.length < 2) {
          normalizedClauses.push(this.createEmptyClause());
        }

        return {
          ...clause,
          clauses: normalizedClauses as [Clause<Tribe[]>, Clause<Tribe[]>, ...Clause<Tribe[]>[]]
        };
      }
      default:
        return clause;
    }
  }
}

export type {RuleChangeEvent, RuleStateChangeEvent};
