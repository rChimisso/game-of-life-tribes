/* eslint-disable jsdoc/require-jsdoc */
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';

@Component({
  selector: '[gol-apply-restore-buttons]',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './apply-restore.html',
  styleUrl: './apply-restore.scss',
  host: {
    class: 'apply-row'
  }
})
export class ApplyRestoreButtons {
  @Input()
  public applyDisabled = false;

  @Input()
  public restoreDisabled = false;

  @Input()
  public applyLabel = 'Apply';

  @Input()
  public restoreLabel = 'Restore';

  @Output()
  public readonly apply = new EventEmitter<void>();

  @Output()
  public readonly restore = new EventEmitter<void>();
}
