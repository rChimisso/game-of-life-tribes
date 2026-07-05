import {DragDropModule} from '@angular/cdk/drag-drop';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';

import {BecomeEditor} from '../become-editor/become-editor';
import {RuleClause} from '../clause/clause';
import {BecomeChangeEvent, BecomeStateChangeEvent} from '../model/become-event';
import {ClauseChangeEvent, ClauseStateChangeEvent} from '../model/clause-event';

import {TypedChanges} from '~gol/core/model/typed-change';
import {normalizeBecome, normalizeRuleProbability, rulesEqual} from '~gol/feature/home/logic/rule-editor';
import {Become, COMBINE_BECOME_KIND, DEFAULT_RULE_PROBABILITY, FIXED_BECOME_KIND, MAJORITY_BECOME_KIND, MAX_RULE_PROBABILITY_INPUT, MINORITY_BECOME_KIND, MIN_RULE_PROBABILITY_INPUT, RULE_PROBABILITY_INPUT_SCALE, Rule, SAME_BECOME_KIND, Tribe} from '~gol/feature/home/model/rule';
import {RuleChangeEvent, RuleStateChangeEvent} from '~gol/feature/home/model/rule-card';
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
 */
@Component({
  selector: 'gol-rule-card',
  standalone: true,
  imports: [
    DragDropModule,
    FormsModule,
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RuleCard implements OnChanges {
  /**
   * Editable rule.
   *
   * @public
   * @type {!Rule<Tribe[]>}
   */
  @Input({required: true})
  public rule!: Rule<Tribe[]>;

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
   * @type {EventEmitter<number>}
   */
  @Output()
  public readonly toggleExpand = new EventEmitter<number>();

  /**
   * Emits rule removal requests.
   *
   * @public
   * @readonly
   * @type {EventEmitter<number>}
   */
  @Output()
  public readonly removeRule = new EventEmitter<number>();

  /**
   * Emits rule duplication requests.
   *
   * @public
   * @readonly
   * @type {EventEmitter<number>}
   */
  @Output()
  public readonly duplicateRule = new EventEmitter<number>();

  /**
   * Emits rule edits with derived state.
   *
   * @public
   * @readonly
   * @type {EventEmitter<RuleChangeEvent>}
   */
  @Output()
  public readonly ruleChange = new EventEmitter<RuleChangeEvent>();

  /**
   * Emits dirty and invalid state changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<RuleStateChangeEvent>}
   */
  @Output()
  public readonly ruleStateChange = new EventEmitter<RuleStateChangeEvent>();

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
   * Pending scaled probability input value.
   *
   * @public
   * @type {number}
   */
  public pendingProbabilityInput = MAX_RULE_PROBABILITY_INPUT;

  /**
   * Whether the user tried to exceed the probability max while already at the cap.
   *
   * @public
   * @type {boolean}
   */
  public showProbabilityMaxError = false;

  /**
   * Minimum probability input value.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public readonly minRuleProbabilityInput = MIN_RULE_PROBABILITY_INPUT;

  /**
   * Maximum probability input value.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public readonly maxRuleProbabilityInput = MAX_RULE_PROBABILITY_INPUT;

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
   * Whether the rule differs from its baseline.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get isDirty(): boolean {
    let dirty = true;
    if (this.baselineRule) {
      dirty = !rulesEqual(this.rule, this.baselineRule) || this.pendingProbabilityInput !== this.baselineProbabilityInput();
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
    return this.clauseInvalid || this.becomeInvalid || !!this.probabilityError;
  }

  /**
   * Probability validation message.
   *
   * @public
   * @type {(string | null)}
   */
  public get probabilityError(): string | null {
    let error: string | null = null;
    if (this.pendingProbabilityInput < MIN_RULE_PROBABILITY_INPUT) {
      error = `Min ${MIN_RULE_PROBABILITY_INPUT}`;
    } else if (this.showProbabilityMaxError) {
      error = `Max ${MAX_RULE_PROBABILITY_INPUT}`;
    }
    return error;
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<RuleCard>): void {
    if (changes.rule) {
      this.pendingProbabilityInput = this.probabilityInput();
      this.showProbabilityMaxError = false;
    }
    if (changes.rule || changes.baselineRule) {
      this.emitRuleState();
    }
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
   * Returns the probability as an integer scaled percentage.
   *
   * @public
   * @returns {number} scaled probability input.
   */
  public probabilityInput(): number {
    return Math.round(this.probability() * RULE_PROBABILITY_INPUT_SCALE);
  }

  /**
   * Formats the probability percentage for compact display.
   *
   * @public
   * @returns {string} formatted percentage.
   */
  public probabilityLabel(): string {
    const scaledProbability = this.probabilityInput();
    const wholeProbability = Math.trunc(scaledProbability / RULE_PROBABILITY_INPUT_SCALE);
    const fractionalProbability = scaledProbability % RULE_PROBABILITY_INPUT_SCALE;
    const decimalPlaces = RULE_PROBABILITY_INPUT_SCALE.toString().length - 1;
    const fractionLabel = fractionalProbability.toString().padStart(decimalPlaces, '0').replace(/0+$/, '');
    return fractionLabel.length > 0 ? `${wholeProbability}.${fractionLabel}` : `${wholeProbability}`;
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
      const parsedProbability = this.parseIntegerInput(value);
      const wasAtProbabilityMax = this.pendingProbabilityInput >= MAX_RULE_PROBABILITY_INPUT;
      if (parsedProbability > MAX_RULE_PROBABILITY_INPUT) {
        this.pendingProbabilityInput = MAX_RULE_PROBABILITY_INPUT;
        this.showProbabilityMaxError = wasAtProbabilityMax;
      } else {
        this.pendingProbabilityInput = parsedProbability;
        this.showProbabilityMaxError = false;
      }
      if (this.probabilityError) {
        this.emitRuleState();
      } else {
        this.updateRule(rule => (rule.probability = normalizeRuleProbability(this.pendingProbabilityInput / RULE_PROBABILITY_INPUT_SCALE)));
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
    this.removeRule.emit(this.ruleIndex);
  }

  /**
   * Emits a duplicate request for the rule.
   *
   * @public
   * @param {Event} event triggering event.
   */
  public onDuplicate(event: Event): void {
    event.stopPropagation();
    this.duplicateRule.emit(this.ruleIndex);
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
   * Applies a rule mutation and emits updates.
   *
   * @private
   * @param {(rule: Rule<Tribe[]>) => void} mutator mutation to apply.
   */
  private updateRule(mutator: (rule: Rule<Tribe[]>) => void): void {
    const nextRule = structuredClone(this.rule);
    mutator(nextRule);
    this.rule = nextRule;
    this.emitRuleChange();
  }

  /**
   * Returns the baseline probability as a scaled integer input.
   *
   * @private
   * @returns {number} scaled baseline probability.
   */
  private baselineProbabilityInput(): number {
    return Math.round(normalizeRuleProbability(this.baselineRule?.probability) * RULE_PROBABILITY_INPUT_SCALE);
  }

  /**
   * Parses an integer input without applying field bounds.
   *
   * @private
   * @param {(number | null)} value input value.
   * @returns {number} parsed integer.
   */
  private parseIntegerInput(value: number | null): number {
    return Math.round(Number(value) || 0);
  }

  /**
   * Emits the current rule and derived state.
   *
   * @private
   */
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

  /**
   * Emits the current rule state.
   *
   * @private
   */
  private emitRuleState(): void {
    this.ruleStateChange.emit({
      index: this.ruleIndex,
      dirty: this.isDirty,
      invalid: this.isInvalid
    });
  }
}
