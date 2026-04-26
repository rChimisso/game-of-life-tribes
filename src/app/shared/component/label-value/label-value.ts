/* eslint-disable jsdoc/require-jsdoc */
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';

@Component({
  selector: 'gol-label-value',
  standalone: true,
  templateUrl: './label-value.html',
  styleUrl: './label-value.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LabelValue {
  @Input({required: true})
  public label = '';

  @Input({required: true})
  public value: string | number | null = null;
}
