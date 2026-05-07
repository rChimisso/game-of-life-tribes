/* eslint-disable jsdoc/require-jsdoc */
import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

import {CheckboxComponent} from '../../../../shared/component/checkbox/checkbox';
import {TribeSwatch} from '../../../../shared/component/tribe-swatch/tribe-swatch';
import {Clause, EditableTribe, NeighborCount, Tribe} from '../../model/rule';
import {buildClauseSummaryParts, RuleSummaryPart} from '../../util/clause-summary';

interface ClauseStateChangeEvent {
  dirty: boolean;
  invalid: boolean;
}

interface ClauseChangeEvent extends ClauseStateChangeEvent {
  clause: Clause<Tribe[]>;
}

@Component({
  selector: 'gol-rule-clause',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    MatButtonModule,
    MatIconModule,
    CheckboxComponent,
    TribeSwatch
  ],
  templateUrl: './clause.html',
  styleUrl: './clause.scss',
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RuleClause implements OnChanges {
  @Input({required: true})
  public clause!: Clause<Tribe[]>;

  @Input()
  public baselineClause: Clause<Tribe[]> | null = null;

  @Input({required: true})
  public editTribes!: EditableTribe[];

  @Input()
  public depth = 0;

  @Input()
  public path: number[] = [];

  @Output()
  public readonly clauseChange = new EventEmitter<ClauseChangeEvent>();

  @Output()
  public readonly clauseStateChange = new EventEmitter<ClauseStateChangeEvent>();

  public collapsedGroupKeys = new Set<string>();

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['clause'] || changes['baselineClause']) {
      this.emitClauseState();
    }
  }

  public emitChangeKind(path: number[], newKind: string): void {
    const dt = this.defaultTribeId();
    let nextClause: Clause<Tribe[]> | null = null;
    switch (newKind) {
      case 'empty':
        nextClause = this.createEmptyClause();
        break;
      case 'is':
        nextClause = {
          kind: 'is',
          tribes: [dt]
        };
        break;
      case 'count':
        nextClause = {
          kind: 'count',
          tribes: [dt],
          interval: [0, 8]
        };
        break;
      case 'none':
        nextClause = {
          kind: 'none',
          tribes: [dt]
        };
        break;
      case 'exactly':
        nextClause = {
          kind: 'exactly',
          tribes: [dt],
          value: 1
        };
        break;
      case 'atLeast':
        nextClause = {
          kind: 'atLeast',
          tribes: [dt],
          value: 1
        };
        break;
      case 'atMost':
        nextClause = {
          kind: 'atMost',
          tribes: [dt],
          value: 1
        };
        break;
      case 'comparison':
      case 'equality':
        nextClause = {
          kind: 'comparison',
          tribe1: [dt],
          tribe2: [dt],
          operator: '=',
          margin: 0
        };
        break;
      case 'not':
        nextClause = {
          kind: 'not',
          clause: this.createEmptyClause()
        };
        break;
      case 'and':
        nextClause = {
          kind: 'and',
          clauses: [this.createEmptyClause(), this.createEmptyClause()]
        };
        break;
      case 'or':
        nextClause = {
          kind: 'or',
          clauses: [this.createEmptyClause(), this.createEmptyClause()]
        };
        break;
      case 'xor':
        nextClause = {
          kind: 'xor',
          clauses: [this.createEmptyClause(), this.createEmptyClause()]
        };
        break;
      default:
        nextClause = null;
        break;
    }

    if (nextClause !== null) {
      this.updateClause(clauseRoot => this.setClauseAtPath(clauseRoot, path, nextClause));
    }
  }

  public emitRemoveChild(path: number[]): void {
    this.updateClause(clauseRoot => {
      let updatedRoot = clauseRoot;
      if (path.length === 0) {
        updatedRoot = this.createEmptyClause();
      } else {
        const parentPath = path.slice(0, -1);
        const childIdx = path[path.length - 1]!;
        const parent = this.getClauseAtPath(clauseRoot, parentPath);
        if (parent.kind === 'and' || parent.kind === 'or' || parent.kind === 'xor') {
          if (parent.clauses.length > 2) {
            (parent.clauses as Clause<Tribe[]>[]).splice(childIdx, 1);
          } else {
            (parent.clauses as Clause<Tribe[]>[])[childIdx] = this.createEmptyClause();
          }
        } else if (parent.kind === 'not') {
          parent.clause = this.createEmptyClause();
        }
      }

      return updatedRoot;
    });
  }

  public emitToggleTribe(path: number[], tribeId: string): void {
    this.updateClause(clauseRoot => {
      const clause = this.getClauseAtPath(clauseRoot, path);
      if (clause.kind === 'is' || clause.kind === 'count' || clause.kind === 'none' || clause.kind === 'exactly' || clause.kind === 'atLeast' || clause.kind === 'atMost') {
        const idx = clause.tribes.indexOf(tribeId);
        if (idx >= 0) {
          if (clause.tribes.length > 1) {
            clause.tribes.splice(idx, 1);
          }
        } else {
          clause.tribes.push(tribeId);
        }
      }

      return clauseRoot;
    });
  }

  public emitToggleEqTribe(path: number[], group: 1 | 2, tribeId: string): void {
    this.updateClause(clauseRoot => {
      const clause = this.getClauseAtPath(clauseRoot, path);
      if (clause.kind === 'comparison' || clause.kind === 'equality') {
        const target = group === 1 ? clause.tribe1 : clause.tribe2;
        const idx = target.indexOf(tribeId);
        if (idx >= 0) {
          if (target.length > 1) {
            target.splice(idx, 1);
          }
        } else {
          target.push(tribeId);
        }
      }

      return clauseRoot;
    });
  }

  public emitSetInterval(path: number[], which: 0 | 1, value: string): void {
    this.updateClause(clauseRoot => {
      const clause = this.getClauseAtPath(clauseRoot, path);
      const nextValue = Math.max(0, Math.min(8, parseInt(value, 10) || 0)) as NeighborCount;
      if (clause.kind === 'count') {
        clause.interval[which] = nextValue;
      } else if (clause.kind === 'exactly' || clause.kind === 'atLeast' || clause.kind === 'atMost') {
        clause.value = nextValue;
      }

      return clauseRoot;
    });
  }

  public emitSetOperator(path: number[], operator: '=' | '!=' | '>' | '<' | '>=' | '<='): void {
    this.updateClause(clauseRoot => {
      const clause = this.getClauseAtPath(clauseRoot, path);
      if (clause.kind === 'comparison' || clause.kind === 'equality') {
        clause.operator = operator;
      }

      return clauseRoot;
    });
  }

  public emitSetMargin(path: number[], value: string): void {
    this.updateClause(clauseRoot => {
      const clause = this.getClauseAtPath(clauseRoot, path);
      if (clause.kind === 'comparison' || clause.kind === 'equality') {
        const parsed = +value;
        clause.margin = Math.max(-8, Math.min(8, Number.isNaN(parsed) ? 0 : parsed));
      }

      return clauseRoot;
    });
  }

  public emitAddChild(path: number[]): void {
    this.updateClause(clauseRoot => {
      const clause = this.getClauseAtPath(clauseRoot, path);
      if (clause.kind === 'and' || clause.kind === 'or' || clause.kind === 'xor') {
        (clause.clauses as Clause<Tribe[]>[]).push(this.createEmptyClause());
      }

      return clauseRoot;
    });
  }

  public childPath(path: number[], index: number): number[] {
    return path.concat(index);
  }

  public childNotPath(path: number[]): number[] {
    return path.concat(0);
  }

  public toggleGroupCollapse(path: number[], event: Event): void {
    event.stopPropagation();
    const key = this.groupKey(path);
    if (this.collapsedGroupKeys.has(key)) {
      this.collapsedGroupKeys.delete(key);
    } else {
      this.collapsedGroupKeys.add(key);
    }
  }

  public isGroupCollapsed(path: number[]): boolean {
    return this.collapsedGroupKeys.has(this.groupKey(path));
  }

  public clauseSummaryParts(clause: Clause<Tribe[]>): RuleSummaryPart[] {
    return buildClauseSummaryParts(clause);
  }

  public summaryTribeColor(tribeId: string): string {
    return this.editTribes.find(t => t.id === tribeId)?.color ?? '888888';
  }

  public tribeSelectionState(tribes: string[]): boolean {
    const allIds = this.selectableTribeIds();
    let allSelected = false;
    if (allIds.length > 0) {
      const selectedCount = allIds.filter(id => tribes.includes(id)).length;
      allSelected = selectedCount === allIds.length;
    }

    return allSelected;
  }

  public onToggleAllClauseTribes(path: number[], tribes: string[], next: boolean): void {
    const allIds = this.selectableTribeIds();
    if (allIds.length > 0) {
      const selected = allIds.filter(id => tribes.includes(id));
      let idsToToggle: string[] = [];
      if (next === true) {
        idsToToggle = allIds.filter(id => !tribes.includes(id));
      } else {
        const keep = selected[0] ?? allIds[0]!;
        idsToToggle = selected.filter(id => id !== keep);
      }

      for (const id of idsToToggle) {
        this.emitToggleTribe(path, id);
      }
    }
  }

  public onToggleAllEqTribes(path: number[], group: 1 | 2, tribes: string[], next: boolean): void {
    const allIds = this.selectableTribeIds();
    if (allIds.length > 0) {
      const selected = allIds.filter(id => tribes.includes(id));
      let idsToToggle: string[] = [];
      if (next === true) {
        idsToToggle = allIds.filter(id => !tribes.includes(id));
      } else {
        const keep = selected[0] ?? allIds[0]!;
        idsToToggle = selected.filter(id => id !== keep);
      }

      for (const id of idsToToggle) {
        this.emitToggleEqTribe(path, group, id);
      }
    }
  }

  private groupKey(path: number[]): string {
    return path.join('.');
  }

  private selectableTribeIds(): string[] {
    return this.editTribes.map(t => t.id);
  }

  private updateClause(mutator: (clauseRoot: Clause<Tribe[]>) => Clause<Tribe[]> | undefined): void {
    const nextClause = structuredClone(this.clause);
    const updatedClause = mutator(nextClause);
    if (updatedClause) {
      this.clause = updatedClause;
    } else {
      this.clause = nextClause;
    }
    this.emitClauseChange();
  }

  private emitClauseChange(): void {
    const dirty = this.isDirty();
    const invalid = this.isInvalid();
    this.clauseChange.emit({
      clause: this.clause,
      dirty,
      invalid
    });
    this.clauseStateChange.emit({
      dirty,
      invalid
    });
  }

  private emitClauseState(): void {
    this.clauseStateChange.emit({
      dirty: this.isDirty(),
      invalid: this.isInvalid()
    });
  }

  private isDirty(): boolean {
    if (this.baselineClause) {
      return !this.clausesEqual(this.clause, this.baselineClause);
    }

    return true;
  }

  private isInvalid(): boolean {
    return this.containsEmptyClause(this.clause);
  }

  private createEmptyClause(): Clause<Tribe[]> {
    return {
      kind: 'empty'
    };
  }

  private defaultTribeId(): string {
    return this.editTribes.find(tribe => tribe.id !== 'dead')?.id ?? 'dead';
  }

  private containsEmptyClause(clause: Clause<Tribe[]>): boolean {
    switch (clause.kind) {
      case 'empty':
        return true;
      case 'not':
        return this.containsEmptyClause(clause.clause);
      case 'and':
      case 'or':
      case 'xor':
        return clause.clauses.some(child => this.containsEmptyClause(child));
      default:
        return false;
    }
  }

  private getClauseAtPath(root: Clause<Tribe[]>, path: number[]): Clause<Tribe[]> {
    let current: Clause<Tribe[]> = root;
    for (const idx of path) {
      if (current.kind === 'and' || current.kind === 'or' || current.kind === 'xor') {
        current = current.clauses[idx]!;
      } else if (current.kind === 'not') {
        current = current.clause;
      }
    }
    return current;
  }

  private setClauseAtPath(root: Clause<Tribe[]>, path: number[], nextClause: Clause<Tribe[]>): Clause<Tribe[]> {
    if (path.length === 0) {
      return nextClause;
    }

    const parent = this.getClauseAtPath(root, path.slice(0, -1));
    const lastIdx = path[path.length - 1]!;
    if (parent.kind === 'and' || parent.kind === 'or' || parent.kind === 'xor') {
      (parent.clauses as Clause<Tribe[]>[])[lastIdx] = nextClause;
    } else if (parent.kind === 'not') {
      parent.clause = nextClause;
    }

    return root;
  }

  private clausesEqual(editableClause: Clause<Tribe[]>, baseClause: Clause<Tribe[]>): boolean {
    return JSON.stringify(this.normalizeClauseForEditor(editableClause)) === JSON.stringify(this.normalizeClauseForEditor(baseClause));
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

export type {ClauseChangeEvent, ClauseStateChangeEvent};
