import {ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';

import {CharFilterDirective} from '~gol/shared/directive/char-filter';

/**
 * Input.
 *
 * @export
 * @class InputComponent
 * @typedef {InputComponent}
 * @implements {ControlValueAccessor}
 */
@Component({
  selector: 'gol-input',
  standalone: true,
  templateUrl: './input.html',
  styleUrl: './input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true
    }
  ],
  imports: [CharFilterDirective]
})
export class InputComponent implements ControlValueAccessor {
  /**
   * Input name.
   *
   * @public
   * @type {!string}
   */
  @Input({required: true})
  public name!: string;

  /**
   * Regex to filter the user input.
   *
   * @public
   * @type {(string | RegExp)}
   */
  @Input()
  public regex: string | RegExp = /.*/;

  /**
   * Input type.
   *
   * @public
   * @type {'text' | 'number' | 'color'}
   */
  @Input()
  public type: 'text' | 'number' | 'color' = 'text';

  /**
   * Placeholder.
   *
   * @public
   * @type {string}
   */
  @Input()
  public placeholder = '';

  /**
   * Whether it's disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public disabled = false;

  /**
   * Emitter for the value change event.
   *
   * @public
   * @readonly
   * @type {EventEmitter<string | number>}
   */
  @Output()
  public readonly valueChange = new EventEmitter<string | number>();

  /**
   * Input value.
   *
   * @public
   * @type {string}
   */
  public value = '';

  /**
   * Allowed input types.
   *
   * @public
   * @readonly
   * @type {'text' | 'color'}
   */
  public get inputType(): 'text' | 'color' {
    return this.type === 'color' ? 'color' : 'text';
  }

  /**
   * @inheritdoc
   */
  public writeValue(value: string | number | null): void {
    if (value === null || value === undefined) {
      this.value = '';
      return;
    }

    this.value = String(value);
  }

  /**
   * @inheritdoc
   */
  public registerOnChange(fn: (value: string | number) => void): void {
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
   * Handles the input event.
   *
   * @public
   * @param {string} rawValue 
   */
  public onInput(rawValue: string): void {
    this.value = rawValue;
    const parsed = this.type === 'number' ? +rawValue : rawValue;
    this.onChange(parsed);
    this.valueChange.emit(parsed);
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
  private onChange: (value: string | number) => void = () => undefined;

  /**
   * Touch callback.
   *
   * @returns {() => void} 
   */
  private onTouched: () => void = () => undefined;
}
