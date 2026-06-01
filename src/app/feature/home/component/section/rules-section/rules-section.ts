import {CdkDragDrop, DragDropModule, moveItemInArray} from '@angular/cdk/drag-drop';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';

import {ApplyRestoreButtons} from '../../../../../shared/component/apply-restore/button-pair';
import {Button} from '../../../../../shared/component/button/button';
import {normalizeClauseForEditor, ruleListsEqual, ruleSignature, toPersistedRule} from '../../../logic/rule-editor';
import {DEAD_TRIBE_ID, EMPTY_CLAUSE, Rule, Tribe} from '../../../model/rule';
import {RuleChangeEvent, RuleStateChangeEvent} from '../../../model/rule-card';
import {UpdateRulesPayload} from '../../../model/sidebar-event';
import {RuleCard} from '../../element/rule-card/rule-card';

import {TypedChanges} from '~gol/core/model/typed-change';

/**
 * Rules editor section.
 *
 * @export
 * @class RulesSection
 * @typedef {RulesSection}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-rules-section',
  standalone: true,
  imports: [
    DragDropModule,
    Button,
    ApplyRestoreButtons,
    RuleCard
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
   * Editable rules.
   *
   * @public
   * @type {Rule<Tribe[]>[]}
   */
  public editRules: Rule<Tribe[]>[] = [];

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
   * Rule state lookup by editable key.
   *
   * @private
   * @readonly
   * @type {Map<string, {dirty: boolean; invalid: boolean}>}
   */
  private readonly ruleStatesByKey = new Map<string, {dirty: boolean; invalid: boolean}>();

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
   * Whether editable rules differ from committed rules.
   *
   * @public
   * @type {boolean}
   */
  public get hasUnappliedRules(): boolean {
    return !ruleListsEqual(this.editRules, this.committedRules);
  }

  /**
   * Whether any editable rule is invalid.
   *
   * @public
   * @type {boolean}
   */
  public get hasInvalidRules(): boolean {
    return this.editRules.some((rule, index) => this.getRuleState(rule, index).invalid);
  }

  /**
   * Creates a rules section.
   *
   * @public
   * @constructor
   * @param {ChangeDetectorRef} cdr
   */
  public constructor(private readonly cdr: ChangeDetectorRef) {}

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
  }

  /**
   * Finds a committed rule by index.
   *
   * @public
   * @param {number} index
   * @returns {(Rule<Tribe[]> | null)}
   */
  public baselineRule(index: number): Rule<Tribe[]> | null {
    return this.committedRules[index] ?? null;
  }

  /**
   * Adds a new editable rule.
   *
   * @public
   */
  public onAddRule(): void {
    const newRule = {
      key: this.createEditableRuleKey(),
      muted: false,
      clause: EMPTY_CLAUSE,
      tribe: this.defaultTribeId()
    };
    this.editRules.push(newRule);
    this.ruleStatesByKey.set(this.ruleStateKey(newRule, this.editRules.length - 1), {dirty: true, invalid: true});
    this.expandedRuleIndex = this.editRules.length - 1;
  }

  /**
   * Removes an editable rule.
   *
   * @public
   * @param {number} index
   */
  public onRemoveRule(index: number): void {
    const removedRule = this.editRules[index];
    this.editRules.splice(index, 1);
    if (removedRule) {
      this.ruleStatesByKey.delete(this.ruleStateKey(removedRule, index));
    }
    this.pruneRuleStates();
    if (this.expandedRuleIndex === index) {
      this.expandedRuleIndex = null;
    } else if (this.expandedRuleIndex !== null && this.expandedRuleIndex > index) {
      this.expandedRuleIndex--;
    }
  }

  /**
   * Duplicates an editable rule.
   *
   * @public
   * @param {number} index
   */
  public onDuplicateRule(index: number): void {
    const rule = this.editRules[index];
    if (rule) {
      const clonedRule = structuredClone(rule);
      clonedRule.key = this.createEditableRuleKey();
      clonedRule.muted = !!clonedRule.muted;
      this.editRules.splice(index + 1, 0, clonedRule);
      this.ruleStatesByKey.set(this.ruleStateKey(clonedRule, index + 1), {dirty: true, invalid: true});
      if (this.expandedRuleIndex !== null && this.expandedRuleIndex > index) {
        this.expandedRuleIndex++;
      }
      this.expandedRuleIndex = index + 1;
    }
  }

  /**
   * Starts a rule drag session.
   *
   * @public
   * @param {number} index
   */
  public onRuleDragStarted(index: number): void {
    this.draggingRuleIndex = index;
    this.beginRuleDragSession();
  }

  /**
   * Starts a drag session from the rule handle.
   *
   * @public
   * @param {number} index
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
   * @param {CdkDragDrop<Rule<Tribe[]>[]>} event
   */
  public onRuleDropped(event: CdkDragDrop<Rule<Tribe[]>[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      moveItemInArray(this.editRules, event.previousIndex, event.currentIndex);
      this.pruneRuleStates();
    }
    this.draggingRuleIndex = null;
    this.restoreExpandedRuleAfterReorder();
  }

  /**
   * Toggles a rule expansion panel.
   *
   * @public
   * @param {number} index
   */
  public onToggleRuleExpand(index: number): void {
    this.expandedRuleIndex = this.expandedRuleIndex === index ? null : index;
  }

  /**
   * Handles changed rule content.
   *
   * @public
   * @param {RuleChangeEvent} event
   */
  public onRuleChanged(event: RuleChangeEvent): void {
    const currentRule = this.editRules[event.index];
    if (currentRule) {
      this.editRules[event.index] = {...event.rule, key: currentRule.key};
      this.ruleStatesByKey.set(this.ruleStateKey(this.editRules[event.index]!, event.index), {dirty: event.dirty, invalid: event.invalid});
      this.pruneRuleStates();
    }
  }

  /**
   * Handles rule state changes.
   *
   * @public
   * @param {RuleStateChangeEvent} event
   */
  public onRuleStateChanged(event: RuleStateChangeEvent): void {
    const rule = this.editRules[event.index];
    if (rule) {
      this.ruleStatesByKey.set(this.ruleStateKey(rule, event.index), {dirty: event.dirty, invalid: event.invalid});
    }
  }

  /**
   * Applies pending rule changes.
   *
   * @public
   */
  public onApplyRules(): void {
    if (!(this.hasInvalidRules || !this.hasUnappliedRules)) {
      this.applyRules.emit({
        rules: this.editRules.map(rule => toPersistedRule(rule))
      });
    }
  }

  /**
   * Restores editable rules from committed rules.
   *
   * @public
   */
  public onRestoreRules(): void {
    const previousExpandedRuleKey = this.expandedRuleIndex !== null ? this.editRules[this.expandedRuleIndex]?.key ?? null : null;
    const previousRuleKeyBuckets = this.buildRuleKeyBuckets(this.editRules);
    this.editRules = this.committedRules.map(rule => {
      const signature = ruleSignature(rule);
      const keyBucket = previousRuleKeyBuckets.get(signature);
      const preferredKey = keyBucket && keyBucket.length > 0 ? keyBucket.shift() : undefined;
      return this.toEditableRule(rule, preferredKey);
    });
    this.ruleStatesByKey.clear();
    if (previousExpandedRuleKey) {
      const expandedRuleIndex = this.editRules.findIndex(rule => rule.key === previousExpandedRuleKey);
      this.expandedRuleIndex = expandedRuleIndex >= 0 ? expandedRuleIndex : null;
    } else {
      this.expandedRuleIndex = null;
    }
  }

  /**
   * Synchronizes editable rules from committed rules.
   *
   * @private
   */
  private syncRulesFromCommitted(): void {
    this.editRules = this.committedRules.map(rule => this.toEditableRule(rule));
    this.ruleStatesByKey.clear();
    this.expandedRuleIndex = null;
  }

  /**
   * Converts a committed rule to an editable rule.
   *
   * @private
   * @param {Rule<Tribe[]>} rule
   * @param {string} [preferredKey]
   * @returns {Rule<Tribe[]>}
   */
  private toEditableRule(rule: Rule<Tribe[]>, preferredKey?: string): Rule<Tribe[]> {
    const editableRule = structuredClone(rule);
    editableRule.clause = normalizeClauseForEditor(editableRule.clause);
    editableRule.key = preferredKey ?? this.createEditableRuleKey();
    editableRule.muted = !!editableRule.muted;
    return editableRule;
  }

  /**
   * Restores the expanded rule after a reorder.
   *
   * @private
   */
  private restoreExpandedRuleAfterReorder(): void {
    if (this.expandedRuleKeyBeforeDrag) {
      const expandedIndex = this.editRules.findIndex(rule => rule.key === this.expandedRuleKeyBeforeDrag);
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
      const expandedRule = this.editRules[this.expandedRuleIndex];
      this.expandedRuleKeyBeforeDrag = expandedRule?.key ?? null;
      this.expandedRuleIndex = null;
      this.cdr.detectChanges();
    }
  }

  /**
   * Creates an editable rule key.
   *
   * @private
   * @returns {string}
   */
  private createEditableRuleKey(): string {
    return `editable-rule-${this.nextEditableRuleKey++}`;
  }

  /**
   * Returns the default tribe id for new rules.
   *
   * @private
   * @returns {string}
   */
  private defaultTribeId(): string {
    return this.tribes.find(tribe => tribe.id !== DEAD_TRIBE_ID)?.id ?? DEAD_TRIBE_ID;
  }

  /**
   * Builds a stable rule state key.
   *
   * @private
   * @param {Rule<Tribe[]>} rule
   * @param {number} index
   * @returns {string}
   */
  private ruleStateKey(rule: Rule<Tribe[]>, index: number): string {
    return rule.key ?? `rule-${index}`;
  }

  /**
   * Builds reusable key buckets from editable rules.
   *
   * @private
   * @param {readonly Rule<Tribe[]>[]} rules
   * @returns {Map<string, string[]>}
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
   * Gets the validation state for an editable rule.
   *
   * @private
   * @param {Rule<Tribe[]>} rule
   * @param {number} index
   * @returns {{dirty: boolean; invalid: boolean}}
   */
  private getRuleState(rule: Rule<Tribe[]>, index: number): {dirty: boolean; invalid: boolean} {
    return this.ruleStatesByKey.get(this.ruleStateKey(rule, index)) ?? {dirty: false, invalid: false};
  }

  /**
   * Removes states for rules that no longer exist.
   *
   * @private
   */
  private pruneRuleStates(): void {
    const activeKeys = new Set(this.editRules.map((rule, index) => this.ruleStateKey(rule, index)));
    for (const key of this.ruleStatesByKey.keys()) {
      if (!activeKeys.has(key)) {
        this.ruleStatesByKey.delete(key);
      }
    }
  }
}
