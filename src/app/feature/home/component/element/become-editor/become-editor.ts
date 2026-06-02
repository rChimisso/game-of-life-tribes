import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {BecomeChangeEvent, BecomeStateChangeEvent} from '../model/become-event';
import {SelectorChangeEvent} from '../model/selector-event';
import {SelectorEditor, TribeSelectorKind} from '../selector-editor/selector-editor';

import {TypedChanges} from '~gol/core/model/typed-change';
import {normalizeSelector, selectorSignature} from '~gol/feature/home/logic/rule-editor';
import {Become, CombinationEntry, DEAD_TRIBE_ID, Tribe, TribeSelector} from '~gol/feature/home/model/rule';
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
type RankedBecome = Extract<Become<Tribe[]>, {kind: 'majority' | 'minority'}>;

/**
 * Combine outcome handled by the lookup table UI.
 *
 * @typedef {CombineBecome}
 */
type CombineBecome = Extract<Become<Tribe[]>, {kind: 'combine'}>;

/**
 * Simplified nested outcome mode.
 *
 * @typedef {NestedBecomeMode}
 */
type NestedBecomeMode = 'fixed' | 'same' | 'combine';

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
    {value: 'fixed', label: FIXED_TRIBE_LABEL},
    {value: 'same', label: 'Same'},
    {value: 'majority', label: 'Majority'},
    {value: 'minority', label: 'Minority'},
    {value: 'combine', label: 'Combine'}
  ];

  /**
   * Nested behavior options.
   *
   * @public
   * @readonly
   * @type {SelectOption[]}
   */
  public readonly nestedOptions: SelectOption[] = [{value: 'fixed', label: FIXED_TRIBE_LABEL}, {value: 'same', label: 'Same'}, {value: 'combine', label: 'Combine'}];

  /**
   * Selector kinds available inside combine rows.
   *
   * @public
   * @readonly
   * @type {TribeSelectorKind[]}
   */
  public readonly combinationInputKinds: TribeSelectorKind[] = ['tribes', 'same', 'different'];

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
    return this.become.kind === 'fixed' ? this.become.tribe : this.defaultTribeId();
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
        kind: 'fixed',
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
          kind: 'fixed',
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
            kind: 'fixed',
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
      const defaultId = this.defaultTribeId();
      this.updateCombine(target, combine => ({
        ...combine,
        strategy: {
          ...combine.strategy,
          entries: [
            ...combine.strategy.entries,
            {
              inputs: [this.explicitSelector(DEAD_TRIBE_ID), this.explicitSelector(defaultId)],
              output: defaultId
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
        if (entry.inputs.length < MAX_COMBINATION_INPUTS) {
          nextEntry = {
            ...entry,
            inputs: [...entry.inputs, this.explicitSelector(this.defaultTribeId())]
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
   * @param {SelectorChangeEvent} event selector change event.
   */
  public onSetCombinationInput(target: CombineTarget, rowIndex: number, inputIndex: number, event: SelectorChangeEvent): void {
    if (!this.disabled) {
      this.updateCombinationEntry(target, rowIndex, entry => {
        const inputs = [...entry.inputs];
        inputs[inputIndex] = event.selector;
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
   * @param {CombinationEntry<Tribe[]>} entry combination row.
   * @returns {boolean} whether an input can be added.
   */
  public canAddCombinationInput(entry: CombinationEntry<Tribe[]>): boolean {
    return entry.inputs.length < MAX_COMBINATION_INPUTS;
  }

  /**
   * Returns the mode represented by a nested outcome.
   *
   * @public
   * @param {Become<Tribe[]> | undefined} become nested outcome.
   * @returns {NestedBecomeMode} nested mode.
   */
  public nestedMode(become: Become<Tribe[]> | undefined): NestedBecomeMode {
    let mode: NestedBecomeMode = 'fixed';
    if (become) {
      switch (become.kind) {
        case 'combine':
          mode = 'combine';
          break;
        case 'same':
          mode = 'same';
          break;
        case 'fixed':
        case 'majority':
        case 'minority':
          mode = 'fixed';
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
    return become?.kind === 'fixed' ? become.tribe : DEAD_TRIBE_ID;
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
    if (combine.strategy.default?.kind === 'fixed') {
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
    return this.nestedMode(become) === 'fixed';
  }

  /**
   * Returns the label for a ranked selector row.
   *
   * @public
   * @param {RankedBecome} become ranked outcome.
   * @returns {string} selector label.
   */
  public rankSelectorLabel(become: RankedBecome): string {
    return become.kind === 'majority' ? 'Majority of' : 'Minority of';
  }

  /**
   * Whether the current outcome is majority or minority.
   *
   * @public
   * @param {Become<Tribe[]>} become outcome.
   * @returns {become is RankedBecome} whether the outcome is ranked.
   */
  public isRankedBecome(become: Become<Tribe[]>): become is RankedBecome {
    return become.kind === 'majority' || become.kind === 'minority';
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
      case 'same':
        become = {kind: 'same'};
        break;
      case 'majority':
      case 'minority':
        become = {
          kind: mode,
          selector: defaultSelector,
          tie: this.createNestedBecome('combine', defaultSelector),
          fallback: {
            kind: 'fixed',
            tribe: DEAD_TRIBE_ID
          }
        };
        break;
      case 'combine':
        become = this.createCombineBecome();
        break;
      case 'fixed':
        become = {
          kind: 'fixed',
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
      case 'same':
        become = {kind: 'same'};
        break;
      case 'combine':
        become = this.createCombineBecome(sourceSelector);
        break;
      case 'fixed':
        become = {
          kind: 'fixed',
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
        inputs: [normalizeSelector(sourceSelector)],
        output: this.defaultTribeId()
      });
    }
    return {
      kind: 'combine',
      strategy: {
        kind: 'lookup',
        entries,
        default: {
          kind: 'fixed',
          tribe: DEAD_TRIBE_ID
        }
      },
      fallback: {
        kind: 'fixed',
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
      kind: 'tribes',
      tribes: [tribeId]
    };
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
    if (target === 'root' && this.become.kind === 'combine') {
      this.become = mutator(this.become);
      this.emitBecomeChange();
    } else if (target !== 'root' && this.isRankedBecome(this.become)) {
      const nested = target === 'tie' ? this.become.tie : this.become.fallback;
      if (nested?.kind === 'combine') {
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
   * @returns {(string | null)} validation message.
   */
  private validateBecome(become: Become<Tribe[]>): string | null {
    const knownIds = new Set(this.tribes.map(tribe => tribe.id));
    let message: string | null = null;
    switch (become.kind) {
      case 'fixed':
        if (!knownIds.has(become.tribe)) {
          message = 'Choose a valid fixed tribe.';
        }
        break;
      case 'majority':
      case 'minority':
        message = this.validateSelector(become.selector) ?? (become.tie ? this.validateBecome(become.tie) : 'Choose a tie behavior.') ?? (become.fallback ? this.validateBecome(become.fallback) : 'Choose a fallback.');
        break;
      case 'combine':
        message = this.validateCombine(become);
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
      case 'tribes':
        if (selector.tribes.length === 0) {
          message = 'Choose at least one tribe.';
        } else if (selector.tribes.some(id => !knownIds.has(id))) {
          message = 'Choose only existing tribes.';
        }
        break;
      case 'tiedMajority':
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
   * @returns {(string | null)} validation message.
   */
  private validateCombine(become: CombineBecome): string | null {
    let message: string | null = null;
    const seenRows = new Set<string>();
    for (const entry of become.strategy.entries) {
      const rowMessage = this.validateCombinationEntry(entry, seenRows);
      if (!message && rowMessage) {
        message = rowMessage;
      }
    }
    if (!message && !become.strategy.default && !become.fallback) {
      message = 'Choose a combination fallback.';
    }
    if (!message && become.strategy.default) {
      message = this.validateBecome(become.strategy.default);
    }
    if (!message && become.fallback) {
      message = this.validateBecome(become.fallback);
    }
    return message;
  }

  /**
   * Validates one combination row.
   *
   * @private
   * @param {CombinationEntry<Tribe[]>} entry combination row.
   * @param {Set<string>} seenRows normalized row keys.
   * @returns {(string | null)} validation message.
   */
  private validateCombinationEntry(entry: CombinationEntry<Tribe[]>, seenRows: Set<string>): string | null {
    const knownIds = new Set(this.tribes.map(tribe => tribe.id));
    let message: string | null = null;
    if (entry.inputs.length === 0) {
      message = 'Combination rows need at least one input.';
    } else if (entry.inputs.length > MAX_COMBINATION_INPUTS) {
      message = 'Combination rows can use at most eight inputs.';
    } else if (entry.inputs.some(selector => this.validateSelector(selector) !== null) || !knownIds.has(entry.output)) {
      message = 'Combination rows can only reference existing tribes.';
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
}
