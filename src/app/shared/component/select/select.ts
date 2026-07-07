import {ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {NG_VALUE_ACCESSOR} from '@angular/forms';
import {MatFormFieldModule, MatFormFieldAppearance} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';

import {SelectOption, SelectValue} from './model/select';
import {TribeSwatch} from '../tribe-swatch/tribe-swatch';

import {CvaComponent} from '~gol/core/abstract/cva-component';

/**
 * Shared select component.
 *
 * @class SelectComponent
 * @typedef {SelectComponent}
 * @extends {CvaComponent<SelectValue>}
 */
@Component({
  selector: 'gol-select',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    TribeSwatch
  ],
  templateUrl: './select.html',
  styleUrl: './select.scss',
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true
    }
  ]
})
export class SelectComponent extends CvaComponent<SelectValue> {
  /**
   * Select options.
   *
   * @public
   * @type {readonly SelectOption[]}
   */
  @Input()
  public options: readonly SelectOption[] = [];

  /**
   * Optional label displayed by the form field.
   *
   * @public
   * @type {string}
   */
  @Input()
  public label = '';

  /**
   * Placeholder shown when no option is selected.
   *
   * @public
   * @type {string}
   */
  @Input()
  public placeholder = '';

  /**
   * Select tooltip.
   *
   * @public
   * @type {string}
   */
  @Input()
  public tooltip = '';

  /**
   * Select appearance.
   *
   * @public
   * @type {MatFormFieldAppearance}
   */
  @Input()
  public appearance: MatFormFieldAppearance = 'fill';

  /**
   * Panel class used to style the overlay globally.
   *
   * @public
   * @type {(string | string[])}
   */
  @Input()
  public panelClass: string | string[] = 'gol-select-panel';

  /**
   * Hides the default checkmark indicator in single-selection panels.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public hideSingleSelectionIndicator = true;

  /**
   * Emits when selection changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<SelectValue>}
   */
  @Output()
  public readonly valueChange = new EventEmitter<SelectValue>();

  /**
   * Current select value.
   *
   * @public
   * @type {SelectValue}
   */
  @Input()
  public value: SelectValue = null;

  /**
   * Currently selected option metadata.
   *
   * @public
   * @type {(SelectOption | null)}
   */
  public get selectedOption(): SelectOption | null {
    return this.options.find(option => option.value === this.value) ?? null;
  }

  /**
   * Handles selection changes.
   *
   * @public
   * @param {SelectValue} value
   */
  public onSelectionChange(value: SelectValue): void {
    this.setValue(value);
    this.valueChange.emit(value);
  }

  /**
   * @inheritdoc
   */
  protected override normalizeValue(value: SelectValue): SelectValue {
    return value ?? null;
  }
}
