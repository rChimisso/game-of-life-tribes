import {DecimalPipe} from '@angular/common';
import {ChangeDetectorRef, Component, ChangeDetectionStrategy, Input, Output, EventEmitter, OnChanges, OnDestroy, ElementRef, NgZone} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';

import {ApplyRestoreButtons} from '../../../../shared/component/apply-restore/button-pair';
import {Button} from '../../../../shared/component/button/button';
import {CheckboxComponent} from '../../../../shared/component/checkbox/checkbox';
import {InputComponent} from '../../../../shared/component/input/input';
import {StorageBar} from '../../../../shared/component/storage-bar/storage-bar';
import {BitsPerCell, GridFormatMetadata} from '../../model/grid-format';
import {DEFAULT_LIVE_METRIC_SECTION_SETTINGS, LiveMetricSectionSettings} from '../../model/metrics';
import {Preset} from '../../model/preset';
import {DEAD_TRIBE_ID, Ruleset, Tribe} from '../../model/rule';
import {SidebarEvent, UpdateRulesPayload, UpdateTribesPayload} from '../../model/sidebar-event';
import {BrushShape, MetricMessage} from '../../model/worker-message';
import {formatBinaryBytes, formatDecimalBytes} from '../../util/byte-format';
import {normalizeLiveMetricSectionSettings} from '../../util/metric-settings';
import {DrawSection} from '../section/draw-section/draw-section';
import {HomeFooter} from '../section/footer/footer';
import {GridSizeSection} from '../section/grid-size-section/grid-size-section';
import {MetricsSection} from '../section/metrics-section/metrics-section';
import {PackingSection} from '../section/packing-section/packing-section';
import {PlaybackSection} from '../section/playback-section/playback-section';
import {PresetsSection} from '../section/presets-section/presets-section';
import {RulesSection} from '../section/rules-section/rules-section';
import {HomeSection} from '../section/section';
import {ShortcutsSection} from '../section/shortcuts-section/shortcuts-section';
import {SpeedSection} from '../section/speed-section/speed-section';
import {TribesSection} from '../section/tribes-section/tribes-section';

import {Grid} from '~gol/core/model/grid';
import {TypedChanges} from '~gol/core/model/typed-change';
import {StorageBarSegment} from '~gol/shared/component/storage-bar/model/storage-bar-segment';

interface DownloadFrameRange {
  startFrame: number;
  endFrame: number;
}

@Component({
  selector: 'gol-sidebar',
  standalone: true,
  imports: [
    FormsModule,
    ApplyRestoreButtons,
    HomeSection,
    PlaybackSection,
    SpeedSection,
    DrawSection,
    GridSizeSection,
    MetricsSection,
    PackingSection,
    PresetsSection,
    TribesSection,
    RulesSection,
    StorageBar,
    Button,
    InputComponent,
    CheckboxComponent,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressBarModule,
    DecimalPipe,
    HomeFooter,
    ShortcutsSection
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(contextmenu)': '$event.preventDefault()'
  }
})
export class Sidebar implements OnChanges, OnDestroy {
  @Input()
  public tribes: readonly Tribe[] = [];

  @Input()
  public drawTribes: string[] = [];

  @Input()
  public speed = 10;

  @Input()
  public maxSpeed = false;

  @Input()
  public recording = false;

  @Input()
  public running = false;

  @Input()
  public stepping = false;

  @Input()
  public backpressure = false;

  @Input()
  public rebuilding = false;

  @Input()
  public gridCols = 100;

  @Input()
  public gridRows = 100;

  @Input()
  public simulationGridFormat: GridFormatMetadata = {bitsPerCell: 8};

  @Input()
  public metrics: MetricMessage | null = null;

  @Input()
  public liveMetricsEnabled = true;

  @Input()
  public liveMetricSettings: LiveMetricSectionSettings = DEFAULT_LIVE_METRIC_SECTION_SETTINGS;

  @Input()
  public chunksSaving = false;

