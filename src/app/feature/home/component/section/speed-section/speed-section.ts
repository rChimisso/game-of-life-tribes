import {ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, OnInit, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';

import {TypedChanges} from '~gol/core/model/typed-change';
import {SpeedFormControls} from '~gol/feature/home/model/speed-form';
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
  imports: [ReactiveFormsModule, NumberInputComponent, ToggleButtonComponent],
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
   * @type {FormGroup<SpeedFormControls>}
   */
  public readonly form = new FormGroup<SpeedFormControls>({
    speed: new FormControl<number | null>(1, {validators: [Validators.required]}),
    maxSpeed: new FormControl(false, {nonNullable: true}),
    recording: new FormControl(false, {nonNullable: true}),
    liveMetricsEnabled: new FormControl(true, {nonNullable: true})
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
    this.form.controls.speed.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.onSpeedControlChange());
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
   * Emits valid speed control changes.
   *
   * @private
   */
  private onSpeedControlChange(): void {
    const control = this.form.controls.speed;
    if (control.valid && control.value !== null) {
      this.speedChange.emit(control.value);
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
    this.setControlDisabled(this.form.controls.speed, this.form.controls.maxSpeed.value || this.liveControlDisabled);
    this.setControlDisabled(this.form.controls.maxSpeed, this.liveControlDisabled);
    this.setControlDisabled(this.form.controls.recording, this.recordingDisabled);
    this.setControlDisabled(this.form.controls.liveMetricsEnabled, this.liveControlDisabled);
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
}
