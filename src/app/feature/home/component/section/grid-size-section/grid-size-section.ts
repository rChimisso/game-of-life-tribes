import {ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, OnInit, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';

import {FrameSizeLimits} from '../../element/frame-size-limits/frame-size-limits';

import {BaselineState} from '~gol/core/model/baseline-state';
import {FormType} from '~gol/core/model/form-type';
import {TypedChanges} from '~gol/core/model/typed-change';
import {gridByteSize, gridFormatFromBits} from '~gol/feature/home/logic/grid-format';
import {GridSettings, GridTopology} from '~gol/feature/home/model/grid';
import {BitsPerCell} from '~gol/feature/home/model/grid-format';
import {GridSizeFormValue} from '~gol/feature/home/model/grid-size-form';
import {BOUNDED_GRID_TOPOLOGY, DEAD_TRIBE_ID, TOROIDAL_GRID_TOPOLOGY, Tribe} from '~gol/feature/home/model/rule';
import {ApplyRestoreButtons} from '~gol/shared/component/apply-restore/button-pair';
import {NumberInputComponent} from '~gol/shared/component/input/number-input/number-input';
import {SegmentedControl} from '~gol/shared/component/segmented-control/segmented-control';
import {SelectOption} from '~gol/shared/component/select/model/select';
import {SelectComponent} from '~gol/shared/component/select/select';

/**
 * Grid size editor section.
 *
 * @class GridSizeSection
 * @typedef {GridSizeSection}
 * @implements {OnChanges}
 * @implements {OnInit}
 */
@Component({
  selector: 'gol-grid-size-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NumberInputComponent,
    SegmentedControl,
    SelectComponent,
    FrameSizeLimits,
    ApplyRestoreButtons
  ],
  templateUrl: './grid-size-section.html',
  styleUrl: './grid-size-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GridSizeSection implements OnChanges, OnInit {
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
   * Grid size form.
   *
   * @public
   * @readonly
   * @type {FormGroup<FormType<GridSizeFormValue>>}
   */
  public readonly form = new FormGroup<FormType<GridSizeFormValue>>({
    cols: new FormControl<number | null>(0, {validators: [Validators.required]}),
    rows: new FormControl<number | null>(0, {validators: [Validators.required]}),
    topology: new FormControl<GridTopology>(TOROIDAL_GRID_TOPOLOGY, {nonNullable: true}),
    boundaryTribe: new FormControl(DEAD_TRIBE_ID, {nonNullable: true})
  });

  /**
   * Whether pending grid size exceeds the detected frame limit.
   *
   * @public
   * @type {boolean}
   */
  public pendingGridOverAllowedFrameLimit = false;

  /**
   * Baseline form value.
   *
   * @private
   * @readonly
   * @type {BaselineState<GridSizeFormValue>}
   */
  private readonly baseline = new BaselineState<GridSizeFormValue>({
    cols: 0,
    rows: 0,
    topology: TOROIDAL_GRID_TOPOLOGY,
    boundaryTribe: DEAD_TRIBE_ID
  });

  /**
   * Destroy ref for subscriptions.
   *
   * @private
   * @readonly
   * @type {DestroyRef}
   */
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Grid column validation message.
   *
   * @public
   * @type {(string | null)}
   */
  public get gridColsError(): string | null {
    return this.dimensionError(this.form.controls.cols);
  }

  /**
   * Grid row validation message.
   *
   * @public
   * @type {(string | null)}
   */
  public get gridRowsError(): string | null {
    return this.dimensionError(this.form.controls.rows);
  }

  /**
   * Whether pending size differs from the committed size.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get hasUnappliedGridSize(): boolean {
    return this.baseline.hasChanges(this.currentFormValue(), (baseline, current) => this.gridValuesEqual(baseline, current));
  }

  /**
   * Pending grid frame size in bytes.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get pendingGridFrameByteSize(): number {
    const {cols, rows} = this.form.getRawValue();
    let frameBytes = 0;
    if (cols !== null && rows !== null) {
      frameBytes = gridByteSize({cols, rows}, gridFormatFromBits(this.simulationBitsPerCell));
    }
    return frameBytes;
  }

  /**
   * Whether Apply is disabled.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get applyDisabled(): boolean {
    return this.running ||
      this.downloading ||
      !this.hasUnappliedGridSize ||
      this.pendingGridOverAllowedFrameLimit ||
      this.form.invalid;
  }

  /**
   * Whether Restore is disabled.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get restoreDisabled(): boolean {
    return this.downloading || !this.hasUnappliedGridSize;
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
    return this.form.controls.boundaryTribe.disabled;
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
      this.syncCommittedGridSettings();
    }
  }

  /**
   * @inheritdoc
   */
  public ngOnInit(): void {
    this.form.controls.topology.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.onTopologyControlChange());
    this.syncBoundaryTribeState();
  }

  /**
   * Applies pending grid size.
   *
   * @public
   */
  public onApplyGridSize(): void {
    if (!this.applyDisabled) {
      const value = this.currentFormValue();
      if (value.cols !== null && value.rows !== null) {
        this.applyGridSize.emit({
          cols: value.cols,
          rows: value.rows,
          topology: value.topology,
          boundaryTribe: value.boundaryTribe
        });
      }
    }
  }

  /**
   * Restores pending grid size from the committed size.
   *
   * @public
   */
  public restoreGridSize(): void {
    this.form.setValue(this.baseline.clone(), {emitEvent: false});
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.syncBoundaryTribeState();
  }

  /**
   * Handles topology changes.
   *
   * @private
   */
  private onTopologyControlChange(): void {
    this.form.controls.boundaryTribe.setValue(this.normalizeBoundaryTribe(this.form.controls.boundaryTribe.value), {emitEvent: false});
    this.syncBoundaryTribeState();
  }

  /**
   * Synchronizes controls from committed inputs.
   *
   * @private
   */
  private syncCommittedGridSettings(): void {
    const value = this.committedFormValue();
    this.baseline.set(value);
    this.form.setValue(value, {emitEvent: false});
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.syncBoundaryTribeState();
  }

  /**
   * Gets the normalized committed form value.
   *
   * @private
   * @returns {GridSizeFormValue} committed form value.
   */
  private committedFormValue(): GridSizeFormValue {
    return {
      cols: this.gridCols,
      rows: this.gridRows,
      topology: this.topology,
      boundaryTribe: this.normalizedBoundaryTribe
    };
  }

  /**
   * Gets the normalized current form value.
   *
   * @private
   * @returns {GridSizeFormValue} current form value.
   */
  private currentFormValue(): GridSizeFormValue {
    const value = this.form.getRawValue();
    return {
      cols: value.cols,
      rows: value.rows,
      topology: value.topology,
      boundaryTribe: this.normalizeBoundaryTribe(value.boundaryTribe)
    };
  }

  /**
   * Checks grid form value equality.
   *
   * @private
   * @param {GridSizeFormValue} baseline baseline value.
   * @param {GridSizeFormValue} current current value.
   * @returns {boolean} whether values are equal.
   */
  private gridValuesEqual(baseline: GridSizeFormValue, current: GridSizeFormValue): boolean {
    const sameBoundaryTribe = baseline.topology === TOROIDAL_GRID_TOPOLOGY || baseline.boundaryTribe === current.boundaryTribe;
    return baseline.cols === current.cols &&
      baseline.rows === current.rows &&
      baseline.topology === current.topology &&
      sameBoundaryTribe;
  }

  /**
   * Syncs boundary tribe disabled state with selected topology.
   *
   * @private
   */
  private syncBoundaryTribeState(): void {
    this.setControlDisabled(this.form.controls.boundaryTribe, this.form.controls.topology.value === TOROIDAL_GRID_TOPOLOGY);
  }

  /**
   * Sets one control disabled state without emitting value changes.
   *
   * @private
   * @param {AbstractControl} control control to update.
   * @param {boolean} disabled whether the control should be disabled.
   */
  private setControlDisabled(control: AbstractControl, disabled: boolean): void {
    if (disabled && control.enabled) {
      control.disable({emitEvent: false});
    } else if (!disabled && control.disabled) {
      control.enable({emitEvent: false});
    }
  }

  /**
   * Gets a dimension control validation message.
   *
   * @private
   * @param {FormControl<number | null>} control control to read.
   * @returns {(string | null)} validation message.
   */
  private dimensionError(control: FormControl<number | null>): string | null {
    let message: string | null = null;
    if (control.hasError('required')) {
      message = 'Required';
    } else if (control.hasError('min')) {
      message = 'Min 3';
    } else if (control.hasError('decimalDigits')) {
      message = 'Integer';
    }
    return message;
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
