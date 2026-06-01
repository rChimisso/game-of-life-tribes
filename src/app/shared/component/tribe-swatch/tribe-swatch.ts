import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';

/**
 * Tribe swatch.
 *
 * @class TribeSwatch
 * @typedef {TribeSwatch}
 */
@Component({
  selector: 'gol-tribe-swatch',
  standalone: true,
  templateUrl: './tribe-swatch.html',
  styleUrl: './tribe-swatch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TribeSwatch {
  /**
   * Tribe color.
   *
   * @public
   * @type {string}
   */
  @Input()
  public color = '';

  /**
   * Whether the swatch is selected.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public selected = false;

  /**
   * Whether the swatch can be selected.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public interactive = true;

  /**
   * Tribe name.
   *
   * @public
   * @type {string}
   */
  @Input()
  public title = '';

  /**
   * Swatch size.
   *
   * @public
   * @type {'xs' | 'sm' | 'md' | 'base'}
   */
  @Input()
  public size: 'xs' | 'sm' | 'md' | 'base' = 'sm';

  /**
   * Emitter for the clicked event.
   *
   * @public
   * @readonly
   * @type {EventEmitter<Event>}
   */
  @Output()
  public readonly clicked = new EventEmitter<Event>();

  /**
   * Emits the clicked event if interactive.
   *
   * @public
   * @param {Event} event 
   */
  public emitClick(event: Event): void {
    if (this.interactive) {
      this.clicked.emit(event);
    }
  }
}
