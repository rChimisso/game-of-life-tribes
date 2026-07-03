/* eslint-disable max-lines */
import {ChangeDetectorRef, Component, OnDestroy, ViewChild} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSnackBar, MatSnackBarModule} from '@angular/material/snack-bar';
import {RouterModule} from '@angular/router';
import {Store} from '@ngrx/store';

import {Engine} from './component/engine/engine';
import {Sidebar} from './component/sidebar/sidebar';
import {clampBrushDensity} from './logic/brush-density';
import {CompressionScheduler} from './logic/compression-scheduler';
import {estimateDownloadWorkingSet} from './logic/download-estimate';
import {prepareHomeDownload} from './logic/download-preparation';
import {startHomeDownloadWorker} from './logic/download-worker-runner';
import {fitsGridFormatInMaxBytes, gridFormatFromBits, gridFormatMetadata, isSupportedBitsPerCell, requiredGridFormatForStateCount, smallestFittingSimulationGridFormat, smallestValidSimulationGridFormat, validatePackingAgainstStateCount} from './logic/grid-format';
import {normalizeDrawSectionPreferences, normalizeGridSectionPreferences, normalizeMetricsSectionPreferences, normalizeSpeedSectionPreferences} from './logic/home-preferences';
import {openHomeSnack} from './logic/home-snackbar';
import {normalizeLiveMetricSectionSettings} from './logic/metric-settings';
import {clearTempOpfsDirectory} from './logic/opfs-temp';
import {normalizeRandomSeed, normalizeRuleset} from './logic/rule-editor';
import {runSnapshotLoadWorker, runSnapshotSaveWorker} from './logic/snapshot-worker-runner';
import {applyBoundaryTribeRenames, applyRuleTribeRenames} from './logic/tribe-impact';
import {DownloadRequestPayload} from './model/download';
import {DOWNLOAD_CHUNK_MODE_THRESHOLD_BYTES} from './model/download-estimate';
import {BRUSH_FILL_VALUES, BRUSH_SHAPE_VALUES, BrushDensityByFill, BrushFill, BrushShape, DEFAULT_BRUSH_DENSITY_BY_FILL} from './model/draw-mode';
import {ExportFrameOrigin} from './model/export-frame-origin';
import {GridFormatMetadata} from './model/grid-format';
import {FIXED_SPEED_LOG_MESSAGE, MINIMUM_PROGRESS_VISIBLE_MS, PREPARING_SNAPSHOT_STATUS} from './model/home-runtime';
import {DEFAULT_LIVE_METRIC_SECTION_SETTINGS, LiveMetricSectionSettings, LiveMetricsSettings} from './model/metrics';
import {DEFAULT_HOME_PREFERENCES, DEFAULT_METRICS_SECTION_PREFERENCES, HomePreferences} from './model/preferences';
import {BOUNDED_GRID_TOPOLOGY, DEAD_TRIBE_ID, DEFAULT_RANDOM_SEED, Ruleset, TOROIDAL_GRID_TOPOLOGY, Tribe} from './model/rule';
import {SidebarEvent} from './model/sidebar-event';
import {BackpressureMessage, ChunkSealedMessage, ChunksSavingMessage, DeviceLostMessage, GenerationMessage, GpuErrorMessage, LimitsMessage, MetricMessage, RebuildingMessage, RecordingMessage, RecordingStoppedMessage, SnapshotMessage, SteppingMessage, StorageQuotaMessage, UncompressedChunksMessage} from './model/worker-message';
import {Preset} from './preset';
import {CONWAY_PRESET} from './preset/conway';
import {ParsedGoltState} from './worker/snapshot/model/golt-types';
import {PersistedPreferencesComponent} from '../../core/abstract/persisted-preferences-component';

import {downloadBlob} from '~gol/core/redux/actions';
import {ProgressStatusMode} from '~gol/shared/component/progress-status/model/progress-status';

