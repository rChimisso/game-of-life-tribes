import {DecimalPipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnInit, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatProgressBarModule} from '@angular/material/progress-bar';

import {PersistedPreferencesComponent} from '../../../../../core/abstract/persisted-preferences-component';
import {ApplyRestoreButtons} from '../../../../../shared/component/apply-restore/button-pair';
import {CheckboxComponent} from '../../../../../shared/component/checkbox/checkbox';
import {InputComponent} from '../../../../../shared/component/input/input';
import {StorageBar} from '../../../../../shared/component/storage-bar/storage-bar';
import {SubsectionComponent} from '../../../../../shared/component/subsection/subsection';
import {DownloadFrameRange, DownloadRequestPayload, DownloadSectionPreferences} from '../../../model/download';
import {formatBinaryBytes, formatDecimalBytes} from '../../../util/byte-format';

import {TypedChanges} from '~gol/core/model/typed-change';
import {StorageBarSegment} from '~gol/shared/component/storage-bar/model/storage-bar-segment';

/**
 * Download options section.
 *
 * @export
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
    InputComponent,
    SubsectionComponent,
    ApplyRestoreButtons,
    MatProgressBarModule,
    DecimalPipe
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
   * Main download progress percentage.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public downloadProgress = -1;

  /**
   * Sub-task download progress percentage.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public downloadSubProgress = -1;

  /**
   * Current download sub-task status.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public downloadStatus = '';

  /**
   * Current download main status.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public downloadMainStatus = '';

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
   * Emits a download cancellation request.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly cancelDownload = new EventEmitter<void>();

  /**
   * First selected frame.
   *
   * @public
   * @type {number}
   */
  public downloadStartFrame = 1;

  /**
   * Last selected frame.
   *
   * @public
   * @type {number}
   */
  public downloadEndFrame = 1;

  /**
   * Whether the download frame selection was touched.
   *
   * @private
   * @type {boolean}
   */
  private downloadFrameRangeTouched = false;

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
   * Whether the download button is disabled.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get downloadButtonDisabled(): boolean {
    return this.downloading || this.chunksSaving || !!this.downloadFrameRangeError || (!this.currentPreferences.metrics && !this.currentPreferences.saves && !this.currentPreferences.mp4 && !this.currentPreferences.png);
  }

  /**
   * Storage title display.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get storageTitleSize(): string {
    return formatDecimalBytes(this.storagePendingRawBytes + this.storageCompressedBytes);
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
   * Normalized selected frame range.
   *
   * @public
   * @readonly
   * @type {(DownloadFrameRange | null)}
   */
  public get normalizedDownloadFrameRange(): DownloadFrameRange | null {
    let range: DownloadFrameRange | null = null;
    if (!this.currentPreferences.allFrames && this.hasRecordedFrames) {
      const startFrame = Math.min(Math.max(1, Math.floor(this.downloadStartFrame || 1)), this.totalRecordedFrames);
      const endFrame = Math.min(Math.max(startFrame, Math.floor(this.downloadEndFrame || startFrame)), this.totalRecordedFrames);
      range = {startFrame, endFrame};
    }
    return range;
  }

  /**
   * Number of selected frames.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get selectedFrameCount(): number {
    const range = this.normalizedDownloadFrameRange;
    return range ? range.endFrame - range.startFrame + 1 : this.totalRecordedFrames;
  }

  /**
   * Frame range validation message.
   *
   * @public
   * @readonly
   * @type {(string | null)}
   */
  public get downloadFrameRangeError(): string | null {
    let message: string | null = null;
    if (!this.currentPreferences.allFrames && this.hasRecordedFrames) {
      switch (true) {
        case !Number.isFinite(this.downloadStartFrame) || !Number.isFinite(this.downloadEndFrame):
          message = 'Frame range must use whole numbers.';
          break;
        case this.downloadStartFrame < 1 || this.downloadEndFrame < 1:
          message = 'Frame range must start at frame 1 or later.';
          break;
        case this.downloadStartFrame > this.totalRecordedFrames || this.downloadEndFrame > this.totalRecordedFrames:
          message = `Recorded frames currently range from 1 to ${this.totalRecordedFrames.toLocaleString()}.`;
          break;
        case this.downloadStartFrame > this.downloadEndFrame:
          message = 'Start frame must be less than or equal to end frame.';
          break;
      }
    }
    return message;
  }

  /**
   * MP4 availability message.
   *
   * @public
   * @readonly
   * @type {(string | null)}
   */
  public get mp4GateMessage(): string | null {
    const bitrateBps = this.currentPreferences.mp4BitrateMbps * 1_000_000;
    const overheadMultiplier = 1.1;
    const estimatedBytes = (this.totalRecordedFrames / this.currentPreferences.mp4Fps) * (bitrateBps / 8) * overheadMultiplier;
    const twoGb = 2 * 1024 * 1024 * 1024;
    return this.totalRecordedFrames > 0 && estimatedBytes > twoGb ?
      `Estimated MP4 size (${formatBinaryBytes(estimatedBytes)}) exceeds the 2 GB memory limit - MP4 will be skipped. Increase FPS, lower bitrate, or record fewer frames` :
      null;
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
  public ngOnInit(): void {
    this.restorePreferences();
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<DownloadSection>): void {
    if (changes.totalRecordedFrames) {
      this.syncDownloadFrameRange();
    }
  }

  /**
   * Handles all-frames selection changes.
   *
   * @public
   * @param {boolean} checked
   */
  public onDownloadAllFramesChange(checked: boolean): void {
    this.currentPreferences.allFrames = checked;
    this.downloadFrameRangeTouched = false;
    this.syncDownloadFrameRange();
    this.savePreferences();
  }

  /**
   * Handles start frame changes.
   *
   * @public
   * @param {number} value
   */
  public onDownloadStartFrameChange(value: number): void {
    this.downloadStartFrame = value;
    this.downloadFrameRangeTouched = true;
  }

  /**
   * Handles end frame changes.
   *
   * @public
   * @param {number} value
   */
  public onDownloadEndFrameChange(value: number): void {
    this.downloadEndFrame = value;
    this.downloadFrameRangeTouched = true;
  }

  /**
   * Persists settings after a local setting change.
   *
   * @public
   */
  public onSettingChange(): void {
    this.savePreferences();
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
    this.download.emit({
      metrics: this.currentPreferences.metrics,
      mp4: this.currentPreferences.mp4 && !this.mp4GateMessage,
      png: this.currentPreferences.png,
      saves: this.currentPreferences.saves,
      fps: this.currentPreferences.mp4Fps,
      bitrate: this.currentPreferences.mp4BitrateMbps * 1_000_000,
      frameRange: this.normalizedDownloadFrameRange
    });
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
    this.syncDownloadFrameRange();
  }

  /**
   * @inheritdoc
   */
  protected override normalizePreferences(stored: Partial<DownloadSectionPreferences>, defaults: DownloadSectionPreferences): DownloadSectionPreferences {
    return {
      metrics: typeof stored.metrics === 'boolean' ? stored.metrics : defaults.metrics,
      saves: typeof stored.saves === 'boolean' ? stored.saves : defaults.saves,
      mp4: typeof stored.mp4 === 'boolean' ? stored.mp4 : defaults.mp4,
      png: typeof stored.png === 'boolean' ? stored.png : defaults.png,
      allFrames: typeof stored.allFrames === 'boolean' ? stored.allFrames : defaults.allFrames,
      mp4Fps: typeof stored.mp4Fps === 'number' && stored.mp4Fps >= 1 && stored.mp4Fps <= 60 ? stored.mp4Fps : defaults.mp4Fps,
      mp4BitrateMbps: typeof stored.mp4BitrateMbps === 'number' && stored.mp4BitrateMbps >= 0.5 && stored.mp4BitrateMbps <= 50 ? stored.mp4BitrateMbps : defaults.mp4BitrateMbps,
      mp4SettingsExpanded: typeof stored.mp4SettingsExpanded === 'boolean' ? stored.mp4SettingsExpanded : defaults.mp4SettingsExpanded,
      selectionExpanded: typeof stored.selectionExpanded === 'boolean' ? stored.selectionExpanded : defaults.selectionExpanded
    };
  }

  /**
   * Keeps the selected frame range inside the recorded frame count.
   *
   * @private
   */
  private syncDownloadFrameRange(): void {
    if (this.totalRecordedFrames <= 0) {
      this.downloadStartFrame = 1;
      this.downloadEndFrame = 1;
    } else if (this.currentPreferences.allFrames || !this.downloadFrameRangeTouched) {
      this.downloadStartFrame = 1;
      this.downloadEndFrame = this.totalRecordedFrames;
    } else {
      this.downloadStartFrame = Math.min(Math.max(1, Math.floor(this.downloadStartFrame || 1)), this.totalRecordedFrames);
      this.downloadEndFrame = Math.min(Math.max(this.downloadStartFrame, Math.floor(this.downloadEndFrame || this.downloadStartFrame)), this.totalRecordedFrames);
    }
  }
}
