import {ChangeDetectionStrategy, Component, Input} from '@angular/core';

/**
 * Label value pair.
 *
 * @export
 * @class LabelValue
 * @typedef {LabelValue}
 */
@Component({
  selector: 'gol-label-value',
  standalone: true,
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
   * @type {'info' | 'warning' | 'error'}
   */
  @Input()
  public type: 'info' | 'warning' | 'error' = 'info';
}
