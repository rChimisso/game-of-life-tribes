import {DOCUMENT, ViewportScroller, isPlatformBrowser} from '@angular/common';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, PLATFORM_ID, ViewEncapsulation, afterNextRender, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatIcon} from '@angular/material/icon';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';

import {WikiFooter} from './component/footer/wiki-footer';
import {WikiContent, WikiContentPage, WikiNavigationItem, WikiNavigationSection} from './model/wiki-content';
import wikiContent from './model/wiki-content.generated.json';
import {DEFAULT_WIKI_PREFERENCES, WIKI_PREFERENCES_STORAGE_KEY, WikiPreferences} from './model/wiki-preferences';
import {WikiNavigationState} from './service/wiki-navigation-state';

import {SEO_DEFAULT_TITLE, SEO_SITE_URL} from '~gol/core/model/seo-page';
import {PreferencesStore} from '~gol/core/service/preferences-store';
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
  imports: [MatIcon, RouterLink, WikiFooter],
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
   * Previous page in sidebar reading order.
   *
   * @public
   * @type {WikiNavigationItem | null}
   */
  public previousPage: WikiNavigationItem | null = null;

  /**
   * Next page in sidebar reading order.
   *
   * @public
   * @type {WikiNavigationItem | null}
   */
  public nextPage: WikiNavigationItem | null = null;

  /**
   * Sanitized HTML trusted after the build-time sanitation pass.
   *
   * @public
   * @type {SafeHtml | null}
   */
  public html: SafeHtml | null = null;

  /**
   * Canonical slugs of expanded navigation sections.
   *
   * @public
   * @type {Set<string>}
   */
  public expandedSectionSlugs: Set<string> = new Set();

  /**
   * Whether persisted navigation preferences have been restored.
   *
   * @public
   * @type {boolean}
   */
  public preferencesReady = false;

  /**
   * Whether the mobile Wiki navigation menu is expanded.
   *
   * @public
   * @type {boolean}
   */
  public mobileNavigationExpanded = false;

  /**
   * Whether the mobile navigation is currently transitioning.
   *
   * @public
   * @type {boolean}
   */
  public mobileNavigationAnimating = false;

  /**
   * Whether navigation transitions may run after initial state restoration.
   *
   * @public
   * @type {boolean}
   */
  public navigationTransitionsReady = false;

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
   * Angular application router.
   *
   * @private
   * @readonly
   * @type {Router}
   */
  private readonly router = inject(Router);

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
   * Angular viewport scrolling controller.
   *
   * @private
   * @readonly
   * @type {ViewportScroller}
   */
  private readonly viewportScroller = inject(ViewportScroller);

  /**
   * Persisted preference storage.
   *
   * @private
   * @readonly
   * @type {PreferencesStore}
   */
  private readonly preferencesStore = inject(PreferencesStore);

  /**
   * In-memory navigation state shared across Wiki route records.
   *
   * @private
   * @readonly
   * @type {WikiNavigationState}
   */
  private readonly navigationState = inject(WikiNavigationState);

  /**
   * Canonical slugs of navigation sections containing child pages.
   *
   * @private
   * @readonly
   * @type {Set<string>}
   */
  private readonly expandableSectionSlugs: Set<string> = new Set(this.navigation.filter(section => section.items.length > 0).map(section => section.landing.slug));

  /**
   * Wiki pages in sidebar reading order.
   *
   * @private
   * @readonly
   * @type {WikiNavigationItem[]}
   */
  private readonly navigationItems: WikiNavigationItem[] = this.navigation.flatMap(section => [section.landing, ...section.items]);

  /**
   * @constructor
   * @public
   */
  public constructor() {
    this.viewportScroller.setOffset(() => [0, (this.document.querySelector<HTMLElement>('.wiki-header')?.offsetHeight ?? 60) + 16]);
    this.expandedSectionSlugs = new Set(this.expandableSectionSlugs);
    if (this.navigationState.preferences !== null) {
      this.applyPreferences(this.navigationState.preferences);
      this.preferencesReady = true;
    }
    afterNextRender(() => {
      if (this.navigationState.preferences === null) {
        this.restorePreferences();
      }
      this.cdr.detectChanges();
      requestAnimationFrame(() => {
        this.navigationTransitionsReady = true;
        this.cdr.markForCheck();
      });
    });
    this.updatePage(this.route.snapshot.paramMap.get('page'));
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => this.updatePage(params.get('page')));
  }

  /**
   * Whether a navigation section is expanded.
   *
   * @public
   * @param {string} slug canonical section slug.
   * @returns {boolean} true when the section is expanded.
   */
  public isSectionExpanded(slug: string): boolean {
    return this.expandedSectionSlugs.has(slug);
  }

  /**
   * Toggles and persists a navigation section's expanded state.
   *
   * @public
   * @param {string} slug canonical section slug.
   */
  public toggleSection(slug: string): void {
    const expandedSectionSlugs = new Set(this.expandedSectionSlugs);
    if (expandedSectionSlugs.has(slug)) {
      expandedSectionSlugs.delete(slug);
    } else {
      expandedSectionSlugs.add(slug);
    }
    this.expandedSectionSlugs = expandedSectionSlugs;
    this.savePreferences();
  }

  /**
   * Toggles and persists the mobile navigation menu state.
   *
   * @public
   */
  public toggleMobileNavigation(): void {
    this.mobileNavigationAnimating = true;
    this.mobileNavigationExpanded = !this.mobileNavigationExpanded;
    this.savePreferences();
  }

  /**
   * Restores normal scrollbar behavior after the mobile menu transition.
   *
   * @public
   * @param {TransitionEvent} event completed CSS transition.
   */
  public onMobileNavigationTransitionEnd(event: TransitionEvent): void {
    if (event.propertyName === 'max-height') {
      this.mobileNavigationAnimating = false;
    }
  }

  /**
   * Delegates links rendered through build-generated article HTML.
   *
   * @public
   * @param {MouseEvent} event article click event.
   */
  public onArticleClick(event: MouseEvent): void {
    const {target} = event;
    const primaryUnmodifiedClick = event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    if (target instanceof Element && primaryUnmodifiedClick) {
      const anchor = target.closest('a[href]');
      const href = anchor?.getAttribute('href') ?? null;
      if (href !== null) {
        const url = new URL(href, this.document.baseURI);
        if (this.isInternalWikiUrl(url)) {
          event.preventDefault();
          this.navigateToWikiUrl(url);
        }
      }
    }
  }

  /**
   * Whether a resolved link targets this application's Wiki.
   *
   * @private
   * @param {URL} url resolved link URL.
   * @returns {boolean} true when the link targets a Wiki route.
   */
  private isInternalWikiUrl(url: URL): boolean {
    const basePath = new URL(this.document.baseURI).pathname.replace(/\/$/, '');
    return url.origin === this.document.location.origin && url.pathname.startsWith(`${basePath}/wiki`);
  }

  /**
   * Navigates to an internal Wiki URL without reloading the document.
   *
   * @private
   * @param {URL} url resolved Wiki URL.
   */
  private navigateToWikiUrl(url: URL): void {
    const {location} = this.document;
    const basePath = new URL(this.document.baseURI).pathname.replace(/\/$/, '');
    const targetPath = url.pathname.replace(/\/$/, '');
    const currentPath = location.pathname.replace(/\/$/, '');
    if (targetPath === currentPath && url.search === location.search && url.hash.length > 1) {
      const fragment = decodeURIComponent(url.hash.slice(1));
      const history = this.document.defaultView?.history;
      history?.pushState(history.state, '', `${location.pathname}${location.search}${url.hash}`);
      this.viewportScroller.scrollToAnchor(fragment);
    } else {
      const applicationUrl = `${targetPath.slice(basePath.length)}${url.search}${url.hash}`;
      this.router.navigateByUrl(applicationUrl).catch(error => console.error('Failed to navigate to Wiki link:', error));
    }
  }

  /**
   * Normalizes persisted Wiki preferences against current navigation sections.
   *
   * @private
   * @param {Partial<WikiPreferences>} stored stored preferences.
   * @param {WikiPreferences} defaults default preferences.
   * @returns {WikiPreferences} normalized preferences.
   */
  private normalizePreferences(stored: Partial<WikiPreferences>, defaults: WikiPreferences): WikiPreferences {
    const collapsedSections = Array.isArray(stored.collapsedSections) ?
      stored.collapsedSections.filter((slug): slug is string => typeof slug === 'string' && this.expandableSectionSlugs.has(slug)) :
      defaults.collapsedSections;
    const mobileNavigationExpanded = typeof stored.mobileNavigationExpanded === 'boolean' ? stored.mobileNavigationExpanded : defaults.mobileNavigationExpanded;
    return {collapsedSections, mobileNavigationExpanded};
  }

  /**
   * Applies normalized Wiki navigation preferences.
   *
   * @private
   * @param {WikiPreferences} preferences normalized preferences.
   */
  private applyPreferences(preferences: WikiPreferences): void {
    this.expandedSectionSlugs = new Set([...this.expandableSectionSlugs].filter(slug => !preferences.collapsedSections.includes(slug)));
    this.mobileNavigationExpanded = preferences.mobileNavigationExpanded;
  }

  /**
   * Restores persisted Wiki navigation preferences in the browser.
   *
   * @private
   */
  private restorePreferences(): void {
    if (isPlatformBrowser(this.platformId)) {
      const preferences = this.preferencesStore.load(WIKI_PREFERENCES_STORAGE_KEY, DEFAULT_WIKI_PREFERENCES, (stored, defaults) => this.normalizePreferences(stored, defaults));
      this.applyPreferences(preferences);
      this.navigationState.preferences = preferences;
    }
    this.preferencesReady = true;
  }

  /**
   * Saves Wiki navigation preferences in the browser.
   *
   * @private
   */
  private savePreferences(): void {
    if (isPlatformBrowser(this.platformId)) {
      const preferences: WikiPreferences = {
        collapsedSections: [...this.expandableSectionSlugs].filter(slug => !this.expandedSectionSlugs.has(slug)),
        mobileNavigationExpanded: this.mobileNavigationExpanded
      };
      this.navigationState.preferences = preferences;
      this.preferencesStore.save(WIKI_PREFERENCES_STORAGE_KEY, preferences);
    }
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
    const navigationIndex = this.navigationItems.findIndex(item => item.slug === this.currentSlug);
    this.previousPage = navigationIndex > 0 ? this.navigationItems[navigationIndex - 1] ?? null : null;
    this.nextPage = navigationIndex >= 0 ? this.navigationItems[navigationIndex + 1] ?? null : null;
    if (this.page !== null) {
      this.html = this.sanitizer.bypassSecurityTrustHtml(this.page.html);
      this.seo.setWikiPage({
        title: `${this.page.title} | ${SEO_DEFAULT_TITLE}`,
        description: this.page.description,
        canonicalUrl: `${SEO_SITE_URL}/wiki/${this.currentSlug === 'home' ? '' : `${this.currentSlug}/`}`
      });
    } else {
      this.html = null;
      this.seo.setNoIndex('Wiki page not found', 'The requested Game of Life: Tribes Wiki page does not exist.');
    }
    this.cdr.markForCheck();
  }
}
