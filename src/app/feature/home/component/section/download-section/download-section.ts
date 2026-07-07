import {ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators} from '@angular/forms';
import {MatTooltipModule} from '@angular/material/tooltip';

import {firstControlError, setControlDisabled} from '~gol/core/function/form-control';
import {FormType} from '~gol/core/model/form-type';
import {TypedChanges} from '~gol/core/model/typed-change';
import {PreferencesStore} from '~gol/core/service/preferences-store';
import {formatBinaryBytes} from '~gol/feature/home/logic/byte-format';
import {DownloadRequestPayload, DownloadSectionPreferences} from '~gol/feature/home/model/download';
import {DownloadFormValue} from '~gol/feature/home/model/download-form';
import {ApplyRestoreButtons} from '~gol/shared/component/apply-restore/button-pair';
import {CheckboxComponent} from '~gol/shared/component/checkbox/checkbox';
import {NumberInputComponent} from '~gol/shared/component/input/number-input/number-input';
import {LabelValue} from '~gol/shared/component/label-value/label-value';
import {ProgressStatus} from '~gol/shared/component/progress-status/progress-status';
import {StorageBarSegment} from '~gol/shared/component/storage-bar/model/storage-bar-segment';
import {StorageBar} from '~gol/shared/component/storage-bar/storage-bar';
import {SubsectionComponent} from '~gol/shared/component/subsection/subsection';

/**
 * Returns the given value when it is boolean, otherwise the fallback.
 *
 * @param {unknown} value possibly boolean value.
 * @param {boolean} fallback fallback value.
 * @returns {boolean} normalized boolean value.
 */
