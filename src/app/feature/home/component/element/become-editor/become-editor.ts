import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, Input, OnChanges} from '@angular/core';
import {AbstractControl, ControlValueAccessor, FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR, ReactiveFormsModule, ValidationErrors, Validator} from '@angular/forms';

import {SelectorEditor} from '../selector-editor/selector-editor';
import {BecomeMode, CombineBecome, CombineTarget, FIXED_TRIBE_LABEL, NestedBecomeMode} from './model/become-editor';

import {setControlDisabled} from '~gol/core/function/form-control';
import {CvaController} from '~gol/core/model/cva-controller';
import {TypedChanges} from '~gol/core/model/typed-change';
import {combinationInputValue, combinationTribeIds, isRankedBecome, validateBecomeSemantics} from '~gol/feature/home/logic/become-validation';
import {DIFFERENT_INPUT_VALUE, SAME_INPUT_VALUE, TRIBE_INPUT_PREFIX, type RankedBecome} from '~gol/feature/home/model/become-validation';
import {Become, COMBINE_BECOME_KIND, CombinationEntry, DEAD_TRIBE_ID, DIFFERENT_TRIBE_SELECTOR_KIND, TRIBES_SELECTOR_KIND, FIXED_BECOME_KIND, MAJORITY_BECOME_KIND, MAX_COMBINATION_INPUTS, MINORITY_BECOME_KIND, SAME_BECOME_KIND, SAME_TRIBE_SELECTOR_KIND, Tribe, TribeSelector} from '~gol/feature/home/model/rule';
import {Button} from '~gol/shared/component/button/button';
import {SelectOption, SelectValue} from '~gol/shared/component/select/model/select';
import {SelectComponent} from '~gol/shared/component/select/select';

/**
 * Editor for rule outcome expressions.
 *
 * @class BecomeEditor
 * @typedef {BecomeEditor}
 * @implements {OnChanges}
 * @implements {ControlValueAccessor}
 * @implements {Validator}
 */
@Component({
  selector: 'gol-become-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgTemplateOutlet,
    Button,
    SelectorEditor,
    SelectComponent
  ],
  templateUrl: './become-editor.html',
  styleUrl: './become-editor.scss',
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BecomeEditor),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => BecomeEditor),
      multi: true
    }
  ]
})
export class BecomeEditor implements OnChanges, ControlValueAccessor, Validator {
  /**
   * Editable outcome expression.
   *
   * @public
   * @type {!Become<Tribe[]>}
   */
  @Input()
  public become: Become<Tribe[]> = {
      kind: FIXED_BECOME_KIND,
      tribe: DEAD_TRIBE_ID
    };

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
   * Ranked selector control.
   *
   * @public
   * @readonly
   * @type {FormControl<TribeSelector<Tribe[]>>}
   */
  public readonly rankSelectorControl = new FormControl<TribeSelector<Tribe[]>>({
    kind: TRIBES_SELECTOR_KIND,
    tribes: [DEAD_TRIBE_ID]
  }, {nonNullable: true});

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
   * Combine default behavior options.
   *
   * @public
   * @readonly
   * @type {SelectOption[]}
   */
  public readonly lookupDefaultOptions: SelectOption[] = [{value: FIXED_BECOME_KIND, label: FIXED_TRIBE_LABEL}, {value: SAME_BECOME_KIND, label: 'Same'}];

  /**
   * Compound CVA callback controller.
   *
   * @private
   * @readonly
   * @type {CvaController<Become<Tribe[]>>}
   */
  private readonly cva = new CvaController<Become<Tribe[]>>();

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
   * Creates the outcome editor.
   *
   * @public
   * @constructor
   * @param {ChangeDetectorRef} becomeEditorChangeDetectorRef change detector.
   */
  public constructor(private readonly becomeEditorChangeDetectorRef: ChangeDetectorRef) {
    this.rankSelectorControl.valueChanges.subscribe(selector => this.onSetRankSelector(selector));
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<BecomeEditor>): void {
    if (changes.become || changes.baselineBecome || changes.tribes) {
      this.syncRankSelectorControl();
      this.cva.emitValidatorChange();
      this.becomeEditorChangeDetectorRef.markForCheck();
    }
  }

  /**
   * @inheritdoc
   */
  public writeValue(value: Become<Tribe[]> | null): void {
    this.become = value ? structuredClone(value) : this.createBecome(FIXED_BECOME_KIND);
    this.syncRankSelectorControl();
    this.becomeEditorChangeDetectorRef.markForCheck();
  }

  /**
   * @inheritdoc
   */
  public registerOnChange(fn: (value: Become<Tribe[]>) => void): void {
    this.cva.registerOnChange(fn);
  }

  /**
   * @inheritdoc
   */
  public registerOnTouched(fn: () => void): void {
    this.cva.registerOnTouched(fn);
  }

