import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {MatTooltipModule} from '@angular/material/tooltip';

import {StorageBarSegment} from './model/storage-bar-segment';

/**
 * Storage segmented bar.
 *
 * @class StorageBar
 * @typedef {StorageBar}
 */
@Component({
  selector: 'gol-storage-bar',
  standalone: true,
  imports: [MatTooltipModule],
  templateUrl: './storage-bar.html',
  styleUrl: './storage-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StorageBar {
  /**
   * List of segments.
   *
   * @public
   * @type {StorageBarSegment[]}
   */
  @Input({required: true})
  public segments: StorageBarSegment[] = [];

  /**
   * Total amount of storage available.
   *
   * @public
   * @type {number}
   */
  @Input()
  public total = 0;

  /**
   * Tooltip.
   *
   * @public
   * @type {string}
   */
  @Input()
  public tooltip = '';

  /**
   * Returns the percentage of a segment value relative to the total.
   *
   * @public
   * @param {number} value segment value.
   * @returns {number} segment percentage relative to the total.
   */
  public segmentPercent(value: number): number {
    return this.total <= 0 ? 0 : Math.max(0, (value / this.total) * 100);
  }
}
