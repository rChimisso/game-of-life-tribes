import {Tribe, TribeSelector} from '~gol/feature/home/model/rule';

/**
 * Event for when a selector editor's validation state changes.
 *
 * @interface SelectorStateChangeEvent
 * @typedef {SelectorStateChangeEvent}
 */
export interface SelectorStateChangeEvent {
  /**
   * Whether it is now dirty.
   *
   * @type {boolean}
   */
  dirty: boolean;
  /**
   * Whether it is now invalid.
   *
   * @type {boolean}
   */
  invalid: boolean;
}

/**
 * Event for when a selector editor's content changes.
 *
 * @interface SelectorChangeEvent
 * @typedef {SelectorChangeEvent}
 * @extends {SelectorStateChangeEvent}
 */
export interface SelectorChangeEvent extends SelectorStateChangeEvent {
  /**
   * The updated selector.
   *
   * @type {TribeSelector<Tribe[]>}
   */
  selector: TribeSelector<Tribe[]>;
}
