import {ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, Input, OnChanges} from '@angular/core';
import {AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator} from '@angular/forms';

import {TribeSelectorKind} from './model/selector-editor';

import {CvaController} from '~gol/core/model/cva-controller';
import {TypedChanges} from '~gol/core/model/typed-change';
import {normalizeSelector, selectorSignature, toggleExplicitTribeSelection} from '~gol/feature/home/logic/rule-editor';
import {DIFFERENT_IN_TRIBE_SELECTOR_KIND, DIFFERENT_TRIBE_SELECTOR_KIND, TRIBES_SELECTOR_KIND, SAME_TRIBE_SELECTOR_KIND, TIE_SELECTOR_KIND, Tribe, TribeSelector} from '~gol/feature/home/model/rule';
import {SelectOption, SelectValue} from '~gol/shared/component/select/model/select';
import {SelectComponent} from '~gol/shared/component/select/select';
import {TribeSwatch} from '~gol/shared/component/tribe-swatch/tribe-swatch';

/**
 * Editor for tribe selector expressions.
 *
 * @class SelectorEditor
 * @typedef {SelectorEditor}
 * @implements {OnChanges}
 * @implements {ControlValueAccessor}
 * @implements {Validator}
 */
@Component({
  selector: 'gol-selector-editor',
  standalone: true,
  imports: [SelectComponent, TribeSwatch],
  templateUrl: './selector-editor.html',
  styleUrl: './selector-editor.scss',
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectorEditor),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SelectorEditor),
      multi: true
    }
  ]
})
export class SelectorEditor implements OnChanges, ControlValueAccessor, Validator {
  /**
   * Editable selector.
   *
   * @public
   * @type {!TribeSelector<Tribe[]>}
   */
  @Input()
  public selector: TribeSelector<Tribe[]> = {
      kind: TRIBES_SELECTOR_KIND,
      tribes: ['']
    };

  /**
   * Baseline selector used for dirty-state checks.
   *
   * @public
   * @type {(TribeSelector<Tribe[]> | null)}
   */
  @Input()
  public baselineSelector: TribeSelector<Tribe[]> | null = null;

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
   * Tooltip.
   *
   * @public
   * @type {string}
   */
  @Input()
  public tooltip = '';

  /**
   * Selector kinds allowed in this editor.
   *
   * @public
   * @type {TribeSelectorKind[]}
   */
  /* eslint-disable indent */
  @Input()
  public allowedKinds: TribeSelectorKind[] = [
    TRIBES_SELECTOR_KIND,
    SAME_TRIBE_SELECTOR_KIND,
    DIFFERENT_TRIBE_SELECTOR_KIND,
    DIFFERENT_IN_TRIBE_SELECTOR_KIND
  ];
  /* eslint-enable indent */

  /**
   * Compound CVA callback controller.
   *
   * @private
   * @readonly
   * @type {CvaController<TribeSelector<Tribe[]>>}
   */
  private readonly cva = new CvaController<TribeSelector<Tribe[]>>();

  /**
   * Human-readable selector mode options.
   *
   * @public
   * @readonly
   * @type {SelectOption[]}
   */
  public get selectorKindOptions(): SelectOption[] {
    return this.allowedKinds.map(kind => ({
      value: kind,
      label: this.selectorKindLabel(kind)
    }));
  }

  /**
   * Selected tribe IDs for the current selector kind.
   *
   * @public
   * @readonly
   * @type {string[]}
   */
  public get selectedTribes(): string[] {
    let selected: string[] = [];
    if (this.usesTribeSubset(this.selector)) {
      selected = [...this.selector.tribes];
    }
    return selected;
  }

  /**
   * Maximum selector tribe swatches placed in one row.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get selectorTribesPerRow(): number {
    const tribeCount = this.tribes.length;
    let perRow = Math.max(1, tribeCount);
    if (tribeCount >= 4) {
      perRow = Math.ceil(tribeCount / 2);
    }
    return perRow;
  }

  /**
   * Whether the selector differs from its baseline.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get isDirty(): boolean {
    return this.baselineSelector ? selectorSignature(this.selector) !== selectorSignature(this.baselineSelector) : true;
  }

  /**
   * Whether the selector is invalid.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get isInvalid(): boolean {
    return this.selectorInvalidMessage() !== null;
  }

  /**
   * Creates the selector editor.
   *
   * @public
   * @constructor
   * @param {ChangeDetectorRef} selectorEditorChangeDetectorRef change detector.
   */
  public constructor(private readonly selectorEditorChangeDetectorRef: ChangeDetectorRef) {}

