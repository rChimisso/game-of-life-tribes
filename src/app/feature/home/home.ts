import {ChangeDetectorRef, Component, OnDestroy, ViewChild} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSnackBar, MatSnackBarConfig, MatSnackBarModule} from '@angular/material/snack-bar';
import {RouterModule} from '@angular/router';

import {Engine} from './component/engine/engine';
import {Sidebar} from './component/sidebar/sidebar';
import {CompressionFailedMessage, DownloadCancelledError, DownloadRequestPayload} from './model/download';
import {DOWNLOAD_CHUNK_MODE_THRESHOLD_BYTES, estimateDownloadWorkingSet, resolveDownloadMode} from './model/download-estimate';
import {BRUSH_FILL_VALUES, BRUSH_SHAPE_VALUES, BrushFill, BrushShape} from './model/draw-mode';
import {GridFormatMetadata} from './model/grid-format';
import {DEFAULT_LIVE_METRIC_SECTION_SETTINGS, LiveMetricSectionSettings, LiveMetricsSettings} from './model/metrics';
import {DEFAULT_HOME_PREFERENCES, DEFAULT_METRICS_SECTION_PREFERENCES, DrawSectionPreferences, HomePreferences, MetricsSectionPreferences, SpeedSectionPreferences} from './model/preferences';
import {CONWAY_PRESET} from './model/preset';
import {OPFS_PENDING_WRITE_BYTE_BUDGET} from './model/recording-limits';
import {DEAD_TRIBE_ID, Ruleset, Tribe} from './model/rule';
import {SidebarEvent} from './model/sidebar-event';
import {BackpressureMessage, ChunkSealedMessage, ChunksSavingMessage, DeviceLostMessage, GenerationMessage, GpuErrorMessage, LimitsMessage, MetricMessage, RebuildingMessage, RecordingMessage, SnapshotMessage, SteppingMessage, StorageQuotaMessage, UncompressedChunksMessage} from './model/worker-message';
import {fitsGridFormatInMaxBytes, gridFormatFromBits, gridFormatMetadata, isSupportedBitsPerCell, requiredGridFormatForStateCount, smallestFittingSimulationGridFormat, smallestValidSimulationGridFormat, validatePackingAgainstStateCount} from './util/grid-format';
import {normalizeLiveMetricSectionSettings} from './util/metric-settings';
import {clearTempOpfsDirectory} from './util/opfs-temp';
import {applyRuleTribeRenames} from './util/tribe-impact';
import {ParsedGoltState} from './worker/snapshot/model/golt-types';
import {PersistedPreferencesComponent} from '../../core/abstract/persisted-preferences-component';

import {ProgressStatusMode} from '~gol/shared/component/progress-status/model/progress-status';

/**
 * Completed snapshot save output.
 *
 * @interface SnapshotSaveOutput
 * @typedef {SnapshotSaveOutput}
 */
interface SnapshotSaveOutput {
  /**
   * User-visible download filename.
   *
   * @type {string}
   */
  filename: string;
  /**
   * Snapshot file data.
   *
   * @type {Blob}
   */
  blob: Blob;
}

/**
 * Compression job tracked by the main-thread scheduler.
 *
 * @interface QueuedCompressionJob
 * @typedef {QueuedCompressionJob}
 */
