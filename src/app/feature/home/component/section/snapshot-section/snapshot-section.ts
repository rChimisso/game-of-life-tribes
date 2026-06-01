import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

import {ApplyRestoreButtons} from '~gol/shared/component/apply-restore/button-pair';
import {ProgressStatusMode} from '~gol/shared/component/progress-status/model/progress-status';
import {ProgressStatus} from '~gol/shared/component/progress-status/progress-status';

/**
 * Snapshot save and load section.
 *
 * @class SnapshotSection
 * @typedef {SnapshotSection}
 */
@Component({
  selector: 'gol-snapshot-section',
  standalone: true,
  imports: [ApplyRestoreButtons, MatIconModule, ProgressStatus],
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
   * Whether the simulation is running.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public running = false;

  /**
   * Whether a skip or step operation is active.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public stepping = false;

  /**
   * Current snapshot progress bar mode.
   *
   * @public
   * @type {ProgressStatusMode}
   */
  @Input({required: true})
  public snapshotProgressMode: ProgressStatusMode = 'indeterminate';

  /**
   * Current snapshot progress percentage.
   *
   * @public
   * @type {(number | null)}
   */
  @Input()
  public snapshotProgressPercent: number | null = null;

  /**
   * Current snapshot progress status from the worker.
   *
   * @public
   * @type {string}
   */
  @Input()
  public snapshotProgressStatus = '';

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
   * Whether snapshot actions are disabled.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get snapshotActionsDisabled(): boolean {
    return this.running || this.downloading || this.savingState || this.loadingState || this.stepping;
  }

  /**
   * Whether snapshot progress is active.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get snapshotProgressActive(): boolean {
    return this.savingState || this.loadingState;
  }

  /**
   * Current snapshot progress status.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get displayedSnapshotProgressStatus(): string {
    return this.snapshotProgressStatus || (this.savingState ? 'Saving snapshot' : 'Loading snapshot');
  }

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
