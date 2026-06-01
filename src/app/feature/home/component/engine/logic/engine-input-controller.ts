import {EngineViewport} from './engine-viewport';
import {EngineWorkerClient} from './engine-worker-client';
import {EngineBrushSettings, EngineInteractionMode, EnginePoint} from '../model/engine-input';

/**
 * Pointer input and brush-preview behavior for the engine canvas.
 *
 * @class EngineInputController
 * @typedef {EngineInputController}
 */
export class EngineInputController {
  /**
   * Active pointers by id.
   *
   * @private
   * @readonly
   * @type {Map<number, EnginePoint>}
   */
  private readonly pointers = new Map<number, EnginePoint>();

  /**
   * Current pointer interaction mode.
   *
   * @private
   * @type {EngineInteractionMode}
   */
  private mode: EngineInteractionMode = 'idle';

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
   * @type {(EnginePoint | null)}
   */
  private touchPendingDraw: EnginePoint | null = null;

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
   * @type {(EnginePoint | null)}
   */
  private lastPreviewCell: EnginePoint | null = null;

  /**
   * Creates an engine input controller.
   *
   * @public
   * @param {EngineViewport} viewport viewport helper.
   * @param {EngineWorkerClient} workerClient worker client.
   * @param {() => boolean} isInputBlocked blocked-input getter.
   * @param {() => boolean} isPanMode pan-mode getter.
   * @param {() => EngineBrushSettings} getBrushSettings brush settings getter.
   * @param {() => number} getDevicePixelRatio device pixel ratio getter.
   */
  public constructor(
    private readonly viewport: EngineViewport,
    private readonly workerClient: EngineWorkerClient,
    private readonly isInputBlocked: () => boolean,
    private readonly isPanMode: () => boolean,
    private readonly getBrushSettings: () => EngineBrushSettings,
    private readonly getDevicePixelRatio: () => number
  ) {}

  /**
   * Handles wheel zoom input.
   *
   * @public
   * @param {WheelEvent} ev wheel event.
   */
  public handleWheel(ev: WheelEvent): void {
    ev.preventDefault();
    if (!this.isInputBlocked()) {
      const factor = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
      this.viewport.zoomAtClientPoint(ev.clientX, ev.clientY, factor);
      this.sendCamera();
    }
  }

