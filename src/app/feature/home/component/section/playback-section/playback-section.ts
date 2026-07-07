import {ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';

import {setControlDisabled, validControlValues} from '~gol/core/function/form-control';
import {FormType} from '~gol/core/model/form-type';
import {TypedChanges} from '~gol/core/model/typed-change';
import {PreferencesStore} from '~gol/core/service/preferences-store';
import {PlaybackFormValue} from '~gol/feature/home/model/playback-form';
import {PlaybackSectionPreferences} from '~gol/feature/home/model/preferences';
import {Button} from '~gol/shared/component/button/button';
import {NumberInputComponent} from '~gol/shared/component/input/number-input/number-input';
import {LabelValue} from '~gol/shared/component/label-value/label-value';

/**
 * Playback controls section.
 *
 * @class PlaybackSection
 * @typedef {PlaybackSection}
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
export class PlaybackSection implements OnChanges, OnInit {
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
   * @private
   * @readonly
   * @type {PlaybackSectionPreferences}
   */
  private readonly defaultPreferences: PlaybackSectionPreferences = {
    skipAmount: 1
  };

  /**
   * Playback form.
   *
   * @public
   * @readonly
   * @type {FormGroup<FormType<PlaybackFormValue>>}
   */
  public readonly form = new FormGroup<FormType<PlaybackFormValue>>({
    skipAmount: new FormControl<number | null>(this.defaultPreferences.skipAmount, {validators: [Validators.required]})
  });

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
   * @param {DestroyRef} destroyRef destroy ref for subscriptions.
   * @param {PreferencesStore} preferencesStore preference storage.
   */
  public constructor(private readonly destroyRef: DestroyRef, private readonly preferencesStore: PreferencesStore) {}

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
    validControlValues(this.form.controls.skipAmount).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.savePreferences());
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
   * Restores the minimum skip amount when the field loses focus with an invalid value.
   *
   * @public
   */
  public restoreInvalidSkipAmount(): void {
    if (this.form.controls.skipAmount.invalid) {
      this.form.controls.skipAmount.setValue(this.defaultPreferences.skipAmount, {emitEvent: false});
    }
  }

  /**
   * Collects current preferences.
   *
   * @private
   * @returns {PlaybackSectionPreferences}
   */
  private collectPreferences(): PlaybackSectionPreferences {
    return {
      skipAmount: this.validSkipAmount ?? this.defaultPreferences.skipAmount
    };
  }

  /**
   * Applies restored preferences.
   *
   * @private
   * @param {PlaybackSectionPreferences} preferences
   */
  private applyPreferences(preferences: PlaybackSectionPreferences): void {
    this.form.controls.skipAmount.setValue(preferences.skipAmount, {emitEvent: false});
  }

  /**
   * Normalizes stored preferences.
   *
   * @private
   * @param {Partial<PlaybackSectionPreferences>} stored
   * @param {PlaybackSectionPreferences} defaults
   * @returns {PlaybackSectionPreferences}
   */
  private normalizePreferences(stored: Partial<PlaybackSectionPreferences>, defaults: PlaybackSectionPreferences): PlaybackSectionPreferences {
    return {
      skipAmount: typeof stored.skipAmount === 'number' && Number.isInteger(stored.skipAmount) && stored.skipAmount >= 1 ? stored.skipAmount : defaults.skipAmount
    };
  }

  /**
   * Synchronizes control disabled state.
   *
   * @private
   */
  private syncControlDisabledState(): void {
    setControlDisabled(this.form.controls.skipAmount, this.livePlaybackDisabled);
  }

  /**
   * Restores preferences from storage.
   *
   * @private
   */
  private restorePreferences(): void {
    this.applyPreferences(this.preferencesStore.load('golt-playback-section-prefs', this.defaultPreferences, (stored, defaults) => this.normalizePreferences(stored, defaults)));
  }

  /**
   * Saves current preferences.
   *
   * @private
   */
  private savePreferences(): void {
    this.preferencesStore.save('golt-playback-section-prefs', this.collectPreferences());
  }
}
