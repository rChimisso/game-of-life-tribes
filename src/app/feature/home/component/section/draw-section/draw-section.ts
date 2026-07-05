import {ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, OnInit, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';

import {TypedChanges} from '~gol/core/model/typed-change';
import {DrawFormControls} from '~gol/feature/home/model/draw-form';
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
   * @type {FormGroup<DrawFormControls>}
   */
  public readonly form = new FormGroup<DrawFormControls>({
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
   * Destroy ref for subscriptions.
   *
   * @private
   * @readonly
   * @type {DestroyRef}
   */
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Brush size validation message.
   *
   * @public
   * @type {(string | null)}
   */
  public get brushSizeError(): string | null {
    return this.rangeError(this.form.controls.brushSize, 1, this.normalizedBrushMaxSize);
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
    return Math.max(1, Math.floor(this.brushMaxSize));
  }

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
    this.form.controls.brushSize.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.onBrushSizeChange());
    this.form.controls.brushShape.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.brushShapeChange.emit(value));
    this.form.controls.brushFill.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.brushFillChange.emit(value));
    this.form.controls.brushDensity.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.onBrushDensityChange());
    this.form.controls.touchMode.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => this.touchModeChange.emit(value));
  }

  /**
   * Emits valid brush size changes.
   *
   * @private
   */
  private onBrushSizeChange(): void {
    const control = this.form.controls.brushSize;
    if (control.valid && control.value !== null) {
      this.brushSizeChange.emit(control.value);
    }
  }

  /**
   * Emits valid brush density changes.
   *
   * @private
   */
  private onBrushDensityChange(): void {
    const control = this.form.controls.brushDensity;
    if (control.valid && control.value !== null) {
      this.brushDensityChange.emit(control.value);
    }
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
    let message: string | null = null;
    if (control.hasError('required')) {
      message = 'Required';
    } else if (control.hasError('min')) {
      message = `Min ${min}`;
    } else if (control.hasError('max')) {
      message = `Max ${max}`;
    } else if (control.hasError('decimalDigits')) {
      message = 'Integer';
    }
    return message;
  }
}
