import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {FrameSizeLimits} from '../../element/frame-size-limits/frame-size-limits';

import {TypedChanges} from '~gol/core/model/typed-change';
import {gridByteSize, gridFormatFromBits} from '~gol/feature/home/logic/grid-format';
import {GridSettings, GridTopology} from '~gol/feature/home/model/grid';
import {BitsPerCell} from '~gol/feature/home/model/grid-format';
import {BOUNDED_GRID_TOPOLOGY, DEAD_TRIBE_ID, TOROIDAL_GRID_TOPOLOGY, Tribe} from '~gol/feature/home/model/rule';
import {ApplyRestoreButtons} from '~gol/shared/component/apply-restore/button-pair';
import {InputComponent} from '~gol/shared/component/input/input';
import {SegmentedControl} from '~gol/shared/component/segmented-control/segmented-control';
import {SelectOption, SelectValue} from '~gol/shared/component/select/model/select';
import {SelectComponent} from '~gol/shared/component/select/select';

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
    SegmentedControl,
    SelectComponent,
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
   * Committed grid topology.
   *
   * @public
   * @type {GridTopology}
   */
  @Input({required: true})
  public topology: GridTopology = TOROIDAL_GRID_TOPOLOGY;

  /**
   * Committed bounded-grid virtual boundary tribe.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public boundaryTribe = DEAD_TRIBE_ID;

  /**
   * Current ruleset tribes.
   *
   * @public
   * @type {readonly Tribe[]}
   */
  @Input({required: true})
  public tribes: readonly Tribe[] = [];

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
   * Emitter for applied grid setting changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<GridSettings>}
   */
  @Output()
  public readonly applyGridSize = new EventEmitter<GridSettings>();

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
   * Pending grid topology.
   *
   * @public
   * @type {GridTopology}
   */
  public pendingTopology: GridTopology = TOROIDAL_GRID_TOPOLOGY;

  /**
   * Pending virtual boundary tribe.
   *
   * @public
   * @type {string}
   */
  public pendingBoundaryTribe = DEAD_TRIBE_ID;

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
    return +this.pendingCols !== +this.gridCols || +this.pendingRows !== +this.gridRows || this.pendingTopology !== this.topology || (this.pendingTopology === BOUNDED_GRID_TOPOLOGY && this.pendingBoundaryTribe !== this.normalizedBoundaryTribe);
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
   * Grid topology select options.
   *
   * @public
   * @readonly
   * @type {readonly SelectOption[]}
   */
  public get topologyOptions(): readonly SelectOption[] {
    return [{value: TOROIDAL_GRID_TOPOLOGY, label: 'Toroidal'}, {value: BOUNDED_GRID_TOPOLOGY, label: 'Bounded'}];
  }

  /**
   * Boundary tribe select options.
   *
   * @public
   * @readonly
   * @type {readonly SelectOption[]}
   */
  public get boundaryTribeOptions(): readonly SelectOption[] {
    return this.tribes.map(tribe => ({
      value: tribe.id,
      label: tribe.id,
      swatchColor: tribe.color
    }));
  }

  /**
   * Whether boundary tribe selection is active.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get boundaryTribeDisabled(): boolean {
    return this.pendingTopology === TOROIDAL_GRID_TOPOLOGY;
  }

  /**
   * Committed boundary tribe after applying topology and tribe-list constraints.
   *
   * @private
   * @readonly
   * @type {string}
   */
  private get normalizedBoundaryTribe(): string {
    return this.normalizeBoundaryTribe(this.boundaryTribe);
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<GridSizeSection>): void {
    if (changes.gridCols || changes.gridRows || changes.topology || changes.boundaryTribe || changes.tribes) {
      this.pendingCols = this.gridCols;
      this.pendingRows = this.gridRows;
      this.pendingTopology = this.topology;
      this.pendingBoundaryTribe = this.normalizedBoundaryTribe;
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
   * Handles pending topology changes.
   *
   * @public
   * @param {SelectValue} value select value.
   */
  public onPendingTopologyChange(value: SelectValue): void {
    this.pendingTopology = value === BOUNDED_GRID_TOPOLOGY ? BOUNDED_GRID_TOPOLOGY : TOROIDAL_GRID_TOPOLOGY;
    this.pendingBoundaryTribe = this.normalizeBoundaryTribe(this.pendingBoundaryTribe);
  }

  /**
   * Handles pending boundary tribe changes.
   *
   * @public
   * @param {SelectValue} value select value.
   */
  public onPendingBoundaryTribeChange(value: SelectValue): void {
    this.pendingBoundaryTribe = this.normalizeBoundaryTribe(typeof value === 'string' ? value : DEAD_TRIBE_ID);
  }

  /**
   * Applies pending grid size.
   *
   * @public
   */
  public onApplyGridSize(): void {
    this.applyGridSize.emit({
      cols: this.pendingCols,
      rows: this.pendingRows,
      topology: this.pendingTopology,
      boundaryTribe: this.pendingBoundaryTribe
    });
  }

  /**
   * Restores pending grid size from the committed size.
   *
   * @public
   */
  public restoreGridSize(): void {
    this.pendingCols = this.gridCols;
    this.pendingRows = this.gridRows;
    this.pendingTopology = this.topology;
    this.pendingBoundaryTribe = this.normalizedBoundaryTribe;
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

  /**
   * Normalizes the selected virtual boundary tribe.
   *
   * @private
   * @param {string} boundaryTribe selected boundary tribe.
   * @returns {string} normalized boundary tribe.
   */
  private normalizeBoundaryTribe(boundaryTribe: string): string {
    let normalized: string;
    if (this.tribes.some(tribe => tribe.id === boundaryTribe)) {
      normalized = boundaryTribe;
    } else {
      normalized = DEAD_TRIBE_ID;
    }
    return normalized;
  }
}
