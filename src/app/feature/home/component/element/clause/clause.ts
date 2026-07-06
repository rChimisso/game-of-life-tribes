import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component, forwardRef, Input, OnChanges} from '@angular/core';
import {AbstractControl, ControlValueAccessor, FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR, ReactiveFormsModule, ValidationErrors, Validator, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

import {SelectorEditor} from '../selector-editor/selector-editor';

import {TypedChanges} from '~gol/core/model/typed-change';
import {normalizeCountExpression, normalizeSelector, selectorSignature, toggleExplicitTribeSelection} from '~gol/feature/home/logic/rule-editor';
import {hasInvalidClauseStructure} from '~gol/feature/home/logic/rule-validation';
import {AND_CLAUSE_KIND, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, EMPTY_CLAUSE, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, TRIBES_SELECTOR_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NeighborCount, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, Operator, OR_CLAUSE_KIND, Tribe, TribeSelector, XOR_CLAUSE_KIND} from '~gol/feature/home/model/rule';
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
 * Clause selector target.
 *
 * @typedef {ClauseSelectorTarget}
 */
type ClauseSelectorTarget = 'count' | 'left' | 'right';

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
 * Active clause selector descriptor.
 *
 * @interface ClauseSelectorDescriptor
 * @typedef {ClauseSelectorDescriptor}
 */
interface ClauseSelectorDescriptor {
  /**
   * Clause path.
   *
   * @type {number[]}
   */
  path: number[];
  /**
   * Selector target.
   *
   * @type {ClauseSelectorTarget}
   */
  target: ClauseSelectorTarget;
  /**
   * Current selector value.
   *
   * @type {TribeSelector<Tribe[]>}
   */
  value: TribeSelector<Tribe[]>;
}

/**
 * Rule clause editor.
 *
 * @class RuleClause
 * @typedef {RuleClause}
 * @implements {OnChanges}
 * @implements {ControlValueAccessor}
 * @implements {Validator}
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RuleClause),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => RuleClause),
      multi: true
    }
  ]
})
export class RuleClause implements OnChanges, ControlValueAccessor, Validator {
  /**
   * Editable clause.
   *
   * @public
   * @type {!Clause<Tribe[]>}
   */
  @Input()
  public clause: Clause<Tribe[]> = EMPTY_CLAUSE;

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
   * Local selector controls keyed by clause path and target.
   *
   * @private
   * @readonly
   * @type {Map<string, FormControl<TribeSelector<Tribe[]>>>}
   */
  private readonly selectorControls = new Map<string, FormControl<TribeSelector<Tribe[]>>>();

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
      this.syncSelectorControlsFromClause();
    }
    if (changes.clause || changes.baselineClause || changes.tribes) {
      this.onValidatorChange();
    }
  }

  /**
   * @inheritdoc
   */
  public writeValue(value: Clause<Tribe[]> | null): void {
    this.clause = value ? structuredClone(value) : EMPTY_CLAUSE;
    this.syncNumberControlsFromClause();
    this.syncSelectorControlsFromClause();
  }

  /**
   * @inheritdoc
   */
  public registerOnChange(fn: (value: Clause<Tribe[]>) => void): void {
    this.onChange = fn;
  }

  /**
   * @inheritdoc
   */
  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /**
   * @inheritdoc
   */
  public setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.syncActiveControlsDisabled();
  }

  /**
   * @inheritdoc
   */
  public validate(_: AbstractControl<Clause<Tribe[]> | null>): ValidationErrors | null {
    return this.isInvalid() ? {clause: true} : null;
  }

  /**
   * @inheritdoc
   */
  public registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
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
   * @param {ClauseSelectorTarget} target selector target.
   * @param {string} key control key.
   * @param {TribeSelector<Tribe[]>} selector selector expression.
   */
  public onSelectorChanged(path: number[], target: ClauseSelectorTarget, key: string, selector: TribeSelector<Tribe[]>): void {
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
              clause.selector = selector;
              delete clause.tribes;
            }
            break;
          case COMPARISON_CLAUSE_KIND:
            if (target === 'left') {
              clause.left = {
                kind: 'count',
                selector
              };
              delete clause.tribe1;
            } else if (target === 'right') {
              clause.right = {
                kind: 'count',
                selector
              };
              delete clause.tribe2;
            }
            break;
        }
        return clauseRoot;
      });
    } else {
      this.selectorControls.get(key)?.updateValueAndValidity({emitEvent: false});
    }
  }

  /**
   * Gets a reactive selector control for one clause selector.
   *
   * @public
   * @param {number[]} path path to the clause to update.
   * @param {ClauseSelectorTarget} target selector target.
   * @param {TribeSelector<Tribe[]>} value current value.
   * @returns {FormControl<TribeSelector<Tribe[]>>} selector control.
   */
  public clauseSelectorControl(path: number[], target: ClauseSelectorTarget, value: TribeSelector<Tribe[]>): FormControl<TribeSelector<Tribe[]>> {
    const key = this.selectorControlKey(path, target);
    let control = this.selectorControls.get(key);
    if (!control) {
      control = new FormControl<TribeSelector<Tribe[]>>(value, {nonNullable: true});
      control.valueChanges.subscribe(nextValue => this.onSelectorChanged(path, target, key, nextValue));
      this.selectorControls.set(key, control);
    }
    this.syncControlDisabled(control);
    if (!this.selectorsEqual(control.value, value)) {
      control.setValue(value, {emitEvent: false});
    }
    return control;
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
    this.syncControlDisabled(control);
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
      this.onValidatorChange();
    }
  }

  /**
   * Synchronizes a child control disabled state.
   *
   * @private
   * @param {AbstractControl} control child control.
   */
  private syncControlDisabled(control: AbstractControl): void {
    if (this.disabled && control.enabled) {
      control.disable({emitEvent: false});
    } else if (!this.disabled && control.disabled) {
      control.enable({emitEvent: false});
    }
  }

  /**
   * Synchronizes all active child controls disabled state.
   *
   * @private
   */
  private syncActiveControlsDisabled(): void {
    for (const control of this.numberControls.values()) {
      this.syncControlDisabled(control);
    }
    for (const control of this.selectorControls.values()) {
      this.syncControlDisabled(control);
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
    this.syncNumberControlsFromClause();
    this.syncSelectorControlsFromClause();
    this.onChange(this.clause);
    this.onValidatorChange();
    this.onTouched();
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
    return hasInvalidClauseStructure(clause, this.tribes) || this.containsInvalidSelectorControlForClause(clause, path) || this.containsInvalidNumberControlForClause(clause, path);
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
   * Whether a clause tree contains invalid active selector controls.
   *
   * @private
   * @param {Clause<Tribe[]>} clause clause to inspect.
   * @param {number[]} path current clause path.
   * @returns {boolean} `true` if any active selector in the clause tree is invalid.
   */
  private containsInvalidSelectorControlForClause(clause: Clause<Tribe[]>, path: number[]): boolean {
    return this.activeSelectorDescriptors(clause, path).some(descriptor => this.selectorControls.get(this.selectorControlKey(descriptor.path, descriptor.target))?.invalid);
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
   * Synchronizes active selector controls from the clause model.
   *
   * @private
   */
  private syncSelectorControlsFromClause(): void {
    for (const descriptor of this.activeSelectorDescriptors(this.clause, [])) {
      const control = this.selectorControls.get(this.selectorControlKey(descriptor.path, descriptor.target));
      if (control && !this.selectorsEqual(control.value, descriptor.value)) {
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
   * Gets active selector descriptors for a clause tree.
   *
   * @private
   * @param {Clause<Tribe[]>} clause clause to inspect.
   * @param {number[]} path current clause path.
   * @returns {ClauseSelectorDescriptor[]} active selector descriptors.
   */
  private activeSelectorDescriptors(clause: Clause<Tribe[]>, path: number[]): ClauseSelectorDescriptor[] {
    let descriptors: ClauseSelectorDescriptor[] = [];
    switch (clause.kind) {
      case COUNT_CLAUSE_KIND:
      case NONE_CLAUSE_KIND:
      case EXACTLY_CLAUSE_KIND:
      case MIN_CLAUSE_KIND:
      case MAX_CLAUSE_KIND:
        descriptors = [
          {
            path,
            target: 'count',
            value: normalizeSelector(clause.selector, clause.tribes)
          }
        ];
        break;
      case COMPARISON_CLAUSE_KIND:
        descriptors = [
          {
            path,
            target: 'left',
            value: normalizeCountExpression(clause.left, clause.tribe1).selector
          },
          {
            path,
            target: 'right',
            value: normalizeCountExpression(clause.right, clause.tribe2).selector
          }
        ];
        break;
      case NOT_CLAUSE_KIND:
        descriptors = this.activeSelectorDescriptors(clause.clause, path.concat(0));
        break;
      case AND_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
      case XOR_CLAUSE_KIND:
        descriptors = clause.clauses.flatMap((child, index) => this.activeSelectorDescriptors(child, path.concat(index)));
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
   * Builds a stable key for a selector clause control.
   *
   * @private
   * @param {number[]} path clause path.
   * @param {ClauseSelectorTarget} target selector target.
   * @returns {string} selector control key.
   */
  private selectorControlKey(path: number[], target: ClauseSelectorTarget): string {
    return `${path.join('.')}:${target}`;
  }

  /**
   * Checks selector semantic equality.
   *
   * @private
   * @param {TribeSelector<Tribe[]>} left left selector.
   * @param {TribeSelector<Tribe[]>} right right selector.
   * @returns {boolean} `true` if the selectors are equivalent.
   */
  private selectorsEqual(left: TribeSelector<Tribe[]>, right: TribeSelector<Tribe[]>): boolean {
    return selectorSignature(left) === selectorSignature(right);
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

  /**
   * Validator change callback.
   *
   * @private
   * @type {() => void}
   */
  private onValidatorChange: () => void = () => undefined;

  /**
   * CVA change callback.
   *
   * @private
   * @type {(value: Clause<Tribe[]>) => void}
   */
  private onChange: (value: Clause<Tribe[]>) => void = () => undefined;

  /**
   * CVA touched callback.
   *
   * @private
   * @type {() => void}
   */
  private onTouched: () => void = () => undefined;
}
