import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn} from '@angular/forms';
import {MatTooltipModule} from '@angular/material/tooltip';

import {TypedChanges} from '~gol/core/model/typed-change';
import {TribeFormControls, TribeFormValue} from '~gol/feature/home/model/tribe-form';
import {ApplyRestoreButtons} from '~gol/shared/component/apply-restore/button-pair';
import {Button} from '~gol/shared/component/button/button';
import {TextInputComponent} from '~gol/shared/component/input/text-input/text-input';
import {TribeSwatch} from '~gol/shared/component/tribe-swatch/tribe-swatch';

/**
 * Tribe entry editor.
 *
 * @class TribeEntry
 * @typedef {TribeEntry}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-tribe-entry',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextInputComponent,
    Button,
    ApplyRestoreButtons,
    TribeSwatch,
    MatTooltipModule
  ],
  templateUrl: './tribe-entry.html',
  styleUrl: './tribe-entry.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TribeEntry implements OnChanges {
  /**
   * Tribe row form.
   *
   * @public
   * @type {(FormGroup<TribeFormControls> | null)}
   */
  @Input()
  public form: FormGroup<TribeFormControls> | null = null;

  /**
   * Stable key of the current tribe.
   *
   * @public
   * @type {string}
   */
  @Input()
  public tribeKey = '';

  /**
   * Whether this entry is the add-tribe row.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public adder = false;

  /**
   * Colors available for easy selection.
   *
   * @public
   * @type {readonly string[]}
   */
  @Input()
  public basicColors: readonly string[] = [];

  /**
   * Parent collection validation version.
   *
   * @public
   * @type {number}
   */
  @Input()
  public validationVersion = 0;

  /**
   * Emits the tribe key to remove.
   *
   * @public
   * @readonly
   * @type {EventEmitter<string>}
   */
  @Output()
  public readonly remove = new EventEmitter<string>();

  /**
   * Emits add confirmation.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly add = new EventEmitter<void>();

  /**
   * Emits add-editor cancellation requests.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly cancelAdd = new EventEmitter<void>();

  /**
   * Emits editing state changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly editingChange = new EventEmitter<boolean>();

  /**
   * Whether the edit panel is open.
   *
   * @public
   * @type {boolean}
   */
  public editing = false;

  /**
   * Local form used for unconfirmed row edits.
   *
   * @public
   * @readonly
   * @type {FormGroup<TribeFormControls>}
   */
  public readonly editorForm = new FormGroup<TribeFormControls>({
    id: new FormControl('', {nonNullable: true, validators: [this.rowControlValidator('id')]}),
    color: new FormControl('', {nonNullable: true, validators: [this.rowControlValidator('color')]})
  });

  /**
   * Row baseline used by edit cancellation.
   *
   * @private
   * @type {(TribeFormValue | null)}
   */
  private rowEditBaseline: TribeFormValue | null = null;

  /**
   * Whether the editor panel should be visible.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get showEditor(): boolean {
    return this.adder || this.editing;
  }

  /**
   * Form used by the currently visible editor.
   *
   * @public
   * @readonly
   * @type {(FormGroup<TribeFormControls> | null)}
   */
  public get activeForm(): FormGroup<TribeFormControls> | null {
    return this.adder ? this.form : this.editorForm;
  }

  /**
   * Header label for the tribe name.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get headerName(): string {
    return this.form?.controls.id.value ?? '';
  }

  /**
   * Header value for the tribe color.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get headerColor(): string {
    return this.form?.controls.color.value ?? '';
  }

  /**
   * Whether the current edit draft differs from the row edit baseline.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get hasPendingChanges(): boolean {
    const current = this.editorForm.getRawValue();
    return !!(current && this.rowEditBaseline && (current.id !== this.rowEditBaseline.id || current.color !== this.rowEditBaseline.color));
  }

  /**
   * Whether the current row edit can be confirmed.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get canConfirmEdit(): boolean {
    return !!(this.form && this.editorForm.valid && this.hasPendingChanges);
  }

  /**
   * Whether the current add draft can be saved.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get canConfirmAdd(): boolean {
    return !!(this.form && this.form.valid);
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<TribeEntry>): void {
    if ((changes.form || changes.adder) && !this.adder) {
      this.syncEditorFromRow();
    }
    if (changes.validationVersion && !this.adder) {
      this.revalidateDraftId();
    }
  }

  /**
   * Opens the editor for an existing tribe.
   *
   * @public
   */
  public openEditor(): void {
    if (!this.adder && this.form) {
      this.rowEditBaseline = this.form.getRawValue();
      this.syncEditorFromRow();
      this.editorForm.updateValueAndValidity({emitEvent: false});
      this.editing = true;
      this.editingChange.emit(true);
    }
  }

  /**
   * Cancels editing and restores draft values.
   *
   * @public
   */
  public cancelEdit(): void {
    if (this.rowEditBaseline) {
      this.editorForm.setValue(this.rowEditBaseline, {emitEvent: false});
    }
    this.editing = false;
    this.rowEditBaseline = null;
    this.editingChange.emit(false);
  }

  /**
   * Confirms the current add/edit draft when valid.
   *
   * @public
   */
  public confirm(): void {
    if (this.adder) {
      if (this.canConfirmAdd) {
        this.add.emit();
      }
    } else {
      this.revalidateDraftId();
      if (this.canConfirmEdit) {
        this.form?.setValue(this.editorForm.getRawValue());
        this.editing = false;
        this.rowEditBaseline = null;
        this.editingChange.emit(false);
      }
    }
  }

  /**
   * Emits removal for the current tribe key.
   *
   * @public
   */
  public onRemove(): void {
    if (this.tribeKey) {
      this.remove.emit(this.tribeKey);
    }
  }

  /**
   * Creates a random RGB hex color.
   *
   * @public
   * @returns {string}
   */
  public randomColor(): string {
    return Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  }

  /**
   * Sets the edited color.
   *
   * @public
   * @param {string} color color value.
   */
  public setColor(color: string): void {
    if (this.activeForm) {
      this.activeForm.controls.color.setValue(this.normalizeHex(color));
    }
  }

  /**
   * Handles native color picker input.
   *
   * @public
   * @param {Event} event input event.
   */
  public onNativeColorInput(event: Event): void {
    const {target} = event;
    if (target instanceof HTMLInputElement) {
      this.setColor(target.value);
    }
  }

  /**
   * Converts a hex string to native picker format.
   *
   * @public
   * @param {string} color color value.
   * @returns {string} native picker color.
   */
  public nativeColor(color: string): string {
    return `#${this.normalizeHex(color).padEnd(6, '0')}`;
  }

  /**
   * Whether a palette color is currently selected.
   *
   * @public
   * @param {string} color color to check.
   * @returns {boolean} whether the color is selected.
   */
  public isColorSelected(color: string): boolean {
    return (this.activeForm?.controls.color.value ?? '').toLowerCase() === color.toLowerCase();
  }

  /**
   * Synchronizes the local editor form from the row form.
   *
   * @private
   */
  private syncEditorFromRow(): void {
    if (this.form) {
      this.editorForm.setValue(this.form.getRawValue(), {emitEvent: false});
      this.editorForm.markAsPristine();
      this.editorForm.markAsUntouched();
      this.editorForm.updateValueAndValidity({emitEvent: false});
    }
  }

  /**
   * Revalidates the local draft ID against current parent rows.
   *
   * @private
   */
  private revalidateDraftId(): void {
    this.editorForm.controls.id.updateValueAndValidity({emitEvent: false});
    this.editorForm.updateValueAndValidity({emitEvent: false});
  }

  /**
   * Mirrors row control validation on the local editor form.
   *
   * @private
   * @param {'id' | 'color'} controlName control name.
   * @returns {ValidatorFn} validator.
   */
  private rowControlValidator(controlName: 'id' | 'color'): ValidatorFn {
    return (control): ValidationErrors | null => this.form?.controls[controlName].validator?.(control) ?? null;
  }

  /**
   * Normalizes a hex color string.
   *
   * @private
   * @param {string} value value to normalize.
   * @returns {string} normalized value.
   */
  private normalizeHex(value: string): string {
    return value.replace(/^#/, '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
  }
}
