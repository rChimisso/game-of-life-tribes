import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

import {ClauseChangeEvent, ClauseStateChangeEvent} from '../model/clause-event';
import {SelectorChangeEvent} from '../model/selector-event';
import {SelectorEditor} from '../selector-editor/selector-editor';

import {TypedChanges} from '~gol/core/model/typed-change';
import {clausesEqual, normalizeCountExpression, normalizeSelector, toggleExplicitTribeSelection} from '~gol/feature/home/logic/rule-editor';
import {AND_CLAUSE_KIND, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, EMPTY_CLAUSE, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, TRIBES_SELECTOR_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NeighborCount, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, Operator, OR_CLAUSE_KIND, TIE_SELECTOR_KIND, Tribe, TribeSelector, XOR_CLAUSE_KIND} from '~gol/feature/home/model/rule';
import {Button} from '~gol/shared/component/button/button';
import {NumberInputComponent} from '~gol/shared/component/input/number-input/number-input';
import {SelectOption, SelectValue} from '~gol/shared/component/select/model/select';
import {SelectComponent} from '~gol/shared/component/select/select';
import {SummaryComponent} from '~gol/shared/component/summary/summary';
import {isBinaryLogicalClause} from '~gol/shared/component/summary/util/clause';
import {TribeSwatch} from '~gol/shared/component/tribe-swatch/tribe-swatch';

/**
 * Clause fragment that stores a count selector.
 *
 * @interface CountSelectorClause
 * @typedef {CountSelectorClause}
 */
interface CountSelectorClause {
  /**
   * Selector expression.
   *
   * @type {?TribeSelector<Tribe[]>}
   */
  selector?: TribeSelector<Tribe[]>;
  /**
   * Legacy explicit tribe list.
   *
   * @type {?[string, ...string[]]}
   */
  tribes?: [string, ...string[]];
}

/**
 * Clause numeric field.
 *
 * @typedef {ClauseNumberField}
 */
type ClauseNumberField = 'interval-0' | 'interval-1' | 'value' | 'margin';

/**
 * Active clause numeric field descriptor.
 *
 * @interface ClauseNumberDescriptor
 * @typedef {ClauseNumberDescriptor}
 */
interface ClauseNumberDescriptor {
  /**
   * Clause path.
   *
   * @type {number[]}
   */
  path: number[];
  /**
   * Number field.
   *
   * @type {ClauseNumberField}
   */
  field: ClauseNumberField;
  /**
   * Current model value.
   *
   * @type {number}
   */
  value: number;
}

