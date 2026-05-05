import {Tribe} from './rule';

/**
 * Save event for adding a tribe.
 *
 * @export
 * @interface AddTribeSaveEvent
 * @typedef {AddTribeSaveEvent}
 */
export interface AddTribeSaveEvent {
  /**
   * Save action kind.
   *
   * @type {'add'}
   */
  kind: 'add';
  /**
   * Tribe payload to add.
   *
   * @type {Tribe}
   */
  tribe: Tribe;
}

/**
 * Save event for editing an existing tribe.
 *
 * @export
 * @interface EditTribeSaveEvent
 * @typedef {EditTribeSaveEvent}
 */
export interface EditTribeSaveEvent {
  /**
   * Save action kind.
   *
   * @type {'edit'}
   */
  kind: 'edit';
  /**
   * Stable key of the edited tribe.
   *
   * @type {string}
   */
  key: string;
  /**
   * Tribe payload after editing.
   *
   * @type {Tribe}
   */
  tribe: Tribe;
}

/**
 * Save event for tribe add/edit actions.
 *
 * @export
 * @typedef {TribeSaveEvent}
 */
export type TribeSaveEvent = AddTribeSaveEvent | EditTribeSaveEvent;
