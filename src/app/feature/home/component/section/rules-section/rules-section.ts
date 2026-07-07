import {CdkDragDrop, DragDropModule} from '@angular/cdk/drag-drop';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatTooltipModule} from '@angular/material/tooltip';

import {RulesEditorValue} from './model/rules-editor';
import {RuleCard} from '../../element/rule-card/rule-card';

import {firstControlError, numericErrorLimit, resetControlInteractionState} from '~gol/core/function/form-control';
import {FormBaselineController} from '~gol/core/model/form-baseline-controller';
import {TypedChanges} from '~gol/core/model/typed-change';
import {normalizeClauseForEditor, normalizeRandomSeed, normalizeRule, ruleDraftListsEqual, ruleDraftSignature, ruleListsEqual, toPersistedRuleDraft} from '~gol/feature/home/logic/rule-editor';
import {DEAD_TRIBE_ID, EMPTY_CLAUSE, FIXED_BECOME_KIND, MAX_RANDOM_SEED, MIN_RANDOM_SEED, Rule, Tribe} from '~gol/feature/home/model/rule';
import {RuleDraft} from '~gol/feature/home/model/rule-draft';
import {RulesFormControls} from '~gol/feature/home/model/rules-form';
import {UpdateRulesPayload} from '~gol/feature/home/model/sidebar-event';
import {ApplyRestoreButtons} from '~gol/shared/component/apply-restore/button-pair';
import {Button} from '~gol/shared/component/button/button';
import {NumberInputComponent} from '~gol/shared/component/input/number-input/number-input';

