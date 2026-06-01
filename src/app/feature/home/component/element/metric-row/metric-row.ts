import {DecimalPipe, PercentPipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';

import {MetricRowFormat} from '../model/metric-row-format';

/**
 * Metric label-value row.
 *
 * @class MetricRow
 * @typedef {MetricRow}
 */
@Component({
  selector: 'gol-metric-row',
  standalone: true,
  imports: [DecimalPipe, PercentPipe],
  templateUrl: './metric-row.html',
  styleUrl: './metric-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricRow {
  /**
   * Metric label.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public label = '';

  /**
   * Metric explanation.
   *
   * @public
   * @type {string}
   */
  @Input()
  public title = '';

  /**
   * Metric value.
   *
   * @public
   * @type {(number | null)}
   */
  @Input()
  public value?: number | null = null;

  /**
   * Metric value format.
   *
   * @public
   * @type {MetricRowFormat}
   */
  @Input()
  public format: MetricRowFormat = 'integer';

  /**
   * Digits info for numeric formatting.
   *
   * @public
   * @type {string}
   */
  @Input()
  public digits = '1.0-0';

  /**
   * Text shown when the metric is disabled or unavailable.
   *
   * @public
   * @type {(string | null)}
   */
  @Input()
  public disabledText: string | null = null;

  /**
   * Text shown while the metric value is missing.
   *
   * @public
   * @type {string}
   */
  @Input()
  public fallback = '--';
}
