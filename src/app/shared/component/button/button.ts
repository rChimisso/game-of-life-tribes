import {Component, EventEmitter, Input, Output} from '@angular/core';
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
   * @type {string}
   */
  @Input()
  public label = '';

  /**
   * Icon.
   *
   * @public
   * @type {string | null}
   */
  @Input()
  public icon: string | null = null;

  /**
   * Color.
   *
   * @public
   * @type {'primary' | 'accent' | 'warn'}
   */
  @Input()
  public color: 'primary' | 'accent' | 'warn' = 'primary';

  /**
   * Variant.
   *
   * @public
   * @type {'raised' | 'flat' | 'stroked' | 'text' | 'icon'}
   */
  @Input()
  public variant: 'raised' | 'flat' | 'stroked' | 'text' | 'icon' = 'raised';

  /**
   * Whether it's disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public disabled = false;

  @Output()
  public readonly clicked = new EventEmitter<void>();

  public emit(): void {
    if (!this.disabled) {
      this.clicked.emit();
    }
  }
}
