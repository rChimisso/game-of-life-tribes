import {NgStyle} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

import {ExclusiveButtonOption} from './model/exclusive-button-option';

/**
 * Exclusive button group.
 *
 * @class ExclusiveButtonGroup
 * @typedef {ExclusiveButtonGroup}
 * @template T 
 */
@Component({
  selector: 'gol-exclusive-button-group',
  standalone: true,
  imports: [MatIconModule, NgStyle],
  templateUrl: './exclusive-button-group.html',
  styleUrl: './exclusive-button-group.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'gol-exclusive-button-group'
  }
})
export class ExclusiveButtonGroup<T> {
  /**
   * Button options.
   *
   * @public
   * @type {readonly ExclusiveButtonOption<T>[]}
   */
  @Input()
  public options: readonly ExclusiveButtonOption<T>[] = [];

  /**
   * Selected value.
   *
   * @public
   * @type {T | null}
   */
  @Input()
  public selectedValue: T | null = null;

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
   * Checks if the given option is active.
   *
   * @public
   * @param {ExclusiveButtonOption<T>} option 
   * @returns {boolean} 
   */
  public isActive(option: ExclusiveButtonOption<T>): boolean {
    return this.selectedValue === option.value;
  }

  /**
   * Emits the selected value change if not disabled.
   *
   * @public
   * @param {ExclusiveButtonOption<T>} option 
   */
  public onOptionClick(option: ExclusiveButtonOption<T>): void {
    if (!option.disabled) {
      this.selectedChange.emit(option.value);
    }
  }
}
