import {ChangeDetectionStrategy, Component, forwardRef, Input, OnChanges} from '@angular/core';
import {AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator} from '@angular/forms';

import {TypedChanges} from '~gol/core/model/typed-change';
import {normalizeSelector, selectorSignature, toggleExplicitTribeSelection} from '~gol/feature/home/logic/rule-editor';
import {DIFFERENT_TRIBE_SELECTOR_KIND, TRIBES_SELECTOR_KIND, SAME_TRIBE_SELECTOR_KIND, TIE_SELECTOR_KIND, Tribe, TribeSelector} from '~gol/feature/home/model/rule';
import {SelectOption, SelectValue} from '~gol/shared/component/select/model/select';
import {SelectComponent} from '~gol/shared/component/select/select';
import {TribeSwatch} from '~gol/shared/component/tribe-swatch/tribe-swatch';

/**
 * Selector kind editable in the selector editor.
 *
 * @typedef {TribeSelectorKind}
 */
export type TribeSelectorKind = TribeSelector<Tribe[]>['kind'];

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
   * Selector kinds allowed in this editor.
   *
   * @public
   * @type {TribeSelectorKind[]}
   */
  @Input()
  public allowedKinds: TribeSelectorKind[] = [TRIBES_SELECTOR_KIND, SAME_TRIBE_SELECTOR_KIND, DIFFERENT_TRIBE_SELECTOR_KIND];

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
    if (this.selector.kind === TRIBES_SELECTOR_KIND) {
      selected = [...this.selector.tribes];
    }
    return selected;
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
      this.onValidatorChange();
    }
  }

  /**
   * @inheritdoc
   */
  public writeValue(value: TribeSelector<Tribe[]> | null): void {
    this.selector = normalizeSelector(value ?? this.createSelector(this.allowedKinds[0] ?? TRIBES_SELECTOR_KIND));
  }

  /**
   * @inheritdoc
   */
  public registerOnChange(fn: (value: TribeSelector<Tribe[]>) => void): void {
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
  public setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
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
    this.onValidatorChange = fn;
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
    if (!this.disabled && this.selector.kind === TRIBES_SELECTOR_KIND) {
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
      [TIE_SELECTOR_KIND]: 'Tie'
    };
    return labels[kind];
  }

  /**
   * Emits the current selector and derived state.
   *
   * @private
   */
  private emitSelectorChange(): void {
    this.onChange(this.selector);
    this.onValidatorChange();
    this.onTouched();
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
   * @type {(value: TribeSelector<Tribe[]>) => void}
   */
  private onChange: (value: TribeSelector<Tribe[]>) => void = () => undefined;

  /**
   * CVA touched callback.
   *
   * @private
   * @type {() => void}
   */
  private onTouched: () => void = () => undefined;
}
