/* eslint-disable jsdoc/require-jsdoc */
import {DragDropModule} from '@angular/cdk/drag-drop';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';

import {Button} from '../../../../shared/component/button/button';
import {SelectOption} from '../../../../shared/component/select/model/select';
import {SelectComponent} from '../../../../shared/component/select/select';
import {SummaryComponent} from '../../../../shared/component/summary/summary';
import {TribeSwatch} from '../../../../shared/component/tribe-swatch/tribe-swatch';
import {AND_CLAUSE_KIND, Clause, COMPARISON_CLAUSE_KIND, EditableTribe, EMPTY_CLAUSE, EMPTY_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Rule, Tribe, XOR_CLAUSE_KIND} from '../../model/rule';
import {RuleChangeEvent, RuleStateChangeEvent} from '../../model/rule-card';
import {ClauseChangeEvent, ClauseStateChangeEvent, RuleClause} from '../clause/clause';

import {TypedChanges} from '~gol/core/model/typed-change';

@Component({
  selector: 'gol-rule-card',
  standalone: true,
  imports: [
    FormsModule,
    DragDropModule,
    RuleClause,
    Button,
    SelectComponent,
    SummaryComponent,
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

  public get isDirty(): boolean {
    if (!this.baselineRule) {
      return true;
    }

    return !this.rulesEqual(this.rule, this.baselineRule);
  }

  public get isInvalid(): boolean {
    return this.clauseInvalid;
  }

  public get tribeSelectOptions(): SelectOption[] {
    return this.editTribes.map(tribe => ({
      value: tribe.id,
      label: tribe.id,
      swatchColor: tribe.color
    }));
  }

  public ngOnChanges(changes: TypedChanges<RuleCard>): void {
    if (changes.rule || changes.baselineRule) {
      this.emitRuleState();
    }
  }

  public outputTribeColor(): string {
    return this.editTribes.find(tribe => tribe.id === this.rule.tribe)?.color ?? '888888';
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
      case EMPTY_CLAUSE_KIND:
        return EMPTY_CLAUSE;
      case COMPARISON_CLAUSE_KIND:
        return {
          ...clause,
          margin: clause.margin ?? 0
        };
      case NOT_CLAUSE_KIND:
        return {
          ...clause,
          clause: this.normalizeClauseForEditor(clause.clause)
        };
      case AND_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
      case XOR_CLAUSE_KIND: {
        const normalizedClauses = clause.clauses.map(sub => this.normalizeClauseForEditor(sub));
        while (normalizedClauses.length < 2) {
          normalizedClauses.push(EMPTY_CLAUSE);
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
