import {EnginePoint} from '../model/engine-input';

import {ExportFrameOrigin, wrapExportFrameOrigin} from '~gol/feature/home/model/export-frame-origin';
import {GridSettings} from '~gol/feature/home/model/grid';
import {BOUNDED_GRID_TOPOLOGY} from '~gol/feature/home/model/rule';
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
   * @param {() => GridSettings} getGrid grid getter.
   */
  public constructor(private readonly getCanvas: () => HTMLCanvasElement, private readonly getGrid: () => GridSettings) {}

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
    this.clampBoundedOffsets();
  }

  /**
   * Clamps the current camera scale to the active bounds.
   *
   * @public
   */
  public refreshScaleBounds(): void {
    this.computeMinScale();
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale));
    this.clampBoundedOffsets();
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
    this.clampBoundedOffsets();
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
    this.offsetX -= dx / this.scale;
    this.offsetY -= dy / this.scale;
    if (grid.topology === BOUNDED_GRID_TOPOLOGY) {
      this.clampBoundedOffsets();
    } else {
      this.offsetX = ((this.offsetX % grid.cols) + grid.cols) % grid.cols;
      this.offsetY = ((this.offsetY % grid.rows) + grid.rows) % grid.rows;
    }
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
    const grid = this.getGrid();
    let cell: EnginePoint;
    if (grid.topology === BOUNDED_GRID_TOPOLOGY) {
      cell = {
        x: Math.min(grid.cols - 1, Math.max(0, Math.floor(worldX))),
        y: Math.min(grid.rows - 1, Math.max(0, Math.floor(worldY)))
      };
    } else {
      cell = {x: Math.floor(worldX), y: Math.floor(worldY)};
    }
    return cell;
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
    let origin: ExportFrameOrigin;
    if (grid.topology === BOUNDED_GRID_TOPOLOGY) {
      origin = {originX: 0, originY: 0};
    } else {
      origin = wrapExportFrameOrigin({originX: centerX - Math.floor(grid.cols / 2), originY: centerY - Math.floor(grid.rows / 2)}, grid);
    }
    return origin;
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

  /**
   * Clamps bounded-grid camera offsets to the visible grid extent.
   *
   * @private
   */
  private clampBoundedOffsets(): void {
    const grid = this.getGrid();
    if (grid.topology === BOUNDED_GRID_TOPOLOGY) {
      const rect = this.getCanvas().getBoundingClientRect();
      const visibleCols = rect.width / this.scale;
      const visibleRows = rect.height / this.scale;
      this.offsetX = Math.min(Math.max(0, grid.cols - visibleCols), Math.max(0, this.offsetX));
      this.offsetY = Math.min(Math.max(0, grid.rows - visibleRows), Math.max(0, this.offsetY));
    }
  }
}
