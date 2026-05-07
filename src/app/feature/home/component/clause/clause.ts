/* eslint-disable jsdoc/require-jsdoc */
import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

import {CheckboxComponent} from '../../../../shared/component/checkbox/checkbox';
import {SelectOption} from '../../../../shared/component/select/model/select';
import {SelectComponent} from '../../../../shared/component/select/select';
import {TribeSwatch} from '../../../../shared/component/tribe-swatch/tribe-swatch';
import {AND_CLAUSE_KIND, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, EditableTribe, EMPTY_CLAUSE, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NeighborCount, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Tribe, XOR_CLAUSE_KIND} from '../../model/rule';
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
    SelectComponent,
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

  public readonly clauseKindOptions: readonly SelectOption[] = [
    {
      value: EMPTY_CLAUSE_KIND,
      label: 'EMPTY',
      disabled: true,
      hidden: true
    },
    {
      value: IS_CLAUSE_KIND,
      label: 'IS'
    },
    {
      value: COUNT_CLAUSE_KIND,
      label: 'COUNT'
    },
    {
      value: NONE_CLAUSE_KIND,
      label: 'NONE'
    },
    {
      value: EXACTLY_CLAUSE_KIND,
      label: 'EXACTLY'
    },
    {
      value: MIN_CLAUSE_KIND,
      label: 'MIN'
    },
    {
      value: MAX_CLAUSE_KIND,
      label: 'MAX'
    },
    {
      value: COMPARISON_CLAUSE_KIND,
      label: 'COMP'
    },
    {
      value: NOT_CLAUSE_KIND,
      label: 'NOT'
    },
    {
      value: AND_CLAUSE_KIND,
      label: 'AND'
    },
    {
      value: OR_CLAUSE_KIND,
      label: 'OR'
    },
    {
      value: XOR_CLAUSE_KIND,
      label: 'XOR'
    }
  ];

  public readonly comparisonOperatorOptions: readonly SelectOption[] = [
    {
      value: '=',
      label: '='
    },
    {
      value: '!=',
      label: '!='
    },
    {
      value: '>',
      label: '>'
    },
    {
      value: '<',
      label: '<'
    },
    {
      value: '>=',
      label: '>='
    },
    {
      value: '<=',
      label: '<='
    }
  ];

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['clause'] || changes['baselineClause']) {
      this.emitClauseState();
    }
  }

  public emitChangeKind(path: number[], newKind: string): void {
    const dt = this.defaultTribeId();
    let nextClause: Clause<Tribe[]> | null = null;
    switch (newKind) {
      case EMPTY_CLAUSE_KIND:
        nextClause = EMPTY_CLAUSE;
        break;
      case IS_CLAUSE_KIND:
        nextClause = {
          kind: IS_CLAUSE_KIND,
          tribes: [dt]
        };
        break;
      case COUNT_CLAUSE_KIND:
        nextClause = {
          kind: COUNT_CLAUSE_KIND,
          tribes: [dt],
          interval: [0, 8]
        };
        break;
      case NONE_CLAUSE_KIND:
        nextClause = {
          kind: NONE_CLAUSE_KIND,
          tribes: [dt]
        };
        break;
      case EXACTLY_CLAUSE_KIND:
        nextClause = {
          kind: EXACTLY_CLAUSE_KIND,
          tribes: [dt],
          value: 1
        };
        break;
      case MIN_CLAUSE_KIND:
        nextClause = {
          kind: MIN_CLAUSE_KIND,
          tribes: [dt],
          value: 1
        };
        break;
      case MAX_CLAUSE_KIND:
        nextClause = {
          kind: MAX_CLAUSE_KIND,
          tribes: [dt],
          value: 1
        };
        break;
      case COMPARISON_CLAUSE_KIND:
        nextClause = {
          kind: COMPARISON_CLAUSE_KIND,
          tribe1: [dt],
          tribe2: [dt],
          operator: '=',
          margin: 0
        };
        break;
      case NOT_CLAUSE_KIND:
        nextClause = {
          kind: NOT_CLAUSE_KIND,
          clause: EMPTY_CLAUSE
        };
        break;
      case AND_CLAUSE_KIND:
        nextClause = {
          kind: AND_CLAUSE_KIND,
          clauses: [EMPTY_CLAUSE, EMPTY_CLAUSE]
        };
        break;
      case OR_CLAUSE_KIND:
        nextClause = {
          kind: OR_CLAUSE_KIND,
          clauses: [EMPTY_CLAUSE, EMPTY_CLAUSE]
        };
        break;
      case XOR_CLAUSE_KIND:
        nextClause = {
          kind: XOR_CLAUSE_KIND,
          clauses: [EMPTY_CLAUSE, EMPTY_CLAUSE]
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
        updatedRoot = EMPTY_CLAUSE;
      } else {
        const parentPath = path.slice(0, -1);
        const childIdx = path[path.length - 1]!;
        const parent = this.getClauseAtPath(clauseRoot, parentPath);
        if (parent.kind === AND_CLAUSE_KIND || parent.kind === OR_CLAUSE_KIND || parent.kind === XOR_CLAUSE_KIND) {
          if (parent.clauses.length > 2) {
            (parent.clauses as Clause<Tribe[]>[]).splice(childIdx, 1);
          } else {
            (parent.clauses as Clause<Tribe[]>[])[childIdx] = EMPTY_CLAUSE;
          }
        } else if (parent.kind === NOT_CLAUSE_KIND) {
          parent.clause = EMPTY_CLAUSE;
        }
      }

      return updatedRoot;
    });
  }

  public emitToggleTribe(path: number[], tribeId: string): void {
    this.updateClause(clauseRoot => {
      const clause = this.getClauseAtPath(clauseRoot, path);
      if (clause.kind === IS_CLAUSE_KIND || clause.kind === COUNT_CLAUSE_KIND || clause.kind === NONE_CLAUSE_KIND || clause.kind === EXACTLY_CLAUSE_KIND || clause.kind === MIN_CLAUSE_KIND || clause.kind === MAX_CLAUSE_KIND) {
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
      if (clause.kind === COMPARISON_CLAUSE_KIND) {
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
      if (clause.kind === COUNT_CLAUSE_KIND) {
        clause.interval[which] = nextValue;
      } else if (clause.kind === EXACTLY_CLAUSE_KIND || clause.kind === MIN_CLAUSE_KIND || clause.kind === MAX_CLAUSE_KIND) {
        clause.value = nextValue;
      }

      return clauseRoot;
    });
  }

  public emitSetOperator(path: number[], operator: '=' | '!=' | '>' | '<' | '>=' | '<='): void {
    this.updateClause(clauseRoot => {
      const clause = this.getClauseAtPath(clauseRoot, path);
      if (clause.kind === COMPARISON_CLAUSE_KIND) {
        clause.operator = operator;
      }

      return clauseRoot;
    });
  }

  public emitSetMargin(path: number[], value: string): void {
    this.updateClause(clauseRoot => {
      const clause = this.getClauseAtPath(clauseRoot, path);
      if (clause.kind === COMPARISON_CLAUSE_KIND) {
        const parsed = +value;
        clause.margin = Math.max(-8, Math.min(8, Number.isNaN(parsed) ? 0 : parsed));
      }

      return clauseRoot;
    });
  }

  public emitAddChild(path: number[]): void {
    this.updateClause(clauseRoot => {
      const clause = this.getClauseAtPath(clauseRoot, path);
      if (clause.kind === AND_CLAUSE_KIND || clause.kind === OR_CLAUSE_KIND || clause.kind === XOR_CLAUSE_KIND) {
        (clause.clauses as Clause<Tribe[]>[]).push(EMPTY_CLAUSE);
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

  private defaultTribeId(): string {
    return this.editTribes.find(tribe => tribe.id !== DEAD_TRIBE_ID)?.id ?? DEAD_TRIBE_ID;
  }

  private containsEmptyClause(clause: Clause<Tribe[]>): boolean {
    switch (clause.kind) {
      case EMPTY_CLAUSE_KIND:
        return true;
      case NOT_CLAUSE_KIND:
        return this.containsEmptyClause(clause.clause);
      case AND_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
      case XOR_CLAUSE_KIND:
        return clause.clauses.some(child => this.containsEmptyClause(child));
      default:
        return false;
    }
  }

  private getClauseAtPath(root: Clause<Tribe[]>, path: number[]): Clause<Tribe[]> {
    let current: Clause<Tribe[]> = root;
    for (const idx of path) {
      if (current.kind === AND_CLAUSE_KIND || current.kind === OR_CLAUSE_KIND || current.kind === XOR_CLAUSE_KIND) {
        current = current.clauses[idx]!;
      } else if (current.kind === NOT_CLAUSE_KIND) {
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
    if (parent.kind === AND_CLAUSE_KIND || parent.kind === OR_CLAUSE_KIND || parent.kind === XOR_CLAUSE_KIND) {
      (parent.clauses as Clause<Tribe[]>[])[lastIdx] = nextClause;
    } else if (parent.kind === NOT_CLAUSE_KIND) {
      parent.clause = nextClause;
    }

    return root;
  }

  private clausesEqual(editableClause: Clause<Tribe[]>, baseClause: Clause<Tribe[]>): boolean {
    return JSON.stringify(this.normalizeClauseForEditor(editableClause)) === JSON.stringify(this.normalizeClauseForEditor(baseClause));
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

export type {ClauseChangeEvent, ClauseStateChangeEvent};
