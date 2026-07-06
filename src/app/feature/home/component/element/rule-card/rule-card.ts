import {DragDropModule} from '@angular/cdk/drag-drop';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, forwardRef, HostBinding, inject, Input, OnChanges, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AbstractControl, FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR, ReactiveFormsModule, ValidationErrors, Validator, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';

import {BecomeEditor} from '../become-editor/become-editor';
import {RuleClause} from '../clause/clause';
import {BecomeChangeEvent, BecomeStateChangeEvent} from '../model/become-event';
import {ClauseChangeEvent, ClauseStateChangeEvent} from '../model/clause-event';

import {TypedChanges} from '~gol/core/model/typed-change';
import {normalizeBecome, normalizeRuleProbability, rulesEqual} from '~gol/feature/home/logic/rule-editor';
import {Become, COMBINE_BECOME_KIND, DEFAULT_RULE_PROBABILITY, EMPTY_CLAUSE, FIXED_BECOME_KIND, MAJORITY_BECOME_KIND, MAX_RULE_PROBABILITY, MINORITY_BECOME_KIND, MIN_RULE_PROBABILITY, Rule, SAME_BECOME_KIND, Tribe} from '~gol/feature/home/model/rule';
import {Button} from '~gol/shared/component/button/button';
import {NumberInputComponent} from '~gol/shared/component/input/number-input/number-input';
import {SummaryComponent} from '~gol/shared/component/summary/summary';
import {TribeSwatch} from '~gol/shared/component/tribe-swatch/tribe-swatch';

/**
 * Rule card editor.
 *
 * @class RuleCard
 * @typedef {RuleCard}
 * @implements {OnChanges}
 * @implements {Validator}
 */
@Component({
  selector: 'gol-rule-card',
  standalone: true,
  imports: [
    DragDropModule,
    ReactiveFormsModule,
    BecomeEditor,
    RuleClause,
    Button,
    SummaryComponent,
    TribeSwatch,
    NumberInputComponent,
    MatIconModule
  ],
  templateUrl: './rule-card.html',
  styleUrl: './rule-card.scss',
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RuleCard),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => RuleCard),
      multi: true
    }
  ]
})
export class RuleCard implements OnChanges, Validator {
  /**
   * Baseline rule used for dirty-state checks.
   *
   * @public
   * @type {Rule<Tribe[]> | null}
   */
  @Input()
  public baselineRule: Rule<Tribe[]> | null = null;

  /**
   * Index of this rule in the list.
   *
   * @public
   * @type {!number}
   */
  @Input({required: true})
  public ruleIndex!: number;

  /**
   * Available tribes for selection.
   *
   * @public
   * @type {Tribe[]}
   */
  @Input({required: true})
  public tribes: Tribe[] = [];

  /**
   * Whether the card is expanded.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public expanded = false;

  /**
   * Emits requests to toggle rule expansion.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly toggleExpand = new EventEmitter<void>();

  /**
   * Emits rule removal requests.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly removeRule = new EventEmitter<void>();

  /**
   * Emits rule duplication requests.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly duplicateRule = new EventEmitter<void>();

  /**
   * Emits drag-handle pointer-down interactions.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly dragHandlePointerDown = new EventEmitter<void>();

  /**
   * Current rule value.
   *
   * @public
   * @type {Rule<Tribe[]>}
   */
  public rule: Rule<Tribe[]> = {
    muted: false,
    clause: EMPTY_CLAUSE,
    become: {
      kind: FIXED_BECOME_KIND,
      tribe: ''
    }
  };

  /**
   * Probability input control.
   *
   * @public
   * @readonly
   * @type {FormControl<number | null>}
   */
  public readonly probabilityControl = new FormControl<number | null>(MAX_RULE_PROBABILITY, {validators: [Validators.required]});

  /**
   * Minimum probability input value.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public readonly minRuleProbability = MIN_RULE_PROBABILITY;

  /**
   * Maximum probability input value.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public readonly maxRuleProbability = MAX_RULE_PROBABILITY;

  /**
   * Maximum probability integer digits.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public readonly maxRuleProbabilityIntegerDigits = MAX_RULE_PROBABILITY.toString().length;

  /**
   * Whether the clause editor is invalid.
   *
   * @private
   * @type {boolean}
   */
  private clauseInvalid = false;

  /**
   * Whether the outcome editor is invalid.
   *
   * @private
   * @type {boolean}
   */
  private becomeInvalid = false;

  /**
   * Destroy ref.
   *
   * @private
   * @readonly
   * @type {DestroyRef}
   */
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Change detector.
   *
   * @private
   * @readonly
   * @type {ChangeDetectorRef}
   */
  private readonly ruleCardChangeDetectorRef = inject(ChangeDetectorRef);

