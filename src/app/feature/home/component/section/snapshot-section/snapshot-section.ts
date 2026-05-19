import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';

import {ApplyRestoreButtons} from '../../../../../shared/component/apply-restore/button-pair';

/**
 * Snapshot save and load section.
 *
 * @export
 * @class SnapshotSection
 * @typedef {SnapshotSection}
 */
@Component({
  selector: 'gol-snapshot-section',
  standalone: true,
  imports: [ApplyRestoreButtons, MatIconModule, MatProgressBarModule],
  templateUrl: './snapshot-section.html',
  styleUrl: './snapshot-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SnapshotSection {
  /**
   * Whether a snapshot is being saved.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public savingState = false;

  /**
   * Whether a snapshot is being loaded.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public loadingState = false;

  /**
   * Whether a download is in progress.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public downloading = false;

  /**
   * Emits snapshot save requests.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly saveState = new EventEmitter<void>();

  /**
   * Emits loaded snapshot bytes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<ArrayBuffer>}
   */
  @Output()
  public readonly loadState = new EventEmitter<ArrayBuffer>();

  /**
   * Handles file input changes.
   *
   * @public
   * @param {Event} event
   */
  public onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          this.loadState.emit(reader.result);
        }
        input.value = '';
      };
      reader.readAsArrayBuffer(file);
    }
  }
}
