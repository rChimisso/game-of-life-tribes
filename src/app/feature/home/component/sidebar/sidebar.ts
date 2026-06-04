import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

import {calculateBrushMaxSize, calculateVramBarTotal, calculateVramRecordingPct, calculateVramSimulationPct, createVramBarTooltip, createVramSegments, formatDownloadStorageQuota, formatDownloadStorageTitleSize, formatVramQuota, formatVramRecording, formatVramSimulation, formatVramTitleSize} from './logic/sidebar-display';
import {startSidebarPointerDrag} from './logic/sidebar-pointer-drag';
import {SidebarGridDisplayInput, SidebarStorageDisplayInput, SidebarVramDisplayInput} from './model/sidebar-display';
import {BrushFill, BrushShape, TouchMode} from '../../model/draw-mode';
import {BitsPerCell, GridFormatMetadata} from '../../model/grid-format';
import {DEFAULT_LIVE_METRIC_SECTION_SETTINGS, LiveMetricSectionSettings} from '../../model/metrics';
import {DEFAULT_SIDEBAR_PREFERENCES, SidebarPreferences} from '../../model/preferences';
import {DEAD_TRIBE_ID, Ruleset, Tribe} from '../../model/rule';
import {SidebarEvent, UpdateRulesPayload, UpdateTribesPayload} from '../../model/sidebar-event';
import {MetricMessage} from '../../model/worker-message';
import {Preset} from '../../preset';
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

import {PersistedPreferencesComponent} from '~gol/core/abstract/persisted-preferences-component';
import {Grid} from '~gol/feature/home/model/grid';
import {Button} from '~gol/shared/component/button/button';
import {ProgressStatusMode} from '~gol/shared/component/progress-status/model/progress-status';
import {StorageBarSegment} from '~gol/shared/component/storage-bar/model/storage-bar-segment';
import {StorageBar} from '~gol/shared/component/storage-bar/storage-bar';

/**
 * Home controls sidebar.
 *
 * @class Sidebar
 * @typedef {Sidebar}
 * @extends {PersistedPreferencesComponent<SidebarPreferences>}
 * @implements {OnDestroy}
 */
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
export class Sidebar extends PersistedPreferencesComponent<SidebarPreferences> implements OnDestroy {
  /**
   * Current ruleset tribes.
   *
   * @public
   * @type {readonly Tribe[]}
   */
  @Input()
  public tribes: readonly Tribe[] = [];

  /**
   * Tribe ids currently selected for drawing.
   *
   * @public
   * @type {string[]}
   */
  @Input()
  public drawTribes: string[] = [];

  /**
   * Simulation speed.
   *
   * @public
   * @type {number}
   */
  @Input()
  public speed = 10;

  /**
   * Whether max-speed mode is active.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public maxSpeed = false;

  /**
   * Whether recording is active.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public recording = false;

  /**
   * Whether the simulation is running.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public running = false;

  /**
   * Whether a stepping operation is active.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public stepping = false;

  /**
   * Whether the engine is applying backpressure.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public backpressure = false;

  /**
   * Whether the engine is rebuilding.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public rebuilding = false;

  /**
   * Grid column count.
   *
   * @public
   * @type {number}
   */
  @Input()
  public gridCols = 100;

  /**
   * Grid row count.
   *
   * @public
   * @type {number}
   */
  @Input()
  public gridRows = 100;

  /**
   * Simulation grid format.
   *
   * @public
   * @type {GridFormatMetadata}
   */
  @Input()
  public simulationGridFormat: GridFormatMetadata = {bitsPerCell: 8};

  /**
   * Latest engine metrics.
   *
   * @public
   * @type {(MetricMessage | null)}
   */
  @Input()
  public metrics: MetricMessage | null = null;

  /**
   * Whether live metrics are enabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public liveMetricsEnabled = true;

  /**
   * Live metrics section settings.
   *
   * @public
   * @type {LiveMetricSectionSettings}
   */
  @Input()
  public liveMetricSettings: LiveMetricSectionSettings = DEFAULT_LIVE_METRIC_SECTION_SETTINGS;

  /**
   * Whether the population metrics section is expanded.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public populationExpanded = true;

  /**
   * Whether the diversity metrics section is expanded.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public diversityExpanded = true;

  /**
   * Whether the interfaces metrics section is expanded.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public interfacesExpanded = true;

  /**
   * Whether recording chunks are being saved.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public chunksSaving = false;

  /**
   * Whether recording is available for the current grid.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public recordingAvailable = true;

  /**
   * Current frame byte size.
   *
   * @public
   * @type {number}
   */
  @Input()
  public frameByteSize = 0;

