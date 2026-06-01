import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';

import {requiredGridFormatForStateCount} from '~gol/feature/home/logic/grid-format';
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

  /**
   * Required minimum packing size.
   *
   * @public
   * @returns {number}
   */
  public get requiredBitsPerCell(): number {
    return requiredGridFormatForStateCount(this.preset.ruleset.tribes.length).bitsPerCell;
  }

  /**
   * Required minimum packing display label.
   *
   * @public
   * @returns {string}
   */
  public get requiredPackingLabel(): string {
    return `${this.requiredBitsPerCell}-bit`;
  }

  /**
   * Preset button tooltip.
   *
   * @public
   * @returns {string}
   */
  public get presetTitle(): string {
    return `${this.preset.name}: ${this.preset.description}. Requires at least ${this.requiredPackingLabel} packing.`;
  }
}
