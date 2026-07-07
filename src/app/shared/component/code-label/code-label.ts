import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {MatTooltipModule} from '@angular/material/tooltip';

/**
 * Code label pair.
 *
 * @class CodeLabel
 * @typedef {CodeLabel}
 */
@Component({
  standalone: true,
  selector: 'gol-code-label',
  imports: [MatTooltipModule],
  templateUrl: './code-label.html',
  styleUrl: './code-label.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
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
