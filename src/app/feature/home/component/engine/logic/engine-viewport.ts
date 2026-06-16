import {EnginePoint} from '../model/engine-input';

import {ExportFrameOrigin, wrapExportFrameOrigin} from '~gol/feature/home/model/export-frame-origin';
import {Grid} from '~gol/feature/home/model/grid';
import {CameraMessage} from '~gol/feature/home/model/worker-message';

/**
 * Base maximum camera scale.
 *
 * @type {number}
 */
const BASE_MAX_SCALE = 128;

/**
 * Camera math and coordinate conversion for the engine canvas.
 *
 * @class EngineViewport
 * @typedef {EngineViewport}
 */
export class EngineViewport {
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
  private maxScale = BASE_MAX_SCALE;

  /**
   * Creates an engine viewport.
   *
   * @public
   * @param {() => HTMLCanvasElement} getCanvas canvas getter.
   * @param {() => Grid} getGrid grid getter.
   */
  public constructor(private readonly getCanvas: () => HTMLCanvasElement, private readonly getGrid: () => Grid) {}

  /**
   * Resets the camera to the full-grid view.
   *
   * @public
   */
  public reset(): void {
    this.computeMinScale();
    this.scale = this.minScale;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  /**
   * Clamps the current camera scale to the active bounds.
   *
   * @public
   */
  public refreshScaleBounds(): void {
    this.computeMinScale();
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale));
  }

  /**
   * Zooms around a client-space point.
   *
   * @public
   * @param {number} clientX client x coordinate.
   * @param {number} clientY client y coordinate.
   * @param {number} factor zoom factor.
   */
  public zoomAtClientPoint(clientX: number, clientY: number, factor: number): void {
    const rect = this.getCanvas().getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const worldX = cx / this.scale + this.offsetX;
    const worldY = cy / this.scale + this.offsetY;
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    this.offsetX = worldX - cx / this.scale;
    this.offsetY = worldY - cy / this.scale;
  }

  /**
   * Pans the camera by a client-space delta.
   *
   * @public
   * @param {number} dx x delta in client pixels.
   * @param {number} dy y delta in client pixels.
   */
  public panByClientDelta(dx: number, dy: number): void {
    const grid = this.getGrid();
    this.offsetX = ((this.offsetX - dx / this.scale) % grid.cols + grid.cols) % grid.cols;
    this.offsetY = ((this.offsetY - dy / this.scale) % grid.rows + grid.rows) % grid.rows;
  }

  /**
   * Converts a client coordinate into a grid cell coordinate.
   *
   * @public
   * @param {number} clientX client x coordinate.
   * @param {number} clientY client y coordinate.
   * @returns {EnginePoint} grid cell coordinate.
   */
  public cellAtClientPoint(clientX: number, clientY: number): EnginePoint {
    const rect = this.getCanvas().getBoundingClientRect();
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const worldX = cssX / this.scale + this.offsetX;
    const worldY = cssY / this.scale + this.offsetY;
    return {x: Math.floor(worldX), y: Math.floor(worldY)};
  }

  /**
   * Builds a camera message for the worker.
   *
   * @public
   * @param {number} dpr device pixel ratio.
   * @returns {CameraMessage} worker camera payload.
   */
  public createCameraMessage(dpr: number): CameraMessage {
    return {
      type: 'camera',
      scale: this.scale * dpr,
      offsetX: this.offsetX,
      offsetY: this.offsetY
    };
  }

  /**
   * Resolves the full-grid export origin centered on the current viewport.
   *
   * @public
   * @returns {ExportFrameOrigin} wrapped export frame origin.
   */
  public createCenteredExportFrameOrigin(): ExportFrameOrigin {
    const rect = this.getCanvas().getBoundingClientRect();
    const grid = this.getGrid();
    const centerX = Math.floor((rect.width / 2) / this.scale + this.offsetX);
    const centerY = Math.floor((rect.height / 2) / this.scale + this.offsetY);
    return wrapExportFrameOrigin({originX: centerX - Math.floor(grid.cols / 2), originY: centerY - Math.floor(grid.rows / 2)}, grid);
  }

  /**
   * Computes the minimum and maximum camera scale for the current grid.
   *
   * @private
   */
  private computeMinScale(): void {
    const rect = this.getCanvas().getBoundingClientRect();
    const grid = this.getGrid();
    this.minScale = Math.max(rect.width / grid.cols, rect.height / grid.rows);
    this.maxScale = Math.max(BASE_MAX_SCALE, this.minScale);
  }
}