  @Input()
  public recordingAvailable = true;

  @Input()
  public frameByteSize = 0;

  @Input()
  public deleteMode = false;

  @Input()
  public panMode = false;

  @Input()
  public ruleset!: Ruleset;

  @Input()
  public brushSize = 1;

  @Input()
  public brushShape: BrushShape = 'square';

  @Input()
  public brushFill: 'full' | 'spray' | 'outline' = 'full';

  @Input()
  public skipAmount = 1;

  @Input()
  public downloadProgress = -1;

  @Input()
  public downloadSubProgress = -1;

  @Input()
  public downloadStatus = '';

  @Input()
  public downloadMainStatus = '';

  @Input()
  public maxBytes = Infinity;

  @Input()
  public vramBudgetBytes = Infinity;

  @Input()
  public vramSimulationBytes = 0;

  @Input()
  public vramRecordingBytes = 0;

  @Input()
  public storagePendingRawBytes = 0;

  @Input()
  public storageCompressedBytes = 0;

  @Input()
  public storageQuotaBytes = 0;

  @Input()
  public savingState = false;

  @Input()
  public loadingState = false;

  @Output()
  public readonly sidebarEvent = new EventEmitter<SidebarEvent>();

  public collapsed = true;

  public downloadMetrics = true;

  public downloadSaves = true;

  public downloadMp4 = false;

  public downloadPng = false;

  public downloadAllFrames = true;

  public downloadStartFrame = 1;

  public downloadEndFrame = 1;

  public mp4Fps = 12;

  public mp4BitrateMbps = 2;

  // Sidebar resize
  public sidebarWidth = 300;

  // Bottom sheet (mobile)
  public sheetTranslate = 'calc(100% - 0px)';

  public suppressClosedTransition = false;

  // Shortcuts
  public shortcutsExpanded = false;

  // Section collapse state
  public presetsExpanded = true;

  public tribesExpanded = true;

  public rulesExpanded = true;

  public metricsExpanded = true;

  public packingExpanded = true;

  public mp4SettingsExpanded = false;

  public downloadSelectionExpanded = true;

  private static readonly prefsKey = 'golt-simfs';

  private downloadFrameRangeTouched = false;

  private readonly mobileLayoutQuery: MediaQueryList | null = null;

  private transitionResetFrame: number | null = null;

  private transitionResetCleanupFrame: number | null = null;

  private readonly mobileLayoutListenerController = new AbortController();

  public get generationCounter(): number {
    return this.metrics?.generation ?? 0;
  }

  public get downloading(): boolean {
    return this.downloadProgress >= 0;
  }

  public get downloadButtonDisabled(): boolean {
    return this.downloadProgress >= 0 || this.chunksSaving || !!this.downloadFrameRangeError || (!this.downloadMetrics && !this.downloadSaves && !this.downloadMp4 && !this.downloadPng);
  }

  public get recordingSize(): string {
    const total = this.storagePendingRawBytes + this.storageCompressedBytes;
    if (total <= 0) {
      return '0 B';
    }
    const parts: string[] = [];
    if (this.storagePendingRawBytes > 0) {
      parts.push(`${formatDecimalBytes(this.storagePendingRawBytes)} pending`);
    }
    if (this.storageCompressedBytes > 0) {
      parts.push(`${formatDecimalBytes(this.storageCompressedBytes)} compressed`);
    }
    return `${formatDecimalBytes(total)} (${parts.join(', ')})`;
  }

  public get storageTitleSize(): string {
    const total = this.storagePendingRawBytes + this.storageCompressedBytes;
    return formatDecimalBytes(total);
  }

  public get storageQuotaFormatted(): string {
    return formatBinaryBytes(this.storageQuotaBytes);
  }

  public get storagePendingFormatted(): string {
    return formatDecimalBytes(this.storagePendingRawBytes);
  }

  public get storageCompressedFormatted(): string {
    return formatDecimalBytes(this.storageCompressedBytes);
  }

