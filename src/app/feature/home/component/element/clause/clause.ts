import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, forwardRef, inject, Input, OnChanges, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AbstractControl, ControlValueAccessor, FormArray, FormControl, FormGroup, NG_VALIDATORS, NG_VALUE_ACCESSOR, ReactiveFormsModule, ValidationErrors, Validator, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';

import {SelectorEditor} from '../selector-editor/selector-editor';
import {ClauseFormControls} from './model/clause-form';

import {TypedChanges} from '~gol/core/model/typed-change';
import {normalizeCountExpression, normalizeSelector, toggleExplicitTribeSelection} from '~gol/feature/home/logic/rule-editor';
import {hasInvalidClauseStructure} from '~gol/feature/home/logic/rule-validation';
import {AND_CLAUSE_KIND, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, EMPTY_CLAUSE, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, TRIBES_SELECTOR_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, Operator, OR_CLAUSE_KIND, Tribe, TribeSelector, XOR_CLAUSE_KIND} from '~gol/feature/home/model/rule';
import {ClauseDraft} from '~gol/feature/home/model/rule-draft';
import {Button} from '~gol/shared/component/button/button';
import {NumberInputComponent} from '~gol/shared/component/input/number-input/number-input';
import {SelectOption, SelectValue} from '~gol/shared/component/select/model/select';
import {SelectComponent} from '~gol/shared/component/select/select';
import {SummaryComponent} from '~gol/shared/component/summary/summary';
import {TribeSwatch} from '~gol/shared/component/tribe-swatch/tribe-swatch';

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
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    forwardRef(() => RuleClause),
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
   * @type {ClauseDraft}
   */
  @Input()
  public clause: ClauseDraft = EMPTY_CLAUSE;

  /**
   * Baseline clause used for dirty-state checks.
   *
   * @public
   * @type {ClauseDraft | null}
   */
  @Input()
  public baselineClause: ClauseDraft | null = null;

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
   * Emits a request to remove this clause from its parent.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly removeSelf = new EventEmitter<void>();

  /**
   * Clause form.
   *
   * @public
   * @readonly
   * @type {FormGroup<ClauseFormControls>}
   */
  public readonly form = new FormGroup<ClauseFormControls>({
    selector: new FormControl<TribeSelector<Tribe[]> | null>(null),
    leftSelector: new FormControl<TribeSelector<Tribe[]> | null>(null),
    rightSelector: new FormControl<TribeSelector<Tribe[]> | null>(null),
    tribes: new FormControl<string[]>([], {nonNullable: true}),
    intervalMin: new FormControl<number | null>(null, {validators: [Validators.required, Validators.min(0), Validators.max(8)]}),
    intervalMax: new FormControl<number | null>(null, {validators: [Validators.required, Validators.min(0), Validators.max(8)]}),
    value: new FormControl<number | null>(null, {validators: [Validators.required, Validators.min(0), Validators.max(8)]}),
    margin: new FormControl<number | null>(null, {validators: [Validators.required, Validators.min(-8), Validators.max(8)]}),
    operator: new FormControl<Operator>('=', {nonNullable: true}),
    child: new FormControl<ClauseDraft>(EMPTY_CLAUSE, {nonNullable: true}),
    children: new FormArray<FormControl<ClauseDraft>>([])
  });

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
    {value: '\u2260', label: '\u2260'},
    {value: '>', label: '>'},
    {value: '<', label: '<'},
    {value: '\u2265', label: '\u2265'},
    {value: '\u2264', label: '\u2264'}
  ];

  /**
   * Whether the logical group is collapsed.
   *
   * @public
   * @type {boolean}
   */
  public groupCollapsed = false;

  /**
   * Whether value propagation is currently suspended.
   *
   * @private
   * @type {boolean}
   */
  private syncing = false;

  /**
   * Change detector.
   *
   * @private
   * @readonly
   * @type {ChangeDetectorRef}
   */
  private readonly ruleClauseChangeDetectorRef = inject(ChangeDetectorRef);

  /**
   * Logical child clause controls.
   *
   * @public
   * @readonly
   * @type {FormArray<FormControl<ClauseDraft>>}
   */
  public get children(): FormArray<FormControl<ClauseDraft>> {
    return this.form.controls.children;
  }

  /**
   * Whether this clause node is invalid.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get invalidClause(): boolean {
    return this.form.invalid || hasInvalidClauseStructure(this.clause, this.tribes);
  }

  /**
   * Creates the clause editor.
   *
   * @public
   * @constructor
   */
  public constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.onFormValueChanged());
    this.form.statusChanges.pipe(takeUntilDestroyed()).subscribe(() => this.onFormStatusChanged());
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<RuleClause>): void {
    if (changes.clause) {
      this.writeClause(this.clause);
    }
    if (changes.tribes) {
      this.form.updateValueAndValidity({emitEvent: false});
      this.onValidatorChange();
      this.ruleClauseChangeDetectorRef.markForCheck();
    }
  }

  /**
   * @inheritdoc
   */
  public writeValue(value: ClauseDraft | null): void {
    this.writeClause(value ?? EMPTY_CLAUSE);
  }

  /**
   * @inheritdoc
   */
  public registerOnChange(fn: (value: ClauseDraft) => void): void {
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
    this.syncActiveControlState();
    this.ruleClauseChangeDetectorRef.markForCheck();
  }

  /**
   * @inheritdoc
   */
  public validate(_: AbstractControl<ClauseDraft | null>): ValidationErrors | null {
    return this.invalidClause ? {clause: true} : null;
  }

  /**
   * @inheritdoc
   */
  public registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  /**
   * Handles clause kind select changes.
   *
   * @public
   * @param {SelectValue} value selected value.
   */
  public onClauseKindSelected(value: SelectValue): void {
    if (!this.disabled && typeof value === 'string') {
      this.writeClause(this.createClause(value));
      this.emitClauseDraft();
    }
  }

  /**
   * Handles a delete interaction.
   *
   * @public
   */
  public onDeleteClicked(): void {
    if (!this.disabled) {
      if (this.depth > 0) {
        this.removeSelf.emit();
      } else {
        this.writeClause(EMPTY_CLAUSE);
        this.emitClauseDraft();
      }
    }
  }

  /**
   * Toggles one tribe in the IS clause.
   *
   * @public
   * @param {string} tribeId tribe ID to toggle.
   */
  public onToggleTribe(tribeId: string): void {
    if (!this.disabled && this.clause.kind === IS_CLAUSE_KIND) {
      const nextTribes = toggleExplicitTribeSelection(this.form.controls.tribes.value, tribeId, this.defaultTribeId());
      this.form.controls.tribes.setValue(nextTribes);
    }
  }

  /**
   * Sets the comparison operator.
   *
   * @public
   * @param {SelectValue} value selected operator.
   */
  public onOperatorSelected(value: SelectValue): void {
    if (!this.disabled && typeof value === 'string') {
      this.form.controls.operator.setValue(value as Operator);
    }
  }

  /**
   * Adds an empty child clause.
   *
   * @public
   */
  public emitAddChild(): void {
    if (!this.disabled && this.isBinaryLogicalClause(this.clause)) {
      this.children.push(this.createClauseControl(EMPTY_CLAUSE));
    }
  }

  /**
   * Removes or clears one child clause.
   *
   * @public
   * @param {number} index child index.
   */
  public removeChild(index: number): void {
    if (!this.disabled && this.isBinaryLogicalClause(this.clause)) {
      if (this.children.length > 2) {
        this.children.removeAt(index);
      } else {
        this.children.at(index).setValue(EMPTY_CLAUSE);
      }
    }
  }

  /**
   * Clears the NOT child clause.
   *
   * @public
   */
  public removeNotChild(): void {
    if (!this.disabled && this.clause.kind === NOT_CLAUSE_KIND) {
      this.form.controls.child.setValue(EMPTY_CLAUSE);
    }
  }

  /**
   * Toggles collapsed state for this logical group.
   *
   * @public
   */
  public toggleGroupCollapse(): void {
    this.groupCollapsed = !this.groupCollapsed;
  }

  /**
   * Whether a tribe is selected in the current IS clause.
   *
   * @public
   * @param {string} tribeId tribe ID.
   * @returns {boolean} `true` if selected.
   */
  public isTribeSelected(tribeId: string): boolean {
    return this.form.controls.tribes.value.includes(tribeId);
  }

  /**
   * Whether a numeric control is invalid.
   *
   * @public
   * @param {AbstractControl} control numeric control.
   * @returns {boolean} `true` if invalid.
   */
  public isNumberInvalid(control: AbstractControl): boolean {
    return control.invalid;
  }

  /**
   * Writes one clause into the active form node.
   *
   * @private
   * @param {ClauseDraft} clause clause value.
   */
  private writeClause(clause: ClauseDraft): void {
    this.syncing = true;
    this.clause = structuredClone(clause);
    this.syncFormFromClause(this.clause);
    this.syncActiveControlState();
    this.form.updateValueAndValidity({emitEvent: false});
    this.syncing = false;
    this.onValidatorChange();
    this.ruleClauseChangeDetectorRef.markForCheck();
  }

  /**
   * Synchronizes active controls from a clause.
   *
   * @private
   * @param {ClauseDraft} clause clause value.
   */
  private syncFormFromClause(clause: ClauseDraft): void {
    this.form.controls.selector.setValue(null, {emitEvent: false});
    this.form.controls.leftSelector.setValue(null, {emitEvent: false});
    this.form.controls.rightSelector.setValue(null, {emitEvent: false});
    this.form.controls.tribes.setValue([], {emitEvent: false});
    this.form.controls.intervalMin.setValue(null, {emitEvent: false});
    this.form.controls.intervalMax.setValue(null, {emitEvent: false});
    this.form.controls.value.setValue(null, {emitEvent: false});
    this.form.controls.margin.setValue(null, {emitEvent: false});
    this.form.controls.operator.setValue('=', {emitEvent: false});
    this.form.controls.child.setValue(EMPTY_CLAUSE, {emitEvent: false});
    this.children.clear({emitEvent: false});

    switch (clause.kind) {
      case IS_CLAUSE_KIND:
        this.form.controls.tribes.setValue([...clause.tribes], {emitEvent: false});
        break;
      case COUNT_CLAUSE_KIND:
        this.form.controls.selector.setValue(normalizeSelector(clause.selector), {emitEvent: false});
        this.form.controls.intervalMin.setValue(clause.interval[0], {emitEvent: false});
        this.form.controls.intervalMax.setValue(clause.interval[1], {emitEvent: false});
        break;
      case NONE_CLAUSE_KIND:
        this.form.controls.selector.setValue(normalizeSelector(clause.selector), {emitEvent: false});
        break;
      case EXACTLY_CLAUSE_KIND:
      case MIN_CLAUSE_KIND:
      case MAX_CLAUSE_KIND:
        this.form.controls.selector.setValue(normalizeSelector(clause.selector), {emitEvent: false});
        this.form.controls.value.setValue(clause.value, {emitEvent: false});
        break;
      case COMPARISON_CLAUSE_KIND:
        this.form.controls.leftSelector.setValue(normalizeCountExpression(clause.left).selector, {emitEvent: false});
        this.form.controls.rightSelector.setValue(normalizeCountExpression(clause.right).selector, {emitEvent: false});
        this.form.controls.operator.setValue(clause.operator || '=', {emitEvent: false});
        this.form.controls.margin.setValue(clause.margin ?? 0, {emitEvent: false});
        break;
      case NOT_CLAUSE_KIND:
        this.form.controls.child.setValue(clause.clause, {emitEvent: false});
        break;
      case AND_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
      case XOR_CLAUSE_KIND:
        for (const child of clause.clauses) {
          this.children.push(this.createClauseControl(child), {emitEvent: false});
        }
        break;
    }
  }

  /**
   * Synchronizes active controls and inactive controls.
   *
   * @private
   */
  private syncActiveControlState(): void {
    this.syncControl(this.form.controls.selector, this.isCountStyleClause(this.clause));
    this.syncControl(this.form.controls.leftSelector, this.clause.kind === COMPARISON_CLAUSE_KIND);
    this.syncControl(this.form.controls.rightSelector, this.clause.kind === COMPARISON_CLAUSE_KIND);
    this.syncControl(this.form.controls.tribes, this.clause.kind === IS_CLAUSE_KIND);
    this.syncControl(this.form.controls.intervalMin, this.clause.kind === COUNT_CLAUSE_KIND);
    this.syncControl(this.form.controls.intervalMax, this.clause.kind === COUNT_CLAUSE_KIND);
    this.syncControl(this.form.controls.value, this.clause.kind === EXACTLY_CLAUSE_KIND || this.clause.kind === MIN_CLAUSE_KIND || this.clause.kind === MAX_CLAUSE_KIND);
    this.syncControl(this.form.controls.margin, this.clause.kind === COMPARISON_CLAUSE_KIND);
    this.syncControl(this.form.controls.operator, this.clause.kind === COMPARISON_CLAUSE_KIND);
    this.syncControl(this.form.controls.child, this.clause.kind === NOT_CLAUSE_KIND);
    this.syncControl(this.children, this.isBinaryLogicalClause(this.clause));
  }

  /**
   * Enables or disables a control from active state.
   *
   * @private
   * @param {AbstractControl} control control to update.
   * @param {boolean} active whether the control is active.
   */
  private syncControl(control: AbstractControl, active: boolean): void {
    if (this.disabled || !active) {
      control.disable({emitEvent: false});
    } else {
      control.enable({emitEvent: false});
    }
  }

  /**
   * Handles form value changes.
   *
   * @private
   */
  private onFormValueChanged(): void {
    if (!this.syncing) {
      this.emitClauseDraft();
    }
  }

  /**
   * Handles form status changes.
   *
   * @private
   */
  private onFormStatusChanged(): void {
    if (!this.syncing) {
      this.onValidatorChange();
      this.ruleClauseChangeDetectorRef.markForCheck();
    }
  }

  /**
   * Emits the active form draft.
   *
   * @private
   */
  private emitClauseDraft(): void {
    this.clause = this.buildClauseFromForm();
    this.onChange(structuredClone(this.clause));
    this.onValidatorChange();
    this.onTouched();
    this.ruleClauseChangeDetectorRef.markForCheck();
  }

  /**
   * Builds a clause from the active form state.
   *
   * @private
   * @returns {ClauseDraft} clause draft.
   */
  private buildClauseFromForm(): ClauseDraft {
    let clause: ClauseDraft = EMPTY_CLAUSE;
    switch (this.clause.kind) {
      case IS_CLAUSE_KIND:
        clause = {
          kind: IS_CLAUSE_KIND,
          tribes: this.form.controls.tribes.value
        };
        break;
      case COUNT_CLAUSE_KIND:
        clause = {
          kind: COUNT_CLAUSE_KIND,
          selector: this.form.controls.selector.value ?? this.defaultSelector(),
          interval: [this.form.controls.intervalMin.value, this.form.controls.intervalMax.value]
        };
        break;
      case NONE_CLAUSE_KIND:
        clause = {
          kind: NONE_CLAUSE_KIND,
          selector: this.form.controls.selector.value ?? this.defaultSelector()
        };
        break;
      case EXACTLY_CLAUSE_KIND:
      case MIN_CLAUSE_KIND:
      case MAX_CLAUSE_KIND:
        clause = {
          kind: this.clause.kind,
          selector: this.form.controls.selector.value ?? this.defaultSelector(),
          value: this.form.controls.value.value
        };
        break;
      case COMPARISON_CLAUSE_KIND:
        clause = {
          kind: COMPARISON_CLAUSE_KIND,
          left: {
            kind: 'count',
            selector: this.form.controls.leftSelector.value ?? this.defaultSelector()
          },
          right: {
            kind: 'count',
            selector: this.form.controls.rightSelector.value ?? this.defaultSelector()
          },
          operator: this.form.controls.operator.value,
          margin: this.form.controls.margin.value
        };
        break;
      case NOT_CLAUSE_KIND:
        clause = {
          kind: NOT_CLAUSE_KIND,
          clause: this.form.controls.child.value
        };
        break;
      case AND_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
      case XOR_CLAUSE_KIND:
        clause = {
          kind: this.clause.kind,
          clauses: this.children.getRawValue()
        };
        break;
    }
    return clause;
  }

  /**
   * Creates a clause for one kind.
   *
   * @private
   * @param {string} kind clause kind.
   * @returns {ClauseDraft} created clause.
   */
  private createClause(kind: string): ClauseDraft {
    let clause: ClauseDraft = EMPTY_CLAUSE;
    switch (kind) {
      case IS_CLAUSE_KIND:
        clause = {
          kind: IS_CLAUSE_KIND,
          tribes: [DEAD_TRIBE_ID]
        };
        break;
      case NONE_CLAUSE_KIND:
        clause = {
          kind: NONE_CLAUSE_KIND,
          selector: this.defaultSelector()
        };
        break;
      case EXACTLY_CLAUSE_KIND:
      case MIN_CLAUSE_KIND:
      case MAX_CLAUSE_KIND:
        clause = {
          kind,
          selector: this.defaultSelector(),
          value: 1
        };
        break;
      case COUNT_CLAUSE_KIND:
        clause = {
          kind: COUNT_CLAUSE_KIND,
          selector: this.defaultSelector(),
          interval: [0, 8]
        };
        break;
      case COMPARISON_CLAUSE_KIND:
        clause = {
          kind: COMPARISON_CLAUSE_KIND,
          left: {
            kind: 'count',
            selector: this.defaultSelector()
          },
          right: {
            kind: 'count',
            selector: this.defaultSelector()
          },
          operator: '=',
          margin: 0
        };
        break;
      case NOT_CLAUSE_KIND:
        clause = {
          kind: NOT_CLAUSE_KIND,
          clause: EMPTY_CLAUSE
        };
        break;
      case AND_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
      case XOR_CLAUSE_KIND:
        clause = {
          kind,
          clauses: [EMPTY_CLAUSE, EMPTY_CLAUSE]
        };
        break;
    }
    return clause;
  }

  /**
   * Creates one child clause control.
   *
   * @private
   * @param {ClauseDraft} clause clause value.
   * @returns {FormControl<ClauseDraft>} clause control.
   */
  private createClauseControl(clause: ClauseDraft): FormControl<ClauseDraft> {
    return new FormControl<ClauseDraft>(clause, {nonNullable: true});
  }

  /**
   * Whether the clause is count-style.
   *
   * @private
   * @param {ClauseDraft} clause clause to inspect.
   * @returns {boolean} `true` if count-style.
   */
  private isCountStyleClause(clause: ClauseDraft): boolean {
    return clause.kind === COUNT_CLAUSE_KIND || clause.kind === NONE_CLAUSE_KIND || clause.kind === EXACTLY_CLAUSE_KIND || clause.kind === MIN_CLAUSE_KIND || clause.kind === MAX_CLAUSE_KIND;
  }

  /**
   * Whether the clause is a binary logical group.
   *
   * @private
   * @param {ClauseDraft} clause clause to inspect.
   * @returns {boolean} `true` if binary logical.
   */
  private isBinaryLogicalClause(clause: ClauseDraft): boolean {
    return clause.kind === AND_CLAUSE_KIND || clause.kind === OR_CLAUSE_KIND || clause.kind === XOR_CLAUSE_KIND;
  }

  /**
   * Returns the default selector.
   *
   * @private
   * @returns {TribeSelector<Tribe[]>} default selector.
   */
  private defaultSelector(): TribeSelector<Tribe[]> {
    return {
      kind: TRIBES_SELECTOR_KIND,
      tribes: [DEAD_TRIBE_ID]
    };
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
   * @type {(value: ClauseDraft) => void}
   */
  private onChange: (value: ClauseDraft) => void = () => undefined;

  /**
   * CVA touched callback.
   *
   * @private
   * @type {() => void}
   */
  private onTouched: () => void = () => undefined;
}
