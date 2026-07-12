import {Injectable} from '@angular/core';

import {WikiPreferences} from '../model/wiki-preferences';

/**
 * Retains Wiki navigation state while route records recreate the Wiki component.
 *
 * @class WikiNavigationState
 * @typedef {WikiNavigationState}
 */
@Injectable({providedIn: 'root'})
export class WikiNavigationState {
  /**
   * Preferences restored during the current browser session.
   *
   * @public
   * @type {WikiPreferences | null}
   */
  public preferences: WikiPreferences | null = null;
}
