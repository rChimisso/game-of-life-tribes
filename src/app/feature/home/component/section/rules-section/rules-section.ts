import {CdkDragDrop, DragDropModule} from '@angular/cdk/drag-drop';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';

import {RuleCard} from '../../element/rule-card/rule-card';

import {BaselineState} from '~gol/core/model/baseline-state';
import {TypedChanges} from '~gol/core/model/typed-change';
import {normalizeClauseForEditor, normalizeRandomSeed, normalizeRule, ruleListsEqual, ruleSignature, toPersistedRule} from '~gol/feature/home/logic/rule-editor';
import {DEAD_TRIBE_ID, EMPTY_CLAUSE, FIXED_BECOME_KIND, MAX_RANDOM_SEED, MIN_RANDOM_SEED, Rule, Tribe} from '~gol/feature/home/model/rule';
import {RulesFormControls} from '~gol/feature/home/model/rules-form';
import {UpdateRulesPayload} from '~gol/feature/home/model/sidebar-event';
import {ApplyRestoreButtons} from '~gol/shared/component/apply-restore/button-pair';
import {Button} from '~gol/shared/component/button/button';
import {NumberInputComponent} from '~gol/shared/component/input/number-input/number-input';

/**
 * Rules editor value tracked by the Apply/Restore baseline.
 *
 * @interface RulesEditorValue
 * @typedef {RulesEditorValue}
 */
interface RulesEditorValue {
  /**
   * Deterministic random seed.
   *
   * @type {(number | null)}
   */
  randomSeed: number | null;
  /**
   * Editable rules.
   *
   * @type {Rule<Tribe[]>[]}
   */
  rules: Rule<Tribe[]>[];
}

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
    rules: new FormArray<FormControl<Rule<Tribe[]>>>([])
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
   * Baseline rules editor value.
   *
   * @private
   * @readonly
   * @type {BaselineState<RulesEditorValue>}
   */
  private readonly baselineRules = new BaselineState<RulesEditorValue>({
    randomSeed: 42,
    rules: []
  });

  /**
   * Destroy ref.
   *
   * @private
   * @readonly
   * @type {DestroyRef}
   */
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Rule form array.
   *
   * @public
   * @readonly
   * @type {FormArray<FormControl<Rule<Tribe[]>>>}
   */
  public get rules(): FormArray<FormControl<Rule<Tribe[]>>> {
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
    return this.baselineRules.hasChanges(this.currentValue(), (baseline, current) => this.editorValuesEqual(baseline, current));
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
    const control = this.form.controls.randomSeed;
    let error: string | null = null;
    if (control.hasError('required')) {
      error = 'Required';
    } else if (control.hasError('min')) {
      error = `Min ${MIN_RANDOM_SEED}`;
    } else if (control.hasError('max')) {
      error = `Max ${MAX_RANDOM_SEED}`;
    } else if (control.hasError('decimalDigits')) {
      error = 'Integer';
    }
    return error;
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
   */
  public constructor(private readonly cdr: ChangeDetectorRef) {
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
   * @returns {(Rule<Tribe[]> | null)} baseline rule.
   */
  public baselineRule(index: number): Rule<Tribe[]> | null {
    return this.baselineRules.value().rules[index] ?? null;
  }

  /**
   * Adds a new editable rule.
   *
   * @public
   */
  public onAddRule(): void {
    const newRule: Rule<Tribe[]> = {
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
    const rule = this.rules.at(index)?.value;
    if (rule) {
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
   * @param {CdkDragDrop<FormControl<Rule<Tribe[]>>[]>} event drop event.
   */
  public onRuleDropped(event: CdkDragDrop<FormControl<Rule<Tribe[]>>[]>): void {
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
      const appliedValue: RulesEditorValue = {
        randomSeed: appliedRandomSeed,
        rules: currentRules.map(rule => toPersistedRule(rule))
      };
      this.baselineRules.set({
        randomSeed: appliedValue.randomSeed,
        rules: appliedValue.rules.map((rule, index) => this.toEditableRule(rule, currentRules[index]?.key))
      });
      this.form.markAsPristine();
      this.form.markAsUntouched();
      this.applyRules.emit({
        randomSeed: appliedRandomSeed,
        rules: appliedValue.rules
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
    this.rebuildForm(this.baselineRules.clone());
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
        const keyBucket = previousRuleKeyBuckets.get(ruleSignature(rule));
        const preferredKey = keyBucket && keyBucket.length > 0 ? keyBucket.shift() : undefined;
        return this.toEditableRule(rule, preferredKey);
      })
    };
    this.baselineRules.set(nextValue);
    this.rebuildForm(nextValue);
    this.expandedRuleIndex = null;
  }

  /**
   * Synchronizes the random seed from committed input.
   *
   * @private
   */
  private syncRandomSeedFromCommitted(): void {
    const previousRuleKeyBuckets = this.buildRuleKeyBuckets(this.currentRules());
    const nextValue: RulesEditorValue = {
      randomSeed: normalizeRandomSeed(this.randomSeed),
      rules: this.committedRules.map(rule => {
        const keyBucket = previousRuleKeyBuckets.get(ruleSignature(rule));
        const preferredKey = keyBucket && keyBucket.length > 0 ? keyBucket.shift() : undefined;
        return this.toEditableRule(rule, preferredKey);
      })
    };
    this.baselineRules.set(nextValue);
    this.form.controls.randomSeed.setValue(nextValue.randomSeed, {emitEvent: false});
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
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.form.updateValueAndValidity({emitEvent: false});
    this.cdr.markForCheck();
  }

  /**
   * Creates one rule control.
   *
   * @private
   * @param {Rule<Tribe[]>} rule editable rule.
   * @returns {FormControl<Rule<Tribe[]>>} rule control.
   */
  private createRuleControl(rule: Rule<Tribe[]>): FormControl<Rule<Tribe[]>> {
    return new FormControl(rule, {nonNullable: true});
  }

  /**
   * Converts a committed rule to an editable rule.
   *
   * @private
   * @param {Rule<Tribe[]>} rule committed rule.
   * @param {string} [preferredKey] preferred key.
   * @returns {Rule<Tribe[]>} editable rule.
   */
  private toEditableRule(rule: Rule<Tribe[]>, preferredKey?: string): Rule<Tribe[]> {
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
   * @returns {Rule<Tribe[]>[]} editable rules.
   */
  private currentRules(): Rule<Tribe[]>[] {
    return this.rules.controls.map(control => control.value);
  }

  /**
   * Builds reusable key buckets from editable rules.
   *
   * @private
   * @param {readonly Rule<Tribe[]>[]} rules editable rules.
   * @returns {Map<string, string[]>} keys grouped by persisted rule signature.
   */
  private buildRuleKeyBuckets(rules: readonly Rule<Tribe[]>[]): Map<string, string[]> {
    const ruleKeyBuckets = new Map<string, string[]>();
    for (const rule of rules) {
      const {key} = rule;
      if (key) {
        const signature = ruleSignature(rule);
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
    return baseline.randomSeed === current.randomSeed && ruleListsEqual(current.rules, baseline.rules);
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
