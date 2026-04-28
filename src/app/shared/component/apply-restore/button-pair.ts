import {Component, EventEmitter, Input, Output} from '@angular/core';

import {Button} from '~gol/shared/component/button/button';

/**
 * Button pair for coupled actions.
 *
 * @export
 * @class ApplyRestoreButtons
 * @typedef {ApplyRestoreButtons}
 */
@Component({
  selector: 'gol-button-pair',
  standalone: true,
  imports: [Button],
  templateUrl: './button-pair.html',
  styleUrl: './button-pair.scss'
})
export class ApplyRestoreButtons {
  /**
   * Left button label.
   *
   * @public
   * @type {string}
   */
  @Input()
  public leftLabel = 'Apply';

  /**
   * Right button label.
   *
   * @public
   * @type {string}
   */
  @Input()
  public rightLabel = 'Restore';

  /**
   * Left button icon.
   *
   * @public
   * @type {string}
   */
  @Input()
  public leftIcon = 'check';

  /**
   * Right button icon.
   *
   * @public
   * @type {string}
   */
  @Input()
  public rightIcon = 'undo';

  /**
   * Whether the left button is disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public leftDisabled = false;

  /**
   * Whether the right button is disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public rightDisabled = false;

  /**
   * Emitter for the left button click event.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly leftClick = new EventEmitter<void>();

  /**
   * Emitter for the right button click event.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly rightClick = new EventEmitter<void>();
}
