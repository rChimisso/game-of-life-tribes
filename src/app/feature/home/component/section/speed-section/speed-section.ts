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
   * Whether live metrics are enabled.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public liveMetricsEnabled = true;

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
   * Emitter for live metrics changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly liveMetricsEnabledChange = new EventEmitter<boolean>();

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
    return this.recordingAvailable ? 'Recording slows down the simulation.' : 'Grid is too large for recording.';
  }

  /**
   * Live metrics availability message.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get liveMetricsMessage(): string {
    return this.liveMetricsEnabled ? 'Live metrics slow down the simulation.' : 'Live metrics are disabled.';
  }
}
