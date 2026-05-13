import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';

import {ExclusiveButtonGroup} from '../../../../../shared/component/exclusive-button-group/exclusive-button-group';
import {ExclusiveButtonOption} from '../../../../../shared/component/exclusive-button-group/model/exclusive-button-option';
import {InputComponent} from '../../../../../shared/component/input/input';
import {TribeSwatch} from '../../../../../shared/component/tribe-swatch/tribe-swatch';
import {Tribe} from '../../../model/rule';
import {BrushShape} from '../../../model/worker-message';

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
   * @type {('full' | 'spray' | 'outline')}
   */
  @Input({required: true})
  public brushFill: 'full' | 'spray' | 'outline' = 'full';

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
   * @type {EventEmitter<'full' | 'spray' | 'outline'>}
   */
  @Output()
  public readonly brushFillChange = new EventEmitter<'full' | 'spray' | 'outline'>();

  /**
   * Emitter for touch mode changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<'draw' | 'pan'>}
   */
  @Output()
  public readonly touchModeChange = new EventEmitter<'draw' | 'pan'>();

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
   * @type {readonly ExclusiveButtonOption<'full' | 'spray' | 'outline'>[]}
   */
  public readonly brushFillOptions: readonly ExclusiveButtonOption<'full' | 'spray' | 'outline'>[] = [
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
   * @type {readonly ExclusiveButtonOption<'draw' | 'pan'>[]}
   */
  public readonly touchModeOptions: readonly ExclusiveButtonOption<'draw' | 'pan'>[] = [
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
   * @type {('draw' | 'pan')}
   */
  public get touchMode(): 'draw' | 'pan' {
    return this.panMode ? 'pan' : 'draw';
  }
}
