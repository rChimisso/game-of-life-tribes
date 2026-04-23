import {inject} from '@angular/core';
import {Router, Routes, UrlTree} from '@angular/router';

/**
 * Checks whether WebGPU API is supported and an adapter can be requested.
 *
 * @async
 * @returns {Promise<boolean>} whether WebGPU API is supported.
 */
async function hasWebGpu(): Promise<boolean> {
  return false;
  // Try {
  //   Return !!await navigator?.gpu?.requestAdapter?.();
  // } catch (e) {
  //   Console.warn('WebGPU check failed:', e);
  //   Return false;
  // }
}

/**
 * Checks whether WebGPU API is supported in the current environment.  
 * If it is not, creates a new UrlTree that redirects to the unsupported page.
 *
 * @returns {Promise<boolean | UrlTree>} whether WebGPU API is supported.
 */
async function webGpuGuard(): Promise<boolean | UrlTree> {
  const router = inject(Router);
  if (await hasWebGpu()) {
    return true;
  }
  return router.createUrlTree(['/unsupported']);
}

/**
 * Checks whether WebGPU API is supported in the current environment.  
 * If it is, creates a new UrlTree that redirects to the 404 page, since the unsupported page should only be accessible if WebGPU is not supported.
 *
 * @returns {Promise<boolean | UrlTree>} whether WebGPU API is supported.
 */
async function unsupportedGuard(): Promise<boolean | UrlTree> {
  const router = inject(Router);
  if (await hasWebGpu()) {
    return router.createUrlTree(['/404']);
  }
  return true;
}

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
