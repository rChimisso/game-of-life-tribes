import {DragDropModule} from '@angular/cdk/drag-drop';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, isDevMode} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

import {BecomeEditor} from '../become-editor/become-editor';
import {RuleClause} from '../clause/clause';
import {BecomeChangeEvent, BecomeStateChangeEvent} from '../model/become-event';
import {ClauseChangeEvent, ClauseStateChangeEvent} from '../model/clause-event';

import {TypedChanges} from '~gol/core/model/typed-change';
import {normalizeBecome, rulesEqual, toPersistedRule} from '~gol/feature/home/logic/rule-editor';
import {Become, Rule, Tribe} from '~gol/feature/home/model/rule';
import {RuleChangeEvent, RuleStateChangeEvent} from '~gol/feature/home/model/rule-card';
import {Button} from '~gol/shared/component/button/button';
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
    BecomeEditor,
    RuleClause,
    Button,
    SummaryComponent,
    TribeSwatch,
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
   * Whether development-only inspection UI should be shown.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public readonly devMode = isDevMode();

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
    if (!this.baselineRule) {
      return true;
    }
    return !rulesEqual(this.rule, this.baselineRule);
  }

  /**
   * Whether the rule is invalid.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get isInvalid(): boolean {
    return this.clauseInvalid || this.becomeInvalid;
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<RuleCard>): void {
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
    return become.kind === 'fixed' ? become.tribe : null;
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
      case 'fixed':
        label = become.tribe;
        break;
      case 'same':
        label = 'Same';
        break;
      case 'majority':
        label = 'Majority';
        break;
      case 'minority':
        label = 'Minority';
        break;
      case 'combine':
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
   * Returns the normalized rule JSON for advanced inspection.
   *
   * @public
   * @returns {string} normalized rule JSON.
   */
  public normalizedRuleJson(): string {
    return JSON.stringify(toPersistedRule(this.rule), null, 2);
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
