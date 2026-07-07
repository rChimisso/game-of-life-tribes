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
    canActivate: [webGpuGuard],
    loadComponent: () => import('~gol/feature/error/error').then(m => m.ErrorPage)
  },
  {
    path: 'unsupported',
    canActivate: [unsupportedGuard],
    loadComponent: () => import('~gol/feature/unsupported/unsupported').then(m => m.UnsupportedPage)
  },
  {
    path: '**',
    redirectTo: '404'
  }
];
