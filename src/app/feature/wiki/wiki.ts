import {DOCUMENT, isPlatformBrowser} from '@angular/common';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, PLATFORM_ID, ViewEncapsulation, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {ActivatedRoute, RouterLink} from '@angular/router';

import {WikiContent, WikiContentPage, WikiNavigationSection} from './model/wiki-content';
import wikiContent from './model/wiki-content.generated.json';

import {SEO_DEFAULT_TITLE, SEO_SITE_URL} from '~gol/core/model/seo-page';
import {SeoService} from '~gol/core/service/seo';

/**
 * Prerendered Wiki page and navigation shell.
 *
 * @class WikiPage
 * @typedef {WikiPage}
 */
@Component({
  selector: 'gol-wiki',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './wiki.html',
  styleUrl: './wiki.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class WikiPage {
  /**
   * Wiki content.
   *
   * @private
   * @readonly
   * @type {WikiContent}
   */
  private readonly wikiContent: WikiContent = wikiContent;

  /**
   * Wiki sidebar sections.
   *
   * @public
   * @readonly
   * @type {WikiNavigationSection[]}
   */
  public readonly navigation: WikiNavigationSection[] = this.wikiContent.navigation;

  /**
   * Current canonical page slug.
   *
   * @public
   * @type {string}
   */
  public currentSlug = 'home';

  /**
   * Current page content, or null when the slug is unknown.
   *
   * @public
   * @type {WikiContentPage | null}
   */
  public page: WikiContentPage | null = null;

  /**
   * Sanitized HTML trusted after the build-time sanitation pass.
   *
   * @public
   * @type {SafeHtml | null}
   */
  public html: SafeHtml | null = null;

  /**
   * Component change detector.
   *
   * @private
   * @readonly
   * @type {ChangeDetectorRef}
   */
  private readonly cdr = inject(ChangeDetectorRef);

  /**
   * Component destruction context.
   *
   * @private
   * @readonly
   * @type {DestroyRef}
   */
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Active platform document.
   *
   * @private
   * @readonly
   * @type {Document}
   */
  private readonly document = inject(DOCUMENT);

  /**
   * Angular platform identifier.
   *
   * @private
   * @readonly
   * @type {object}
   */
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * Current activated Wiki route.
   *
   * @private
   * @readonly
   * @type {ActivatedRoute}
   */
  private readonly route = inject(ActivatedRoute);

  /**
   * Angular HTML trust boundary.
   *
   * @private
   * @readonly
   * @type {DomSanitizer}
   */
  private readonly sanitizer = inject(DomSanitizer);

  /**
   * Document metadata service.
   *
   * @private
   * @readonly
   * @type {SeoService}
   */
  private readonly seo = inject(SeoService);

  /**
   * @constructor
   * @public
   */
  public constructor() {
    this.updatePage(this.route.snapshot.paramMap.get('page'));
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => this.updatePage(params.get('page')));
  }

  /**
   * Selects and publishes the current Wiki page.
   *
   * @private
   * @param {string | null} routeSlug route page parameter.
   */
  private updatePage(routeSlug: string | null): void {
    this.currentSlug = routeSlug?.toLowerCase() ?? 'home';
    this.page = this.wikiContent.pages[this.currentSlug] ?? null;
    if (this.page !== null) {
      this.html = this.sanitizer.bypassSecurityTrustHtml(this.page.html);
      this.seo.setWikiPage({
        title: `${this.page.title} | ${SEO_DEFAULT_TITLE}`,
        description: this.page.description,
        canonicalUrl: `${SEO_SITE_URL}/wiki/${this.currentSlug === 'home' ? '' : `${this.currentSlug}/`}`
      });
      this.scrollToFragment();
    } else {
      this.html = null;
      this.seo.setNoIndex('Wiki page not found', 'The requested Game of Life: Tribes Wiki page does not exist.');
    }
    this.cdr.markForCheck();
  }

  /**
   * Scrolls to a rendered page fragment after client-side navigation.
   *
   * @private
   */
  private scrollToFragment(): void {
    if (isPlatformBrowser(this.platformId)) {
      const fragment = this.document.location.hash.slice(1);
      if (fragment.length > 0) {
        setTimeout(() => this.document.getElementById(fragment)?.scrollIntoView(), 0);
      }
    }
  }
}
