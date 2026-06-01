import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';

import {ExclusiveButtonGroup} from '../../../../../shared/component/exclusive-button-group/exclusive-button-group';
import {ExclusiveButtonOption} from '../../../../../shared/component/exclusive-button-group/model/exclusive-button-option';
import {InputComponent} from '../../../../../shared/component/input/input';
import {TribeSwatch} from '../../../../../shared/component/tribe-swatch/tribe-swatch';
import {BrushFill, BrushShape, TouchMode} from '../../../model/draw-mode';
import {Tribe} from '../../../model/rule';

import {TypedChanges} from '~gol/core/model/typed-change';

/**
 * Drawing tools section.
 *
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
export class DrawSection implements OnChanges {
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
   * Pending brush size shown in the input.
   *
   * @public
   * @type {number}
   */
  public pendingBrushSize = 1;

  /**
   * Whether the user tried to exceed the max while already at the cap.
   *
   * @public
   * @type {boolean}
   */
  public showBrushSizeMaxError = false;

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
   * Brush size validation message.
   *
   * @public
   * @type {(string | null)}
   */
  public get brushSizeError(): string | null {
    if (this.pendingBrushSize < 1) {
      return 'Min 1';
    }
    if (this.showBrushSizeMaxError) {
      return `Max ${ this.normalizedBrushMaxSize }`;
    }
    return null;
  }

  /**
   * Normalized maximum brush size.
   *
   * @public
   * @type {number}
   */
  public get normalizedBrushMaxSize(): number {
    return Math.max(1, Math.floor(this.brushMaxSize));
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<DrawSection>): void {
    if (changes.brushSize || changes.brushMaxSize) {
      this.pendingBrushSize = this.clampBrushSize(this.brushSize);
      this.showBrushSizeMaxError = false;
    }
  }

  /**
   * Handles brush size changes.
   *
   * @public
   * @param {string} value
   */
  public onBrushSizeChange(value: string): void {
    const parsedBrushSize = this.parseBrushSize(value);
    const wasAtBrushMax = this.pendingBrushSize >= this.normalizedBrushMaxSize;
    if (parsedBrushSize > this.normalizedBrushMaxSize) {
      this.pendingBrushSize = this.normalizedBrushMaxSize;
      this.showBrushSizeMaxError = wasAtBrushMax;
    } else {
      this.pendingBrushSize = parsedBrushSize;
      this.showBrushSizeMaxError = false;
    }
    if (!this.brushSizeError) {
      this.brushSize = this.pendingBrushSize;
      this.brushSizeChange.emit(String(this.brushSize));
    }
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
    return Math.min(Math.max(1, Math.floor(+size || 1)), this.normalizedBrushMaxSize);
  }

  /**
   * Parses a brush size input.
   *
   * @private
   * @param {(string | number)} value
   * @returns {number}
   */
  private parseBrushSize(value: string | number): number {
    const size = Math.floor(+value || 0);
    return Math.max(0, size);
  }
}