  /**
   * Whether delete drawing mode is active.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public deleteMode = false;

  /**
   * Whether touch pan mode is active.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public panMode = false;

  /**
   * Current ruleset.
   *
   * @public
   * @type {Ruleset}
   */
  @Input()
  public ruleset!: Ruleset;

  /**
   * Brush size in cells.
   *
   * @public
   * @type {number}
   */
  @Input()
  public brushSize = 1;

  /**
   * Brush shape.
   *
   * @public
   * @type {BrushShape}
   */
  @Input()
  public brushShape: BrushShape = 'square';

  /**
   * Brush fill mode.
   *
   * @public
   * @type {BrushFill}
   */
  @Input()
  public brushFill: BrushFill = 'full';

  /**
   * Current download progress percentage.
   *
   * @public
   * @type {number}
   */
  @Input()
  public downloadProgress = -1;

  /**
   * Main download status text.
   *
   * @public
   * @type {string}
   */
  @Input()
  public downloadMainStatus = '';

  /**
   * Whether download cancellation is pending.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public downloadCancelling = false;

  /**
   * Whether the download estimate exceeds the chunk threshold.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public downloadEstimateExceedsChunkThreshold = false;

  /**
   * Maximum available bytes for simulation storage.
   *
   * @public
   * @type {number}
   */
  @Input()
  public maxBytes = Infinity;

  /**
   * VRAM budget in bytes.
   *
   * @public
   * @type {number}
   */
  @Input()
  public vramBudgetBytes = Infinity;

  /**
   * Simulation VRAM usage in bytes.
   *
   * @public
   * @type {number}
   */
  @Input()
  public vramSimulationBytes = 0;

  /**
   * Recording VRAM usage in bytes.
   *
   * @public
   * @type {number}
   */
  @Input()
  public vramRecordingBytes = 0;

  /**
   * Pending raw storage bytes.
   *
   * @public
   * @type {number}
   */
  @Input()
  public storagePendingRawBytes = 0;

  /**
   * Compressed storage bytes.
   *
   * @public
   * @type {number}
   */
  @Input()
  public storageCompressedBytes = 0;

  /**
   * Storage quota in bytes.
   *
   * @public
   * @type {number}
   */
  @Input()
  public storageQuotaBytes = 0;

  /**
   * Whether snapshot saving is active.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public savingState = false;

  /**
   * Whether snapshot loading is active.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public loadingState = false;

  /**
   * Current snapshot progress bar mode.
   *
   * @public
   * @type {ProgressStatusMode}
   */
  @Input()
  public snapshotProgressMode: ProgressStatusMode = 'indeterminate';

  /**
   * Current snapshot progress percentage.
   *
   * @public
   * @type {(number | null)}
   */
  @Input()
  public snapshotProgressPercent: number | null = null;

  /**
   * Current snapshot progress status text.
   *
   * @public
   * @type {string}
   */
  @Input()
  public snapshotProgressStatus = '';

  /**
   * Sidebar event output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<SidebarEvent>}
   */
  @Output()
  public readonly sidebarEvent = new EventEmitter<SidebarEvent>();

  /**
   * Whether the sidebar is collapsed.
   *
   * @public
   * @type {boolean}
   */
  public collapsed = true;

  /**
   * Desktop sidebar width in CSS pixels.
   *
   * @public
   * @type {number}
   */
  public sidebarWidth = 300;

  /**
   * Mobile bottom sheet translate value.
   *
   * @public
   * @type {string}
   */
  public sheetTranslate = 'calc(100% - 0px)';

  /**
   * Whether the closed-state transition should be suppressed.
   *
   * @public
   * @type {boolean}
   */
  public suppressClosedTransition = false;

  /**
   * Default preferences.
   *
   * @protected
   * @readonly
   * @type {SidebarPreferences}
   */
  protected override readonly defaultPreferences: SidebarPreferences = DEFAULT_SIDEBAR_PREFERENCES;

  /**
   * Mobile layout media query.
   *
   * @private
   * @readonly
   * @type {(MediaQueryList | null)}
   */
  private readonly mobileLayoutQuery: MediaQueryList | null = null;

  /**
   * Controller for mobile layout listeners.
   *
   * @private
   * @readonly
   * @type {AbortController}
   */
  private readonly mobileLayoutListenerController = new AbortController();

