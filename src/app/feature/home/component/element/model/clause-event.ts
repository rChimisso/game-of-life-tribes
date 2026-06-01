import {Clause, Tribe} from '../../../model/rule';

/**
 * Clause state change event.
 *
 * @interface ClauseStateChangeEvent
 * @typedef {ClauseStateChangeEvent}
 */
export interface ClauseStateChangeEvent {
  /**
   * Whether the clause has been modified.
   *
   * @type {boolean}
   */
  dirty: boolean;
  /**
   * Whether the clause is in an invalid state.
   *
   * @type {boolean}
   */
  invalid: boolean;
}

/**
 * Clause change event.
 *
 * @interface ClauseChangeEvent
 * @typedef {ClauseChangeEvent}
 * @extends {ClauseStateChangeEvent}
 */
export interface ClauseChangeEvent extends ClauseStateChangeEvent {
  /**
   * Changed clause.
   *
   * @type {Clause<Tribe[]>}
   */
  clause: Clause<Tribe[]>;
}
