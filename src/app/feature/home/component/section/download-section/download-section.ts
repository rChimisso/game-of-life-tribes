import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnInit, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {PersistedPreferencesComponent} from '../../../../../core/abstract/persisted-preferences-component';
import {ApplyRestoreButtons} from '../../../../../shared/component/apply-restore/button-pair';
import {CheckboxComponent} from '../../../../../shared/component/checkbox/checkbox';
import {ProgressStatus} from '../../../../../shared/component/progress-status/progress-status';
import {StorageBar} from '../../../../../shared/component/storage-bar/storage-bar';
import {SubsectionComponent} from '../../../../../shared/component/subsection/subsection';
import {formatBinaryBytes, formatDecimalBytes} from '../../../logic/byte-format';
import {DownloadFrameRangeFormValue, DownloadMp4SettingsFormValue, DownloadRequestPayload, DownloadSectionPreferences} from '../../../model/download';
import {DownloadFrameRangeForm} from '../../element/download-frame-range-form/download-frame-range-form';
import {DownloadMp4SettingsForm} from '../../element/download-mp4-settings-form/download-mp4-settings-form';

import {TypedChanges} from '~gol/core/model/typed-change';
import {StorageBarSegment} from '~gol/shared/component/storage-bar/model/storage-bar-segment';

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
    FormsModule,
    StorageBar,
    CheckboxComponent,
    SubsectionComponent,
    ApplyRestoreButtons,
    DownloadFrameRangeForm,
    DownloadMp4SettingsForm,
    ProgressStatus
  ],
  templateUrl: './download-section.html',
  styleUrl: './download-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DownloadSection extends PersistedPreferencesComponent<DownloadSectionPreferences> implements OnChanges, OnInit {
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
   * Download frame range form data.
   *
   * @public
   * @type {DownloadFrameRangeFormValue}
   */
  public downloadFrameRangeFormData: DownloadFrameRangeFormValue = {
    allFrames: true,
    startFrame: 1,
    endFrame: 1
  };

  /**
   * Current valid download frame range form value.
   *
   * @public
   * @type {DownloadFrameRangeFormValue}
   */
  public downloadFrameRangeValue: DownloadFrameRangeFormValue = {...this.downloadFrameRangeFormData};

  /**
   * Whether the frame range form is currently valid.
   *
   * @public
   * @type {boolean}
   */
  public downloadFrameRangeValid = true;

  /**
   * Download MP4 settings form data.
   *
   * @public
   * @type {DownloadMp4SettingsFormValue}
   */
  public downloadMp4SettingsFormData: DownloadMp4SettingsFormValue = {
    mp4Fps: 12,
    mp4BitrateMbps: 2
  };

  /**
   * Current valid download MP4 settings form value.
   *
   * @public
   * @type {DownloadMp4SettingsFormValue}
   */
  public downloadMp4SettingsValue: DownloadMp4SettingsFormValue = {...this.downloadMp4SettingsFormData};

  /**
   * Whether the MP4 settings form is currently valid.
   *
   * @public
   * @type {boolean}
   */
  public downloadMp4SettingsValid = true;

  /**
   * User-facing high-memory chunk export warning.
   *
   * @public
   * @type {string}
   */
  public chunkModeWarning = '';

  /**
   * Default preferences.
   *
   * @protected
   * @readonly
   * @type {DownloadSectionPreferences}
   */
  protected override readonly defaultPreferences: DownloadSectionPreferences = {
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
   * Current preferences.
   *
   * @private
   * @readonly
   * @type {DownloadSectionPreferences}
   */
  public readonly currentPreferences: DownloadSectionPreferences = {...this.defaultPreferences};

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
    return !this.downloadFrameRangeValid ||
      !this.hasRecordedFrames ||
      this.chunksSaving ||
      this.loadingState ||
      this.downloadCancelling ||
      this.downloading ||
      this.savingState ||
      this.stepping ||
      this.running ||
      (this.currentPreferences.mp4 && !this.downloadMp4SettingsValid) ||
      !(this.effectiveForceChunkDownload || this.currentPreferences.metrics || this.currentPreferences.saves || this.currentPreferences.mp4 || this.currentPreferences.png);
  }

  /**
   * Whether compressed chunk export is effectively selected.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get effectiveForceChunkDownload(): boolean {
    return this.currentPreferences.forceChunkDownload || this.downloadEstimateExceedsChunkThreshold;
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
    return formatDecimalBytes(this.storagePendingRawBytes);
  }

  /**
   * Compressed storage display.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get storageCompressedFormatted(): string {
    return formatDecimalBytes(this.storageCompressedBytes);
  }

  /**
   * Storage bar tooltip.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get storageBarTooltip(): string {
    return `${this.storagePendingFormatted} pending / ${this.storageCompressedFormatted} compressed / ${this.storageQuotaFormatted} quota`;
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
   */
  public constructor() {
    super('golt-download-section-prefs');
  }

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
    this.emitSettingsChange();
  }

  /**
   * @inheritdoc
   */
  public ngOnInit(): void {
    this.restorePreferences();
    this.emitSettingsChange();
  }

  /**
   * Persists settings after a local setting change.
   *
   * @public
   */
  public onSettingChange(): void {
    this.savePreferences();
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
      this.currentPreferences.selectionExpanded = expanded;
    } else {
      this.currentPreferences.mp4SettingsExpanded = expanded;
    }
    this.savePreferences();
  }

  /**
   * Emits the final download payload.
   *
   * @public
   */
  public onDownload(): void {
    this.download.emit(this.createDownloadRequestPayload());
  }

  /**
   * Handles valid frame range form submissions.
   *
   * @public
   * @param {DownloadFrameRangeFormValue} value
   */
  public onDownloadFrameRangeFormChange(value: DownloadFrameRangeFormValue): void {
    const {allFrames} = value;
    this.downloadFrameRangeValue = {...value};
    if (allFrames !== this.currentPreferences.allFrames) {
      this.currentPreferences.allFrames = allFrames;
      this.savePreferences();
    }
    this.emitSettingsChange();
  }

  /**
   * Handles frame range form validity changes.
   *
   * @public
   * @param {boolean} valid
   */
  public onDownloadFrameRangeValidityChange(valid: boolean): void {
    this.downloadFrameRangeValid = valid;
    this.emitSettingsChange();
  }

  /**
   * Handles valid MP4 settings form submissions.
   *
   * @public
   * @param {DownloadMp4SettingsFormValue} value
   */
  public onDownloadMp4SettingsFormChange(value: DownloadMp4SettingsFormValue): void {
    this.downloadMp4SettingsValue = {...value};
    if (value.mp4Fps !== this.currentPreferences.mp4Fps || value.mp4BitrateMbps !== this.currentPreferences.mp4BitrateMbps) {
      this.currentPreferences.mp4Fps = value.mp4Fps;
      this.currentPreferences.mp4BitrateMbps = value.mp4BitrateMbps;
      this.savePreferences();
    }
    this.emitSettingsChange();
  }

  /**
   * Handles MP4 settings form validity changes.
   *
   * @public
   * @param {boolean} valid
   */
  public onDownloadMp4SettingsValidityChange(valid: boolean): void {
    this.downloadMp4SettingsValid = valid;
    this.emitSettingsChange();
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
  protected override collectPreferences(): DownloadSectionPreferences {
    return {...this.currentPreferences};
  }

  /**
   * @inheritdoc
   */
  protected override applyPreferences(preferences: DownloadSectionPreferences): void {
    Object.assign(this.currentPreferences, this.defaultPreferences, preferences);
    this.forceDownloadFrameRangeValue({
      allFrames: this.currentPreferences.allFrames,
      startFrame: 1,
      endFrame: Math.max(1, this.totalRecordedFrames)
    });
    this.forceDownloadMp4SettingsValue({
      mp4Fps: this.currentPreferences.mp4Fps,
      mp4BitrateMbps: this.currentPreferences.mp4BitrateMbps
    });
  }

  /**
   * @inheritdoc
   */
  protected override normalizePreferences(stored: Partial<DownloadSectionPreferences>, defaults: DownloadSectionPreferences): DownloadSectionPreferences {
    const storedMp4Fps = +(stored.mp4Fps ?? defaults.mp4Fps);
    const storedMp4BitrateMbps = +(stored.mp4BitrateMbps ?? defaults.mp4BitrateMbps);
    const mp4Fps = Number.isInteger(storedMp4Fps) && storedMp4Fps >= 1 && storedMp4Fps <= 240 ? storedMp4Fps : defaults.mp4Fps;
    const mp4BitrateMbps = Number.isInteger(storedMp4BitrateMbps) && storedMp4BitrateMbps >= 1 && storedMp4BitrateMbps <= 60 ? storedMp4BitrateMbps : defaults.mp4BitrateMbps;
    return {
      metrics: this.forceBoolean(stored.metrics, defaults.metrics),
      saves: this.forceBoolean(stored.saves, defaults.saves),
      mp4: this.forceBoolean(stored.mp4, defaults.mp4),
      png: this.forceBoolean(stored.png, defaults.png),
      allFrames: this.forceBoolean(stored.allFrames, defaults.allFrames),
      forceChunkDownload: this.forceBoolean(stored.forceChunkDownload, defaults.forceChunkDownload),
      mp4Fps,
      mp4BitrateMbps,
      mp4SettingsExpanded: this.forceBoolean(stored.mp4SettingsExpanded, defaults.mp4SettingsExpanded),
      selectionExpanded: this.forceBoolean(stored.selectionExpanded, defaults.selectionExpanded)
    };
  }

  /**
   * Creates the current download request payload.
   *
   * @private
   * @returns {DownloadRequestPayload} current payload.
   */
  private createDownloadRequestPayload(): DownloadRequestPayload {
    const frameRange = this.currentPreferences.allFrames ?
      null :
      {
        startFrame: +this.downloadFrameRangeValue.startFrame,
        endFrame: +this.downloadFrameRangeValue.endFrame
      };
    return {
      metrics: this.currentPreferences.metrics,
      mp4: this.currentPreferences.mp4,
      png: this.currentPreferences.png,
      saves: this.currentPreferences.saves,
      fps: +this.downloadMp4SettingsValue.mp4Fps,
      bitrate: +this.downloadMp4SettingsValue.mp4BitrateMbps * 1_000_000,
      frameRange,
      forceChunkDownload: this.effectiveForceChunkDownload
    };
  }

  /**
   * Emits current settings for parent-side estimate updates.
   *
   * @private
   */
  private emitSettingsChange(): void {
    this.settingsChange.emit(this.createDownloadRequestPayload());
  }

  /**
   * Forcefully syncs the frame range state passed to the child form.
   *
   * @private
   * @param {DownloadFrameRangeFormValue} value
   */
  private forceDownloadFrameRangeValue(value: DownloadFrameRangeFormValue): void {
    this.downloadFrameRangeValue = {...value};
    this.downloadFrameRangeFormData = {...value};
    this.downloadFrameRangeValid = true;
  }

  /**
   * Syncs the frame range bounds when the recording grows.
   *
   * @private
   */
  private syncFrameRangeWithTotalFrames(): void {
    if (this.currentPreferences.allFrames) {
      this.forceDownloadFrameRangeValue({
        allFrames: true,
        startFrame: 1,
        endFrame: Math.max(1, this.totalRecordedFrames)
      });
    }
  }

  /**
   * Forcefully syncs the MP4 settings state passed to the child form.
   *
   * @private
   * @param {DownloadMp4SettingsFormValue} value
   */
  private forceDownloadMp4SettingsValue(value: DownloadMp4SettingsFormValue): void {
    this.downloadMp4SettingsValue = {...value};
    this.downloadMp4SettingsFormData = {...value};
    this.downloadMp4SettingsValid = true;
  }
}