function normalizeBooleanPreference(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Download options section.
 *
 * @class DownloadSection
 * @typedef {DownloadSection}
 * @implements {OnChanges}
 * @implements {OnInit}
 */
@Component({
  selector: 'gol-download-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    StorageBar,
    CheckboxComponent,
    NumberInputComponent,
    LabelValue,
    SubsectionComponent,
    ApplyRestoreButtons,
    ProgressStatus,
    MatTooltipModule
  ],
  templateUrl: './download-section.html',
  styleUrl: './download-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DownloadSection implements OnChanges, OnInit {
  /**
   * Number of recorded frames available for download.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public totalRecordedFrames = 0;

  /**
   * Pending raw recording bytes.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public storagePendingRawBytes = 0;

  /**
   * Compressed recording bytes.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public storageCompressedBytes = 0;

  /**
   * Reserved recording storage headroom.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public storageReservedBytes = 0;

  /**
   * Storage quota in bytes.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public storageQuotaBytes = 0;

  /**
   * Whether recorded chunks are currently saving.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public chunksSaving = false;

  /**
   * Whether the simulation is running.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public running = false;

  /**
   * Whether a skip or step operation is active.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public stepping = false;

  /**
   * Whether a snapshot is being saved.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public savingState = false;

  /**
   * Whether a snapshot is being loaded.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public loadingState = false;

  /**
   * Main download progress percentage.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public downloadProgress = -1;

  /**
   * Current download main status.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public downloadMainStatus = '';

  /**
   * Whether the current download is cancelling.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public downloadCancelling = false;

  /**
   * Whether the current estimate requires compressed chunk export.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public downloadEstimateExceedsChunkThreshold = false;

  /**
   * Emits the final download request.
   *
   * @public
   * @readonly
   * @type {EventEmitter<DownloadRequestPayload>}
   */
  @Output()
  public readonly download = new EventEmitter<DownloadRequestPayload>();

  /**
   * Emits the current download request preview.
   *
   * @public
   * @readonly
   * @type {EventEmitter<DownloadRequestPayload>}
   */
  @Output()
  public readonly settingsChange = new EventEmitter<DownloadRequestPayload>();

  /**
   * Emits a download cancellation request.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly cancelDownload = new EventEmitter<void>();

  /**
   * Download form.
   *
   * @public
   * @readonly
   * @type {FormGroup<FormType<DownloadFormValue>>}
   */
  public readonly form = new FormGroup<FormType<DownloadFormValue>>({
    outputs: new FormGroup({
      saves: new FormControl(true, {nonNullable: true}),
      metrics: new FormControl(true, {nonNullable: true}),
      png: new FormControl(false, {nonNullable: true}),
      mp4: new FormControl(false, {nonNullable: true})
    }),
    selection: new FormGroup({
      allFrames: new FormControl(true, {nonNullable: true}),
      startFrame: new FormControl<number | null>(1, {validators: [Validators.required]}),
      endFrame: new FormControl<number | null>(1, {validators: [Validators.required]})
    }, {validators: [this.frameOrderValidator()]}),
    mp4Settings: new FormGroup({
      fps: new FormControl<number | null>(12, {validators: [Validators.required]}),
      bitrateMbps: new FormControl<number | null>(2, {validators: [Validators.required]})
    }),
    forceChunkDownload: new FormControl(false, {nonNullable: true})
  }, {validators: [this.outputSelectionValidator()]});

  /**
   * User-facing high-memory chunk export warning.
   *
   * @public
   * @type {string}
   */
  public chunkModeWarning = '';

  /**
   * Selection subsection expansion state.
   *
   * @public
   * @type {boolean}
   */
  public selectionExpanded = true;

  /**
   * MP4 settings subsection expansion state.
   *
   * @public
   * @type {boolean}
   */
  public mp4SettingsExpanded = false;

  /**
   * User-selected chunk download preference before threshold forcing.
   *
   * @private
   * @type {boolean}
   */
  private preferredForceChunkDownload = false;

  /**
   * Whether form subscriptions are initialized.
   *
   * @private
   * @type {boolean}
   */
  private formSubscriptionsInitialized = false;

  /**
   * Default preferences.
   *
   * @private
   * @readonly
   * @type {DownloadSectionPreferences}
   */
  private readonly defaultPreferences: DownloadSectionPreferences = {
    metrics: true,
    saves: true,
    mp4: false,
    png: false,
    allFrames: true,
    forceChunkDownload: false,
    mp4Fps: 12,
    mp4BitrateMbps: 2,
    mp4SettingsExpanded: false,
    selectionExpanded: true
  };

  /**
   * Last valid persistent preference values.
   *
   * @private
   * @type {DownloadSectionPreferences}
   */
  private lastSavedPreferences: DownloadSectionPreferences = {...this.defaultPreferences};

  /**
   * Whether a download is active.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get downloading(): boolean {
    return this.downloadProgress >= 0;
  }

  /**
   * Whether download option controls are disabled.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get downloadControlsDisabled(): boolean {
    return this.downloading || this.savingState || this.loadingState || this.stepping;
  }

  /**
   * Download progress status displayed above the button pair.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get downloadProgressStatus(): string {
    return this.downloadMainStatus || 'Preparing download';
  }

  /**
   * Whether the download button is disabled.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get downloadButtonDisabled(): boolean {
    return !this.hasRecordedFrames ||
      this.chunksSaving ||
      this.loadingState ||
      this.downloadCancelling ||
      this.downloading ||
      this.savingState ||
      this.stepping ||
      this.running ||
      this.form.invalid;
  }

  /**
   * Whether compressed chunk export is effectively selected.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get effectiveForceChunkDownload(): boolean {
    return this.form.controls.forceChunkDownload.value || this.downloadEstimateExceedsChunkThreshold;
  }

  /**
   * Whether the force chunk download checkbox is disabled.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get forceChunkDownloadDisabled(): boolean {
    return this.downloadControlsDisabled || this.downloadEstimateExceedsChunkThreshold;
  }

  /**
   * Whether the cancel button is disabled.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get cancelButtonDisabled(): boolean {
    return !this.downloading || this.downloadCancelling;
  }

  /**
   * Start frame validation message.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get startFrameError(): string {
    return this.frameError(this.form.controls.selection.controls.startFrame);
  }

  /**
   * End frame validation message.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get endFrameError(): string {
    let message = this.frameError(this.form.controls.selection.controls.endFrame);
    if (!message && this.form.controls.selection.hasError('frameOrder') && this.form.controls.selection.controls.endFrame.enabled) {
      message = 'Before start';
    }
    return message;
  }

  /**
   * MP4 FPS validation message.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get fpsError(): string {
    return this.numberError(this.form.controls.mp4Settings.controls.fps, 240);
  }

  /**
   * MP4 bitrate validation message.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get bitrateError(): string {
    return this.numberError(this.form.controls.mp4Settings.controls.bitrateMbps, 60);
  }

  /**
   * Maximum recorded frame integer digits.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get recordedFrameIntegerDigits(): number {
    return this.integerDigits(Math.max(1, this.totalRecordedFrames));
  }

  /**
   * Number of selected frames.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get selectedFrameCount(): string {
    const {allFrames, endFrame, startFrame} = this.form.controls.selection.getRawValue();
    let count = 0;
    if (this.hasRecordedFrames && (this.form.controls.selection.valid || this.form.controls.selection.disabled)) {
      if (allFrames) {
        count = this.totalRecordedFrames;
      } else {
        count = (endFrame ?? 0) - (startFrame ?? 0) + 1;
      }
    }
    return `${Math.max(0, count)}/${this.totalRecordedFrames}`;
  }

  /**
   * Storage quota display.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get storageQuotaFormatted(): string {
    return formatBinaryBytes(this.storageQuotaBytes);
  }

  /**
   * Pending storage display.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get storagePendingFormatted(): string {
    return formatBinaryBytes(this.storagePendingRawBytes);
  }

  /**
   * Compressed storage display.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get storageCompressedFormatted(): string {
    return formatBinaryBytes(this.storageCompressedBytes);
  }

  /**
   * Reserved storage display.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get storageReservedFormatted(): string {
    return formatBinaryBytes(this.storageReservedBytes);
  }

  /**
   * Storage bar tooltip.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get storageBarTooltip(): string {
    return `${this.storagePendingFormatted} pending / ${this.storageCompressedFormatted} compressed / ${this.storageReservedFormatted} reserved / ${this.storageQuotaFormatted} browser quota estimate`;
  }

  /**
   * Storage bar segments.
   *
   * @public
   * @readonly
   * @type {StorageBarSegment[]}
   */
  public get storageSegments(): StorageBarSegment[] {
    return [
      {
        label: 'pending',
        value: this.storagePendingRawBytes,
        formatted: this.storagePendingFormatted,
        color: '#f59e0b'
      },
      {
        label: 'compressed',
        value: this.storageCompressedBytes,
        formatted: this.storageCompressedFormatted,
        color: '#e91e8a'
      },
      {
        label: 'reserved',
        value: this.storageReservedBytes,
        formatted: this.storageReservedFormatted,
        color: '#8f0000'
      }
    ];
  }

  /**
   * Whether at least one frame was recorded.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get hasRecordedFrames(): boolean {
    return this.totalRecordedFrames > 0;
  }

  /**
   * Creates the download section.
   *
   * @public
   * @constructor
   * @param {DestroyRef} destroyRef destroy ref for subscriptions.
   * @param {PreferencesStore} preferencesStore preference storage.
   */
  public constructor(private readonly destroyRef: DestroyRef, private readonly preferencesStore: PreferencesStore) {}

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<DownloadSection>): void {
    if (changes.totalRecordedFrames) {
      this.syncFrameRangeWithTotalFrames();
    }
    if (changes.downloadEstimateExceedsChunkThreshold && this.downloadEstimateExceedsChunkThreshold) {
      this.chunkModeWarning = 'Estimated download memory is above 2 GiB. This download will export compressed recording chunks instead of the selected outputs.';
    }
    if (changes.downloadEstimateExceedsChunkThreshold) {
      this.syncEffectiveForceChunkDownload();
    }
    if (changes.downloadProgress || changes.savingState || changes.loadingState || changes.stepping || changes.downloadEstimateExceedsChunkThreshold || changes.totalRecordedFrames) {
      this.syncFormDisabledState();
    }
    this.emitSettingsChange();
  }

  /**
   * @inheritdoc
   */
  public ngOnInit(): void {
    this.restorePreferences();
    this.initFormSubscriptions();
    this.syncFormDisabledState();
    this.emitSettingsChange();
  }

  /**
   * Persists subsection state.
   *
   * @public
   * @param {'selection' | 'mp4'} section
   * @param {boolean} expanded
   */
  public onSubsectionExpandedChange(section: 'selection' | 'mp4', expanded: boolean): void {
    if (section === 'selection') {
      this.selectionExpanded = expanded;
    } else {
      this.mp4SettingsExpanded = expanded;
    }
    this.persistValidPreferences();
  }

  /**
   * Emits the final download payload.
   *
   * @public
   */
  public onDownload(): void {
    if (!this.downloadButtonDisabled) {
      this.download.emit(this.createDownloadRequestPayload());
    }
  }

  /**
   * Clears the chunk mode message content after collapse.
   *
   * @public
   * @param {TransitionEvent} event
   */
  public onChunkModeMessageTransitionEnd(event: TransitionEvent): void {
    if (event.propertyName === 'grid-template-rows' && !this.downloadEstimateExceedsChunkThreshold) {
      this.chunkModeWarning = '';
    }
  }

  /**
   * @inheritdoc
   */
  private collectPreferences(): DownloadSectionPreferences {
    const raw = this.form.getRawValue();
    const mp4Fps = this.isValidMp4Fps(raw.mp4Settings.fps) ? raw.mp4Settings.fps : this.lastSavedPreferences.mp4Fps;
    const mp4BitrateMbps = this.isValidMp4BitrateMbps(raw.mp4Settings.bitrateMbps) ? raw.mp4Settings.bitrateMbps : this.lastSavedPreferences.mp4BitrateMbps;
    return {
      metrics: raw.outputs.metrics,
      saves: raw.outputs.saves,
      mp4: raw.outputs.mp4,
      png: raw.outputs.png,
      allFrames: raw.selection.allFrames,
      forceChunkDownload: this.preferredForceChunkDownload,
      mp4Fps,
      mp4BitrateMbps,
      mp4SettingsExpanded: this.mp4SettingsExpanded,
      selectionExpanded: this.selectionExpanded
    };
  }

  /**
   * @inheritdoc
   */
  private applyPreferences(preferences: DownloadSectionPreferences): void {
    this.selectionExpanded = preferences.selectionExpanded;
    this.mp4SettingsExpanded = preferences.mp4SettingsExpanded;
    this.preferredForceChunkDownload = preferences.forceChunkDownload;
    this.lastSavedPreferences = {...preferences};
    this.form.patchValue({
      outputs: {
        saves: preferences.saves,
        metrics: preferences.metrics,
        png: preferences.png,
        mp4: preferences.mp4
      },
      selection: {
        allFrames: preferences.allFrames,
        startFrame: 1,
        endFrame: Math.max(1, this.totalRecordedFrames)
      },
      mp4Settings: {
        fps: preferences.mp4Fps,
        bitrateMbps: preferences.mp4BitrateMbps
      },
      forceChunkDownload: this.downloadEstimateExceedsChunkThreshold ? true : preferences.forceChunkDownload
    }, {emitEvent: false});
  }

  /**
   * @inheritdoc
   */
  private normalizePreferences(stored: Partial<DownloadSectionPreferences>, defaults: DownloadSectionPreferences): DownloadSectionPreferences {
    const storedMp4Fps = +(stored.mp4Fps ?? defaults.mp4Fps);
    const storedMp4BitrateMbps = +(stored.mp4BitrateMbps ?? defaults.mp4BitrateMbps);
    const mp4Fps = Number.isInteger(storedMp4Fps) && storedMp4Fps >= 1 && storedMp4Fps <= 240 ? storedMp4Fps : defaults.mp4Fps;
    const mp4BitrateMbps = Number.isInteger(storedMp4BitrateMbps) && storedMp4BitrateMbps >= 1 && storedMp4BitrateMbps <= 60 ? storedMp4BitrateMbps : defaults.mp4BitrateMbps;
    return {
      metrics: normalizeBooleanPreference(stored.metrics, defaults.metrics),
      saves: normalizeBooleanPreference(stored.saves, defaults.saves),
      mp4: normalizeBooleanPreference(stored.mp4, defaults.mp4),
      png: normalizeBooleanPreference(stored.png, defaults.png),
      allFrames: normalizeBooleanPreference(stored.allFrames, defaults.allFrames),
      forceChunkDownload: normalizeBooleanPreference(stored.forceChunkDownload, defaults.forceChunkDownload),
      mp4Fps,
      mp4BitrateMbps,
      mp4SettingsExpanded: normalizeBooleanPreference(stored.mp4SettingsExpanded, defaults.mp4SettingsExpanded),
      selectionExpanded: normalizeBooleanPreference(stored.selectionExpanded, defaults.selectionExpanded)
    };
  }

  /**
   * Initializes reactive form subscriptions.
   *
   * @private
   */
  private initFormSubscriptions(): void {
    if (!this.formSubscriptionsInitialized) {
      this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.onFormValueChange());
      this.form.controls.selection.controls.allFrames.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncFormDisabledState());
      this.form.controls.outputs.controls.mp4.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncFormDisabledState());
      this.formSubscriptionsInitialized = true;
    }
  }

  /**
   * Handles any local form value change.
   *
   * @private
   */
  private onFormValueChange(): void {
    if (!this.downloadEstimateExceedsChunkThreshold) {
      this.preferredForceChunkDownload = this.form.controls.forceChunkDownload.value;
    }
    this.form.updateValueAndValidity({emitEvent: false});
    this.persistValidPreferences();
    this.emitSettingsChange();
  }

  /**
   * Persists currently valid persistent fields.
   *
   * @private
   */
  private persistValidPreferences(): void {
    this.lastSavedPreferences = this.collectPreferences();
    this.savePreferences();
  }

  /**
   * Syncs forced chunk export with the form while preserving user preference.
   *
   * @private
   */
  private syncEffectiveForceChunkDownload(): void {
    if (this.downloadEstimateExceedsChunkThreshold) {
      this.form.controls.forceChunkDownload.setValue(true, {emitEvent: false});
    } else {
      this.form.controls.forceChunkDownload.setValue(this.preferredForceChunkDownload, {emitEvent: false});
    }
    this.form.updateValueAndValidity({emitEvent: false});
  }

  /**
   * Syncs enabled/disabled state for controls with external gates and dependent settings.
   *
   * @private
   */
  private syncFormDisabledState(): void {
    const selectionControlsDisabled = this.downloadControlsDisabled || !this.hasRecordedFrames;
    const mp4ControlsDisabled = this.downloadControlsDisabled || !this.form.controls.outputs.controls.mp4.value;
    setControlDisabled(this.form.controls.outputs, this.downloadControlsDisabled);
    setControlDisabled(this.form.controls.selection.controls.allFrames, selectionControlsDisabled);
    setControlDisabled(this.form.controls.selection.controls.startFrame, selectionControlsDisabled || this.form.controls.selection.controls.allFrames.value);
    setControlDisabled(this.form.controls.selection.controls.endFrame, selectionControlsDisabled || this.form.controls.selection.controls.allFrames.value);
    setControlDisabled(this.form.controls.mp4Settings, mp4ControlsDisabled);
    setControlDisabled(this.form.controls.forceChunkDownload, this.forceChunkDownloadDisabled);
    this.form.updateValueAndValidity({emitEvent: false});
  }

  /**
   * Restores preferences from storage.
   *
   * @private
   */
  private restorePreferences(): void {
    this.applyPreferences(this.preferencesStore.load('golt-download-section-prefs', this.defaultPreferences, (stored, defaults) => this.normalizePreferences(stored, defaults)));
  }

  /**
   * Saves current preferences.
   *
   * @private
   */
  private savePreferences(): void {
    this.preferencesStore.save('golt-download-section-prefs', this.collectPreferences());
  }

  /**
   * Syncs the frame range bounds when the recording grows.
   *
   * @private
   */
  private syncFrameRangeWithTotalFrames(): void {
    if (this.form.controls.selection.controls.allFrames.value) {
      this.form.controls.selection.patchValue({
        startFrame: 1,
        endFrame: Math.max(1, this.totalRecordedFrames)
      }, {emitEvent: false});
    }
    this.form.controls.selection.updateValueAndValidity({emitEvent: false});
  }

  /**
   * Creates the current download request payload.
   *
   * @private
   * @returns {DownloadRequestPayload} current payload.
   */
  private createDownloadRequestPayload(): DownloadRequestPayload {
    const raw = this.form.getRawValue();
    const frameRange = raw.selection.allFrames ?
      null :
      {
        startFrame: raw.selection.startFrame ?? 1,
        endFrame: raw.selection.endFrame ?? 1
      };
    return {
      metrics: raw.outputs.metrics,
      mp4: raw.outputs.mp4,
      png: raw.outputs.png,
      saves: raw.outputs.saves,
      fps: this.normalizedMp4Fps(raw.mp4Settings.fps),
      bitrate: this.normalizedMp4BitrateMbps(raw.mp4Settings.bitrateMbps) * 1_000_000,
      frameRange,
      forceChunkDownload: this.effectiveForceChunkDownload
    };
  }

  /**
   * Normalizes an MP4 FPS form value.
   *
   * @private
   * @param {(number | null)} value form value.
   * @returns {number} normalized FPS.
   */
  private normalizedMp4Fps(value: number | null): number {
    return this.isValidMp4Fps(value) ? value : this.defaultPreferences.mp4Fps;
  }

  /**
   * Normalizes an MP4 bitrate form value.
   *
   * @private
   * @param {(number | null)} value form value.
   * @returns {number} normalized bitrate in megabits per second.
   */
  private normalizedMp4BitrateMbps(value: number | null): number {
    return this.isValidMp4BitrateMbps(value) ? value : this.defaultPreferences.mp4BitrateMbps;
  }

  /**
   * Whether an MP4 FPS value can be persisted or emitted.
   *
   * @private
   * @param {(number | null)} value form value.
   * @returns {boolean} whether the value is valid.
   */
  private isValidMp4Fps(value: number | null): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 240;
  }

  /**
   * Whether an MP4 bitrate value can be persisted or emitted.
   *
   * @private
   * @param {(number | null)} value form value.
   * @returns {boolean} whether the value is valid.
   */
  private isValidMp4BitrateMbps(value: number | null): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 60;
  }

  /**
   * Emits current settings for parent-side estimate updates.
   *
   * @private
   */
  private emitSettingsChange(): void {
    if (this.form.valid) {
      this.settingsChange.emit(this.createDownloadRequestPayload());
    }
  }

  /**
   * Builds an output-selection validator.
   *
   * @private
   * @returns {ValidatorFn} validator.
   */
  private outputSelectionValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.getRawValue() as DownloadFormValue;
      let errors: ValidationErrors | null = null;
      if (!(value.forceChunkDownload || value.outputs.saves || value.outputs.metrics || value.outputs.png || value.outputs.mp4)) {
        errors = {outputRequired: true};
      }
      return errors;
    };
  }

  /**
   * Builds a start/end ordering validator.
   *
   * @private
   * @returns {ValidatorFn} validator.
   */
  private frameOrderValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.getRawValue() as DownloadFormValue['selection'];
      let errors: ValidationErrors | null = null;
      if (!value.allFrames && value.startFrame !== null && value.endFrame !== null && value.startFrame > value.endFrame) {
        errors = {frameOrder: true};
      }
      return errors;
    };
  }

  /**
   * Gets a frame control validation message.
   *
   * @private
   * @param {FormControl<number | null>} control control to read.
   * @returns {string} validation message.
   */
  private frameError(control: FormControl<number | null>): string {
    let message = '';
    if (control.enabled) {
      message = firstControlError(control, [
        ['required', 'Required'],
        ['min', error => `Min ${this.numericErrorLimit(error, 'min', 1)}`],
        ['max', error => `Max ${this.numericErrorLimit(error, 'max', this.totalRecordedFrames).toLocaleString()}`],
        ['maxIntegerDigits', 'Too many digits']
      ]) ?? '';
    }
    return message;
  }

  /**
   * Gets a numeric control validation message.
   *
   * @private
   * @param {FormControl<number | null>} control control to read.
   * @param {number} max maximum configured value.
   * @returns {string} validation message.
   */
  private numberError(control: FormControl<number | null>, max: number): string {
    let message = '';
    if (control.enabled) {
      message = firstControlError(control, [
        ['required', 'Required'],
        ['min', error => `Min ${this.numericErrorLimit(error, 'min', 1)}`],
        ['max', error => `Max ${this.numericErrorLimit(error, 'max', max)}`],
        ['decimalDigits', 'Integer'],
        ['maxIntegerDigits', 'Too many digits']
      ]) ?? '';
    }
    return message;
  }

  /**
   * Reads a numeric validation limit from an Angular validation error.
   *
   * @private
   * @param {unknown} error validation error metadata.
   * @param {'min' | 'max'} key limit key.
   * @param {number} fallback fallback limit.
   * @returns {number} resolved limit.
   */
  private numericErrorLimit(error: unknown, key: 'min' | 'max', fallback: number): number {
    let limit = fallback;
    if (typeof error === 'object' && error !== null && key in error) {
      const value = (error as Record<'min' | 'max', unknown>)[key];
      if (typeof value === 'number') {
        limit = value;
      }
    }
    return limit;
  }

  /**
   * Counts integer digits in a positive numeric limit.
   *
   * @private
   * @param {number} value numeric limit.
   * @returns {number} digit count.
   */
  private integerDigits(value: number): number {
    return Math.max(1, Math.trunc(Math.abs(value)).toString().length);
  }
}
