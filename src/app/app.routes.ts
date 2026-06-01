import {inject} from '@angular/core';
import {Router, Routes, UrlTree} from '@angular/router';

/**
 * Checks whether WebGPU API is supported and an adapter can be requested.
 *
 * @async
 * @returns {Promise<boolean>} whether WebGPU API is supported.
 */
async function hasWebGpu(): Promise<boolean> {
  try {
    return !!await navigator?.gpu?.requestAdapter?.();
  } catch (e) {
    console.warn('WebGPU check failed:', e);
    return false;
  }
}

/**
 * Creates a route guard for WebGPU availability policy.
 *
 * @param {boolean} requireWebGpu whether the route requires WebGPU support.
 * @param {string} redirectPath redirect path when the policy is not met.
 * @returns {Promise<boolean | UrlTree>} whether WebGPU API is supported.
 */
function createWebGpuGuard(requireWebGpu: boolean, redirectPath: string): () => Promise<boolean | UrlTree> {
  return async() => {
    const router = inject(Router);
    const supported = await hasWebGpu();
    if (supported === requireWebGpu) {
      return true;
    }
    return router.createUrlTree([redirectPath]);
  };
}

/**
 * Guard for routes that require WebGPU.
 *
 * @type {() => Promise<boolean | UrlTree>}
 */
const webGpuGuard = createWebGpuGuard(true, '/unsupported');

/**
 * Guard for the unsupported route, which should only be accessible without WebGPU.
 *
 * @type {() => Promise<boolean | UrlTree>}
 */
const unsupportedGuard = createWebGpuGuard(false, '/404');

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
