import {Routes} from '@angular/router';

import {unsupportedGuard, webGpuGuard} from './app-route-guards';

/**
 * Application routes.
 *
 * @type {Routes}
 */
export const routes: Routes = [
  {
    path: '',
    canActivate: [webGpuGuard],
    loadComponent: () => import('~gol/feature/home/home').then(m => m.HomePage)
  },
  {
    path: '404',
    loadComponent: () => import('~gol/feature/error/error').then(m => m.ErrorPage)
  },
  {
    path: 'wiki',
    loadComponent: () => import('~gol/feature/wiki/wiki').then(m => m.WikiPage)
  },
  {
    path: 'wiki/:page',
    loadComponent: () => import('~gol/feature/wiki/wiki').then(m => m.WikiPage)
  },
  {
    path: 'unsupported',
    canActivate: [unsupportedGuard],
    loadComponent: () => import('~gol/feature/unsupported/unsupported').then(m => m.UnsupportedPage)
  },
  {
    path: '**',
    loadComponent: () => import('~gol/feature/error/error').then(m => m.ErrorPage)
  }
];
