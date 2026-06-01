import {ChangeDetectorRef, Component, OnDestroy, ViewChild} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSnackBar, MatSnackBarConfig, MatSnackBarModule} from '@angular/material/snack-bar';
import {RouterModule} from '@angular/router';

import {Engine} from './component/engine/engine';
import {Sidebar} from './component/sidebar/sidebar';
import {fitsGridFormatInMaxBytes, gridFormatFromBits, gridFormatMetadata, isSupportedBitsPerCell, requiredGridFormatForStateCount, smallestFittingSimulationGridFormat, smallestValidSimulationGridFormat, validatePackingAgainstStateCount} from './logic/grid-format';
import {normalizeLiveMetricSectionSettings} from './logic/metric-settings';
import {clearTempOpfsDirectory} from './logic/opfs-temp';
import {applyRuleTribeRenames} from './logic/tribe-impact';
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
  /**
   * Engine component instance.
   *
   * @public
   * @type {Engine<Tribe[]>}
   */
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

  /**
   * Current simulation ruleset.
   *
   * @public
   * @type {Ruleset}
   */
  public ruleset: Ruleset = CONWAY_PRESET.ruleset;

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
   * Background compression worker pool.
   *
   * @private
   * @type {Worker[]}
   */
  private compressPool: Worker[] = [];

  /**
   * Round-robin compression worker index.
   *
   * @private
   * @type {number}
   */
  private compressPoolIndex = 0;

  /**
   * Compression jobs waiting for dispatch.
   *
   * @private
   * @type {QueuedCompressionJob[]}
   */
  private pendingCompressionJobs: QueuedCompressionJob[] = [];

  /**
   * Compression jobs deferred after retry exhaustion.
   *
   * @private
   * @type {QueuedCompressionJob[]}
   */
  private deferredCompressionJobs: QueuedCompressionJob[] = [];

  /**
   * Compression jobs currently active by filename.
   *
   * @private
   * @readonly
   * @type {Map<string, QueuedCompressionJob>}
   */
  private readonly activeCompressionJobs = new Map<string, QueuedCompressionJob>();

  /**
   * Pending compression retry timers.
   *
   * @private
   * @type {ReturnType<typeof setTimeout>[]}
   */
  private compressionRetryTimers: ReturnType<typeof setTimeout>[] = [];

  /**
   * Raw bytes currently active in compression workers.
   *
   * @private
   * @type {number}
   */
  private activeCompressionBytes = 0;

  /**
   * Whether compression dispatch is paused for download preparation.
   *
   * @private
   * @type {boolean}
   */
  private compressionDispatchPaused = false;

  /**
   * Promise resolvers waiting for compression queue changes.
   *
   * @private
   * @readonly
   * @type {Set<() => void>}
   */
  private readonly compressionDrainResolvers = new Set<() => void>();

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
   * Minimum progress UI visibility duration.
   *
   * @private
   * @readonly
   * @type {number}
   */
  private readonly minimumProgressVisibleMs = 1000;

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
   */
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

  /**
   * @inheritdoc
   */
  public ngOnDestroy(): void {
    console.log('[GOLT] Home page destroyed');
    this.keydownListenerController.abort();
    this.terminateCompressWorker();
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
      this.requeueDeferredCompressionJobs();
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
    this.openSnack('GPU device lost — simulation stopped. Try resetting to a smaller grid or reloading the page.', 'error', 0);
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
    this.openSnack(`GPU error: ${data.reason}`, 'error');
    this.openSnack(`GPU error: ${data.reason}`, 'error');
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
    this.refreshDownloadEstimateFlag();
    if (data.quotaBytes <= 0) {
      return;
    }
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

  /**
   * Queues a sealed recording chunk for background compression.
   *
   * @public
   * @param {ChunkSealedMessage} data sealed chunk message.
   */
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

  /**
   * Requeues engine-reported chunks that are still uncompressed.
   *
   * @public
   * @param {UncompressedChunksMessage} data uncompressed chunks message.
   */
  public onUncompressedChunks(data: UncompressedChunksMessage): void {
    for (const chunk of data.chunks) {
      this.onChunkSealed({type: 'chunkSealed', ...chunk});
    }
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
          this.openSnack('Snapshot save failed. Try again.', 'error');
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
   * Handles a sidebar command.
   *
   * @public
   * @param {SidebarEvent} ev sidebar event.
   */
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

  /**
   * Applies a ruleset and selects a valid simulation grid format.
   *
   * @private
   * @param {Ruleset} newRuleset ruleset to apply.
   * @param {boolean} preferSmallestFormat whether to prefer the smallest valid format.
   * @returns {boolean} true when persisted draw preferences changed.
   */
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

  /**
   * Handles global keyboard shortcuts.
   *
   * While stepping, only the spacebar shortcut remains active so it can cancel the step.
   *
   * @private
   * @param {KeyboardEvent} ev keyboard event.
   */
  private handleKeydown(ev: KeyboardEvent): void {
    if (this.downloadProgress >= 0) {
      return;
    }
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

  /**
   * Handles brush keyboard shortcuts.
   *
   * @private
   * @param {string} key pressed key.
   * @returns {{ handled: boolean; shouldSavePreferences: boolean }} shortcut result.
   */
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
      const t = active.type;
      return t !== 'checkbox' && t !== 'radio';
    }
    return false;
  }

  /**
   * Toggles simulation run state.
   *
   * @private
   */
  private toggleRun(): void {
    if (this.stepping) {
      this.cancelStepping();
      return;
    }
    this.setRunState(this.state === 'paused' ? 'running' : 'paused');
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
      this.requeueDeferredCompressionJobs();
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

  /**
   * Releases the active wake lock.
   *
   * @private
   */
  private releaseWakeLock(): void {
    const lock = this.wakeLock;
    this.wakeLock = null;
    if (!lock) {
      return;
    }
    console.log('[GOLT] Screen wake lock released');
    lock.release().catch(error => console.warn('Failed to release screen wake lock:', error));
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
   * Terminates compression workers and clears pending compression state.
   *
   * @private
   */
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

  /**
   * Resumes compression dispatch after a download wait.
   *
   * @private
   */
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
   * Creates the background compression worker pool.
   *
   * @private
   */
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

  /**
   * Requests cancellation for the active or preparing download.
   *
   * @private
   */
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

  /**
   * Opens a snackbar and logs the same message.
   *
   * @private
   * @param {string} message snackbar message.
   * @param {'info' | 'warning' | 'error'} tone snackbar tone.
   * @param {number} duration snackbar duration in milliseconds.
   */
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
    const saved = await this.buildGoltFile(snap);
    await this.waitForMinimumVisibleTime(startedAt);
    this.downloadBlob(saved.blob, saved.filename);
  }

  /**
   * Builds a GOLT file from a snapshot.
   *
   * @private
   * @async
   * @param {SnapshotMessage} snap snapshot to encode.
   * @returns {Promise<SnapshotSaveOutput>} saved snapshot output.
   */
  private async buildGoltFile(snap: SnapshotMessage): Promise<SnapshotSaveOutput> {
    return this.runSnapshotSaveWorker(snap);
  }

  /**
   * Parses a GOLT file buffer.
   *
   * @private
   * @async
   * @param {ArrayBuffer} buffer file buffer.
   * @returns {Promise<ParsedGoltState | null>} parsed state or null when invalid.
   */
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

  /**
   * Starts a browser download for a blob.
   *
   * @private
   * @param {Blob} blob download data.
   * @param {string} filename download filename.
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Runs the snapshot worker in save mode.
   *
   * @private
   * @param {SnapshotMessage} snap snapshot to save.
   * @returns {Promise<SnapshotSaveOutput>} saved snapshot output.
   */
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

  /**
   * Runs the snapshot worker in load mode.
   *
   * @private
   * @param {ArrayBuffer} buffer snapshot file buffer.
   * @returns {Promise<ParsedGoltState | null>} parsed state or null when invalid.
   */
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

  /**
   * Keeps progress UI visible for a minimum duration.
   *
   * @private
   * @async
   * @param {number} startedAt operation start timestamp.
   */
  private async waitForMinimumVisibleTime(startedAt: number): Promise<void> {
    const elapsed = performance.now() - startedAt;
    if (elapsed < this.minimumProgressVisibleMs) {
      await new Promise(resolve => setTimeout(resolve, this.minimumProgressVisibleMs - elapsed));
    }
  }

  /**
   * Normalizes persisted draw-section preferences.
   *
   * @private
   * @param {(Partial<DrawSectionPreferences> | undefined)} stored stored preferences.
   * @param {DrawSectionPreferences} defaults default preferences.
   * @returns {DrawSectionPreferences} normalized preferences.
   */
  private normalizeDrawSectionPreferences(stored: Partial<DrawSectionPreferences> | undefined, defaults: DrawSectionPreferences): DrawSectionPreferences {
    const normalizedStored = stored ?? {};
    return {
      brushSize: typeof normalizedStored.brushSize === 'number' && normalizedStored.brushSize >= 1 ? Math.floor(normalizedStored.brushSize) : defaults.brushSize,
      brushShape: normalizedStored.brushShape && BRUSH_SHAPE_VALUES.includes(normalizedStored.brushShape) ? normalizedStored.brushShape : defaults.brushShape,
      brushFill: normalizedStored.brushFill && BRUSH_FILL_VALUES.includes(normalizedStored.brushFill) ? normalizedStored.brushFill : defaults.brushFill
    };
  }

  /**
   * Normalizes persisted speed-section preferences.
   *
   * @private
   * @param {(Partial<SpeedSectionPreferences> | undefined)} stored stored preferences.
   * @param {SpeedSectionPreferences} defaults default preferences.
   * @returns {SpeedSectionPreferences} normalized preferences.
   */
  private normalizeSpeedSectionPreferences(stored: Partial<SpeedSectionPreferences> | undefined, defaults: SpeedSectionPreferences): SpeedSectionPreferences {
    const normalizedStored = stored ?? {};
    return {
      speed: typeof normalizedStored.speed === 'number' && normalizedStored.speed >= 1 ? Math.floor(normalizedStored.speed) : defaults.speed,
      maxSpeed: typeof normalizedStored.maxSpeed === 'boolean' ? normalizedStored.maxSpeed : defaults.maxSpeed,
      recording: typeof normalizedStored.recording === 'boolean' ? normalizedStored.recording : defaults.recording,
      liveMetricsEnabled: typeof normalizedStored.liveMetricsEnabled === 'boolean' ? normalizedStored.liveMetricsEnabled : defaults.liveMetricsEnabled
    };
  }

  /**
   * Normalizes persisted metrics-section preferences.
   *
   * @private
   * @param {(Partial<MetricsSectionPreferences> | undefined)} stored stored preferences.
   * @param {MetricsSectionPreferences} defaults default preferences.
   * @returns {MetricsSectionPreferences} normalized preferences.
   */
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
