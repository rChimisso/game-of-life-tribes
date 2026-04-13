/* eslint-disable jsdoc/require-jsdoc */
import {AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, ViewChild} from '@angular/core';

import {AllowedTribe, ANY_TRIBE_ID, Ruleset, Tribe} from '../../model/rule';
import {CameraMessage, DrawMessage, LimitsMessage, MetricMessage, RecordingMessage, SnapshotMessage, SteppingMessage, WorkerMessage} from '../../worker/webengine';

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
  public drawTribe!: Exclude<AllowedTribe<T>, typeof ANY_TRIBE_ID>;

  @Input()
  public brushSize = 1;

  @Input()
  public brushShape: 'square' | 'round' = 'square';

  @Input()
  public brushFill: 'full' | 'spray' = 'full';

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

  // Â”€â”€ Worker â”€â”€
  private worker!: Worker;

  // Â”€â”€ Camera â”€â”€
  private scale = 1;

  private offsetX = 0;

  private offsetY = 0;

  private minScale = 1;

  private readonly maxScale = 128;

  // ── Pointer state ──
  private isPanning = false;

  private isDrawing = false;

  private lastX = 0;

  private lastY = 0;

  private readonly onDocMove = (ev: MouseEvent) => this.onMove(ev);

  private readonly onDocUp = () => this.onUp();

  // ── Touch state ──
  private touchDrawing = false;

  private wasTwoFinger = false;

  private lastPinchDist = 0;

  private lastMidX = 0;

  private lastMidY = 0;

  // Â”€â”€ Zoom (wheel) â”€â”€
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

  // Â”€â”€ Pan & Draw (mouse) â”€â”€
  @HostListener('mousedown', ['$event'])
  public onDown(ev: MouseEvent): void {
    if (ev.button === 2) {
      this.isPanning = true;
      this.lastX = ev.clientX;
      this.lastY = ev.clientY;
      this.attachDocListeners();
    } else if (ev.button === 0) {
      this.isDrawing = true;
      this.drawAt(ev);
      this.attachDocListeners();
    }
  }

  private onMove(ev: MouseEvent): void {
    if (this.isPanning) {
      const dx = ev.clientX - this.lastX;
      const dy = ev.clientY - this.lastY;
      this.lastX = ev.clientX;
      this.lastY = ev.clientY;
      // Panning moves the offset in cell space (toroidal).
      this.offsetX = ((this.offsetX - dx / this.scale) % this.ruleset.cols + this.ruleset.cols) % this.ruleset.cols;
      this.offsetY = ((this.offsetY - dy / this.scale) % this.ruleset.rows + this.ruleset.rows) % this.ruleset.rows;
      this.sendCamera();
    } else if (this.isDrawing) {
      this.drawAt(ev);
    }
  }

  private onUp(): void {
    this.isPanning = false;
    this.isDrawing = false;
    this.detachDocListeners();
  }

  @HostListener('contextmenu', ['$event'])
  public disableCtx(ev: Event): void {
    ev.preventDefault();
  }

  private attachDocListeners(): void {
    document.addEventListener('mousemove', this.onDocMove);
    document.addEventListener('mouseup', this.onDocUp);
  }

  private detachDocListeners(): void {
    document.removeEventListener('mousemove', this.onDocMove);
    document.removeEventListener('mouseup', this.onDocUp);
  }

  // Â”€â”€ Resize â”€â”€
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

  // Â”€â”€ Lifecycle â”€â”€
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
      }
    };

    // Touch events (need passive: false for preventDefault).
    const host = this.canvasRef.nativeElement.parentElement!;
    host.addEventListener('touchstart', e => this.onTouchStart(e), {passive: false});
    host.addEventListener('touchmove', e => this.onTouchMove(e), {passive: false});
    host.addEventListener('touchend', e => this.onTouchEnd(e));
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
    this.detachDocListeners();
    this.worker?.terminate();
  }

  // Â”€â”€ Camera helpers â”€â”€
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

  // Â”€â”€ Drawing â”€â”€
  // ── Drawing ──
  private drawAt(ev: MouseEvent): void {
    this.drawAtPoint(ev.clientX, ev.clientY);
  }

  // ── Touch handling ──
  private onTouchStart(ev: TouchEvent): void {
    ev.preventDefault();
    if (ev.touches.length === 1 && !this.wasTwoFinger) {
      this.touchDrawing = true;
      this.drawAtPoint(ev.touches[0]!.clientX, ev.touches[0]!.clientY);
    } else if (ev.touches.length >= 2) {
      this.touchDrawing = false;
      this.wasTwoFinger = true;
      this.lastMidX = (ev.touches[0]!.clientX + ev.touches[1]!.clientX) / 2;
      this.lastMidY = (ev.touches[0]!.clientY + ev.touches[1]!.clientY) / 2;
      this.lastPinchDist = this.pinchDist(ev.touches[0]!, ev.touches[1]!);
    }
  }

  private onTouchMove(ev: TouchEvent): void {
    ev.preventDefault();
    if (ev.touches.length === 1 && this.touchDrawing) {
      this.drawAtPoint(ev.touches[0]!.clientX, ev.touches[0]!.clientY);
    } else if (ev.touches.length >= 2) {
      this.touchDrawing = false;
      this.wasTwoFinger = true;
      const midX = (ev.touches[0]!.clientX + ev.touches[1]!.clientX) / 2;
      const midY = (ev.touches[0]!.clientY + ev.touches[1]!.clientY) / 2;

      // Pan.
      const dx = midX - this.lastMidX;
      const dy = midY - this.lastMidY;
      this.lastMidX = midX;
      this.lastMidY = midY;
      this.offsetX = ((this.offsetX - dx / this.scale) % this.ruleset.cols + this.ruleset.cols) % this.ruleset.cols;
      this.offsetY = ((this.offsetY - dy / this.scale) % this.ruleset.rows + this.ruleset.rows) % this.ruleset.rows;

      // Pinch zoom.
      const dist = this.pinchDist(ev.touches[0]!, ev.touches[1]!);
      if (this.lastPinchDist > 0) {
        const rect = this.canvasRef.nativeElement.getBoundingClientRect();
        const worldX = (midX - rect.left) / this.scale + this.offsetX;
        const worldY = (midY - rect.top) / this.scale + this.offsetY;

        const factor = dist / this.lastPinchDist;
        this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));

        this.offsetX = worldX - (midX - rect.left) / this.scale;
        this.offsetY = worldY - (midY - rect.top) / this.scale;
      }
      this.lastPinchDist = dist;

      this.sendCamera();
    }
  }

  private onTouchEnd(ev: TouchEvent): void {
    if (ev.touches.length === 0) {
      this.touchDrawing = false;
      this.wasTwoFinger = false;
      this.lastPinchDist = 0;
    } else if (ev.touches.length === 1) {
      // Went from 2 fingers to 1 — don't start drawing.
      this.lastPinchDist = 0;
    }
  }

  private pinchDist(a: Touch, b: Touch): number {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
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
      tribe: this.drawTribe as string
    } satisfies DrawMessage);
  }
}