  /**
   * Whether the rule card should render invalid styling.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  @HostBinding('class.invalid-rule')
  public get invalidRuleClass(): boolean {
    return this.isInvalid;
  }

  /**
   * Whether the rule differs from its baseline.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get isDirty(): boolean {
    let dirty = true;
    if (this.baselineRule) {
      dirty = !rulesEqual(this.rule, this.baselineRule) || this.probabilityControl.value !== this.baselineProbability();
    }
    return dirty;
  }

  /**
   * Whether the rule is invalid.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get isInvalid(): boolean {
    return this.clauseInvalid || this.becomeInvalid || this.probabilityControl.invalid;
  }

  /**
   * Probability validation message.
   *
   * @public
   * @type {(string | null)}
   */
  public get probabilityError(): string | null {
    const control = this.probabilityControl;
    let error: string | null = null;
    if (control.hasError('required')) {
      error = 'Required';
    } else if (control.hasError('min')) {
      error = `Min ${MIN_RULE_PROBABILITY}`;
    } else if (control.hasError('max')) {
      error = `Max ${MAX_RULE_PROBABILITY}`;
    } else if (control.hasError('decimalDigits')) {
      error = 'Max 3 decimals';
    }
    return error;
  }

  /**
   * Creates the rule card.
   *
   * @public
   * @constructor
   */
  public constructor() {
    this.probabilityControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.onProbabilityChanged(value));
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<RuleCard>): void {
    if (changes.baselineRule) {
      this.emitRuleState();
    }
  }

  /**
   * @inheritdoc
   */
  public writeValue(value: Rule<Tribe[]> | null): void {
    this.rule = value ? structuredClone(value) : this.rule;
    this.probabilityControl.setValue(this.probability(), {emitEvent: false});
    this.syncProbabilityControlDisabled();
    this.ruleCardChangeDetectorRef.markForCheck();
  }

  /**
   * @inheritdoc
   */
  public registerOnChange(fn: (value: Rule<Tribe[]>) => void): void {
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
  public validate(_: AbstractControl<Rule<Tribe[]> | null>): ValidationErrors | null {
    return this.isInvalid ? {rule: true} : null;
  }

  /**
   * @inheritdoc
   */
  public registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  /**
   * Returns the normalized output expression.
   *
   * @public
   * @returns {Become<Tribe[]>} normalized output expression.
   */
  public outputBecome(): Become<Tribe[]> {
    return normalizeBecome(this.rule);
  }

  /**
   * Returns the normalized baseline output expression.
   *
   * @public
   * @returns {(Become<Tribe[]> | null)} normalized baseline output expression.
   */
  public baselineBecome(): Become<Tribe[]> | null {
    return this.baselineRule ? normalizeBecome(this.baselineRule) : null;
  }

  /**
   * Returns the fixed output tribe id when the rule has a fixed outcome.
   *
   * @public
   * @returns {(string | null)} fixed output tribe id.
   */
  public fixedOutputTribeId(): string | null {
    const become = this.outputBecome();
    return become.kind === FIXED_BECOME_KIND ? become.tribe : null;
  }

  /**
   * Returns the rule output label.
   *
   * @public
   * @returns {string} output label.
   */
  public outputBecomeLabel(): string {
    const become = this.outputBecome();
    let label = 'Unsupported';
    switch (become.kind) {
      case FIXED_BECOME_KIND:
        label = become.tribe;
        break;
      case SAME_BECOME_KIND:
        label = 'Same';
        break;
      case MAJORITY_BECOME_KIND:
        label = 'Majority';
        break;
      case MINORITY_BECOME_KIND:
        label = 'Minority';
        break;
      case COMBINE_BECOME_KIND:
        label = 'Combine';
        break;
    }
    return label;
  }

  /**
   * Returns the color for the fixed output tribe.
   *
   * @public
   * @returns {string} hex color code for the fixed output tribe.
   */
  public outputTribeColor(): string {
    return this.tribes.find(tribe => tribe.id === this.fixedOutputTribeId())?.color ?? '888888';
  }

  /**
   * Returns the normalized probability percentage.
   *
   * @public
   * @returns {number} probability percentage.
   */
  public probability(): number {
    return normalizeRuleProbability(this.rule.probability);
  }

  /**
   * Formats the probability percentage for compact display.
   *
   * @public
   * @returns {string} formatted percentage.
   */
  public probabilityLabel(): string {
    return this.probability().toFixed(3).replace(/(?:\.0+|(\.\d*?)0+)$/, '$1');
  }

  /**
   * Whether the probability header badge should be shown.
   *
   * @public
   * @returns {boolean} true when the rule probability is not the default.
   */
  public showProbabilityBadge(): boolean {
    return this.probability() !== DEFAULT_RULE_PROBABILITY;
  }

  /**
   * Applies outcome edits to the rule.
   *
   * @public
   * @param {BecomeChangeEvent} event outcome change event.
   */
  public onBecomeChanged(event: BecomeChangeEvent): void {
    if (!this.rule.muted) {
      this.becomeInvalid = event.invalid;
      this.updateRule(rule => {
        rule.become = event.become;
        delete rule.tribe;
      });
    }
  }

  /**
   * Updates derived outcome state.
   *
   * @public
   * @param {BecomeStateChangeEvent} event outcome state event.
   */
  public onBecomeStateChanged(event: BecomeStateChangeEvent): void {
    this.becomeInvalid = event.invalid;
    this.emitRuleState();
  }

  /**
   * Applies clause edits to the rule.
   *
   * @public
   * @param {ClauseChangeEvent} event clause change event.
   */
  public onClauseChanged(event: ClauseChangeEvent): void {
    this.clauseInvalid = event.invalid;
    this.updateRule(rule => (rule.clause = event.clause));
  }

  /**
   * Updates derived clause state.
   *
   * @public
   * @param {ClauseStateChangeEvent} event clause state event.
   */
  public onClauseStateChanged(event: ClauseStateChangeEvent): void {
    this.clauseInvalid = event.invalid;
    this.emitRuleState();
  }

  /**
   * Applies probability edits to the rule.
   *
   * @public
   * @param {string | number} value probability input value.
   */
  public onProbabilityChanged(value: number | null): void {
    if (!this.rule.muted) {
      if (this.probabilityError) {
        this.emitRuleState();
      } else if (value !== null) {
        this.updateRule(rule => (rule.probability = normalizeRuleProbability(value)));
      }
    }
  }

  /**
   * Emits a remove request for the rule.
   *
   * @public
   * @param {Event} event triggering event.
   */
  public onRemove(event: Event): void {
    event.stopPropagation();
    this.removeRule.emit();
  }

  /**
   * Emits a duplicate request for the rule.
   *
   * @public
   * @param {Event} event triggering event.
   */
  public onDuplicate(event: Event): void {
    event.stopPropagation();
    this.duplicateRule.emit();
  }

  /**
   * Toggles the muted state.
   *
   * @public
   * @param {Event} event triggering event.
   */
  public onToggleMute(event: Event): void {
    event.stopPropagation();
    this.updateRule(rule => (rule.muted = !rule.muted));
  }

  /**
   * Emits the drag-handle pointer-down event.
   *
   * @public
   * @param {PointerEvent} event pointer event.
   */
  public onDragHandlePointerDown(event: PointerEvent): void {
    event.stopPropagation();
    this.dragHandlePointerDown.emit();
  }

  /**
   * Marks the card as touched.
   *
   * @public
   */
  public touch(): void {
    this.onTouched();
  }

  /**
   * Applies a rule mutation and emits updates.
   *
   * @private
   * @param {(rule: Rule<Tribe[]>) => void} mutator mutation to apply.
   */
  private updateRule(mutator: (rule: Rule<Tribe[]>) => void): void {
    const nextRule = structuredClone(this.rule);
    mutator(nextRule);
    this.rule = nextRule;
    this.syncProbabilityControlDisabled();
    this.emitRuleChange();
  }

  /**
   * Returns the normalized baseline probability.
   *
   * @private
   * @returns {number} normalized baseline probability.
   */
  private baselineProbability(): number {
    return normalizeRuleProbability(this.baselineRule?.probability);
  }

  /**
   * Emits the current rule and derived state.
   *
   * @private
   */
  private emitRuleChange(): void {
    this.onChange(this.rule);
    this.onValidatorChange();
  }

  /**
   * Emits the current rule state.
   *
   * @private
   */
  private emitRuleState(): void {
    this.onValidatorChange();
  }

  /**
   * Synchronizes probability control disabled state from the rule.
   *
   * @private
   */
  private syncProbabilityControlDisabled(): void {
    if (this.rule.muted && this.probabilityControl.enabled) {
      this.probabilityControl.disable({emitEvent: false});
    } else if (!this.rule.muted && this.probabilityControl.disabled) {
      this.probabilityControl.enable({emitEvent: false});
    }
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
   * @type {(value: Rule<Tribe[]>) => void}
   */
  private onChange: (value: Rule<Tribe[]>) => void = () => undefined;

  /**
   * CVA touched callback.
   *
   * @private
   * @type {() => void}
   */
  private onTouched: () => void = () => undefined;
}