/**
 * Rules editor section.
 *
 * @class RulesSection
 * @typedef {RulesSection}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-rules-section',
  standalone: true,
  imports: [
    DragDropModule,
    ReactiveFormsModule,
    MatTooltipModule,
    Button,
    ApplyRestoreButtons,
    RuleCard,
    NumberInputComponent
  ],
  templateUrl: './rules-section.html',
  styleUrl: './rules-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RulesSection implements OnChanges {
  /**
   * Committed rules.
   *
   * @public
   * @type {Rule<Tribe[]>[]}
   */
  @Input({required: true})
  public committedRules: Rule<Tribe[]>[] = [];

  /**
   * Committed deterministic random seed.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public randomSeed = 42;

  /**
   * Available tribes.
   *
   * @public
   * @type {Tribe[]}
   */
  @Input({required: true})
  public tribes: Tribe[] = [];

  /**
   * Whether the simulation is running.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public running = false;

  /**
   * Whether a download is in progress.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public downloading = false;

  /**
   * Emitter for applied rule changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<UpdateRulesPayload>}
   */
  @Output()
  public readonly applyRules = new EventEmitter<UpdateRulesPayload>();

  /**
   * Rules form.
   *
   * @public
   * @readonly
   * @type {FormGroup<RulesFormControls>}
   */
  public readonly form = new FormGroup<RulesFormControls>({
    randomSeed: new FormControl<number | null>(42, {validators: [Validators.required]}),
    rules: new FormArray<FormControl<RuleDraft>>([])
  });

  /**
   * Minimum random seed value.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public readonly minRandomSeed = MIN_RANDOM_SEED;

  /**
   * Maximum random seed value.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public readonly maxRandomSeed = MAX_RANDOM_SEED;

  /**
   * Maximum random seed integer digits.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public readonly maxRandomSeedIntegerDigits = MAX_RANDOM_SEED.toString().length;

  /**
   * Currently dragged rule index.
   *
   * @public
   * @type {(number | null)}
   */
  public draggingRuleIndex: number | null = null;

  /**
   * Currently expanded rule index.
   *
   * @public
   * @type {(number | null)}
   */
  public expandedRuleIndex: number | null = null;

  /**
   * Next editable rule key counter.
   *
   * @private
   * @type {number}
   */
  private nextEditableRuleKey = 0;

  /**
   * Expanded rule key before dragging.
   *
   * @private
   * @type {(string | null)}
   */
  private expandedRuleKeyBeforeDrag: string | null = null;

  /**
   * Baseline coordinator.
   *
   * @private
   * @readonly
   * @type {FormBaselineController<RulesEditorValue>}
   */
  private readonly baselineRules = new FormBaselineController<RulesEditorValue>({
    randomSeed: 42,
    rules: []
  }, this.form, () => this.currentValue(), value => this.rebuildForm(value), (baseline, current) => this.editorValuesEqual(baseline, current));

  /**
   * Rule form array.
   *
   * @public
   * @readonly
   * @type {FormArray<FormControl<RuleDraft>>}
   */
  public get rules(): FormArray<FormControl<RuleDraft>> {
    return this.form.controls.rules;
  }

  /**
   * Whether editable rules differ from committed rules.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get hasUnappliedRules(): boolean {
    return this.baselineRules.hasChanges();
  }

  /**
   * Whether any editable rule setting is invalid.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get hasInvalidRules(): boolean {
    return this.form.invalid;
  }

  /**
   * Random seed validation message.
   *
   * @public
   * @readonly
   * @type {(string | null)}
   */
  public get randomSeedError(): string | null {
    return firstControlError(this.form.controls.randomSeed, [
      ['required', 'Required'],
      ['min', error => `Min ${numericErrorLimit(error, 'min', MIN_RANDOM_SEED)}`],
      ['max', error => `Max ${numericErrorLimit(error, 'max', MAX_RANDOM_SEED)}`],
      ['decimalDigits', 'Integer']
    ]);
  }

  /**
   * Whether Apply is disabled.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get applyDisabled(): boolean {
    return this.running || this.downloading || !this.hasUnappliedRules || this.hasInvalidRules;
  }

  /**
   * Whether Restore is disabled.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get restoreDisabled(): boolean {
    return this.downloading || !this.hasUnappliedRules;
  }

  /**
   * @constructor
   * @public
   * @param {ChangeDetectorRef} cdr change detector.
   * @param {DestroyRef} destroyRef destroy ref for subscriptions.
   */
  public constructor(private readonly cdr: ChangeDetectorRef, private readonly destroyRef: DestroyRef) {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
    this.form.statusChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<RulesSection>): void {
    if (changes.committedRules) {
      const previousRules = changes.committedRules.previousValue;
      if (!(previousRules && ruleListsEqual(previousRules, this.committedRules))) {
        this.syncRulesFromCommitted();
      }
    }
    if (changes.randomSeed) {
      this.syncRandomSeedFromCommitted();
    }
  }

  /**
   * Finds a committed rule by index.
   *
   * @public
   * @param {number} index rule index.
   * @returns {(RuleDraft | null)} baseline rule.
   */
  public baselineRule(index: number): RuleDraft | null {
    return this.baselineRules.baselineValue().rules[index] ?? null;
  }

  /**
   * Adds a new editable rule.
   *
   * @public
   */
  public onAddRule(): void {
    const newRule: RuleDraft = {
      key: this.createEditableRuleKey(),
      muted: false,
      clause: EMPTY_CLAUSE,
      become: {
        kind: FIXED_BECOME_KIND,
        tribe: this.defaultTribeId()
      }
    };
    this.rules.push(this.createRuleControl(newRule));
    this.expandedRuleIndex = this.rules.length - 1;
    this.cdr.markForCheck();
  }

  /**
   * Removes an editable rule.
   *
   * @public
   * @param {number} index rule index.
   */
  public onRemoveRule(index: number): void {
    this.rules.removeAt(index);
    if (this.expandedRuleIndex === index) {
      this.expandedRuleIndex = null;
    } else if (this.expandedRuleIndex !== null && this.expandedRuleIndex > index) {
      this.expandedRuleIndex--;
    }
    this.cdr.markForCheck();
  }

  /**
   * Duplicates an editable rule.
   *
   * @public
   * @param {number} index rule index.
   */
  public onDuplicateRule(index: number): void {
    const control = this.rules.at(index);
    const rule = control?.value;
    if (rule && !control.invalid) {
      const clonedRule = structuredClone(rule);
      clonedRule.key = this.createEditableRuleKey();
      clonedRule.muted = !!clonedRule.muted;
      this.rules.insert(index + 1, this.createRuleControl(clonedRule));
      if (this.expandedRuleIndex !== null && this.expandedRuleIndex > index) {
        this.expandedRuleIndex++;
      }
      this.expandedRuleIndex = index + 1;
      this.cdr.markForCheck();
    }
  }

  /**
   * Starts a rule drag session.
   *
   * @public
   * @param {number} index rule index.
   */
  public onRuleDragStarted(index: number): void {
    this.draggingRuleIndex = index;
    this.beginRuleDragSession();
  }

  /**
   * Starts a drag session from the rule handle.
   *
   * @public
   * @param {number} index rule index.
   */
  public onRuleDragHandlePointerDown(index: number): void {
    this.draggingRuleIndex = index;
    this.beginRuleDragSession();
  }

  /**
   * Ends a rule drag session.
   *
   * @public
   */
  public onRuleDragEnded(): void {
    this.draggingRuleIndex = null;
  }

  /**
   * Handles rule drop reordering.
   *
   * @public
   * @param {CdkDragDrop<FormControl<RuleDraft>[]>} event drop event.
   */
  public onRuleDropped(event: CdkDragDrop<FormControl<RuleDraft>[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      const control = this.rules.at(event.previousIndex);
      this.rules.removeAt(event.previousIndex);
      this.rules.insert(event.currentIndex, control);
      this.rules.updateValueAndValidity();
    }
    this.draggingRuleIndex = null;
    this.restoreExpandedRuleAfterReorder();
    this.cdr.markForCheck();
  }

  /**
   * Toggles a rule expansion panel.
   *
   * @public
   * @param {number} index rule index.
   */
  public onToggleRuleExpand(index: number): void {
    this.expandedRuleIndex = this.expandedRuleIndex === index ? null : index;
  }

  /**
   * Applies pending rule changes.
   *
   * @public
   */
  public onApplyRules(): void {
    if (!this.applyDisabled) {
      const currentRules = this.currentRules();
      const appliedRandomSeed = normalizeRandomSeed(this.form.controls.randomSeed.value ?? this.randomSeed);
      const persistedRules = currentRules.map(rule => toPersistedRuleDraft(rule));
      this.baselineRules.setBaseline({
        randomSeed: appliedRandomSeed,
        rules: currentRules
      });
      resetControlInteractionState(this.form);
      this.applyRules.emit({
        randomSeed: appliedRandomSeed,
        rules: persistedRules
      });
      this.cdr.markForCheck();
    }
  }

  /**
   * Restores editable rules from committed rules.
   *
   * @public
   */
  public onRestoreRules(): void {
    const previousExpandedRuleKey = this.expandedRuleIndex !== null ? this.currentRules()[this.expandedRuleIndex]?.key ?? null : null;
    this.baselineRules.restore();
    if (previousExpandedRuleKey) {
      const expandedRuleIndex = this.currentRules().findIndex(rule => rule.key === previousExpandedRuleKey);
      this.expandedRuleIndex = expandedRuleIndex >= 0 ? expandedRuleIndex : null;
    } else {
      this.expandedRuleIndex = null;
    }
    this.cdr.markForCheck();
  }

  /**
   * Gets one rule key.
   *
   * @public
   * @param {number} index rule index.
   * @returns {string} rule key.
   */
  public ruleKey(index: number): string {
    return this.rules.at(index).value.key ?? `rule-${index}`;
  }

  /**
   * Synchronizes editable rules from committed rules.
   *
   * @private
   */
  private syncRulesFromCommitted(): void {
    const previousRuleKeyBuckets = this.buildRuleKeyBuckets(this.currentRules());
    const nextValue: RulesEditorValue = {
      randomSeed: normalizeRandomSeed(this.randomSeed),
      rules: this.committedRules.map(rule => {
        const editableRule = this.toEditableRule(rule, '');
        const keyBucket = previousRuleKeyBuckets.get(ruleDraftSignature(editableRule));
        const preferredKey = keyBucket && keyBucket.length > 0 ? keyBucket.shift() : undefined;
        editableRule.key = preferredKey ?? this.createEditableRuleKey();
        return editableRule;
      })
    };
    this.baselineRules.syncCommitted(nextValue);
    this.expandedRuleIndex = null;
  }

  /**
   * Synchronizes the random seed from committed input.
   *
   * @private
   */
  private syncRandomSeedFromCommitted(): void {
    const nextRandomSeed = normalizeRandomSeed(this.randomSeed);
    const baseline = this.baselineRules.baselineValue();
    this.form.controls.randomSeed.setValue(nextRandomSeed, {emitEvent: false});
    this.baselineRules.setBaseline({
      randomSeed: nextRandomSeed,
      rules: baseline.rules
    });
  }

  /**
   * Rebuilds the rules form from a value.
   *
   * @private
   * @param {RulesEditorValue} value editor value.
   */
  private rebuildForm(value: RulesEditorValue): void {
    this.form.controls.randomSeed.setValue(value.randomSeed, {emitEvent: false});
    this.rules.clear();
    for (const rule of value.rules) {
      this.rules.push(this.createRuleControl(rule));
    }
    this.form.updateValueAndValidity({emitEvent: false});
    this.cdr.markForCheck();
  }

  /**
   * Resets the Apply/Restore baseline from the current form value.
   *
   * @private
   */
  private resetBaselineFromCurrent(): void {
    this.baselineRules.commitCurrent();
  }

  /**
   * Creates one rule control.
   *
   * @private
   * @param {RuleDraft} rule editable rule.
   * @returns {FormControl<RuleDraft>} rule control.
   */
  private createRuleControl(rule: RuleDraft): FormControl<RuleDraft> {
    return new FormControl(rule, {nonNullable: true});
  }

  /**
   * Converts a committed rule to an editable rule.
   *
   * @private
   * @param {Rule<Tribe[]>} rule committed rule.
   * @param {string} [preferredKey] preferred key.
   * @returns {RuleDraft} editable rule.
   */
  private toEditableRule(rule: Rule<Tribe[]>, preferredKey?: string): RuleDraft {
    const editableRule = normalizeRule(rule);
    editableRule.clause = normalizeClauseForEditor(editableRule.clause);
    editableRule.key = preferredKey ?? this.createEditableRuleKey();
    editableRule.muted = !!editableRule.muted;
    return editableRule;
  }

  /**
   * Gets the current rule values.
   *
   * @private
   * @returns {RuleDraft[]} editable rules.
   */
  private currentRules(): RuleDraft[] {
    return this.rules.controls.map(control => control.value);
  }

  /**
   * Builds reusable key buckets from editable rules.
   *
   * @private
   * @param {readonly RuleDraft[]} rules editable rules.
   * @returns {Map<string, string[]>} keys grouped by persisted rule signature.
   */
  private buildRuleKeyBuckets(rules: readonly RuleDraft[]): Map<string, string[]> {
    const ruleKeyBuckets = new Map<string, string[]>();
    for (const rule of rules) {
      const {key} = rule;
      if (key) {
        const signature = ruleDraftSignature(rule);
        const existingKeys = ruleKeyBuckets.get(signature);
        if (existingKeys) {
          existingKeys.push(key);
        } else {
          ruleKeyBuckets.set(signature, [key]);
        }
      }
    }
    return ruleKeyBuckets;
  }

  /**
   * Gets the current editor value.
   *
   * @private
   * @returns {RulesEditorValue} editor value.
   */
  private currentValue(): RulesEditorValue {
    return {
      randomSeed: this.form.controls.randomSeed.value,
      rules: this.currentRules()
    };
  }

  /**
   * Compares rules editor values.
   *
   * @private
   * @param {RulesEditorValue} baseline baseline value.
   * @param {RulesEditorValue} current current value.
   * @returns {boolean} whether values are equal.
   */
  private editorValuesEqual(baseline: RulesEditorValue, current: RulesEditorValue): boolean {
    return baseline.randomSeed === current.randomSeed && ruleDraftListsEqual(current.rules, baseline.rules);
  }

  /**
   * Restores the expanded rule after a reorder.
   *
   * @private
   */
  private restoreExpandedRuleAfterReorder(): void {
    if (this.expandedRuleKeyBeforeDrag) {
      const expandedIndex = this.currentRules().findIndex(rule => rule.key === this.expandedRuleKeyBeforeDrag);
      this.expandedRuleIndex = expandedIndex >= 0 ? expandedIndex : null;
      this.expandedRuleKeyBeforeDrag = null;
    }
  }

  /**
   * Begins a rule drag session.
   *
   * @private
   */
  private beginRuleDragSession(): void {
    if (this.expandedRuleIndex !== null) {
      const expandedRule = this.currentRules()[this.expandedRuleIndex];
      this.expandedRuleKeyBeforeDrag = expandedRule?.key ?? null;
      this.expandedRuleIndex = null;
      this.cdr.detectChanges();
    }
  }

  /**
   * Creates an editable rule key.
   *
   * @private
   * @returns {string} editable rule key.
   */
  private createEditableRuleKey(): string {
    return `editable-rule-${this.nextEditableRuleKey++}`;
  }

  /**
   * Returns the default tribe id for new rules.
   *
   * @private
   * @returns {string} default tribe id.
   */
  private defaultTribeId(): string {
    return this.tribes.find(tribe => tribe.id !== DEAD_TRIBE_ID)?.id ?? DEAD_TRIBE_ID;
  }
}
