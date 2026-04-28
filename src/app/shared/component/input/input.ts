import {ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';

import {CharFilterDirective} from '~gol/shared/directive/char-filter';

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

  @Input()
  public type: 'text' | 'number' | 'color' = 'text';

  @Input()
  public placeholder = '';

  @Input()
  public disabled = false;

  @Output()
  public readonly valueChange = new EventEmitter<string | number>();

  public value = '';

  public get inputType(): 'text' | 'color' {
    return this.type === 'color' ? 'color' : 'text';
  }

  public writeValue(value: string | number | null): void {
    if (value === null || value === undefined) {
      this.value = '';
      return;
    }

    this.value = String(value);
  }

  public registerOnChange(fn: (value: string | number) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  public onInput(rawValue: string): void {
    this.value = rawValue;
    const parsed = this.type === 'number' ? +rawValue : rawValue;
    this.onChange(parsed);
    this.valueChange.emit(parsed);
  }

  public touch(): void {
    this.onTouched();
  }

  private onChange: (value: string | number) => void = () => undefined;

  private onTouched: () => void = () => undefined;
}
