import {ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {NG_VALUE_ACCESSOR} from '@angular/forms';
import {MatSlideToggleChange, MatSlideToggleModule} from '@angular/material/slide-toggle';

import {CvaComponent} from '~gol/core/abstract/cva-component';

/**
 * Toggle button.
 *
 * @export
 * @class ToggleButtonComponent
 * @typedef {ToggleButtonComponent}
 * @extends {CvaComponent<boolean>}
 */
@Component({
  selector: 'gol-toggle-button',
  standalone: true,
  imports: [MatSlideToggleModule],
  templateUrl: './toggle-button.html',
  styleUrl: './toggle-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ToggleButtonComponent),
      multi: true
    }
  ]
})
export class ToggleButtonComponent extends CvaComponent<boolean> {
  /**
   * Label.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public label = '';

  /**
   * Button title.
   *
   * @public
   * @type {string}
   */
  @Input()
  public title = '';

  /**
   * Button size.
   *
   * @public
   * @type {'sm' | 'md'}
   */
  @Input()
  public size: 'sm' | 'md' = 'md';

  /**
   * Emitter for the toggled change event.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly toggledChange = new EventEmitter<boolean>();

  /**
   * Whether it's active.
   *
   * @public
   * @type {boolean}
   */
  public value = false;

  /**
   * Handles the slide toggle change event.
   *
   * @public
   * @param {MatSlideToggleChange} event
   */
  public onToggleChange(event: MatSlideToggleChange): void {
    if (!this.disabled) {
      this.setValue(event.checked);
      this.toggledChange.emit(this.value);
    }
  }

  /**
   * @inheritdoc
   */
  protected override normalizeValue(value: boolean | null): boolean {
    return value === true;
  }
}
