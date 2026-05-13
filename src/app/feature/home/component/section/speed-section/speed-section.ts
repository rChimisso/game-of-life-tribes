import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {CheckboxComponent} from '../../../../../shared/component/checkbox/checkbox';
import {InputComponent} from '../../../../../shared/component/input/input';

/**
 * Speed and recording section.
 *
 * @export
 * @class SpeedSection
 * @typedef {SpeedSection}
 */
@Component({
  selector: 'gol-speed-section',
  standalone: true,
  imports: [FormsModule, InputComponent, CheckboxComponent],
  templateUrl: './speed-section.html',
  styleUrl: './speed-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpeedSection {
  /**
   * Current simulation speed.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public speed = 1;

  /**
   * Whether max speed is enabled.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public maxSpeed = false;

  /**
   * Whether a download is in progress.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public downloading = false;

  /**
   * Whether recording is available for this grid.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public recordingAvailable = false;

  /**
   * Whether recording is enabled.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public recording = false;

  /**
   * Emitter for speed changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<string>}
   */
  @Output()
  public readonly speedChange = new EventEmitter<string>();

  /**
   * Emitter for max speed changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly maxSpeedChange = new EventEmitter<boolean>();

  /**
   * Emitter for recording changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly recordingChange = new EventEmitter<boolean>();

  /**
   * Whether recording control is disabled.
   *
   * @public
   * @type {boolean}
   */
  public get recordingDisabled(): boolean {
    return this.downloading || !this.recordingAvailable;
  }

  /**
   * Recording availability message.
   *
   * @public
   * @type {string}
   */
  public get recordingGateMessage(): string {
    if (this.recordingAvailable) {
      return 'Recording slows down the simulation.';
    }
    return 'Grid is too large for recording.';
  }
}
