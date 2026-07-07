import {ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatTooltipModule} from '@angular/material/tooltip';

import {setControlDisabled, validControlValues} from '~gol/core/function/form-control';
import {FormType} from '~gol/core/model/form-type';
import {TypedChanges} from '~gol/core/model/typed-change';
import {SpeedFormValue} from '~gol/feature/home/model/speed-form';
import {NumberInputComponent} from '~gol/shared/component/input/number-input/number-input';
import {ToggleButtonComponent} from '~gol/shared/component/toggle-button/toggle-button';

/**
 * Speed and recording section.
 *
 * @class SpeedSection
 * @typedef {SpeedSection}
 * @implements {OnChanges}
 * @implements {OnInit}
 */
@Component({
  selector: 'gol-speed-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatTooltipModule,
    NumberInputComponent,
    ToggleButtonComponent
  ],
  templateUrl: './speed-section.html',
  styleUrl: './speed-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpeedSection implements OnChanges, OnInit {
  /**
   * Current simulation speed.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public speed = 1;

  /**
   * Whether max speed is enabled.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public maxSpeed = false;

  /**
   * Whether a download is in progress.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public downloading = false;

  /**
   * Whether the live engine is blocked by a GPU error.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public engineBlocked = false;

  /**
   * Whether recording is available for this grid.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public recordingAvailable = false;

  /**
   * Whether browser storage has room for one more recorded frame.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public recordingStorageAvailable = false;

  /**
   * Whether recording is enabled.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public recording = false;

  /**
   * Whether live metrics are enabled.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public liveMetricsEnabled = true;

  /**
   * Emitter for speed changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<number>}
   */
  @Output()
  public readonly speedChange = new EventEmitter<number>();

  /**
   * Emitter for max speed changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly maxSpeedChange = new EventEmitter<boolean>();

  /**
   * Emitter for recording changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly recordingChange = new EventEmitter<boolean>();

  /**
   * Emitter for live metrics changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly liveMetricsEnabledChange = new EventEmitter<boolean>();

  /**
   * Speed section form.
   *
   * @public
   * @readonly
   * @type {FormGroup<FormType<SpeedFormValue>>}
   */
  public readonly form = new FormGroup<FormType<SpeedFormValue>>({
    speed: new FormControl<number | null>(1, {validators: [Validators.required]}),
    maxSpeed: new FormControl(false, {nonNullable: true}),
    recording: new FormControl(false, {nonNullable: true}),
    liveMetricsEnabled: new FormControl(true, {nonNullable: true})
  });

  /**
   * Whether recording control is disabled.
   *
   * @public
   * @type {boolean}
   */
  public get recordingDisabled(): boolean {
    return this.engineBlocked || this.downloading || !this.recordingAvailable || !this.recordingStorageAvailable;
  }

  /**
   * Whether live speed controls are disabled.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get liveControlDisabled(): boolean {
    return this.engineBlocked || this.downloading;
  }

  /**
   * Recording availability message.
   *
   * @public
   * @type {string}
   */
  public get recordingGateMessage(): string {
    let message = 'Recording slows down the simulation.';
    if (!this.recordingAvailable) {
      message = 'Grid is too large for recording.';
    } else if (!this.recordingStorageAvailable) {
      message = 'Not enough browser storage for one frame.';
    }
    return message;
  }

  /**
   * Live metrics availability message.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get liveMetricsMessage(): string {
    return 'Support varies depending on grid size.';
  }

  /**
   * Creates the speed section.
   *
   * @public
   * @constructor
   * @param {DestroyRef} destroyRef destroy ref for subscriptions.
   */
  public constructor(private readonly destroyRef: DestroyRef) {}

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<SpeedSection>): void {
    if (changes.speed || changes.maxSpeed || changes.recording || changes.liveMetricsEnabled) {
      this.form.patchValue({
        speed: this.speed,
        maxSpeed: this.maxSpeed,
        recording: this.recording,
        liveMetricsEnabled: this.liveMetricsEnabled
      }, {emitEvent: false});
    }
    if (changes.maxSpeed || changes.downloading || changes.engineBlocked || changes.recordingAvailable || changes.recordingStorageAvailable) {
      this.syncControlDisabledState();
    }
  }

  /**
   * @inheritdoc
   */
  public ngOnInit(): void {
    validControlValues(this.form.controls.speed).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.speedChange.emit(value));
    this.form.controls.maxSpeed.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.onMaxSpeedControlChange(value));
    this.form.controls.recording.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.recordingChange.emit(value));
    this.form.controls.liveMetricsEnabled.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.liveMetricsEnabledChange.emit(value));
    this.syncControlDisabledState();
  }

  /**
   * Restores the committed speed when an invalid edit loses focus.
   *
   * @public
   */
  public restoreInvalidSpeed(): void {
    if (this.form.controls.speed.invalid) {
      this.form.controls.speed.setValue(this.speed, {emitEvent: false});
    }
  }

  /**
   * Handles max speed control changes.
   *
   * @private
   * @param {boolean} value max speed value.
   */
  private onMaxSpeedControlChange(value: boolean): void {
    this.maxSpeedChange.emit(value);
    this.syncControlDisabledState();
  }

  /**
   * Synchronizes control disabled states.
   *
   * @private
   */
  private syncControlDisabledState(): void {
    setControlDisabled(this.form.controls.speed, this.form.controls.maxSpeed.value || this.liveControlDisabled);
    setControlDisabled(this.form.controls.maxSpeed, this.liveControlDisabled);
    setControlDisabled(this.form.controls.recording, this.recordingDisabled);
    setControlDisabled(this.form.controls.liveMetricsEnabled, this.liveControlDisabled);
  }
}
