import {Become, Tribe} from '~gol/feature/home/model/rule';

/**
 * Event for when a become editor's validation state changes.
 *
 * @interface BecomeStateChangeEvent
 * @typedef {BecomeStateChangeEvent}
 */
export interface BecomeStateChangeEvent {
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
 * Event for when a become editor's content changes.
 *
 * @interface BecomeChangeEvent
 * @typedef {BecomeChangeEvent}
 * @extends {BecomeStateChangeEvent}
 */
export interface BecomeChangeEvent extends BecomeStateChangeEvent {
  /**
   * The updated outcome expression.
   *
   * @type {Become<Tribe[]>}
   */
  become: Become<Tribe[]>;
}
