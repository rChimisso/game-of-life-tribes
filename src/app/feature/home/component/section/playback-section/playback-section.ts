import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {Button} from '../../../../../shared/component/button/button';
import {InputComponent} from '../../../../../shared/component/input/input';

import {LabelValue} from '~gol/shared/component/label-value/label-value';

/**
 * Playback controls section.
 *
 * @export
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
export class PlaybackSection {
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
   * Number of generations to step.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public skipAmount = 1;

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
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly stepBack = new EventEmitter<void>();

  /**
   * Emitter for skip amount changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<number>}
   */
  @Output()
  public readonly skipAmountChange = new EventEmitter<number>();

  /**
   * Emitter for forward step actions.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly stepForward = new EventEmitter<void>();

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
}