interface QueuedCompressionJob {
  /**
   * Chunk data sent to a compression worker.
   *
   * @type {ChunkSealedMessage}
   */
  chunk: ChunkSealedMessage;
  /**
   * Failed retry attempts since this job last entered the queue.
   *
   * @type {number}
   */
  attempts: number;
  /**
   * Number of times this job has moved from deferred back to queued.
   *
   * @type {number}
   */
  deferredRequeues: number;
}

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

  /**
   * Status shown while the app is collecting snapshot inputs.
   *
   * @private
   * @readonly
   * @type {string}
   */
  private static readonly preparingSnapshotStatus = 'Preparing snapshot';

  /**
   * Status shown while active compression jobs finish.
   *
   * @private
   * @readonly
   * @type {string}
   */
  private static readonly waitingCompressionJobsStatus = 'Waiting for compression jobs to finish';

  /**
   * Maximum delayed retries before a failed compression job is deferred.
   *
   * @private
   * @readonly
   * @type {number}
   */
  private static readonly maxCompressionRetries = 3;

  /**
   * Maximum deferred-to-queued cycles before a chunk is left raw.
   *
   * @private
   * @readonly
   * @type {number}
   */
  private static readonly maxCompressionDeferredRequeues = 3;

  /**
   * Initial delayed compression retry interval.
   *
   * @private
   * @readonly
   * @type {number}
   */
  private static readonly compressionRetryDelayMs = 2000;

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

  public downloadMainStatus = '';

  public downloadEstimateExceedsChunkThreshold = false;

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

  /**
   * Current snapshot progress bar mode.
   *
   * @public
   * @type {ProgressStatusMode}
   */
  public snapshotProgressMode: ProgressStatusMode = 'indeterminate';

  /**
   * Current snapshot progress percentage.
   *
   * @public
   * @type {(number | null)}
   */
  public snapshotProgressPercent: number | null = null;

  /**
   * Current snapshot progress status text.
   *
   * @public
   * @type {string}
   */
  public snapshotProgressStatus = '';

  private quotaWarningLevel: 0 | 25 | 50 | 75 | 100 = 0;

  private pendingStateLoad: {grid: Uint32Array; generation: number; gridFormat: GridFormatMetadata} | null = null;

  private compressPool: Worker[] = [];

  private compressPoolIndex = 0;

  private pendingCompressionJobs: QueuedCompressionJob[] = [];

  private deferredCompressionJobs: QueuedCompressionJob[] = [];

  private readonly activeCompressionJobs = new Map<string, QueuedCompressionJob>();

  private compressionRetryTimers: ReturnType<typeof setTimeout>[] = [];

  private activeCompressionBytes = 0;

  private compressionDispatchPaused = false;

  private readonly compressionDrainResolvers = new Set<() => void>();

  private downloadWorker: Worker | null = null;

  /**
   * Whether the current download was cancelled by the user.
   *
   * @private
   * @type {boolean}
   */
  private downloadCancelRequested = false;

  private drawTribeIndex = 1;

  private pendingSnapshotResolve: ((snap: SnapshotMessage) => void) | null = null;

  private pendingRecordingResolve: ((rec: RecordingMessage) => void) | null = null;

  private latestRecordingManifest: RecordingMessage | null = null;

  private downloadRequestPreview: DownloadRequestPayload | null = null;

  private readonly keydownListenerController = new AbortController();

  private wakeLock: WakeLockSentinel | null = null;

  private wakeLockRequestPending = false;

  private readonly minimumProgressVisibleMs = 1000;

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

  public get overlayActive(): boolean {
    return this.gpuErrorMessage !== null || this.rebuilding || this.backpressure || this.stepping || this.maxSpeed;
  }

  /**
   * Whether an active download is waiting for cancellation to complete.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get downloadCancelling(): boolean {
    return this.downloadCancelRequested;
  }

  public constructor(private readonly cdr: ChangeDetectorRef, private readonly snackBar: MatSnackBar) {
    super('golt-home-prefs');
    console.log('[GOLT] Home page initialized');
    this.restorePreferences();
    clearTempOpfsDirectory().catch(error => console.warn('[GOLT] Failed to clear temporary OPFS files on page init:', error));
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
      this.requeueDeferredCompressionJobs();
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
        this.setLoadedGenerationCounter(generation);
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
    this.openSnack(`GPU error: ${data.reason}`, 'error');
    this.openSnack(`GPU error: ${data.reason}`, 'error');
    this.cdr.markForCheck();
  }

  public onStorageQuota(data: StorageQuotaMessage): void {
    this.storageUsedBytes = data.usedBytes;
    this.storageQuotaBytes = data.quotaBytes;
    this.storagePendingRawBytes = data.pendingRawBytes;
    this.storageCompressedBytes = data.compressedBytes;
    this.refreshDownloadEstimateFlag();
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
        this.openSnack(`Recording storage at 25% capacity${compHint}`, 'info');
      } else if (level === 50) {
        this.openSnack(`Recording storage at 50% capacity${compHint}`, 'warning');
      } else if (level === 75) {
        const pauseHint = alreadyPaused ? '' : ' — simulation paused to preserve data';
        this.openSnack(`Recording storage at 75%${pauseHint}${compHint}`, 'warning');
        if (this.stepping) {
          this.cancelStepping();
        }
        this.setRunState('paused');
      } else if (level === 100) {
        this.openSnack(`Storage full — recording disabled. Save your data, then reset.${compHint}`, 'error');
        if (this.stepping) {
          this.cancelStepping();
        }
        this.setRunState('paused');
        if (this.recording) {
          this.recording = false;
          this.requeueDeferredCompressionJobs();
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
    this.pendingCompressionJobs.push({
      chunk: data,
      attempts: 0,
      deferredRequeues: 0
    });
    this.dispatchCompressionJobs();
    this.notifyCompressionDrainWaiters();
    this.refreshDownloadEstimateFlag();
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
      this.saveGoltState(snap)
        .catch(error => {
          console.error('[GOLT] Snapshot save failed:', error);
          this.openSnack('Snapshot save failed. Try again.', 'error');
        })
        .finally(() => {
          this.savingState = false;
          this.resetSnapshotProgress();
          this.cdr.markForCheck();
        });
    }
  }

  public onRecording(rec: RecordingMessage): void {
    this.latestRecordingManifest = rec;
    this.refreshDownloadEstimateFlag();
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
        if (!this.recording) {
          this.requeueDeferredCompressionJobs();
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
      case 'downloadSettingsChange':
        this.downloadRequestPreview = ev.value;
        this.refreshDownloadEstimateFlag();
        break;
      case 'download':
        this.downloadZip(ev.value);
        break;
      case 'cancelDownload':
        this.cancelDownload();
        break;
      case 'saveState':
        this.savingState = true;
        this.setSnapshotProgress('indeterminate', null, HomePage.preparingSnapshotStatus);
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
        const currentGrid = {
          cols: this.ruleset.cols,
          rows: this.ruleset.rows
        };
        const requiredFormat = requiredGridFormatForStateCount(preset.ruleset.tribes.length);
        const fittingFormat = smallestFittingSimulationGridFormat(
          preset.ruleset.tribes.length,
          currentGrid,
          this.currentMaxBytes()
        );
        if (fittingFormat) {
          const newRuleset = structuredClone(preset.ruleset);
          newRuleset.cols = currentGrid.cols;
          newRuleset.rows = currentGrid.rows;
          shouldSavePreferences = this.applyCommittedRuleset(newRuleset, true);
        } else {
          this.openSnack(
            `${preset.name} preset requires at least ${requiredFormat.bitsPerCell}-bit packing, which is not supported by the current grid size. Reduce the grid size before applying it.`,
            'error'
          );
        }
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

  /**
   * Refreshes the high-memory download estimate flag from the latest manifest.
   *
   * @private
   */
  private refreshDownloadEstimateFlag(): void {
    if (this.latestRecordingManifest && this.downloadRequestPreview) {
      const estimate = estimateDownloadWorkingSet(this.downloadRequestPreview, this.latestRecordingManifest, this.tribes.length);
      this.downloadEstimateExceedsChunkThreshold = estimate.totalBytes > DOWNLOAD_CHUNK_MODE_THRESHOLD_BYTES;
    } else {
      this.downloadEstimateExceedsChunkThreshold = false;
    }
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
    if (this.overlayActive) {
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
          if (!this.recording) {
            this.requeueDeferredCompressionJobs();
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
    if (state === 'paused') {
      this.requeueDeferredCompressionJobs();
    }
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
    for (const timer of this.compressionRetryTimers) {
      clearTimeout(timer);
    }
    this.compressPool = [];
    this.compressPoolIndex = 0;
    this.pendingCompressionJobs = [];
    this.deferredCompressionJobs = [];
    this.activeCompressionJobs.clear();
    this.compressionRetryTimers = [];
    this.activeCompressionBytes = 0;
    this.compressionDispatchPaused = false;
    this.notifyCompressionDrainWaiters();
  }

  /**
   * Dispatches queued compression jobs within the memory budget.
   *
   * @private
   */
  private dispatchCompressionJobs(): void {
    let dispatched = true;
    while (!this.compressionDispatchPaused && dispatched && this.pendingCompressionJobs.length > 0 && this.compressPool.length > 0) {
      const nextJob = this.pendingCompressionJobs[0]!;
      if (this.canDispatchCompressionJob(nextJob)) {
        this.pendingCompressionJobs.shift();
        this.postCompressionJob(nextJob);
      } else {
        dispatched = false;
      }
    }
  }

  /**
   * Checks whether one compression job fits the active memory budget.
   *
   * @private
   * @param {QueuedCompressionJob} job compression job.
   * @returns {boolean} true when the job can start now.
   */
  private canDispatchCompressionJob(job: QueuedCompressionJob): boolean {
    return this.activeCompressionBytes === 0 ||
      this.activeCompressionBytes + job.chunk.rawBytes <= OPFS_PENDING_WRITE_BYTE_BUDGET;
  }

  /**
   * Sends one compression job to the worker pool.
   *
   * @private
   * @param {QueuedCompressionJob} job compression job.
   */
  private postCompressionJob(job: QueuedCompressionJob): void {
    const worker = this.compressPool[this.compressPoolIndex % this.compressPool.length]!;
    this.compressPoolIndex++;
    this.activeCompressionBytes += job.chunk.rawBytes;
    this.activeCompressionJobs.set(job.chunk.filename, job);
    worker.postMessage({
      type: 'compress',
      filename: job.chunk.filename,
      rawBytes: job.chunk.rawBytes,
      blockCount: job.chunk.blockCount,
      cols: job.chunk.cols,
      rows: job.chunk.rows,
      rawGridFormat: job.chunk.rawGridFormat,
      storageGridFormat: job.chunk.storageGridFormat
    });
  }

  /**
   * Releases active compression memory after a worker finishes a job.
   *
   * @private
   * @param {string} filename completed chunk filename.
   * @param {number} rawBytes raw bytes for the completed job.
   */
  private completeCompressionJob(filename: string, rawBytes: number): void {
    const activeJob = this.activeCompressionJobs.get(filename);
    const completedBytes = activeJob?.chunk.rawBytes ?? rawBytes;
    this.activeCompressionJobs.delete(filename);
    this.activeCompressionBytes = Math.max(0, this.activeCompressionBytes - completedBytes);
    this.dispatchCompressionJobs();
    this.notifyCompressionDrainWaiters();
    this.refreshDownloadEstimateFlag();
  }

  /**
   * Handles a compression job failure.
   *
   * @private
   * @param {string} filename failed chunk filename.
   * @param {number} rawBytes failed chunk raw bytes.
   */
  private failCompressionJob(filename: string, rawBytes: number): void {
    const failedJob = this.activeCompressionJobs.get(filename);
    this.completeCompressionJob(filename, rawBytes);
    if (failedJob) {
      this.scheduleCompressionRetryOrDefer(failedJob);
    }
  }

  /**
   * Schedules a delayed retry or defers a repeatedly failed compression job.
   *
   * @private
   * @param {QueuedCompressionJob} job failed compression job.
   */
  private scheduleCompressionRetryOrDefer(job: QueuedCompressionJob): void {
    if (job.attempts < HomePage.maxCompressionRetries) {
      this.scheduleCompressionRetry({
        ...job,
        attempts: job.attempts + 1
      });
    } else if (job.deferredRequeues < HomePage.maxCompressionDeferredRequeues) {
      console.warn('[GOLT] Compression job deferred after retries:', job.chunk.filename);
      this.deferredCompressionJobs.push({
        ...job,
        attempts: 0
      });
      this.refreshDownloadEstimateFlag();
    } else {
      console.warn('[GOLT] Compression job left raw after repeated retry cycles:', job.chunk.filename);
      this.refreshDownloadEstimateFlag();
    }
  }

  /**
   * Adds a compression job back to the queue after exponential backoff.
   *
   * @private
   * @param {QueuedCompressionJob} job retry job.
   */
  private scheduleCompressionRetry(job: QueuedCompressionJob): void {
    const delayMs = HomePage.compressionRetryDelayMs * 2 ** (job.attempts - 1);
    const timer = setTimeout(() => {
      this.compressionRetryTimers = this.compressionRetryTimers.filter(t => t !== timer);
      this.pendingCompressionJobs.push(job);
      this.dispatchCompressionJobs();
      this.notifyCompressionDrainWaiters();
    }, delayMs);
    this.compressionRetryTimers.push(timer);
    this.notifyCompressionDrainWaiters();
  }

  /**
   * Requeues deferred failed compression jobs after memory pressure drops.
   *
   * @private
   */
  private requeueDeferredCompressionJobs(): void {
    if (this.deferredCompressionJobs.length > 0) {
      const jobs = this.deferredCompressionJobs.map(job => ({
        ...job,
        attempts: 0,
        deferredRequeues: job.deferredRequeues + 1
      }));
      this.deferredCompressionJobs = [];
      this.pendingCompressionJobs.push(...jobs);
      console.log('[GOLT] Requeued deferred compression jobs', {count: jobs.length});
      this.dispatchCompressionJobs();
      this.notifyCompressionDrainWaiters();
      this.refreshDownloadEstimateFlag();
    }
  }

  /**
   * Waits for compression jobs before download handoff.
   *
   * @private
   * @async
   * @param {'active' | 'all'} mode compression wait mode.
   */
  private async waitForDownloadCompression(mode: 'active' | 'all'): Promise<void> {
    if (mode === 'all') {
      this.requeueDeferredCompressionJobs();
    } else {
      this.compressionDispatchPaused = true;
    }
    const initialJobs = Math.max(0, this.countCompressionWaitJobs(mode));
    this.updateCompressionWaitProgress(HomePage.waitingCompressionJobsStatus, 0, initialJobs);
    while (!this.downloadCancelRequested && this.countCompressionWaitJobs(mode) > 0) {
      const remainingJobs = this.countCompressionWaitJobs(mode);
      const completedJobs = Math.max(0, initialJobs - remainingJobs);
      this.updateCompressionWaitProgress(HomePage.waitingCompressionJobsStatus, completedJobs, initialJobs);
      await new Promise<void>(resolve => {
        this.compressionDrainResolvers.add(resolve);
      });
    }
    this.updateCompressionWaitProgress(HomePage.waitingCompressionJobsStatus, initialJobs, initialJobs);
    this.throwIfDownloadCancelled();
  }

  /**
   * Counts queued, active, retrying, and deferred compression jobs.
   *
   * @private
   * @param {'active' | 'all'} mode count mode.
   * @returns {number} compression job count.
   */
  private countCompressionWaitJobs(mode: 'active' | 'all'): number {
    let jobs: number;
    if (mode === 'active') {
      jobs = this.activeCompressionJobs.size;
    } else {
      jobs = this.activeCompressionJobs.size + this.pendingCompressionJobs.length + this.compressionRetryTimers.length + this.deferredCompressionJobs.length;
    }
    return jobs;
  }

  /**
   * Updates compression wait progress.
   *
   * @private
   * @param {string} label status label.
   * @param {number} completedJobs completed jobs.
   * @param {number} totalJobs total jobs.
   */
  private updateCompressionWaitProgress(label: string, completedJobs: number, totalJobs: number): void {
    const fraction = totalJobs > 0 ? completedJobs / totalJobs : 1;
    this.downloadProgress = Math.max(this.downloadProgress, Math.round(30 * fraction));
    this.downloadMainStatus = this.formatCompressionWaitStatus(label, completedJobs, totalJobs);
    this.cdr.markForCheck();
  }

  /**
   * Formats compression wait progress status.
   *
   * @private
   * @param {string} label status label.
   * @param {number} completedJobs completed job count.
   * @param {number} totalJobs total job count.
   * @returns {string} formatted status.
   */
  private formatCompressionWaitStatus(label: string, completedJobs: number, totalJobs: number): string {
    return `${label} (${Math.max(0, completedJobs)} / ${Math.max(0, totalJobs)})`;
  }

  /**
   * Notifies waiters that compression queue state changed.
   *
   * @private
   */
  private notifyCompressionDrainWaiters(): void {
    for (const resolve of Array.from(this.compressionDrainResolvers)) {
      this.compressionDrainResolvers.delete(resolve);
      resolve();
    }
  }

  private resumeCompressionPool(): void {
    this.compressionDispatchPaused = false;
    for (const worker of this.compressPool) {
      worker.postMessage({type: 'resumeCompression'});
    }
    this.dispatchCompressionJobs();
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
          this.engine.updateChunkCodec(ev.data.filename, ev.data.rawBytes, ev.data.codec, ev.data.storedBytes, ev.data.gridFormat);
          this.completeCompressionJob(ev.data.filename, ev.data.rawBytes);
        } else if (ev.data?.type === 'compressionFailed') {
          const failed = ev.data as CompressionFailedMessage;
          this.failCompressionJob(failed.filename, failed.rawBytes);
        }
      };
      this.compressPool.push(w);
    }
  }

  private cancelDownload(): void {
    console.log('[GOLT] Cancelling download');
    this.downloadCancelRequested = true;
    this.notifyCompressionDrainWaiters();
    if (this.downloadWorker) {
      this.downloadMainStatus = 'Cancelling download';
      this.downloadWorker.postMessage({type: 'cancel'});
      this.cdr.markForCheck();
    } else {
      this.downloadMainStatus = 'Cancelling download';
      this.resumeCompressionPool();
      this.engine.requestUncompressedChunks();
      this.cdr.markForCheck();
    }
  }

  /**
   * Clears visible download progress state.
   *
   * @private
   */
  private resetDownloadState(): void {
    this.downloadProgress = -1;
    this.downloadMainStatus = '';
  }

  /**
   * Stops download preparation when cancellation was requested.
   *
   * @private
   */
  private throwIfDownloadCancelled(): void {
    if (this.downloadCancelRequested) {
      throw new DownloadCancelledError();
    }
  }

  private restart(): void {
    console.log('[GOLT] Restart requested');
    this.snackBar.dismiss();
    clearTempOpfsDirectory().catch(error => console.warn('[GOLT] Failed to clear temporary OPFS files:', error));
    this.setRunState('paused');
    this.terminateCompressWorker();
    this.storagePendingRawBytes = 0;
    this.storageCompressedBytes = 0;
    this.storageUsedBytes = 0;
    this.quotaWarningLevel = 0;
    this.latestRecordingManifest = null;
    this.downloadEstimateExceedsChunkThreshold = false;
    this.rebuilding = true;
    this.ruleset = {...this.ruleset};
    this.latestMetrics = null;
  }

  private openSnack(message: string, tone: 'info' | 'warning' | 'error', duration: number = 0): void {
    this.logSnack(message, tone);
    const config: MatSnackBarConfig = {panelClass: `snackbar-${tone}`};
    if (duration > 0) {
      config.duration = duration;
    }
    this.snackBar.open(message, 'Dismiss', config);
  }

  /**
   * Logs snackbar messages with the same severity used by the UI.
   *
   * @private
   * @param {string} message snackbar message.
   * @param {('info' | 'warning' | 'error')} tone snackbar tone.
   */
  private logSnack(message: string, tone: 'info' | 'warning' | 'error'): void {
    switch (tone) {
      case 'info':
        console.log(`[GOLT] ${message}`);
        break;
      case 'warning':
        console.warn(`[GOLT] ${message}`);
        break;
      case 'error':
        console.error(`[GOLT] ${message}`);
        break;
    }
  }

  private clampBrushSize(): boolean {
    const max = Math.max(1, Math.floor(Math.min(this.ruleset.cols, this.ruleset.rows) / 4));
    const nextBrushSize = Math.min(this.brushSize, max);
    const changed = nextBrushSize !== this.brushSize;
    this.brushSize = nextBrushSize;
    return changed;
  }

  private async downloadZip(opts: DownloadRequestPayload): Promise<void> {
    this.downloadCancelRequested = false;
    this.downloadRequestPreview = opts;
    const needFrames = opts.forceChunkDownload || opts.mp4 || opts.png || opts.metrics || opts.saves;
    console.log('[GOLT] Download started', {
      metrics: opts.metrics,
      mp4: opts.mp4,
      png: opts.png,
      saves: opts.saves,
      forceChunkDownload: opts.forceChunkDownload,
      frameRange: opts.frameRange
    });

    // Pause the simulation so the download captures a consistent state.
    if (this.state === 'running') {
      this.setRunState('paused');
      this.engine.setRunning(false);
    }

    this.downloadProgress = 0;
    this.downloadMainStatus = needFrames ? 'Saving pending recording frames' : HomePage.preparingSnapshotStatus;
    this.cdr.markForCheck();

    try {
      console.log('[GOLT] Clearing temporary OPFS files before download');
      await clearTempOpfsDirectory();
      this.throwIfDownloadCancelled();
      let flushedRecording: RecordingMessage | null = null;
      if (needFrames) {
        console.log('[GOLT] Download OPFS flush started');
        flushedRecording = await this.requestRecordingManifest();
        console.log('[GOLT] Download OPFS flush completed', {
          chunks: flushedRecording.manifest.chunks.length,
          generationStart: flushedRecording.manifest.generationStart,
          generationEnd: flushedRecording.manifest.generationEnd
        });
        this.throwIfDownloadCancelled();
        this.downloadMainStatus = HomePage.waitingCompressionJobsStatus;
        this.cdr.markForCheck();
      }

      const initialEstimate = estimateDownloadWorkingSet(opts, flushedRecording, this.tribes.length);
      const initialMode = resolveDownloadMode(initialEstimate, opts.forceChunkDownload);
      this.downloadEstimateExceedsChunkThreshold = initialEstimate.totalBytes > DOWNLOAD_CHUNK_MODE_THRESHOLD_BYTES;
      if (initialMode === 'compressed-chunks') {
        console.log('[GOLT] Download waiting for all recording chunks before chunk export');
        await this.waitForDownloadCompression('all');
        this.throwIfDownloadCancelled();
      } else {
        console.log('[GOLT] Download active compression wait started');
        await this.waitForDownloadCompression('active');
        this.throwIfDownloadCancelled();
      }

      this.downloadMainStatus = needFrames ? 'Refreshing recording manifest' : HomePage.preparingSnapshotStatus;
      this.cdr.markForCheck();
      const snapshotP = this.requestDownloadSnapshot();
      const recordingP = needFrames ? this.requestRecordingManifest() : Promise.resolve(null);
      const [snap, rec] = await Promise.all([snapshotP, recordingP]);
      this.throwIfDownloadCancelled();
      console.log('[GOLT] Download manifest handoff ready', {
        chunks: rec?.manifest.chunks.length ?? 0,
        generationStart: rec?.manifest.generationStart ?? null,
        generationEnd: rec?.manifest.generationEnd ?? null
      });
      this.startDownloadWorker(opts, snap, rec, performance.now());
    } catch (error) {
      this.handleDownloadPreparationFailure(error);
    }
  }

  /**
   * Handles download setup failure or cancellation before the worker starts.
   *
   * @private
   * @param {unknown} error failure reason.
   */
  private handleDownloadPreparationFailure(error: unknown): void {
    if (this.downloadCancelRequested || error instanceof DownloadCancelledError) {
      this.downloadMainStatus = 'Cancelling';
    } else {
      console.error('[GOLT] Download preparation failed:', error);
      this.openSnack('Download failed while preparing compression data. Try again.', 'error');
    }
    this.resumeCompressionPool();
    this.resetDownloadState();
    this.downloadCancelRequested = false;
    this.cdr.markForCheck();
  }

  /**
   * Requests the current engine snapshot for a download.
   *
   * @private
   */
  private requestDownloadSnapshot(): Promise<SnapshotMessage> {
    return new Promise<SnapshotMessage>(resolve => {
      this.pendingSnapshotResolve = resolve;
      this.engine.requestSnapshot();
    });
  }

  /**
   * Requests a recording manifest after pending frames have been sealed to OPFS.
   *
   * @private
   */
  private requestRecordingManifest(): Promise<RecordingMessage> {
    return new Promise<RecordingMessage>(resolve => {
      this.pendingRecordingResolve = resolve;
      this.engine.requestRecording();
    });
  }

  /**
   * Starts the download worker once snapshot and recording data are stable.
   *
   * @private
   * @param {DownloadRequestPayload} opts download options.
   * @param {SnapshotMessage} snap stable snapshot.
   * @param {(RecordingMessage | null)} rec stable recording manifest.
   * @param {number} startedAt download start timestamp.
   */
  private startDownloadWorker(opts: DownloadRequestPayload, snap: SnapshotMessage, rec: RecordingMessage | null, startedAt: number): void {
    const worker = new Worker(new URL('./worker/download.ts', import.meta.url), {type: 'module'});
    this.downloadWorker = worker;
    const pendingDownloadSideEffects: Promise<void>[] = [];

    const releaseDownloadUi = () => {
      this.resetDownloadState();
      this.downloadCancelRequested = false;
      if (this.downloadWorker === worker) {
        this.downloadWorker = null;
      }
      this.cdr.markForCheck();
      this.resumeCompressionPool();
      this.engine.requestUncompressedChunks();
    };
    const terminateDownloadWorker = (reason: string) => {
      if (reason === 'error') {
        console.warn('[GOLT] Download worker terminated after error');
      }
      worker.terminate();
    };
    const cleanupDownload = () => {
      releaseDownloadUi();
      terminateDownloadWorker('done');
    };

    worker.onerror = () => {
      console.error('[GOLT] Download worker failed unexpectedly');
      this.openSnack('Download failed unexpectedly. Try again.', 'error');
      cleanupDownload();
    };

    worker.onmessage = async(e: MessageEvent) => {
      if (e.data.type === 'progress') {
        this.downloadProgress = e.data.percent;
        this.downloadMainStatus = e.data.status ?? '';
        this.cdr.markForCheck();
      } else if (e.data.type === 'warning') {
        this.openSnack(e.data.message ?? 'Download warning.', 'warning');
      } else if (e.data.type === 'done-part') {
        console.log('[GOLT] Download part ready:', e.data.filename);
        const blob = e.data.file instanceof Blob ? e.data.file : new Blob([e.data.buffer]);
        const sideEffect = this.waitForMinimumVisibleTime(startedAt).then(() => {
          if (!this.downloadCancelRequested && this.downloadWorker === worker) {
            this.downloadBlob(blob, e.data.filename);
          }
        });
        pendingDownloadSideEffects.push(sideEffect);
      } else if (e.data.type === 'error') {
        const reason = e.data.reason ?? 'Unknown error';
        const suggestion = typeof reason === 'string' && reason.includes('Array buffer allocation failed') ? ' Try downloading fewer frames or fewer output selections.' : '';
        this.openSnack(`Download error: ${reason}${suggestion}`, 'error');
        cleanupDownload();
      } else if (e.data.type === 'cancelled') {
        releaseDownloadUi();
      } else if (e.data.type === 'cancel-cleanup-done') {
        terminateDownloadWorker('cancel cleanup done');
      } else if (e.data.type === 'done') {
        console.log('[GOLT] Download completed');
        await Promise.all(pendingDownloadSideEffects);
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
        gridFormat: snap.gridFormat,
        tribes: this.tribes.map(t => ({id: t.id, color: t.color})),
        rules: this.ruleset.rules
      },
      recording: hasChunks ? {
        manifest: rec.manifest,
        cols: rec.cols,
        rows: rec.rows
      } : null,
      tribes: this.tribes.map(t => ({id: t.id, color: t.color})),
      rules: this.ruleset.rules
    }, transferables);
  }

  private async loadState(buffer: ArrayBuffer): Promise<void> {
    const startedAt = performance.now();
    this.loadingState = true;
    this.setSnapshotProgress('indeterminate', null, 'Reading snapshot file');
    this.cdr.markForCheck();
    try {
      const parsed = await this.parseGoltFile(buffer);
      await this.waitForMinimumVisibleTime(startedAt);
      if (parsed) {
        this.applyLoadedSnapshot(parsed);
      } else {
        console.warn('[GOLT] Invalid snapshot file selected');
        this.openSnack('Invalid snapshot file.', 'error');
      }
    } finally {
      this.loadingState = false;
      this.resetSnapshotProgress();
      this.cdr.markForCheck();
    }
  }

  private async saveGoltState(snap: SnapshotMessage): Promise<void> {
    const startedAt = performance.now();
    console.log('[GOLT] Clearing temporary OPFS files before snapshot save');
    await clearTempOpfsDirectory();
    const saved = await this.buildGoltFile(snap);
    await this.waitForMinimumVisibleTime(startedAt);
    this.downloadBlob(saved.blob, saved.filename);
  }

  private async buildGoltFile(snap: SnapshotMessage): Promise<SnapshotSaveOutput> {
    return this.runSnapshotSaveWorker(snap);
  }

  private async parseGoltFile(buffer: ArrayBuffer): Promise<ParsedGoltState | null> {
    return this.runSnapshotLoadWorker(buffer);
  }

  /**
   * Applies a parsed snapshot to the current engine or queues it through rebuild.
   *
   * @private
   * @param {ParsedGoltState} parsed parsed snapshot data.
   * @param {number} parsed.cols
   * @param {number} parsed.rows
   * @param {number} parsed.generation
   * @param {Uint32Array} parsed.grid
   * @param {GridFormatMetadata} parsed.gridFormat
   */
  private applyLoadedSnapshot(parsed: ParsedGoltState): void {
    const {cols, rows, generation} = parsed;
    const nextRuleset: Ruleset = {
      cols,
      rows,
      tribes: parsed.tribes.map(t => ({id: t.id, color: t.color})),
      rules: structuredClone(parsed.rules)
    };
    const nextSimulationGridFormat = this.smallestSimulationGridFormatForRuleset(nextRuleset, cols, rows);
    this.setLoadedGenerationCounter(generation);
    this.queueLoadedSnapshotForRebuild(parsed, nextRuleset, nextSimulationGridFormat);
  }

  /**
   * Stores a parsed snapshot until the engine rebuild completes.
   *
   * @private
   * @param {ParsedGoltState} parsed parsed snapshot data.
   * @param {number} parsed.cols
   * @param {number} parsed.rows
   * @param {number} parsed.generation
   * @param {Uint32Array} parsed.grid
   * @param {GridFormatMetadata} parsed.gridFormat
   * @param {Ruleset} nextRuleset ruleset loaded from the snapshot.
   * @param {GridFormatMetadata} nextSimulationGridFormat grid format selected for the rebuilt engine.
   */
  private queueLoadedSnapshotForRebuild(parsed: ParsedGoltState, nextRuleset: Ruleset, nextSimulationGridFormat: GridFormatMetadata): void {
    const {generation, grid, gridFormat} = parsed;
    this.rebuilding = true;
    this.pendingStateLoad = {
      grid,
      generation,
      gridFormat
    };
    this.simulationGridFormat = nextSimulationGridFormat;
    this.ruleset = nextRuleset;
    this.syncDrawSelectionWithRuleset();
    if (this.clampBrushSize()) {
      this.savePreferences();
    }
  }

  /**
   * Keeps draw controls pointed at a valid tribe after loading snapshot metadata.
   *
   * @private
   */
  private syncDrawSelectionWithRuleset(): void {
    if (!this.ruleset.tribes.some(t => this.drawTribes.includes(t.id))) {
      this.drawTribes = [this.ruleset.tribes.find(t => t.id !== DEAD_TRIBE_ID)?.id ?? DEAD_TRIBE_ID];
    }
    this.drawTribeIndex = this.ruleset.tribes.findIndex(t => t.id === this.drawTribes[0]);
  }

  /**
   * Updates the visible generation counter as soon as a snapshot is accepted.
   *
   * @private
   * @param {number} generation loaded snapshot generation.
   */
  private setLoadedGenerationCounter(generation: number): void {
    this.onGeneration({
      type: 'generation',
      generation,
      fps: this.latestMetrics?.fps ?? 0
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private runSnapshotSaveWorker(snap: SnapshotMessage): Promise<SnapshotSaveOutput> {
    return new Promise<SnapshotSaveOutput>((resolve, reject) => {
      const worker = new Worker(new URL('./worker/snapshot.ts', import.meta.url), {type: 'module'});
      worker.onerror = () => {
        worker.terminate();
        reject(new Error('Snapshot worker failed unexpectedly'));
      };
      worker.onmessage = (event: MessageEvent) => {
        const message = event.data as {
          type: 'saved-buffer' | 'saved-file' | 'progress' | 'error';
          filename?: string;
          buffer?: ArrayBuffer;
          file?: File;
          mode?: ProgressStatusMode;
          percent?: number | null;
          status?: string;
          reason?: string;
        };
        if (message.type === 'saved-buffer' && message.buffer instanceof ArrayBuffer && message.filename) {
          worker.terminate();
          resolve({
            filename: message.filename,
            blob: new Blob([message.buffer], {type: 'application/octet-stream'})
          });
        } else if (message.type === 'saved-file' && message.file instanceof File && message.filename) {
          worker.terminate();
          resolve({
            filename: message.filename,
            blob: message.file
          });
        } else if (message.type === 'saved-buffer' || message.type === 'saved-file') {
          worker.terminate();
          reject(new Error('Snapshot save failed: incomplete worker payload'));
        } else if (message.type === 'progress') {
          this.applySnapshotProgress(message.mode, message.percent ?? null, message.status ?? '');
        } else if (message.type === 'error') {
          worker.terminate();
          reject(new Error(message.reason ?? 'Snapshot save failed'));
        }
      };
      worker.postMessage({
        type: 'save',
        snapshot: {
          generation: snap.generation,
          cols: snap.cols,
          rows: snap.rows,
          grid: snap.grid,
          gridFormat: snap.gridFormat,
          tribes: this.tribes.map(t => ({id: t.id, color: t.color})),
          rules: this.ruleset.rules
        }
      }, [snap.grid.buffer]);
    });
  }

  private runSnapshotLoadWorker(buffer: ArrayBuffer): Promise<ParsedGoltState | null> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./worker/snapshot.ts', import.meta.url), {type: 'module'});
      worker.onerror = () => {
        worker.terminate();
        reject(new Error('Snapshot worker failed unexpectedly'));
      };
      worker.onmessage = (event: MessageEvent) => {
        const message = event.data as {
          type: 'loaded' | 'invalid' | 'progress' | 'error';
          cols?: number;
          rows?: number;
          generation?: number;
          grid?: Uint32Array;
          gridFormat?: GridFormatMetadata;
          tribes?: ParsedGoltState['tribes'];
          rules?: ParsedGoltState['rules'];
          mode?: ProgressStatusMode;
          percent?: number | null;
          status?: string;
          reason?: string;
        };
        if (message.type === 'loaded' && typeof message.cols === 'number' && typeof message.rows === 'number' &&
            typeof message.generation === 'number' && message.grid instanceof Uint32Array && message.gridFormat &&
            Array.isArray(message.tribes) && Array.isArray(message.rules)) {
          worker.terminate();
          resolve({
            cols: message.cols,
            rows: message.rows,
            generation: message.generation,
            grid: message.grid,
            gridFormat: message.gridFormat,
            tribes: message.tribes,
            rules: message.rules
          });
        } else if (message.type === 'loaded') {
          worker.terminate();
          reject(new Error('Snapshot load failed: incomplete worker payload'));
        } else if (message.type === 'invalid') {
          worker.terminate();
          resolve(null);
        } else if (message.type === 'progress') {
          this.applySnapshotProgress(message.mode, message.percent ?? null, message.status ?? '');
        } else if (message.type === 'error') {
          worker.terminate();
          reject(new Error(message.reason ?? 'Snapshot load failed'));
        }
      };
      worker.postMessage({
        type: 'load',
        buffer
      }, [buffer]);
    });
  }

  /**
   * Applies progress reported by the snapshot worker.
   *
   * @private
   * @param {(ProgressStatusMode | undefined)} mode progress bar mode.
   * @param {(number | null)} percent determinate progress percentage.
   * @param {string} status user-visible status text.
   */
  private applySnapshotProgress(mode: ProgressStatusMode | undefined, percent: number | null, status: string): void {
    this.setSnapshotProgress(mode ?? 'indeterminate', percent, status);
    this.cdr.markForCheck();
  }

  /**
   * Sets snapshot progress state.
   *
   * @private
   * @param {ProgressStatusMode} mode progress bar mode.
   * @param {(number | null)} percent determinate progress percentage.
   * @param {string} status user-visible status text.
   */
  private setSnapshotProgress(mode: ProgressStatusMode, percent: number | null, status: string): void {
    this.snapshotProgressMode = mode;
    this.snapshotProgressPercent = percent;
    this.snapshotProgressStatus = status;
  }

  /**
   * Clears snapshot progress state.
   *
   * @private
   */
  private resetSnapshotProgress(): void {
    this.setSnapshotProgress('indeterminate', null, '');
  }

  private async waitForMinimumVisibleTime(startedAt: number): Promise<void> {
    const elapsed = performance.now() - startedAt;
    if (elapsed < this.minimumProgressVisibleMs) {
      await new Promise(resolve => setTimeout(resolve, this.minimumProgressVisibleMs - elapsed));
    }
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