  /**
   * Animation frame used to reset transition suppression.
   *
   * @private
   * @type {(number | null)}
   */
  private transitionResetFrame: number | null = null;

  /**
   * Cleanup animation frame used to reset transition suppression.
   *
   * @private
   * @type {(number | null)}
   */
  private transitionResetCleanupFrame: number | null = null;

  /**
   * Current generation shown in the playback section.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get generationCounter(): number {
    return this.metrics?.generation ?? 0;
  }

  /**
   * Whether a download is currently active.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get downloading(): boolean {
    return this.downloadProgress >= 0;
  }

  /**
   * Total VRAM usage shown in the sidebar section title.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get vramTitleSize(): string {
    return formatVramTitleSize(this.vramDisplayInput);
  }

  /**
   * Formatted detected VRAM budget.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get vramQuotaFormatted(): string {
    return formatVramQuota(this.vramDisplayInput);
  }

  /**
   * Recording data size shown in the Download section title.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get downloadStorageTitleSize(): string {
    return formatDownloadStorageTitleSize(this.storageDisplayInput);
  }

  /**
   * Recording quota shown in the Download section title.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get downloadStorageQuotaFormatted(): string {
    return formatDownloadStorageQuota(this.storageDisplayInput);
  }

  /**
   * Formatted simulation VRAM usage.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get vramSimulationFormatted(): string {
    return formatVramSimulation(this.vramDisplayInput);
  }

  /**
   * Formatted recording VRAM usage.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get vramRecordingFormatted(): string {
    return formatVramRecording(this.vramDisplayInput);
  }

  /**
   * Simulation VRAM bar percentage.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get vramSimulationPct(): number {
    return calculateVramSimulationPct(this.vramDisplayInput);
  }

  /**
   * Recording VRAM bar percentage.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get vramRecordingPct(): number {
    return calculateVramRecordingPct(this.vramDisplayInput);
  }

  /**
   * Tooltip for the VRAM usage bar.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get vramBarTooltip(): string {
    return createVramBarTooltip(this.vramDisplayInput);
  }

  /**
   * Total value used by the VRAM usage bar.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get vramBarTotal(): number {
    return calculateVramBarTotal(this.vramDisplayInput);
  }

  /**
   * VRAM usage bar segments.
   *
   * @public
   * @readonly
   * @type {StorageBarSegment[]}
   */
  public get vramSegments(): StorageBarSegment[] {
    return createVramSegments(this.vramDisplayInput);
  }

  /**
   * Maximum allowed brush size for the current grid.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get brushMaxSize(): number {
    return calculateBrushMaxSize(this.gridDisplayInput);
  }

  /**
   * VRAM display input.
   *
   * @private
   * @readonly
   * @type {SidebarVramDisplayInput}
   */
  private get vramDisplayInput(): SidebarVramDisplayInput {
    return {
      budgetBytes: this.vramBudgetBytes,
      simulationBytes: this.vramSimulationBytes,
      recordingBytes: this.vramRecordingBytes
    };
  }

  /**
   * Recording storage display input.
   *
   * @private
   * @readonly
   * @type {SidebarStorageDisplayInput}
   */
  private get storageDisplayInput(): SidebarStorageDisplayInput {
    return {
      pendingRawBytes: this.storagePendingRawBytes,
      compressedBytes: this.storageCompressedBytes,
      quotaBytes: this.storageQuotaBytes
    };
  }

  /**
   * Grid display input.
   *
   * @private
   * @readonly
   * @type {SidebarGridDisplayInput}
   */
  private get gridDisplayInput(): SidebarGridDisplayInput {
    return {
      cols: this.gridCols,
      rows: this.gridRows
    };
  }

