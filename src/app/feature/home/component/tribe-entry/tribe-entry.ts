/* eslint-disable jsdoc/require-jsdoc */
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {ApplyRestoreButtons} from '../../../../shared/component/apply-restore/button-pair';
import {Button} from '../../../../shared/component/button/button';
import {InputComponent} from '../../../../shared/component/input/input';
import {DEAD_TRIBE, EditableTribe, Tribe} from '../../model/rule';

interface TribeDraftChange {
  index: number;
  tribe: Tribe;
}

@Component({
  selector: 'gol-tribe-entry',
  standalone: true,
  imports: [
    FormsModule,
    InputComponent,
    Button,
    ApplyRestoreButtons
  ],
  templateUrl: './tribe-entry.html',
  styleUrl: './tribe-entry.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TribeEntry implements OnChanges {
  @Input()
  public tribe: Tribe | null = null;

  @Input()
  public index = -1;

  @Input()
  public existingTribes: readonly EditableTribe[] = [];

  @Input()
  public basicColors: string[] = [];

  @Input()
  public addName = '';

  @Input()
  public addColor = '';

  @Input()
  public canConfirmAdd = false;

  @Output()
  public readonly remove = new EventEmitter<number>();

  @Output()
  public readonly confirmEdit = new EventEmitter<TribeDraftChange>();

  @Output()
  public readonly addNameChange = new EventEmitter<string>();

  @Output()
  public readonly addColorChange = new EventEmitter<string>();

  @Output()
  public readonly confirmAdd = new EventEmitter<void>();

  @Output()
  public readonly cancelAdd = new EventEmitter<void>();

  public draftName = '';

  public draftColor = '';

  public editing = false;

  public get isAdder(): boolean {
    return !this.tribe;
  }

  public get showEditor(): boolean {
    return this.isAdder || this.editing;
  }

  public get headerName(): string {
    return this.tribe?.id ?? '';
  }

  public get headerColor(): string {
    return this.tribe?.color ?? '';
  }

  public get currentName(): string {
    return this.isAdder ? this.addName : this.draftName;
  }

  public get currentColor(): string {
    return this.isAdder ? this.addColor : this.draftColor;
  }

  public get hasPendingChanges(): boolean {
    if (!this.tribe) {
      return false;
    }
    return this.draftName !== this.tribe.id || this.draftColor !== this.tribe.color;
  }

  public get canConfirmEdit(): boolean {
    if (!this.tribe) {
      return false;
    }
    const cleanId = this.normalizeId(this.draftName);
    const cleanColor = this.normalizeHex(this.draftColor);
    if (!cleanId || cleanId === DEAD_TRIBE.id || cleanColor.length !== 6) {
      return false;
    }
    return !this.existingTribes.some((entry, entryIndex) => entryIndex !== this.index && entry.id === cleanId);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['tribe']) {
      this.resetDraft();
      if (!changes['tribe'].firstChange) {
        this.editing = false;
      }
    }
  }

  public openEditor(): void {
    if (this.isAdder) {
      return;
    }
    this.resetDraft();
    this.editing = true;
  }

  public cancelEdit(): void {
    this.resetDraft();
    this.editing = false;
  }

  public onCurrentNameChange(value: string | number): void {
    if (this.isAdder) {
      this.onAddNameChange(value);
    } else {
      this.onNameChange(value);
    }
  }

  public onCurrentColorChange(value: string | number): void {
    if (this.isAdder) {
      this.onAddColorChange(value);
    } else {
      this.onColorChange(value);
    }
  }

  public onNameChange(value: string | number): void {
    this.draftName = this.normalizeId(String(value));
  }

  public onColorChange(value: string | number): void {
    this.draftColor = this.normalizeHex(String(value));
  }

  public onAddNameChange(value: string | number): void {
    this.addNameChange.emit(String(value));
  }

  public onAddColorChange(value: string | number): void {
    this.addColorChange.emit(this.normalizeHex(String(value)));
  }

  public onConfirmEdit(): void {
    if (!this.tribe || !this.canConfirmEdit || !this.hasPendingChanges) {
      return;
    }
    this.confirmEdit.emit({
      index: this.index,
      tribe: {
        id: this.draftName,
        color: this.draftColor
      }
    });
    this.editing = false;
  }

  public randomColor(): string {
    return Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  }

  public nativeColor(color: string): string {
    return `#${this.normalizeHex(color).padEnd(6, '0')}`;
  }

  public isColorSelected(color: string): boolean {
    return this.currentColor.toLowerCase() === color.toLowerCase();
  }

  private normalizeHex(value: string): string {
    return value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
  }

  private normalizeId(value: string): string {
    return value.replace(/[^A-Za-z0-9]/g, '');
  }

  private resetDraft(): void {
    if (!this.tribe) {
      this.draftName = '';
      this.draftColor = '';
      return;
    }
    this.draftName = this.tribe.id;
    this.draftColor = this.tribe.color;
  }
}
