/**
 * Default application title.
 *
 * @type {string}
 */
export const SEO_DEFAULT_TITLE = 'Game of Life: Tribes';

/**
 * Default application description.
 *
 * @type {string}
 */
export const SEO_DEFAULT_DESCRIPTION = 'An interactive, browser-based cellular automata simulator extending Conway\'s Game of Life with multiple tribes and configurable rules.';

/**
 * Absolute deployed application URL without a trailing slash.
 *
 * @type {string}
 */
export const SEO_SITE_URL = 'https://game-of-life-tribes.dev';

/**
 * Search and sharing metadata for an indexable page.
 *
 * @interface SeoPage
 * @typedef {SeoPage}
 */
export interface SeoPage {
  /**
   * Browser and search-result title.
   */
  title: string;
  /**
   * Search-result and sharing description.
   */
  description: string;
  /**
   * Absolute canonical page URL.
   */
  canonicalUrl: string;
}