  /**
   * @constructor
   * @public
   * @param {ElementRef} elRef sidebar host element.
   * @param {NgZone} zone Angular zone.
   * @param {ChangeDetectorRef} cdr change detector.
   */
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
  }

  /**
   * @inheritdoc
   */
  public ngOnDestroy(): void {
    this.mobileLayoutListenerController.abort();
    this.clearPendingTransitionReset();
  }

  /**
   * Toggles the sidebar open state.
   *
   * @public
   */
  public toggle(): void {
    this.clearPendingTransitionReset();
    this.suppressClosedTransition = false;
    this.collapsed = !this.collapsed;
    if (!this.collapsed) {
      this.sheetTranslate = '0px';
    }
  }

  /**
   * Emits a typed sidebar action.
   *
   * @public
   * @param {SidebarEvent} event sidebar event.
   */
  public emit(event: SidebarEvent): void {
    this.sidebarEvent.emit(event);
  }

  /**
   * Toggles one tribe in the draw selection.
   *
   * @public
   * @param {string} id tribe id.
   */
  public onTribeChange(id: string): void {
    this.emit({action: 'selectTribes', value: this.toggleTribeSelection(id)});
  }

  /**
   * Emits a speed change from a form value.
   *
   * @public
   * @param {string} value speed form value.
   */
  public onSpeedChange(value: string): void {
    const n = +value;
    if (n > 0) {
      this.emit({action: 'setSpeed', value: n});
    }
  }

  /**
   * Emits max-speed state changes.
   *
   * @public
   * @param {boolean} checked whether max speed is enabled.
   */
  public onMaxSpeedChange(checked: boolean): void {
    this.emit({action: 'setMaxSpeed', value: checked});
  }

  /**
   * Emits recording state changes.
   *
   * @public
   * @param {boolean} checked whether recording was requested.
   */
  public onRecordingChange(checked: boolean): void {
    this.emit({action: 'setRecording', value: checked && this.recordingAvailable});
  }

  /**
   * Emits live metrics enabled state changes.
   *
   * @public
   * @param {boolean} checked whether live metrics are enabled.
   */
  public onLiveMetricsEnabledChange(checked: boolean): void {
    this.emit({
      action: 'setLiveMetrics',
      value: {
        enabled: checked,
        sections: this.liveMetricSettings
      }
    });
  }

  /**
   * Emits live metric section settings changes.
   *
   * @public
   * @param {LiveMetricSectionSettings} settings metric section settings.
   */
  public onLiveMetricSettingsChange(settings: LiveMetricSectionSettings): void {
    this.emit({
      action: 'setLiveMetrics',
      value: {
        enabled: this.liveMetricsEnabled,
        sections: settings
      }
    });
  }

  /**
   * Emits an applied grid size.
   *
   * @public
   * @param {Grid} value grid size.
   */
  public onGridSizeApply(value: Grid): void {
    this.emit({action: 'setGridSize', value});
  }

  /**
   * Emits an applied grid packing value.
   *
   * @public
   * @param {BitsPerCell} value bits per cell.
   */
  public onPackingApply(value: BitsPerCell): void {
    this.emit({action: 'setPacking', value});
  }

  /**
   * Emits a clamped brush size change from a form value.
   *
   * @public
   * @param {string} value brush size form value.
   */
  public onBrushSizeChange(value: string): void {
    const n = Math.min(Math.max(1, +value || 1), this.brushMaxSize);
    if (n > 0) {
      this.emit({action: 'setBrushSize', value: n});
    }
  }

  /**
   * Emits a brush shape change.
   *
   * @public
   * @param {BrushShape} shape brush shape.
   */
  public onBrushShapeChange(shape: BrushShape): void {
    this.emit({action: 'setBrushShape', value: shape});
  }

  /**
   * Emits a brush fill change.
   *
   * @public
   * @param {BrushFill} fill brush fill.
   */
  public onBrushFillChange(fill: BrushFill): void {
    this.emit({action: 'setBrushFill', value: fill});
  }

  /**
   * Emits population section expansion changes.
   *
   * @public
   * @param {boolean} expanded whether the section is expanded.
   */
  public onPopulationExpandedChange(expanded: boolean): void {
    this.emit({action: 'setPopulationExpanded', value: expanded});
  }

  /**
   * Emits diversity section expansion changes.
   *
   * @public
   * @param {boolean} expanded whether the section is expanded.
   */
  public onDiversityExpandedChange(expanded: boolean): void {
    this.emit({action: 'setDiversityExpanded', value: expanded});
  }

  /**
   * Emits interfaces section expansion changes.
   *
   * @public
   * @param {boolean} expanded whether the section is expanded.
   */
  public onInterfacesExpandedChange(expanded: boolean): void {
    this.emit({action: 'setInterfacesExpanded', value: expanded});
  }

  /**
   * Emits touch interaction mode changes.
   *
   * @public
   * @param {TouchMode} mode touch mode.
   */
  public onTouchModeChange(mode: TouchMode): void {
    if ((mode === 'pan') !== this.panMode) {
      this.emit({action: 'togglePanMode'});
    }
  }

  /**
   * Emits a committed tribes update.
   *
   * @public
   * @param {UpdateTribesPayload} payload tribes update payload.
   */
  public applyTribes(payload: UpdateTribesPayload): void {
    this.emit({action: 'updateTribes', value: payload});
  }

  /**
   * Emits a selected preset.
   *
   * @public
   * @param {Preset} preset selected preset.
   */
  public applyPreset(preset: Preset): void {
    this.emit({action: 'applyPreset', value: preset});
  }

  /**
   * Emits a committed rules update.
   *
   * @public
   * @param {UpdateRulesPayload} payload rules update payload.
   */
  public applyRules(payload: UpdateRulesPayload): void {
    this.emit({action: 'updateRules', value: payload});
  }

  /**
   * Starts mobile bottom-sheet dragging.
   *
   * @public
   * @param {PointerEvent} event pointer event.
   */
  public onSheetDragStart(event: PointerEvent): void {
    const startY = event.clientY;
    const panel = this.elRef.nativeElement.querySelector('.sidebar-panel') as HTMLElement;
    const handle = event.currentTarget as HTMLElement | null;
    const panelHeight = panel.offsetHeight;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const currentTranslateY = panel.getBoundingClientRect().bottom - viewportHeight;
    startSidebarPointerDrag({
      event,
      handle,
      classTarget: panel,
      className: 'dragging',
      stopPropagation: false,
      onMove: e => {
        const dy = e.clientY - startY;
        const newTranslate = Math.max(0, currentTranslateY + dy);
        this.sheetTranslate = `${newTranslate}px`;
        this.cdr.detectChanges();
      },
      onEnd: e => {
        const dy = e.clientY - startY;
        const finalTranslate = Math.max(0, currentTranslateY + dy);
        if (finalTranslate > panelHeight * 0.5) {
          this.collapsed = true;
          this.sheetTranslate = '0px';
        } else {
          this.sheetTranslate = `${finalTranslate}px`;
        }
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Starts desktop sidebar resizing.
   *
   * @public
   * @param {PointerEvent} event pointer event.
   */
  public onResizeStart(event: PointerEvent): void {
    const startX = event.clientX;
    const startWidth = this.sidebarWidth;
    const handle = event.currentTarget as HTMLElement | null;
    const panel = this.elRef.nativeElement.querySelector('.sidebar-panel') as HTMLElement | null;
    startSidebarPointerDrag({
      event,
      handle,
      classTarget: panel,
      className: 'resizing',
      stopPropagation: true,
      onMove: e => {
        this.sidebarWidth = Math.max(300, Math.min(600, startWidth + e.clientX - startX));
        this.cdr.detectChanges();
      },
      onEnd: () => {
        this.savePreferences();
      }
    });
  }

  /**
   * Collects current preferences.
   *
   * @protected
   * @returns {SidebarPreferences}
   */
  protected override collectPreferences(): SidebarPreferences {
    return {
      sidebarWidth: this.sidebarWidth
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
      sidebarWidth: typeof stored.sidebarWidth === 'number' && stored.sidebarWidth >= 300 && stored.sidebarWidth <= 600 ? stored.sidebarWidth : defaults.sidebarWidth
    };
  }

  /**
   * Whether preferences should be saved.
   *
   * @protected
   * @returns {boolean}
   */
  protected override shouldSavePreferences(): boolean {
    return this.isDesktopLayout();
  }

  /**
   * Updates transition suppression when the responsive layout changes.
   *
   * @private
   */
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

  /**
   * Checks whether the sidebar is in desktop layout.
   *
   * @private
   * @returns {boolean} true when the desktop layout is active.
   */
  private isDesktopLayout(): boolean {
    return !this.mobileLayoutQuery?.matches;
  }

  /**
   * Cancels scheduled transition reset frames.
   *
   * @private
   */
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

  /**
   * Resolves the next draw tribe selection.
   *
   * @private
   * @param {string} id selected tribe id.
   * @returns {string[]} next selected tribe ids.
   */
  private toggleTribeSelection(id: string): string[] {
    let selection: string[];
    if (id === DEAD_TRIBE_ID) {
      selection = [DEAD_TRIBE_ID];
    } else if (this.drawTribes.length === 1 && this.drawTribes[0] === DEAD_TRIBE_ID) {
      selection = [id];
    } else {
      const current = this.drawTribes.filter(t => t !== DEAD_TRIBE_ID);
      const idx = current.indexOf(id);
      if (idx >= 0) {
        if (current.length > 1) {
          current.splice(idx, 1);
        }
        selection = current;
      } else {
        selection = [...current, id];
      }
    }
    return selection;
  }
}
