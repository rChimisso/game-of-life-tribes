import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnInit, Output} from '@angular/core';
import {AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators} from '@angular/forms';

import {FormComponent} from '../../../../../core/abstract/form-component';
import {FormType} from '../../../../../core/model/form-type';
import {CheckboxComponent} from '../../../../../shared/component/checkbox/checkbox';
import {InputComponent} from '../../../../../shared/component/input/input';
import {DownloadFrameRangeFormValue} from '../../../model/download';

import {TypedChanges} from '~gol/core/model/typed-change';
import {LabelValue} from '~gol/shared/component/label-value/label-value';

/**
 * Download frame range form.
 *
 * @export
 * @class DownloadFrameRangeForm
 * @typedef {DownloadFrameRangeForm}
 * @extends {FormComponent<DownloadFrameRangeFormValue>}
 * @implements {OnChanges}
 * @implements {OnInit}
 */
@Component({
  selector: 'gol-download-frame-range-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CheckboxComponent,
    InputComponent,
    LabelValue
  ],
  templateUrl: './download-frame-range-form.html',
  styleUrl: './download-frame-range-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DownloadFrameRangeForm extends FormComponent<DownloadFrameRangeFormValue> implements OnChanges, OnInit {
  /**
   * Whether the form is disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public disabled = false;

  /**
   * Whether recorded frames are available.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public hasRecordedFrames = false;

  /**
   * Amount of total recorded frames.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public totalFrames = 1;

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
   * Start frame validation message.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get startFrameError(): string {
    return this.frameError(this.form.controls.startFrame);
  }

  /**
   * End frame validation message.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get endFrameError(): string {
    let message = this.frameError(this.form.controls.endFrame);
    if (!message && this.form.hasError('frameOrder') && this.form.controls.endFrame.enabled) {
      message = 'Before start';
    }
    return message;
  }

  /**
   * Number of selected frames.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get selectedFrameCount(): string {
    const {allFrames, endFrame, startFrame} = this.form.getRawValue();
    let count = 0;
    if (this.hasRecordedFrames && (this.form.valid || this.form.disabled)) {
      if (allFrames) {
        count = this.totalFrames;
      } else {
        count = +endFrame - +startFrame + 1;
      }
    }
    return `${count}/${this.totalFrames}`;
  }

  /**
   * @inheritdoc
   */
  public ngOnInit(): void {
    this.form.setValidators(this.frameOrderValidator());
    this.syncValidators();
    this.formChanges(() => this.onFormValueChange());
    this.syncDisabledState();
    this.emitValidity();
  }

  /**
   * @inheritdoc
   */
  public override ngOnChanges(changes: TypedChanges<DownloadFrameRangeForm>): void {
    super.ngOnChanges(changes);
    if (changes.totalFrames) {
      this.syncValidators();
      if (this.totalFrames <= 0) {
        this.form.patchValue({
          allFrames: true,
          startFrame: 1,
          endFrame: 1
        });
      }
    }
    if (changes.disabled || changes.hasRecordedFrames || changes.formData || changes.totalFrames) {
      this.syncDisabledState();
      this.emitValidity();
    }
  }

  /**
   * @inheritdoc
   */
  protected override initForm(): FormType<DownloadFrameRangeFormValue> {
    return {
      allFrames: new FormControl(true, {nonNullable: true}),
      startFrame: new FormControl(1, {nonNullable: true}),
      endFrame: new FormControl(1, {nonNullable: true})
    };
  }

  /**
   * Handles any form value change.
   *
   * @private
   */
  private onFormValueChange(): void {
    this.syncDisabledState();
    this.emitValidity();
    if (this.form.valid) {
      this.emitSubmit();
    }
  }

  /**
   * Syncs validators for dynamic frame limits.
   *
   * @private
   */
  private syncValidators(): void {
    const validators = [Validators.min(1), this.maxFrameValidator()];
    this.form.controls.startFrame.setValidators(validators);
    this.form.controls.endFrame.setValidators(validators);
    this.form.controls.startFrame.updateValueAndValidity({emitEvent: false});
    this.form.controls.endFrame.updateValueAndValidity({emitEvent: false});
    this.form.updateValueAndValidity({emitEvent: false});
  }

  /**
   * Syncs the disabled state of the controls.
   *
   * @private
   */
  private syncDisabledState(): void {
    if (this.disabled || !this.hasRecordedFrames) {
      this.form.disable({emitEvent: false});
    } else {
      this.form.controls.allFrames.enable({emitEvent: false});
      if (this.form.controls.allFrames.value) {
        this.form.controls.startFrame.disable({emitEvent: false});
        this.form.controls.endFrame.disable({emitEvent: false});
      } else {
        this.form.controls.startFrame.enable({emitEvent: false});
        this.form.controls.endFrame.enable({emitEvent: false});
      }
    }
    this.form.updateValueAndValidity({emitEvent: false});
  }

  /**
   * Emits the current form validity.
   *
   * @private
   */
  private emitValidity(): void {
    this.validityChange.emit(this.disabled || !this.hasRecordedFrames || this.form.valid);
  }

  /**
   * Builds a max frame validator.
   *
   * @private
   * @returns {ValidatorFn}
   */
  private maxFrameValidator(): ValidatorFn {
    return (control: AbstractControl<number>): ValidationErrors | null => {
      let errors: ValidationErrors | null = null;
      if (+control.value > this.totalFrames) {
        errors = {maxFrame: true};
      }
      return errors;
    };
  }

  /**
   * Builds a start/end ordering validator.
   *
   * @private
   * @returns {ValidatorFn}
   */
  private frameOrderValidator(): ValidatorFn {
    return (): ValidationErrors | null => {
      let errors: ValidationErrors | null = null;
      const startFrame = +this.form.controls.startFrame.value;
      const endFrame = +this.form.controls.endFrame.value;
      if (!this.form.controls.allFrames.value && startFrame > endFrame) {
        errors = {frameOrder: true};
      }
      return errors;
    };
  }

  /**
   * Gets a frame control validation message.
   *
   * @private
   * @param {FormControl<number>} control
   * @returns {string}
   */
  private frameError(control: FormControl<number>): string {
    let message = '';
    if (control.enabled && control.hasError('min')) {
      message = 'Min 1';
    } else if (control.enabled && control.hasError('maxFrame')) {
      message = `Max ${this.totalFrames.toLocaleString()}`;
    }
    return message;
  }
}