/**
 * Rule clause editor.
 *
 * @class RuleClause
 * @typedef {RuleClause}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-rule-clause',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgTemplateOutlet,
    MatButtonModule,
    MatIconModule,
    SelectorEditor,
    NumberInputComponent,
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
   * Local numeric controls keyed by clause path and field.
   *
   * @private
   * @readonly
   * @type {Map<string, FormControl<number | null>>}
   */
  private readonly numberControls = new Map<string, FormControl<number | null>>();

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
    if (changes.clause) {
      this.syncNumberControlsFromClause();
    }
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
            selector: {
              kind: TRIBES_SELECTOR_KIND,
              tribes: [DEAD_TRIBE_ID]
            },
            interval: [0, 8]
          };
          break;
        case COMPARISON_CLAUSE_KIND:
          nextClause = {
            kind: COMPARISON_CLAUSE_KIND,
            left: {
              kind: 'count',
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [DEAD_TRIBE_ID]
              }
            },
            right: {
              kind: 'count',
              selector: {
                kind: TRIBES_SELECTOR_KIND,
                tribes: [DEAD_TRIBE_ID]
              }
            },
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
        if (clause.kind === IS_CLAUSE_KIND) {
          clause.tribes = toggleExplicitTribeSelection(clause.tribes, tribeId, this.defaultTribeId());
        }
        return clauseRoot;
      });
    }
  }

  /**
   * Handles clause kind select changes.
   *
   * @public
   * @param {number[]} path path to the clause to replace.
   * @param {SelectValue} value selected value.
   */
  public onClauseKindSelected(path: number[], value: SelectValue): void {
    if (typeof value === 'string') {
      this.emitChangeKind(path, value);
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
          const target = group === 1 ? clause.tribe1 ?? [DEAD_TRIBE_ID] : clause.tribe2 ?? [DEAD_TRIBE_ID];
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
   * Applies selector edits to count-style clauses and comparison groups.
   *
   * @public
   * @param {number[]} path path to the clause to update.
   * @param {'count' | 'left' | 'right'} target selector target.
   * @param {SelectorChangeEvent} event selector change event.
   */
  public onSelectorChanged(path: number[], target: 'count' | 'left' | 'right', event: SelectorChangeEvent): void {
    if (!this.disabled) {
      this.updateClause(clauseRoot => {
        const clause = this.getClauseAtPath(clauseRoot, path);
        switch (clause.kind) {
          case COUNT_CLAUSE_KIND:
          case NONE_CLAUSE_KIND:
          case EXACTLY_CLAUSE_KIND:
          case MIN_CLAUSE_KIND:
          case MAX_CLAUSE_KIND:
            if (target === 'count') {
              clause.selector = event.selector;
              delete clause.tribes;
            }
            break;
          case COMPARISON_CLAUSE_KIND:
            if (target === 'left') {
              clause.left = {
                kind: 'count',
                selector: event.selector
              };
              delete clause.tribe1;
            } else if (target === 'right') {
              clause.right = {
                kind: 'count',
                selector: event.selector
              };
              delete clause.tribe2;
            }
            break;
        }
        return clauseRoot;
      });
    }
  }

  /**
   * Gets a reactive numeric control for one clause number field.
   *
   * @public
   * @param {number[]} path path to the clause to update.
   * @param {ClauseNumberField} field number field.
   * @param {number} value current value.
   * @returns {FormControl<number | null>} numeric control.
   */
  public clauseNumberControl(path: number[], field: ClauseNumberField, value: number): FormControl<number | null> {
    const key = this.numberControlKey(path, field);
    let control = this.numberControls.get(key);
    if (!control) {
      control = new FormControl<number | null>(value, {validators: [Validators.required]});
      control.valueChanges.subscribe(nextValue => this.onClauseNumberChanged(path, field, key, nextValue));
      this.numberControls.set(key, control);
    }
    this.syncNumberControlDisabled(control);
    if (!control.dirty && control.value !== value) {
      control.setValue(value, {emitEvent: false});
    }
    return control;
  }

  /**
   * Whether the rendered clause node is invalid.
   *
   * @public
   * @param {number[]} path path to the clause node.
   * @returns {boolean} `true` if the clause node or any descendant is invalid.
   */
  public isClauseNodeInvalid(path: number[]): boolean {
    return this.isClauseTreeInvalid(this.getClauseAtPath(this.clause, path), path);
  }

  /**
   * Whether a rendered clause numeric field is invalid.
   *
   * @public
   * @param {number[]} path path to the clause node.
   * @param {ClauseNumberField} field number field.
   * @returns {boolean} `true` if the field control is invalid.
   */
  public isClauseNumberFieldInvalid(path: number[], field: ClauseNumberField): boolean {
    return this.numberControls.get(this.numberControlKey(path, field))?.invalid ?? false;
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
   * Handles comparison operator select changes.
   *
   * @public
   * @param {number[]} path path to the comparison clause.
   * @param {SelectValue} value selected value.
   */
  public onOperatorSelected(path: number[], value: SelectValue): void {
    if (typeof value === 'string') {
      this.emitSetOperator(path, value as Operator);
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
   * Returns the normalized count selector for a count-style clause.
   *
   * @public
   * @param {CountSelectorClause} clause count-style clause.
   * @returns {TribeSelector<Tribe[]>} normalized selector.
   */
  public countSelector(clause: CountSelectorClause): TribeSelector<Tribe[]> {
    return normalizeSelector(clause.selector, clause.tribes);
  }

  /**
   * Returns the normalized left comparison selector.
   *
   * @public
   * @param {Extract<Clause<Tribe[]>, {kind: typeof COMPARISON_CLAUSE_KIND}>} clause comparison clause.
   * @returns {TribeSelector<Tribe[]>} normalized selector.
   */
  public comparisonLeftSelector(clause: Extract<Clause<Tribe[]>, {kind: typeof COMPARISON_CLAUSE_KIND}>): TribeSelector<Tribe[]> {
    return normalizeCountExpression(clause.left, clause.tribe1).selector;
  }

  /**
   * Returns the normalized right comparison selector.
   *
   * @public
   * @param {Extract<Clause<Tribe[]>, {kind: typeof COMPARISON_CLAUSE_KIND}>} clause comparison clause.
   * @returns {TribeSelector<Tribe[]>} normalized selector.
   */
  public comparisonRightSelector(clause: Extract<Clause<Tribe[]>, {kind: typeof COMPARISON_CLAUSE_KIND}>): TribeSelector<Tribe[]> {
    return normalizeCountExpression(clause.right, clause.tribe2).selector;
  }

  /**
   * Updates a numeric clause value.
   *
   * @private
   * @param {number[]} path path to the clause to update.
   * @param {ClauseNumberField} field number field.
   * @param {string} key control key.
   * @param {(number | null)} value next numeric value.
   */
  private onClauseNumberChanged(path: number[], field: ClauseNumberField, key: string, value: number | null): void {
    const control = this.numberControls.get(key);
    if (!this.disabled && value !== null && (!control || control.valid)) {
      this.updateClause(clauseRoot => {
        const clause = this.getClauseAtPath(clauseRoot, path);
        if (clause.kind === COUNT_CLAUSE_KIND && field === 'interval-0') {
          clause.interval[0] = value as NeighborCount;
        } else if (clause.kind === COUNT_CLAUSE_KIND && field === 'interval-1') {
          clause.interval[1] = value as NeighborCount;
        } else if ((clause.kind === EXACTLY_CLAUSE_KIND || clause.kind === MIN_CLAUSE_KIND || clause.kind === MAX_CLAUSE_KIND) && field === 'value') {
          clause.value = value as NeighborCount;
        } else if (clause.kind === COMPARISON_CLAUSE_KIND && field === 'margin') {
          clause.margin = value;
        }
        return clauseRoot;
      });
    } else {
      this.emitClauseState();
    }
  }

  /**
   * Synchronizes a numeric control disabled state.
   *
   * @private
   * @param {FormControl<number | null>} control numeric control.
   */
  private syncNumberControlDisabled(control: FormControl<number | null>): void {
    if (this.disabled && control.enabled) {
      control.disable({emitEvent: false});
    } else if (!this.disabled && control.disabled) {
      control.enable({emitEvent: false});
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
   * Returns all selectable tribe IDs.
   *
   * @private
   * @returns {string[]} selectable tribe IDs.
   */
  private selectableTribeIds(): string[] {
    return this.tribes.map(t => t.id);
  }

  /**
   * Returns the default tribe id for explicit selections.
   *
   * @private
   * @returns {string} default tribe id.
   */
  private defaultTribeId(): string {
    return this.tribes[0]?.id ?? '';
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
    return this.isClauseTreeInvalid(this.clause, []);
  }

  /**
   * Whether a clause tree is invalid.
   *
   * @private
   * @param {Clause<Tribe[]>} clause clause to inspect.
   * @param {number[]} path current clause path.
   * @returns {boolean} `true` if the clause tree is invalid.
   */
  private isClauseTreeInvalid(clause: Clause<Tribe[]>, path: number[]): boolean {
    return this.containsEmptyClause(clause) || this.containsInvalidSelector(clause) || this.containsInvalidNumberControlForClause(clause, path);
  }

  /**
   * Whether a clause tree contains invalid active numeric controls.
   *
   * @private
   * @param {Clause<Tribe[]>} clause clause to inspect.
   * @param {number[]} path current clause path.
   * @returns {boolean} `true` if any active numeric control in the clause tree is invalid.
   */
  private containsInvalidNumberControlForClause(clause: Clause<Tribe[]>, path: number[]): boolean {
    return this.activeNumberDescriptors(clause, path).some(descriptor => this.numberControls.get(this.numberControlKey(descriptor.path, descriptor.field))?.invalid);
  }

  /**
   * Synchronizes active numeric controls from the clause model.
   *
   * @private
   */
  private syncNumberControlsFromClause(): void {
    for (const descriptor of this.activeNumberDescriptors(this.clause, [])) {
      const control = this.numberControls.get(this.numberControlKey(descriptor.path, descriptor.field));
      if (control && control.value !== descriptor.value) {
        control.setValue(descriptor.value, {emitEvent: false});
        control.markAsPristine();
        control.markAsUntouched();
      }
    }
  }

  /**
   * Gets active numeric field descriptors for a clause tree.
   *
   * @private
   * @param {Clause<Tribe[]>} clause clause to inspect.
   * @param {number[]} path current clause path.
   * @returns {ClauseNumberDescriptor[]} active numeric descriptors.
   */
  private activeNumberDescriptors(clause: Clause<Tribe[]>, path: number[]): ClauseNumberDescriptor[] {
    let descriptors: ClauseNumberDescriptor[] = [];
    switch (clause.kind) {
      case COUNT_CLAUSE_KIND:
        descriptors = [
          {
            path,
            field: 'interval-0',
            value: clause.interval[0]
          },
          {
            path,
            field: 'interval-1',
            value: clause.interval[1]
          }
        ];
        break;
      case EXACTLY_CLAUSE_KIND:
      case MIN_CLAUSE_KIND:
      case MAX_CLAUSE_KIND:
        descriptors = [
          {
            path,
            field: 'value',
            value: clause.value
          }
        ];
        break;
      case COMPARISON_CLAUSE_KIND:
        descriptors = [
          {
            path,
            field: 'margin',
            value: clause.margin ?? 0
          }
        ];
        break;
      case NOT_CLAUSE_KIND:
        descriptors = this.activeNumberDescriptors(clause.clause, path.concat(0));
        break;
      case AND_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
      case XOR_CLAUSE_KIND:
        descriptors = clause.clauses.flatMap((child, index) => this.activeNumberDescriptors(child, path.concat(index)));
        break;
    }
    return descriptors;
  }

  /**
   * Builds a stable key for a numeric clause control.
   *
   * @private
   * @param {number[]} path clause path.
   * @param {ClauseNumberField} field number field.
   * @returns {string} numeric control key.
   */
  private numberControlKey(path: number[], field: ClauseNumberField): string {
    return `${path.join('.')}:${field}`;
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
   * Whether a clause tree contains an invalid selector.
   *
   * @private
   * @param {Clause<Tribe[]>} clause clause to inspect.
   * @returns {boolean} `true` if the clause tree contains an invalid selector, `false` otherwise.
   */
  private containsInvalidSelector(clause: Clause<Tribe[]>): boolean {
    let invalid = false;
    switch (clause.kind) {
      case COUNT_CLAUSE_KIND:
      case NONE_CLAUSE_KIND:
      case EXACTLY_CLAUSE_KIND:
      case MIN_CLAUSE_KIND:
      case MAX_CLAUSE_KIND:
        invalid = this.isSelectorInvalid(normalizeSelector(clause.selector, clause.tribes));
        break;
      case COMPARISON_CLAUSE_KIND:
        invalid = this.isSelectorInvalid(normalizeCountExpression(clause.left, clause.tribe1).selector) || this.isSelectorInvalid(normalizeCountExpression(clause.right, clause.tribe2).selector);
        break;
      case NOT_CLAUSE_KIND:
        invalid = this.containsInvalidSelector(clause.clause);
        break;
      case AND_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
      case XOR_CLAUSE_KIND:
        invalid = clause.clauses.some(child => this.containsInvalidSelector(child));
        break;
    }
    return invalid;
  }

  /**
   * Whether a selector is invalid for this editor.
   *
   * @private
   * @param {TribeSelector<Tribe[]>} selector selector to inspect.
   * @returns {boolean} `true` if invalid.
   */
  private isSelectorInvalid(selector: TribeSelector<Tribe[]>): boolean {
    const knownIds = new Set(this.tribes.map(tribe => tribe.id));
    let invalid = false;
    switch (selector.kind) {
      case TRIBES_SELECTOR_KIND:
        invalid = selector.tribes.length === 0 || selector.tribes.some(id => !knownIds.has(id));
        break;
      case TIE_SELECTOR_KIND:
        invalid = true;
        break;
    }
    return invalid;
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
