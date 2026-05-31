import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

import {CheckboxComponent} from '../../../../../shared/component/checkbox/checkbox';
import {SelectOption} from '../../../../../shared/component/select/model/select';
import {SelectComponent} from '../../../../../shared/component/select/select';
import {SummaryComponent} from '../../../../../shared/component/summary/summary';
import {TribeSwatch} from '../../../../../shared/component/tribe-swatch/tribe-swatch';
import {AND_CLAUSE_KIND, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, EMPTY_CLAUSE, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NeighborCount, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, Operator, OR_CLAUSE_KIND, Tribe, XOR_CLAUSE_KIND} from '../../../model/rule';
import {clausesEqual} from '../../../util/rule-editor';
import {ClauseChangeEvent, ClauseStateChangeEvent} from '../model/clause-event';

import {TypedChanges} from '~gol/core/model/typed-change';
import {Button} from '~gol/shared/component/button/button';
import {isBinaryLogicalClause} from '~gol/shared/component/summary/util/clause';
import {CharFilterDirective} from '~gol/shared/directive/char-filter';

/**
 * Rule clause editor.
 *
 * @export
 * @class RuleClause
 * @typedef {RuleClause}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-rule-clause',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    MatButtonModule,
    MatIconModule,
    CharFilterDirective,
    CheckboxComponent,
    SelectComponent,
    SummaryComponent,
    TribeSwatch,
    Button
  ],
  templateUrl: './clause.html',
  styleUrl: './clause.scss',
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RuleClause implements OnChanges {
  /**
   * Editable clause.
   *
   * @public
   * @type {!Clause<Tribe[]>}
   */
  @Input({required: true})
  public clause!: Clause<Tribe[]>;

  /**
   * Baseline clause used for dirty-state checks.
   *
   * @public
   * @type {Clause<Tribe[]> | null}
   */
  @Input()
  public baselineClause: Clause<Tribe[]> | null = null;

  /**
   * Available tribes for selection.
   *
   * @public
   * @type {!Tribe[]}
   */
  @Input({required: true})
  public tribes!: Tribe[];

  /**
   * Current nesting depth.
   *
   * @public
   * @type {number}
   */
  @Input()
  public depth = 0;

  /**
   * Path to this clause in the tree.
   *
   * @public
   * @type {number[]}
   */
  @Input()
  public path: number[] = [];

  /**
   * Whether mutating controls are disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public disabled = false;

  /**
   * Emits clause edits with derived state.
   *
   * @public
   * @readonly
   * @type {EventEmitter<ClauseChangeEvent>}
   */
  @Output()
  public readonly clauseChange = new EventEmitter<ClauseChangeEvent>();

  /**
   * Emits dirty and invalid state changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<ClauseStateChangeEvent>}
   */
  @Output()
  public readonly clauseStateChange = new EventEmitter<ClauseStateChangeEvent>();

  /**
   * Collapsed logical group keys.
   *
   * @public
   * @type {Set<string>}
   */
  public collapsedGroupKeys = new Set<string>();

  /**
   * Selectable clause kinds.
   *
   * @public
   * @readonly
   * @type {SelectOption[]}
   */
  public readonly clauseKindOptions: SelectOption[] = [
    {
      value: EMPTY_CLAUSE_KIND,
      label: 'EMPTY',
      disabled: true,
      hidden: true
    },
    {value: IS_CLAUSE_KIND, label: 'IS'},
    {value: COUNT_CLAUSE_KIND, label: 'COUNT'},
    {value: NONE_CLAUSE_KIND, label: 'NONE'},
    {value: EXACTLY_CLAUSE_KIND, label: 'EXACTLY'},
    {value: MIN_CLAUSE_KIND, label: 'MIN'},
    {value: MAX_CLAUSE_KIND, label: 'MAX'},
    {value: COMPARISON_CLAUSE_KIND, label: 'COMP'},
    {value: NOT_CLAUSE_KIND, label: 'NOT'},
    {value: AND_CLAUSE_KIND, label: 'AND'},
    {value: OR_CLAUSE_KIND, label: 'OR'},
    {value: XOR_CLAUSE_KIND, label: 'XOR'}
  ];

  /**
   * Selectable comparison operators.
   *
   * @public
   * @readonly
   * @type {SelectOption[]}
   */
  public readonly comparisonOperatorOptions: SelectOption[] = [
    {value: '=', label: '='},
    {value: '≠', label: '≠'},
    {value: '>', label: '>'},
    {value: '<', label: '<'},
    {value: '≥', label: '≥'},
    {value: '≤', label: '≤'}
  ];

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<RuleClause>): void {
    if (changes.clause || changes.baselineClause) {
      this.emitClauseState();
    }
  }

  /**
   * Replaces the clause at the given path with a new kind.
   *
   * @public
   * @param {number[]} path path to the clause to replace.
   * @param {string} newKind next clause kind.
   */
  public emitChangeKind(path: number[], newKind: string): void {
    if (!this.disabled) {
      let nextClause: Clause<Tribe[]> | null = null;
      switch (newKind) {
        case EMPTY_CLAUSE_KIND:
          nextClause = EMPTY_CLAUSE;
          break;
        case IS_CLAUSE_KIND:
        case NONE_CLAUSE_KIND:
          nextClause = {
            kind: newKind,
            tribes: [DEAD_TRIBE_ID]
          };
          break;
        case EXACTLY_CLAUSE_KIND:
        case MIN_CLAUSE_KIND:
        case MAX_CLAUSE_KIND:
          nextClause = {
            kind: newKind,
            tribes: [DEAD_TRIBE_ID],
            value: 1
          };
          break;
        case COUNT_CLAUSE_KIND:
          nextClause = {
            kind: COUNT_CLAUSE_KIND,
            tribes: [DEAD_TRIBE_ID],
            interval: [0, 8]
          };
          break;
        case COMPARISON_CLAUSE_KIND:
          nextClause = {
            kind: COMPARISON_CLAUSE_KIND,
            tribe1: [DEAD_TRIBE_ID],
            tribe2: [DEAD_TRIBE_ID],
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
        case OR_CLAUSE_KIND:
        case XOR_CLAUSE_KIND:
          nextClause = {
            kind: newKind,
            clauses: [EMPTY_CLAUSE, EMPTY_CLAUSE]
          };
          break;
        default:
          nextClause = null;
          break;
      }
      if (nextClause) {
        this.updateClause(clauseRoot => this.setClauseAtPath(clauseRoot, path, nextClause));
      }
    }
  }

  /**
   * Removes the child clause at the given path.
   *
   * @public
   * @param {number[]} path path to the child clause to remove.
   */
  public emitRemoveChild(path: number[]): void {
    if (!this.disabled) {
      this.updateClause(clauseRoot => {
        let updatedRoot = clauseRoot;
        if (path.length === 0) {
          updatedRoot = EMPTY_CLAUSE;
        } else {
          const parentPath = path.slice(0, -1);
          const childIdx = path[path.length - 1]!;
          const parent = this.getClauseAtPath(clauseRoot, parentPath);
          if (isBinaryLogicalClause(parent)) {
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
  }

  /**
   * Toggles a tribe in the selected clause.
   *
   * @public
   * @param {number[]} path path to the clause to update.
   * @param {string} tribeId tribe ID to toggle.
   */
  public emitToggleTribe(path: number[], tribeId: string): void {
    if (!this.disabled) {
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
  }

  /**
   * Toggles a tribe in one comparison group.
   *
   * @public
   * @param {number[]} path path to the comparison clause.
   * @param {1 | 2} group comparison group to update.
   * @param {string} tribeId tribe ID to toggle.
   */
  public emitToggleEqTribe(path: number[], group: 1 | 2, tribeId: string): void {
    if (!this.disabled) {
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
  }

  /**
   * Updates an interval or count value.
   *
   * @public
   * @param {number[]} path path to the clause to update.
   * @param {0 | 1} which interval index to update.
   * @param {string} value next numeric value.
   */
  public emitSetInterval(path: number[], which: 0 | 1, value: string): void {
    if (!this.disabled) {
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
  }

  /**
   * Sets the comparison operator.
   *
   * @public
   * @param {number[]} path path to the comparison clause.
   * @param {Operator} operator comparison operator.
   */
  public emitSetOperator(path: number[], operator: Operator): void {
    if (!this.disabled) {
      this.updateClause(clauseRoot => {
        const clause = this.getClauseAtPath(clauseRoot, path);
        if (clause.kind === COMPARISON_CLAUSE_KIND) {
          clause.operator = operator;
        }
        return clauseRoot;
      });
    }
  }

  /**
   * Sets the comparison margin.
   *
   * @public
   * @param {number[]} path path to the comparison clause.
   * @param {string} value next margin value.
   */
  public emitSetMargin(path: number[], value: string): void {
    if (!this.disabled) {
      this.updateClause(clauseRoot => {
        const clause = this.getClauseAtPath(clauseRoot, path);
        if (clause.kind === COMPARISON_CLAUSE_KIND) {
          const parsed = +value;
          clause.margin = Math.max(-8, Math.min(8, Number.isNaN(parsed) ? 0 : parsed));
        }
        return clauseRoot;
      });
    }
  }

  /**
   * Adds an empty child clause.
   *
   * @public
   * @param {number[]} path path to the parent clause.
   */
  public emitAddChild(path: number[]): void {
    if (!this.disabled) {
      this.updateClause(clauseRoot => {
        const clause = this.getClauseAtPath(clauseRoot, path);
        if (isBinaryLogicalClause(clause)) {
          (clause.clauses as Clause<Tribe[]>[]).push(EMPTY_CLAUSE);
        }
        return clauseRoot;
      });
    }
  }

  /**
   * Builds the path for a child clause.
   *
   * @public
   * @param {number[]} path parent clause path.
   * @param {number} index child clause index.
   * @returns {number[]} path to the child clause.
   */
  public childPath(path: number[], index: number): number[] {
    return path.concat(index);
  }

  /**
   * Builds the path for a NOT child clause.
   *
   * @public
   * @param {number[]} path parent clause path.
   * @returns {number[]} path to the NOT child clause.
   */
  public childNotPath(path: number[]): number[] {
    return path.concat(0);
  }

  /**
   * Toggles collapsed state for a logical group.
   *
   * @public
   * @param {number[]} path path to the logical group.
   */
  public toggleGroupCollapse(path: number[]): void {
    const key = this.groupKey(path);
    if (this.collapsedGroupKeys.has(key)) {
      this.collapsedGroupKeys.delete(key);
    } else {
      this.collapsedGroupKeys.add(key);
    }
  }

  /**
   * Whether a logical group is collapsed.
   *
   * @public
   * @param {number[]} path path to the logical group.
   * @returns {boolean} `true` if the group is collapsed, `false` otherwise.
   */
  public isGroupCollapsed(path: number[]): boolean {
    return this.collapsedGroupKeys.has(this.groupKey(path));
  }

  /**
   * Whether all selectable tribes are selected.
   *
   * @public
   * @param {string[]} tribes selected tribe IDs.
   * @returns {boolean} `true` if all selectable tribes are selected, `false` otherwise.
   */
  public tribeSelectionState(tribes: string[]): boolean {
    const allIds = this.selectableTribeIds();
    let allSelected = false;
    if (allIds.length > 0) {
      const selectedCount = allIds.filter(id => tribes.includes(id)).length;
      allSelected = selectedCount === allIds.length;
    }
    return allSelected;
  }

  /**
   * Toggles all tribes for a clause selection.
   *
   * @public
   * @param {number[]} path path to the clause to update.
   * @param {string[]} tribes currently selected tribe IDs.
   * @param {boolean} next next all-selected state.
   */
  public onToggleAllClauseTribes(path: number[], tribes: string[], next: boolean): void {
    if (!this.disabled) {
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
  }

  /**
   * Toggles all tribes for one comparison group.
   *
   * @public
   * @param {number[]} path path to the comparison clause.
   * @param {1 | 2} group comparison group to update.
   * @param {string[]} tribes currently selected tribe IDs.
   * @param {boolean} next next all-selected state.
   */
  public onToggleAllEqTribes(path: number[], group: 1 | 2, tribes: string[], next: boolean): void {
    if (!this.disabled) {
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
  }

  /**
   * Serializes a path into a group key.
   *
   * @private
   * @param {number[]} path clause path.
   * @returns {string} serialized group key.
   */
  private groupKey(path: number[]): string {
    return path.join('.');
  }

  /**
   * Returns all selectable tribe ids.
   *
   * @private
   * @returns {string[]} selectable tribe IDs.
   */
  private selectableTribeIds(): string[] {
    return this.tribes.map(t => t.id);
  }

  /**
   * Applies a clause mutation and emits updates.
   *
   * @private
   * @param {(clauseRoot: Clause<Tribe[]>) => Clause<Tribe[]> | undefined} mutator mutation to apply.
   */
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

  /**
   * Emits the current clause and derived state.
   *
   * @private
   */
  private emitClauseChange(): void {
    const dirty = this.isDirty();
    const invalid = this.isInvalid();
    this.clauseChange.emit({
      clause: this.clause,
      dirty,
      invalid
    });
    this.clauseStateChange.emit({dirty, invalid});
  }

  /**
   * Emits the current clause state.
   *
   * @private
   */
  private emitClauseState(): void {
    this.clauseStateChange.emit({dirty: this.isDirty(), invalid: this.isInvalid()});
  }

  /**
   * Whether the clause differs from its baseline.
   *
   * @private
   * @returns {boolean} `true` if the clause differs from its baseline, `false` otherwise.
   */
  private isDirty(): boolean {
    if (this.baselineClause) {
      return !clausesEqual(this.clause, this.baselineClause);
    }
    return true;
  }

  /**
   * Whether the clause contains empty placeholders.
   *
   * @private
   * @returns {boolean} `true` if the clause contains empty placeholders, `false` otherwise.
   */
  private isInvalid(): boolean {
    return this.containsEmptyClause(this.clause);
  }

  /**
   * Whether a clause tree contains an empty clause.
   *
   * @private
   * @param {Clause<Tribe[]>} clause clause to inspect.
   * @returns {boolean} `true` if the clause tree contains an empty clause, `false` otherwise.
   */
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

  /**
   * Looks up a clause by path.
   *
   * @private
   * @param {Clause<Tribe[]>} root clause tree root.
   * @param {number[]} path path to the target clause.
   * @returns {Clause<Tribe[]>} clause at the given path.
   */
  private getClauseAtPath(root: Clause<Tribe[]>, path: number[]): Clause<Tribe[]> {
    let current: Clause<Tribe[]> = root;
    for (const idx of path) {
      if (isBinaryLogicalClause(current)) {
        current = current.clauses[idx]!;
      } else if (current.kind === NOT_CLAUSE_KIND) {
        current = current.clause;
      }
    }
    return current;
  }

  /**
   * Replaces a clause by path.
   *
   * @private
   * @param {Clause<Tribe[]>} root clause tree root.
   * @param {number[]} path path to the clause to replace.
   * @param {Clause<Tribe[]>} nextClause replacement clause.
   * @returns {Clause<Tribe[]>} updated clause tree root.
   */
  private setClauseAtPath(root: Clause<Tribe[]>, path: number[], nextClause: Clause<Tribe[]>): Clause<Tribe[]> {
    if (path.length === 0) {
      return nextClause;
    }
    const parent = this.getClauseAtPath(root, path.slice(0, -1));
    const lastIdx = path[path.length - 1]!;
    if (isBinaryLogicalClause(parent)) {
      (parent.clauses as Clause<Tribe[]>[])[lastIdx] = nextClause;
    } else if (parent.kind === NOT_CLAUSE_KIND) {
      parent.clause = nextClause;
    }
    return root;
  }
}
