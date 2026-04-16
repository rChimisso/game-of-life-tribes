/* eslint-disable jsdoc/require-jsdoc */
import {AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, ViewChild} from '@angular/core';

import {Ruleset, Tribe} from '../../model/rule';
import {BrushShape, CameraMessage, ChunksSavingMessage, DrawMessage, LimitsMessage, MetricMessage, RecordingMessage, SnapshotMessage, SteppingMessage, WorkerMessage} from '../../worker/webengine';

import {TypedChanges} from '~gol/core/model/typed-change';

@Component({
  selector: 'gol-engine',
  templateUrl: './engine.html',
  styleUrls: ['./engine.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Engine<T extends readonly Tribe[]> implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('engineCanvas', {static: true})
  public canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input()
  public ruleset!: Ruleset<T>;

  @Input()
  public speed = 1;

  @Input()
  public state: 'running' | 'paused' = 'paused';

  @Input()
  public isRecording = false;

  @Input()
  public drawTribes: string[] = [];

  @Input()
  public panMode = false;

  @Input()
  public brushSize = 1;

  @Input()
  public brushShape: BrushShape = 'square';

  @Input()
  public brushFill: 'full' | 'spray' | 'outline' = 'full';

  @Output()
  public readonly metrics = new EventEmitter<MetricMessage>();

  @Output()
  public readonly snapshot = new EventEmitter<SnapshotMessage>();

  @Output()
  public readonly recording = new EventEmitter<RecordingMessage>();

  @Output()
  public readonly limits = new EventEmitter<LimitsMessage>();

  @Output()
  public readonly stepping = new EventEmitter<SteppingMessage>();

  @Output()
  public readonly chunksSaving = new EventEmitter<ChunksSavingMessage>();

  private worker!: Worker;

  private scale = 1;

  private offsetX = 0;

  private offsetY = 0;

  private minScale = 1;

  private readonly maxScale = 128;

  // ── Pointer state (unified mouse + touch) ──
  private readonly pointers = new Map<number, {x: number; y: number}>();

  private mode: 'idle' | 'draw' | 'pan' | 'pinch' = 'idle';

  private primaryPointerId = -1;

  private touchPendingDraw: {x: number; y: number} | null = null;

  private lastPinchDist = 0;

  @HostListener('wheel', ['$event'])
  public onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const cx = ev.clientX - rect.left;
    const cy = ev.clientY - rect.top;

    // World point under cursor before zoom.
    const worldX = cx / this.scale + this.offsetX;
    const worldY = cy / this.scale + this.offsetY;

    const factor = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));

    // Keep cursor-point stable.
    this.offsetX = worldX - cx / this.scale;
    this.offsetY = worldY - cy / this.scale;

    this.sendCamera();
  }

  // ── Pointer events (unified mouse + touch) ──
  @HostListener('pointerdown', ['$event'])
  public onPointerDown(ev: PointerEvent): void {
    ev.preventDefault();
    (ev.target as Element).setPointerCapture(ev.pointerId);
    this.pointers.set(ev.pointerId, {x: ev.clientX,
      y: ev.clientY});

    if (ev.button === 2) {
      this.mode = 'pan';
      this.primaryPointerId = ev.pointerId;
      return;
    }

    if (this.pointers.size >= 2) {
      this.mode = 'pinch';
      this.touchPendingDraw = null;
      this.lastPinchDist = this.currentPinchDist();
      return;
    }

    if (ev.pointerType === 'touch' && this.panMode) {
      this.mode = 'pan';
      this.primaryPointerId = ev.pointerId;
    } else if (ev.pointerType === 'touch') {
      this.touchPendingDraw = {x: ev.clientX,
        y: ev.clientY};
      this.primaryPointerId = ev.pointerId;
    } else {
      this.mode = 'draw';
      this.primaryPointerId = ev.pointerId;
      this.drawAtPoint(ev.clientX, ev.clientY);
    }
  }

  @HostListener('pointermove', ['$event'])
  public onPointerMove(ev: PointerEvent): void {
    if (!this.pointers.has(ev.pointerId)) {
      return;
    }
    const prev = this.pointers.get(ev.pointerId)!;
    this.pointers.set(ev.pointerId, {x: ev.clientX,
      y: ev.clientY});

    if (this.mode === 'pan' && ev.pointerId === this.primaryPointerId) {
      const dx = ev.clientX - prev.x;
      const dy = ev.clientY - prev.y;
      this.offsetX = ((this.offsetX - dx / this.scale) % this.ruleset.cols + this.ruleset.cols) % this.ruleset.cols;
      this.offsetY = ((this.offsetY - dy / this.scale) % this.ruleset.rows + this.ruleset.rows) % this.ruleset.rows;
      this.sendCamera();
      return;
    }

    if (this.mode === 'pinch' || this.pointers.size >= 2) {
      this.mode = 'pinch';
      this.touchPendingDraw = null;
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
      return;
    }

    if (this.touchPendingDraw) {
      this.mode = 'draw';
      this.drawAtPoint(this.touchPendingDraw.x, this.touchPendingDraw.y);
      this.touchPendingDraw = null;
    }
    if (this.mode === 'draw') {
      this.drawAtPoint(ev.clientX, ev.clientY);
    }
  }

  @HostListener('pointerup', ['$event'])
  @HostListener('pointercancel', ['$event'])
  public onPointerUp(ev: PointerEvent): void {
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

  @HostListener('contextmenu', ['$event'])
  public disableCtx(ev: Event): void {
    ev.preventDefault();
  }

  @HostListener('window:resize')
  public onResize(): void {
    if (!this.ruleset) {
      return;
    }
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Tell the worker to resize the OffscreenCanvas.
    this.worker?.postMessage({
      type: 'resize',
      width: Math.round(rect.width * dpr),
      height: Math.round(rect.height * dpr)
    });

    // Recompute min-scale and clamp.
    this.computeMinScale();
    if (this.scale < this.minScale) {
      this.scale = this.minScale;
    }
    this.sendCamera();
  }

  public ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    this.worker = new Worker(new URL('../../worker/webengine.ts', import.meta.url), {type: 'module'});

    const offscreen = canvas.transferControlToOffscreen();
    this.worker.postMessage({
      type: 'init',
      canvas: offscreen,
      ruleset: this.ruleset,
      speed: this.speed,
      running: this.state === 'running'
    } satisfies WorkerMessage, [offscreen]);

    this.worker.postMessage({type: 'setRecording',
      recording: this.isRecording});

    this.resetCamera();

    this.worker.onmessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'metrics') {
        this.metrics.emit(ev.data as MetricMessage);
      } else if (ev.data?.type === 'snapshot') {
        this.snapshot.emit(ev.data as SnapshotMessage);
      } else if (ev.data?.type === 'recording') {
        this.recording.emit(ev.data as RecordingMessage);
      } else if (ev.data?.type === 'limits') {
        this.limits.emit(ev.data as LimitsMessage);
      } else if (ev.data?.type === 'stepping') {
        this.stepping.emit(ev.data as SteppingMessage);
      } else if (ev.data?.type === 'chunksSaving') {
        this.chunksSaving.emit(ev.data as ChunksSavingMessage);
      }
    };
  }

  public requestSnapshot(): void {
    this.worker?.postMessage({type: 'getSnapshot'});
  }

  public loadSnapshot(grid: Uint32Array, generation: number): void {
    this.worker?.postMessage({
      type: 'loadSnapshot',
      grid,
      generation
    });
  }

  public setRecording(recording: boolean): void {
    this.worker?.postMessage({type: 'setRecording',
      recording});
  }

  public requestRecording(): void {
    this.worker?.postMessage({type: 'getRecording'});
  }

  public stepBack(count: number): void {
    this.worker?.postMessage({type: 'stepBack',
      count});
  }

  public stepForward(count: number): void {
    this.worker?.postMessage({type: 'stepForward',
      count});
  }

  public ngOnChanges(changes: TypedChanges<Engine<T>>): void {
    if (!this.worker) {
      return;
    }

    if (changes.state) {
      this.worker.postMessage({type: 'setRunning',
        running: this.state === 'running'});
    }
    if (changes.isRecording) {
      this.worker.postMessage({type: 'setRecording',
        recording: this.isRecording});
    }
    if (changes.speed) {
      this.worker.postMessage({type: 'setSpeed',
        speed: this.speed});
    }
    if (changes.ruleset) {
      const needReset = !changes.ruleset.previousValue ||
        changes.ruleset.previousValue.rows !== this.ruleset.rows ||
        changes.ruleset.previousValue.cols !== this.ruleset.cols;
      this.worker.postMessage({type: 'setRuleset',
        ruleset: this.ruleset});
      if (needReset) {
        this.resetCamera();
      }
    }
  }

  public ngOnDestroy(): void {
    this.worker?.terminate();
  }

  private computeMinScale(): void {
    const el = this.canvasRef.nativeElement;
    const rect = el.getBoundingClientRect();
    // Min scale (CSS px/cell): entire grid visible, no duplicates.
    this.minScale = Math.max(
      rect.width / this.ruleset.cols,
      rect.height / this.ruleset.rows,
    );
  }

  private resetCamera(): void {
    this.computeMinScale();
    this.scale = this.minScale;
    this.offsetX = 0;
    this.offsetY = 0;
    this.sendCamera();
  }

  private sendCamera(): void {
    const dpr = window.devicePixelRatio || 1;
    this.worker?.postMessage({
      type: 'camera',
      scale: this.scale * dpr,
      offsetX: this.offsetX,
      offsetY: this.offsetY
    } satisfies CameraMessage);
  }

  private currentPinchDist(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) {
      return 0;
    }
    const dx = pts[0]!.x - pts[1]!.x;
    const dy = pts[0]!.y - pts[1]!.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private currentPinchMid(): {x: number; y: number} {
    const pts = [...this.pointers.values()];
    return {
      x: (pts[0]!.x + pts[1]!.x) / 2,
      y: (pts[0]!.y + pts[1]!.y) / 2
    };
  }

  private drawAtPoint(clientX: number, clientY: number): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const worldX = cssX / this.scale + this.offsetX;
    const worldY = cssY / this.scale + this.offsetY;
    this.worker?.postMessage({
      type: 'draw',
      x: Math.floor(worldX),
      y: Math.floor(worldY),
      size: this.brushSize,
      shape: this.brushShape,
      fill: this.brushFill,
      tribes: this.drawTribes
    } satisfies DrawMessage);
  }
}
