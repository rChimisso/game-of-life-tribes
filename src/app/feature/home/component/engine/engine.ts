import {AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild} from '@angular/core';

import {EngineInputController} from './logic/engine-input-controller';
import {EngineViewport} from './logic/engine-viewport';
import {EngineWorkerClient} from './logic/engine-worker-client';
import {normalizeLiveMetricsSettings} from '../../logic/metric-settings';
import {BrushFill, BrushShape} from '../../model/draw-mode';
import {ExportFrameOrigin} from '../../model/export-frame-origin';
import {GridFormatMetadata} from '../../model/grid-format';
import {DEFAULT_LIVE_METRICS_SETTINGS, LiveMetricsSettings} from '../../model/metrics';
import {Ruleset, Tribe} from '../../model/rule';
import {BackpressureMessage, ChunkSealedMessage, ChunksSavingMessage, DeviceLostMessage, GenerationMessage, GpuErrorMessage, LimitsMessage, MetricMessage, RebuildingMessage, RecordingMessage, RecordingStoppedMessage, SnapshotMessage, SteppingMessage, StorageQuotaMessage, UncompressedChunksMessage} from '../../model/worker-message';

import {TypedChanges} from '~gol/core/model/typed-change';

/**
 * Canvas-backed simulation engine component.
 *
 * @class Engine
 * @typedef {Engine}
 * @implements {AfterViewInit}
 * @implements {OnChanges}
 * @implements {OnDestroy}
 */
