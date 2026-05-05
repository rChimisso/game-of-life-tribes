import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

/**
 * Home sidebar section.
 *
 * @export
 * @class HomeSection
 * @typedef {HomeSection}
 */
@Component({
  selector: 'gol-home-section',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './section.html',
  styleUrl: './section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeSection {
  /**
   * Section title.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public title = '';

  /**
   * Section description.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public description = '';

  /**
   * Optional section info for additional data in the title space.
   *
   * @public
   * @type {string}
   */
  @Input()
  public info = '';

  /**
   * Whether the section is collapsible.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public collapsible = true;

  /**
   * Whether the section is expanded.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public expanded = true;

  /**
   * Emitter for the expanded state change event.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly expandedChange = new EventEmitter<boolean>();

  /**
   * Handles the header click event.
   *
   * @public
   */
  public onHeaderClick(): void {
    if (this.collapsible) {
      this.expandedChange.emit(!this.expanded);
    }
  }
}
