/* eslint-disable jsdoc/require-jsdoc */
import {ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';

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
  ]
})
export class InputComponent implements ControlValueAccessor {
  @Input()
  public type: 'text' | 'number' | 'color' = 'text';

  @Input()
  public placeholder = '';

  @Input()
  public min?: number;

  @Input()
  public max?: number;

  @Input()
  public step?: number | string;

  @Input()
  public inputClass = '';

  @Input()
  public disabled = false;

  @Output()
  public readonly valueChange = new EventEmitter<string | number>();

  public value = '';

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

  public setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  public onInput(rawValue: string): void {
    this.value = rawValue;

    const parsed = this.type === 'number' ? this.toNumber(rawValue) : rawValue;
    this.onChange(parsed);
    this.valueChange.emit(parsed);
  }

  public touch(): void {
    this.onTouched();
  }

  private toNumber(rawValue: string): number {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private onChange: (value: string | number) => void = () => undefined;

  private onTouched: () => void = () => undefined;
}
