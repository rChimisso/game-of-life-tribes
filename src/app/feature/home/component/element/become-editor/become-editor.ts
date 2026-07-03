import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {BecomeChangeEvent, BecomeStateChangeEvent} from '../model/become-event';
import {SelectorChangeEvent} from '../model/selector-event';
import {SelectorEditor} from '../selector-editor/selector-editor';

import {TypedChanges} from '~gol/core/model/typed-change';
import {normalizeSelector, selectorSignature} from '~gol/feature/home/logic/rule-editor';
import {Become, COMBINE_BECOME_KIND, CombinationEntry, DEAD_TRIBE_ID, DIFFERENT_TRIBE_SELECTOR_KIND, TRIBES_SELECTOR_KIND, FIXED_BECOME_KIND, LOOKUP_STRATEGY_KIND, MAJORITY_BECOME_KIND, MINORITY_BECOME_KIND, SAME_BECOME_KIND, SAME_TRIBE_SELECTOR_KIND, TIE_SELECTOR_KIND, Tribe, TribeSelector} from '~gol/feature/home/model/rule';
import {Button} from '~gol/shared/component/button/button';
import {SelectOption, SelectValue} from '~gol/shared/component/select/model/select';
import {SelectComponent} from '~gol/shared/component/select/select';

/**
 * Outcome editor mode.
 *
 * @typedef {BecomeMode}
 */
type BecomeMode = Become<Tribe[]>['kind'];

/**
 * Ranked outcome handled by the same UI.
 *
 * @typedef {RankedBecome}
 */
type RankedBecome = Extract<Become<Tribe[]>, {kind: typeof MAJORITY_BECOME_KIND | typeof MINORITY_BECOME_KIND}>;

/**
 * Combine outcome handled by the lookup table UI.
 *
 * @typedef {CombineBecome}
 */
type CombineBecome = Extract<Become<Tribe[]>, {kind: typeof COMBINE_BECOME_KIND}>;

/**
 * Simplified nested outcome mode.
 *
 * @typedef {NestedBecomeMode}
 */
type NestedBecomeMode = typeof FIXED_BECOME_KIND | typeof SAME_BECOME_KIND | typeof COMBINE_BECOME_KIND;

/**
 * Editable combine target.
 *
 * @typedef {CombineTarget}
 */
type CombineTarget = 'root' | 'tie' | 'fallback';

/**
 * Label shared by fixed outcome controls.
 *
 * @type {"Fixed tribe"}
 */
const FIXED_TRIBE_LABEL = 'Fixed tribe';

/**
 * Maximum number of selector inputs in one combination row.
 *
 * @type {8}
 */
const MAX_COMBINATION_INPUTS = 8;

/**
 * Select value prefix for concrete tribe inputs.
 *
 * @type {"tribe:"}
 */
const TRIBE_INPUT_PREFIX = 'tribe:';

/**
 * Select value for the current-cell tribe input.
 *
 * @type {"selector:same"}
 */
const SAME_INPUT_VALUE = 'selector:same';

/**
 * Select value for tribes different from the current-cell tribe.
 *
 * @type {"selector:different"}
 */
const DIFFERENT_INPUT_VALUE = 'selector:different';

/**
 * Select value for the active ranked candidates.
 *
 * @type {"selector:rank"}
 */
const RANK_INPUT_VALUE = 'selector:rank';

