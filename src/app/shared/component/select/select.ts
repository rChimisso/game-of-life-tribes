import {ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {MatFormFieldModule, MatFormFieldAppearance} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';

import {SelectOption, SelectValue} from './model/select';
import {TribeSwatch} from '../tribe-swatch/tribe-swatch';

/**
 * Shared select component.
 *
 * @export
 * @class SelectComponent
 * @typedef {SelectComponent}
 * @implements {ControlValueAccessor}
 */
@Component({
  selector: 'gol-select',
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule, TribeSwatch],
  templateUrl: './select.html',
  styleUrl: './select.scss',
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true
    }
  ]
})
export class SelectComponent implements ControlValueAccessor {
  /**
   * Select options.
   *
   * @public
   * @type {readonly SelectOption[]}
   */
  @Input()
  public options: readonly SelectOption[] = [];

  /**
   * Optional label displayed by the form field.
   *
   * @public
   * @type {string}
   */
  @Input()
  public label = '';

  /**
   * Placeholder shown when no option is selected.
   *
   * @public
   * @type {string}
   */
  @Input()
  public placeholder = '';

  /**
   * Select appearance.
   *
   * @public
   * @type {MatFormFieldAppearance}
   */
  @Input()
  public appearance: MatFormFieldAppearance = 'fill';

  /**
   * Panel class used to style the overlay globally.
   *
   * @public
   * @type {(string | string[])}
   */
  @Input()
  public panelClass: string | string[] = 'gol-select-panel';

  /**
   * Hides the default checkmark indicator in single-selection panels.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public hideSingleSelectionIndicator = true;

  /**
   * Whether it's disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public disabled = false;

  /**
   * Emits when selection changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<SelectValue>}
   */
  @Output()
  public readonly valueChange = new EventEmitter<SelectValue>();

  /**
   * Current select value.
   *
   * @public
   * @type {SelectValue}
   */
  public value: SelectValue = null;

  /**
   * Currently selected option metadata.
   *
   * @public
   * @type {(SelectOption | null)}
   */
  public get selectedOption(): SelectOption | null {
    return this.options.find(option => option.value === this.value) ?? null;
  }

  /**
   * @inheritdoc
   */
  public writeValue(value: SelectValue): void {
    this.value = value ?? null;
  }

  /**
   * @inheritdoc
   */
  public registerOnChange(fn: (value: SelectValue) => void): void {
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
  public setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  /**
   * Handles selection changes.
   *
   * @public
   * @param {SelectValue} value
   */
  public onSelectionChange(value: SelectValue): void {
    this.value = value;
    this.onChange(value);
    this.valueChange.emit(value);
  }

  /**
   * Handles touch interactions.
   *
   * @public
   */
  public touch(): void {
    this.onTouched();
  }

  /**
   * Change callback.
   *
   * @returns {(value: SelectValue) => void}
   */
  private onChange: (value: SelectValue) => void = () => undefined;

  /**
   * Touch callback.
   *
   * @returns {() => void}
   */
  private onTouched: () => void = () => undefined;
}
