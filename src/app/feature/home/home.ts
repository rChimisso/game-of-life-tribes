import {ChangeDetectorRef, Component, OnDestroy, ViewChild} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSnackBar, MatSnackBarConfig, MatSnackBarModule} from '@angular/material/snack-bar';
import {RouterModule} from '@angular/router';

import {Engine} from './component/engine/engine';
import {Sidebar} from './component/sidebar/sidebar';
import {DownloadRequestPayload} from './model/download';
import {BRUSH_FILL_VALUES, BRUSH_SHAPE_VALUES, BrushFill, BrushShape} from './model/draw-mode';
import {GridFormatMetadata} from './model/grid-format';
import {DEFAULT_LIVE_METRIC_SECTION_SETTINGS, LiveMetricSectionSettings, LiveMetricsSettings} from './model/metrics';
import {DEFAULT_HOME_PREFERENCES, DEFAULT_METRICS_SECTION_PREFERENCES, DrawSectionPreferences, HomePreferences, MetricsSectionPreferences, SpeedSectionPreferences} from './model/preferences';
import {CONWAY_PRESET} from './model/preset';
import {DEAD_TRIBE_ID, Ruleset, Tribe} from './model/rule';
import {SidebarEvent} from './model/sidebar-event';
import {BackpressureMessage, ChunkSealedMessage, ChunksSavingMessage, DeviceLostMessage, GenerationMessage, GpuErrorMessage, LimitsMessage, MetricMessage, RebuildingMessage, RecordingMessage, SnapshotMessage, SteppingMessage, StorageQuotaMessage, UncompressedChunksMessage} from './model/worker-message';
import {buildGoltStateFile, parseGoltStateFile} from './util/golt-file';
import {fitsGridFormatInMaxBytes, gridFormatFromBits, gridFormatMetadata, isSupportedBitsPerCell, smallestValidSimulationGridFormat, validatePackingAgainstStateCount} from './util/grid-format';
import {normalizeLiveMetricSectionSettings} from './util/metric-settings';
import {applyRuleTribeRenames} from './util/tribe-impact';
import {PersistedPreferencesComponent} from '../../core/abstract/persisted-preferences-component';

/**
 * Home page component.
 *
 * @export
 * @class HomePage
 * @typedef {HomePage}
 * @implements {OnDestroy}
 */
