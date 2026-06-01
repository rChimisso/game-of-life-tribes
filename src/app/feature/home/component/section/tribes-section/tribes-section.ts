import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';

import {ApplyRestoreButtons} from '../../../../../shared/component/apply-restore/button-pair';
import {Button} from '../../../../../shared/component/button/button';
import {analyzeTribeApplyImpact} from '../../../logic/tribe-impact';
import {DEAD_TRIBE_ID, EditableTribe, Rule, Tribe} from '../../../model/rule';
import {UpdateTribesPayload} from '../../../model/sidebar-event';
import {TribeApplyImpact} from '../../../model/tribe-impact';
import {TribeSaveEvent} from '../../../model/tribe-save-event';
import {TribeEntry} from '../../element/tribe-entry/tribe-entry';

import {TypedChanges} from '~gol/core/model/typed-change';

/**
 * Tribe editor section.
 *
 * @class TribesSection
 * @typedef {TribesSection}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-tribes-section',
  standalone: true,
  imports: [Button, ApplyRestoreButtons, TribeEntry],
  templateUrl: './tribes-section.html',
  styleUrl: './tribes-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TribesSection implements OnChanges {
  /**
   * Committed tribes.
   *
   * @public
   * @type {Tribe[]}
   */
  @Input({required: true})
  public committedTribes: Tribe[] = [];

  /**
   * Committed rules.
   *
   * @public
   * @type {Rule<Tribe[]>[]}
   */
  @Input({required: true})
  public committedRules: Rule<Tribe[]>[] = [];

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
   * Emitter for applied tribe changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<UpdateTribesPayload>}
   */
  @Output()
  public readonly applyTribes = new EventEmitter<UpdateTribesPayload>();

  /**
   * Basic color palette.
   *
   * @public
   * @readonly
   * @type {readonly string[]}
   */
  public readonly basicColors = [
    '000088',
    '0000ff',
    '008800',
    '008888',
    '0088ff',
    '00ff00',
    '00ff88',
    '00ffff',
    '880000',
    '880088',
    '8800ff',
    '888800',
    '888888',
    '8888ff',
    '88ff00',
    '88ff88',
    '88ffff',
    'ff0000',
    'ff0088',
    'ff00ff',
    'ff8800',
    'ff8888',
    'ff88ff',
    'ffff00',
    'ffff88',
    'ffffff'
  ];

  /**
   * Editable tribes.
   *
   * @public
   * @type {EditableTribe[]}
   */
  public editTribes: EditableTribe[] = [];

  /**
   * Baseline editable tribes.
   *
   * @private
   * @type {EditableTribe[]}
   */
  private baselineTribes: EditableTribe[] = [];

  /**
   * Next editable tribe key counter.
   *
   * @private
   * @type {number}
   */
  private nextEditableTribeKey = 0;

  /**
   * Whether the add tribe editor is visible.
   *
   * @public
   * @type {boolean}
   */
  public showTribeAdder = false;

  /**
   * New tribe id.
   *
   * @public
   * @type {string}
   */
  public newTribeId = '';

  /**
   * New tribe color.
   *
   * @public
   * @type {string}
   */
  public newTribeColor = '';

  /**
   * Whether pending tribes differ from the baseline.
   *
   * @public
   * @type {boolean}
   */
  public get hasUnappliedTribes(): boolean {
    return !this.tribesEqual(this.editTribes, this.baselineTribes);
  }

  /**
   * Impact of applying pending tribe changes.
   *
   * @public
   * @type {TribeApplyImpact}
   */
  public get tribeApplyImpact(): TribeApplyImpact {
    return analyzeTribeApplyImpact(this.baselineTribes, this.editTribes, this.committedRules);
  }

  /**
   * Whether applying pending tribe changes is blocked.
   *
   * @public
   * @type {boolean}
   */
  public get tribeApplyBlocked(): boolean {
    return this.tribeApplyImpact.blocked;
  }

  /**
   * Tribe apply error message.
   *
   * @public
   * @type {(string | null)}
   */
  public get tribeApplyErrorMessage(): string | null {
    return this.tribeApplyImpact.message;
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<TribesSection>): void {
    if (changes.committedTribes) {
      this.syncTribesFromCommitted();
      this.cancelAddTribe();
    }
  }

  /**
   * Opens the add tribe editor.
   *
   * @public
   */
  public startAddTribe(): void {
    this.showTribeAdder = true;
    this.newTribeId = '';
    this.newTribeColor = this.randomColor();
  }

  /**
   * Closes the add tribe editor.
   *
   * @public
   */
  public cancelAddTribe(): void {
    this.showTribeAdder = false;
    this.newTribeId = '';
    this.newTribeColor = '';
  }

  /**
   * Handles saved tribe changes.
   *
   * @public
   * @param {TribeSaveEvent} event
   */
  public onSaveTribe(event: TribeSaveEvent): void {
    if (event.kind === 'add') {
      this.editTribes.push({
        id: event.tribe.id,
        color: event.tribe.color,
        key: this.createEditableTribeKey()
      });
      this.cancelAddTribe();
      return;
    }

    const index = this.findEditTribeIndexByKey(event.key);
    if (index < 0) {
      return;
    }

    this.editTribes[index] = {
      ...this.editTribes[index]!,
      id: event.tribe.id,
      color: event.tribe.color
    };
  }

  /**
   * Removes an editable tribe.
   *
   * @public
   * @param {string} key
   */
  public onRemoveTribe(key: string): void {
    const index = this.findEditTribeIndexByKey(key);
    if (index < 0) {
      return;
    }

    const {id} = this.editTribes[index]!;
    if (id === DEAD_TRIBE_ID) {
      return;
    }
    this.editTribes.splice(index, 1);
  }

  /**
   * Applies pending tribe changes.
   *
   * @public
   */
  public onApplyTribes(): void {
    if (this.tribeApplyBlocked || !this.hasUnappliedTribes) {
      return;
    }
    this.applyTribes.emit({
      tribes: this.editTribes.map(tribe => this.toTribe(tribe)),
      renamePairs: this.tribeApplyImpact.renamePairs
    });
  }

  /**
   * Restores tribes from the baseline.
   *
   * @public
   */
  public onRestoreTribes(): void {
    this.editTribes = this.baselineTribes.map(tribe => ({...tribe}));
    this.cancelAddTribe();
  }

  /**
   * Creates a random hex color.
   *
   * @public
   * @returns {string}
   */
  public randomColor(): string {
    return Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  }

  /**
   * Synchronizes editable tribes from committed tribes.
   *
   * @private
   */
  private syncTribesFromCommitted(): void {
    this.editTribes = this.committedTribes.map(tribe => this.toEditableTribe(tribe));
    this.baselineTribes = this.editTribes.map(tribe => ({...tribe}));
  }

  /**
   * Converts a committed tribe to an editable tribe.
   *
   * @private
   * @param {Tribe} tribe
   * @returns {EditableTribe}
   */
  private toEditableTribe(tribe: Tribe): EditableTribe {
    return {
      ...tribe,
      key: this.createEditableTribeKey()
    };
  }

  /**
   * Converts an editable tribe to a committed tribe.
   *
   * @private
   * @param {EditableTribe} tribe
   * @returns {Tribe}
   */
  private toTribe(tribe: EditableTribe): Tribe {
    return {id: tribe.id, color: tribe.color};
  }

  /**
   * Finds an editable tribe by key.
   *
   * @private
   * @param {string} key
   * @returns {number}
   */
  private findEditTribeIndexByKey(key: string): number {
    return this.editTribes.findIndex(tribe => tribe.key === key);
  }

  /**
   * Creates an editable tribe key.
   *
   * @private
   * @returns {string}
   */
  private createEditableTribeKey(): string {
    const key = `editable-tribe-${this.nextEditableTribeKey}`;
    this.nextEditableTribeKey++;
    return key;
  }

  /**
   * Checks whether editable tribes match the baseline.
   *
   * @private
   * @param {readonly EditableTribe[]} editableTribes
   * @param {readonly EditableTribe[]} baseTribes
   * @returns {boolean}
   */
  private tribesEqual(editableTribes: readonly EditableTribe[], baseTribes: readonly EditableTribe[]): boolean {
    if (editableTribes.length !== baseTribes.length) {
      return false;
    }

    return editableTribes.every((tribe, index) => {
      const base = baseTribes[index];
      return base ? tribe.id === base.id && tribe.color === base.color : false;
    });
  }
}
