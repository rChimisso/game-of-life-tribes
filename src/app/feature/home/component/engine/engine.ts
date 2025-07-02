/* eslint-disable jsdoc/require-jsdoc */
import {AfterViewInit, Component, ElementRef, HostListener, Input,
  OnChanges, OnDestroy, ViewChild, ChangeDetectionStrategy} from '@angular/core';

import {Ruleset, Tribe} from '../../model/rule';
import {CameraMessage, DrawMessage, ResizeMessage} from '../../worker/webengine';

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

  /**
   * External inputs.
   */
  @Input()
  public ruleset!: Ruleset<T>;

  @Input()
  public speed = 1; // Steps per second (or -1 = max)

  @Input()
  public state: 'running' | 'paused' = 'paused';

  @Input()
  public drawTribe!: string;

  // ──────────────────────────────────────────
  private worker!: Worker;

  private offscreen!: OffscreenCanvas;

  // Camera
  private scale = 1; // Px per cell

  private offsetX = 0; // In cells

  private offsetY = 0;

  private minScale = 1; // Fit-whole-grid when we know size

  private readonly maxScale = 128; // 1 cell = 128 px

  // Pointer state
  private isPanning = false;

  private lastX = 0;

  private lastY = 0;

  // ─────────────── Mouse events ──────────────
  @HostListener('wheel', ['$event'])
  public onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const {offsetX: cx, offsetY: cy} = ev;
    const worldX = (cx / this.scale) + this.offsetX;
    const worldY = (cy / this.scale) + this.offsetY;

    const factor = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));

    // Keep cursor-point stable:
    this.offsetX = worldX - (cx / this.scale);
    this.offsetY = worldY - (cy / this.scale);

    this.sendCamera();
  }

  @HostListener('mousedown', ['$event'])
  public onDown(ev: MouseEvent): void {
    if (ev.button === 2) { // Right-button = pan
      this.isPanning = true;
      this.lastX = ev.clientX;
      this.lastY = ev.clientY;
    } else if (ev.button === 0) { // Left-button = draw
      this.drawAt(ev);
    }
  }

  @HostListener('mousemove', ['$event'])
  public onMove(ev: MouseEvent): void {
    if (this.isPanning) {
      // Const dx = (ev.clientX - this.lastX) / this.scale;
      // Const dy = (ev.clientY - this.lastY) / this.scale;
      // This.offsetX -= dx;
      // This.offsetY += dy;
      // This.lastX = ev.clientX;
      // This.lastY = ev.clientY;
      const dx = ev.clientX - this.lastX; // * DevicePixelRatio;
      const dy = ev.clientY - this.lastY; // * DevicePixelRatio;
      this.lastX = ev.clientX;
      this.lastY = ev.clientY;
      this.offsetX = (this.offsetX - dx / this.scale + this.ruleset.cols) % this.ruleset.cols;
      this.offsetY = (this.offsetY + dy / this.scale + this.ruleset.rows) % this.ruleset.rows;
      this.sendCamera();
    } else if (ev.buttons & 1) { // Left held
      this.drawAt(ev);
    }
  }

  @HostListener('mouseup')
  public onUp(): void {
    this.isPanning = false;
  }

  @HostListener('contextmenu', ['$event'])
  public disableCtx(ev: Event): void {
    ev.preventDefault();
  }

  // ─────────────── Resize handling ───────────
  @HostListener('window:resize')
  public resizeCanvas(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (this.offscreen) { // Already transferred
      const dpr = window.devicePixelRatio || 1; // High-DPI support
      this.offscreen.width = width * dpr;
      this.offscreen.height = height * dpr;

      this.worker.postMessage({
        type: 'resize',
        width: this.offscreen.width,
        height: this.offscreen.height,
        dpr
      } as ResizeMessage);
    } else { // First load
      const canvas = this.canvasRef.nativeElement;
      canvas.width = width;
      canvas.height = height;
    }

    // Re-compute min-zoom but keep current view (so it may now be clipped):
    if (this.ruleset) {
      this.minScale = Math.min(width / this.ruleset.cols, height / this.ruleset.rows);
    }
  }

  public ngAfterViewInit(): void {
    // 1. Size canvas & compute initial min-zoom
    this.resizeCanvas();

    // 2. Offscreen + worker
    this.offscreen = this.canvasRef.nativeElement.transferControlToOffscreen();
    this.worker = new Worker(new URL('../../worker/webengine.ts', import.meta.url), {type: 'module'});

    // 3. Start worker
    this.worker.postMessage({
      type: 'init',
      canvas: this.offscreen,
      ruleset: this.ruleset,
      speed: this.speed,
      running: this.state === 'running'
    }, [this.offscreen]);
    this.worker.postMessage({
      type: 'setRunning',
      running: this.state === 'running'
    });
    this.worker.postMessage({
      type: 'setSpeed',
      speed: this.speed
    });
    this.worker.postMessage({
      type: 'setRuleset',
      ruleset: this.ruleset
    });
    this.resetCamera();

    // 4. Listen for metrics / events from worker (if you later add them)
    this.worker.onmessage = _ => { /* Metrics hook */ };
  }

  // Angular change-detection hook:
  public ngOnChanges(chgs: TypedChanges<Engine<T>>): void {
    if (!this.worker) {
      return;
    }
    if (chgs.state) {
      this.worker.postMessage({
        type: 'setRunning',
        running: this.state === 'running'
      });
    }
    if (chgs.speed) {
      this.worker.postMessage({
        type: 'setSpeed',
        speed: this.speed
      });
    }
    if (chgs.ruleset) {
      const needViewReset = !chgs.ruleset.previousValue || chgs.ruleset.previousValue.rows !== this.ruleset.rows || chgs.ruleset.previousValue.cols !== this.ruleset.cols;
      this.worker.postMessage({
        type: 'setRuleset',
        ruleset: this.ruleset
      });
      if (needViewReset) {
        this.resetCamera();
      }
    }
  }

  public ngOnDestroy(): void {
    this.worker?.terminate();
  }

  // ─────────────── Camera maths ──────────────
  private resetCamera(): void {
    const w = window.innerWidth; // Canvas px
    const h = window.innerHeight;
    this.minScale = Math.max(w / this.ruleset.cols, h / this.ruleset.rows);
    this.scale = this.minScale; // Square cells: 1 cell = `scale` px
    this.offsetX = 0; // Start at top-left; wider side will overflow
    this.offsetY = 0;
    this.sendCamera();
  }

  private sendCamera(): void {
    this.worker?.postMessage(({
      type: 'camera',
      scale: this.scale,
      offsetX: this.offsetX,
      offsetY: this.offsetY
    } as CameraMessage));
  }

  private drawAt(ev: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;

    // ── margin (in px) added by letter-boxing on each side ──
    const marginX = 0;// Math.abs((window.innerWidth - this.ruleset.cols * this.scale) / 8);
    const marginY = window.innerHeight - this.ruleset.rows * this.scale;

    // Subtract the margin before converting to world-space
    const worldX = ((px - marginX) / this.scale) + this.offsetX;
    const worldY = ((py - marginY) / this.scale) - this.offsetY;

    // How many cells under a pixel?
    const span = Math.ceil(1 / this.scale);
    const startX = Math.floor(worldX) - Math.floor(span / 2);
    const startY = Math.floor(worldY) - Math.floor(span / 2);

    const cells: { x: number; y: number }[] = [];
    for (let y = 0; y < span; y++) {
      for (let x = 0; x < span; x++) {
        cells.push({
          x: startX + x,
          y: this.ruleset.rows - 1 - startY + y
        });
      }
    }

    this.worker?.postMessage({
      type: 'draw',
      tribe: this.drawTribe,
      cells
    } as DrawMessage);
  }
}
