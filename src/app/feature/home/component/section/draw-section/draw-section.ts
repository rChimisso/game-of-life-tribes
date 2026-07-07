import {ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';

import {firstControlError, validControlValues} from '~gol/core/function/form-control';
import {FormType} from '~gol/core/model/form-type';
import {TypedChanges} from '~gol/core/model/typed-change';
import {MIN_BRUSH_SIZE} from '~gol/feature/home/model/brush-size';
import {DrawFormValue} from '~gol/feature/home/model/draw-form';
import {BrushFill, BrushShape, MAX_BRUSH_DENSITY, MIN_BRUSH_DENSITY, TouchMode} from '~gol/feature/home/model/draw-mode';
import {Tribe} from '~gol/feature/home/model/rule';
import {ExclusiveButtonGroup} from '~gol/shared/component/exclusive-button-group/exclusive-button-group';
import {ExclusiveButtonOption} from '~gol/shared/component/exclusive-button-group/model/exclusive-button-option';
import {NumberInputComponent} from '~gol/shared/component/input/number-input/number-input';
import {TribeSwatch} from '~gol/shared/component/tribe-swatch/tribe-swatch';

/**
 * Drawing tools section.
 *
 * @class DrawSection
 * @typedef {DrawSection}
 * @implements {OnChanges}
 * @implements {OnInit}
 */
@Component({
  selector: 'gol-draw-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    MatTooltipModule,
    NumberInputComponent,
    TribeSwatch,
    ExclusiveButtonGroup
  ],
  templateUrl: './draw-section.html',
  styleUrl: './draw-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawSection implements OnChanges, OnInit {
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
   * Current brush density percentage.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public brushDensity = MAX_BRUSH_DENSITY;

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
   * @type {EventEmitter<number>}
   */
  @Output()
  public readonly brushSizeChange = new EventEmitter<number>();

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
   * Emitter for brush density changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<number>}
   */
  @Output()
  public readonly brushDensityChange = new EventEmitter<number>();

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
   * Draw form.
   *
   * @public
   * @readonly
   * @type {FormGroup<FormType<DrawFormValue>>}
   */
  public readonly form = new FormGroup<FormType<DrawFormValue>>({
    brushSize: new FormControl<number | null>(1, {validators: [Validators.required]}),
    brushShape: new FormControl<BrushShape>('square', {nonNullable: true}),
    brushFill: new FormControl<BrushFill>('full', {nonNullable: true}),
    brushDensity: new FormControl<number | null>(MAX_BRUSH_DENSITY, {validators: [Validators.required]}),
    touchMode: new FormControl<TouchMode>('draw', {nonNullable: true})
  });

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
   * Minimum brush size.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public readonly minBrushSize = MIN_BRUSH_SIZE;

  /**
   * Brush size validation message.
   *
   * @public
   * @type {(string | null)}
   */
  public get brushSizeError(): string | null {
    return this.rangeError(this.form.controls.brushSize, this.minBrushSize, this.normalizedBrushMaxSize);
  }

  /**
   * Brush density validation message.
   *
   * @public
   * @type {(string | null)}
   */
  public get brushDensityError(): string | null {
    return this.rangeError(this.form.controls.brushDensity, MIN_BRUSH_DENSITY, MAX_BRUSH_DENSITY);
  }

  /**
   * Normalized maximum brush size.
   *
   * @public
   * @type {number}
   */
  public get normalizedBrushMaxSize(): number {
    return Math.max(this.minBrushSize, Math.floor(this.brushMaxSize));
  }

  /**
   * Maximum brush size integer digits.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get brushSizeIntegerDigits(): number {
    return this.integerDigits(this.normalizedBrushMaxSize);
  }

  /**
   * Maximum brush density integer digits.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get brushDensityIntegerDigits(): number {
    return this.integerDigits(MAX_BRUSH_DENSITY);
  }

  /**
   * Creates the draw section.
   *
   * @public
   * @constructor
   * @param {DestroyRef} destroyRef destroy ref for subscriptions.
   */
  public constructor(private readonly destroyRef: DestroyRef) {}

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<DrawSection>): void {
    if (changes.brushSize || changes.brushShape || changes.brushFill || changes.brushDensity || changes.panMode) {
      this.form.patchValue({
        brushSize: this.brushSize,
        brushShape: this.brushShape,
        brushFill: this.brushFill,
        brushDensity: this.brushDensity,
        touchMode: this.panMode ? 'pan' : 'draw'
      }, {emitEvent: false});
    }
    if (changes.brushMaxSize) {
      this.form.controls.brushSize.updateValueAndValidity({emitEvent: false});
    }
  }

  /**
   * @inheritdoc
   */
  public ngOnInit(): void {
    validControlValues(this.form.controls.brushSize).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.brushSizeChange.emit(value));
    this.form.controls.brushShape.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.brushShapeChange.emit(value));
    this.form.controls.brushFill.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.brushFillChange.emit(value));
    validControlValues(this.form.controls.brushDensity).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.brushDensityChange.emit(value));
    this.form.controls.touchMode.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.touchModeChange.emit(value));
  }

  /**
   * Gets a range validation message.
   *
   * @private
   * @param {FormControl<number | null>} control control to read.
   * @param {number} min minimum value.
   * @param {number} max maximum value.
   * @returns {(string | null)} validation message.
   */
  private rangeError(control: FormControl<number | null>, min: number, max: number): string | null {
    return firstControlError(control, [
      ['required', 'Required'],
      ['min', error => `Min ${this.numericErrorLimit(error, 'min', min)}`],
      ['max', error => `Max ${this.numericErrorLimit(error, 'max', max)}`],
      ['decimalDigits', 'Integer'],
      ['maxIntegerDigits', 'Too many digits']
    ]);
  }

  /**
   * Reads a numeric validation limit from an Angular validation error.
   *
   * @private
   * @param {unknown} error validation error metadata.
   * @param {'min' | 'max'} key limit key.
   * @param {number} fallback fallback limit.
   * @returns {number} resolved limit.
   */
  private numericErrorLimit(error: unknown, key: 'min' | 'max', fallback: number): number {
    let limit = fallback;
    if (typeof error === 'object' && error !== null && key in error) {
      const value = (error as Record<'min' | 'max', unknown>)[key];
      if (typeof value === 'number') {
        limit = value;
      }
    }
    return limit;
  }

  /**
   * Counts integer digits in a positive numeric limit.
   *
   * @private
   * @param {number} value numeric limit.
   * @returns {number} digit count.
   */
  private integerDigits(value: number): number {
    return Math.max(1, Math.trunc(Math.abs(value)).toString().length);
  }
}
