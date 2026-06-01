import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';

import {ApplyRestoreButtons} from '../../../../../shared/component/apply-restore/button-pair';
import {Preset, PRESETS} from '../../../model/preset';
import {PresetButton} from '../../element/preset-button/preset-button';

/**
 * Preset selection section.
 *
 * @class PresetsSection
 * @typedef {PresetsSection}
 */
@Component({
  selector: 'gol-presets-section',
  standalone: true,
  imports: [PresetButton, ApplyRestoreButtons],
  templateUrl: './presets-section.html',
  styleUrl: './presets-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PresetsSection {
  /**
   * Whether the simulation is running.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public running = false;

  /**
   * Whether a download is in progress.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public downloading = false;

  /**
   * Emitter for applied preset selections.
   *
   * @public
   * @readonly
   * @type {EventEmitter<Preset>}
   */
  @Output()
  public readonly applyPreset = new EventEmitter<Preset>();

  /**
   * Available ruleset presets.
   *
   * @public
   * @readonly
   * @type {readonly Preset[]}
   */
  public readonly presets = PRESETS;

  /**
   * Currently selected preset.
   *
   * @public
   * @type {(Preset | null)}
   */
  public selectedPreset: Preset | null = null;

  /**
   * Handles preset selection.
   *
   * @public
   * @param {Preset} preset
   */
  public onPresetSelected(preset: Preset): void {
    this.selectedPreset = preset;
  }

  /**
   * Applies the selected preset.
   *
   * @public
   */
  public onApplyPreset(): void {
    if (!this.selectedPreset) {
      return;
    }
    this.applyPreset.emit(this.selectedPreset);
    this.selectedPreset = null;
  }

  /**
   * Clears the selected preset.
   *
   * @public
   */
  public onRestorePreset(): void {
    this.selectedPreset = null;
  }
}
