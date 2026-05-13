import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';

import {ApplyRestoreButtons} from '../../../../../shared/component/apply-restore/button-pair';
import {ExclusiveButtonGroup} from '../../../../../shared/component/exclusive-button-group/exclusive-button-group';
import {BitsPerCell, SUPPORTED_SIMULATION_BITS_PER_CELL} from '../../../model/grid-format';
import {formatBinaryBytes} from '../../../util/byte-format';
import {gridByteSize, gridFormatFromBits, validatePackingAgainstStateCount} from '../../../util/grid-format';
import {RECORDING_MAX_FRAME_BYTES} from '../../../worker/recording-limits';

import {TypedChanges} from '~gol/core/model/typed-change';
import {ExclusiveButtonOption} from '~gol/shared/component/exclusive-button-group/model/exclusive-button-option';
import {LabelValue} from '~gol/shared/component/label-value/label-value';

/**
 * Simulation packing editor section.
 *
 * @export
 * @class PackingSection
 * @typedef {PackingSection}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-packing-section',
  standalone: true,
  imports: [ExclusiveButtonGroup, LabelValue, ApplyRestoreButtons],
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
   * Pending simulation packing size.
   *
   * @public
   * @type {BitsPerCell}
   */
  public pendingSimulationBitsPerCell: BitsPerCell = 8;

  /**
   * Packing button options.
   *
   * @public
   * @type {readonly ExclusiveButtonOption<BitsPerCell>[]}
   */
  public get packingButtonOptions(): readonly ExclusiveButtonOption<BitsPerCell>[] {
    return SUPPORTED_SIMULATION_BITS_PER_CELL.map(bitsPerCell => ({
      value: bitsPerCell,
      title: `${bitsPerCell} bits per cell`,
      label: `${bitsPerCell}`,
      disabled: !validatePackingAgainstStateCount(bitsPerCell, this.tribeCount)
    }));
  }

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
   * Formatted pending packing frame size.
   *
   * @public
   * @type {string}
   */
  public get pendingPackingFrameSizeFormatted(): string {
    return formatBinaryBytes(this.pendingPackingFrameByteSize);
  }

  /**
   * Whether pending packing exceeds the recording frame limit.
   *
   * @public
   * @type {boolean}
   */
  public get pendingPackingOverRecordingFrameLimit(): boolean {
    return this.pendingPackingFrameByteSize > RECORDING_MAX_FRAME_BYTES;
  }

  /**
   * Whether pending packing exceeds the detected frame limit.
   *
   * @public
   * @type {boolean}
   */
  public get pendingPackingOverAllowedFrameLimit(): boolean {
    return Number.isFinite(this.maxBytes) && this.pendingPackingFrameByteSize > this.maxBytes;
  }

  /**
   * Recording frame limit label.
   *
   * @public
   * @type {string}
   */
  public get recordingFrameLimitLabel(): string {
    return `${formatBinaryBytes(RECORDING_MAX_FRAME_BYTES)} (${RECORDING_MAX_FRAME_BYTES.toLocaleString()} bytes)`;
  }

  /**
   * Detected frame limit label.
   *
   * @public
   * @type {string}
   */
  public get allowedFrameLimitLabel(): string {
    if (!Number.isFinite(this.maxBytes)) {
      return 'Detecting…';
    }
    return `${formatBinaryBytes(this.maxBytes)} (${this.maxBytes.toLocaleString()} bytes)`;
  }

  /**
   * Frame size tooltip.
   *
   * @public
   * @type {string}
   */
  public get frameSizeTooltip(): string {
    return `${formatBinaryBytes(RECORDING_MAX_FRAME_BYTES)} recording buget / ${formatBinaryBytes(this.maxBytes)} total buget`;
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