@Component({
  selector: 'gol-home',
  standalone: true,
  imports: [
    RouterModule,
    Engine,
    Sidebar,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomePage extends PersistedPreferencesComponent<HomePreferences> implements OnDestroy {
  @ViewChild(Engine) public engine!: Engine<Tribe[]>;

  /**
   * Fixed-speed log message.
   *
   * @private
   * @readonly
   * @type {string}
   */
  private static readonly fixedSpeedLogMessage = '[GOLT] Fixed speed selected';

  public ruleset: Ruleset = CONWAY_PRESET.ruleset;

  public state: 'running' | 'paused' = 'paused';

  public speed = 1;

  public maxSpeed = false;

  public recording = false;

  public drawTribes: string[] = ['Alive'];

  public deleteMode = false;

  public panMode = false;

  public latestMetrics: MetricMessage | null = null;

  public liveMetricsEnabled = true;

  public liveMetricSettings: LiveMetricSectionSettings = DEFAULT_LIVE_METRIC_SECTION_SETTINGS;

  public populationExpanded = DEFAULT_METRICS_SECTION_PREFERENCES.populationExpanded;

  public diversityExpanded = DEFAULT_METRICS_SECTION_PREFERENCES.diversityExpanded;

  public interfacesExpanded = DEFAULT_METRICS_SECTION_PREFERENCES.interfacesExpanded;

  public liveMetrics: LiveMetricsSettings = {
    enabled: this.liveMetricsEnabled,
    sections: this.liveMetricSettings
  };

  public brushSize = 1;

  public brushShape: BrushShape = 'square';

  public brushFill: BrushFill = 'full';

  public downloadProgress = -1;

  public downloadSubProgress = -1;

  public downloadStatus = '';

  public downloadMainStatus = '';

  public maxBytes = Infinity;

  public vramBudgetBytes = Infinity;

  public frameByteSize = 0;

  public simulationGridFormat = gridFormatMetadata(smallestValidSimulationGridFormat(this.ruleset.tribes.length, this.ruleset));

  public vramSimulationBytes = 0;

  public vramRecordingBytes = 0;

  public recordingAvailable = true;

  public stepping = false;

  public chunksSaving = false;

  public backpressure = false;

  public rebuilding = false;

  public gpuErrorMessage: string | null = null;

  public storageUsedBytes = 0;

  public storageQuotaBytes = 0;

  public storagePendingRawBytes = 0;

  public storageCompressedBytes = 0;

  public savingState = false;

  public loadingState = false;

  private quotaWarningLevel: 0 | 25 | 50 | 75 | 100 = 0;

  private pendingStateLoad: {grid: Uint32Array; generation: number; gridFormat: GridFormatMetadata} | null = null;

  private compressPool: Worker[] = [];

  private compressPoolIndex = 0;

  private downloadWorker: Worker | null = null;

  private drawTribeIndex = 1;

  private pendingSnapshotResolve: ((snap: SnapshotMessage) => void) | null = null;

  private pendingRecordingResolve: ((rec: RecordingMessage) => void) | null = null;

  private readonly keydownListenerController = new AbortController();

  private wakeLock: WakeLockSentinel | null = null;

  private wakeLockRequestPending = false;

  /**
   * Default preferences.
   *
   * @protected
   * @readonly
   * @type {HomePreferences}
   */
  protected override readonly defaultPreferences: HomePreferences = DEFAULT_HOME_PREFERENCES;

  public get tribes(): readonly Tribe[] {
    return this.ruleset.tribes;
  }

  public get effectiveSpeed(): number {
    return this.maxSpeed ? -1 : this.speed;
  }

  public constructor(private readonly cdr: ChangeDetectorRef, private readonly snackBar: MatSnackBar) {
    super('golt-home-prefs');
    console.log('[GOLT] Home page initialized');
    this.restorePreferences();
    document.addEventListener('keydown', ev => this.handleKeydown(ev), {
      capture: true,
      signal: this.keydownListenerController.signal
    });
    document.addEventListener('visibilitychange', () => this.onVisibilityChange(), {
      signal: this.keydownListenerController.signal
    });
  }

  public ngOnDestroy(): void {
    console.log('[GOLT] Home page destroyed');
    this.keydownListenerController.abort();
    this.terminateCompressWorker();
    this.releaseWakeLock();
  }

  public onMetrics(data: MetricMessage): void {
    this.latestMetrics = data;
    this.cdr.markForCheck();
  }

  public onGeneration(data: GenerationMessage): void {
    if (this.latestMetrics) {
      this.latestMetrics = {
        ...this.latestMetrics,
        generation: data.generation,
        fps: data.fps
      };
    } else {
      this.latestMetrics = {
        type: 'metrics',
        generation: data.generation,
        population: {},
        aliveCells: 0,
        deadCells: 0,
        occupancy: 0,
        shannonEntropy: 0,
        simpsonIndex: 0,
        metricsAvailability: {
          population: this.liveMetricsEnabled && this.liveMetricSettings.population ? 'ok' : 'disabled',
          diversity: this.liveMetricsEnabled && this.liveMetricSettings.diversity ? 'ok' : 'disabled',
          interfaces: this.liveMetricsEnabled && this.liveMetricSettings.interfaces ? 'ok' : 'disabled'
        },
        extinctionTime: {},
        totalFrames: 0,
        fps: data.fps,
        canStepBack: false,
        recordingBytes: 0,
        recordingRawBytes: 0
      };
    }
    this.cdr.markForCheck();
  }

  public onLimits(data: LimitsMessage): void {
    this.maxBytes = data.maxBytes;
    this.vramBudgetBytes = data.vramBudgetBytes;
    this.frameByteSize = data.frameByteSize;
    if (data.gridFormat.bitsPerCell !== this.simulationGridFormat.bitsPerCell) {
      this.simulationGridFormat = data.gridFormat;
    }
    this.vramSimulationBytes = data.vramSimulationBytes;
    this.vramRecordingBytes = data.vramRecordingBytes;
    this.recordingAvailable = data.recordingAvailable;
    if (!data.recordingAvailable && this.recording) {
      this.recording = false;
      this.savePreferences();
    }
    this.cdr.markForCheck();
  }

  public onStepping(data: SteppingMessage): void {
    this.stepping = data.active;
    this.cdr.markForCheck();
  }

  public onChunksSaving(data: ChunksSavingMessage): void {
    this.chunksSaving = data.active;
    this.cdr.markForCheck();
  }

  public onBackpressure(data: BackpressureMessage): void {
    this.backpressure = data.active;
    this.cdr.markForCheck();
  }

  public onRebuilding(data: RebuildingMessage): void {
    console.log(`[GOLT] Engine rebuild ${data.active ? 'started' : 'completed'}`);
    this.rebuilding = data.active;
    if (!data.active) {
      this.gpuErrorMessage = null;
      if (this.pendingStateLoad) {
        const {grid, generation, gridFormat} = this.pendingStateLoad;
        this.pendingStateLoad = null;
        this.engine.loadSnapshot(grid, generation, gridFormat);
        this.latestMetrics = null;
      }
    }
    this.cdr.markForCheck();
  }

  public onDeviceLost(data: DeviceLostMessage): void {
    console.error('[GOLT] GPU device lost:', data.reason);
    this.setRunState('paused');
    this.gpuErrorMessage = `GPU device lost: ${data.reason}`;
    this.openSnack('GPU device lost — simulation stopped. Try resetting to a smaller grid or reloading the page.', 'error', 0);
    this.cdr.markForCheck();
  }

  public onGpuError(data: GpuErrorMessage): void {
    console.error('[GOLT] GPU error:', data.reason);
    this.setRunState('paused');
    this.gpuErrorMessage = data.reason;
    this.openSnack(`GPU error: ${data.reason}`, 'error', 0);
    this.openSnack(`GPU error: ${data.reason}`, 'error', 0);
    this.cdr.markForCheck();
  }

  public onStorageQuota(data: StorageQuotaMessage): void {
    this.storageUsedBytes = data.usedBytes;
    this.storageQuotaBytes = data.quotaBytes;
    this.storagePendingRawBytes = data.pendingRawBytes;
    this.storageCompressedBytes = data.compressedBytes;
    if (data.quotaBytes <= 0) {
      return;
    }
    // Mixed byte formats: used in decimal GB, quota in binary GiB.
    // Include GPU buffer margin (worst-case data in flight not yet on disk).
    const effectiveUsed = data.usedBytes + data.gpuBufferMarginBytes;
    const usedDecimalGiga = effectiveUsed / 1e9;
    const quotaBinaryGiga = data.quotaBytes / (1024 ** 3);
    const pct = quotaBinaryGiga > 0 ? (usedDecimalGiga / quotaBinaryGiga) * 100 : 0;
    let level: 0 | 25 | 50 | 75 | 100 = 0;
    switch (true) {
      case pct >= 100:
        level = 100;
        break;
      case pct >= 75:
        level = 75;
        break;
      case pct >= 50:
        level = 50;
        break;
      case pct >= 25:
        level = 25;
        break;
    }
    if (level > this.quotaWarningLevel) {
      this.quotaWarningLevel = level;
      const compHint = this.storagePendingRawBytes > 0 ? ' (compression in progress — size may decrease)' : '';
      const alreadyPaused = this.state === 'paused' && !this.stepping;
      if (level === 25) {
        this.openSnack(`Recording storage at 25% capacity${compHint}`, 'info', 0);
      } else if (level === 50) {
        this.openSnack(`Recording storage at 50% capacity${compHint}`, 'warning', 0);
      } else if (level === 75) {
        const pauseHint = alreadyPaused ? '' : ' — simulation paused to preserve data';
        this.openSnack(`Recording storage at 75%${pauseHint}${compHint}`, 'warning', 0);
        if (this.stepping) {
          this.cancelStepping();
        }
        this.setRunState('paused');
      } else if (level === 100) {
        this.openSnack(`Storage full — recording disabled. Save your data, then reset.${compHint}`, 'error', 0);
        if (this.stepping) {
          this.cancelStepping();
        }
        this.setRunState('paused');
        if (this.recording) {
          this.recording = false;
          this.savePreferences();
        }
      }
    } else if (level < this.quotaWarningLevel) {
      this.quotaWarningLevel = level;
      this.snackBar.dismiss();
    }
    this.cdr.markForCheck();
  }

  public onChunkSealed(data: ChunkSealedMessage): void {
    if (this.compressPool.length === 0) {
      this.initCompressPool();
    }
    const worker = this.compressPool[this.compressPoolIndex % this.compressPool.length]!;
    this.compressPoolIndex++;
    worker.postMessage({
      type: 'compress',
      filename: data.filename,
      rawBytes: data.rawBytes,
      blockCount: data.blockCount,
      cols: data.cols,
      rows: data.rows,
      rawGridFormat: data.rawGridFormat,
      storageGridFormat: data.storageGridFormat
    });
  }

  public onUncompressedChunks(data: UncompressedChunksMessage): void {
    for (const chunk of data.chunks) {
      this.onChunkSealed({type: 'chunkSealed', ...chunk});
    }
  }

  public onSnapshot(snap: SnapshotMessage): void {
    if (this.pendingSnapshotResolve) {
      this.pendingSnapshotResolve(snap);
      this.pendingSnapshotResolve = null;
    } else {
      this.saveGoltState(snap).finally(() => {
        this.savingState = false;
        this.cdr.markForCheck();
      });
    }
  }

  public onRecording(rec: RecordingMessage): void {
    if (this.pendingRecordingResolve) {
      this.pendingRecordingResolve(rec);
      this.pendingRecordingResolve = null;
    }
  }

  public onSidebarEvent(ev: SidebarEvent): void {
    let shouldSavePreferences = false;

    switch (ev.action) {
      case 'toggleRun':
        this.toggleRun();
        break;
      case 'restart':
        this.restart();
        break;
      case 'selectTribe':
        this.deleteMode = false;
        this.drawTribes = [ev.value];
        this.drawTribeIndex = this.tribes.findIndex(t => t.id === ev.value);
        break;
      case 'selectTribes':
        this.drawTribes = ev.value;
        this.deleteMode = this.drawTribes.length === 1 && this.drawTribes[0] === DEAD_TRIBE_ID;
        if (!this.deleteMode && this.drawTribes.length === 1) {
          this.drawTribeIndex = this.tribes.findIndex(t => t.id === this.drawTribes[0]);
        }
        break;
      case 'setSpeed':
        this.speed = ev.value;
        this.maxSpeed = false;
        console.log(HomePage.fixedSpeedLogMessage, {speed: this.speed});
        shouldSavePreferences = true;
        break;
      case 'setMaxSpeed':
        this.maxSpeed = ev.value;
        console.log(`[GOLT] Max speed ${this.toggleStateLabel(this.maxSpeed)}`);
        shouldSavePreferences = true;
        break;
      case 'setRecording':
        this.recording = ev.value;
        console.log(`[GOLT] Recording ${this.toggleStateLabel(this.recording)}`);
        if (this.recording && this.compressPool.length === 0) {
          this.initCompressPool();
        }
        shouldSavePreferences = true;
        break;
      case 'setLiveMetrics': {
        const next = ev.value;
        this.liveMetricsEnabled = next.enabled;
        this.liveMetricSettings = normalizeLiveMetricSectionSettings(next.sections);
        console.log(`[GOLT] Live metrics ${this.toggleStateLabel(this.liveMetricsEnabled)}`, {
          sections: this.liveMetricSettings
        });
        this.syncLiveMetrics();
        shouldSavePreferences = true;
        break;
      }
      case 'setPopulationExpanded':
        this.populationExpanded = ev.value;
        shouldSavePreferences = true;
        break;
      case 'setDiversityExpanded':
        this.diversityExpanded = ev.value;
        shouldSavePreferences = true;
        break;
      case 'setInterfacesExpanded':
        this.interfacesExpanded = ev.value;
        shouldSavePreferences = true;
        break;
      case 'setGridSize': {
        const {cols, rows} = ev.value;
        this.rebuilding = true;
        this.simulationGridFormat = this.resolveSimulationGridFormat(this.simulationGridFormat, this.ruleset, cols, rows);
        this.ruleset = {
          ...this.ruleset,
          cols,
          rows
        };
        this.latestMetrics = null;
        shouldSavePreferences = this.clampBrushSize();
        break;
      }
      case 'setPacking': {
        this.rebuilding = true;
        this.simulationGridFormat = this.resolveSimulationGridFormat({bitsPerCell: ev.value});
        this.latestMetrics = null;
        break;
      }
      case 'download':
        this.downloadZip(ev.value);
        break;
      case 'cancelDownload':
        this.cancelDownload();
        break;
      case 'saveState':
        this.savingState = true;
        this.cdr.markForCheck();
        this.engine.requestSnapshot();
        break;
      case 'loadState':
        this.loadState(ev.value);
        break;
      case 'deleteMode':
        this.deleteMode = !this.deleteMode;
        if (this.deleteMode) {
          this.drawTribes = [DEAD_TRIBE_ID];
        } else {
          this.drawTribes = [this.tribes[this.drawTribeIndex]!.id];
        }
        break;
      case 'updateTribes': {
        const update = ev.value;
        const renamedRules = applyRuleTribeRenames(this.ruleset.rules, update.renamePairs);
        shouldSavePreferences = this.applyCommittedRuleset({
          ...this.ruleset,
          tribes: update.tribes,
          rules: renamedRules
        });
        break;
      }
      case 'updateRules': {
        const update = ev.value;
        shouldSavePreferences = this.applyCommittedRuleset({
          ...this.ruleset,
          rules: update.rules
        });
        break;
      }
      case 'stepBack':
        this.engine.stepBack(ev.value);
        break;
      case 'stepForward':
        this.engine.stepForward(ev.value);
        break;
      case 'togglePanMode':
        this.panMode = !this.panMode;
        break;
      case 'setBrushSize':
        this.brushSize = ev.value;
        shouldSavePreferences = true;
        break;
      case 'setBrushShape':
        this.brushShape = ev.value;
        shouldSavePreferences = true;
        break;
      case 'setBrushFill':
        this.brushFill = ev.value;
        shouldSavePreferences = true;
        break;
      case 'applyPreset': {
        const preset = ev.value;
        const newRuleset = structuredClone(preset.ruleset);
        newRuleset.cols = this.ruleset.cols;
        newRuleset.rows = this.ruleset.rows;
        shouldSavePreferences = this.applyCommittedRuleset(newRuleset, true);
        break;
      }
    }

    if (shouldSavePreferences) {
      this.savePreferences();
    }
  }

  /**
   * Collects current preferences.
   *
   * @protected
   * @returns {HomePreferences}
   */
  protected override collectPreferences(): HomePreferences {
    return {
      draw: {
        brushSize: this.brushSize,
        brushShape: this.brushShape,
        brushFill: this.brushFill
      },
      speed: {
        speed: this.speed,
        maxSpeed: this.maxSpeed,
        recording: this.recording,
        liveMetricsEnabled: this.liveMetricsEnabled
      },
      metrics: {
        liveMetricSettings: {...this.liveMetricSettings},
        populationExpanded: this.populationExpanded,
        diversityExpanded: this.diversityExpanded,
        interfacesExpanded: this.interfacesExpanded
      }
    };
  }

  /**
   * Applies restored preferences.
   *
   * @protected
   * @param {HomePreferences} preferences
   */
  protected override applyPreferences(preferences: HomePreferences): void {
    this.brushSize = preferences.draw.brushSize;
    this.brushShape = preferences.draw.brushShape;
    this.brushFill = preferences.draw.brushFill;
    this.speed = preferences.speed.speed;
    this.maxSpeed = preferences.speed.maxSpeed;
    this.recording = preferences.speed.recording;
    this.liveMetricsEnabled = preferences.speed.liveMetricsEnabled;
    this.liveMetricSettings = {...preferences.metrics.liveMetricSettings};
    this.populationExpanded = preferences.metrics.populationExpanded;
    this.diversityExpanded = preferences.metrics.diversityExpanded;
    this.interfacesExpanded = preferences.metrics.interfacesExpanded;
    this.clampBrushSize();
    this.syncLiveMetrics();
  }

  /**
   * Normalizes stored preferences.
   *
   * @protected
   * @param {Partial<HomePreferences>} stored
   * @param {HomePreferences} defaults
   * @returns {HomePreferences}
   */
  protected override normalizePreferences(stored: Partial<HomePreferences>, defaults: HomePreferences): HomePreferences {
    return {
      draw: this.normalizeDrawSectionPreferences(stored.draw, defaults.draw),
      speed: this.normalizeSpeedSectionPreferences(stored.speed, defaults.speed),
      metrics: this.normalizeMetricsSectionPreferences(stored.metrics, defaults.metrics)
    };
  }

  private applyCommittedRuleset(newRuleset: Ruleset, preferSmallestFormat = false): boolean {
    this.rebuilding = true;
    this.simulationGridFormat = preferSmallestFormat ?
      this.smallestSimulationGridFormatForRuleset(newRuleset) :
      this.resolveSimulationGridFormat(this.simulationGridFormat, newRuleset);
    this.ruleset = newRuleset;
    if (!newRuleset.tribes.some(t => this.drawTribes.includes(t.id))) {
      this.drawTribes = [newRuleset.tribes.find(t => t.id !== DEAD_TRIBE_ID)?.id ?? DEAD_TRIBE_ID];
    }
    this.drawTribeIndex = newRuleset.tribes.findIndex(t => t.id === this.drawTribes[0]);
    this.latestMetrics = null;
    return this.clampBrushSize();
  }

  private handleKeydown(ev: KeyboardEvent): void {
    if (this.downloadProgress >= 0) {
      return;
    }
    // While stepping, only allow spacebar (to cancel the step).
    if (this.stepping) {
      if (ev.key === ' ') {
        this.cancelStepping();
        ev.preventDefault();
        ev.stopPropagation();
        (document.activeElement as HTMLElement)?.blur?.();
        this.cdr.markForCheck();
      }
      return;
    }
    if (this.activeElementBlocksShortcut(document.activeElement)) {
      return;
    }
    let shortcut = this.handlePlaybackShortcut(ev.key);
    if (!shortcut.handled) {
      shortcut = this.handleSelectionShortcut(ev.key);
    }
    if (!shortcut.handled) {
      shortcut = this.handleBrushShortcut(ev.key);
    }
    if (shortcut.handled) {
      if (shortcut.shouldSavePreferences) {
        this.savePreferences();
      }
      ev.preventDefault();
      ev.stopPropagation();
      (document.activeElement as HTMLElement)?.blur?.();
      this.cdr.markForCheck();
    }
  }

  private handlePlaybackShortcut(key: string): {handled: boolean; shouldSavePreferences: boolean} {
    switch (key) {
      case ' ':
        this.toggleRun();
        return {handled: true, shouldSavePreferences: false};
      case 'r':
        this.restart();
        return {handled: true, shouldSavePreferences: false};
      case 'e':
        if (this.recordingAvailable) {
          this.recording = !this.recording;
          console.log(`[GOLT] Recording ${this.toggleStateLabel(this.recording)}`);
          if (this.recording && this.compressPool.length === 0) {
            this.initCompressPool();
          }
          return {handled: true, shouldSavePreferences: true};
        }
        return {handled: true, shouldSavePreferences: false};
      case 'm':
        this.maxSpeed = !this.maxSpeed;
        console.log(`[GOLT] Max speed ${this.toggleStateLabel(this.maxSpeed)}`);
        return {handled: true, shouldSavePreferences: true};
      case 'w':
        this.liveMetricsEnabled = !this.liveMetricsEnabled;
        console.log(`[GOLT] Live metrics ${this.toggleStateLabel(this.liveMetricsEnabled)}`, {
          sections: this.liveMetricSettings
        });
        this.syncLiveMetrics();
        return {handled: true, shouldSavePreferences: true};
      default:
        return {handled: false, shouldSavePreferences: false};
    }
  }

  private handleSelectionShortcut(key: string): {handled: boolean; shouldSavePreferences: boolean} {
    switch (key) {
      case 'ArrowUp':
        this.speed += 1;
        this.maxSpeed = false;
        console.log(HomePage.fixedSpeedLogMessage, {speed: this.speed});
        return {handled: true, shouldSavePreferences: true};
      case 'ArrowDown':
        this.speed = Math.max(1, this.speed - 1);
        console.log(HomePage.fixedSpeedLogMessage, {speed: this.speed});
        return {handled: true, shouldSavePreferences: true};
      case 'ArrowRight':
        this.drawTribeIndex = (this.drawTribeIndex + 1) % this.tribes.length;
        if (this.drawTribeIndex === 0) {
          this.drawTribeIndex = 1;
        }
        this.drawTribes = [this.tribes[this.drawTribeIndex]!.id];
        this.deleteMode = false;
        return {handled: true, shouldSavePreferences: false};
      case 'ArrowLeft':
        this.drawTribeIndex -= 1;
        if (this.drawTribeIndex <= 0) {
          this.drawTribeIndex = this.tribes.length - 1;
        }
        this.drawTribes = [this.tribes[this.drawTribeIndex]!.id];
        this.deleteMode = false;
        return {handled: true, shouldSavePreferences: false};
      case 'd':
        this.deleteMode = !this.deleteMode;
        if (this.deleteMode) {
          this.drawTribes = [DEAD_TRIBE_ID];
        } else {
          this.drawTribes = [this.tribes[this.drawTribeIndex]!.id];
        }
        return {handled: true, shouldSavePreferences: false};
      default:
        return {handled: false, shouldSavePreferences: false};
    }
  }

  private handleBrushShortcut(key: string): {handled: boolean; shouldSavePreferences: boolean} {
    switch (key) {
      case '+': {
        const max = Math.max(1, Math.floor(Math.min(this.ruleset.cols, this.ruleset.rows) / 4));
        this.brushSize = Math.min(max, this.brushSize + 1);
        return {handled: true, shouldSavePreferences: true};
      }
      case '-':
        this.brushSize = Math.max(1, this.brushSize - 1);
        return {handled: true, shouldSavePreferences: true};
      case 'b': {
        const idx = BRUSH_SHAPE_VALUES.indexOf(this.brushShape);
        this.brushShape = BRUSH_SHAPE_VALUES[(idx + 1) % BRUSH_SHAPE_VALUES.length]!;
        return {handled: true, shouldSavePreferences: true};
      }
      case 'f': {
        const idx = BRUSH_FILL_VALUES.indexOf(this.brushFill);
        this.brushFill = BRUSH_FILL_VALUES[(idx + 1) % BRUSH_FILL_VALUES.length]!;
        return {handled: true, shouldSavePreferences: true};
      }
      default:
        return {handled: false, shouldSavePreferences: false};
    }
  }

  private activeElementBlocksShortcut(active: Element | null): boolean {
    if (active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) {
      return true;
    }
    if (active instanceof HTMLInputElement) {
      const t = active.type;
      return t !== 'checkbox' && t !== 'radio';
    }
    return false;
  }

  private toggleRun(): void {
    if (this.stepping) {
      this.cancelStepping();
      return;
    }
    this.setRunState(this.state === 'paused' ? 'running' : 'paused');
  }

  private cancelStepping(): void {
    this.engine.cancelStepping();
  }

  private setRunState(state: 'running' | 'paused'): void {
    if (this.state !== state) {
      console.log(`[GOLT] Simulation ${state}`);
    }
    this.state = state;
    this.syncWakeLock();
  }

  private syncWakeLock(): void {
    if (this.state === 'running' && document.visibilityState === 'visible') {
      this.requestWakeLock();
    } else {
      this.releaseWakeLock();
    }
  }

  private requestWakeLock(): void {
    if (this.wakeLock || this.wakeLockRequestPending || document.visibilityState !== 'visible') {
      return;
    }
    if (!('wakeLock' in navigator)) {
      console.warn('[GOLT] Screen Wake Lock API is unavailable');
      return;
    }
    this.wakeLockRequestPending = true;
    navigator.wakeLock.request('screen').then(lock => {
      if (this.state !== 'running' || document.visibilityState !== 'visible') {
        lock.release().catch(error => console.warn('Failed to release unused wake lock:', error));
        return;
      }
      this.wakeLock = lock;
      console.log('[GOLT] Screen wake lock acquired');
      lock.addEventListener('release', () => {
        if (this.wakeLock === lock) {
          console.log('[GOLT] Screen wake lock released by browser');
          this.wakeLock = null;
          this.syncWakeLock();
        }
      });
    }).catch(error => console.warn('Failed to request screen wake lock:', error))
      .finally(() => {
        this.wakeLockRequestPending = false;
      });
  }

  private releaseWakeLock(): void {
    const lock = this.wakeLock;
    this.wakeLock = null;
    if (!lock) {
      return;
    }
    console.log('[GOLT] Screen wake lock released');
    lock.release().catch(error => console.warn('Failed to release screen wake lock:', error));
  }

  private onVisibilityChange(): void {
    this.syncWakeLock();
  }

  private currentMaxBytes(): number {
    return this.maxBytes > 0 ? this.maxBytes : Number.POSITIVE_INFINITY;
  }

  private smallestSimulationGridFormatForRuleset(ruleset: Ruleset = this.ruleset, cols = ruleset.cols, rows = ruleset.rows): GridFormatMetadata {
    return gridFormatMetadata(smallestValidSimulationGridFormat(ruleset.tribes.length, {cols, rows}, this.currentMaxBytes()));
  }

  private resolveSimulationGridFormat(preferred: GridFormatMetadata | null | undefined, ruleset: Ruleset = this.ruleset, cols = ruleset.cols, rows = ruleset.rows): GridFormatMetadata {
    if (preferred?.bitsPerCell !== undefined && isSupportedBitsPerCell(preferred.bitsPerCell) &&
        validatePackingAgainstStateCount(preferred.bitsPerCell, ruleset.tribes.length) &&
        fitsGridFormatInMaxBytes({cols, rows}, gridFormatFromBits(preferred.bitsPerCell), this.currentMaxBytes())) {
      return gridFormatMetadata(gridFormatFromBits(preferred.bitsPerCell));
    }
    return this.smallestSimulationGridFormatForRuleset(ruleset, cols, rows);
  }

  private terminateCompressWorker(): void {
    for (const w of this.compressPool) {
      w.terminate();
    }
    this.compressPool = [];
    this.compressPoolIndex = 0;
  }

  private async pauseCompressionPool(): Promise<void> {
    if (this.compressPool.length === 0) {
      return;
    }
    await Promise.all(this.compressPool.map(worker => new Promise<void>(resolve => {
      const onMessage = (ev: MessageEvent) => {
        if (ev.data?.type === 'compressionPaused') {
          worker.removeEventListener('message', onMessage);
          resolve();
        }
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({type: 'pauseCompression'});
    })));
  }

  private resumeCompressionPool(): void {
    for (const worker of this.compressPool) {
      worker.postMessage({type: 'resumeCompression'});
    }
  }

  /**
   * Formats a boolean toggle state for logs.
   *
   * @private
   * @param {boolean} enabled
   * @returns {string}
   */
  private toggleStateLabel(enabled: boolean): string {
    return enabled ? 'enabled' : 'disabled';
  }

  private syncLiveMetrics(): void {
    this.liveMetrics = {
      enabled: this.liveMetricsEnabled,
      sections: this.liveMetricSettings
    };
  }

  private initCompressPool(): void {
    const poolSize = Math.max(1, (navigator.hardwareConcurrency ?? 4) - 2);
    for (let i = 0; i < poolSize; i++) {
      const w = new Worker(new URL('./worker/compress.ts', import.meta.url), {type: 'module'});
      w.onmessage = (ev: MessageEvent) => {
        if (ev.data?.type === 'compressed') {
          this.engine.updateChunkCodec(ev.data.filename, ev.data.codec, ev.data.storedBytes, ev.data.gridFormat);
        }
      };
      this.compressPool.push(w);
    }
  }

  private cancelDownload(): void {
    console.log('[GOLT] Download cancelled');
    if (this.downloadWorker) {
      this.downloadWorker.terminate();
      this.downloadWorker = null;
    }
    this.resumeCompressionPool();
    this.downloadProgress = -1;
    this.downloadSubProgress = -1;
    this.downloadStatus = '';
    this.downloadMainStatus = '';
    this.cdr.markForCheck();

    // Resume background compression for any remaining raw-packed chunks.
    this.engine.requestUncompressedChunks();
  }

  private restart(): void {
    console.log('[GOLT] Restart requested');
    this.snackBar.dismiss();
    this.setRunState('paused');
    this.terminateCompressWorker();
    this.storagePendingRawBytes = 0;
    this.storageCompressedBytes = 0;
    this.storageUsedBytes = 0;
    this.quotaWarningLevel = 0;
    this.rebuilding = true;
    this.ruleset = {...this.ruleset};
    this.latestMetrics = null;
  }

  private openSnack(message: string, tone: 'info' | 'warning' | 'error', duration: number): void {
    const config: MatSnackBarConfig = {
      panelClass: `snackbar-${tone}`
    };
    if (duration > 0) {
      config.duration = duration;
    }
    this.snackBar.open(message, 'Dismiss', config);
  }

  private clampBrushSize(): boolean {
    const max = Math.max(1, Math.floor(Math.min(this.ruleset.cols, this.ruleset.rows) / 4));
    const nextBrushSize = Math.min(this.brushSize, max);
    const changed = nextBrushSize !== this.brushSize;
    this.brushSize = nextBrushSize;
    return changed;
  }

  private downloadZip(opts: DownloadRequestPayload): void {
    const needFrames = opts.mp4 || opts.png || opts.metrics || opts.saves;
    console.log('[GOLT] Download started', {
      metrics: opts.metrics,
      mp4: opts.mp4,
      png: opts.png,
      saves: opts.saves,
      frameRange: opts.frameRange
    });

    // Pause the simulation so the download captures a consistent state.
    if (this.state === 'running') {
      this.setRunState('paused');
      this.engine.setRunning(false);
    }

    this.downloadProgress = 0;
    this.downloadSubProgress = -1;
    this.downloadMainStatus = 'Waiting for compression jobs to finish';
    this.downloadStatus = '';
    this.cdr.markForCheck();

    this.pauseCompressionPool().then(() => {
      const snapshotP = new Promise<SnapshotMessage>(resolve => {
        this.pendingSnapshotResolve = resolve;
        this.engine.requestSnapshot();
      });

      const framesP = needFrames ?
        new Promise<RecordingMessage>(resolve => {
          this.pendingRecordingResolve = resolve;
          this.engine.requestRecording();
        }) :
        Promise.resolve(null);

      Promise.all([snapshotP, framesP]).then(([snap, rec]) => {
        const worker = new Worker(new URL('./worker/download.ts', import.meta.url), {type: 'module'});
        this.downloadWorker = worker;

        const cleanupDownload = () => {
          console.log('[GOLT] Download worker cleaned up');
          this.downloadProgress = -1;
          this.downloadSubProgress = -1;
          this.downloadStatus = '';
          this.downloadMainStatus = '';
          this.downloadWorker = null;
          this.cdr.markForCheck();
          worker.terminate();
          this.resumeCompressionPool();
          this.engine.requestUncompressedChunks();
        };

        worker.onerror = () => {
          console.error('[GOLT] Download worker failed unexpectedly');
          this.openSnack('Download failed unexpectedly. Try again.', 'error', 0);
          cleanupDownload();
        };

        worker.onmessage = (e: MessageEvent) => {
          if (e.data.type === 'progress') {
            this.downloadProgress = e.data.percent;
            this.downloadMainStatus = e.data.status ?? '';
            this.cdr.markForCheck();
          } else if (e.data.type === 'sub-progress') {
            this.downloadSubProgress = e.data.percent;
            this.downloadStatus = e.data.status ?? '';
            this.cdr.markForCheck();
          } else if (e.data.type === 'done-part') {
            console.log('[GOLT] Download part ready:', e.data.filename);
            this.downloadBlob(new Blob([e.data.buffer]), e.data.filename);
          } else if (e.data.type === 'error') {
            const reason = e.data.reason ?? 'Unknown error';
            console.error('[GOLT] Download error:', reason);
            const suggestion = typeof reason === 'string' && reason.includes('Array buffer allocation failed') ? ' Try downloading fewer frames or fewer output selections.' : '';
            this.openSnack(`Download error: ${reason}${suggestion}`, 'error', 0);
            cleanupDownload();
          } else if (e.data.type === 'done') {
            console.log('[GOLT] Download completed');
            cleanupDownload();
          }
        };
        const gridBuf = snap.grid;
        const hasChunks = rec && rec.manifest.chunks.length > 0;
        const transferables: ArrayBuffer[] = [];
        if (gridBuf?.buffer?.byteLength > 0) {
          transferables.push(gridBuf.buffer);
        }
        worker.postMessage({
          type: 'download',
          opts,
          snapshot: {
            generation: snap.generation,
            cols: snap.cols,
            rows: snap.rows,
            grid: gridBuf,
            gridFormat: snap.gridFormat
          },
          recording: hasChunks ? {
            manifest: rec.manifest,
            cols: rec.cols,
            rows: rec.rows
          } : null,
          tribes: this.tribes.map(t => ({id: t.id, color: t.color})),
          rules: this.ruleset.rules,
          metricsHistory: []
        }, transferables);
      });
    }).catch(() => {
      console.error('[GOLT] Download preparation failed while waiting for compression data');
      this.openSnack('Download failed while preparing compression data. Try again.', 'error', 0);
      this.resumeCompressionPool();
      this.downloadProgress = -1;
      this.downloadSubProgress = -1;
      this.downloadStatus = '';
      this.downloadMainStatus = '';
      this.cdr.markForCheck();
    });
  }

  private async loadState(buffer: ArrayBuffer): Promise<void> {
    this.loadingState = true;
    this.cdr.markForCheck();
    try {
      const parsed = await this.parseGoltFile(buffer);
      if (!parsed) {
        return;
      }
      const {cols, rows, generation, grid, gridFormat} = parsed;
      const nextSimulationGridFormat = this.smallestSimulationGridFormatForRuleset(this.ruleset, cols, rows);
      const needsRebuild = cols !== this.ruleset.cols || rows !== this.ruleset.rows ||
        nextSimulationGridFormat.bitsPerCell !== this.simulationGridFormat.bitsPerCell;
      if (needsRebuild) {
        this.rebuilding = true;
        this.pendingStateLoad = {
          grid,
          generation,
          gridFormat
        };
        this.simulationGridFormat = nextSimulationGridFormat;
        if (cols !== this.ruleset.cols || rows !== this.ruleset.rows) {
          this.ruleset = {
            ...this.ruleset,
            cols,
            rows
          };
        }
        if (this.clampBrushSize()) {
          this.savePreferences();
        }
      } else {
        this.engine.loadSnapshot(grid, generation, gridFormat);
        this.latestMetrics = null;
      }
    } finally {
      this.loadingState = false;
      this.cdr.markForCheck();
    }
  }

  private async saveGoltState(snap: SnapshotMessage): Promise<void> {
    const blob = await this.buildGoltFile(snap);
    this.downloadBlob(blob, `gol-state-gen${snap.generation}.golt`);
  }

  private async buildGoltFile(snap: SnapshotMessage): Promise<Blob> {
    const file = await buildGoltStateFile({
      generation: snap.generation,
      cols: snap.cols,
      rows: snap.rows,
      grid: snap.grid,
      gridFormat: snap.gridFormat,
      tribes: this.tribes,
      rules: this.ruleset.rules
    });
    return new Blob([file], {type: 'application/octet-stream'});
  }

  private async parseGoltFile(buffer: ArrayBuffer): Promise<{cols: number; rows: number; generation: number; grid: Uint32Array; gridFormat: GridFormatMetadata} | null> {
    return parseGoltStateFile(buffer);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
