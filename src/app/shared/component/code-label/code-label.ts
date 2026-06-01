import {ChangeDetectionStrategy, Component, Input} from '@angular/core';

/**
 * Code label pair.
 *
 * @class CodeLabel
 * @typedef {CodeLabel}
 */
@Component({
  standalone: true,
  selector: 'gol-code-label',
  templateUrl: './code-label.html',
  styleUrl: './code-label.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.title]': 'tooltip'
  }
})
export class CodeLabel {
  /**
   * Code to display.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public code = '';

  /**
   * Label.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public label = '';

  /**
   * Tooltip.
   *
   * @public
   * @type {string}
   */
  @Input()
  public tooltip = '';
}
