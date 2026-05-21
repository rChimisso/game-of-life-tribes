import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {MatProgressBarModule} from '@angular/material/progress-bar';

import {ProgressStatusMode} from './model/progress-status';

/**
 * Shared progress indicator with status text.
 *
 * @export
 * @class ProgressStatus
 * @typedef {ProgressStatus}
 */
@Component({
  selector: 'gol-progress-status',
  standalone: true,
  imports: [MatProgressBarModule],
  templateUrl: './progress-status.html',
  styleUrl: './progress-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgressStatus {
  /**
   * Whether progress is currently visible.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public active = false;

  /**
   * Progress bar mode.
   *
   * @public
   * @type {ProgressStatusMode}
   */
  @Input({required: true})
  public mode: ProgressStatusMode = 'indeterminate';

  /**
   * Determinate progress percentage.
   *
   * @public
   * @type {(number | null)}
   */
  @Input()
  public percent: number | null = null;

  /**
   * Status text shown below the progress bar.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public status = '';

  /**
   * Progress value passed to the Material progress bar.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get progressValue(): number {
    return Math.max(0, Math.min(100, this.percent ?? 0));
  }
}
