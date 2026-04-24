/* eslint-disable jsdoc/require-jsdoc */
import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

import {ChangeClauseKindEvent, ClausePathEvent, SetClauseIntervalEvent, ToggleClauseEqTribeEvent, ToggleClauseTribeEvent} from '../../model/clause-event';
import {Clause, Tribe} from '../../model/rule';

@Component({
  selector: 'gol-rule-clause',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './clause.html',
  styleUrl: './clause.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RuleClause {
  @Input({required: true})
  public clause!: Clause<Tribe[]>;

  @Input({required: true})
  public editTribes!: Tribe[];

  @Input()
  public depth = 0;

  @Input()
  public path: number[] = [];

  @Input({required: true})
  public ruleIndex!: number;

  @Output()
  public readonly changeKind = new EventEmitter<ChangeClauseKindEvent>();

  @Output()
  public readonly removeChild = new EventEmitter<ClausePathEvent>();

  @Output()
  public readonly toggleTribe = new EventEmitter<ToggleClauseTribeEvent>();

  @Output()
  public readonly toggleEqTribe = new EventEmitter<ToggleClauseEqTribeEvent>();

  @Output()
  public readonly setInterval = new EventEmitter<SetClauseIntervalEvent>();

  @Output()
  public readonly addChild = new EventEmitter<ClausePathEvent>();

  public emitChangeKind(ruleIndex: number, path: number[], newKind: string): void {
    this.changeKind.emit({
      ruleIndex,
      path,
      newKind
    });
  }

  public emitRemoveChild(ruleIndex: number, path: number[]): void {
    this.removeChild.emit({
      ruleIndex,
      path
    });
  }

  public emitToggleTribe(ruleIndex: number, path: number[], tribeId: string): void {
    this.toggleTribe.emit({
      ruleIndex,
      path,
      tribeId
    });
  }

  public emitToggleEqTribe(ruleIndex: number, path: number[], group: 1 | 2, tribeId: string): void {
    this.toggleEqTribe.emit({
      ruleIndex,
      path,
      group,
      tribeId
    });
  }

  public emitSetInterval(ruleIndex: number, path: number[], which: 0 | 1, value: string): void {
    this.setInterval.emit({
      ruleIndex,
      path,
      which,
      value
    });
  }

  public emitAddChild(ruleIndex: number, path: number[]): void {
    this.addChild.emit({
      ruleIndex,
      path
    });
  }

  public childPath(path: number[], index: number): number[] {
    return path.concat(index);
  }

  public childNotPath(path: number[]): number[] {
    return path.concat(0);
  }
}
