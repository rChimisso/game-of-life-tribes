import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';

import {ExclusiveButtonGroup} from '../../../../../shared/component/exclusive-button-group/exclusive-button-group';
import {ExclusiveButtonOption} from '../../../../../shared/component/exclusive-button-group/model/exclusive-button-option';
import {InputComponent} from '../../../../../shared/component/input/input';
import {TribeSwatch} from '../../../../../shared/component/tribe-swatch/tribe-swatch';
import {BrushFill, BrushShape, TouchMode} from '../../../model/draw-mode';
import {Tribe} from '../../../model/rule';

/**
 * Drawing tools section.
 *
 * @export
 * @class DrawSection
 * @typedef {DrawSection}
 */
@Component({
  selector: 'gol-draw-section',
  standalone: true,
  imports: [
    FormsModule,
    MatIconModule,
    InputComponent,
    TribeSwatch,
    ExclusiveButtonGroup
  ],
  templateUrl: './draw-section.html',
  styleUrl: './draw-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawSection {
  /**
   * Available tribes.
   *
   * @public
   * @type {readonly Tribe[]}
   */
  @Input({required: true})
  public tribes: readonly Tribe[] = [];

  /**
   * Currently selected tribes for drawing.
   *
   * @public
   * @type {string[]}
   */
  @Input({required: true})
  public drawTribes: string[] = [];

  /**
   * Whether delete mode is enabled.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public deleteMode = false;

  /**
   * Current brush size.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public brushSize = 1;

  /**
   * Maximum brush size.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public brushMaxSize = 1;

  /**
   * Current brush shape.
   *
   * @public
   * @type {BrushShape}
   */
  @Input({required: true})
  public brushShape: BrushShape = 'square';

  /**
   * Current brush fill mode.
   *
   * @public
   * @type {BrushFill}
   */
  @Input({required: true})
  public brushFill: BrushFill = 'full';

  /**
   * Whether touch interactions pan the grid.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public panMode = false;

  /**
   * Emitter for single tribe selection changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<string>}
   */
  @Output()
  public readonly tribeChange = new EventEmitter<string>();

  /**
   * Emitter for delete mode toggles.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly deleteModeToggle = new EventEmitter<void>();

  /**
   * Emitter for brush size changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<string>}
   */
  @Output()
  public readonly brushSizeChange = new EventEmitter<string>();

  /**
   * Emitter for brush shape changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<BrushShape>}
   */
  @Output()
  public readonly brushShapeChange = new EventEmitter<BrushShape>();

  /**
   * Emitter for brush fill mode changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<BrushFill>}
   */
  @Output()
  public readonly brushFillChange = new EventEmitter<BrushFill>();

  /**
   * Emitter for touch mode changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<TouchMode>}
   */
  @Output()
  public readonly touchModeChange = new EventEmitter<TouchMode>();

  /**
   * Brush shape button options.
   *
   * @public
   * @readonly
   * @type {readonly ExclusiveButtonOption<BrushShape>[]}
   */
  public readonly brushShapeOptions: readonly ExclusiveButtonOption<BrushShape>[] = [
    {
      value: 'square',
      tooltip: 'Square',
      icon: 'square'
    },
    {
      value: 'round',
      tooltip: 'Round',
      icon: 'circle'
    },
    {
      value: 'diamond',
      tooltip: 'Diamond',
      icon: 'square',
      iconStyle: {
        transform: 'rotate(45deg)'
      }
    },
    {
      value: 'vline',
      tooltip: 'Vertical Line',
      icon: 'horizontal_rule',
      iconStyle: {
        transform: 'rotate(90deg)'
      }
    },
    {
      value: 'hline',
      tooltip: 'Horizontal Line',
      icon: 'horizontal_rule'
    }
  ];

  /**
   * Brush fill button options.
   *
   * @public
   * @readonly
   * @type {readonly ExclusiveButtonOption<BrushFill>[]}
   */
  public readonly brushFillOptions: readonly ExclusiveButtonOption<BrushFill>[] = [
    {
      value: 'full',
      tooltip: 'Full',
      label: 'Full'
    },
    {
      value: 'spray',
      tooltip: 'Spray',
      label: 'Spray'
    },
    {
      value: 'outline',
      tooltip: 'Outline',
      label: 'Outline'
    }
  ];

  /**
   * Touch mode button options.
   *
   * @public
   * @readonly
   * @type {readonly ExclusiveButtonOption<TouchMode>[]}
   */
  public readonly touchModeOptions: readonly ExclusiveButtonOption<TouchMode>[] = [
    {
      value: 'draw',
      tooltip: 'Draw',
      label: 'Draw'
    },
    {
      value: 'pan',
      tooltip: 'Pan',
      label: 'Pan'
    }
  ];

  /**
   * Current touch mode.
   *
   * @public
   * @type {TouchMode}
   */
  public get touchMode(): TouchMode {
    return this.panMode ? 'pan' : 'draw';
  }

  /**
   * Handles brush size changes.
   *
   * @public
   * @param {string} value
   */
  public onBrushSizeChange(value: string): void {
    this.brushSize = this.clampBrushSize(+value || 1);
    this.brushSizeChange.emit(String(this.brushSize));
  }

  /**
   * Handles brush shape changes.
   *
   * @public
   * @param {BrushShape} shape
   */
  public onBrushShapeChange(shape: BrushShape): void {
    this.brushShape = shape;
    this.brushShapeChange.emit(shape);
  }

  /**
   * Handles brush fill changes.
   *
   * @public
   * @param {BrushFill} fill
   */
  public onBrushFillChange(fill: BrushFill): void {
    this.brushFill = fill;
    this.brushFillChange.emit(fill);
  }

  /**
   * Clamps the brush size.
   *
   * @private
   * @param {number} size
   * @returns {number}
   */
  private clampBrushSize(size: number): number {
    return Math.min(Math.max(1, Math.floor(+size || 1)), Math.max(1, Math.floor(this.brushMaxSize)));
  }
}
