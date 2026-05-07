import {ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {MatCheckboxChange, MatCheckboxModule} from '@angular/material/checkbox';

/**
 * Checkbox.
 *
 * @export
 * @class CheckboxComponent
 * @typedef {CheckboxComponent}
 * @implements {ControlValueAccessor}
 */
@Component({
  selector: 'gol-checkbox',
  standalone: true,
  imports: [MatCheckboxModule],
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true
    }
  ]
})
export class CheckboxComponent implements ControlValueAccessor {
  /**
   * Label.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public label = '';

  /**
   * Whether it's disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public disabled = false;

  /**
   * Checkbox size.
   *
   * @public
   * @type {'sm' | 'md'}
   */
  @Input()
  public size: 'sm' | 'md' = 'md';

  /**
   * Emitter for the checked change event.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly checkedChange = new EventEmitter<boolean>();

  /**
   * Whether it's checked.
   *
   * @public
   * @type {boolean}
   */
  public checked = false;

  /**
   * @inheritdoc
   */
  public writeValue(value: boolean | null): void {
    this.checked = value === true;
  }

  /**
   * @inheritdoc
   */
  public registerOnChange(fn: (value: boolean) => void): void {
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
   * Handles the checkbox change event.
   *
   * @public
   * @param {MatCheckboxChange} event 
   */
  public onCheckboxChange(event: MatCheckboxChange): void {
    this.checked = event.checked;
    this.onChange(this.checked);
    this.checkedChange.emit(this.checked);
  }

  /**
   * Handles the blur event.
   *
   * @public
   */
  public touch(): void {
    this.onTouched();
  }

  /**
   * Change callback.
   *
   * @returns {(value: boolean) => void} 
   */
  private onChange: (value: boolean) => void = () => undefined;

  /**
   * Touch callback.
   *
   * @returns {() => void} 
   */
  private onTouched: () => void = () => undefined;
}
