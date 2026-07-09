import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators} from '@angular/forms';

import {TribeEntry} from '../../element/tribe-entry/tribe-entry';

import {resetControlInteractionState} from '~gol/core/function/form-control';
import {FormBaselineController} from '~gol/core/model/form-baseline-controller';
import {TypedChanges} from '~gol/core/model/typed-change';
import {analyzeTribeApplyImpact, analyzeTribePackingImpact} from '~gol/feature/home/logic/tribe-impact';
import {GridTopology} from '~gol/feature/home/model/grid';
import {BitsPerCell} from '~gol/feature/home/model/grid-format';
import {BOUNDED_GRID_TOPOLOGY, DEAD_TRIBE_ID, EditableTribe, Rule, TOROIDAL_GRID_TOPOLOGY, Tribe} from '~gol/feature/home/model/rule';
import {UpdateTribesPayload} from '~gol/feature/home/model/sidebar-event';
import {TribeFormControls, TribesFormControls, TribeFormValue} from '~gol/feature/home/model/tribe-form';
import {TribeApplyImpact, TribePackingImpact} from '~gol/feature/home/model/tribe-impact';
import {ApplyRestoreButtons} from '~gol/shared/component/apply-restore/button-pair';
import {Button} from '~gol/shared/component/button/button';

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
  imports: [
    ReactiveFormsModule,
    Button,
    ApplyRestoreButtons,
    TribeEntry
  ],
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
   * Committed grid topology.
   *
   * @public
   * @type {GridTopology}
   */
  @Input({required: true})
  public topology: GridTopology = TOROIDAL_GRID_TOPOLOGY;

  /**
   * Committed bounded-grid boundary tribe.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public boundaryTribe = DEAD_TRIBE_ID;

  /**
   * Current grid columns.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public gridCols = 0;

  /**
   * Current grid rows.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public gridRows = 0;

  /**
   * Active simulation packing.
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
  public readonly basicColors: readonly string[] = [
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
   * Tribe collection form.
   *
   * @public
   * @readonly
   * @type {FormGroup<TribesFormControls>}
   */
  public readonly form = new FormGroup<TribesFormControls>({
    tribes: new FormArray<FormGroup<TribeFormControls>>([])
  });

  /**
   * Stable row keys aligned with the tribe FormArray.
   *
   * @public
   * @type {string[]}
   */
  public rowKeys: string[] = [];

  /**
   * Version used to refresh open row draft validators.
   *
   * @public
   * @type {number}
   */
  public tribeDraftValidationVersion = 0;

  /**
   * Keys currently open for row editing.
   *
   * @private
   * @readonly
   * @type {Set<string>}
   */
  private readonly editingKeys = new Set<string>();

  /**
   * Baseline coordinator.
   *
   * @private
   * @readonly
   * @type {FormBaselineController<EditableTribe[]>}
   */
  private readonly baselineTribes = new FormBaselineController<EditableTribe[]>([], this.form, () => this.currentEditableTribes(), value => this.rebuildFormFromEditableTribes(value), (baseline, current) => this.tribesEqual(current, baseline));

  /**
   * Next editable tribe key counter.
   *
   * @private
   * @type {number}
   */
  private nextEditableTribeKey = 0;

  /**
   * Add tribe form.
   *
   * @public
   * @readonly
   * @type {FormGroup<TribeFormControls>}
   */
  public readonly addForm = this.createTribeForm({id: '', color: ''}, 'add');

  /**
   * Whether the add tribe editor is visible.
   *
   * @public
   * @type {boolean}
   */
  public showTribeAdder = false;

  /**
   * Tribe rows form array.
   *
   * @public
   * @readonly
   * @type {FormArray<FormGroup<TribeFormControls>>}
   */
  public get tribes(): FormArray<FormGroup<TribeFormControls>> {
    return this.form.controls.tribes as FormArray<FormGroup<TribeFormControls>>;
  }

  /**
   * Editable tribes represented by the current form.
   *
   * @public
   * @readonly
   * @type {EditableTribe[]}
   */
  public get editTribes(): EditableTribe[] {
    return this.currentEditableTribes();
  }

  /**
   * Whether pending tribes differ from the baseline.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get hasUnappliedTribes(): boolean {
    return this.baselineTribes.hasChanges();
  }

  /**
   * Impact of applying pending tribe changes.
   *
   * @public
   * @readonly
   * @type {TribeApplyImpact}
   */
  public get tribeApplyImpact(): TribeApplyImpact {
    return analyzeTribeApplyImpact(this.baselineTribes.baselineValue(), this.currentEditableTribes(), this.committedRules, this.boundaryTribe, this.topology === BOUNDED_GRID_TOPOLOGY);
  }

  /**
   * Whether applying pending tribe changes is blocked.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get tribeApplyBlocked(): boolean {
    return this.tribeApplyImpact.blocked;
  }

  /**
   * Tribe apply error messages.
   *
   * @public
   * @readonly
   * @type {string[]}
   */
  public get tribeApplyErrorMessages(): string[] {
    return this.tribeApplyImpact.messages;
  }

  /**
   * Impact of applying pending tribe changes on packing.
   *
   * @public
   * @readonly
   * @type {TribePackingImpact}
   */
  public get tribePackingImpact(): TribePackingImpact {
    return analyzeTribePackingImpact(this.baselineTribes.baselineValue().length, this.currentEditableTribes().length, this.simulationBitsPerCell, {cols: this.gridCols, rows: this.gridRows}, this.maxBytes);
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
      !this.hasUnappliedTribes ||
      this.tribes.length <= 1 ||
      this.tribeApplyBlocked ||
      this.tribePackingImpact.blocked ||
      this.form.invalid ||
      this.editingKeys.size > 0;
  }

  /**
   * Whether Restore is disabled.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get restoreDisabled(): boolean {
    return this.downloading || !this.hasUnappliedTribes;
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
    this.addForm.setValue({id: '', color: this.randomColor()}, {emitEvent: true});
    resetControlInteractionState(this.addForm);
    this.updateAllIdValidity();
  }

  /**
   * Closes the add tribe editor.
   *
   * @public
   */
  public cancelAddTribe(): void {
    this.showTribeAdder = false;
    this.addForm.setValue({id: '', color: ''}, {emitEvent: false});
    resetControlInteractionState(this.addForm);
    this.updateAllIdValidity();
  }

  /**
   * Adds the current add-form tribe.
   *
   * @public
   */
  public onAddTribe(): void {
    if (this.addForm.valid) {
      const key = this.createEditableTribeKey();
      this.tribes.push(this.createTribeForm(this.addForm.getRawValue(), key));
      this.rowKeys.push(key);
      this.cancelAddTribe();
      this.updateAllIdValidity();
      this.refreshOpenDraftValidity();
    }
  }

  /**
   * Removes an editable tribe.
   *
   * @public
   * @param {string} key key to remove.
   */
  public onRemoveTribe(key: string): void {
    const index = this.findRowIndexByKey(key);
    if (index >= 0) {
      const id = this.tribes.at(index).controls.id.value;
      if (id !== DEAD_TRIBE_ID) {
        this.tribes.removeAt(index);
        this.rowKeys.splice(index, 1);
        this.editingKeys.delete(key);
        this.updateAllIdValidity();
        this.refreshOpenDraftValidity();
      }
    }
  }

  /**
   * Tracks editing state for one row.
   *
   * @public
   * @param {string} key row key.
   * @param {boolean} editing whether row editing is open.
   */
  public onRowEditingChange(key: string, editing: boolean): void {
    if (editing) {
      this.editingKeys.add(key);
    } else {
      this.editingKeys.delete(key);
    }
  }

  /**
   * Applies pending tribe changes.
   *
   * @public
   */
  public onApplyTribes(): void {
    if (!this.applyDisabled) {
      this.applyTribes.emit({
        tribes: this.currentEditableTribes().map(tribe => this.toTribe(tribe)),
        renamePairs: this.tribeApplyImpact.renamePairs
      });
    }
  }

  /**
   * Restores tribes from the baseline.
   *
   * @public
   */
  public onRestoreTribes(): void {
    this.baselineTribes.restore();
    this.cancelAddTribe();
    this.editingKeys.clear();
  }

  /**
   * Creates a random hex color.
   *
   * @public
   * @returns {string} RGB hex color.
   */
  public randomColor(): string {
    return Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  }

  /**
   * Gets one row key.
   *
   * @public
   * @param {number} index row index.
   * @returns {string} row key.
   */
  public rowKey(index: number): string {
    return this.rowKeys[index] ?? `${index}`;
  }

  /**
   * Synchronizes editable tribes from committed tribes.
   *
   * @private
   */
  private syncTribesFromCommitted(): void {
    const editableTribes = this.committedTribes.map(tribe => this.toEditableTribe(tribe));
    this.baselineTribes.syncCommitted(editableTribes);
    this.editingKeys.clear();
  }

  /**
   * Rebuilds the FormArray from editable tribes.
   *
   * @private
   * @param {readonly EditableTribe[]} tribes editable tribes.
   */
  private rebuildFormFromEditableTribes(tribes: readonly EditableTribe[]): void {
    this.tribes.clear();
    this.rowKeys = [];
    for (const tribe of tribes) {
      this.tribes.push(this.createTribeForm(tribe, tribe.key));
      this.rowKeys.push(tribe.key);
    }
    this.updateAllIdValidity();
  }

  /**
   * Creates a tribe row form.
   *
   * @private
   * @param {TribeFormValue} tribe tribe form value.
   * @param {string} key stable key.
   * @returns {FormGroup<TribeFormControls>} row form.
   */
  private createTribeForm(tribe: TribeFormValue, key: string): FormGroup<TribeFormControls> {
    const form = new FormGroup<TribeFormControls>({
      id: new FormControl(tribe.id, {
        nonNullable: true,
        validators: [
          Validators.required,
          this.idFormatValidator(),
          this.reservedIdValidator(key),
          this.uniqueIdValidator(key)
        ]
      }),
      color: new FormControl(tribe.color, {
        nonNullable: true,
        validators: [Validators.required, this.hexColorValidator()]
      })
    });
    form.controls.id.valueChanges.subscribe(() => {
      this.updateAllIdValidity(form.controls.id);
      if (key !== 'add') {
        this.refreshOpenDraftValidity();
      }
    });
    return form;
  }

  /**
   * Converts a committed tribe to an editable tribe.
   *
   * @private
   * @param {Tribe} tribe tribe to convert.
   * @returns {EditableTribe} editable tribe.
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
   * @param {EditableTribe} tribe tribe to convert.
   * @returns {Tribe} committed tribe.
   */
  private toTribe(tribe: EditableTribe): Tribe {
    return {id: tribe.id, color: tribe.color};
  }

  /**
   * Gets the current editable tribe values.
   *
   * @private
   * @returns {EditableTribe[]} editable tribes.
   */
  private currentEditableTribes(): EditableTribe[] {
    return this.tribes.controls.map((form, index) => ({
      id: form.controls.id.value,
      color: form.controls.color.value,
      key: this.rowKey(index)
    }));
  }

  /**
   * Finds an editable tribe by key.
   *
   * @private
   * @param {string} key key to find.
   * @returns {number} row index.
   */
  private findRowIndexByKey(key: string): number {
    return this.rowKeys.findIndex(rowKey => rowKey === key);
  }

  /**
   * Creates an editable tribe key.
   *
   * @private
   * @returns {string} editable tribe key.
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
   * @param {readonly EditableTribe[]} editableTribes editable tribes.
   * @param {readonly EditableTribe[]} baseTribes baseline tribes.
   * @returns {boolean} whether tribes are equal.
   */
  private tribesEqual(editableTribes: readonly EditableTribe[], baseTribes: readonly EditableTribe[]): boolean {
    let equal = editableTribes.length === baseTribes.length;
    if (equal) {
      equal = editableTribes.every((tribe, index) => {
        const base = baseTribes[index];
        return base ? tribe.id === base.id && tribe.color === base.color : false;
      });
    }
    return equal;
  }

  /**
   * Builds a tribe id format validator.
   *
   * @private
   * @returns {ValidatorFn} validator.
   */
  private idFormatValidator(): ValidatorFn {
    return (control: AbstractControl<string>): ValidationErrors | null => {
      let errors: ValidationErrors | null = null;
      if (!/^[A-Za-z0-9]*$/.test(control.value ?? '')) {
        errors = {allowedPattern: true};
      }
      return errors;
    };
  }

  /**
   * Builds a reserved id validator.
   *
   * @private
   * @param {string} key row key.
   * @returns {ValidatorFn} validator.
   */
  private reservedIdValidator(key: string): ValidatorFn {
    return (control: AbstractControl<string>): ValidationErrors | null => {
      let errors: ValidationErrors | null = null;
      if (key !== 'add' && control.value === DEAD_TRIBE_ID && this.findRowIndexByKey(key) >= 0) {
        const baseline = this.baselineTribes.baselineValue()[this.findRowIndexByKey(key)];
        if (baseline?.id !== DEAD_TRIBE_ID) {
          errors = {reservedTribeId: true};
        }
      } else if (key === 'add' && control.value === DEAD_TRIBE_ID) {
        errors = {reservedTribeId: true};
      }
      return errors;
    };
  }

  /**
   * Builds a unique id validator.
   *
   * @private
   * @param {string} key row key.
   * @returns {ValidatorFn} validator.
   */
  private uniqueIdValidator(key: string): ValidatorFn {
    return (control: AbstractControl<string>): ValidationErrors | null => {
      const value = control.value ?? '';
      const matches = this.currentEditableTribes().filter(tribe => tribe.id === value && tribe.key !== key);
      let errors: ValidationErrors | null = null;
      if (value && matches.length > 0) {
        errors = {duplicateTribeId: true};
      }
      return errors;
    };
  }

  /**
   * Builds a hex color validator.
   *
   * @private
   * @returns {ValidatorFn} validator.
   */
  private hexColorValidator(): ValidatorFn {
    return (control: AbstractControl<string>): ValidationErrors | null => {
      const value = control.value ?? '';
      let errors: ValidationErrors | null = null;
      if (!/^[0-9a-fA-F]{6}$/.test(value)) {
        errors = {hexColor: true};
      }
      return errors;
    };
  }

  /**
   * Updates all id controls after one id changes.
   *
   * @private
   * @param {AbstractControl} [source] source control.
   */
  private updateAllIdValidity(source?: AbstractControl): void {
    for (const row of this.tribes.controls) {
      if (row.controls.id !== source) {
        row.controls.id.updateValueAndValidity({emitEvent: false});
      }
    }
    if (this.addForm.controls.id !== source) {
      this.addForm.controls.id.updateValueAndValidity({emitEvent: false});
    }
  }

  /**
   * Signals open local draft forms to re-run row ID validators.
   *
   * @private
   */
  private refreshOpenDraftValidity(): void {
    this.tribeDraftValidationVersion++;
  }
}
