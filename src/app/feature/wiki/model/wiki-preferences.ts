/**
 * Persisted Wiki navigation preferences.
 *
 * @interface WikiPreferences
 * @typedef {WikiPreferences}
 */
export interface WikiPreferences {
  /**
   * Canonical slugs of collapsed navigation sections.
   *
   * @type {string[]}
   */
  collapsedSections: string[];
  /**
   * Whether the mobile navigation menu is expanded.
   *
   * @type {boolean}
   */
  mobileNavigationExpanded: boolean;
}

/**
 * Local-storage key for Wiki preferences.
 *
 * @type {string}
 */
export const WIKI_PREFERENCES_STORAGE_KEY = 'golt-wiki-prefs';

/**
 * Default Wiki navigation preferences.
 *
 * @type {WikiPreferences}
 */
export const DEFAULT_WIKI_PREFERENCES: WikiPreferences = {
  collapsedSections: [],
  mobileNavigationExpanded: false
};
