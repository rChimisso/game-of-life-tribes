import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnInit, Output} from '@angular/core';
import {AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators} from '@angular/forms';

import {FormComponent} from '~gol/core/abstract/form-component';
import {FormType} from '~gol/core/model/form-type';
import {TypedChanges} from '~gol/core/model/typed-change';
import {DownloadMp4SettingsFormValue} from '~gol/feature/home/model/download';
import {InputComponent} from '~gol/shared/component/input/input';

/**
 * Download MP4 settings form.
 *
 * @class DownloadMp4SettingsForm
 * @typedef {DownloadMp4SettingsForm}
 * @extends {FormComponent<DownloadMp4SettingsFormValue>}
 * @implements {OnChanges}
 * @implements {OnInit}
 */
@Component({
  selector: 'gol-download-mp4-settings-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  templateUrl: './download-mp4-settings-form.html',
  styleUrl: './download-mp4-settings-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DownloadMp4SettingsForm extends FormComponent<DownloadMp4SettingsFormValue> implements OnChanges, OnInit {
  /**
   * Whether the form is disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public disabled = false;

  /**
   * Emitter for current form validity.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly validityChange = new EventEmitter<boolean>();

  /**
   * FPS validation message.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get fpsError(): string {
    return this.numberError(this.form.controls.mp4Fps, 240);
  }

  /**
   * Bitrate validation message.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get bitrateError(): string {
    return this.numberError(this.form.controls.mp4BitrateMbps, 60);
  }

  /**
   * @inheritdoc
   */
  public ngOnInit(): void {
    this.formChanges(() => this.onFormValueChange());
    this.syncDisabledState();
    this.emitValidity();
  }

  /**
   * @inheritdoc
   */
  public override ngOnChanges(changes: TypedChanges<DownloadMp4SettingsForm>): void {
    super.ngOnChanges(changes);
    if (changes.disabled || changes.formData) {
      this.syncDisabledState();
      this.emitValidity();
    }
  }

  /**
   * @inheritdoc
   */
  protected override initForm(): FormType<DownloadMp4SettingsFormValue> {
    return {
      mp4Fps: new FormControl(12, {
        nonNullable: true,
        validators: [Validators.min(1), Validators.max(240), this.integerValidator()]
      }),
      mp4BitrateMbps: new FormControl(2, {
        nonNullable: true,
        validators: [Validators.min(1), Validators.max(60), this.integerValidator()]
      })
    };
  }

  /**
   * Handles any form value change.
   *
   * @private
   */
  private onFormValueChange(): void {
    this.emitValidity();
    if (this.form.valid) {
      this.emitSubmit();
    }
  }

  /**
   * Syncs the disabled state of the controls.
   *
   * @private
   */
  private syncDisabledState(): void {
    if (this.disabled) {
      this.form.disable({emitEvent: false});
    } else {
      this.form.enable({emitEvent: false});
    }
    this.form.updateValueAndValidity({emitEvent: false});
  }

  /**
   * Emits the current form validity.
   *
   * @private
   */
  private emitValidity(): void {
    this.validityChange.emit(this.disabled || this.form.valid);
  }

  /**
   * Builds an integer validator.
   *
   * @private
   * @returns {ValidatorFn}
   */
  private integerValidator(): ValidatorFn {
    return (control: AbstractControl<number>): ValidationErrors | null => {
      let errors: ValidationErrors | null = null;
      if (!Number.isInteger(+control.value)) {
        errors = {integer: true};
      }
      return errors;
    };
  }

  /**
   * Gets a numeric control validation message.
   *
   * @private
   * @param {FormControl<number>} control
   * @param {number} max
   * @returns {string}
   */
  private numberError(control: FormControl<number>, max: number): string {
    let message = '';
    if (control.enabled && control.hasError('min')) {
      message = 'Min 1';
    } else if (control.enabled && control.hasError('max')) {
      message = `Max ${max}`;
    } else if (control.enabled && control.hasError('integer')) {
      message = 'Integer';
    }
    return message;
  }
}
