import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {ApplyRestoreButtons} from '../../../../shared/component/apply-restore/button-pair';
import {Button} from '../../../../shared/component/button/button';
import {InputComponent} from '../../../../shared/component/input/input';
import {TribeSwatch} from '../../../../shared/component/tribe-swatch/tribe-swatch';
import {DEAD_TRIBE_ID, EditableTribe, Tribe} from '../../model/rule';
import {TribeSaveEvent} from '../../model/tribe-save-event';

import {TypedChanges} from '~gol/core/model/typed-change';

/**
 * Tribe entry editor.
 *
 * @export
 * @class TribeEntry
 * @typedef {TribeEntry}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-tribe-entry',
  standalone: true,
  imports: [
    FormsModule,
    InputComponent,
    Button,
    ApplyRestoreButtons,
    TribeSwatch
  ],
  templateUrl: './tribe-entry.html',
  styleUrl: './tribe-entry.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TribeEntry implements OnChanges {
  /**
   * Existing tribe.
   *
   * @public
   * @type {Tribe | null}
   */
  @Input()
  public tribe: Tribe | null = null;

  /**
   * Stable key of the current tribe.
   *
   * @public
   * @type {string}
   */
  @Input()
  public tribeKey = '';

  /**
   * Currently existing tribes.
   *
   * @public
   * @type {readonly EditableTribe[]}
   */
  @Input()
  public existingTribes: readonly EditableTribe[] = [];

  /**
   * Colors available for easy selection.
   *
   * @public
   * @type {string[]}
   */
  @Input()
  public basicColors: string[] = [];

  /**
   * Name for a new tribe.
   *
   * @public
   * @type {string}
   */
  @Input()
  public addName = '';

  /**
   * Color for a new tribe.
   *
   * @public
   * @type {string}
   */
  @Input()
  public addColor = '';

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
   * Emits confirmed add/edit tribe changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<TribeSaveEvent>}
   */
  @Output()
  public readonly save = new EventEmitter<TribeSaveEvent>();

  /**
   * Emits changes to the add-tribe name draft.
   *
   * @public
   * @readonly
   * @type {EventEmitter<string>}
   */
  @Output()
  public readonly addNameChange = new EventEmitter<string>();

  /**
   * Emits changes to the add-tribe color draft.
   *
   * @public
   * @readonly
   * @type {EventEmitter<string>}
   */
  @Output()
  public readonly addColorChange = new EventEmitter<string>();

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
   * Draft tribe name while editing.
   *
   * @public
   * @type {string}
   */
  public draftName = '';

  /**
   * Draft tribe color while editing.
   *
   * @public
   * @type {string}
   */
  public draftColor = '';

  /**
   * Whether the edit panel is open.
   *
   * @public
   * @type {boolean}
   */
  public editing = false;

  /**
   * Whether this entry is the add-tribe row.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get isAdder(): boolean {
    return !this.tribe;
  }

  /**
   * Whether the editor panel should be visible.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get showEditor(): boolean {
    return this.isAdder || this.editing;
  }

  /**
   * Header label for the tribe name.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get headerName(): string {
    return this.tribe?.id ?? '';
  }

  /**
   * Header value for the tribe color.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get headerColor(): string {
    return this.tribe?.color ?? '';
  }

  /**
   * Current tribe name shown in inputs.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get currentName(): string {
    return this.isAdder ? this.addName : this.draftName;
  }

  /**
   * Current tribe color shown in inputs.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get currentColor(): string {
    return this.isAdder ? this.addColor : this.draftColor;
  }

  /**
   * Whether the edit draft differs from the current tribe.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get hasPendingChanges(): boolean {
    return !(!this.tribe || (this.draftName === this.tribe.id && this.draftColor === this.tribe.color));
  }

  /**
   * Whether the current edit draft can be saved.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get canConfirmEdit(): boolean {
    return !!(this.tribe && this.validateTribeDraft(this.draftName, this.draftColor, this.tribeKey));
  }

  /**
   * Whether the current add draft can be saved.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get canConfirmAdd(): boolean {
    return !!this.validateTribeDraft(this.addName, this.addColor);
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<TribeEntry>): void {
    if (changes.tribe) {
      this.resetDraft();
      if (!changes.tribe.firstChange) {
        this.editing = false;
      }
    }
  }

  /**
   * Opens the editor for an existing tribe.
   *
   * @public
   */
  public openEditor(): void {
    if (!this.isAdder) {
      this.resetDraft();
      this.editing = true;
    }
  }

  /**
   * Cancels editing and restores draft values.
   *
   * @public
   */
  public cancelEdit(): void {
    this.resetDraft();
    this.editing = false;
  }

  /**
   * Handles name input changes for add/edit modes.
   *
   * @public
   * @param {string | number} value
   */
  public onCurrentNameChange(value: string | number): void {
    if (this.isAdder) {
      this.onAddNameChange(value);
    } else {
      this.onNameChange(value);
    }
  }

  /**
   * Handles color input changes for add/edit modes.
   *
   * @public
   * @param {string | number} value
   */
  public onCurrentColorChange(value: string | number): void {
    if (this.isAdder) {
      this.onAddColorChange(value);
    } else {
      this.onColorChange(value);
    }
  }

  /**
   * Updates the edit name draft.
   *
   * @public
   * @param {string | number} value
   */
  public onNameChange(value: string | number): void {
    this.draftName = this.normalizeId(String(value));
  }

  /**
   * Updates the edit color draft.
   *
   * @public
   * @param {string | number} value
   */
  public onColorChange(value: string | number): void {
    this.draftColor = this.normalizeHex(String(value));
  }

  /**
   * Emits add-name draft changes.
   *
   * @public
   * @param {string | number} value
   */
  public onAddNameChange(value: string | number): void {
    this.addNameChange.emit(String(value));
  }

  /**
   * Emits add-color draft changes.
   *
   * @public
   * @param {string | number} value
   */
  public onAddColorChange(value: string | number): void {
    this.addColorChange.emit(this.normalizeHex(String(value)));
  }

  /**
   * Saves the current add/edit draft when valid.
   *
   * @public
   */
  public onSave(): void {
    if (this.isAdder) {
      const addValidated = this.validateTribeDraft(this.addName, this.addColor);
      if (addValidated) {
        this.save.emit({
          kind: 'add',
          tribe: addValidated
        });
      }
      return;
    }

    const editValidated = this.validateTribeDraft(this.draftName, this.draftColor, this.tribeKey);
    if (this.tribe && this.tribeKey && editValidated && this.hasPendingChanges) {
      this.save.emit({
        kind: 'edit',
        key: this.tribeKey,
        tribe: editValidated
      });
      this.editing = false;
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
   * Converts a hex string to native picker format.
   *
   * @public
   * @param {string} color
   * @returns {string}
   */
  public nativeColor(color: string): string {
    return `#${this.normalizeHex(color).padEnd(6, '0')}`;
  }

  /**
   * Whether a palette color is currently selected.
   *
   * @public
   * @param {string} color
   * @returns {boolean}
   */
  public isColorSelected(color: string): boolean {
    return this.currentColor.toLowerCase() === color.toLowerCase();
  }

  /**
   * Normalizes a hex color string.
   *
   * @private
   * @param {string} value
   * @returns {string}
   */
  private normalizeHex(value: string): string {
    return value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
  }

  /**
   * Normalizes a tribe id string.
   *
   * @private
   * @param {string} value
   * @returns {string}
   */
  private normalizeId(value: string): string {
    return value.replace(/[^A-Za-z0-9]/g, '');
  }

  /**
   * Validates and normalizes a tribe draft.
   *
   * @private
   * @param {string} name
   * @param {string} color
   * @param {string | null} [excludeKey=null]
   * @returns {(Tribe | null)}
   */
  private validateTribeDraft(name: string, color: string, excludeKey: string | null = null): Tribe | null {
    const cleanId = this.normalizeId(name);
    const cleanColor = this.normalizeHex(color);
    if (!cleanId || cleanId === DEAD_TRIBE_ID || cleanColor.length !== 6) {
      return null;
    }
    if (this.existingTribes.some(entry => entry.id === cleanId && entry.key !== excludeKey)) {
      return null;
    }
    return {
      id: cleanId,
      color: cleanColor
    };
  }

  /**
   * Resets edit drafts from the current tribe.
   *
   * @private
   */
  private resetDraft(): void {
    if (this.tribe) {
      this.draftName = this.tribe.id;
      this.draftColor = this.tribe.color;
    } else {
      this.draftName = '';
      this.draftColor = '';
    }
  }
}
