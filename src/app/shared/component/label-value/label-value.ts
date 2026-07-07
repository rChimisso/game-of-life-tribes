import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {MatTooltipModule} from '@angular/material/tooltip';

import {SeverityLevel} from '~gol/core/model/severity-level';

/**
 * Label value pair.
 *
 * @class LabelValue
 * @typedef {LabelValue}
 */
@Component({
  selector: 'gol-label-value',
  standalone: true,
  imports: [MatTooltipModule],
  templateUrl: './label-value.html',
  styleUrl: './label-value.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LabelValue {
  /**
   * Label.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public label = '';

  /**
   * Value.
   *
   * @public
   * @type {?(string | number | null)}
   */
  @Input({required: true})
  public value?: string | number | null = null;

  /**
   * Type of the label.
   *
   * @public
   * @type {SeverityLevel}
   */
  @Input()
  public type: SeverityLevel = 'info';

  /**
   * Tooltip.
   *
   * @public
   * @type {string}
   */
  @Input()
  public tooltip = '';
}
