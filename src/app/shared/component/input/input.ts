import {ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, Output} from '@angular/core';
import {NG_VALUE_ACCESSOR} from '@angular/forms';

import {CvaComponent} from '~gol/core/abstract/cva-component';
import {CharFilterDirective} from '~gol/shared/directive/char-filter';

/**
 * Input.
 *
 * @export
 * @class InputComponent
 * @typedef {InputComponent}
 * @extends {CvaComponent<string | number>}
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
export class InputComponent extends CvaComponent<string | number> {
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
  public override value: string | number = '';

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
   * Handles the input event.
   *
   * @public
   * @param {string} rawValue 
   */
  public onInput(rawValue: string): void {
    const parsed = this.type === 'number' ? +rawValue : rawValue;
    this.setValue(parsed);
    this.valueChange.emit(parsed);
  }

  /**
   * @inheritdoc
   */
  protected override normalizeValue(value: string | number | null): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  }
}