  public get storageCompressedPct(): number {
    return this.storageQuotaBytes > 0 ? (this.storageCompressedBytes / this.storageQuotaBytes) * 100 : 0;
  }

  public get storagePendingPct(): number {
    return this.storageQuotaBytes > 0 ? (this.storagePendingRawBytes / this.storageQuotaBytes) * 100 : 0;
  }

  public get storageBarTooltip(): string {
    return `${formatDecimalBytes(this.storagePendingRawBytes)} pending / ${formatDecimalBytes(this.storageCompressedBytes)} compressed / ${formatBinaryBytes(this.storageQuotaBytes)} quota`;
  }

  public get vramTitleSize(): string {
    return formatBinaryBytes(this.vramSimulationBytes + this.vramRecordingBytes);
  }

  public get vramQuotaFormatted(): string {
    return Number.isFinite(this.vramBudgetBytes) ? formatBinaryBytes(this.vramBudgetBytes) : 'Detecting…';
  }

  public get vramSimulationFormatted(): string {
    return formatBinaryBytes(this.vramSimulationBytes);
  }

  public get vramRecordingFormatted(): string {
    return formatBinaryBytes(this.vramRecordingBytes);
  }

  public get vramSimulationPct(): number {
    return Number.isFinite(this.vramBudgetBytes) && this.vramBudgetBytes > 0 ? (this.vramSimulationBytes / this.vramBudgetBytes) * 100 : 0;
  }

  public get vramRecordingPct(): number {
    return Number.isFinite(this.vramBudgetBytes) && this.vramBudgetBytes > 0 ? (this.vramRecordingBytes / this.vramBudgetBytes) * 100 : 0;
  }

  public get vramBarTooltip(): string {
    return `${this.vramSimulationFormatted} simulation / ${this.vramRecordingFormatted} recording / ${this.vramQuotaFormatted} budget`;
  }

  public get vramBarTotal(): number {
    if (Number.isFinite(this.vramBudgetBytes) && this.vramBudgetBytes > 0) {
      return this.vramBudgetBytes;
    }

    return this.vramSimulationBytes + this.vramRecordingBytes;
  }

  public get vramSegments(): StorageBarSegment[] {
    return [
      {
        label: 'simulation',
        value: this.vramSimulationBytes,
        formatted: this.vramSimulationFormatted,
        color: '#f59e0b'
      },
      {
        label: 'recording',
        value: this.vramRecordingBytes,
        formatted: this.vramRecordingFormatted,
        color: '#e91e8a'
      }
    ];
  }

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

  public get mp4GateMessage(): string | null {
    const frames = this.metrics?.totalFrames || 0;
    if (frames === 0) {
      return null;
    }
    const bitrateBps = this.mp4BitrateMbps * 1_000_000;
    const overheadMultiplier = 1.1; // 10% safety margin for muxer overhead
    const estimatedBytes = (frames / this.mp4Fps) * (bitrateBps / 8) * overheadMultiplier;
    const twoGb = 2 * 1024 * 1024 * 1024;
    if (estimatedBytes > twoGb) {
      return `Estimated MP4 size (${formatBinaryBytes(estimatedBytes)}) exceeds the 2 GB memory limit — MP4 will be skipped. Increase FPS, lower bitrate, or record fewer frames`;
    }
    return null;
  }

  public get brushMaxSize(): number {
    return Math.max(1, Math.floor(Math.min(this.gridCols, this.gridRows) / 4));
  }

  public get totalRecordedFrames(): number {
    return Math.max(0, this.metrics?.totalFrames ?? 0);
  }

  public get hasRecordedFrames(): boolean {
    return this.totalRecordedFrames > 0;
  }

  public get normalizedDownloadFrameRange(): DownloadFrameRange | null {
    if (this.downloadAllFrames || !this.hasRecordedFrames) {
      return null;
    }
    const startFrame = Math.min(Math.max(1, Math.floor(this.downloadStartFrame || 1)), this.totalRecordedFrames);
    const endFrame = Math.min(Math.max(startFrame, Math.floor(this.downloadEndFrame || startFrame)), this.totalRecordedFrames);
    return {startFrame, endFrame};
  }

