import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {MatTooltipModule} from '@angular/material/tooltip';

import {FrameSizeLimits} from '../../element/frame-size-limits/frame-size-limits';

import {TypedChanges} from '~gol/core/model/typed-change';
import {gridByteSize, gridFormatFromBits, validatePackingAgainstStateCount} from '~gol/feature/home/logic/grid-format';
import {BitsPerCell, SUPPORTED_SIMULATION_BITS_PER_CELL} from '~gol/feature/home/model/grid-format';
import {ApplyRestoreButtons} from '~gol/shared/component/apply-restore/button-pair';
import {ExclusiveButtonGroup} from '~gol/shared/component/exclusive-button-group/exclusive-button-group';
import {ExclusiveButtonOption} from '~gol/shared/component/exclusive-button-group/model/exclusive-button-option';

/**
 * Simulation packing editor section.
 *
 * @class PackingSection
 * @typedef {PackingSection}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-packing-section',
  standalone: true,
  imports: [
    ExclusiveButtonGroup,
    FrameSizeLimits,
    ApplyRestoreButtons,
    MatTooltipModule
  ],
  templateUrl: './packing-section.html',
  styleUrl: './packing-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PackingSection implements OnChanges {
  /**
   * Current grid columns.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public gridCols = 0;

  /**
   * Current grid rows.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public gridRows = 0;

  /**
   * Committed simulation packing size.
   *
   * @public
   * @type {BitsPerCell}
   */
  @Input({required: true})
  public simulationBitsPerCell: BitsPerCell = 8;

  /**
   * Number of tribes in the ruleset.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public tribeCount = 0;

  /**
   * Maximum allowed frame bytes.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public maxBytes = Infinity;

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
   * Emitter for applied packing changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<BitsPerCell>}
   */
  @Output()
  public readonly applyPacking = new EventEmitter<BitsPerCell>();

  /**
   * Packing button options.
   *
   * @public
   * @type {readonly ExclusiveButtonOption<BitsPerCell>[]}
   */
  public readonly packingButtonOptions: ExclusiveButtonOption<BitsPerCell>[] = SUPPORTED_SIMULATION_BITS_PER_CELL.map(bitsPerCell => ({
    value: bitsPerCell,
    tooltip: `${bitsPerCell} bits per cell`,
    label: `${bitsPerCell}`,
    disabled: !validatePackingAgainstStateCount(bitsPerCell, this.tribeCount)
  }));

  /**
   * Pending simulation packing size.
   *
   * @public
   * @type {BitsPerCell}
   */
  public pendingSimulationBitsPerCell: BitsPerCell = 8;

  /**
   * Whether pending packing exceeds the detected frame limit.
   *
   * @public
   * @type {boolean}
   */
  public pendingPackingOverAllowedFrameLimit = false;

  /**
   * Whether pending packing differs from the committed packing.
   *
   * @public
   * @type {boolean}
   */
  public get hasUnappliedPacking(): boolean {
    return +this.pendingSimulationBitsPerCell !== +this.simulationBitsPerCell;
  }

  /**
   * Pending packing frame size in bytes.
   *
   * @public
   * @type {number}
   */
  public get pendingPackingFrameByteSize(): number {
    return gridByteSize({cols: this.gridCols, rows: this.gridRows}, gridFormatFromBits(this.pendingSimulationBitsPerCell));
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<PackingSection>): void {
    if (changes.simulationBitsPerCell) {
      this.pendingSimulationBitsPerCell = this.simulationBitsPerCell;
    }
  }

  /**
   * Handles pending packing changes.
   *
   * @public
   * @param {BitsPerCell} bitsPerCell
   */
  public onPackingOptionChange(bitsPerCell: BitsPerCell): void {
    this.pendingSimulationBitsPerCell = bitsPerCell;
  }

  /**
   * Applies pending packing.
   *
   * @public
   */
  public onApplyPacking(): void {
    this.applyPacking.emit(this.pendingSimulationBitsPerCell);
  }

  /**
   * Restores pending packing from the committed packing.
   *
   * @public
   */
  public restorePacking(): void {
    this.pendingSimulationBitsPerCell = this.simulationBitsPerCell;
  }
}
