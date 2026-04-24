/* eslint-disable jsdoc/require-jsdoc */
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';

export interface StorageBarSegment {
  label: string;
  value: number;
  formatted: string;
  color: string;
}

@Component({
  selector: 'gol-storage-bar',
  standalone: true,
  templateUrl: './storage-bar.html',
  styleUrl: './storage-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StorageBar {
  @Input({required: true})
  public segments: StorageBarSegment[] = [];

  @Input()
  public total = 0;

  @Input()
  public tooltip = '';

  @Input()
  public showLegend = true;

  public segmentPercent(value: number): number {
    if (this.total <= 0) {
      return 0;
    }

    return Math.max(0, (value / this.total) * 100);
  }
}