/**
 * Home page component.
 *
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
  /**
   * Engine component instance.
   *
   * @public
   * @type {Engine<Tribe[]>}
   */
  @ViewChild(Engine) public engine!: Engine<Tribe[]>;

  /**
   * Sidebar component instance.
   *
   * @private
   * @type {Sidebar}
   */
  @ViewChild(Sidebar) private readonly sidebar!: Sidebar;

  /**
   * Current simulation ruleset.
   *
   * @public
   * @type {Ruleset}
   */
  public ruleset: Ruleset = {
    ...CONWAY_PRESET.ruleset,
    cols: 512,
    rows: 512,
    topology: TOROIDAL_GRID_TOPOLOGY,
    boundaryTribe: DEAD_TRIBE_ID,
    randomSeed: DEFAULT_RANDOM_SEED
  };

  /**
   * Current simulation run state.
   *
   * @public
   * @type {'running' | 'paused'}
   */
  public state: 'running' | 'paused' = 'paused';

  /**
   * Current fixed simulation speed.
   *
   * @public
   * @type {number}
   */
  public speed = 1;

  /**
   * Whether max-speed mode is active.
   *
   * @public
   * @type {boolean}
   */
  public maxSpeed = false;

  /**
   * Whether recording is active.
   *
   * @public
   * @type {boolean}
   */
  public recording = false;

  /**
   * Tribe ids currently selected for drawing.
   *
   * @public
   * @type {string[]}
   */
  public drawTribes: string[] = ['Alive'];

  /**
   * Whether delete drawing mode is active.
   *
   * @public
   * @type {boolean}
   */
  public deleteMode = false;

  /**
   * Whether touch pan mode is active.
   *
   * @public
   * @type {boolean}
   */
  public panMode = false;

  /**
   * Latest metrics emitted by the engine.
   *
   * @public
   * @type {(MetricMessage | null)}
   */
  public latestMetrics: MetricMessage | null = null;

  /**
   * Whether live metrics are enabled.
   *
   * @public
   * @type {boolean}
   */
  public liveMetricsEnabled = true;

  /**
   * Live metric section settings.
   *
   * @public
   * @type {LiveMetricSectionSettings}
   */
  public liveMetricSettings: LiveMetricSectionSettings = DEFAULT_LIVE_METRIC_SECTION_SETTINGS;

  /**
   * Whether the population metrics section is expanded.
   *
   * @public
   * @type {boolean}
   */
  public populationExpanded = DEFAULT_METRICS_SECTION_PREFERENCES.populationExpanded;

  /**
   * Whether the diversity metrics section is expanded.
   *
   * @public
   * @type {boolean}
   */
  public diversityExpanded = DEFAULT_METRICS_SECTION_PREFERENCES.diversityExpanded;

  /**
   * Whether the interfaces metrics section is expanded.
   *
   * @public
   * @type {boolean}
   */
  public interfacesExpanded = DEFAULT_METRICS_SECTION_PREFERENCES.interfacesExpanded;

  /**
   * Live metrics input passed to the engine.
   *
   * @public
   * @type {LiveMetricsSettings}
   */
  public liveMetrics: LiveMetricsSettings = {
    enabled: this.liveMetricsEnabled,
    sections: this.liveMetricSettings
  };

  /**
   * Brush size in cells.
   *
   * @public
   * @type {number}
   */
  public brushSize = 1;

  /**
   * Brush shape.
   *
   * @public
   * @type {BrushShape}
   */
  public brushShape: BrushShape = 'square';

  /**
   * Brush fill mode.
   *
   * @public
   * @type {BrushFill}
   */
  public brushFill: BrushFill = 'full';

  /**
   * Brush density percentages by fill mode.
   *
   * @public
   * @type {BrushDensityByFill}
   */
  public brushDensityByFill: BrushDensityByFill = {...DEFAULT_BRUSH_DENSITY_BY_FILL};

  /**
   * Current download progress percentage.
   *
   * @public
   * @type {number}
   */
  public downloadProgress = -1;

  /**
   * Main download status text.
   *
   * @public
   * @type {string}
   */
  public downloadMainStatus = '';

  /**
   * Whether the current download estimate exceeds the chunk threshold.
   *
   * @public
   * @type {boolean}
   */
  public downloadEstimateExceedsChunkThreshold = false;

  /**
   * Maximum available bytes for simulation storage.
   *
   * @public
   * @type {number}
   */
  public maxBytes = Infinity;

  /**
   * VRAM budget in bytes.
   *
   * @public
   * @type {number}
   */
  public vramBudgetBytes = Infinity;

  /**
   * Current frame byte size.
   *
   * @public
   * @type {number}
   */
  public frameByteSize = 0;

  /**
   * Simulation grid format.
   *
   * @public
   * @type {GridFormatMetadata}
   */
  public simulationGridFormat = gridFormatMetadata(smallestValidSimulationGridFormat(this.ruleset.tribes.length, this.ruleset));

  /**
   * Simulation VRAM usage in bytes.
   *
   * @public
   * @type {number}
   */
  public vramSimulationBytes = 0;

  /**
   * Recording VRAM usage in bytes.
   *
   * @public
   * @type {number}
   */
  public vramRecordingBytes = 0;

  /**
   * Whether recording is available for the current grid.
   *
   * @public
   * @type {boolean}
   */
  public recordingAvailable = true;

  /**
   * Whether a stepping operation is active.
   *
   * @public
   * @type {boolean}
   */
  public stepping = false;

  /**
   * Whether recording chunks are being saved.
   *
   * @public
   * @type {boolean}
   */
  public chunksSaving = false;

  /**
   * Whether the engine is applying backpressure.
   *
   * @public
   * @type {boolean}
   */
  public backpressure = false;

  /**
   * Whether the engine is rebuilding.
   *
   * @public
   * @type {boolean}
   */
  public rebuilding = false;

  /**
   * Current GPU error message.
   *
   * @public
   * @type {(string | null)}
   */
  public gpuErrorMessage: string | null = null;

  /**
   * Storage used in bytes.
   *
   * @public
   * @type {number}
   */
  public storageUsedBytes = 0;

  /**
   * Storage quota in bytes.
   *
   * @public
   * @type {number}
   */
  public storageQuotaBytes = 0;

  /**
   * Pending raw storage bytes.
   *
   * @public
   * @type {number}
   */
  public storagePendingRawBytes = 0;

  /**
   * Compressed storage bytes.
   *
   * @public
   * @type {number}
   */
  public storageCompressedBytes = 0;

  /**
   * Reserved recording storage headroom in bytes.
   *
   * @public
   * @type {number}
   */
  public storageReservedBytes = 0;

  /**
   * Whether snapshot saving is active.
   *
   * @public
   * @type {boolean}
   */
  public savingState = false;

  /**
   * Whether snapshot loading is active.
   *
   * @public
   * @type {boolean}
   */
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

  /**
   * Highest storage quota warning level already shown.
   *
   * @private
   * @type {0 | 25 | 50 | 75 | 100}
   */
  private quotaWarningLevel: 0 | 25 | 50 | 75 | 100 = 0;

  /**
   * Snapshot waiting for engine rebuild completion.
   *
   * @private
   * @type {({grid: Uint32Array; generation: number; gridFormat: GridFormatMetadata} | null)}
   */
  private pendingStateLoad: {grid: Uint32Array; generation: number; gridFormat: GridFormatMetadata} | null = null;

  /**
   * Background compression scheduler.
   *
   * @private
   * @readonly
   * @type {CompressionScheduler}
   */
  private readonly compressionScheduler = new CompressionScheduler({
    updateChunkCodec: message => {
      this.engine.updateChunkCodec(message.filename, message.rawBytes, message.codec, message.storedBytes, message.gridFormat);
    },
    isDownloadCancelled: () => this.downloadCancelRequested,
    getDownloadProgress: () => this.downloadProgress,
    setDownloadProgress: (progress, status) => {
      this.downloadProgress = progress;
      this.downloadMainStatus = status;
    },
    refreshDownloadEstimate: () => this.refreshDownloadEstimateFlag(),
    markForCheck: () => this.cdr.markForCheck()
  });

  /**
   * Active download worker.
   *
   * @private
   * @type {(Worker | null)}
   */
  private downloadWorker: Worker | null = null;

  /**
   * Whether the current download was cancelled by the user.
   *
   * @private
   * @type {boolean}
   */
  private downloadCancelRequested = false;

  /**
   * Current single-tribe draw index.
   *
   * @private
   * @type {number}
   */
  private drawTribeIndex = 1;

  /**
   * Pending snapshot resolver for request/response flows.
   *
   * @private
   * @type {(((snap: SnapshotMessage) => void) | null)}
   */
  private pendingSnapshotResolve: ((snap: SnapshotMessage) => void) | null = null;

  /**
   * Pending recording resolver for request/response flows.
   *
   * @private
   * @type {(((rec: RecordingMessage) => void) | null)}
   */
  private pendingRecordingResolve: ((rec: RecordingMessage) => void) | null = null;

  /**
   * Latest recording manifest received from the engine.
   *
   * @private
   * @type {(RecordingMessage | null)}
   */
  private latestRecordingManifest: RecordingMessage | null = null;

  /**
   * Latest download request preview from the sidebar.
   *
   * @private
   * @type {(DownloadRequestPayload | null)}
   */
  private downloadRequestPreview: DownloadRequestPayload | null = null;

  /**
   * Controller for document-level listeners.
   *
   * @private
   * @readonly
   * @type {AbortController}
   */
  private readonly keydownListenerController = new AbortController();

  /**
   * Active screen wake lock.
   *
   * @private
   * @type {(WakeLockSentinel | null)}
   */
  private wakeLock: WakeLockSentinel | null = null;

  /**
   * Whether a wake lock request is in flight.
   *
   * @private
   * @type {boolean}
   */
  private wakeLockRequestPending = false;

  /**
   * Default preferences.
   *
   * @protected
   * @readonly
   * @type {HomePreferences}
   */
  protected override readonly defaultPreferences: HomePreferences = DEFAULT_HOME_PREFERENCES;

  /**
   * Current ruleset tribes.
   *
   * @public
   * @readonly
   * @type {readonly Tribe[]}
   */
  public get tribes(): readonly Tribe[] {
    return this.ruleset.tribes;
  }

  /**
   * Effective simulation speed sent to the engine.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get effectiveSpeed(): number {
    return this.maxSpeed ? -1 : this.speed;
  }

  /**
   * Whether a blocking overlay owns engine input.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get overlayActive(): boolean {
    return this.gpuErrorMessage !== null || this.rebuilding || this.backpressure || this.stepping || this.maxSpeed;
  }

  /**
   * Active brush density percentage for the current fill mode.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get activeBrushDensity(): number {
    return this.brushDensityByFill[this.brushFill];
  }

  /**
   * Whether browser storage has enough remaining room for one more frame after reserved headroom.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get recordingStorageAvailable(): boolean {
    return this.frameByteSize > 0 && this.storageQuotaBytes > 0 && this.storageQuotaBytes - this.storagePendingRawBytes - this.storageCompressedBytes - this.storageReservedBytes >= this.frameByteSize;
  }

  /**
   * Whether a blocking overlay owns keyboard shortcuts.
   *
   * @private
   * @readonly
   * @type {boolean}
   */
  private get shortcutOverlayActive(): boolean {
    return this.gpuErrorMessage !== null || this.rebuilding || this.backpressure;
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

  /**
   * Creates the home page and restores persisted preferences.
   *
   * @public
   * @param {ChangeDetectorRef} cdr change detector.
   * @param {MatSnackBar} snackBar snackbar service.
   * @param {Store} store$ store.
   */
  public constructor(private readonly cdr: ChangeDetectorRef, private readonly snackBar: MatSnackBar, private readonly store$: Store) {
    super('golt-home-prefs');
    console.log('[GOLT] Home page initialized');
    this.restorePreferences();
    clearTempOpfsDirectory().catch(error => console.warn('[GOLT] Failed to clear temporary OPFS files on page init:', error));
    document.addEventListener('keydown', ev => this.handleKeydown(ev), {capture: true, signal: this.keydownListenerController.signal});
    document.addEventListener('visibilitychange', () => this.onVisibilityChange(), {signal: this.keydownListenerController.signal});
  }

  /**
   * @inheritdoc
   */
  public ngOnDestroy(): void {
    console.log('[GOLT] Home page destroyed');
    this.keydownListenerController.abort();
    this.compressionScheduler.terminate();
    this.releaseWakeLock();
  }

  /**
   * Stores the latest metrics emitted by the engine.
   *
   * @public
   * @param {MetricMessage} data metrics message.
   */
  public onMetrics(data: MetricMessage): void {
    this.latestMetrics = data;
    this.cdr.markForCheck();
  }

  /**
   * Updates the visible generation counter from the engine.
   *
   * @public
   * @param {GenerationMessage} data generation message.
   */
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

  /**
   * Applies engine limits and derived recording availability.
   *
   * @public
   * @param {LimitsMessage} data limits message.
   */
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
      this.compressionScheduler.requeueDeferredJobs();
      this.savePreferences();
    }
    this.cdr.markForCheck();
  }

  /**
   * Applies stepping status from the engine.
   *
   * @public
   * @param {SteppingMessage} data stepping status.
   */
  public onStepping(data: SteppingMessage): void {
    this.stepping = data.active;
    this.cdr.markForCheck();
  }

  /**
   * Applies chunk-saving status from the engine.
   *
   * @public
   * @param {ChunksSavingMessage} data chunk-saving status.
   */
  public onChunksSaving(data: ChunksSavingMessage): void {
    this.chunksSaving = data.active;
    this.cdr.markForCheck();
  }

  /**
   * Applies engine backpressure status.
   *
   * @public
   * @param {BackpressureMessage} data backpressure status.
   */
  public onBackpressure(data: BackpressureMessage): void {
    this.backpressure = data.active;
    this.cdr.markForCheck();
  }

  /**
   * Applies engine rebuild status.
   *
   * @public
   * @param {RebuildingMessage} data rebuild status.
   */
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

  /**
   * Handles engine device-loss failures.
   *
   * @public
   * @param {DeviceLostMessage} data device-loss message.
   */
  public onDeviceLost(data: DeviceLostMessage): void {
    console.error('[GOLT] GPU device lost:', data.reason);
    this.setRunState('paused');
    this.gpuErrorMessage = `GPU device lost: ${data.reason}`;
    openHomeSnack(this.snackBar, 'GPU device lost — simulation stopped. Try resetting to a smaller grid or reloading the page.', 'error', 0);
    this.cdr.markForCheck();
  }

  /**
   * Handles engine GPU errors.
   *
   * @public
   * @param {GpuErrorMessage} data GPU error message.
   */
  public onGpuError(data: GpuErrorMessage): void {
    console.error('[GOLT] GPU error:', data.reason);
    this.setRunState('paused');
    this.gpuErrorMessage = data.reason;
    openHomeSnack(this.snackBar, `GPU error: ${data.reason}`, 'error');
    this.cdr.markForCheck();
  }

  /**
   * Applies storage quota updates and warning thresholds.
   *
   * Decimal used bytes are compared against binary quota bytes to match the existing storage warning policy.
   *
   * @public
   * @param {StorageQuotaMessage} data storage quota message.
   */
  public onStorageQuota(data: StorageQuotaMessage): void {
    this.storageUsedBytes = data.usedBytes;
    this.storageQuotaBytes = data.quotaBytes;
    this.storagePendingRawBytes = data.pendingRawBytes;
    this.storageCompressedBytes = data.compressedBytes;
    this.storageReservedBytes = data.reservedBytes;
    this.refreshDownloadEstimateFlag();
    const effectiveUsed = data.pendingRawBytes + data.compressedBytes + data.reservedBytes;
    const pct = data.quotaBytes > 0 ? (effectiveUsed / data.quotaBytes) * 100 : 0;
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
    const {recordingStorageAvailable} = this;
    if (level > this.quotaWarningLevel) {
      this.quotaWarningLevel = level;
      const compHint = this.storagePendingRawBytes > 0 ? ' (compression in progress - size may decrease)' : '';
      const alreadyPaused = this.state === 'paused' && !this.stepping;
      if (level === 25) {
        openHomeSnack(this.snackBar, `Recording storage at 25% of browser quota${compHint}`, 'info');
      } else if (level === 50) {
        openHomeSnack(this.snackBar, `Recording storage at 50% of browser quota${compHint}`, 'warn');
      } else if (level === 75) {
        const pauseHint = alreadyPaused ? '' : ' - simulation paused to preserve data';
        openHomeSnack(this.snackBar, `Recording storage at 75% of browser quota${pauseHint}${compHint}`, 'warn');
        if (this.stepping) {
          this.cancelStepping();
        }
        this.setRunState('paused');
      } else if (level === 100) {
        openHomeSnack(this.snackBar, `Browser storage quota reached - recording disabled. Save your data, then reset.${compHint}`, 'error');
        this.disableRecordingForStorage();
      }
    } else if (level < this.quotaWarningLevel) {
      this.quotaWarningLevel = level;
      this.snackBar.dismiss();
    }
    if (!recordingStorageAvailable && this.recording && level < 100) {
      openHomeSnack(this.snackBar, 'Browser storage below one frame - recording disabled. Save your data, then reset.', 'error');
      this.disableRecordingForStorage();
    }
    this.cdr.markForCheck();
  }

  /**
   * Queues a sealed recording chunk for background compression.
   *
   * @public
   * @param {ChunkSealedMessage} data sealed chunk message.
   */
  public onChunkSealed(data: ChunkSealedMessage): void {
    this.compressionScheduler.enqueueChunk(data);
  }

  /**
   * Requeues engine-reported chunks that are still uncompressed.
   *
   * @public
   * @param {UncompressedChunksMessage} data uncompressed chunks message.
   */
  public onUncompressedChunks(data: UncompressedChunksMessage): void {
    this.compressionScheduler.enqueueUncompressedChunks(data);
  }

  /**
   * Handles a snapshot emitted by the engine.
   *
   * @public
   * @param {SnapshotMessage} snap snapshot message.
   */
  public onSnapshot(snap: SnapshotMessage): void {
    if (this.pendingSnapshotResolve) {
      this.pendingSnapshotResolve(snap);
      this.pendingSnapshotResolve = null;
    } else {
      this.saveGoltState(snap)
        .catch(error => {
          console.error('[GOLT] Snapshot save failed:', error);
          openHomeSnack(this.snackBar, 'Snapshot save failed. Try again.', 'error');
        })
        .finally(() => {
          this.savingState = false;
          this.resetSnapshotProgress();
          this.cdr.markForCheck();
        });
    }
  }

  /**
   * Handles a recording manifest emitted by the engine.
   *
   * @public
   * @param {RecordingMessage} rec recording manifest message.
   */
  public onRecording(rec: RecordingMessage): void {
    this.latestRecordingManifest = rec;
    this.refreshDownloadEstimateFlag();
    if (this.pendingRecordingResolve) {
      this.pendingRecordingResolve(rec);
      this.pendingRecordingResolve = null;
    }
  }

  /**
   * Handles recording being stopped by the engine.
   *
   * @public
   * @param {RecordingStoppedMessage} data recording stop message.
   */
  public onRecordingStopped(data: RecordingStoppedMessage): void {
    this.recording = false;
    this.setRunState('paused');
    this.compressionScheduler.requeueDeferredJobs();
    this.savePreferences();
    const restoreHint = data.restoredGeneration === null ? '' : ` Restored to generation ${data.restoredGeneration.toLocaleString()}.`;
    openHomeSnack(this.snackBar, `Browser storage quota reached - recording stopped.${restoreHint}`, 'error');
    this.cdr.markForCheck();
  }

  /**
   * Handles a sidebar command.
   *
   * @public
   * @param {SidebarEvent} ev sidebar event.
   */
  public onSidebarEvent(ev: SidebarEvent): void {
    const shouldSavePreferences = this.handleHomeSidebarEvent(ev);
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
        brushFill: this.brushFill,
        brushDensityByFill: {...this.brushDensityByFill}
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
      },
      grid: {
        topology: this.ruleset.topology,
        boundaryTribe: this.ruleset.boundaryTribe
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
    this.brushDensityByFill = {...preferences.draw.brushDensityByFill};
    this.speed = preferences.speed.speed;
    this.maxSpeed = preferences.speed.maxSpeed;
    this.recording = preferences.speed.recording;
    this.liveMetricsEnabled = preferences.speed.liveMetricsEnabled;
    this.liveMetricSettings = {...preferences.metrics.liveMetricSettings};
    this.populationExpanded = preferences.metrics.populationExpanded;
    this.diversityExpanded = preferences.metrics.diversityExpanded;
    this.interfacesExpanded = preferences.metrics.interfacesExpanded;
    this.ruleset = {
      ...this.ruleset,
      topology: preferences.grid.topology,
      boundaryTribe: this.normalizeBoundaryTribe(preferences.grid.boundaryTribe, this.ruleset.tribes)
    };
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
      draw: normalizeDrawSectionPreferences(stored.draw, defaults.draw),
      speed: normalizeSpeedSectionPreferences(stored.speed, defaults.speed),
      metrics: normalizeMetricsSectionPreferences(stored.metrics, defaults.metrics),
      grid: normalizeGridSectionPreferences(stored.grid, defaults.grid)
    };
  }

  /**
   * Stops recording after the effective storage quota is no longer safe.
   *
   * @private
   */
  private disableRecordingForStorage(): void {
    if (this.stepping) {
      this.cancelStepping();
    }
    this.setRunState('paused');
    if (this.recording) {
      this.recording = false;
      this.compressionScheduler.requeueDeferredJobs();
      this.savePreferences();
    }
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

  /**
   * Normalizes topology fields on a ruleset.
   *
   * @private
   * @param {Ruleset} ruleset ruleset to normalize.
   * @returns {Ruleset} ruleset with valid grid settings.
   */
  private normalizeRulesetGridSettings(ruleset: Ruleset): Ruleset {
    const topology = ruleset.topology === BOUNDED_GRID_TOPOLOGY ? BOUNDED_GRID_TOPOLOGY : TOROIDAL_GRID_TOPOLOGY;
    return {
      ...normalizeRuleset(ruleset),
      topology,
      boundaryTribe: this.normalizeBoundaryTribe(ruleset.boundaryTribe, ruleset.tribes)
    };
  }

  /**
   * Normalizes the virtual boundary tribe for the tribe list.
   *
   * @private
   * @param {string} boundaryTribe candidate boundary tribe.
   * @param {readonly Tribe[]} tribes active tribes.
   * @returns {string} normalized boundary tribe.
   */
  private normalizeBoundaryTribe(boundaryTribe: string, tribes: readonly Tribe[]): string {
    let normalized: string;
    if (tribes.some(tribe => tribe.id === boundaryTribe)) {
      normalized = boundaryTribe;
    } else {
      normalized = DEAD_TRIBE_ID;
    }
    return normalized;
  }

  /**
   * Applies a ruleset and selects a valid simulation grid format.
   *
   * @private
   * @param {Ruleset} newRuleset ruleset to apply.
   * @param {boolean} preferSmallestFormat whether to prefer the smallest valid format.
   * @returns {boolean} true when persisted draw preferences changed.
   */
  private applyCommittedRuleset(newRuleset: Ruleset, preferSmallestFormat = false): boolean {
    this.resetRecordingCompressionState();
    this.rebuilding = true;
    const normalizedRuleset = this.normalizeRulesetGridSettings(newRuleset);
    const gridSettingsChanged = normalizedRuleset.topology !== this.ruleset.topology || normalizedRuleset.boundaryTribe !== this.ruleset.boundaryTribe;
    this.simulationGridFormat = preferSmallestFormat ?
      this.smallestSimulationGridFormatForRuleset(normalizedRuleset) :
      this.resolveSimulationGridFormat(this.simulationGridFormat, normalizedRuleset);
    this.ruleset = normalizedRuleset;
    if (!normalizedRuleset.tribes.some(t => this.drawTribes.includes(t.id))) {
      this.drawTribes = [normalizedRuleset.tribes.find(t => t.id !== DEAD_TRIBE_ID)?.id ?? DEAD_TRIBE_ID];
    }
    this.drawTribeIndex = normalizedRuleset.tribes.findIndex(t => t.id === this.drawTribes[0]);
    this.latestMetrics = null;
    return this.clampBrushSize() || gridSettingsChanged;
  }

  /**
   * Applies a preset to the current grid when the required packing fits.
   *
   * @private
   * @param {Preset} preset preset to apply.
   * @returns {boolean} true when preferences should be saved.
   */
  private applyPreset(preset: Preset): boolean {
    const currentGrid = {
      cols: this.ruleset.cols,
      rows: this.ruleset.rows
    };
    const requiredFormat = requiredGridFormatForStateCount(preset.ruleset.tribes.length);
    const fittingFormat = smallestFittingSimulationGridFormat(preset.ruleset.tribes.length, currentGrid, this.currentMaxBytes());
    let shouldSavePreferences = false;
    if (fittingFormat) {
      shouldSavePreferences = this.applyCommittedRuleset({
        ...preset.ruleset,
        cols: currentGrid.cols,
        rows: currentGrid.rows,
        topology: this.ruleset.topology,
        boundaryTribe: this.ruleset.boundaryTribe,
        randomSeed: normalizeRandomSeed(preset.ruleset.randomSeed)
      }, true);
    } else {
      openHomeSnack(this.snackBar, `${preset.name} preset requires at least ${requiredFormat.bitsPerCell}-bit packing, which is not supported by the current grid size. Reduce the grid size before applying it.`, 'error');
    }
    return shouldSavePreferences;
  }

  /**
   * Handles global keyboard shortcuts.
   *
   * While stepping, only the spacebar shortcut remains active so it can cancel the step.
   *
   * @private
   * @param {KeyboardEvent} ev keyboard event.
   */
  private handleKeydown(ev: KeyboardEvent): void {
    const shortcutBlockedByFocus = this.activeElementBlocksShortcut(document.activeElement);
    let shortcut = shortcutBlockedByFocus ? {handled: false, shouldSavePreferences: false} : this.handleInterfaceShortcut(ev.key);
    if (!shortcut.handled && this.downloadProgress < 0) {
      if (this.stepping) {
        if (ev.key === ' ' && !shortcutBlockedByFocus) {
          this.cancelStepping();
          shortcut = {handled: true, shouldSavePreferences: false};
        }
      } else if (!shortcutBlockedByFocus && !this.shortcutOverlayActive) {
        shortcut = this.handlePlaybackShortcut(ev.key);
        if (!shortcut.handled) {
          shortcut = this.handleSelectionShortcut(ev.key);
        }
        if (!shortcut.handled) {
          shortcut = this.handleBrushShortcut(ev.key);
        }
      }
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

  /**
   * Handles interface keyboard shortcuts.
   *
   * @private
   * @param {string} key pressed key.
   * @returns {{ handled: boolean; shouldSavePreferences: boolean }} shortcut result.
   */
  private handleInterfaceShortcut(key: string): {handled: boolean; shouldSavePreferences: boolean} {
    let shortcut: {handled: boolean; shouldSavePreferences: boolean};
    if (key === 's') {
      this.sidebar.toggle();
      shortcut = {handled: true, shouldSavePreferences: false};
    } else {
      shortcut = {handled: false, shouldSavePreferences: false};
    }
    return shortcut;
  }

  /**
   * Handles playback keyboard shortcuts.
   *
   * @private
   * @param {string} key pressed key.
   * @returns {{ handled: boolean; shouldSavePreferences: boolean }} shortcut result.
   */
  private handlePlaybackShortcut(key: string): {handled: boolean; shouldSavePreferences: boolean} {
    switch (key) {
      case ' ':
        this.toggleRun();
        return {handled: true, shouldSavePreferences: false};
      case 'ArrowLeft':
        this.stepGenerationWithShortcut('back');
        return {handled: true, shouldSavePreferences: false};
      case 'ArrowRight':
        this.stepGenerationWithShortcut('forward');
        return {handled: true, shouldSavePreferences: false};
      case 'r':
        this.restart();
        return {handled: true, shouldSavePreferences: false};
      case 'e':
        if (this.recordingAvailable && (this.recording || this.recordingStorageAvailable)) {
          this.recording = !this.recording;
          console.log(`[GOLT] Recording ${this.toggleStateLabel(this.recording)}`);
          if (this.recording) {
            this.compressionScheduler.ensurePool();
          }
          if (!this.recording) {
            this.compressionScheduler.requeueDeferredJobs();
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
      default: return {handled: false, shouldSavePreferences: false};
    }
  }

  /**
   * Handles draw selection keyboard shortcuts.
   *
   * @private
   * @param {string} key pressed key.
   * @returns {{ handled: boolean; shouldSavePreferences: boolean }} shortcut result.
   */
  private handleSelectionShortcut(key: string): {handled: boolean; shouldSavePreferences: boolean} {
    switch (key) {
      case 'ArrowUp':
        this.speed += 1;
        this.maxSpeed = false;
        console.log(FIXED_SPEED_LOG_MESSAGE, {speed: this.speed});
        return {handled: true, shouldSavePreferences: true};
      case 'ArrowDown':
        this.speed = Math.max(1, this.speed - 1);
        console.log(FIXED_SPEED_LOG_MESSAGE, {speed: this.speed});
        return {handled: true, shouldSavePreferences: true};
      case 'd':
        this.deleteMode = !this.deleteMode;
        if (this.deleteMode) {
          this.drawTribes = [DEAD_TRIBE_ID];
        } else {
          this.drawTribes = [this.tribes[this.drawTribeIndex]!.id];
        }
        return {handled: true, shouldSavePreferences: false};
      case 't':
        this.selectNextDrawTribe();
        return {handled: true, shouldSavePreferences: false};
      default: return {handled: false, shouldSavePreferences: false};
    }
  }

  /**
   * Selects the next non-dead tribe for drawing.
   *
   * @private
   */
  private selectNextDrawTribe(): void {
    const selectableTribes = this.tribes.filter(tribe => tribe.id !== DEAD_TRIBE_ID);
    if (selectableTribes.length > 0) {
      const selectedTribeId = this.deleteMode ? this.tribes[this.drawTribeIndex]?.id : this.drawTribes[0];
      const selectedIndex = selectableTribes.findIndex(tribe => tribe.id === selectedTribeId);
      const nextTribe = selectableTribes[(selectedIndex + 1) % selectableTribes.length]!;
      this.deleteMode = false;
      this.drawTribes = [nextTribe.id];
      this.drawTribeIndex = this.tribes.findIndex(tribe => tribe.id === nextTribe.id);
    }
  }

  /**
   * Handles brush keyboard shortcuts.
   *
   * @private
   * @param {string} key pressed key.
   * @returns {{ handled: boolean; shouldSavePreferences: boolean }} shortcut result.
   */
  private handleBrushShortcut(key: string): {handled: boolean; shouldSavePreferences: boolean} {
    switch (key) {
      case '+':
        const max = Math.max(1, Math.floor(Math.min(this.ruleset.cols, this.ruleset.rows) / 4));
        this.brushSize = Math.min(max, this.brushSize + 1);
        return {handled: true, shouldSavePreferences: true};
      case '-':
        this.brushSize = Math.max(1, this.brushSize - 1);
        return {handled: true, shouldSavePreferences: true};
      case 'b':
        this.brushShape = BRUSH_SHAPE_VALUES[(BRUSH_SHAPE_VALUES.indexOf(this.brushShape) + 1) % BRUSH_SHAPE_VALUES.length]!;
        return {handled: true, shouldSavePreferences: true};
      case 'f':
        this.brushFill = BRUSH_FILL_VALUES[(BRUSH_FILL_VALUES.indexOf(this.brushFill) + 1) % BRUSH_FILL_VALUES.length]!;
        return {handled: true, shouldSavePreferences: true};
      default: return {handled: false, shouldSavePreferences: false};
    }
  }

  /**
   * Checks whether the focused element should block keyboard shortcuts.
   *
   * @private
   * @param {(Element | null)} active focused element.
   * @returns {boolean} true when shortcut handling should be blocked.
   */
  private activeElementBlocksShortcut(active: Element | null): boolean {
    if (active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) {
      return true;
    }
    if (active instanceof HTMLInputElement) {
      return active.type !== 'checkbox' && active.type !== 'radio';
    }
    return false;
  }

  /**
   * Steps one generation with the arrow key shortcut when playback controls allow it.
   *
   * @private
   * @param {'back' | 'forward'} direction step direction.
   */
  private stepGenerationWithShortcut(direction: 'back' | 'forward'): void {
    if (this.canStepGenerationWithShortcut(direction)) {
      if (direction === 'back') {
        this.resetVisibleGenPerSecond();
        this.engine.stepBack(1);
      } else {
        this.engine.stepForward(1);
      }
    }
  }

  /**
   * Returns whether arrow key stepping can run now.
   *
   * @private
   * @param {'back' | 'forward'} direction step direction.
   * @returns {boolean} whether stepping can run.
   */
  private canStepGenerationWithShortcut(direction: 'back' | 'forward'): boolean {
    let canStep = this.state !== 'running' && !(this.downloadProgress >= 0 || this.stepping || this.backpressure || this.rebuilding);
    if (direction === 'back') {
      canStep = canStep && !this.chunksSaving && (this.latestMetrics?.canStepBack ?? false);
    }
    return canStep;
  }

  /**
   * Toggles simulation run state.
   *
   * @private
   */
  private toggleRun(): void {
    if (this.stepping) {
      this.cancelStepping();
    } else {
      this.setRunState(this.state === 'paused' ? 'running' : 'paused');
    }
  }

  /**
   * Cancels active stepping.
   *
   * @private
   */
  private cancelStepping(): void {
    this.engine.cancelStepping();
  }

  /**
   * Sets simulation run state.
   *
   * @private
   * @param {'running' | 'paused'} state next run state.
   */
  private setRunState(state: 'running' | 'paused'): void {
    if (this.state !== state) {
      console.log(`[GOLT] Simulation ${state}`);
    }
    this.state = state;
    if (state === 'paused') {
      this.compressionScheduler.requeueDeferredJobs();
    }
    this.syncWakeLock();
  }

  /**
   * Synchronizes wake lock state with simulation state.
   *
   * @private
   */
  private syncWakeLock(): void {
    if (this.state === 'running' && document.visibilityState === 'visible') {
      this.requestWakeLock();
    } else {
      this.releaseWakeLock();
    }
  }

  /**
   * Requests a wake lock while the simulation is running.
   *
   * @private
   */
  private requestWakeLock(): void {
    if (!(this.wakeLock || this.wakeLockRequestPending || document.visibilityState !== 'visible')) {
      if ('wakeLock' in navigator) {
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
        }).catch(error => console.warn('Failed to request screen wake lock:', error)).finally(() => (this.wakeLockRequestPending = false));
      } else {
        console.warn('[GOLT] Screen Wake Lock API is unavailable');
      }
    }
  }

  /**
   * Releases the active wake lock.
   *
   * @private
   */
  private releaseWakeLock(): void {
    const lock = this.wakeLock;
    this.wakeLock = null;
    if (lock) {
      console.log('[GOLT] Screen wake lock released');
      lock.release().catch(error => console.warn('Failed to release screen wake lock:', error));
    }
  }

  /**
   * Handles document visibility changes for wake lock recovery.
   *
   * @private
   */
  private onVisibilityChange(): void {
    this.syncWakeLock();
  }

  /**
   * Current storage budget for the simulation grid.
   *
   * @private
   * @returns {number} current maximum bytes.
   */
  private currentMaxBytes(): number {
    return this.maxBytes > 0 ? this.maxBytes : Number.POSITIVE_INFINITY;
  }

  /**
   * Resolves the smallest simulation grid format that fits a ruleset.
   *
   * @private
   * @param {Ruleset} ruleset ruleset to evaluate.
   * @param {number} cols grid columns.
   * @param {number} rows grid rows.
   * @returns {GridFormatMetadata} selected grid format metadata.
   */
  private smallestSimulationGridFormatForRuleset(ruleset: Ruleset = this.ruleset, cols = ruleset.cols, rows = ruleset.rows): GridFormatMetadata {
    return gridFormatMetadata(smallestValidSimulationGridFormat(ruleset.tribes.length, {cols, rows}, this.currentMaxBytes()));
  }

  /**
   * Resolves a preferred simulation grid format or falls back to the smallest fitting format.
   *
   * @private
   * @param {(GridFormatMetadata | null | undefined)} preferred preferred grid format.
   * @param {Ruleset} ruleset ruleset to evaluate.
   * @param {number} cols grid columns.
   * @param {number} rows grid rows.
   * @returns {GridFormatMetadata} selected grid format metadata.
   */
  private resolveSimulationGridFormat(preferred: GridFormatMetadata | null | undefined, ruleset: Ruleset = this.ruleset, cols = ruleset.cols, rows = ruleset.rows): GridFormatMetadata {
    if (preferred?.bitsPerCell !== undefined && isSupportedBitsPerCell(preferred.bitsPerCell) &&
        validatePackingAgainstStateCount(preferred.bitsPerCell, ruleset.tribes.length) &&
        fitsGridFormatInMaxBytes({cols, rows}, gridFormatFromBits(preferred.bitsPerCell), this.currentMaxBytes())) {
      return gridFormatMetadata(gridFormatFromBits(preferred.bitsPerCell));
    }
    return this.smallestSimulationGridFormatForRuleset(ruleset, cols, rows);
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

  /**
   * Synchronizes live metrics inputs from local preference state.
   *
   * @private
   */
  private syncLiveMetrics(): void {
    this.liveMetrics = {
      enabled: this.liveMetricsEnabled,
      sections: this.liveMetricSettings
    };
  }

  /**
   * Requests cancellation for the active or preparing download.
   *
   * @private
   */
  private cancelDownload(): void {
    console.log('[GOLT] Cancelling download');
    this.clearExportFrameOrigin();
    this.downloadCancelRequested = true;
    this.compressionScheduler.notifyWaiters();
    if (this.downloadWorker) {
      this.downloadMainStatus = 'Cancelling download';
      this.downloadWorker.postMessage({type: 'cancel'});
      this.cdr.markForCheck();
    } else {
      this.downloadMainStatus = 'Cancelling download';
      this.compressionScheduler.resume();
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
   * Clears the visible generations-per-second metric without changing other live metrics.
   *
   * @private
   */
  private resetVisibleGenPerSecond(): void {
    if (this.latestMetrics) {
      this.latestMetrics = {
        ...this.latestMetrics,
        fps: 0
      };
      this.cdr.markForCheck();
    }
  }

  /**
   * Clears queued compression and transient recording state for a fresh simulation.
   *
   * @private
   */
  private resetRecordingCompressionState(): void {
    console.info('[GOLT] Clearing compression jobs for simulation reset');
    this.compressionScheduler.terminate();
    this.storagePendingRawBytes = 0;
    this.storageCompressedBytes = 0;
    this.storageReservedBytes = 0;
    this.storageUsedBytes = 0;
    this.quotaWarningLevel = 0;
    this.latestRecordingManifest = null;
    this.downloadEstimateExceedsChunkThreshold = false;
  }

  /**
   * Restarts the simulation state and clears transient recording data.
   *
   * @private
   */
  private restart(): void {
    console.log('[GOLT] Restart requested');
    this.snackBar.dismiss();
    clearTempOpfsDirectory().catch(error => console.warn('[GOLT] Failed to clear temporary OPFS files:', error));
    this.setRunState('paused');
    this.resetRecordingCompressionState();
    this.rebuilding = true;
    this.ruleset = {...this.ruleset};
    this.latestMetrics = null;
  }

  /**
   * Clamps the brush size to the current grid.
   *
   * @private
   * @returns {boolean} true when the brush size changed.
   */
  private clampBrushSize(): boolean {
    const max = Math.max(1, Math.floor(Math.min(this.ruleset.cols, this.ruleset.rows) / 4));
    const nextBrushSize = Math.min(this.brushSize, max);
    const changed = nextBrushSize !== this.brushSize;
    this.brushSize = nextBrushSize;
    return changed;
  }

  /**
   * Prepares a consistent snapshot and optional recording manifest for download.
   *
   * @private
   * @async
   * @param {DownloadRequestPayload} opts download options.
   */
  private async downloadZip(opts: DownloadRequestPayload): Promise<void> {
    await prepareHomeDownload(opts, {
      setDownloadPreview: preview => {
        this.downloadRequestPreview = preview;
      },
      beginExportFrameOrigin: downloadOpts => this.beginExportFrameOrigin(downloadOpts),
      clearExportFrameOrigin: () => this.clearExportFrameOrigin(),
      setCancelRequested: cancelled => {
        this.downloadCancelRequested = cancelled;
      },
      isCancelRequested: () => this.downloadCancelRequested,
      pauseIfRunning: () => {
        if (this.state === 'running') {
          this.setRunState('paused');
          this.engine.setRunning(false);
        }
      },
      setProgress: (progress, status) => {
        this.downloadProgress = progress;
        this.downloadMainStatus = status;
      },
      markForCheck: () => this.cdr.markForCheck(),
      requestRecordingManifest: () => this.requestRecordingManifest(),
      requestSnapshot: () => this.requestDownloadSnapshot(),
      waitForCompression: mode => this.compressionScheduler.waitForDownloadCompression(mode),
      setEstimateExceedsThreshold: exceedsThreshold => {
        this.downloadEstimateExceedsChunkThreshold = exceedsThreshold;
      },
      getTribeCount: () => this.tribes.length,
      startDownloadWorker: (downloadOpts, snap, rec, startedAt) => this.startDownloadWorker(downloadOpts, snap, rec, startedAt),
      resumeCompression: () => this.compressionScheduler.resume(),
      resetDownloadState: () => this.resetDownloadState(),
      openSnack: (message, tone) => openHomeSnack(this.snackBar, message, tone)
    });
  }

  /**
   * Captures and displays the active visual export framing origin.
   *
   * @private
   * @param {DownloadRequestPayload} opts download options.
   * @returns {(ExportFrameOrigin | null)} active export origin.
   */
  private beginExportFrameOrigin(opts: DownloadRequestPayload): ExportFrameOrigin | null {
    let origin: ExportFrameOrigin | null = null;
    if ((opts.png || opts.mp4) && !opts.forceChunkDownload) {
      origin = this.engine.createExportFrameOrigin();
      this.engine.setExportFrameOrigin(origin);
      console.info('[GOLT] Visual export framing origin captured', origin);
    } else {
      this.engine.setExportFrameOrigin(null);
    }
    return origin;
  }

  /**
   * Clears the active visual export framing overlay.
   *
   * @private
   */
  private clearExportFrameOrigin(): void {
    this.engine.setExportFrameOrigin(null);
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
    startHomeDownloadWorker({
      opts,
      snapshot: snap,
      recording: rec,
      ruleset: this.ruleset,
      startedAt
    }, {
      setWorker: worker => {
        this.downloadWorker = worker;
      },
      getWorker: () => this.downloadWorker,
      isCancelRequested: () => this.downloadCancelRequested,
      setCancelRequested: cancelled => {
        this.downloadCancelRequested = cancelled;
      },
      setProgress: (progress, status) => {
        this.downloadProgress = progress;
        this.downloadMainStatus = status;
      },
      resetDownloadState: () => this.resetDownloadState(),
      markForCheck: () => this.cdr.markForCheck(),
      resumeCompression: () => this.compressionScheduler.resume(),
      requestUncompressedChunks: () => this.engine.requestUncompressedChunks(),
      openSnack: (message, tone) => openHomeSnack(this.snackBar, message, tone),
      waitForMinimumVisibleTime: operationStartedAt => this.waitForMinimumVisibleTime(operationStartedAt),
      clearExportFrameOrigin: () => this.clearExportFrameOrigin(),
      downloadBlob: (blob, filename) => this.store$.dispatch(downloadBlob({blob, filename}))
    });
  }

  /**
   * Loads a saved GOLT state from a file buffer.
   *
   * @private
   * @async
   * @param {ArrayBuffer} buffer snapshot file buffer.
   */
  private async loadState(buffer: ArrayBuffer): Promise<void> {
    const startedAt = performance.now();
    this.loadingState = true;
    this.setSnapshotProgress('indeterminate', null, 'Reading snapshot file');
    this.cdr.markForCheck();
    try {
      const parsed = await runSnapshotLoadWorker(buffer, (mode, percent, status) => {
        this.applySnapshotProgress(mode, percent, status);
      });
      await this.waitForMinimumVisibleTime(startedAt);
      if (parsed) {
        this.applyLoadedSnapshot(parsed);
      } else {
        console.warn('[GOLT] Invalid snapshot file selected');
        openHomeSnack(this.snackBar, 'Invalid snapshot file.', 'error');
      }
    } finally {
      this.loadingState = false;
      this.resetSnapshotProgress();
      this.cdr.markForCheck();
    }
  }

  /**
   * Saves the current engine snapshot as a GOLT file.
   *
   * @private
   * @async
   * @param {SnapshotMessage} snap snapshot to save.
   */
  private async saveGoltState(snap: SnapshotMessage): Promise<void> {
    const startedAt = performance.now();
    console.log('[GOLT] Clearing temporary OPFS files before snapshot save');
    await clearTempOpfsDirectory();
    const saved = await runSnapshotSaveWorker(snap, this.ruleset, (mode, percent, status) => {
      this.applySnapshotProgress(mode, percent, status);
    });
    await this.waitForMinimumVisibleTime(startedAt);
    this.store$.dispatch(downloadBlob({blob: saved.blob, filename: saved.filename}));
  }

  /**
   * Keeps progress UI visible for a minimum duration.
   *
   * @private
   * @async
   * @param {number} startedAt operation start timestamp.
   */
  private async waitForMinimumVisibleTime(startedAt: number): Promise<void> {
    const elapsed = performance.now() - startedAt;
    if (elapsed < MINIMUM_PROGRESS_VISIBLE_MS) {
      await new Promise(resolve => setTimeout(resolve, MINIMUM_PROGRESS_VISIBLE_MS - elapsed));
    }
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
      topology: parsed.topology,
      boundaryTribe: this.normalizeBoundaryTribe(parsed.boundaryTribe, parsed.tribes),
      randomSeed: normalizeRandomSeed(parsed.randomSeed),
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
    this.resetRecordingCompressionState();
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

  /**
   * Dispatches one sidebar event by action.
   *
   * @private
   * @param {SidebarEvent} event sidebar event.
   * @returns {boolean} true when preferences should be saved.
   */
  private handleHomeSidebarEvent(event: SidebarEvent): boolean {
    let shouldSavePreferences = false;
    switch (event.action) {
      case 'toggleRun':
        this.toggleRun();
        break;
      case 'restart':
        this.restart();
        break;
      case 'selectTribe':
        this.deleteMode = false;
        this.drawTribes = [event.value];
        this.drawTribeIndex = this.tribes.findIndex(t => t.id === event.value);
        break;
      case 'selectTribes':
        this.drawTribes = event.value;
        this.deleteMode = this.drawTribes.length === 1 && this.drawTribes[0] === DEAD_TRIBE_ID;
        if (!this.deleteMode && this.drawTribes.length === 1) {
          this.drawTribeIndex = this.tribes.findIndex(t => t.id === this.drawTribes[0]);
        }
        break;
      case 'setSpeed':
        this.speed = event.value;
        this.maxSpeed = false;
        console.log(FIXED_SPEED_LOG_MESSAGE, {speed: this.speed});
        shouldSavePreferences = true;
        break;
      case 'setMaxSpeed':
        this.maxSpeed = event.value;
        console.log(`[GOLT] Max speed ${this.toggleStateLabel(this.maxSpeed)}`);
        shouldSavePreferences = true;
        break;
      case 'setRecording':
        this.recording = event.value && this.recordingAvailable && this.recordingStorageAvailable;
        console.log(`[GOLT] Recording ${this.toggleStateLabel(this.recording)}`);
        if (this.recording) {
          this.compressionScheduler.ensurePool();
        }
        if (!this.recording) {
          this.compressionScheduler.requeueDeferredJobs();
        }
        shouldSavePreferences = true;
        break;
      case 'setLiveMetrics':
        this.liveMetricsEnabled = event.value.enabled;
        this.liveMetricSettings = normalizeLiveMetricSectionSettings(event.value.sections);
        console.log(`[GOLT] Live metrics ${this.toggleStateLabel(this.liveMetricsEnabled)}`, {sections: this.liveMetricSettings});
        this.syncLiveMetrics();
        shouldSavePreferences = true;
        break;
      case 'setPopulationExpanded':
        this.populationExpanded = event.value;
        shouldSavePreferences = true;
        break;
      case 'setDiversityExpanded':
        this.diversityExpanded = event.value;
        shouldSavePreferences = true;
        break;
      case 'setInterfacesExpanded':
        this.interfacesExpanded = event.value;
        shouldSavePreferences = true;
        break;
      case 'setGridSize':
        this.resetRecordingCompressionState();
        this.rebuilding = true;
        this.simulationGridFormat = this.resolveSimulationGridFormat(this.simulationGridFormat, this.ruleset, event.value.cols, event.value.rows);
        this.ruleset = {
          ...this.ruleset,
          cols: event.value.cols,
          rows: event.value.rows,
          topology: event.value.topology,
          boundaryTribe: this.normalizeBoundaryTribe(event.value.boundaryTribe, this.ruleset.tribes)
        };
        this.latestMetrics = null;
        shouldSavePreferences = true;
        this.clampBrushSize();
        break;
      case 'setPacking':
        this.resetRecordingCompressionState();
        this.rebuilding = true;
        this.simulationGridFormat = this.resolveSimulationGridFormat({bitsPerCell: event.value});
        this.latestMetrics = null;
        break;
      case 'downloadSettingsChange':
        this.downloadRequestPreview = event.value;
        this.refreshDownloadEstimateFlag();
        break;
      case 'download':
        this.downloadZip(event.value);
        break;
      case 'cancelDownload':
        this.cancelDownload();
        break;
      case 'saveState':
        this.savingState = true;
        this.setSnapshotProgress('indeterminate', null, PREPARING_SNAPSHOT_STATUS);
        this.cdr.markForCheck();
        this.engine.requestSnapshot();
        break;
      case 'loadState':
        this.loadState(event.value);
        break;
      case 'deleteMode':
        this.deleteMode = !this.deleteMode;
        this.drawTribes = this.deleteMode ? [DEAD_TRIBE_ID] : [this.tribes[this.drawTribeIndex]!.id];
        break;
      case 'updateTribes':
        shouldSavePreferences = this.applyCommittedRuleset({
          ...this.ruleset,
          boundaryTribe: applyBoundaryTribeRenames(this.ruleset.boundaryTribe, event.value.renamePairs),
          tribes: event.value.tribes,
          rules: applyRuleTribeRenames(this.ruleset.rules, event.value.renamePairs)
        });
        break;
      case 'updateRules':
        shouldSavePreferences = this.applyCommittedRuleset({
          ...this.ruleset,
          randomSeed: event.value.randomSeed,
          rules: event.value.rules
        });
        break;
      case 'stepBack':
        this.resetVisibleGenPerSecond();
        this.engine.stepBack(event.value);
        break;
      case 'stepForward':
        this.engine.stepForward(event.value);
        break;
      case 'togglePanMode':
        this.panMode = !this.panMode;
        break;
      case 'setBrushSize':
        this.brushSize = event.value;
        shouldSavePreferences = true;
        break;
      case 'setBrushShape':
        this.brushShape = event.value;
        shouldSavePreferences = true;
        break;
      case 'setBrushFill':
        this.brushFill = event.value;
        shouldSavePreferences = true;
        break;
      case 'setBrushDensity':
        this.brushDensityByFill = {
          ...this.brushDensityByFill,
          [this.brushFill]: clampBrushDensity(event.value)
        };
        shouldSavePreferences = true;
        break;
      case 'applyPreset':
        shouldSavePreferences = this.applyPreset(event.value);
        break;
    }
    return shouldSavePreferences;
  }
}