  /**
   * @inheritdoc
   */
  public setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.syncRankSelectorControl();
    this.becomeEditorChangeDetectorRef.markForCheck();
  }

  /**
   * @inheritdoc
   */
  public validate(_: AbstractControl<Become<Tribe[]> | null>): ValidationErrors | null {
    return this.isInvalid ? {become: true} : null;
  }

  /**
   * @inheritdoc
   */
  public registerOnValidatorChange(fn: () => void): void {
    this.cva.registerOnValidatorChange(fn);
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
   * @param {TribeSelector<Tribe[]>} selector selector expression.
   */
  public onSetRankSelector(selector: TribeSelector<Tribe[]>): void {
    if (!this.disabled && this.isRankedBecome(this.become)) {
      this.become = {
        ...this.become,
        selector
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
        tie: this.createNestedBecome(value as NestedBecomeMode)
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
        fallback: this.createNestedBecome(value as NestedBecomeMode)
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
   * Sets combine lookup default behavior.
   *
   * @public
   * @param {CombineTarget} target combine target.
   * @param {SelectValue} value selected behavior.
   */
  public onSetLookupDefaultMode(target: CombineTarget, value: SelectValue): void {
    if (!this.disabled && value === SAME_BECOME_KIND) {
      this.updateCombine(target, combine => ({...combine, default: {kind: SAME_BECOME_KIND} }));
    } else if (!this.disabled && value === FIXED_BECOME_KIND) {
      this.updateCombine(target, combine => ({
        ...combine,
        default: {
          kind: FIXED_BECOME_KIND,
          tribe: DEAD_TRIBE_ID
        }
      }));
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
        default: {
          kind: FIXED_BECOME_KIND,
          tribe: value
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
        entries: [
          ...combine.entries,
          {
            inputs: [defaultInput ?? this.defaultCombinationInput(target)],
            output: defaultOutputId
          }
        ]
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
        entries: combine.entries.filter((_, rowIndex) => rowIndex !== index)
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
    return combinationInputValue(input);
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
    if (combine.default?.kind === FIXED_BECOME_KIND) {
      tribe = combine.default.tribe;
    }
    return tribe;
  }

  /**
   * Returns the mode represented by a combine default.
   *
   * @public
   * @param {CombineBecome} combine combine outcome.
   * @returns {typeof FIXED_BECOME_KIND | typeof SAME_BECOME_KIND} default mode.
   */
  public lookupDefaultMode(combine: CombineBecome): typeof FIXED_BECOME_KIND | typeof SAME_BECOME_KIND {
    return combine.default?.kind === SAME_BECOME_KIND ? SAME_BECOME_KIND : FIXED_BECOME_KIND;
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
    return isRankedBecome(become);
  }

  /**
   * Emits the current outcome and derived state.
   *
   * @private
   */
  private emitBecomeChange(): void {
    this.syncRankSelectorControl();
    this.cva.emitChange(this.become);
    this.cva.emitValidatorChange();
    this.cva.emitTouched();
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
          tie: {
            kind: FIXED_BECOME_KIND,
            tribe: DEAD_TRIBE_ID
          },
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
   * @returns {Become<Tribe[]>} nested outcome.
   */
  private createNestedBecome(mode: NestedBecomeMode): Become<Tribe[]> {
    let become: Become<Tribe[]>;
    switch (mode) {
      case SAME_BECOME_KIND:
        become = {kind: SAME_BECOME_KIND};
        break;
      case COMBINE_BECOME_KIND:
        become = this.createCombineBecome();
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
   * @returns {CombineBecome} combine outcome.
   */
  private createCombineBecome(): CombineBecome {
    const entries: CombinationEntry<Tribe[]>[] = [];
    return {
      kind: COMBINE_BECOME_KIND,
      entries,
      default: {
        kind: FIXED_BECOME_KIND,
        tribe: DEAD_TRIBE_ID
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
   * @param {CombineTarget} _target combine target.
   * @returns {TribeSelector<Tribe[]>} default input selector.
   */
  private defaultCombinationInput(_target: CombineTarget): TribeSelector<Tribe[]> {
    return this.explicitSelector(this.defaultTribeId());
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
    const options: SelectOption[] = combinationTribeIds(this.tribes, ranked).map(tribeId => ({
      value: `${TRIBE_INPUT_PREFIX}${tribeId}`,
      label: tribeId,
      swatchColor: this.tribes.find(tribe => tribe.id === tribeId)?.color
    }));
    options.push(
      {value: SAME_INPUT_VALUE, label: 'Same'},
      {value: DIFFERENT_INPUT_VALUE, label: 'Different'}
    );
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
      entries: combine.entries.map((entry, index) => index === rowIndex ? mutator(entry) : entry)
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
    return validateBecomeSemantics(become, this.tribes, 'become', rankedContext)[0]?.message ?? null;
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

  /**
   * Synchronizes the ranked selector control.
   *
   * @private
   */
  private syncRankSelectorControl(): void {
    if (this.isRankedBecome(this.become) && this.rankSelectorControl.value !== this.become.selector) {
      this.rankSelectorControl.setValue(this.become.selector, {emitEvent: false});
    }
    setControlDisabled(this.rankSelectorControl, this.disabled);
  }
}
