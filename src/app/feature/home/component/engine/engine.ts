import {AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild} from '@angular/core';

import {BrushFill, BrushShape, TouchMode} from '../../model/draw-mode';
import {GridFormatMetadata} from '../../model/grid-format';
import {DEFAULT_LIVE_METRICS_SETTINGS, LiveMetricsSettings} from '../../model/metrics';
import {Ruleset, Tribe} from '../../model/rule';
import {BackpressureMessage, ChunkSealedMessage, ChunksSavingMessage, DeviceLostMessage, GenerationMessage, GpuErrorMessage, LimitsMessage, MetricMessage, RebuildingMessage, RecordingMessage, SnapshotMessage, SteppingMessage, StorageQuotaMessage, UncompressedChunksMessage} from '../../model/worker-message';
import {normalizeLiveMetricsSettings} from '../../util/metric-settings';

import {TypedChanges} from '~gol/core/model/typed-change';

/**
 * Canvas-backed simulation engine component.
 *
 * @export
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
    '(pointerleave)': 'onPointerLeave($event)',
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
   * Base maximum camera scale.
   *
   * @private
   * @readonly
   * @type {number}
   */
  private static readonly baseMaxScale = 128;

  /**
   * Render worker instance.
   *
   * @private
   * @type {(Worker | undefined)}
   */
  private worker?: Worker;

  /**
   * Current camera scale.
   *
   * @private
   * @type {number}
   */
  private scale = 1;

  /**
   * Current camera x offset.
   *
   * @private
   * @type {number}
   */
  private offsetX = 0;

  /**
   * Current camera y offset.
   *
   * @private
   * @type {number}
   */
  private offsetY = 0;

  /**
   * Minimum camera scale.
   *
   * @private
   * @type {number}
   */
  private minScale = 1;

  /**
   * Maximum camera scale.
   *
   * @private
   * @type {number}
   */
  private maxScale = Engine.baseMaxScale;

  /**
   * Active pointers by id.
   *
   * @private
   * @readonly
   * @type {Map<number, {x: number; y: number}>}
   */
  private readonly pointers = new Map<number, {x: number; y: number}>();

  /**
   * Current pointer interaction mode.
   *
   * @private
   * @type {'idle' | TouchMode | 'pinch'}
   */
  private mode: 'idle' | TouchMode | 'pinch' = 'idle';

  /**
   * Primary pointer id for the active interaction.
   *
   * @private
   * @type {number}
   */
  private primaryPointerId = -1;

  /**
   * Deferred touch draw point.
   *
   * @private
   * @type {({x: number; y: number} | null)}
   */
  private touchPendingDraw: {x: number; y: number} | null = null;

  /**
   * Previous pinch distance in client pixels.
   *
   * @private
   * @type {number}
   */
  private lastPinchDist = 0;

  /**
   * Last cell used by the brush preview.
   *
   * @private
   * @type {({x: number; y: number} | null)}
   */
  private lastPreviewCell: {x: number; y: number} | null = null;

  /**
   * Zooms the canvas around the wheel pointer position.
   *
   * @public
   * @param {WheelEvent} ev wheel event.
   */
  public onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    if (!this.inputBlocked) {
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      const worldX = cx / this.scale + this.offsetX;
      const worldY = cy / this.scale + this.offsetY;
      const factor = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
      this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
      this.offsetX = worldX - cx / this.scale;
      this.offsetY = worldY - cy / this.scale;
      this.sendCamera();
    }
  }

  /**
   * Starts a draw, pan, or pinch interaction.
   *
   * @public
   * @param {PointerEvent} ev pointer event.
   */
  public onPointerDown(ev: PointerEvent): void {
    ev.preventDefault();
    if (!this.inputBlocked) {
      (document.activeElement as HTMLElement)?.blur?.();
      (ev.target as Element).setPointerCapture(ev.pointerId);
      this.pointers.set(ev.pointerId, {x: ev.clientX, y: ev.clientY});
      if (ev.button === 2) {
        this.mode = 'pan';
        this.primaryPointerId = ev.pointerId;
        this.clearBrushPreview();
        return;
      }
      if (this.pointers.size >= 2) {
        this.mode = 'pinch';
        this.touchPendingDraw = null;
        this.clearBrushPreview();
        this.lastPinchDist = this.currentPinchDist();
        return;
      }
      if (ev.pointerType === 'touch' && this.panMode) {
        this.mode = 'pan';
        this.primaryPointerId = ev.pointerId;
        this.clearBrushPreview();
      } else if (ev.pointerType === 'touch') {
        this.touchPendingDraw = {x: ev.clientX, y: ev.clientY};
        this.primaryPointerId = ev.pointerId;
        this.updateBrushPreview(ev.clientX, ev.clientY);
      } else {
        this.mode = 'draw';
        this.primaryPointerId = ev.pointerId;
        this.drawAtPoint(ev.clientX, ev.clientY);
      }
    }
  }

  /**
   * Updates the active pointer interaction or hover preview.
   *
   * @public
   * @param {PointerEvent} ev pointer event.
   */
  public onPointerMove(ev: PointerEvent): void {
    if (!this.inputBlocked) {
      if (this.pointers.has(ev.pointerId)) {
        const prev = this.pointers.get(ev.pointerId)!;
        this.pointers.set(ev.pointerId, {x: ev.clientX, y: ev.clientY});
        if (this.mode === 'pan' && ev.pointerId === this.primaryPointerId) {
          const dx = ev.clientX - prev.x;
          const dy = ev.clientY - prev.y;
          this.offsetX = ((this.offsetX - dx / this.scale) % this.ruleset.cols + this.ruleset.cols) % this.ruleset.cols;
          this.offsetY = ((this.offsetY - dy / this.scale) % this.ruleset.rows + this.ruleset.rows) % this.ruleset.rows;
          this.sendCamera();
        } else if (this.mode === 'pinch' || this.pointers.size >= 2) {
          this.mode = 'pinch';
          this.touchPendingDraw = null;
          this.clearBrushPreview();
          const dist = this.currentPinchDist();
          if (this.lastPinchDist > 0 && dist > 0) {
            const mid = this.currentPinchMid();
            const rect = this.canvasRef.nativeElement.getBoundingClientRect();
            const worldX = (mid.x - rect.left) / this.scale + this.offsetX;
            const worldY = (mid.y - rect.top) / this.scale + this.offsetY;
            const factor = dist / this.lastPinchDist;
            this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
            this.offsetX = worldX - (mid.x - rect.left) / this.scale;
            this.offsetY = worldY - (mid.y - rect.top) / this.scale;
            this.sendCamera();
          }
          this.lastPinchDist = dist;
        } else {
          if (this.touchPendingDraw) {
            this.mode = 'draw';
            this.drawAtPoint(this.touchPendingDraw.x, this.touchPendingDraw.y);
            this.touchPendingDraw = null;
          }
          if (this.mode === 'draw') {
            this.drawAtPoint(ev.clientX, ev.clientY);
          }
        }
      } else {
        this.updateBrushPreview(ev.clientX, ev.clientY);
      }
    }
  }

  /**
   * Finishes the active pointer interaction for one pointer.
   *
   * @public
   * @param {PointerEvent} ev pointer event.
   */
  public onPointerUp(ev: PointerEvent): void {
    if (!this.inputBlocked) {
      this.pointers.delete(ev.pointerId);
      if (ev.pointerId === this.primaryPointerId) {
        if (this.touchPendingDraw && this.mode !== 'pinch') {
          this.drawAtPoint(this.touchPendingDraw.x, this.touchPendingDraw.y);
        }
        this.touchPendingDraw = null;
        this.primaryPointerId = -1;
      }
      if (this.pointers.size === 0) {
        this.mode = 'idle';
        this.lastPinchDist = 0;
      } else if (this.pointers.size === 1) {
        this.lastPinchDist = 0;
      }
    }
  }

  /**
   * Clears hover preview when the pointer leaves the canvas.
   *
   * @param {PointerEvent} _ev pointer event.
   */
  public onPointerLeave(_ev: PointerEvent): void {
    if (!this.inputBlocked && this.pointers.size === 0) {
      this.clearBrushPreview();
    }
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
    if (!this.ruleset) {
      return;
    }
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.worker?.postMessage({
      type: 'resize',
      width: Math.round(rect.width * dpr),
      height: Math.round(rect.height * dpr)
    });
    this.computeMinScale();
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale));
    this.sendCamera();
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
    this.worker = new Worker(new URL('../../worker/webengine.ts', import.meta.url), {type: 'module'});
    this.worker.onmessage = (ev: MessageEvent) => {
      switch (ev.data?.type) {
        case 'metrics': this.metrics.emit(ev.data); break;
        case 'snapshot': this.snapshot.emit(ev.data); break;
        case 'recording': this.recording.emit(ev.data); break;
        case 'limits': this.limits.emit(ev.data); break;
        case 'stepping': this.stepping.emit(ev.data); break;
        case 'chunksSaving': this.chunksSaving.emit(ev.data); break;
        case 'backpressure': this.backpressure.emit(ev.data); break;
        case 'storageQuota': this.storageQuota.emit(ev.data); break;
        case 'chunkSealed': this.chunkSealed.emit(ev.data); break;
        case 'uncompressedChunks': this.uncompressedChunks.emit(ev.data); break;
        case 'generation': this.generation.emit(ev.data); break;
        case 'rebuilding': this.rebuilding.emit(ev.data); break;
        case 'deviceLost': this.deviceLost.emit(ev.data); break;
        case 'gpuError': this.gpuError.emit(ev.data); break;
        default: console.warn('Unknown message from worker:', ev.data); break;
      }
    };
    this.worker.onerror = (err: ErrorEvent) => {
      this.gpuError.emit({
        type: 'gpuError',
        reason: err.message || 'Worker crashed unexpectedly'
      });
    };
    const offscreen = canvas.transferControlToOffscreen();
    this.worker.postMessage({
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
    this.worker?.postMessage({type: 'getSnapshot'});
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
    this.worker?.postMessage({
      type: 'loadSnapshot',
      grid,
      generation,
      gridFormat
    }, [grid.buffer]);
  }

  /**
   * Updates recording state in the engine worker.
   *
   * @public
   * @param {boolean} recording whether recording is enabled.
   */
  public setRecording(recording: boolean): void {
    this.worker?.postMessage({type: 'setRecording', recording});
  }

  /**
   * Updates simulation run state in the engine worker.
   *
   * @public
   * @param {boolean} running whether the simulation should run.
   */
  public setRunning(running: boolean): void {
    this.worker?.postMessage({type: 'setRunning', running});
  }

  /**
   * Requests the current recording manifest from the engine worker.
   *
   * @public
   */
  public requestRecording(): void {
    this.worker?.postMessage({type: 'getRecording'});
  }

  /**
   * Requests a backward stepping operation.
   *
   * @public
   * @param {number} count step count.
   */
  public stepBack(count: number): void {
    this.worker?.postMessage({type: 'stepBack', count});
  }

  /**
   * Requests a forward stepping operation.
   *
   * @public
   * @param {number} count step count.
   */
  public stepForward(count: number): void {
    this.worker?.postMessage({type: 'stepForward', count});
  }

  /**
   * Cancels the active stepping operation.
   *
   * @public
   */
  public cancelStepping(): void {
    this.worker?.postMessage({type: 'cancelStepping'});
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
    this.worker?.postMessage({
      type: 'updateChunkCodec',
      filename,
      rawBytes,
      codec,
      storedBytes,
      gridFormat
    });
  }

  /**
   * Requests chunks that still need compression.
   *
   * @public
   */
  public requestUncompressedChunks(): void {
    this.worker?.postMessage({type: 'getUncompressedChunks'});
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<Engine<T>>): void {
    if (this.worker) {
      if (changes.state) {
        this.worker.postMessage({type: 'setRunning', running: this.state === 'running'});
      }
      if (changes.isRecording) {
        this.worker.postMessage({type: 'setRecording', recording: this.isRecording});
      }
      if (changes.speed) {
        this.worker.postMessage({type: 'setSpeed', speed: this.speed});
      }
      if (changes.liveMetrics) {
        this.worker.postMessage({
          type: 'setLiveMetrics',
          liveMetrics: normalizeLiveMetricsSettings(this.liveMetrics)
        });
      }
      if (changes.ruleset || changes.simulationGridFormat) {
        this.worker.postMessage({
          type: 'setRuleset',
          ruleset: this.ruleset,
          simulationGridFormat: this.simulationGridFormat
        });
        const prevRuleset = changes.ruleset?.previousValue;
        if (!(prevRuleset && prevRuleset.rows === this.ruleset.rows && prevRuleset.cols === this.ruleset.cols)) {
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
    this.worker?.terminate();
  }

  /**
   * Computes the minimum and maximum camera scale for the current grid.
   *
   * @private
   */
  private computeMinScale(): void {
    const el = this.canvasRef.nativeElement;
    const rect = el.getBoundingClientRect();
    this.minScale = Math.max(rect.width / this.ruleset.cols, rect.height / this.ruleset.rows);
    this.maxScale = Math.max(Engine.baseMaxScale, this.minScale);
  }

  /**
   * Resets the camera to the full-grid view.
   *
   * @private
   */
  private resetCamera(): void {
    this.computeMinScale();
    this.scale = this.minScale;
    this.offsetX = 0;
    this.offsetY = 0;
    this.sendCamera();
  }

  /**
   * Sends the current camera to the worker.
   *
   * @private
   */
  private sendCamera(): void {
    const dpr = window.devicePixelRatio || 1;
    this.worker?.postMessage({
      type: 'camera',
      scale: this.scale * dpr,
      offsetX: this.offsetX,
      offsetY: this.offsetY
    });
  }

  /**
   * Calculates the distance between the first two active pointers.
   *
   * @private
   * @returns {number} distance in client pixels.
   */
  private currentPinchDist(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) {
      return 0;
    }
    const dx = pts[0]!.x - pts[1]!.x;
    const dy = pts[0]!.y - pts[1]!.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculates the midpoint between the first two active pointers.
   *
   * @private
   * @returns {{ x: number; y: number }} midpoint in client pixels.
   */
  private currentPinchMid(): {x: number; y: number} {
    const pts = [...this.pointers.values()];
    return {
      x: (pts[0]!.x + pts[1]!.x) / 2,
      y: (pts[0]!.y + pts[1]!.y) / 2
    };
  }

  /**
   * Keeps the rendered brush preview aligned when brush inputs change.
   *
   * @private
   * @param {TypedChanges<Engine<T>>} changes input changes.
   */
  private syncBrushPreviewInputChanges(changes: TypedChanges<Engine<T>>): void {
    if (changes.inputBlocked && this.inputBlocked) {
      this.resetInteractionState();
    }
    const brushPreviewInputChanged = changes.brushSize || changes.brushShape || changes.panMode;
    if (brushPreviewInputChanged && this.lastPreviewCell && !this.inputBlocked) {
      if (this.panMode) {
        this.clearBrushPreview();
      } else {
        this.worker?.postMessage({
          type: 'brushPreview',
          visible: true,
          x: this.lastPreviewCell.x,
          y: this.lastPreviewCell.y,
          size: this.brushSize,
          shape: this.brushShape
        });
      }
    }
  }

  /**
   * Updates the worker-side brush preview for a client coordinate.
   *
   * @private
   * @param {number} clientX pointer x coordinate.
   * @param {number} clientY pointer y coordinate.
   */
  private updateBrushPreview(clientX: number, clientY: number): void {
    if (!this.panMode) {
      const cell = this.cellAtPoint(clientX, clientY);
      this.lastPreviewCell = cell;
      this.worker?.postMessage({
        type: 'brushPreview',
        visible: true,
        x: cell.x,
        y: cell.y,
        size: this.brushSize,
        shape: this.brushShape
      });
    } else {
      this.clearBrushPreview();
    }
  }

  /**
   * Clears transient input state while an overlay owns the canvas surface.
   *
   * @private
   */
  private resetInteractionState(): void {
    this.pointers.clear();
    this.mode = 'idle';
    this.primaryPointerId = -1;
    this.touchPendingDraw = null;
    this.lastPinchDist = 0;
    this.clearBrushPreview();
  }

  /**
   * Hides the worker-side brush preview.
   *
   * @private
   */
  private clearBrushPreview(): void {
    this.lastPreviewCell = null;
    this.worker?.postMessage({
      type: 'brushPreview',
      visible: false,
      x: 0,
      y: 0,
      size: this.brushSize,
      shape: this.brushShape
    });
  }

  /**
   * Converts a client coordinate into a grid cell coordinate.
   *
   * @private
   * @param {number} clientX pointer x coordinate.
   * @param {number} clientY pointer y coordinate.
   * @returns {{ x: number; y: number }} grid cell coordinate.
   */
  private cellAtPoint(clientX: number, clientY: number): {x: number; y: number} {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const worldX = cssX / this.scale + this.offsetX;
    const worldY = cssY / this.scale + this.offsetY;
    return {
      x: Math.floor(worldX),
      y: Math.floor(worldY)
    };
  }

  /**
   * Sends a draw stroke sample and updates the preview position.
   *
   * @private
   * @param {number} clientX pointer x coordinate.
   * @param {number} clientY pointer y coordinate.
   */
  private drawAtPoint(clientX: number, clientY: number): void {
    const cell = this.cellAtPoint(clientX, clientY);
    this.lastPreviewCell = cell;
    this.worker?.postMessage({
      type: 'draw',
      x: cell.x,
      y: cell.y,
      size: this.brushSize,
      shape: this.brushShape,
      fill: this.brushFill,
      tribes: this.drawTribes
    });
    this.worker?.postMessage({
      type: 'brushPreview',
      visible: true,
      x: cell.x,
      y: cell.y,
      size: this.brushSize,
      shape: this.brushShape
    });
  }
}
