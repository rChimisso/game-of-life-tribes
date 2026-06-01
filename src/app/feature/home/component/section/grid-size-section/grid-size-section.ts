import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {ApplyRestoreButtons} from '../../../../../shared/component/apply-restore/button-pair';
import {InputComponent} from '../../../../../shared/component/input/input';
import {gridByteSize, gridFormatFromBits} from '../../../logic/grid-format';
import {BitsPerCell} from '../../../model/grid-format';
import {FrameSizeLimits} from '../../element/frame-size-limits/frame-size-limits';

import {TypedChanges} from '~gol/core/model/typed-change';
import {Grid} from '~gol/feature/home/model/grid';

/**
 * Grid size editor section.
 *
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
    FrameSizeLimits,
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
   * Whether pending grid size exceeds the detected frame limit.
   *
   * @public
   * @type {boolean}
   */
  public pendingGridOverAllowedFrameLimit = false;

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
