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
export const SEO_DEFAULT_DESCRIPTION = 'A superset of the classic Game of Life that adds multiple cell tribes! Experiment, learn, and have fun with the provided UI editor!';

/**
 * Absolute deployed application URL without a trailing slash.
 *
 * @type {string}
 */
export const SEO_SITE_URL = 'https://rchimisso.github.io/game-of-life-tribes';

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
