import {PrerenderFallback, RenderMode, ServerRoute} from '@angular/ssr';

import wikiContent from './feature/wiki/model/wiki-content.generated.json';

/**
 * Static and client-rendered route policy.
 *
 * @type {ServerRoute[]}
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: 'wiki',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'wiki/:page',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.Client,
    getPrerenderParams: () => Promise.resolve(wikiContent.slugs.filter(slug => slug !== 'home').map(page => ({page})))
  },
  {
    path: 'unsupported',
    renderMode: RenderMode.Prerender
  },
  {
    path: '404',
    renderMode: RenderMode.Prerender
  },
  {
    path: '**',
    renderMode: RenderMode.Client
  }
];