  /**
   * Starts a draw, pan, or pinch interaction.
   *
   * @public
   * @param {PointerEvent} ev pointer event.
   */
  public handlePointerDown(ev: PointerEvent): void {
    ev.preventDefault();
    if (!this.isInputBlocked()) {
      (document.activeElement as HTMLElement)?.blur?.();
      (ev.target as Element).setPointerCapture(ev.pointerId);
      this.pointers.set(ev.pointerId, {x: ev.clientX, y: ev.clientY});
      if (ev.button === 2) {
        this.startPan(ev.pointerId);
      } else if (this.pointers.size >= 2) {
        this.startPinch();
      } else if (ev.pointerType === 'touch' && this.isPanMode()) {
        this.startPan(ev.pointerId);
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
  public handlePointerMove(ev: PointerEvent): void {
    if (!this.isInputBlocked()) {
      const activePointer = this.pointers.get(ev.pointerId);
      if (activePointer) {
        this.pointers.set(ev.pointerId, {x: ev.clientX, y: ev.clientY});
        this.handleActivePointerMove(ev, activePointer);
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
  public handlePointerUp(ev: PointerEvent): void {
    if (!this.isInputBlocked()) {
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
   * @public
   */
  public handlePointerLeave(): void {
    if (!this.isInputBlocked() && this.pointers.size === 0) {
      this.clearBrushPreview();
    }
  }

  /**
   * Clears transient input state while an overlay owns the canvas surface.
   *
   * @public
   */
  public resetInteractionState(): void {
    this.pointers.clear();
    this.mode = 'idle';
    this.primaryPointerId = -1;
    this.touchPendingDraw = null;
    this.lastPinchDist = 0;
    this.clearBrushPreview();
  }

  /**
   * Keeps the rendered brush preview aligned when brush inputs change.
   *
   * @public
   * @param {boolean} inputBlocked whether input is blocked.
   * @param {boolean} brushPreviewInputChanged whether preview inputs changed.
   */
  public syncBrushPreviewInputChanges(inputBlocked: boolean, brushPreviewInputChanged: boolean): void {
    if (inputBlocked) {
      this.resetInteractionState();
    }
    if (brushPreviewInputChanged && this.lastPreviewCell && !inputBlocked) {
      if (this.isPanMode()) {
        this.clearBrushPreview();
      } else {
        this.showBrushPreview(this.lastPreviewCell);
      }
    }
  }

  /**
   * Clears the worker-side brush preview.
   *
   * @public
   */
  public clearBrushPreview(): void {
    const brush = this.getBrushSettings();
    this.lastPreviewCell = null;
    this.workerClient.setBrushPreview({
      type: 'brushPreview',
      visible: false,
      x: 0,
      y: 0,
      size: brush.size,
      shape: brush.shape
    });
  }

  /**
   * Sends the current viewport camera to the worker.
   *
   * @public
   */
  public sendCamera(): void {
    this.workerClient.sendCamera(this.viewport.createCameraMessage(this.getDevicePixelRatio()));
  }

  /**
   * Handles movement for a pointer already captured by the canvas.
   *
   * @private
   * @param {PointerEvent} ev pointer event.
   * @param {EnginePoint} previous previous pointer point.
   */
  private handleActivePointerMove(ev: PointerEvent, previous: EnginePoint): void {
    if (this.mode === 'pan' && ev.pointerId === this.primaryPointerId) {
      this.viewport.panByClientDelta(ev.clientX - previous.x, ev.clientY - previous.y);
      this.sendCamera();
    } else if (this.mode === 'pinch' || this.pointers.size >= 2) {
      this.updatePinchZoom();
    } else {
      this.drawOrPromotePendingTouch(ev);
    }
  }

  /**
   * Starts a pan interaction.
   *
   * @private
   * @param {number} pointerId active pointer id.
   */
  private startPan(pointerId: number): void {
    this.mode = 'pan';
    this.primaryPointerId = pointerId;
    this.clearBrushPreview();
  }

  /**
   * Starts a pinch interaction.
   *
   * @private
   */
  private startPinch(): void {
    this.mode = 'pinch';
    this.touchPendingDraw = null;
    this.clearBrushPreview();
    this.lastPinchDist = this.currentPinchDist();
  }

  /**
   * Updates pinch zoom.
   *
   * @private
   */
  private updatePinchZoom(): void {
    this.mode = 'pinch';
    this.touchPendingDraw = null;
    this.clearBrushPreview();
    const dist = this.currentPinchDist();
    if (this.lastPinchDist > 0 && dist > 0) {
      const mid = this.currentPinchMid();
      this.viewport.zoomAtClientPoint(mid.x, mid.y, dist / this.lastPinchDist);
      this.sendCamera();
    }
    this.lastPinchDist = dist;
  }

  /**
   * Starts touch drawing after the first movement or continues an active draw.
   *
   * @private
   * @param {PointerEvent} ev pointer event.
   */
  private drawOrPromotePendingTouch(ev: PointerEvent): void {
    if (this.touchPendingDraw) {
      this.mode = 'draw';
      this.drawAtPoint(this.touchPendingDraw.x, this.touchPendingDraw.y);
      this.touchPendingDraw = null;
    }
    if (this.mode === 'draw') {
      this.drawAtPoint(ev.clientX, ev.clientY);
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
    if (!this.isPanMode()) {
      const cell = this.viewport.cellAtClientPoint(clientX, clientY);
      this.lastPreviewCell = cell;
      this.showBrushPreview(cell);
    } else {
      this.clearBrushPreview();
    }
  }

  /**
   * Sends a draw stroke sample and updates the preview position.
   *
   * @private
   * @param {number} clientX pointer x coordinate.
   * @param {number} clientY pointer y coordinate.
   */
  private drawAtPoint(clientX: number, clientY: number): void {
    const cell = this.viewport.cellAtClientPoint(clientX, clientY);
    const brush = this.getBrushSettings();
    this.lastPreviewCell = cell;
    this.workerClient.draw({
      type: 'draw',
      x: cell.x,
      y: cell.y,
      size: brush.size,
      shape: brush.shape,
      fill: brush.fill,
      tribes: brush.tribes
    });
    this.showBrushPreview(cell);
  }

  /**
   * Shows the worker-side brush preview at a cell.
   *
   * @private
   * @param {EnginePoint} cell preview cell.
   */
  private showBrushPreview(cell: EnginePoint): void {
    const brush = this.getBrushSettings();
    this.workerClient.setBrushPreview({
      type: 'brushPreview',
      visible: true,
      x: cell.x,
      y: cell.y,
      size: brush.size,
      shape: brush.shape
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
    let distance = 0;
    if (pts.length >= 2) {
      const dx = pts[0]!.x - pts[1]!.x;
      const dy = pts[0]!.y - pts[1]!.y;
      distance = Math.sqrt(dx * dx + dy * dy);
    }
    return distance;
  }

  /**
   * Calculates the midpoint between the first two active pointers.
   *
   * @private
   * @returns {EnginePoint} midpoint in client pixels.
   */
  private currentPinchMid(): EnginePoint {
    const pts = [...this.pointers.values()];
    return {x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2};
  }
}
