import {ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {NG_VALUE_ACCESSOR} from '@angular/forms';
import {MatCheckboxChange, MatCheckboxModule} from '@angular/material/checkbox';

import {CvaComponent} from '~gol/core/abstract/cva-component';

/**
 * Checkbox.
 *
 * @class CheckboxComponent
 * @typedef {CheckboxComponent}
 * @extends {CvaComponent<boolean>}
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
export class CheckboxComponent extends CvaComponent<boolean> {
  /**
   * Label.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public label = '';

  /**
   * Tooltip.
   *
   * @public
   * @type {(string | null)}
   */
  @Input()
  public tooltip: string | null = null;

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
  public value = false;

  /**
   * Handles the checkbox change event.
   *
   * @public
   * @param {MatCheckboxChange} event 
   */
  public onCheckboxChange(event: MatCheckboxChange): void {
    this.setValue(event.checked);
    this.checkedChange.emit(this.value);
  }

  /**
   * @inheritdoc
   */
  protected override normalizeValue(value: boolean | null): boolean {
    return value === true;
  }
}
