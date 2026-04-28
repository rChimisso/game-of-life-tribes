import {ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {MatCheckboxChange, MatCheckboxModule} from '@angular/material/checkbox';

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
  @Input({required: true})
  public label = '';

  @Input()
  public disabled = false;

  @Output()
  public readonly checkedChange = new EventEmitter<boolean>();

  public checked = false;

  public writeValue(value: boolean | null): void {
    this.checked = value === true;
  }

  public registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  public onCheckboxChange(event: MatCheckboxChange): void {
    this.checked = event.checked;
    this.onChange(this.checked);
    this.checkedChange.emit(this.checked);
  }

  public touch(): void {
    this.onTouched();
  }

  private onChange: (value: boolean) => void = () => undefined;

  private onTouched: () => void = () => undefined;
}