  public get downloadFrameRangeError(): string | null {
    if (this.downloadAllFrames || !this.hasRecordedFrames) {
      return null;
    }
    if (!Number.isFinite(this.downloadStartFrame) || !Number.isFinite(this.downloadEndFrame)) {
      return 'Frame range must use whole numbers.';
    }
    if (this.downloadStartFrame < 1 || this.downloadEndFrame < 1) {
      return 'Frame range must start at frame 1 or later.';
    }
    if (this.downloadStartFrame > this.totalRecordedFrames || this.downloadEndFrame > this.totalRecordedFrames) {
      return `Recorded frames currently range from 1 to ${this.totalRecordedFrames.toLocaleString()}.`;
    }
    if (this.downloadStartFrame > this.downloadEndFrame) {
      return 'Start frame must be less than or equal to end frame.';
    }
    return null;
  }

  public constructor(private readonly elRef: ElementRef, private readonly zone: NgZone, private readonly cdr: ChangeDetectorRef) {
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      this.mobileLayoutQuery = window.matchMedia('(max-width: 640px)');
      this.mobileLayoutQuery.addEventListener('change', () => {
        this.zone.run(() => {
          this.handleMobileLayoutChange();
        });
      }, {
        signal: this.mobileLayoutListenerController.signal
      });
    }
    this.loadPrefs();
  }

  public ngOnDestroy(): void {
    this.mobileLayoutListenerController.abort();
    this.clearPendingTransitionReset();
  }

  public ngOnChanges(changes: TypedChanges<Sidebar>): void {
    if (changes.metrics) {
      this.syncDownloadFrameRange();
    }
  }

  public toggle(): void {
    this.clearPendingTransitionReset();
    this.suppressClosedTransition = false;
    this.collapsed = !this.collapsed;
    if (!this.collapsed) {
      this.sheetTranslate = '0px';
    }
  }

  public emit(action: SidebarEvent['action'], value?: unknown): void {
    this.sidebarEvent.emit({action, value});
  }

  public onTribeChange(id: string): void {
    this.emit('selectTribes', this.toggleTribeSelection(id));
  }

  public onSpeedChange(value: string): void {
    const n = +value;
    if (n > 0) {
      this.emit('setSpeed', n);
    }
  }

  public onMaxSpeedChange(checked: boolean): void {
    this.emit('setMaxSpeed', checked);
  }

  public onRecordingChange(checked: boolean): void {
    this.emit('setRecording', checked);
  }

  public onLiveMetricsEnabledChange(checked: boolean): void {
    this.liveMetricsEnabled = checked;
    this.emit('setLiveMetrics', {
      enabled: this.liveMetricsEnabled,
      sections: this.liveMetricSettings
    });
  }

  public onLiveMetricSettingsChange(settings: LiveMetricSectionSettings): void {
    this.liveMetricSettings = normalizeLiveMetricSectionSettings(settings);
    this.emit('setLiveMetrics', {
      enabled: this.liveMetricsEnabled,
      sections: this.liveMetricSettings
    });
  }

  public onGridSizeApply(value: Grid): void {
    this.emit('setGridSize', value);
  }

  public onPackingApply(value: BitsPerCell): void {
    this.emit('setPacking', value);
  }

  public onDownload(): void {
    this.emit('download', {
      metrics: this.downloadMetrics,
      mp4: this.downloadMp4 && !this.mp4GateMessage,
      png: this.downloadPng,
      saves: this.downloadSaves,
      fps: this.mp4Fps,
      bitrate: this.mp4BitrateMbps * 1_000_000,
      frameRange: this.normalizedDownloadFrameRange
    });
  }

  public onDownloadAllFramesChange(checked: boolean): void {
    this.downloadAllFrames = checked;
    this.downloadFrameRangeTouched = false;
    this.syncDownloadFrameRange();
    this.savePrefs();
  }

  public onDownloadStartFrameChange(value: number): void {
    this.downloadStartFrame = value;
    this.downloadFrameRangeTouched = true;
  }

  public onDownloadEndFrameChange(value: number): void {
    this.downloadEndFrame = value;
    this.downloadFrameRangeTouched = true;
  }

  public onStepBack(): void {
    this.emit('stepBack', +this.skipAmount);
  }

  public onStepForward(): void {
    this.emit('stepForward', +this.skipAmount);
  }

  public onSkipAmountChange(value: number): void {
    this.skipAmount = value;
    this.savePrefs();
  }

  public onBrushSizeChange(value: string): void {
    const n = Math.min(Math.max(1, +value || 1), this.brushMaxSize);
    if (n > 0) {
      this.emit('setBrushSize', n);
    }
  }

  public onBrushShapeChange(shape: BrushShape): void {
    this.emit('setBrushShape', shape);
  }

  public onBrushFillChange(fill: 'full' | 'spray' | 'outline'): void {
    this.emit('setBrushFill', fill);
  }

  public onTouchModeChange(mode: 'draw' | 'pan'): void {
    if ((mode === 'pan') !== this.panMode) {
      this.emit('togglePanMode');
    }
  }

  public onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        this.emit('loadState', reader.result);
      }
      input.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  public applyTribes(payload: UpdateTribesPayload): void {
    this.emit('updateTribes', payload);
  }

  public applyPreset(preset: Preset): void {
    this.emit('applyPreset', preset);
  }

  public applyRules(payload: UpdateRulesPayload): void {
    this.emit('updateRules', payload);
  }

  public onSheetDragStart(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    event.preventDefault();

    const startY = event.clientY;
    const panel = this.elRef.nativeElement.querySelector('.sidebar-panel') as HTMLElement;
    const handle = event.currentTarget as HTMLElement | null;
    const panelHeight = panel.offsetHeight;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const currentTranslateY = panel.getBoundingClientRect().bottom - viewportHeight;

    panel.classList.add('dragging');
    document.body.style.userSelect = 'none';
    handle?.setPointerCapture?.(event.pointerId);

    const cleanup = () => {
      panel.classList.remove('dragging');
      document.body.style.userSelect = '';
      handle?.releasePointerCapture?.(event.pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) {
        return;
      }

      e.preventDefault();
      const dy = e.clientY - startY;
      const newTranslate = Math.max(0, currentTranslateY + dy);
      this.sheetTranslate = `${newTranslate}px`;
      this.cdr.detectChanges();
    };

    const onEnd = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) {
        return;
      }

      const dy = e.clientY - startY;
      const finalTranslate = Math.max(0, currentTranslateY + dy);
      // If dragged down more than 50% of the panel height, close.
      if (finalTranslate > panelHeight * 0.5) {
        this.collapsed = true;
        this.sheetTranslate = '0px';
      } else {
        // Stay at dragged position.
        this.sheetTranslate = `${finalTranslate}px`;
      }
      this.cdr.detectChanges();
      cleanup();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
  }

  public onResizeStart(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    document.body.style.userSelect = 'none';
    const startX = event.clientX;
    const startWidth = this.sidebarWidth;
    const handle = event.currentTarget as HTMLElement | null;
    const panel = this.elRef.nativeElement.querySelector('.sidebar-panel') as HTMLElement | null;

    handle?.setPointerCapture?.(event.pointerId);
    panel?.classList.add('resizing');

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      this.sidebarWidth = Math.max(300, Math.min(600, startWidth + e.clientX - startX));
      this.cdr.detectChanges();
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      document.body.style.userSelect = '';
      panel?.classList.remove('resizing');
      handle?.releasePointerCapture?.(event.pointerId);
      if (this.isDesktopLayout()) {
        this.savePrefs();
      }
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }

  public toggleSection(section: 'presets' | 'packing' | 'tribes' | 'rules' | 'metrics' | 'shortcuts' | 'mp4Settings' | 'downloadSelection'): void {
    this.onSectionExpandedChange(section, !this[`${section}Expanded`]);
  }

  public onSectionExpandedChange(section: 'presets' | 'packing' | 'tribes' | 'rules' | 'metrics' | 'shortcuts' | 'mp4Settings' | 'downloadSelection', expanded: boolean): void {
    switch (section) {
      case 'presets': this.presetsExpanded = expanded; break;
      case 'packing': this.packingExpanded = expanded; break;
      case 'tribes': this.tribesExpanded = expanded; break;
      case 'rules': this.rulesExpanded = expanded; break;
      case 'metrics': this.metricsExpanded = expanded; break;
      case 'shortcuts': this.shortcutsExpanded = expanded; break;
      case 'mp4Settings': this.mp4SettingsExpanded = expanded; break;
      case 'downloadSelection': this.downloadSelectionExpanded = expanded; break;
    }
    this.savePrefs();
  }

  public savePrefs(): void {
    try {
      const existing = JSON.parse(localStorage.getItem(Sidebar.prefsKey) ?? '{}');
      const prefs = {
        ...existing,
        shortcutsExpanded: this.shortcutsExpanded,
        presetsExpanded: this.presetsExpanded,
        packingExpanded: this.packingExpanded,
        tribesExpanded: this.tribesExpanded,
        rulesExpanded: this.rulesExpanded,
        metricsExpanded: this.metricsExpanded,
        downloadMetrics: this.downloadMetrics,
        downloadSaves: this.downloadSaves,
        downloadMp4: this.downloadMp4,
        downloadPng: this.downloadPng,
        downloadAllFrames: this.downloadAllFrames,
        mp4Fps: this.mp4Fps,
        mp4BitrateMbps: this.mp4BitrateMbps,
        mp4SettingsExpanded: this.mp4SettingsExpanded,
        downloadSelectionExpanded: this.downloadSelectionExpanded,
        skipAmount: +this.skipAmount
      };
      if (this.isDesktopLayout()) {
        Object.assign(prefs, {sidebarWidth: this.sidebarWidth});
      }
      localStorage.setItem(Sidebar.prefsKey, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save sidebar preferences:', e);
    }
  }

  private handleMobileLayoutChange(): void {
    if (!this.collapsed) {
      return;
    }
    this.suppressClosedTransition = true;
    this.cdr.markForCheck();
    this.clearPendingTransitionReset();
    this.transitionResetFrame = requestAnimationFrame(() => {
      this.transitionResetFrame = null;
      this.transitionResetCleanupFrame = requestAnimationFrame(() => {
        this.transitionResetCleanupFrame = null;
        this.suppressClosedTransition = false;
        this.cdr.markForCheck();
      });
    });
  }

  private isDesktopLayout(): boolean {
    return !this.mobileLayoutQuery?.matches;
  }

  private clearPendingTransitionReset(): void {
    if (this.transitionResetFrame !== null) {
      cancelAnimationFrame(this.transitionResetFrame);
      this.transitionResetFrame = null;
    }
    if (this.transitionResetCleanupFrame !== null) {
      cancelAnimationFrame(this.transitionResetCleanupFrame);
      this.transitionResetCleanupFrame = null;
    }
  }

  private toggleTribeSelection(id: string): string[] {
    if (id === DEAD_TRIBE_ID) {
      return [DEAD_TRIBE_ID];
    }
    // If currently in delete mode (only DEAD_TRIBE_ID selected), start fresh.
    if (this.drawTribes.length === 1 && this.drawTribes[0] === DEAD_TRIBE_ID) {
      return [id];
    }
    const current = this.drawTribes.filter(t => t !== DEAD_TRIBE_ID);
    const idx = current.indexOf(id);
    if (idx >= 0) {
      // Don't allow deselecting the last tribe.
      if (current.length > 1) {
        current.splice(idx, 1);
      }
      return current;
    }
    return [...current, id];
  }

  private syncDownloadFrameRange(): void {
    const totalFrames = this.totalRecordedFrames;
    if (totalFrames <= 0) {
      this.downloadStartFrame = 1;
      this.downloadEndFrame = 1;
      return;
    }

    if (this.downloadAllFrames) {
      this.downloadStartFrame = 1;
      this.downloadEndFrame = totalFrames;
      return;
    }

    if (!this.downloadFrameRangeTouched) {
      this.downloadStartFrame = 1;
      this.downloadEndFrame = totalFrames;
      return;
    }

    this.downloadStartFrame = Math.min(Math.max(1, Math.floor(this.downloadStartFrame || 1)), totalFrames);
    this.downloadEndFrame = Math.min(Math.max(this.downloadStartFrame, Math.floor(this.downloadEndFrame || this.downloadStartFrame)), totalFrames);
  }

  private loadPrefs(): void {
    try {
      const raw = localStorage.getItem(Sidebar.prefsKey);
      if (!raw) {
        return;
      }
      const p = JSON.parse(raw);
      if (typeof p.shortcutsExpanded === 'boolean') {
        this.shortcutsExpanded = p.shortcutsExpanded;
      }
      if (typeof p.presetsExpanded === 'boolean') {
        this.presetsExpanded = p.presetsExpanded;
      }
      if (typeof p.packingExpanded === 'boolean') {
        this.packingExpanded = p.packingExpanded;
      }
      if (typeof p.tribesExpanded === 'boolean') {
        this.tribesExpanded = p.tribesExpanded;
      }
      if (typeof p.rulesExpanded === 'boolean') {
        this.rulesExpanded = p.rulesExpanded;
      }
      if (typeof p.metricsExpanded === 'boolean') {
        this.metricsExpanded = p.metricsExpanded;
      }
      if (this.isDesktopLayout() && typeof p.sidebarWidth === 'number' && p.sidebarWidth >= 300 && p.sidebarWidth <= 600) {
        this.sidebarWidth = p.sidebarWidth;
      }
      if (typeof p.downloadMetrics === 'boolean') {
        this.downloadMetrics = p.downloadMetrics;
      }
      if (typeof p.downloadSaves === 'boolean') {
        this.downloadSaves = p.downloadSaves;
      }
      if (typeof p.downloadMp4 === 'boolean') {
        this.downloadMp4 = p.downloadMp4;
      }
      if (typeof p.downloadPng === 'boolean') {
        this.downloadPng = p.downloadPng;
      }
      if (typeof p.downloadAllFrames === 'boolean') {
        this.downloadAllFrames = p.downloadAllFrames;
      }
      if (typeof p.mp4Fps === 'number' && p.mp4Fps >= 1 && p.mp4Fps <= 60) {
        this.mp4Fps = p.mp4Fps;
      }
      if (typeof p.mp4BitrateMbps === 'number' && p.mp4BitrateMbps >= 0.5 && p.mp4BitrateMbps <= 50) {
        this.mp4BitrateMbps = p.mp4BitrateMbps;
      }
      if (typeof p.mp4SettingsExpanded === 'boolean') {
        this.mp4SettingsExpanded = p.mp4SettingsExpanded;
      }
      if (typeof p.mp4BitrateMbps === 'number' && p.mp4BitrateMbps >= 0.5 && p.mp4BitrateMbps <= 50) {
        this.mp4BitrateMbps = p.mp4BitrateMbps;
      }
      if (typeof p.mp4SettingsExpanded === 'boolean') {
        this.mp4SettingsExpanded = p.mp4SettingsExpanded;
      }
      if (typeof p.downloadSelectionExpanded === 'boolean') {
        this.downloadSelectionExpanded = p.downloadSelectionExpanded;
      }
      if (typeof p.skipAmount === 'number' && p.skipAmount >= 1) {
        this.skipAmount = p.skipAmount;
      }
    } catch (e) {
      console.warn('Failed to load sidebar preferences:', e);
    }
  }
}
