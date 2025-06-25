import {Component, Input} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatStepperModule} from '@angular/material/stepper';

/**
 * Button.
 *
 * @export
 * @class Button
 * @typedef {Button}
 */
@Component({
  selector: 'gol-button',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatStepperModule],
  templateUrl: './button.html',
  styleUrl: './button.scss'
})
export class Button {
  /**
   * Label.
   *
   * @public
   * @type {!string}
   */
  @Input({required: true})
  public label!: string;

  /**
   * Icon.
   *
   * @public
   * @type {!string}
   */
  @Input({required: true})
  public icon!: string;

  /**
   * Color.
   *
   * @public
   * @type {'primary' | 'accent' | 'warn'}
   */
  @Input()
  public color: 'primary' | 'accent' | 'warn' = 'primary';

  /**
   * Which kind of stepper button it is, if any.
   *
   * @public
   * @type {'next' | 'previous' | ''}
   */
  @Input()
  public stepperKind: 'next' | 'previous' | '' = '';

  /**
   * Whether it's disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public isDisabled = false;
}
