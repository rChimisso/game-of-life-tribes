import {afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

import {PersistedPreferencesComponent} from '../../../../core/abstract/persisted-preferences-component';
import {Button} from '../../../../shared/component/button/button';
import {StorageBar} from '../../../../shared/component/storage-bar/storage-bar';
import {BRUSH_FILL_VALUES, BRUSH_SHAPE_VALUES, BrushFill, BrushShape, TouchMode} from '../../model/draw-mode';
import {BitsPerCell, GridFormatMetadata} from '../../model/grid-format';
import {DEFAULT_LIVE_METRIC_SECTION_SETTINGS, LiveMetricSectionSettings} from '../../model/metrics';
import {DEFAULT_DRAW_SECTION_PREFERENCES, DEFAULT_METRICS_SECTION_PREFERENCES, DEFAULT_SPEED_SECTION_PREFERENCES, DrawSectionPreferences, MetricsSectionPreferences, SidebarPreferences, SpeedSectionPreferences} from '../../model/preferences';
import {Preset} from '../../model/preset';
import {DEAD_TRIBE_ID, Ruleset, Tribe} from '../../model/rule';
import {SidebarEvent, UpdateRulesPayload, UpdateTribesPayload} from '../../model/sidebar-event';
import {MetricMessage} from '../../model/worker-message';
import {formatBinaryBytes} from '../../util/byte-format';
import {normalizeLiveMetricSectionSettings} from '../../util/metric-settings';
import {DownloadSection} from '../section/download-section/download-section';
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
import {SnapshotSection} from '../section/snapshot-section/snapshot-section';
import {SpeedSection} from '../section/speed-section/speed-section';
import {TribesSection} from '../section/tribes-section/tribes-section';

import {TypedChanges} from '~gol/core/model/typed-change';
import {Grid} from '~gol/feature/home/model/grid';
import {StorageBarSegment} from '~gol/shared/component/storage-bar/model/storage-bar-segment';

@Component({
  selector: 'gol-sidebar',
  standalone: true,
  imports: [
    HomeSection,
    PlaybackSection,
    SpeedSection,
    DrawSection,
    GridSizeSection,
    MetricsSection,
    DownloadSection,
    SnapshotSection,
    PackingSection,
    PresetsSection,
    TribesSection,
    RulesSection,
    StorageBar,
    Button,
    MatButtonModule,
    MatIconModule,
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
export class Sidebar extends PersistedPreferencesComponent<SidebarPreferences> implements OnChanges, OnDestroy {
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
  public brushFill: BrushFill = 'full';

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

  public drawSectionPreferences: DrawSectionPreferences = {...DEFAULT_DRAW_SECTION_PREFERENCES};

  public speedSectionPreferences: SpeedSectionPreferences = {...DEFAULT_SPEED_SECTION_PREFERENCES};

  public metricsSectionPreferences: MetricsSectionPreferences = {
    ...DEFAULT_METRICS_SECTION_PREFERENCES,
    liveMetricSettings: {...DEFAULT_METRICS_SECTION_PREFERENCES.liveMetricSettings}
  };

  public collapsed = true;

  // Sidebar resize
  public sidebarWidth = 300;

  // Bottom sheet (mobile)
  public sheetTranslate = 'calc(100% - 0px)';

  public suppressClosedTransition = false;

  private readonly mobileLayoutQuery: MediaQueryList | null = null;

  private transitionResetFrame: number | null = null;

  private transitionResetCleanupFrame: number | null = null;

  private readonly mobileLayoutListenerController = new AbortController();

  private initialPreferencesSynced = false;

  /**
   * Default preferences.
   *
   * @protected
   * @readonly
   * @type {SidebarPreferences}
   */
  protected override readonly defaultPreferences: SidebarPreferences = {
    sidebarWidth: 300,
    draw: DEFAULT_DRAW_SECTION_PREFERENCES,
    speed: DEFAULT_SPEED_SECTION_PREFERENCES,
    metrics: DEFAULT_METRICS_SECTION_PREFERENCES
  };

  public get generationCounter(): number {
    return this.metrics?.generation ?? 0;
  }

  public get downloading(): boolean {
    return this.downloadProgress >= 0;
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

  public get brushMaxSize(): number {
    return Math.max(1, Math.floor(Math.min(this.gridCols, this.gridRows) / 4));
  }

  public constructor(private readonly elRef: ElementRef, private readonly zone: NgZone, private readonly cdr: ChangeDetectorRef) {
    super('golt-sidebar-prefs');
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
    this.restorePreferences();
    afterNextRender(() => {
      this.emitInitialSectionPreferences();
      this.initialPreferencesSynced = true;
    });
  }

  public ngOnChanges(changes: TypedChanges<Sidebar>): void {
    let shouldSavePreferences = false;

    if (changes.gridCols || changes.gridRows) {
      const clampedBrushSize = this.clampBrushSize(this.drawSectionPreferences.brushSize);
      if (clampedBrushSize !== this.drawSectionPreferences.brushSize) {
        this.drawSectionPreferences = {
          ...this.drawSectionPreferences,
          brushSize: clampedBrushSize
        };
        shouldSavePreferences = true;
        if (this.initialPreferencesSynced) {
          this.emit('setBrushSize', clampedBrushSize);
        }
      }
    }

    if (this.initialPreferencesSynced) {
      if (changes.brushSize) {
        const nextBrushSize = this.clampBrushSize(this.brushSize);
        if (nextBrushSize !== this.drawSectionPreferences.brushSize) {
          this.drawSectionPreferences = {
            ...this.drawSectionPreferences,
            brushSize: nextBrushSize
          };
          shouldSavePreferences = true;
        }
      }

      if (changes.brushShape && this.brushShape !== this.drawSectionPreferences.brushShape) {
        this.drawSectionPreferences = {
          ...this.drawSectionPreferences,
          brushShape: this.brushShape
        };
        shouldSavePreferences = true;
      }

      if (changes.brushFill && this.brushFill !== this.drawSectionPreferences.brushFill) {
        this.drawSectionPreferences = {
          ...this.drawSectionPreferences,
          brushFill: this.brushFill
        };
        shouldSavePreferences = true;
      }

      if (changes.speed && this.speed !== this.speedSectionPreferences.speed) {
        this.speedSectionPreferences = {
          ...this.speedSectionPreferences,
          speed: this.speed
        };
        shouldSavePreferences = true;
      }

      if (changes.maxSpeed && this.maxSpeed !== this.speedSectionPreferences.maxSpeed) {
        this.speedSectionPreferences = {
          ...this.speedSectionPreferences,
          maxSpeed: this.maxSpeed
        };
        shouldSavePreferences = true;
      }

      if (changes.recording || changes.recordingAvailable) {
        const nextRecording = this.recording && this.recordingAvailable;
        if (nextRecording !== this.speedSectionPreferences.recording) {
          this.speedSectionPreferences = {
            ...this.speedSectionPreferences,
            recording: nextRecording
          };
          shouldSavePreferences = true;
        }
      }

      if (changes.liveMetricsEnabled && this.liveMetricsEnabled !== this.speedSectionPreferences.liveMetricsEnabled) {
        this.speedSectionPreferences = {
          ...this.speedSectionPreferences,
          liveMetricsEnabled: this.liveMetricsEnabled
        };
        shouldSavePreferences = true;
      }

      if (changes.liveMetricSettings) {
        const nextLiveMetricSettings = normalizeLiveMetricSectionSettings(this.liveMetricSettings);
        if (JSON.stringify(nextLiveMetricSettings) !== JSON.stringify(this.metricsSectionPreferences.liveMetricSettings)) {
          this.metricsSectionPreferences = {
            ...this.metricsSectionPreferences,
            liveMetricSettings: nextLiveMetricSettings
          };
          shouldSavePreferences = true;
        }
      }
    }

    if (shouldSavePreferences) {
      this.savePreferences();
      this.cdr.markForCheck();
    }
  }

  public ngOnDestroy(): void {
    this.mobileLayoutListenerController.abort();
    this.clearPendingTransitionReset();
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
    this.sidebarEvent.emit(value === undefined ? {action} as SidebarEvent : {action, value} as SidebarEvent);
  }

  public onTribeChange(id: string): void {
    this.emit('selectTribes', this.toggleTribeSelection(id));
  }

  public onSpeedChange(value: string): void {
    const n = +value;
    if (n > 0) {
      this.speedSectionPreferences = {
        ...this.speedSectionPreferences,
        speed: n,
        maxSpeed: false
      };
      this.savePreferences();
      this.cdr.markForCheck();
      this.emit('setSpeed', n);
    }
  }

  public onMaxSpeedChange(checked: boolean): void {
    this.speedSectionPreferences = {
      ...this.speedSectionPreferences,
      maxSpeed: checked
    };
    this.savePreferences();
    this.cdr.markForCheck();
    this.emit('setMaxSpeed', checked);
  }

  public onRecordingChange(checked: boolean): void {
    const nextRecording = checked && this.recordingAvailable;
    this.speedSectionPreferences = {
      ...this.speedSectionPreferences,
      recording: nextRecording
    };
    this.savePreferences();
    this.cdr.markForCheck();
    this.emit('setRecording', nextRecording);
  }

  public onLiveMetricsEnabledChange(checked: boolean): void {
    this.speedSectionPreferences = {
      ...this.speedSectionPreferences,
      liveMetricsEnabled: checked
    };
    this.savePreferences();
    this.cdr.markForCheck();
    this.emit('setLiveMetrics', {
      enabled: this.speedSectionPreferences.liveMetricsEnabled,
      sections: this.metricsSectionPreferences.liveMetricSettings
    });
  }

  public onLiveMetricSettingsChange(settings: LiveMetricSectionSettings): void {
    this.metricsSectionPreferences = {
      ...this.metricsSectionPreferences,
      liveMetricSettings: normalizeLiveMetricSectionSettings(settings)
    };
    this.savePreferences();
    this.cdr.markForCheck();
    this.emit('setLiveMetrics', {
      enabled: this.speedSectionPreferences.liveMetricsEnabled,
      sections: this.metricsSectionPreferences.liveMetricSettings
    });
  }

  public onGridSizeApply(value: Grid): void {
    this.emit('setGridSize', value);
  }

  public onPackingApply(value: BitsPerCell): void {
    this.emit('setPacking', value);
  }

  public onBrushSizeChange(value: string): void {
    const n = Math.min(Math.max(1, +value || 1), this.brushMaxSize);
    if (n > 0) {
      this.drawSectionPreferences = {
        ...this.drawSectionPreferences,
        brushSize: n
      };
      this.savePreferences();
      this.cdr.markForCheck();
      this.emit('setBrushSize', n);
    }
  }

  public onBrushShapeChange(shape: BrushShape): void {
    this.drawSectionPreferences = {
      ...this.drawSectionPreferences,
      brushShape: shape
    };
    this.savePreferences();
    this.cdr.markForCheck();
    this.emit('setBrushShape', shape);
  }

  public onBrushFillChange(fill: BrushFill): void {
    this.drawSectionPreferences = {
      ...this.drawSectionPreferences,
      brushFill: fill
    };
    this.savePreferences();
    this.cdr.markForCheck();
    this.emit('setBrushFill', fill);
  }

  public onPopulationExpandedChange(expanded: boolean): void {
    this.metricsSectionPreferences = {
      ...this.metricsSectionPreferences,
      populationExpanded: expanded
    };
    this.savePreferences();
  }

  public onDiversityExpandedChange(expanded: boolean): void {
    this.metricsSectionPreferences = {
      ...this.metricsSectionPreferences,
      diversityExpanded: expanded
    };
    this.savePreferences();
  }

  public onInterfacesExpandedChange(expanded: boolean): void {
    this.metricsSectionPreferences = {
      ...this.metricsSectionPreferences,
      interfacesExpanded: expanded
    };
    this.savePreferences();
  }

  public onTouchModeChange(mode: TouchMode): void {
    if ((mode === 'pan') !== this.panMode) {
      this.emit('togglePanMode');
    }
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
      if (e.pointerId === event.pointerId) {
        e.preventDefault();
        const dy = e.clientY - startY;
        const newTranslate = Math.max(0, currentTranslateY + dy);
        this.sheetTranslate = `${newTranslate}px`;
        this.cdr.detectChanges();
      }
    };

    const onEnd = (e: PointerEvent) => {
      if (e.pointerId === event.pointerId) {
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
      }
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
      if (e.pointerId === event.pointerId) {
        e.preventDefault();
        e.stopPropagation();
        this.sidebarWidth = Math.max(300, Math.min(600, startWidth + e.clientX - startX));
        this.cdr.detectChanges();
      }
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId === event.pointerId) {
        e.preventDefault();
        e.stopPropagation();
        document.body.style.userSelect = '';
        panel?.classList.remove('resizing');
        handle?.releasePointerCapture?.(event.pointerId);
        this.savePreferences();
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }

  /**
   * Collects current preferences.
   *
   * @protected
   * @returns {SidebarPreferences}
   */
  protected override collectPreferences(): SidebarPreferences {
    return {
      sidebarWidth: this.sidebarWidth,
      draw: {...this.drawSectionPreferences},
      speed: {...this.speedSectionPreferences},
      metrics: {
        ...this.metricsSectionPreferences,
        liveMetricSettings: {...this.metricsSectionPreferences.liveMetricSettings}
      }
    };
  }

  /**
   * Applies restored preferences.
   *
   * @protected
   * @param {SidebarPreferences} preferences
   */
  protected override applyPreferences(preferences: SidebarPreferences): void {
    if (this.isDesktopLayout()) {
      this.sidebarWidth = preferences.sidebarWidth;
    }
    this.drawSectionPreferences = {...preferences.draw};
    this.speedSectionPreferences = {...preferences.speed};
    this.metricsSectionPreferences = {
      ...preferences.metrics,
      liveMetricSettings: {...preferences.metrics.liveMetricSettings}
    };
  }

  /**
   * Normalizes stored preferences.
   *
   * @protected
   * @param {Partial<SidebarPreferences>} stored
   * @param {SidebarPreferences} defaults
   * @returns {SidebarPreferences}
   */
  protected override normalizePreferences(stored: Partial<SidebarPreferences>, defaults: SidebarPreferences): SidebarPreferences {
    return {
      sidebarWidth: typeof stored.sidebarWidth === 'number' && stored.sidebarWidth >= 300 && stored.sidebarWidth <= 600 ? stored.sidebarWidth : defaults.sidebarWidth,
      draw: this.normalizeDrawSectionPreferences(stored.draw, defaults.draw),
      speed: this.normalizeSpeedSectionPreferences(stored.speed, defaults.speed),
      metrics: this.normalizeMetricsSectionPreferences(stored.metrics, defaults.metrics)
    };
  }

  private handleMobileLayoutChange(): void {
    if (this.collapsed) {
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

  private emitInitialSectionPreferences(): void {
    this.emit('setBrushSize', this.drawSectionPreferences.brushSize);
    this.emit('setBrushShape', this.drawSectionPreferences.brushShape);
    this.emit('setBrushFill', this.drawSectionPreferences.brushFill);
    this.emit('setSpeed', this.speedSectionPreferences.speed);
    this.emit('setMaxSpeed', this.speedSectionPreferences.maxSpeed);
    this.emit('setRecording', this.speedSectionPreferences.recording && this.recordingAvailable);
    this.emit('setLiveMetrics', {
      enabled: this.speedSectionPreferences.liveMetricsEnabled,
      sections: this.metricsSectionPreferences.liveMetricSettings
    });
  }

  private clampBrushSize(size: number): number {
    return Math.min(Math.max(1, Math.floor(+size || 1)), this.brushMaxSize);
  }

  private normalizeDrawSectionPreferences(stored: Partial<DrawSectionPreferences> | undefined, defaults: DrawSectionPreferences): DrawSectionPreferences {
    const normalizedStored = stored ?? {};
    return {
      brushSize: typeof normalizedStored.brushSize === 'number' && normalizedStored.brushSize >= 1 ? Math.floor(normalizedStored.brushSize) : defaults.brushSize,
      brushShape: normalizedStored.brushShape && BRUSH_SHAPE_VALUES.includes(normalizedStored.brushShape) ? normalizedStored.brushShape : defaults.brushShape,
      brushFill: normalizedStored.brushFill && BRUSH_FILL_VALUES.includes(normalizedStored.brushFill) ? normalizedStored.brushFill : defaults.brushFill
    };
  }

  private normalizeSpeedSectionPreferences(stored: Partial<SpeedSectionPreferences> | undefined, defaults: SpeedSectionPreferences): SpeedSectionPreferences {
    const normalizedStored = stored ?? {};
    return {
      speed: typeof normalizedStored.speed === 'number' && normalizedStored.speed >= 1 ? Math.floor(normalizedStored.speed) : defaults.speed,
      maxSpeed: typeof normalizedStored.maxSpeed === 'boolean' ? normalizedStored.maxSpeed : defaults.maxSpeed,
      recording: typeof normalizedStored.recording === 'boolean' ? normalizedStored.recording : defaults.recording,
      liveMetricsEnabled: typeof normalizedStored.liveMetricsEnabled === 'boolean' ? normalizedStored.liveMetricsEnabled : defaults.liveMetricsEnabled
    };
  }

  private normalizeMetricsSectionPreferences(stored: Partial<MetricsSectionPreferences> | undefined, defaults: MetricsSectionPreferences): MetricsSectionPreferences {
    const normalizedStored = stored ?? {};
    return {
      liveMetricSettings: normalizeLiveMetricSectionSettings(normalizedStored.liveMetricSettings ?? defaults.liveMetricSettings),
      populationExpanded: typeof normalizedStored.populationExpanded === 'boolean' ? normalizedStored.populationExpanded : defaults.populationExpanded,
      diversityExpanded: typeof normalizedStored.diversityExpanded === 'boolean' ? normalizedStored.diversityExpanded : defaults.diversityExpanded,
      interfacesExpanded: typeof normalizedStored.interfacesExpanded === 'boolean' ? normalizedStored.interfacesExpanded : defaults.interfacesExpanded
    };
  }
}