  /**
   * Validation message for the current selector.
   *
   * @public
   * @returns {(string | null)} validation message.
   */
  public selectorInvalidMessage(): string | null {
    const knownIds = new Set(this.tribes.map(tribe => tribe.id));
    let message: string | null = null;
    switch (this.selector.kind) {
      case TRIBES_SELECTOR_KIND:
      case DIFFERENT_IN_TRIBE_SELECTOR_KIND:
        if (this.selector.tribes.length === 0) {
          message = 'Choose at least one tribe.';
        } else if (this.selector.tribes.some(id => !knownIds.has(id))) {
          message = 'Choose only existing tribes.';
        }
        break;
      case TIE_SELECTOR_KIND:
        message = 'Tie selectors are only available in ranked tie handling.';
        break;
    }
    return message;
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<SelectorEditor>): void {
    if (changes.selector || changes.baselineSelector || changes.tribes || changes.allowedKinds) {
      this.selector = normalizeSelector(this.selector);
      this.cva.emitValidatorChange();
      this.selectorEditorChangeDetectorRef.markForCheck();
    }
  }

  /**
   * @inheritdoc
   */
  public writeValue(value: TribeSelector<Tribe[]> | null): void {
    this.selector = normalizeSelector(value ?? this.createSelector(this.allowedKinds[0] ?? TRIBES_SELECTOR_KIND));
    this.selectorEditorChangeDetectorRef.markForCheck();
  }

  /**
   * @inheritdoc
   */
  public registerOnChange(fn: (value: TribeSelector<Tribe[]>) => void): void {
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
    this.selectorEditorChangeDetectorRef.markForCheck();
  }

  /**
   * @inheritdoc
   */
  public validate(_: AbstractControl<TribeSelector<Tribe[]> | null>): ValidationErrors | null {
    return this.isInvalid ? {selector: true} : null;
  }

  /**
   * @inheritdoc
   */
  public registerOnValidatorChange(fn: () => void): void {
    this.cva.registerOnValidatorChange(fn);
  }

  /**
   * Sets the selector kind.
   *
   * @public
   * @param {SelectValue} value selected kind.
   */
  public onSetSelectorKind(value: SelectValue): void {
    if (!this.disabled && typeof value === 'string') {
      this.selector = this.createSelector(value as TribeSelectorKind);
      this.emitSelectorChange();
    }
  }

  /**
   * Toggles one explicit selector tribe.
   *
   * @public
   * @param {string} tribeId tribe id to toggle.
   */
  public onToggleTribe(tribeId: string): void {
    if (!this.disabled && this.usesTribeSubset(this.selector)) {
      this.selector = {
        ...this.selector,
        tribes: toggleExplicitTribeSelection(this.selector.tribes, tribeId, this.defaultTribeId())
      };
      this.emitSelectorChange();
    }
  }

  /**
   * Whether the given tribe is selected.
   *
   * @public
   * @param {string} tribeId tribe id.
   * @returns {boolean} `true` if selected.
   */
  public isTribeSelected(tribeId: string): boolean {
    return this.selectedTribes.includes(tribeId);
  }

  /**
   * Label for one selector kind.
   *
   * @public
   * @param {TribeSelectorKind} kind selector kind.
   * @returns {string} display label.
   */
  public selectorKindLabel(kind: TribeSelectorKind): string {
    const labels: Record<TribeSelectorKind, string> = {
      [TRIBES_SELECTOR_KIND]: 'Specific tribes',
      [SAME_TRIBE_SELECTOR_KIND]: 'Same',
      [DIFFERENT_TRIBE_SELECTOR_KIND]: 'Different',
      [DIFFERENT_IN_TRIBE_SELECTOR_KIND]: 'Different in',
      [TIE_SELECTOR_KIND]: 'Tie'
    };
    return labels[kind];
  }

  /**
   * Whether a selector has an editable tribe subset.
   *
   * @public
   * @param {TribeSelector<Tribe[]>} selector selector to inspect.
   * @returns {boolean} whether the selector has tribe swatches.
   */
  public usesTribeSubset(selector: TribeSelector<Tribe[]>): selector is Extract<TribeSelector<Tribe[]>, {tribes: [string, ...string[]]}> {
    return selector.kind === TRIBES_SELECTOR_KIND || selector.kind === DIFFERENT_IN_TRIBE_SELECTOR_KIND;
  }

  /**
   * Emits the current selector and derived state.
   *
   * @private
   */
  private emitSelectorChange(): void {
    this.cva.emitChange(this.selector);
    this.cva.emitValidatorChange();
    this.cva.emitTouched();
  }

  /**
   * Creates a selector for one mode.
   *
   * @private
   * @param {TribeSelectorKind} kind selector kind.
   * @returns {TribeSelector<Tribe[]>} selector.
   */
  private createSelector(kind: TribeSelectorKind): TribeSelector<Tribe[]> {
    let selector: TribeSelector<Tribe[]>;
    switch (kind) {
      case TRIBES_SELECTOR_KIND:
      case DIFFERENT_IN_TRIBE_SELECTOR_KIND:
        selector = {
          kind,
          tribes: [this.defaultTribeId()]
        };
        break;
      case TIE_SELECTOR_KIND:
        selector = {
          kind,
          source: {
            kind: TRIBES_SELECTOR_KIND,
            tribes: [this.defaultTribeId()]
          }
        };
        break;
      default:
        selector = {kind};
        break;
    }
    return selector;
  }

  /**
   * Returns the default tribe id.
   *
   * @private
   * @returns {string} default tribe id.
   */
  private defaultTribeId(): string {
    return this.tribes[0]?.id ?? '';
  }
}
