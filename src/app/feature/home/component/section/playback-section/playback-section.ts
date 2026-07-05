import {ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, OnInit, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';

import {PersistedPreferencesComponent} from '~gol/core/abstract/persisted-preferences-component';
import {TypedChanges} from '~gol/core/model/typed-change';
import {PlaybackFormControls} from '~gol/feature/home/model/playback-form';
import {PlaybackSectionPreferences} from '~gol/feature/home/model/preferences';
import {Button} from '~gol/shared/component/button/button';
import {NumberInputComponent} from '~gol/shared/component/input/number-input/number-input';
import {LabelValue} from '~gol/shared/component/label-value/label-value';

/**
 * Playback controls section.
 *
 * @class PlaybackSection
 * @typedef {PlaybackSection}
 * @extends {PersistedPreferencesComponent<PlaybackSectionPreferences>}
 * @implements {OnChanges}
 * @implements {OnInit}
 */
@Component({
  selector: 'gol-playback-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    Button,
    NumberInputComponent,
    LabelValue
  ],
  templateUrl: './playback-section.html',
  styleUrl: './playback-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaybackSection extends PersistedPreferencesComponent<PlaybackSectionPreferences> implements OnChanges, OnInit {
  /**
   * Whether the simulation is running.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public running = false;

  /**
   * Whether a multi-step action is active.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public stepping = false;

  /**
   * Whether a download is in progress.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public downloading = false;

  /**
   * Whether recorded chunks are waiting for storage.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public backpressure = false;

  /**
   * Whether the engine is rebuilding.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public rebuilding = false;

  /**
   * Whether the live engine is blocked by a GPU error.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public engineBlocked = false;

  /**
   * Whether stepping back is disabled by the engine.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public stepBackBaseDisabled = false;

  /**
   * Current generation counter.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public generationCounter = 0;

  /**
   * Latest measured simulation FPS.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public metricsFps = 0;

  /**
   * Emitter for play or pause actions.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly toggleRun = new EventEmitter<void>();

  /**
   * Emitter for backward step actions.
   *
   * @public
   * @readonly
   * @type {EventEmitter<number>}
   */
  @Output()
  public readonly stepBack = new EventEmitter<number>();

  /**
   * Emitter for forward step actions.
   *
   * @public
   * @readonly
   * @type {EventEmitter<number>}
   */
  @Output()
  public readonly stepForward = new EventEmitter<number>();

  /**
   * Emitter for restart actions.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly restart = new EventEmitter<void>();

  /**
   * Default preferences.
   *
   * @protected
   * @readonly
   * @type {PlaybackSectionPreferences}
   */
  protected override readonly defaultPreferences: PlaybackSectionPreferences = {
    skipAmount: 1
  };

  /**
   * Playback form.
   *
   * @public
   * @readonly
   * @type {FormGroup<PlaybackFormControls>}
   */
  public readonly form = new FormGroup<PlaybackFormControls>({
    skipAmount: new FormControl<number | null>(this.defaultPreferences.skipAmount, {validators: [Validators.required]})
  });

  /**
   * Destroy ref for subscriptions.
   *
   * @private
   * @readonly
   * @type {DestroyRef}
   */
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Valid skip amount.
   *
   * @private
   * @readonly
   * @type {(number | null)}
   */
  private get validSkipAmount(): number | null {
    const control = this.form.controls.skipAmount;
    let value: number | null = null;
    if (control.valid && control.value !== null) {
      value = control.value;
    }
    return value;
  }

  /**
   * Whether the run button is disabled.
   *
   * @public
   * @type {boolean}
   */
  public get runDisabled(): boolean {
    return this.engineBlocked || this.downloading || this.rebuilding || (this.backpressure && !this.running && !this.stepping);
  }

  /**
   * Whether the current action can be paused.
   *
   * @public
   * @type {boolean}
   */
  public get canPause(): boolean {
    return this.running || this.stepping;
  }

  /**
   * Whether playback controls are busy.
   *
   * @public
   * @type {boolean}
   */
  public get isBusy(): boolean {
    return this.downloading || this.stepping || this.backpressure || this.rebuilding;
  }

  /**
   * Whether live playback controls are unavailable.
   *
   * @public
   * @type {boolean}
   */
  public get livePlaybackDisabled(): boolean {
    return this.engineBlocked || this.isBusy;
  }

  /**
   * Whether stepping backward is disabled.
   *
   * @public
   * @type {boolean}
   */
  public get stepBackDisabled(): boolean {
    return this.running || this.livePlaybackDisabled || this.stepBackBaseDisabled || this.form.controls.skipAmount.invalid;
  }

  /**
   * Whether stepping forward is disabled.
   *
   * @public
   * @type {boolean}
   */
  public get stepForwardDisabled(): boolean {
    return this.running || this.livePlaybackDisabled || this.form.controls.skipAmount.invalid;
  }

  /**
   * Tooltip for the backward step button.
   *
   * @public
   * @type {string}
   */
  public get stepBackTooltip(): string {
    let tooltip = 'Busy or no recording available';
    const skipAmount = this.validSkipAmount;
    if (!this.stepBackDisabled && skipAmount !== null) {
      if (skipAmount > this.generationCounter) {
        tooltip = 'Go back to generation #0';
      } else {
        tooltip = `Go back to generation #${this.generationCounter - skipAmount}`;
      }
    }
    return tooltip;
  }

  /**
   * Tooltip for the forward step button.
   *
   * @public
   * @type {string}
   */
  public get stepForwardTooltip(): string {
    let tooltip = 'Busy';
    const skipAmount = this.validSkipAmount;
    if (!this.stepForwardDisabled && skipAmount !== null) {
      tooltip = `Skip to generation #${skipAmount + this.generationCounter}`;
    }
    return tooltip;
  }

  /**
   * Creates the playback section.
   *
   * @public
   * @constructor
   */
  public constructor() {
    super('golt-playback-section-prefs');
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<PlaybackSection>): void {
    if (changes.engineBlocked || changes.downloading || changes.stepping || changes.backpressure || changes.rebuilding) {
      this.syncControlDisabledState();
    }
  }

  /**
   * @inheritdoc
   */
  public ngOnInit(): void {
    this.restorePreferences();
    this.form.controls.skipAmount.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.onSkipAmountChange());
    this.syncControlDisabledState();
  }

  /**
   * Emits a backward step request.
   *
   * @public
   */
  public onStepBack(): void {
    const skipAmount = this.validSkipAmount;
    if (skipAmount !== null) {
      this.stepBack.emit(skipAmount);
    }
  }

  /**
   * Emits a forward step request.
   *
   * @public
   */
  public onStepForward(): void {
    const skipAmount = this.validSkipAmount;
    if (skipAmount !== null) {
      this.stepForward.emit(skipAmount);
    }
  }

  /**
   * Collects current preferences.
   *
   * @protected
   * @returns {PlaybackSectionPreferences}
   */
  protected override collectPreferences(): PlaybackSectionPreferences {
    return {
      skipAmount: this.validSkipAmount ?? this.defaultPreferences.skipAmount
    };
  }

  /**
   * Applies restored preferences.
   *
   * @protected
   * @param {PlaybackSectionPreferences} preferences
   */
  protected override applyPreferences(preferences: PlaybackSectionPreferences): void {
    this.form.controls.skipAmount.setValue(preferences.skipAmount, {emitEvent: false});
  }

  /**
   * Normalizes stored preferences.
   *
   * @protected
   * @param {Partial<PlaybackSectionPreferences>} stored
   * @param {PlaybackSectionPreferences} defaults
   * @returns {PlaybackSectionPreferences}
   */
  protected override normalizePreferences(stored: Partial<PlaybackSectionPreferences>, defaults: PlaybackSectionPreferences): PlaybackSectionPreferences {
    return {
      skipAmount: typeof stored.skipAmount === 'number' && Number.isInteger(stored.skipAmount) && stored.skipAmount >= 1 ? stored.skipAmount : defaults.skipAmount
    };
  }

  /**
   * Persists valid skip amount changes.
   *
   * @private
   */
  private onSkipAmountChange(): void {
    if (this.form.controls.skipAmount.valid) {
      this.savePreferences();
    }
  }

  /**
   * Synchronizes control disabled state.
   *
   * @private
   */
  private syncControlDisabledState(): void {
    this.setControlDisabled(this.form.controls.skipAmount, this.livePlaybackDisabled);
  }

  /**
   * Sets one control disabled state without emitting value changes.
   *
   * @private
   * @param {AbstractControl} control control to update.
   * @param {boolean} disabled whether the control should be disabled.
   */
  private setControlDisabled(control: AbstractControl, disabled: boolean): void {
    if (disabled && control.enabled) {
      control.disable({emitEvent: false});
    } else if (!disabled && control.disabled) {
      control.enable({emitEvent: false});
    }
  }
}
