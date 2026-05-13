import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {ApplyRestoreButtons} from '../../../../../shared/component/apply-restore/button-pair';
import {InputComponent} from '../../../../../shared/component/input/input';
import {BitsPerCell} from '../../../model/grid-format';
import {formatBinaryBytes} from '../../../util/byte-format';
import {gridByteSize, gridFormatFromBits} from '../../../util/grid-format';
import {RECORDING_MAX_FRAME_BYTES} from '../../../worker/recording-limits';

import {Grid} from '~gol/core/model/grid';
import {TypedChanges} from '~gol/core/model/typed-change';
import {LabelValue} from '~gol/shared/component/label-value/label-value';

/**
 * Grid size editor section.
 *
 * @export
 * @class GridSizeSection
 * @typedef {GridSizeSection}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-grid-size-section',
  standalone: true,
  imports: [
    FormsModule,
    InputComponent,
    LabelValue,
    ApplyRestoreButtons
  ],
  templateUrl: './grid-size-section.html',
  styleUrl: './grid-size-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GridSizeSection implements OnChanges {
  /**
   * Committed grid columns.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public gridCols = 0;

  /**
   * Committed grid rows.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public gridRows = 0;

  /**
   * Current simulation packing size.
   *
   * @public
   * @type {BitsPerCell}
   */
  @Input({required: true})
  public simulationBitsPerCell: BitsPerCell = 8;

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
   * Emitter for applied grid size changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<Grid>}
   */
  @Output()
  public readonly applyGridSize = new EventEmitter<Grid>();

  /**
   * Pending grid columns.
   *
   * @public
   * @type {number}
   */
  public pendingCols = 0;

  /**
   * Pending grid rows.
   *
   * @public
   * @type {number}
   */
  public pendingRows = 0;

  /**
   * Grid column validation message.
   *
   * @public
   * @type {(string | null)}
   */
  public get gridColsError(): string | null {
    if (+this.pendingCols < 3) {
      return 'Min 3';
    }
    return null;
  }

  /**
   * Grid row validation message.
   *
   * @public
   * @type {(string | null)}
   */
  public get gridRowsError(): string | null {
    if (+this.pendingRows < 3) {
      return 'Min 3';
    }
    return null;
  }

  /**
   * Whether pending size differs from the committed size.
   *
   * @public
   * @type {boolean}
   */
  public get hasUnappliedGridSize(): boolean {
    return +this.pendingCols !== +this.gridCols || +this.pendingRows !== +this.gridRows;
  }

  /**
   * Pending grid frame size in bytes.
   *
   * @public
   * @type {number}
   */
  public get pendingGridFrameByteSize(): number {
    return gridByteSize({cols: +this.pendingCols, rows: +this.pendingRows}, gridFormatFromBits(this.simulationBitsPerCell));
  }

  /**
   * Formatted pending grid frame size.
   *
   * @public
   * @type {string}
   */
  public get pendingGridFrameSizeFormatted(): string {
    return formatBinaryBytes(this.pendingGridFrameByteSize);
  }

  /**
   * Whether pending grid size exceeds the recording frame limit.
   *
   * @public
   * @type {boolean}
   */
  public get pendingGridOverRecordingFrameLimit(): boolean {
    return this.pendingGridFrameByteSize > RECORDING_MAX_FRAME_BYTES;
  }

  /**
   * Whether pending grid size exceeds the detected frame limit.
   *
   * @public
   * @type {boolean}
   */
  public get pendingGridOverAllowedFrameLimit(): boolean {
    return Number.isFinite(this.maxBytes) && this.pendingGridFrameByteSize > this.maxBytes;
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
  public ngOnChanges(changes: TypedChanges<GridSizeSection>): void {
    if (changes.gridCols || changes.gridRows) {
      this.pendingCols = this.gridCols;
      this.pendingRows = this.gridRows;
    }
  }

  /**
   * Handles pending column changes.
   *
   * @public
   * @param {(string | number)} value
   */
  public onPendingColsChange(value: string | number): void {
    this.pendingCols = this.parseDimension(value);
  }

  /**
   * Handles pending row changes.
   *
   * @public
   * @param {(string | number)} value
   */
  public onPendingRowsChange(value: string | number): void {
    this.pendingRows = this.parseDimension(value);
  }

  /**
   * Applies pending grid size.
   *
   * @public
   */
  public onApplyGridSize(): void {
    this.applyGridSize.emit({cols: this.pendingCols, rows: this.pendingRows});
  }

  /**
   * Restores pending grid size from the committed size.
   *
   * @public
   */
  public restoreGridSize(): void {
    this.pendingCols = this.gridCols;
    this.pendingRows = this.gridRows;
  }

  /**
   * Parses a grid dimension input.
   *
   * @private
   * @param {(string | number)} value
   * @returns {number}
   */
  private parseDimension(value: string | number): number {
    const n = Math.floor(+value || 0);
    return Math.max(0, n);
  }
}
