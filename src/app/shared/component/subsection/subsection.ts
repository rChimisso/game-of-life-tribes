import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

/**
 * Collapsible subsection.
 *
 * @export
 * @class SubsectionComponent
 * @typedef {SubsectionComponent}
 */
@Component({
  selector: 'gol-subsection',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './subsection.html',
  styleUrl: './subsection.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubsectionComponent {
  /**
   * Subsection title.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public title = '';

  /**
   * Whether the subsection is expanded.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public expanded = true;

  /**
   * Whether the subsection header is disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public disabled = false;

  /**
   * Emitter for expanded state changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly expandedChange = new EventEmitter<boolean>();

  /**
   * Toggles the expanded state.
   *
   * @public
   */
  public toggle(): void {
    if (!this.disabled) {
      this.expandedChange.emit(!this.expanded);
    }
  }
}
