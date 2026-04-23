import {Component, Input} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

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
  imports: [MatIconModule, MatButtonModule],
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
   * Whether it's disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public isDisabled = false;
}
