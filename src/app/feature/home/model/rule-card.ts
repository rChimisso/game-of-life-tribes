import {Rule, Tribe} from './rule';

/**
 * Event for when a rule's state changes.
 *
 * @interface RuleStateChangeEvent
 * @typedef {RuleStateChangeEvent}
 */
export interface RuleStateChangeEvent {
  /**
   * Rule index.
   *
   * @type {number}
   */
  index: number;
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
 * Event for when a rule's content changes.
 *
 * @interface RuleChangeEvent
 * @typedef {RuleChangeEvent}
 * @extends {RuleStateChangeEvent}
 */
export interface RuleChangeEvent extends RuleStateChangeEvent {
  /**
   * The updated rule.
   *
   * @type {Rule<Tribe[]>}
   */
  rule: Rule<Tribe[]>;
}
