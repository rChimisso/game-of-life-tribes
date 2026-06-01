import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';

import {Preset} from '~gol/feature/home/model/preset';

/**
 * Ruleset preset button.
 *
 * @class PresetButton
 * @typedef {PresetButton}
 */
@Component({
  selector: 'gol-preset-button',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './preset-button.html',
  styleUrl: './preset-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PresetButton {
  /**
   * Ruleset preset.
   *
   * @public
   * @type {!Preset}
   */
  @Input({required: true})
  public preset!: Preset;

  /**
   * Whether this preset is currently selected.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public isSelected = false;
}
