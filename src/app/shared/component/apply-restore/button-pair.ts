/* eslint-disable jsdoc/require-jsdoc */
import {Component, EventEmitter, Input, Output} from '@angular/core';

import {Button} from '~gol/shared/component/button/button';

@Component({
  selector: 'gol-button-pair',
  standalone: true,
  imports: [Button],
  templateUrl: './button-pair.html',
  styleUrl: './button-pair.scss'
})
export class ApplyRestoreButtons {
  @Input()
  public leftDisabled = false;

  @Input()
  public rightDisabled = false;

  @Input()
  public leftLabel = 'Apply';

  @Input()
  public rightLabel = 'Restore';

  @Input()
  public leftIcon = 'check';

  @Input()
  public rightIcon = 'undo';

  @Output()
  public readonly leftClick = new EventEmitter<void>();

  @Output()
  public readonly rightClick = new EventEmitter<void>();
}