@Component({
  selector: 'gol-engine',
  templateUrl: './engine.html',
  styleUrls: ['./engine.scss'],
  host: {
    '(wheel)': 'onWheel($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerUp($event)',
    '(pointerleave)': 'onPointerLeave()',
    '(contextmenu)': 'disableCtx($event)',
    '(window:resize)': 'onResize()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Engine<T extends readonly Tribe[]> implements AfterViewInit, OnChanges, OnDestroy {
  /**
   * Engine canvas element reference.
   *
   * @public
   * @type {ElementRef<HTMLCanvasElement>}
   */
  @ViewChild('engineCanvas', {static: true})
  public canvasRef!: ElementRef<HTMLCanvasElement>;

  /**
   * Current simulation ruleset.
   *
   * @public
   * @type {Ruleset<T>}
   */
  @Input()
  public ruleset!: Ruleset<T>;

  /**
   * Current simulation grid format.
   *
   * @public
   * @type {GridFormatMetadata}
   */
  @Input()
  public simulationGridFormat: GridFormatMetadata = {bitsPerCell: 8};

  /**
   * Simulation speed multiplier.
   *
   * @public
   * @type {number}
   */
  @Input()
  public speed = 1;

  /**
   * Simulation run state.
   *
   * @public
   * @type {'running' | 'paused'}
   */
  @Input()
  public state: 'running' | 'paused' = 'paused';

  /**
   * Whether recording is active.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public isRecording = false;

  /**
   * Live metrics configuration.
   *
   * @public
   * @type {LiveMetricsSettings}
   */
  @Input()
  public liveMetrics: LiveMetricsSettings = DEFAULT_LIVE_METRICS_SETTINGS;

  /**
   * Tribe ids used by drawing.
   *
   * @public
   * @type {string[]}
   */
  @Input()
  public drawTribes: string[] = [];

  /**
   * Whether touch interactions should pan instead of draw.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public panMode = false;

  /**
   * Whether canvas input is blocked by page overlays.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public inputBlocked = false;

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
   * Brush density percentage.
   *
   * @public
   * @type {number}
   */
  @Input()
  public brushDensity = 100;

  /**
   * Metrics output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<MetricMessage>}
   */
  @Output()
  public readonly metrics = new EventEmitter<MetricMessage>();

  /**
   * Snapshot output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<SnapshotMessage>}
   */
  @Output()
  public readonly snapshot = new EventEmitter<SnapshotMessage>();

  /**
   * Recording output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<RecordingMessage>}
   */
  @Output()
  public readonly recording = new EventEmitter<RecordingMessage>();

  /**
   * Recording stopped output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<RecordingStoppedMessage>}
   */
  @Output()
  public readonly recordingStopped = new EventEmitter<RecordingStoppedMessage>();

  /**
   * Engine limits output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<LimitsMessage>}
   */
  @Output()
  public readonly limits = new EventEmitter<LimitsMessage>();

  /**
   * Stepping status output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<SteppingMessage>}
   */
  @Output()
  public readonly stepping = new EventEmitter<SteppingMessage>();

  /**
   * Chunk-saving status output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<ChunksSavingMessage>}
   */
  @Output()
  public readonly chunksSaving = new EventEmitter<ChunksSavingMessage>();

  /**
   * Backpressure status output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<BackpressureMessage>}
   */
  @Output()
  public readonly backpressure = new EventEmitter<BackpressureMessage>();

  /**
   * Storage quota output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<StorageQuotaMessage>}
   */
  @Output()
  public readonly storageQuota = new EventEmitter<StorageQuotaMessage>();

  /**
   * Sealed chunk output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<ChunkSealedMessage>}
   */
  @Output()
  public readonly chunkSealed = new EventEmitter<ChunkSealedMessage>();

  /**
   * Uncompressed chunks output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<UncompressedChunksMessage>}
   */
  @Output()
  public readonly uncompressedChunks = new EventEmitter<UncompressedChunksMessage>();

  /**
   * Generation output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<GenerationMessage>}
   */
  @Output()
  public readonly generation = new EventEmitter<GenerationMessage>();

  /**
   * Rebuild status output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<RebuildingMessage>}
   */
  @Output()
  public readonly rebuilding = new EventEmitter<RebuildingMessage>();

  /**
   * Device-loss output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<DeviceLostMessage>}
   */
  @Output()
  public readonly deviceLost = new EventEmitter<DeviceLostMessage>();

  /**
   * GPU error output stream.
   *
   * @public
   * @readonly
   * @type {EventEmitter<GpuErrorMessage>}
   */
  @Output()
  public readonly gpuError = new EventEmitter<GpuErrorMessage>();

  /**
   * Camera math helper.
   *
   * @private
   * @readonly
   * @type {EngineViewport}
   */
  private readonly viewport = new EngineViewport(() => this.canvasRef.nativeElement, () => this.ruleset);

  /**
   * Worker message client.
   *
   * @private
   * @readonly
   * @type {EngineWorkerClient}
   */
  private readonly workerClient = new EngineWorkerClient({
    metrics: message => this.metrics.emit(message),
    snapshot: message => this.snapshot.emit(message),
    recording: message => this.recording.emit(message),
    recordingStopped: message => this.recordingStopped.emit(message),
    limits: message => this.limits.emit(message),
    stepping: message => this.stepping.emit(message),
    chunksSaving: message => this.chunksSaving.emit(message),
    backpressure: message => this.backpressure.emit(message),
    storageQuota: message => this.storageQuota.emit(message),
    chunkSealed: message => this.chunkSealed.emit(message),
    uncompressedChunks: message => this.uncompressedChunks.emit(message),
    generation: message => this.generation.emit(message),
    rebuilding: message => this.rebuilding.emit(message),
    deviceLost: message => this.deviceLost.emit(message),
    gpuError: message => this.gpuError.emit(message)
  });

  /**
   * Pointer input controller.
   *
   * @private
   * @readonly
   * @type {EngineInputController}
   */
  private readonly inputController = new EngineInputController(
    this.viewport,
    this.workerClient,
    () => this.inputBlocked,
    () => this.panMode,
    () => ({
      size: this.brushSize,
      shape: this.brushShape,
      fill: this.brushFill,
      density: this.brushDensity,
      tribes: this.drawTribes
    }),
    () => window.devicePixelRatio || 1
  );

  /**
   * Pending animation frame for coalesced resize work.
   *
   * @private
   * @type {(number | null)}
   */
  private pendingResizeFrame: number | null = null;

  /**
   * Latest pending canvas width in device pixels.
   *
   * @private
   * @type {number}
   */
  private pendingResizeWidth = 0;

  /**
   * Latest pending canvas height in device pixels.
   *
   * @private
   * @type {number}
   */
  private pendingResizeHeight = 0;

  /**
   * Last worker canvas width applied in device pixels.
   *
   * @private
   * @type {number}
   */
  private appliedCanvasWidth = 0;

  /**
   * Last worker canvas height applied in device pixels.
   *
   * @private
   * @type {number}
   */
  private appliedCanvasHeight = 0;

  /**
   * Zooms the canvas around the wheel pointer position.
   *
   * @public
   * @param {WheelEvent} ev wheel event.
   */
  public onWheel(ev: WheelEvent): void {
    this.inputController.handleWheel(ev);
  }

  /**
   * Starts a draw, pan, or pinch interaction.
   *
   * @public
   * @param {PointerEvent} ev pointer event.
   */
  public onPointerDown(ev: PointerEvent): void {
    this.inputController.handlePointerDown(ev);
  }

  /**
   * Updates the active pointer interaction or hover preview.
   *
   * @public
   * @param {PointerEvent} ev pointer event.
   */
  public onPointerMove(ev: PointerEvent): void {
    this.inputController.handlePointerMove(ev);
  }

  /**
   * Finishes the active pointer interaction for one pointer.
   *
   * @public
   * @param {PointerEvent} ev pointer event.
   */
  public onPointerUp(ev: PointerEvent): void {
    this.inputController.handlePointerUp(ev);
  }

  /**
   * Clears hover preview when the pointer leaves the canvas.
   */
  public onPointerLeave(): void {
    this.inputController.handlePointerLeave();
  }

  /**
   * Disables the browser context menu on the canvas surface.
   *
   * @public
   * @param {Event} ev context menu event.
   */
  public disableCtx(ev: Event): void {
    ev.preventDefault();
  }

  /**
   * Resizes the worker canvas and refreshes camera constraints.
   *
   * @public
   */
  public onResize(): void {
    if (this.ruleset && this.workerClient.initialized) {
      this.capturePendingResize();
      if (this.pendingResizeFrame === null) {
        this.pendingResizeFrame = requestAnimationFrame(() => this.flushPendingResize());
      }
    }
  }

  /**
   * @inheritdoc
   */
  public ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    this.appliedCanvasWidth = canvas.width;
    this.appliedCanvasHeight = canvas.height;
    const offscreen = canvas.transferControlToOffscreen();
    this.workerClient.initialize({
      type: 'init',
      canvas: offscreen,
      ruleset: this.ruleset,
      simulationGridFormat: this.simulationGridFormat,
      recording: this.isRecording,
      speed: this.speed,
      running: this.state === 'running',
      liveMetrics: normalizeLiveMetricsSettings(this.liveMetrics)
    }, [offscreen]);
    this.resetCamera();
  }

  /**
   * Requests a snapshot from the engine worker.
   *
   * @public
   */
  public requestSnapshot(): void {
    this.workerClient.requestSnapshot();
  }

  /**
   * Loads a snapshot into the engine worker.
   *
   * @public
   * @param {Uint32Array} grid snapshot grid.
   * @param {number} generation snapshot generation.
   * @param {GridFormatMetadata} gridFormat snapshot grid format.
   */
  public loadSnapshot(grid: Uint32Array, generation: number, gridFormat: GridFormatMetadata): void {
    this.workerClient.loadSnapshot(grid, generation, gridFormat);
  }

  /**
   * Updates recording state in the engine worker.
   *
   * @public
   * @param {boolean} recording whether recording is enabled.
   */
  public setRecording(recording: boolean): void {
    this.workerClient.setRecording(recording);
  }

  /**
   * Updates simulation run state in the engine worker.
   *
   * @public
   * @param {boolean} running whether the simulation should run.
   */
  public setRunning(running: boolean): void {
    this.workerClient.setRunning(running);
  }

  /**
   * Requests the current recording manifest from the engine worker.
   *
   * @public
   */
  public requestRecording(): void {
    this.workerClient.requestRecording();
  }

  /**
   * Requests a backward stepping operation.
   *
   * @public
   * @param {number} count step count.
   */
  public stepBack(count: number): void {
    this.workerClient.stepBack(count);
  }

  /**
   * Requests a forward stepping operation.
   *
   * @public
   * @param {number} count step count.
   */
  public stepForward(count: number): void {
    this.workerClient.stepForward(count);
  }

  /**
   * Cancels the active stepping operation.
   *
   * @public
   */
  public cancelStepping(): void {
    this.workerClient.cancelStepping();
  }

  /**
   * Updates one recording chunk codec after compression completes.
   *
   * @public
   * @param {string} filename chunk filename.
   * @param {number} rawBytes raw chunk byte count.
   * @param {string} codec stored chunk codec.
   * @param {number} storedBytes stored chunk byte count.
   * @param {GridFormatMetadata} gridFormat stored chunk grid format.
   */
  public updateChunkCodec(filename: string, rawBytes: number, codec: string, storedBytes: number, gridFormat: GridFormatMetadata): void {
    this.workerClient.updateChunkCodec(filename, rawBytes, codec, storedBytes, gridFormat);
  }

  /**
   * Requests chunks that still need compression.
   *
   * @public
   */
  public requestUncompressedChunks(): void {
    this.workerClient.requestUncompressedChunks();
  }

  /**
   * Resolves the current full-grid visual export origin.
   *
   * @public
   * @returns {ExportFrameOrigin} wrapped export frame origin.
   */
  public createExportFrameOrigin(): ExportFrameOrigin {
    return this.viewport.createCenteredExportFrameOrigin();
  }

  /**
   * Updates the grid-relative visual export framing overlay.
   *
   * @public
   * @param {(ExportFrameOrigin | null)} origin active export origin.
   */
  public setExportFrameOrigin(origin: ExportFrameOrigin | null): void {
    this.workerClient.setExportFrameOrigin(origin);
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<Engine<T>>): void {
    if (this.workerClient.initialized) {
      if (changes.state) {
        this.workerClient.setRunning(this.state === 'running');
      }
      if (changes.isRecording) {
        this.workerClient.setRecording(this.isRecording);
      }
      if (changes.speed) {
        this.workerClient.setSpeed(this.speed);
      }
      if (changes.liveMetrics) {
        this.workerClient.setLiveMetrics(normalizeLiveMetricsSettings(this.liveMetrics));
      }
      if (changes.ruleset || changes.simulationGridFormat) {
        this.workerClient.setRuleset(this.ruleset, this.simulationGridFormat);
        const prevRuleset = changes.ruleset?.previousValue;
        if (!(prevRuleset && prevRuleset.rows === this.ruleset.rows && prevRuleset.cols === this.ruleset.cols && prevRuleset.topology === this.ruleset.topology)) {
          this.resetCamera();
        }
      }
      this.syncBrushPreviewInputChanges(changes);
    }
  }

  /**
   * @inheritdoc
   */
  public ngOnDestroy(): void {
    this.cancelPendingResize();
    this.workerClient.terminate();
  }

  /**
   * Resets the camera to the full-grid view.
   *
   * @private
   */
  private resetCamera(): void {
    this.viewport.reset();
    this.inputController.sendCamera();
  }

  /**
   * Keeps the rendered brush preview aligned when brush inputs change.
   *
   * @private
   * @param {TypedChanges<Engine<T>>} changes input changes.
   */
  private syncBrushPreviewInputChanges(changes: TypedChanges<Engine<T>>): void {
    const inputBlockedChangedToBlocked = Boolean(changes.inputBlocked && this.inputBlocked);
    const brushPreviewInputChanged = Boolean(changes.brushSize || changes.brushShape || changes.panMode);
    this.inputController.syncBrushPreviewInputChanges(inputBlockedChangedToBlocked, brushPreviewInputChanged);
  }

  /**
   * Captures the latest canvas size requested by the browser resize stream.
   *
   * @private
   */
  private capturePendingResize(): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.pendingResizeWidth = Math.round(rect.width * dpr);
    this.pendingResizeHeight = Math.round(rect.height * dpr);
  }

  /**
   * Applies the latest coalesced canvas resize to the worker.
   *
   * @private
   */
  private flushPendingResize(): void {
    this.pendingResizeFrame = null;
    if (this.pendingResizeWidth > 0 && this.pendingResizeHeight > 0) {
      const sizeChanged = this.pendingResizeWidth !== this.appliedCanvasWidth || this.pendingResizeHeight !== this.appliedCanvasHeight;
      this.viewport.refreshScaleBounds();
      if (sizeChanged) {
        this.workerClient.resize(this.pendingResizeWidth, this.pendingResizeHeight);
        this.appliedCanvasWidth = this.pendingResizeWidth;
        this.appliedCanvasHeight = this.pendingResizeHeight;
      }
      this.inputController.sendCamera();
    }
  }

  /**
   * Cancels any pending coalesced resize frame.
   *
   * @private
   */
  private cancelPendingResize(): void {
    if (this.pendingResizeFrame !== null) {
      cancelAnimationFrame(this.pendingResizeFrame);
      this.pendingResizeFrame = null;
    }
  }
}
