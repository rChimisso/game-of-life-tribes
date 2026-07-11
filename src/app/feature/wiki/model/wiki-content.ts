/**
 * Prerendered Wiki page content.
 *
 * @interface WikiContentPage
 * @typedef {WikiContentPage}
 */
export interface WikiContentPage {
  /**
   * Canonical lowercase route slug.
   */
  slug: string;
  /**
   * Page title extracted from its first heading.
   */
  title: string;
  /**
   * Search and sharing description extracted from page prose.
   */
  description: string;
  /**
   * Sanitized HTML generated from the Markdown source.
   */
  html: string;
}

/**
 * Wiki navigation entry.
 *
 * @interface WikiNavigationItem
 * @typedef {WikiNavigationItem}
 */
export interface WikiNavigationItem {
  /**
   * Link label.
   */
  label: string;
  /**
   * Canonical page slug.
   */
  slug: string;
}

/**
 * Wiki navigation section.
 *
 * @interface WikiNavigationSection
 * @typedef {WikiNavigationSection}
 */
export interface WikiNavigationSection {
  /**
   * Section landing page.
   */
  landing: WikiNavigationItem;
  /**
   * Child pages listed below the landing page.
   */
  items: WikiNavigationItem[];
}

/**
 * Generated Wiki content contract.
 *
 * @interface WikiContent
 * @typedef {WikiContent}
 */
export interface WikiContent {
  /**
   * Pages keyed by canonical slug.
   */
  pages: Record<string, WikiContentPage>;
  /**
   * Sidebar navigation sections.
   */
  navigation: WikiNavigationSection[];
  /**
   * Canonical slugs emitted during prerendering.
   */
  slugs: string[];
}
