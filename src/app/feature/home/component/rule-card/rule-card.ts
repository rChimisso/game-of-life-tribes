/* eslint-disable jsdoc/require-jsdoc */
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';

import {Button} from '../../../../shared/component/button/button';
import {ChangeClauseKindEvent, ClausePathEvent, SetClauseIntervalEvent, ToggleClauseEqTribeEvent, ToggleClauseTribeEvent} from '../../model/clause-event';
import {EditableTribe, Rule, Tribe} from '../../model/rule';
import {RuleClause} from '../clause/clause';

@Component({
  selector: 'gol-rule-card',
  standalone: true,
  imports: [
    FormsModule,
    RuleClause,
    Button,
    MatIconModule
  ],
  templateUrl: './rule-card.html',
  styleUrl: './rule-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RuleCard {
  @Input({required: true})
  public rule!: Rule<Tribe[]>;

  @Input({required: true})
  public ruleIndex!: number;

  @Input({required: true})
  public editTribes: EditableTribe[] = [];

  @Input()
  public expanded = false;

  @Input()
  public summary = '';

  @Input()
  public summaryTribes: string[] = [];

  @Input()
  public summaryTribeColors: Record<string, string> = {};

  @Input()
  public outputColor = '888888';

  @Input()
  public outputContrast = '#fff';

  @Output()
  public readonly toggleExpand = new EventEmitter<number>();

  @Output()
  public readonly removeRule = new EventEmitter<number>();

  @Output()
  public readonly setRuleOutput = new EventEmitter<{index: number; tribeId: string}>();

  @Output()
  public readonly addChild = new EventEmitter<ClausePathEvent>();

  @Output()
  public readonly changeKind = new EventEmitter<ChangeClauseKindEvent>();

  @Output()
  public readonly removeChild = new EventEmitter<ClausePathEvent>();

  @Output()
  public readonly setInterval = new EventEmitter<SetClauseIntervalEvent>();

  @Output()
  public readonly toggleEqTribe = new EventEmitter<ToggleClauseEqTribeEvent>();

  @Output()
  public readonly toggleTribe = new EventEmitter<ToggleClauseTribeEvent>();

  public tribeColor(tribeId: string): string {
    return this.summaryTribeColors[tribeId] ?? '888888';
  }

  public onSetRuleOutput(tribeId: string): void {
    this.setRuleOutput.emit({
      index: this.ruleIndex,
      tribeId
    });
  }

  public onRemove(event: Event): void {
    event.stopPropagation();
    this.removeRule.emit(this.ruleIndex);
  }
}
