import {DOCUMENT} from '@angular/common';
import {Injectable, inject} from '@angular/core';
import {Meta, Title} from '@angular/platform-browser';

import {SEO_DEFAULT_DESCRIPTION, SEO_DEFAULT_TITLE, SEO_SITE_URL, SeoPage} from '../model/seo-page';

/**
 * Owns document metadata across client and prerendered routes.
 *
 * @class SeoService
 * @typedef {SeoService}
 */
@Injectable({providedIn: 'root'})
export class SeoService {
  /**
   * Active platform document.
   *
   * @private
   * @readonly
   * @type {Document}
   */
  private readonly document = inject(DOCUMENT);

  /**
   * Angular document metadata manager.
   *
   * @private
   * @readonly
   * @type {Meta}
   */
  private readonly meta = inject(Meta);

  /**
   * Angular document title manager.
   *
   * @private
   * @readonly
   * @type {Title}
   */
  private readonly title = inject(Title);

  /**
   * Restores the simulation's default metadata.
   *
   * @public
   */
  public setDefault(): void {
    this.setIndexablePage({
      title: SEO_DEFAULT_TITLE,
      description: SEO_DEFAULT_DESCRIPTION,
      canonicalUrl: `${SEO_SITE_URL}/`
    }, 'website');
  }

  /**
   * Applies indexable Wiki page metadata.
   *
   * @public
   * @param {SeoPage} page Wiki metadata.
   */
  public setWikiPage(page: SeoPage): void {
    this.setIndexablePage(page, 'article');
  }

  /**
   * Applies metadata for an error or unsupported route.
   *
   * @public
   * @param {string} pageTitle page title.
   * @param {string} description page description.
   */
  public setNoIndex(pageTitle: string, description: string): void {
    this.title.setTitle(`${pageTitle} | ${SEO_DEFAULT_TITLE}`);
    this.meta.updateTag({name: 'description', content: description});
    this.meta.updateTag({name: 'robots', content: 'noindex'});
    this.meta.updateTag({property: 'og:title', content: pageTitle});
    this.meta.updateTag({property: 'og:description', content: description});
    this.meta.updateTag({property: 'og:type', content: 'website'});
    this.meta.removeTag('property=\'og:url\'');
    this.removeCanonicalLink();
  }

  /**
   * Applies common indexable page metadata.
   *
   * @private
   * @param {SeoPage} page page metadata.
   * @param {'article' | 'website'} type Open Graph page type.
   */
  private setIndexablePage(page: SeoPage, type: 'article' | 'website'): void {
    this.title.setTitle(page.title);
    this.meta.updateTag({name: 'description', content: page.description});
    this.meta.updateTag({name: 'robots', content: 'index,follow'});
    this.meta.updateTag({property: 'og:title', content: page.title});
    this.meta.updateTag({property: 'og:description', content: page.description});
    this.meta.updateTag({property: 'og:type', content: type});
    this.meta.updateTag({property: 'og:url', content: page.canonicalUrl});
    this.setCanonicalLink(page.canonicalUrl);
  }

  /**
   * Updates the canonical document link.
   *
   * @private
   * @param {string} url canonical URL.
   */
  private setCanonicalLink(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (link === null || link === undefined) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
  }

  /**
   * Removes the canonical link from non-indexable pages.
   *
   * @private
   */
  private removeCanonicalLink(): void {
    const link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (link !== null && link !== undefined) {
      link.remove();
    }
  }
}
