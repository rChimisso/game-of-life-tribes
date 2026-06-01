import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';

import {formatBinaryBytes} from '../../../logic/byte-format';
import {RECORDING_MAX_FRAME_BYTES} from '../../../model/recording-limits';
import {FrameSizeLimitInfo} from '../model/frame-size-limit';

import {TypedChanges} from '~gol/core/model/typed-change';
import {LabelValue} from '~gol/shared/component/label-value/label-value';

/**
 * Shared frame size and limits display.
 *
 * @export
 * @class FrameSizeLimits
 * @typedef {FrameSizeLimits}
 */
@Component({
  selector: 'gol-frame-size-limits',
  standalone: true,
  imports: [LabelValue],
  templateUrl: './frame-size-limits.html',
  styleUrl: './frame-size-limits.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrameSizeLimits implements OnChanges {
  /**
   * Pending frame size in bytes.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public frameBytes = 0;

  /**
   * Maximum allowed frame bytes.
   *
   * @public
   * @type {number}
   */
  @Input({required: true})
  public maxBytes = Infinity;

  /**
   * Emits whether the current pending frame size exceeds supported limits.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly overAllowedLimitChange = new EventEmitter<boolean>();

  /**
   * Derived display information for frame size limits.
   *
   * @public
   * @type {FrameSizeLimitInfo}
   */
  public frameInfo: FrameSizeLimitInfo = this.frameSizeLimitInfo(this.frameBytes, this.maxBytes);

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<FrameSizeLimits>): void {
    if (changes.frameBytes || changes.maxBytes) {
      this.frameInfo = this.frameSizeLimitInfo(this.frameBytes, this.maxBytes);
      this.overAllowedLimitChange.emit(this.frameInfo.overAllowedLimit);
    }
  }

  /**
   * Builds frame size display metadata and limit state for a pending edit.
   *
   * @private
   * @param {number} frameBytes pending frame size in bytes.
   * @param {number} maxBytes maximum allowed frame bytes.
   * @returns {FrameSizeLimitInfo} 
   */
  private frameSizeLimitInfo(frameBytes: number, maxBytes: number): FrameSizeLimitInfo {
    const formatted = formatBinaryBytes(frameBytes);
    const maxBytesFinite = Number.isFinite(maxBytes);
    const recordingMaxBytes = maxBytesFinite ? Math.min(RECORDING_MAX_FRAME_BYTES, maxBytes) : RECORDING_MAX_FRAME_BYTES;
    const recordingLabel = `${formatBinaryBytes(recordingMaxBytes)} (${recordingMaxBytes.toLocaleString()} bytes)`;
    const allowedLabel = maxBytesFinite ? `${formatBinaryBytes(maxBytes)} (${maxBytes.toLocaleString()} bytes)` : 'Detecting…';
    const maxBytesLabel = maxBytesFinite ? formatBinaryBytes(maxBytes) : 'Detecting…';
    return {
      frameBytes,
      formatted,
      overRecordingLimit: frameBytes > recordingMaxBytes,
      overAllowedLimit: maxBytesFinite && frameBytes > maxBytes,
      labels: {
        bytes: frameBytes.toLocaleString(),
        recording: recordingLabel,
        allowed: allowedLabel
      },
      title: `${formatted} frame size`,
      tooltip: `${formatBinaryBytes(recordingMaxBytes)} recording budget / ${maxBytesLabel} total budget`
    };
  }
}
