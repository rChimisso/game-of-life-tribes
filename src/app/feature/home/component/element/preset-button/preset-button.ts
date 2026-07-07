import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';

import {requiredGridFormatForStateCount} from '~gol/feature/home/logic/grid-format';
import {Preset} from '~gol/feature/home/preset/model/preset';

/**
 * Ruleset preset button.
 *
 * @class PresetButton
 * @typedef {PresetButton}
 */
@Component({
  selector: 'gol-preset-button',
  standalone: true,
  imports: [MatButtonModule, MatTooltipModule],
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
  public get presetTooltip(): string {
    const description = this.preset.description.endsWith('.') ? this.preset.description : `${this.preset.description}.`;
    return `${this.preset.name}: ${description}\nRequires at least ${this.requiredPackingLabel} packing.`;
  }
}
