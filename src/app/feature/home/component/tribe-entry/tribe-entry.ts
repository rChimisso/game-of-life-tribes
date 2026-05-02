/* eslint-disable jsdoc/require-jsdoc */
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {ApplyRestoreButtons} from '../../../../shared/component/apply-restore/button-pair';
import {Button} from '../../../../shared/component/button/button';
import {InputComponent} from '../../../../shared/component/input/input';
import {Tribe} from '../../model/rule';

interface TribeTextChange {
  index: number;
  value: string;
}

interface TribeColorChange {
  index: number;
  color: string;
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
export class TribeEntry {
  @Input()
  public tribe: Tribe | null = null;

  @Input()
  public index = -1;

  @Input()
  public editing = false;

  @Input()
  public editingName: string | null = null;

  @Input()
  public basicColors: string[] = [];

  @Input()
  public addName = '';

  @Input()
  public addColor = '';

  @Input()
  public canConfirmAdd = false;

  @Output()
  public readonly editToggle = new EventEmitter<number>();

  @Output()
  public readonly remove = new EventEmitter<number>();

  @Output()
  public readonly nameChange = new EventEmitter<TribeTextChange>();

  @Output()
  public readonly colorChange = new EventEmitter<TribeColorChange>();

  @Output()
  public readonly addNameChange = new EventEmitter<string>();

  @Output()
  public readonly addColorChange = new EventEmitter<string>();

  @Output()
  public readonly confirmAdd = new EventEmitter<void>();

  @Output()
  public readonly cancelAdd = new EventEmitter<void>();

  public get isAdder(): boolean {
    return !this.tribe;
  }

  public get showHeader(): boolean {
    return !!this.tribe && this.tribe.id !== 'dead';
  }

  public get showEditor(): boolean {
    return this.isAdder || this.editing;
  }

  public get showPanel(): boolean {
    return this.isAdder || this.showHeader;
  }

  public get currentName(): string {
    return this.isAdder ? this.addName : this.editingName ?? '';
  }

  public get currentColor(): string {
    return this.isAdder ? this.addColor : this.tribe?.color ?? '';
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
    this.nameChange.emit({
      index: this.index,
      value: String(value)
    });
  }

  public onColorChange(value: string | number): void {
    this.colorChange.emit({
      index: this.index,
      color: this.normalizeHex(String(value))
    });
  }

  public onAddNameChange(value: string | number): void {
    this.addNameChange.emit(String(value));
  }

  public onAddColorChange(value: string | number): void {
    this.addColorChange.emit(this.normalizeHex(String(value)));
  }

  public randomColor(): string {
    return Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  }

  public nativeColor(color: string): string {
    return `#${this.normalizeHex(color).padEnd(6, '0')}`;
  }

  private normalizeHex(value: string): string {
    return value.toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 6);
  }
}
