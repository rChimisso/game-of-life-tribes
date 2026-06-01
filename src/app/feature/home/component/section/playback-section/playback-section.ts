import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {PersistedPreferencesComponent} from '~gol/core/abstract/persisted-preferences-component';
import {PlaybackSectionPreferences} from '~gol/feature/home/model/preferences';
import {Button} from '~gol/shared/component/button/button';
import {InputComponent} from '~gol/shared/component/input/input';
import {LabelValue} from '~gol/shared/component/label-value/label-value';

/**
 * Playback controls section.
 *
 * @class PlaybackSection
 * @typedef {PlaybackSection}
 */
@Component({
  selector: 'gol-playback-section',
  standalone: true,
  imports: [
    FormsModule,
    Button,
    InputComponent,
    LabelValue
  ],
  templateUrl: './playback-section.html',
  styleUrl: './playback-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaybackSection extends PersistedPreferencesComponent<PlaybackSectionPreferences> {
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
   * Number of generations to step.
   *
   * @public
   * @type {number}
   */
  public skipAmount = this.defaultPreferences.skipAmount;

  /**
   * Whether the run button is disabled.
   *
   * @public
   * @type {boolean}
   */
  public get runDisabled(): boolean {
    return this.downloading || this.rebuilding || (this.backpressure && !this.running && !this.stepping);
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
   * Whether stepping backward is disabled.
   *
   * @public
   * @type {boolean}
   */
  public get stepBackDisabled(): boolean {
    return this.running || this.isBusy || this.stepBackBaseDisabled;
  }

  /**
   * Whether stepping forward is disabled.
   *
   * @public
   * @type {boolean}
   */
  public get stepForwardDisabled(): boolean {
    return this.running || this.isBusy;
  }

  /**
   * Tooltip for the backward step button.
   *
   * @public
   * @type {string}
   */
  public get stepBackTooltip(): string {
    if (this.stepBackDisabled) {
      return 'Busy or no recording available';
    }
    if (+this.skipAmount > this.generationCounter) {
      return 'Go back to generation #0';
    }
    return `Go back to generation #${this.generationCounter - this.skipAmount}`;
  }

  /**
   * Tooltip for the forward step button.
   *
   * @public
   * @type {string}
   */
  public get stepForwardTooltip(): string {
    if (this.stepForwardDisabled) {
      return 'Busy';
    }
    return `Skip to generation #${+this.skipAmount + this.generationCounter}`;
  }

  /**
   * Creates the playback section.
   *
   * @public
   * @constructor
   */
  public constructor() {
    super('golt-playback-section-prefs');
    this.restorePreferences();
  }

  /**
   * Handles skip amount changes.
   *
   * @public
   * @param {number} value
   */
  public onSkipAmountChange(value: number): void {
    this.skipAmount = Math.max(1, Math.floor(+value || 1));
    this.savePreferences();
  }

  /**
   * Emits a backward step request.
   *
   * @public
   */
  public onStepBack(): void {
    this.stepBack.emit(+this.skipAmount);
  }

  /**
   * Emits a forward step request.
   *
   * @public
   */
  public onStepForward(): void {
    this.stepForward.emit(+this.skipAmount);
  }

  /**
   * Collects current preferences.
   *
   * @protected
   * @returns {PlaybackSectionPreferences}
   */
  protected override collectPreferences(): PlaybackSectionPreferences {
    return {
      skipAmount: +this.skipAmount
    };
  }

  /**
   * Applies restored preferences.
   *
   * @protected
   * @param {PlaybackSectionPreferences} preferences
   */
  protected override applyPreferences(preferences: PlaybackSectionPreferences): void {
    this.skipAmount = Math.max(1, Math.floor(+preferences.skipAmount || 1));
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
      skipAmount: typeof stored.skipAmount === 'number' && stored.skipAmount >= 1 ? stored.skipAmount : defaults.skipAmount
    };
  }
}
