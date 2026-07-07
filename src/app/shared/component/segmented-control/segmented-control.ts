import {NgStyle} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {NG_VALUE_ACCESSOR} from '@angular/forms';
import {MatTooltipModule} from '@angular/material/tooltip';

import {SelectOption, SelectValue} from '../select/model/select';

import {CvaComponent} from '~gol/core/abstract/cva-component';

/**
 * Segmented control with a sliding selected-state thumb.
 *
 * @class SegmentedControl
 * @typedef {SegmentedControl}
 * @extends {CvaComponent<SelectValue>}
 */
@Component({
  selector: 'gol-segmented-control',
  standalone: true,
  imports: [NgStyle, MatTooltipModule],
  templateUrl: './segmented-control.html',
  styleUrl: './segmented-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SegmentedControl),
      multi: true
    }
  ]
})
export class SegmentedControl extends CvaComponent<SelectValue> {
  /**
   * Segmented options.
   *
   * @public
   * @type {readonly SelectOption[]}
   */
  @Input()
  public options: readonly SelectOption[] = [];

  /**
   * Accessible label.
   *
   * @public
   * @type {string}
   */
  @Input()
  public label = 'Segmented control';

  /**
   * Emitter for selected value changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<SelectValue>}
   */
  @Output()
  public readonly valueChange = new EventEmitter<SelectValue>();

  /**
   * Current selected value.
   *
   * @public
   * @type {SelectValue}
   */
  public value: SelectValue = null;

  /**
   * Inline styles that position the selected-state thumb.
   *
   * @public
   * @readonly
   * @type {Record<string, string>}
   */
  public get controlStyle(): Record<string, string> {
    return {
      '--gol-segment-count': `${Math.max(1, this.options.length)}`,
      '--gol-segment-index': `${Math.max(0, this.selectedIndex)}`
    };
  }

  /**
   * Selected option index.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get selectedIndex(): number {
    const index = this.options.findIndex(option => option.value === this.value);
    return index >= 0 ? index : 0;
  }

  /**
   * Checks whether one option is selected.
   *
   * @public
   * @param {SelectOption} option option to check.
   * @returns {boolean} whether the option is selected.
   */
  public isSelected(option: SelectOption): boolean {
    return option.value === this.value;
  }

  /**
   * Selects one option.
   *
   * @public
   * @param {SelectOption} option selected option.
   */
  public onOptionClick(option: SelectOption): void {
    if (!this.disabled && !option.disabled) {
      this.setValue(option.value);
      this.valueChange.emit(this.value);
    }
  }

  /**
   * @inheritdoc
   */
  protected override normalizeValue(value: SelectValue): SelectValue {
    return value ?? null;
  }
}
