import {NgStyle} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, Output, ViewEncapsulation} from '@angular/core';
import {NG_VALUE_ACCESSOR} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';

import {ExclusiveButtonOption} from './model/exclusive-button-option';

import {CvaComponent} from '~gol/core/abstract/cva-component';

/**
 * Exclusive button group.
 *
 * @class ExclusiveButtonGroup
 * @typedef {ExclusiveButtonGroup}
 * @template T
 * @extends {CvaComponent<T | null>}
 */
@Component({
  selector: 'gol-exclusive-button-group',
  standalone: true,
  imports: [MatIconModule, NgStyle],
  templateUrl: './exclusive-button-group.html',
  styleUrl: './exclusive-button-group.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ExclusiveButtonGroup),
      multi: true
    }
  ],
  host: {
    class: 'gol-exclusive-button-group'
  }
})
export class ExclusiveButtonGroup<T> extends CvaComponent<T | null> {
  /**
   * Button options.
   *
   * @public
   * @type {readonly ExclusiveButtonOption<T>[]}
   */
  @Input()
  public options: readonly ExclusiveButtonOption<T>[] = [];

  /**
   * Emitter for the selected value change event.
   *
   * @public
   * @readonly
   * @type {EventEmitter<T>}
   */
  @Output()
  public readonly selectedChange = new EventEmitter<T>();

  /**
   * Current selected value.
   *
   * @public
   * @type {T | null}
   */
  public value: T | null = null;

  /**
   * Selected value.
   *
   * @public
   * @type {T | null}
   */
  @Input()
  public set selectedValue(value: T | null) {
    this.value = value;
  }

  /**
   * Checks if the given option is active.
   *
   * @public
   * @param {ExclusiveButtonOption<T>} option
   * @returns {boolean}
   */
  public isActive(option: ExclusiveButtonOption<T>): boolean {
    return this.value === option.value;
  }

  /**
   * Emits the selected value change if not disabled.
   *
   * @public
   * @param {ExclusiveButtonOption<T>} option
   */
  public onOptionClick(option: ExclusiveButtonOption<T>): void {
    if (!this.disabled && !option.disabled) {
      this.setValue(option.value);
      this.selectedChange.emit(option.value);
    }
  }
}