/**
 * Editor for rule outcome expressions.
 *
 * @class BecomeEditor
 * @typedef {BecomeEditor}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-become-editor',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    Button,
    SelectorEditor,
    SelectComponent
  ],
  templateUrl: './become-editor.html',
  styleUrl: './become-editor.scss',
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BecomeEditor implements OnChanges {
  /**
   * Editable outcome expression.
   *
   * @public
   * @type {!Become<Tribe[]>}
   */
  @Input({required: true})
  public become!: Become<Tribe[]>;

  /**
   * Baseline outcome used for dirty-state checks.
   *
   * @public
   * @type {(Become<Tribe[]> | null)}
   */
  @Input()
  public baselineBecome: Become<Tribe[]> | null = null;

  /**
   * Available tribes.
   *
   * @public
   * @type {Tribe[]}
   */
  @Input({required: true})
  public tribes: Tribe[] = [];

  /**
   * Whether editing is disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public disabled = false;

  /**
   * Emits outcome edits with derived state.
   *
   * @public
   * @readonly
   * @type {EventEmitter<BecomeChangeEvent>}
   */
  @Output()
  public readonly becomeChange = new EventEmitter<BecomeChangeEvent>();

  /**
   * Emits dirty and invalid state changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<BecomeStateChangeEvent>}
   */
  @Output()
  public readonly becomeStateChange = new EventEmitter<BecomeStateChangeEvent>();

  /**
   * Outcome mode options.
   *
   * @public
   * @readonly
   * @type {SelectOption[]}
   */
  public readonly modeOptions: SelectOption[] = [
    {value: FIXED_BECOME_KIND, label: FIXED_TRIBE_LABEL},
    {value: SAME_BECOME_KIND, label: 'Same'},
    {value: MAJORITY_BECOME_KIND, label: 'Majority'},
    {value: MINORITY_BECOME_KIND, label: 'Minority'},
    {value: COMBINE_BECOME_KIND, label: 'Combine'}
  ];

  /**
   * Nested behavior options.
   *
   * @public
   * @readonly
   * @type {SelectOption[]}
   */
  public readonly nestedOptions: SelectOption[] = [{value: FIXED_BECOME_KIND, label: FIXED_TRIBE_LABEL}, {value: SAME_BECOME_KIND, label: 'Same'}, {value: COMBINE_BECOME_KIND, label: 'Combine'}];

  /**
   * Selectable tribes for fixed outcomes.
   *
   * @public
   * @readonly
   * @type {SelectOption[]}
   */
  public get tribeSelectOptions(): SelectOption[] {
    return this.tribes.map(tribe => ({
      value: tribe.id,
      label: tribe.id,
      swatchColor: tribe.color
    }));
  }

  /**
   * Whether the outcome differs from its baseline.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get isDirty(): boolean {
    return this.baselineBecome ? JSON.stringify(this.become) !== JSON.stringify(this.baselineBecome) : true;
  }

  /**
   * Whether the outcome is invalid.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get isInvalid(): boolean {
    return this.invalidMessage() !== null;
  }

  /**
   * Fixed tribe selected by the editor.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get fixedTribe(): string {
    return this.become.kind === FIXED_BECOME_KIND ? this.become.tribe : this.defaultTribeId();
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<BecomeEditor>): void {
    if (changes.become || changes.baselineBecome || changes.tribes) {
      this.emitBecomeState();
    }
  }

  /**
   * Returns the primary validation message.
   *
   * @public
   * @returns {(string | null)} validation message.
   */
  public invalidMessage(): string | null {
    return this.validateBecome(this.become);
  }

  /**
   * Sets the outcome mode.
   *
   * @public
   * @param {SelectValue} value selected mode.
   */
  public onSetMode(value: SelectValue): void {
    if (!this.disabled && typeof value === 'string') {
      this.become = this.createBecome(value as BecomeMode);
      this.emitBecomeChange();
    }
  }

  /**
   * Sets the fixed output tribe.
   *
   * @public
   * @param {SelectValue} value selected tribe id.
   */
  public onSetFixedTribe(value: SelectValue): void {
    if (!this.disabled && typeof value === 'string') {
      this.become = {
        kind: FIXED_BECOME_KIND,
        tribe: value
      };
      this.emitBecomeChange();
    }
  }

  /**
   * Updates the ranked source selector.
   *
   * @public
   * @param {SelectorChangeEvent} event selector change event.
   */
  public onSetRankSelector(event: SelectorChangeEvent): void {
    if (!this.disabled && this.isRankedBecome(this.become)) {
      this.become = {
        ...this.become,
        selector: event.selector
      };
      this.emitBecomeChange();
    }
  }

  /**
   * Sets ranked tie behavior.
   *
   * @public
   * @param {SelectValue} value selected nested mode.
   */
  public onSetTieMode(value: SelectValue): void {
    if (!this.disabled && this.isRankedBecome(this.become) && typeof value === 'string') {
      this.become = {
        ...this.become,
        tie: this.createNestedBecome(value as NestedBecomeMode, this.become.selector)
      };
      this.emitBecomeChange();
    }
  }

  /**
   * Sets ranked fallback behavior.
   *
   * @public
   * @param {SelectValue} value selected nested mode.
   */
  public onSetRankFallbackMode(value: SelectValue): void {
    if (!this.disabled && this.isRankedBecome(this.become) && typeof value === 'string') {
      this.become = {
        ...this.become,
        fallback: this.createNestedBecome(value as NestedBecomeMode, this.become.selector)
      };
      this.emitBecomeChange();
    }
  }

  /**
   * Sets a fixed nested tribe.
   *
   * @public
   * @param {'tie' | 'fallback'} target nested target.
   * @param {SelectValue} value selected tribe id.
   */
  public onSetRankNestedFixedTribe(target: 'tie' | 'fallback', value: SelectValue): void {
    if (!this.disabled && this.isRankedBecome(this.become) && typeof value === 'string') {
      this.become = {
        ...this.become,
        [target]: {
          kind: FIXED_BECOME_KIND,
          tribe: value
        }
      };
      this.emitBecomeChange();
    }
  }

  /**
   * Sets combine lookup default fixed tribe.
   *
   * @public
   * @param {CombineTarget} target combine target.
   * @param {SelectValue} value selected tribe id.
   */
  public onSetLookupDefaultTribe(target: CombineTarget, value: SelectValue): void {
    if (!this.disabled && typeof value === 'string') {
      this.updateCombine(target, combine => ({
        ...combine,
        strategy: {
          ...combine.strategy,
          default: {
            kind: FIXED_BECOME_KIND,
            tribe: value
          }
        }
      }));
    }
  }

  /**
   * Adds one lookup row.
   *
   * @public
   * @param {CombineTarget} target combine target.
   */
  public onAddCombinationRow(target: CombineTarget): void {
    if (!this.disabled) {
      const defaultOutputId = this.firstOutputTribeId();
      const defaultInput = this.firstAvailableCombinationInput(target, {
        inputs: [],
        output: defaultOutputId
      });
      this.updateCombine(target, combine => ({
        ...combine,
        strategy: {
          ...combine.strategy,
          entries: [
            ...combine.strategy.entries,
            {
              inputs: [defaultInput ?? this.defaultCombinationInput(target)],
              output: defaultOutputId
            }
          ]
        }
      }));
    }
  }

  /**
   * Removes one lookup row.
   *
   * @public
   * @param {CombineTarget} target combine target.
   * @param {number} index row index.
   */
  public onRemoveCombinationRow(target: CombineTarget, index: number): void {
    if (!this.disabled) {
      this.updateCombine(target, combine => ({
        ...combine,
        strategy: {
          ...combine.strategy,
          entries: combine.strategy.entries.filter((_, rowIndex) => rowIndex !== index)
        }
      }));
    }
  }

  /**
   * Adds one input selector to a lookup row.
   *
   * @public
   * @param {CombineTarget} target combine target.
   * @param {number} rowIndex row index.
   */
  public onAddCombinationInput(target: CombineTarget, rowIndex: number): void {
    if (!this.disabled) {
      this.updateCombinationEntry(target, rowIndex, entry => {
        let nextEntry = entry;
        const nextInput = this.firstAvailableCombinationInput(target, entry);
        if (entry.inputs.length < MAX_COMBINATION_INPUTS && nextInput) {
          nextEntry = {
            ...entry,
            inputs: [...entry.inputs, nextInput]
          };
        }
        return nextEntry;
      });
    }
  }

  /**
   * Removes one input selector from a lookup row.
   *
   * @public
   * @param {CombineTarget} target combine target.
   * @param {number} rowIndex row index.
   * @param {number} inputIndex input index.
   */
  public onRemoveCombinationInput(target: CombineTarget, rowIndex: number, inputIndex: number): void {
    if (!this.disabled) {
      this.updateCombinationEntry(target, rowIndex, entry => {
        let nextEntry = entry;
        if (entry.inputs.length > 1) {
          nextEntry = {
            ...entry,
            inputs: entry.inputs.filter((_, index) => index !== inputIndex)
          };
        }
        return nextEntry;
      });
    }
  }

  /**
   * Sets a lookup row input selector.
   *
   * @public
   * @param {CombineTarget} target combine target.
   * @param {number} rowIndex row index.
   * @param {number} inputIndex input index.
   * @param {SelectValue} value selected input value.
   */
  public onSetCombinationInput(target: CombineTarget, rowIndex: number, inputIndex: number, value: SelectValue): void {
    if (!this.disabled && typeof value === 'string') {
      this.updateCombinationEntry(target, rowIndex, entry => {
        const inputs = [...entry.inputs];
        inputs[inputIndex] = this.createCombinationInput(value, target);
        return {
          ...entry,
          inputs
        };
      });
    }
  }

  /**
   * Sets a lookup row output.
   *
   * @public
   * @param {CombineTarget} target combine target.
   * @param {number} rowIndex row index.
   * @param {SelectValue} value selected tribe id.
   */
  public onSetCombinationOutput(target: CombineTarget, rowIndex: number, value: SelectValue): void {
    if (!this.disabled && typeof value === 'string') {
      this.updateCombinationEntry(target, rowIndex, entry => ({
        ...entry,
        output: value
      }));
    }
  }

  /**
   * Returns whether another input can be added to a row.
   *
   * @public
   * @param {CombineTarget} target combine target.
   * @param {CombinationEntry<Tribe[]>} entry combination row.
   * @returns {boolean} whether an input can be added.
   */
  public canAddCombinationInput(target: CombineTarget, entry: CombinationEntry<Tribe[]>): boolean {
    return entry.inputs.length < MAX_COMBINATION_INPUTS && this.firstAvailableCombinationInput(target, entry) !== null;
  }

  /**
   * Returns the select value for a combination input selector.
   *
   * @public
   * @param {TribeSelector<Tribe[]>} input input selector.
   * @returns {string} select value.
   */
  public combinationInputValue(input: TribeSelector<Tribe[]>): string {
    const selector = normalizeSelector(input);
    let value: string;
    switch (selector.kind) {
      case SAME_TRIBE_SELECTOR_KIND:
        value = SAME_INPUT_VALUE;
        break;
      case DIFFERENT_TRIBE_SELECTOR_KIND:
        value = DIFFERENT_INPUT_VALUE;
        break;
      case TIE_SELECTOR_KIND:
        value = RANK_INPUT_VALUE;
        break;
      case TRIBES_SELECTOR_KIND:
        value = `${TRIBE_INPUT_PREFIX}${selector.tribes[0]}`;
        break;
    }
    return value;
  }

  /**
   * Returns the available combination input options for a target.
   *
   * @public
   * @param {CombineTarget} target combine target.
   * @param {CombinationEntry<Tribe[]>} entry combination row.
   * @param {number} inputIndex active input index.
   * @returns {SelectOption[]} input options.
   */
  public combinationInputOptions(target: CombineTarget, entry: CombinationEntry<Tribe[]>, inputIndex: number): SelectOption[] {
    const selectedValues = new Set(entry.inputs.map((input, index) => index === inputIndex ? null : this.combinationInputValue(input)).filter(value => value !== null));
    const options = this.allCombinationInputOptions(this.rankedContext(target));
    return options.filter(option => typeof option.value !== 'string' || !selectedValues.has(option.value));
  }

  /**
   * Returns the mode represented by a nested outcome.
   *
   * @public
   * @param {Become<Tribe[]> | undefined} become nested outcome.
   * @returns {NestedBecomeMode} nested mode.
   */
  public nestedMode(become: Become<Tribe[]> | undefined): NestedBecomeMode {
    let mode: NestedBecomeMode = FIXED_BECOME_KIND;
    if (become) {
      switch (become.kind) {
        case COMBINE_BECOME_KIND:
          mode = COMBINE_BECOME_KIND;
          break;
        case SAME_BECOME_KIND:
          mode = SAME_BECOME_KIND;
          break;
        case FIXED_BECOME_KIND:
        case MAJORITY_BECOME_KIND:
        case MINORITY_BECOME_KIND:
          mode = FIXED_BECOME_KIND;
          break;
      }
    }
    return mode;
  }

  /**
   * Returns the fixed tribe represented by a nested outcome.
   *
   * @public
   * @param {Become<Tribe[]> | undefined} become nested outcome.
   * @returns {string} fixed tribe id.
   */
  public nestedFixedTribe(become: Become<Tribe[]> | undefined): string {
    return become?.kind === FIXED_BECOME_KIND ? become.tribe : DEAD_TRIBE_ID;
  }

  /**
   * Returns the fixed default tribe for a lookup strategy.
   *
   * @public
   * @param {CombineBecome} combine combine outcome.
   * @returns {string} fixed default tribe.
   */
  public lookupDefaultTribe(combine: CombineBecome): string {
    let tribe = DEAD_TRIBE_ID;
    if (combine.strategy.default?.kind === FIXED_BECOME_KIND) {
      tribe = combine.strategy.default.tribe;
    }
    return tribe;
  }

  /**
   * Returns whether a nested outcome has an editable fixed tribe select.
   *
   * @public
   * @param {Become<Tribe[]> | undefined} become nested outcome.
   * @returns {boolean} whether it is fixed.
   */
  public showsNestedFixedTribe(become: Become<Tribe[]> | undefined): boolean {
    return this.nestedMode(become) === FIXED_BECOME_KIND;
  }

  /**
   * Returns the label for a ranked selector row.
   *
   * @public
   * @param {RankedBecome} become ranked outcome.
   * @returns {string} selector label.
   */
  public rankSelectorLabel(become: RankedBecome): string {
    return become.kind === MAJORITY_BECOME_KIND ? 'Majority of' : 'Minority of';
  }

  /**
   * Whether the current outcome is majority or minority.
   *
   * @public
   * @param {Become<Tribe[]>} become outcome.
   * @returns {become is RankedBecome} whether the outcome is ranked.
   */
  public isRankedBecome(become: Become<Tribe[]>): become is RankedBecome {
    return become.kind === MAJORITY_BECOME_KIND || become.kind === MINORITY_BECOME_KIND;
  }

  /**
   * Emits the current outcome and derived state.
   *
   * @private
   */
  private emitBecomeChange(): void {
    const dirty = this.isDirty;
    const invalid = this.isInvalid;
    this.becomeChange.emit({
      become: this.become,
      dirty,
      invalid
    });
    this.becomeStateChange.emit({
      dirty,
      invalid
    });
  }

  /**
   * Emits the current outcome state.
   *
   * @private
   */
  private emitBecomeState(): void {
    this.becomeStateChange.emit({
      dirty: this.isDirty,
      invalid: this.isInvalid
    });
  }

  /**
   * Creates an outcome for one mode.
   *
   * @private
   * @param {BecomeMode} mode outcome mode.
   * @returns {Become<Tribe[]>} outcome expression.
   */
  private createBecome(mode: BecomeMode): Become<Tribe[]> {
    const defaultId = this.defaultTribeId();
    const defaultSelector = this.explicitSelector(defaultId);
    let become: Become<Tribe[]>;
    switch (mode) {
      case SAME_BECOME_KIND:
        become = {kind: SAME_BECOME_KIND};
        break;
      case MAJORITY_BECOME_KIND:
      case MINORITY_BECOME_KIND:
        become = {
          kind: mode,
          selector: defaultSelector,
          tie: this.createNestedBecome(COMBINE_BECOME_KIND, defaultSelector),
          fallback: {
            kind: FIXED_BECOME_KIND,
            tribe: DEAD_TRIBE_ID
          }
        };
        break;
      case COMBINE_BECOME_KIND:
        become = this.createCombineBecome();
        break;
      case FIXED_BECOME_KIND:
        become = {
          kind: FIXED_BECOME_KIND,
          tribe: defaultId
        };
        break;
    }
    return become;
  }

  /**
   * Creates a nested outcome.
   *
   * @private
   * @param {NestedBecomeMode} mode nested mode.
   * @param {TribeSelector<Tribe[]>} sourceSelector source selector.
   * @returns {Become<Tribe[]>} nested outcome.
   */
  private createNestedBecome(mode: NestedBecomeMode, sourceSelector: TribeSelector<Tribe[]>): Become<Tribe[]> {
    let become: Become<Tribe[]>;
    switch (mode) {
      case SAME_BECOME_KIND:
        become = {kind: SAME_BECOME_KIND};
        break;
      case COMBINE_BECOME_KIND:
        become = this.createCombineBecome(sourceSelector);
        break;
      case FIXED_BECOME_KIND:
        become = {
          kind: FIXED_BECOME_KIND,
          tribe: DEAD_TRIBE_ID
        };
        break;
    }
    return become;
  }

  /**
   * Creates a combine outcome.
   *
   * @private
   * @param {TribeSelector<Tribe[]>} sourceSelector source selector.
   * @returns {CombineBecome} combine outcome.
   */
  private createCombineBecome(sourceSelector?: TribeSelector<Tribe[]>): CombineBecome {
    const entries: CombinationEntry<Tribe[]>[] = [];
    if (sourceSelector) {
      entries.push({
        inputs: [this.rankSelector(sourceSelector)],
        output: this.firstOutputTribeId()
      });
    }
    return {
      kind: COMBINE_BECOME_KIND,
      strategy: {
        kind: LOOKUP_STRATEGY_KIND,
        entries,
        default: {
          kind: FIXED_BECOME_KIND,
          tribe: DEAD_TRIBE_ID
        }
      }
    };
  }

  /**
   * Creates an explicit tribe selector.
   *
   * @private
   * @param {string} tribeId tribe id.
   * @returns {TribeSelector<Tribe[]>} selector.
   */
  private explicitSelector(tribeId: string): TribeSelector<Tribe[]> {
    return {
      kind: TRIBES_SELECTOR_KIND,
      tribes: [tribeId]
    };
  }

  /**
   * Creates a selector for the active ranked candidates.
   *
   * @private
   * @param {TribeSelector<Tribe[]>} sourceSelector ranked source selector.
   * @returns {TribeSelector<Tribe[]>} ranked selector.
   */
  private rankSelector(sourceSelector: TribeSelector<Tribe[]>): TribeSelector<Tribe[]> {
    return {
      kind: TIE_SELECTOR_KIND,
      source: normalizeSelector(sourceSelector)
    };
  }

  /**
   * Creates a combination input selector from a select value.
   *
   * @private
   * @param {string} value selected value.
   * @param {CombineTarget} target combine target.
   * @returns {TribeSelector<Tribe[]>} input selector.
   */
  private createCombinationInput(value: string, target: CombineTarget): TribeSelector<Tribe[]> {
    let selector: TribeSelector<Tribe[]>;
    if (value === SAME_INPUT_VALUE) {
      selector = {kind: SAME_TRIBE_SELECTOR_KIND};
    } else if (value === DIFFERENT_INPUT_VALUE) {
      selector = {kind: DIFFERENT_TRIBE_SELECTOR_KIND};
    } else if (value === RANK_INPUT_VALUE && this.rankedContext(target)) {
      selector = this.rankSelector(this.rankedContext(target)!.selector);
    } else if (value.startsWith(TRIBE_INPUT_PREFIX)) {
      selector = this.explicitSelector(value.slice(TRIBE_INPUT_PREFIX.length));
    } else {
      selector = this.defaultCombinationInput(target);
    }
    return selector;
  }

  /**
   * Creates the default input for a combination target.
   *
   * @private
   * @param {CombineTarget} target combine target.
   * @returns {TribeSelector<Tribe[]>} default input selector.
   */
  private defaultCombinationInput(target: CombineTarget): TribeSelector<Tribe[]> {
    const ranked = this.rankedContext(target);
    let selector: TribeSelector<Tribe[]>;
    if (ranked) {
      selector = this.rankSelector(ranked.selector);
    } else {
      selector = this.explicitSelector(this.defaultTribeId());
    }
    return selector;
  }

  /**
   * Returns the first selectable input not already used in a row.
   *
   * @private
   * @param {CombineTarget} target combine target.
   * @param {CombinationEntry<Tribe[]>} entry combination row.
   * @returns {(TribeSelector<Tribe[]> | null)} first available input.
   */
  private firstAvailableCombinationInput(target: CombineTarget, entry: CombinationEntry<Tribe[]>): TribeSelector<Tribe[]> | null {
    const selectedValues = new Set(entry.inputs.map(input => this.combinationInputValue(input)));
    const option = this.allCombinationInputOptions(this.rankedContext(target)).find(candidate => typeof candidate.value === 'string' && !selectedValues.has(candidate.value));
    let selector: TribeSelector<Tribe[]> | null = null;
    if (typeof option?.value === 'string') {
      selector = this.createCombinationInput(option.value, target);
    }
    return selector;
  }

  /**
   * Returns all possible combination input options for a ranked context.
   *
   * @private
   * @param {(RankedBecome | null)} ranked ranked context.
   * @returns {SelectOption[]} input options.
   */
  private allCombinationInputOptions(ranked: RankedBecome | null): SelectOption[] {
    const options = this.combinationTribeOptions(ranked);
    options.push(
      {value: SAME_INPUT_VALUE, label: 'Same'},
      {value: DIFFERENT_INPUT_VALUE, label: 'Different'}
    );
    if (ranked) {
      options.push({
        value: RANK_INPUT_VALUE,
        label: ranked.kind === MAJORITY_BECOME_KIND ? 'Majority' : 'Minority'
      });
    }
    return options;
  }

  /**
   * Returns the ranked context for a nested combine target.
   *
   * @private
   * @param {CombineTarget} target combine target.
   * @returns {(RankedBecome | null)} ranked context.
   */
  private rankedContext(target: CombineTarget): RankedBecome | null {
    let ranked: RankedBecome | null = null;
    if (target !== 'root' && this.isRankedBecome(this.become)) {
      ranked = this.become;
    }
    return ranked;
  }

  /**
   * Returns tribe options for a combination input.
   *
   * @private
   * @param {(RankedBecome | null)} ranked ranked context.
   * @returns {SelectOption[]} tribe input options.
   */
  private combinationTribeOptions(ranked: RankedBecome | null): SelectOption[] {
    const allowedIds = ranked?.selector.kind === TRIBES_SELECTOR_KIND ? new Set(ranked.selector.tribes) : null;
    return this.tribes.filter(tribe => !allowedIds || allowedIds.has(tribe.id) || tribe.id === DEAD_TRIBE_ID).map(tribe => ({
      value: `${TRIBE_INPUT_PREFIX}${tribe.id}`,
      label: tribe.id,
      swatchColor: tribe.color
    }));
  }

  /**
   * Updates one combination entry.
   *
   * @private
   * @param {CombineTarget} target combine target.
   * @param {number} rowIndex row index.
   * @param {(entry: CombinationEntry<Tribe[]>) => CombinationEntry<Tribe[]>} mutator row mutator.
   */
  private updateCombinationEntry(target: CombineTarget, rowIndex: number, mutator: (entry: CombinationEntry<Tribe[]>) => CombinationEntry<Tribe[]>): void {
    this.updateCombine(target, combine => ({
      ...combine,
      strategy: {
        ...combine.strategy,
        entries: combine.strategy.entries.map((entry, index) => index === rowIndex ? mutator(entry) : entry)
      }
    }));
  }

  /**
   * Updates a combine outcome at the requested target.
   *
   * @private
   * @param {CombineTarget} target combine target.
   * @param {(combine: CombineBecome) => CombineBecome} mutator combine mutation.
   */
  private updateCombine(target: CombineTarget, mutator: (combine: CombineBecome) => CombineBecome): void {
    if (target === 'root' && this.become.kind === COMBINE_BECOME_KIND) {
      this.become = mutator(this.become);
      this.emitBecomeChange();
    } else if (target !== 'root' && this.isRankedBecome(this.become)) {
      const nested = target === 'tie' ? this.become.tie : this.become.fallback;
      if (nested?.kind === COMBINE_BECOME_KIND) {
        this.become = {
          ...this.become,
          [target]: mutator(nested)
        };
        this.emitBecomeChange();
      }
    }
  }

  /**
   * Validates an outcome expression.
   *
   * @private
   * @param {Become<Tribe[]>} become outcome expression.
   * @param {(RankedBecome | null)} rankedContext ranked context.
   * @returns {(string | null)} validation message.
   */
  private validateBecome(become: Become<Tribe[]>, rankedContext: RankedBecome | null = null): string | null {
    const knownIds = new Set(this.tribes.map(tribe => tribe.id));
    let message: string | null = null;
    switch (become.kind) {
      case FIXED_BECOME_KIND:
        if (!knownIds.has(become.tribe)) {
          message = 'Choose a valid fixed tribe.';
        }
        break;
      case MAJORITY_BECOME_KIND:
      case MINORITY_BECOME_KIND:
        message = this.validateSelector(become.selector) ?? (become.tie ? this.validateBecome(become.tie, become) : 'Choose a tie behavior.') ?? (become.fallback ? this.validateBecome(become.fallback, become) : 'Choose a fallback.');
        break;
      case COMBINE_BECOME_KIND:
        message = this.validateCombine(become, rankedContext);
        break;
    }
    return message;
  }

  /**
   * Validates a selector expression.
   *
   * @private
   * @param {TribeSelector<Tribe[]>} selector selector expression.
   * @returns {(string | null)} validation message.
   */
  private validateSelector(selector: TribeSelector<Tribe[]>): string | null {
    const knownIds = new Set(this.tribes.map(tribe => tribe.id));
    let message: string | null = null;
    switch (selector.kind) {
      case TRIBES_SELECTOR_KIND:
        if (selector.tribes.length === 0) {
          message = 'Choose at least one tribe.';
        } else if (selector.tribes.some(id => !knownIds.has(id))) {
          message = 'Choose only existing tribes.';
        }
        break;
      case TIE_SELECTOR_KIND:
        message = this.validateSelector(selector.source);
        break;
    }
    return message;
  }

  /**
   * Validates a combine outcome.
   *
   * @private
   * @param {CombineBecome} become combine outcome.
   * @param {(RankedBecome | null)} rankedContext ranked context.
   * @returns {(string | null)} validation message.
   */
  private validateCombine(become: CombineBecome, rankedContext: RankedBecome | null): string | null {
    let message: string | null = null;
    const seenRows = new Set<string>();
    for (const entry of become.strategy.entries) {
      const rowMessage = this.validateCombinationEntry(entry, seenRows, rankedContext);
      if (!message && rowMessage) {
        message = rowMessage;
      }
    }
    if (!message && !become.strategy.default) {
      message = 'Choose a combination default.';
    }
    if (!message && become.strategy.default) {
      message = this.validateBecome(become.strategy.default);
    }
    return message;
  }

  /**
   * Validates one combination row.
   *
   * @private
   * @param {CombinationEntry<Tribe[]>} entry combination row.
   * @param {Set<string>} seenRows normalized row keys.
   * @param {(RankedBecome | null)} rankedContext ranked context.
   * @returns {(string | null)} validation message.
   */
  private validateCombinationEntry(entry: CombinationEntry<Tribe[]>, seenRows: Set<string>, rankedContext: RankedBecome | null): string | null {
    const knownIds = new Set(this.tribes.map(tribe => tribe.id));
    const allowedValues = new Set(this.allCombinationInputOptions(rankedContext).map(option => option.value));
    let message: string | null = null;
    if (entry.inputs.length === 0) {
      message = 'Combination rows need at least one input.';
    } else if (entry.inputs.length > MAX_COMBINATION_INPUTS) {
      message = 'Combination rows can use at most eight inputs.';
    } else if (new Set(entry.inputs.map(input => this.combinationInputValue(input))).size !== entry.inputs.length) {
      message = 'Combination rows cannot repeat the same input.';
    } else if (entry.inputs.some(selector => this.validateSelector(selector) !== null) || !knownIds.has(entry.output)) {
      message = 'Combination rows can only reference existing tribes.';
    } else if (entry.inputs.some(selector => !allowedValues.has(this.combinationInputValue(selector)))) {
      message = 'Combination rows can only use inputs available in this context.';
    } else {
      const rowKey = entry.inputs.map(selector => selectorSignature(selector)).sort().join('|');
      if (seenRows.has(rowKey)) {
        message = 'Combination table has duplicate input rows.';
      } else {
        seenRows.add(rowKey);
      }
    }
    return message;
  }

  /**
   * Returns the default tribe id.
   *
   * @private
   * @returns {string} default tribe id.
   */
  private defaultTribeId(): string {
    return this.tribes.find(tribe => tribe.id !== DEAD_TRIBE_ID)?.id ?? DEAD_TRIBE_ID;
  }

  /**
   * Returns the first selectable output tribe id.
   *
   * @private
   * @returns {string} output tribe id.
   */
  private firstOutputTribeId(): string {
    const option = this.tribeSelectOptions.find(candidate => typeof candidate.value === 'string');
    return typeof option?.value === 'string' ? option.value : this.defaultTribeId();
  }
}
